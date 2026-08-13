import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import Decimal from 'break_infinity.js'
import { Defects, Incidents, Tickets } from './Backlogs.tsx'
import type { GameState } from '../game/store.ts'
import { conceptsIn } from '../ui/concepts.ts'
import { newRoster, addHires } from '../sim/roles.ts'

// Vitest runs without `globals`, so testing-library's own auto-cleanup hook is
// never installed and renders would otherwise stack up in one document.
afterEach(cleanup)

function stateWith(patch: Partial<GameState>): GameState {
  return {
    defects: 0,
    incidents: [],
    tickets: 0,
    projectsShipped: 0,
    roster: newRoster(0),
    commitment: new Decimal(1000),
    ...patch,
  } as GameState
}

describe('§4.15 — three components, never one', () => {
  /**
   * The rule the whole section exists for. A combined "problems" total is the
   * most natural thing to build here and it would delete the entire point of
   * §4.11's four roles, because the player's answer to each backlog is a
   * different hire. Asserted structurally: nothing in the module takes all
   * three, so nothing can add them up.
   */
  it('renders nothing at all for a studio with no history', () => {
    const state = stateWith({})
    const { container } = render(
      <>
        <Defects state={state} />
        <Incidents state={state} />
        <Tickets state={state} />
      </>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('§4.12 — the defect counter', () => {
  it('stays hidden below one, so its appearance is the notification', () => {
    const { container } = render(<Defects state={stateWith({ defects: 0.4 })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('reads as a sentence rather than as a ratio', () => {
    render(<Defects state={stateWith({ defects: 48, commitment: new Decimal(1008) })} />)
    expect(screen.getByText('48')).toBeInTheDocument()
    expect(screen.getByText('DEFECTS')).toBeInTheDocument()
    expect(screen.getByText('1 per 21 SP')).toBeInTheDocument()
  })

  it('says DEFECT, not DEFECTS, when there is one', () => {
    render(<Defects state={stateWith({ defects: 1 })} />)
    expect(screen.getByText('DEFECT')).toBeInTheDocument()
  })

  /**
   * §4.15 rule 1 — it names the cure, and only while the cure is missing. A
   * studio that has already hired QA is being told something it acted on, which
   * is the definition of nagging.
   */
  it('names QA while there are none, and stops once there are', () => {
    render(<Defects state={stateWith({ defects: 10 })} />)
    expect(screen.getByText('HIRE QA')).toBeInTheDocument()
    cleanup()

    const hired = stateWith({ defects: 10, roster: addHires(newRoster(0), 'qa', 3) })
    render(<Defects state={hired} />)
    expect(screen.queryByText('HIRE QA')).not.toBeInTheDocument()
  })
})

describe('§4.12a — the incident chips', () => {
  const down = stateWith({
    incidents: [
      { id: 1, releaseId: 7, releaseName: 'Flappy Square', age: 4, work: 30 },
      { id: 2, releaseId: 9, releaseName: 'Calculator Pro', age: 1, work: 44 },
    ],
  })

  /**
   * **Not a total.** A total hides which game is on fire, and §10.11's gallery
   * is where the player already keeps that mental map — so each chip carries
   * the release's own name and the player connects it to a cover they know.
   */
  it('names every downed game rather than counting them', () => {
    render(<Incidents state={down} />)
    expect(screen.getByText('Flappy Square')).toBeInTheDocument()
    expect(screen.getByText('Calculator Pro')).toBeInTheDocument()
  })

  it('says what it costs, not how much work is left', () => {
    render(<Incidents state={down} />)
    // The player does not care how many SRE-seconds remain. They care that a
    // game they shipped is not earning.
    expect(screen.getAllByText('OFF SALE')).toHaveLength(2)
  })

  it('names SRE while there are none', () => {
    render(<Incidents state={down} />)
    expect(screen.getByText('HIRE SRE')).toBeInTheDocument()
  })
})

describe('§4.13 — the ticket bar', () => {
  it('says nothing at all until there is a catalogue to answer for', () => {
    const { container } = render(<Tickets state={stateWith({ projectsShipped: 0 })} />)
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * §13.7.1 — the founder answers the email, so a garage with one shipped game
   * is keeping up. The bar has to be drawn against the same capacity the
   * simulation charges, or the readout would contradict the till.
   *
   * **And a studio that is keeping up says nothing**, which is the same rule
   * `Defects` applies at zero. A permanent `TICKETS — KEEPING UP` row is
   * furniture reporting that nothing is happening, and the part of the rail it
   * teaches the player to stop reading is the part that will one day say
   * FALLING BEHIND.
   */
  it('says nothing for a garage, because the founder answers the email', () => {
    const { container } = render(<Tickets state={stateWith({ projectsShipped: 1 })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('speaks up once the catalogue outgrows the founder', () => {
    render(<Tickets state={stateWith({ projectsShipped: 40 })} />)
    // §4.15 rule 1 — it names the cure rather than the problem. The problem is
    // the bar; the words are for the person who fixes it.
    expect(screen.getByText('HIRE SUPPORT')).toBeInTheDocument()
    expect(screen.getByText('TICKETS')).toBeInTheDocument()
  })

  /**
   * Once Support has been hired the row still exists — the queue is still deep,
   * and hiding it would be the HUD deciding a solved problem is a finished one —
   * but it stops naming a cure the player has already bought.
   */
  it('stops nagging once Support exists, without going silent', () => {
    render(
      <Tickets
        state={stateWith({ projectsShipped: 40, roster: addHires(newRoster(0), 'support', 1) })}
      />,
    )
    expect(screen.getByText('FALLING BEHIND')).toBeInTheDocument()
    expect(screen.queryByText('HIRE SUPPORT')).not.toBeInTheDocument()
  })
})

describe('§10.2a — the three nouns are tracked concepts', () => {
  /**
   * One noun, one colour, everywhere it appears — including inside typed
   * dialogue and terminal copy, which is what `ConceptText` is for. A backlog
   * that only had a colour inside its own component would teach the player that
   * the colour means "this widget" rather than "this thing".
   */
  it('colours them wherever they appear in copy', () => {
    expect(conceptsIn('Three defects and one incident')).toEqual(
      expect.arrayContaining(['defects', 'incidents']),
    )
    expect(conceptsIn('the ticket queue')).toContain('tickets')
    // The words a player would actually say, not the ones the design doc uses.
    expect(conceptsIn('two bugs')).toContain('defects')
    expect(conceptsIn('an outage')).toContain('incidents')
  })
})
