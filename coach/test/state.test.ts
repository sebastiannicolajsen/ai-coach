import { describe, expect, test } from 'claude-code/testing'
import type { CoachMachine, CoachStation } from '../types'
import { type CoachEvent, START, isOuter, step } from '../hooks/state'

const at = (station: CoachStation, focus: CoachStation | null = null): CoachMachine => ({ station, focus })
const to = (m: CoachMachine, e: CoachEvent) => step(m, e).next.station

describe('station machine: the rail says what to do now, the person move decides it', () => {
  test('session start goes to Plan from any station', () => {
    for (const s of ['plan', 'brief', 'review', 'own'] as const) {
      expect(to(at(s), { type: 'session_start' })).toBe('plan')
    }
    expect(START.station).toBe('plan')
  })

  test('prompt.submit takes the station of the person move, from any station', () => {
    for (const from of ['plan', 'brief', 'review', 'own'] as const) {
      for (const move of ['plan', 'brief', 'review', 'own'] as const) {
        expect(to(at(from), { type: 'prompt_submit', move })).toBe(move)
      }
    }
  })

  test('Haiku can correct the move while the turn runs', () => {
    expect(to(at('brief'), { type: 'move', move: 'review' })).toBe('review')
  })

  test('turn.complete is always Review, except while an Own check is pending', () => {
    for (const s of ['plan', 'brief', 'review', 'own'] as const) {
      expect(to(at(s), { type: 'turn_complete' })).toBe('review')
    }
    expect(to(at('own'), { type: 'turn_complete', ownPending: true })).toBe('own')
    expect(to(at('brief'), { type: 'turn_complete', ownPending: true })).toBe('review')
  })

  test('Haiku flags never move the rail; with evidence they only suggest', () => {
    const t = step(at('review'), { type: 'flag', flag: 'new_task', hasEvidence: true })
    expect(t.next.station).toBe('review')
    expect(t.suggest).toBe('plan')
    expect(step(at('brief'), { type: 'flag', flag: 'scope_change', hasEvidence: true }).next.station).toBe('brief')
    expect(step(at('brief'), { type: 'flag', flag: 'share_intent', hasEvidence: true }).suggest).toBe('own')
  })

  test('a flag without evidence, or for the station already shown, suggests nothing', () => {
    expect(step(at('review'), { type: 'flag', flag: 'new_task', hasEvidence: false })).toEqual({ next: at('review'), suggest: null })
    expect(step(at('own'), { type: 'flag', flag: 'share_intent', hasEvidence: true }).suggest).toBeNull()
  })

  test('Plan is entered by a plan file and left when Claude acts or the plan is approved', () => {
    expect(to(at('review'), { type: 'plan_written' })).toBe('plan')
    expect(to(at('plan'), { type: 'acting' })).toBe('brief')
    expect(to(at('plan'), { type: 'plan_approved' })).toBe('brief')
    expect(to(at('review'), { type: 'acting' })).toBe('review')
  })

  test('git commit, push and deploy move any other station to Own', () => {
    for (const s of ['plan', 'brief', 'review'] as const) {
      expect(to(at(s), { type: 'push' })).toBe('own')
    }
    expect(to(at('own'), { type: 'push' })).toBe('own')
  })

  test('Own returns to Review when the checks end', () => {
    expect(to(at('own'), { type: 'own_done' })).toBe('review')
    expect(to(at('review'), { type: 'own_done' })).toBe('review')
  })

  test('isOuter names Plan and Own', () => {
    expect(['plan', 'own'].every(s => isOuter(s as CoachStation))).toBe(true)
    expect(isOuter('brief') || isOuter('review')).toBe(false)
  })
})

describe('focus', () => {
  test('tapping a station sets the focus and leaves the position alone', () => {
    const t = step(at('review'), { type: 'focus', station: 'plan' })
    expect(t.next).toEqual(at('review', 'plan'))
  })

  test('the next prompt clears the focus', () => {
    expect(step(at('review', 'plan'), { type: 'prompt_submit', move: 'brief' }).next.focus).toBeNull()
    expect(step(at('plan', 'own'), { type: 'prompt_submit', move: 'review' }).next.focus).toBeNull()
  })

  test('focus_clear drops it without moving', () => {
    expect(step(at('review', 'plan'), { type: 'focus_clear' }).next).toEqual(at('review'))
  })

  test('automatic moves keep the focus until a prompt', () => {
    expect(step(at('brief', 'review'), { type: 'turn_complete' }).next.focus).toBe('review')
  })
})
