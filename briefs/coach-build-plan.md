# Coach: build plan

Companion to `coach-mod-brief.md`. The brief says *what* to build; this plan says *in what order*, with what proof at each step.

Each milestone ends with a demo you can run, and a stop. Don't start the next milestone until the owner says go.

---

## Kickoff prompt for Claude Code

Paste this into a fresh Claude Code session in an empty folder, with both files present:

```
Read coach-mod-brief.md and coach-build-plan.md fully before writing code.
We build the Coach mod milestone by milestone, starting with M0.
Rules:
- Build against the mods API types you generate in .claude-plugin/types/.
  Where they disagree with the brief, the types win; tell me what differed.
- Never block, rewrite or drop my prompt.
- At the end of each milestone: run the tests, show me the demo steps,
  list what you could not verify, and stop.
Start with M0: generate the types, then run the five spikes and report.
```

---

## M0: Spikes (half a day)

Goal: know what the API really allows before designing around it.

| Spike | What to try | Pass when |
|---|---|---|
| 1a | Wrap `UserMessage` / `AssistantMessage` render output to add a meta-line label (mini glyph plus station name) | The label shows under prompts and above replies, in Desktop and in the terminal |
| 1b | Style the `AbovePrompt` band as a dock (width, corners, background) | It reads as attached to the prompt box |
| 1c | Re-render a past `UserMessage` when an async value arrives (the prompt note) | The note appears under the message without a new turn |
| 2 | `$.model.complete({ model: 'haiku', ... })` result fields | Token usage is present, or confirmed absent |
| 3 | Switch permission mode to plan mode from a mod | It's possible, or confirmed not possible |
| 4 | Hold a `git push` tool call until a band button is clicked | The push waits, then continues or cancels on click |

**Output:** `SPIKES.md` with pass or fail per spike, the API used, and the fallback chosen (from brief section 11).

**Demo:** a throwaway mod showing each passing spike.

---

## M1: Skeleton and loop (1 day)

- Plugin scaffold (brief section 12): `plugin.json`, `hooks.json`, `register.ts`, config loader.
- `/coach` command with `immediate: true`, plus `pane`, `settings` and `about` subcommands (stubs for now).
- The dock at rest: the one-word indicator with four bars, the picker on tap, the Coach menu (cost placeholder, Turn off coach, Settings) and the `Coach off` state in the same spot. The on/off state is persisted in `$.store`.
- Station machine (brief section 5.1), rule events only: Plan at session start, Brief on `prompt.submit`, Review on `turn.complete`, Own on `tool.call` for git push and commit.
- Focus on tap (brief section 5.3): outline on the rail, cleared on the next send. No band content yet.
- Rail animations (brief section 4.8).

**Tests:** unit tests for every rule transition and for focus clearing.

**Demo:** a real session in which the indicator follows Brief and Review, steps out to Own on `git push`, and Turn off coach collapses the dock to `Coach off`, which turns it back on.

---

## M2: Transcript (1 day)

- Message labels with the fade rule (section 4.4), or the spike-1a fallback.
- Outer-loop dividers with fade-in.
- The inner-bar pulse when a loop closes (a Brief following a Review in which the user questioned or corrected Claude). Use a simple keyword rule for now; replace it with call A in M3.

**Demo:** scroll a 10-turn session. The rhythm is visible, and the dividers sit where the steps out happened.

---

## M3: Haiku, context card and band (2 days)

- `haiku.ts`: a call wrapper with a cached system prompt, a timeout, `isAnswered` handling, and a usage accumulator.
- Call A (turn analysis) plus the context card in `$.state` (brief sections 6 and 7.1).
- Call B (band content) plus validation (brief section 7.3): verbatim evidence check, blocklist, blanks, length caps.
- Band rendering in the dock: unfold and fold, chips into `$.prompt.fill`, source line, dismiss.
- Outer-loop moves from Haiku flags, with hysteresis (brief section 5.1).
- Focus now renders real band content, generated on demand.

**Tests:** fixture-based tests with a stubbed `$.model` (record and replay JSON), plus validation unit tests.

**Demo:** the churn session from the design work produces bands that quote the session ("18.4% is heading to Thursday's steering group").

---

## M4: Prompt notes (half a day)

- Call C on `prompt.submit` (brief section 7.4).
- The greyed ✓ note under the user's message, or the band fallback (spike 1c).
- The Brief gap as a dim suggestion in the empty prompt box via `prompt.suggest`, accepted with Tab.

**Demo:** a good prompt gets a greyed ✓ naming the move. After a weak one, the empty prompt box shows a dim template with blanks that fills the gap.

---

## M5: Own checks (half a day)

- The "Pause pushes" setting, asked on the first push.
- Hold and continue (spike 4), three checks, and "Continue anyway".

**Demo:** with the setting on, a push waits for the checks. With it off, the band shows without holding anything.

---

## M6: Ease-in, fade and dismissals (1 day)

- Session counter, silent session 1, the onboarding toast and the first-run rail hint.
- Per-finding-kind counters in `$.store` (counts only), the 3-in-5 fade rule, and dismissal silencing (brief section 8).
- `/coach settings`: cadence, Pause pushes, re-enable silenced findings, hotkeys (off by default), and estimated cost per turn.

**Tests:** fade and dismissal logic against simulated sessions.

**Demo:** reset the store, run sessions 1–4, and show the behaviour changing as the brief describes.

---

## M7: Cost and meta chat (1 day)

- Cost tracking from `e.usage` and the coach calls, a price table in `config/prices.json` (**look up current prices at build time**), and an "≈ API cost" label for plan users.
- Tapping `Coach` flips the rail to the cost line.
- Meta chat in the pane (brief section 4.7): Socratic by default, starter chips, opened from the pane, `/coach ask` or the band.

**Demo:** the cost line is within 10% of the console for one session, and the meta chat asks a question back before advising.

---

## M8: Evaluation and hardening (1–2 days)

- 10 consented, anonymised fixture sessions with snapshot station sequences.
- 60 labelled turns for precision per finding kind. Any kind below 80% precision is set to focus-only in config.
- Manual UX checklist (brief section 13.4) in Desktop and in a narrow terminal, in light and dark mode.
- `/coach about` text and the README, including attribution, the privacy summary and settings.
- Run `panel-fluency-coach.md` on the built mod and fix the consensus flags.

**Demo:** the evaluation report plus a 5-minute walkthrough recording.

---

## M9: Pilot (2 weeks, outside Claude Code)

- Code review by IT security, then publish to the internal managed marketplace.
- Get Implement legal's confirmation on the CC BY-NC-SA use before any client-facing use.
- Run the pilot with 5–10 newcomers. Measure locally, with consent: the share of artifact turns followed by a Review action, Coach-off rate, and dismissals per session.
- Run a retro, then write the v1.1 backlog (hidden focus instruction, `$.model.classify` if documented, team insights only with opt-in).

---

## Estimated effort

About 8–9 build days for M0–M8 with Claude Code doing the implementation and Sebastian reviewing at each stop, plus the 2-week pilot.
