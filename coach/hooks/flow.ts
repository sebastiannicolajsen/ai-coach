import type { CoachBand, CoachStation, CoachSuggestion } from '../types'
import {
  type Dollar,
  addTrace,
  clearBand,
  upsertUserNote,
  complete,
  dispatch,
  heads,
  pulseLoop,
  refreshUsage,
  set,
  recordUsage,
  savePrefs,
  showBand,
  turnInput,
} from './actions'
import { COMMIT_RE, DEPLOY_RE, LIMITS, OWN_DENY_TEXT, PUSH_RE } from './config'
import { makeOwnCheck } from './own'
import { blockedBecause, cadenceAllows, isFaded, isQuietPhase, recordShown } from './fade'
import { analyseTurn, headTail, notePrompt, writeBand } from './haiku'
import { MOVE_CAPTION, classifyMove } from './moves'
import { freshGaps, gapNames, gapTemplate, missingFrom } from './gaps'
import { noteKey } from './notes'
import { cut, isVerbatim, staticBand } from './validate'
import { endTurnChoice } from './route'

export type Push = 'commit' | 'push' | 'deploy' | null

export function classifyCommand(command: string): Push {
  if (DEPLOY_RE.test(command)) return 'deploy'
  if (PUSH_RE.test(command)) return 'push'
  if (COMMIT_RE.test(command)) return 'commit'
  return null
}

const stem = (template: string): string => template.split(/___|\[/)[0]!.trim().slice(0, 12)

export const wasAccepted = (shown: CoachSuggestion, submitted: string): boolean =>
  submitted.trim().includes(stem(shown.template))

const GAP_REASON: Record<string, string> = {
  plan: 'This looks like a new task.',
  own: 'This looks like it is going to someone.',
}

export async function onPrompt($: Dollar, text: string) {
  const st = await $.get()
  const prefs = st.prefs
  const prev = st.station
  const mv = classifyMove(text, prev)
  if (mv.move === 'review' && prev === 'review') await pulseLoop($)

  const shown = st.shownSuggest
  if (shown) {
    if (!wasAccepted(shown, text)) {
      const ignored = (st.ignoredGaps[shown.kind] ?? 0) + 1
      await $.patch('ignoredGaps', g => ({ ...g, [shown.kind]: ignored }))
      if (ignored >= 2) await $.patch('silencedSession', s => [...s, shown.kind])
    }
    await set($, 'shownSuggest', null)
  }

  await clearBand($)
  await $.patch('turnIndex', n => n + 1)
  const turn = (await $.get()).turnIndex
  await set($, 'lastPrompt', text.slice(0, LIMITS.windowText))
  await set($, 'tools', [])
  await set($, 'pendingSuggest', null)
  await set($, 'moveNote', mv.caption ?? MOVE_CAPTION[mv.move])
  // Leaving Review for a new instruction is fine, but worth naming: the chapter line says where they came from.
  const from = prev === 'review' && mv.move === 'brief' ? prev : undefined
  await upsertUserNote($, noteKey(text), { move: mv.move, turn, ...(from ? { from } : {}), ...(mv.caption ? { caption: mv.caption } : {}) })
  await dispatch($, { type: 'prompt_submit', move: mv.move }, mv.caption ?? OUTER_MOVE_REASON[mv.move] ?? '')
  // Taking a result as final brings up the Own checks; nothing is held, the person ticks or moves on. A push or
  // send instruction gets its checks when the push itself happens.
  if (mv.caption === 'taking it as final' && !(await $.get()).ownCheck) {
    await set($, 'ownCheck', makeOwnCheck((await $.get()).card, '', false))
  }
  await addTrace($, 'move', true, `${mv.move} · ${mv.hit ? `"${mv.hit.slice(0, 40)}"` : 'default'} · "${text.slice(0, 40)}"`)

  if (isQuietPhase(prefs)) {
    await addTrace($, 'gate', false, 'session 1 is quiet: no notes or suggestions (/coach preview shows them)')
    return
  }
  if (mv.note) await applyNote($, text, turn, { text: mv.note, kind: NOTE_KIND[mv.note] ?? null })
  // A short instruction missing what its kind of request needs gets its note and template at once, by rule;
  // the note names only what was not already named on an earlier prompt.
  const missing = mv.move === 'brief' || mv.caption === 'starting new work' ? missingFrom(text) : []
  const earlier = Object.entries((await $.get()).rowNotes.user)
    .filter(([k, n]) => k !== noteKey(text) && n.gap)
    .map(([, n]) => n.gap!)
  const gaps = freshGaps(missing, earlier)
  if (gaps.length > 0 && !mv.note) {
    await upsertUserNote($, noteKey(text), { gap: gapNames(gaps), turn })
    await set($, 'pendingSuggest', { template: gapTemplate(text, gaps), kind: 'brief_gap' })
    await addTrace($, 'gaps', true, `missing ${gapNames(gaps)}`)
  }
  if (prefs.settings.cadence !== 'focus') {
    // The row under the message shows a spinner until its feedback is written.
    await set($, 'noteBusy', noteKey(text))
    $.clock.after(0, () => void runNote($, text, turn))
  }
  else await addTrace($, 'gate', false, 'cadence "on focus only" skips call C')
}

// "Analyse [question] for [audience]" → "question, audience".
export const slotNames = (template: string): string =>
  [...template.matchAll(/\[([^\]\n]{2,24})\]/g)]
    .map(m => m[1]!.split(/\/| or /)[0]!.trim())
    .slice(0, 3)
    .join(', ')

const OUTER_MOVE_REASON: Record<string, string> = { plan: 'asked for a plan', own: 'about to ship' }
const NOTE_KIND: Record<string, string> = { 'Corrected Claude': 'silent_assumption', 'Questioned the result': 'unchecked_claim' }

// The ✓ note belongs to the user row, found by the prompt's text or, once known, the row's id.
async function applyNote($: Dollar, text: string, turn: number, note: { text: string; kind: string | null }) {
  const prefs = (await $.get()).prefs
  if (note.kind) await savePrefs($, p => ({ ...p, fade: recordShown(p.fade, note.kind!, true) }))
  if (note.kind && !prefs.settings.preview && isFaded(prefs.fade, note.kind)) return
  await upsertUserNote($, noteKey(text), { note: note.text, turn })
  const rows = (await $.get()).rows
  if (rows.userTurn === turn && rows.user) await upsertUserNote($, rows.user, { note: note.text, turn })
}

async function runNote($: Dollar, text: string, turn: number) {
  try {
    await writeNote($, text, turn)
  } finally {
    await $.patch('noteBusy', k => (k === noteKey(text) ? '' : k))
  }
}

async function writeNote($: Dollar, text: string, turn: number) {
  const r = await notePrompt(complete($), text, (await $.get()).card)
  await recordUsage($, r.usage)
  if (r.good) await applyNote($, text, turn, r.good)
  if (r.caption) await upsertUserNote($, noteKey(text), { detail: r.caption })
  await addTrace(
    $,
    'C',
    r.info.isAnswered,
    `${r.info.reason} · note ${r.good ? `"${r.good.text.slice(0, 30)}"` : 'none'} · template ${r.suggestion ? 'yes' : 'none'} · move ${r.move ?? 'none'}`,
  )
  // Haiku only decides when no rule matched: a rule's Plan, Own or Review stands ("kundebrief" is not a Brief).
  if (r.move && !classifyMove(text, 'brief').hit && (await $.get()).turnIndex === turn) await overrideMove($, text, r.move)
  const st = await $.get()
  if (r.suggestion && !st.silencedSession.includes(r.suggestion.kind) && !st.prefs.silenced.includes(r.suggestion.kind)) {
    await set($, 'pendingSuggest', r.suggestion)
    // A ✓ wins the line under the message; otherwise it names what the prompt could still say.
    const gap = slotNames(r.suggestion.template)
    const ruled = (await $.get()).rowNotes.user[noteKey(text)]?.gap
    if (!r.good && gap && !ruled) await upsertUserNote($, noteKey(text), { gap, turn })
  }
}

// Haiku's move, with evidence from the prompt, wins over the keyword rule while the turn is still running.
async function overrideMove($: Dollar, text: string, move: CoachStation) {
  const st = await $.get()
  const key = noteKey(text)
  const ruled = st.rowNotes.user[key]?.move
  if (!ruled || ruled === move || st.station !== ruled) return
  await upsertUserNote($, key, { move })
  await set($, 'moveNote', MOVE_CAPTION[move])
  await dispatch($, { type: 'move', move }, OUTER_MOVE_REASON[move] ?? '')
}

export async function showSuggestion($: Dollar, attempt = 0) {
  const pending = (await $.get()).pendingSuggest
  if (!pending) return
  if ((await $.get()).ownCheck || (await $.get()).station === 'own') {
    await addTrace($, 'suggest', false, 'an Own check is active')
    return
  }
  if ((await $.prompt.read()).text !== '') {
    await addTrace($, 'suggest', false, attempt === 0 ? 'the prompt box has text; retrying once' : 'the prompt box still has text')
    if (attempt === 0) $.clock.after(RETRY_MS, () => void showSuggestion($, 1))
    return
  }
  const r = await $.prompt.suggest({ text: pending.template })
  $.ui.log(`suggest shown=${r.isShown}`, { to: 'debug' })
  await addTrace($, 'suggest', r.isShown, r.isShown ? `shown "${pending.template.slice(0, 40)}"` : 'the engine did not show it')
  if (r.isShown) {
    await set($, 'shownSuggest', pending)
    await set($, 'pendingSuggest', null)
  }
}

const RETRY_MS = 4000

export async function onTurnComplete($: Dollar, answer: string, isAnswer: boolean) {
  await catchUpOnPrompt($)
  await dispatch($, { type: 'turn_complete', ownPending: (await $.get()).ownCheck !== null })
  await set($, 'moveNote', '')
  await set($, 'lastAnswer', headTail(answer, LIMITS.answerText))
  const prompt = (await $.get()).lastPrompt
  await $.patch('fresh', f => [...f, heads(prompt), heads(answer)].filter(Boolean).slice(-6))
  await endTurnChoice($)
  if (!isAnswer) return
  const prefs = (await $.get()).prefs
  const turn = (await $.get()).turnIndex
  if (cadenceAllows(prefs.settings.cadence, turn)) {
    // A spinner holds the band's place while the suggestions are written, so the person sees work going on.
    const now = await $.get()
    if (!isQuietPhase(prefs) && !now.focus && !now.ownCheck) await set($, 'bandLoading', true)
    $.clock.after(0, () => void runAnalysis($, turn))
  } else await addTrace($, 'gate', false, `cadence "${prefs.settings.cadence}" skips the analysis on turn ${turn}`)
  $.clock.after(0, () => void showSuggestion($))
  $.clock.after(0, () => void refreshUsage($))
}

const MAX_CHECK = 2
const CHECK_CHARS = 24

// The very first prompt of a chat can reach the engine before the coach has started, so prompt.submit never
// runs for it. When the reply ends and the latest prompt has no record, read it from the conversation and
// process it now: its step, feedback and template.
async function catchUpOnPrompt($: Dollar) {
  try {
    // Slash commands and the engine's own markup are no prompts of the person's.
    const isPrompt = (t: string) => t.trim() !== '' && !t.trim().startsWith('/') && !t.includes('<command-')
    const last = (await $.session.messages()).filter(m => m.role === 'user' && isPrompt(m.text)).at(-1)
    if (!last) return
    const known = (await $.get()).rowNotes.user[noteKey(last.text)]
    if (known) return
    await addTrace($, 'move', true, 'caught up on a prompt the coach had not seen')
    await onPrompt($, last.text)
  } catch {
    // Nothing to catch up on.
  }
}

export async function runAnalysis($: Dollar, turn: number) {
  try {
    await analyse($, turn)
  } finally {
    // In preview a turn never ends without suggestions: the step's own when nothing better came back.
    const st = await $.get()
    if (st.turnIndex === turn) {
      await set($, 'bandLoading', false)
      if (st.prefs.settings.preview && !st.band && !st.focus && !st.ownCheck) {
        await showBand($, { ...staticBand(st.station), source: 'fallback' })
        await addTrace($, 'band', true, `preview: ${st.station} suggestions (nothing specific came back)`)
      }
    }
  }
}

async function analyse($: Dollar, turn: number) {
  const input = await turnInput($)
  const isPreview = (await $.get()).prefs.settings.preview
  const r = await analyseTurn(complete($), input, isPreview)
  await recordUsage($, r.usage)
  await set($, 'card', r.card)
  await addTrace($, 'A', r.info.isAnswered, `${r.info.reason} · finding ${r.rawFinding} → ${r.findingWhy} · ${r.flags.length} flags`)
  if ((await $.get()).turnIndex !== turn) {
    await addTrace($, 'gate', false, 'the person had already moved on')
    return
  }

  if (r.stepNote) await set($, 'stationNote', r.stepNote)
  // The model the likely next prompt suits, for the model button; a draft's own recommendation wins.
  const st0 = await $.get()
  if (r.nextModel && (st0.prefs.settings.recommendModel || st0.prefs.settings.modelSwitch !== 'off') && !st0.route?.draft) {
    await set($, 'route', { draft: '', ...r.nextModel })
  }

  const claims = r.card.unchecked_claims.filter(c => isVerbatim(input.answer, c)).slice(-MAX_CHECK)
  await set($, 'rowNotes', { ...(await $.get()).rowNotes, reply: { turn, check: claims.map(c => cut(c, CHECK_CHARS)) } })

  let suggest: string | null = null
  for (const flag of r.flags) {
    const t = await dispatch($, { type: 'flag', flag: flag.type, hasEvidence: flag.hasEvidence })
    if (t.suggest && !suggest) suggest = t.suggest
  }
  if (!r.finding) {
    // No finding: the next-step chips, written for this conversation, when the band may show at all.
    if (r.next) await raise($, turn, input, { station: r.next.station, kind: 'next_step', evidence: r.next.evidence }, suggest, r.next)
    else await addTrace($, 'band', false, 'no next-step chips survived')
    return
  }
  await raise($, turn, input, r.finding, suggest, r.band ?? r.next)
}

async function raise(
  $: Dollar,
  turn: number,
  input: Awaited<ReturnType<typeof turnInput>>,
  finding: NonNullable<Awaited<ReturnType<typeof analyseTurn>>['finding']>,
  suggest: string | null,
  ready: CoachBand | null = null,
) {
  const st = await $.get()
  const why = blockedBecause({
    prefs: st.prefs,
    kind: finding.kind,
    sessionDismissals: st.sessionDismissals,
    silencedSession: st.silencedSession,
    turnIndex: turn,
    lastBandTurn: st.lastBandTurn,
  })
  if (why || st.focus || st.ownCheck) {
    await addTrace($, 'gate', false, `${finding.kind} not raised: ${why ?? (st.focus ? 'a focus is active' : 'an Own check is active')}`)
    return
  }
  // Call A usually brings its own chips; only without them is the second call made.
  let band = ready
  if (band) await addTrace($, 'B', true, `skipped: call A brought ${band.chips.length} chips`)
  else {
    const r = await writeBand(complete($), input, finding.station, finding, 'finding', st.prefs.settings.preview)
    await recordUsage($, r.usage)
    const dropped = r.chips.dropped.length ? ` (dropped: ${[...new Set(r.chips.dropped)].join(', ')})` : ''
    await addTrace($, 'B', r.info.isAnswered, `${r.info.reason} · chips ${r.chips.kept}/${r.chips.returned} kept${dropped} · band ${r.band ? 'yes' : 'no'}`)
    // A finding never vanishes because call B was unreadable: show the station's own chips with the finding.
    band = r.band ?? { ...staticBand(finding.station), kind: finding.kind, evidence: finding.evidence.slice(0, 2), source: 'finding' as const }
    if (!r.band) await addTrace($, 'B', false, `fallback band for ${finding.kind}`)
  }
  if ((await $.get()).turnIndex !== turn || (await $.get()).focus) return
  const withSuggestion =
    !band.suggestion && suggest
      ? { ...band, suggestion: { station: suggest as typeof band.station, reason: GAP_REASON[suggest] ?? '' } }
      : band
  await showBand($, withSuggestion)
  // Next steps are not a behaviour to grow out of, so they never fade.
  if (finding.kind !== 'next_step') await savePrefs($, p => ({ ...p, fade: recordShown(p.fade, finding.kind, false) }))
}

export async function askPausePreference($: Dollar) {
  await set($, 'askedPause', true)
  try {
    const answer = await $.ui.ask('Pause before a push so there is a moment to check it?', {
      options: ['Pause pushes', 'Just show the checks'],
      header: 'Own',
    })
    await savePrefs($, p => ({
      ...p,
      settings: { ...p.settings, pausePushes: answer === 'Pause pushes' ? 'on' : 'off' },
    }))
  } catch {
    // Dismissed: ask again on a later push.
    await set($, 'askedPause', false)
  }
}

// Returns a denial for a push that must wait for the Own band, else null.
export async function onPush($: Dollar, kind: Exclude<Push, null>, command = ''): Promise<string | null> {
  const isInteractive = (await $.session.surface()) !== null
  const canHold = kind !== 'commit' && isInteractive
  if (canHold && (await $.get()).pushPass) {
    await set($, 'pushPass', false)
    return null
  }
  if (canHold && (await $.get()).prefs.settings.pausePushes === 'unset' && !(await $.get()).askedPause) {
    await askPausePreference($)
  }
  const isHeld = canHold && (await $.get()).prefs.settings.pausePushes === 'on'
  const reason = isHeld ? 'push paused' : kind === 'commit' ? 'git commit' : kind === 'push' ? 'git push' : 'deploy'
  await dispatch($, { type: 'push' }, reason)
  const existing = (await $.get()).ownCheck
  if (!existing) await set($, 'ownCheck', makeOwnCheck((await $.get()).card, command, isHeld))
  else if (isHeld && !existing.held) await set($, 'ownCheck', { ...existing, held: true })
  return isHeld ? OWN_DENY_TEXT : null
}
