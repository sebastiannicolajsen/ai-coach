import type { CoachRoute, RouteEffort, RouteModel } from '../types'
import { type Dollar, addTrace, recordUsageAt, saveSettings, set } from './actions'
import { COACH_MODELS, DECLINE_TURNS, ROUTE_MODELS, ROUTER } from './config'
import { extractJson } from './haiku'
import { SYSTEM_ROUTE } from './prompts'
import { isRouteModel, parseRoute } from './parse-route'

export { isRouteModel, parseRoute }

const FAMILIES: readonly RouteModel[] = ['fable', 'opus', 'sonnet', 'haiku']

// "claude-opus-5-5", "opus" or "Opus 5.5 (1M context)" → opus.
export const familyOf = (id: string): RouteModel | null => FAMILIES.find(f => id.toLowerCase().includes(f)) ?? null

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

// The draft the recommendation was made for still leads what is in the box (or what was sent).
export const isSameDraft = (route: CoachRoute | null, text: string): boolean => {
  if (!route) return false
  const head = route.draft.trim().slice(0, 40)
  return head !== '' && text.trim().startsWith(head)
}

// The model Claude runs on now: the coach's choice, else the session's own.
export async function currentModel($: Dollar): Promise<RouteModel | null> {
  const st = await $.get()
  return st.modelChoice?.model ?? familyOf(st.sessionModel)
}

export async function refreshSessionModel($: Dollar) {
  try {
    await set($, 'sessionModel', await $.session.model())
  } catch {
    // Unknown: the recommendation still shows, without "switch from".
  }
}

// Asks the smallest model which model the draft suits. A draft it already judged, or a short one, is skipped.
export async function recommend($: Dollar, draft?: string): Promise<CoachRoute | null> {
  const st = await $.get()
  if (!st.prefs.enabled || !(st.prefs.settings.recommendModel || st.prefs.settings.modelSwitch !== 'off')) return null
  const text = (draft ?? (await $.prompt.read()).text).trim()
  if (words(text) < ROUTER.minWords || text.startsWith('/')) return null
  if (st.route && st.route.draft === text) return st.route
  let context = ''
  try {
    const u = await $.session.usage()
    if (u.context?.percent !== undefined) context = `${Math.round(u.context.percent)}% of a ${Math.round(u.context.window / 1000)}k window`
  } catch {
    // No figures: the model decides without them.
  }
  if (!st.sessionModel) await refreshSessionModel($)
  const current = await currentModel($)
  const prompt = [
    `Prompt:\n${text.slice(0, 800)}`,
    `Claude's last answer (start):\n${st.lastAnswer.slice(0, 400) || '(none yet)'}`,
    `Conversation so far: ${st.turnIndex} turns${context ? `, context ${context}` : ''}`,
    `Current model: ${current ?? 'unknown'}; current effort: ${(await currentEffort($)) ?? 'unknown'}`,
  ].join('\n\n')
  await set($, 'routeBusy', true)
  try {
    const r = await $.model.complete({
      model: ROUTER.model,
      system: SYSTEM_ROUTE,
      prompt,
      maxTokens: ROUTER.maxTokens,
      effort: ROUTER.effort,
      timeoutMs: ROUTER.timeoutMs,
    })
    await recordUsageAt($, r.usage, COACH_MODELS['haiku-5.5'].price)
    const parsed = r.isAnswered ? parseRoute(extractJson(r.text)) : null
    if (!parsed) return null
    const route = { draft: text, ...parsed }
    await set($, 'route', route)
    return route
  } catch {
    return null
  } finally {
    await set($, 'routeBusy', false)
  }
}

// The effort Claude runs at now: the coach's choice, else what the session's own requests carry.
export async function currentEffort($: Dollar): Promise<RouteEffort | null> {
  const st = await $.get()
  return st.modelChoice?.effort ?? st.sessionEffort
}

// A recommendation worth showing: another model, or the same one at another effort.
export function differs(route: CoachRoute | null, model: RouteModel | null, effort: RouteEffort | null): boolean {
  if (!route) return false
  return route.model !== model || (route.effort !== undefined && effort !== null && route.effort !== effort)
}

export const routeLabel = (m: RouteModel, effort?: RouteEffort | null) => (effort ? `${ROUTE_MODELS[m].label} · ${effort}` : ROUTE_MODELS[m].label)

export const ASK = {
  // First and marked, as the dialog marks the option it recommends.
  switchTo: (m: RouteModel, effort?: RouteEffort | null) => `Send with ${routeLabel(m, effort)} (Recommended)`,
  keep: (m: RouteModel) => `Keep ${ROUTE_MODELS[m].label}`,
  always: 'Always switch for me',
  never: 'Stop asking',
} as const

// At send, before anything runs. The prompt is judged; when another model suits it, "ask" holds it in Claude's
// own dialog, "auto" sends it there for this prompt, "off" leaves it. A model the person switched to stays.
export async function chooseForTurn($: Dollar, text: string) {
  const st = await $.get()
  const sticky = st.modelChoice?.sticky ? st.modelChoice : null
  const mode = st.prefs.settings.modelSwitch
  await set($, 'modelChoice', sticky)
  if (mode === 'off') {
    await set($, 'route', null)
    return
  }
  const route = isSameDraft(st.route, text) ? st.route : await recommend($, text)
  await set($, 'route', null)
  const base = sticky?.model ?? familyOf(st.sessionModel)
  const baseEffort = sticky?.effort ?? st.sessionEffort
  if (!route || !base || !differs(route, base, baseEffort)) return
  const choice = (sticky: boolean) => ({ model: route.model, sticky, ...(route.effort ? { effort: route.effort } : {}) })
  if (mode === 'auto') {
    await set($, 'modelChoice', choice(false))
    return
  }
  const declined = st.declined
  if (declined && declined.model === route.model && st.turnIndex - declined.turn < DECLINE_TURNS) return
  const options = [ASK.switchTo(route.model, route.effort), ASK.keep(base), ASK.always, ASK.never]
  const to = route.effort ? `${ROUTE_MODELS[route.model].label} at ${route.effort} effort` : ROUTE_MODELS[route.model].label
  let answer = ''
  try {
    answer = await $.ui.ask(`This looks like ${route.reason}. Send it with ${to} instead of ${ROUTE_MODELS[base].label}?`, {
      options,
      header: 'Model',
    })
  } catch {
    // Dismissed: the prompt goes as it is.
  }
  if (answer === options[0]) await switchTo($, route.model, route.effort)
  else if (answer === ASK.always) {
    await saveSettings($, { modelSwitch: 'auto' })
    await set($, 'modelChoice', choice(false))
  } else if (answer === ASK.never) await saveSettings($, { modelSwitch: 'off' })
  else await set($, 'declined', { model: route.model, turn: st.turnIndex })
}

// The step's model, when the coach chose one for the main loop.
export function stepModel(choice: CoachRoute['model'] | null | undefined): string | null {
  return choice ? ROUTE_MODELS[choice].id : null
}

// Changes the session's own model or effort through its /config row, as the person would, so the model picker
// at the foot of the prompt box shows the switch and they see where it is done. False when there is no such row
// or it refused; the caller then applies the switch to each request instead.
export async function setSessionRow($: Dollar, kind: 'model' | 'effort', want: string): Promise<boolean> {
  try {
    const rows = await $.config.list()
    const is = (r: { key: string; label: string }) =>
      kind === 'model' ? /^model$/i.test(r.key) || /^model$/i.test(r.label) : /effort/i.test(r.key) || /^effort/i.test(r.label)
    const row = rows.find(is)
    if (!row) return false
    let value = want
    if (row.options?.length) {
      const opt = row.options.find(o => o.toLowerCase() === want) ?? row.options.find(o => o.toLowerCase().includes(want))
      if (!opt) return false
      value = opt
    }
    const r = await $.config.set({ key: row.key, value })
    return !r.deny
  } catch {
    return false
  }
}

// A pick from the model slot, the picker or the dialog. It changes the session's own model and effort when it
// can, so the app's own picker shows it; otherwise it applies to each request until changed back. Picking the
// session's own model at its own effort goes back to it.
export async function switchTo($: Dollar, model: RouteModel, effort?: RouteEffort) {
  const st = await $.get()
  const keep = effort ?? st.modelChoice?.effort
  const isOwn = familyOf(st.sessionModel) === model && (!keep || keep === st.sessionEffort)
  if (isOwn) {
    await set($, 'modelChoice', null)
    return
  }
  const modelSet = familyOf(st.sessionModel) === model || (await setSessionRow($, 'model', model))
  const effortSet = !keep || keep === st.sessionEffort || (await setSessionRow($, 'effort', keep))
  if (modelSet) await refreshSessionModel($)
  if (effortSet && keep) await set($, 'sessionEffort', keep)
  const rest = { model, sticky: true, ...(keep && !effortSet ? { effort: keep } : {}) }
  await set($, 'modelChoice', modelSet && effortSet ? null : rest)
  await addTrace($, 'model', true, `${model}${keep ? ` · ${keep}` : ''}: ${modelSet && effortSet ? 'set in the session picker' : 'applied to each request'}`)
}

export async function setEffort($: Dollar, effort: RouteEffort) {
  const model = await currentModel($)
  if (model) await switchTo($, model, effort)
}

// The step's effort, when the coach chose one.
export const stepEffort = (choice: { effort?: RouteEffort } | null | undefined): RouteEffort | null => choice?.effort ?? null

export async function endTurnChoice($: Dollar) {
  const choice = (await $.get()).modelChoice
  if (choice && !choice.sticky) await set($, 'modelChoice', null)
}
