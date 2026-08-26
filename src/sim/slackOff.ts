/**
 * Who is away from their desk, and what it costs — GDD §7.8.6, §7.8.9.
 *
 * **This file reverses §7.8.6 rule 2.** That rule said "nothing ambient ever
 * changes the simulation — not one Story Point, in either direction", and it
 * said why: *"the moment a water trip costs output, the player starts trying to
 * prevent water trips, and the game becomes about micro-managing forty walk
 * cycles."* The prediction was right. It is now the feature — the floor is a
 * minigame rather than evidence, on the user's instruction (2026-08-26), and
 * the GDD says so in its own words.
 *
 * What stops it being the disaster rule 2 feared is the shape of
 * {@link awayShare}: the away population is a **fraction of headcount**, so
 * dragging people back is a real lever for the first hour and a rounding error
 * by the time the studio is a thousand people. §11's Branch D is the exit, and
 * the exit is deliberately incomplete — see {@link ERRANDS}.
 *
 * ## The split with the renderer
 *
 * **This owns time; the renderer owns space.** An errand's travel window is a
 * constant here ({@link TRAVEL_SECONDS}) and not a function of how far the walk
 * turned out to be, because the alternative is a simulation that needs the
 * room's geometry to advance — and a headless tick would then leave the whole
 * studio stuck mid-corridor with the output to match. The renderer walks its
 * bodies at their own speed and stands them still at whichever end they reach
 * first, which is what §7.8.6's existing flat-middle walk already did.
 *
 * Pure, like every other file here: `dt` and `rng` arrive as arguments.
 */

/** Where somebody has gone instead of working. */
export type Errand = 'water' | 'whiteboard' | 'window' | 'sofa' | 'loiter'

/**
 * What an errand is worth having, in the two numbers that decide how much of
 * the studio is standing up at any moment.
 *
 * `heads` is how many people go together. The whiteboard's two-to-three is the
 * joke rather than a detail: one person at a whiteboard is thinking, three is a
 * meeting nobody called.
 */
export interface ErrandDef {
  /** Seconds spent standing at the far end, before turning round. */
  stand: number
  /** How many people go. A range, drawn per errand. */
  minHeads: number
  maxHeads: number
  /**
   * Does this errand need a prop that §7.8.1's crowding can take away, or that
   * §11's Branch D can delete?
   *
   * `loiter` is the one that does not, and that is load-bearing: it is why
   * Branch D can never drive the away population to zero, which is §7.8.9 rule
   * 2's "an automation upgrade for this would be the game solving its own joke"
   * kept as a mechanism rather than as a promise.
   */
  needsProp: boolean
}

export const ERRANDS: Readonly<Record<Errand, ErrandDef>> = {
  water: { stand: 7, minHeads: 1, maxHeads: 1, needsProp: true },
  whiteboard: { stand: 20, minHeads: 2, maxHeads: 3, needsProp: true },
  window: { stand: 14, minHeads: 1, maxHeads: 1, needsProp: true },
  sofa: { stand: 26, minHeads: 1, maxHeads: 1, needsProp: true },
  loiter: { stand: 18, minHeads: 1, maxHeads: 1, needsProp: false },
}

/** Every errand, once. Exhaustive by construction so a new one cannot be forgotten. */
export const ERRAND_KINDS = Object.keys(ERRANDS) as readonly Errand[]

/**
 * Relative likelihood of each errand, before entropy and before Branch D.
 *
 * Water leads because it is the trip §7.8.6 already had and the one people
 * recognise. The whiteboard is rarer than it looks here because it takes two or
 * three people every time it fires.
 */
const BASE_WEIGHTS: Readonly<Record<Errand, number>> = {
  water: 3,
  whiteboard: 1.6,
  window: 2,
  sofa: 1.2,
  loiter: 2,
}

/**
 * Nominal seconds walking, each way.
 *
 * A constant rather than a distance, for the reason in the module note. It is
 * also the number that decides how much of an errand is *travel* — at seven
 * seconds standing at a cooler, a five-second walk out means the water trip is
 * mostly walking, which is what a water trip looks like.
 */
export const TRAVEL_SECONDS = 5

/**
 * A tab returning from the background hands over a multi-second frame. Clamped
 * for the same reason §7.8.6 clamps its own step: the floor should not erupt at
 * the moment the player looks back at it, and — now that this costs Story
 * Points — a six-second catch-up step must not empty the office either.
 */
export const MAX_STEP_SECONDS = 0.25

/** The average errand, travel included. Used to turn a duty cycle into a rate. */
export const MEAN_ERRAND_SECONDS =
  2 * TRAVEL_SECONDS +
  ERRAND_KINDS.reduce((sum, k) => sum + ERRANDS[k].stand, 0) / ERRAND_KINDS.length

/**
 * §7.8.9 — **what fraction of the studio is not at its desk**, at this entropy.
 *
 * Stated as a duty cycle rather than as a spawn rate because the duty cycle is
 * the design claim. §7.8.9's table asks for roughly one to two per cent of
 * headcount in each of four idle states — about five per cent — **rising with
 * entropy**; two to ten brackets that, and the top of the range is §6 stated in
 * bodies: at `TOTAL GRIDLOCK` a tenth of the company is standing in a corridor.
 *
 * The spawn rate is a consequence of this and of {@link MEAN_ERRAND_SECONDS},
 * never a number of its own — see {@link advanceSlack}. Tuning the rate
 * directly is how the two quietly disagree and the floor ends up either empty
 * or deserted.
 */
export const SHARE_CALM = 0.02
export const SHARE_SEIZED = 0.1

export function awayShare(entropy: number): number {
  const e = Math.max(0, Math.min(1, entropy))
  return SHARE_CALM + (SHARE_SEIZED - SHARE_CALM) * e
}

/**
 * Below this nobody ever leaves their desk.
 *
 * One person alone cannot be interrupted — §7.8.6's own rule — and two cannot
 * afford it. It also keeps the first minutes of §21's script clean: the garage
 * is one developer and then two, and neither of them wandering off is a
 * mechanic the player has been shown yet.
 */
export const SLACK_MIN_DEVS = 3

export interface SlackContext {
  devs: number
  /** Studio-wide Communication Entropy, §4.3. */
  entropy: number
  /** §11 Branch D — multiplies {@link awayShare}. 1 is an unbought board. */
  slackShare?: number
  /** §11 Branch D — errands whose destination the studio has deleted. */
  blocked?: readonly Errand[]
  /**
   * Seats that never leave. James (§21.7.0) is the whole of this list today.
   *
   * A list rather than a boolean because the rule is about *seats*, and the
   * next character who earns the exemption should cost one array entry rather
   * than a second parallel mechanism.
   */
  pinned?: readonly number[]
}

/** How many people should be away right now. Not an integer; it is a target. */
export function awayTarget(ctx: SlackContext): number {
  const devs = Math.max(0, Math.floor(ctx.devs))
  if (devs < SLACK_MIN_DEVS) return 0
  const share = Math.max(0, ctx.slackShare ?? 1)
  return devs * awayShare(ctx.entropy) * share
}

/**
 * Errand weights, with Branch D's deletions applied.
 *
 * **Zeroed, not filtered afterwards**, for the reason `devStates.ts` gives for
 * `zeroTrust`: the probability mass a deleted errand was holding redistributes
 * across the ones that remain, rather than being re-rolled. The player who
 * removed the whiteboards gets people going to the window instead — which is
 * true to life and is why every Branch D node also cuts the share.
 */
export function errandWeights(ctx: SlackContext): Record<Errand, number> {
  const blocked = new Set(ctx.blocked ?? [])
  const out = {} as Record<Errand, number>
  for (const k of ERRAND_KINDS) out[k] = blocked.has(k) ? 0 : BASE_WEIGHTS[k]
  // `loiter` cannot be blocked. Standing about needs no furniture, so there is
  // nothing for a purchase to take away — see ErrandDef.needsProp.
  out.loiter = BASE_WEIGHTS.loiter
  return out
}

/** Pick an errand. `roll` is in [0, 1). */
export function pickErrand(ctx: SlackContext, roll: number): Errand {
  const w = errandWeights(ctx)
  const total = ERRAND_KINDS.reduce((sum, k) => sum + w[k], 0)
  if (total <= 0) return 'loiter'
  let acc = 0
  const target = Math.max(0, Math.min(1, roll)) * total
  for (const k of ERRAND_KINDS) {
    acc += w[k]
    if (target < acc) return k
  }
  return 'loiter'
}

/**
 * Where one person is in their errand.
 *
 * `carried` is its own phase rather than a flag, because the two things that
 * are true of a carried developer — no clock, and no walk — are exactly what a
 * phase is for, and a flag beside a phase is two states that can disagree.
 */
export type SlackPhase = 'out' | 'there' | 'back' | 'carried'

export interface Away {
  seat: number
  errand: Errand
  phase: SlackPhase
  /** Seconds spent in the current phase. */
  elapsed: number
  /**
   * A stable per-errand roll, so the renderer can pick *which* cooler and stick
   * with it. Kept here rather than in the renderer because a walker whose
   * destination is re-rolled per frame crosses the floor sideways.
   */
  pick: number
}

export interface SlackState {
  away: readonly Away[]
}

export function emptySlack(): SlackState {
  return { away: [] }
}

/** How many heads this state costs the studio. Every away developer, whatever the phase. */
export function awayHeads(s: SlackState): number {
  return s.away.length
}

/** Is this seat away from its desk? */
export function isAway(s: SlackState, seat: number): boolean {
  return s.away.some((a) => a.seat === seat)
}

export function awayAt(s: SlackState, seat: number): Away | undefined {
  return s.away.find((a) => a.seat === seat)
}

/** How long the current phase lasts. Infinite while carried — a held object has no clock. */
export function phaseLength(a: Away): number {
  switch (a.phase) {
    case 'out':
    case 'back':
      return TRAVEL_SECONDS
    case 'there':
      return ERRANDS[a.errand].stand
    case 'carried':
      return Infinity
  }
}

/**
 * Advance the whole away roster one step.
 *
 * Returns a new state; never mutates. Three things happen, in this order, and
 * the order matters: **expire, cull, then start**. Starting before culling
 * would let a roster that has just lost half its seats to a Paradigm Shift
 * spawn into indices that no longer exist.
 */
export function advanceSlack(
  s: SlackState,
  dtSeconds: number,
  ctx: SlackContext,
  rng: () => number = Math.random,
): SlackState {
  const dt = Math.max(0, Math.min(MAX_STEP_SECONDS, dtSeconds))
  const devs = Math.max(0, Math.floor(ctx.devs))
  const pinned = new Set(ctx.pinned ?? [])

  const next: Away[] = []
  for (const a of s.away) {
    // §26.2 — the roster outlives a headcount that shrank under it. A seat past
    // the end of the studio is not a person any more, so it is not a cost.
    if (a.seat >= devs) continue
    // James does not wander, and a save or a scenario that put him here anyway
    // is corrected on the next tick rather than trusted.
    if (pinned.has(a.seat)) continue

    const elapsed = a.elapsed + dt
    const life = phaseLength(a)
    if (elapsed < life) {
      next.push({ ...a, elapsed })
      continue
    }
    switch (a.phase) {
      case 'out':
        next.push({ ...a, phase: 'there', elapsed: 0 })
        break
      case 'there':
        next.push({ ...a, phase: 'back', elapsed: 0 })
        break
      case 'back':
        // Home. They are working again, so they leave the roster entirely.
        break
      case 'carried':
        next.push({ ...a, elapsed })
        break
    }
  }

  // --- starting new errands ------------------------------------------------
  //
  // The rate is derived from the duty cycle rather than chosen: how far the
  // floor is below its target, divided by how long an errand lasts. A floor at
  // target starts nothing; a floor that has just been tidied up by hand refills
  // over about one errand's length, which is the pace at which the player can
  // feel themselves losing ground without it being a treadmill.
  const target = awayTarget(ctx)
  const deficit = target - next.length
  if (deficit > 0 && devs >= SLACK_MIN_DEVS) {
    const expected = (deficit / MEAN_ERRAND_SECONDS) * dt
    if (rng() < expected) {
      const errand = pickErrand(ctx, rng())
      const want = headsFor(errand, rng())
      const taken = new Set(next.map((a) => a.seat))
      for (const p of pinned) taken.add(p)
      const pick = rng()
      for (let n = 0; n < want; n++) {
        const seat = freeSeat(devs, taken, rng)
        if (seat < 0) break
        taken.add(seat)
        next.push({ seat, errand, phase: 'out', elapsed: 0, pick })
      }
    }
  }

  return { away: next }
}

/** How many people go on this errand. */
export function headsFor(errand: Errand, roll: number): number {
  const { minHeads, maxHeads } = ERRANDS[errand]
  const span = maxHeads - minHeads + 1
  return minHeads + Math.min(span - 1, Math.floor(Math.max(0, Math.min(1, roll)) * span))
}

/**
 * Find a seat nobody has claimed.
 *
 * Bounded probing rather than a free list: at the worst duty cycle a tenth of
 * the seats are taken, so a handful of tries finds one almost always, and
 * giving up costs one errand that did not start.
 */
function freeSeat(devs: number, taken: ReadonlySet<number>, rng: () => number): number {
  for (let tries = 0; tries < 8; tries++) {
    const i = Math.floor(rng() * devs)
    if (!taken.has(i)) return i
  }
  return -1
}

// --- the drag ---------------------------------------------------------------

/**
 * §7.8.9 — pick somebody up. Returns the state unchanged if they cannot be.
 *
 * **This refuses nobody except a pinned seat**, which reverses §7.8.9's
 * blockquote ("somebody mid-behaviour is still refused"). That refusal existed
 * to stop a drag reading as an interruption rather than a tidy-up, and it was
 * the whole obstacle to the minigame the drag was supposed to be: a toy that
 * will not let you catch the person who is walking away is a toy with no verb.
 *
 * A developer lifted out of their chair joins the roster, so lifting somebody
 * who was working **starts costing output immediately**. That is the "distract
 * them" half of the request, priced honestly.
 *
 * **The one exception is James — §21.7.0 rule 6 — and it hardened on
 * 2026-08-26.** He could briefly be lifted and would snap back on release,
 * which is a fine beat and the wrong one: a rule stated by *undoing* the
 * player's gesture teaches them the gesture worked and then failed. He is now
 * never lifted at all, and `store.ts` answers the attempt in his own voice,
 * which says the same thing while being funny about it.
 *
 * Enforced here as well as at the call site because this is where the roster
 * lives. A refusal that only exists in the renderer is one a scenario, a save,
 * or the next call site can walk straight past.
 */
export function liftSlacker(
  s: SlackState,
  seat: number,
  roll = 0.5,
  pinned: readonly number[] = [],
): SlackState {
  if (seat < 0 || pinned.includes(seat)) return s
  const existing = s.away.find((a) => a.seat === seat)
  if (existing) {
    if (existing.phase === 'carried') return s
    return {
      away: s.away.map((a) =>
        a.seat === seat ? { ...a, phase: 'carried' as SlackPhase, elapsed: 0 } : a,
      ),
    }
  }
  // Lifted straight out of a chair. They enter as `carried`, and when they are
  // put down they walk home like anybody else — see `dropSlacker`.
  return {
    away: [...s.away, { seat, errand: 'loiter', phase: 'carried', elapsed: 0, pick: roll }],
  }
}

/**
 * Put them down.
 *
 * `onDesk` is whether the finger was over a desk. On a desk they sit down and
 * are working again; anywhere else they **walk home**, unhurried, and produce
 * nothing until they arrive. §7.8.9's "drop them anywhere else and they walk
 * back to wherever they were going, unhurried, which is funnier than obeying" —
 * now with the small difference that it is also more expensive.
 *
 * `pinned` seats are seated rather than sent walking — belt and braces. Since
 * 2026-08-26 they cannot be lifted at all ({@link liftSlacker}), so this branch
 * should be unreachable; it stays because a save or a scenario built before
 * that rule could still present a pinned seat mid-carry, and the correct
 * recovery is to put him back in his chair rather than walk him across the
 * floor. See §21.7.0 rule 6.
 */
export function dropSlacker(
  s: SlackState,
  seat: number,
  onDesk: boolean,
  pinned: readonly number[] = [],
): SlackState {
  const a = s.away.find((x) => x.seat === seat)
  if (!a) return s
  if (onDesk || pinned.includes(seat)) {
    return { away: s.away.filter((x) => x.seat !== seat) }
  }
  return {
    away: s.away.map((x) =>
      x.seat === seat ? { ...x, phase: 'back' as SlackPhase, elapsed: 0 } : x,
    ),
  }
}

/**
 * §7.8.6 rule 5 — a poke wins.
 *
 * The one rule of the old ambient layer that survives untouched: tapping
 * somebody sends them back to their desk, whatever they were doing. It is now
 * worth Story Points, which makes it a better rule rather than a different one.
 */
export function pokeHome(s: SlackState, seat: number): SlackState {
  return { away: s.away.filter((x) => x.seat !== seat) }
}
