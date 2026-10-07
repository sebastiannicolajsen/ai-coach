import { describe, expect, test } from 'claude-code/testing'
import type { CoachPrefs } from '../types'
import { DEFAULT_SETTINGS } from '../hooks/config'
import { blockedBecause, cadenceAllows, isFaded, labelMode, phaseFor, recordDismissal, recordShown } from '../hooks/fade'

const prefs = (over: Partial<CoachPrefs> = {}): CoachPrefs => ({
  enabled: true,
  sessions: 5,
  hintTaps: 1,
  settings: DEFAULT_SETTINGS,
  fade: {},
  dismissals: {},
  silenced: [],
  ...over,
})

const gate = (p: CoachPrefs, over = {}) => ({
  prefs: p,
  kind: 'unchecked_claim',
  sessionDismissals: {},
  silencedSession: [],
  turnIndex: 10,
  lastBandTurn: 0,
  ...over,
})

describe('ease-in', () => {
  test('phases by session', () => {
    expect([1, 2, 3, 4, 9].map(phaseFor)).toEqual(['silent', 'limited', 'limited', 'full', 'full'])
  })

  test('session 1 is silent', () => {
    expect(blockedBecause(gate(prefs({ sessions: 1 })))).toBe('session-1')
  })

  test('sessions 2 and 3 allow at most one band per 5 turns', () => {
    const p = prefs({ sessions: 2 })
    expect(blockedBecause(gate(p, { turnIndex: 4, lastBandTurn: 1 }))).toBe('spacing')
    expect(blockedBecause(gate(p, { turnIndex: 6, lastBandTurn: 1 }))).toBeNull()
    expect(blockedBecause(gate(p, { turnIndex: 2, lastBandTurn: 0 }))).toBeNull()
  })

  test('label mode: all in sessions 1-3, recent after', () => {
    expect([1, 3, 4].map(labelMode)).toEqual(['all', 'all', 'recent'])
  })
})

describe('fade', () => {
  test('keeps the last five and fades at three unprompted', () => {
    let fade = {}
    for (const shown of [true, false, true, false, false, true]) fade = recordShown(fade, 'k', shown)
    expect((fade as Record<string, boolean[]>).k).toEqual([false, true, false, false, true])
    expect(isFaded(fade, 'k')).toBe(false)
    fade = recordShown(fade, 'k', true)
    expect(isFaded(fade, 'k')).toBe(true)
  })

  test('a faded kind is blocked from session 4 on, not in sessions 2-3', () => {
    const fade = { unchecked_claim: [true, true, true] }
    expect(blockedBecause(gate(prefs({ fade })))).toBe('faded')
    expect(blockedBecause(gate(prefs({ fade, sessions: 3 })))).toBeNull()
  })
})

describe('dismissals', () => {
  test('two in a session silence the kind for the session', () => {
    expect(blockedBecause(gate(prefs(), { sessionDismissals: { unchecked_claim: 2 } }))).toBe('dismissed-twice')
    expect(blockedBecause(gate(prefs(), { sessionDismissals: { unchecked_claim: 1 } }))).toBeNull()
  })

  test('five in total silence it until re-enabled', () => {
    let p = prefs()
    for (let i = 0; i < 4; i++) p = recordDismissal(p, 'unchecked_claim')
    expect(p.silenced).toEqual([])
    p = recordDismissal(p, 'unchecked_claim')
    expect(p.silenced).toEqual(['unchecked_claim'])
    expect(blockedBecause(gate(p))).toBe('silenced')
    expect(recordDismissal(p, 'unchecked_claim').silenced).toEqual(['unchecked_claim'])
  })

  test('session silencing from ignored suggestions', () => {
    expect(blockedBecause(gate(prefs(), { silencedSession: ['unchecked_claim'] }))).toBe('silenced-session')
  })
})

describe('cadence', () => {
  test('every, third and focus only', () => {
    expect(cadenceAllows('every', 1)).toBe(true)
    expect([1, 2, 3, 6].map(n => cadenceAllows('third', n))).toEqual([false, false, true, true])
    expect(cadenceAllows('focus', 3)).toBe(false)
  })
})
