import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { CoachState } from '../types'
import { INITIAL } from '../hooks/initial'

// In-memory stand-ins for what the engine answers beneath the plugin.
export function harness(on: On, over: Partial<CoachState> = {}) {
  mock.store(on)
  const clock = mock.clock(on)
  const box = { value: { ...INITIAL, ready: true, sessionCounted: true, ...over } as CoachState, version: 1 }
  const seen = { fills: [] as string[], models: [] as string[] }
  on('state.get', async (_$, e, next) => {
    const r = await next(e)
    if (e.plugin !== 'coach') return r
    if (r.deny !== undefined) return r
    const read = r.value
    return { value: { ...read, value: read.value === undefined ? box.value : read.value } }
  })
  on('state.set', async (_$, e, next) => {
    if (e.plugin === 'coach') box.value = e.value as CoachState
    return next(e)
  })
  on('ui.open', () => ({ value: undefined }) as never)
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [], cost: { usd: 1.48 } } }) as never)
  on('session.authorize', () => ({ value: { handle: 'test', kind: 'api-key' } }) as never)
  on('session.surface', () => ({ value: 'terminal' }) as never)
  on('prompt.fill', (_$, e) => {
    seen.fills.push(e.text)
    return { isFilled: true } as never
  })
  on('model.complete', () => {
    seen.models.push('call')
    return {
      value: {
        isAnswered: true,
        text: 'What would a good result look like for you?',
        usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      },
    } as never
  })
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  return { box, seen, clock }
}
