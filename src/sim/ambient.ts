/**
 * Ambient life on the floor — GDD §7.8.6.
 *
 * §7.8.4 gives each developer an idle state, which is enough to stop the floor
 * looking frozen and nowhere near enough to make it look *inhabited*: every one
 * of those states is a person alone at a desk, and a room where nobody ever
 * speaks to anybody is a diorama.
 *
 * **The thesis needs this more than the juice does.** §6 is about communication
 * overhead and §4.1 charges the player for it in a number — but a number is an
 * assertion. This is the same claim made as evidence: at three developers the
 * floor is calm and someone occasionally says something; at eighty it is a
 * churn of interruptions and people walking away from their desks. §7.8.6's
 * standard is that **the entropy curve should be legible with the HUD switched
 * off**.
 *
 * Everything here is pure. The renderer owns where a walking developer *is*;
 * this owns what is happening and for how long, which is the half that has
 * rules worth pinning.
 *
 * **Nothing in this file may ever be read by the simulation.** §7.8.6 rule 2:
 * not one Story Point, in either direction. The moment a water trip costs
 * output, the player starts trying to prevent water trips, and the game becomes
 * about micro-managing forty walk cycles.
 */

/** What somebody is doing instead of working. */
export type Behaviour = 'chatter' | 'smalltalk' | 'water' | 'driveby'

/** How many people one behaviour occupies. */
export const PARTICIPANTS: Record<Behaviour, number> = {
  chatter: 1,
  smalltalk: 2,
  water: 1,
  driveby: 2,
}

/** Roughly how long each runs, in seconds. */
export const DURATION: Record<Behaviour, number> = {
  chatter: 2.6,
  smalltalk: 5.5,
  water: 7,
  driveby: 6,
}

/**
 * §7.8.6 rule 3 — the concurrency cap is a **fraction of headcount**.
 *
 * So the cost is flat above ~150 developers, and the floor at 100 is not twelve
 * times busier than the floor at 10 but *proportionally* busier. A fixed cap
 * would make a small room frantic and a large one dead.
 */
export const BUDGET_FRACTION = 0.08
export const BUDGET_MAX = 12

export function ambientBudget(devs: number): number {
  if (devs < 2) return 0 // One person alone cannot be interrupted.
  return Math.max(1, Math.min(BUDGET_MAX, Math.round(devs * BUDGET_FRACTION)))
}

/**
 * §7.8.6 rule 1 — **rate scales with entropy, not with headcount.**
 *
 * The distinction is the whole point and it is easy to get backwards. More
 * people does not mean more chatter per person; §4.1 says it means more
 * *interruption*, which is a different claim. Headcount is already accounted
 * for by {@link ambientBudget}; this is the equation, dramatised.
 *
 * At `IN SYNC` a bubble is an event — one every twelve seconds or so across the
 * whole floor. At `PRODUCTIVITY BREAKDOWN` it is constant.
 */
export const RATE_CALM = 0.08
export const RATE_SEIZED = 2.4

export function eventsPerSecond(entropy: number): number {
  const e = Math.max(0, Math.min(1, entropy))
  return RATE_CALM + (RATE_SEIZED - RATE_CALM) * e
}

/**
 * Relative weights at this entropy.
 *
 * Two thresholds, and both are §7.8.6 being specific about what escalation
 * means:
 *
 *  - **Small talk needs a little slack.** A calm floor is quiet, not sociable.
 *  - **Drive-bys are the high-entropy behaviour**, because walking to somebody
 *    else's desk to ask them something is the most expensive interruption in
 *    real life and should be the most expensive one here.
 *
 * Water is the one behaviour with a floor under it at every entropy: people
 * fetch drinks in a calm office too, and it is the only behaviour that is not
 * *about* communication. It is what stops a quiet floor being a still one.
 */
export const SMALLTALK_FROM = 0.15
export const DRIVEBY_FROM = 0.5

export function weightsFor(entropy: number): Record<Behaviour, number> {
  const e = Math.max(0, Math.min(1, entropy))
  return {
    chatter: 1,
    smalltalk: e < SMALLTALK_FROM ? 0 : 0.5 * (e - SMALLTALK_FROM),
    water: 0.35,
    driveby: e < DRIVEBY_FROM ? 0 : 1.4 * (e - DRIVEBY_FROM),
  }
}

/**
 * Choose a behaviour. `r` is a uniform 0..1 — injected rather than drawn here
 * so the choice is reproducible under test.
 */
export function pickBehaviour(entropy: number, r: number): Behaviour {
  const w = weightsFor(entropy)
  const order: Behaviour[] = ['chatter', 'smalltalk', 'water', 'driveby']
  const total = order.reduce((sum, k) => sum + w[k], 0)
  let acc = 0
  const target = Math.max(0, Math.min(1, r)) * total
  for (const k of order) {
    acc += w[k]
    if (target < acc) return k
  }
  return 'chatter'
}

/**
 * §7.8.6 rule 4 — **above rung 2 this switches off entirely.**
 *
 * Individual behaviours are meaningless when a person is two pixels, and the
 * failure mode being avoided is not cost but nonsense: a system running
 * invisibly is one that can go wrong invisibly. The floor tier and above get
 * their liveliness from §7.8.2's window flicker instead.
 */
export function ambientRuns(devs: number, drawnIndividually: boolean): boolean {
  return drawnIndividually && devs >= 2
}

/**
 * Should a new behaviour start this frame?
 *
 * Poisson-ish rather than a countdown: an interruption is not on a schedule,
 * and a timer that fires every N seconds reads as a metronome the second time
 * you watch it. `dt` is clamped because a tab returning from the background can
 * hand over a multi-second frame, and §7.8.6's floor should not erupt at the
 * moment the player looks back at it.
 */
export const MAX_STEP_SECONDS = 0.25

export function shouldStart(entropy: number, dt: number, r: number): boolean {
  const step = Math.max(0, Math.min(MAX_STEP_SECONDS, dt))
  return r < eventsPerSecond(entropy) * step
}
