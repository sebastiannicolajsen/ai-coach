# Coach

A quiet thinking partner for working with Claude Code. It shows where you are in the working loop and helps with the next step, without explaining a framework.

The loop has four stations. Plan (decide what Claude should do), Brief (your next prompt), Review (check what Claude gave you) and Own (stand behind what you ship). Brief and Review are the inner loop; Plan and Own are the steps outside it.

## What you see

- **Rail** above the prompt, one row: four bars (a small drawing on desktop, line characters in the terminal), the station word in its colour, a dim caption, and `Coach` at the right. `Coach` opens one row: `Focus on` with four step buttons on the left (picking one shows a band at once, focuses the coach until your next prompt and pre-fills a template when the box is empty), and the cost with `Turn off` on the right.
- **Start quietly**: on by default; off is preview mode.
- **Labels in the chat**: the glyph (active bar coloured) and station name on your prompts (Brief, with a `✓` note when there is one) and on Claude's replies (Review, or Own during a check). From the fourth session only the latest exchange shows them; older ones appear on hover.
- **Dividers**: one short dim line such as `Own · push paused` when you step out to Plan or Own, at most one per turn.
- **Band** above the rail, only after Claude has finished and only when something is worth saying or you chose a focus. A finding band is a title with `×`, the quoted source in dim italic, and two or three buttons that fill the prompt box. A focus band adds a header row. A thin rule separates the band from the rail; there is no rule at rest.
- **Own checks** on `git commit`, `git push` and deploy commands: a title, the source, three check buttons (the third can come from what Claude assumed) and `Continue anyway`. With Pause pushes on, the push is denied once with a note to wait; finishing the checks lets the next push through once and sends `Checks done. Go ahead with the push.` as a prompt.
- **Pane** (`/coach`): the four steps with short meanings, what the conversation is about, a Socratic `Stuck?` chat, settings as selects, the cost and the attribution.

The first session is silent apart from the rail, labels and one toast. Sessions two and three allow at most one band per five turns. From session four, behaviours you already show without prompting stop being coached, and a finding you dismiss twice (or five times in total) stops being raised.

## Commands

| Command | Does |
|---|---|
| `/coach` | Open the pane (steps, Stuck? chat, settings) |
| `/coach on`, `/coach off` | Set it explicitly |
| `/coach pane` | Open the Coach pane |
| `/coach ask` | Open the pane at the `Stuck?` chat |
| `/coach settings` | Open the pane with settings |
| `/coach preview` | Toggle preview: skips the silent first session, fade, dismissal silencing and the one-band-per-5-turns limit (the check cadence still applies) |
| `/coach about` | What the coach reads and stores, in four lines |

## Settings

In the pane (`/coach`).

- **Coach checks**: every turn (default), every 3rd turn, or on focus only. This covers the turn analysis, the band and the prompt notes.
- **Pause pushes for a check**: off by default; asked once on the first push.
- **Start quietly**: on by default; off is preview mode.
- **Labels in the chat**: on or off.
- **Raise silenced findings again**: clears dismissals.

## Privacy

- Reads: your prompts, Claude's answers and tool names in this session, only to follow the loop.
- Sends: short excerpts to Haiku through this session's own connection, and nothing to any other service.
- Keeps in memory: a small context card for this session only, cleared when it ends.
- Stores on disk: counters and settings only (on or off, sessions, dismissals), never message text.

Mods are not sandboxed and see every prompt. Distribute through Implement's managed plugin marketplace after IT security review; public-sector and client work needs the DPO's sign-off beyond internal use.

## Cost

The Coach menu shows what the coach's own Haiku calls cost against the conversation's cost, for example `Coach $0.03, 2% of $1.48 this session`. Subscription users see `≈` before the amount. Prices are in `hooks/config.ts` (source and date in the comment).

## Layout

`hooks/register.tsx` wires every hook and is the only file that touches the engine's `$`; everything else gets a narrow `Ctx` from it. Decisions are pure and unit-tested: `state.ts` (station machine), `card.ts`, `validate.ts`, `fade.ts`, `cost.ts`. `haiku.ts` makes the three model calls and never throws. UI lives in `hooks/ui/`. State is one `coach.state` value; the contract is in `types/index.d.ts`.

Run `claude plugin validate .` and `claude plugin test .` in this folder, and `npx -p typescript tsc -p .` once Claude Code has laid `.claude-plugin/types`.

## Attribution

Based on the AI Fluency Framework by Dakan, Feller and Anthropic, CC BY-NC-SA 4.0.
