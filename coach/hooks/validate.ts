import type { CoachBand, CoachChip, CoachStation, CoachSuggestion } from '../types'
import { BLOCKLIST, LIMITS, STATIC_CHIPS, STATIC_TITLE, STATIONS } from './config'
import type { CoachFlagType } from './state'

export type Finding = { station: CoachStation; kind: string; evidence: string[] }
export type Flag = { type: CoachFlagType; evidence: string; hasEvidence: boolean }
export type Note = { text: string; kind: string | null }

const obj = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

export const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

export const isVerbatim = (haystack: string, quote: unknown): quote is string =>
  typeof quote === 'string' &&
  norm(quote).length >= LIMITS.evidenceMin &&
  norm(haystack).includes(norm(quote))

export const cut = (s: string, max: number): string => {
  const t = norm(s)
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

const isStation = (v: unknown): v is CoachStation => STATIONS.includes(v as CoachStation)
const isKind = (v: unknown): v is string => typeof v === 'string' && /^[a-z_]{3,40}$/.test(v)

const FLAGS: readonly CoachFlagType[] = ['new_task', 'scope_change', 'share_intent']

export function validateFlags(raw: unknown, haystack: string): Flag[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(item => {
    const f = obj(item)
    if (!FLAGS.includes(f.type as CoachFlagType)) return []
    const evidence = typeof f.evidence === 'string' ? f.evidence : ''
    return [{ type: f.type as CoachFlagType, evidence, hasEvidence: isVerbatim(haystack, evidence) }]
  })
}

export function validateFinding(raw: unknown, haystack: string): Finding | null {
  const f = obj(raw)
  if (f.confidence !== 'high' || !isStation(f.station) || !isKind(f.kind)) return null
  const evidence = (Array.isArray(f.evidence) ? f.evidence : [])
    .filter((q): q is string => isVerbatim(haystack, q))
    .map(q => cut(q, 80))
  return evidence.length === 0 ? null : { station: f.station, kind: f.kind, evidence: evidence.slice(0, 3) }
}

export function isBlocked(label: string): boolean {
  const l = norm(label).toLowerCase().replace(/[?.!]+$/, '')
  return BLOCKLIST.some(b => l === b || l.includes(b))
}

export function cutLabel(label: string): string {
  const words = norm(label).split(' ').slice(0, LIMITS.chipLabelWords).join(' ')
  return cut(words, LIMITS.chipLabelChars)
}

export function withBlanks(station: CoachStation, fill: string): string {
  const text = norm(fill)
  if (station !== 'brief' || text.includes('___')) return cut(text, LIMITS.chipFill)
  return `${cut(text, LIMITS.chipFill - 5).replace(/[:.\s]+$/, '')}: ___`
}

export function validateChips(raw: unknown, haystack: string, station: CoachStation): CoachChip[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const chips: CoachChip[] = []
  for (const item of raw) {
    const c = obj(item)
    if (typeof c.label !== 'string' || typeof c.fill !== 'string') continue
    if (!isVerbatim(haystack, c.evidence) || isBlocked(c.label)) continue
    const label = cutLabel(c.label)
    if (!label || seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    chips.push({ label, fill: withBlanks(station, c.fill), evidence: cut(c.evidence, 80) })
  }
  return chips.slice(0, LIMITS.chips)
}

export function validateBand(
  raw: unknown,
  haystack: string,
  station: CoachStation,
  finding: Finding | null,
  source: CoachBand['source'] = 'finding',
): CoachBand | null {
  const b = obj(raw)
  const chips = validateChips(b.chips, haystack, station)
  const title = typeof b.title === 'string' ? cut(b.title, LIMITS.title) : ''
  if (chips.length < LIMITS.minChips || !title) return null
  const s = obj(b.suggestion)
  const suggestion =
    isStation(s.station) && s.station !== station && typeof s.reason === 'string' && norm(s.reason)
      ? { station: s.station, reason: cut(s.reason, LIMITS.reasonText) }
      : null
  const evidence = [...new Set([...(finding?.evidence ?? []), ...chips.map(c => c.evidence)])].slice(0, 2)
  return { station, kind: finding?.kind ?? `focus_${station}`, title, evidence, chips, suggestion, source }
}

export function staticBand(station: CoachStation): CoachBand {
  return {
    station,
    kind: `focus_${station}`,
    title: STATIC_TITLE[station],
    evidence: [],
    chips: STATIC_CHIPS[station].map(c => ({ label: c.label, fill: c.fill, evidence: '' })),
    suggestion: null,
    source: 'fallback',
  }
}

export function validateNote(
  raw: unknown,
  haystack: string,
): { good: Note | null; suggestion: CoachSuggestion | null } {
  const r = obj(raw)
  const g = obj(r.good)
  const good =
    typeof g.text === 'string' && isVerbatim(haystack, g.evidence) && norm(g.text)
      ? { text: cut(g.text, LIMITS.noteText), kind: isKind(g.kind) ? g.kind : null }
      : null
  const s = obj(r.suggestion)
  const template = typeof s.template === 'string' ? norm(s.template) : ''
  const suggestion =
    template.includes('___') && template.length <= LIMITS.templateText && isVerbatim(haystack, s.evidence)
      ? { template, kind: isKind(s.kind) ? s.kind : 'brief_gap' }
      : null
  return { good, suggestion }
}
