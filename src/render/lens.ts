/**
 * The lens — one camera, one space.
 *
 * `docs/PLAN-2026-08-19-lens.md` §2. What this replaces held seven views, fitted
 * each one to the viewport independently, and cross-faded between them by rung
 * distance. Measured, that drew the neighbouring view at 3.16x or 1/3.16x its
 * own fitted size at every hand-off, so a dolly was a dissolve between two
 * pictures that were never the same size — the artefact §10.5 exists to forbid,
 * arrived at by the mechanism chosen to prevent it.
 *
 * Here there is **one scale and one centre**, both in building space, and the
 * levels are places that scale can be rather than pictures that can be blended.
 * `frames.ts` owns where those places are; this owns getting between them.
 *
 * Three jobs:
 *
 *  1. **Hold the camera** — scale, centre, and the velocity the §6 zoom smear
 *     and the §20.4 doppler are driven from.
 *  2. **Move it** — a pinch or a wheel about a focal point, a drag, and a
 *     commanded flight to a named frame.
 *  3. **Settle it.** The camera **never parks between two levels**: after a
 *     gesture stops it eases to the nearest one. A lens left half way between a
 *     floor and a building is showing neither, and every complaint about the
 *     old zoom starts with a frame like that.
 *
 * The arithmetic is pure and exported; the class is a few fields and a clock.
 */

import {
  DESK,
  FLOOR,
  TOP_LEVEL,
  buildingFrame,
  fitScaleFor,
  floorFrame,
  floorToBuilding,
  frameFor,
  intoPlate,
  levelAtScale,
  levelScales,
  scaleAtLevel,
  storeyOf,
  type Level,
  type Rect,
} from './frames.ts'

export interface Viewport {
  w: number
  h: number
}

/**
 * How long after the last gesture the camera settles onto a level.
 *
 * Long enough that a wheel arriving in bursts reads as one gesture — a browser
 * emits them about every 40 ms — and short enough that letting go feels like
 * letting go rather than like waiting.
 */
export const SETTLE_DELAY_MS = 180

/** How fast a settle or a commanded flight converges, per second. */
export const EASE_RATE = 3.4

/**
 * How far the camera may roam at a given scale, as a centre range.
 *
 * The rule is the old one and is worth keeping: **a subject that already fits
 * the frame does not slide around**, because panning something that fits is how
 * a player ends up lost in an empty frame. What changed is that there is now
 * something to pan *at every level below the floor*, because zooming in past a
 * level's own fit genuinely enlarges the picture rather than only cross-fading.
 */
export function panRange(bounds: Rect, scale: number, viewport: Viewport): { x: number; y: number } {
  if (!(scale > 0)) return { x: 0, y: 0 }
  return {
    x: Math.max(0, (bounds.w - viewport.w / scale) / 2),
    y: Math.max(0, (bounds.h - viewport.h / scale) / 2),
  }
}

/**
 * What the camera may roam over at a continuous level position.
 *
 * Inside the floor it is the floor: you can look anywhere on your own storey
 * and no further, which is what makes a storey a place rather than a viewport.
 * At and above the floor it is the building.
 */
export function panBounds(level: number, seat: number, storeys: number): Rect {
  const focus = storeyOf(seat)
  if (level < FLOOR + 0.5) return intoPlate(floorFrame(), focus)
  return buildingFrame(storeys, focus)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * Hold `focal` still while the scale changes underneath it.
 *
 * A pinch that scales about the middle of the screen walks whatever the player
 * is pinching *off* the screen, which is the "zoom to any squad" requirement
 * failing for a reason that has nothing to do with squads. One subtraction per
 * axis, and it generalises: it is also what makes a wheel land on the thing the
 * pointer is over.
 */
export function anchorCentre(
  centre: { cx: number; cy: number },
  from: number,
  to: number,
  focal: { x: number; y: number },
  viewport: Viewport,
): { cx: number; cy: number } {
  if (!(from > 0) || !(to > 0)) return centre
  // The world point under the focal pixel, before the scale change.
  const wx = centre.cx + (focal.x - viewport.w / 2) / from
  const wy = centre.cy + (focal.y - viewport.h / 2) / from
  return {
    cx: wx - (focal.x - viewport.w / 2) / to,
    cy: wy - (focal.y - viewport.h / 2) / to,
  }
}

/** Which level a continuous position settles onto. Nearest, always. */
export function settleLevel(level: number): Level {
  return clamp(Math.round(level), DESK, TOP_LEVEL) as Level
}

export interface LensTarget {
  scale: number
  cx: number
  cy: number
}

export class Lens {
  private viewport: Viewport = { w: 1, h: 1 }
  private seat = 0
  private storeys = 1

  private _scale = 1
  private _cx = 0
  private _cy = 0
  private _velocity = 0
  private lastLevel = TOP_LEVEL

  /** Where the camera is easing to, or null when it is the player's. */
  private target: LensTarget | null = null
  /** When the last deliberate gesture ended, for the settle. */
  private idleSince = Number.POSITIVE_INFINITY
  /** True while a commanded flight owns the camera; a hand on the glass ends it. */
  private commanded = false
  /**
   * What the room actually occupies, when it is not the full floor.
   *
   * §7.8.1's first frames are a garage: one desk, then a huddle, then walls
   * pushing outward across the 11–30 band. Framing the fixed 5x2 floor there
   * would put two developers in the corner of a room built for a thousand,
   * which is the defect this whole change is about, arrived at from the other
   * end. Above the unfold the room reports the constant and this is a no-op.
   */
  private floorRect: Rect | null = null

  /**
   * The level the camera is **parked at**, or null while it is the player's.
   *
   * Held as a position on the ladder rather than as a scale, and that is the
   * whole of it. A scale only means a level *relative to the frames*, and the
   * frames move underneath it: the room grows through the garage band, storeys
   * arrive, the viewport rotates. Startup is the worst case and it showed —
   * `?z` and the scenario picker both call {@link set} before the first ticker
   * frame, so the camera was parked against a one-storey building and a room
   * that had not been laid out, and once the real ones arrived the same scale
   * meant level 2.1 instead of 3. The picture was of a floor when the flag had
   * asked for a building.
   *
   * Re-derived whenever the frames change, so a parked camera stays parked at
   * the thing it was parked at rather than at the number that used to mean it.
   */
  private parked: number | null = null
  /** Set when the frames have moved and a parked camera needs re-deriving. */
  private dirty = false
  /** True once the player has dragged, so a re-derive does not undo their pan. */
  private panned = false

  constructor(viewport?: Viewport) {
    if (viewport) this.viewport = viewport
    /*
     * **It opens on the floor, not on the building.**
     *
     * The building is a place you *go* — it is how you choose which thousand
     * people to stand among — and it is the one level of the four with nobody
     * on it: past a second storey the tower is tall enough that the pulled-out
     * plan drops under `ROOM_RESOLVE_SCALE` and the room is not drawn at all.
     * Resting there means the game opens on an empty tower, and §7.8.10's
     * corner desk — the player's own — is not on the screen to be tapped.
     *
     * That is not a hypothetical. It is what `test:walk` found the first time
     * this ran past a thousand developers: item 9 sweeps the frame looking for
     * the founder, every tap landed on a storey band instead, and the studio
     * bankrupted itself while the walk searched for a person the camera had
     * left behind.
     *
     * §7.7.1's ceiling still owns the other end — `maxZoomFor` pulls a small
     * studio further in every frame — so a one-developer garage still opens on
     * the desk it has always opened on. This only decides where a studio big
     * enough to have a choice comes to rest, and the answer is: among the
     * people.
     */
    this.reframe(FLOOR, true)
  }

  get scale(): number {
    return this._scale
  }

  get centre(): { cx: number; cy: number } {
    return { cx: this._cx, cy: this._cy }
  }

  /** |d(log scale)/dt| — what the §6 smear and the §20.4 whoosh are driven from. */
  get velocity(): number {
    return this._velocity
  }

  /** Where the camera is on the level ladder, continuously. 0 desk, 3 building. */
  get level(): number {
    return levelAtScale(this._scale, this.scales())
  }

  /**
   * The camera as the simulation's Z — GDD §7.2's [0, 1].
   *
   * Derived rather than held, so `store.ts`, the §20.7.3 music bus, the §8.2
   * poke sounds and the §23.3 bench all keep working off the number they
   * already read. The ladder's rungs 0–3 are this scope's four levels, and
   * `TOP_RUNG` is 9, so the map is one division.
   */
  get z(): number {
    return clamp(this.level / 9, 0, 1)
  }

  /** True while the camera is flying somewhere it was sent. */
  get settling(): boolean {
    return this.target !== null
  }

  setViewport(v: Viewport): void {
    if (v.w === this.viewport.w && v.h === this.viewport.h) return
    this.viewport = { w: Math.max(1, v.w), h: Math.max(1, v.h) }
  }

  /**
   * Point the lens at a part of the studio — the address, and how much of the
   * building exists.
   *
   * Changing the *storey* moves the frames, because the plates below the focus
   * do not move and the ones above it lift. Re-framing on that would yank the
   * camera; instead the scale is preserved and only the centre follows, which
   * reads as the building opening at a different floor rather than as a cut.
   */
  setAddress(seat: number, storeys: number): void {
    const nextSeat = Math.max(0, Math.floor(Number.isFinite(seat) ? seat : 0))
    const nextStoreys = Math.max(1, Math.floor(Number.isFinite(storeys) ? storeys : 1))
    if (nextSeat === this.seat && nextStoreys === this.storeys) return
    const movedStorey = storeyOf(nextSeat) !== storeyOf(this.seat)
    this.seat = nextSeat
    this.storeys = nextStoreys
    this.dirty = true
    if (movedStorey && !this.commanded) {
      // Follow the focus without changing how close in we are.
      const here = settleLevel(this.level)
      const frame = frameFor(here, this.seat, this.storeys)
      this._cx = frame.cx
      this._cy = frame.cy
    }
  }

  /**
   * The scale at which each level exactly fits, for the current address.
   *
   * Routed through {@link frameOf} rather than straight to `levelScales`, so
   * the garage's live rectangle is what the *magnetic stop* lands on too. Two
   * derivations of "where is the floor level" is how the camera settles onto a
   * scale that frames something else.
   */
  scales(): Record<Level, number> {
    const base = levelScales(this.seat, this.storeys, this.viewport)
    if (this.floorRect) base[FLOOR] = fitScaleFor(this.frameOf(FLOOR), this.viewport)
    return base
  }

  /**
   * What the room occupies right now, or null to use the fixed floor.
   *
   * The room is the authority on its own size — it is the thing that draws the
   * walls — so the lens asks rather than deriving a second answer that can
   * disagree with the first by a frame.
   */
  setFloorRect(rect: Rect | null): void {
    const before = this.floorRect
    if (
      rect &&
      before &&
      before.w === rect.w &&
      before.h === rect.h &&
      before.cx === rect.cx &&
      before.cy === rect.cy
    ) {
      return
    }
    this.floorRect = rect ? { ...rect } : null
    this.dirty = true
  }

  /** The frame a level names, for the current address. */
  frameOf(level: Level): Rect {
    if (level === FLOOR && this.floorRect) return intoPlate(this.floorRect, storeyOf(this.seat))
    return frameFor(level, this.seat, this.storeys)
  }

  /**
   * Send the camera to a level — the tap-to-enter and the breadcrumb.
   *
   * `immediate` is for startup and for `?z`, where an ease would be a lurch out
   * of a frame nobody has seen yet.
   */
  reframe(level: Level, immediate = false): void {
    const frame = this.frameOf(level)
    const scale = fitScaleFor(frame, this.viewport)
    if (immediate) {
      this._scale = scale
      this._cx = frame.cx
      this._cy = frame.cy
      this.target = null
      this.commanded = false
      this.parked = level
      this.panned = false
      return
    }
    this.target = { scale, cx: frame.cx, cy: frame.cy }
    this.commanded = true
    this.parked = level
    this.panned = false
    this.idleSince = Number.POSITIVE_INFINITY
  }

  /**
   * Ease the centre without changing how close in the camera is.
   *
   * §7.8.10's Hero Anchor and §10.7a.1's dialogue both want to *point* the lens
   * at somebody without moving it in or out. `reframe` would do both, and doing
   * both is a whip.
   */
  aimAt(cx: number, cy: number): void {
    this.target = { scale: this._scale, cx, cy }
    this.commanded = true
    this.idleSince = Number.POSITIVE_INFINITY
  }

  /** Fly to a level, centred on a point in the focused floor's own space. */
  flyTo(level: Level, floorPoint?: { x: number; y: number }): void {
    const frame = this.frameOf(level)
    const at = floorPoint ? floorToBuilding(floorPoint, storeyOf(this.seat)) : null
    this.target = {
      scale: fitScaleFor(frame, this.viewport),
      cx: at ? at.x : frame.cx,
      cy: at ? at.y : frame.cy,
    }
    this.commanded = true
    this.parked = level
    this.panned = false
    this.idleSince = Number.POSITIVE_INFINITY
  }

  /**
   * GDD §7.2's Z, as `?z`, the §23.3 bench and the scenario picker all set it.
   *
   * Continuous rather than snapped to a level, because the bench drives a dolly
   * by stepping this in small increments and measuring the frame time; rounding
   * it to a stop would turn the thing being measured into a staircase.
   */
  set(z: number): void {
    if (!Number.isFinite(z)) return
    const level = clamp(z * 9, DESK, TOP_LEVEL)
    const frame = this.frameOf(settleLevel(level))
    this._scale = scaleAtLevel(level, this.scales())
    this._cx = frame.cx
    this._cy = frame.cy
    this.target = null
    this.commanded = false
    this.parked = level
    this.panned = false
    this.idleSince = Number.POSITIVE_INFINITY
  }

  /**
   * Scale by a factor about a focal pixel — a pinch, or a wheel.
   *
   * A hand on the lens ends any commanded flight: a camera that keeps pulling
   * back to where it was *sent* is a camera the player has to fight.
   */
  zoomBy(factor: number, focal: { x: number; y: number } | null, now: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return
    const scales = this.scales()
    const next = clamp(this._scale * factor, scales[TOP_LEVEL] * 0.85, scales[DESK] * 1.6)
    if (focal) {
      const moved = anchorCentre(
        { cx: this._cx, cy: this._cy },
        this._scale,
        next,
        focal,
        this.viewport,
      )
      this._cx = moved.cx
      this._cy = moved.cy
    }
    this._scale = next
    this.target = null
    this.commanded = false
    this.parked = null
    this.idleSince = now
  }

  /** Drag the world, in screen pixels. */
  /** What the camera may roam over — the floor it is in, or the building. */
  private bounds(): Rect {
    if (this.level < FLOOR + 0.5 && this.floorRect) {
      return intoPlate(this.floorRect, storeyOf(this.seat))
    }
    return panBounds(this.level, this.seat, this.storeys)
  }

  panBy(dx: number, dy: number, now: number): void {
    if (!(this._scale > 0)) return
    this._cx -= dx / this._scale
    this._cy -= dy / this._scale
    this.target = null
    this.commanded = false
    this.panned = true
    this.idleSince = now
  }

  /**
   * Advance one frame: run the ease, run the settle, hold the pan limits.
   *
   * The order matters. Easing first and clamping second means a commanded
   * flight cannot be dragged out of bounds by its own overshoot, and it means
   * the settle target is always a legal place to be.
   */
  update(dt: number, now: number): void {
    const before = Math.log(Math.max(1e-9, this._scale))

    // **The frames moved; a parked camera has not.** Re-derive the scale (and,
    // unless the player has dragged, the centre) from the level it was parked
    // at. Without this, startup parks against a one-storey building and an
    // unbuilt room and then quietly means something else once the real ones
    // arrive — the flag asks for a building and the picture is of a floor.
    if (this.dirty) {
      this.dirty = false
      if (this.target === null && this.parked !== null) {
        this._scale = scaleAtLevel(this.parked, this.scales())
        if (!this.panned) {
          const frame = this.frameOf(settleLevel(this.parked))
          this._cx = frame.cx
          this._cy = frame.cy
        }
      }
    }

    if (this.target === null && now - this.idleSince > SETTLE_DELAY_MS) {
      // **The magnetic stop.** Nothing between two levels is a picture of
      // anything, so the camera is never left there.
      const to = settleLevel(this.level)
      const scale = scaleAtLevel(to, this.scales())
      this.parked = to
      if (Math.abs(Math.log(scale) - before) > 1e-4) {
        this.target = { scale, cx: this._cx, cy: this._cy }
      } else {
        this.idleSince = Number.POSITIVE_INFINITY
      }
    }

    if (this.target) {
      const k = Math.min(1, dt * EASE_RATE)
      // Interpolated in the log, because scale is multiplicative: a linear lerp
      // spends most of the move at the far end and reads as a lurch then a
      // crawl.
      this._scale = Math.exp(before + (Math.log(this.target.scale) - before) * k)
      this._cx += (this.target.cx - this._cx) * k
      this._cy += (this.target.cy - this._cy) * k
      const done =
        Math.abs(Math.log(this.target.scale / this._scale)) < 0.002 &&
        Math.hypot(this.target.cx - this._cx, this.target.cy - this._cy) * this._scale < 0.6
      if (done) {
        this._scale = this.target.scale
        this._cx = this.target.cx
        this._cy = this.target.cy
        this.target = null
        this.commanded = false
        this.idleSince = Number.POSITIVE_INFINITY
      }
    }

    const bounds = this.bounds()
    const range = panRange(bounds, this._scale, this.viewport)
    this._cx = clamp(this._cx, bounds.cx - range.x, bounds.cx + range.x)
    this._cy = clamp(this._cy, bounds.cy - range.y, bounds.cy + range.y)

    if (dt > 0) {
      const instant = Math.abs(Math.log(Math.max(1e-9, this._scale)) - before) / dt
      // Smoothed: one dropped frame otherwise reads as a huge velocity spike
      // and fires a smear the player did not ask for.
      this._velocity += (instant - this._velocity) * Math.min(1, dt * 12)
    }
    this.lastLevel = this.level
  }

  /** Screen point to building-space point. */
  toWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: this._cx + (x - this.viewport.w / 2) / this._scale,
      y: this._cy + (y - this.viewport.h / 2) / this._scale,
    }
  }

  /** The world transform to apply to the scene root. */
  transform(): { x: number; y: number; scale: number } {
    return {
      x: this.viewport.w / 2 - this._cx * this._scale,
      y: this.viewport.h / 2 - this._cy * this._scale,
      scale: this._scale,
    }
  }

  /** The level the camera last settled on — what the HUD names. */
  get settledLevel(): Level {
    return settleLevel(this.lastLevel)
  }
}
