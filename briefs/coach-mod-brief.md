# Coach: build brief for Claude Code

An AI fluency thinking partner, built as a Claude Code mod. It shows where you are in the working loop with Claude, and helps you take the next step well, without explaining a framework.

Owner: Sebastian (Implement, DT / AI team) · Status: ready to build v1 · Date: 2026-10-07

---

## 0. Read this first (for Claude Code)

- Build against the mods API types Claude Code generates in `.claude-plugin/types/`. This brief has been checked against the types of **v2.1.289** (2026-10-07); see section 16 for every place the API changed the design. The API changes between releases, so **the generated types win** over anything written here.
- Section 11 lists the things to verify. All have been answered from the 2.1.289 types (section 11); confirm each one at runtime in M0 rather than re-researching.
- Work milestone by milestone (section 14). Stop after each milestone and show the result.
- Never block, rewrite or drop the user's prompt. The coach only adds, suggests and pre-fills.

---

## 1. Purpose and principles

Newcomers use Claude well when they run a loop: brief Claude, review what comes back, refine. Occasionally they step out to plan the work or to own what they ship. Anthropic's AI Fluency Index shows that the review step is the weakest, and that it gets weaker when Claude produces a polished artifact. That is the normal case in Claude Code.

Principles (in priority order):

1. **Silent by default.** No finding, no band. When unsure, say nothing.
2. **One place asks.** Only the band above the prompt asks for anything. Every other surface is passive.
3. **About the work, never the person.** No scores, no praise of the user, no "you forgot".
4. **Grounded.** Every suggestion quotes the conversation it came from.
5. **Fade.** Behaviours the user already shows stop being coached.
6. **Teach by structure, not explanation.** Plain verbs, consistent colour, one-line tooltips. Never mention "4D", "Delegation" etc. in the main UI, only as small secondary labels.
7. **Native.** It should look like a first-party Claude Code feature (section 4.1).

---

## 2. Scope

**v1 (this brief):** station indicator, message labels, outer-loop dividers, coach band (findings, focus and suggestions), meta chat in the pane, Coach menu (cost, on/off, settings), ease-in and fade, Own checks on `git push`.

**Not in v1:** team dashboards or any central reporting, Cowork or claude.ai chat (mods don't exist there), automatic permission-mode switching unless verified (section 11), multi-language UI beyond following the user's language in generated text.

---

## 3. The model: four stations, two loops

| Station | Plain meaning (tooltip) | Framework label (small) | Loop | Colour token |
|---|---|---|---|---|
| Plan | Decide what Claude should do, and how | Delegation | outer | `--text-tint-violet` |
| Brief | Your next prompt | Description | inner | `--text-tint-aqua` |
| Review | Check what Claude gave you | Discernment | inner | `--text-warning` (amber) |
| Own | Stand behind what you ship | Diligence | outer | `--text-tint-magenta` |

Use theme tokens, never hard-coded hex, so light and dark mode both work. Use the same token for a station's word and its marks. No blue and no green: blue reads as a link and green as success. If the tint tokens don't exist in Claude Code's theme, map to the nearest neutral-safe equivalents and report it. The bar position also carries the meaning, so colour is never the only cue.

> **2.1.289:** mods take `color` as "a theme key or a raw color"; the CSS tokens above don't exist and the theme keys aren't enumerated in the types. Use ANSI colour names, which follow the user's terminal palette in light and dark: Plan `magenta`, Brief `cyan`, Review `yellow`, Own `redBright` (rose, so it stays distinct from Plan's violet). Keep the mapping in one `STATION_COLOR` table so it can be swapped for theme keys later.

Attribution, shown in the pane footer and the README: "Based on the AI Fluency Framework by Dakan, Feller and Anthropic, CC BY-NC-SA 4.0." Write all UI copy and prompts yourself. Do not paste course text.

---

## 4. Surfaces

### 4.1 Visual language: quiet

The coach should read as typography, not as coloured UI.

- **Colour only as small marks:** the station word, the 4-bar indicator, the mini glyph in message labels, and the short bar inside a divider.
- **No coloured fills or tinted backgrounds** anywhere in the coach (no tinted pills, chips or bands). This is the main fix from the design review: tinted UI reads as generated, not first-party.
- **Neutral components:** chips are neutral outlines (`--border`, darker on hover). Labels inside the band are muted grey. Checkboxes are neutral hairline squares.
- The coach speaks in the UI sans at small size. Claude's own replies are untouched.
- Clay/brand colour is never used by the coach. It belongs to Claude's actions (Send).
- Sentence case, no exclamation marks, no emoji, no "I". Contractions are fine.
- No shadows, gradients or decorative icons.

### 4.2 The Coach menu (on/off, cost, settings in one place)

- The word `Coach` sits at the right end of the dock's rail line, as a quiet text button (secondary text, hover background, no icon, no switch).
- **Tap `Coach`:** a small menu folds open above it, right-aligned:
  - a muted line: `Coach $0.03 · 2% of $1.48 this session` (section 9),
  - `Turn off coach`,
  - `Settings` (opens `/coach settings`).
- **Turned off:** all coach UI is hidden and Haiku calls stop. Hooks stay registered. The dock shrinks to the rail line with only a muted `Coach off` in the same spot. Tapping it turns the coach back on. On/off therefore always lives in the same place. Persist the state per user in `$.store`.
- Also register a `/coach` command (with `immediate: true`) that toggles on/off, plus `pane`, `ask`, `settings` and `about`. Closing the pane only hides the pane.

### 4.3 Station indicator (the rail)

**At rest:** one word and four bars, on the dock's rail line:

`▬ ▬▬ ▬ ▬  Review · checking what Claude gave you`

- The four bars stand for Plan, Brief, Review and Own. Plan and Own are short (10px); Brief and Review are longer (14px) and sit closer together, so the inner pair reads as one loop without arrows or separators. Only the current bar takes the station colour.
- The word takes the station colour. The caption after it is muted and truncates first on narrow widths.
- Captions: Plan "deciding what Claude should do", Brief "your next prompt", Review "checking what Claude gave you", Own "standing behind what you ship".
- **Tap the indicator:** a picker unfolds above it with the four stations (a small dot plus the name, neutral text, the current one in primary text). Picking one sets the focus (section 5.3), and the indicator shows `Focus · Review`. The picker folds away after choosing.
- **Moves:** the active bar's colour cross-fades (300 ms), and the word changes at the same time. Outer moves also add the divider (section 4.5). A closed loop (a Brief after a Review where the user questioned or corrected Claude) gives the two inner bars a single 300 ms brightness pulse. No arrows, pipes or other separators anywhere.
- On first run, a one-time muted line above the indicator says "Tap to focus the coach on a step." It disappears after the first tap or after three sessions.
- The cost lives in the Coach menu (section 4.2).

### 4.4 Message labels (transcript)

No outlines or borders beside messages. Instead, each message carries a small label in its meta line: the same four-bar glyph as the indicator, in miniature (about 70% size, 3px tall), with the station's bar coloured, followed by the station name in muted text.

- **Your prompts:** under the bubble, right-aligned, `▬ Brief`, followed by the greyed ✓ note when there is one (section 4.7b).
- **Claude's replies:** above the reply, left-aligned, `▬ Review` (or `▬ Own` while an Own check is active). Tooltip: "Your turn to check this."
- **Purpose:** the transcript shows which step each message belongs to, using the same visual code as the indicator, so the mapping teaches itself. A run of Briefs with no questioning between them is visible without any words.
- **Fade:** labels show on every message in sessions 1–3. From session 4 they show only on the latest exchange and on messages next to an outer-loop divider. Older labels appear on hover.
- **Implementation:** wrap the `UserMessage` / `AssistantMessage` render output (`await next(e)` inside a `Box`, label above or below). Supported in 2.1.289 (section 11). Only label `UserMessage` rows whose `origin.kind` is the person's prompt, and `AssistantMessage` blocks with `isFirstOfReply` (the hook fires per text block). Return `next(e)` unchanged while `e.props.isExpanded`. Fallback if it fails at runtime: a dim `$.ui.log` line per turn ("▬ Review").
- **Hover reveal** for older labels: draw them `display: "none"` with `hover: { display: "flex" }` inside a keyed `Box`.

### 4.5 Outer-loop dividers

- When the position moves into Plan or Own, insert a subtle divider in the transcript: a muted hairline with a short station-coloured bar and muted text, such as `── ▬ Own · push paused ──`.
- Never insert more than one divider per turn.
- **2.1.289:** the only way a mod adds a transcript row is `$.ui.log` (a dim notice, never sent to the model), which takes plain text, so the divider is a dim text line without colour or fade-in. Never use `$.session.append` for it.

### 4.6 Coach band (the only surface that asks)

It sits in the `AbovePrompt` band. It is shown only when one of these is true:
- a high-confidence finding exists for the current turn (section 7.2), or
- the user has chosen a focus station, or
- an Own check is active.

Content, top to bottom (order and spacing matter; the review found that equal weights blur together):
1. **Header row:** the mini glyph plus the station name in muted 11px (`Focus · Review` when focused), with dismiss (×) on the right. 6px below.
2. **Title:** the finding, about the work, at most 90 characters, primary text, about 13.5px, line height 1.5.
3. **Source:** directly under the title (4px), because it belongs to the claim. Muted 11px, a small quote mark, then the evidence quotes in italic separated by `·`. No "From" prefix.
4. **Chips:** 12px below the source, with 6px gaps. Two or three neutral chips. Clicking one calls `$.prompt.fill` with its text. Brief chips use blanks (`___`); Review chips may be full questions to Claude. Own checks are hairline checkboxes, followed by a plain-text `Continue anyway`.
5. **Optional suggestion line** under the chips, muted: `Step out to Plan? This has grown into a deliverable.` with one text button `Go to Plan`. At most one suggestion.
6. A hairline separates the band from the indicator line below. Band padding: 12px.

Dismissing hides the band for this turn and counts as a dismissal for that finding type (section 8).

Timing: render the band only after the Haiku call has returned. Never show a skeleton while Claude is still writing. If the call fails or confidence is low, render nothing.

### 4.7 Pane and meta chat

The pane (`$.ui.open({ id: 'coach', title: 'Coach' })`) holds:
1. The station rail.
2. `This conversation is about: …` (from the context card, at most 10 words).
3. `Stuck?`, which opens the meta chat: an `Input` plus `Markdown` thread inside the pane.

Meta chat behaviour:
- It can be opened from the pane, from `/coach ask`, or from the band (long-press or a secondary chip "Ask the coach"). When opened from the band, it starts with that band's finding as context.
- Model: `$.model.fork` when the question needs the whole session; otherwise `$.model.complete` with the context card.
- Socratic by default: it asks one question back before giving advice. It writes a complete prompt only if the user asks for one twice, and then fills it with `$.prompt.fill` as a template with blanks.
- Starter chips:
  - "My result isn't what I wanted"
  - "How do I check this?"
  - "Should Claude do this at all?"
  - "What should I tell the client about AI use?"

### 4.7b Prompt notes (Brief feedback)

- After `prompt.submit`, while Claude works, a greyed note fades in under the user's message (muted text, 11px, right-aligned under the bubble on Desktop):
  - `✓ Goal, audience and deadline are clear` when the prompt shows a behaviour worth reinforcing (goal, audience, done criteria, an example, a correction of Claude, a question to Claude's result).
  - At most one ✓ per note. No note if nothing is grounded.
- **Gaps are not shown as notes.** A grounded Brief gap becomes a dim suggestion inside the empty prompt box via `prompt.suggest` (accepted with Tab, gone as soon as the user types something else). For example: `A customer has churned when ___`. Rules:
  - At most one suggestion, always a template with blanks.
  - Shown only when the prompt box is empty and after Claude's answer completes.
  - Never shown while an Own check is active.
  - The band takes priority for Review, Plan and Own findings. Both can be visible at once, because they are different places.
  - If ignored twice in a session, that gap kind is silenced for the session.
- It is passive. It never asks for anything and has no buttons. The ✓ names the move, never praises the person ("Questioned the result", not "Great job").
- The note is generated by call C (section 7.4) and fades with the same rules as findings (section 8). Once a behaviour has faded, its ✓ is no longer shown either.

### 4.7c Desktop placement

**The dock.** The prompt box belongs to Claude Code, and a mod cannot draw inside it (only `$.prompt.fill` and suggestions). The coach is therefore rendered in the `AbovePrompt` band, styled as a dock fixed to the top edge of the prompt box: same width and outer corners, one shared hairline, so the two read as one unit.

- **At rest:** one line, about 22px. The indicator on the left; the `Coach` menu button on the right.
- **Unfolded:** the coach band (section 4.6) opens above the rail line, folding open in 200 ms, only for a finding, a focus or an Own check. It folds away again on send.
- **Distinct from Claude Code:** the dock background is one surface step darker than the input field. It never uses Claude Code's button styles or clay.
- **Coach off:** the dock shrinks to one line showing only a muted `Coach off`, in the same spot as the menu button. Tapping it turns the coach back on.
- **Optional hotkeys:** 1–4 for station focus, off by default (a digit typed into an empty prompt fires band hotkeys).
- **Pane open:** the rail is mirrored in the pane header. **Narrow terminal:** the dock still renders, because the band falls back above the prompt; the rail can alternatively use `$.ui.status`.
- **Verify in spike 1b:** the band's styling options are enough to match the prompt box's width and corners. If not, keep the dock as a plain band directly above the box.

### 4.8 Animation

| Event | Motion |
|---|---|
| Inner move (Brief and Review) | Bar colour and word cross-fade, 300 ms. Barely noticeable. |
| Outer move (to Plan or Own) | Same cross-fade, plus the divider fade-in. For 4 s the caption shows the reason ("Stepped out · git push") instead of the station caption. |
| Band appears | 150 ms fade and 4px rise. |
| Loop closed (the user refines after a Review) | No text. The two inner bars pulse once. |

Respect the redraw throttle (10/s). Never animate continuously.

> **2.1.289:** there is no transition or animation API, and the terminal draws in character cells. In v1, every change above is instant. The loop-closed pulse is the one exception: render the inner bars `bold` for one redraw and clear it with `$.clock.after(300, …)`. Pixel sizes in this brief (11px, 13.5px, 6px gaps, 22px) translate to `dimColor`, plain or `bold` text and 0–1 cell gaps.

---

## 5. State machine

### 5.1 Automatic position

| From | Event | To | Decided by |
|---|---|---|---|
| any | session start, or first prompt | Plan | rule |
| any inner | `prompt.submit` | Brief | rule |
| any inner | `turn.complete` | Review | rule |
| inner | turn analysis flags `new_task` or `scope_change` with evidence | Plan | Haiku plus evidence check |
| Plan | Claude starts acting (first file-edit tool call), or the user approves a plan | Brief / Review per the next event | rule |
| inner | `tool.call` matches `git commit`, `git push`, deploy or publish commands | Own | rule |
| inner | turn analysis flags `share_intent` (named outside recipient, "send", "client", "publish") | Own | Haiku plus evidence check |
| Own | Own checks completed, or the user continues without the push | inner | rule |

Hysteresis: an outer move needs either a rule event or a Haiku flag with verbatim evidence. When Haiku flags without evidence, or with low confidence, don't move. Show a suggestion line in the band instead.

### 5.2 Own checks on push

- Hold the `git push` / deploy tool call and show the Own checks:
  - "Tested it myself"
  - "No client or personal data in it"
  - "AI assistance noted where it matters"
- Hold it only if the user has enabled "Pause pushes" (off by default; asked once on the first push). Otherwise show the Own band (checks as hairline checkboxes) without holding the push.
- Never hold longer than the user's choice: `Continue anyway` is always present.
- **2.1.289:** a hook's own time is capped at 10 s, but the clock stops during any `$` call. A push therefore can't wait on a band button (that wait is the hook's own time), but it can wait on `await $.ui.ask(question, { options, multiSelect: true })`, the engine's own question dialog. When "Pause pushes" is on, the push is denied with "Push paused at the Own check. Wait for the person to finish the checks; don't retry." and the Own band holds it. Finishing the checks, or `Continue anyway`, sets a one-time pass and submits "Checks done. Go ahead with the push." (see `visual-spec.md`).

### 5.3 Focus (manual station)

- Tapping a station sets `focus = station`. The rail shows it outlined, and the band renders that station's content immediately. Generate it on demand; show a quiet "…" for at most 1.5 s, then render, or show nothing if the call fails.
- Focus clears on the next `prompt.submit`. Automatic detection resumes after that.
- What each focus does:
  - **Plan:** chips for goal, what must not change, and whether Claude should do this at all, plus `$.prompt.fill` with "Before changing anything, outline your approach and what you need from me." Switch Claude to plan mode only if verified (section 11).
  - **Brief:** chips for the gaps found in the last prompt, as blanks.
  - **Review:** chips for the two or three claims worth checking in the last answer.
  - **Own:** run the Own checks now.
- **Hidden instruction (v1.1, optional, behind a setting):** while Review is focused, add one line of context on the next `prompt.submit` asking Claude to state its uncertainties. While Plan is focused, ask Claude to propose before acting. Show `Review focus: Claude will flag uncertainty` in the band, so it is never invisible.

---

## 6. Context card

A small object, updated after every turn, held in `$.state` only (session memory). **Never written to `$.store`, never logged, never sent anywhere except the Haiku calls.** It is cleared when the session ends.

```json
{
  "task": "churn analysis, Q3 export",
  "recipient": "Mette, steering group Thursday",
  "definitions": { "churn": "contract end (corrected by user)" },
  "claude_assumptions": ["312 trial accounts excluded"],
  "unchecked_claims": ["18.4%", "SMB is the driver"],
  "about": "Q3 churn analysis for Thursday's steering group",
  "language": "en"
}
```

Each field is capped at 120 characters, and each list at 5 items (oldest dropped). This is what makes the chips specific across turns ("18.4% goes to Mette on Thursday").

---

## 7. Haiku calls

Model: `haiku` via `$.model.complete({ model: 'haiku', system, prompt, maxTokens, effort: 'low', timeoutMs: 8000 })`. (2.1.289 has no `cache` flag; `system` is a plain string, so keep it byte-identical between calls.) Check `r.isAnswered` and do nothing on failure. Fire the call from `turn.complete` without awaiting it (`void`), and write results into `$.state` so the band redraws itself.

Input window, every call:
- the context card,
- the last user message (cap 1,500 characters),
- the last assistant answer (cap 1,500 characters),
- a list of the tool calls in the turn (names plus short arguments),
- the current station and focus.

### 7.1 Call A: turn analysis (once per turn)

System prompt (write it in your own words; this is the spec):

> You analyse one turn of a work session between a person and Claude. Return JSON only. Update the context card with facts stated in this turn. Flag outer-loop triggers only with a verbatim quote from the turn as evidence. Never infer facts that are not in the text. Use the language of the person's messages.

Output:

```json
{
  "card": { "...updated context card..." },
  "flags": [
    { "type": "new_task | scope_change | share_intent", "evidence": "verbatim quote" }
  ],
  "finding": {
    "station": "brief | review | plan | own",
    "kind": "missing_audience | missing_done | unchecked_claim | silent_assumption | ...",
    "evidence": ["verbatim quote", "..."],
    "confidence": "high | low"
  } ,
  "suggest_station": null
}
```

`maxTokens`: 500.

### 7.2 Call B: band content (when a finding is high-confidence, or on focus)

System prompt (spec):

> Write the coach band for one station. Be specific: every chip must name at least one concrete thing from the card or the turn (a file, a number, a person, a deadline, a definition). Speak about the work, never the person. Brief chips are templates with ___ blanks. Review chips are short questions the person can send to Claude. Return JSON only.

Output:

```json
{
  "station": "review",
  "title": "max 90 characters",
  "chips": [
    { "label": "max 5 words", "fill": "text for the prompt", "evidence": "verbatim quote" }
  ],
  "suggestion": { "station": "plan", "reason": "max 60 characters" }
}
```

`maxTokens`: 300.

### 7.4 Call C: prompt note (on `prompt.submit`, fire and forget)

Input: the new prompt plus the context card. Output: `{ "good": { "text": "max 50 characters", "evidence": "verbatim" } | null, "suggestion": { "template": "max 80 characters, with ___ blanks", "evidence": "verbatim from card or prompt" } | null }`. The suggestion is held until `turn.complete`, then shown via `prompt.suggest` if the box is empty. `maxTokens`: 120. Render only items with verified evidence. It is included in the cadence setting (section 9), so `on focus only` disables it.

### 7.3 Validation (in code, before rendering)

- Drop any chip whose `evidence` is not a verbatim substring of the input window.
- Drop chips whose label matches the generic blocklist ("Who is the audience?", "Add more context", "Be more specific", "Check the output", and similar). Keep the list in config.
- Brief chips without `___` get it appended (`: ___`).
- If fewer than two chips survive, render nothing (or static fallback chips when the user chose a focus).
- Truncate to the length limits and never wrap more than two lines per chip.

---

## 8. Ease-in and fade

| Phase | Behaviour |
|---|---|
| Session 1 | Silent. Indicator and message labels only. One toast: "The coach follows your loop with Claude. Tap a station to focus it. /coach to turn it off." No findings in the band. |
| Sessions 2–3 | Findings allowed, at most one band per 5 turns. Review findings are prioritised on artifact turns. |
| Session 4 onwards | Fade per behaviour (below). Own checks never fade. |

Fade: keep a per-user counter in `$.store` for each finding kind, recording **how often the user shows the behaviour unprompted** (for example, they question a claim without a band). After 3 unprompted shows in the last 5 relevant turns, stop raising that finding kind automatically. Focus still works.

Dismissals: two dismissals of the same finding kind in a session silences it for that session; five in total silences it until the user re-enables it in `/coach settings`.

Store only counters and settings in `$.store`, never message text.

---

## 9. Cost

- **Conversation:** read `(await $.session.usage()).cost?.usd`, the same figure `/cost` shows (2.1.289). Fall back to summing `e.usage` from every `turn.complete` against the price table only if `cost` is absent.
- **Coach:** add up `r.usage` (a `ModelUsage`, returned on every arm in 2.1.289) from each Haiku call, priced from the table.
- **USD:** a price table in config (input, output, cache read and cache write per model). **Look up current prices at build time; don't hard-code them from memory.**
- Display (rail row, flipped): `Coach $0.03 · 2% of $1.48 this session`, with a thin proportional bar.
- For subscription users (plan, not API key), label it `≈ API cost`.
- Config: the Haiku call cadence can be `every turn` (default), `every 3rd turn` or `on focus only`.

---

## 10. Privacy and security

- Mods are not sandboxed and see every prompt. Distribute through Implement's managed plugin marketplace after code review by IT security.
- Haiku calls use the session's own credentials and provider. No other endpoint, no telemetry, no network calls besides `$.model.*`.
- The context card is session memory only. `$.store` holds counters, settings and the on/off state, nothing else.
- Opening `/coach about` shows exactly what the coach reads and stores, in four lines.
- Public-sector and client work: the DPO signs off before rollout beyond Implement internal use.

---

## 11. Verify first (spikes before dependent work)

| # | Question | If no | Answer from the 2.1.289 types |
|---|---|---|---|
| 1 | Can a mod wrap `UserMessage` / `AssistantMessage` rendering to add a label above or below a message (glyph, station name, ✓ note), and re-render a past message when an async result arrives (the prompt note)? | Labels become a dim `$.ui.log` line per turn. The prompt note moves into the `AbovePrompt` band and is shown until Claude's answer completes. | **Yes.** Both are `ui.render` sites on every surface; `<Box>{await next(e)}<Text/></Box>` is the documented pattern. A render that reads a `$.state` atom is redrawn when the atom is written, so the ✓ note appears late without a new turn. Key notes by the prompt text, since `prompt.submit` and the row don't share an id. |
| 1b | Can the band be styled as a dock attached to the prompt box? | Plain band directly above the box. | **Partly.** `Box` takes `backgroundColor` and a border, but not the prompt box's width or corners, and the engine draws its own `[-]` beside the band. Use the plain band with a top hairline. |
| 2 | Does the `$.model.complete` result include token usage? | Estimate from characters (section 9). | **Yes.** `usage` (`ModelUsage`) is on every arm. `$.session.usage().cost.usd` also gives the conversation's own cost. |
| 3 | Can a mod switch the permission mode (plan mode)? | Plan focus pre-fills a plan request instead. | **No.** No `$` method sets the mode. Use the fallback. |
| 4 | Can a `tool.call` hook hold a `git push` until the user clicks? (Blast Radius pattern) | Show the Own band without holding. | **Yes, with the engine's dialog only.** The 10 s hook budget rules out waiting on a band button, but `$.ui.ask` stops the clock (section 5.2). |

`$.model.classify(text, labels)` is documented in 2.1.289. It returns one label, so it doesn't fit call A, which has to return a card and evidence. Keep `$.model.complete` for A, B and C.

---

## 12. File structure and hooks

```
coach/
  .claude-plugin/plugin.json  # includes "types": "./types/index.d.ts"
  hooks/hooks.json            # "modules": ["./register.tsx"]
  hooks/
    register.tsx              # export const register: Register
    state.ts                  # station machine, focus, hysteresis (pure)
    card.ts                   # context card update and caps (pure)
    haiku.ts                  # calls A, B, C and validation
    ui/rail.tsx ui/band.tsx ui/pane.tsx ui/labels.tsx
    cost.ts  fade.ts  config.ts  atoms.ts
    prompts.ts                # system prompts as string constants
  types/index.d.ts            # PluginState contract for every $.state value
  test/*.test.ts              # claude plugin test
  README.md                   # includes attribution and the privacy summary
```

**2.1.289:** a mod can only import code files (`.ts`, `.tsx`, ...), and the hooks module runs with no Node. Prompts, the blocklist and the price table therefore live in `.ts` modules (`prompts.ts`, `config.ts`), not `.md` or `.json`. The mod is written in the session's dev-mods folder and hot-reloads; the `briefs/` folder in this repo stays the source of the design.

Hook map:

| Hook | Does |
|---|---|
| `prompt.submit` | Set Brief, clear focus, fire call C (prompt note), inject the hidden focus line (v1.1 setting) |
| `turn.complete` | Set Review, add usage to cost, fire call A, then call B if high-confidence |
| `tool.call` (matcher: git push/commit, deploy) | Move to Own; hold if "Pause pushes" is on |
| `ui.render` `Pane` | Rail, about-line, meta chat |
| `ui.render` `AbovePrompt` | Coach band, plus the rail when the pane is closed |
| `ui.render` `UserMessage` / `AssistantMessage` | Message labels and ✓ notes (if spike 1 passes) |
| `ui.close` | Remember if the user (`person`) closed the pane; don't reopen it automatically |
| `/coach` command | Toggle, `pane`, `ask`, `settings`, `about` |

---

## 13. Test plan

1. **Unit:** state machine transitions (every row in 5.1), focus clearing, hysteresis, card caps, chip validation (evidence substring, blocklist, blanks), fade counters, cost sums.
2. **Fixtures:** 10 recorded sessions (consented, anonymised). These include the churn example from the design work, a client email, a refactor, a pure Q&A session, and one that steps out to Own twice. Snapshot the expected station sequence for each.
3. **Haiku evaluation:** 60 labelled turns. Report precision per finding kind. A finding kind ships only at **≥ 80% precision**; below that it is focus-only. Recall doesn't matter.
4. **Manual UX checklist:**
   - Turning the coach off leaves the chat untouched.
   - The band never appears mid-turn.
   - At most one suggestion is visible.
   - Session 1 is silent.
   - Dark mode works.
   - A narrow terminal shows the rail in the band.
5. **Cost:** compare the coach total against the API console for one session. It should be within 10%.
6. **Reviewer panel re-run:** run `panel-fluency-coach.md` on the built v1 before internal rollout.

---

## 14. Build order

1. **Spikes** from section 11. Report the results.
2. **Skeleton:** the Coach menu, `/coach`, the pane with the rail, and automatic Brief and Review from events. No model calls.
3. **Transcript:** message labels (or the fallback) and outer-loop dividers driven by tool events.
4. **Haiku:** call A plus the context card, then call B plus validation, then the band.
5. **Focus:** tapping stations, Plan pre-fill, Review claims, Own checks.
6. **Ease-in, fade and dismissals.**
7. **Cost reveal.**
8. **Meta chat.**
9. **Test plan, then the panel re-run, then the internal pilot** with 5–10 newcomers for two weeks. Measure the share of artifact turns followed by a Review action, before and after.

---

## 15. Design decisions already made (do not reopen without the owner)

- The loop is shown over time in the transcript (message labels and dividers), not as a diagram.
- The station indicator is one word plus four bars, with a picker on tap. No arrows, pipes or tinted pills.
- Colour appears only as small marks. All coach components are neutral. Palette: violet, aqua, amber, magenta (no blue, no green).
- On/off and cost live together in the Coach menu, in one place on the dock.
- The band above the prompt is the only surface that asks. There's no suggestion card under answers.
- Tapping a station is a focus, not a change of position. It lasts until the next prompt.
- The cost reveal sits behind the word "Coach", with no icon.
- Silence is the default. Precision matters more than recall.

---

## 16. What the 2.1.289 API changed (summary)

| Brief said | Built as | Why |
|---|---|---|
| CSS tint tokens (`--text-tint-violet`, ...) | ANSI names: `magenta`, `cyan`, `yellow`, `redBright` | Mods take theme keys or raw colours; no CSS tokens (3) |
| Dock glued to the prompt box | Plain `AbovePrompt` band with a hairline | Band can't take the box's width or corners; engine adds `[-]` (11, 1b) |
| Cross-fades, fade-ins, 150 ms rise | Instant changes; one `bold` pulse cleared by `$.clock.after` | No animation API; cell-based drawing (4.8) |
| Coloured, faded transcript dividers | Dim `$.ui.log` line | Only way a mod adds a transcript row (4.5) |
| Push held by band checkboxes | Push denied once, Own band holds it, finishing sets a one-time pass and `$.prompt.submit` asks Claude to go ahead (visual-spec.md) | 10 s hook budget rules out waiting on a band button; `$.ui.ask` only asks the one-time "pause pushes?" |
| Tinted/bold UI, `▴` picker, hint line | No bold; one `Coach` button opens picker row + menu row; hairline only above the rail (1 px `Svg` on desktop) | Visual refs D1–D8 |
| Plan focus may switch to plan mode | Pre-fill only | No `$` method sets the mode (11, 3) |
| Conversation cost from summed `e.usage` | `$.session.usage().cost.usd` | Same figure `/cost` shows (9) |
| `cache: true` on the system prompt | Byte-identical `system` string | No cache flag on `$.model.complete` (7) |
| `prompts/*.md`, `config/*.json` | `prompts.ts`, `config.ts` | Mods import code files only (12) |
| Labels on every message block | `UserMessage` from the person, `AssistantMessage` with `isFirstOfReply` | Hook fires per text block and for notifications too (4.4) |
