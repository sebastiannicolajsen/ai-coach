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

- **Chapter line** above each of your messages: the step in its colour, what the message does in a few specific words (for example `asks for three angles for the Nordlys pitch`) and a thin line. When you leave Review for a new instruction it starts with `moved on from Review`. While the step is decided, the line shows Claude's working mark and `Reading the step…`.
- **Feedback** under your message: `✓` for a move worth repeating (for example `Audience is named`, `Questioned the result`), `◐ Could say who it is for and what it should achieve` when a short request leaves out what its kind of request needs (an analysis: the question and which data; a piece of writing: who it is for and what it should achieve). A gap already named earlier in the chat is not named again. While the feedback is written, the row shows Claude's working mark and `Reading your prompt…`.
- **Template** in the empty prompt box after the reply, with named slots such as `[audience]` and `[deadline]`. Tab takes it.
- **Suggestions** above the prompt: the coach's clay `✦`, then a row of quiet buttons that put a question or prompt into the box. They are written for this conversation: the coach reads the last answer in full (its start and its end) and the exchanges before it, and each button names something concrete from them, such as an option Claude offered, a number to check or the next part to do. While they are written the row shows `Writing suggestions…`. They stay until your next prompt.
- **Model controls** beside `⋯`, in the style of the model and effort at the foot of the prompt box. The model slot shows the model in use and its effort as a small vertical bar that fills from low to max; a press opens `Run Claude on` (Haiku 5.5, Sonnet 5.5, Opus 5.5, Fable 5.1) and `Effort` (low to max), the recommended ones marked `✦`. When the coach recommends another model or effort, the slot shows it instead, for example `Opus 5.5 · planning` with a clay bar, and a press switches to it. While the coach is still judging, the slot shows Claude's working mark. Then the mode, `Prompt me` (default), `Auto-select` or `Only show`, which a press cycles. See [Model recommendations](#model-recommendations).
- **Own checks** when you take a result as final or push: `Tested myself`, `No client data` and a third drawn from the conversation, plus `Continue anyway`. With *Pause pushes* on, a push waits until the checks are done.
- **Step line** under the suggestions: the four bars, the current step and, after a reply, what to do now in a few specific words (for example `check the 12% Nordlys figure`), and `⋯`. `⋯` opens one row: `Focus on` Plan, Brief, Review or Own, the coach's cost, `Settings` (the pane) and `Turn off`.
- **Pane** (`/coach`): the four steps, what the conversation is about, a `Stuck?` chat, settings and attribution.

## Model recommendations

The coach recommends the model a prompt suits, and how hard it should think (effort: low, medium, high, xhigh or max):

| Model | Suits |
|---|---|
| Haiku 5.5 | Quick, small or mechanical work: a lookup, a rename, a short reply |
| Sonnet 5.5 | Everyday work with a clear instruction: a draft, routine code, carrying out an agreed plan |
| Opus 5.5 | Work that needs judgment: planning, open questions, reviewing important work, tricky debugging |
| Fable 5.1 | The hardest work: long multi-step tasks, large changes, strategy with many moving parts |

- **After each reply** the analysis names the model the likely next prompt suits, and it shows beside `⋯`, marked `✦`.
- **When you send a prompt**, Haiku 5.5 judges the prompt itself (about a second), and the mode decides what happens when another model suits it:
  - **Prompt me** (default): the prompt is held before anything runs, and Claude's own dialog asks: *This looks like planning. Send it with Opus 5.5 at high effort instead of Sonnet 5.5?* with `Send with Opus 5.5 · high (Recommended)` first, then `Keep Sonnet 5.5`, `Always switch for me` (turns on Auto-select) and `Stop asking` (turns on Only show). After `Keep`, the same suggestion is not asked about again for three prompts.
  - **Auto-select**: the prompt goes to the suggested model, for that prompt only.
  - **Only show**: nothing is held or switched; the recommendation stays beside `⋯`.
- **While you type** (terminal only): when you pause, the draft is judged too. The desktop app does not share the draft with mods.
- **Picking a model** in the slot, the picker or the dialog changes the session's own model and effort, as `/config` would, so the model picker at the foot of the prompt box shows the switch and people learn where it is done. Where the session offers no such setting, the switch applies to each request instead, until you pick another. `/coach why` says which way it went.

The coach prefers the current model when it fits nearly as well, because a switch loses the cached conversation. A switch applies to the main conversation only, never to subagents. Each judgement costs a fraction of a cent and counts toward the coach's cost.

## Commands

| Command | Does |
|---|---|
| `/coach help` | List every command |
| `/coach` | Open the pane |
| `/coach on` · `/coach off` | Turn the coach on or off, for every chat |
| `/coach preview on` · `off` | Show every finding from the first session (for testing and demos); plain `/coach preview` toggles |
| `/coach model haiku` · `haiku-5.5` · `sonnet` · `opus` | Pick the model that writes the feedback |
| `/coach model` | Show which model runs now |
| `/coach recommend on` · `off` | Show the model suggestion beside Coach (on by default) |
| `/coach switch ask` · `auto` · `off` | When a prompt suits another model: prompt me (default), auto-select, or only show |
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
- **Recommend a model**: on by default.
- **Before a prompt runs**: Prompt me (default), Auto-select or Only show.
- **Coach checks**: every turn (default), every 3rd turn, or on focus only.
- **Pause pushes for a check**: off by default; asked once on the first push.
- **Start quietly**: on by default. The first session then shows only the chapter lines and the step line; sessions two and three allow one set of suggestions per five turns; from session four, behaviours you already show stop being coached. Off is the same as `/coach preview on`.
- **Labels in the chat**: on or off.

Settings are shared by every chat and read again with each message.

## Privacy

- **Reads** your prompts, Claude's answers and tool names in the session, only to follow the loop.
- **Sends** short excerpts to the chosen feedback model, and your prompt (in the terminal also the draft) to Haiku 5.5 for a model recommendation, through the session's own Claude connection, and to nothing else.
- **Keeps in memory** a small context card for the session only.
- **Stores on disk** counters and settings only, never message text.

Mods are not sandboxed and see every prompt. Distribute through your organisation's managed plugin marketplace after a security review; client and public-sector work needs sign-off from your data protection officer.

## For developers

`hooks/register.tsx` wires every hook. Decisions are pure and unit-tested: `moves.ts` (which step a message is), `gaps.ts` (what a short request leaves out), `state.ts`, `card.ts`, `validate.ts`, `fade.ts`, `cost.ts`. `haiku.ts` makes the model calls and never throws. `route.ts` recommends a model for the draft and picks the model of each turn, which the `turn.step` hook applies. UI lives in `hooks/ui/`.

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
