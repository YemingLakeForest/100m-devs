/**
 * The `+1` over each developer's head — GDD §8.2b.
 *
 * "A poke's numeral rises from where the finger landed. That is correct for the
 * *tap* and it is not enough for the *work*: developers generate story points
 * continuously whether or not anybody is poking them, and none of that is
 * visible."
 *
 * So every developer shows what they are earning, at the rate they are actually
 * earning it. Which makes this the display half of §4.9a — until now the
 * per-developer roll was a hidden number, and §4.9a is explicit that "a hidden
 * roll is indistinguishable from a random number generator nobody can see". One
 * developer emitting `+5` beside one emitting `+0.2` is the whole idea, on
 * screen, with no readout.
 *
 * Three constraints shape everything below.
 *
 * **It thins out as the floor fills — it does not stop.** Above the point where
 * individual numerals become noise the sources aggregate: per row of ten, then
 * per squad of a hundred, then per ten squads. The picture stays legible and
 * the information survives, which is the difference between thinning and
 * switching off. {@link groupSizeFor} is the whole of that rule.
 *
 * **It is a transform on a pooled sprite, never a per-developer allocation** —
 * §7.8.3's budget rule, and the reason this is not a hundred `Text` objects.
 * The pool is a fixed {@link MAX_TALLIES} entries, each holding a fixed row of
 * re-textured glyph sprites, so a full floor emitting continuously allocates
 * nothing at all after the first frame.
 *
 * **It is distinct from the poke numeral.** Smaller, quieter, one colour, no
 * §8.2a snippet: "passive output is quiet; a tap is an event." Sharing the
 * poke's typeface and stroke and nothing else is deliberate — they must read as
 * the same game and never as the same event.
 */

import { Container, Sprite, Text, type Renderer, type Texture } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/**
 * Most sources emitting at once — the point §8.2b calls "where individual
 * numerals become noise".
 *
 * **A hundred, and not fewer.** §8.2b names the picture it wants exactly: "a
 * hundred people each emitting `+1` while the total barely moves is the joke
 * the whole game is about, told without a number." So a hundred is the design
 * rather than the tolerance, and it happens to be §7.8.1a's squad — the largest
 * group of people who can see each other, which is also the largest group a
 * player can take in at once.
 *
 * A first pass at thirty-six looked reasonable in isolation and was wrong for a
 * reason no screenshot of it would show: the whole of Run 1 tops out at forty
 * developers, so it aggregated §21's *entire script* into four numerals of `+11`
 * and the per-person spread — the thing this exists to display — was never once
 * visible during the only act anybody has played.
 */
export const MAX_SOURCES = 100

/** Most numerals in flight. Sources × lifetime ÷ period, with headroom. */
export const MAX_TALLIES = 140

/**
 * Seconds between one source's emissions.
 *
 * Constant per *source*, which is what makes the rate legible: a developer
 * earning five times as much does not emit five times as often, they emit the
 * same `+` every second with a bigger number in it. Emitting more often would
 * read as the floor getting busier rather than as anybody getting better, and
 * §4.9a wants the *spread* visible, not the activity.
 */
export const TALLY_PERIOD = 1.15

export const TALLY_LIFE_MS = 1250
/** How far one rises over its life, in screen pixels. */
export const TALLY_RISE = 30

const TALLY_SIZE = 11
const GLYPHS = '0123456789+.KMBTQ'
/** Longest label the pool has to draw — `+1000Q` at the top of §7.7.1. */
const MAX_GLYPHS = 7

/**
 * How many developers one numeral speaks for, at this drawn headcount.
 *
 * Powers of ten, because §7.8.1a's structure is: a row is ten, a squad is a
 * hundred, a floor is ten thousand. Aggregating on anything else would put the
 * numeral over a group the player cannot see the edges of.
 */
export function groupSizeFor(drawn: number, cap: number = MAX_SOURCES): number {
  if (!Number.isFinite(drawn) || drawn <= 0) return 1
  const ceiling = Math.max(1, Math.floor(cap))
  let group = 1
  while (Math.ceil(drawn / group) > ceiling) group *= 10
  return group
}

/**
 * Most sources the §7.4 ladder allows at each rung — desk, squad, floor,
 * building.
 *
 * §8.2b thins by *how many people are drawn*, and that was the whole rule while
 * a floor was the only thing ever drawn. It stopped being enough the moment the
 * lens could stand outside the floor: a thousand seats are a thousand seats
 * whether they measure 2,700 pixels across or 334, so the same hundred numerals
 * that spread comfortably over a squad were stacked eight deep over a floor
 * plan the size of a postcard. Every screenshot above Squad was unreadable and
 * none of it was the room's fault.
 *
 * So the cap is the group you can see the edges of, which is exactly what §8.2b
 * asked for and is a property of the *lens*, not of the headcount:
 *
 * - **Desk** and **Squad** — you can see people, so a numeral is a person.
 *   {@link MAX_SOURCES} of them, unchanged, which keeps §21's whole script and
 *   §4.9a's per-developer spread exactly as they were.
 * - **Floor** — you can see squads and not faces. Ten numerals, one per squad,
 *   and because seats are laid out squad-major the aggregation lands on the
 *   squad rather than across two of them.
 * - **Building** — you can see floors. The pulled-out plan is one floor, so it
 *   gets one numeral: what this storey earns, over this storey.
 * - **Block** — you can see buildings, and the room draws one of them. The same
 *   argument lands on the same number: one numeral, over the floor you are
 *   standing in, because that is the only part of the block whose people this
 *   layer has. A numeral per *building* would be a lie — the layer speaks for
 *   the seats the room drew, and the room drew one storey of one tower.
 */
export const SOURCE_CAP: readonly number[] = [MAX_SOURCES, MAX_SOURCES, 10, 1, 1]

/** The cap for a continuous position on the ladder — see {@link SOURCE_CAP}. */
export function capForLevel(level: number): number {
  if (!Number.isFinite(level)) return MAX_SOURCES
  return SOURCE_CAP[rungOf(level)]
}

/**
 * How many seats the numeral layer speaks for at each rung, starting from the
 * squad the address is in.
 *
 * The cap alone gets the count right and the *placement* wrong. Inside a squad
 * the lens is over about a dozen people, but the grouping runs across a
 * thousand-seat floor, so a hundred sources means one numeral per row of ten —
 * and a row of ten is twenty-seven hundred pixels wide at Desk zoom. The
 * numeral lands on the mean of a row whose ends are both off screen, which is a
 * `+40` hovering over an empty patch of carpet.
 *
 * So the layer covers **the smallest group containing the address that it can
 * draw a member of**: the address's own squad at Desk and Squad, one numeral
 * each, exactly the hundred-people picture §8.2b asks for; the whole floor at
 * Floor and Building, where the members are squads and storeys and every one of
 * them is on screen anyway.
 *
 * Squad-aligned rather than centred on the seat, because §7.8.1a's squad is a
 * group with visible edges and a sliding window of a hundred is not: numerals
 * appearing and vanishing at a boundary that moves with the camera reads as a
 * rendering fault, and the same boundary held still reads as a team.
 */
export const SOURCE_SPAN: readonly number[] = [
  MAX_SOURCES,
  MAX_SOURCES,
  Infinity,
  Infinity,
  Infinity,
]

/** The span for a continuous position on the ladder — see {@link SOURCE_SPAN}. */
export function spanForLevel(level: number): number {
  if (!Number.isFinite(level)) return Infinity
  return SOURCE_SPAN[rungOf(level)]
}

function rungOf(level: number): number {
  return Math.max(0, Math.min(SOURCE_CAP.length - 1, Math.round(level)))
}

/**
 * The slice of seats the layer speaks for — the {@link SOURCE_SPAN} block the
 * address falls in, clamped to what is drawn.
 */
export function sourceWindow(drawn: number, at: number, span: number): { from: number; to: number } {
  const n = Math.max(0, Math.floor(drawn))
  if (!Number.isFinite(span) || span <= 0) return { from: 0, to: n }
  const seat = Math.max(0, Math.min(n - 1, Math.floor(at)))
  const from = Math.floor(seat / span) * span
  return { from, to: Math.min(n, from + span) }
}

/** Which seats emit, and how coarsely — see {@link SOURCE_CAP}, {@link SOURCE_SPAN}. */
export interface TallyPlan {
  /** Most numerals the layer may put in flight. Default {@link MAX_SOURCES}. */
  cap?: number
  /** First seat the layer speaks for. Default 0. */
  from?: number
  /** One past the last seat the layer speaks for. Default everything drawn. */
  to?: number
}

export interface TallySource {
  x: number
  y: number
  /** Story Points per second this numeral speaks for. */
  rate: number
}

/**
 * Group `drawn` seats into at most {@link MAX_SOURCES} emitting anchors.
 *
 * Pure, and separate from the layer, because the thinning rule is the part of
 * §8.2b with a right answer and the part worth testing without a renderer.
 *
 * The anchor is the mean of the group's seats rather than its first: a `+40`
 * over the left-hand end of a row reads as belonging to the person standing
 * there, which is the exact misreading aggregation is supposed to avoid.
 */
export function tallySources(
  seats: ReadonlyArray<{ x: number; y: number }>,
  drawn: number,
  rateFor: (index: number) => number,
  plan: TallyPlan = {},
): TallySource[] {
  const n = Math.min(seats.length, Math.max(0, Math.floor(drawn)))
  if (n === 0) return []

  const first = Math.max(0, Math.min(n, Math.floor(plan.from ?? 0)))
  const last = Math.max(first, Math.min(n, Math.floor(plan.to ?? n)))
  if (last === first) return []

  const group = groupSizeFor(last - first, plan.cap ?? MAX_SOURCES)
  const out: TallySource[] = []

  for (let from = first; from < last; from += group) {
    const to = Math.min(last, from + group)
    let x = 0
    let y = 0
    let rate = 0
    for (let i = from; i < to; i++) {
      x += seats[i].x
      y += seats[i].y
      rate += rateFor(i)
    }
    const count = to - from
    out.push({ x: x / count, y: y / count, rate })
  }

  return out
}

/**
 * Magnitudes, out to a quadrillion.
 *
 * One further than the HUD's, because this is a *rate* at a headcount the HUD
 * only ever shows as a count: §7.7.1's top rung is 10¹³ developers, so the
 * studio's velocity reaches into the quadrillions and a numeral that stopped at
 * T would read `+9999.0T` and run off the head it belongs to.
 */
const MAGNITUDES: ReadonlyArray<readonly [number, string]> = [
  [1e15, 'Q'],
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
]

/** `+1`, `+0.2`, `+4.1K` — short forms only; a tally is not a readout. */
export function formatTally(sp: number): string {
  const n = Math.abs(sp)
  for (const [at, suffix] of MAGNITUDES) {
    if (n < at) continue
    const scaled = n / at
    return `+${scaled < 10 ? scaled.toFixed(1) : Math.round(scaled)}${suffix}`
  }
  if (n >= 10) return `+${Math.round(n)}`
  if (n >= 1) return `+${n.toFixed(1).replace(/\.0$/, '')}`
  // Never `+0`. §25.1: a numeral announcing that nothing happened while the
  // simulation banks the points is the one thing feedback must not do — and at
  // this size it is the *slow* developer's whole characterisation.
  return `+${Math.max(0.01, n).toFixed(2)}`
}

/** Height above the anchor at `age`, 0..1 through the numeral's life. */
export function tallyRise(age: number): number {
  const t = Math.min(1, Math.max(0, age))
  // Decelerating, so it leaves the head quickly and then hangs where it can be
  // read. Linear reads as a balloon and an ease-in never clears the sprite.
  return TALLY_RISE * (1 - (1 - t) * (1 - t))
}

/** Opacity at `age`. Full for the first third, then out. */
export function tallyAlpha(age: number): number {
  const t = Math.min(1, Math.max(0, age))
  if (t < 0.34) return 1
  // `1 - (t - 0.34) / 0.66` is 2.2e-16 rather than 0 at t = 1, which is
  // invisible on screen and a permanently live pool slot in the layer below.
  if (t >= 1) return 0
  return Math.max(0, 1 - (t - 0.34) / 0.66)
}

interface Slot {
  root: Container
  glyphs: Sprite[]
  bornAt: number
  x: number
  y: number
  live: boolean
}

export interface TallyLayer {
  /** Parent this into the glass, above the world and below the poke numerals. */
  container: Container
  /**
   * Advance one frame. `sources` are in **screen** coordinates and their rates
   * are Story Points per second.
   *
   * Screen rather than world on purpose: §7.6a says legibility wins, and a
   * numeral that scaled with the camera would be four pixels tall at the rung
   * where a hundred of them appear at once.
   */
  update(now: number, dt: number, sources: ReadonlyArray<TallySource>): void
  destroy(): void
}

export function createTallies(renderer: Renderer): TallyLayer {
  const root = new Container()
  const glyphs = new Map<string, Texture>()
  const owned: Texture[] = []

  // One size, one colour, sixteen glyphs — sixteen textures, baked once. The
  // poke numeral needs three colours and two sizes because it is an event with
  // states; this is a heartbeat and has one.
  const colour = c(RAMPS.CALM[1])
  for (const glyph of GLYPHS) {
    const text = new Text({
      text: glyph,
      style: {
        fontFamily: 'Departure Mono, monospace',
        fontSize: TALLY_SIZE,
        fill: colour,
        // Thinner than the poke's outline: this sits over the desks constantly
        // and a heavy stroke at this size turns the floor into a stencil.
        stroke: { color: c(RAMPS.NEUTRAL[0]), width: 2.5 },
      },
    })
    const texture = renderer.generateTexture(text)
    text.destroy()
    owned.push(texture)
    glyphs.set(glyph, texture)
  }

  const advance = TALLY_SIZE * 0.72

  const slots: Slot[] = []
  for (let i = 0; i < MAX_TALLIES; i++) {
    const holder = new Container()
    holder.visible = false
    const row: Sprite[] = []
    for (let g = 0; g < MAX_GLYPHS; g++) {
      const sprite = new Sprite()
      sprite.visible = false
      holder.addChild(sprite)
      row.push(sprite)
    }
    root.addChild(holder)
    slots.push({ root: holder, glyphs: row, bornAt: 0, x: 0, y: 0, live: false })
  }

  /**
   * Seconds of output each source has banked but not yet shown.
   *
   * Seeded with a per-source offset rather than zero: without it every numeral
   * on the floor is emitted on the same frame and the whole thing pulses in
   * unison, which reads as a scripted effect rather than as people working.
   */
  let accumulators: Float64Array = new Float64Array(0)

  function resize(count: number) {
    if (accumulators.length === count) return
    const next = new Float64Array(count)
    for (let i = 0; i < count; i++) {
      next[i] = i < accumulators.length ? accumulators[i] : ((i * 0.618034) % 1) * TALLY_PERIOD
    }
    accumulators = next
  }

  function emit(now: number, x: number, y: number, sp: number) {
    const slot = slots.find((s) => !s.live)
    // Full pool. Dropping the newest is right: the oldest is mid-read, and
    // interrupting a numeral somebody is looking at to start one they are not
    // is the wrong trade at exactly the headcount where the pool fills.
    if (!slot) return

    const label = formatTally(sp)
    for (let i = 0; i < MAX_GLYPHS; i++) {
      const sprite = slot.glyphs[i]
      const texture = i < label.length ? glyphs.get(label[i]) : undefined
      sprite.visible = texture !== undefined
      if (texture) {
        sprite.texture = texture
        sprite.x = i * advance
      }
    }
    // Centred on the head rather than starting at it, so a `+0.2` and a `+4.1K`
    // rise from the same place instead of drifting right as the number grows.
    slot.root.pivot.set((Math.min(MAX_GLYPHS, label.length) * advance) / 2, 0)
    slot.bornAt = now
    slot.x = x
    slot.y = y
    slot.live = true
    slot.root.visible = true
  }

  return {
    container: root,

    update(now, dt, sources) {
      resize(sources.length)

      for (let i = 0; i < sources.length; i++) {
        const source = sources[i]
        if (!(source.rate > 0)) continue
        accumulators[i] += dt
        if (accumulators[i] < TALLY_PERIOD) continue
        accumulators[i] -= TALLY_PERIOD
        emit(now, source.x, source.y, source.rate * TALLY_PERIOD)
      }

      for (const slot of slots) {
        if (!slot.live) continue
        const age = (now - slot.bornAt) / TALLY_LIFE_MS
        if (age >= 1) {
          slot.live = false
          slot.root.visible = false
          continue
        }
        slot.root.position.set(slot.x, slot.y - tallyRise(age))
        slot.root.alpha = tallyAlpha(age)
      }
    },

    destroy() {
      for (const texture of owned) texture.destroy(true)
      owned.length = 0
      glyphs.clear()
      root.destroy({ children: true })
    },
  }
}
