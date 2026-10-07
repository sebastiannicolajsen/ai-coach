import type { CoachBand, CoachStation } from '../types'

// What a band is about, shown dim at the end of its quote row.
export const targetOf = (station: CoachStation): string =>
  station === 'brief' ? 'your last prompt' : station === 'own' ? "what you're about to ship" : "Claude's last reply"

// A static focus band has no quote: one dim row says where it applies.
export const focusTarget = (station: CoachStation): string =>
  station === 'review' ? "On Claude's last reply" : station === 'own' ? "On what you're about to ship" : 'On your next prompt'

export const hasQuote = (band: CoachBand): boolean => band.evidence.length > 0
