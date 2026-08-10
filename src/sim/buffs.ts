/**
 * The poke as a buff — GDD §4.5a, R14.
 *
 * §4.5's tap "pays out once and is forgotten. That is a clicker, and it is the
 * shallow half of one: the tap is worth the same whoever you aim it at, so
 * there is no reason to aim." §4.5a's replacement is that **a poke raises that
 * unit's own output rate, for a while**, and everything interesting follows
 * from the decay: a tap that pays instantly rewards a macro, a tap that fades
 * rewards attention.
 *
 * ## The architectural problem, which §4.5a states rather than hides
 *
 * > The store currently models **one** dev-state machine for the whole studio.
 * > A per-employee buff needs per-employee state. That is the first thing this
 * > requires and there is no way around it: a shared machine cannot hold a buff
 * > belonging to seat 41.
 *
 * And the studio reaches 10¹² developers, so a table with a row per developer
 * is not available. What is available is that **the player can only have poked
 * a few of them recently**: the overlay is sparse, capped at {@link MAX_BUFFS}
 * entries, and every entry decays itself out of existence. A studio of ten
 * trillion carries at most sixty-four small objects, and usually none.
 *
 * ## The strength is derived, not tuned — and that is what protects §4.10
 *
 * A buff of strength `s` on a unit producing `u` story points per second
 * delivers `s · u · τ` points over its life. So the conversion runs the other
 * way: given the story points §4.5's formula already produced, solve for the
 * strength that pays them back.
 *
 *     s = value / (u · τ)
 *
 * **This is the whole reason the economy does not need rebalancing.** §4.5a is
 * explicit that "4.7's dev states still scale it, 4.6's Fibonacci ladder still
 * sets the base, and 4.1's Entropy still taxes it. What changes is the
 * *destination* of the number, not the formula that produces it" — so a poke is
 * worth exactly what §4.10 was calibrated on, and only its *arrival* is spread
 * over a few seconds. Picking a percentage out of the air instead would have
 * been a silent rebalance of Run 1, which is the mistake `output.ts` documents
 * at length and pins the mean twice to avoid.
 *
 * It also delivers §4.5b's rule for free. A unit of `n` people produces roughly
 * `n` times as much, and §4.8's reach makes the poke worth roughly `Z(n)·n`
 * times as much, so `s ∝ Z(n)·n / n = Z(n)`: **the buff percentage falls as the
 * unit grows, on exactly the shape §4.5b names**, without a second curve to
 * tune or to disagree with the first.
 *
 * Pure and dependency-free — it does not know what a developer is worth
 * (§4.9a), only how to ask.
 */

/** One buffed unit. Identified by where it sits on §7.7.1's ladder. */
export interface Buff {
  /** The rung whose unit was poked — with `index`, which seats it covers. */
  rung: number
  /** Which unit at that rung. */
  index: number
  /** The lift on that unit's output right now. 0.5 is +50%. */
  strength: number
}

/**
 * How quickly a buff forgets, in seconds.
 *
 * The knob §4.5a's loop turns on: "the buff fades, so the loop is *maintain the
 * people who are worth maintaining* rather than tap the screen as fast as
 * possible." Five seconds puts a buff's useful life at about fifteen (it is
 * dropped at {@link MIN_STRENGTH} of its peak), which is long enough that a
 * player can hold a handful of targets up by rotating and short enough that
 * walking away loses them.
 *
 * **Changing it cannot change what a poke is worth** — the strength is solved
 * against this same constant — so it is a pacing knob and not a balance one.
 * That is deliberate: §25.2's rule is that numbers wanting play-testing should
 * be safe to play-test.
 */
export const BUFF_TAU = 5

/**
 * The most any one unit can be lifted, as a multiple of its own output.
 *
 * A ceiling is needed because `u` is in the denominator: one developer out of a
 * hundred thousand produces a vanishing amount, and dividing by it would hand
 * that seat a strength in the thousands. +300% is well past anything reachable
 * in normal play at a scale where the individual is visible.
 *
 * **What the clamp catches is paid out rather than lost** — see {@link addBuff}.
 */
export const MAX_STRENGTH = 3

/**
 * How many buffed units the overlay will hold.
 *
 * The bound is the point of the design, not a safety net: without it, a floor
 * of ten thousand poked steadily grows ten thousand entries, and the §23.3
 * frame budget pays for all of them every tick. Sixty-four is far more than the
 * handful §4.5a's maintenance loop asks a player to juggle.
 */
export const MAX_BUFFS = 64

/**
 * The strength below which a buff is dropped.
 *
 * Half a per cent is invisible in every readout the game has, and keeping it
 * would mean an entry lives for as long as floating point can halve it.
 */
const MIN_STRENGTH = 0.005

/** The seats a unit covers. Kept local so this module stays dependency-free. */
function seatRange(rung: number, index: number, devs: number): { from: number; to: number } {
  // §7.7.1's headcount bands, the same table `units.ts` reads. Duplicated as a
  // one-line lookup rather than imported because `units.ts` imports the ladder,
  // and this module is on the tick path.
  const size = UNIT_SIZE[Math.max(0, Math.min(UNIT_SIZE.length - 1, Math.floor(rung)))]
  const n = Math.max(0, Math.floor(devs))
  const from = Math.min(n, Math.max(0, Math.floor(index)) * size)
  return { from, to: Math.min(n, from + size) }
}

const UNIT_SIZE: readonly number[] = [1, 1, 1, 1e3, 1e4, 1e5, 1e6, 1e8, 1e10, 1e13]

/**
 * Buff a unit with the story points a poke produced.
 *
 * Returns the new overlay and the **overflow** — the points the buff could not
 * take, which the caller pays out immediately instead. Nothing is lost in
 * either direction, which is what makes "a poke is worth what §4.5 says it is"
 * an invariant rather than an intention.
 */
export function addBuff(
  buffs: readonly Buff[],
  at: { rung: number; index: number },
  value: number,
  unitOutput: number,
): { buffs: Buff[]; overflow: number } {
  if (!(value > 0)) return { buffs: [...buffs], overflow: 0 }

  // §6.3 — a seized studio produces nothing, so there is no rate to raise by a
  // percentage and the points land as §4.5's one-off. A player in Entropy Lock
  // still cannot tap their way out; this changes where the tap goes, not
  // whether it works.
  if (!(unitOutput > 0)) return { buffs: [...buffs], overflow: value }

  const rung = Math.floor(at.rung)
  const index = Math.floor(at.index)
  const perStrength = unitOutput * BUFF_TAU

  const next = buffs.map((b) => ({ ...b }))
  const existing = next.find((b) => b.rung === rung && b.index === index)
  const held = existing ? existing.strength : 0

  // The ceiling applies to the *total* on the unit, so topping up a buff that
  // is already at the cap overflows entirely — which is the mashing case, and
  // it degrades into exactly the pre-R14 behaviour rather than into nothing.
  const room = Math.max(0, MAX_STRENGTH - held)
  const wanted = value / perStrength
  const taken = Math.min(room, wanted)
  const overflow = (wanted - taken) * perStrength

  if (taken > 0) {
    if (existing) existing.strength = held + taken
    else next.push({ rung, index, strength: taken })
  }

  if (next.length > MAX_BUFFS) {
    // Evict the weakest of the *others*. What the player is actively
    // maintaining is by definition the strongest, so the entry that goes is one
    // that was about to decay away anyway — the loss is bounded by
    // MIN_STRENGTH's neighbourhood and is the price of the overlay being
    // bounded at all.
    //
    // **Never the buff just added**, which is what excluding the last entry
    // buys. A fresh poke lands at the same strength as sixty-three others, so a
    // plain "drop the smallest" ties with them and — the array being in
    // insertion order — drops the newest. The player would have tapped a
    // developer and watched nothing happen, at exactly the moment the overlay
    // is busiest and they are least able to tell why.
    let worst = 0
    for (let i = 1; i < next.length - 1; i++) {
      if (next[i].strength < next[worst].strength) worst = i
    }
    next.splice(worst, 1)
  }

  return { buffs: next, overflow }
}

/**
 * Advance every buff by `dt` seconds, dropping the ones that have faded.
 *
 * Exponential, so a buff never quite reaches zero and the cutoff is what ends
 * it. The buffs that were dropped come back **with the strength they still
 * had**, because that strength is story points the poke was promised and has
 * not been paid.
 *
 * It is a small quantity — {@link MIN_STRENGTH} of the peak — and that is
 * exactly why it is worth returning rather than discarding. The proportion lost
 * is `MIN_STRENGTH / peak`, and the peak is larger for a smaller unit, so
 * swallowing it would make a poke worth measurably less at forty developers
 * than at forty thousand. A leak that *moves with headcount* is the shape of
 * silent rebalance `output.ts` pins the mean twice to rule out, and the fix is
 * the same one `addBuff` already uses for the strength ceiling: hand it back.
 */
export function decayBuffs(
  buffs: readonly Buff[],
  dt: number,
): { buffs: Buff[]; dropped: Buff[] } {
  if (buffs.length === 0) return { buffs: [], dropped: [] }
  const k = Math.exp(-Math.max(0, dt) / BUFF_TAU)

  const out: Buff[] = []
  const dropped: Buff[] = []
  for (const b of buffs) {
    const strength = b.strength * k
    if (strength >= MIN_STRENGTH) out.push({ ...b, strength })
    else dropped.push({ ...b, strength })
  }
  return { buffs: out, dropped }
}

/**
 * The total lift on one seat — GDD §4.5b, "the buff applies to everything
 * inside it".
 *
 * Buffs at different rungs stack: a developer who is personally poked *and*
 * sits on a buffed floor carries both, which is the composition §4.5b wants and
 * the reason the overlay is keyed by rung rather than flattened to seats.
 */
export function strengthOnSeat(buffs: readonly Buff[], seat: number, devs: number): number {
  let total = 0
  for (const b of buffs) {
    const { from, to } = seatRange(b.rung, b.index, devs)
    if (seat >= from && seat < to) total += b.strength
  }
  return total
}

/**
 * What the overlay does to the studio's velocity, as a fraction — 0.05 is +5%.
 *
 * `shareSum(from, to)` is §4.9a's shares summed over a seat range: how much of
 * the studio's output those seats actually produce. Passed in rather than
 * imported so this module stays pure, and so the caller can be the one thing
 * that knows about the run seed.
 *
 * **It agrees with {@link strengthOnSeat} by construction**, because both are
 * the same sum grouped differently — and `units.ts` guarantees the seat ranges
 * tile the studio, so no developer is counted twice. That agreement is what
 * keeps §8.2b's numerals over forty heads adding up to the VELOCITY readout
 * above them; §25.1 is about what happens when two readouts of one quantity
 * disagree.
 */
export function buffLift(
  buffs: readonly Buff[],
  devs: number,
  shareSum: (from: number, to: number) => number,
): number {
  if (!(devs > 0) || buffs.length === 0) return 0

  let lift = 0
  for (const b of buffs) {
    const { from, to } = seatRange(b.rung, b.index, devs)
    if (to > from) lift += b.strength * shareSum(from, to)
  }
  return lift / devs
}
