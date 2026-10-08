import { describe, expect, test } from 'claude-code/testing'
import { harness } from './seed'
import { INITIAL } from '../hooks/initial'

const prefs = (sessions: number, over = {}) => ({ ...INITIAL.prefs, sessions, ...over })

describe('hooks', () => {
  test('prompt.submit never changes or drops the prompt, with the coach on or off', async ($, on) => {
    harness(on, { prefs: prefs(5) })
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    const composer = { kind: 'composer' } as const
    const sent = await $.prompt.submit({ text: '  Why is it 18.4%?  ', wait: false, origin: composer })
    expect(sent).toEqual({ text: '  Why is it 18.4%?  ' })
  })

  test('prompts from an SDK host count as the person; notifications do not', async ($, on) => {
    const { box } = harness(on, { prefs: prefs(5), station: 'review', turnIndex: 1, focus: 'plan' })
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    await $.prompt.submit({ text: 'Write the summary', wait: false, origin: { kind: 'task-notification' } as never })
    expect(box.value.station).toBe('review')
    expect(box.value.focus).toBe('plan')
    await $.prompt.submit({ text: 'Write the summary', wait: false, origin: { kind: 'sdk' } })
    expect(box.value.station).toBe('brief')
    expect(box.value.focus).toBeNull()
    expect(box.value.turnIndex).toBe(2)
  })

  test('prompt.submit passes through while the coach is off', async ($, on) => {
    harness(on, { prefs: prefs(5, { enabled: false }) })
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    expect(await $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } })).toEqual({ text: 'hello' })
  })

  test('prompt.submit moves the rail to Brief and counts the turn', async ($, on) => {
    const { box } = harness(on, { prefs: prefs(5), station: 'review', turnIndex: 1 })
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    await $.prompt.submit({ text: 'Write the summary', wait: false, origin: { kind: 'composer' } })
    expect(box.value.station).toBe('brief')
    expect(box.value.turnIndex).toBe(2)
  })

  test('turn.complete moves the rail to Review', async ($, on) => {
    const { box } = harness(on, { prefs: prefs(1), station: 'brief' })
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
    expect(box.value.station).toBe('review')
  })

  test('a plugin edit while Plan is shown starts the work', async ($, on) => {
    const { box } = harness(on, { prefs: prefs(5), station: 'plan' })
    on('tool.call', () => ({ result: 'ok' }) as never)
    await $.tool.call({ tool: 'Edit', tool_use_id: 't1', file_path: '/a.ts', old_string: 'a', new_string: 'b' } as never)
    expect(box.value.station).toBe('brief')
    expect(box.value.tools[0]).toBe('Edit /a.ts')
  })

  test('/coach about answers in four lines; /coach opens the pane; on and off toggle and persist', async ($, on) => {
    const { box } = harness(on, { prefs: prefs(5) })
    const run = (args: string) => $.command.run({ command: 'coach', args, origin: { kind: 'composer' }, presentation: {} } as never)
    const about = await run('about')
    expect(about.text?.split('\n')).toHaveLength(4)
    expect(about.text).toContain('never message text')
    expect((await run('off')).text).toBe('Coach off.')
    expect(box.value.prefs.enabled).toBe(false)
    expect((await run('on')).text).toBe('Coach on.')
    expect(box.value.prefs.enabled).toBe(true)
    expect((await run('preview')).text).toBe('Preview on: every finding shows.')
    expect(box.value.prefs.settings.preview).toBe(true)
    expect((await run('preview')).text).toBe('Preview off.')
    // "on" and "off" set it outright, so two copies of the coach can never flip it back.
    expect((await run('preview on')).text).toBe('Preview on: every finding shows.')
    expect((await run('preview on')).text).toBe('Preview on: every finding shows.')
    expect((await run('preview off')).text).toBe('Preview off.')
    expect(box.value.prefs.settings.preview).toBe(false)
    expect((await run('')).text).toBe('Coach pane opened.')
    expect(box.value.prefs.enabled).toBe(true)
    expect((await run('settings')).text).toContain('settings')
  })
})

describe('plan files, why and command output', () => {
  test('writing a plan file enters Plan; approving it leaves', async ($, on) => {
    const { box } = harness(on, { prefs: prefs(5), station: 'review' })
    on('tool.call', () => ({ result: 'ok' }) as never)
    await $.tool.call({ tool: 'Write', tool_use_id: 't1', file_path: '/proj/PLAN.md', content: 'x' } as never)
    expect(box.value.station).toBe('plan')
    await $.tool.call({ tool: 'Edit', tool_use_id: 't2', file_path: '/proj/plan.md', old_string: 'a', new_string: 'b' } as never)
    expect(box.value.station).toBe('plan')
    await $.tool.call({ tool: 'Edit', tool_use_id: 't3', file_path: '/proj/src/a.ts', old_string: 'a', new_string: 'b' } as never)
    expect(box.value.station).toBe('brief')
  })

  test('/coach why prints the last analysis, or says there is none', async ($, on) => {
    const { box } = harness(on, { prefs: prefs(5) })
    const run = (args: string) => $.command.run({ command: 'coach', args, origin: { kind: 'composer' }, presentation: {} } as never)
    expect((await run('why')).text).toBe("Nothing analysed yet. It runs after each of Claude's replies.")
    box.value = { ...box.value, trace: [{ turn: 3, call: 'A', ok: true, detail: 'ok · finding none → none returned' }] }
    const text = (await run('why')).text ?? ''
    expect(text.split('\n')[0]).toBe('Last analysis')
    expect(text).toContain('t3 | A | ok | ok · finding none')
  })

  test('a question after a Review from an SDK host shows Review with its caption on the rail', async ($, on) => {
    const { box } = harness(on, { prefs: prefs(5), station: 'review' })
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    await $.prompt.submit({ text: 'Why did you exclude the trial accounts?', wait: false, origin: { kind: 'sdk' } })
    expect(box.value.station).toBe('review')
    expect(box.value.moveNote).toBe('questioned the result')
    expect(Object.values(box.value.rowNotes.user)[0]?.move).toBe('review')
  })
})

describe('feedback model', () => {
  test('/coach model switches the model and says which one runs', async ($, on) => {
    const { box } = harness(on, { prefs: prefs(5) })
    const run = async (args: string) =>
      (await $.command.run({ command: 'coach', args } as never)) as { text: string }
    expect((await run('model sonnet')).text).toBe('Feedback model: Sonnet 5.5.')
    expect(box.value.prefs.settings.model).toBe('sonnet')
    expect((await run('model')).text).toContain('Sonnet 5.5')
    expect((await run('model opus')).text).toBe('Feedback model: Opus 5.5.')
  })
})

describe('help', () => {
  test('/coach help lists every command, the model switch included', async ($, on) => {
    harness(on, { prefs: prefs(5) })
    const r = (await $.command.run({ command: 'coach', args: 'help', origin: { kind: 'composer' }, presentation: {} } as never)) as { text: string }
    for (const part of ['/coach model haiku · sonnet · opus', '/coach preview on', '/coach why', '/coach on · /coach off']) {
      expect(r.text).toContain(part)
    }
  })
})
