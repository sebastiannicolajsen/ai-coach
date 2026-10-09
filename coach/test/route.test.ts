import { describe, expect, test } from 'claude-code/testing'
import { onTurnComplete } from '../hooks/flow'
import { effortOf } from '../hooks/parse-route'
import { INITIAL } from '../hooks/initial'
import { differs, chooseForTurn, endTurnChoice, familyOf, isSameDraft, parseRoute, recommend, stepModel, switchTo } from '../hooks/route'
import { answered, makeFake } from './fake'

const settings = (over: Partial<typeof INITIAL.prefs.settings> = {}) => ({ ...INITIAL.prefs, settings: { ...INITIAL.prefs.settings, ...over } })

describe('reading a model', () => {
  test('ids, aliases and labels map to a family', () => {
    expect(familyOf('claude-opus-5-5')).toBe('opus')
    expect(familyOf('sonnet')).toBe('sonnet')
    expect(familyOf('Fable 5.1 (1M context)')).toBe('fable')
    expect(familyOf('')).toBeNull()
  })

  test('a reply is kept only with a known model and a short reason', () => {
    expect(parseRoute({ model: 'opus', reason: 'Planning.' })).toEqual({ model: 'opus', reason: 'planning' })
    expect(parseRoute({ model: 'gpt', reason: 'x' })).toBeNull()
    expect(parseRoute({ model: 'haiku', reason: '' })).toBeNull()
  })

  test('the recommendation belongs to the draft while the draft still starts the same way', () => {
    const route = { draft: 'Plan how we migrate the billing service', model: 'opus' as const, reason: 'planning' }
    expect(isSameDraft(route, 'Plan how we migrate the billing service to the new queue')).toBe(true)
    expect(isSameDraft(route, 'Rename the file')).toBe(false)
  })

  test('only the main loop is moved, to the full id', () => {
    expect(stepModel('fable')).toBe('claude-fable-5-1')
    expect(stepModel(null)).toBeNull()
  })
})

describe('recommending while typing', () => {
  test('a short draft is not judged', async () => {
    const f = makeFake()
    f.box.text = 'hi there'
    expect(await recommend(f.ctx)).toBeNull()
    expect(f.requests.length).toBe(0)
  })

  test('a draft is judged once by the smallest model', async () => {
    const f = makeFake()
    f.box.text = 'Plan how we migrate the billing service to the new queue'
    f.replies.push(answered({ model: 'opus', reason: 'planning' }))
    const r = await recommend(f.ctx)
    expect(r).toEqual({ draft: f.box.text, model: 'opus', reason: 'planning' })
    expect(f.requests[0]).toMatchObject({ model: 'claude-haiku-5-5', effort: 'low' })
    expect(f.requests[0]!.prompt).toContain('Current model: sonnet')
    expect(f.state.cost.usd).toBeGreaterThan(0)
    await recommend(f.ctx)
    expect(f.requests.length).toBe(1)
  })

  test('off means no call', async () => {
    const f = makeFake({ prefs: settings({ recommendModel: false, modelSwitch: 'off' }) })
    f.box.text = 'Plan how we migrate the billing service to the new queue'
    expect(await recommend(f.ctx)).toBeNull()
    expect(f.requests.length).toBe(0)
  })
})

describe('switching', () => {
  const draft = 'Plan how we migrate the billing service to the new queue'
  const route = { draft, model: 'opus' as const, reason: 'planning' }

  test('with switching off the prompt stays on the session model and nothing is asked', async () => {
    const f = makeFake({ route, sessionModel: 'claude-sonnet-5-5', prefs: settings({ modelSwitch: 'off' }) })
    await chooseForTurn(f.ctx, draft)
    expect(f.state.modelChoice).toBeNull()
    expect(f.state.route).toBeNull()
    expect(f.asks).toEqual([])
  })

  test('by default the prompt is held and the person is asked before it runs', async () => {
    const f = makeFake({ route, sessionModel: 'claude-sonnet-5-5' })
    f.askAnswer.value = 'Send with Opus 5.5 (Recommended)'
    await chooseForTurn(f.ctx, draft)
    expect(f.asks).toEqual(['This looks like planning. Send it with Opus 5.5 instead of Sonnet 5.5?'])
    expect(f.state.modelChoice).toEqual({ model: 'opus', sticky: true })
  })

  test('keeping the model is remembered, so the same question does not come straight back', async () => {
    const f = makeFake({ route, sessionModel: 'claude-sonnet-5-5', turnIndex: 4 })
    f.askAnswer.value = 'Keep Sonnet 5.5'
    await chooseForTurn(f.ctx, draft)
    expect(f.state.modelChoice).toBeNull()
    expect(f.state.declined).toEqual({ model: 'opus', turn: 4 })
    f.state = { ...f.state, route, turnIndex: 5 }
    await chooseForTurn(f.ctx, draft)
    expect(f.asks.length).toBe(1)
  })

  test('a dismissed dialog sends the prompt as it is', async () => {
    const f = makeFake({ route, sessionModel: 'claude-sonnet-5-5' })
    f.askAnswer.value = new Error('dismissed')
    await chooseForTurn(f.ctx, draft)
    expect(f.state.modelChoice).toBeNull()
  })

  test('"Always switch" and "Stop asking" change the setting', async () => {
    const f = makeFake({ route, sessionModel: 'claude-sonnet-5-5' })
    f.askAnswer.value = 'Always switch for me'
    await chooseForTurn(f.ctx, draft)
    expect(f.state.prefs.settings.modelSwitch).toBe('auto')
    expect(f.state.modelChoice).toEqual({ model: 'opus', sticky: false })
    const g = makeFake({ route, sessionModel: 'claude-sonnet-5-5' })
    g.askAnswer.value = 'Stop asking'
    await chooseForTurn(g.ctx, draft)
    expect(g.state.prefs.settings.modelSwitch).toBe('off')
  })

  test('with auto-switch the prompt goes to the recommended model for this turn only', async () => {
    const f = makeFake({ route, sessionModel: 'claude-sonnet-5-5', prefs: settings({ modelSwitch: 'auto' }) })
    await chooseForTurn(f.ctx, draft)
    expect(f.state.modelChoice).toEqual({ model: 'opus', sticky: false })
    await endTurnChoice(f.ctx)
    expect(f.state.modelChoice).toBeNull()
  })

  test('auto-switch judges a prompt sent before the recommendation came back', async () => {
    const f = makeFake({ sessionModel: 'claude-opus-5-5', prefs: settings({ modelSwitch: 'auto' }) })
    f.replies.push(answered({ model: 'haiku', reason: 'quick edit' }))
    await chooseForTurn(f.ctx, 'Rename the variable total to grandTotal in report.ts')
    expect(f.state.modelChoice).toEqual({ model: 'haiku', sticky: false })
  })

  test('a Switch stays until changed back, and switching to the session model clears it', async () => {
    const f = makeFake({ sessionModel: 'claude-sonnet-5-5', prefs: settings({ modelSwitch: 'off' }) })
    await switchTo(f.ctx, 'opus')
    expect(f.state.modelChoice).toEqual({ model: 'opus', sticky: true })
    await chooseForTurn(f.ctx, 'next prompt here please')
    await endTurnChoice(f.ctx)
    expect(f.state.modelChoice).toEqual({ model: 'opus', sticky: true })
    await switchTo(f.ctx, 'sonnet')
    expect(f.state.modelChoice).toBeNull()
  })
})

describe('after a reply', () => {
  test('the analysis names the model the likely next prompt suits', async () => {
    const f = makeFake({ turnIndex: 3, lastPrompt: 'Compare the supplier quotes', sessionModel: 'claude-sonnet-5-5' })
    f.replies.push(answered({ card: {}, flags: [], finding: null, next_model: { model: 'opus', reason: 'reviewing the figures' } }))
    await onTurnComplete(f.ctx, 'Option B from Nordlys is 12% cheaper.', true)
    await f.flush()
    expect(f.state.route).toEqual({ draft: '', model: 'opus', reason: 'reviewing the figures' })
  })
})

describe('effort', () => {
  test('a step\'s effort reads as a level, names or thinking tokens', () => {
    expect(effortOf('xhigh')).toBe('xhigh')
    expect(effortOf(2000)).toBe('low')
    expect(effortOf(40000)).toBe('xhigh')
    expect(effortOf(undefined)).toBeNull()
  })

  test('the same model at another effort is still worth showing', () => {
    expect(differs({ draft: '', model: 'opus', reason: 'x', effort: 'high' }, 'opus', 'medium')).toBe(true)
    expect(differs({ draft: '', model: 'opus', reason: 'x', effort: 'high' }, 'opus', 'high')).toBe(false)
    expect(differs({ draft: '', model: 'opus', reason: 'x' }, 'opus', 'medium')).toBe(false)
  })

  test('the dialog names the effort and the switch carries it', async () => {
    const draft = 'Plan how we migrate the billing service to the new queue'
    const f = makeFake({ route: { draft, model: 'opus', reason: 'planning', effort: 'high' }, sessionModel: 'claude-sonnet-5-5', sessionEffort: 'medium' })
    f.askAnswer.value = 'Send with Opus 5.5 · high (Recommended)'
    await chooseForTurn(f.ctx, draft)
    expect(f.asks[0]).toBe('This looks like planning. Send it with Opus 5.5 at high effort instead of Sonnet 5.5?')
    expect(f.state.modelChoice).toEqual({ model: 'opus', sticky: true, effort: 'high' })
  })
})

describe('switching the session itself', () => {
  test('a pick changes the session\'s own model and effort rows, so the app\'s picker shows it', async () => {
    const f = makeFake({ sessionModel: 'claude-sonnet-5-5', sessionEffort: 'medium' })
    f.configRows.push(
      { key: 'model', label: 'Model', kind: 'choice', value: 'sonnet', options: ['haiku', 'sonnet', 'opus', 'fable'] },
      { key: 'effortLevel', label: 'Effort', kind: 'choice', value: 'medium', options: ['low', 'medium', 'high', 'xhigh', 'max'] },
    )
    await switchTo(f.ctx, 'opus', 'high')
    expect(f.configRows.map(r => r.value)).toEqual(['opus', 'high'])
    expect(f.state.modelChoice).toBeNull()
    expect(f.state.sessionEffort).toBe('high')
  })

  test('without the rows the switch applies to each request instead', async () => {
    const f = makeFake({ sessionModel: 'claude-sonnet-5-5', sessionEffort: 'medium' })
    await switchTo(f.ctx, 'opus', 'high')
    expect(f.state.modelChoice).toEqual({ model: 'opus', sticky: true, effort: 'high' })
  })
})
