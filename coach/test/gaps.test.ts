import { describe, expect, test } from 'claude-code/testing'
import { freshGaps, gapNames, gapTemplate, missingFrom, requestKind } from '../hooks/gaps'

describe('gaps in a short instruction', () => {
  test('a vague request misses the basics', () => {
    const gaps = missingFrom('Okay I want help reviewing a data set for some sales')
    expect(gaps).toContain('question')
    expect(gaps).not.toContain('audience')
    expect(gapNames(gaps)).toBe('question, which data')
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

describe('gaps fit the request and are not repeated', () => {
  test('a pitch is asked for its reader and purpose, never a deadline', () => {
    const gaps = missingFrom('Hi there I need help with my new sales pitch')
    expect(requestKind('Hi there I need help with my new sales pitch')).toBe('writing')
    expect(gaps).toEqual(['audience', 'goal'])
  })
  test('a pitch that names its reader only lacks the goal', () => {
    expect(missingFrom('Help me with a pitch for the client')).toEqual(['goal'])
  })
  test('no request is asked for a deadline', () => {
    for (const t of ['help me analyse our sales data', 'Write an email', 'Do something with this']) expect(missingFrom(t)).not.toContain('deadline')
  })
  test('a vague general request needs two gaps before a note', () => {
    expect(missingFrom('Fix the login bug in the table view')).toEqual([])
  })
  test('what was named on an earlier prompt is not named again', () => {
    expect(freshGaps(['question', 'data'], ['question, which data'])).toEqual([])
    expect(freshGaps(['audience', 'goal'], ['question, which data', 'audience'])).toEqual(['goal'])
  })
})
