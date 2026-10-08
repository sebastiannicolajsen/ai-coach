import type { CoachBand, CoachOwnCheck, CoachState } from '../../types'
import { type Dollar, dismissBand, fillFromCoach, finishOwn, focusStation, setEnabled, tickOwn, toggleMenu, restoreBand } from '../actions'
import { OWN_CONTINUE, STATIONS, STATION_NAME } from '../config'
import { menuCost } from '../cost'
import { type Ui, checkMark, glyph, withSurface } from './glyph'
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

// Only suggestions: one row of buttons that fill the prompt box, and a dismiss at the end. What the coach
// noticed about the person's own message is said under that message, not here.
function bandView(ui: Ui, $: Dollar, band: CoachBand) {
  const { Box, Button } = ui
  return (
    <Box flexDirection="row" justifyContent="space-between" gap={1}>
      <Box flexDirection="row" flexWrap="wrap" gap={1} flexShrink={1}>
        {band.chips.map((chip, i) => (
          <Button key={`chip-${i}`} label={chip.label} onPress={() => void fillFromCoach($, chip.fill)} />
        ))}
      </Box>
      {dismissButton(ui, $)}
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
        {check.checks.map((text, i) =>
          // Open checks are plain buttons; a ticked one turns into a drawn tick and dim text, still pressable.
          check.ticked.includes(i) ? (
            <Box key={`own-done-${i}`} flexDirection="row" gap={1} alignItems="center">
              {checkMark(ui)}
              <Button key={`own-${i}`} plain dimColor label={text} onPress={() => void tickOwn($, i)} />
            </Box>
          ) : (
            <Button key={`own-${i}`} label={text} onPress={() => void tickOwn($, i)} />
          ),
        )}
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
        {st.hiddenBand && !st.band && <Button key="menu-restore" label="Show suggestions" onPress={() => void restoreBand($)} />}
        <Text dimColor>{menuCost(st.cost.usd, st.usage.convUsd)}</Text>
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
  const { Box, Button, Text } = ui
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
  // Suggestions on top, a rule, then the status group: the Focus row sits right above the rail it changes.
  return (
    <Box flexDirection="column">
      {content}
      {st.menuOpen && fold(ui, $, st)}
      {content === null && !st.menuOpen && st.prefs.hintTaps === 0 && st.prefs.sessions <= 3 && (
        <Text dimColor>The coach follows your loop with Claude. Press Coach to focus on a step.</Text>
      )}
      <Box flexDirection="row" gap={1}>
        {rail(ui, { station: st.station, focus: st.focus, reason: st.stationReason, moveNote: st.moveNote, pulse: st.pulse })}
        <Button key="menu" plain label="Coach" onPress={() => void toggleMenu($)} />
      </Box>
    </Box>
  )
}
