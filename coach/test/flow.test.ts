import { describe, expect, test } from 'claude-code/testing'
import { classifyCommand, onPrompt, onPush, onTurnComplete, showSuggestion, wasAccepted } from '../hooks/flow'
import { dismissBand, fillFromCoach, finishOwn, focusStation, tickOwn } from '../hooks/actions'
import { OWN_CHECKS, OWN_DENY_TEXT, OWN_PASS_TEXT } from '../hooks/config'
import { INITIAL } from '../hooks/initial'
import { makeOwnCheck, ownChecks } from '../hooks/own'
import { noteKey, ruleNote } from '../hooks/notes'
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
  test('moves to Brief, clears focus and band, counts the turn', async () => {
    const f = makeFake({ station: 'review', focus: 'plan', turnIndex: 2, prefs: prefsFor(5) })
    await onPrompt(f.ctx, 'Why is it 18.4%?')
    expect(f.state.station).toBe('brief')
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
        good: { text: 'Questioned the result', evidence: 'Why is it 18.4%', kind: 'unchecked_claim' },
        suggestion: { template: 'Churn means ___', evidence: 'Why is it 18.4%', kind: 'missing_done' },
      }),
    )
    await onPrompt(f.ctx, 'Why is it 18.4%?')
    await f.flush()
    expect(f.state.notes[noteKey('Why is it 18.4%?')]).toBe('Questioned the result')
    expect(f.state.pendingSuggest?.template).toBe('Churn means ___')
    expect(f.state.cost.tokens).toBeGreaterThan(0)
  })

  test('a faded behaviour no longer gets its note', async () => {
    const fade = { unchecked_claim: [true, true, false, true] }
    const f = makeFake({ prefs: prefsFor(5, { fade }) })
    f.replies.push(answered({ good: { text: 'Questioned the result', evidence: 'Why is it', kind: 'unchecked_claim' } }))
    await onPrompt(f.ctx, 'Why is it 18.4%?')
    await f.flush()
    expect(f.state.notes).toEqual({})
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

  test('verified share_intent moves to Own with one divider; an unverified flag only suggests', async () => {
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
    expect(f.state.station).toBe('own')
    expect(f.logs).toEqual(['Own · share intent'])
    expect(f.state.stationReason).toBe('')

    const g = setup(5)
    g.replies.push(answered({ flags: [{ type: 'new_task', evidence: 'not in the text' }], finding: FINDING_A.finding }), answered(BAND_B))
    await onTurnComplete(g.ctx, ANSWER, true)
    await g.flush()
    expect(g.state.station).toBe('review')
    expect(g.state.band?.suggestion?.station).toBe('plan')
    expect(g.logs).toEqual([])
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

  test('focusing a station pre-fills its template when the box is empty', async () => {
    const f = makeFake({ prefs: prefsFor(5) })
    await focusStation(f.ctx, 'brief')
    expect(f.fills).toEqual(['This is for ___, who needs it to ___.'])
    const g = makeFake({ prefs: prefsFor(5) })
    g.box.text = 'typing'
    await focusStation(g.ctx, 'brief')
    expect(g.fills).toEqual([])
  })

  test('a new template replaces the previous coach template, a chip never lands on top of one', async () => {
    const f = makeFake({ prefs: prefsFor(5) })
    await focusStation(f.ctx, 'brief')
    await focusStation(f.ctx, 'plan')
    expect(f.box.text).toBe('The goal is ___, and what must not change is ___.')
    expect(f.modes).toEqual(['replace', 'replace'])
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
    expect(f.logs).toEqual(['Own · git commit'])
  })

  test('with pausePushes on, the push is denied and the band holds it', async () => {
    const f = held({ card: { ...INITIAL.card, recipient: 'Mette, steering group' } })
    expect(await onPush(f.ctx, 'push', 'git push origin main')).toBe(OWN_DENY_TEXT)
    expect(f.asks).toEqual([])
    expect(f.state.station).toBe('own')
    expect(f.state.ownCheck?.held).toBe(true)
    expect(f.state.ownCheck?.title).toContain('Mette')
    expect(f.state.ownCheck?.source).toEqual(['git push', 'email to Mette'])
    expect(f.logs).toEqual(['Own · push paused'])
    expect(await onPush(f.ctx, 'push', 'git push')).toBe(OWN_DENY_TEXT)
    expect(f.logs).toHaveLength(1)
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
    expect(f.logs).toEqual(['Own · git push'])
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
    expect(f.logs).toHaveLength(1)
  })
})

describe('preview and rule notes', () => {
  test('the rule note fires for obvious moves after a Review only', () => {
    expect(ruleNote('Use contract end instead. Go.', 'review')?.text).toBe('Corrected Claude')
    expect(ruleNote('No, that is not what I asked', 'review')?.text).toBe('Corrected Claude')
    expect(ruleNote("That's wrong, the base is Q3", 'review')?.text).toBe('Corrected Claude')
    expect(ruleNote('How did you get 18.4%?', 'review')?.text).toBe('Questioned the result')
    expect(ruleNote('Are you sure about that?', 'review')?.text).toBe('Questioned the result')
    expect(ruleNote('How did you get 18.4%?', 'brief')).toBeNull()
    expect(ruleNote('Write the summary', 'review')).toBeNull()
  })

  test('the note key survives spacing and case', () => {
    expect(noteKey('  Why   is it\n18.4%? ')).toBe(noteKey('why is it 18.4%?'))
  })

  test('a rule note shows without any model call (session 2)', async () => {
    const f = makeFake({ station: 'review', prefs: prefsFor(2, { settings: { ...INITIAL.prefs.settings, cadence: 'focus' } }) })
    await onPrompt(f.ctx, 'Use contract end instead. Go.')
    expect(f.state.notes[noteKey('Use contract end instead. Go.')]).toBe('Corrected Claude')
    expect(f.state.latestNote).toEqual({ turn: 1, text: 'Corrected Claude' })
    expect(f.requests).toHaveLength(0)
  })

  test('the note is also stored under the row id once the row is known', async () => {
    const f = makeFake({ station: 'review', rows: { user: 'row-1', reply: '', userTurn: 1, replyTurn: 0 }, turnIndex: 0, prefs: prefsFor(2) })
    await onPrompt(f.ctx, 'Are you sure about the base?')
    expect(f.state.notes['row-1']).toBe('Questioned the result')
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
      answered({ good: { text: 'Audience is clear', evidence: 'to Mette', kind: null }, suggestion: { template: 'Churn means ___', evidence: 'churn numbers', kind: 'missing_done' } }),
    )
    await onPrompt(f.ctx, 'Send the churn numbers to Mette')
    await f.flush()
    expect(f.state.notes[noteKey('Send the churn numbers to Mette')]).toBe('Audience is clear')
    expect(f.state.pendingSuggest?.template).toBe('Churn means ___')
    f.state = { ...f.state, turnIndex: 6 }
    f.replies.push(answered(FINDING_A), answered(BAND_B))
    await onTurnComplete(f.ctx, ANSWER, true)
    await f.flush()
    expect(f.state.band?.kind).toBe('unchecked_claim')
    expect(f.suggested).toEqual(['Churn means ___'])
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
