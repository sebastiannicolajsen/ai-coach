import { describe, expect, test } from 'claude-code/testing'
import { COACH_MODELS } from '../hooks/config'
import { addCost, costLine, formatUsd, menuCost, priceUsage, shareLine } from '../hooks/cost'

const HAIKU = COACH_MODELS.haiku.price

describe('cost', () => {
  test('each feedback model has its listed price (per million tokens)', () => {
    expect(HAIKU).toEqual({ input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 })
    expect(COACH_MODELS.sonnet.price).toEqual({ input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 })
    expect(COACH_MODELS['haiku-5.5'].price).toEqual({ input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 })
    expect(COACH_MODELS['haiku-5.5'].id).toBe('claude-haiku-5-5')
    expect(COACH_MODELS.opus.price).toEqual({ input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 })
    const usd = priceUsage(
      { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 10000, cache_creation_input_tokens: 800 },
      HAIKU,
    )
    expect(Math.round(usd * 1e9)).toBe(4_000_000)
  })

  test('sums calls and tokens', () => {
    const one = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    const c = addCost(addCost({ tokens: 0, usd: 0 }, one, HAIKU), one, HAIKU)
    expect(c.tokens).toBe(300)
    expect(Math.round(c.usd * 1e9)).toBe(700_000)
  })

  test('ignores missing and negative counts', () => {
    expect(priceUsage({ input_tokens: -5 }, HAIKU)).toBe(0)
    expect(priceUsage({}, HAIKU)).toBe(0)
  })

  test('shows the coach as its share of the session', () => {
    expect(shareLine(0.03, 1.48)).toBe('2% of this session')
    expect(shareLine(0.001, 1.48)).toBe('<1% of this session')
    expect(shareLine(0.03, null)).toBe('$0.03 so far')
    expect(menuCost(0.03, 1.48)).toBe('Coach 2% of this session')
    expect(costLine(0.03, 1.48, 'Haiku 4.5')).toBe('Coach 2% of this session · Haiku 4.5')
    expect(formatUsd(0.0004)).toBe('<$0.01')
  })
})
