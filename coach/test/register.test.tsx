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
    await $.prompt.submit({ text: 'Why is it 18.4%?', wait: false, origin: { kind: 'task-notification' } as never })
    expect(box.value.station).toBe('review')
    expect(box.value.focus).toBe('plan')
    await $.prompt.submit({ text: 'Why is it 18.4%?', wait: false, origin: { kind: 'sdk' } })
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
    await $.prompt.submit({ text: 'Why is it 18.4%?', wait: false, origin: { kind: 'composer' } })
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
    expect(box.value.prefs.settings.preview).toBe(false)
    expect((await run('')).text).toBe('Coach pane opened.')
    expect(box.value.prefs.enabled).toBe(true)
    expect((await run('settings')).text).toContain('settings')
  })
})
