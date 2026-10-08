import { describe, expect, test } from 'claude-code/testing'
import { gapNames, gapTemplate, missingFrom } from '../hooks/gaps'

describe('gaps in a short instruction', () => {
  test('a vague request misses the basics', () => {
    const gaps = missingFrom('Okay I want help reviewing a data set for some sales')
    expect(gaps).toContain('question')
    expect(gaps).toContain('audience')
    expect(gapNames(gaps)).toBe('question, which data, audience')
  })

  test('a full brief misses nothing worth saying', () => {
    expect(missingFrom('Compare Q3 churn by tier in churn.csv for the steering group by Thursday as a one-pager').length).toBeLessThan(2)
  })

  test('a long prompt is left alone', () => {
    expect(missingFrom('word '.repeat(60))).toEqual([])
  })

  test('the template keeps the person\'s words and names the slots', () => {
    const t = gapTemplate('I want help analysing my sales data from 2025.', ['question', 'audience', 'deadline'])
    expect(t).toBe('I want help analysing my sales data from 2025: [question], for [audience], by [deadline]')
  })
})

describe('gaps depend on the kind of request', () => {
  test('a pitch is never asked for its data', () => {
    expect(missingFrom('Hi there I need help with my new sales pitch')).not.toContain('data')
  })
  test('an analysis is', () => {
    expect(missingFrom('I want help analysing something')).toContain('data')
  })
})
