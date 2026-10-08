import { describe, expect, test } from 'claude-code/testing'
import { harness } from './seed'
import { INITIAL } from '../hooks/initial'

// The live desktop case: a fresh chat, preview on, the person's first message.
describe('live repro', () => {
  for (const kind of ['composer', 'sdk'] as const) {
    test(`a first message from ${kind} is recorded as Plan with a gap`, async ($, on) => {
      const { box } = harness(on, { prefs: { ...INITIAL.prefs, sessions: 5, settings: { ...INITIAL.prefs.settings, preview: true } } })
      on('prompt.submit', (_$, e) => ({ text: e.text }))
      await $.prompt.submit({ text: 'help me with a client convo', wait: false, origin: { kind } })
      const v = box.value
      expect(v.station).toBe('plan')
      expect(JSON.stringify(v.rowNotes)).toContain('starting new work')
      expect(JSON.stringify(v.trace)).not.toContain('error')
    })
  }
})
