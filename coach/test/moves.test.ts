import { describe, expect, test } from 'claude-code/testing'
import type { CoachStation } from '../types'
import { classifyMove } from '../hooks/moves'

type Row = [prompt: string, move: CoachStation, previous?: CoachStation]

const TABLE: Row[] = [
  // Brief: a new or next instruction
  ['Run the churn analysis on the Q3 export for Thursday.', 'brief'],
  ['Write a summary for the steering group.', 'brief'],
  ['Add a column for contract end date.', 'brief'],
  ['Refactor the loader so it streams the file.', 'brief'],
  ['Translate the intro to Danish.', 'brief'],
  ['Lav en oversigt over kundeafgang for tredje kvartal.', 'brief'],
  ['Tilføj en kolonne med slutdato.', 'brief'],
  ['What does the export contain?', 'brief'],
  ['Now do the same for Q2.', 'brief', 'review'],
  ['Make the chart bigger and use our colours.', 'brief'],
  // Review: questions, checks or corrects Claude's result
  ['Why did you exclude the trial accounts?', 'review'],
  ['How did you get 18.4%?', 'review'],
  ['Are you sure about the SMB tier?', 'review'],
  ['Use contract end instead. Go.', 'review'],
  ["That's wrong, the base is all accounts.", 'review'],
  ['No, I meant the 2025 export.', 'review'],
  ['Please double-check the totals.', 'review'],
  ['Can you verify the 312 number?', 'review'],
  ['Where did you get the 21.1%?', 'review'],
  ['Hvorfor valgte du at udelukke prøvekonti?', 'review'],
  ['Er du sikker på tallet?', 'review'],
  ['Det er forkert, grundlaget er alle konti.', 'review'],
  ['Brug slutdato i stedet.', 'review'],
  ['Tjek lige summerne.', 'review'],
  ['Why is it higher in SMB?', 'review', 'review'],
  // Plan: approach, options, plan before work
  ['Make a plan for the migration before touching anything.', 'plan'],
  ['How would you approach the churn model?', 'plan'],
  ['Should we split this into two services?', 'plan'],
  ['Outline the options for the data pipeline.', 'plan'],
  ["Don't change anything yet, just propose an approach.", 'plan'],
  ['Hvordan ville du gribe det an?', 'plan'],
  ['Skal vi dele det op i to dele?', 'plan'],
  ['Lav en plan for migreringen.', 'plan'],
  // Own: ship, send, commit, push, publish, share
  ['Push it and draft the email to Mette.', 'own'],
  ['Commit this with a clear message.', 'own'],
  ['Deploy to production now.', 'own'],
  ['Send it to Mette before Thursday.', 'own'],
  ['Publish the report to the client portal.', 'own'],
  ['Share this with the steering group.', 'own'],
  ['Send den til Mette inden torsdag.', 'own'],
  ['Udgiv rapporten.', 'own'],
]

describe('the person move, from the prompt', () => {
  test('has 30+ real-looking prompts', () => {
    expect(TABLE.length).toBeGreaterThanOrEqual(30)
  })

  for (const [prompt, move, previous] of TABLE) {
    test(`${move}: ${prompt}`, () => {
      expect(classifyMove(prompt, previous ?? 'brief').move).toBe(move)
    })
  }

  test('a bare why only counts as questioning right after a Review', () => {
    expect(classifyMove('Why is it higher in SMB?', 'brief').move).toBe('brief')
    expect(classifyMove('Why is it higher in SMB?', 'review').move).toBe('review')
  })

  test('review moves carry a note: corrected or questioned; others have none', () => {
    expect(classifyMove('Use contract end instead. Go.', 'review').note).toBe('Corrected Claude')
    expect(classifyMove('No, that is not what I asked', 'review').note).toBe('Corrected Claude')
    expect(classifyMove('How did you get 18.4%?', 'review').note).toBe('Questioned the result')
    expect(classifyMove('Write a summary', 'review').note).toBeNull()
    expect(classifyMove('Push it', 'review').note).toBe('About to ship')
  })

  test('the rule that fired is reported for the trace; the default has none', () => {
    expect(classifyMove('Are you sure about it?', 'brief').hit).toBe('Are you sure')
    expect(classifyMove('Write a summary', 'brief').hit).toBeNull()
  })

  test('asking for a plan outranks a correction word inside it', () => {
    expect(classifyMove('Make a plan to exclude trials instead.', 'review').move).toBe('plan')
  })
})

describe('new work is Plan, taking a result as final is Own', () => {
  const cases: [string, string, string | undefined][] = [
    ['I want help with a new sales pitch', 'plan', 'starting new work'],
    ['Okay help me prep for a sales pitch', 'plan', 'starting new work'],
    ['Hi there I need help with my new sales pitch', 'plan', 'starting new work'],
    ['Help me prep a pitch for the client', 'plan', 'starting new work'],
    ['Hjælp mig med en ny præsentation', 'plan', 'starting new work'],
    ['Jeg har brug for hjælp til en kundebrief', 'plan', 'starting new work'],
    ['Hi there - help me with a clietn convo', 'plan', 'starting new work'],
    ['That looks good!', 'own', 'taking it as final'],
    ['Perfect', 'own', 'taking it as final'],
    ['This is the final version for the steering group', 'own', 'taking it as final'],
    ['Det ser godt ud', 'own', 'taking it as final'],
    ['Why did you exclude the trial accounts?', 'review', undefined],
    ['Use contract end instead. Go.', 'review', undefined],
    ['Add a column for region', 'brief', undefined],
  ]
  for (const [text, move, caption] of cases) {
    test(`${move}: ${text}`, () => {
      const m = classifyMove(text, 'review')
      expect(m.move).toBe(move)
      expect(m.caption).toBe(caption)
    })
  }
})
