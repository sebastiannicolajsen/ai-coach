import type { Dollar } from '../actions'
import { STATION_HEX } from '../config'
import { type Ui, checkMark, coachMark, glyph, icon, spinner, withSurface, wordColor } from './glyph'

// `/coach gallery`: every candidate drawing technique side by side, numbered, inside a transcript row,
// so one screenshot shows which ones the surface paints the way the tests assume.

type SvgFn = (p: { source: string; alt: string; width?: number; height?: number }) => never

const rule = (w: number, h: number, y: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect x="0" y="${y}" width="${w}" height="1" fill="#8A8782" fill-opacity="0.45"/></svg>`
const ruleNoSize = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 1" preserveAspectRatio="none"><rect x="0" y="0" width="100" height="1" fill="#8A8782" fill-opacity="0.45"/></svg>'
const DASHES = '─'.repeat(200)

function row(ui: Ui, label: string, body: unknown) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row" gap={1} marginTop={1}>
      <Box width={4} flexShrink={0}>
        <Text dimColor>{label}</Text>
      </Box>
      <Box flexDirection="row" flexGrow={1} flexShrink={1} gap={1} alignItems="center">
        {body as never}
      </Box>
    </Box>
  )
}

export async function renderGallery($: Dollar, e: Parameters<Dollar['ui']['resolve']>[0]) {
  const ui = withSurface($.ui.resolve(e), (e as { surface: string }).surface)
  const { Box, Text, Button, Markdown } = ui as Ui & { Markdown: (p: { text: string; dimColor?: boolean }) => never }
  const Svg = (ui as unknown as { Svg?: SvgFn }).Svg
  const svg = (source: string, width?: number, height?: number) =>
    Svg ? <Svg source={source} alt="" width={width} height={height} /> : <Text dimColor>(no Svg here)</Text>
  const word = (
    <>
      {glyph(ui, 'brief', { mini: true })}
      <Text color={wordColor(ui, 'brief')}>Brief</Text>
      <Box flexShrink={0}>
        <Text dimColor>· a new instruction</Text>
      </Box>
    </>
  )
  return (
    <Box flexDirection="column">
      <Text>Coach · gallery. Which numbers look right?</Text>

      <Text dimColor>Rules after a chapter line</Text>
      {row(ui, 'R1', <>{word}<Box flexGrow={1} flexShrink={1} overflow="hidden" height={1}><Text dimColor>{DASHES}</Text></Box></>)}
      {row(ui, 'R2', <>{word}<Box flexGrow={1} flexShrink={1}><Text dimColor wrap="truncate">{DASHES}</Text></Box></>)}
      {row(ui, 'R3', <>{word}<Box flexGrow={1} flexShrink={1} overflow="hidden" height={1}>{svg(rule(2400, 1, 0), 2400, 1)}</Box></>)}
      {row(ui, 'R4', <>{word}<Box flexGrow={1} flexShrink={1}>{svg(ruleNoSize, undefined, 1)}</Box></>)}
      {row(ui, 'R5', <>{word}{svg(rule(400, 1, 0), 400, 1)}</>)}
      {row(ui, 'R6', <>{word}<Box flexGrow={1} flexShrink={1}><Markdown text="---" dimColor /></Box></>)}
      {row(ui, 'R7', <>{word}<Box flexGrow={1} flexShrink={1} borderStyle="single" borderDimColor height={1} /></>)}
      {row(ui, 'R8', <>{word}<Text dimColor>{'─'.repeat(40)}</Text></>)}

      <Text dimColor>Separators across the band width</Text>
      {row(ui, 'S1', <Box flexGrow={1} height={1} overflow="hidden">{svg(rule(2400, 9, 4), 2400, 9)}</Box>)}
      {row(ui, 'S2', <Box flexGrow={1}>{svg(ruleNoSize, undefined, 1)}</Box>)}
      {row(ui, 'S3', <Box flexGrow={1}><Markdown text="---" dimColor /></Box>)}
      {row(ui, 'S4', <Box flexGrow={1} overflow="hidden" height={1}><Text dimColor>{DASHES}</Text></Box>)}

      <Text dimColor>Check marks</Text>
      {row(ui, 'K1', <>{checkMark(ui)}<Text dimColor>Audience is named</Text></>)}
      {row(ui, 'K2', <Text dimColor>✓ Audience is named</Text>)}
      {row(ui, 'K3', <Text dimColor>✔ Audience is named</Text>)}

      <Text dimColor>Suggestion styles (which looks best?)</Text>
      {row(ui, 'B1', <>{['Check the 12%', 'Compare delivery terms'].map(l => <Button key={`b1-${l}`} label={l} onPress={() => {}} />)}</>)}
      {row(ui, 'B2', <>{[coachMark(ui), ...['Check the 12%', 'Compare delivery terms'].map(l => <Button key={`b2-${l}`} variant="secondary" label={l} onPress={() => {}} />)]}</>)}
      {row(ui, 'B3', <>{[coachMark(ui), ...['Check the 12%', 'Compare delivery terms'].map(l => <Button key={`b3-${l}`} variant="primary" label={l} onPress={() => {}} />)]}</>)}
      {row(ui, 'B4', <>{[coachMark(ui), ...['Check the 12%', 'Compare delivery terms'].map(l => <Button key={`b4-${l}`} plain label={`${l} ↗`} onPress={() => {}} />)]}</>)}
      {row(ui, 'B5', <>{['Check the 12%', 'Compare delivery terms'].map(l => <Button key={`b5-${l}`} plain dimColor label={`→ ${l}`} onPress={() => {}} />)}</>)}

      <Text dimColor>Icons beside the step line, and the settings control</Text>
      {row(ui, 'I1', <>{icon(ui, 'mark') as never}<Text>Opus 5.5 · planning</Text>{icon(ui, 'model') as never}<Text dimColor>Sonnet 5.5</Text>{icon(ui, 'ask') as never}<Text dimColor>Prompt me</Text>{icon(ui, 'auto') as never}<Text dimColor>Auto-select</Text>{icon(ui, 'off') as never}<Text dimColor>Only show</Text></>)}
      {row(ui, 'I2', <>{['⋯', '•••', '☰', 'Settings'].map(l => <Button key={`i2-${l}`} plain dimColor label={l} onPress={() => {}} />)}</>)}

      <Text dimColor>Working spinner (should turn and breathe)</Text>
      {row(ui, 'W1', spinner(ui, 'Finding next steps'))}

      <Text dimColor>Station colours (word and bar)</Text>
      {row(
        ui,
        'C1',
        <>
          {(['plan', 'brief', 'review', 'own'] as const).map(s => (
            <Box flexDirection="row" gap={1} flexShrink={0}>
              {glyph(ui, s, { mini: true })}
              <Text color={wordColor(ui, s)}>{s}</Text>
              <Text color={STATION_HEX[s]}>bar hex</Text>
            </Box>
          ))}
        </>,
      )}
    </Box>
  )
}
