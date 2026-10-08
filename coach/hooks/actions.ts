import type { ModelUsage } from 'claude-code'
import type { CoachUserNote, CoachState, CoachBand, CoachPrefs, CoachSettings, CoachStation } from '../types'
import type { Ctx } from './ctx'
import { EMPTY_CARD } from './card'
import { COACH_MODELS, DEFAULT_SETTINGS, FOCUS_TEMPLATE, OWN_PASS_TEXT, STATION_NAME } from './config'
import { addCost } from './cost'
import { recordDismissal } from './fade'
import { type Complete, type TurnInput, writeBand } from './haiku'
import { makeOwnCheck } from './own'
import { noteKey } from './notes'
import { type CoachEvent, isOuter, step } from './state'
import { staticBand } from './validate'

export type Dollar = Ctx

export const REASON_MS = 4000
export const PANE_ID = 'coach'

export const set = <K extends keyof CoachState>($: Dollar, key: K, value: CoachState[K]) =>
  $.patch(key, () => value)

// Every coach call runs on the model chosen in the settings, with that model's time limit.
export const complete = ($: Dollar): Complete => async req => {
  const m = COACH_MODELS[(await $.get()).prefs.settings.model] ?? COACH_MODELS.haiku
  return $.model.complete({ ...req, model: m.id, timeoutMs: m.timeoutMs })
}

export const heads = (s: string) => s.trim().slice(0, 60)

const PERSISTED = ['enabled', 'sessions', 'hintTaps', 'settings', 'fade', 'dismissals', 'silenced'] as const

export async function loadPrefs($: Dollar): Promise<CoachPrefs> {
  const base = (await $.get()).prefs
  const stored: Partial<CoachPrefs> = {}
  for (const key of PERSISTED) {
    const v = await $.store.get(key)
    if (v !== undefined && v !== null) (stored as Record<string, unknown>)[key] = v
  }
  const next: CoachPrefs = {
    ...base,
    ...stored,
    settings: { ...DEFAULT_SETTINGS, ...(stored.settings ?? {}) },
  }
  await set($, 'prefs', next)
  return next
}

export async function savePrefs($: Dollar, fn: (p: CoachPrefs) => CoachPrefs): Promise<CoachPrefs> {
  const before = (await $.get()).prefs
  const after = fn(before)
  await set($, 'prefs', after)
  for (const key of PERSISTED) {
    if (after[key] !== before[key]) await $.store.set(key, after[key])
  }
  return after
}

export const saveSettings = ($: Dollar, patch: Partial<CoachSettings>) =>
  savePrefs($, p => ({ ...p, settings: { ...p.settings, ...patch } }))

export async function recordUsage($: Dollar, usage: ModelUsage | null) {
  const m = COACH_MODELS[(await $.get()).prefs.settings.model] ?? COACH_MODELS.haiku
  if (usage) await $.patch('cost', c => addCost(c, usage, m.price))
}

// The user row's data: its move, the ✓ note and an outer step, keyed by the prompt's text.
export async function upsertUserNote($: Dollar, key: string, patch: Partial<CoachUserNote>) {
  const turn = (await $.get()).turnIndex
  await $.patch('rowNotes', r => ({
    ...r,
    user: { ...r.user, [key]: { move: 'brief' as const, turn, ...r.user[key], ...patch } },
  }))
}

const TRACE_MAX = 8

export async function addTrace($: Dollar, call: string, ok: boolean, detail: string) {
  const turn = (await $.get()).turnIndex
  await $.patch('trace', t => [...t, { turn, call, ok, detail: detail.slice(0, 160) }].slice(-TRACE_MAX))
}

export async function dispatch($: Dollar, ev: CoachEvent, reason = '') {
  const m = { station: (await $.get()).station, focus: (await $.get()).focus }
  const t = step(m, ev)
  if (t.next.station !== m.station) await set($, 'station', t.next.station)
  if (t.next.focus !== m.focus) await set($, 'focus', t.next.focus)
  if (t.next.station !== m.station && isOuter(t.next.station)) await outerMove($, t.next.station, reason)
  return t
}

const OUTER_REASON: Record<string, string> = { plan: 'plan first', own: 'before it goes out' }

async function outerMove($: Dollar, to: CoachStation, reason: string) {
  const why = reason || OUTER_REASON[to] || ''
  await set($, 'stationReason', `Stepped out · ${why}`)
  $.clock.after(REASON_MS, () => void set($, 'stationReason', ''))
  const turn = (await $.get()).turnIndex
  if ((await $.get()).dividerTurn === turn) return
  await set($, 'dividerTurn', turn)
  $.ui.log(`${STATION_NAME[to]} · ${why}`, { to: 'debug' })
  await upsertUserNote($, noteKey((await $.get()).lastPrompt), { outer: `${STATION_NAME[to]} · ${why}` })
  const prompt = (await $.get()).lastPrompt
  const answer = (await $.get()).lastAnswer
  await $.patch('fresh', f => [...f, heads(prompt), heads(answer)].filter(Boolean).slice(-6))
}

export async function pulseLoop($: Dollar) {
  await set($, 'pulse', true)
  $.clock.after(300, () => void set($, 'pulse', false))
}

export async function openPane($: Dollar) {
  await $.ui.open({ id: PANE_ID, title: 'Coach' })
}

export async function setEnabled($: Dollar, enabled: boolean) {
  await savePrefs($, p => ({ ...p, enabled }))
  await set($, 'menuOpen', false)
  await set($, 'pickerOpen', false)
  if (!enabled) {
    await setBand($, null)
    await set($, 'ownCheck', null)
    await set($, 'focus', null)
  }
}

// The row a band is about: the newest reply for Review, the newest prompt for a Brief finding.
export function rowFor(band: CoachBand): string {
  if (band.station === 'review') return 'reply'
  if (band.station === 'brief' && band.source === 'finding') return 'user'
  return ''
}

export async function setBand($: Dollar, band: CoachBand | null) {
  await set($, 'band', band)
  await set($, 'bandRow', band ? rowFor(band) : '')
}

// The first Coach press ends the first-run line.
export async function toggleMenu($: Dollar) {
  await $.patch('menuOpen', o => !o)
  if ((await $.get()).prefs.hintTaps === 0) await savePrefs($, p => ({ ...p, hintTaps: p.hintTaps + 1 }))
}

export async function clearBand($: Dollar) {
  await setBand($, null)
  await set($, 'hiddenBand', null)
  await set($, 'bandLoading', false)
  await set($, 'ownCheck', null)
}

export async function dismissBand($: Dollar) {
  if ((await $.get()).ownCheck) {
    await set($, 'ownCheck', null)
    await dispatch($, { type: 'own_done' })
  }
  const band = (await $.get()).band
  if (band && band.source === 'finding') {
    await $.patch('sessionDismissals', d => ({ ...d, [band.kind]: (d[band.kind] ?? 0) + 1 }))
    await savePrefs($, p => recordDismissal(p, band.kind))
  }
  // Kept until the next prompt, so the Coach menu can bring the suggestions back.
  if (band) await set($, 'hiddenBand', band)
  await setBand($, null)
  await dispatch($, { type: 'focus_clear' })
}

export async function restoreBand($: Dollar) {
  const hidden = (await $.get()).hiddenBand
  if (!hidden) return
  await set($, 'hiddenBand', null)
  await set($, 'menuOpen', false)
  await setBand($, hidden)
}

export async function turnInput($: Dollar): Promise<TurnInput> {
  return {
    card: (await $.get()).card,
    user: (await $.get()).lastPrompt,
    answer: (await $.get()).lastAnswer,
    tools: (await $.get()).tools,
    station: (await $.get()).station,
    focus: (await $.get()).focus,
  }
}

// A coach template replaces the previous coach template, never the person's own text.
export async function fillFromCoach($: Dollar, text: string, isTemplate = false) {
  const box = (await $.prompt.read()).text
  const isOurs = box === '' || box === (await $.get()).lastFill
  if (!isOurs) return isTemplate ? undefined : $.prompt.fill({ text, mode: 'insert' })
  await set($, 'lastFill', text)
  return $.prompt.fill({ text, mode: 'replace' })
}

export async function refreshUsage($: Dollar) {
  try {
    const usage = await $.session.usage()
    const auth = await $.session.authorize()
    await set($, 'usage', { convUsd: usage.cost?.usd ?? null, isApprox: auth?.kind !== 'api-key' })
  } catch {
    // Keep the last known figure.
  }
}

// Focus shows the static band at once; the specific one replaces it when Haiku answers.
export async function focusStation($: Dollar, station: CoachStation) {
  await set($, 'menuOpen', false)
  await $.patch('prefs', p => ({ ...p, hintTaps: p.hintTaps + 1 }))
  await $.store.set('hintTaps', (await $.get()).prefs.hintTaps)
  await dispatch($, { type: 'focus', station })
  if (station === 'own') {
    await setBand($, null)
    await set($, 'ownCheck', makeOwnCheck((await $.get()).card, '', false))
    return
  }
  await set($, 'ownCheck', null)
  // The template shows dim in the empty prompt box (Tab takes it) and never overwrites typed text.
  const template = FOCUS_TEMPLATE[station]
  if (template) {
    const r = await $.prompt.suggest({ text: template }).catch(() => undefined)
    await addTrace($, 'suggest', r !== undefined, `focus ${station}: ${template.slice(0, 60)}`)
  }
  await setBand($, staticBand(station))
  const input = await turnInput($)
  if (input.user === '' && input.answer === '') return
  const { band, usage } = await writeBand(complete($), input, station, null, 'focus')
  await recordUsage($, usage)
  if ((await $.get()).focus !== station || !band) return
  await setBand($, band)
}

export async function showBand($: Dollar, band: CoachBand) {
  const turn = (await $.get()).turnIndex
  await setBand($, band)
  await set($, 'lastBandTurn', turn)
}

// Ending the checks of a held push lets the next push through once and asks Claude to retry it.
export async function finishOwn($: Dollar) {
  const held = (await $.get()).ownCheck?.held === true
  await set($, 'ownCheck', null)
  await dispatch($, { type: 'own_done' })
  await dispatch($, { type: 'focus_clear' })
  if (!held) return
  await set($, 'pushPass', true)
  await $.prompt.submit({ text: OWN_PASS_TEXT })
}

export async function tickOwn($: Dollar, index: number) {
  const check = (await $.get()).ownCheck
  if (!check) return
  const ticked = check.ticked.includes(index)
    ? check.ticked.filter(i => i !== index)
    : [...check.ticked, index]
  if (ticked.length >= check.checks.length) return finishOwn($)
  await set($, 'ownCheck', { ...check, ticked })
}

export async function resetSession($: Dollar) {
  await set($, 'card', EMPTY_CARD)
  await clearBand($)
}
