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
  BLOCK,
  BUILDING,
  DESK,
  FLOOR,
  GALAXY,
  GLOBE,
  PARK,
  TOP_LEVEL,
  blockOf,
  buildingOf,
  fitScaleFor,
  floorFrame,
  floorToPark,
  galaxyFrame,
  globeToGalaxy,
  intoGalaxy,
  intoGlobe,
  frameFor,
  intoParcel,
  intoPlate,
  intoPlot,
  parkToGlobe,
  levelAtScale,
  levelScales,
  nestScales,
  plotOf,
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
export function panBounds(
  level: number,
  seat: number,
  storeys: number,
  buildings = 1,
  blocks = 1,
  sites = 1,
  worlds = 1,
): Rect {
  const block = blockOf(seat)
  const plot = plotOf(buildingOf(seat))
  if (level < FLOOR + 0.5) {
    return intoGalaxy(
      intoGlobe(intoParcel(intoPlot(intoPlate(floorFrame(), storeyOf(seat)), plot), block)),
    )
  }
  // Between the floor and the block it is the building you are in: you may look
  // anywhere on your own tower and no further, for the same reason the floor
  // holds you to your own storey. Then the block, then the park, then the
  // planet, and then the network — which is the last of them, because there is
  // nowhere left to roam. The neighbourhood is a fixed frame
  // (`WORLDS_FRAMED`), so a drag at the top rung is a rotation rather than a
  // pan, and `stage.ts` routes it that way before it ever reaches here.
  const at = (l: Level) => frameFor(l, seat, storeys, buildings, blocks, sites, worlds)
  if (level < BLOCK - 0.5) return at(BUILDING)
  if (level < PARK - 0.5) return at(BLOCK)
  if (level < GLOBE - 0.5) return at(PARK)
  if (level < GALAXY - 0.5) return at(GLOBE)
  return galaxyFrame(worlds, sites, storeys, buildings, blocks)
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

/**
 * How far a gesture has to travel before it counts as meaning something.
 *
 * A fifth of a level. Below it the camera stays where it was parked, which is
 * what a stray wheel notch or a two-finger wobble deserves.
 */
export const SETTLE_INTENT = 0.18

/**
 * Where a gesture that started at `from` should settle.
 *
 * **Nearest is the wrong rule, and it is why the zoom felt like it was
 * fighting you.** `Math.round` means a pinch has to travel more than *half a
 * level in log space* — a factor of about 1.8 — before it lands anywhere new.
 * Anything less and the magnetic stop hauls the camera back to where it
 * started, so a deliberate, visible zoom gets silently undone. Reported as
 * "the zoom in got reversed forcibly back", which is exactly what it was.
 *
 * So the rule is intent, not proximity: past {@link SETTLE_INTENT} a gesture
 * always arrives **at least one level in the direction it was going**, and
 * nearest only breaks the tie when it has gone further than that. A nudge
 * leaves you where you were; a push moves you one; a shove moves you as many as
 * it earned.
 *
 * Levels count outward — Desk is 0, Building is 3 — so zooming *in* is a
 * decrease and the sign falls out of the arithmetic rather than being named.
 */
export function settleTowards(level: number, from: number | null): Level {
  if (from === null || !Number.isFinite(from)) return settleLevel(level)
  const moved = level - from
  if (Math.abs(moved) < SETTLE_INTENT) return settleLevel(from)
  const nearest = Math.round(level)
  const atLeastOne = Math.round(from) + Math.sign(moved)
  const to = moved > 0 ? Math.max(nearest, atLeastOne) : Math.min(nearest, atLeastOne)
  return clamp(to, DESK, TOP_LEVEL) as Level
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
  /** How many buildings stand on the address's own block. */
  private buildings = 1
  /** How many blocks stand in the park. The frames above the block need it. */
  private blocks = 1
  /** How many sites the studio has settled. Only the globe's own frame needs it. */
  private sites = 1
  /** How many worlds the studio has settled. Only the network's own frame needs it. */
  private worlds = 1

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
  /**
   * Where the camera was parked *at*, in the focused floor's own space, when it
   * was sent to a person rather than to a rectangle.
   *
   * Held next to {@link parked} and for the same reason. A level names a frame
   * and a frame has a centre, so re-deriving a parked camera from the level
   * alone quietly throws away any aim: `flyTo(DESK, founderDeskAt())` lands on
   * §7.8.10's corner desk, the frames then move — the room grows, the canvas is
   * laid out a second time — and the next re-derive re-centres on the *Desk
   * level's* own frame, which is seat 0, the first developer's chair. The
   * founder sits outside the seat lattice twelve units away, so a two-person
   * studio came to rest with the player's own avatar 395 px above the top of
   * the screen and nothing to tap.
   */
  private parkedAt: { x: number; y: number } | null = null
  /** Set when the frames have moved and a parked camera needs re-deriving. */
  private dirty = false
  /** True once the player has dragged, so a re-derive does not undo their pan. */
  private panned = false
  /**
   * The level the current gesture started from, or null between gestures.
   *
   * Held for the whole pinch rather than sampled at the end, because "which way
   * were you going" is a property of the gesture and the last frame of a pinch
   * that overshoots and comes back is pointing the wrong way.
   */
  private gestureFrom: number | null = null
  /**
   * §7.7.1 — the outermost level the camera may reach. See {@link setCeiling}.
   *
   * The whole ladder until a headcount says otherwise, so a lens standing on
   * its own — a test, a bench — is not silently pinned to a desk.
   */
  private ceiling: Level = TOP_LEVEL

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
   * already read. The ladder's rungs 0–5 are this scope's six levels, and
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
    /*
     * **The viewport is one of the frames.** Every level's scale is a fit
     * against it, so a resize moves every rung and a camera parked on one
     * of them is left holding a number that used to mean it.
     *
     * `parked`'s own note named this case — "the viewport rotates" — and the
     * flag was never set here. Nothing was known to be reading the wrong number
     * because of it; it was found while tracing a cold boot, where the canvas
     * is laid out once before the HUD and once after, and it is fixed on the
     * strength of the invariant rather than of a symptom. What kept it harmless
     * is not reassuring: §7.7.1's ceiling used to re-cut the camera from
     * outside the lens every frame, so a parked camera was being re-derived
     * constantly as a side effect of a different defect.
     */
    this.dirty = true
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
  setAddress(
    seat: number,
    storeys: number,
    buildings = 1,
    blocks = 1,
    sites = 1,
    worlds = 1,
  ): void {
    const nextSeat = Math.max(0, Math.floor(Number.isFinite(seat) ? seat : 0))
    const nextStoreys = Math.max(1, Math.floor(Number.isFinite(storeys) ? storeys : 1))
    const nextBuildings = Math.max(1, Math.floor(Number.isFinite(buildings) ? buildings : 1))
    const nextBlocks = Math.max(1, Math.floor(Number.isFinite(blocks) ? blocks : 1))
    const nextSites = Math.max(1, Math.floor(Number.isFinite(sites) ? sites : 1))
    const nextWorlds = Math.max(1, Math.floor(Number.isFinite(worlds) ? worlds : 1))
    if (
      nextSeat === this.seat &&
      nextStoreys === this.storeys &&
      nextBuildings === this.buildings &&
      nextBlocks === this.blocks &&
      nextSites === this.sites &&
      nextWorlds === this.worlds
    ) {
      return
    }
    // A new *building* moves the frames as surely as a new storey does, and it
    // moves them further: every level below the block is authored inside a plot
    // and the plot is somewhere else. A new block moves them further still.
    //
    // A new **site** does not, and that is the no-spin decision paying for
    // itself: the planet turns so that whichever site the address is in faces
    // the camera, so a park's position inside the globe is the same constant
    // whichever park it is. Changing continent moves nothing in this space.
    const moved =
      storeyOf(nextSeat) !== storeyOf(this.seat) || buildingOf(nextSeat) !== buildingOf(this.seat)
    this.seat = nextSeat
    this.storeys = nextStoreys
    this.buildings = nextBuildings
    this.blocks = nextBlocks
    this.sites = nextSites
    this.worlds = nextWorlds
    this.dirty = true
    if (moved && !this.commanded) {
      // Follow the focus without changing how close in we are.
      const here = settleLevel(this.level)
      const frame = frameFor(
        here,
        this.seat,
        this.storeys,
        this.buildings,
        this.blocks,
        this.sites,
        this.worlds,
      )
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
    const base = levelScales(
      this.seat,
      this.storeys,
      this.viewport,
      this.buildings,
      this.blocks,
      this.sites,
      this.worlds,
    )
    if (this.floorRect) base[FLOOR] = fitScaleFor(this.frameOf(FLOOR), this.viewport)
    // The garage is a rectangle that grows and it does not respect the nesting
    // — for the first thirty developers the room is smaller than the squad
    // that is supposed to contain it. `nestScales` is what keeps the ladder a
    // ladder; without it the rungs cross and the band between them stops
    // existing. See its own note.
    return nestScales(base)
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

  /**
   * §7.7.1 — how far out the camera may pull back, as a level.
   *
   * **The studio you can see is the studio you have.** With two developers
   * there is no floor to look at and no tower, and a lens that can reach them
   * says the world is a backdrop the player is pointing at rather than a place
   * they are filling.
   *
   * It lives *here* now, and that is the fix rather than a tidy-up. It used to
   * be held from outside, as `if (camera.z > ceiling) camera.set(ceiling)` once
   * a frame — a statement about the camera's Z made by something that could not
   * see the ladder the Z is derived from. When the rungs crossed (see
   * {@link nestScales}) that line stopped converging: the scale it asserted
   * reported a level *above* the ceiling, so it fired again on the very next
   * frame, and every frame after, and each firing threw away the gesture, the
   * settle and the pan. Thirty wheel notches moved the camera nothing at all,
   * because every one of them was undone 16 ms later by a rule that could not
   * satisfy itself.
   *
   * Owned by the lens, it is one bound on one clamp: the zoom stops there, the
   * settle will not target past it, and a commanded flight is held to it. There
   * is nothing to fight because there is no second opinion.
   *
   * Rounded, because a ceiling is a *rung* and rungs are whole. It arrives as
   * a Z on §7.2's ten-rung ladder and is read back as a level by one
   * multiplication, and a rung has to survive the round trip in one piece —
   * truncated, a ceiling a hair under the squad is a studio pinned to its own
   * desk with no way to see the room it is sitting in.
   */
  setCeiling(level: number): void {
    const next = clamp(Math.round(Number.isFinite(level) ? level : TOP_LEVEL), DESK, TOP_LEVEL) as Level
    if (next === this.ceiling) return
    this.ceiling = next
    this.dirty = true
  }

  /** The furthest-out scale §7.7.1 allows, for the frames as they are now. */
  private ceilingScale(scales = this.scales()): number {
    return scaleAtLevel(this.ceiling, scales)
  }

  /**
   * The frame a level names, for the current address.
   *
   * Nested the same way {@link nestScales} nests the ladder, and it has to be:
   * a level whose scale was pushed out to the room's must be *centred* on the
   * room too, or the camera sits at the garage's scale looking at the middle of
   * a squad block the garage is only one corner of. Two derivations of "where
   * is this level" is how a picture ends up framing nothing.
   */
  frameOf(level: Level): Rect {
    const room = this.floorRect ? this.roomFrame(this.floorRect) : null
    if (level === FLOOR && room) return room
    const own = frameFor(
      level,
      this.seat,
      this.storeys,
      this.buildings,
      this.blocks,
      this.sites,
      this.worlds,
    )
    if (!room || level > FLOOR) return own
    // A frame that holds *more* than the room fits at a smaller scale than the
    // room does. That is the crossing `nestScales` collapses.
    return fitScaleFor(own, this.viewport) < fitScaleFor(room, this.viewport) ? room : own
  }

  /**
   * The room's own rectangle, carried out to park space.
   *
   * Three nestings deep and written once, because it is written in three places
   * — the frame, the pan bounds and the re-derive — and a coordinate space that
   * is assembled by hand at every call site is trap 38 waiting to happen.
   */
  private roomFrame(rect: Rect): Rect {
    return intoGalaxy(
      intoGlobe(
        intoParcel(
          intoPlot(intoPlate(rect, storeyOf(this.seat)), plotOf(buildingOf(this.seat))),
          blockOf(this.seat),
        ),
      ),
    )
  }

  /** A point on the focused floor, in the camera's own space. */
  private floorPointToWorld(p: { x: number; y: number }): { x: number; y: number } {
    return globeToGalaxy(
      parkToGlobe(
        floorToPark(p, storeyOf(this.seat), plotOf(buildingOf(this.seat)), blockOf(this.seat)),
      ),
    )
  }

  /**
   * Send the camera to a level — the tap-to-enter and the breadcrumb.
   *
   * `immediate` is for startup and for `?z`, where an ease would be a lurch out
   * of a frame nobody has seen yet.
   */
  reframe(level: Level, immediate = false): void {
    level = Math.min(level, this.ceiling) as Level
    const frame = this.frameOf(level)
    const scale = fitScaleFor(frame, this.viewport)
    if (immediate) {
      this._scale = scale
      this._cx = frame.cx
      this._cy = frame.cy
      this.target = null
      this.commanded = false
      this.parked = level
      this.parkedAt = null
      this.gestureFrom = null
      this.panned = false
      return
    }
    this.target = { scale, cx: frame.cx, cy: frame.cy }
    this.commanded = true
    this.parked = level
    this.parkedAt = null
    this.gestureFrom = null
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
    level = Math.min(level, this.ceiling) as Level
    const frame = this.frameOf(level)
    const at = floorPoint ? this.floorPointToWorld(floorPoint) : null
    this.target = {
      scale: fitScaleFor(frame, this.viewport),
      cx: at ? at.x : frame.cx,
      cy: at ? at.y : frame.cy,
    }
    this.commanded = true
    this.parked = level
    this.parkedAt = floorPoint ? { x: floorPoint.x, y: floorPoint.y } : null
    this.gestureFrom = null
    this.panned = false
    this.idleSince = Number.POSITIVE_INFINITY
  }

  /**
   * Fly to a **rectangle of the focused floor**, rather than to a level.
   *
   * §7.8.12's TEAM control is the caller, and it needs this because the suite is
   * not the size of any rung. `flyTo` takes its scale from the level it is sent
   * to, so `flyTo(SQUAD, suiteCentre)` aims correctly and then draws the room at
   * a hundred-desk scale — the suite ends up a fifth of the frame with ninety
   * empty seats around it, which is a picture of the floor with the thing you
   * asked for in the corner of it.
   *
   * The level is still recorded, because everything downstream of the lens reads
   * one: the breadcrumb, §8.2's poke tier, §20.2's audio zones and §4.5b's unit
   * all ask "where am I". `parked` therefore names the rung this rectangle sits
   * *in* while the scale is the rectangle's own — which is a state the camera has
   * always been able to be in (a pinch leaves it between two levels every time)
   * and is not a new kind of thing to be.
   */
  flyToRect(level: Level, rect: Rect): void {
    level = Math.min(level, this.ceiling) as Level
    const centre = this.floorPointToWorld({ x: rect.cx, y: rect.cy })
    this.target = {
      scale: fitScaleFor(this.roomFrame(rect), this.viewport),
      cx: centre.x,
      cy: centre.y,
    }
    this.commanded = true
    this.parked = level
    this.parkedAt = { x: rect.cx, y: rect.cy }
    this.gestureFrom = null
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
    /*
     * **Clamped to the ladder, not to the ceiling — the ceiling arrives a frame
     * later and pulls it in.**
     *
     * Every caller of this sets a headcount and a camera in the same breath,
     * and the ceiling is derived from the headcount *by the ticker*, one frame
     * afterwards. Clamping here therefore clamps against the studio the player
     * had a moment ago: the scenario bar's 100 K button set a hundred thousand
     * developers and then asked for rung 5, and the lens — still holding the
     * ceiling of an empty studio — parked it at the squad. Reported as "100k
     * view does not have any more than 1 building", and the block was there the
     * whole time, two zoom levels out.
     *
     * `update` holds the ceiling every frame, so a Z past it is corrected on
     * the next one with the right headcount in hand. §7.7.1 is not weakened by
     * being applied a frame late; it was weakened by being applied early.
     */
    const level = clamp(z * 9, DESK, TOP_LEVEL)
    const frame = this.frameOf(settleLevel(level))
    this._scale = scaleAtLevel(level, this.scales())
    this._cx = frame.cx
    this._cy = frame.cy
    this.target = null
    this.commanded = false
    this.parked = level
    this.parkedAt = null
    this.gestureFrom = null
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
    /*
     * The first frame of a gesture remembers where it began — see
     * `settleTowards`.
     *
     * `parked` when the camera is at rest, because that is the stop it is
     * sitting on. But **the live level while a flight is in progress**, and
     * that distinction is load-bearing: `parked` during a commanded flight is
     * the *destination*, so a pinch that interrupts a pull-in would be measured
     * against a level the camera has not reached and would read as travelling
     * outward while the fingers moved inward. The player sees where the camera
     * is, not where it was going.
     */
    if (this.gestureFrom === null) {
      this.gestureFrom = this.target !== null ? this.level : (this.parked ?? this.level)
    }
    const scales = this.scales()
    // Out stops at §7.7.1's ceiling and in stops a little past the desk. A
    // hard stop rather than a rubber band, because a zoom that travels and then
    // springs back is the thing the settle was just taught not to do.
    const next = clamp(this._scale * factor, this.ceilingScale(scales), scales[DESK] * 1.6)
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
    this.parkedAt = null
    this.idleSince = now
  }

  /** Drag the world, in screen pixels. */
  /** What the camera may roam over — the floor it is in, or the building. */
  private bounds(): Rect {
    if (this.level < FLOOR + 0.5 && this.floorRect) return this.roomFrame(this.floorRect)
    return panBounds(
      this.level,
      this.seat,
      this.storeys,
      this.buildings,
      this.blocks,
      this.sites,
      this.worlds,
    )
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
          // The aim first, if there was one — see `parkedAt`. A camera sent to
          // a person is parked on the person, not on the rectangle the level
          // happens to name.
          if (this.parkedAt) {
            const at = this.floorPointToWorld(this.parkedAt)
            this._cx = at.x
            this._cy = at.y
          } else {
            const frame = this.frameOf(settleLevel(this.parked))
            this._cx = frame.cx
            this._cy = frame.cy
          }
        }
      }
    }

    if (this.target === null && now - this.idleSince > SETTLE_DELAY_MS) {
      // **The magnetic stop.** Nothing between two levels is a picture of
      // anything, so the camera is never left there.
      // Held to the ceiling: `settleTowards` promises a gesture at least one
      // level in the direction it was going, and outward that promise runs off
      // the end of the studio the player has built.
      const to = Math.min(settleTowards(this.level, this.gestureFrom), this.ceiling) as Level
      const scale = scaleAtLevel(to, this.scales())
      this.parked = to
      this.gestureFrom = null
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

    /*
     * **The ceiling, held.** The zoom already stops there, so the only way to
     * be outside it is for the world to have moved rather than the camera: the
     * ceiling itself coming down on a new career, or the frames shifting under
     * a lens that is sitting still — the garage growing, a storey arriving, the
     * viewport turning.
     *
     * After the ease rather than before it, so a flight cannot be clamped on
     * its first frame and then eased straight back out through the bound.
     */
    const limit = this.ceilingScale()
    if (this._scale < limit) {
      this._scale = limit
      if (this.parked !== null) this.parked = Math.min(this.parked, this.ceiling)
      if (this.target && this.target.scale < limit) this.target = { ...this.target, scale: limit }
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
