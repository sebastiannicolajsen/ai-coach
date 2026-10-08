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
export type CoachModel = 'haiku' | 'sonnet' | 'opus'

export type CoachSettings = {
  model: CoachModel
  cadence: CoachCadence
  pausePushes: CoachPausePushes
  labels: boolean
  hotkeys: boolean
  preview: boolean
}

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
