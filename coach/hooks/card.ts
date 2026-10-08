import type { CoachCard } from '../types'
import { LIMITS } from './config'

export const EMPTY_CARD: CoachCard = {
  task: '',
  recipient: '',
  definitions: {},
  claude_assumptions: [],
  unchecked_claims: [],
  about: '',
  language: 'en',
}

const clip = (v: unknown, max: number = LIMITS.cardField): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(x => clip(x)).filter(Boolean) : []

const defs = (v: unknown): Record<string, string> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return {}
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v)) {
    const key = clip(k, 40)
    const text = clip(val)
    if (key && text) out[key] = text
  }
  return out
}

const lastN = <T,>(items: T[]): T[] => items.slice(-LIMITS.cardList)

const merge = <T,>(old: T[], add: T[]): T[] => {
  const seen = new Set<T>()
  const all = [...old, ...add].filter(x => (seen.has(x) ? false : (seen.add(x), true)))
  return lastN(all)
}

export function mergeCard(prev: CoachCard, patch: unknown): CoachCard {
  const p = (typeof patch === 'object' && patch !== null ? patch : {}) as Record<string, unknown>
  const def = { ...prev.definitions, ...defs(p.definitions) }
  const keys = Object.keys(def).slice(-LIMITS.cardList)
  return {
    task: clip(p.task) || prev.task,
    recipient: clip(p.recipient) || prev.recipient,
    definitions: Object.fromEntries(keys.map(k => [k, def[k]!])),
    claude_assumptions: merge(prev.claude_assumptions, list(p.claude_assumptions)),
    unchecked_claims: merge(prev.unchecked_claims, list(p.unchecked_claims)),
    about: clip(p.about) || prev.about,
    language: clip(p.language, 8) || prev.language,
  }
}

export function aboutLine(card: CoachCard): string {
  const words = card.about.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const cut = words.slice(0, LIMITS.aboutWords).join(' ')
  return words.length > LIMITS.aboutWords ? `${cut}…` : cut
}

export function cardText(card: CoachCard): string {
  return [
    card.task,
    card.recipient,
    ...Object.entries(card.definitions).map(([k, v]) => `${k}: ${v}`),
    ...card.claude_assumptions,
    ...card.unchecked_claims,
    card.about,
  ]
    .filter(Boolean)
    .join('\n')
}
