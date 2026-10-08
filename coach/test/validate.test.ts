import { describe, expect, test } from 'claude-code/testing'
import { extractJson } from '../hooks/haiku'
import {
  auditChips,
  whyNotFinding,
  GOOD_MOVES,
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
    expect(isVerbatim(HAY, 'Churn numbers to Mette')).toBe(true)
    expect(isVerbatim(HAY, 'churn numbers to Mette.')).toBe(true)
    expect(isVerbatim(HAY, '\u201cchurn numbers to Mette\u201d')).toBe(true)
    expect(isVerbatim(HAY, 'Send churn numbers to Mette by Thursday')).toBe(true)
    expect(isVerbatim(HAY, 'Send the churn figures to Mette by Friday soon')).toBe(false)
    expect(isVerbatim(HAY, 'unrelated words entirely')).toBe(false)
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
    expect(withBlanks('brief', 'The deadline is')).toBe('The deadline is: [detail]')
    expect(withBlanks('brief', 'Churn means ___')).toBe('Churn means ___')
    expect(withBlanks('brief', 'This is for [audience]')).toBe('This is for [audience]')
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

describe('preview', () => {
  const f = { station: 'review', kind: 'unchecked_claim', evidence: ['18.4%'], confidence: 'low' }
  test('a low-confidence finding is kept only in preview, and marked', () => {
    expect(validateFinding(f, HAY)).toBeNull()
    expect(validateFinding(f, HAY, true)).toEqual({ station: 'review', kind: 'unchecked_claim', evidence: ['18.4%'], isLow: true })
  })

  test('one grounded chip plus a static one is enough in preview only', () => {
    const raw = { title: 'The 18.4% has no source yet', chips: [{ label: 'Source for 18.4%', fill: 'Where from?', evidence: '18.4%' }] }
    expect(validateBand(raw, HAY, 'review', null)).toBeNull()
    const band = validateBand(raw, HAY, 'review', null, 'finding', true)
    expect(band?.chips).toHaveLength(2)
    expect(band?.chips[1]?.evidence).toBe('')
  })

  test('audits say why chips were dropped', () => {
    const { kept, dropped } = auditChips(
      [
        { label: 'Source for 18.4%', fill: 'a', evidence: '18.4%' },
        { label: 'Be more specific', fill: 'b', evidence: '18.4%' },
        { label: 'Other thing', fill: 'c', evidence: 'nothing like it at all' },
        { label: 3 },
      ],
      HAY,
      'review',
    )
    expect(kept).toHaveLength(1)
    expect(dropped).toEqual(['generic', 'no evidence', 'malformed'])
  })

  test('why a raw finding was dropped', () => {
    expect(whyNotFinding(null, HAY, false)).toBe('none returned')
    expect(whyNotFinding(f, HAY, false)).toBe('confidence low')
    expect(whyNotFinding({ ...f, confidence: 'high', evidence: ['invented words nobody wrote'] }, HAY, false)).toBe('no evidence found in the turn')
    expect(whyNotFinding({ ...f, confidence: 'high' }, HAY, false)).toBe('kept')
  })
})

describe('prompt note', () => {
  test('keeps only grounded items', () => {
    const hay = 'Make a summary for Mette by Thursday. A customer has churned when the contract ends.'
    const ok = validateNote(
      {
        good: { move: 'audience_named', evidence: 'for Mette by Thursday' },
        suggestion: { template: 'A customer has churned when [event]', evidence: 'A customer has churned', kind: 'missing_done' },
      },
      hay,
    )
    expect(ok.good).toEqual({ text: 'Audience is named', kind: 'missing_audience' })
    expect(ok.suggestion?.template).toContain('[event]')
    const bad = validateNote(
      { good: { move: 'goal_stated', evidence: 'not there' }, suggestion: { template: 'no slot at all', evidence: 'A customer has churned' } },
      hay,
    )
    expect(bad).toEqual({ good: null, suggestion: null, move: null })
  })

  test('free-text notes are rejected; a fixed move maps to our own words', () => {
    const hay = 'some prompt text here'
    expect(validateNote({ good: { text: 'Great prompt, very clear', evidence: 'prompt text' } }, hay).good).toBeNull()
    expect(validateNote({ good: { move: 'made_up_move', evidence: 'prompt text' } }, hay).good).toBeNull()
    for (const [move, { text }] of Object.entries(GOOD_MOVES)) {
      expect(validateNote({ good: { move, evidence: 'prompt text', text: 'ignored free text' } }, hay).good?.text).toBe(text)
    }
    expect(GOOD_MOVES.audience_named?.text).toBe('Audience is named')
  })

  test('templates need a [slot] (or legacy ___) and fit 120 characters', () => {
    const hay = 'some prompt text here'
    const note = (template: string) => validateNote({ suggestion: { template, evidence: 'prompt text' } }, hay).suggestion
    expect(note('This is for [audience]')?.template).toBe('This is for [audience]')
    expect(note('Churn means ___')?.template).toBe('Churn means ___')
    expect(note('No slot in this one')).toBeNull()
    expect(note(`${'y'.repeat(130)} [audience]`)).toBeNull()
  })
})

describe('hardening from live traces', () => {
  test('a cut-off JSON reply is repaired', () => {
    const r = extractJson('Here you go: {"station":"review","title":"Check the 312","chips":[{"label":"Show both","fill":"Show with and without tr') as { title?: string; chips?: unknown[] }
    expect(r?.title).toBe('Check the 312')
    expect(Array.isArray(r?.chips)).toBe(true)
  })

  test('a gap is never a check note', () => {
    const hay = 'Hi there i want help to do some analysis'
    const gap = validateNote({ good: { text: 'Broad request without goal', evidence: 'want help to do some analysis' } }, hay)
    expect(gap.good).toBeNull()
    const ok = validateNote({ good: { move: 'questioned_result', evidence: 'want help' } }, hay)
    expect(ok.good?.text).toBe('Questioned the result')
  })
})
