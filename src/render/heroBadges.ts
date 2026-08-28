/**
 * §13.11.1 — "who covers this?", the pure half.
 *
 * The renderer draws badges on a unit's face and tints exactly the developers a
 * hero reaches. This file is the arithmetic it tints *by*: given the heroes
 * placed on a unit, which of them reach it, how much of it, and where two
 * heroes of one branch waste coverage on each other (§13.8 rule 3 — two of a
 * class over the same rows do not stack).
 *
 * The Pixi drawing is not here — `room.ts` owns the floor's geometry and draws
 * the decals — but the *decision* about which seat gets which mark is, because
 * it is arithmetic and it has been wrong before.
 *
 * The note that stood here said a renderer built today would be drawing a floor
 * that can never hold a hero, because placement was gated behind §13.6.7a's
 * Layer 2. That was true of the *drag* §13.8 specifies and not of placement
 * itself: `placeHero` has been complete for months and had no caller, which is
 * a different problem with a much cheaper answer (`GameState.posting`).
 */

import type { HeroBranch } from '../sim/heroTree.ts'
import { coverage } from '../sim/heroes.ts'
import type { HeroState } from '../sim/heroes.ts'

/** One hero's claim over one unit. */
export interface CoverageClaim {
  heroId: string
  branch: HeroBranch
  /** §13.6.2 — the fraction of the unit the hero actually reaches. */
  fraction: number
  complete: boolean
}

/** §13.11.1 — who covers this unit, and where coverage is wasted. */
export interface UnitFootprint {
  claims: readonly CoverageClaim[]
  /** Branches with two or more heroes over the same unit — the cross-hatch. */
  overlapped: ReadonlySet<HeroBranch>
}

/**
 * Fold a unit's placements into what the badge layer draws.
 *
 * A hero reaches a fraction of the unit per §13.6.2; two heroes of one branch
 * do not stack, so where they overlap the second one is *visibly wasted*
 * (§13.11.1's cross-hatching rather than a scolding).
 */
export function unitFootprint(
  placements: ReadonlyArray<{ heroId: string; branch: HeroBranch; state: HeroState }>,
  devsAtSlot: number,
): UnitFootprint {
  const claims: CoverageClaim[] = []
  const seen = new Map<HeroBranch, number>()

  for (const p of placements) {
    const cov = coverage(p.state, devsAtSlot)
    claims.push({ heroId: p.heroId, branch: p.branch, fraction: cov.fraction, complete: cov.complete })
    seen.set(p.branch, (seen.get(p.branch) ?? 0) + 1)
  }

  const overlapped = new Set<HeroBranch>()
  for (const [branch, count] of seen) if (count > 1) overlapped.add(branch)

  return { claims, overlapped }
}

// ---------------------------------------------------------------------------
// §13.11.1 on the room floor — which seat gets which mark
// ---------------------------------------------------------------------------

/** One placed hero, as the room needs them. Seats, not people. */
export interface RoomPosting {
  branch: HeroBranch
  /** The branch's colour, already resolved — this module knows no palette. */
  colour: string
  /** The seat they were posted on. Rungs 0–2 cover from here upward (§13.6.2). */
  index: number
  /** How many seats they would cover once settled. */
  reachDevs: number
  /** §13.8 rule 4 — still walking, so covering nothing yet. */
  settling: boolean
  /** 0..1 activation sweep after settling. Omitted means an established posting. */
  activation?: number
}

/** What the floor draws under one seat. */
export interface SeatMark {
  colour: string
  /** §13.8 rule 3 — a hero of this branch already covers this seat. */
  wasted: boolean
  /** §13.8 rule 4 — drawn as an outline, because it is not coverage yet. */
  settling: boolean
  /** Seat-local fill progress; staggered in posting order for the activation wave. */
  activation?: number
}

/**
 * §13.11.1 — fold every posting in the room into one mark per seat.
 *
 * Three rules, and each one is a sentence from §13.8 or §13.11.1:
 *
 * 1. **A posting covers upward from its own seat** — §13.6.2's reach against
 *    `devs - index`, which is what `heroCoverageOf` charges the simulation for
 *    at rungs 0–2. The footprint the player sees is the footprint they are paid
 *    for, or the picture is a decoration.
 * 2. **Two of one branch do not stack, and the waste is drawn** — §13.8 rule 3.
 *    Earlier postings win the seat; a later one of the *same* branch marks it
 *    wasted rather than recolouring it, so the hatch lands on the overlap and
 *    not on the whole of the second footprint.
 * 3. **Two of different branches both count**, and the seat keeps the first
 *    colour. There is one floor tile and two true answers; the alternative is
 *    splitting the diamond, which at desk zoom is four pixels of stripe nobody
 *    can read.
 *
 * A settling posting is drawn — as an outline, by the caller — rather than
 * withheld. §13.8 rule 4 makes relocation cost time and §13.11.1 wants that
 * time on screen; a footprint that simply appears twenty seconds after the tap
 * teaches the player that the tap did nothing.
 */
export function roomSeatMarks(
  postings: readonly RoomPosting[],
  devs: number,
): Map<number, SeatMark> {
  const seats = Math.max(0, Math.floor(Number.isFinite(devs) ? devs : 0))
  const marks = new Map<number, SeatMark>()
  /** Which branches have already claimed each seat — rule 2's bookkeeping. */
  const claimedBy = new Map<number, Set<HeroBranch>>()

  for (const p of postings) {
    const from = Math.max(0, Math.floor(p.index))
    if (from >= seats) continue
    // `devs - index` is the slot, and reach is capped by it: a hero on the last
    // desk of a room of ten covers one person however far they can reach.
    const to = Math.min(seats, from + Math.max(0, Math.floor(p.reachDevs)))
    const span = Math.max(1, to - from)
    const sweep = p.settling ? 0 : Math.min(1, Math.max(0, p.activation ?? 1))

    for (let seat = from; seat < to; seat++) {
      const order = span <= 1 ? 0 : (seat - from) / (span - 1)
      // The first seat begins immediately; the last finishes with the sweep.
      const activation = Math.min(1, Math.max(0, sweep * 1.35 - order * 0.35))
      let branches = claimedBy.get(seat)
      if (!branches) {
        branches = new Set()
        claimedBy.set(seat, branches)
      }
      const duplicate = branches.has(p.branch)
      branches.add(p.branch)

      const existing = marks.get(seat)
      if (!existing) {
        marks.set(seat, { colour: p.colour, wasted: false, settling: p.settling, activation })
        continue
      }
      // Rule 3 keeps the first colour; rule 2 turns the seat hatched. A seat is
      // only un-settled once somebody who has arrived covers it.
      if (duplicate) existing.wasted = true
      if (!p.settling) existing.settling = false
      existing.activation = Math.max(existing.activation ?? 1, activation)
    }
  }

  return marks
}
