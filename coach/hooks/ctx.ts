import type { EngineInterface } from 'claude-code'
import type { CoachState } from '../types'

// The engine's `$` cannot cross a file boundary, so register.tsx hands the rest of the
// mod this narrow set of closures instead. Tests can supply their own.
export type Ctx = {
  get: () => Promise<CoachState>
  patch: <K extends keyof CoachState>(key: K, fn: (value: CoachState[K]) => CoachState[K]) => Promise<unknown>
  ui: Pick<EngineInterface['ui'], 'log' | 'toast' | 'ask' | 'open' | 'resolve'>
  model: Pick<EngineInterface['model'], 'complete'>
  prompt: Pick<EngineInterface['prompt'], 'fill' | 'suggest' | 'read' | 'submit'>
  store: Pick<EngineInterface['store'], 'get' | 'set'>
  clock: Pick<EngineInterface['clock'], 'after'>
  session: Pick<EngineInterface['session'], 'usage' | 'authorize' | 'surface'> & {
    messages: () => Promise<{ role: 'user' | 'assistant'; text: string }[]>
  }
}
