import { describe, expect, test } from 'claude-code/testing'
import {
  isBlocked,
  isVerbatim,
  validateBand,
  validateChips,
  validateFinding,
  validateFlags,
  validateNote,
  withBlanks,
} from '../hooks/validate'

const HAY = 'Send the churn numbers to Mette by Thursday. Churn is 18.4% and SMB is the driver.'

const chip = (label: string, fill: string, evidence: string) => ({ label, fill, evidence })

describe('evidence', () => {
  test('is a verbatim substring, whitespace-insensitive', () => {
    expect(isVerbatim(HAY, 'churn numbers to Mette')).toBe(true)
    expect(isVerbatim(HAY, 'churn   numbers\nto Mette')).toBe(true)
    expect(isVerbatim(HAY, 'Churn numbers to Mette')).toBe(false)
    expect(isVerbatim(HAY, 'ab')).toBe(false)
    expect(isVerbatim(HAY, 42)).toBe(false)
  })
})

describe('chips', () => {
  test('drops chips whose evidence is not in the input', () => {
    const chips = validateChips(
      [chip('Check 18.4%', 'Where does 18.4% come from?', '18.4%'), chip('Check SMB', 'Why SMB?', 'not in the text')],
      HAY,
      'review',
    )
    expect(chips.map(c => c.label)).toEqual(['Check 18.4%'])
  })

  test('drops generic labels from the blocklist', () => {
    expect(isBlocked('Who is the audience?')).toBe(true)
    expect(isBlocked('Add more context')).toBe(true)
    expect(isBlocked('Mette on Thursday')).toBe(false)
    const chips = validateChips([chip('Be more specific', 'x', '18.4%')], HAY, 'brief')
    expect(chips).toEqual([])
  })

  test('appends a blank to Brief chips that lack one', () => {
    expect(withBlanks('brief', 'The deadline is')).toBe('The deadline is: ___')
    expect(withBlanks('brief', 'Churn means ___')).toBe('Churn means ___')
    expect(withBlanks('review', 'Where does 18.4% come from?')).toBe('Where does 18.4% come from?')
  })

  test('limits labels to five words, 32 characters and three chips', () => {
    const many = ['a', 'b', 'c', 'd'].map(k => chip(`${k} one two three four five six`, 'Why?', '18.4%'))
    const chips = validateChips(many, HAY, 'review')
    expect(chips).toHaveLength(3)
    expect(chips[0]!.label.split(' ').length).toBeLessThanOrEqual(5)
  })

  test('drops duplicate labels', () => {
    const chips = validateChips([chip('Mette Thursday', 'a', '18.4%'), chip('mette thursday', 'b', '18.4%')], HAY, 'review')
    expect(chips).toHaveLength(1)
  })
})

describe('band', () => {
  const raw = {
    title: 'The 18.4% goes to Mette on Thursday and has no source yet',
    chips: [chip('Source for 18.4%', 'Where does 18.4% come from?', '18.4%'), chip('Is SMB the driver?', 'What shows SMB is the driver?', 'SMB is the driver')],
    suggestion: { station: 'own', reason: 'This is going to Mette.' },
  }

  test('renders with two valid chips', () => {
    const band = validateBand(raw, HAY, 'review', null)
    expect(band?.chips).toHaveLength(2)
    expect(band?.suggestion?.station).toBe('own')
    expect(band?.evidence.length).toBeGreaterThan(0)
  })

  test('renders nothing with fewer than two surviving chips', () => {
    expect(validateBand({ ...raw, chips: [raw.chips[0]] }, HAY, 'review', null)).toBeNull()
    expect(validateBand({ ...raw, chips: [raw.chips[0], chip('x y', 'z', 'missing quote')] }, HAY, 'review', null)).toBeNull()
  })

  test('truncates the title to 90 characters and ignores a suggestion to the same station', () => {
    const band = validateBand({ ...raw, title: 'w'.repeat(200), suggestion: { station: 'review', reason: 'r' } }, HAY, 'review', null)
    expect(band?.title).toHaveLength(90)
    expect(band?.suggestion).toBeNull()
  })

  test('garbage in, nothing out', () => {
    expect(validateBand(null, HAY, 'review', null)).toBeNull()
    expect(validateBand('text', HAY, 'review', null)).toBeNull()
  })
})

describe('finding and flags', () => {
  test('a finding needs high confidence and a verbatim quote', () => {
    const f = { station: 'review', kind: 'unchecked_claim', evidence: ['18.4%', 'invented'], confidence: 'high' }
    expect(validateFinding(f, HAY)).toEqual({ station: 'review', kind: 'unchecked_claim', evidence: ['18.4%'] })
    expect(validateFinding({ ...f, confidence: 'low' }, HAY)).toBeNull()
    expect(validateFinding({ ...f, evidence: ['invented'] }, HAY)).toBeNull()
    expect(validateFinding({ ...f, station: 'nope' }, HAY)).toBeNull()
    expect(validateFinding({ ...f, kind: 'Not Snake' }, HAY)).toBeNull()
  })

  test('flags keep unverified evidence marked, unknown types dropped', () => {
    const flags = validateFlags(
      [
        { type: 'share_intent', evidence: 'Send the churn numbers to Mette' },
        { type: 'new_task', evidence: 'made up' },
        { type: 'other', evidence: 'x' },
      ],
      HAY,
    )
    expect(flags.map(f => [f.type, f.hasEvidence])).toEqual([
      ['share_intent', true],
      ['new_task', false],
    ])
  })
})

describe('prompt note', () => {
  test('keeps only grounded items', () => {
    const hay = 'Make a summary for Mette by Thursday. A customer has churned when the contract ends.'
    const ok = validateNote(
      {
        good: { text: 'Audience and deadline are clear', evidence: 'for Mette by Thursday', kind: null },
        suggestion: { template: 'A customer has churned when ___', evidence: 'A customer has churned', kind: 'missing_done' },
      },
      hay,
    )
    expect(ok.good?.text).toBe('Audience and deadline are clear')
    expect(ok.suggestion?.template).toContain('___')
    const bad = validateNote(
      { good: { text: 'Nice', evidence: 'not there' }, suggestion: { template: 'no blank', evidence: 'A customer has churned' } },
      hay,
    )
    expect(bad).toEqual({ good: null, suggestion: null })
  })

  test('truncates the note to 50 characters and rejects long templates', () => {
    const hay = 'some prompt text here'
    const r = validateNote(
      {
        good: { text: 'x'.repeat(80), evidence: 'prompt text' },
        suggestion: { template: `${'y'.repeat(90)} ___`, evidence: 'prompt text' },
      },
      hay,
    )
    expect(r.good?.text).toHaveLength(50)
    expect(r.suggestion).toBeNull()
  })
})
