import type { Note } from './validate'

// Obvious moves that need no model: correcting Claude, or questioning what it gave back.
const CORRECTS_RE = /\b(instead|actually|that'?s (?:wrong|not right|incorrect)|not what i (?:meant|asked)|should be|use \w+ not)\b|(?:^|[.!?]\s*)no,/i
const QUESTIONS_RE = /\b(how did you|why did you|are you sure|where did you get|what did you assume|which assumptions?|hvordan kom du|er du sikker)\b/i

export function ruleNote(text: string, previous: string): Note | null {
  if (previous !== 'review') return null
  if (CORRECTS_RE.test(text)) return { text: 'Corrected Claude', kind: 'silent_assumption' }
  if (QUESTIONS_RE.test(text)) return { text: 'Questioned the result', kind: 'unchecked_claim' }
  return null
}

// Rows and prompts can differ in spacing or pasted-content markers, so match on a short normalised head.
export const noteKey = (text: string): string => text.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40)
