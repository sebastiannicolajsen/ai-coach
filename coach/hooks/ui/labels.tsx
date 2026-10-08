import type { CoachStation, CoachState, CoachUserNote } from '../../types'
import { type Dollar, heads } from '../actions'
import { labelMode } from '../fade'
import { noteKey } from '../notes'
import { STATION_NAME } from '../config'
import { type Ui, fillRule, glyph, mark, wordColor } from './glyph'

export { noteKey }

type Row = { requestId: string; text: string }

const CHAPTER_CAPTION: Record<CoachStation, string> = {
  plan: 'asking for a plan',
  brief: 'a new instruction',
  review: "checking Claude's result",
  own: 'about to ship',
}


// The person's move for this row: found by the prompt's text, the row's id, or (newest row) this turn.
export function userNoteFor(st: CoachState, row: Row, isNewest: boolean): CoachUserNote | undefined {
  const all = st.rowNotes.user
  return all[noteKey(row.text)] ?? all[row.requestId] ?? (isNewest ? Object.values(all).find(n => n.turn === st.turnIndex) : undefined)
}

export const chapterCaption = (n: CoachUserNote | undefined): string => {
  if (!n) return CHAPTER_CAPTION.brief
  if (n.from) return `moved on from ${STATION_NAME[n.from]}`
  if (n.caption) return n.caption
  if (n.outer) return n.outer.split(' · ').slice(1).join(' · ') || n.outer
  return CHAPTER_CAPTION[n.move]
}

// A chapter line opens each exchange: glyph, the move in its colour, a dim caption that never wraps, the ✓ note
// when there is one, then a rule across the rest of the row.
// One line above the person's message: the move in its colour, a caption, and a rule across the rest.
// Under the person's message, right-aligned: ✓ a move worth repeating, ◐ what it could still say. It is
// placed over the empty space the engine leaves under the bubble (absolute, bottom right), so it sits right
// under the message and takes no room of its own.
function feedbackRow(ui: Ui, key: string, n: CoachUserNote | undefined, isShown: boolean) {
  const { Box, Text } = ui
  const feedback = n?.note ? { kind: 'good' as const, text: n.note } : n?.gap ? { kind: 'comment' as const, text: `Could add: ${n.gap}` } : null
  if (!feedback) return null
  const reveal = isShown ? {} : { display: 'none' as const, hover: { scope: key, display: 'flex' as const } }
  return (
    <Box position="absolute" bottom={0} right={0} flexDirection="row" gap={1} alignItems="center" {...reveal}>
      {mark(ui, feedback.kind)}
      <Text dimColor>{feedback.text}</Text>
    </Box>
  )
}

function chapterLine(ui: Ui, n: CoachUserNote | undefined) {
  const { Box, Text } = ui
  const move = n?.move ?? 'brief'
  return (
    <Box flexDirection="row" gap={1} marginTop={1} alignItems="center">
      {glyph(ui, move, { mini: true })}
      <Box flexShrink={0}>
        <Text color={wordColor(ui, move)}>{STATION_NAME[move]}</Text>
      </Box>
      <Box flexShrink={0}>
        <Text dimColor wrap="truncate">· {chapterCaption(n)}</Text>
      </Box>
      {fillRule(ui)}
    </Box>
  )
}

// Render hooks never write, so the first unseen row of a turn is recorded from a timer.
async function isNewest($: Dollar, id: string, kind: 'user' | 'reply', matches: boolean) {
  const st = await $.get()
  const turnKey = kind === 'user' ? 'userTurn' : 'replyTurn'
  const isKnown = st.rows[kind] === id
  // With a known newest text, the text decides; recording by id is only the fallback when there is none.
  const hasReference = (kind === 'user' ? st.lastPrompt : st.lastAnswer) !== ''
  const isNew = !isKnown && !hasReference && st.rows[turnKey] < st.turnIndex
  if (isNew) {
    $.clock.after(0, () => {
      void $.patch('rows', r => (r[turnKey] < st.turnIndex ? { ...r, [kind]: id, [turnKey]: st.turnIndex } : r))
    })
  }
  return isKnown || isNew || matches
}

// The chapter line sits above the engine's row as a sibling; no width on anything that holds the row.
export async function userLabel($: Dollar, ui: Ui, e: Row, inner: unknown) {
  const { Box } = ui
  const st = await $.get()
  const matches = heads(e.text) === heads(st.lastPrompt) || st.fresh.includes(heads(e.text))
  const isFresh = await isNewest($, e.requestId, 'user', matches)
  const n = userNoteFor(st, e, isFresh)
  const key = `row-${e.requestId}`
  const isShown = labelMode(st.prefs.sessions) === 'all' || isFresh
  return (
    <Box key={key} hover={{ scope: key }} flexDirection="column">
      {chapterLine(ui, n)}
      {inner as never}
      {feedbackRow(ui, key, n, isShown)}
    </Box>
  )
}

// A reply is never a step: only what is worth checking in it, dim, when the analysis found something.
export async function assistantLabel($: Dollar, ui: Ui, e: Row, inner: unknown) {
  const { Box, Text } = ui
  const st = await $.get()
  const head = heads(e.text)
  const matches = head !== '' && (st.lastAnswer.includes(head) || st.fresh.includes(head))
  const isFresh = await isNewest($, e.requestId, 'reply', matches)
  const check = isFresh && st.rowNotes.reply?.turn === st.turnIndex ? st.rowNotes.reply.check : []
  if (check.length === 0) return inner as never
  return (
    <Box key={`row-${e.requestId}`} flexDirection="column">
      {inner as never}
      <Text dimColor>Worth checking: {check.join(' · ')}</Text>
    </Box>
  )
}
