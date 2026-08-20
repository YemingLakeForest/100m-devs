/**
 * The scene — one building, with the room inside the plate it belongs to.
 *
 * `docs/PLAN-2026-08-19-lens.md` §2. This used to build seven containers, one
 * per navigation stop, and hand them to a camera that fitted each one to the
 * viewport separately. That is what put two copies of one building on screen at
 * different sizes, and no amount of tuning the cross-fade between them could
 * have helped: they were never the same picture.
 *
 * There are now **two objects and one nesting**. `building.ts` draws ten floor
 * plans stacked into a stair; `room.ts` draws one of them for real; and the
 * room is parented *into* the plate whose floor it is, so descending is a
 * single affine transform and the swap between the plan and the room happens at
 * a size where the two are indistinguishable.
 *
 * Everything is drawn in code from the master palette rather than loaded from
 * assets/. That is deliberate and is not a placeholder shortcut: ART_DIRECTION
 * §4 classes everything at this scale as T0 — procedural — and §7.8.2 is
 * explicit that no rung above the room needs a bespoke sprite, which is the
 * whole reason the §22.7 art budget can be nineteen.
 */

import {
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Texture,
  type Renderer,
} from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import { buildRoom, seatPosition, type RoomHandle } from './room.ts'
import { buildBuilding, type BuildingHandle } from './building.ts'

/** Palette colour as the 0xrrggbb number Pixi wants. */
function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** 2:1 isometric — ART_DIRECTION §1, "Projection: 2:1 isometric". */
const TILE_H = 32

/** GDD §23.3 criterion 4: floor zoom must hold 55 fps with 1,000 sprites. */
export const FLOOR_SPRITE_COUNT = 1000

/**
 * How far above its desk particle `i` is at drop progress `t`, in world units.
 *
 * §21 Act IV asks for 1,000 developers dropping "from the sky", which is a
 * different thing from 1,000 developers appearing. Two properties make it read
 * that way, and both are here rather than in the caller so they are testable:
 *
 *  - **Stagger.** Every particle landing on the same frame is a wipe, not a
 *    fall. Each gets its own start delay, so the floor fills in as a shower.
 *    The delay is derived from the index by a hash rather than a random draw,
 *    so the drop looks identical on every run and a failure is reproducible.
 *  - **A hard landing.** Ease-out alone reads as a lift descending. The curve
 *    overshoots slightly past the desk and settles back, which is the impact
 *    the bass-drop THUD is scoring.
 */
export const DROP_HEIGHT = 2600
/** Fraction of the drop window spent releasing particles, not falling. */
const DROP_STAGGER_SPAN = 0.45
/** Fraction of one particle's own window spent airborne; the rest is the settle. */
const FALL_FRACTION = 0.85
/** Depth of the landing dip, as a fraction of the fall height. */
const LANDING_DIP = 0.006

export function dropOffset(index: number, t: number): number {
  if (t >= 1) return 0
  if (t <= 0) return DROP_HEIGHT

  // Deterministic per-index scatter in [0, 1). A plain `index / count` ramp
  // would release the swarm in iso-grid order, which reads as a diagonal wipe
  // sweeping the floor — the one thing the stagger exists to avoid.
  const scatter = ((index * 2654435761) % 4096) / 4096
  const delay = scatter * DROP_STAGGER_SPAN
  const u = (t - delay) / (1 - DROP_STAGGER_SPAN)

  if (u <= 0) return DROP_HEIGHT
  if (u >= 1) return 0

  if (u < FALL_FRACTION) {
    // Free fall: distance covered goes as t², so the swarm is moving fastest
    // at the instant it lands. An ease-out here — which is the reflex, and
    // what the first version of this did — decelerates into the floor and
    // reads as a thousand lifts descending in unison.
    const v = u / FALL_FRACTION
    return DROP_HEIGHT * (1 - v * v)
  }

  // Landing: one damped dip below the desk and back. This is what the
  // bass-drop THUD is scoring, and without it the impact is only audible.
  const b = (u - FALL_FRACTION) / (1 - FALL_FRACTION)
  return -DROP_HEIGHT * LANDING_DIP * Math.sin(b * Math.PI) * (1 - b)
}

/**
 * The Level 2 floor, plus the handles §21 Act IV needs to wreck it.
 *
 * The collapse does not build a swarm of its own — it animates *this* one. That
 * matters for more than tidiness: GDD §23.3 criterion 4 measures 1,000 sprites
 * at floor zoom, and a second thousand spawned for the drop would mean the
 * spectacle runs at double the sprite cost the gate ever measured.
 */
export interface FloorSwarm {
  /** The tier container — the same object as `tiers[2]`. */
  readonly container: Container
  /** Desk positions in floor-local coordinates; the Slack web anchors to these. */
  readonly desks: readonly (readonly [number, number])[]
  /** Parent for the Slack web, above the particles. */
  readonly webLayer: Container
  /**
   * Every seat, in floor-local coordinates — GDD §7.7.6's hit test.
   *
   * Distinct from {@link desks}, which is the every-twelfth subset the Slack
   * web anchors to. Poking needs all of them: "the actual developer under the
   * thumb", not the nearest of eighty-three.
   */
  readonly seats: ReadonlyArray<{ x: number; y: number }>
  /**
   * §21 Act IV — "1,000 pixel developers drop from the sky".
   *
   * `t` runs 0 (all airborne) to 1 (all landed) and is clamped, so calling it
   * with 1 forever after the drop is a no-op rather than a per-frame upload.
   */
  setDropProgress(t: number): void
  /**
   * How many of the 1,000 are actually people — GDD §7.7.1.
   *
   * The tier allocates the full {@link FLOOR_SPRITE_COUNT} because §23.3
   * criterion 4 measures exactly that, but it must not *show* a studio the
   * player has not hired. Rendering all thousand at every headcount put a
   * ghost of a full office behind two developers at the zoom ceiling, which
   * is the opposite of §7.7's promise that the studio you see is the studio
   * you have.
   */
  setPopulation(devs: number): void
  /**
   * Force the full thousand regardless of headcount, for the §23.3 criterion 4
   * measurement. Pass null to hand control back to {@link setPopulation}.
   *
   * Without this the benchmark would quietly measure however many developers
   * happened to be hired — usually one — and report a pass on a scene 1/1000th
   * the weight of the one the criterion names.
   */
  setPopulationOverride(n: number | null): void
}

/**
 * Level 2 — the open office floor (GDD §7.4).
 *
 * Built as a real ParticleContainer at FLOOR_SPRITE_COUNT, because GDD §23.3
 * criterion 4 measures exactly this: 1,000 sprites at floor zoom, 55 fps
 * 5th percentile. A prettier scene with 40 sprites would pass the eye and fail
 * the gate it exists to answer. GDD §23.2 non-negotiable 2 names ParticleContainer
 * as the committed approach.
 */
function buildFloor(renderer: Renderer): FloorSwarm {
  const root = new Container()

  // One tiny desk-and-body texture, reused by every particle.
  const proto = new Graphics()
  proto.rect(0, 3, 10, 4).fill(c(RAMPS.WOOD[1]))
  proto.rect(3, 0, 4, 4).fill(c(RAMPS.NEUTRAL[6]))
  proto.rect(4, 4, 2, 2).fill(c(RAMPS.GLOW[1]))
  const texture = renderer.generateTexture(proto)
  proto.destroy()

  // Position stays STATIC even though the Act IV drop moves every particle.
  // Static means the buffer uploads only when update() is called, so the drop
  // pays for the ~2 s it is animating and the other 99% of the run — including
  // the criterion-4 measurement — costs exactly what it did before the
  // spectacle existed. Making it dynamic would have moved that cost onto every
  // frame of the game to serve two seconds of it.
  // Typed on Particle rather than the default IParticle: alpha is what drives
  // the population, and IParticle does not declare it.
  const particles = new ParticleContainer<Particle>({
    dynamicProperties: { position: false, scale: false, rotation: false, color: true },
  })

  // Laid out on the iso grid rather than a square one, so the floor reads as
  // the same space as the desk seen from further away.
  const cols = Math.ceil(Math.sqrt(FLOOR_SPRITE_COUNT))
  const restY = new Float64Array(FLOOR_SPRITE_COUNT)
  const desks: Array<readonly [number, number]> = []
  const seats: Array<{ x: number; y: number }> = []

  for (let i = 0; i < FLOOR_SPRITE_COUNT; i++) {
    // **On the room's own seats**, not on a private 32x32 grid.
    //
    // The swarm used to have a layout of its own because it was a separate
    // ladder stop with its own camera fit. It is now §21 Act IV's drop and
    // nothing else, parented inside the room — so a body has to fall onto the
    // desk it is going to occupy, or the thousand developers land in a
    // rectangle beside the floor they were hired onto.
    const { x, y } = seatPosition(i)
    restY[i] = y
    // Every 12th desk anchors the web. All 1,000 would be an opaque red sheet
    // rather than a web, and 83 endpoints already reads as "everyone".
    if (i % 12 === 0) desks.push([x, y])
    seats.push({ x, y })
    particles.addParticle(
      new Particle({
        texture,
        x,
        y,
        // A little variation so it does not read as wallpaper.
        tint: i % 7 === 0 ? c(RAMPS.NEUTRAL[5]) : c(RAMPS.NEUTRAL[6]),
      }),
    )
  }

  const webLayer = new Container()
  root.addChild(particles)
  root.addChild(webLayer)
  root.pivot.set(0, (cols * TILE_H) / 4)

  let lastT = 1
  let population = 0
  let override: number | null = null

  /** Alpha is a dynamic particle property, so this costs an upload and no more. */
  function applyPopulation() {
    const shown = override ?? population
    const children = particles.particleChildren
    for (let i = 0; i < children.length; i++) children[i].alpha = i < shown ? 1 : 0
  }

  applyPopulation()

  return {
    container: root,
    desks,
    seats,
    webLayer,
    setPopulation(devs: number) {
      // Saturates at the sprite budget. Above 1,000 the Construction Ladder
      // says this tier should become towers (§7.8.2) and that geometry does
      // not exist yet, so it holds at a full floor rather than pretending.
      const next = Math.max(0, Math.min(FLOOR_SPRITE_COUNT, Math.floor(devs)))
      if (next === population) return
      population = next
      if (override === null) applyPopulation()
    },
    setPopulationOverride(n: number | null) {
      if (n === override) return
      override = n
      applyPopulation()
    },
    setDropProgress(t: number) {
      const clamped = Math.min(1, Math.max(0, t))
      // Landed and already settled — skip the upload entirely.
      if (clamped === 1 && lastT === 1) return
      lastT = clamped

      const children = particles.particleChildren
      for (let i = 0; i < children.length; i++) {
        children[i].y = restY[i] - dropOffset(i, clamped)
      }
      // Static positions were mutated directly, so the buffer has to be told.
      particles.update()
    },
  }
}
export interface Scene {
  /** Rung 3 — the exploded stack of ten floor plans. The camera's root object. */
  building: BuildingHandle
  /**
   * Rungs 0–2 — the room, which is one storey of that building drawn for real.
   *
   * **Parented into a plate rather than into the world**, which is the whole of
   * the change: the room is *inside* the floor it is a picture of, at the
   * plate's own scale, so descending into a floor and arriving in its room is
   * one continuous transform with nothing to cross-fade.
   */
  room: RoomHandle
  /** §21 Act IV's thousand-body drop, parented on the room's own seats. */
  floor: FloorSwarm
  /** Move the room into a different storey's plate — §26.2.2's address. */
  hostRoomOn(storey: number): void
}

/** Build the scene. The caller drives the camera and the level of detail. */
export function buildScene(renderer: Renderer): Scene {
  const floor = buildFloor(renderer)
  const room = buildRoom()
  const building = buildBuilding()

  // §7.8.1a — the particle swarm is **not a ladder stop.** It exists solely as
  // §21 Act IV's subject: a thousand bodies that can be dropped out of the sky
  // at once, which is a spectacle the room's own developers cannot afford to be
  // (three display objects each, built in a single frame). It is parented into
  // the room so it lands on the room's floor, in the room's transform, and it
  // draws nobody until the trap springs.
  room.container.addChild(floor.container)

  let hosted = -1
  const hostRoomOn = (storey: number) => {
    const f = Math.max(0, Math.floor(Number.isFinite(storey) ? storey : 0))
    if (f === hosted) return
    hosted = f
    // One `addChild` — Pixi re-parents rather than duplicating — and the room's
    // local coordinates are unchanged, because every plate is the same floor
    // space at the same scale. Moving the address therefore cannot move
    // anything inside the room relative to anything else in it.
    building.plateHost(f).addChild(room.container)
  }
  hostRoomOn(0)

  return { building, room, floor, hostRoomOn }
}

export { Texture }
