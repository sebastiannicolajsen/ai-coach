import type { CoachBand, CoachOwnCheck, CoachState } from '../../types'
import { type Dollar, dismissBand, fillFromCoach, finishOwn, focusStation, setEnabled, tickOwn } from '../actions'
import { OWN_CONTINUE, STATIONS, STATION_NAME } from '../config'
import { menuCost } from '../cost'
import { type Ui, glyph, hairline, withSurface } from './glyph'
import { focusTarget, hasQuote, targetOf } from '../target'
import { rail } from './rail'

function dismissButton(ui: Ui, $: Dollar) {
  return <ui.Button key="dismiss" label="×" role="dismiss" onPress={() => void dismissBand($)} />
}

// Finding or Own title on one row with the dismiss control at the right end.
function titleRow(ui: Ui, $: Dollar, title: string) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row" justifyContent="space-between" gap={1}>
      <Box flexShrink={1}>
        <Text>{title}</Text>
      </Box>
      {dismissButton(ui, $)}
    </Box>
  )
}

function sourceRow(ui: Ui, quotes: string[], target: string) {
  const { Box, Text } = ui
  if (quotes.length === 0) return null
  return (
    <Box flexDirection="row" gap={1}>
      <Text dimColor>“</Text>
      <Box flexShrink={1}>
        <Text dimColor italic wrap="truncate">
          {quotes.join(' · ')}
        </Text>
      </Box>
      {target && <Text dimColor>· {target}</Text>}
    </Box>
  )
}

function bandView(ui: Ui, $: Dollar, band: CoachBand) {
  const { Box, Text, Button } = ui
  return (
    <Box flexDirection="column">
      {band.title && titleRow(ui, $, band.title)}
      {hasQuote(band) ? sourceRow(ui, band.evidence, targetOf(band.station)) : <Text dimColor>{focusTarget(band.station)}</Text>}
      <Box flexDirection="row" flexWrap="wrap" gap={1} marginTop={1}>
        {band.chips.map((chip, i) => (
          <Button
            key={`chip-${i}`}
            label={chip.label}
            onPress={() => void fillFromCoach($, chip.fill)}
          />
        ))}
      </Box>
      {band.suggestion && (
        <Box flexDirection="row" gap={1}>
          <Text dimColor>
            Step out to {STATION_NAME[band.suggestion.station]}? {band.suggestion.reason}
          </Text>
          <Button
            key="suggest"
            label={`Go to ${STATION_NAME[band.suggestion.station]}`}
            plain
            onPress={() => void focusStation($, band.suggestion!.station)}
          />
        </Box>
      )}
    </Box>
  )
}

function ownView(ui: Ui, $: Dollar, check: CoachOwnCheck) {
  const { Box, Button } = ui
  return (
    <Box flexDirection="column">
      {titleRow(ui, $, check.title)}
      {sourceRow(ui, check.source, '')}
      <Box flexDirection="row" flexWrap="wrap" gap={1} marginTop={1}>
        {check.checks.map((text, i) => (
          <Button
            key={`own-${i}`}
            label={`${check.ticked.includes(i) ? '☑' : '☐'} ${text}`}
            onPress={() => void tickOwn($, i)}
          />
        ))}
        <Button key="own-continue" plain dimColor label={OWN_CONTINUE} onPress={() => void finishOwn($)} />
      </Box>
    </Box>
  )
}

// One row: "Focus on" and the four steps on the left, cost and Turn off on the right.
function fold(ui: Ui, $: Dollar, st: CoachState) {
  const { Box, Text, Button } = ui
  return (
    <Box flexDirection="row" justifyContent="space-between" gap={1}>
      <Box flexDirection="row" gap={1} flexShrink={1}>
        <Text dimColor>Focus on</Text>
        {STATIONS.map((s, i) => (
          <Button
            key={`pick-${s}`}
            label={STATION_NAME[s]}
            hotkey={st.prefs.settings.hotkeys ? String(i + 1) : undefined}
            onPress={() => void focusStation($, s)}
          />
        ))}
      </Box>
      <Box flexDirection="row" gap={1} flexShrink={0}>
        <Text dimColor>{menuCost(st.cost.usd, st.usage.isApprox)}</Text>
        <Button key="menu-off" label="Turn off" onPress={() => void setEnabled($, false)} />
      </Box>
    </Box>
  )
}

export async function renderAbovePrompt(
  $: Dollar,
  e: Parameters<Dollar['ui']['resolve']>[0] & { props: { hasSurvey: boolean; isWorking: boolean; bodyColumns: number } },
  next: (e: never) => Promise<never>,
) {
  if (e.props.hasSurvey) return next(e as never)
  const ui = withSurface($.ui.resolve(e), (e as { surface: string }).surface)
  const { Box, Button } = ui
  const st = await $.get()

  if (!st.prefs.enabled) {
    return (
      <Box flexDirection="row" justifyContent="flex-end">
        <Button key="coach-on" plain dimColor label="Coach off" onPress={() => void setEnabled($, true)} />
      </Box>
    )
  }

  // Mid-turn only what the person asked for: a focus, or a held push.
  const isAsked = st.focus !== null || st.ownCheck?.held === true
  const content =
    e.props.isWorking && !isAsked
      ? null
      : st.ownCheck
        ? ownView(ui, $, st.ownCheck)
        : st.band
          ? bandView(ui, $, st.band)
          : null
  const hasRule = content !== null || st.menuOpen

  return (
    <Box flexDirection="column">
      {content}
      {st.menuOpen && fold(ui, $, st)}
      {hasRule && hairline(ui, e.props.bodyColumns)}
      <Box flexDirection="row" gap={1}>
        {rail(ui, { station: st.station, focus: st.focus, reason: st.stationReason, pulse: st.pulse })}
        <Button key="menu" plain label="Coach" onPress={() => void $.patch('menuOpen', o => !o)} />
      </Box>
    </Box>
  )
}
