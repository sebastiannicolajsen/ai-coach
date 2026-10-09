export type CoachStation = 'plan' | 'brief' | 'review' | 'own'

export type CoachMachine = { station: CoachStation; focus: CoachStation | null }

export type CoachCard = {
  task: string
  recipient: string
  definitions: Record<string, string>
  claude_assumptions: string[]
  unchecked_claims: string[]
  about: string
  language: string
}

export type CoachChip = { label: string; fill: string; evidence: string }

export type CoachBand = {
  station: CoachStation
  kind: string
  title: string
  evidence: string[]
  chips: CoachChip[]
  suggestion: { station: CoachStation; reason: string } | null
  source: 'finding' | 'focus' | 'fallback'
}

export type CoachCadence = 'every' | 'third' | 'focus'
export type CoachPausePushes = 'unset' | 'on' | 'off'

// Which model writes the coach's feedback.
export type CoachModel = 'haiku' | 'haiku-5.5' | 'sonnet' | 'opus'

export type CoachSettings = {
  model: CoachModel
  cadence: CoachCadence
  pausePushes: CoachPausePushes
  labels: boolean
  hotkeys: boolean
  preview: boolean
  // Name the model a draft suits as it is typed, and whether the coach sends it there by itself.
  recommendModel: boolean
  // Before a prompt is sent to another model than it suits: ask in a dialog, switch by itself, or do nothing.
  modelSwitch: CoachModelSwitch
}

export type CoachModelSwitch = 'ask' | 'auto' | 'off'

// The models Claude itself can run a prompt on, from the strongest down.
export type RouteModel = 'fable' | 'opus' | 'sonnet' | 'haiku'
// What the coach recommends for the draft in the prompt box, and why, in a few words.
export type CoachRoute = { draft: string; model: RouteModel; reason: string; effort?: RouteEffort }
// How hard Claude thinks, from low to max.
export type RouteEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
// The model the coach runs Claude on: for one prompt (auto-switch) or until changed back (Switch).
export type CoachModelChoice = { model: RouteModel; sticky: boolean; effort?: RouteEffort }

export type CoachFade = Record<string, boolean[]>

export type CoachPrefs = {
  enabled: boolean
  sessions: number
  hintTaps: number
  settings: CoachSettings
  fade: CoachFade
  dismissals: Record<string, number>
  silenced: string[]
}

export type CoachOwnCheck = {
  held: boolean
  ticked: number[]
  title: string
  source: string[]
  checks: string[]
}
export type CoachSuggestion = { template: string; kind: string }
export type CoachMetaMessage = { role: 'user' | 'coach'; text: string }
export type CoachUserNote = {
  move: CoachStation
  note?: string
  outer?: string
  // The step the person was in when they sent this, set when they left Review for something else.
  from?: CoachStation
  // A caption that says more than the move's default, such as "starting new work".
  caption?: string
  // What the prompt could still say, from the slots of the suggested template: "question, audience".
  gap?: string
  // What the message does in this work, in a few specific words: "asks for three angles for the Nordlys pitch".
  detail?: string
  turn: number
}
export type CoachReplyNote = { turn: number; check: string[] }
export type CoachRowNotes = { user: Record<string, CoachUserNote>; reply: CoachReplyNote | null }
export type CoachTrace = { turn: number; call: string; ok: boolean; detail: string }
export type CoachUsage = { convUsd: number | null; isApprox: boolean }
export type CoachRows = { user: string; reply: string; userTurn: number; replyTurn: number }
export type CoachCost = { tokens: number; usd: number }

export type CoachState = {
  ready: boolean
  prefs: CoachPrefs
  station: CoachStation
  focus: CoachStation | null
  stationReason: string
  pulse: boolean
  card: CoachCard
  band: CoachBand | null
  // The last suggestions the person dismissed, so Coach can show them again until the next prompt.
  hiddenBand: CoachBand | null
  bandLoading: boolean
  // The prompt whose feedback is still being written (its note key), so its row shows a spinner.
  noteBusy: string
  route: CoachRoute | null
  modelMenuOpen: boolean
  // The model the person kept their own over, and on which turn, so the dialog does not ask again at once.
  declined: { model: RouteModel; turn: number } | null
  modelChoice: CoachModelChoice | null
  // The session's own model id, as /model shows it.
  sessionModel: string
  // The effort the session's own requests carry, as the last main-loop step showed it.
  sessionEffort: RouteEffort | null
  // A model judgement is under way, so the model slot shows the working mark.
  routeBusy: boolean
  // What to do in the current step, written for this conversation after each reply ("check the 12% figure").
  stationNote: string
  rowNotes: CoachRowNotes
  moveNote: string
  trace: CoachTrace[]
  pendingSuggest: CoachSuggestion | null
  shownSuggest: CoachSuggestion | null
  ownCheck: CoachOwnCheck | null
  menuOpen: boolean
  pickerOpen: boolean
  settingsOpen: boolean
  meta: CoachMetaMessage[]
  metaBusy: boolean
  metaContext: string
  turnIndex: number
  cost: CoachCost
  lastPrompt: string
  lastAnswer: string
  fresh: string[]
  tools: string[]
  dividerTurn: number
  lastBandTurn: number
  sessionDismissals: Record<string, number>
  silencedSession: string[]
  ignoredGaps: Record<string, number>
  askedPause: boolean
  sessionCounted: boolean
  pushPass: boolean
  lastFill: string
  usage: CoachUsage
  rows: CoachRows
  bandRow: string
}

declare module 'claude-code' {
  interface PluginState {
    coach: { state: CoachState }
  }
}
