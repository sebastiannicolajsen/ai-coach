import type { CoachTrace } from '../types'

export const TRACE_TITLE = 'Last analysis'

// One line per call, separated by " | " so the command output can draw it as a table.
export function formatTrace(trace: CoachTrace[]): string {
  if (trace.length === 0) return 'Nothing analysed yet. It runs after each of Claude\'s replies.'
  const rows = trace.map(t => `t${t.turn} | ${t.call} | ${t.ok ? 'ok' : 'no'} | ${t.detail}`)
  return [TRACE_TITLE, ...rows].join('\n')
}
