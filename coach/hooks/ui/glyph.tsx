import type { ElementTable } from 'claude-code'
import type { CoachStation } from '../../types'
import { STATION_COLOR, STATION_HEX, STATION_NAME, STATION_WORD_HEX } from '../config'

export type Ui = Pick<ElementTable, 'Box' | 'Text' | 'Button'> & { surface?: string }

// The element table plus the surface it belongs to (the glyph is an Svg anywhere but the terminal).
export const withSurface = (table: unknown, surface: string): Ui => ({ ...(table as object), surface }) as Ui

export const isTerminal = (ui: Ui) => ui.surface === 'terminal'

// Station word: theme keys on the terminal, the light-mode hex everywhere else.
export const wordColor = (ui: Ui, s: CoachStation) => (isTerminal(ui) ? STATION_COLOR[s] : STATION_WORD_HEX[s])

const ORDER: CoachStation[] = ['plan', 'brief', 'review', 'own']
const WIDTH: Record<CoachStation, number> = { plan: 10, brief: 15, review: 15, own: 10 }
const GAP = [4, 2, 4]
const HEIGHT = 3

type GlyphOptions = { mini?: boolean; pulse?: boolean }

// The four bars as one small drawing: outer bars short, the inner pair long and close.
export function glyphSvg(active: CoachStation, { mini = false, pulse = false }: GlyphOptions = {}) {
  const k = mini ? 0.7 : 1
  let x = 0
  const bars = ORDER.map((s, i) => {
    const w = WIDTH[s] * k
    const isActive = s === active
    const isInner = s === 'brief' || s === 'review'
    const fill = isActive ? STATION_HEX[s] : '#888888'
    const opacity = isActive ? 1 : pulse && isInner ? 0.6 : 0.35
    const bar = `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${(HEIGHT * k).toFixed(1)}" rx="${(1.5 * k).toFixed(2)}" fill="${fill}" fill-opacity="${opacity}"/>`
    x += w + (GAP[i] ?? 0) * k
    return bar
  })
  const total = ORDER.reduce((n, s) => n + WIDTH[s], 0) + GAP.reduce((n, g) => n + g, 0)
  const width = Math.round(total * k * 10) / 10
  const height = Math.round(HEIGHT * k * 10) / 10
  return {
    width,
    height,
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bars.join('')}</svg>`,
  }
}

// Terminal cells: active bar thick and coloured, the rest thin and dim; the inner pair sits closer.
const CELLS: Record<CoachStation, { on: string; off: string; gap: string }> = {
  plan: { on: '━', off: '─', gap: '  ' },
  brief: { on: '━━', off: '──', gap: ' ' },
  review: { on: '━━', off: '──', gap: '  ' },
  own: { on: '━', off: '─', gap: '' },
}

type SvgFn = (p: { source: string; alt: string; width?: number; height?: number; isInteractive?: boolean }) => never

// Claude's own working mark: a small clay asterisk that turns and breathes. SMIL needs the interactive frame.
const SPIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="12" height="12"><g fill="none" stroke="#D97757" stroke-width="1.5" stroke-linecap="round"><path d="M6 1.5V10.5M1.5 6H10.5M2.8 2.8 9.2 9.2M9.2 2.8 2.8 9.2"/><animateTransform attributeName="transform" type="rotate" from="0 6 6" to="360 6 6" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite"/></g></svg>'

// A gap of a few pixels: the desktop spaces in whole rows, so a transparent drawing of that height stands in.
// The terminal has nothing smaller than a row and gets nothing.
export function spacer(ui: Ui, px: number) {
  const Svg = (ui as unknown as { Svg?: SvgFn }).Svg
  if (!Svg || isTerminal(ui)) return null
  return <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 ${px}" width="1" height="${px}"></svg>`} alt="space" width={1} height={px} />
}

const MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="11" height="11"><path d="M6 0.8 7.3 4.7 11.2 6 7.3 7.3 6 11.2 4.7 7.3 0.8 6 4.7 4.7Z" fill="#D97757"/></svg>'

// The coach's mark, the ✦ its recommendations carry: in clay, ahead of the suggestions.
export function coachMark(ui: Ui) {
  const Svg = (ui as unknown as { Svg?: SvgFn }).Svg
  if (Svg && !isTerminal(ui)) return <Svg source={MARK_SVG} alt="Coach suggests" width={11} height={11} />
  return <ui.Text color="claude">✦</ui.Text>
}

// Small line icons in the label grey, drawn like the check mark: one beside each control at the step line.
const LINE = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 12" width="16" height="12"><g fill="none" stroke="#8A8782" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`
const ICONS = {
  // A chip: the model Claude runs on.
  model: LINE('<rect x="3" y="3" width="6" height="6" rx="1.3"/><path d="M5 1.2v1.8M7 1.2v1.8M5 9v1.8M7 9v1.8M1.2 5h1.8M1.2 7h1.8M9 5h1.8M9 7h1.8"/>'),
  // A speech bubble: ask before switching.
  ask: LINE('<path d="M2.2 3.3a1.3 1.3 0 0 1 1.3-1.3h5a1.3 1.3 0 0 1 1.3 1.3v3.4a1.3 1.3 0 0 1-1.3 1.3H5.4L3.2 10V8h-.0a1.3 1.3 0 0 1-1-1.3Z"/>'),
  // Two turning arrows: switch by itself.
  auto: LINE('<path d="M9.6 4.6A3.8 3.8 0 0 0 2.7 4M2.4 7.4A3.8 3.8 0 0 0 9.3 8"/><path d="M2.5 1.8v2.4h2.4M9.5 10.2V7.8H7.1"/>'),
  // An arrow into the prompt box: a suggestion fills it.
  fill: LINE('<path d="M2.5 2v3.6a1.6 1.6 0 0 0 1.6 1.6h5.4"/><path d="M7.4 5 9.6 7.2 7.4 9.4"/>'),
  // An eye: only show.
  off: LINE('<path d="M1 6s1.8-3.4 5-3.4S11 6 11 6 9.2 9.4 6 9.4 1 6 1 6Z"/><circle cx="6" cy="6" r="1.4"/>'),
} as const

export type IconName = keyof typeof ICONS | 'mark'

// A drawn icon beside a control; nothing on the terminal, where the words stand alone.
export function icon(ui: Ui, name: IconName) {
  const Svg = (ui as unknown as { Svg?: SvgFn }).Svg
  if (!Svg || isTerminal(ui)) return name === 'mark' ? coachMark(ui) : null
  if (name === 'mark') return coachMark(ui)
  return <Svg source={ICONS[name]} alt={name} width={16} height={12} />
}

const EFFORT_LEVEL = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 } as const

// Effort as one small vertical bar that fills from the bottom, low to max; clay when it is a recommendation.
export function effortBar(ui: Ui, effort: keyof typeof EFFORT_LEVEL | null | undefined, isRecommended = false) {
  if (!effort) return null
  const Svg = (ui as unknown as { Svg?: SvgFn }).Svg
  const level = EFFORT_LEVEL[effort]
  if (!Svg || isTerminal(ui)) return <ui.Text dimColor={!isRecommended}>{' ▁▂▄▆█'[level]}</ui.Text>
  const fill = isRecommended ? '#D97757' : '#8A8782'
  const filled = (10 * level) / 5
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 12" width="9" height="12"><rect x="3.5" y="1" width="4" height="10" rx="1.2" fill="none" stroke="${fill}" stroke-opacity="0.55" stroke-width="1"/><rect x="3.5" y="${(11 - filled).toFixed(1)}" width="4" height="${filled.toFixed(1)}" rx="1.2" fill="${fill}"/></svg>`
  return <Svg source={source} alt={`${effort} effort`} width={9} height={12} />
}

// The working mark alone, for a slot that is still being decided.
export function spinMark(ui: Ui) {
  const Svg = (ui as unknown as { Svg?: SvgFn }).Svg
  if (Svg && !isTerminal(ui)) return <Svg source={SPIN_SVG} alt="working" width={12} height={12} isInteractive />
  return <ui.Text color="claude">✻</ui.Text>
}

// A working row: the mark and a dim word, in the voice of Claude's own spinner.
export function spinner(ui: Ui, text: string) {
  const { Box, Text } = ui
  const Svg = (ui as unknown as { Svg?: SvgFn }).Svg
  return (
    <Box flexDirection="row" gap={1} alignItems="center">
      {Svg && !isTerminal(ui) ? (
        <Svg source={SPIN_SVG} alt="working" width={12} height={12} isInteractive />
      ) : (
        <Text color="claude">✻</Text>
      )}
      <Text dimColor>{text}…</Text>
    </Box>
  )
}

const CHECK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 10" width="12" height="10"><path d="M1.5 5.5 4.5 8.5 10.5 1.5" fill="none" stroke="#8A8782" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'

const HALF_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="11" height="11"><circle cx="6" cy="6" r="4.6" fill="none" stroke="#8A8782" stroke-width="1.4"/><path d="M6 1.4 A4.6 4.6 0 0 1 6 10.6 Z" fill="#8A8782"/></svg>'
const CROSS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 2.5 9.5 9.5 M9.5 2.5 2.5 9.5" fill="none" stroke="#8A8782" stroke-width="1.6" stroke-linecap="round"/></svg>'

export type Mark = 'good' | 'comment' | 'issue'

// The three marks on a person's message: ✓ a move worth repeating, ◐ something it could still say, ✕ a problem.
export function mark(ui: Ui, kind: Mark) {
  if (kind === 'good') return checkMark(ui)
  const Svg = (ui as unknown as { Svg?: SvgFn }).Svg
  if (Svg && !isTerminal(ui)) {
    return kind === 'comment' ? <Svg source={HALF_SVG} alt="comment" width={11} height={11} /> : <Svg source={CROSS_SVG} alt="issue" width={10} height={10} />
  }
  return <ui.Text dimColor>{kind === 'comment' ? '◐' : '✕'}</ui.Text>
}

// A rule that fills the rest of a row, after a chapter line's caption.
export function fillRule(ui: Ui) {
  return pieces(ui, 60)
}

// A drawn tick in the label grey: the ✓ glyph falls back to another font on remote surfaces.
export function checkMark(ui: Ui) {
  const Svg = (ui as unknown as { Svg?: SvgFn }).Svg
  if (Svg && !isTerminal(ui)) return <Svg source={CHECK_SVG} alt="done" width={12} height={10} />
  return <ui.Text dimColor>✓</ui.Text>
}

export function glyph(ui: Ui, active: CoachStation, { mini = false, pulse = false }: GlyphOptions = {}) {
  const { Box, Text } = ui
  const Svg = (ui as unknown as { Svg?: SvgFn }).Svg
  if (Svg && !isTerminal(ui)) {
    const g = glyphSvg(active, { mini, pulse })
    return (
      <Box flexShrink={0}>
        <Svg source={g.source} alt={STATION_NAME[active]} width={g.width} height={g.height} />
      </Box>
    )
  }
  return (
    <Box flexDirection="row" flexShrink={0}>
      {ORDER.map(s => {
        const c = CELLS[s]
        return s === active ? (
          <Text color={STATION_COLOR[s]}>
            {c.on}
            {c.gap}
          </Text>
        ) : (
          <Text dimColor={!(pulse && (s === 'brief' || s === 'review'))}>
            {c.off}
            {c.gap}
          </Text>
        )
      })}
    </Box>
  )
}

// One thin rule between the band's content and the rail. It fills the slot's width, is 1px tall (an unset height
// would scale to a fraction of a pixel), has a blank row above and below, and is never
// drawn as dashes on a remote surface.
// A line across the rest of a row, built from short pieces in a box that clips what does not fit. A single
// long text line wraps to two lines on desktop, and a truncating one ends in "…"; pieces avoid both.
// The grey of a step bar that is not lit (35% of #888888 over the page), so the rule continues the glyph.
export const RULE_GREY = '#D1CFCB'

function pieces(ui: Ui, count: number) {
  const { Box, Text } = ui
  const tone = isTerminal(ui) ? { dimColor: true } : { color: RULE_GREY }
  return (
    <Box flexDirection="row" flexWrap="nowrap" flexGrow={1} flexShrink={1} overflow="hidden" minWidth={2}>
      {Array.from({ length: count }, (_, i) => (
        <Box key={`r${i}`} flexShrink={0}>
          <Text {...tone}>────</Text>
        </Box>
      ))}
    </Box>
  )
}

// The band's rule across its width.
export function hairline(ui: Ui, _columns: number) {
  return <ui.Box flexDirection="row">{pieces(ui, 60)}</ui.Box>
}
