import type { ModelCompleteRequest, ModelCompleteResult, ModelUsage } from 'claude-code'
import type { CoachBand, CoachCard, CoachStation, CoachSuggestion } from '../types'
import { cardText, mergeCard } from './card'
import { HAIKU, LIMITS } from './config'
import { SYSTEM_A, SYSTEM_B, SYSTEM_C } from './prompts'
import {
  type Finding,
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
}

type Ran = { json: unknown; usage: ModelUsage | null }

const head = (s: string, max: number = LIMITS.windowText) => s.slice(0, max)

export function buildInput(i: TurnInput): { prompt: string; haystack: string } {
  const user = head(i.user)
  const answer = head(i.answer)
  const tools = i.tools.join('\n')
  const card = JSON.stringify(i.card)
  const prompt = [
    `Context card:\n${card}`,
    `Last message from the person:\n${user}`,
    `Last answer from Claude:\n${answer}`,
    `Tool calls in the turn:\n${tools || '(none)'}`,
    `Current station: ${i.station}; focus: ${i.focus ?? 'none'}`,
  ].join('\n\n')
  return { prompt, haystack: [user, answer, tools, cardText(i.card)].join('\n') }
}

export function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
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
    return { json: r.isAnswered ? extractJson(r.text) : null, usage: r.usage }
  } catch {
    return { json: null, usage: null }
  }
}

const obj = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}

export type TurnAnalysis = {
  card: CoachCard
  flags: Flag[]
  finding: Finding | null
  usage: ModelUsage | null
}

export async function analyseTurn(complete: Complete, i: TurnInput): Promise<TurnAnalysis> {
  const { prompt, haystack } = buildInput(i)
  const { json, usage } = await ask(complete, SYSTEM_A, prompt, HAIKU.maxTokens.a)
  const j = obj(json)
  return {
    card: mergeCard(i.card, j.card),
    flags: validateFlags(j.flags, haystack),
    finding: validateFinding(j.finding, haystack),
    usage,
  }
}

export async function writeBand(
  complete: Complete,
  i: TurnInput,
  station: CoachStation,
  finding: Finding | null,
  source: CoachBand['source'] = 'finding',
): Promise<{ band: CoachBand | null; usage: ModelUsage | null }> {
  const { prompt, haystack } = buildInput(i)
  const ask1 = finding
    ? `Write the band for station ${station}. Finding: ${finding.kind}. Evidence: ${finding.evidence.join(' | ')}\n\n${prompt}`
    : `Write the band for station ${station}.\n\n${prompt}`
  const { json, usage } = await ask(complete, SYSTEM_B, ask1, HAIKU.maxTokens.b)
  return { band: validateBand(json, haystack, station, finding, source), usage }
}

export async function notePrompt(
  complete: Complete,
  text: string,
  card: CoachCard,
): Promise<{ good: Note | null; suggestion: CoachSuggestion | null; usage: ModelUsage | null }> {
  const prompt = `Context card:\n${JSON.stringify(card)}\n\nPrompt:\n${head(text)}`
  const { json, usage } = await ask(complete, SYSTEM_C, prompt, HAIKU.maxTokens.c)
  const haystack = `${head(text)}\n${cardText(card)}`
  return { ...validateNote(json, haystack), usage }
}
