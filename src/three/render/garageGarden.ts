/**
 * The front garden: the courtyard cut into the frontage, and the forecourt in front of it [§7.8.12; redone 2026-10-11,
 * at the user's instruction: *"the front garden, make it more pretty"*, and then, of a first cut with wisteria, string
 * lights, mown stripes and a path laid in a running bond: *"it's too complex, just make a simple garden that's
 * charming"*].
 *
 * Simple here means few things, each of them big enough to read: a lawn lighter than the leaves that stand on it, one
 * blossom tree, two beds of flowers, a path of stepping stones, the arbor and the bench, and a pair of tubs. It was a
 * dim green thicket with a bench in it, and a garden is charming for what is not green in it. Every block is at least
 * a hand across, because the court is 6 m of a 2000-px picture and a 0.1 m flower is a smudge.
 *
 * The court is outdoors and outside the walking floor (`HQ_GARDEN`), and the arbor and the bench stay where §7.8.12
 * put them.
 */
import * as T from 'three'
import { HQ_GARDEN } from '../sim/floorPlan.ts'
import { box } from './worldArt.ts'
import { duckSeat } from './duckOffice.ts'

const SOIL = '#60513b', EDGE = '#87938a', TUB = '#394e55', WOOD = '#a18b65', WOOD_DARK = '#76583d'
const LEAF = '#416652', LEAF_MID = '#52765b', LEAF_LIGHT = '#63836a', LAWN = '#7aae6c'
/** Pushed a step further than they look in the palette: the room's light is blue, and a pink in it comes out lavender. */
const BLOSSOM = '#f2a0b0', BLUSH = '#f8c8cf', ROSE = '#dd7f94', CORAL = '#e8836e', AMBER = '#ebb54a', LILAC = '#b79ad0', WHITE = '#f7f4e6'
const FLOWERS = [BLOSSOM, AMBER, LILAC, CORAL, WHITE, ROSE]

/** A raised bed edged in stone, `x0..x1` by `z0..z1`, planted in mounds of leaf with a flower on each. */
function bed(g: T.Object3D, x0: number, x1: number, z0: number, z1: number): void {
  const w = x1 - x0, d = z1 - z0
  box(g, (x0 + x1) / 2, 0, (z0 + z1) / 2, w, .24, d, EDGE)
  box(g, (x0 + x1) / 2, .24, (z0 + z1) / 2, w - .1, .03, d - .1, SOIL)
  const nx = Math.max(1, Math.round(w / .42)), nz = Math.max(1, Math.round(d / .42))
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = x0 + (i + .5) * w / nx, z = z0 + (j + .5) * d / nz, k = i + j * 2
    box(g, x, .27, z, w / nx * .82, .3, d / nz * .82, k % 2 ? LEAF : LEAF_MID)
    box(g, x + .03, .57, z, .21, .13, .21, FLOWERS[(i * 2 + j * 3) % FLOWERS.length])
  }
}

/** A flower tub: a dark planter, a mound of leaf, and three blooms standing proud. */
function tub(g: T.Object3D, x: number, z: number, k: number): void {
  box(g, x, 0, z, .62, .42, .62, TUB)
  box(g, x, .42, z, .7, .06, .7, '#61767a')
  box(g, x, .48, z, .56, .3, .56, LEAF)
  box(g, x - .14, .78, z - .06, .2, .14, .2, FLOWERS[k % FLOWERS.length])
  box(g, x + .12, .78, z + .08, .2, .14, .2, FLOWERS[(k + 2) % FLOWERS.length])
  box(g, x + .02, .88, z - .12, .17, .13, .17, FLOWERS[(k + 4) % FLOWERS.length])
}

/** A flowering cherry in three pinks, its crown leaning out over the lawn from a trunk that stands in the bed. */
function blossomTree(g: T.Object3D, x: number, z: number): void {
  box(g, x, 0, z, .26, 1.45, .26, WOOD_DARK)
  box(g, x - .2, 1.4, z + .3, 1.55, .3, 1.4, ROSE)
  box(g, x, 1.65, z + .3, 1.8, .5, 1.55, BLOSSOM)
  box(g, x + .4, 2.1, z + .15, 1.0, .45, 1.0, BLUSH)
  box(g, x - .5, 2.0, z + .5, .85, .5, .85, BLOSSOM)
}

/**
 * The courtyard garden, in the court's own frame (`g` stands at its floor, 0.2 m under the room's). The court is the
 * void `HQ_GARDEN` leaves in the plan, and the camera sees it over its east wall: what is in the west half, at the
 * back, and at the mouth is what is seen.
 */
export function courtyardGarden(g: T.Object3D): void {
  const c = HQ_GARDEN
  box(g, (c.x0 + c.x1) / 2, -.08, (c.z0 + c.z1) / 2, c.x1 - c.x0, .08, c.z1 - c.z0, LAWN, false)

  // Two beds, along the back wall and the west one: the two walls the camera sees the inside of.
  bed(g, -1.84, -1.2, 5.17, 7.75)
  bed(g, -1.2, 3.2, 5.17, 5.75)
  blossomTree(g, 1.0, 5.5)

  // Stepping stones from the bench to the tree, and the bench's own paving.
  for (let row = 0; row < 4; row++) box(g, 1.0 + (row % 2 ? .12 : -.12), 0, 6.15 + row * .46, .56, .045, .36, '#b9b5a0', false)
  // §11.7 [demo 2026-10-22] — with the CTO's paddling pool at the court's mouth, the pool is where the bench was.
  if (duckSeat() === 'pool') { tub(g, -1.3, 8.35, 0); tub(g, 3.3, 8.35, 3); return }
  box(g, 1, 0, 8.25, 3.2, .045, 1.5, '#aaa58e', false)

  // The arbor and the bench, as they were: posts, beams and slats, with a little leaf and a few lilac flowers on top.
  for (const x of [-.40, 2.40]) for (const z of [7.65, 8.8]) {
    box(g, x, 0, z, .13, 2.12, .13, WOOD_DARK)
    box(g, x, .01, z, .18, .10, .18, '#34494f')
  }
  for (const z of [7.65, 8.8]) box(g, 1, 2.12, z, 3.12, .13, .15, WOOD)
  for (let x = -.4; x < 2.6; x += .40) box(g, x, 2.22, 8.22, .08, .09, 1.50, WOOD)
  for (const x of [-.2, .9, 2.1]) {
    box(g, x, 2.30, 8.7, .44, .15, .44, LEAF_LIGHT)
    box(g, x + .1, 2.4, 8.55, .22, .14, .22, LILAC)
  }
  for (const x of [-.15, 2.15]) box(g, x, .03, 8.37, .10, .41, .48, '#34494f')
  for (let z = 8.12; z < 8.65; z += .15) box(g, 1, .44, z, 2.6, .065, .12, WOOD)
  for (const x of [-.15, 2.15]) box(g, x, .45, 8.62, .07, .53, .07, '#34494f')
  for (const y of [.66, .84]) box(g, 1, y, 8.62, 2.6, .12, .06, WOOD)

  // a tub at either side of the court's mouth
  tub(g, -1.3, 8.35, 0)
  tub(g, 3.3, 8.35, 3)
}

/**
 * The forecourt in front of the court and the door, in the pavement's own frame (x and z as in the plan; y = 0 is the
 * paving): a ribbon of flowers at the foot of the west wing's glass, and a tub in the angle either side of the door,
 * which leave its approach, along its outward normal and on to the crossing, clear.
 */
export function forecourtPlanting(yard: T.Object3D): void {
  bed(yard, -5.3, -2.4, 8.3, 8.85)
  tub(yard, -8.7, 11.98, 1)
  tub(yard, -6.02, 9.3, 4)
}
