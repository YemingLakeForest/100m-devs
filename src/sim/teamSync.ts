/**
 * Team sync — how well the studio held together while it built the thing.
 *
 * §4.14 rates a release on three things the player arranges: what they let
 * break, who touched it, and how good those people were. None of them asks the
 * question the whole game is *about*. §6's thesis is that a company gets worse
 * at building software as it gets bigger, and §4.1 already models exactly that
 * — and until now the answer only ever showed up as **less** output. A studio
 * drowning in its own communication overhead shipped later. It did not ship
 * *worse*, and it obviously should.
 *
 * So this is §4.1 read a second way. The same entropy curve that decides how
 * much gets built also decides how well it got built, and a release finally
 * carries the mark of the organisation that produced it.
 *
 * ## Two terms, and why one of them is an integral
 *
 * **Flow** is §4.1's efficiency *averaged over the build*, not sampled at ship.
 * That distinction is the load-bearing one in the file. A studio that spent
 * four minutes at 40% and then hired a Cloud hero on the last frame did not
 * build a good game; it built a bad game and then got organised. An instant
 * reading rewards exactly that, and the fix is not a bigger number, it is a
 * different *kind* of number — ∫η dt over the project, divided by the project's
 * seconds, which is the honest mean and which no last-second purchase can move.
 * The store integrates it beside §10.11.2's labour, on the same tick and for
 * the same reason.
 *
 * It also carries §4.9's local entropy, because a poked developer is a
 * distracted one and the player's own thumb is a source of the disorder this
 * term measures. Poking your way through a project makes it ship sooner and
 * score slightly worse, which is §4.5a's trade finally stated in both currencies
 * rather than only the flattering one.
 *
 * **Service** is whether the studio is staffed for the catalogue it already
 * has — §4.13's support and §4.12a's SRE, against the demand those sections
 * derive. A studio whose support queue is on fire is a studio whose engineers
 * are answering email, and the next game is worse for it.
 *
 * ## The garage scores one, and that is the whole calibration
 *
 * §4.14.1 derives the neutral point from what a garage ships rather than
 * picking it at fifty, and this term has to be honest inside that scheme. A
 * garage is **perfectly in sync**: one desk, no communication overhead, and no
 * catalogue to be understaffed for. So {@link GARAGE_SYNC} is 1 and it is the
 * *ceiling*, which makes this the one input to the rating that can only ever be
 * spent — scale costs sync, and heroes, cohesion and hiring for the back
 * catalogue are how it is bought back. That is §6's thesis priced, which is the
 * reason the term exists.
 *
 * Pure — no store, no clock, no renderer.
 */

import { headsNeeded } from './support.ts'

/**
 * Flow against service. **Flow dominates**, because it is the game's central
 * number and service is a hygiene factor: a studio can be perfectly staffed for
 * its catalogue and still be a thousand people who cannot hear each other.
 *
 * First pass, on §25.3.2's standing rule for weights — the order is the claim,
 * the values want a playtest.
 */
export const SYNC_WEIGHTS = {
  flow: 0.75,
  service: 0.25,
} as const

/**
 * What a garage scores. **Derived, not chosen** — see the file header.
 *
 * One desk is at full §4.1 efficiency and has no catalogue to be understaffed
 * for, so both terms are 1 and so is their weighted sum. §4.14.1's baseline
 * reads this constant rather than the number 1, so a future term with a garage
 * value below 1 cannot silently re-tune the economy by being added here.
 */
export const GARAGE_SYNC = SYNC_WEIGHTS.flow * 1 + SYNC_WEIGHTS.service * 1

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/**
 * ∫η dt over the build, divided by the build — §4.1, averaged rather than
 * sampled.
 *
 * A project with no seconds behind it is a project nobody built, and the honest
 * answer for it is the garage rather than zero: it is the same question
 * `rateRelease` answers by returning the baseline for a release with no Story
 * Points, and answering it with 0 here would make the first frame after a
 * Paradigm Shift the worst-organised studio in the game's history.
 */
export function flowScore(flowSeconds: number, projectSeconds: number): number {
  // **Both guards answer "we do not know" with the garage, never with zero.**
  // This is an ephemeral counter (§24.2), so a non-finite value cannot come
  // from a save document and can only ever be a bug — and the failure mode of a
  // bug here must not be a studio silently docked a fifth of every rating it
  // earns for the rest of the session.
  if (!Number.isFinite(flowSeconds) || !Number.isFinite(projectSeconds)) return 1
  if (!(projectSeconds > 0)) return 1
  return clamp01(Math.max(0, flowSeconds) / projectSeconds)
}

/** What the two service roles are being asked for, and what is answering. */
export interface ServiceLoad {
  /** §4.13's heads on the queue, founder dilution included. */
  supportHeads: number
  /** §4.12a's heads on the pager, founder dilution included. */
  sreHeads: number
  /** Games ever shipped — §4.13's `catalogue`, which never decays. */
  catalogue: number
  /** §4.12's bench at this moment, which is the second half of the ticket rate. */
  defectBacklog: number
  /** §4.12a's open incidents. Each one is a release off sale. */
  openIncidents: number
}

/**
 * Is the studio staffed for what it has already made — §4.13, §4.12a.
 *
 * Each side is *coverage of demand*, capped at 1: over-staffing support does
 * not buy quality, it just means nobody is drowning. **Zero demand scores 1
 * rather than 0**, which is what keeps a garage — and Run 1, and the first
 * project after a Paradigm Shift — at the top of this term instead of being
 * penalised for having shipped nothing yet.
 *
 * The two are averaged rather than minimised. A weakest-link rule reads well and
 * plays badly: a single unlucky incident with no SRE hired would halve the term
 * outright, and §4.12's "nothing here may become a fail state" applies to a
 * rating that collapses on one event just as much as to one that stops the
 * clicker.
 */
export function serviceScore(load: ServiceLoad): number {
  const needed = headsNeeded(load.catalogue, load.defectBacklog)
  const support = needed > 0 ? clamp01(Math.max(0, load.supportHeads) / needed) : 1

  // §4.12a's clearance is one head to one incident — `clearanceCapacity` is the
  // identity on heads, so the ratio is the honest reading of "is anybody on
  // this?" without importing a function to multiply by one.
  const open = Number.isFinite(load.openIncidents) ? Math.max(0, load.openIncidents) : 0
  const sre = open > 0 ? clamp01(Math.max(0, load.sreHeads) / open) : 1

  return (support + sre) / 2
}

export interface SyncInputs {
  /** ∫ effective efficiency dt over the build, in seconds. */
  flowSeconds: number
  /** The build, in simulated seconds. */
  projectSeconds: number
  load: ServiceLoad
}

/**
 * How in sync the team that built this was, 0..1 — {@link GARAGE_SYNC} at the
 * top, and the top is a garage.
 */
export function teamSync(inputs: SyncInputs): number {
  return clamp01(
    SYNC_WEIGHTS.flow * flowScore(inputs.flowSeconds, inputs.projectSeconds) +
      SYNC_WEIGHTS.service * serviceScore(inputs.load),
  )
}
