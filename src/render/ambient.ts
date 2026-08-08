/**
 * Ambient life, drawn — GDD §7.8.6.
 *
 * `sim/ambient.ts` decides *what* is happening and for how long; this decides
 * where the bodies are and what is over their heads. The split is the usual one
 * and it earns its keep here: the rules that matter — rate follows entropy,
 * drive-bys are the high-entropy behaviour, nothing touches the simulation —
 * are all testable without a renderer.
 *
 * **The bubbles carry text.** They were abstract dashes first, on the argument
 * that §19's sentences are a grey smear at the size one developer occupies —
 * which is true of §19's sentences and was the wrong conclusion. The fix is
 * shorter lines, not no lines: `chatter.ts` writes to about thirty characters,
 * which fits. This is the cheapest comedy surface in the product, one string
 * and no art, and a wordless bubble spends the whole animation and keeps none
 * of the joke.
 *
 * Text is baked to a texture once per line and cached, never constructed per
 * frame — there are at most twelve bubbles up at a time (§7.8.6 rule 3) and
 * about forty distinct lines, so the cache is small and warm within a minute.
 *
 * §7.8.6 rule 2 is the one to protect: **nothing here is ever read back by the
 * simulation**. This module exports no state and the room never asks it a
 * question — it only tells it how much time has passed.
 */

import { Container, Graphics, Text } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import { chatterLine, exchange, loiterLine } from '../game/chatter.ts'
import {
  DURATION,
  PARTICIPANTS,
  ambientBudget,
  ambientRuns,
  pickBehaviour,
  shouldStart,
  type Behaviour,
} from '../sim/ambient.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

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
  /**
   * Advance. `seats` are desk positions, `props` are walkable destinations
   * (the cooler, the coffee machine) — empty if §7.8.1's crowding has taken
   * the walkway, which correctly stops the trips with it.
   */
  update(
    dt: number,
    opts: {
      seats: readonly Seat[]
      props: readonly Seat[]
      devs: number
      entropy: number
      drawnIndividually: boolean
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
 * the standing-around part — the whole joke of a water trip is the pause at the
 * far end, not the walking.
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
  const g = new Graphics()
  layer.addChild(g)

  const live: Live[] = []
  /** Seat index -> the behaviour occupying it, so nobody is double-booked. */
  const busy = new Map<number, Live>()

  /**
   * Speech-bubble labels, pooled **per instance**.
   *
   * `Text` is expensive to construct and cheap to move, so they are made once,
   * parked, and re-pointed at whatever is being said this frame. At most twelve
   * bubbles exist at once (§7.8.6 rule 3), so the pool never grows past about
   * that.
   *
   * Instance-local rather than module-local, which was the first draft: a
   * shared pool would have two rooms writing over each other's words, and
   * `destroy` on one would take the other's labels with it.
   */
  const labels: Text[] = []
  let labelsUsed = 0
  /**
   * Set once if `Text` cannot be constructed — which happens wherever there is
   * no canvas to measure against. The bubble then draws without words rather
   * than throwing, so the *behaviour* stays testable headlessly and a real
   * device that somehow fails to make a Text loses the joke rather than the
   * frame.
   */
  let textUnavailable = false

  function label(text: string): Text | null {
    if (textUnavailable) return null
    let t = labels[labelsUsed]
    if (!t) {
      try {
        t = new Text({
          style: {
            // ART_DIRECTION §3 — the one face. The generic fallback matters:
            // the woff2 may not have loaded, and a missing font must degrade to
            // the wrong monospace rather than to no words at all.
            fontFamily: 'Departure Mono, monospace',
            fontSize: 9,
            fill: 0xffffff,
          },
        })
        t.anchor.set(0.5, 0)
      } catch {
        textUnavailable = true
        return null
      }
      labels.push(t)
      layer.addChild(t)
    }
    labelsUsed++
    if (t.text !== text) t.text = text
    t.visible = true
    return t
  }

  function hideLabels(from = 0) {
    for (let i = from; i < labels.length; i++) labels[i].visible = false
  }

  function end(a: Live) {
    for (const i of a.who) if (busy.get(i) === a) busy.delete(i)
    const at = live.indexOf(a)
    if (at >= 0) live.splice(at, 1)
  }

  function freeSeat(seats: readonly Seat[]): number {
    // Bounded probing rather than building a free list every frame: at the
    // budget's worst case twelve of a hundred seats are taken, so a handful of
    // tries finds one almost always and giving up costs nothing but one
    // behaviour that did not start.
    for (let tries = 0; tries < 8; tries++) {
      const i = Math.floor(rng() * seats.length)
      if (!busy.has(i)) return i
    }
    return -1
  }

  function begin(kind: Behaviour, seats: readonly Seat[], props: readonly Seat[]) {
    const first = freeSeat(seats)
    if (first < 0) return
    const from = seats[first]
    // Drawn once, at the start, and held for the life of the behaviour: a line
    // re-rolled per frame would be a slot machine rather than a sentence.
    const pair = exchange(rng())
    const says =
      PARTICIPANTS[kind] === 2 ? pair : [kind === 'water' ? loiterLine(rng()) : chatterLine(rng())]

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
          ? [first - 1, first + 1].find((j) => j >= 0 && j < seats.length && !busy.has(j)) ?? -1
          : freeSeat(seats)
      if (other < 0 || other === first) return
      a.who.push(other)
      if (kind === 'driveby') a.target = { x: seats[other].x, y: seats[other].y }
    }

    if (kind === 'water') {
      if (props.length === 0) return
      const at = props[Math.floor(rng() * props.length)]
      a.target = { x: at.x, y: at.y }
    }

    for (const i of a.who) busy.set(i, a)
    live.push(a)
  }

  return {
    layer,

    update(dt, { seats, props, devs, entropy, drawnIndividually }) {
      g.clear()
      // Labels are claimed from the pool as bubbles are drawn; whatever is left
      // over from last frame gets hidden at the end.
      labelsUsed = 0

      if (!ambientRuns(devs, drawnIndividually) || seats.length === 0) {
        if (live.length > 0) {
          live.length = 0
          busy.clear()
        }
        hideLabels()
        return
      }

      for (let i = live.length - 1; i >= 0; i--) {
        const a = live[i]
        a.age += dt
        if (a.age >= a.life) end(a)
      }

      if (live.length < ambientBudget(devs) && shouldStart(entropy, dt, rng())) {
        begin(pickBehaviour(entropy, rng()), seats, props)
      }

      // --- bubbles ---------------------------------------------------------
      for (const a of live) {
        const t = a.age / a.life
        for (const [n, i] of a.who.entries()) {
          const seat = seats[i]
          if (!seat) continue
          // Two people in a conversation alternate rather than both talking at
          // once. An exchange is what reads as a conversation; two simultaneous
          // bubbles read as two people talking past each other, which is a
          // different and much later joke.
          if (a.who.length === 2 && (Math.floor(t * 4) % 2) !== n) continue

          // A bubble follows its speaker. The instigator of a walk is the one
          // who moves; everybody else bubbles over their own desk.
          const off = i === a.who[0] ? walkOffset(a, t) : ZERO
          bubble(label, g, seat.x + off.x, seat.y + off.y - 46, t, a.kind, a.says[n] ?? a.says[0])
        }
      }

      hideLabels(labelsUsed)
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
      g.clear()
      hideLabels()
    },

    destroy() {
      layer.destroy({ children: true })
      live.length = 0
      busy.clear()
    },
  }

}

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
  // Stop short of the destination. Standing *inside* the water cooler is not a
  // clipping error the eye forgives.
  const reach = Math.max(0, d - STANDOFF) / d
  return {
    x: dx * reach * p,
    y: dy * reach * p - walkBob(t, p > 0 && p < 1),
  }
}



/**
 * A speech balloon with dashes in it.
 *
 * Deliberately not text — see the module note. Colour carries the kind, using
 * the ramps the room already speaks: interface phosphor for talking, warn for
 * an interruption somebody did not ask for.
 */
/**
 * A speech balloon with words in it.
 *
 * Sized to its text rather than to a constant, so a two-word line does not sit
 * in a box built for six. The balloon is drawn into the shared `Graphics` and
 * the words are a pooled `Text` on top — one draw call for every bubble on the
 * floor plus one node each for the labels.
 */
function bubble(
  label: (text: string) => Text | null,
  g: Graphics,
  x: number,
  y: number,
  t: number,
  kind: Behaviour,
  says: string,
) {
  // Pops in, holds, pops out. Nothing on this floor appears or vanishes.
  const grow = Math.min(1, t / 0.12)
  const fade = Math.min(1, (1 - t) / 0.15)
  const s = Math.min(grow, fade)
  if (s <= 0.01) return

  const fill = kind === 'driveby' ? RAMPS.WARN[0] : RAMPS.NEUTRAL[7]
  const ink = kind === 'driveby' ? RAMPS.NEUTRAL[0] : RAMPS.NEUTRAL[0]

  const node = label(says)
  if (node) {
    node.scale.set(s)
    node.tint = c(ink)
  }

  const w = (says.length * 5.4 + 10) * s
  const h = 15 * s

  g.roundRect(x - w / 2, y - h, w, h, 3 * s).fill({ color: c(fill), alpha: 0.95 })
  // The tail, pointing down at whoever is speaking.
  g.moveTo(x - 3 * s, y)
    .lineTo(x + 2 * s, y)
    .lineTo(x - 1 * s, y + 5 * s)
    .closePath()
    .fill({ color: c(fill), alpha: 0.95 })

  node?.position.set(x, y - h + 3 * s)
}
