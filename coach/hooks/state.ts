import type { CoachMachine, CoachStation } from '../types'
import { OUTER } from './config'

export type CoachFlagType = 'new_task' | 'scope_change' | 'share_intent'

export type CoachEvent =
  | { type: 'session_start' }
  | { type: 'prompt_submit'; move: CoachStation }
  | { type: 'move'; move: CoachStation }
  | { type: 'turn_complete'; ownPending?: boolean }
  | { type: 'acting' }
  | { type: 'plan_written' }
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

// The rail says what the person should do now; the person's own move (or a tool) decides it.
export function step(m: CoachMachine, e: CoachEvent): Transition {
  switch (e.type) {
    case 'session_start':
      return { next: { station: 'plan', focus: null }, suggest: null }
    case 'prompt_submit':
      return go({ ...m, focus: null }, e.move)
    case 'move':
      return go(m, e.move)
    case 'turn_complete':
      // Your turn to check. Only a pending Own check keeps Own on the rail.
      return e.ownPending && m.station === 'own' ? stay(m) : go(m, 'review')
    case 'acting':
    case 'plan_approved':
      return m.station === 'plan' ? go(m, 'brief') : stay(m)
    case 'plan_written':
      return go(m, 'plan')
    case 'push':
      return m.station === 'own' ? stay(m) : go(m, 'own')
    case 'own_done':
      return m.station === 'own' ? go(m, 'review') : stay(m)
    case 'flag':
      // Haiku never moves the rail: a flag with evidence becomes a suggestion line in the band.
      return e.hasEvidence && FLAG_TARGET[e.flag] !== m.station
        ? { next: m, suggest: FLAG_TARGET[e.flag] }
        : stay(m)
    case 'focus':
      return stay({ ...m, focus: e.station })
    case 'focus_clear':
      return stay({ ...m, focus: null })
  }
}
