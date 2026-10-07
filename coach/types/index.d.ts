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

export type CoachSettings = {
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
  bandLoading: boolean
  notes: Record<string, string>
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
  latestNote: { turn: number; text: string } | null
}

declare module 'claude-code' {
  interface PluginState {
    coach: { state: CoachState }
  }
}
