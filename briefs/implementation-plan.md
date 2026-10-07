# Coach: implementation plan (this session)

Companion to `coach-mod-brief.md` (the what, checked against the 2.1.289 API) and `coach-build-plan.md` (the milestone order). This plan is what gets built now, in one pass, by Sonnet 5.5.

**Where:** `/Users/semn/.claude/dev-mods/0e171435-555c-4838-ae49-5713f6d7ef03/coach/`, the session's hot-reload folder. Each saved edit reloads the mod when the turn ends. Copy it into this repo (`coach/`) at the end so it's versioned.

**In scope:** M0 (runtime confirmation of the spikes already answered in brief §11) through M7, plus the README and `/coach about` from M8.
**Out of scope:** the 10 fixture sessions, the 60-turn precision evaluation, the panel re-run and the pilot (M8–M9). They need real, consented data and people.

---

## Architecture

```
coach/
  .claude-plugin/plugin.json      name "coach", types "./types/index.d.ts"
  hooks/hooks.json                { "modules": ["./register.tsx"] }
  hooks/register.tsx              wires every hook; thin
  hooks/atoms.ts                  every $.state atom (one place)
  hooks/state.ts                  pure station machine: reduce(state, event) -> state
  hooks/card.ts                   pure context-card merge and caps
  hooks/validate.ts               pure chip validation (evidence, blocklist, blanks, caps)
  hooks/fade.ts                   pure ease-in, fade and dismissal rules over store counters
  hooks/cost.ts                   pure pricing from ModelUsage + price table
  hooks/haiku.ts                  calls A, B, C over $.model.complete; JSON parse; never throws
  hooks/prompts.ts                system prompts for A, B, C and the meta chat
  hooks/config.ts                 STATION_COLOR, captions, blocklist, prices, git/deploy regex
  hooks/ui/glyph.tsx              four-bar glyph (full and mini)
  hooks/ui/band.tsx               AbovePrompt: band + rail + Coach menu + picker
  hooks/ui/labels.tsx             UserMessage / AssistantMessage labels and ✓ notes
  hooks/ui/pane.tsx               Pane: rail, about-line, meta chat
  types/index.d.ts                PluginState contract
  test/*.test.ts                  claude plugin test
  README.md
```

Rule: logic that decides anything is pure and unit-tested; `register.tsx` and the `ui/` files only read atoms and call `$`.

### State (`$.state`, session only)

`station`, `focus`, `stationReason` (outer-move caption, cleared after 4 s), `pulse`, `card` (context card), `band` (validated band content or null), `bandLoading`, `notes` (prompt text → ✓ note), `pendingSuggest`, `ownCheck` (active Own check + ticked items), `menuOpen`, `pickerOpen`, `meta` (meta-chat thread), `turnIndex`, `cost` (coach tokens and USD).

### Store (`$.store`, across sessions; counters and settings only)

`enabled`, `sessions`, `hintTaps`, `settings` (cadence, pausePushes: unset/on/off, labels, hotkeys), `fade` (per finding kind: last-5 unprompted history), `dismissals` (per kind, total), `silenced` (kinds).

### Hook map

| Hook | Does |
|---|---|
| `session.start` | register `/coach`; bump session counter; Plan; session-1 toast |
| `prompt.submit` | Brief (closed-loop pulse if it questions/corrects); clear focus, band and Own check; fire call C (`void`); always `next(e)` with the text unchanged |
| `tool.call` (Bash) | `git commit/push`, deploy or publish → Own + divider; hold via `$.ui.ask` only when pausePushes is on; ask about pausing on the first push |
| `tool.call` (Edit/Write) | leaving Plan when Claude starts acting |
| `turn.complete` | Review; cadence check; fire call A then B (`void`); queue call C's suggestion |
| `prompt.suggest` | n/a: we call `$.prompt.suggest` after the turn when the box is empty |
| `ui.render` AbovePrompt | band (if finding/focus/Own) above the rail line; `Coach off` when disabled; yield to surveys |
| `ui.render` UserMessage / AssistantMessage | mini-glyph label, ✓ note, fade rules, hover reveal |
| `ui.render` Pane `coach` | rail, about-line, Stuck? meta chat, attribution footer |
| `command.run` coach | toggle, `pane`, `ask`, `settings`, `about` |

---

## Steps

Each step ends with `claude plugin validate`, `tsc -p` (once the types are laid) and `claude plugin test`.

1. **Scaffold and spikes (M0).** Manifest, contract, `register.tsx` with the AbovePrompt rail and a UserMessage label. Confirm on load: labels draw, colours resolve, `$.ui.ask` holds a fake push. Record results in `coach/SPIKES.md`.
2. **Skeleton (M1).** Pure station machine and focus; rail with picker; Coach menu; `/coach` on/off persisted in `$.store`; Own on git push/commit. Tests for every rule row in brief §5.1 and focus clearing.
3. **Transcript (M2).** Labels with the session 1–3 / 4+ fade and hover reveal; `$.ui.log` dividers (max one per turn); keyword-based closed-loop pulse.
4. **Haiku and band (M3).** Calls A and B, card caps, validation (verbatim evidence, blocklist, `___`, ≥2 chips), band rendering, chip → `$.prompt.fill`, dismiss, outer moves from flags with hysteresis, focus content on demand with static fallback chips. Tests with a stubbed `$.model`.
5. **Prompt notes (M4).** Call C; ✓ note on the user row via `notes` atom; Brief gap via `$.prompt.suggest` after the turn when the box is empty; ignored-twice silencing.
6. **Own checks (M5).** Pause-pushes question on first push; `$.ui.ask` hold; band checkboxes when not holding; `Continue anyway`.
7. **Ease-in and fade (M6).** Silent session 1 + toast + first-run rail hint; ≤1 band per 5 turns in sessions 2–3; 3-in-5 fade; dismissal silencing; `/coach settings` pane section.
8. **Cost and meta chat (M7).** Coach USD from `r.usage` × price table (looked up at build time), conversation from `$.session.usage().cost.usd`, `≈ API cost` label; Socratic meta chat in the pane with starter chips, opened from pane, `/coach ask` or band.
9. **Finish.** README (attribution, privacy summary, settings), `/coach about` in four lines, copy to `coach/` in this repo, final validate + tests, short report of what was verified and what wasn't.

## Definition of done

- `claude plugin validate` clean, `tsc` clean, all tests pass.
- Coach off leaves the chat untouched; band never appears mid-turn; session 1 is silent; the prompt is never blocked, rewritten or dropped.
- Nothing but counters and settings in `$.store`; no network beyond `$.model.*`.
