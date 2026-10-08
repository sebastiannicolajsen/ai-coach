import { describe, expect, test } from 'claude-code/testing'
import { EMPTY_CARD } from '../hooks/card'
import { analyseTurn, buildInput, extractJson, notePrompt, writeBand } from '../hooks/haiku'
import { answered, usage } from './fake'

const input = {
  card: { ...EMPTY_CARD, task: 'churn analysis' },
  user: 'Send the churn numbers to Mette by Thursday',
  answer: 'Churn is 18.4% and SMB is the driver.',
  tools: ['Read export.csv'],
  station: 'review' as const,
  focus: null,
}

describe('haiku calls', () => {
  test('extractJson tolerates fences and prose', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('no json')).toBeNull()
    expect(extractJson('{broken')).toBeNull()
  })

  test('the input window caps messages at 1,500 characters', () => {
    const { prompt } = buildInput({ ...input, user: 'u'.repeat(4000), answer: 'a'.repeat(4000) })
    expect(prompt.length).toBeLessThan(3600)
  })

  test('call A merges the card and keeps only verified flags and findings', async () => {
    const seen: unknown[] = []
    const r = await analyseTurn(
      async req => {
        seen.push(req)
        return answered({
          card: { recipient: 'Mette, steering group' },
          flags: [{ type: 'share_intent', evidence: 'Send the churn numbers to Mette' }],
          finding: { station: 'review', kind: 'unchecked_claim', evidence: ['18.4%'], confidence: 'high' },
        })
      },
      input,
    )
    expect(r.card.task).toBe('churn analysis')
    expect(r.card.recipient).toBe('Mette, steering group')
    expect(r.flags[0]?.hasEvidence).toBe(true)
    expect(r.finding?.kind).toBe('unchecked_claim')
    expect(r.usage).toEqual(usage)
    expect(seen[0]).toMatchObject({ model: 'haiku', maxTokens: 1200, effort: 'low', timeoutMs: 8000 })
  })

  test('failure, rejection or junk never throws and renders nothing', async () => {
    const failed = await analyseTurn(async () => ({ isAnswered: false, reason: 'aborted', usage }), input)
    expect(failed.finding).toBeNull()
    expect(failed.flags).toEqual([])
    expect(failed.card).toEqual(input.card)
    const threw = await analyseTurn(async () => {
      throw new Error('blocked model')
    }, input)
    expect(threw.finding).toBeNull()
    expect(threw.usage).toBeNull()
    const junk = await writeBand(async () => answered('not json'), input, 'review', null)
    expect(junk.band).toBeNull()
  })

  test('call B returns a validated band', async () => {
    const r = await writeBand(
      async () =>
        answered({
          station: 'review',
          title: 'The 18.4% goes to Mette with no source yet',
          chips: [
            { label: 'Source for 18.4%', fill: 'Where does 18.4% come from?', evidence: '18.4%' },
            { label: 'SMB as driver', fill: 'What shows SMB is the driver?', evidence: 'SMB is the driver' },
            { label: 'Add more context', fill: 'More context', evidence: '18.4%' },
          ],
        }),
      input,
      'review',
      { station: 'review', kind: 'unchecked_claim', evidence: ['18.4%'] },
    )
    expect(r.band?.chips.map(c => c.label)).toEqual(['Source for 18.4%', 'SMB as driver'])
    expect(r.band?.kind).toBe('unchecked_claim')
  })

  test('call C reads a note and a suggestion with evidence from the prompt or card', async () => {
    const r = await notePrompt(
      async () =>
        answered({
          good: { move: 'audience_named', evidence: 'to Mette by Thursday' },
          suggestion: { template: 'Churn means [definition]', evidence: 'churn analysis', kind: 'missing_done' },
        }),
      input.user,
      input.card,
    )
    expect(r.good?.text).toBe('Audience is named')
    expect(r.suggestion?.kind).toBe('missing_done')
  })
})
