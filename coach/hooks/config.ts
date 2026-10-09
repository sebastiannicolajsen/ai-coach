import type { CoachSettings, CoachStation, CoachModel, RouteModel } from '../types'

export const STATIONS: readonly CoachStation[] = ['plan', 'brief', 'review', 'own']

export const OUTER: readonly CoachStation[] = ['plan', 'own']

// Claude Code's muted, theme-aware keys (they follow light and dark). If the engine refuses one,
// swap in STATION_COLOR_FALLBACK (plain ANSI names, no bright variants).
export const STATION_COLOR: Record<CoachStation, string> = {
  plan: 'purple_FOR_SUBAGENTS_ONLY',
  brief: 'cyan_FOR_SUBAGENTS_ONLY',
  review: 'yellow_FOR_SUBAGENTS_ONLY',
  own: 'pink_FOR_SUBAGENTS_ONLY',
}

export const STATION_COLOR_FALLBACK: Record<CoachStation, string> = {
  plan: 'magenta',
  brief: 'cyan',
  review: 'yellow',
  own: 'red',
}

// Light-mode tones sampled from the visual refs; an Svg or a remote surface's Text takes raw colours only.
export const STATION_HEX: Record<CoachStation, string> = {
  plan: '#8B7FD6',
  brief: '#2A9D8F',
  review: '#D08A1E',
  own: '#D45A85',
}

export const STATION_WORD_HEX: Record<CoachStation, string> = {
  plan: '#6E5FC4',
  brief: '#1F8577',
  review: '#B06A12',
  own: '#B83C6A',
}

export const STATION_NAME: Record<CoachStation, string> = {
  plan: 'Plan',
  brief: 'Brief',
  review: 'Review',
  own: 'Own',
}

export const STATION_CAPTION: Record<CoachStation, string> = {
  plan: 'deciding what Claude should do',
  brief: 'your next prompt',
  review: 'checking what Claude gave you',
  own: 'standing behind what you ship',
}

export const STATION_TOOLTIP: Record<CoachStation, string> = {
  plan: 'Decide what Claude should do, and how',
  brief: 'Your next prompt',
  review: 'Check what Claude gave you',
  own: 'Stand behind what you ship',
}

// Small secondary labels only (never in the main UI).
export const STATION_MEANING: Record<CoachStation, string> = {
  plan: 'Decide what Claude should do',
  brief: 'Say what you need',
  review: 'Check what came back',
  own: 'Stand behind what ships',
}

// One line shown at once when a step is picked, before the specific band is ready.
export const STATIC_TITLE: Record<CoachStation, string> = {
  plan: 'Before Claude starts, say what the work is and what must not change.',
  brief: 'Your next prompt could say who it is for and what done looks like.',
  review: 'Pick the claims in the last answer that you would check yourself.',
  own: 'Before this goes out, three quick checks.',
}

export const STATION_FRAMEWORK: Record<CoachStation, string> = {
  plan: 'Delegation',
  brief: 'Description',
  review: 'Discernment',
  own: 'Diligence',
}

export const ATTRIBUTION = 'Based on the AI Fluency Framework by Dakan, Feller and Anthropic, CC BY-NC-SA 4.0.'

export const DEFAULT_SETTINGS: CoachSettings = {
  model: 'haiku-5.5',
  cadence: 'every',
  pausePushes: 'unset',
  labels: true,
  hotkeys: false,
  preview: false,
  recommendModel: true,
  modelSwitch: 'ask',
}

// The models a prompt can be sent with. Prices per million tokens (input / output), from the same page.
export const ROUTE_MODELS: Record<RouteModel, { id: string; label: string }> = {
  fable: { id: 'claude-fable-5-1', label: 'Fable 5.1' },
  opus: { id: 'claude-opus-5-5', label: 'Opus 5.5' },
  sonnet: { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  haiku: { id: 'claude-haiku-5-5', label: 'Haiku 5.5' },
}

// The recommender runs on the smallest model, whatever writes the feedback: it reads a draft, not a turn.
// The three modes, as the toggle beside Coach names them.
export const MODEL_SWITCH_LABEL = { ask: 'Prompt me', auto: 'Auto-select', off: 'Only show' } as const

// After the person keeps their model, the same recommendation is not asked about for this many prompts.
export const DECLINE_TURNS = 3

export const ROUTER = { model: 'claude-haiku-5-5', effort: 'low', timeoutMs: 5000, maxTokens: 120, debounceMs: 900, minWords: 4 } as const

// The models the feedback can run on, by their full ids so the price is the right one. Prices per million
// tokens from https://platform.claude.com/docs/en/about-claude/pricing (read 2026-10-08); ids from the models overview.
export const COACH_MODELS: Record<CoachModel, { id: string; label: string; timeoutMs: number; price: Price }> = {
  haiku: { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', timeoutMs: 8000, price: { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 } },
  // Haiku 5.5 is priced by prompt length; the coach's prompts stay far below the 100,000-token step.
  'haiku-5.5': { id: 'claude-haiku-5-5', label: 'Haiku 5.5', timeoutMs: 8000, price: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 } },
  sonnet: { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', timeoutMs: 15000, price: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 } },
  opus: { id: 'claude-opus-5-5', label: 'Opus 5.5', timeoutMs: 25000, price: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 } },
}

export const isCoachModel = (v: unknown): v is CoachModel => typeof v === 'string' && v in COACH_MODELS

export const HAIKU = {
  model: 'haiku',
  effort: 'low',
  timeoutMs: 8000,
  maxTokens: { a: 1600, b: 800, c: 400, meta: 600 },
} as const

export const LIMITS = {
  title: 90,
  chipLabelWords: 5,
  chipLabelChars: 32,
  chipFill: 160,
  chips: 3,
  minChips: 2,
  cardField: 120,
  cardList: 5,
  noteText: 50,
  templateText: 120,
  windowText: 1500,
  answerText: 2400,
  captionText: 60,
  aboutWords: 10,
  reasonText: 60,
  evidenceMin: 3,
} as const

export const BLOCKLIST: readonly string[] = [
  'who is the audience',
  'add more context',
  'be more specific',
  'check the output',
  'check the result',
  'add more detail',
  'provide more context',
  'what is the goal',
  'verify the output',
  'review the answer',
]

export const OWN_CHECKS: readonly string[] = ['Tested myself', 'No client data', 'AI assistance noted']
export const OWN_PASS_TEXT = 'Checks done. Go ahead with the push.'
export const OWN_DENY_TEXT =
  "Push paused at the Own check. Wait for the person to finish the checks; don't retry."

// Suggested in the empty prompt box when a station is focused. Slots are named in brackets: [audience].
export const SLOT_RE = /\[[^\]\n]{2,24}\]|___/
export const FOCUS_TEMPLATE: Record<CoachStation, string> = {
  plan: 'The goal is [goal], and what must not change is [limits].',
  brief: 'This is for [audience], who needs it to [decide or do].',
  review: 'Which of your assumptions about [topic] should I check first?',
  own: '',
}
export const OWN_CONTINUE = 'Continue anyway'

export const PUSH_RE = /\bgit\s+(?:-C\s+\S+\s+)?push\b/
export const COMMIT_RE = /\bgit\s+(?:-C\s+\S+\s+)?commit\b/
export const DEPLOY_RE =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:deploy|publish|release)|npm\s+publish|vercel(?:\s+\S+)*\s+--prod|vercel\s+deploy|netlify\s+deploy|kubectl\s+(?:apply|rollout)|terraform\s+apply|cdk\s+deploy|serverless\s+deploy|sls\s+deploy|gh\s+release\s+create|docker\s+push|twine\s+upload|cargo\s+publish|fly\s+deploy|firebase\s+deploy)\b/

export const PLAN_FILE_RE = /(^|\/)(\.claude\/plans\/|plan[^/]*\.md$|[^/]*-plan\.md$)/i

export const EDIT_TOOLS: readonly string[] = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']

export const CLOSED_LOOP_RE =
  /\?|\b(?:no|not|wrong|actually|instead|why|sure|source|check|verify|doesn'?t|isn'?t|didn'?t|but|nej|ikke|forkert|hvorfor|kilde)\b/i

export const FOCUS_ONLY_KINDS: readonly string[] = []

export const STATIC_CHIPS: Record<CoachStation, { label: string; fill: string }[]> = {
  plan: [
    { label: 'Goal and limits', fill: 'The goal is [goal], and what must not change is [limits].' },
    { label: 'Should Claude do this?', fill: 'Is this something Claude should do, or should I do part of it myself? Tell me why.' },
    { label: 'Outline first', fill: 'Before changing anything, outline your approach and what you need from me.' },
  ],
  brief: [
    { label: 'Who it is for', fill: 'This is for [audience], who needs it to [decide or do].' },
    { label: 'What done looks like', fill: 'It is done when [result].' },
  ],
  review: [
    { label: 'What did you assume?', fill: 'Which assumptions did you make in that answer, and which parts are you least sure about?' },
    { label: 'How do I verify this?', fill: 'How can I check the main claims in your answer myself?' },
  ],
  own: [
    { label: 'Check before sharing', fill: 'Before this goes out, list what I should check myself and what could be wrong.' },
    { label: 'Data in it', fill: 'Does this contain client or personal data that should not leave this machine?' },
  ],
}

export const STARTER_CHIPS: readonly string[] = [
  "My result isn't what I wanted",
  'How do I check this?',
  'Should Claude do this at all?',
  'What should I tell the client about AI use?',
]

// Prices in USD per million tokens; the per-model values live in COACH_MODELS above.
export type Price = { input: number; output: number; cacheWrite: number; cacheRead: number }
