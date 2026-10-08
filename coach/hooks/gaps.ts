// What a short instruction leaves out, checked by rule the moment it is sent: no model call, so the
// "Could add" note and the template are there before Claude answers. Haiku may refine them later.

export type Gap = 'data' | 'question' | 'audience' | 'deadline' | 'output'

const HAS: Record<Gap, RegExp> = {
  data: /\.(csv|xlsx?|json|parquet|sql|txt|pdf|docx?)\b|\b(file|folder|sheet|table|export|database|attached|pasted|below|here is|this data)\b|\bfil(en)?\b|\bvedhæft/i,
  question: /\?|\b(why|which|whether|how (much|many|did|does)|compare|trend|growth|drop|driver|top|best|worst|answer|find out|understand|see if)\b|\b(hvorfor|hvilke|hvordan|sammenlign)\b/i,
  audience: /\bfor (my|our|the|a)?\s*(team|boss|manager|client|customer|board|steering|ceo|cfo|leadership|partner|stakeholders?|meeting)\b|\bto (send|share|present)\b|\b(til|for) (min|vores|kunden|ledelsen|styregruppen)\b|\bfor [A-ZÆØÅ][a-zæøå]+/,
  deadline: /\b(by|before|until|due)\s+\w+|\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|next week|this week|eod|asap)\b|\b(i dag|i morgen|mandag|tirsdag|onsdag|torsdag|fredag|næste uge)\b/i,
  output: /\b(chart|graph|plot|table|summary|memo|report|slides?|deck|email|list|numbers|dashboard|one[- ]pager|bullet)\b|\b(graf|tabel|opsummering|rapport|mail|liste)\b/i,
}

const ANALYSIS = /\b(analy[sz]\w*|data|dataset|numbers|figures|statistics|metrics|report|review\w* (a|the|my|our) data)\b|\b(analys\w*|data|tal)\b/i

const SLOT: Record<Gap, string> = {
  data: 'which data',
  question: 'question',
  audience: 'audience',
  deadline: 'deadline',
  output: 'output',
}

const ORDER: Gap[] = ['question', 'data', 'audience', 'deadline', 'output']

// Only short, open instructions are checked: a long prompt has usually said what it needs to.
export function missingFrom(text: string): Gap[] {
  const words = text.trim().split(/\s+/).length
  if (words > 40) return []
  // Asking which data only makes sense for analysis; a pitch or an email has no data set.
  const isAnalysis = ANALYSIS.test(text)
  return ORDER.filter(g => (g !== 'data' || isAnalysis) && !HAS[g].test(text))
}

export const gapNames = (gaps: Gap[]): string => gaps.slice(0, 3).map(g => SLOT[g]).join(', ')

// The person's own words, then named slots for what is missing: "Analyse sales data, [question], for [audience]".
export function gapTemplate(text: string, gaps: Gap[]): string {
  const head = text.trim().replace(/[.!?\s]+$/, '').slice(0, 60)
  const parts = gaps.slice(0, 3).map(g =>
    g === 'audience' ? 'for [audience]' : g === 'deadline' ? 'by [deadline]' : g === 'output' ? 'as [output]' : `[${SLOT[g]}]`,
  )
  return `${head}: ${parts.join(', ')}`
}
