import { describe, expect, test } from 'claude-code/testing'
import { classifyCommand, onPrompt, onPush, onTurnComplete, showSuggestion, wasAccepted } from '../hooks/flow'
import { dismissBand, fillFromCoach, finishOwn, focusStation, tickOwn } from '../hooks/actions'
import { OWN_CHECKS, OWN_DENY_TEXT, OWN_PASS_TEXT } from '../hooks/config'
import { INITIAL } from '../hooks/initial'
import { makeOwnCheck, ownChecks } from '../hooks/own'
import { noteKey } from '../hooks/notes'
import { blockedBecause } from '../hooks/fade'
import { answered, makeFake } from './fake'

const prefsFor = (sessions: number, over = {}) => ({ ...INITIAL.prefs, sessions, ...over })

const FINDING_A = {
  card: { recipient: 'Mette' },
  flags: [],
  finding: { station: 'review', kind: 'unchecked_claim', evidence: ['18.4%'], confidence: 'high' },
}
const BAND_B = {
  title: 'The 18.4% goes to Mette with no source yet',
  chips: [
    { label: 'Source for 18.4%', fill: 'Where does 18.4% come from?', evidence: '18.4%' },
    { label: 'SMB as driver', fill: 'What shows SMB is the driver?', evidence: 'SMB is the driver' },
  ],
}
const ANSWER = 'Churn is 18.4% and SMB is the driver.'

const outers = (f: { state: { rowNotes: { user: Record<string, { outer?: string }> } } }) =>
  Object.values(f.state.rowNotes.user).flatMap(n => (n.outer ? [n.outer] : []))

describe('commands', () => {
  test('git commit, push and deploy are recognised', () => {
    expect(classifyCommand('git commit -m "x"')).toBe('commit')
    expect(classifyCommand('git push origin main')).toBe('push')
    expect(classifyCommand('cd app && git -C app push')).toBe('push')
    expect(classifyCommand('npm run deploy')).toBe('deploy')
    expect(classifyCommand('terraform apply -auto-approve')).toBe('deploy')
    expect(classifyCommand('git status')).toBeNull()
    expect(classifyCommand('ls')).toBeNull()
  })
})

describe('prompt.submit side', () => {
  test('takes the station of the person move, clears focus and band, counts the turn', async () => {
    const f = makeFake({ station: 'review', focus: 'plan', turnIndex: 2, prefs: prefsFor(5) })
    await onPrompt(f.ctx, 'Why is it 18.4%?')
    expect(f.state.station).toBe('review')
    expect(f.state.rowNotes.user[noteKey('Why is it 18.4%?')]?.move).toBe('review')
    expect(f.state.focus).toBeNull()
    expect(f.state.band).toBeNull()
    expect(f.state.turnIndex).toBe(3)
    expect(f.state.lastPrompt).toBe('Why is it 18.4%?')
  })

  test('a question after a Review closes the loop with a pulse that clears', async () => {
    const f = makeFake({ station: 'review', prefs: prefsFor(5) })
    await onPrompt(f.ctx, 'Are you sure about the source?')
    expect(f.state.pulse).toBe(true)
    await f.flush()
    expect(f.state.pulse).toBe(false)
    const g = makeFake({ station: 'brief', prefs: prefsFor(5) })
    await onPrompt(g.ctx, 'Are you sure?')
    expect(g.state.pulse).toBe(false)
  })

  test('call C stores a note under the prompt text and queues a suggestion', async () => {
    const f = makeFake({ prefs: prefsFor(5) })
    f.replies.push(
      answered({
        good: { move: 'questioned_result', evidence: 'Why is it 18.4%' },
        suggestion: { template: 'Churn means [definition]', evidence: 'Why is it 18.4%', kind: 'missing_done' },
      }),
    )
    await onPrompt(f.ctx, 'Why is it 18.4%?')
    await f.flush()
    expect(f.state.rowNotes.user[noteKey('Why is it 18.4%?')]?.note).toBe('Questioned the result')
    expect(f.state.pendingSuggest?.template).toBe('Churn means [definition]')
    expect(f.state.cost.tokens).toBeGreaterThan(0)
  })

  test('a faded behaviour no longer gets its note', async () => {
    const fade = { unchecked_claim: [true, true, false, true] }
    const f = makeFake({ prefs: prefsFor(5, { fade }) })
    f.replies.push(answered({ good: { text: 'Questioned the result', evidence: 'Why is it', kind: 'unchecked_claim' } }))
    await onPrompt(f.ctx, 'Why is it 18.4%?')
    await f.flush()
    expect(f.state.rowNotes.user[noteKey('Why is it 18.4%?')]?.note).toBeUndefined()
  })

  test('session 1 and focus-only cadence make no call C', async () => {
    const one = makeFake({ prefs: prefsFor(1) })
    await onPrompt(one.ctx, 'Hello there')
    await one.flush()
    expect(one.requests).toHaveLength(0)
    const focusOnly = makeFake({ prefs: prefsFor(5, { settings: { ...INITIAL.prefs.settings, cadence: 'focus' } }) })
    await onPrompt(focusOnly.ctx, 'Hello there')
    await focusOnly.flush()
    expect(focusOnly.requests).toHaveLength(0)
  })

  test('an ignored suggestion counts; the second silences the kind for the session', async () => {
    const f = makeFake({ prefs: prefsFor(1), shownSuggest: { template: 'Churn means ___', kind: 'missing_done' } })
    await onPrompt(f.ctx, 'something else')
    expect(f.state.ignoredGaps.missing_done).toBe(1)
    f.state = { ...f.state, shownSuggest: { template: 'Churn means ___', kind: 'missing_done' } }
    await onPrompt(f.ctx, 'again something else')
    expect(f.state.silencedSession).toEqual(['missing_done'])
    f.state = { ...f.state, shownSuggest: { template: 'Churn means ___', kind: 'missing_done' } }
    await onPrompt(f.ctx, 'Churn means contract end')
    expect(f.state.ignoredGaps.missing_done).toBe(2)
    expect(wasAccepted({ template: 'Churn means ___', kind: 'k' }, 'Churn means contract end')).toBe(true)
  })
})

describe('turn.complete side', () => {
  const setup = (sessions: number, over = {}) =>
    makeFake({ station: 'brief', turnIndex: 6, lastPrompt: 'Send the churn numbers to Mette', prefs: prefsFor(sessions), ...over })

  test('moves to Review and raises a validated band after the analysis', async () => {
    const f = setup(5)
    f.replies.push(answered(FINDING_A), answered(BAND_B))
    await onTurnComplete(f.ctx, ANSWER, true)
    expect(f.state.station).toBe('review')
    expect(f.state.band).toBeNull()
    await f.flush()
    expect(f.state.band?.chips).toHaveLength(2)
    expect(f.state.band?.kind).toBe('unchecked_claim')
    expect(f.state.card.recipient).toBe('Mette')
    expect(f.state.lastBandTurn).toBe(6)
    expect(f.state.prefs.fade.unchecked_claim).toEqual([false])
  })

  test('session 1 is silent: the card updates but no band appears', async () => {
    const f = setup(1)
    f.replies.push(answered(FINDING_A), answered(BAND_B))
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    expect(f.state.band).toBeNull()
    expect(f.state.card.recipient).toBe('Mette')
    expect(f.requests).toHaveLength(1)
  })

  test('sessions 2 and 3 allow one band per 5 turns', async () => {
    const f = setup(2, { lastBandTurn: 4 })
    f.replies.push(answered(FINDING_A), answered(BAND_B))
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    expect(f.state.band).toBeNull()
  })

  test('two dismissals in a session silence the kind; five in total silence it for good', async () => {
    const f = setup(5)
    for (let i = 0; i < 2; i++) {
      f.replies.push(answered(FINDING_A), answered(BAND_B))
      f.state = { ...f.state, turnIndex: 7 + i }
      await onTurnComplete(f.ctx, ANSWER, true)
      await f.flush()
      expect(f.state.band).not.toBeNull()
      await dismissBand(f.ctx)
      expect(f.state.band).toBeNull()
    }
    expect(f.state.sessionDismissals.unchecked_claim).toBe(2)
    f.replies.push(answered(FINDING_A), answered(BAND_B))
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    expect(f.state.band).toBeNull()
    expect(f.state.prefs.dismissals.unchecked_claim).toBe(2)
  })

  test('a band for a turn the person has moved past is dropped', async () => {
    const f = setup(5)
    f.replies.push(answered(FINDING_A), answered(BAND_B))
    await onTurnComplete(f.ctx, ANSWER, true)
    f.state = { ...f.state, turnIndex: 7 }
    await f.flush()
    expect(f.state.band).toBeNull()
  })

  test('flags never move the rail: a verified share_intent only suggests Own, an unverified one nothing', async () => {
    const f = setup(5)
    f.replies.push(
      answered({
        flags: [
          { type: 'share_intent', evidence: 'Send the churn numbers to Mette' },
          { type: 'new_task', evidence: 'Send the churn numbers to Mette' },
        ],
        finding: { station: 'own', kind: 'share_check', evidence: ['Send the churn numbers to Mette'], confidence: 'high' },
      }),
      answered(BAND_B),
    )
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    expect(f.state.station).toBe('review')
    expect(f.state.band?.suggestion?.station).toBe('own')
    expect(outers(f)).toEqual([])

    const g = setup(5)
    g.replies.push(answered({ flags: [{ type: 'new_task', evidence: 'not in the text' }], finding: FINDING_A.finding }), answered(BAND_B))
    await onTurnComplete(g.ctx, ANSWER, true)
    await g.flush()
    expect(g.state.station).toBe('review')
    expect(g.state.band?.suggestion).toBeNull()
    expect(outers(g)).toEqual([])
  })

  test('cadence every 3rd turn and focus-only skip the analysis', async () => {
    const third = setup(5, { turnIndex: 4, prefs: prefsFor(5, { settings: { ...INITIAL.prefs.settings, cadence: 'third' } }) })
    await onTurnComplete(third.ctx, ANSWER, true)
    await third.flush()
    expect(third.requests).toHaveLength(0)
    const off = setup(5, { prefs: prefsFor(5, { settings: { ...INITIAL.prefs.settings, cadence: 'focus' } }) })
    await onTurnComplete(off.ctx, ANSWER, true)
    await off.flush()
    expect(off.requests).toHaveLength(0)
  })

  test('an aborted turn goes to Review without a call', async () => {
    const f = setup(5)
    await onTurnComplete(f.ctx, '', false)
    await f.flush()
    expect(f.state.station).toBe('review')
    expect(f.requests).toHaveLength(0)
  })

  test('a queued suggestion shows only when the box is empty and Own is not active', async () => {
    const pending = { template: 'Churn means ___', kind: 'missing_done' }
    const f = setup(5, { pendingSuggest: pending })
    f.box.text = 'typing'
    await showSuggestion(f.ctx)
    expect(f.suggested).toEqual([])
    f.box.text = ''
    await showSuggestion(f.ctx)
    expect(f.suggested).toEqual(['Churn means ___'])
    expect(f.state.shownSuggest).toEqual(pending)
    expect(f.state.pendingSuggest).toBeNull()
    const own = setup(5, { pendingSuggest: pending, ownCheck: { held: false, ticked: [] } })
    await showSuggestion(own.ctx)
    expect(own.suggested).toEqual([])
  })
})

describe('focus', () => {
  test('on a fresh session it shows static chips at once', async () => {
    const f = makeFake({ prefs: prefsFor(5) })
    await focusStation(f.ctx, 'plan')
    expect(f.state.focus).toBe('plan')
    expect(f.state.band?.source).toBe('fallback')
    expect(f.state.band?.chips.length).toBeGreaterThanOrEqual(2)
    expect(f.requests).toHaveLength(0)
  })

  test('with context it asks for content and shows the validated chips', async () => {
    const f = makeFake({ lastPrompt: 'Send the churn numbers', lastAnswer: ANSWER, station: 'review', prefs: prefsFor(5) })
    f.replies.push(answered({ ...BAND_B }))
    await focusStation(f.ctx, 'review')
    expect(f.state.band?.source).toBe('focus')
    expect(f.state.band?.chips.map(c => c.label)).toEqual(['Source for 18.4%', 'SMB as driver'])
  })

  test('failed content leaves the static chips', async () => {
    const f = makeFake({ lastPrompt: 'x', lastAnswer: ANSWER, prefs: prefsFor(5) })
    await focusStation(f.ctx, 'review')
    expect(f.state.band?.source).toBe('fallback')
    expect(f.state.band?.title).not.toBe('')
  })

  test('focusing a station suggests its template in the prompt box and never fills it', async () => {
    const f = makeFake({ prefs: prefsFor(5) })
    await focusStation(f.ctx, 'brief')
    expect(f.suggested).toEqual(['This is for [audience], who needs it to [decide or do].'])
    expect(f.fills).toEqual([])
    await focusStation(f.ctx, 'plan')
    expect(f.suggested.at(-1)).toBe('The goal is [goal], and what must not change is [limits].')
  })

  test('a chip replaces a coach template and lands after the person\'s own words', async () => {
    const f = makeFake({ prefs: prefsFor(5) })
    await fillFromCoach(f.ctx, 'The goal is ___.', true)
    await fillFromCoach(f.ctx, 'Where does 18.4% come from?')
    expect(f.box.text).toBe('Where does 18.4% come from?')
    f.box.text = 'my own words '
    await fillFromCoach(f.ctx, 'and a chip')
    expect(f.box.text).toBe('my own words and a chip')
  })

  test('the static band shows at once, with a real title, while Haiku is working', async () => {
    const f = makeFake({ lastPrompt: 'x', lastAnswer: ANSWER, prefs: prefsFor(5) })
    f.replies.push(answered({ ...BAND_B }))
    const pending = focusStation(f.ctx, 'review')
    await Promise.resolve()
    await pending
    expect(f.state.band?.source).toBe('focus')
    const g = makeFake({ lastPrompt: 'x', lastAnswer: ANSWER, prefs: prefsFor(5) })
    await focusStation(g.ctx, 'review')
    expect(g.state.band?.title).toContain('claims')
    expect(g.state.band?.chips.length).toBeGreaterThanOrEqual(2)
  })

  test('Own focus runs the checks now', async () => {
    const f = makeFake({ prefs: prefsFor(5) })
    await focusStation(f.ctx, 'own')
    expect(f.state.ownCheck?.held).toBe(false)
    expect(f.state.focus).toBe('own')
  })

  test('the next prompt clears focus and band', async () => {
    const f = makeFake({ prefs: prefsFor(5) })
    await focusStation(f.ctx, 'plan')
    await onPrompt(f.ctx, 'Go ahead')
    expect(f.state.focus).toBeNull()
    expect(f.state.band).toBeNull()
  })
})

describe('Own checks', () => {
  const held = (over = {}) =>
    makeFake({ station: 'review', prefs: prefsFor(5, { settings: { ...INITIAL.prefs.settings, pausePushes: 'on' } }), ...over })
  const off = () => held({ prefs: prefsFor(5, { settings: { ...INITIAL.prefs.settings, pausePushes: 'off' } }) })

  test('a commit moves to Own with a divider and never holds', async () => {
    const f = held()
    expect(await onPush(f.ctx, 'commit', 'git commit -m x')).toBeNull()
    expect(f.state.station).toBe('own')
    expect(f.state.ownCheck?.held).toBe(false)
    expect(f.state.ownCheck?.checks).toHaveLength(3)
    expect(outers(f)).toEqual(['Own · git commit'])
  })

  test('with pausePushes on, the push is denied and the band holds it', async () => {
    const f = held({ card: { ...INITIAL.card, recipient: 'Mette, steering group' } })
    expect(await onPush(f.ctx, 'push', 'git push origin main')).toBe(OWN_DENY_TEXT)
    expect(f.asks).toEqual([])
    expect(f.state.station).toBe('own')
    expect(f.state.ownCheck?.held).toBe(true)
    expect(f.state.ownCheck?.title).toContain('Mette')
    expect(f.state.ownCheck?.source).toEqual(['git push', 'email to Mette'])
    expect(outers(f)).toEqual(['Own · push paused'])
    expect(await onPush(f.ctx, 'push', 'git push')).toBe(OWN_DENY_TEXT)
    expect(outers(f)).toHaveLength(1)
  })

  test('finishing the checks sets a one-time pass and asks Claude to go ahead', async () => {
    const f = held()
    await onPush(f.ctx, 'push', 'git push')
    await tickOwn(f.ctx, 0)
    await tickOwn(f.ctx, 1)
    expect(f.submitted).toEqual([])
    await tickOwn(f.ctx, 2)
    expect(f.submitted).toEqual([OWN_PASS_TEXT])
    expect(f.state.ownCheck).toBeNull()
    expect(f.state.station).toBe('review')
    expect(f.state.pushPass).toBe(true)
    expect(await onPush(f.ctx, 'push', 'git push')).toBeNull()
    expect(f.state.pushPass).toBe(false)
    expect(await onPush(f.ctx, 'push', 'git push')).toBe(OWN_DENY_TEXT)
  })

  test('Continue anyway gives the same pass', async () => {
    const f = held()
    await onPush(f.ctx, 'deploy', 'npm run deploy')
    await finishOwn(f.ctx)
    expect(f.submitted).toEqual([OWN_PASS_TEXT])
    expect(f.state.pushPass).toBe(true)
  })

  test('dismissing the band ends the check without a pass or a prompt', async () => {
    const f = held()
    await onPush(f.ctx, 'push', 'git push')
    await dismissBand(f.ctx)
    expect(f.state.ownCheck).toBeNull()
    expect(f.state.pushPass).toBe(false)
    expect(f.submitted).toEqual([])
    expect(f.state.station).toBe('review')
  })

  test('with pausePushes off the push runs and the band carries the checks, no prompt on finish', async () => {
    const f = off()
    expect(await onPush(f.ctx, 'push', 'git push')).toBeNull()
    expect(f.state.ownCheck?.held).toBe(false)
    expect(outers(f)).toEqual(['Own · git push'])
    await finishOwn(f.ctx)
    expect(f.submitted).toEqual([])
    expect(f.state.pushPass).toBe(false)
  })

  test('the first push asks about pausing once and stores the answer', async () => {
    const f = makeFake({ station: 'review', prefs: prefsFor(5) })
    f.askAnswer.value = 'Pause pushes'
    expect(await onPush(f.ctx, 'push', 'git push')).toBe(OWN_DENY_TEXT)
    expect(f.state.prefs.settings.pausePushes).toBe('on')
    expect(f.asks).toHaveLength(1)
    expect(f.store.get('settings')).toMatchObject({ pausePushes: 'on' })
    await onPush(f.ctx, 'push', 'git push')
    expect(f.asks).toHaveLength(1)
  })

  test('headless sessions are never held', async () => {
    const f = held()
    ;(f.ctx.session as { surface: () => Promise<null> }).surface = async () => null
    expect(await onPush(f.ctx, 'push', 'git push')).toBeNull()
  })

  test('the third check comes from the card, else falls back', () => {
    const card = { ...INITIAL.card, claude_assumptions: ['312 trial accounts excluded'] }
    expect(ownChecks(card)[2]).toBe('312 trial accounts excluded explained')
    expect(ownChecks(INITIAL.card)).toEqual(OWN_CHECKS)
  })

  test('ticking toggles; all ticked ends Own', async () => {
    const f = makeFake({ station: 'own', ownCheck: makeOwnCheck(INITIAL.card, '', false), prefs: prefsFor(5) })
    await tickOwn(f.ctx, 0)
    await tickOwn(f.ctx, 0)
    expect(f.state.ownCheck?.ticked).toEqual([])
    await tickOwn(f.ctx, 0)
    await tickOwn(f.ctx, 1)
    expect(f.state.station).toBe('own')
    await tickOwn(f.ctx, 2)
    expect(f.state.ownCheck).toBeNull()
    expect(f.state.station).toBe('review')
  })

  test('only one divider per turn', async () => {
    const f = off()
    await onPush(f.ctx, 'commit', 'git commit')
    f.state = { ...f.state, station: 'review', ownCheck: null }
    await onPush(f.ctx, 'push', 'git push')
    expect(outers(f)).toHaveLength(1)
  })
})

describe('preview and rule notes', () => {
  test('the note key survives spacing and case', () => {
    expect(noteKey('  Why   is it\n18.4%? ')).toBe(noteKey('why is it 18.4%?'))
  })

  test('a rule note shows without any model call (session 2)', async () => {
    const f = makeFake({ station: 'review', prefs: prefsFor(2, { settings: { ...INITIAL.prefs.settings, cadence: 'focus' } }) })
    await onPrompt(f.ctx, 'Use contract end instead. Go.')
    expect(f.state.rowNotes.user[noteKey('Use contract end instead. Go.')]?.note).toBe('Corrected Claude')
    expect(f.state.rowNotes.user[noteKey('Use contract end instead. Go.')]?.move).toBe('review')
    expect(f.state.station).toBe('review')
    expect(f.state.moveNote).toBe('questioned the result')
    expect(f.requests).toHaveLength(0)
  })

  test('the note is also stored under the row id once the row is known', async () => {
    const f = makeFake({ station: 'review', rows: { user: 'row-1', reply: '', userTurn: 1, replyTurn: 0 }, turnIndex: 0, prefs: prefsFor(2) })
    await onPrompt(f.ctx, 'Are you sure about the base?')
    expect(f.state.rowNotes.user['row-1']?.note).toBe('Questioned the result')
  })

  test('preview bypasses silence, spacing, fade and dismissals', () => {
    const preview = { ...INITIAL.prefs.settings, preview: true }
    const gate = (sessions: number, over = {}) => ({
      prefs: prefsFor(sessions, { settings: preview, fade: { k: [true, true, true] }, silenced: ['k'] }),
      kind: 'k',
      sessionDismissals: { k: 5 },
      silencedSession: ['k'],
      turnIndex: 2,
      lastBandTurn: 1,
      ...over,
    })
    expect(blockedBecause(gate(1))).toBeNull()
    expect(blockedBecause({ ...gate(1), prefs: prefsFor(1, { silenced: ['k'] }) })).toBe('session-1')
  })

  test('in preview, session 1 runs call C, raises a finding and shows the suggestion', async () => {
    const f = makeFake({ station: 'brief', turnIndex: 1, lastPrompt: 'Send the churn numbers to Mette', prefs: prefsFor(1, { settings: { ...INITIAL.prefs.settings, preview: true } }) })
    f.replies.push(
      answered({ good: { move: 'audience_named', evidence: 'to Mette' }, suggestion: { template: 'Churn means [definition]', evidence: 'churn numbers', kind: 'missing_done' } }),
    )
    await onPrompt(f.ctx, 'Send the churn numbers to Mette')
    await f.flush()
    expect(f.state.rowNotes.user[noteKey('Send the churn numbers to Mette')]?.note).toBe('Audience is named')
    expect(f.state.pendingSuggest?.template).toBe('Churn means [definition]')
    f.state = { ...f.state, turnIndex: 6 }
    f.replies.push(answered(FINDING_A), answered(BAND_B))
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    expect(f.state.band?.kind).toBe('unchecked_claim')
    expect(f.suggested).toEqual(['Churn means [definition]'])
  })

  test('a Review band is tied to the latest reply', async () => {
    const f = makeFake({ station: 'brief', turnIndex: 6, rows: { user: 'u1', reply: 'r1', userTurn: 6, replyTurn: 6 }, lastPrompt: 'Send the churn numbers to Mette', prefs: prefsFor(5) })
    f.replies.push(answered(FINDING_A), answered(BAND_B))
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    expect(f.state.bandRow).toBe('reply')
    await dismissBand(f.ctx)
    expect(f.state.bandRow).toBe('')
  })
})

describe('moves, trace and reply notes', () => {
  const PROMPT = 'Write the summary'

  test('a plan or Own move steps out and names itself on the user row', async () => {
    const f = makeFake({ station: 'review', prefs: prefsFor(2, { settings: { ...INITIAL.prefs.settings, cadence: 'focus' } }) })
    await onPrompt(f.ctx, 'Make a plan for the migration.')
    expect(f.state.station).toBe('plan')
    expect(f.state.moveNote).toBe('asked for a plan')
    expect(outers(f)).toEqual(['Plan · asked for a plan'])
    const g = makeFake({ station: 'review', prefs: prefsFor(2) })
    await onPrompt(g.ctx, 'Push it and draft the email to Mette.')
    expect(g.state.station).toBe('own')
    expect(outers(g)).toEqual(['Own · about to ship'])
    await onTurnComplete(g.ctx, 'Done.', true)
    expect(g.state.station).toBe('review')
    expect(g.state.moveNote).toBe('')
  })

  test('Haiku overrides the rule only with evidence, while the turn runs', async () => {
    const f = makeFake({ station: 'review', prefs: prefsFor(2) })
    f.replies.push(answered({ move: { kind: 'review', evidence: 'Write the summary' } }))
    await onPrompt(f.ctx, PROMPT)
    expect(f.state.station).toBe('brief')
    await f.flush()
    expect(f.state.station).toBe('review')
    expect(f.state.rowNotes.user[noteKey(PROMPT)]?.move).toBe('review')
    const g = makeFake({ station: 'review', prefs: prefsFor(2) })
    g.replies.push(answered({ move: { kind: 'review', evidence: 'words that are not there at all' } }))
    await onPrompt(g.ctx, PROMPT)
    await g.flush()
    expect(g.state.station).toBe('brief')
  })

  test('the trace records the calls and why a finding did not show (session 1)', async () => {
    const f = makeFake({ station: 'brief', turnIndex: 6, lastPrompt: 'Send the churn numbers to Mette', prefs: prefsFor(1) })
    f.replies.push(answered(FINDING_A))
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    const lines = f.state.trace.map(t => `${t.call}:${t.ok}:${t.detail}`)
    expect(lines[0]).toContain('A:true:ok · finding unchecked_claim (high) → kept')
    expect(lines[1]).toContain('gate:false:unchecked_claim not raised: session-1')
  })

  test('the trace says why a model finding was dropped and how many chips survived', async () => {
    const f = makeFake({ station: 'brief', turnIndex: 6, lastPrompt: 'Send the churn numbers to Mette', prefs: prefsFor(5) })
    f.replies.push(
      answered({ finding: { station: 'review', kind: 'unchecked_claim', evidence: ['18.4%'], confidence: 'low' } }),
    )
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    expect(f.state.trace[0]?.detail).toContain('→ confidence low')
    const g = makeFake({ station: 'brief', turnIndex: 6, lastPrompt: 'Send the churn numbers to Mette', prefs: prefsFor(5) })
    g.replies.push(answered(FINDING_A), answered({ title: 'T', chips: [{ label: 'Be more specific', fill: 'x', evidence: '18.4%' }, { label: 'Source for 18.4%', fill: 'y', evidence: '18.4%' }] }))
    await onTurnComplete(g.ctx, ANSWER, true)
    await g.flush()
    expect(g.state.trace[1]?.detail).toContain('chips 1/2 kept (dropped: generic)')
    // Call B kept one of two chips, so the finding falls back to the station's own band with the quote.
    expect(g.state.band?.source).toBe('finding')
    expect(g.state.band?.kind).toBe('unchecked_claim')
    expect(g.state.band?.evidence).toEqual(['18.4%'])
  })

  test('in preview a low finding with one chip still shows a band', async () => {
    const settings = { ...INITIAL.prefs.settings, preview: true }
    const f = makeFake({ station: 'brief', turnIndex: 6, lastPrompt: 'Send the churn numbers to Mette', prefs: prefsFor(1, { settings }) })
    f.replies.push(
      answered({ finding: { station: 'review', kind: 'unchecked_claim', evidence: ['18.4%'], confidence: 'low' } }),
      answered({ title: 'The 18.4% has no source yet', chips: [{ label: 'Source for 18.4%', fill: 'Where from?', evidence: '18.4%' }] }),
    )
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    expect(f.state.band?.chips).toHaveLength(2)
  })

  test('the reply carries up to two verbatim claims, each cut to 24 characters', async () => {
    const f = makeFake({ station: 'brief', turnIndex: 4, lastPrompt: PROMPT, prefs: prefsFor(5) })
    f.replies.push(
      answered({ card: { unchecked_claims: ['18.4%', 'SMB is the driver', 'a claim nobody wrote anywhere'] } }),
    )
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    expect(f.state.rowNotes.reply).toEqual({ turn: 4, check: ['18.4%', 'SMB is the driver'] })
    const g = makeFake({ station: 'brief', turnIndex: 4, lastPrompt: PROMPT, prefs: prefsFor(5) })
    g.replies.push(answered({ card: { unchecked_claims: ['Churn is 18.4% and SMB is the driver'] } }))
    await onTurnComplete(g.ctx, ANSWER, true)
    await g.flush()
    expect(g.state.rowNotes.reply?.check[0]?.length).toBeLessThanOrEqual(24)
  })

  test('a suggestion waits once for an empty box, then shows', async () => {
    const f = makeFake({ pendingSuggest: { template: 'Churn means ___', kind: 'missing_done' }, prefs: prefsFor(5) })
    f.box.text = 'typing'
    await showSuggestion(f.ctx)
    expect(f.suggested).toEqual([])
    expect(f.state.trace[0]?.detail).toContain('retrying once')
    f.box.text = ''
    await f.flush()
    expect(f.suggested).toEqual(['Churn means ___'])
    expect(f.state.trace.some(t => t.call === 'suggest' && t.ok)).toBe(true)
  })
})

describe('moved on and fallback band', () => {
  test('leaving Review for another move is remembered on the user row', async () => {
    const f = makeFake({ station: 'review', prefs: prefsFor(2, { settings: { ...INITIAL.prefs.settings, cadence: 'focus' } }) })
    await onPrompt(f.ctx, 'Now do the same for Q2.')
    expect(f.state.rowNotes.user[noteKey('Now do the same for Q2.')]).toMatchObject({ move: 'brief', from: 'review' })
    const g = makeFake({ station: 'review', prefs: prefsFor(2, { settings: { ...INITIAL.prefs.settings, cadence: 'focus' } }) })
    await onPrompt(g.ctx, 'Why did you exclude the trial accounts?')
    expect(g.state.rowNotes.user[noteKey('Why did you exclude the trial accounts?')]?.from).toBeUndefined()
    const h = makeFake({ station: 'brief', prefs: prefsFor(2, { settings: { ...INITIAL.prefs.settings, cadence: 'focus' } }) })
    await onPrompt(h.ctx, 'Now do the same for Q2.')
    expect(h.state.rowNotes.user[noteKey('Now do the same for Q2.')]?.from).toBeUndefined()
  })

  test('when call B is not JSON but call A kept a finding, the station band shows with the finding', async () => {
    const f = makeFake({ station: 'brief', turnIndex: 6, lastPrompt: 'Send the churn numbers to Mette', prefs: prefsFor(5) })
    f.replies.push(answered(FINDING_A), answered('this is not json at all'))
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    expect(f.state.band).toMatchObject({ source: 'finding', kind: 'unchecked_claim', station: 'review', evidence: ['18.4%'] })
    expect(f.state.band?.title).not.toBe('')
    expect(f.state.band?.chips.length).toBeGreaterThanOrEqual(2)
    expect(f.state.trace.some(t => t.detail === 'fallback band for unchecked_claim')).toBe(true)
  })
})

describe('Plan and Own from everyday prompts', () => {
  test('starting new work is Plan, with its caption on the row and the rail', async () => {
    const f = makeFake({ station: 'review', prefs: prefsFor(2) })
    await onPrompt(f.ctx, 'I want help with a new sales pitch')
    expect(f.state.station).toBe('plan')
    expect(f.state.moveNote).toBe('starting new work')
    expect(f.state.rowNotes.user[noteKey('I want help with a new sales pitch')]?.from).toBeUndefined()
  })

  test('taking a result as final is Own and brings up the checks without holding anything', async () => {
    const f = makeFake({ station: 'review', prefs: prefsFor(2) })
    await onPrompt(f.ctx, 'That looks good!')
    expect(f.state.station).toBe('own')
    expect(f.state.ownCheck?.held).toBe(false)
    expect(f.state.ownCheck?.checks.length).toBe(3)
  })
})

describe('Haiku does not overrule a rule', () => {
  test('a rule-based Plan stays a Plan when Haiku says brief', async () => {
    const f = makeFake({ station: 'review', prefs: prefsFor(2) })
    f.replies.push(answered({ good: null, suggestion: null, move: { kind: 'brief', evidence: 'kundebrief' } }))
    await onPrompt(f.ctx, 'Jeg har brug for hjælp til en kundebrief')
    await f.flush()
    expect(f.state.station).toBe('plan')
  })
})

describe('preview always shows the step suggestions', () => {
  test('no finding in preview: the band offers the Review chips after a reply', async () => {
    const f = makeFake({ station: 'brief', turnIndex: 3, lastPrompt: 'help me with a client brief', prefs: prefsFor(2, { settings: { ...INITIAL.prefs.settings, preview: true } }) })
    f.replies.push(answered({ card: {}, flags: [], finding: null }))
    await onTurnComplete(f.ctx, 'Here are a few questions.', true)
    await f.flush()
    expect(f.state.band?.station).toBe('review')
    expect(f.state.band?.chips.map(c => c.label)).toContain('What did you assume?')
  })

  test('outside preview a turn with no finding stays silent', async () => {
    const f = makeFake({ station: 'brief', turnIndex: 3, lastPrompt: 'help me with a client brief', prefs: prefsFor(5) })
    f.replies.push(answered({ card: {}, flags: [], finding: null }))
    await onTurnComplete(f.ctx, 'Here are a few questions.', true)
    await f.flush()
    expect(f.state.band).toBeNull()
  })
})

describe('first prompt and instant suggestions', () => {
  test('a prompt the coach never saw is caught up on when the reply ends', async () => {
    const f = makeFake({ station: 'plan', prefs: prefsFor(2, { settings: { ...INITIAL.prefs.settings, preview: true } }) })
    f.messages = [
      { role: 'user', text: '/coach preview on' },
      { role: 'user', text: 'Hi, I need help with an analysis for our bakery' },
      { role: 'assistant', text: 'Sure, what data do you have?' },
    ]
    f.replies.push(answered({ card: {}, flags: [], finding: null }))
    await onTurnComplete(f.ctx, 'Sure, what data do you have?', true)
    await f.flush()
    const note = f.state.rowNotes.user[noteKey('Hi, I need help with an analysis for our bakery')]
    expect(note?.move).toBe('plan')
    expect(note?.gap).toBeDefined()
    expect(f.state.rowNotes.user[noteKey('/coach preview on')]).toBeUndefined()
  })

  test('a spinner holds the band while the suggestions are written; in preview the step chips follow when nothing came back', async () => {
    const f = makeFake({ station: 'brief', turnIndex: 2, lastPrompt: 'x', prefs: prefsFor(2, { settings: { ...INITIAL.prefs.settings, preview: true } }) })
    await onTurnComplete(f.ctx, 'Here is the summary.', true)
    expect(f.state.bandLoading).toBe(true)
    expect(f.state.band).toBeNull()
    await f.flush()
    expect(f.state.bandLoading).toBe(false)
    expect(f.state.band?.station).toBe('review')
    expect(f.state.band?.source).toBe('fallback')
  })

  test('without a finding the next-step chips, written for this conversation, show', async () => {
    const answer = 'Option B from Nordlys is 12% cheaper than the others.'
    const f = makeFake({ station: 'brief', turnIndex: 4, lastPrompt: 'Compare the supplier quotes', prefs: prefsFor(6) })
    f.replies.push(
      answered({
        card: {},
        flags: [],
        finding: null,
        next: {
          station: 'review',
          chips: [
            { label: 'Check the 12%', fill: 'How did you get 12% for Nordlys?', evidence: '12% cheaper' },
            { label: 'Compare delivery terms', fill: 'Compare delivery terms for Option B', evidence: 'Option B from Nordlys' },
          ],
        },
      }),
    )
    await onTurnComplete(f.ctx, answer, true)
    await f.flush()
    expect(f.state.band?.chips.map(c => c.label)).toEqual(['Check the 12%', 'Compare delivery terms'])
    expect(f.state.band?.kind).toBe('next_step')
    expect(f.state.bandLoading).toBe(false)
  })

  test('the row under a prompt shows a spinner until its feedback is written', async () => {
    const f = makeFake({ prefs: prefsFor(6) })
    await onPrompt(f.ctx, 'Write the steering group summary of the churn numbers')
    expect(f.state.noteBusy).not.toBe('')
    await f.flush()
    expect(f.state.noteBusy).toBe('')
  })
})
