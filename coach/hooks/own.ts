import type { CoachCard, CoachOwnCheck } from '../types'
import { OWN_CHECKS } from './config'
import { cut } from './validate'

// Third check: from the card when Claude made an assumption, else the generic one.
export function ownChecks(card: CoachCard): string[] {
  const assumption = card.claude_assumptions[card.claude_assumptions.length - 1]
  const third = assumption ? `${cut(assumption, 30)} explained` : OWN_CHECKS[2]!
  return [OWN_CHECKS[0]!, OWN_CHECKS[1]!, third]
}

export const ownTitle = (card: CoachCard): string =>
  card.recipient
    ? `This goes to ${cut(card.recipient.split(',')[0]!, 40)}. Three quick checks.`
    : 'Before this goes out, three quick checks.'

const COMMAND_RE = /\bgit\s+(?:-C\s+\S+\s+)?(?:push|commit)\b|\b(?:deploy|publish|release|apply|upload)\b/

export function ownSource(card: CoachCard, command: string): string[] {
  const hit = COMMAND_RE.exec(command)?.[0]
  const recipient = card.recipient ? `email to ${cut(card.recipient.split(',')[0]!, 30)}` : ''
  return [hit ? cut(hit, 30) : '', recipient].filter(Boolean)
}

export const makeOwnCheck = (card: CoachCard, command: string, held: boolean): CoachOwnCheck => ({
  held,
  ticked: [],
  title: ownTitle(card),
  source: ownSource(card, command),
  checks: ownChecks(card),
})
