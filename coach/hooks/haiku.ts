import type { ModelCompleteRequest, ModelCompleteResult, ModelUsage } from 'claude-code'
import type { CoachBand, CoachCard, CoachStation, CoachSuggestion, RouteEffort, RouteModel } from '../types'
import { parseRoute } from './parse-route'
import { cardText, mergeCard } from './card'
import { HAIKU, LIMITS } from './config'
import { SYSTEM_A, SYSTEM_B, SYSTEM_C } from './prompts'
import {
  type Finding,
  auditChips,
  whyNotFinding,
  type Flag,
  type Note,
  validateBand,
  validateFinding,
  validateFlags,
  validateNote,
} from './validate'

export type Complete = (req: ModelCompleteRequest) => Promise<ModelCompleteResult>

export type TurnInput = {
  card: CoachCard
  user: string
  answer: string
  tools: string[]
  station: CoachStation
  focus: CoachStation | null
  // Earlier exchanges of the conversation, oldest first, so suggestions can build on more than the last turn.
  history?: { role: 'user' | 'assistant'; text: string }[]
}

const HISTORY_CHARS = { user: 300, assistant: 500 }

// The start and the end of a long text: the answer's conclusion is usually at the end.
export const headTail = (s: string, max: number) =>
  s.length <= max ? s : `${s.slice(0, Math.round(max * 0.6))}\n…\n${s.slice(-Math.round(max * 0.4))}`

export type CallInfo = { isAnswered: boolean; reason: string }

type Ran = { json: unknown; usage: ModelUsage | null; info: CallInfo }

const head = (s: string, max: number = LIMITS.windowText) => s.slice(0, max)

export function buildInput(i: TurnInput): { prompt: string; haystack: string } {
  const user = head(i.user)
  const answer = headTail(i.answer, LIMITS.answerText)
  const tools = i.tools.join('\n')
  const card = JSON.stringify(i.card)
  const history = (i.history ?? [])
    .map(m => `${m.role === 'user' ? 'Person' : 'Claude'}: ${headTail(m.text.trim(), HISTORY_CHARS[m.role])}`)
    .join('\n\n')
  const prompt = [
    `Context card:\n${card}`,
    ...(history ? [`Earlier in the conversation:\n${history}`] : []),
    `Last message from the person:\n${user}`,
    `Last answer from Claude:\n${answer}`,
    `Tool calls in the turn:\n${tools || '(none)'}`,
    `Current station: ${i.station}; focus: ${i.focus ?? 'none'}`,
  ].join('\n\n')
  return { prompt, haystack: [user, answer, tools, history, cardText(i.card)].join('\n') }
}

// Haiku sometimes wraps the object in prose or fences, or is cut off at the token cap: take the outermost
// object, and if it was cut off, close what was left open.
export function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  if (start < 0) return null
  const end = text.lastIndexOf('}')
  if (end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      // fall through to repair
    }
  }
  return repairJson(text.slice(start))
}

// Closes a truncated JSON object: drops a dangling key, value or comma, then closes open strings and brackets.
export function repairJson(body: string): unknown {
  let inString = false
  let escaped = false
  const stack: string[] = []
  let lastSafe = 0
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']')
    else if (c === '}' || c === ']') stack.pop()
    if (!inString && (c === ',' || c === '{' || c === '[')) lastSafe = c === ',' ? i : i + 1
  }
  for (const cut of [body.length, lastSafe]) {
    let head = body.slice(0, cut).replace(/[,:\s]+$/, '')
    const open: string[] = []
    let str = false
    let esc = false
    for (const c of head) {
      if (str) {
        if (esc) esc = false
        else if (c === '\\') esc = true
        else if (c === '"') str = false
        continue
      }
      if (c === '"') str = true
      else if (c === '{' || c === '[') open.push(c === '{' ? '}' : ']')
      else if (c === '}' || c === ']') open.pop()
    }
    if (str) head += '"'
    try {
      const parsed = JSON.parse(head + open.reverse().join(''))
      // An empty object is garbage that happened to close, not a reply.
      return parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0 ? parsed : null
    } catch {
      // try the shorter cut
    }
  }
  return null
}

async function ask(complete: Complete, system: string, prompt: string, maxTokens: number): Promise<Ran> {
  try {
    const r = await complete({
      model: HAIKU.model,
      system,
      prompt,
      maxTokens,
      effort: HAIKU.effort,
      timeoutMs: HAIKU.timeoutMs,
    })
    const json = r.isAnswered ? extractJson(r.text) : null
    const reason = r.isAnswered ? (json === null ? `not JSON: "…${r.text.slice(-40).replace(/\s+/g, ' ')}"` : 'ok') : r.reason
    return { json, usage: r.usage, info: { isAnswered: r.isAnswered, reason } }
  } catch {
    return { json: null, usage: null, info: { isAnswered: false, reason: 'threw' } }
  }
}

const obj = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}

export type TurnAnalysis = {
  card: CoachCard
  flags: Flag[]
  finding: Finding | null
  usage: ModelUsage | null
  info: CallInfo
  // For /coach why: what the model returned and why it did or did not survive.
  rawFinding: string
  findingWhy: string
  // The band, when call A already wrote usable chips with its finding: saves the second call.
  band: CoachBand | null
  // Chips for the most useful next step, written every turn, finding or not.
  next: CoachBand | null
  // The model the likely next prompt suits.
  nextModel: { model: RouteModel; reason: string; effort?: RouteEffort } | null
  // What to do in the current step, for the step line.
  stepNote: string | null
}

const STEP_NOTE_CHARS = 48

export function cleanStepNote(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '')
  return s && s.length <= STEP_NOTE_CHARS ? s : null
}

const isStationName = (v: unknown): v is CoachStation => v === 'plan' || v === 'brief' || v === 'review' || v === 'own'

const rawLabel = (v: unknown): string => {
  const f = obj(v)
  return typeof f.kind === 'string' ? `${f.kind} (${String(f.confidence)})` : 'none'
}

export async function analyseTurn(complete: Complete, i: TurnInput, isPreview = false): Promise<TurnAnalysis> {
  const { prompt, haystack } = buildInput(i)
  const { json, usage, info } = await ask(complete, SYSTEM_A, prompt, HAIKU.maxTokens.a)
  const j = obj(json)
  const finding = validateFinding(j.finding, haystack, isPreview)
  const band = finding
    ? validateBand({ station: finding.station, title: '', chips: obj(j.finding).chips, suggestion: null }, haystack, finding.station, finding, 'finding', isPreview)
    : null
  const nx = obj(j.next)
  const nextStation = isStationName(nx.station) ? nx.station : i.station
  const next = validateBand({ chips: nx.chips }, haystack, nextStation, null, 'finding', isPreview)
  return {
    band,
    next: next ? { ...next, kind: 'next_step' } : null,
    nextModel: parseRoute(j.next_model),
    stepNote: cleanStepNote(j.step_note),
    card: mergeCard(i.card, j.card),
    flags: validateFlags(j.flags, haystack),
    finding,
    usage,
    info,
    rawFinding: rawLabel(j.finding),
    findingWhy: whyNotFinding(j.finding, haystack, isPreview),
  }
}

export type BandResult = {
  band: CoachBand | null
  usage: ModelUsage | null
  info: CallInfo
  chips: { returned: number; kept: number; dropped: string[] }
}

export async function writeBand(
  complete: Complete,
  i: TurnInput,
  station: CoachStation,
  finding: Finding | null,
  source: CoachBand['source'] = 'finding',
  isPreview = false,
): Promise<BandResult> {
  const { prompt, haystack } = buildInput(i)
  const ask1 = finding
    ? `Write the band for station ${station}. Finding: ${finding.kind}. Evidence: ${finding.evidence.join(' | ')}\n\n${prompt}`
    : `Write the band for station ${station}.\n\n${prompt}`
  const { json, usage, info } = await ask(complete, SYSTEM_B, ask1, HAIKU.maxTokens.b)
  const chipsRaw = obj(json).chips
  const audit = auditChips(chipsRaw, haystack, station)
  return {
    band: validateBand(json, haystack, station, finding, source, isPreview),
    usage,
    info,
    chips: { returned: Array.isArray(chipsRaw) ? chipsRaw.length : 0, kept: audit.kept.length, dropped: audit.dropped },
  }
}

export async function notePrompt(
  complete: Complete,
  text: string,
  card: CoachCard,
): Promise<{
  good: Note | null
  suggestion: CoachSuggestion | null
  move: CoachStation | null
  caption: string | null
  usage: ModelUsage | null
  info: CallInfo
}> {
  const prompt = `Context card:\n${JSON.stringify(card)}\n\nPrompt:\n${head(text)}`
  const { json, usage, info } = await ask(complete, SYSTEM_C, prompt, HAIKU.maxTokens.c)
  const haystack = `${head(text)}\n${cardText(card)}`
  return { ...validateNote(json, haystack), usage, info }
}
