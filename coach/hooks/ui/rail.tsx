import type { CoachStation } from '../../types'
import { STATION_CAPTION, STATION_NAME } from '../config'
import { type Ui, glyph, wordColor } from './glyph'

export type RailProps = {
  station: CoachStation
  focus: CoachStation | null
  reason: string
  pulse: boolean
}

export const railWord = (station: CoachStation, focus: CoachStation | null): string =>
  focus ? `Focus · ${STATION_NAME[focus]}` : STATION_NAME[station]

// Glyph, station word (the only coloured text) and a muted caption that truncates first.
export function rail(ui: Ui, p: RailProps) {
  const { Box, Text } = ui
  const shown = p.focus ?? p.station
  return (
    <Box flexDirection="row" gap={1} flexGrow={1} flexShrink={1}>
      {glyph(ui, shown, { pulse: p.pulse })}
      <Text color={wordColor(ui, shown)} wrap="truncate">
        {railWord(p.station, p.focus)}
      </Text>
      <Box flexShrink={1} marginLeft={1}>
        <Text dimColor wrap="truncate">
          {p.reason || STATION_CAPTION[shown]}
        </Text>
      </Box>
    </Box>
  )
}
