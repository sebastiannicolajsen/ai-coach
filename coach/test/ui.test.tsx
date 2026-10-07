import { describe, expect, test } from 'claude-code/testing'
import type { On, RenderSurface } from 'claude-code'
import type { CoachBand, CoachState } from '../types'
import { INITIAL } from '../hooks/initial'
import { makeOwnCheck } from '../hooks/own'
import { noteKey } from '../hooks/notes'
import { harness } from './seed'

const BAND: CoachBand = {
  station: 'review',
  kind: 'unchecked_claim',
  title: 'The 18.4% goes to Mette with no source yet',
  evidence: ['18.4%', 'Mette'],
  chips: [
    { label: 'Source for 18.4%', fill: 'Where does 18.4% come from?', evidence: '18.4%' },
    { label: 'SMB as driver', fill: 'What shows SMB is the driver?', evidence: 'SMB' },
  ],
  suggestion: { station: 'own', reason: 'This is going to Mette.' },
  source: 'finding',
}

const BAND_PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 20,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
}

const PANE_PROPS = {
  title: 'Coach',
  isFocused: false,
  bodyColumns: 60,
  placement: 'inline',
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
} as const

const USER_PROPS = { text: 'Why is it 18.4%?', origin: { kind: 'composer' }, isExpanded: false } as const
const ANSWER_PROPS = { text: 'Churn is 18.4% and SMB is the driver.', isFirstOfReply: true }

const SURFACES = ['terminal', 'desktop'] as const
type Surface = (typeof SURFACES)[number]

const OWN = makeOwnCheck({ ...INITIAL.card, recipient: 'Mette, steering group' }, 'git push origin main', false)

const prefs = (sessions: number, over = {}) => ({ ...INITIAL.prefs, sessions, ...over })

// One test per surface, each with its own fresh state.
const each = (name: string, over: Partial<CoachState>, body: (surface: Surface, h: ReturnType<typeof harness>, $: never, on: On) => Promise<void>) => {
  for (const surface of SURFACES) {
    test(`${name} (${surface})`, async ($, on) => {
      await body(surface, harness(on, over), $ as never, on)
    })
  }
}

const mountBand = ($: never, surface: RenderSurface, props = BAND_PROPS) =>
  ($ as { ui: { mount: (t: object) => Promise<any> } }).ui.mount({ plugin: 'coach', surface, component: 'AbovePrompt', props })

describe('coach band', () => {
  each('Coach opens one row: Focus on four steps left, cost and Turn off right', { prefs: prefs(5), cost: { tokens: 1, usd: 0.02 }, usage: { convUsd: 13.97, isApprox: true } }, async (surface, _h, $) => {
    const ui = await mountBand($, surface)
    expect(await ui.find({ type: 'Text', text: 'Plan' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'deciding what Claude should do' })).toBeDefined()
    expect(await ui.find({ key: 'pick-plan' })).toBeUndefined()
    await ui.press({ key: 'menu' })
    const buttons = await ui.findAll({ type: 'Button' })
    expect(buttons.map((b: { key?: string }) => b.key).sort()).toEqual(['menu', 'menu-off', 'pick-brief', 'pick-own', 'pick-plan', 'pick-review'])
    expect(await ui.find({ key: 'menu-settings' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'Focus on' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '≈$0.02 this session' })).toBeDefined()
    await ui.press({ key: 'pick-review' })
    expect(await ui.find({ type: 'Text', text: 'Focus · Review' })).toBeDefined()
    expect(await ui.find({ key: 'pick-review' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /claims in the last answer/ })).toBeDefined()
    await ui.unmount()
  })

  each('a focus band shows even mid-turn, never blank', { prefs: prefs(5), focus: 'brief', band: { ...BAND, station: 'brief', source: 'focus', title: 'Your next prompt could say who it is for.' } }, async (surface, _h, $) => {
    const ui = await mountBand($, surface, { ...BAND_PROPS, isWorking: true })
    expect(await ui.find({ type: 'Text', text: 'Your next prompt could say who it is for.' })).toBeDefined()
    await ui.unmount()
  })

  each('a finding band shows title, source and chips; a chip fills the prompt box', { prefs: prefs(5), band: BAND }, async (surface, h, $) => {
    const ui = await mountBand($, surface)
    expect(await ui.find({ type: 'Text', text: BAND.title })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '18.4% · Mette' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: "· Claude's last reply" })).toBeDefined()
    expect(await ui.find({ key: 'chip-1' })).toBeDefined()
    expect(await ui.find({ key: 'suggest' })).toBeDefined()
    expect(await ui.find({ key: 'ask' })).toBeUndefined()
    await ui.press({ key: 'chip-0' })
    expect(h.seen.fills).toEqual(['Where does 18.4% come from?'])
    await ui.unmount()
  })

  each('dismissing hides the band and counts the dismissal', { prefs: prefs(5), band: BAND }, async (surface, h, $) => {
    const ui = await mountBand($, surface)
    await ui.press({ key: 'dismiss' })
    expect(await ui.find({ type: 'Text', text: BAND.title })).toBeUndefined()
    expect(h.box.value.sessionDismissals.unchecked_claim).toBe(1)
    expect(h.box.value.prefs.dismissals.unchecked_claim).toBe(1)
    await ui.unmount()
  })

  each('the band never shows mid-turn', { prefs: prefs(5), band: BAND }, async (surface, _h, $) => {
    const ui = await mountBand($, surface, { ...BAND_PROPS, isWorking: true })
    expect(await ui.find({ type: 'Text', text: BAND.title })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'Plan' })).toBeDefined()
    await ui.unmount()
  })

  each('the rail yields to a survey', { prefs: prefs(5), band: BAND }, async (surface, _h, $) => {
    const ui = await mountBand($, surface, { ...BAND_PROPS, hasSurvey: true } as never).catch(() => null)
    // With nothing beneath the plugin to draw, a survey turn leaves no coach text at all.
    expect(ui === null || (await ui.find({ key: 'picker' })) === undefined).toBe(true)
  })

  each('Own band: title, quotes, one row of checks, Continue anyway', { prefs: prefs(5), station: 'own', ownCheck: OWN }, async (surface, h, $) => {
    const ui = await mountBand($, surface)
    expect(await ui.find({ type: 'Text', text: 'This goes to Mette. Three quick checks.' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'git push · email to Mette' })).toBeDefined()
    expect((await ui.find({ key: 'own-0' }))?.props.label).toBe('☐ Tested myself')
    expect((await ui.find({ key: 'own-continue' }))?.props.plain).toBe(true)
    await ui.press({ key: 'own-0' })
    expect((await ui.find({ key: 'own-0' }))?.props.label).toBe('☑ Tested myself')
    await ui.press({ key: 'own-continue' })
    expect(await ui.find({ key: 'own-0' })).toBeUndefined()
    expect(h.box.value.station).toBe('review')
    await ui.unmount()
  })

  each('coach off leaves one muted line that turns it back on', { prefs: prefs(5, { enabled: false }) }, async (surface, h, $) => {
    const ui = await mountBand($, surface)
    expect(await ui.find({ key: 'coach-on' })).toBeDefined()
    expect(await ui.find({ key: 'menu' })).toBeUndefined()
    await ui.press({ key: 'coach-on' })
    expect(h.box.value.prefs.enabled).toBe(true)
    await ui.unmount()
  })
})

const mount = ($: never, surface: RenderSurface, component: string, props: object, requestId?: string) =>
  ($ as { ui: { mount: (t: object) => Promise<any> } }).ui.mount({ plugin: 'coach', surface, component, props, requestId })

const everyNode = (node: unknown, out: { type?: string; props?: Record<string, unknown> }[] = []) => {
  if (typeof node !== 'object' || node === null) return out
  const n = node as { type?: string; props?: Record<string, unknown>; children?: unknown[] }
  out.push(n)
  for (const c of n.children ?? []) everyNode(c, out)
  return out
}

describe('visual pass', () => {
  const surfaceWord = (surface: string) => (surface === 'desktop' ? '#B06A12' : 'yellow_FOR_SUBAGENTS_ONLY')

  each('rail at rest: one row, one Button, no rule, no bold, no backgrounds', { prefs: prefs(5), station: 'review' }, async (surface, _h, $) => {
    const ui = await mountBand($, surface)
    const nodes = everyNode(await ui.drawn())
    expect(nodes.filter(n => n.type === 'Button')).toHaveLength(1)
    expect((await ui.find({ key: 'menu' }))?.props.dimColor).toBeUndefined()
    expect(nodes.some(n => n.props && 'backgroundColor' in n.props)).toBe(false)
    expect(nodes.some(n => n.props && n.props.bold)).toBe(false)
    expect(JSON.stringify(nodes)).not.toContain('────')
    expect(nodes.filter(n => n.type === 'Svg').length).toBe(surface === 'desktop' ? 1 : 0)
    const coloured = nodes.filter(n => n.type === 'Text' && n.props?.color)
    expect(coloured.map(n => n.props?.color)).toContain(surfaceWord(surface))
    expect(coloured).toHaveLength(surface === 'terminal' ? 2 : 1)
    if (surface === 'terminal') expect(JSON.stringify(nodes)).toContain('━')
    await ui.unmount()
  })

  each('finding band: no header row, × on the title row, native chips, rule only above the rail', { prefs: prefs(5), band: BAND }, async (surface, _h, $) => {
    const ui = await mountBand($, surface, { ...BAND_PROPS, bodyColumns: 40 })
    const nodes = everyNode(await ui.drawn())
    expect(nodes.some(n => n.props && 'backgroundColor' in n.props)).toBe(false)
    expect(nodes.some(n => n.props && n.props.bold)).toBe(false)
    const json = JSON.stringify(await ui.drawn())
    expect(json.split('─'.repeat(40)).length - 1).toBe(surface === 'terminal' ? 1 : 0)
    if (surface === 'desktop') expect(json).not.toContain('─')
    expect(nodes.filter(n => n.type === 'Svg').length).toBe(surface === 'desktop' ? 2 : 0)
    expect(JSON.stringify(await ui.drawn())).not.toContain('Focus')
    expect((await ui.find({ key: 'chip-0' }))?.props.plain).toBeUndefined()
    expect((await ui.find({ key: 'dismiss' }))?.props.role).toBe('dismiss')
    expect(await ui.find({ key: 'ask' })).toBeUndefined()
    if (surface === 'desktop') {
      const svgs = nodes.filter(n => n.type === 'Svg')
      const rule = svgs.find(n => n.props?.alt === '')
      expect(rule).toBeDefined()
      expect(rule?.props?.width).toBeUndefined()
      expect(rule?.props?.height).toBe(1)
      expect(String(rule?.props?.source)).toContain('preserveAspectRatio="none"')
    }
    await ui.unmount()
  })

  each('focus band has no extra header; the rail says Focus', { prefs: prefs(5), focus: 'brief', band: { ...BAND, station: 'brief', source: 'focus' } }, async (surface, _h, $) => {
    const ui = await mountBand($, surface)
    const found = await ui.findAll({ type: 'Text', text: 'Focus · Brief' })
    expect(found).toHaveLength(1)
    await ui.unmount()
  })

  each('the picker is one row of four native buttons', { prefs: prefs(5), menuOpen: true }, async (surface, _h, $) => {
    const ui = await mountBand($, surface)
    expect(JSON.stringify(await ui.drawn())).not.toContain('●')
    for (const s of ['plan', 'brief', 'review', 'own']) {
      expect((await ui.find({ key: `pick-${s}` }))?.props.plain).toBeUndefined()
    }
    expect((await ui.find({ key: 'menu-off' }))?.props.plain).toBeUndefined()
    await ui.unmount()
  })

  each('labels keep the active bar coloured and draw no backgrounds', { prefs: prefs(2), notes: { [noteKey('Why is it 18.4%?')]: 'Questioned the result' } }, async (surface, _h, $) => {
    const ui = await mount($, surface, 'UserMessage', USER_PROPS)
    const nodes = everyNode(await ui.drawn())
    expect(nodes.some(n => n.props && 'backgroundColor' in n.props)).toBe(false)
    expect(nodes.some(n => n.props && n.props.bold)).toBe(false)
    expect(nodes.some(n => n.type === 'Svg')).toBe(surface === 'desktop')
    expect(await ui.find({ type: 'Text', text: '✓ Questioned the result' })).toBeDefined()
    if (surface === 'terminal') expect(nodes.some(n => n.type === 'Text' && n.props?.color === 'cyan_FOR_SUBAGENTS_ONLY')).toBe(true)
    await ui.unmount()
  })
})

describe('message labels', () => {
  each('user rows carry Brief and the check note in sessions 1-3', { prefs: prefs(2), notes: { [noteKey('Why is it 18.4%?')]: 'Questioned the result' } }, async (surface, _h, $) => {
    const ui = await mount($, surface, 'UserMessage', USER_PROPS)
    expect(await ui.find({ type: 'Text', text: 'Why is it 18.4%?' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Brief' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '✓ Questioned the result' })).toBeDefined()
    expect((await ui.findAll({ type: 'Box' })).some((b: { props: Record<string, unknown> }) => b.props.display === 'none')).toBe(false)
    await ui.unmount()
  })

  each('from session 4 an older row hides its label until hover', { prefs: prefs(5), lastPrompt: 'newer prompt' }, async (surface, _h, $) => {
    const ui = await mount($, surface, 'UserMessage', USER_PROPS)
    expect((await ui.findAll({ type: 'Box' })).some((b: { props: Record<string, unknown> }) => b.props.display === 'none')).toBe(true)
    await ui.unmount()
  })

  each('the latest prompt keeps its label in session 4 and is never written from the render', { prefs: prefs(5), lastPrompt: USER_PROPS.text, turnIndex: 3 }, async (surface, h, $) => {
    const before = JSON.stringify(h.box.value)
    const ui = await mount($, surface, 'UserMessage', USER_PROPS, 'row-9')
    expect((await ui.findAll({ type: 'Box' })).some((b: { props: Record<string, unknown> }) => b.props.display === 'none')).toBe(false)
    await h.clock.advance(1)
    await ui.unmount()
    expect(JSON.stringify(h.box.value)).toBe(before)
  })

  each('a row recorded as older stays hidden until hover', { prefs: prefs(5), lastPrompt: 'something else', turnIndex: 3, rows: { user: 'row-new', reply: '', userTurn: 3, replyTurn: 0 } }, async (surface, _h, $) => {
    const ui = await mount($, surface, 'UserMessage', USER_PROPS, 'row-old')
    expect((await ui.findAll({ type: 'Box' })).some((b: { props: Record<string, unknown> }) => b.props.display === 'none')).toBe(true)
    await ui.unmount()
  })

  each('prompts from an SDK host are labelled; the row holding the message sets no width', { prefs: prefs(2) }, async (surface, _h, $) => {
    const ui = await mount($, surface, 'UserMessage', { ...USER_PROPS, origin: { kind: 'sdk' } })
    expect(await ui.find({ type: 'Text', text: 'Brief' })).toBeDefined()
    const boxes: { props: Record<string, unknown> }[] = await ui.findAll({ type: 'Box' })
    // The engine refuses its own message node under a Box with a width.
    const row = boxes.find(b => typeof b.props.key === 'string' && (b.props.key as string).startsWith('row-'))
    expect(row?.props.width).toBeUndefined()
    expect(boxes.some(b => b.props.width === '100%')).toBe(true)
    await ui.unmount()
  })

  each('from session 4 the latest row keeps its label', { prefs: prefs(5), lastPrompt: USER_PROPS.text }, async (surface, _h, $) => {
    const ui = await mount($, surface, 'UserMessage', USER_PROPS)
    expect((await ui.findAll({ type: 'Box' })).some((b: { props: Record<string, unknown> }) => b.props.display === 'none')).toBe(false)
    await ui.unmount()
  })

  each('assistant replies carry Review', { prefs: prefs(2), lastAnswer: ANSWER_PROPS.text }, async (surface, _h, $) => {
    const ui = await mount($, surface, 'AssistantMessage', ANSWER_PROPS)
    expect(await ui.find({ type: 'Text', text: 'Review' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Own' })).toBeUndefined()
    await ui.unmount()
  })

  each('assistant replies carry Own while a check is active', { prefs: prefs(2), lastAnswer: ANSWER_PROPS.text, ownCheck: OWN }, async (surface, _h, $) => {
    const ui = await mount($, surface, 'AssistantMessage', ANSWER_PROPS)
    expect(await ui.find({ type: 'Text', text: 'Own' })).toBeDefined()
    await ui.unmount()
  })

  const skipped: [string, Partial<CoachState>, object][] = [
    ['coach off', { prefs: prefs(2, { enabled: false }) }, USER_PROPS],
    ['labels off', { prefs: prefs(2, { settings: { ...INITIAL.prefs.settings, labels: false } }) }, USER_PROPS],
    ['expanded row', { prefs: prefs(2) }, { ...USER_PROPS, isExpanded: true }],
    ['notification row', { prefs: prefs(2) }, { ...USER_PROPS, origin: { kind: 'task-notification' } }],
  ]
  for (const [name, state, props] of skipped) {
    each(`no label for: ${name}`, state, async (surface, _h, $) => {
      const ui = await mount($, surface, 'UserMessage', props)
      expect(await ui.find({ type: 'Text', text: 'Brief' })).toBeUndefined()
      await ui.unmount()
    })
  }
})

describe('the rule between feedback and rail', () => {
  const rules = (nodes: { type?: string; props?: Record<string, unknown> }[]) => nodes.filter(n => n.type === 'Svg' && n.props?.alt === '')
  each('desktop: a 1px Svg exists whenever band content or the fold is shown, never at rest', { prefs: prefs(5), band: BAND }, async (surface, h, $) => {
    const ui = await mountBand($, surface)
    const withBand = everyNode(await ui.drawn())
    expect(rules(withBand)).toHaveLength(surface === 'desktop' ? 1 : 0)
    if (surface === 'desktop') expect(rules(withBand)[0]?.props?.height).toBe(1)
    await ui.press({ key: 'dismiss' })
    expect(rules(everyNode(await ui.drawn()))).toHaveLength(0)
    await ui.press({ key: 'menu' })
    const folded = everyNode(await ui.drawn())
    expect(rules(folded)).toHaveLength(surface === 'desktop' ? 1 : 0)
    if (surface === 'terminal') expect(JSON.stringify(await ui.drawn())).toContain('─'.repeat(80))
    expect(h.box.value.menuOpen).toBe(true)
    await ui.unmount()
  })
})

describe('what a band is about', () => {
  each('a static focus band says where it applies', { prefs: prefs(5), focus: 'review', band: { ...BAND, evidence: [], source: 'fallback', title: 'Pick the claims you would check.' } }, async (surface, _h, $) => {
    const ui = await mountBand($, surface)
    expect(await ui.find({ type: 'Text', text: "On Claude's last reply" })).toBeDefined()
    await ui.unmount()
  })

  each('the reply label says note below only while the band is about that row', { prefs: prefs(5), band: BAND, bandRow: 'reply', lastAnswer: 'Churn is 18.4% and SMB is the driver.', turnIndex: 1 }, async (surface, h, $) => {
    const props = { text: 'Churn is 18.4% and SMB is the driver.', isFirstOfReply: true }
    const about = await mount($, surface, 'AssistantMessage', props, 'r1')
    expect(await about.find({ type: 'Text', text: '· note below' })).toBeDefined()
    expect((await about.findAll({ type: 'Box' })).some((b: { props: Record<string, unknown> }) => b.props.display === 'none')).toBe(false)
    await about.unmount()
    const other = await mount($, surface, 'AssistantMessage', { ...props, text: 'An older reply about something else.' }, 'r0')
    expect(await other.find({ type: 'Text', text: '· note below' })).toBeUndefined()
    await other.unmount()
    expect(h.box.value.bandRow).toBe('reply')
  })

  each('no suffix without a band', { prefs: prefs(2), band: null, bandRow: 'r1' }, async (surface, _h, $) => {
    const ui = await mount($, surface, 'AssistantMessage', { text: 'x', isFirstOfReply: true }, 'r1')
    expect(await ui.find({ type: 'Text', text: '· note below' })).toBeUndefined()
    await ui.unmount()
  })
})

describe('the check note on a prompt', () => {
  each('arrives after the row drew, from an sdk prompt, and redraws it', { prefs: prefs(2), station: 'review' }, async (surface, h, $, on) => {
    on('prompt.submit', (_$: unknown, e: { text: string }) => ({ text: e.text }) as never)
    const text = 'Use contract end instead. Go.'
    const ui = await mount($, surface, 'UserMessage', { text, origin: { kind: 'sdk' }, isExpanded: false })
    expect(await ui.find({ type: 'Text', text: /✓/ })).toBeUndefined()
    await ($ as unknown as { prompt: { submit: (a: object) => Promise<unknown> } }).prompt.submit({ text, wait: false, origin: { kind: 'sdk' } })
    await h.clock.advance(1)
    expect(await ui.find({ type: 'Text', text: '✓ Corrected Claude' })).toBeDefined()
    expect(h.box.value.turnIndex).toBe(1)
    expect(h.seen.models.length).toBeGreaterThan(0)
    await ui.unmount()
  })

  each('is matched when the row text differs in spacing or case', { prefs: prefs(2), notes: { [noteKey('why is it 18.4%?')]: 'Questioned the result' } }, async (surface, _h, $) => {
    const ui = await mount($, surface, 'UserMessage', { text: '  Why   is it\n18.4%?  ', origin: { kind: 'sdk' }, isExpanded: false })
    expect(await ui.find({ type: 'Text', text: '✓ Questioned the result' })).toBeDefined()
    await ui.unmount()
  })
})

describe('pane', () => {
  each('steps first, no rail, section labels, starter chips, footer', { prefs: prefs(5), station: 'review', card: { ...INITIAL.card, about: 'Q3 churn analysis for the steering group' }, cost: { tokens: 1, usd: 0.02 }, usage: { convUsd: 13.97, isApprox: true } }, async (surface, _h, $) => {
    const ui = await mount($, surface, 'Pane', PANE_PROPS, 'coach')
    const json = JSON.stringify(await ui.drawn())
    expect(json).not.toContain('checking what Claude gave you')
    expect(json).not.toContain('Coach\\"')
    expect(json).not.toContain('Delegation')
    expect(json).not.toContain('●')
    for (const t of ['Decide what Claude should do', 'Say what you need', 'Check what came back', 'Stand behind what ships']) {
      expect(await ui.find({ type: 'Text', text: t })).toBeDefined()
    }
    const review = await ui.find({ type: 'Text', text: 'Review' })
    expect(review?.props.color).toBe(surface === 'desktop' ? '#B06A12' : 'yellow_FOR_SUBAGENTS_ONLY')
    expect((await ui.find({ type: 'Text', text: 'Plan' }))?.props.color).toBeUndefined()
    for (const t of ['THIS CONVERSATION', 'STUCK?', 'SETTINGS']) expect(await ui.find({ type: 'Text', text: t })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Q3 churn analysis for the steering group' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Coach ≈$0.02 of $13.97 this session' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Based on the AI Fluency Framework by Dakan, Feller and Anthropic, CC BY-NC-SA 4.0.' })).toBeDefined()
    expect(await ui.find({ key: 'starter-3' })).toBeDefined()
    expect(await ui.find({ key: 'ask' })).toBeDefined()
    expect((await ui.findAll({ type: 'Svg' })).length).toBe(surface === 'desktop' ? 4 : 0)
    await ui.unmount()
  })

  each('a question goes to Haiku and the reply lands in the thread', { prefs: prefs(5) }, async (surface, h, $) => {
    const ui = await mount($, surface, 'Pane', PANE_PROPS, 'coach')
    await ui.input({ key: 'ask', text: 'How do I check this?' })
    expect(h.box.value.meta.map(m => m.role)).toEqual(['user', 'coach'])
    expect(h.box.value.cost.tokens).toBe(20)
    expect(await ui.find({ type: 'Markdown', text: /good result/ })).toBeDefined()
    await ui.unmount()
  })

  each('settings are Selects that persist', { prefs: prefs(5) }, async (surface, h, $) => {
    const ui = await mount($, surface, 'Pane', PANE_PROPS, 'coach')
    expect(await ui.find({ type: 'Select', key: 'set-cadence' })).toBeDefined()
    await ui.select({ key: 'set-cadence', value: 'third' })
    expect(h.box.value.prefs.settings.cadence).toBe('third')
    await ui.select({ key: 'set-pause', value: 'on' })
    expect(h.box.value.prefs.settings.pausePushes).toBe('on')
    await ui.select({ key: 'set-labels', value: 'off' })
    expect(h.box.value.prefs.settings.labels).toBe(false)
    await ui.select({ key: 'set-quiet', value: 'off' })
    expect(h.box.value.prefs.settings.preview).toBe(true)
    await ui.unmount()
  })

  test('without Select (mobile) a button cycles the setting', async ($, on) => {
    const { box } = harness(on, { prefs: prefs(5) })
    const ui = await mount($ as never, 'mobile', 'Pane', PANE_PROPS, 'coach')
    expect(await ui.find({ type: 'Select' })).toBeUndefined()
    await ui.press({ key: 'set-cadence' })
    expect(box.value.prefs.settings.cadence).toBe('third')
    await ui.unmount()
  })
})
