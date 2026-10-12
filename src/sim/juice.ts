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

/** Most packets alive at once: one instanced mesh, one draw call, at a thousand developers or a billion. */
export const MAX_PACKETS = 48

/**
 * Most packets launched in a second. Half the instance budget, because a packet is in flight
 * about a second and a half and the other half is slack for ones still arriving when the rate
 * jumps; 24 a second is also about the most the eye can tell apart as separate things.
 */
export const MAX_PACKETS_PER_SECOND = 24

/**
 * How a rate of work becomes packets: how many to launch a second, and what each carries.
 *
 * **The product is the rate, always.** The same honesty rule as {@link assignStreams}: a flow that
 * shows a fortieth of the work being done lies more the more the studio grows. Below the cap one
 * packet is one point, so a lone developer's flow is countable and is the tutorial for what a
 * worker earns. Once the cap binds the packets get fatter in whole decades (1, 10, 100…) and the
 * count stays between a tenth of the cap and the cap — the unit changes with the scale, never the
 * crowd — and a decade is a number a numeral can say without a fraction.
 */
export function packetSpec(
  ratePerSecond: number,
  maxPerSecond: number = MAX_PACKETS_PER_SECOND,
): { perSecond: number; value: number } {
  if (!(ratePerSecond > 0) || !Number.isFinite(ratePerSecond)) return { perSecond: 0, value: 0 }
  const cap = Math.max(1, maxPerSecond)
  if (ratePerSecond <= cap) return { perSecond: ratePerSecond, value: 1 }
  const value = 10 ** Math.ceil(Math.log10(ratePerSecond / cap))
  return { perSecond: ratePerSecond / value, value }
}

/**
 * How high the backlog heap stands, in whole levels from 0 (nothing queued) to `levels - 1`.
 *
 * Logarithmic, so the heap reads as "a little, some, a lot, a mountain" and a queue of a billion
 * is not a skyscraper; it saturates at the top level rather than growing, because a pile that
 * outgrows the room stops being a picture of a backlog. Any positive queue is at least level 1:
 * a heap that vanishes while work is waiting would say the work had been done.
 */
export function backlogLevel(queued: number, levels = 5): number {
  if (!(queued > 0)) return 0
  const top = Math.max(1, Math.floor(levels) - 1)
  return Math.min(top, 1 + Math.floor(Math.log10(1 + queued)))
}

/** How long each of the unit flash's three colours holds. Three hard steps, as the HUD's hot edge. */
const UNIT_FLASH_STEP_MS = 90
/** The whole flash: 270 ms, inside §10.8 F6's 400 for an animation that is not a scored beat. */
export const UNIT_FLASH_MS = UNIT_FLASH_STEP_MS * 3

/**
 * Which of the flash's three colours a unit wears `ageMs` after its work completed — 0 the
 * neutral ramp's white, 1 light amber, 2 amber — or null before it begins and once it is over.
 * The same three steps the HUD's queue slots take (`gl-hot-slot`), moved from a bar to whatever
 * the lens is showing as the unit (a house, a lot): the reference game flashes the finished
 * *column*, not each of the people who filled it. Never a blend: a unit is one of the three
 * colours, or it is not flashing.
 *
 * Reduced motion keeps the information and drops the sequence: amber for as long.
 */
export function unitFlash(ageMs: number, reduced = false): 0 | 1 | 2 | null {
  if (!(ageMs >= 0) || ageMs >= UNIT_FLASH_MS) return null
  return reduced ? 2 : (Math.floor(ageMs / UNIT_FLASH_STEP_MS) as 0 | 1 | 2)
}
