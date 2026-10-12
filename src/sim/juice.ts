/**
 * The juice kit's pure half — what a numeral weighs, how a pop steps, who a numeral speaks for,
 * and which part of a bar is new. GDD §8.2 / §8.2a (the numeral), §10.8a (the vocabulary).
 *
 * Every number in here exists to answer one observation from the 1 Million Books study
 * (docs/PLAN-2026-10-11-juice-layer.md): that game never shows ten thousand small `+1`s. It
 * changes what one event *looks like* at each size of the world, and it never lets the numbers on
 * screen stop adding up to the work being done. Everything here is stepped and whole-pixel,
 * because ART_DIRECTION §3 forbids anti-aliased type and the interface's whole motion grammar is
 * `steps(n, end)`: an effect arrives in hard frames and is gone, it is never eased or faded in.
 */

/** Pixels a numeral grows per decade of yield. Even, so the face stays on its pixel grid. */
const SIZE_STEP = 2

/**
 * Decades of yield that still change the size. Three, so `+1` and `+1,000` are visibly different
 * things and `+1e15` is not a banner: a numeral is a sticker on the glass (pokeText.ts), and the
 * biggest one is still only six pixels taller than the smallest.
 */
const MAX_TIERS = 3

/** Which decade of yield a numeral is, 0 (under ten) to {@link MAX_TIERS}. A loss counts by cost. */
export function numeralTier(sp: number): number {
  const n = Math.abs(sp)
  // `!(n >= 10)` rather than `n < 10`: NaN is a numeral that has nothing to say, so it stays small.
  if (!(n >= 10)) return 0
  return Math.min(MAX_TIERS, Math.floor(Math.log10(n)))
}

/**
 * A numeral's size from what it carries.
 *
 * **Absolute, not relative to recent yields**, which was the alternative: a relative size would
 * make the biggest tap of the minute always look the same, and the whole point is that +8 and
 * +8,000 should not. It saturates late in a run, where every tap is huge, and that is fine —
 * at that scale the numerals are the aggregated ones from {@link assignStreams}, and a crit
 * (`pokeText.ts`) is bigger by base size, not by tier.
 */
export function numeralSize(sp: number, base: number): number {
  return base + SIZE_STEP * numeralTier(sp)
}

/** Where the pop turns from the small first frame to the overshoot, and where it rests. */
const POP_SMALL_UNTIL_MS = 55
const POP_REST_AT_MS = 110

/**
 * The arrival of a numeral: one small frame, one big one, then its own size. Three hard sizes and
 * nothing between them — GDD §10.8a's "bars squash and stretch" in the grammar the HUD already
 * speaks (`gl-pop`, `steps(4, end)`) — and 110 ms in all, inside §10.8 F6's 400.
 *
 * Reduced motion drops the movement and keeps the numeral (§10.5 rule 3).
 */
export function popScale(ageMs: number, reduced = false): number {
  if (reduced) return 1
  if (ageMs < POP_SMALL_UNTIL_MS) return 0.75
  if (ageMs < POP_REST_AT_MS) return 1.25
  return 1
}

/**
 * Most streams the screen carries. Twelve, because a numeral lives 1.3 s and a stream may emit
 * every 0.65 s, so twelve streams is the 24 alive that `passiveWork.ts` always capped at.
 */
export const MAX_STREAMS = 12

/** One voice on the glass: everyone it speaks for, and what they make between them. */
export interface Stream {
  key: string
  /** Story points per second, the members' rates summed. Display-only, like all of passive work. */
  rate: number
  /** Seats, ascending. The numeral rises over each of them in turn. */
  members: number[]
}

/**
 * Who each numeral speaks for.
 *
 * **The numerals have to add up.** Passive work used to give every worker a numeral of their own
 * and cap the screen at 24, so a hundred visible people showed a quarter of the work they were
 * doing and a thousand showed a fortieth: the more the studio grew, the more the feedback lied.
 * The reference game's answer is one numeral per sweep, not per sprite, and this is the same: past
 * {@link MAX_STREAMS} people share streams, each stream's numeral carries the sum, and the
 * numerals on screen total the work being done at any headcount.
 *
 * Streams are keyed by `seat mod MAX_STREAMS`, not by position in the list, so a worker stays in
 * the same stream while the camera pans and the crowd around them changes (the visible list is
 * rebuilt every 250 ms). The one seam is at {@link MAX_STREAMS} people exactly, where everybody
 * stops having a stream to themselves; credit is display-only, so the few numerals that stand in
 * the seam are allowed to be wrong for a moment.
 */
export function assignStreams(
  people: readonly { seat: number; rate: number }[],
  max: number = MAX_STREAMS,
): Stream[] {
  const cap = Math.max(1, Math.floor(max))
  const own = people.length <= cap
  const by = new Map<string, Stream>()
  for (const p of people) {
    // `((n % m) + m) % m`: James and the founder sit on negative seats, and JS's `%` keeps the sign.
    const key = own ? `s${p.seat}` : `b${((p.seat % cap) + cap) % cap}`
    const stream = by.get(key)
    if (stream) {
      stream.rate += p.rate
      stream.members.push(p.seat)
    } else by.set(key, { key, rate: p.rate, members: [p.seat] })
  }
  const streams = [...by.values()]
  for (const s of streams) s.members.sort((a, b) => a - b)
  return streams
}

/**
 * The segments of a stepped bar that have just come on — the ones that arrive in the ramp's
 * lightest value and settle (`graph.css`, `gl-hot`). The reference game's progress bar does this
 * with a white-hot leading edge; the HUD has no white, so it is `--p3`, which is the lightest
 * thing the interface is allowed to be. A bar that held still, drained or reset has no new part.
 */
export function hotSegments(prevOn: number, on: number): { from: number; to: number } | null {
  return on > prevOn ? { from: prevOn, to: on } : null
}
