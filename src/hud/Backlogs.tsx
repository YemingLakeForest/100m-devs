/**
 * The three backlogs, on screen — GDD §4.15, R30.
 *
 * Defects, incidents and tickets are three numbers that all go up, all mean
 * "something is wrong", and all get worse when you go faster. **A player who
 * cannot tell them apart at a glance has three copies of one anxiety instead of
 * three problems with three answers** — and the answers are three different
 * people: Mo, Serena and Matt.
 *
 * §10.2a's rule extended to the other side of the ledger. Three rules make this
 * a system rather than three widgets, and each one is enforced below:
 *
 * 1. **None of them explains itself.** Each used to name its cure in the cure's
 *    colour — `HIRE QA`, `HIRE SRE`, `HIRE SUPPORT` — and the professions were
 *    cut on 2026-09-26 (*"different types of hires (SRE QA ETC."*). The cure
 *    is now a person, and each readout only appears once that person has
 *    arrived (`unlocks.ts`), so there is nobody left to point at.
 * 2. **They never merge into a "problems" total.** A single health bar is the
 *    most natural thing to build here and it would hide which of the three
 *    people the trouble belongs to. There is deliberately no component in this
 *    file that takes all three.
 * 3. **Incidents are the only one allowed to animate.** §10.6's anti-pattern
 *    list forbids ambient motion in the HUD; this is its single exception,
 *    bought with the argument that an incident is the only element on screen
 *    describing money leaving *at this moment*.
 */

import { densityLine } from '../sim/defects.ts'
import { serviceRatio } from '../sim/support.ts'
import { supportHeads, type GameState } from '../game/store.ts'
import { Kw } from './Kw.tsx'

/**
 * §4.12 — what is on the bench, and how dense it is.
 *
 * Sits beside §10.4's burn-down because it is a tax on that number: the two are
 * the same project measured by what is finished and by what is broken.
 *
 * **Hidden at zero.** A studio that has not written anything has not broken
 * anything, and a `0 DEFECTS` readout in Act I would be a permanent piece of
 * furniture teaching the player to ignore the row before it ever says anything.
 * The counter appearing is itself the notification.
 */
export function Defects({ state }: { state: GameState }) {
  const count = Math.floor(state.defects)
  if (count < 1) return null

  const density = densityLine(state.defects, state.commitment.toNumber())

  return (
    <div className="backlog backlog--defects">
      {/*
        Two rows, never three. The count and the density are one sentence — "37
        defects, one per 107 story points" — and stacking them cost a line in a
        rail that turned out not to have one. See §4.15's note on the rail budget
        in `Hud.tsx`.
      */}
      <span className="backlog__head">
        <span className="backlog__count">
          <b>{count}</b> <Kw kind="defects">{count === 1 ? 'DEFECT' : 'DEFECTS'}</Kw>
        </span>
      </span>
      {density && <span className="backlog__note">{density}</span>}
    </div>
  )
}

/**
 * §4.12a — one chip per downed game, named.
 *
 * **Not a total.** A total hides which game is on fire, and §10.11's gallery is
 * where the player already keeps that mental map — so the chip carries the
 * release's own name and the player connects it to a cover they recognise
 * without a lookup.
 *
 * This is the HUD's only animating element (rule 3). The pulse is on the chip
 * rather than on the text, so it survives `prefers-reduced-motion` degrading to
 * a static tint rather than to nothing.
 */
export function Incidents({ state }: { state: GameState }) {
  if (state.incidents.length === 0) return null

  return (
    <div className="backlog backlog--incidents">
      <span className="backlog__head">
        <Kw kind="incidents">{state.incidents.length === 1 ? 'INCIDENT' : 'INCIDENTS'}</Kw>
      </span>
      <ul className="backlog__chips">
        {state.incidents.map((incident) => (
          <li key={incident.id} className="backlog__chip">
            {/*
              The name, then what it costs. "OFF SALE" rather than a work
              counter: the player does not care how many on-call seconds remain,
              they care that a game they shipped is not earning.
            */}
            <span className="backlog__chip-name">{incident.releaseName}</span>
            <span className="backlog__chip-state">OFF SALE</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * §4.13 — the queue, as a depth bar rather than a number.
 *
 * §4.13 calls tickets "the studio's ambient noise", so the component is
 * deliberately the quietest thing in the HUD: no count unless it is large, no
 * colour that shouts, and a bar that is legible as **keeping up** or **falling
 * behind** without a number being read at all.
 *
 * The ratio is capacity over arrivals, which is the quantity the player is
 * actually managing — depth alone says nothing, because two hundred tickets is
 * a crisis for one person and a quiet morning for fifty.
 */
export function Tickets({ state }: { state: GameState }) {
  // Drawn against the capacity the simulation charges — the founder's head and
  // Matt's help desk — by asking the one function that knows it.
  const ratio = serviceRatio(state.projectsShipped, state.defects, supportHeads(state))

  // Nothing arriving is not "keeping up", it is nothing at all. Act I has no
  // catalogue and this row has nothing to say until something ships.
  if (!Number.isFinite(ratio)) return null

  /**
   * **Silent while the studio is keeping up** — the same rule {@link Defects}
   * applies at zero, and it should have been applied here from the start.
   *
   * A `TICKETS — KEEPING UP` bar is a permanent piece of furniture reporting
   * that nothing is happening, and §4.13 calls this component "the studio's
   * ambient noise" and asks it to be the quietest thing in the HUD. A row that
   * is always there is not quiet; it is the loudest kind of furniture, because
   * it teaches the player to stop reading that part of the rail — and the part
   * of the rail it teaches them to ignore is the one that will eventually say
   * FALLING BEHIND.
   *
   * It also costs forty pixels of the left rail in every frame of every run,
   * which turned out to be forty pixels the rail did not have.
   */
  if (ratio >= 1) return null

  // A full bar at parity, emptying as the studio falls behind. Clamped so the
  // bar is never invisible however far under water the queue is.
  const fill = Math.max(0.04, Math.min(1, ratio))

  return (
    <div className="backlog backlog--tickets" data-behind="true">
      <span className="backlog__head">
        <Kw kind="tickets">TICKETS</Kw>
        <span className="backlog__note">FALLING BEHIND</span>
      </span>
      <div className="backlog__bar" role="presentation">
        <div className="backlog__bar-fill" style={{ inlineSize: `${fill * 100}%` }} />
      </div>
    </div>
  )
}
