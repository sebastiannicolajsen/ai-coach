# Notes for developers

What the Claude Code mod API (2.1.289) and the desktop app allow, as found while building the coach.

## Drawing on the desktop app

- A Box with a `width` that contains the engine's own message node is refused; the engine then draws the plain message. Put labels beside the message, never in a sized box around it.
- `alignSelf: 'stretch'` is refused.
- Every `UserMessage` row arrives with `isExpanded: true` (there is no compact view), so it is no reason to skip a label.
- Thin or very wide `Svg` images do not draw. Small ones do (the step bars, the check marks).
- A one-row `height` is not enforced: a long text line wraps to a second line, and a truncating one (`wrap="truncate"`) ends in `…`. Rules are therefore a row of short dash pieces in a box that clips what does not fit.
- `Button` takes no colour, and the desktop always draws a native button, `plain` or not.
- `Text` colours accept raw hex; theme keys are not listed in the types.
- `/coach gallery` draws the candidate techniques side by side to check a surface.

## Behaviour of the engine

- `$` cannot cross a file boundary, and state references must be literal, so `register.tsx` is the only file that touches `$` and the session state is one `coach.state` atom.
- A render hook never writes state; writes happen in handlers, timers and other events.
- A hook has a 10 s budget of its own time; `$` calls do not count. A push can therefore not wait on a button: the coach denies it, shows the Own checks, and lets the next push through once they are done.
- `$.model.complete` returns `usage` on every result; `$.session.usage().cost.usd` gives the session's cost.
- Model replies can be cut off at `maxTokens`; caps are generous and truncated JSON is repaired.
- Desktop prompts arrive with origin `sdk`, not `composer`.
- `prompt.suggest` only shows while no turn runs and the box is empty.
- Model calls run from `$.clock.after(0, …)` so an abandoned dispatch cannot cut them off.
- No `$` method switches the permission mode.

## Installing while developing

- `claude plugin install` also keeps a copy under `~/.claude/plugins/cache/ai-coach/coach/<version>`, and a chat can keep loading a stale copy. After a change, raise the version, run `claude plugin update coach@ai-coach`, or replace the cached folder with a link to this one.
- Loading the coach twice in one chat (hot reload plus the installed copy) shares one state and breaks both. Test in a fresh chat.
- Settings are stored per plugin id and re-read on every prompt; `/coach why` shows the last analysis and any hook error.
