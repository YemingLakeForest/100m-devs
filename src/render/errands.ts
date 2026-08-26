/**
 * The away population, drawn — GDD §7.8.6, §7.8.9.
 *
 * `sim/slackOff.ts` decides **who** is away, on what errand, and for how long;
 * this decides where their body is while it happens. That split is the whole
 * reason the minigame survives a zoom: the cost lives in the simulation, so it
 * is still charged at the Floor tier where §7.8.6 rule 4 has switched every
 * individual body off.
 *
 * ## Time is the simulation's; space is ours
 *
 * The sim gives each phase a fixed window ({@link TRAVEL_SECONDS}). A route may
 * be two tiles or forty, so a walker either arrives with time to spare and
 * **stands there**, or is still walking when the window closes and arrives at
 * the next phase change. Both read correctly and neither needs the simulation
 * to know how far the cooler is — which it must not, because a headless tick
 * would then have nobody arriving anywhere and the studio's output would sit at
 * the floor for ever.
 *
 * ## Three things this owns that the sim deliberately does not
 *
 * 1. **Which** cooler, which whiteboard, which window. The sim picks a kind and
 *    hands over a stable roll; the destination is geometry.
 * 2. **The route**, via `walkPath.ts` — along the aisles, never through a desk.
 * 3. **The struggle.** §7.8.9 rule 4 keeps physics cartoon, so it is a rotation,
 *    a swing and a protest bubble, and there is no solver anywhere near it.
 */

import { Container } from 'pixi.js'
import { boardLine, loiterLine, struggleLine, windowLine } from '../game/chatter.ts'
import { ERRANDS, TRAVEL_SECONDS, type Away, type Errand } from '../sim/slackOff.ts'
import { bubblesLegible, counterScale, createBubbles } from './bubble.ts'
import {
  WALK_TILES_PER_SECOND,
  advanceAlong,
  pathLength,
  route,
  type GridPoint,
  type Lanes,
} from './walkPath.ts'

/** Somewhere to stand, per errand kind. In the floor's grid axes. */
export interface Spots {
  water: readonly GridPoint[]
  whiteboard: readonly GridPoint[]
  window: readonly GridPoint[]
  sofa: readonly GridPoint[]
}

export const NO_SPOTS: Spots = { water: [], whiteboard: [], window: [], sofa: [] }

const ZERO = { x: 0, y: 0 }

/**
 * How long a protest bubble stays up, and how long the gap between them is.
 *
 * A carried developer talks in bursts rather than continuously: a bubble that
 * never goes away stops being speech and becomes a label, and the joke is that
 * they keep *starting* again.
 */
const STRUGGLE_ON_MS = 1500
const STRUGGLE_OFF_MS = 700

/**
 * How far a standing developer stops short of the thing they walked to.
 *
 * Standing *inside* the water cooler is not a clipping error the eye forgives.
 * In grid units, because everything else here is.
 */
const STANDOFF = 0.55

interface Live {
  seat: number
  errand: Errand
  /** The phase this route was built for, so a phase change rebuilds it. */
  builtFor: Away['phase']
  path: GridPoint[]
  length: number
  /** Where they are now, in grid units — kept so a `back` route can start here. */
  at: GridPoint
  /** Facing, as a grid-space unit vector. */
  dx: number
  dy: number
  says: string
  age: number
}

export interface ErrandsLayer {
  readonly layer: Container
  /**
   * Advance and draw. `roster` is the simulation's away list, verbatim — this
   * module never decides who is on it.
   */
  update(
    dt: number,
    opts: {
      roster: readonly Away[]
      seatGrid: (seat: number) => GridPoint
      toScreen: (p: GridPoint) => { x: number; y: number }
      spots: Spots
      lanes: Lanes
      drawnIndividually: boolean
      worldScale: number
      /** Where the player's finger is, in room-local screen coordinates. */
      carryAt: { x: number; y: number } | null
    },
  ): void
  /** Room-local screen offset from seat `i`'s desk. Zero for anybody at theirs. */
  offsetFor(i: number): { x: number; y: number }
  /** Is this seat away and therefore drawn somewhere other than its chair? */
  isAway(i: number): boolean
  clear(): void
  destroy(): void
}

export function createErrands(): ErrandsLayer {
  const layer = new Container()
  const bubbles = createBubbles()
  layer.addChild(bubbles.layer)

  /** Seat -> what we are drawing for them. Rebuilt lazily against the roster. */
  const live = new Map<number, Live>()
  /** Room-local screen offsets, recomputed each frame and read by the room. */
  const offsets = new Map<number, { x: number; y: number }>()

  /**
   * Where this errand goes, in grid coordinates.
   *
   * Uses the entry's own `pick` — a roll the simulation made once and holds for
   * the life of the errand — so the destination is stable. Re-rolling it per
   * frame is how a walker crosses the floor sideways.
   *
   * **Falls back to the desk's own aisle** when the room has no such prop:
   * §7.8.1's crowding takes the cooler and the sofa away, and somebody sent to
   * a prop that no longer exists must stand *somewhere*. That fallback is also
   * §7.8.9's own note — "standing about happens where you already were" — and
   * it keeps the crowding joke intact: a floor that has lost its walkway has
   * people on their feet and nobody at the cooler.
   */
  function destination(a: Away, seat: GridPoint, spots: Spots, lanes: Lanes): GridPoint {
    const list =
      a.errand === 'water'
        ? spots.water
        : a.errand === 'whiteboard'
          ? spots.whiteboard
          : a.errand === 'window'
            ? spots.window
            : a.errand === 'sofa'
              ? spots.sofa
              : []
    if (list.length > 0) {
      const at = list[Math.min(list.length - 1, Math.floor(a.pick * list.length))]
      // Spread a huddle out along the wall rather than stacking two people in
      // one spot: the seat index is the only thing that distinguishes them and
      // it is stable, which is what the jitter has to be.
      const spread = ((a.seat % 3) - 1) * 0.7
      return { gx: at.gx, gy: at.gy + spread }
    }
    // Just outside their own desk, in the aisle behind it — jittered by the
    // seat so a row of loiterers is not a queue.
    const lane = lanes.aisles.find((v) => v > seat.gx + 1e-6) ?? seat.gx + 1
    return { gx: lane, gy: seat.gy + (((a.seat * 7) % 5) - 2) * 0.35 }
  }

  /** Stop short of the destination, along the last leg. */
  function standOff(path: GridPoint[]): GridPoint[] {
    if (path.length < 2) return path
    const end = path[path.length - 1]
    const prev = path[path.length - 2]
    const d = Math.hypot(end.gx - prev.gx, end.gy - prev.gy)
    if (d <= STANDOFF) return path
    const k = (d - STANDOFF) / d
    const trimmed = path.slice(0, -1)
    trimmed.push({ gx: prev.gx + (end.gx - prev.gx) * k, gy: prev.gy + (end.gy - prev.gy) * k })
    return trimmed
  }

  function lineFor(errand: Errand, r: number): string {
    if (errand === 'whiteboard') return boardLine(r)
    if (errand === 'window') return windowLine(r)
    return loiterLine(r)
  }

  /**
   * Build (or rebuild) what we draw for one entry.
   *
   * Called on a phase change and on nothing else, and the two cases are
   * genuinely different routes rather than one route read backwards:
   *
   *  - **`back`** is *from wherever they are standing* to their own desk. That
   *    is what makes the drop work — a developer put down in the middle of the
   *    floor walks home from the carpet, not from the cooler they never reached.
   *  - **Everything else** is the desk to the destination, stopped short of it.
   */
  function build(a: Away, opts: Parameters<ErrandsLayer['update']>[1], existing?: Live): Live {
    const desk = opts.seatGrid(a.seat)
    const outbound = () =>
      standOff(route(desk, destination(a, desk, opts.spots, opts.lanes), opts.lanes))
    // Where a walk home starts. Normally it is simply where they are standing.
    // With no `existing` we are rebuilding from nothing — §7.8.6 rule 4 dropped
    // every body when the player zoomed out to Floor and they have just zoomed
    // back in — so the honest reconstruction is the far end of the errand they
    // were on, not the desk. Reading `desk` there would teleport somebody home
    // the instant the camera returned, which is the one thing this whole change
    // set out to stop.
    const from = existing?.at ?? outbound().at(-1) ?? desk
    const path = a.phase === 'back' ? route(from, desk, opts.lanes) : outbound()
    return {
      seat: a.seat,
      errand: a.errand,
      builtFor: a.phase,
      path,
      length: pathLength(path),
      at: existing?.at ?? { gx: path[0]?.gx ?? desk.gx, gy: path[0]?.gy ?? desk.gy },
      dx: existing?.dx ?? 0,
      dy: existing?.dy ?? 0,
      says: existing?.says ?? lineFor(a.errand, a.pick),
      age: existing?.age ?? 0,
    }
  }

  return {
    layer,

    update(dt, opts) {
      const { roster, seatGrid, toScreen, drawnIndividually, worldScale, carryAt } = opts
      offsets.clear()
      bubbles.begin()

      // §7.8.6 rule 4 — above rung 2 a person is two pixels and none of this is
      // drawn. **The simulation keeps running underneath**, which is the whole
      // point of the split: the output penalty does not go away when the player
      // zooms out, only the bodies do.
      if (!drawnIndividually || roster.length === 0) {
        live.clear()
        bubbles.end()
        return
      }

      const seen = new Set<number>()
      for (const a of roster) {
        seen.add(a.seat)
        let l = live.get(a.seat)
        // Rebuilt on a phase change and on nothing else. `back` in particular
        // must re-route from wherever they actually are — which is the desk end
        // of a finished errand, or the carpet where the player dropped them.
        if (!l || l.builtFor !== a.phase || l.errand !== a.errand) {
          l = build(a, opts, l)
          live.set(a.seat, l)
        }
        l.age += dt

        if (a.phase === 'carried' && carryAt) {
          // §7.8.9 — a carried developer is wherever the finger is, full stop.
          // No easing: a held object that lags the pointer does not feel held.
          const desk = toScreen(seatGrid(a.seat))
          offsets.set(a.seat, { x: carryAt.x - desk.x, y: carryAt.y - desk.y })
          // The struggle, in words. Bursts rather than a continuous label —
          // the joke is that they keep starting again.
          const cycle = STRUGGLE_ON_MS + STRUGGLE_OFF_MS
          const ms = (l.age * 1000) % cycle
          if (ms < STRUGGLE_ON_MS && bubblesLegible(worldScale)) {
            const which = Math.floor((l.age * 1000) / cycle)
            bubbles.draw({
              x: carryAt.x,
              y: carryAt.y - 34,
              ageMs: ms,
              remainMs: STRUGGLE_ON_MS - ms,
              says: struggleLine(((a.seat * 31 + which * 17) % 97) / 97),
              inv: counterScale(worldScale),
              // §7.8.6 gives the warn ramp to interruptions nobody asked for.
              // Being picked up off the floor by a giant hand qualifies.
              tone: 'warn',
            })
          }
          continue
        }

        // Distance along the route. `out` and `back` both walk forwards along
        // their own path — `back`'s was built from where they were standing to
        // their desk, so there is no reverse case to get wrong.
        const travelled =
          a.phase === 'there'
            ? l.length
            : Math.min(l.length, a.elapsed * WALK_TILES_PER_SECOND)
        const at = advanceAlong(l.path, travelled)
        l.at = { gx: at.gx, gy: at.gy }
        if (at.moving) {
          l.dx = at.dx
          l.dy = at.dy
        }

        const here = toScreen(l.at)
        const desk = toScreen(seatGrid(a.seat))
        // A little vertical bounce, so a walker is walking rather than sliding.
        const bob = at.moving ? Math.abs(Math.sin(l.age * Math.PI * 9)) * 2.2 : 0
        offsets.set(a.seat, { x: here.x - desk.x, y: here.y - desk.y - bob })

        // A bubble only while they are standing at the far end. Walking people
        // do not narrate their own walk, and a floor of forty moving labels is
        // the fog §7.8.6 spent a paragraph avoiding.
        if (a.phase === 'there' && bubblesLegible(worldScale)) {
          const life = ERRANDS[a.errand].stand * 1000
          bubbles.draw({
            x: here.x,
            y: here.y - 46,
            ageMs: a.elapsed * 1000,
            remainMs: life - a.elapsed * 1000,
            says: l.says,
            inv: counterScale(worldScale),
          })
        }
      }

      for (const seat of [...live.keys()]) if (!seen.has(seat)) live.delete(seat)
      bubbles.end()
    },

    offsetFor(i) {
      return offsets.get(i) ?? ZERO
    },

    isAway(i) {
      return offsets.has(i)
    },

    clear() {
      live.clear()
      offsets.clear()
      bubbles.clear()
    },

    destroy() {
      bubbles.destroy()
      layer.destroy({ children: true })
      live.clear()
      offsets.clear()
    },
  }
}

/** Re-exported so the room can size its travel window against the sim's. */
export { TRAVEL_SECONDS }
