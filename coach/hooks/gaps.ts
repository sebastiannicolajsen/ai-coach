// What a short instruction leaves out, checked by rule the moment it is sent: no model call, so the
// "Could add" note and the template are there before Claude answers. Haiku may refine them later.

export type Gap = 'data' | 'question' | 'audience' | 'goal' | 'deadline' | 'output'

const HAS: Record<Gap, RegExp> = {
  data: /\.(csv|xlsx?|json|parquet|sql|txt|pdf|docx?)\b|\b(file|folder|sheet|table|export|database|attached|pasted|below|here is|this data)\b|\bfil(en)?\b|\bvedhæft/i,
  question: /\?|\b(why|which|whether|how (much|many|did|does)|compare|trend|growth|drop|driver|top|best|worst|answer|find out|understand|see if)\b|\b(hvorfor|hvilke|hvordan|sammenlign)\b/i,
  audience: /\bfor (my|our|the|a)?\s*(team|boss|manager|client|customer|board|steering|ceo|cfo|leadership|partner|stakeholders?|meeting)\b|\bto (send|share|present)\b|\b(til|for) (min|vores|kunden|ledelsen|styregruppen)\b|\bfor [A-ZÆØÅ][a-zæøå]+/,
  goal: /\b(so (that|they|we|it)|in order to|to (get|win|convince|persuade|land|secure|explain|show|make|help|sell)|goal|aim|purpose|want them to)\b|\b(så (de|vi|at)|for at|målet)\b/i,
  deadline: /\b(by|before|until|due)\s+\w+|\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|next week|this week|eod|asap)\b|\b(i dag|i morgen|mandag|tirsdag|onsdag|torsdag|fredag|næste uge)\b/i,
  output: /\b(chart|graph|plot|table|summary|memo|report|slides?|deck|email|list|numbers|dashboard|one[- ]pager|bullet)\b|\b(graf|tabel|opsummering|rapport|mail|liste)\b/i,
}

const WRITING = /\b(pitch|e-?mail|mail|memo|post|presentation|deck|slides?|summary|proposal|letter|speech|article|brief|announcement|newsletter|invitation|offer|tilbud|oplæg|præsentation|nyhedsbrev|invitation)\b/i

const ANALYSIS = /\b(analy[sz]\w*|data|dataset|numbers|figures|statistics|metrics|report|review\w* (a|the|my|our) data)\b|\b(analys\w*|data|tal)\b/i

const SLOT: Record<Gap, string> = {
  data: 'which data',
  question: 'question',
  audience: 'audience',
  goal: 'goal',
  deadline: 'deadline',
  output: 'output',
}

// What is worth asking for depends on the request: an analysis needs a question and its data, a piece of
// writing needs a reader and a purpose. A deadline rarely changes what Claude writes, so it is never asked for.
const RELEVANT = {
  analysis: ['question', 'data', 'output'],
  writing: ['audience', 'goal'],
  other: ['question', 'output'],
} satisfies Record<string, Gap[]>

export type RequestKind = keyof typeof RELEVANT

// Asking to analyse wins; otherwise a named piece of writing; otherwise any mention of data.
export const requestKind = (text: string): RequestKind =>
  /\banaly[sz]/i.test(text) ? 'analysis' : WRITING.test(text) ? 'writing' : ANALYSIS.test(text) ? 'analysis' : 'other'

// Only short, open instructions are checked: a long prompt has usually said what it needs to. A general
// request needs two gaps before it is worth a note; an analysis or a piece of writing needs one.
export function missingFrom(text: string): Gap[] {
  const words = text.trim().split(/\s+/).length
  if (words > 40) return []
  const kind = requestKind(text)
  const missing = (RELEVANT[kind] as Gap[]).filter(g => !HAS[g].test(text))
  return kind === 'other' && missing.length < 2 ? [] : missing
}

// Gaps the coach already named on an earlier prompt of this chat are not named again: saying "audience"
// under every message teaches nothing new.
export function freshGaps(gaps: Gap[], earlier: string[]): Gap[] {
  const said = new Set(earlier.flatMap(g => g.split(', ')))
  return gaps.filter(g => !said.has(SLOT[g]))
}

export const gapNames = (gaps: Gap[]): string => gaps.slice(0, 2).map(g => SLOT[g]).join(', ')

// The person's own words, then named slots for what is missing: "Analyse sales data, [question], for [audience]".
export function gapTemplate(text: string, gaps: Gap[]): string {
  const head = text.trim().replace(/[.!?\s]+$/, '').slice(0, 60)
  const parts = gaps.slice(0, 3).map(g =>
    g === 'audience' ? 'for [audience]' : g === 'goal' ? 'so that [goal]' : g === 'deadline' ? 'by [deadline]' : g === 'output' ? 'as [output]' : `[${SLOT[g]}]`,
  )
  return `${head}: ${parts.join(', ')}`
}
