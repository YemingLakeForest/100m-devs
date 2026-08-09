/**
 * Rungs 4–6 — the city. GDD §7.7.1, §7.7.2, §7.8.2.
 *
 * `tower.ts` took the picture from one thousand developers to ten thousand and
 * then **stopped**: §7.7.1 caps rung 3 at ten storeys, and above that the studio
 * grew and the screen did not. That is the exact failure §7.7 opens by
 * forbidding — *a counter with a particle effect* — arriving at the moment the
 * numbers get interesting, which is where the tower left it.
 *
 * This carries it four more decades:
 *
 * | Rung | Unit | The frame |
 * |---|---|---|
 * | 4 | **a building** | a block |
 * | 5 | **a campus** | a business park |
 * | 6 | **a town** | a sprawl to the horizon |
 *
 * **Every unit is drawn at the same footprint, on purpose.** §7.7.1's promise is
 * that the *unit* changes, not that the same unit gets smaller — so a town
 * occupies exactly as much screen as a building did, and the difference between
 * them is what is inside it. Shrinking would have been cheaper and would have
 * said the opposite thing: that the studio is receding rather than growing.
 *
 * Rungs 7–9 — nation, planet, galaxy — are **not here**. They are a different
 * register (a lit coastline, a world, a cluster) rather than more architecture,
 * and §7.4's Level 3 and Level 4 tiers already hold that scale from the camera's
 * side. Building them badly to fill the table would be worse than the honest
 * gap.
 *
 * Procedural, from the master palette. §7.8.2: no rung above 2 requires a single
 * bespoke sprite, which is the whole reason the §22.7 art budget can be nineteen.
 */

import { Container, Graphics } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import { RUNGS, rungFor } from '../sim/headcount.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** The first rung this tier draws — above `tower.ts`'s ten storeys. */
export const CITY_FIRST_RUNG = 4
/** The last. Above this, §7.4's Level 3 and 4 tiers carry the scale. */
export const CITY_LAST_RUNG = 6

/**
 * Most units drawn at once.
 *
 * The same ten `tower.ts` caps its storeys at, and for the same reason: past
 * roughly a dozen objects the eye stops counting, so an eleventh adds cost and
 * no information. Within a rung the count saturates and the *next rung* is what
 * moves the picture on — which is what makes a promotion worth scoring.
 */
export const MAX_UNITS = 10

/** How long one unit takes to fall out of the sky and land. */
export const UNIT_DROP_MS = 760
const DROP_FROM = 620

/** Footprint of one unit, whatever the unit happens to be. */
const UNIT_W = 132
const UNIT_D = UNIT_W / 2

/**
 * How far apart the units stand, per rung — across the screen, and back into it.
 *
 * Per rung because the three units are not the same size on the ground even
 * though they occupy the same footprint: a building is a narrow tower on a wide
 * plot, a town fills its plot to the edge. One shared pitch either packs the
 * towns into each other or scatters the buildings across a car park.
 */
const SPREAD: Record<number, { x: number; y: number }> = {
  4: { x: 0.66, y: 64 },
  5: { x: 1.06, y: 78 },
  6: { x: 1.12, y: 86 },
}

export interface CityCount {
  /** §7.7.1's rung, clamped to the range this tier draws. */
  rung: number
  /** How many units stand on the ground, 0 while the tower still has it. */
  count: number
}

/**
 * Which rung, and how many of its unit — GDD §7.7.1.
 *
 * Floor, not round, for `tower.ts`'s reason: 4.9 buildings is four buildings and
 * most of a fifth, and drawing five would be claiming one that is nearly empty.
 * The player counts what they can see.
 */
export function unitsFor(devs: number): CityCount {
  if (!Number.isFinite(devs)) return { rung: CITY_FIRST_RUNG, count: 0 }
  const rung = rungFor(devs)
  if (rung.rung < CITY_FIRST_RUNG) return { rung: CITY_FIRST_RUNG, count: 0 }
  const at = Math.min(CITY_LAST_RUNG, rung.rung)
  // Clamped to this tier's last rung so a headcount past a town keeps drawing a
  // saturated sprawl rather than nothing at all. The picture stops growing;
  // it never stops existing.
  const size = at === rung.rung ? rung.unitSize : 1e6
  return { rung: at, count: Math.max(1, Math.min(MAX_UNITS, Math.floor(devs / size))) }
}

/**
 * How many of rung `rung`'s unit a headcount amounts to — GDD §7.4a.
 *
 * {@link unitsFor} answers "what should the *picture* be", which was the right
 * question while the headcount chose the rung. It no longer does: §7.4a makes
 * the **camera** choose, so a studio of three million can be looked at as a
 * sprawl of three towns *or* as a business park of thirty campuses, saturating
 * at ten, and both are true statements about the same studio.
 *
 * Returns 0 below the rung's first unit, which is what makes an unearned rung
 * draw nothing rather than draw a lie — the camera ceiling should never let it
 * be seen, and a picture that is honest without the ceiling is one less thing
 * that can quietly disagree with it.
 */
export function unitsAtRung(devs: number, rung: number): number {
  if (!Number.isFinite(devs) || devs <= 0) return 0
  const spec = RUNGS.find((r) => r.rung === rung)
  if (!spec) return 0
  return Math.min(MAX_UNITS, Math.floor(devs / spec.unitSize))
}

/**
 * Height above its resting place at `t` through an arrival.
 *
 * §7.7.2's register is deadpan slapstick — "a whole tower slams down beside the
 * last one, hard enough to make the neighbours sway" — so it falls under
 * gravity, distance as t², and is moving fastest at the instant it lands. An
 * ease-out reads as a crane lowering it, which is a different joke and a worse
 * one.
 */
export function unitDropHeight(t: number): number {
  if (t <= 0) return DROP_FROM
  if (t >= 1) return 0
  return DROP_FROM * (1 - t * t)
}

/**
 * How much the *already-standing* units sway as a new one lands, in radians.
 *
 * This is the neighbours, not the arrival. A damped oscillation rather than a
 * single lean, because something that tips once and stops reads as a hinge.
 */
export function neighbourSway(t: number): number {
  if (t <= 0.8 || t >= 1) return 0
  const b = (t - 0.8) / 0.2
  return Math.sin(b * Math.PI * 3) * 0.035 * (1 - b)
}

/**
 * Where unit `i` stands, in room units from the centre of the formation.
 *
 * **Fixed by index, never by count.** A formation solved from `n` re-centres
 * every object each time one arrives, so a hire would slide the whole block
 * sideways — and the one thing §7.7.2 asks of an arrival is that the player sees
 * a thing *land*, not a scene rearrange itself around it. Laid out from the
 * middle outward so the group stays roughly centred as it fills.
 *
 * **And the formation has a grain**, exactly as §7.8.1's desks do and for the
 * same reason. Placing units on a square plan and projecting it is what a
 * renderer gives you free, and it puts two units on the *same screen x* whenever
 * their plan coordinates differ by (1, 1) — which at these heights reads as one
 * building stacked on top of another rather than as two standing apart. So the
 * arrangement is screen-aligned: units run level across a row, rows step back,
 * and each row behind is sheared half a pitch so the unit behind is not
 * eclipsed by the one in front.
 *
 * The objects themselves are still drawn in the 2:1 projection. Only where they
 * stand is screen-aligned, which is legal at this rung for the same reason it
 * was legal on the floor: there is no drawn tile grid for a level row to
 * disagree with.
 */
const SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0.5, 1],
  [-0.5, 1],
  [2, 0],
  [-2, 0],
  [1.5, 1],
  [-1.5, 1],
  [0, 2],
  [1, 2],
  [-1, 2],
]

export function slotAt(i: number, rung = CITY_FIRST_RUNG): { x: number; y: number } {
  const [across, back] = SLOTS[Math.max(0, Math.floor(i)) % SLOTS.length]
  const spread = SPREAD[rung] ?? SPREAD[CITY_FIRST_RUNG]
  // Back is *up* the screen and therefore further from the camera, which is
  // also the draw order: sort ascending y and the painter order is free.
  // `0 - …` rather than a leading minus: the front row is back 0, and unary
  // negation of zero is -0, which compares unequal to the 0 every other row is
  // measured against.
  return { x: across * UNIT_W * spread.x, y: 0 - back * spread.y }
}

// ---------------------------------------------------------------------------
// The units
// ---------------------------------------------------------------------------

/** A footprint on the ground. Everything at this scale stands on one. */
function pad(g: Graphics, x: number, y: number, w: number, fill: number) {
  g.moveTo(x, y - w / 4)
    .lineTo(x + w / 2, y)
    .lineTo(x, y + w / 4)
    .lineTo(x - w / 2, y)
    .closePath()
    .fill(fill)
}

/**
 * A block with lit windows, in the 2:1 projection.
 *
 * The one primitive all three rungs are built from — a building *is* one of
 * these, a campus is four small ones on a plinth, a town is thirty tiny ones.
 * That is not a shortcut, it is §7.8.2's own sentence: "a city is instanced
 * blocks with varied heights."
 */
function block(g: Graphics, x: number, y: number, w: number, h: number, seed: number) {
  const q = w / 4
  // Left face to the light, right face away — ART_DIRECTION §7's top-left
  // source, held by hand because no script can check it.
  g.moveTo(x - w / 2, y - h)
    .lineTo(x, y - h + q)
    .lineTo(x, y + q)
    .lineTo(x - w / 2, y)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[2]))
  g.moveTo(x + w / 2, y - h)
    .lineTo(x, y - h + q)
    .lineTo(x, y + q)
    .lineTo(x + w / 2, y)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[1]))
  g.moveTo(x, y - h - q)
    .lineTo(x + w / 2, y - h)
    .lineTo(x, y - h + q)
    .lineTo(x - w / 2, y - h)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[3]))

  // Windows, lit from a deterministic hash so the facade is identical on every
  // rebuild. A randomly lit building re-rolls its whole face whenever anything
  // else changes, which reads as a fault rather than as an office at night.
  const rows = Math.max(1, Math.floor(h / 13))
  const cols = Math.max(1, Math.floor(w / 15))
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const lit = ((seed * 31 + r * 17 + i * 7) % 5) !== 0
      if (!lit) continue
      const fx = (i + 0.5) / cols
      const wx = x - w / 2 + fx * (w / 2)
      const wy = y - h + 6 + r * 13 + fx * q
      g.rect(wx, wy, 5, 4).fill(c(RAMPS.GLOW[1]))
    }
  }
}

/** Rung 4 — a building. One tower, its own height, standing on its plot. */
function drawBuilding(g: Graphics, x: number, y: number, i: number) {
  // The plot. NEUTRAL[1] rather than [0] — the app's background *is* NEUTRAL[0]
  // (see `Application.init`), so a ground plane drawn in it is not a dark ground
  // plane, it is a hole, and every building above it floats.
  pad(g, x, y + 4, UNIT_W * 0.86, c(RAMPS.NEUTRAL[1]))
  const h = 84 + ((i * 37) % 4) * 16
  block(g, x, y, UNIT_W * 0.52, h, i + 1)
}

/**
 * Rung 5 — a campus. "A business park. Buildings in formation, connecting
 * walkways, car parks that are always full."
 */
function drawCampus(g: Graphics, x: number, y: number, i: number) {
  pad(g, x, y + 4, UNIT_W * 0.98, c(RAMPS.NEUTRAL[1]))
  pad(g, x, y, UNIT_W * 0.9, c(RAMPS.NEUTRAL[2]))

  // The car park, and it is always full. Four rows of two-pixel cars on the
  // near plot — the cheapest possible statement that people are here and that
  // there is nowhere left to put them.
  pad(g, x + UNIT_W * 0.2, y + 14, UNIT_W * 0.34, c(RAMPS.NEUTRAL[1]))
  for (let k = 0; k < 8; k++) {
    const cx = x + UNIT_W * 0.2 + ((k % 4) - 1.5) * 8
    const cy = y + 14 + (Math.floor(k / 4) - 0.5) * 6 + ((k % 4) - 1.5) * 4
    g.rect(cx, cy, 4, 2).fill(c(k % 3 === 0 ? RAMPS.NEUTRAL[4] : RAMPS.NEUTRAL[3]))
  }

  // Four blocks in formation, plus the walkway between them.
  g.moveTo(x - UNIT_W * 0.26, y - 6)
    .lineTo(x + UNIT_W * 0.04, y + 9)
    .stroke({ width: 2, color: c(RAMPS.NEUTRAL[2]), alpha: 0.8 })
  // **Low-rise, and wider than they are tall.** A business park whose blocks are
  // the height of rung 4's towers does not read as a different unit — it reads
  // as more towers, closer together, which is the one thing §7.7.1 says a rung
  // change must never look like. The unit changed; the silhouette has to say so.
  const plots: ReadonlyArray<readonly [number, number]> = [
    [-0.29, -4],
    [0.02, -18],
    [-0.02, 8],
    [0.29, -6],
  ]
  for (let k = 0; k < plots.length; k++) {
    const [fx, dy] = plots[k]
    block(g, x + UNIT_W * fx, y + dy, UNIT_W * 0.3, 26 + ((i + k) % 3) * 9, i * 5 + k)
  }
}

/**
 * Rung 6 — a town. "Sprawl to the horizon. Street grids, a ring road, an
 * airport."
 */
function drawTown(g: Graphics, x: number, y: number, i: number) {
  pad(g, x, y + 4, UNIT_W * 1.02, c(RAMPS.NEUTRAL[1]))
  pad(g, x, y, UNIT_W * 0.96, c(RAMPS.NEUTRAL[2]))

  // The ring road. An ellipse in the 2:1 projection, which is what a circle on
  // the ground is, and the one line that turns a patch of blocks into a place.
  g.ellipse(x, y - 2, UNIT_W * 0.40, UNIT_W * 0.20).stroke({
    width: 2,
    color: c(RAMPS.NEUTRAL[3]),
    alpha: 0.85,
  })

  // The airport — a strip and two approach lights, on the far side where it has
  // room. At this scale it is six pixels, and it is the difference between a
  // sprawl and a *town*.
  g.moveTo(x - UNIT_W * 0.36, y - 20)
    .lineTo(x - UNIT_W * 0.1, y - 33)
    .stroke({ width: 3, color: c(RAMPS.NEUTRAL[2]) })
  g.rect(x - UNIT_W * 0.36, y - 21, 2, 2).fill(c(RAMPS.WARN[2]))
  g.rect(x - UNIT_W * 0.11, y - 34, 2, 2).fill(c(RAMPS.WARN[2]))

  // The sprawl itself: a street grid of small blocks, thinning at the edge the
  // way a real town does.
  for (let r = -3; r <= 3; r++) {
    for (let k = -3; k <= 3; k++) {
      if (Math.abs(r) + Math.abs(k) > 4) continue
      const seed = i * 13 + (r + 3) * 7 + (k + 3)
      if (seed % 7 === 0) continue
      const bx = x + (k - r) * 16
      const by = y + (k + r) * 8 - 4
      // Squat. At 12 wide and up to 31 tall these read as a field of
      // matchsticks rather than as a town seen from a distance — a horizon is
      // made of things that are wider than they are tall.
      block(g, bx, by, 16, 6 + (seed % 4) * 4, seed)
    }
  }
}

const DRAW: Record<number, (g: Graphics, x: number, y: number, i: number) => void> = {
  4: drawBuilding,
  5: drawCampus,
  6: drawTown,
}

// ---------------------------------------------------------------------------

export interface CityHandle {
  container: Container
  /** Rebuild for a headcount. Cheap on change, far too dear per frame. */
  setHeadcount(devs: number): void
  /** Advance the arrival. `now` in ms. */
  update(now: number): void
  /** True while a unit is still in the air. */
  readonly settling: boolean
  /** Live bounding size for the §23.4.1 camera fit. */
  readonly extent: { w: number; h: number }
  /** Which rung is on screen, for the §7.7.5 scale bar and the tests. */
  readonly rung: number
  readonly units: number
}

/**
 * @param fixedRung Pin this city to one rung of the ladder — GDD §7.4a.
 *
 * Three of these are built rather than one, one per rung, because §7.4a makes
 * the block, the business park and the sprawl three *places the camera can
 * stop* rather than three states of one place. One instance that swapped its
 * own geometry as the camera moved would be a cut in the middle of a pinch,
 * which §10.5 forbids; three that cross-fade are three tenths of a Graphics
 * each and hand-off for free.
 */
export function buildCity(fixedRung?: number): CityHandle {
  const root = new Container()
  const standing = new Container()
  const settled = new Graphics()
  const falling = new Graphics()
  standing.addChild(settled)
  root.addChild(standing, falling)

  let rung = fixedRung ?? CITY_FIRST_RUNG
  let units = 0
  let arriving = false
  let arrivalStart = 0
  const extent = { w: UNIT_W, h: UNIT_W }

  function redraw(n: number) {
    settled.clear()
    const draw = DRAW[rung] ?? drawBuilding
    // Back to front: a unit lower on screen is nearer the camera, so it must be
    // drawn last. The formation is centre-out rather than in depth order, so
    // unlike the room's desk loop this one cannot rely on index order.
    const order = Array.from({ length: n }, (_, i) => i).sort(
      (a, b) => slotAt(a, rung).y - slotAt(b, rung).y,
    )
    for (const i of order) {
      const at = slotAt(i, rung)
      draw(settled, at.x, at.y, i)
    }

    // Measured from the formation actually on the ground rather than from a
    // constant, so the camera pulls back as the block fills out — §23.4.1 reads
    // this every frame and a stale extent frames the wrong thing.
    let minX = 0
    let maxX = 0
    let minY = 0
    let maxY = 0
    for (let i = 0; i < Math.max(1, n); i++) {
      const at = slotAt(i, rung)
      minX = Math.min(minX, at.x - UNIT_W / 2)
      maxX = Math.max(maxX, at.x + UNIT_W / 2)
      minY = Math.min(minY, at.y - 150)
      maxY = Math.max(maxY, at.y + UNIT_D / 2)
    }
    extent.w = maxX - minX
    extent.h = maxY - minY
    root.pivot.set((minX + maxX) / 2, (minY + maxY) / 2)
  }

  redraw(0)

  return {
    container: root,

    setHeadcount(devs: number) {
      const next =
        fixedRung === undefined
          ? unitsFor(devs)
          : { rung: fixedRung, count: unitsAtRung(devs, fixedRung) }
      if (next.rung === rung && next.count === units) return
      // A rung change replaces every unit at once — a block does not become a
      // business park by growing, it becomes one because the thing being counted
      // changed. Only a gain *within* a rung is an arrival to animate.
      const gained = next.rung === rung && next.count > units
      rung = next.rung
      units = next.count
      redraw(gained ? units - 1 : units)
      if (gained) {
        arriving = true
        arrivalStart = performance.now()
      }
    },

    update(now: number) {
      if (!arriving) return
      const t = (now - arrivalStart) / UNIT_DROP_MS
      falling.clear()

      if (t >= 1) {
        arriving = false
        redraw(units)
        standing.rotation = 0
        return
      }

      const at = slotAt(units - 1, rung)
      const draw = DRAW[rung] ?? drawBuilding
      draw(falling, at.x, at.y - unitDropHeight(t), units - 1)
      // "Hard enough to make the neighbours sway" — §7.7.2. The settled group
      // leans, the arrival does not, which is why the two are separate layers.
      standing.rotation = neighbourSway(t)
    },

    get settling() {
      return arriving
    },
    get rung() {
      return rung
    },
    get units() {
      return units
    },
    extent,
  }
}
