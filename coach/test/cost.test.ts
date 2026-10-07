import { describe, expect, test } from 'claude-code/testing'
import { COACH_PRICE, PRICES } from '../hooks/config'
import { addCost, costLine, menuCost, formatUsd, priceUsage, sharePercent } from '../hooks/cost'

describe('cost', () => {
  test('prices usage from the table (Haiku 4.5: $1 in, $5 out, $1.25 write, $0.10 read)', () => {
    expect(COACH_PRICE).toEqual({ input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 })
    const usd = priceUsage(
      { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 10000, cache_creation_input_tokens: 800 },
      COACH_PRICE,
    )
    expect(Math.round(usd * 1e9)).toBe(4_000_000)
  })

  test('sums calls and tokens', () => {
    const one = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    const c = addCost(addCost({ tokens: 0, usd: 0 }, one, COACH_PRICE), one, COACH_PRICE)
    expect(c.tokens).toBe(300)
    expect(Math.round(c.usd * 1e9)).toBe(700_000)
  })

  test('ignores missing and negative counts', () => {
    expect(priceUsage({ input_tokens: -5 }, COACH_PRICE)).toBe(0)
    expect(priceUsage({}, PRICES['haiku-5.5']!)).toBe(0)
  })

  test('formats the menu line', () => {
    expect(formatUsd(0.034)).toBe('$0.03')
    expect(formatUsd(0.0004)).toBe('<$0.01')
    expect(sharePercent(0.03, 1.48)).toBe(2)
    expect(sharePercent(1, 0)).toBe(0)
    expect(costLine(0.03, 1.48, false)).toBe('Coach $0.03 of $1.48 this session')
    expect(costLine(0.03, 1.48, true)).toBe('Coach ≈$0.03 of $1.48 this session')
    expect(costLine(0.03, null, false)).toBe('Coach $0.03 this session')
    expect(menuCost(0.02, true)).toBe('≈$0.02 this session')
  })
})
