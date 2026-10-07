# Spikes: what the types, validate and tests confirmed

Checked against Claude Code 2.1.289 (`claude plugin validate`, `tsc -p`, `claude plugin test`: 129 tests). "Live" means it needs a real session.

## Brief section 11

| # | Question | Confirmed offline | Still needs a live session |
|---|---|---|---|
| 1 | Wrap `UserMessage` / `AssistantMessage` with a label and a late note | Both are `ui.render` sites; the wrapped tree validates on terminal and desktop (mount tests). The note is an atom read in the render, so it redraws when `call C` writes it; the test sets it before mounting, not after. Only the person's prompts (`origin.kind` composer) and `isFirstOfReply` blocks are labelled; `isExpanded` passes through. | That a late write redraws an already-drawn row; the hover reveal (`display: none` with `hover.display: flex` inside a keyed `Box`, scope = the row key); that the assistant block text matches the head of `turn.complete.answer` for the fresh-row test (a reply that opens with a short preamble before tool calls will fall back to hover). |
| 1b | Dock styled like the prompt box | Not possible: only `AbovePrompt` exists, with no width or corner control. Built as a plain band with a hairline and the rail on its bottom line. | How the engine's `[-]` and the hairline sit together; narrow terminals. |
| 2 | Token usage on `$.model.complete` | `usage` is on every arm of `ModelCompleteResult`; summed in `cost.ts` (tested). `$.session.usage().cost.usd` is used for the conversation. | Coach total against the API console (within 10%). Which model the `haiku` alias resolves to: the price page lists Haiku 4.5 ($1/$5) and Haiku 5.5 ($0.10/$0.50); the table uses 4.5 (upper bound). |
| 3 | Switch to plan mode | No `$` method sets the permission mode. Plan focus pre-fills "Before changing anything, outline your approach and what you need from me." | n/a |
| 4 | Hold a push | Denied with `OWN_DENY_TEXT` while the Own band holds it; finishing the checks or `Continue anyway` sets a one-time pass and calls `$.prompt.submit`. Logic tested with a fake context: the pass is single-use, dismissing gives none, commits and headless sessions are never held. | That Claude waits instead of retrying, that `$.prompt.submit` from the band starts a turn, and that the next push is allowed once. |

## Other things the API settled

- **`$` cannot cross a file boundary** (validate refuses it). `register.tsx` is the only file that touches `$` and builds a `Ctx` of closures; `claude-code`'s `atom`, `read` and `update` also need literal state references in that file, so the whole session state is one `coach.state` atom and `Ctx.get` / `Ctx.patch` read and write it. This replaced the plan's per-key atoms and the planned `atoms.ts`.
- **No colour on `Button`**: the station word is a coloured `Text`; the picker (D3) opens with `Coach` as one fold above the menu row (D5), so the rail has one control. A press on the word itself was not possible.
- **Visual refs** (`briefs/visual-spec.md`) win over the earlier pass: no bold anywhere, desktop word and bars use the light-mode hex values, the desktop rule is a 1 px `Svg`, the terminal rule is exactly `bodyColumns` of `─`.
- **Own hold** is now deny + band + `$.prompt.submit` with a one-time `pushPass` (the 10 s hook budget rules out waiting on a band button); `$.ui.ask` remains only for the first-push "pause pushes?" question.
- **Colour keys**: `purple/cyan/yellow/pink_FOR_SUBAGENTS_ONLY` are used for the station word and active terminal bar (`STATION_COLOR`); the d.ts does not list valid keys and mount tests cannot show an unknown key being refused, so check the colours in a live session and swap `STATION_COLOR_FALLBACK` in if they draw wrong. The desktop glyph is an `Svg` with raw hex (`STATION_HEX`).
- **No tooltip API**: the plain-language meanings are shown as a muted caption in the rail and in the picker; the framework names appear only as small secondary labels in the pane legend.
- **`Input` is absent only on mobile** (the brief said vscode and mobile). The pane skips the chat there. The band is raised on terminal and desktop only.
- **`ui.ask` options are 2 to 4 labels.**
- **`prompt.suggest` cannot show while a turn runs or the box has text.** The suggestion is queued and shown from a timer after `turn.complete` (and when call C answers late), only when `$.prompt.read()` is empty.
- **Model calls run from `$.clock.after(0, ...)`** rather than the dispatch, so an abandoned dispatch cannot abort them. Live: confirm calls complete when the next prompt is typed quickly.
- **Meta chat uses `$.model.complete` with the card and the last few messages from `$.session.messages()`**, not `$.model.fork`: a fork runs on the main model, which the Haiku price table would misprice.

- **Prompt origin**: the desktop Code tab is an SDK host, so prompts arrive as `sdk` (not only `composer`). Gates now exclude only task notifications, peers, channels, scheduled and engine origins.
- **Mobile's element table holds stand-ins for `Select` and `Input`** (they draw empty), so the pane decides by surface, not by presence.

## Live checklist (nothing here is checkable offline)

1. Mod loads; `/coach` registered (a mid-session load never gets `session.start`, so registration and the session counter also run lazily from the first hook or render).
2. Rail and labels draw and colours read in light and dark terminals; glyph widths; ▴ picker and `Coach` menu clicks.
3. Band never appears mid-turn; Coach off leaves only `Coach off`.
4. A push with Pause pushes on; Esc denial message.
5. Divider line appears once per turn; `Stepped out · ...` caption clears after 4 s.
6. Prompt note appears under the prompt; `prompt.suggest` ghost text appears and Tab takes it.
7. Closed-loop pulse (a bold flash on the inner bars).
8. Cost line against the console; `≈ API cost` for subscription logins.
9. Precision of findings on real turns (plan M8) and the reviewer-panel re-run: out of scope for this build.
