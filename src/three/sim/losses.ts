/*
 * Copied from the rebuild (100m-devs-three/src/sim/losses.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * Where the output goes — the named slices of a studio's lost work.
 *
 * [added 2026-09-23, at the user's instruction: *"I need to ensure player see
 * and feel the number of devs we are hiring and manage the loss of efficiency
 * is the key (slack off, sync loss etc)."*] The HUD used to report the loss as
 * one number, §2.1's `1 − η`, and the game is about a big company wasting
 * effort in several recognisable ways at once. This names them.
 *
 * ## It is a partition of the losses the simulation already has
 *
 * Nothing here is a new mechanic (GDD §2.1, amended the same day): the
 * delivered share is the store's own velocity divided by one Story Point per
 * developer, so "doing the work of N" can never disagree with the burn-down,
 * and the slices only say what the rest of the headcount is doing instead. The
 * factors that actually removed that work are three:
 *
 * - **away** — §18's errands, measured, not modelled: `1 − awayShare`.
 * - **coordination** — §2.1's η. One number in the simulation, and several
 *   things on screen, because a meeting on a floor, a building waiting on
 *   another building and two campuses writing the same save system are the
 *   same `(D / D_cap)^ρ` seen at different distances. The split is by scale
 *   (see {@link coordinationWeights}) and it moves no Story Point.
 * - **blocked** — §10.7's full build queue, which stops the studio outright.
 * - **onboarding** [added 2026-09-24] — new hires on the payroll who are not yet
 *   on the burn-down, measured like away: `1 − onboardShare`.
 *
 * [amended 2026-09-24, Garage to Galaxy] `eta` is now §2.1's whole coordination
 * factor — the collapse past capacity times option C's square root — and its
 * split comes from `sim/dysfunction.ts`'s ledger when one is passed, so an
 * upgrade that moves meetings into waiting moves them here too.
 *
 * Whatever else bends velocity — flow, pokes, the role mix, heroes, events —
 * is not a named loss, and it is absorbed proportionally rather than invented
 * into a slice nobody can act on.
 *
 * ## Why log shares
 *
 * The factors multiply, so "how much of the loss is the water cooler's" has no
 * unique answer: taking the cooler out first or last gives different numbers.
 * Splitting `1 − Π f` in proportion to `−ln f` is the one order-free answer,
 * and it sums exactly by construction — the property the tests pin.
 *
 * Pure — no store, no clock, no renderer.
 */

/** Every state a developer's light can be in. The order is the legend's. */
export const LOSS_KINDS = ['slack', 'meet', 'wait', 'onboard', 'dup', 'handoff', 'lag'] as const
export type LossKind = typeof LOSS_KINDS[number]
export type WorkState = 'work' | LossKind

/** Fractions of headcount; the eight values always sum to exactly 1. */
export type Breakdown = Record<WorkState, number>

export interface LossInputs {
  /** People on the payroll who could be coding. */
  heads: number
  /** What they are delivering, in developer-equivalents (velocity / SP per dev per second). */
  effective: number
  /** §2.1's efficiency, 0..1. */
  eta: number
  /** §18 — the share of the floor that is away from its desk, 0..1. */
  awayShare: number
  /** §10.7 — the build queue is full and nobody is coding. */
  blocked: boolean
  /**
   * §2.1 [2026-09-24] — the share of the headcount still onboarding, 0..1.
   * Measured like `awayShare`: new hires are on the payroll and not yet on the
   * burn-down. Absent means nobody is new.
   */
  onboardShare?: number
  /**
   * Where the coordination loss sits, from `sim/dysfunction.ts`'s ledger.
   * Absent means the scale's natural split ({@link coordinationWeights}), which
   * is what the ledger returns when nothing has been bought.
   */
  coordWeights?: Record<'meet' | 'wait' | 'dup' | 'handoff', number>
  /** §6 [2026-09-25] — colonies waiting on HQ at light speed, 0..1. Measured. */
  lagShare?: number
  /** §6 — duplicate work from local studios, 0..1. Measured, added to the dup slice. */
  dupShare?: number
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0))
const ramp = (lo: number, hi: number, x: number) => {
  if (x <= lo) return 0
  if (x >= hi) return 1
  const t = Math.log(x / lo) / Math.log(hi / lo)
  return t * t * (3 - 2 * t)
}

/**
 * How §2.1's one coordination loss reads at each size of studio.
 *
 * Meetings are there from the first shared floor. Waiting on another team
 * arrives with the second building — before that there is no "other team" a
 * floor can be blocked on — duplicate work with the second city district, and
 * handoffs with the second timezone. The thresholds are the §6 ladder's own
 * rungs, and the order is the claim; the weights are presentation.
 */
export function coordinationWeights(heads: number): Record<'meet' | 'wait' | 'dup' | 'handoff', number> {
  const w = { meet: 1, wait: 0.55 * ramp(1_000, 10_000, heads), dup: 0.4 * ramp(100_000, 1_000_000, heads), handoff: 0.35 * ramp(1_000_000, 10_000_000, heads) }
  const sum = w.meet + w.wait + w.dup + w.handoff
  return { meet: w.meet / sum, wait: w.wait / sum, dup: w.dup / sum, handoff: w.handoff / sum }
}

export function lossBreakdown(i: LossInputs): Breakdown {
  const out: Breakdown = { work: 0, slack: 0, meet: 0, wait: 0, onboard: 0, dup: 0, handoff: 0, lag: 0 }
  if (!(i.heads > 0)) { out.work = 1; return out }
  const delivered = clamp01(i.effective / i.heads)
  out.work = delivered
  const lost = 1 - delivered
  if (lost <= 0) return out
  if (i.blocked) { out.wait = lost; return out }
  // −ln of each factor; a factor of exactly 0 is an infinite share, so cap it
  // at a loss that is total for practical purposes.
  const share = (f: number) => Math.max(0, -Math.log(Math.max(1e-9, clamp01(f))))
  const away = share(1 - i.awayShare)
  const onboard = share(1 - (i.onboardShare ?? 0))
  const lagF = share(1 - (i.lagShare ?? 0))
  const dupF = share(1 - (i.dupShare ?? 0))
  const coord = share(i.eta)
  const total = away + onboard + coord + lagF + dupF
  if (total <= 0) {
    // Nothing named explains the gap (heroes, roles, an event): call it
    // meetings rather than leave the bar short of its own width.
    out.meet = lost
    return out
  }
  out.slack = lost * away / total
  out.onboard = lost * onboard / total
  out.lag = lost * lagF / total
  const c = lost * coord / total
  const w = i.coordWeights ?? coordinationWeights(i.heads)
  out.meet = c * w.meet
  out.wait = c * w.wait
  out.dup = c * w.dup
  out.handoff = c * w.handoff
  out.dup += lost * dupF / total
  return out
}

/** "Doing the work of" — the one reading the HUD and the selection panel share. */
export function workOf(heads: number, b: Breakdown): number {
  return Math.max(0, heads * b.work)
}
