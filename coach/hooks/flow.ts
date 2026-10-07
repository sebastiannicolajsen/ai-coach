import type { CoachSuggestion } from '../types'
import {
  type Dollar,
  clearBand,
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
import { CLOSED_LOOP_RE, COMMIT_RE, DEPLOY_RE, LIMITS, OWN_DENY_TEXT, PUSH_RE } from './config'
import { makeOwnCheck } from './own'
import { blockedBecause, cadenceAllows, isFaded, isQuietPhase, recordShown } from './fade'
import { analyseTurn, notePrompt, writeBand } from './haiku'
import { noteKey, ruleNote } from './notes'

export type Push = 'commit' | 'push' | 'deploy' | null

export function classifyCommand(command: string): Push {
  if (DEPLOY_RE.test(command)) return 'deploy'
  if (PUSH_RE.test(command)) return 'push'
  if (COMMIT_RE.test(command)) return 'commit'
  return null
}

export const isReplyToLoop = (station: string, text: string): boolean =>
  station === 'review' && CLOSED_LOOP_RE.test(text)

const stem = (template: string): string => template.split('___')[0]!.trim().slice(0, 12)

export const wasAccepted = (shown: CoachSuggestion, submitted: string): boolean =>
  submitted.trim().includes(stem(shown.template))

const GAP_REASON: Record<string, string> = {
  plan: 'This looks like a new task.',
  own: 'This looks like it is going to someone.',
}

export async function onPrompt($: Dollar, text: string) {
  const prefs = (await $.get()).prefs
  const prev = (await $.get()).station
  if (isReplyToLoop(prev, text)) await pulseLoop($)

  const shown = (await $.get()).shownSuggest
  if (shown) {
    if (!wasAccepted(shown, text)) {
      const ignored = ((await $.get()).ignoredGaps[shown.kind] ?? 0) + 1
      await $.patch('ignoredGaps', g => ({ ...g, [shown.kind]: ignored }))
      if (ignored >= 2) await $.patch('silencedSession', s => [...s, shown.kind])
    }
    await set($, 'shownSuggest', null)
  }

  await dispatch($, { type: 'prompt_submit' })
  await clearBand($)
  await $.patch('turnIndex', n => n + 1)
  await set($, 'lastPrompt', text.slice(0, LIMITS.windowText))
  await set($, 'tools', [])
  await set($, 'pendingSuggest', null)

  if (isQuietPhase(prefs)) return
  const turn = (await $.get()).turnIndex
  const rule = ruleNote(text, prev)
  if (rule) await applyNote($, text, turn, rule)
  if (prefs.settings.cadence !== 'focus') $.clock.after(0, () => void runNote($, text, turn))
}

// The note is stored under the prompt's text and, once the row is known, under its id; the newest row also
// reads it straight from `latestNote`, so a note that arrives after the row has drawn still shows.
async function applyNote($: Dollar, text: string, turn: number, note: { text: string; kind: string | null }) {
  const prefs = (await $.get()).prefs
  if (note.kind) await savePrefs($, p => ({ ...p, fade: recordShown(p.fade, note.kind!, true) }))
  if (note.kind && !prefs.settings.preview && isFaded(prefs.fade, note.kind)) return
  const rows = (await $.get()).rows
  await $.patch('notes', n => ({
    ...n,
    [noteKey(text)]: note.text,
    ...(rows.userTurn === turn && rows.user ? { [rows.user]: note.text } : {}),
  }))
  await set($, 'latestNote', { turn, text: note.text })
}

async function runNote($: Dollar, text: string, turn: number) {
  const { good, suggestion, usage } = await notePrompt(complete($), text, (await $.get()).card)
  await recordUsage($, usage)
  if (good) await applyNote($, text, turn, good)
  const prefs = (await $.get()).prefs
  const silenced = (await $.get()).silencedSession
  if (suggestion && !silenced.includes(suggestion.kind) && !prefs.silenced.includes(suggestion.kind)) {
    await set($, 'pendingSuggest', suggestion)
  }
}

export async function showSuggestion($: Dollar) {
  const pending = (await $.get()).pendingSuggest
  if (!pending || (await $.get()).ownCheck || (await $.get()).station === 'own') return
  if ((await $.prompt.read()).text !== '') return
  const r = await $.prompt.suggest({ text: pending.template })
  $.ui.log(`suggest shown=${r.isShown}`, { to: 'debug' })
  if (r.isShown) {
    await set($, 'shownSuggest', pending)
    await set($, 'pendingSuggest', null)
  }
}

export async function onTurnComplete($: Dollar, answer: string, isAnswer: boolean) {
  await dispatch($, { type: 'turn_complete' })
  await set($, 'lastAnswer', answer.slice(0, LIMITS.windowText))
  const prompt = (await $.get()).lastPrompt
  await $.patch('fresh', f => [...f, heads(prompt), heads(answer)].filter(Boolean).slice(-6))
  if (!isAnswer) return
  const prefs = (await $.get()).prefs
  const turn = (await $.get()).turnIndex
  if (cadenceAllows(prefs.settings.cadence, turn)) $.clock.after(0, () => void runAnalysis($, turn))
  $.clock.after(0, () => void showSuggestion($))
  $.clock.after(0, () => void refreshUsage($))
}

export async function runAnalysis($: Dollar, turn: number) {
  const input = await turnInput($)
  const r = await analyseTurn(complete($), input)
  await recordUsage($, r.usage)
  await set($, 'card', r.card)
  if ((await $.get()).turnIndex !== turn) return

  let suggest: string | null = null
  for (const flag of r.flags) {
    const t = await dispatch($, { type: 'flag', flag: flag.type, hasEvidence: flag.hasEvidence }, flag.type.replace('_', ' '))
    if (t.suggest) suggest = t.suggest
    if (t.next.station !== input.station) break
  }
  if (!r.finding) return
  await raise($, turn, input, r.finding, suggest)
}

async function raise(
  $: Dollar,
  turn: number,
  input: Awaited<ReturnType<typeof turnInput>>,
  finding: NonNullable<Awaited<ReturnType<typeof analyseTurn>>['finding']>,
  suggest: string | null,
) {
  const prefs = (await $.get()).prefs
  const why = blockedBecause({
    prefs,
    kind: finding.kind,
    sessionDismissals: (await $.get()).sessionDismissals,
    silencedSession: (await $.get()).silencedSession,
    turnIndex: turn,
    lastBandTurn: (await $.get()).lastBandTurn,
  })
  if (why || (await $.get()).focus || (await $.get()).ownCheck) return
  const { band, usage } = await writeBand(complete($), input, finding.station, finding)
  await recordUsage($, usage)
  if (!band || (await $.get()).turnIndex !== turn || (await $.get()).focus) return
  const withSuggestion =
    !band.suggestion && suggest
      ? { ...band, suggestion: { station: suggest as typeof band.station, reason: GAP_REASON[suggest] ?? '' } }
      : band
  await showBand($, withSuggestion)
  await savePrefs($, p => ({ ...p, fade: recordShown(p.fade, finding.kind, false) }))
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
