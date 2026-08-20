/**
 * Level 3 — the building: a tower to choose a floor from, and that floor's plan
 * pulled out beside it.
 *
 * **`devs` here is the headcount of *this building*, not of the studio.** It
 * was the studio's when there was only ever one of them, and the difference is
 * the whole of what the block level changed in this file: `setHeadcount` takes
 * `devsIn(state.devs, building)` and every storey, squad and window count below
 * reads from that. A tower that drew the studio's headcount would put ten full
 * floors in every building on the block.
 *
 * `docs/PLAN-2026-08-19-lens.md` §4. What this replaces was a solid slab tower
 * measuring 190 px wide in a 997 px frame with nothing else on screen. Two
 * things were wrong with it and only one of them was the size.
 *
 * **A closed box says nothing about being enterable.** The brief was "I need
 * the option to click and choose which floor to go into", and a facade offers
 * no answer to which floor is which, how full any of them is, or which one you
 * are standing in. The mechanism existed and nothing on screen said so.
 *
 * **And an edge-on band cannot be zoomed into.** The rule the camera rests on
 * is that a child is drawn inside its parent's cell, so descending is one
 * affine transform; a storey drawn as a band is not a picture of a floor plan,
 * and becoming one needs a cut.
 *
 * The answer is both at once, and `frames.ts` records the three compositions
 * measured on the way to it. The **tower** is what a building looks like: bands
 * you have not opened, compact and countable, each a 36 px thumb target. The
 * **plan** is the floor you have selected, lifted out to the side at 286 px —
 * twice what any arrangement of ten plans could manage — joined back to its own
 * band by the lift line. Descending zooms into the plan, which *is* the room's
 * own geometry at `PLATE_SCALE`, so the transform stays exact and there is
 * still nothing to cross-fade.
 *
 * Procedural, from the master palette. ART_DIRECTION §4 classes everything at
 * this scale as T0/T3 and §7.8.2 is explicit that no rung above the room needs
 * a bespoke sprite, which is the whole reason the §22.7 art budget can be
 * nineteen.
 */

import { Container, Graphics } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import {
  BAND_H,
  DEVS_PER_FLOOR,
  FLOORS_PER_BUILDING,
  PLATE_SCALE,
  PODIUM_H,
  PODIUM_W,
  SHADOW_SPREAD,
  TOWER_GROUND,
  TOWER_CROWN,
  TOWER_D,
  TOWER_W,
  towerSurfaceY,
  bandRect,
  floorOutline,
  plateAt,
  squadOutline,
  storeysIn,
} from './frames.ts'
import { ROOM_SQUAD_COLS, ROOM_SQUAD_ROWS, SQUAD_SIZE } from './room.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** Squads on one floor — five across, two back. */
const SQUADS_PER_FLOOR = ROOM_SQUAD_COLS * ROOM_SQUAD_ROWS

const HALF_W = TOWER_W / 2
const HALF_D = TOWER_D / 2

/**
 * How thick the pulled-out plan's slab is, in floor-space units.
 *
 * A plan with no thickness is a rug. The extrusion under its two near edges is
 * what says the thing lifted out of the tower is a *floor* and not a diagram.
 */
const SLAB_H = 260

/** How long a storey takes to land — §7.7.2's deadpan slapstick. */
export const STOREY_DROP_MS = 720

/** Where a storey is on its way down, in building units above its band. */
export function storeyDropHeight(t: number): number {
  if (t <= 0) return 520
  if (t >= 1) return 0
  // Distance as t², so it is moving fastest at the instant it lands. An
  // ease-out reads as a crane lowering it, which is a different joke.
  return 520 * (1 - t * t)
}

/** How many developers are on storey `f` of a studio of `devs`. */
export function devsOnStorey(devs: number, f: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(devs) ? devs : 0))
  return Math.max(0, Math.min(DEVS_PER_FLOOR, n - f * DEVS_PER_FLOOR))
}

/** How many of a storey's ten squads have anybody in them. */
export function squadsOnStorey(devs: number, f: number): number {
  return Math.min(SQUADS_PER_FLOOR, Math.ceil(devsOnStorey(devs, f) / SQUAD_SIZE))
}

function poly(g: Graphics, pts: ReadonlyArray<{ x: number; y: number }>) {
  g.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
  g.closePath()
}

/**
 * The building's surface — re-exported from `frames.ts`, which owns it.
 *
 * It lived here first, and living here is what let it disagree with the picker:
 * `storeyAtBuilding` tested an upright rectangle against a band this function
 * shears, and a tap in the middle of the tower landed four fifths of a floor
 * low. Geometry the camera and the finger both depend on belongs with the rest
 * of the level model, and the drawing borrows it rather than restating it.
 */
export const surfaceY = towerSurfaceY

/**
 * A quad lying flat on a facade — `x0` to `x1`, `dy` below the surface at
 * `level`, `h` tall.
 *
 * Sheared, not axis-aligned. A rectangle on a raked wall is a sticker: the old
 * windows were `g.rect`, and at 11 px across that is the difference between
 * glazing and a decal. The two vertical edges stay vertical because in this
 * projection vertical *is* vertical; only the top and bottom rake.
 */
function facade(g: Graphics, x0: number, x1: number, level: number, dy: number, h: number) {
  const a = surfaceY(x0, level) + dy
  const b = surfaceY(x1, level) + dy
  g.moveTo(x0, a).lineTo(x1, b).lineTo(x1, b + h).lineTo(x0, a + h).closePath()
}

/** A small isometric box standing on the deck at `baseY` — roof plant, lift overrun. */
function box(g: Graphics, cx: number, baseY: number, w: number, h: number, side: Sides) {
  const hw = w / 2
  const hd = w / 4
  const ty = baseY - h
  poly(g, [
    { x: cx, y: ty - hd },
    { x: cx + hw, y: ty },
    { x: cx, y: ty + hd },
    { x: cx - hw, y: ty },
  ])
  g.fill(c(side.top))
  poly(g, [
    { x: cx - hw, y: ty },
    { x: cx, y: ty + hd },
    { x: cx, y: baseY + hd },
    { x: cx - hw, y: baseY },
  ])
  g.fill(c(side.left))
  poly(g, [
    { x: cx + hw, y: ty },
    { x: cx, y: ty + hd },
    { x: cx, y: baseY + hd },
    { x: cx + hw, y: baseY },
  ])
  g.fill(c(side.right))
}

interface Sides {
  top: string
  left: string
  right: string
}

/**
 * The two faces, by index: 0 is the left one and it is the lit one.
 *
 * ART_DIRECTION §7 puts the single source at the top left and says to hold it
 * by hand because no script can check it. Every colour the tower uses is a pair
 * indexed by face, so holding it is a matter of never writing a bare ramp entry
 * below rather than of remembering which way the sun is.
 */
const CURTAIN = {
  /** Precast spandrel — the solid band between one storey's glass and the next. */
  spandrel: [RAMPS.NEUTRAL[3], RAMPS.NEUTRAL[1]],
  /**
   * The mullion grid. Panes are drawn on top of it, so the gaps *are* the frame.
   *
   * **Lighter than the spandrel, not darker.** Mullions are extruded aluminium
   * and they are the one part of a curtain wall that catches the sky; drawn
   * dark they read as gaps in the building rather than as the thing holding the
   * glass up. The first pass put the shaded face's frame and its empty panes on
   * the same ramp entry, which is a grid nobody can see at all.
   */
  frame: [RAMPS.NEUTRAL[4], RAMPS.NEUTRAL[2]],
  /**
   * Glass with nobody behind it.
   *
   * **Never NEUTRAL[0].** That entry *is* the app's background, so a pane
   * painted in it is not dark glass, it is a hole punched through the building
   * — and an empty top storey came out as a black slot cut across the tower.
   * Two ramp steps under the mullion is enough to read as a void without
   * becoming one.
   */
  dark: [RAMPS.NEUTRAL[2], RAMPS.NEUTRAL[1]],
  /** The floor plate, showing as a bright line where the curtain wall passes it. */
  slab: [RAMPS.NEUTRAL[5], RAMPS.NEUTRAL[3]],
  /** A squad at their desks. Monitor light, not lamp light — that is the whole joke. */
  lit: [RAMPS.GLOW[2], RAMPS.GLOW[1]],
  /** The same, further from the window. */
  dim: [RAMPS.GLOW[1], RAMPS.GLOW[0]],
  /** Somebody has the overheads on. Amber, and rare. */
  late: [RAMPS.WARN[2], RAMPS.WARN[1]],
} as const

/**
 * Bays per face — five, and five because the floor inside has five squads across.
 *
 * So the ten lit windows of a full storey are not a bar chart drawn as windows:
 * each one is a squad, the left face is the floor's front row and the right face
 * its back row, and the tower is a true picture of the plan pulled out beside it.
 */
export const BAYS = 5
export const BAY_PITCH = HALF_W / BAYS
export const PANE_W = BAY_PITCH - 4
/** Where the glazing sits inside a storey, measured down from its own ceiling. */
const GLASS_TOP = 9
const GLASS_H = 22
/** The floor plate below it, and how thick it reads. */
const PLATE_TOP = GLASS_TOP + GLASS_H + 2
const PLATE_H = 3

/**
 * Which of three lit tones a pane takes — deterministic, so it never flickers.
 *
 * A floor where every occupied window is the same cyan reads as a progress bar
 * stood on its end. Six per cent of it is on the overheads and a fifth is a row
 * further back from the glass, which is the difference between an occupancy
 * meter and a building at night. Hashed from the storey and the squad rather
 * than sampled, because `redrawTower` runs on every hire and a pane that picks
 * a new tone each time is a fault light.
 */
export function paneTone(f: number, squad: number): keyof typeof CURTAIN {
  const h = Math.sin(f * 127.1 + squad * 311.7) * 43758.5453
  const r = h - Math.floor(h)
  if (r < 0.06) return 'late'
  if (r < 0.26) return 'dim'
  return 'lit'
}

/**
 * One storey: two curtain-walled faces, its floor plate, and its lit squads.
 *
 * `lit` is **squads**, not a fraction — `squadsOnStorey` already knows the
 * number and a window is a squad, so rounding a ratio back into a window count
 * was two conversions where none was needed.
 *
 * **No roof except on the top storey.** Every storey used to draw its own slab
 * top, and a slab top is a diamond `TOWER_D` deep while the storeys are only
 * `BAND_H` apart — so each floor's roof covered the two or three above it and a
 * ten-storey building rendered as one smooth column of overlapping diamonds.
 */
function drawStorey(g: Graphics, f: number, lit: number, focused: boolean) {
  for (let side = 0; side < 2; side++) {
    const x0 = side === 0 ? -HALF_W : 0
    const x1 = side === 0 ? 0 : HALF_W

    facade(g, x0, x1, f + 1, 0, BAND_H)
    g.fill(c(CURTAIN.spandrel[side]))

    // The mullion grid, laid down whole. The panes below cover everything
    // except the four-unit gaps between them, and those gaps are the mullions.
    facade(g, x0, x1, f + 1, GLASS_TOP, GLASS_H)
    g.fill(c(CURTAIN.frame[side]))

    for (let i = 0; i < BAYS; i++) {
      const px = (side === 0 ? -HALF_W : 0) + 2 + i * BAY_PITCH
      const squad = side * BAYS + i
      const tone = squad < lit ? paneTone(f, squad) : 'dark'
      facade(g, px, px + PANE_W, f + 1, GLASS_TOP + 2, GLASS_H - 4)
      g.fill(c(CURTAIN[tone][side]))
    }

    // The floor plate. A curtain wall hangs *past* the slab it is bolted to, so
    // the slab shows as a bright line once per storey — which is also the one
    // mark that makes ten floors countable at a glance.
    facade(g, x0, x1, f + 1, PLATE_TOP, PLATE_H)
    g.fill(c(CURTAIN.slab[side]))
  }

  // The arris. Two faces two ramp steps apart is not enough edge at 160 px
  // across, and the corner is the only thing giving the building volume.
  g.moveTo(0, surfaceY(0, f + 1))
    .lineTo(0, surfaceY(0, f))
    .stroke({ width: 1, color: c(RAMPS.NEUTRAL[6]), alpha: 0.3 })

  if (focused) {
    /*
     * The storey the address is in, said three ways.
     *
     * A two-pixel outline was the whole of it, and against a facade already
     * made of bright horizontal rules it is one more bright horizontal rule —
     * "the one I clicked is not the one I selected" was reported about a
     * selection that was in fact correct, because nothing on the tower said so
     * loudly enough to argue with. So: the glass takes the interface's own
     * phosphor as a wash, the outline is heavier, and a solid tab hangs off the
     * side of the band, outside the building's silhouette where nothing else in
     * the picture lives.
     *
     * Phosphor rather than the building's palette throughout, because none of
     * this is architecture: it is the game pointing at a door.
     */
    const outline = () => {
      g.moveTo(-HALF_W, surfaceY(-HALF_W, f + 1))
        .lineTo(0, surfaceY(0, f + 1))
        .lineTo(HALF_W, surfaceY(HALF_W, f + 1))
        .lineTo(HALF_W, surfaceY(HALF_W, f))
        .lineTo(0, surfaceY(0, f))
        .lineTo(-HALF_W, surfaceY(-HALF_W, f))
        .closePath()
    }
    outline()
    g.fill({ color: c(RAMPS.CALM[1]), alpha: 0.2 })
    outline()
    g.stroke({ width: 3, color: c(RAMPS.CALM[2]), alpha: 0.95 })

    // The tab: a solid wedge on the lit side, pointing in at the open floor.
    // Read at a glance from across the frame, which is the one thing an outline
    // running along the same lines as ten floor plates cannot do.
    const top = surfaceY(-HALF_W, f + 1)
    const mid = top + BAND_H / 2
    poly(g, [
      { x: -HALF_W - 3, y: top + BAND_H * 0.18 },
      { x: -HALF_W - 3, y: top + BAND_H * 0.82 },
      { x: -HALF_W - 16, y: mid + BAND_H * 0.34 },
      { x: -HALF_W - 16, y: mid - BAND_H * 0.34 },
    ])
    g.fill(c(RAMPS.CALM[2]))
  }
}

/**
 * The crown, drawn once, on the top storey — a building has one.
 *
 * The deck's own corners are at `surfaceY(±HALF_W, n)`, and getting that wrong
 * is what produced the two notched wings at the top of the old tower: the
 * diamond was placed `HALF_D` low, so the top storey's faces stood proud of
 * their own roof by thirty-seven units and the building appeared to be broken
 * open. A skyline ends in a parapet, a plant room and a mast, and none of those
 * are decoration — they are what stops a stack of floors ending in a lid.
 */
function drawRoof(g: Graphics, n: number) {
  const y = surfaceY(HALF_W, n)
  const deck = [
    { x: 0, y: y - HALF_D },
    { x: HALF_W, y },
    { x: 0, y: y + HALF_D },
    { x: -HALF_W, y },
  ]
  poly(g, deck)
  g.fill(c(RAMPS.NEUTRAL[3]))
  poly(g, deck)
  g.stroke({ width: 2, color: c(RAMPS.NEUTRAL[5]), alpha: 0.85 })

  // Plant room and lift overrun. Both are boxes rather than the five-sided
  // polygon that used to stand here, which read as a chip out of the roof.
  //
  // **Every face of them is lighter than the deck.** Taken from the building's
  // own shading pair they came out at NEUTRAL[1] on the shaded side, and against
  // a NEUTRAL[3] deck that is not a box in shadow, it is a rectangular hole —
  // which is what the first pass looked like: two pits punched in the roof.
  box(g, -20, y + 5, 40, 13, {
    top: RAMPS.NEUTRAL[6],
    left: RAMPS.NEUTRAL[5],
    right: RAMPS.NEUTRAL[3],
  })
  box(g, 22, y - 2, 26, 20, {
    top: RAMPS.NEUTRAL[6],
    left: RAMPS.NEUTRAL[4],
    right: RAMPS.NEUTRAL[2],
  })

  // The mast, and the aviation light every skyline has and no brief ever asks
  // for. One red pixel at the top of a grey building is most of what says the
  // thing is enormous — and `TOWER_CROWN` is the frame agreeing to leave room
  // for it, which the first pass did not, so this was drawn and then cropped
  // off by its own viewport.
  const mast = TOWER_CROWN - 18
  g.rect(-1, y - mast, 2, mast - 4).fill(c(RAMPS.NEUTRAL[4]))
  g.circle(0, y - mast, 2.5).fill(c(RAMPS.ALARM[2]))
}

// The plinth's dimensions live in `frames.ts` — `buildingFrame`, `towerRect`
// and `block.ts`'s pads all measure against them, and a second copy here is how
// the frame came to be cutting twenty units off the bottom of its own subject.
export { PODIUM_H }

/**
 * The plinth's top surface — an apron of pavement around the shaft's foot.
 *
 * Drawn *before* the storeys, so the tower paints over everything but the near
 * sliver: that sliver is the whole of the effect, and it is what stops the
 * building looking like a column somebody dropped on the floor.
 */
function drawPodiumDeck(g: Graphics) {
  poly(g, [
    { x: 0, y: surfaceY(0, 0) - PODIUM_W / 2 },
    { x: PODIUM_W, y: surfaceY(PODIUM_W, 0) },
    { x: 0, y: surfaceY(0, 0) + PODIUM_W / 2 },
    { x: -PODIUM_W, y: surfaceY(-PODIUM_W, 0) },
  ])
  g.fill(c(RAMPS.NEUTRAL[3]))
}

/**
 * The plinth's two faces, and the lobby.
 *
 * A lobby is lit whatever the hour and whatever the headcount, which is the
 * point of putting one here: the ground floor of this building glows even when
 * the studio is one person, and it is the only part of the tower that says so.
 */
function drawPodium(g: Graphics) {
  for (let side = 0; side < 2; side++) {
    const x0 = side === 0 ? -PODIUM_W : 0
    const x1 = side === 0 ? 0 : PODIUM_W
    const a = surfaceY(x0, 0)
    const b = surfaceY(x1, 0)

    g.moveTo(x0, a)
      .lineTo(x1, b)
      .lineTo(x1, b + PODIUM_H)
      .lineTo(x0, a + PODIUM_H)
      .closePath()
      .fill(c(side === 0 ? RAMPS.NEUTRAL[2] : RAMPS.NEUTRAL[1]))

    // The lobby glazing, run as one ribbon with piers in it rather than as
    // windows: at ground level the glass is the whole wall.
    g.moveTo(x0, a + 5)
      .lineTo(x1, b + 5)
      .lineTo(x1, b + 15)
      .lineTo(x0, a + 15)
      .closePath()
      .fill(c(side === 0 ? RAMPS.GLOW[1] : RAMPS.GLOW[0]))

    for (let i = 1; i < 5; i++) {
      const px = x0 + ((x1 - x0) * i) / 5
      const py = surfaceY(px, 0)
      g.moveTo(px, py + 5)
        .lineTo(px, py + 15)
        .stroke({ width: 2, color: c(side === 0 ? RAMPS.NEUTRAL[3] : RAMPS.NEUTRAL[1]) })
    }

    // The pavement line at the plinth's foot, so the building meets the ground
    // rather than fading into it.
    g.moveTo(x0, a + PODIUM_H)
      .lineTo(x1, b + PODIUM_H)
      .stroke({ width: 1, color: c(RAMPS.NEUTRAL[0]) })
  }
}

/**
 * The focused floor's plan, drawn in floor space.
 *
 * Read at about 286 px across, so everything here is a statement made in a few
 * pixels: the slab, ten squad plates, and how full each one is. Detail below
 * that grain is cost with no information, and the room itself takes over the
 * moment the plan is worth more than a plan.
 */
function drawPlan(g: Graphics, onFloor: number) {
  const outline = floorOutline()

  // The slab's own thickness, under the two near edges, drawn first so the deck
  // lands on top of it.
  const near = [outline[1], outline[2], outline[3]]
  g.moveTo(near[0].x, near[0].y)
  for (const pt of near) g.lineTo(pt.x, pt.y)
  g.lineTo(near[2].x, near[2].y + SLAB_H)
  g.lineTo(near[1].x, near[1].y + SLAB_H)
  g.lineTo(near[0].x, near[0].y + SLAB_H)
  g.closePath().fill(c(RAMPS.NEUTRAL[1]))

  poly(g, outline)
  g.fill(c(RAMPS.NEUTRAL[3]))

  // Ten squad plates. A full squad is a bank of desks and reads as wood; a
  // part-full one is filled to its own share along the row axis, so the last
  // squad on a floor visibly fills up rather than switching on.
  for (let s = 0; s < SQUADS_PER_FLOOR; s++) {
    const pts = squadOutline(s)
    const inSquad = Math.max(0, Math.min(SQUAD_SIZE, onFloor - s * SQUAD_SIZE))
    poly(g, pts)
    g.fill(c(RAMPS.NEUTRAL[2]))
    if (inSquad <= 0) continue
    const t = inSquad / SQUAD_SIZE
    const [a, b, cc, d] = pts
    const at = (p: { x: number; y: number }, q: { x: number; y: number }, k: number) => ({
      x: p.x + (q.x - p.x) * k,
      y: p.y + (q.y - p.y) * k,
    })
    poly(g, [a, b, at(b, cc, t), at(a, d, t)])
    g.fill(c(RAMPS.WOOD[1]))

    /*
     * The desk rows, and they are the difference between a floor plan and a rug.
     *
     * A squad filled flat in `WOOD[2]` is a correct occupancy reading and an
     * orange tile: at ten storeys the room is below `ROOM_RESOLVE_SCALE` and
     * never draws, so this abstraction is the *only* picture of the floor, and
     * a full building came out as a sheet of amber next to a cool grey tower.
     * Six banks of desks with a line of monitor light down each is the same
     * information and is legibly furniture — which is what the room underneath
     * will turn into when the camera arrives.
     */
    const ROWS = 6
    for (let r = 1; r <= ROWS; r++) {
      const k = (r / ROWS) * t
      const from = at(a, d, k)
      const to = at(b, cc, k)
      g.moveTo(from.x, from.y)
        .lineTo(to.x, to.y)
        .stroke({ width: 26, color: c(RAMPS.WOOD[2]) })
      g.moveTo(from.x, from.y)
        .lineTo(to.x, to.y)
        .stroke({ width: 9, color: c(RAMPS.GLOW[1]), alpha: 0.85 })
    }
  }

  // The corridors are the gaps between the plates and want an edge, or the
  // whole deck reads as one texture.
  poly(g, outline)
  g.stroke({ width: 30, color: c(RAMPS.CALM[1]), alpha: 0.9 })
}

/**
 * The tower alone — no plan, no lift line. What one plot of the block holds.
 *
 * Exported because `block.ts` draws nine of these and this file draws the
 * tenth, and they have to be the same picture: the block's tower for a plot and
 * the real building parented into that same plot are drawn at the same size in
 * the same place, so the hand-off as the camera descends is a swap nobody can
 * see. That is the {@link ROOM_RESOLVE_SCALE} trick again, one level up — match
 * the two representations at the size they trade at, rather than blending two
 * that never match.
 *
 * `focus` is which storey is lit, or −1 for none. A block does not light a
 * storey: at that scale a band is 19 px and the thing being chosen is the
 * building.
 */
export function drawTower(g: Graphics, storeys: number, devs: number, focus = -1): void {
  const n = Math.max(0, Math.min(FLOORS_PER_BUILDING, Math.floor(storeys)))
  if (n <= 0) return
  drawPodiumDeck(g)
  drawRoof(g, n)
  for (let f = n - 1; f >= 0; f--) drawStorey(g, f, squadsOnStorey(devs, f), f === focus)
  drawPodium(g)
}

export interface BuildingHandle {
  container: Container
  /**
   * Where a floor's own geometry belongs.
   *
   * There is one plan slot, because one floor is open at a time. The room is
   * parented *into* it rather than drawn beside it: the room is inside the
   * plan, at the plan's scale, so a descent is one transform and there is
   * nothing to cross-fade.
   */
  plateHost(storey: number): Container
  /** Rebuild for a headcount. Cheap on change, far too dear per frame. */
  setHeadcount(devs: number): void
  /** Which storey is open — lit on the tower, and drawn out as the plan. */
  setFocus(storey: number): void
  /**
   * Hide the plan, because the room is drawing the real thing.
   *
   * The two are the same picture at the same size at the moment of the swap —
   * that is what `ROOM_RESOLVE_SCALE` is chosen for — so this is a swap the
   * player cannot see rather than a fade between two that never match.
   */
  setPlanHidden(storey: number, hidden: boolean): void
  /** Fade the tower out as the camera goes indoors. */
  setChromeAlpha(alpha: number): void
  /**
   * Fade the pulled-out plan in as the *block* goes away.
   *
   * The plan is 286 units wide against a 130-unit plot stride, so at block
   * scale it would be drawn straight across the neighbouring building. It
   * arrives as the last neighbour leaves — two different objects trading
   * places, which is a fade §10.5 allows, rather than two pictures of one
   * object, which is the one it forbids.
   */
  setPlanAlpha(alpha: number): void
  /** Advance §7.7.2's arrival. `now` in ms. */
  update(now: number): void
  readonly settling: boolean
  readonly storeys: number
}

export function buildBuilding(): BuildingHandle {
  const root = new Container()
  const ground = new Graphics()
  const tower = new Graphics()
  const rising = new Graphics()
  const link = new Graphics()
  const plan = new Container()
  const planGfx = new Graphics()
  const host = new Container()

  const slot = plateAt()
  plan.position.set(slot.x, slot.y)
  plan.scale.set(PLATE_SCALE)
  plan.addChild(planGfx, host)
  root.addChild(ground, tower, rising, link, plan)

  let devs = 0
  let storeys = 1
  let focus = 0
  let planHidden = false
  let arriving = false
  let arrivalStart = 0

  /*
   * Back to front, which for a tower means top down — see {@link drawTower},
   * which owns the order now because the block draws the same thing.
   */
  function redrawTower(n: number) {
    tower.clear()
    drawTower(tower, n, devs, focus)
  }

  function redrawGround() {
    ground.clear()
    // The plot. NEUTRAL[1] rather than [0] — the app's background *is*
    // NEUTRAL[0], so a ground plane drawn in it is not a dark ground plane, it
    // is a hole, and the building above it floats.
    // Under the plinth's foot rather than under the shaft's: the building now
    // meets the ground twenty units lower than it used to, and a shadow left
    // where the shaft ends is a shadow halfway up the lobby.
    /*
     * **Under the plinth, and wider than it.** It used to be an ellipse at
     * `PLOT_DROP * 0.92` with the shaft's proportions, which put it entirely
     * *inside* the plinth deck — a shadow drawn under a thing that then paints
     * over all of it is not a shadow, and the building had nothing grounding it
     * at all. Centred on the deck and oversailing it by {@link SHADOW_SPREAD},
     * what shows is a rim, which is the whole of what says a heavy object is
     * resting on something.
     */
    ground
      .ellipse(0, TOWER_GROUND, PODIUM_W * SHADOW_SPREAD, (PODIUM_W / 2) * SHADOW_SPREAD)
      .fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.75 })
  }

  function redrawLink() {
    link.clear()
    const band = bandRect(focus)
    const target = plateAt()
    // The lift line: out of the open storey, across, and into the plan. It is
    // the one line that says the plan is a floor *of this building* rather than
    // a second drawing beside it — and it is also what the player is riding
    // when they change floors.
    link
      .moveTo(band.cx + band.w / 2, band.cy)
      .lineTo(target.x - 40, band.cy)
      .lineTo(target.x - 40, target.y + 60)
      .stroke({ width: 2, color: c(RAMPS.CALM[1]), alpha: 0.75 })
    link.circle(band.cx + band.w / 2, band.cy, 4).fill(c(RAMPS.CALM[2]))
    link.circle(target.x - 40, target.y + 60, 4).fill(c(RAMPS.CALM[2]))
  }

  function redrawPlan() {
    planGfx.clear()
    if (planHidden) return
    drawPlan(planGfx, devsOnStorey(devs, focus))
  }

  redrawTower(storeys)
  redrawGround()
  redrawLink()
  redrawPlan()

  return {
    container: root,

    plateHost() {
      return host
    },

    setHeadcount(next: number) {
      const n = Math.max(0, Math.floor(Number.isFinite(next) ? next : 0))
      if (n === devs) return
      const before = storeys
      devs = n
      storeys = storeysIn(n)
      if (storeys > before) {
        // Only a *gain* is an arrival. Act V liquidates the studio, and a
        // building shedding floors is not a beat anyone should be shown.
        arriving = true
        arrivalStart = performance.now()
      }
      redrawTower(arriving ? storeys - 1 : storeys)
      redrawPlan()
    },

    setFocus(storey: number) {
      const next = Math.max(0, Math.min(storeys - 1, Math.floor(storey)))
      if (next === focus) return
      focus = next
      redrawTower(storeys)
      redrawLink()
      redrawPlan()
    },

    setPlanHidden(_storey: number, hide: boolean) {
      if (hide === planHidden) return
      planHidden = hide
      redrawPlan()
    },

    setPlanAlpha(alpha: number) {
      const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1))
      plan.alpha = a
      plan.renderable = a > 0.004
      link.visible = plan.renderable
    },

    setChromeAlpha(alpha: number) {
      const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1))
      ground.alpha = a
      tower.alpha = a
      rising.alpha = a
      link.alpha = a
      // The plan is not chrome — it is the thing the room replaces, and it is
      // hidden rather than faded (see `setPlanHidden`), so the two are never
      // both half-present.
    },

    update(now: number) {
      if (!arriving) return
      const t = (now - arrivalStart) / STOREY_DROP_MS
      rising.clear()
      if (t >= 1) {
        arriving = false
        rising.position.set(0, 0)
        redrawTower(storeys)
        return
      }
      rising.position.set(0, -storeyDropHeight(t))
      drawStorey(rising, storeys - 1, squadsOnStorey(devs, storeys - 1), false)
    },

    get settling() {
      return arriving
    },
    get storeys() {
      return storeys
    },
  }
}
