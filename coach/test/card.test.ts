import { describe, expect, test } from 'claude-code/testing'
import { EMPTY_CARD, aboutLine, cardText, mergeCard } from '../hooks/card'

describe('context card', () => {
  test('caps every field at 120 characters', () => {
    const card = mergeCard(EMPTY_CARD, { task: 'x'.repeat(300), recipient: 'y'.repeat(121) })
    expect(card.task).toHaveLength(120)
    expect(card.recipient).toHaveLength(120)
  })

  test('caps lists at 5 and drops the oldest', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const card = mergeCard(EMPTY_CARD, { unchecked_claims: items })
    expect(card.unchecked_claims).toEqual(['c', 'd', 'e', 'f', 'g'])
    const next = mergeCard(card, { unchecked_claims: ['h', 'c'] })
    expect(next.unchecked_claims).toEqual(['d', 'e', 'f', 'g', 'h'])
  })

  test('caps definitions at 5 entries', () => {
    const defs = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map(k => [k, k]))
    expect(Object.keys(mergeCard(EMPTY_CARD, { definitions: defs }).definitions)).toEqual(['b', 'c', 'd', 'e', 'f'])
  })

  test('keeps earlier values when the patch is empty or malformed', () => {
    const card = mergeCard(EMPTY_CARD, { task: 'churn analysis', language: 'da' })
    expect(mergeCard(card, null)).toEqual(card)
    expect(mergeCard(card, { task: 42, claude_assumptions: 'nope' })).toEqual(card)
  })

  test('aboutLine truncates to 10 words', () => {
    const card = mergeCard(EMPTY_CARD, { about: 'one two three four five six seven eight nine ten eleven twelve' })
    expect(aboutLine(card)).toBe('one two three four five six seven eight nine ten…')
    expect(aboutLine(EMPTY_CARD)).toBe('')
  })

  test('cardText joins the facts for the evidence check', () => {
    const card = mergeCard(EMPTY_CARD, { task: 'churn', unchecked_claims: ['18.4%'] })
    expect(cardText(card)).toContain('18.4%')
  })
})
