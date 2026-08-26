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
 * ## What this is, since 2026-08-26
 *
 * §7.8.6 rule 2 was reversed that day and the away population moved out to
 * `sim/slackOff.ts`, where it costs Story Points. **What is left here is the
 * half that is still free**, and the line between them is not arbitrary:
 *
 *  - `chatter` and `smalltalk` never leave the chair.
 *  - `driveby` does leave it, and stays free anyway, because **a drive-by is
 *    work, badly done** — it is walking over to ask a colleague a question, and
 *    §4.1's Entropy already charges the studio for exactly that. The errand
 *    roster is people who are *not working*.
 *
 * `water` and `loiter` used to live here and are now errands — see
 * {@link Behaviour} for why they were deleted from the union rather than left
 * in it weighted zero.
 *
 * **`loiterCap` went with them.** It computed roughly four to fourteen per cent
 * of headcount, rising with entropy, floored at one and capped at eight, and all
 * of that reasoning survives in `slackOff.ts`'s `awayShare` — with the ceiling
 * deliberately dropped, because a cap of eight was a *rendering* budget and the
 * away population now costs Story Points at every headcount, including the ones
 * where no body is drawn at all.
 */

/**
 * What somebody is doing instead of working — the *free* half.
 *
 * `water` and `loiter` moved to `sim/slackOff.ts` on 2026-08-26 and are gone
 * from this union rather than left in it weighted zero. A dead member of a
 * union is a thing every switch in the codebase keeps handling for ever, and
 * the exhaustiveness test that was protecting them was the only caller left.
 */
export type Behaviour = 'chatter' | 'smalltalk' | 'driveby'

/** How many people one behaviour occupies. */
export const PARTICIPANTS: Record<Behaviour, number> = {
  chatter: 1,
  smalltalk: 2,
  driveby: 2,
}

/** Roughly how long each runs, in seconds. */
export const DURATION: Record<Behaviour, number> = {
  chatter: 2.6,
  smalltalk: 5.5,
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
 * Chatter is the one behaviour with a floor under it at every entropy: somebody
 * says something in a calm office too, and it is the punctuation that stops a
 * quiet floor being a silent one. (Water used to carry that job and now belongs
 * to `slackOff.ts`, which has its own floor under it for the same reason.)
 */
export const SMALLTALK_FROM = 0.15
export const DRIVEBY_FROM = 0.5

export function weightsFor(entropy: number): Record<Behaviour, number> {
  const e = Math.max(0, Math.min(1, entropy))
  return {
    chatter: 1,
    smalltalk: e < SMALLTALK_FROM ? 0 : 0.5 * (e - SMALLTALK_FROM),
    driveby: e < DRIVEBY_FROM ? 0 : 1.4 * (e - DRIVEBY_FROM),
  }
}

/**
 * Choose a behaviour. `r` is a uniform 0..1 — injected rather than drawn here
 * so the choice is reproducible under test.
 */
export function pickBehaviour(entropy: number, r: number): Behaviour {
  const w = weightsFor(entropy)
  // Every behaviour, and the list is exhaustive by type: a `Behaviour` added to
  // the union and forgotten here would be given a weight, tested for that
  // weight, and never once chosen.
  const order: Behaviour[] = ['chatter', 'smalltalk', 'driveby']
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

/**
 * How a speech bubble opens and shuts — GDD §8.3's tactile juice.
 *
 * **In wall-clock milliseconds, not as a fraction of the behaviour.** The pop
 * used to run over 12% of a behaviour's life, and a behaviour is seconds long:
 * a six-second exchange spent seven hundred milliseconds growing the bubble and
 * nine hundred shrinking it, with the words scaling along with the box. That is
 * a zoom, and it was reported as one. Speech does not zoom. It arrives.
 *
 * So: a hard snap open with a slight overshoot, a hold, and a shut that closes
 * vertically while staying wide — the shape a comic bubble makes, and the shape
 * a mouth makes. The whole opening is over in a tenth of a second, which is
 * about as long as it takes to notice something appeared.
 */
export const BUBBLE_IN_MS = 110
export const BUBBLE_OUT_MS = 90
/** How far past full size the snap overshoots. Enough to feel, not to notice. */
const BUBBLE_OVERSHOOT = 1.7

export interface BubblePop {
  /** Horizontal scale. */
  sx: number
  /** Vertical scale — this is the one that carries the snap. */
  sy: number
  /** Are the words up? They are either fully there or not there at all. */
  ink: boolean
}

/** Back-out easing: overshoots 1 and settles. The snap, in one line. */
function overshoot(u: number): number {
  const p = u - 1
  return 1 + (BUBBLE_OVERSHOOT + 1) * p * p * p + BUBBLE_OVERSHOOT * p * p
}

export function bubblePop(ageMs: number, remainMs: number): BubblePop {
  if (ageMs <= 0 || remainMs <= 0) return { sx: 0, sy: 0, ink: false }

  if (remainMs < BUBBLE_OUT_MS) {
    // Shutting. Vertical collapses and horizontal barely moves, so it reads as
    // a bubble snapping closed rather than as one receding into the distance.
    const v = remainMs / BUBBLE_OUT_MS
    return { sx: 0.55 + 0.45 * v, sy: v * v, ink: false }
  }

  if (ageMs < BUBBLE_IN_MS) {
    const u = ageMs / BUBBLE_IN_MS
    const s = overshoot(u)
    // The horizontal leads and the vertical overshoots, which is squash and
    // stretch on a box: it arrives wide and settles.
    return { sx: Math.min(1.06, 0.35 + u * 0.75), sy: s, ink: s > 0.72 }
  }

  return { sx: 1, sy: 1, ink: true }
}
