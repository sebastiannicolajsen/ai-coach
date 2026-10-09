import type { CoachStation } from '../../types'
import { STATION_NAME } from '../config'
import { type Ui, glyph, wordColor } from './glyph'

export type RailProps = {
  station: CoachStation
  focus: CoachStation | null
  reason: string
  moveNote?: string
  // What to do now, written for this conversation; there is no stock caption.
  note?: string
  pulse: boolean
}

export const railWord = (station: CoachStation, focus: CoachStation | null): string =>
  focus ? `Focus · ${STATION_NAME[focus]}` : STATION_NAME[station]

// Glyph, station word (the only coloured text) and, when there is one, a written note that truncates first.
export function rail(ui: Ui, p: RailProps) {
  const { Box, Text } = ui
  const shown = p.focus ?? p.station
  const caption = p.reason || (p.focus ? '' : p.moveNote || p.note || '')
  return (
    <Box flexDirection="row" gap={1} flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
      {glyph(ui, shown, { pulse: p.pulse })}
      <Text color={wordColor(ui, shown)} wrap="truncate">
        {railWord(p.station, p.focus)}
      </Text>
      {caption && (
        <Box flexShrink={1} minWidth={0} overflow="hidden" marginLeft={1}>
          <Text dimColor wrap="truncate">
            {caption}
          </Text>
        </Box>
      )}
    </Box>
  )
}
