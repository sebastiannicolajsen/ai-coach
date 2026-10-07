import type { CoachMachine, CoachStation } from '../types'
import { OUTER } from './config'

export type CoachFlagType = 'new_task' | 'scope_change' | 'share_intent'

export type CoachEvent =
  | { type: 'session_start' }
  | { type: 'prompt_submit' }
  | { type: 'turn_complete' }
  | { type: 'acting' }
  | { type: 'push' }
  | { type: 'plan_approved' }
  | { type: 'own_done' }
  | { type: 'flag'; flag: CoachFlagType; hasEvidence: boolean }
  | { type: 'focus'; station: CoachStation }
  | { type: 'focus_clear' }

export type Transition = { next: CoachMachine; suggest: CoachStation | null }

export const START: CoachMachine = { station: 'plan', focus: null }

export const isOuter = (s: CoachStation) => OUTER.includes(s)

const FLAG_TARGET: Record<CoachFlagType, CoachStation> = {
  new_task: 'plan',
  scope_change: 'plan',
  share_intent: 'own',
}

const stay = (m: CoachMachine): Transition => ({ next: m, suggest: null })
const go = (m: CoachMachine, station: CoachStation): Transition => ({
  next: { ...m, station },
  suggest: null,
})

export function step(m: CoachMachine, e: CoachEvent): Transition {
  switch (e.type) {
    case 'session_start':
      return { next: { station: 'plan', focus: null }, suggest: null }
    case 'prompt_submit': {
      const cleared = { ...m, focus: null }
      // Plan (first prompt included) is left by Claude acting; a new prompt ends an Own check.
      return m.station === 'plan' ? stay(cleared) : go(cleared, 'brief')
    }
    case 'turn_complete':
      // Own stays so its checks can be answered; Plan hands over to Review.
      return m.station === 'own' ? stay(m) : go(m, 'review')
    case 'acting':
      return m.station === 'plan' ? go(m, 'brief') : stay(m)
    case 'plan_approved':
      return m.station === 'plan' ? go(m, 'brief') : stay(m)
    case 'push':
      return m.station === 'own' ? stay(m) : go(m, 'own')
    case 'own_done':
      return m.station === 'own' ? go(m, 'review') : stay(m)
    case 'flag': {
      if (isOuter(m.station)) return stay(m)
      const target = FLAG_TARGET[e.flag]
      return e.hasEvidence ? go(m, target) : { next: m, suggest: target }
    }
    case 'focus':
      return stay({ ...m, focus: e.station })
    case 'focus_clear':
      return stay({ ...m, focus: null })
  }
}
