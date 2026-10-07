import { describe, expect, test } from 'claude-code/testing'
import type { CoachMachine, CoachStation } from '../types'
import { type CoachEvent, START, isOuter, step } from '../hooks/state'

const at = (station: CoachStation, focus: CoachStation | null = null): CoachMachine => ({ station, focus })
const to = (m: CoachMachine, e: CoachEvent) => step(m, e).next.station

describe('station machine, brief section 5.1', () => {
  test('session start goes to Plan from any station', () => {
    for (const s of ['plan', 'brief', 'review', 'own'] as const) {
      expect(to(at(s), { type: 'session_start' })).toBe('plan')
    }
    expect(START.station).toBe('plan')
  })

  test('the first prompt stays in Plan until Claude acts', () => {
    expect(to(at('plan'), { type: 'prompt_submit' })).toBe('plan')
  })

  test('prompt.submit moves any inner station to Brief', () => {
    expect(to(at('brief'), { type: 'prompt_submit' })).toBe('brief')
    expect(to(at('review'), { type: 'prompt_submit' })).toBe('brief')
  })

  test('turn.complete moves any inner station to Review', () => {
    expect(to(at('brief'), { type: 'turn_complete' })).toBe('review')
    expect(to(at('review'), { type: 'turn_complete' })).toBe('review')
  })

  test('turn.complete hands Plan over to Review and leaves Own open for its checks', () => {
    expect(to(at('plan'), { type: 'turn_complete' })).toBe('review')
    expect(to(at('own'), { type: 'turn_complete' })).toBe('own')
  })

  test('new_task and scope_change with evidence move an inner station to Plan', () => {
    for (const flag of ['new_task', 'scope_change'] as const) {
      expect(to(at('review'), { type: 'flag', flag, hasEvidence: true })).toBe('plan')
      expect(to(at('brief'), { type: 'flag', flag, hasEvidence: true })).toBe('plan')
    }
  })

  test('share_intent with evidence moves an inner station to Own', () => {
    expect(to(at('review'), { type: 'flag', flag: 'share_intent', hasEvidence: true })).toBe('own')
  })

  test('hysteresis: a flag without evidence never moves, it suggests', () => {
    const t = step(at('review'), { type: 'flag', flag: 'new_task', hasEvidence: false })
    expect(t.next.station).toBe('review')
    expect(t.suggest).toBe('plan')
    const s = step(at('brief'), { type: 'flag', flag: 'share_intent', hasEvidence: false })
    expect(s.next.station).toBe('brief')
    expect(s.suggest).toBe('own')
  })

  test('flags do nothing while already in an outer station', () => {
    expect(step(at('own'), { type: 'flag', flag: 'new_task', hasEvidence: true })).toEqual({
      next: at('own'),
      suggest: null,
    })
    expect(to(at('plan'), { type: 'flag', flag: 'share_intent', hasEvidence: true })).toBe('plan')
  })

  test('Plan is left when Claude starts acting or the plan is approved', () => {
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

  test('Own returns to the inner loop when the checks end or the next prompt arrives', () => {
    expect(to(at('own'), { type: 'own_done' })).toBe('review')
    expect(to(at('own'), { type: 'prompt_submit' })).toBe('brief')
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
    expect(step(at('review', 'plan'), { type: 'prompt_submit' }).next.focus).toBeNull()
    expect(step(at('plan', 'own'), { type: 'prompt_submit' }).next.focus).toBeNull()
  })

  test('focus_clear drops it without moving', () => {
    expect(step(at('review', 'plan'), { type: 'focus_clear' }).next).toEqual(at('review'))
  })

  test('automatic moves keep the focus until a prompt', () => {
    expect(step(at('brief', 'review'), { type: 'turn_complete' }).next.focus).toBe('review')
  })
})
