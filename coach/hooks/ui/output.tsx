import type { Dollar } from '../actions'
import { TRACE_TITLE } from '../trace'
import { withSurface } from './glyph'

const COLS = [4, 8, 4]

// The engine hands the row its text as "<plugin>: <text>"; the coach draws its own name once.
export const stripPrefix = (text: string) => text.replace(/^coach:\s*/i, '')

// `/coach …` answers drawn like a chapter line: "Coach" then the answer, dim; /coach why as a small table.
export async function renderCommandOutput($: Dollar, e: Parameters<Dollar['ui']['resolve']>[0], text: string) {
  const ui = withSurface($.ui.resolve(e), (e as { surface: string }).surface)
  const { Box, Text } = ui
  const lines = stripPrefix(text).split('\n')
  const isTable = lines[0] === TRACE_TITLE
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text>Coach</Text>
        <Text dimColor>· {lines[0]}</Text>
      </Box>
      {lines.slice(1).map(line => {
        if (!isTable) return <Text dimColor>{line}</Text>
        const cells = line.split(' | ')
        return (
          <Box flexDirection="row" gap={1}>
            {cells.slice(0, 3).map((c, i) => (
              <Box width={COLS[i]} flexShrink={0}>
                <Text dimColor={i !== 1}>{c}</Text>
              </Box>
            ))}
            <Box flexShrink={1}>
              <Text dimColor>{cells.slice(3).join(' | ')}</Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
