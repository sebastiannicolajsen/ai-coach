import type { CoachFade, CoachPrefs } from '../types'

export const HISTORY = 5
export const FADE_AT = 3
export const SESSION_DISMISS_LIMIT = 2
export const TOTAL_DISMISS_LIMIT = 5
export const BAND_EVERY = 5

export type Phase = 'silent' | 'limited' | 'full'

export const phaseFor = (sessions: number): Phase =>
  sessions <= 1 ? 'silent' : sessions <= 3 ? 'limited' : 'full'

export function recordShown(fade: CoachFade, kind: string, isUnprompted: boolean): CoachFade {
  const history = [...(fade[kind] ?? []), isUnprompted].slice(-HISTORY)
  return { ...fade, [kind]: history }
}

export const isFaded = (fade: CoachFade, kind: string): boolean =>
  (fade[kind] ?? []).filter(Boolean).length >= FADE_AT

export function recordDismissal(prefs: CoachPrefs, kind: string): CoachPrefs {
  const total = (prefs.dismissals[kind] ?? 0) + 1
  const silenced =
    total >= TOTAL_DISMISS_LIMIT && !prefs.silenced.includes(kind)
      ? [...prefs.silenced, kind]
      : prefs.silenced
  return { ...prefs, dismissals: { ...prefs.dismissals, [kind]: total }, silenced }
}

export type Gate = {
  prefs: CoachPrefs
  kind: string
  sessionDismissals: Record<string, number>
  silencedSession: string[]
  turnIndex: number
  lastBandTurn: number
}

// Why a finding may not be raised, or null when it may.
export const isQuietPhase = (prefs: CoachPrefs): boolean =>
  !prefs.settings.preview && phaseFor(prefs.sessions) === 'silent'

export function blockedBecause(g: Gate): string | null {
  // Preview shows every finding; the cadence setting still applies upstream.
  if (g.prefs.settings.preview) return null
  const phase = phaseFor(g.prefs.sessions)
  if (phase === 'silent') return 'session-1'
  if (g.prefs.silenced.includes(g.kind)) return 'silenced'
  if (g.silencedSession.includes(g.kind)) return 'silenced-session'
  if ((g.sessionDismissals[g.kind] ?? 0) >= SESSION_DISMISS_LIMIT) return 'dismissed-twice'
  if (phase === 'full' && g.kind !== 'next_step' && isFaded(g.prefs.fade, g.kind)) return 'faded'
  if (phase === 'limited' && g.lastBandTurn > 0 && g.turnIndex - g.lastBandTurn < BAND_EVERY)
    return 'spacing'
  return null
}

export type LabelMode = 'all' | 'recent'
export const labelMode = (sessions: number): LabelMode => (sessions <= 3 ? 'all' : 'recent')

export function cadenceAllows(cadence: CoachPrefs['settings']['cadence'], turnIndex: number): boolean {
  if (cadence === 'every') return true
  if (cadence === 'third') return turnIndex % 3 === 0
  return false
}
