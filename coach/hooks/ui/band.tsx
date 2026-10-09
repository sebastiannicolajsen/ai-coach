import type { CoachBand, CoachOwnCheck, CoachState } from '../../types'
import { type Dollar, dismissBand, fillFromCoach, finishOwn, focusStation, openPane, saveSettings, setEnabled, tickOwn, toggleMenu, restoreBand } from '../actions'
import { OWN_CONTINUE, STATIONS, STATION_NAME } from '../config'
import { menuCost } from '../cost'
import { type Ui, checkMark, coachMark, effortBar, glyph, icon, spacer, spinMark, spinner, withSurface } from './glyph'
import { MODEL_SWITCH_LABEL, ROUTE_MODELS } from '../config'
import { differs, familyOf, setEffort, switchTo } from '../route'
import { EFFORTS } from '../parse-route'
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
// The suggestions in the step line's own style: the coach's mark, then each one as plain text behind a small
// arrow into the prompt box, turning clay under the pointer; lifted a few pixels off the step line.
function bandView(ui: Ui, $: Dollar, band: CoachBand) {
  const { Box, Button } = ui
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" flexWrap="wrap" columnGap={3} alignItems="center">
        {coachMark(ui)}
        {band.chips.map((chip, i) => (
          <Box key={`chip-box-${i}`} flexDirection="row" gap={1} alignItems="center" flexShrink={0}>
            {icon(ui, 'fill')}
            <Button
              key={`chip-${i}`}
              plain
              label={chip.label}
              hover={{ scope: `chip-${i}`, color: CLAY }}
              onPress={() => void fillFromCoach($, chip.fill)}
            />
          </Box>
        ))}
      </Box>
      {spacer(ui, 3)}
    </Box>
  )
}

const CLAY = '#D97757'

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

// The coach's mark for a recommendation, wherever one shows: beside the settings and in the picker.
export const REC_MARK = '✦'
// The settings control: the menu mark Claude's own interface uses.
export const SETTINGS_GLYPH = '⋯'

// Beside the settings, like the model and effort at the foot of the prompt box: the recommendation, marked,
// which a press switches to; the model in use, which opens the picker; and the mode, which a press cycles:
// Prompt me → Auto-select → Only show.
function modelControls(ui: Ui, $: Dollar, st: CoachState) {
  const { Box, Button } = ui
  const now = st.modelChoice?.model ?? familyOf(st.sessionModel)
  const effort = st.modelChoice?.effort ?? st.sessionEffort
  const rec = differs(st.route, now, effort) ? st.route : null
  const mode = MODEL_SWITCH_LABEL[st.prefs.settings.modelSwitch] ? st.prefs.settings.modelSwitch : 'ask'
  const isJudging = st.routeBusy || (st.bandLoading && (st.prefs.settings.recommendModel || mode !== 'off'))
  const slot = (button: unknown, bar: unknown) => (
    <Box flexDirection="row" alignItems="center" flexShrink={0}>
      {icon(ui, 'model')}
      {button as never}
      {bar as never}
    </Box>
  )
  return (
    <Box flexDirection="row" gap={1} flexShrink={0} alignItems="center">
      {isJudging && !rec
        ? slot(<Box flexDirection="row" gap={1} alignItems="center">{spinMark(ui)}</Box>, null)
        : rec
          ? slot(
              <Button
                key="model"
                plain
                label={`${ROUTE_MODELS[rec.model].label} · ${rec.reason}`}
                onPress={() => void switchTo($, rec.model, rec.effort).then(() => $.patch('route', () => null))}
              />,
              effortBar(ui, rec.effort, true),
            )
          : slot(
              <Button key="model" plain dimColor label={now ? ROUTE_MODELS[now].label : 'Model'} onPress={() => void $.patch('modelMenuOpen', o => !o)} />,
              effortBar(ui, effort),
            )}
      <Box flexDirection="row" alignItems="center" flexShrink={0}>
        {icon(ui, mode)}
        <Button key="switch-mode" plain dimColor label={MODEL_SWITCH_LABEL[mode]} onPress={() => void saveSettings($, { modelSwitch: NEXT_MODE[mode] })} />
      </Box>
    </Box>
  )
}

// The model picker: the four models, then the five efforts; the ones in use dimmed, the recommended marked.
function modelMenu(ui: Ui, $: Dollar, st: CoachState) {
  const { Box, Text, Button } = ui
  const now = st.modelChoice?.model ?? familyOf(st.sessionModel)
  const effort = st.modelChoice?.effort ?? st.sessionEffort
  const close = () => $.patch('modelMenuOpen', () => false)
  const option = (key: string, label: string, isNow: boolean, isRec: boolean, pick: () => void) => {
    const shown = isRec && !isNow ? `${label} ${REC_MARK}` : label
    return isNow ? <Button key={key} plain dimColor label={shown} onPress={pick} /> : <Button key={key} label={shown} onPress={pick} />
  }
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1} flexWrap="wrap" alignItems="center">
        <Text dimColor>Run Claude on</Text>
        {ROUTE_ORDER.map(m => option(`run-${m}`, ROUTE_MODELS[m].label, m === now, m === st.route?.model, () => void switchTo($, m).then(close)))}
      </Box>
      <Box flexDirection="row" gap={1} flexWrap="wrap" alignItems="center">
        <Text dimColor>Effort</Text>
        {EFFORTS.map(x => option(`effort-${x}`, x, x === effort, x === st.route?.effort, () => void setEffort($, x).then(close)))}
      </Box>
    </Box>
  )
}

const ROUTE_ORDER = ['haiku', 'sonnet', 'opus', 'fable'] as const
const NEXT_MODE = { ask: 'auto', auto: 'off', off: 'ask' } as const

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
        <Button key="menu-settings" plain dimColor label="Settings" onPress={() => void $.patch('settingsOpen', () => true).then(() => openPane($))} />
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
  // While the suggestions are written a spinner holds their place.
  const loading = content === null && st.bandLoading ? spinner(ui, 'Writing suggestions') : null
  // Suggestions on top, then the status group: the Focus row sits right above the rail it changes, and the
  // model row last, nearest the draft it is about.
  return (
    <Box flexDirection="column">
      {content ?? loading}
      {st.menuOpen && fold(ui, $, st)}
      {st.modelMenuOpen && modelMenu(ui, $, st)}
      {content === null && !st.menuOpen && st.prefs.hintTaps === 0 && st.prefs.sessions <= 3 && (
        <Text dimColor>The coach follows your loop with Claude. Press ⋯ to focus on a step.</Text>
      )}
      <Box flexDirection="row" gap={1}>
        {rail(ui, { station: st.station, focus: st.focus, reason: st.stationReason, moveNote: st.moveNote, note: st.stationNote, pulse: st.pulse })}
        {modelControls(ui, $, st)}
        <Button key="menu" plain dimColor label={SETTINGS_GLYPH} onPress={() => void toggleMenu($)} />
      </Box>
    </Box>
  )
}
