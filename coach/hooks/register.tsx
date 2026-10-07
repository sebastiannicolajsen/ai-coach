import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import {
  dispatch,
  loadPrefs,
  openPane,
  refreshUsage,
  resetSession,
  savePrefs,
  saveSettings,
  setEnabled,
} from './actions'
import { INITIAL } from './initial'
import type { Ctx } from './ctx'
import { EDIT_TOOLS } from './config'
import { classifyCommand, onPrompt, onPush, onTurnComplete } from './flow'
import { openAsk } from './meta'
import { renderAbovePrompt } from './ui/band'
import { withSurface } from './ui/glyph'
import { assistantLabel, userLabel } from './ui/labels'
import { renderPane } from './ui/pane'

export const ABOUT = [
  "Reads: your prompts, Claude's answers and tool names in this session, only to follow the loop.",
  "Sends: short excerpts to Haiku through this session's own connection, and nothing to any other service.",
  'Keeps in memory: a small context card for this session only, cleared when it ends.',
  'Stores on disk: counters and settings only (on or off, sessions, dismissals), never message text.',
].join('\n')

const TOAST = 'The coach follows your loop with Claude. Tap a station to focus it. /coach to turn it off.'

const short = (e: Record<string, unknown>): string =>
  String(e.file_path ?? e.command ?? e.pattern ?? e.path ?? '').slice(0, 60)

const state = atom({ plugin: 'coach', key: 'state' } as const, INITIAL)

// The desktop Code tab is an SDK host, so the person's prompts do not always arrive as 'composer'.
// Skip only what other parties or the engine send.
const NOT_THE_PERSON = [
  'task-notification',
  'scheduled-trigger',
  'peer',
  'peer-send-message',
  'projects-relay',
  'channel',
  'coordinator',
  'observer',
  'observer-activity',
  'auto-continuation',
  'plugin',
]
export const isPersonPrompt = (kind: string): boolean => !NOT_THE_PERSON.includes(kind)

let isCommandRegistered = false
let isInitScheduled = false

function shim($: EngineInterface): Ctx {
  return {
    get: async () => ({ ...INITIAL, ...(await read($, state)) }),
    patch: (key, fn) => update($, state, s => ({ ...INITIAL, ...s, [key]: fn({ ...INITIAL, ...s }[key]) })),
    ui: {
      log: (text, options) => $.ui.log(text, options),
      toast: (text, options) => $.ui.toast(text, options),
      ask: (question, options) => $.ui.ask(question, options),
      open: pane => $.ui.open(pane),
      resolve: e => $.ui.resolve(e),
    },
    model: { complete: (request, options) => $.model.complete(request, options) },
    prompt: {
      fill: input => $.prompt.fill(input),
      suggest: input => $.prompt.suggest(input),
      read: () => $.prompt.read(),
      submit: input => $.prompt.submit(input),
    },
    store: { get: key => $.store.get(key), set: (key, value) => $.store.set(key, value) },
    clock: { after: (ms, fn) => $.clock.after(ms, fn) },
    session: {
      usage: args => $.session.usage(args),
      authorize: () => $.session.authorize(),
      surface: () => $.session.surface(),
      messages: () => $.session.messages(),
    },
  }
}

async function init($: EngineInterface) {
  const c = shim($)
  if (!isCommandRegistered) {
    isCommandRegistered = true
    try {
      await $.command.register({
        name: 'coach',
        description: 'Coach: on/off, pane, ask, settings, about',
        argumentHint: '[pane|ask|settings|preview|about|on|off]',
        immediate: true,
      })
    } catch {
      isCommandRegistered = false
    }
  }
  if (!(await c.get()).ready) {
    await c.patch('ready', () => true)
    await loadPrefs(c)
    await refreshUsage(c)
  }
  if (!(await c.get()).sessionCounted) {
    await c.patch('sessionCounted', () => true)
    const p = await savePrefs(c, q => ({ ...q, sessions: q.sessions + 1 }))
    if (p.sessions === 1 && p.enabled) c.ui.toast(TOAST)
  }
}

async function scheduleInit($: EngineInterface) {
  if (isInitScheduled || (await read($, state)).ready) return
  isInitScheduled = true
  $.clock.after(0, () => void init($))
}

async function isOn($: EngineInterface) {
  return (await read($, state)).prefs.enabled
}

async function turnOnIfOff($: EngineInterface) {
  if (!(await isOn($))) await setEnabled(shim($), true)
}

async function runCommand($: EngineInterface, args: string) {
  await init($)
  const c = shim($)
  const arg = args.trim().toLowerCase()
  switch (arg) {
    case 'about':
      return { text: ABOUT }
    case 'preview': {
      const next = !(await c.get()).prefs.settings.preview
      await saveSettings(c, { preview: next })
      return { text: next ? 'Preview on: every finding shows.' : 'Preview off.' }
    }
    case 'pane':
      await turnOnIfOff($)
      await openPane(c)
      return { text: 'Coach pane opened.' }
    case 'ask':
      await turnOnIfOff($)
      await openAsk(c)
      return { text: 'Ask the coach in the pane.' }
    case 'settings':
      await c.patch('settingsOpen', () => true)
      await openPane(c)
      return { text: 'Coach settings are in the pane.' }
    case 'on':
    case 'off':
      await setEnabled(c, arg === 'on')
      if (arg === 'on') await resetSession(c)
      return { text: arg === 'on' ? 'Coach on.' : 'Coach off.' }
    default:
      await turnOnIfOff($)
      await openPane(c)
      return { text: 'Coach pane opened.' }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await init($)
    await dispatch(shim($), { type: 'session_start' })
    await refreshUsage(shim($))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    try {
      await init($)
      if ((await isOn($)) && isPersonPrompt(e.origin.kind)) await onPrompt(shim($), e.text)
    } catch {
      // The coach never gets in the way of a prompt.
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    try {
      await init($)
      if (await isOn($)) {
        const name = String(e.tool)
        const args = e as unknown as Record<string, unknown>
        await update($, state, st => ({ ...st, tools: [...st.tools, `${name} ${short(args)}`.trim()].slice(-12) }))
        const kind = name === 'Bash' ? classifyCommand(String(args.command ?? '')) : null
        if (kind) {
          const denial = await onPush(shim($), kind, String(args.command ?? ''))
          if (denial) return { deny: denial }
        } else if (EDIT_TOOLS.includes(name)) {
          await dispatch(shim($), { type: 'acting' })
        }
      }
    } catch {
      // Observation only: a failure here never blocks the call.
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    try {
      await init($)
      if ((await isOn($)) && !e.agentId) await onTurnComplete(shim($), e.answer, e.reason === 'answer')
    } catch {
      // Silent.
    }
    return next(e)
  })

  on('command.run', { command: 'coach' }, ($, e) => runCommand($, e.args))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await scheduleInit($)
    return renderAbovePrompt(shim($), e, next as never)
  })

  on('ui.render', { component: 'Pane', requestId: 'coach' }, ($, e) => renderPane(shim($), e))

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const c = shim($)
    const prefs = (await read($, state)).prefs
    if (!prefs.enabled || !prefs.settings.labels || e.props.isExpanded || !isPersonPrompt(e.props.origin.kind)) {
      return next(e)
    }
    return userLabel(c, withSurface(c.ui.resolve(e), e.surface) as never, { requestId: e.requestId, text: e.props.text }, await next(e))
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const c = shim($)
    const prefs = (await read($, state)).prefs
    if (!prefs.enabled || !prefs.settings.labels || !e.props.isFirstOfReply) return next(e)
    return assistantLabel(c, withSurface(c.ui.resolve(e), e.surface) as never, { requestId: e.requestId, text: e.props.text }, await next(e))
  })
}
