import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import {
  addTrace,
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
import { EDIT_TOOLS, PLAN_FILE_RE, COACH_MODELS, isCoachModel } from './config'
import { formatTrace } from './trace'
import { classifyCommand, onPrompt, onPush, onTurnComplete } from './flow'
import { openAsk } from './meta'
import { renderAbovePrompt } from './ui/band'
import { withSurface } from './ui/glyph'
import { assistantLabel, userLabel } from './ui/labels'
import { renderGallery } from './ui/gallery'
import { renderCommandOutput } from './ui/output'
import { renderPane } from './ui/pane'

// What /coach help prints, one command per line.
export const HELP = [
  'Commands',
  '/coach  open the pane: the steps, a Stuck? chat, settings',
  '/coach on · /coach off  turn the coach on or off (for every chat)',
  '/coach preview on · off  show every finding from the first session',
  '/coach model haiku · haiku-5.5 · sonnet · opus  pick the model that writes the feedback (Haiku 5.5 is the default)',
  '/coach model  show which model runs now',
  '/coach why  the last analysis: what ran, what came back, what was dropped',
  '/coach settings  open the pane at the settings',
  '/coach ask  open the Stuck? chat',
  '/coach about  what the coach reads and stores',
  '/coach gallery  drawing test for the surface you are on',
].join('\n')

export const ABOUT = [
  "Reads: your prompts, Claude's answers and tool names in this session, only to follow the loop.",
  "Sends: short excerpts to Haiku through this session's own connection, and nothing to any other service.",
  'Keeps in memory: a small context card for this session only, cleared when it ends.',
  'Stores on disk: counters and settings only (on or off, sessions, dismissals), never message text.',
].join('\n')

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
        argumentHint: '[help|pane|ask|settings|model [haiku|haiku-5.5|sonnet|opus]|preview [on|off]|why|gallery|about|on|off]',
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
    await savePrefs(c, q => ({ ...q, sessions: q.sessions + 1 }))
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
    case 'help':
      return { text: HELP }
    case 'about':
      return { text: ABOUT }
    case 'preview':
    case 'preview on':
    case 'preview off': {
      // "on" and "off" set it outright; plain "preview" toggles.
      const next = arg === 'preview on' ? true : arg === 'preview off' ? false : !(await c.get()).prefs.settings.preview
      await saveSettings(c, { preview: next })
      return { text: next ? 'Preview on: every finding shows.' : 'Preview off.' }
    }
    case 'model':
    case 'model haiku':
    case 'model haiku-5.5':
    case 'model sonnet':
    case 'model opus': {
      const name = arg.split(' ')[1]
      if (!isCoachModel(name)) {
        const now = COACH_MODELS[(await c.get()).prefs.settings.model] ?? COACH_MODELS['haiku-5.5']
        return { text: `Feedback model: ${now.label}. Change it with /coach model haiku, haiku-5.5, sonnet or opus.` }
      }
      await saveSettings(c, { model: name })
      return { text: `Feedback model: ${COACH_MODELS[name].label}.` }
    }
    case 'gallery':
      return { text: 'Gallery' }
    case 'why':
      return { text: formatTrace((await c.get()).trace) }
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

// A failed hook leaves a line in /coach why and the debug log instead of vanishing.
async function report($: EngineInterface, hook: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  $.ui.log(`${hook} failed: ${message}`, { to: 'debug' })
  try {
    await addTrace(shim($), 'error', false, `${hook}: ${message}`)
  } catch {
    // Nothing left to report to.
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
      // Settings live in the store, shared by every chat: read them again, so a change made in another chat
      // (preview, on/off, cadence) applies here from the next message.
      await loadPrefs(shim($))
      if ((await isOn($)) && isPersonPrompt(e.origin.kind)) await onPrompt(shim($), e.text)
    } catch (err) {
      // The coach never gets in the way of a prompt, but the failure shows in /coach why.
      await report($, 'prompt.submit', err)
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
        } else if (name === 'ExitPlanMode') {
          await dispatch(shim($), { type: 'plan_approved' })
        } else if (EDIT_TOOLS.includes(name)) {
          const isPlan = PLAN_FILE_RE.test(String(args.file_path ?? ''))
          await dispatch(shim($), { type: isPlan ? 'plan_written' : 'acting' })
        }
      }
    } catch (err) {
      // Observation only: a failure here never blocks the call.
      await report($, 'tool.call', err)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    try {
      await init($)
      if ((await isOn($)) && !e.agentId) await onTurnComplete(shim($), e.answer, e.reason === 'answer')
    } catch (err) {
      await report($, 'turn.complete', err)
    }
    return next(e)
  })

  on('command.run', { command: 'coach' }, ($, e) => runCommand($, e.args))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await scheduleInit($)
    return renderAbovePrompt(shim($), e, next as never)
  })

  on('ui.render', { component: 'CommandOutput', props: { command: 'coach' } }, ($, e) =>
    e.props.args.trim() === 'gallery' ? renderGallery(shim($), e) : renderCommandOutput(shim($), e, e.props.text),
  )

  on('ui.render', { component: 'Pane', requestId: 'coach' }, ($, e) => renderPane(shim($), e))

  // isExpanded is not a reason to skip: the desktop app draws every row in full, so it is always true there.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const c = shim($)
    const prefs = (await read($, state)).prefs
    if (!prefs.enabled || !prefs.settings.labels || !isPersonPrompt(e.props.origin.kind)) {
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
