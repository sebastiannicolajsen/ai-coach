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

export function costLine(coachUsd: number, conversationUsd: number | null | undefined, isApprox: boolean): string {
  const base = `Coach ${isApprox ? '≈' : ''}${formatUsd(coachUsd)}`
  return typeof conversationUsd === 'number' ? `${base} of ${formatUsd(conversationUsd)} this session` : `${base} this session`
}

export const menuCost = (coachUsd: number, isApprox: boolean): string =>
  `${isApprox ? '≈' : ''}${formatUsd(coachUsd)} this session`
