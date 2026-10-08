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

type SvgFn = (p: { source: string; alt: string; width?: number; height?: number }) => never

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
