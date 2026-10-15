/**
 * What the statue does when the game is done, and where the finished ones stand — GDD §8.2a [CANON - added 2026-10-14].
 *
 * The concept page (`docs/demos/product-box-ideas-2026-10-14`) played the same four beats on every product: the
 * whole thing flashes, it turns round to be looked at, its name appears, and it goes to the queue. This is that, as numbers, so the
 * order can be pinned and the renderer (`render/statue.ts`) holds none of it. Every step is hard — a colour that is one thing
 * and then another, a quarter turn and then the next, a hop in six places — and nothing is eased or faded: that is
 * the interface's own motion (`steps(n, end)`) and the user's standing rule against gradients and glows.
 *
 * Pure — no store, no clock, no renderer: it is handed the time since the beat began.
 */
import { STATUE_PLAZA } from './floorPlan.ts'

export const BEAT = {
  /** The flash: all white until here, then light amber until `lamp`, then the statue's own colours. Two steps, not a fade. */
  white: 0.12,
  lamp: 0.24,
  /** The name plate lights when the flash is over: the title arrives after the picture, as it did on the board. */
  plate: 0.24,
  /** The turn: `turns` quarter-turns, one every `turnEvery` seconds from `turnFrom`, which is a full circle and so ends facing the lens. */
  turnFrom: 0.45,
  turnEvery: 0.15,
  turns: 4,
  /** When it leaves the plinth for the queue, and how long that takes, in `shipSteps` hard hops. */
  shipAt: 1.8,
  shipLen: 0.9,
  shipSteps: 6,
} as const

export interface BeatFrame {
  /** What colour the whole statue is: white, then light amber, then (null) its own. */
  tint: 'white' | 'lamp' | null
  /** Whether the name plate shows the title. */
  plate: boolean
  /** Quarter-turns made so far, 0 to `turns`. */
  turns: number
  /** −1 while it stands on the plinth; 0 to `shipSteps − 1` while it is on its way. */
  ship: number
  /** The beat is over: the statue is in the queue. */
  over: boolean
}

/** The beat, `t` seconds in. A time before it began is the first frame of it. */
export function beatAt(t: number): BeatFrame {
  const s = Math.max(0, Number.isFinite(t) ? t : 0)
  const turned = s < BEAT.turnFrom ? 0 : Math.min(BEAT.turns, Math.floor((s - BEAT.turnFrom) / BEAT.turnEvery) + 1)
  const shipped = s < BEAT.shipAt ? -1 : Math.min(BEAT.shipSteps - 1, Math.floor((s - BEAT.shipAt) / BEAT.shipLen * BEAT.shipSteps))
  return {
    tint: s < BEAT.white ? 'white' : s < BEAT.lamp ? 'lamp' : null,
    plate: s >= BEAT.plate,
    turns: turned,
    ship: shipped,
    over: s >= BEAT.shipAt + BEAT.shipLen,
  }
}

/** How big a statue in the queue is, against the one on the plinth. */
export const QUEUE_SCALE = 0.34

/** How big it is on each hop of its way to the queue: the same size until it is well under way, then a step down, then the queue's. */
export const SHIP_SCALE: readonly number[] = [1, 1, 0.7, 0.7, QUEUE_SCALE, QUEUE_SCALE]

export interface P3 { x: number; y: number; z: number }

/** Where it is at hop `step` of a trip between two places: `lift` metres up at the middle of the way, and nowhere in between the hops. */
export function hopAt(from: P3, to: P3, step: number, lift: number): P3 {
  const last = BEAT.shipSteps - 1
  const f = Math.max(0, Math.min(last, step)) / last
  return {
    x: from.x + (to.x - from.x) * f,
    y: from.y + (to.y - from.y) * f + Math.sin(Math.PI * f) * lift,
    z: from.z + (to.z - from.z) * f,
  }
}

/** Where place `i` of the queue is on the deck: the head (0) beside the plinth, and each place after it a pitch further north. */
export function queueSlot(i: number): { x: number; z: number } {
  const q = STATUE_PLAZA.queue
  return { x: q.x, z: q.zHead - i * q.pitch }
}

/** How many of a queue of `length` are drawn: the first few, and the rest are a count. */
export const queueShown = (length: number): number => Math.max(0, Math.min(STATUE_PLAZA.queue.shown, Math.floor(length)))
