import type { ElementTable } from 'claude-code'
import type { CoachCadence, CoachModel, CoachPausePushes } from '../../types'
import { type Dollar, saveSettings, savePrefs } from '../actions'
import { aboutLine } from '../card'
import { ATTRIBUTION, COACH_MODELS, STARTER_CHIPS, STATIONS, STATION_MEANING, STATION_NAME } from '../config'
import { costLine } from '../cost'
import { askMeta } from '../meta'
import { type Ui, glyph, withSurface, wordColor } from './glyph'

type Table = ElementTable<'terminal' | 'desktop' | 'vscode'>

const MODEL_OPTIONS: [CoachModel, string][] = (Object.keys(COACH_MODELS) as CoachModel[]).map(k => [k, COACH_MODELS[k].label])

const CADENCE: [CoachCadence, string][] = [
  ['every', 'Every turn'],
  ['third', 'Every 3rd turn'],
  ['focus', 'On focus only'],
]
const ONOFF: [string, string][] = [
  ['off', 'Off'],
  ['on', 'On'],
]

const ONOFF_ON: [string, string][] = [
  ['on', 'On'],
  ['off', 'Off'],
]

const section = (ui: Ui, text: string) => <ui.Text dimColor>{text.toUpperCase()}</ui.Text>

// The four steps: mini glyph with that step's bar coloured, the name, a short meaning.
function steps(ui: Ui, current: string) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column">
      {STATIONS.map(s => (
        <Box flexDirection="row" gap={1}>
          {glyph(ui, s, { mini: true })}
          <Text color={s === current ? wordColor(ui, s) : undefined}>{STATION_NAME[s]}</Text>
          <Box flexShrink={1}>
            <Text dimColor wrap="truncate">
              {STATION_MEANING[s]}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// A row with the label left and a Select right; surfaces without Select get a button that cycles.
function settingRow(ui: Table & Ui, key: string, label: string, value: string, options: [string, string][], onPick: (v: string) => void) {
  const { Box, Text, Button } = ui
  // Mobile's table holds a stand-in for Select and Input, so go by the surface.
  const Select = ui.surface === 'mobile' ? undefined : (ui as unknown as { Select?: Table['Select'] }).Select
  const shown = options.find(([v]) => v === value)?.[1] ?? options[0]![1]
  const next = () => options[(options.findIndex(([v]) => v === value) + 1) % options.length]![0]
  return (
    <Box flexDirection="row" justifyContent="space-between" gap={1}>
      <Text>{label}</Text>
      {Select ? (
        <Select
          key={key}
          options={options.map(([v, l]) => ({ value: v, label: l }))}
          value={value}
          onSelect={v => onPick(v)}
        />
      ) : (
        <Button key={key} label={shown} onPress={() => onPick(next())} />
      )}
    </Box>
  )
}

async function settingsView(ui: Table & Ui, $: Dollar) {
  const { Box, Button } = ui
  const prefs = (await $.get()).prefs
  const s = prefs.settings
  return (
    <Box flexDirection="column" gap={1}>
      {section(ui, 'Settings')}
      {settingRow(ui, 'set-model', 'Feedback model', s.model, MODEL_OPTIONS, v => void saveSettings($, { model: v as CoachModel }))}
      {settingRow(ui, 'set-cadence', 'Coach checks', s.cadence, CADENCE, v => void saveSettings($, { cadence: v as CoachCadence }))}
      {settingRow(ui, 'set-pause', 'Pause pushes for a check', s.pausePushes === 'on' ? 'on' : 'off', ONOFF, v => void saveSettings($, { pausePushes: v as CoachPausePushes }))}
      {settingRow(ui, 'set-labels', 'Labels in the chat', s.labels ? 'on' : 'off', [['on', 'On'], ['off', 'Off']], v => void saveSettings($, { labels: v === 'on' }))}
      {settingRow(ui, 'set-quiet', 'Start quietly', s.preview ? 'off' : 'on', ONOFF_ON, v => void saveSettings($, { preview: v === 'off' }))}
      {prefs.silenced.length > 0 && (
        <Button
          key="set-unsilence"
          plain
          label={`Raise silenced findings again (${prefs.silenced.length})`}
          onPress={() => void savePrefs($, p => ({ ...p, silenced: [], dismissals: {} }))}
        />
      )}
    </Box>
  )
}

async function chatView(ui: Table & Ui, $: Dollar) {
  const { Box, Text, Button, Markdown } = ui
  const st = await $.get()
  const hasInput = ui.surface !== 'mobile'
  return (
    <Box flexDirection="column" gap={1}>
      {section(ui, 'Stuck?')}
      {st.meta.length === 0 && (
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {STARTER_CHIPS.map((text, i) => (
            <Button key={`starter-${i}`} label={text} onPress={() => void askMeta($, text)} />
          ))}
        </Box>
      )}
      {st.meta.map((m, i) => (
        <Box flexDirection="column">
          <Text dimColor>{m.role === 'user' ? 'You' : 'Coach'}</Text>
          <Markdown key={`msg-${i}`} text={m.text} />
        </Box>
      ))}
      {st.metaBusy && <Text dimColor>…</Text>}
      {hasInput && inputView(ui, $)}
    </Box>
  )
}

function inputView(ui: Table, $: Dollar) {
  const Input = (ui as unknown as { Input: Table['Input'] }).Input
  return <Input key="ask" placeholder="Ask about this work" submitLabel="Ask" onSubmit={text => void askMeta($, text)} />
}

export async function renderPane($: Dollar, e: Parameters<Dollar['ui']['resolve']>[0]) {
  const ui = withSurface($.ui.resolve(e), (e as { surface: string }).surface) as unknown as Table & Ui
  const { Box, Text } = ui
  const st = await $.get()
  const about = aboutLine(st.card)
  if (!st.prefs.enabled) {
    return <Text dimColor>Coach is off. Use /coach on to turn it back on.</Text>
  }
  return (
    <Box flexDirection="column" gap={1}>
      {steps(ui, st.focus ?? st.station)}
      {section(ui, 'This conversation')}
      <Text>{about || 'Nothing to go on yet.'}</Text>
      {await chatView(ui, $)}
      {await settingsView(ui, $)}
      <Box flexDirection="column">
        <Text dimColor>{costLine(st.cost.usd, st.usage.convUsd, (COACH_MODELS[st.prefs.settings.model] ?? COACH_MODELS.haiku).label)}</Text>
        <Text dimColor>{ATTRIBUTION}</Text>
      </Box>
    </Box>
  )
}
