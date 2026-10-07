import type { CoachSettings, CoachStation } from '../types'

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
  cadence: 'every',
  pausePushes: 'unset',
  labels: true,
  hotkeys: false,
  preview: false,
}

export const HAIKU = {
  model: 'haiku',
  effort: 'low',
  timeoutMs: 8000,
  maxTokens: { a: 500, b: 300, c: 120, meta: 500 },
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
  templateText: 80,
  windowText: 1500,
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

// Pre-filled when a station is focused and the prompt box is empty.
export const FOCUS_TEMPLATE: Record<CoachStation, string> = {
  plan: 'The goal is ___, and what must not change is ___.',
  brief: 'This is for ___, who needs it to ___.',
  review: 'Which of your assumptions about ___ should I check first?',
  own: '',
}
export const OWN_CONTINUE = 'Continue anyway'

export const PUSH_RE = /\bgit\s+(?:-C\s+\S+\s+)?push\b/
export const COMMIT_RE = /\bgit\s+(?:-C\s+\S+\s+)?commit\b/
export const DEPLOY_RE =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:deploy|publish|release)|npm\s+publish|vercel(?:\s+\S+)*\s+--prod|vercel\s+deploy|netlify\s+deploy|kubectl\s+(?:apply|rollout)|terraform\s+apply|cdk\s+deploy|serverless\s+deploy|sls\s+deploy|gh\s+release\s+create|docker\s+push|twine\s+upload|cargo\s+publish|fly\s+deploy|firebase\s+deploy)\b/

export const EDIT_TOOLS: readonly string[] = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']

export const CLOSED_LOOP_RE =
  /\?|\b(?:no|not|wrong|actually|instead|why|sure|source|check|verify|doesn'?t|isn'?t|didn'?t|but|nej|ikke|forkert|hvorfor|kilde)\b/i

export const FOCUS_ONLY_KINDS: readonly string[] = []

export const STATIC_CHIPS: Record<CoachStation, { label: string; fill: string }[]> = {
  plan: [
    { label: 'Goal and limits', fill: 'The goal is ___, and what must not change is ___.' },
    { label: 'Should Claude do this?', fill: 'Is this something Claude should do, or should I do part of it myself? Tell me why.' },
    { label: 'Outline first', fill: 'Before changing anything, outline your approach and what you need from me.' },
  ],
  brief: [
    { label: 'Who it is for', fill: 'This is for ___, who needs it to ___.' },
    { label: 'What done looks like', fill: 'It is done when ___.' },
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

// Prices in USD per million tokens.
// Source: https://platform.claude.com/docs/en/about-claude/pricing (read 2026-10-07).
// Claude Haiku 4.5: $1 input, $5 output, $1.25 5m cache write, $0.10 cache read.
// The same page lists Claude Haiku 5.5 at $0.10 / $0.50 (write 0.125, read 0.01); the 'haiku' alias
// is priced as 4.5 here, which is the safe upper bound. Change COACH_PRICE if the alias resolves to 5.5.
export type Price = { input: number; output: number; cacheWrite: number; cacheRead: number }

export const PRICES: Record<string, Price> = {
  'haiku-4.5': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  'haiku-5.5': { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
}

export const COACH_PRICE: Price = PRICES['haiku-4.5']!
