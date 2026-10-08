# Coach

<a href="../dist/coach-0.2.0.zip"><img src="https://img.shields.io/badge/Download-Coach%200.2.0-2A9D8F?style=for-the-badge" alt="Download Coach 0.2.0"></a>

A quiet thinking partner for working with Claude Code. It shows which step of the working loop you are in and helps you take the next one well, without explaining a framework.

## Install

**From the zip** ([`dist/coach-0.2.0.zip`](../dist/coach-0.2.0.zip)): unzip it into a folder, then start Claude Code with that folder as a plugin:

```bash
claude --plugin-dir /path/to/unzipped/coach
```

**From this repository**: add the repository as a local marketplace once, then install.

```bash
claude plugin marketplace add /path/to/ai-coach
```

```bash
claude plugin install coach@ai-coach
```

Start a new chat afterwards and run `/coach help` to see every command.

## The loop

Four steps. **Plan**: decide what Claude should do. **Brief**: your next prompt. **Review**: check what Claude gave you. **Own**: stand behind what you ship. Brief and Review are the everyday loop; Plan and Own are the steps outside it.

The coach decides the step from what your message does:

| Your message | Step |
|---|---|
| "Help me with a new pitch", "I need help with…", "Jeg har brug for hjælp til…" | Plan · starting new work |
| "Make a plan…", "How would you approach…", "Should we…" | Plan · asked for a plan |
| A new or next instruction | Brief · a new instruction |
| "Why did you…", "Are you sure…", "That's wrong", "…instead" | Review · checking Claude's result |
| "Looks good", "Perfect", "Final version", "Ready to send", "Det ser godt ud" | Own · taking it as final |
| Push, publish, deploy, "send it to…" | Own · about to ship |

After every reply from Claude the step line says Review: it is your turn to check.

## What you see

- **Chapter line** above each of your messages: the step in its colour, a short caption and a thin line. When you leave Review for a new instruction it says `moved on from Review`.
- **Feedback** under your message: `✓` for a move worth repeating (for example `Audience is named`, `Questioned the result`), `◐ Could add: question, audience` when a short request leaves out the basics.
- **Template** in the empty prompt box after the reply, with named slots such as `[audience]` and `[deadline]`. Tab takes it.
- **Suggestions** above the prompt: one row of buttons that put a question or prompt into the box, and `✕`. A dismissed set comes back from **Coach → Show suggestions** until your next prompt.
- **Own checks** when you take a result as final or push: `Tested myself`, `No client data` and a third drawn from the conversation, plus `Continue anyway`. With *Pause pushes* on, a push waits until the checks are done.
- **Step line** under the suggestions: the four bars, the current step and its meaning, and `Coach`. `Coach` opens one row: `Focus on` Plan, Brief, Review or Own, the coach's cost, and `Turn off`.
- **Pane** (`/coach`): the four steps, what the conversation is about, a `Stuck?` chat, settings and attribution.

## Commands

| Command | Does |
|---|---|
| `/coach help` | List every command |
| `/coach` | Open the pane |
| `/coach on` · `/coach off` | Turn the coach on or off, for every chat |
| `/coach preview on` · `off` | Show every finding from the first session (for testing and demos); plain `/coach preview` toggles |
| `/coach model haiku` · `haiku-5.5` · `sonnet` · `opus` | Pick the model that writes the feedback |
| `/coach model` | Show which model runs now |
| `/coach why` | The last analysis: which calls ran, what came back and why anything was dropped |
| `/coach settings` | Open the pane at the settings |
| `/coach ask` | Open the `Stuck?` chat |
| `/coach about` | What the coach reads and stores |
| `/coach gallery` | A drawing test for the surface you are on |

## Feedback model and cost

The feedback runs on **Haiku 5.5** by default. Switch with `/coach model haiku`, `sonnet` or `opus`, or in the pane under *Feedback model*. Haiku 5.5 is the fastest and cheapest; larger models are slower and cost more:

| Model | Input | Output | Cache write | Cache read |
|---|---|---|---|---|
| Haiku 4.5 | $1 | $5 | $1.25 | $0.10 |
| Haiku 5.5 | $0.10 | $0.50 | $0.125 | $0.01 |
| Sonnet 5.5 | $2 | $10 | $2.50 | $0.10 |
| Opus 5.5 | $4 | $20 | $5 | $0.20 |

Prices per million tokens (Haiku 5.5 for prompts up to 100,000 tokens, which covers every coach call), from the [Anthropic pricing page](https://platform.claude.com/docs/en/about-claude/pricing) on 2026-10-08; they live in `hooks/config.ts`.

The Coach menu shows the coach's own cost as its share of the session, for example `Coach 2% of this session`; the pane adds the model, `Coach 2% of this session · Haiku 5.5`.

## Settings

In the pane (`/coach`):

- **Feedback model**: Haiku 5.5 (default), Haiku 4.5, Sonnet 5.5 or Opus 5.5.
- **Coach checks**: every turn (default), every 3rd turn, or on focus only.
- **Pause pushes for a check**: off by default; asked once on the first push.
- **Start quietly**: on by default. The first session then shows only the chapter lines and the step line; sessions two and three allow one set of suggestions per five turns; from session four, behaviours you already show stop being coached. Off is the same as `/coach preview on`.
- **Labels in the chat**: on or off.

Settings are shared by every chat and read again with each message.

## Privacy

- **Reads** your prompts, Claude's answers and tool names in the session, only to follow the loop.
- **Sends** short excerpts to the chosen feedback model through the session's own Claude connection, and to nothing else.
- **Keeps in memory** a small context card for the session only.
- **Stores on disk** counters and settings only, never message text.

Mods are not sandboxed and see every prompt. Distribute through your organisation's managed plugin marketplace after a security review; client and public-sector work needs sign-off from your data protection officer.

## For developers

`hooks/register.tsx` wires every hook. Decisions are pure and unit-tested: `moves.ts` (which step a message is), `gaps.ts` (what a short request leaves out), `state.ts`, `card.ts`, `validate.ts`, `fade.ts`, `cost.ts`. `haiku.ts` makes the model calls and never throws. UI lives in `hooks/ui/`.

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

After a change, raise the version in `.claude-plugin/plugin.json`, run `claude plugin update coach@ai-coach`, and rebuild the zip from the `coach/` folder:

```bash
git ls-files -co --exclude-standard | zip -q ../dist/coach-<version>.zip -@
```

What the desktop app draws and refuses, and how the engine behaves, is in [NOTES.md](NOTES.md).

## Attribution

Based on the AI Fluency Framework by Dakan, Feller and Anthropic, CC BY-NC-SA 4.0.
