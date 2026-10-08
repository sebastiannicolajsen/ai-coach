import type { CoachBand, CoachChip, CoachStation, CoachSuggestion } from '../types'
import { BLOCKLIST, LIMITS, STATIC_CHIPS, STATIC_TITLE, STATIONS, SLOT_RE } from './config'
import type { CoachFlagType } from './state'

export type Flag = { type: CoachFlagType; evidence: string; hasEvidence: boolean }
export type Note = { text: string; kind: string | null }

const obj = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

export const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

// Case, quote style, whitespace and trailing punctuation do not matter for evidence.
const fold = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201a\u201b`]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

const words = (s: string): string[] =>
  fold(s)
    .split(/[^\p{L}\p{N}%$.,'-]+/u)
    .map(w => w.replace(/^[.,'-]+|[.,'-]+$/g, ''))
    .filter(Boolean)

export const EVIDENCE_SHARE = 0.8

// A quote counts when it appears as written, or when at least 80% of its words appear in order.
export const isVerbatim = (haystack: string, quote: unknown): quote is string => {
  if (typeof quote !== 'string' || norm(quote).length < LIMITS.evidenceMin) return false
  const q = fold(quote).replace(/^["'\s]+|["'.,;:!?\s]+$/g, '')
  if (q.length >= LIMITS.evidenceMin && fold(haystack).includes(q)) return true
  const need = words(quote)
  if (need.length === 0) return false
  const have = words(haystack)
  let at = 0
  let hit = 0
  for (const w of need) {
    const i = have.indexOf(w, at)
    if (i >= 0) {
      hit += 1
      at = i + 1
    }
  }
  return hit / need.length >= EVIDENCE_SHARE
}

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

export type Finding = { station: CoachStation; kind: string; evidence: string[]; isLow?: boolean }

export function validateFinding(raw: unknown, haystack: string, allowLow = false): Finding | null {
  const f = obj(raw)
  const isHigh = f.confidence === 'high'
  if ((!isHigh && !(allowLow && f.confidence === 'low')) || !isStation(f.station) || !isKind(f.kind)) return null
  const evidence = (Array.isArray(f.evidence) ? f.evidence : [])
    .filter((q): q is string => isVerbatim(haystack, q))
    .map(q => cut(q, 80))
  if (evidence.length === 0) return null
  return { station: f.station, kind: f.kind, evidence: evidence.slice(0, 3), ...(isHigh ? {} : { isLow: true }) }
}

// Why a raw finding did not survive, for /coach why.
export function whyNotFinding(raw: unknown, haystack: string, allowLow: boolean): string {
  const f = obj(raw)
  if (raw === null || raw === undefined || Object.keys(f).length === 0) return 'none returned'
  if (!isStation(f.station) || !isKind(f.kind)) return 'bad station or kind'
  if (f.confidence !== 'high' && !(allowLow && f.confidence === 'low')) return `confidence ${String(f.confidence)}`
  return validateFinding(raw, haystack, allowLow) ? 'kept' : 'no evidence found in the turn'
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
  if (station !== 'brief' || SLOT_RE.test(text)) return cut(text, LIMITS.chipFill)
  return `${cut(text, LIMITS.chipFill - 9).replace(/[:.\s]+$/, '')}: [detail]`
}

export type ChipAudit = { kept: CoachChip[]; dropped: string[] }

export function auditChips(raw: unknown, haystack: string, station: CoachStation): ChipAudit {
  if (!Array.isArray(raw)) return { kept: [], dropped: [] }
  const seen = new Set<string>()
  const kept: CoachChip[] = []
  const dropped: string[] = []
  for (const item of raw) {
    const c = obj(item)
    if (typeof c.label !== 'string' || typeof c.fill !== 'string') {
      dropped.push('malformed')
      continue
    }
    if (isBlocked(c.label)) {
      dropped.push('generic')
      continue
    }
    if (!isVerbatim(haystack, c.evidence)) {
      dropped.push('no evidence')
      continue
    }
    const label = cutLabel(c.label)
    if (!label || seen.has(label.toLowerCase())) {
      dropped.push('duplicate')
      continue
    }
    seen.add(label.toLowerCase())
    kept.push({ label, fill: withBlanks(station, c.fill), evidence: cut(c.evidence as string, 80) })
  }
  if (kept.length > LIMITS.chips) dropped.push(`${kept.length - LIMITS.chips} over the cap`)
  return { kept: kept.slice(0, LIMITS.chips), dropped }
}

export const validateChips = (raw: unknown, haystack: string, station: CoachStation): CoachChip[] =>
  auditChips(raw, haystack, station).kept

// In preview one grounded chip is enough; a static chip makes up the pair.
export function validateBand(
  raw: unknown,
  haystack: string,
  station: CoachStation,
  finding: Finding | null,
  source: CoachBand['source'] = 'finding',
  isPreview = false,
): CoachBand | null {
  const b = obj(raw)
  let chips = validateChips(b.chips, haystack, station)
  const title = typeof b.title === 'string' ? cut(b.title, LIMITS.title) : ''
  if (isPreview && chips.length === 1) {
    const extra = STATIC_CHIPS[station].find(c => !chips.some(k => k.label === c.label))
    if (extra) chips = [...chips, { label: extra.label, fill: extra.fill, evidence: '' }]
  }
  // The band shows only its chips now, so a title is optional.
  if (chips.length < LIMITS.minChips) return null
  const s = obj(b.suggestion)
  const suggestion =
    isStation(s.station) && s.station !== station && typeof s.reason === 'string' && norm(s.reason)
      ? { station: s.station, reason: cut(s.reason, LIMITS.reasonText) }
      : null
  const evidence = [...new Set([...(finding?.evidence ?? []), ...chips.map(c => c.evidence)])].filter(Boolean).slice(0, 2)
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

const MOVES: readonly CoachStation[] = ['plan', 'brief', 'review', 'own']

// The moves worth a ✓, the note each one gets, and the finding kind it shows the person no longer needs.
export const GOOD_MOVES: Record<string, { text: string; fades: string | null }> = {
  goal_stated: { text: 'Goal is stated', fades: null },
  audience_named: { text: 'Audience is named', fades: 'missing_audience' },
  done_defined: { text: 'Says what done looks like', fades: 'missing_done' },
  example_given: { text: 'Gave an example', fades: null },
  constraint_named: { text: 'Named a constraint', fades: null },
  corrected_claude: { text: 'Corrected Claude', fades: 'silent_assumption' },
  questioned_result: { text: 'Questioned the result', fades: 'unchecked_claim' },
}

const GAP_WORDS = /\b(without|missing|lacks?|lacking|no clear|unclear|vague|broad|not specified|needs?)\b/i

export function validateNote(
  raw: unknown,
  haystack: string,
): { good: Note | null; suggestion: CoachSuggestion | null; move: CoachStation | null } {
  const r = obj(raw)
  const g = obj(r.good)
  // A ✓ names one of a few concrete moves, in our words; anything else (or a gap) is no ✓ at all.
  const move = typeof g.move === 'string' ? GOOD_MOVES[g.move] : undefined
  const good =
    move && isVerbatim(haystack, g.evidence) && !GAP_WORDS.test(String(g.text ?? ''))
      ? { text: move.text, kind: move.fades }
      : null
  const s = obj(r.suggestion)
  const template = typeof s.template === 'string' ? norm(s.template) : ''
  const suggestion =
    // A template is a suggestion, not a claim about the work, so it needs a slot but no verbatim quote.
    SLOT_RE.test(template) && template.length <= LIMITS.templateText
      ? { template, kind: isKind(s.kind) ? s.kind : 'brief_gap' }
      : null
  const m = obj(r.move)
  const kindOfMove = MOVES.includes(m.kind as CoachStation) && isVerbatim(haystack, m.evidence) ? (m.kind as CoachStation) : null
  return { good, suggestion, move: kindOfMove }
}
