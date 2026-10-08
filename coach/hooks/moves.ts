import type { CoachStation } from '../types'

export type Move = {
  move: CoachStation
  // The rule that fired, for the trace; null when the default (a new instruction) applied.
  hit: string | null
  // What the move did, for the user row's ✓ note and the rail caption.
  note: string | null
  // A caption that says more than the move's default, such as "starting new work".
  caption?: string
}

const any = (...patterns: string[]) => new RegExp(patterns.join('|'), 'i')

// Asks for a plan before any work: decided first so "make a plan ... instead" stays a plan.
const PLAN_FIRST = any(
  String.raw`\b(make|write|draft|create|give me|show me|sketch)\s+(me\s+)?(a|an|the)?\s*(plan|outline|proposal|roadmap)\b`,
  String.raw`\bhow would you\b`,
  String.raw`\bshould we\b`,
  String.raw`\bdon'?t (change|touch|edit|do|write) anything\b`,
  String.raw`\b(lav|skriv|giv mig)\s+(en\s+)?(plan|forslag)\b`,
  String.raw`\bhvordan ville du\b`,
  String.raw`\bskal vi\b`,
  String.raw`\bændr ikke noget\b`,
)

const OWN = any(
  String.raw`\bgit\s+(push|commit)\b`,
  String.raw`\b(push|deploy|publish|ship|release)\b`,
  String.raw`\bgo live\b`,
  String.raw`\bcommit (it|this|that|the|these|all|my)\b`,
  String.raw`\b(send|email|mail|forward|share)\s+(it|this|that|them|the\s+\w+(\s+\w+)?)\s+(to|with)\b`,
  String.raw`\b(send|del|videresend)\s+(den|det|dem|rapporten|mailen|filen)\s+(til|med)\b`,
  String.raw`\b(udgiv|publicer|udrul|skub)\b`,
)

const REVIEW = any(
  String.raw`\bwhy did you\b`,
  String.raw`\bhow did you\b`,
  String.raw`\bare you sure\b`,
  String.raw`\bis (that|this|it) (right|correct|true|accurate)\b`,
  String.raw`\b(double[- ]?check|fact[- ]?check|verify|check (the|that|this|it|if|whether|your|those|these))\b`,
  String.raw`\bthat'?s (wrong|not right|incorrect|not true)\b`,
  String.raw`\bnot what i (meant|asked|wanted)\b`,
  String.raw`\b(wrong|incorrect|mistake)\b`,
  String.raw`\bdoesn'?t (look|seem|add up|match)\b`,
  String.raw`\b(instead|rather than)\b`,
  String.raw`(^|[.!?]\s*)no[,.!]`,
  String.raw`\bwhere did you (get|find)\b`,
  String.raw`\bwhat did you assume\b`,
  String.raw`\b(what'?s|what is) the source\b`,
  String.raw`\bsource for\b`,
  String.raw`\bhvorfor (valgte|gjorde|tog|brugte) du\b`,
  String.raw`\ber du sikker\b`,
  String.raw`\b(det er|dét er) (forkert|ikke rigtigt)\b`,
  String.raw`\bforkert\b`,
  String.raw`\bi stedet( for)?\b`,
  String.raw`\b(tjek|kontroller|verificer|dobbelttjek)\b`,
  String.raw`\bhvor har du\b`,
  String.raw`\bkilde\b`,
)

const CORRECTS = any(
  String.raw`\b(instead|rather than|wrong|incorrect|mistake|forkert|i stedet)\b`,
  String.raw`\bthat'?s (wrong|not right|incorrect|not true)\b`,
  String.raw`\bnot what i (meant|asked|wanted)\b`,
  String.raw`(^|[.!?]\s*)no[,.!]`,
)

const PLAN_GENERAL = any(
  String.raw`\bplan\b`,
  String.raw`\boutline\b`,
  String.raw`\b(what are|give me|list|compare|weigh)\b.{0,25}\b(options|alternatives)\b`,
  String.raw`\bapproach\b`,
  String.raw`\bpropose\b`,
  String.raw`\bbefore you (change|start|touch|begin|code|write|edit|do anything)\b`,
  String.raw`\bthink (it )?through\b`,
  String.raw`\b(forslag|tilgang|muligheder|før du (ændrer|starter|skriver|retter))\b`,
)

// Starting a new piece of work is the Plan step: deciding what Claude should do. Checked after the explicit
// plan, Own and Review phrases, so "help me check this" stays a Review.
const NEW_WORK = any(
  String.raw`\b(help|assist) (me )?(with|to|prep|prepare|plan|build|write|create|make|draft|figure)\b`,
  String.raw`\bi (want|need|would like|'d like)( some)? (help|to (start|build|write|create|make|draft|prepare|prep|plan|work on))\b`,
  String.raw`\b(can|could) you help\b`,
  String.raw`\bprep(are)? (for|a|an|the|my|our)\b`,
  String.raw`\blet'?s (start|begin|work on|build|make|do|tackle)\b`,
  String.raw`\b(a|my|our) new (pitch|project|task|analysis|deck|proposal|email|report|presentation|plan|idea|product|campaign)\b`,
  String.raw`\bhjælp (mig )?(med|til)\b`,
  String.raw`\bjeg (vil|skal|har brug for)( gerne)? (have )?(hjælp|lave|skrive|forberede|bygge)\b`,
  String.raw`\blad os (starte|begynde|lave|arbejde)\b`,
)

// Taking a result as final is the Own step: the person now stands behind it. Short approvals and words
// about it leaving the room ("final", "ready to send", "for the client").
const APPROVE = any(
  String.raw`^\W*(that|this|it)?\s*(looks|sounds|seems|is)\s+(good|great|perfect|fine|right|spot on)\b`,
  String.raw`^\W*(perfect|great|excellent|lgtm|love it|nice|good job|ship it|good to go)\W*$`,
  String.raw`\b(use (it|this|that) as is|go with (it|this|that))\b`,
  String.raw`^\W*(det )?(ser|lyder) (godt|fint|perfekt) ud\b`,
  String.raw`^\W*(perfekt|super|fint)\W*$`,
)

// The result is about to leave the room: named as final or ready to send. Naming an audience alone is not
// enough ("write a summary for the steering group" is an instruction).
const SHARE = any(
  String.raw`\b(final version|finali[sz]e|ready to (send|ship|share|go))\b`,
  String.raw`\b(endelig version|klar til at sende)\b`,
)

// Only counts as questioning the result when the person has just been reviewing.
const REVIEW_WEAK = any(String.raw`^\s*(why|how come|what makes|explain)\b`, String.raw`\bwhy\b`, String.raw`^\s*(hvorfor|forklar)\b`)

const NOTE: Record<CoachStation, string | null> = {
  plan: 'Asked for a plan',
  brief: null,
  review: 'Questioned the result',
  own: 'About to ship',
}

const found = (re: RegExp, text: string): string | null => re.exec(text)?.[0]?.trim() ?? null

export function classifyMove(text: string, previous: CoachStation): Move {
  const make = (move: CoachStation, hit: string | null): Move => ({
    move,
    hit,
    note: move === 'review' && CORRECTS.test(text) ? 'Corrected Claude' : NOTE[move],
  })
  const planFirst = found(PLAN_FIRST, text)
  if (planFirst) return make('plan', planFirst)
  const own = found(OWN, text)
  if (own) return make('own', own)
  const review = found(REVIEW, text)
  if (review) return make('review', review)
  const plan = found(PLAN_GENERAL, text)
  if (plan) return make('plan', plan)
  const approve = found(APPROVE, text)
  if (approve) return { move: 'own', hit: approve, note: null, caption: 'taking it as final' }
  const fresh = found(NEW_WORK, text)
  if (fresh) return { move: 'plan', hit: fresh, note: null, caption: 'starting new work' }
  const share = found(SHARE, text)
  if (share) return { move: 'own', hit: share, note: null, caption: 'taking it as final' }
  if (previous === 'review') {
    const weak = found(REVIEW_WEAK, text)
    if (weak) return make('review', weak)
  }
  return make('brief', null)
}

export const MOVE_CAPTION: Record<CoachStation, string> = {
  plan: 'asked for a plan',
  brief: 'gave an instruction',
  review: 'questioned the result',
  own: 'about to ship',
}
