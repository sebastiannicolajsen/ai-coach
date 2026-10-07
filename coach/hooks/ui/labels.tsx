import type { CoachStation } from '../../types'
import { type Dollar, heads } from '../actions'
import { STATION_NAME } from '../config'
import { labelMode } from '../fade'
import { noteKey } from '../notes'
import { type Ui, glyph } from './glyph'


export { noteKey }

type Row = { requestId: string; text: string }

function label(ui: Ui, station: CoachStation, note: string | undefined, isAbout: boolean) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row" gap={1}>
      {glyph(ui, station, { mini: true })}
      <Text dimColor>{STATION_NAME[station]}</Text>
      {note && <Text dimColor>✓ {note}</Text>}
      {isAbout && <Text dimColor>· note below</Text>}
    </Box>
  )
}

// Labels show on every row in sessions 1-3; later only on the latest exchange, the rest on hover.
// Render hooks never write state, so freshness is matched by text against what prompt.submit and turn.complete recorded.
function wrap(ui: Ui, id: string, isShown: boolean, inner: unknown, tag: unknown, align: 'flex-start' | 'flex-end', isBefore: boolean) {
  const { Box } = ui
  const key = `row-${id}`
  const tagBox = isShown ? (
    <Box justifyContent={align} width="100%">
      {tag as never}
    </Box>
  ) : (
    <Box justifyContent={align} width="100%" display="none" hover={{ scope: key, display: 'flex' }}>
      {tag as never}
    </Box>
  )
  return (
    // No width here: the engine refuses its own message node under a Box that sets one.
    // A column stretches its children, so the label row still spans the full width.
    <Box key={key} hover={{ scope: key }} flexDirection="column" alignItems="stretch">
      {isBefore && tagBox}
      {inner as never}
      {!isBefore && tagBox}
    </Box>
  )
}

export async function userLabel($: Dollar, ui: Ui, e: Row, inner: unknown) {
  const st = await $.get()
  const matches = heads(e.text) === heads(st.lastPrompt) || st.fresh.includes(heads(e.text))
  const isFresh = matches
  const latest = isFresh && st.latestNote?.turn === st.turnIndex ? st.latestNote.text : undefined
  const note = st.notes[noteKey(e.text)] ?? latest
  const isAbout = st.band !== null && st.bandRow === 'user' && isFresh
  const isShown = labelMode(st.prefs.sessions) === 'all' || isFresh || isAbout
  return wrap(ui, e.requestId, isShown, inner, label(ui, 'brief', note, isAbout), 'flex-end', false)
}

export async function assistantLabel($: Dollar, ui: Ui, e: Row, inner: unknown) {
  const st = await $.get()
  const head = heads(e.text)
  const matches = head !== '' && (st.lastAnswer.includes(head) || st.fresh.includes(head))
  const isFresh = matches
  const isOwn = isFresh && st.ownCheck !== null
  const isAbout = st.band !== null && st.bandRow === 'reply' && isFresh
  const isShown = labelMode(st.prefs.sessions) === 'all' || isFresh || isAbout
  return wrap(ui, e.requestId, isShown, inner, label(ui, isOwn ? 'own' : 'review', undefined, isAbout), 'flex-start', true)
}
