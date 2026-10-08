import type { CoachCost } from '../types'
import type { Price } from './config'

type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export function priceUsage(u: Usage, p: Price): number {
  const n = (v: number | undefined) => (typeof v === 'number' && v > 0 ? v : 0)
  return (
    (n(u.input_tokens) * p.input +
      n(u.output_tokens) * p.output +
      n(u.cache_read_input_tokens) * p.cacheRead +
      n(u.cache_creation_input_tokens) * p.cacheWrite) /
    1_000_000
  )
}

export const countTokens = (u: Usage): number =>
  (u.input_tokens ?? 0) +
  (u.output_tokens ?? 0) +
  (u.cache_read_input_tokens ?? 0) +
  (u.cache_creation_input_tokens ?? 0)

export const addCost = (c: CoachCost, u: Usage, p: Price): CoachCost => ({
  tokens: c.tokens + countTokens(u),
  usd: c.usd + priceUsage(u, p),
})

export const formatUsd = (usd: number): string =>
  usd < 0.01 && usd > 0 ? '<$0.01' : `$${usd.toFixed(2)}`

export const sharePercent = (coach: number, conversation: number): number =>
  conversation > 0 ? Math.round((coach / conversation) * 100) : 0

// The coach's cost as its share of the whole session: "2% of this session", "<1% of this session". Without a
// session figure there is nothing to share against, so it says the coach's own dollars instead.
export function shareLine(coachUsd: number, conversationUsd: number | null | undefined): string {
  if (typeof conversationUsd !== 'number' || conversationUsd <= 0) return `${formatUsd(coachUsd)} so far`
  const pct = (coachUsd / conversationUsd) * 100
  return pct > 0 && pct < 1 ? '<1% of this session' : `${Math.round(pct)}% of this session`
}

export const costLine = (coachUsd: number, conversationUsd: number | null | undefined, model: string): string =>
  `Coach ${shareLine(coachUsd, conversationUsd)} · ${model}`

export const menuCost = (coachUsd: number, conversationUsd: number | null | undefined): string =>
  `Coach ${shareLine(coachUsd, conversationUsd)}`
