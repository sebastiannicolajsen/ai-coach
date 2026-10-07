import type { ModelCompleteRequest, ModelCompleteResult } from 'claude-code'
import type { CoachState } from '../types'
import type { Ctx } from '../hooks/ctx'
import { INITIAL } from '../hooks/initial'

export const usage = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

export const answered = (json: unknown): ModelCompleteResult => ({
  isAnswered: true,
  text: typeof json === 'string' ? json : JSON.stringify(json),
  usage,
})

export type Fake = {
  ctx: Ctx
  state: CoachState
  logs: string[]
  toasts: string[]
  asks: string[]
  fills: string[]
  submitted: string[]
  modes: string[]
  suggested: string[]
  requests: ModelCompleteRequest[]
  replies: ModelCompleteResult[]
  askAnswer: { value: string | Error }
  box: { text: string }
  store: Map<string, unknown>
  flush: () => Promise<void>
}

export function makeFake(over: Partial<CoachState> = {}): Fake {
  const timers: (() => void)[] = []
  const f = {
    state: { ...INITIAL, ...over },
    logs: [] as string[],
    toasts: [] as string[],
    asks: [] as string[],
    fills: [] as string[],
    submitted: [] as string[],
    modes: [] as string[],
    suggested: [] as string[],
    requests: [] as ModelCompleteRequest[],
    replies: [] as ModelCompleteResult[],
    askAnswer: { value: 'ok' as string | Error },
    box: { text: '' },
    store: new Map<string, unknown>(),
  }
  const ctx = {
    get: async () => f.state,
    patch: async (key: keyof CoachState, fn: (v: never) => unknown) => {
      f.state = { ...f.state, [key]: fn(f.state[key] as never) }
    },
    ui: {
      log: (t: string, o?: { to?: string }) => void (o?.to === 'debug' || f.logs.push(t)),
      toast: (t: string) => void f.toasts.push(t),
      ask: async (q: string) => {
        f.asks.push(q)
        if (f.askAnswer.value instanceof Error) throw f.askAnswer.value
        return f.askAnswer.value
      },
      open: async () => ({}),
      resolve: () => {
        throw new Error('not in unit tests')
      },
    },
    model: {
      complete: async (r: ModelCompleteRequest) => {
        f.requests.push(r)
        return f.replies.shift() ?? ({ isAnswered: false, reason: 'empty-reply', usage } as ModelCompleteResult)
      },
    },
    prompt: {
      fill: async (a: { text: string; mode?: string }) => {
        f.fills.push(a.text)
        f.modes.push(a.mode ?? 'replace')
        f.box.text = a.mode === 'insert' ? f.box.text + a.text : a.text
        return { isFilled: true }
      },
      suggest: async (a: { text: string }) => {
        f.suggested.push(a.text)
        return { isShown: f.box.text === '' }
      },
      read: async () => ({ text: f.box.text, cursor: 0 }),
      submit: async (a: { text: string }) => {
        f.submitted.push(a.text)
        return { text: a.text }
      },
    },
    store: {
      get: async (k: string) => f.store.get(k),
      set: async (k: string, v: unknown) => void f.store.set(k, v),
    },
    clock: { after: (_ms: number, fn: () => void) => (timers.push(fn), { cancel: () => {} }) },
    session: {
      usage: async () => ({ cost: { usd: 1.48 } }),
      authorize: async () => null,
      surface: async () => 'terminal',
      messages: async () => [],
    },
  }
  const flush = async () => {
    for (let round = 0; round < 8; round++) {
      while (timers.length) timers.shift()!()
      for (let i = 0; i < 300; i++) await Promise.resolve()
    }
  }
  return Object.assign(f, { ctx: ctx as unknown as Ctx, flush }) as unknown as Fake
}
