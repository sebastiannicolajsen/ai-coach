# Coach: visual spec (from `coach-visual-refs/`)

The refs are the target. They show the desktop Code tab in light mode. `X1-now-card.png` is the current state; `X2-target-card.png` and `D1`–`D8` are the target. The engine draws the band's grey rounded container; the coach draws only what goes inside it.

## Global rules

- **One size of text.** No `bold` anywhere: not the station word, not the title.
- **Colour sits only on:** the active bar of a glyph, and the station word in the rail. The band, the chips, the captions and the transcript labels use neutral text: default, or `dimColor` for secondary text.
- **No backgrounds** set by the coach. Native buttons draw their own outline.
- **Hairline:** one thin, light rule. It appears only between the band's content and the rail line, and never at rest.
  - On desktop, draw it as a 1 px `Svg` line that fills the band width (`preserveAspectRatio="none"`, a wide viewBox capped by the slot). Never draw it as `─` text: in X1 the dashes wrap onto two lines.
  - On the terminal, use `─` repeated to exactly `bodyColumns`, with `dimColor`.
- **No hint line** ("Tap ▴ …"), no `▴`, and no "Ask the coach" chip in the band.

## Colours

Station colours, light mode, sampled from the refs:

| Station | Bar | Word |
|---|---|---|
| Plan | `#8B7FD6` | `#6E5FC4` |
| Brief | `#2A9D8F` | `#1F8577` |
| Review | `#D08A1E` | `#B06A12` |
| Own | `#D45A85` | `#B83C6A` |

Inactive bars are a light neutral grey: `#D4D4D4` in light mode, about 35% foreground.

- **Desktop:** use the hex values for both the `Svg` bars and the word's `Text` color, unless a theme key is shown to draw the same tone.
- **Terminal:** keep the theme keys (`*_FOR_SUBAGENTS_ONLY`) with ANSI fallbacks.

## Glyph

Four rounded bars on one baseline.

- **Bars:** Plan and Own are short (10 px). Brief and Review are long (15 px). Height 3 px, radius 1.5 px.
- **Gaps:** 4 px between the outer bars and the inner pair, 2 px inside the pair.
- **Mini (labels):** about 70% of that. The active bar is coloured in labels too; don't dim it.

## Rail line (D1, X2): one row at rest

`[glyph]  Review   checking what Claude gave you ··············· Coach`

- **Glyph**, then a gap.
- **Station word**, in the station colour.
- **Caption**, `dimColor`, about 2 cells after the word, truncating first.
- **`Coach`**, flush right: a plain Button in default text colour, not dim.
- **Focus (D4):** the word becomes `Focus · Brief` in the station colour, and the caption changes to that station's caption.

## Finding band (D2)

From the top:

1. **Title row.** The finding in default text, no header row above it. A `×` dismiss (`role="dismiss"`) sits at the right end of the same row.
2. **Source row.** A small `“` mark (`dimColor`), then the quote(s) in `dimColor` italic, separated by `·`.
3. **Chips.** One blank row above them. Two or three native Buttons on one row: not plain, no variant.
4. **Suggestion line** (optional), `dimColor`.
5. **Hairline.**
6. **Rail line.**

## Focus band (D4)

Same as D2, with one difference:

- **Header row** above the title: the mini glyph plus `Focus · Brief`, `dimColor`.

Choosing a focus also pre-fills the prompt box with that station's template (`$.prompt.fill`, for example `Mette needs to decide ___ on Thursday, so focus on ___.`).

## Step picker (D3)

One row of four native Buttons: `Plan`, `Brief`, `Review`, `Own`.

- The current station's Button gets the mini glyph inside it if possible. Otherwise put the glyph just before it.
- Hairline below, then the rail.

How it opens:

- Preferred: a press on the glyph or the station word. A Button can't take colour, so only if a plain Button can carry the coloured word.
- Otherwise: pressing `Coach` opens a fold with the D3 picker row on top and the D5 menu row under it, then the hairline, then the rail.

## Coach menu (D5)

One row:

- Left: `Coach $0.03, 2% of $1.48 this session` in `dimColor`. Use a comma, not `·`. Add `≈` for subscription users.
- Right: `Turn off coach` and `Settings` as native Buttons.

Then the hairline, then the rail.

## Coach off (D6)

The band holds only `Coach off`, flush right, as a plain `dimColor` Button. Nothing else.

## Own band (D7)

- **Title row:** for example `This reaches Mette before Thursday. Three quick checks.`, with `×` on the right.
- **Source row:** `“ git push · email to Mette`.
- **One row of checks:**
  - Each check is a native Button whose label starts with `☐` (`☑` when ticked).
  - The third check may be generated from the card, for example `Trial exclusion explained`. It falls back to `AI assistance noted`.
  - `Continue anyway` follows as a plain `dimColor` Button.
- **Then:** the hairline, then the rail with `Own` / `standing behind what you ship`.

Transcript:

- **Divider:** `$.ui.log` with `Own · push paused` (the engine prefixes `coach`).
- **Tool row:** the push's own row reads `git push origin main paused`.

### Holding the push from the band

The push is held by the band, not by the `$.ui.ask` dialog, because the 10 s hook budget rules out waiting on the band:

1. With Pause pushes on, deny the push with: `Push paused at the Own check. Wait for the person to finish the checks; don't retry.`
2. Show the Own band.
3. When all checks are ticked, or `Continue anyway` is pressed, set a one-time pass for the next matching push and call `$.prompt.submit({ text: 'Checks done. Go ahead with the push.' })`.
4. With Pause pushes off, show the same band without denying the push.

## Transcript labels (D1, D7)

- **Under the user's bubble, right-aligned:** mini glyph (Brief coloured), `Brief` in `dimColor`, then `✓ Corrected Claude's definition` in `dimColor` with no `·`.
- **Above Claude's reply, left-aligned:** mini glyph (Review coloured), `Review` in `dimColor`.
- **No other text or borders.** The active bar keeps its colour.

## Prompt suggestion (D8)

The engine draws it. Keep the template short, with one `___`.
