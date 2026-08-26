/**
 * Ambient life, drawn — GDD §7.8.6.
 *
 * `sim/ambient.ts` decides *what* is happening and for how long; this decides
 * where the bodies are and what is over their heads. The split is the usual one
 * and it earns its keep here: the rules that matter — rate follows entropy,
 * drive-bys are the high-entropy behaviour — are testable without a renderer.
 *
 * **The bubbles carry text.** They were abstract dashes first, on the argument
 * that §19's sentences are a grey smear at the size one developer occupies —
 * which is true of §19's sentences and was the wrong conclusion. The fix is
 * shorter lines, not no lines: `chatter.ts` writes to about thirty characters,
 * which fits. This is the cheapest comedy surface in the product, one string
 * and no art, and a wordless bubble spends the whole animation and keeps none
 * of the joke.
 *
 * ## What left, on 2026-08-26
 *
 * §7.8.9's away population — the water trips and the loitering — moved to
 * `sim/slackOff.ts` and `render/errands.ts`, where it costs Story Points and
 * routes along the aisles instead of straight through the desks. So did the
 * drag: `hands` used to live here, and a toy that changes the economy belongs
 * next to the economy.
 *
 * **What is left is the free half**, and §7.8.6 rule 2 still governs it,
 * unamended, for these three behaviours: chatter and small talk never leave the
 * chair, and a drive-by is *work, badly done* — walking over to ask somebody a
 * question, which §4.1 already charges for as Entropy. A player who ignores any
 * of it still loses nothing.
 */

import { Container } from 'pixi.js'
import { chatterLine, exchange } from '../game/chatter.ts'
import {
  DURATION,
  PARTICIPANTS,
  ambientBudget,
  ambientRuns,
  pickBehaviour,
  shouldStart,
  type Behaviour,
} from '../sim/ambient.ts'
import { bubblesLegible, counterScale, createBubbles } from './bubble.ts'

const ZERO = { x: 0, y: 0 }

/** How far a walking developer stands from the thing they walked to. */
const STANDOFF = 18
/** Fraction of a walk spent travelling each way; the rest is standing there. */
const TRAVEL = 0.28

export interface Seat {
  x: number
  y: number
}

interface Live {
  kind: Behaviour
  /** What is said. One line, or two for an exchange. */
  says: readonly string[]
  /** Seat indices taking part. First is the instigator. */
  who: number[]
  /**
   * Where the instigator started, copied rather than looked up. The room
   * rebuilds its seat array on every hire, so an index captured now may point
   * somewhere else by the time this behaviour ends — and a walker whose origin
   * moved mid-trip snaps across the floor.
   */
  home: Seat
  /** Where a walker is going, in room-local coordinates. Null if nobody walks. */
  target: Seat | null
  age: number
  life: number
}

export interface Ambient {
  /** Bubbles, parented into the room so they share its transform. */
  readonly layer: Container
  /** Advance. `seats` are desk positions. */
  update(
    dt: number,
    opts: {
      seats: readonly Seat[]
      devs: number
      entropy: number
      drawnIndividually: boolean
      /** The tier's current on-screen scale, so bubbles keep a constant screen size. */
      worldScale: number
      /**
       * Seats the away population has taken — §7.8.9.
       *
       * Not a courtesy. `errands.ts` moves those bodies across the floor, and a
       * drive-by that started on somebody already at the cooler would draw them
       * in two places and bubble over the empty chair. One authority per body,
       * and for anybody on the roster it is not this one.
       */
      busySeats?: ReadonlySet<number>
    },
  ): void
  /** Room-local offset for the developer in seat `i`. Zero unless walking. */
  offsetFor(i: number): { x: number; y: number }
  /** §7.8.6 rule 5 — a poke wins. Ends whatever this developer was doing. */
  interrupt(i: number): void
  clear(): void
  destroy(): void
}

/**
 * Ease a walk out and back.
 *
 * Returns 0 at the desk and 1 at the destination. Flat in the middle, which is
 * the standing-around part — the whole joke of a drive-by is the pause at the
 * far end, not the walking.
 *
 * **Still a fraction of the behaviour's life rather than a speed**, unlike
 * `walkPath.ts`, and deliberately: a drive-by walks to a *neighbouring desk*,
 * which is a couple of tiles, so there is nothing for a route to route around
 * and no distance for a constant speed to make interesting.
 */
export function walkPhase(t: number): number {
  if (t <= 0 || t >= 1) return 0
  if (t < TRAVEL) return t / TRAVEL
  if (t > 1 - TRAVEL) return (1 - t) / TRAVEL
  return 1
}

/** A little vertical bounce, so a walker is walking rather than sliding. */
export function walkBob(t: number, moving: boolean): number {
  if (!moving) return 0
  return Math.abs(Math.sin(t * Math.PI * 14)) * 2.2
}

/**
 * @param rng Injected so the floor is reproducible under test.
 *
 * Not a testability nicety: the first version of the test suite asserted a hard
 * bound on how many people are up at once on a calm floor, against
 * `Math.random()`, and failed roughly one run in six. A statistical claim about
 * a random process either needs a seeded source or a bound so loose it asserts
 * nothing. Seeding it is the version that still catches a regression.
 */
export function createAmbient(rng: () => number = Math.random): Ambient {
  const layer = new Container()
  const bubbles = createBubbles()
  layer.addChild(bubbles.layer)

  const live: Live[] = []
  /** Seat index -> the behaviour occupying it, so nobody is double-booked. */
  const busy = new Map<number, Live>()

  function end(a: Live) {
    for (const i of a.who) if (busy.get(i) === a) busy.delete(i)
    const at = live.indexOf(a)
    if (at >= 0) live.splice(at, 1)
  }

  function freeSeat(seats: readonly Seat[], taken: ReadonlySet<number>): number {
    // Bounded probing rather than building a free list every frame: at the
    // budget's worst case twelve of a hundred seats are taken, so a handful of
    // tries finds one almost always and giving up costs nothing but one
    // behaviour that did not start.
    for (let tries = 0; tries < 8; tries++) {
      const i = Math.floor(rng() * seats.length)
      if (!busy.has(i) && !taken.has(i)) return i
    }
    return -1
  }

  function begin(kind: Behaviour, seats: readonly Seat[], taken: ReadonlySet<number>) {
    const first = freeSeat(seats, taken)
    if (first < 0) return
    const from = seats[first]
    // Drawn once, at the start, and held for the life of the behaviour: a line
    // re-rolled per frame would be a slot machine rather than a sentence.
    const pair = exchange(rng())
    const says = PARTICIPANTS[kind] === 2 ? pair : [chatterLine(rng())]

    const a: Live = {
      kind,
      says,
      who: [first],
      home: { x: from.x, y: from.y },
      target: null,
      age: 0,
      life: DURATION[kind],
    }

    if (PARTICIPANTS[kind] === 2) {
      // A conversation needs somebody to have it with. Small talk is with a
      // *neighbour* — the person you can turn to without getting up — while a
      // drive-by is somebody you had to walk to, which is exactly what makes it
      // the expensive one.
      const other =
        kind === 'smalltalk'
          ? [first - 1, first + 1].find(
              (j) => j >= 0 && j < seats.length && !busy.has(j) && !taken.has(j),
            ) ?? -1
          : freeSeat(seats, taken)
      if (other < 0 || other === first) return
      a.who.push(other)
      if (kind === 'driveby') a.target = { x: seats[other].x, y: seats[other].y }
    }

    for (const i of a.who) busy.set(i, a)
    live.push(a)
  }

  return {
    layer,

    update(dt, { seats, devs, entropy, drawnIndividually, worldScale, busySeats }) {
      bubbles.begin()
      const taken: ReadonlySet<number> = busySeats ?? EMPTY_SET

      if (!ambientRuns(devs, drawnIndividually) || seats.length === 0) {
        if (live.length > 0) {
          live.length = 0
          busy.clear()
        }
        bubbles.end()
        return
      }

      for (let i = live.length - 1; i >= 0; i--) {
        const a = live[i]
        a.age += dt
        // §7.8.9 — somebody the away roster has claimed since this started. The
        // errand layer is drawing their body now, so this one lets go rather
        // than bubbling over an empty chair.
        if (a.age >= a.life || a.who.some((j) => taken.has(j))) end(a)
      }

      if (live.length < ambientBudget(devs) && shouldStart(entropy, dt, rng())) {
        begin(pickBehaviour(entropy, rng()), seats, taken)
      }

      // --- bubbles ---------------------------------------------------------
      //
      // **A bubble nobody can read is not drawn.** §6.3 is that dialogue is the
      // product; a line of it rendered five pixels tall is not quiet dialogue,
      // it is a white smudge on somebody's desk, and at Floor there were a
      // dozen of them speckled over the plan looking like damage.
      //
      // The behaviours keep running underneath, so the walkers still walk and
      // the exchange the player zooms back into is the one that was already
      // happening.
      const inv = counterScale(worldScale)
      if (bubblesLegible(worldScale)) {
        for (const a of live) {
          const t = a.age / a.life
          for (const [n, i] of a.who.entries()) {
            const seat = seats[i]
            if (!seat) continue
            // Two people in a conversation alternate rather than both talking at
            // once. An exchange is what reads as a conversation; two simultaneous
            // bubbles read as two people talking past each other, which is a
            // different and much later joke.
            if (a.who.length === 2 && Math.floor(t * 4) % 2 !== n) continue

            // A bubble follows its speaker. The instigator of a walk is the one
            // who moves; everybody else bubbles over their own desk.
            const off = i === a.who[0] ? walkOffset(a, t) : ZERO
            bubbles.draw({
              x: seat.x + off.x,
              y: seat.y + off.y - 46,
              // Wall-clock, not a fraction of the behaviour's life. The pop used
              // to run over 12% of `a.life`, so a six-second exchange spent
              // seven hundred milliseconds zooming open and nine hundred zooming
              // shut — reported, accurately, as "they zoom and way too slow".
              ageMs: a.age * 1000,
              remainMs: (a.life - a.age) * 1000,
              says: a.says[n] ?? a.says[0],
              inv,
              tone: a.kind === 'driveby' ? 'warn' : 'speech',
            })
          }
        }
      }

      bubbles.end()
    },

    offsetFor(i) {
      const a = busy.get(i)
      if (!a || a.who[0] !== i) return ZERO
      return walkOffset(a, a.age / a.life)
    },

    interrupt(i) {
      const a = busy.get(i)
      if (a) end(a)
    },

    clear() {
      live.length = 0
      busy.clear()
      bubbles.clear()
    },

    destroy() {
      bubbles.destroy()
      layer.destroy({ children: true })
      live.length = 0
      busy.clear()
    },
  }
}

const EMPTY_SET: ReadonlySet<number> = new Set<number>()

/** Where a walking developer is, relative to the desk they left. */
export function walkOffset(
  a: { home: Seat; target: Seat | null },
  t: number,
): { x: number; y: number } {
  if (!a.target) return ZERO
  const p = walkPhase(t)
  if (p <= 0) return ZERO
  const dx = a.target.x - a.home.x
  const dy = a.target.y - a.home.y
  const d = Math.hypot(dx, dy) || 1
  // Stop short of the destination. Standing *inside* somebody else's desk is
  // not a clipping error the eye forgives.
  const reach = Math.max(0, d - STANDOFF) / d
  return {
    x: dx * reach * p,
    y: dy * reach * p - walkBob(t, p > 0 && p < 1),
  }
}
