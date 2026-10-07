import { type Dollar, complete, openPane, recordUsage } from './actions'
import { cardText } from './card'
import { HAIKU } from './config'
import { SYSTEM_META } from './prompts'

const PROMPT_REQUEST_RE = /\b(write|draft|give|make|show|skriv|lav)\b[^.?!]{0,40}\b(prompt|template)\b/i
const NEEDS_SESSION_RE = /\b(this|above|earlier|last|answer|result|output|my prompt|that)\b/i
const FENCE_RE = /```prompt\s*\n([\s\S]*?)```/

export const countPromptRequests = (userTexts: string[]): number =>
  userTexts.filter(t => PROMPT_REQUEST_RE.test(t)).length

export const extractPrompt = (reply: string): string | null => FENCE_RE.exec(reply)?.[1]?.trim() || null

async function sessionExcerpt($: Dollar): Promise<string> {
  try {
    const rows = (await $.session.messages()).slice(-6)
    return rows.map(r => `${r.role}: ${r.text.slice(0, 600)}`).join('\n')
  } catch {
    return ''
  }
}

export async function openAsk($: Dollar, context = '') {
  await $.patch('metaContext', () => context)
  await openPane($)
}

export async function askMeta($: Dollar, text: string) {
  const question = text.trim()
  if (!question || (await $.get()).metaBusy) return
  await $.patch('meta', m => [...m, { role: 'user' as const, text: question }])
  await $.patch('metaBusy', () => true)
  const thread = (await $.get()).meta
  const asked = countPromptRequests(thread.filter(m => m.role === 'user').map(m => m.text))
  const card = cardText((await $.get()).card)
  const context = (await $.get()).metaContext
  const excerpt = NEEDS_SESSION_RE.test(question) ? await sessionExcerpt($) : ''
  const mode =
    asked >= 2
      ? 'The person has asked twice for a ready prompt. Write it now.'
      : 'Ask one question back before advising.'
  const prompt = [
    card && `What the work is about:\n${card}`,
    context && `The coach band said:\n${context}`,
    excerpt && `Recent messages:\n${excerpt}`,
    `Conversation with the coach:\n${thread.map(m => `${m.role}: ${m.text}`).join('\n')}`,
    mode,
  ]
    .filter(Boolean)
    .join('\n\n')
  const r = await complete($)({
    model: HAIKU.model,
    system: SYSTEM_META,
    prompt,
    maxTokens: HAIKU.maxTokens.meta,
    effort: HAIKU.effort,
    timeoutMs: HAIKU.timeoutMs,
  })
  await recordUsage($, r.usage)
  const reply = r.isAnswered ? r.text.trim() : 'No answer came back. Try again in a moment.'
  const template = r.isAnswered ? extractPrompt(reply) : null
  if (template) await $.prompt.fill({ text: template, mode: 'replace' })
  await $.patch('meta', m => [...m, { role: 'coach' as const, text: reply }])
  await $.patch('metaBusy', () => false)
}
