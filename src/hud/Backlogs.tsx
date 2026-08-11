/**
 * The three backlogs, on screen — GDD §4.15, R30.
 *
 * Defects, incidents and tickets are three numbers that all go up, all mean
 * "something is wrong", and all get worse when you go faster. **A player who
 * cannot tell them apart at a glance has three copies of one anxiety instead of
 * three problems with three answers** — and the answers are completely
 * different: hire QA, hire SRE, hire Support.
 *
 * §10.2a's rule extended to the other side of the ledger. Three rules make this
 * a system rather than three widgets, and each one is enforced below:
 *
 * 1. **Each names its cure, in the cure's colour.** No component here explains
 *    a mechanic in a paragraph; each one points at the person who fixes it.
 * 2. **They never merge into a "problems" total.** A single health bar is the
 *    most natural thing to build here and it would delete the entire point of
 *    §4.11's four roles. There is deliberately no component in this file that
 *    takes all three.
 * 3. **Incidents are the only one allowed to animate.** §10.6's anti-pattern
 *    list forbids ambient motion in the HUD; this is its single exception,
 *    bought with the argument that an incident is the only element on screen
 *    describing money leaving *at this moment*.
 */

import { densityLine } from '../sim/defects.ts'
import { serviceRatio } from '../sim/support.ts'
import { countsOf } from '../sim/roles.ts'
import { FOUNDER_ROLE_HEADS } from '../sim/founder.ts'
import type { GameState } from '../game/store.ts'
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
  const qa = countsOf(state.roster).qa

  return (
    <div className="backlog backlog--defects">
      <span className="backlog__count">
        <b>{count}</b> <Kw kind="defects">{count === 1 ? 'DEFECT' : 'DEFECTS'}</Kw>
      </span>
      {density && <span className="backlog__note">{density}</span>}
      {/*
        Rule 1. It names the cure rather than the problem, and only while the
        cure is missing — a studio that has already hired QA is being told
        something it acted on, which is the definition of nagging.
      */}
      {qa === 0 && <span className="backlog__cure backlog__cure--qa">QA REDUCE THIS</span>}
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
  const sre = countsOf(state.roster).sre

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
              counter: the player does not care how many SRE-seconds remain,
              they care that a game they shipped is not earning.
            */}
            <span className="backlog__chip-name">{incident.releaseName}</span>
            <span className="backlog__chip-state">OFF SALE</span>
          </li>
        ))}
      </ul>
      {sre === 0 && <span className="backlog__cure backlog__cure--sre">SRE CLEAR THESE</span>}
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
  const support = countsOf(state.roster).support
  // §13.7.1 — the founder answers the email when nobody else does, so the bar
  // has to be drawn against the same capacity the simulation charges.
  const ratio = serviceRatio(state.projectsShipped, state.defects, support + FOUNDER_ROLE_HEADS)

  // Nothing arriving is not "keeping up", it is nothing at all. Act I has no
  // catalogue and this row has nothing to say until something ships.
  if (!Number.isFinite(ratio)) return null

  const keepingUp = ratio >= 1
  // A full bar at parity, emptying as the studio falls behind. Clamped so a
  // studio at ten times capacity does not draw a bar ten screens wide.
  const fill = Math.max(0.04, Math.min(1, ratio))

  return (
    <div className="backlog backlog--tickets" data-behind={keepingUp ? 'false' : 'true'}>
      <span className="backlog__head">
        <Kw kind="tickets">TICKETS</Kw>
        <span className="backlog__note">{keepingUp ? 'KEEPING UP' : 'FALLING BEHIND'}</span>
      </span>
      <div className="backlog__bar" role="presentation">
        <div className="backlog__bar-fill" style={{ inlineSize: `${fill * 100}%` }} />
      </div>
      {!keepingUp && support === 0 && (
        <span className="backlog__cure backlog__cure--support">SUPPORT ANSWER THESE</span>
      )}
    </div>
  )
}
