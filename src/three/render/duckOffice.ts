/**
 * The CTO, and where he sits — GDD §11.7 [2026-10-21; redesign demo 2026-10-22].
 *
 * *"he's bad, redisign the look and his seat and gimme options and demos"*. The
 * first cut was a yellow cube with a mouth, looking straight at the lens out of
 * a white box that read as a sink. Two things were wrong and both are fixed
 * here once, for every option:
 *
 * - **The figure is a rubber duck's silhouette, in profile.** A rubber duck is
 *   recognised by its outline — the round belly, the chest pushed forward, the
 *   tail kicked up, the head sat forward on top and the flat orange beak — and
 *   an outline needs a side view. So he is built in his own frame with the beak
 *   along +x and his flank along +z, and every seat turns him three-quarters to
 *   the lens (`TURN`): the profile, with the beak a little toward you.
 * - **The seat is a choice, and there are four to look at** (`DuckSeat`): a
 *   paddling pool in the courtyard garden, the water cooler, a tiny executive
 *   office, and a museum plinth by the founder. `?duck=` picks one in a loopback
 *   session (`dev/debugAccess.ts`'s rule); one of them stays when the user picks.
 *
 * Everything else is as it was: the duck and his outfit are one `dynamic` group
 * the batcher skips, rebuilt when his look changes; the seat is static and
 * batched; he is not in `env.targets` because he does not code.
 */

import * as T from 'three'
import { box, cylinder, sphere, sharedMaterial } from './worldArt.ts'
import { nameSign } from './garageDetails.ts'
import { NO_DUCK_LOOK, lookKey, type DuckLook } from '../../sim/duck.ts'

const YELLOW = '#ffd23f'
const YELLOW_SHADE = '#f0b92e'
const BEAK = '#f08a2a'
const BEAK_DARK = '#cf6c1f'
const EYE = '#1b2224'
const GLINT = '#ffffff'
const CHEEK = '#f4a09a'
const WATER = '#8dc3da'
const BRASS = '#c49b3c'
const CROWN = '#c08a2a'

// --- the figure ----------------------------------------------------------------
//
// [2026-10-22, second pass] *"I am leaning towards on a podium idea, but redesign the duck hes now ugly"*. The
// first redesign stacked three slabs for a belly, and under the room's light they shaded into stripes — a layer
// cake with a beak — with a head the same width as the body and eyes like pinpricks. So, three candidates
// (`DuckModel`), built on what makes a toy duck read as cute rather than as a diagram:
//
// - **one yellow**, and a shade of it only where a wing is, so the shape is lit by the room and not painted in bands;
// - **rounded by crossing**, not stacking: a block and two narrower blocks through it, one wider in x and one in z,
//   make a voxel lozenge whose corners step in on every side at once;
// - **a big head**, set apart from the body, with **big eyes low on it**, a glint in each, and a small beak;
// - a blush under the eye, because that is the difference between a duck and a cute duck.
//
// In his own frame: sitting on y = 0, beak along +x, his left flank toward +z. A seat scales and places him.

export const DUCK_MODELS = ['toy', 'chibi', 'round'] as const
export type DuckModel = typeof DUCK_MODELS[number]

interface Anchors {
  /** His head: middle, top, and its half-width across his face (z), where eyewear hangs. */
  head: { x: number; y: number; top: number; half: number }
  /** The eye the lens sees: its middle, and how far out on his flank. */
  eye: { x: number; y: number; z: number }
  /** The front of his chest under the beak, where neckwear hangs. */
  chest: { x: number; y: number }
}

/** A rounded block: the core, and two narrower blocks through it so every edge steps in. */
function lozenge(g: T.Group, x: number, y: number, z: number, w: number, h: number, d: number, step: number, colour: string): void {
  box(g, x, y + step, z, w, h - step * 2, d, colour)
  box(g, x, y, z, w - step * 2, h, d - step * 2, colour)
  box(g, x, y + step, z, w + step, h - step * 2, d - step * 2, colour)
  box(g, x, y + step, z, w - step * 2, h - step * 2, d + step, colour)
}

/** An eye on each flank, with a glint, and a blush under it. */
function face(g: T.Group, a: Anchors, w: number, h: number): void {
  for (const side of [-1, 1]) {
    const z = side * (a.eye.z + 0.004)
    box(g, a.eye.x, a.eye.y - h / 2, z, w, h, 0.012, EYE)
    box(g, a.eye.x + w * 0.2, a.eye.y + h * 0.12, side * (a.eye.z + 0.012), w * 0.34, w * 0.34, 0.01, GLINT)
    box(g, a.eye.x + w * 0.55, a.eye.y - h * 1.05, side * (a.eye.z + 0.006), w * 0.75, h * 0.32, 0.01, CHEEK)
  }
}

const MODELS: Record<DuckModel, { anchors: Anchors; build(g: T.Group, a: Anchors): void }> = {
  /** **The toy**: the bath duck everybody pictures, a little rounder and a lot friendlier. */
  toy: {
    anchors: { head: { x: 0.2, y: 0.74, top: 1.0, half: 0.27 }, eye: { x: 0.31, y: 0.77, z: 0.27 }, chest: { x: 0.46, y: 0.46 } },
    build(g, a) {
      lozenge(g, -0.02, 0, 0, 0.82, 0.48, 0.58, 0.05, YELLOW)
      box(g, 0.38, 0.1, 0, 0.14, 0.28, 0.46, YELLOW)
      box(g, -0.46, 0.28, 0, 0.14, 0.22, 0.32, YELLOW)
      box(g, -0.54, 0.42, 0, 0.12, 0.14, 0.2, YELLOW)
      lozenge(g, a.head.x, 0.5, 0, 0.5, 0.5, 0.5, 0.04, YELLOW)
      box(g, 0.53, 0.64, 0, 0.16, 0.07, 0.24, BEAK)
      box(g, 0.5, 0.6, 0, 0.12, 0.04, 0.18, BEAK_DARK)
      face(g, a, 0.09, 0.12)
      for (const side of [-1, 1]) {
        box(g, -0.08, 0.2, side * 0.32, 0.3, 0.13, 0.02, YELLOW_SHADE)
        box(g, -0.22, 0.29, side * 0.32, 0.1, 0.07, 0.02, YELLOW_SHADE)
      }
    },
  },
  /** **The chibi**: a head nearly as big as he is and eyes to match. A mascot. */
  chibi: {
    anchors: { head: { x: 0.12, y: 0.62, top: 0.92, half: 0.325 }, eye: { x: 0.27, y: 0.64, z: 0.325 }, chest: { x: 0.4, y: 0.3 } },
    build(g, a) {
      lozenge(g, -0.06, 0, 0, 0.7, 0.36, 0.52, 0.04, YELLOW)
      box(g, -0.42, 0.2, 0, 0.12, 0.16, 0.26, YELLOW)
      box(g, -0.48, 0.3, 0, 0.1, 0.1, 0.16, YELLOW)
      lozenge(g, a.head.x, 0.32, 0, 0.6, 0.6, 0.6, 0.05, YELLOW)
      box(g, 0.48, 0.52, 0, 0.13, 0.06, 0.2, BEAK)
      box(g, 0.46, 0.49, 0, 0.1, 0.035, 0.15, BEAK_DARK)
      face(g, a, 0.12, 0.17)
      for (const side of [-1, 1]) box(g, -0.12, 0.12, side * 0.28, 0.24, 0.11, 0.02, YELLOW_SHADE)
    },
  },
  /** **The round one**: no boxes at all, low-poly balls like the trees' leaves. The real rubber duck's curves. */
  round: {
    anchors: { head: { x: 0.24, y: 0.74, top: 1.01, half: 0.25 }, eye: { x: 0.36, y: 0.8, z: 0.215 }, chest: { x: 0.45, y: 0.46 } },
    build(g, a) {
      sphere(g, -0.02, 0.27, 0, 1, YELLOW).scale.set(0.5, 0.3, 0.35)
      sphere(g, 0.3, 0.3, 0, 1, YELLOW).scale.set(0.2, 0.24, 0.28)
      sphere(g, -0.42, 0.44, 0, 1, YELLOW).scale.set(0.14, 0.12, 0.13)
      sphere(g, a.head.x, a.head.y, 0, 0.27, YELLOW)
      sphere(g, 0.53, 0.68, 0, 1, BEAK).scale.set(0.13, 0.045, 0.12)
      for (const side of [-1, 1]) {
        sphere(g, a.eye.x, a.eye.y, side * a.eye.z, 0.062, EYE)
        sphere(g, a.eye.x + 0.025, a.eye.y + 0.025, side * (a.eye.z + 0.05), 0.02, GLINT)
        sphere(g, a.eye.x + 0.06, a.eye.y - 0.1, side * (a.eye.z - 0.005), 1, CHEEK).scale.set(0.045, 0.02, 0.02)
        sphere(g, -0.06, 0.3, side * 0.3, 1, YELLOW_SHADE).scale.set(0.2, 0.1, 0.05)
      }
    },
  },
}

let chosenModel: DuckModel = 'toy'
/** Pick the duck the next garage is built with — the demo's other switch, `?duckmodel=`. */
export function setDuckModel(model: DuckModel): void { chosenModel = model }

/** The anchors of the duck being drawn: everything he wears is placed off these. */
let A: Anchors = MODELS.toy.anchors
function figure(g: T.Group): void {
  A = MODELS[chosenModel].anchors
  MODELS[chosenModel].build(g, A)
}

/** What each item is, in his frame. Hats on the cap, eyewear on the eyes, neckwear under the beak. */
const WEAR: Record<string, (g: T.Group) => void> = {
  crown: (g) => {
    box(g, A.head.x, A.head.top, 0, 0.32, 0.09, 0.32, CROWN)
    for (const dx of [-0.12, 0.12]) for (const dz of [-0.12, 0, 0.12]) box(g, A.head.x + dx, A.head.top + 0.09, dz, 0.07, 0.12, 0.07, CROWN)
    box(g, A.head.x, A.head.top + 0.02, 0.163, 0.06, 0.05, 0.01, '#b0443a')
  },
  tophat: (g) => {
    box(g, A.head.x, A.head.top, 0, 0.48, 0.03, 0.48, '#22262a')
    box(g, A.head.x, A.head.top + 0.03, 0, 0.3, 0.36, 0.3, '#22262a')
    box(g, A.head.x, A.head.top + 0.06, 0, 0.306, 0.06, 0.306, '#a24a3f')
  },
  partyhat: (g) => {
    box(g, A.head.x, A.head.top, 0, 0.26, 0.11, 0.26, '#7b5aa6')
    box(g, A.head.x, A.head.top + 0.11, 0, 0.17, 0.11, 0.17, '#5f9e6e')
    box(g, A.head.x, A.head.top + 0.22, 0, 0.09, 0.11, 0.09, '#d1473b')
    sphere(g, A.head.x, A.head.top + 0.38, 0, 0.05, '#f2ead0', true)
  },
  helmet: (g) => {
    const glass = box(g, A.head.x + 0.04, A.head.y - 0.23, 0, 0.66, 0.54, 0.56, '#b1c7c8', false)
    glass.material = sharedMaterial('duck-helmet-glass', () => new T.MeshStandardMaterial({ color: '#b1c7c8', transparent: true, opacity: 0.3, depthWrite: false, roughness: 0.3 }))
    box(g, A.head.x + 0.04, A.head.y - 0.27, 0, 0.7, 0.06, 0.6, '#e9ecea')
    box(g, A.head.x - 0.12, A.head.top + 0.08, -0.1, 0.02, 0.2, 0.02, '#8d9594')
    sphere(g, A.head.x - 0.12, A.head.top + 0.3, -0.1, 0.04, '#d1473b', true)
  },
  readers: (g) => {
    for (const side of [-1, 1]) {
      box(g, A.eye.x + 0.01, A.eye.y - 0.07, side * (A.head.half + 0.02), 0.16, 0.14, 0.015, EYE)
      box(g, A.eye.x + 0.01, A.eye.y - 0.05, side * (A.head.half + 0.03), 0.11, 0.1, 0.01, WATER)
    }
    box(g, A.head.x + A.head.half + 0.01, A.eye.y - 0.01, 0, 0.02, 0.025, A.head.half * 2 + 0.04, EYE)
  },
  shades: (g) => {
    for (const side of [-1, 1]) box(g, A.eye.x, A.eye.y - 0.065, side * (A.head.half + 0.02), 0.2, 0.11, 0.015, '#141414')
    box(g, A.head.x + A.head.half + 0.015, A.eye.y - 0.06, 0, 0.02, 0.1, A.head.half * 2 + 0.04, '#141414')
    box(g, A.eye.x - 0.05, A.eye.y, A.head.half + 0.032, 0.05, 0.02, 0.008, '#8d9594')
  },
  monocle: (g) => {
    box(g, A.eye.x + 0.01, A.eye.y - 0.08, A.head.half + 0.02, 0.17, 0.17, 0.015, '#e8b541')
    box(g, A.eye.x + 0.01, A.eye.y - 0.055, A.head.half + 0.03, 0.11, 0.11, 0.01, WATER)
    box(g, A.eye.x - 0.05, A.eye.y - 0.44, A.head.half + 0.03, 0.012, 0.36, 0.012, '#e8b541')
  },
  lanyard: (g) => {
    for (const side of [-1, 1]) box(g, A.chest.x - 0.13, A.chest.y - 0.06, side * 0.2, 0.03, 0.16, 0.025, '#b0443a')
    box(g, A.chest.x + 0.08, A.chest.y - 0.08, 0, 0.03, 0.03, 0.4, '#b0443a')
    box(g, A.chest.x + 0.1, A.chest.y - 0.26, 0.08, 0.02, 0.17, 0.15, '#f2ead0')
    box(g, A.chest.x + 0.112, A.chest.y - 0.14, 0.08, 0.01, 0.04, 0.15, '#b0443a')
  },
  bowtie: (g) => {
    for (const side of [-1, 1]) box(g, A.chest.x + 0.07, A.chest.y, side * 0.08, 0.05, 0.11, 0.12, '#b0443a')
    box(g, A.chest.x + 0.09, A.chest.y + 0.02, 0, 0.05, 0.07, 0.06, '#d1473b')
  },
  necktie: (g) => {
    box(g, A.chest.x + 0.08, A.chest.y - 0.02, 0, 0.04, 0.08, 0.09, '#4a7fb0')
    box(g, A.chest.x + 0.08, A.chest.y - 0.3, 0, 0.03, 0.28, 0.08, '#4a7fb0')
  },
}

// --- the seats -------------------------------------------------------------------

export const DUCK_SEATS = ['pool', 'cooler', 'office', 'plinth'] as const
export type DuckSeat = typeof DUCK_SEATS[number]

/** Three-quarters to the lens: the profile, and the beak a little toward you. Camera-facing is π/4. */
const TURN = Math.PI / 4 - 0.4

interface Seat {
  /** Where the seat stands, and the floor it stands on. */
  x: number
  z: number
  y: number
  /** The whole set, scaled: the room is seen from far off, and a desk-sized duck is thirty pixels. */
  size: number
  /** How big he is, and where he sits (his own y = 0), in the seat's frame. */
  scale: number
  at: [number, number, number]
  /** The seat itself: static, batched with the room. */
  build(g: T.Group): void
  /** The brass plate with his title on it, once he is CTO — in the seat's frame. */
  plate(g: T.Group): void
  /** Where ducklings go, and printouts. */
  ducklings: readonly [number, number, number][]
  pile: [number, number, number]
  /** Is he sitting in water (bubbles float on it) or not (bubbles rise round him)? */
  wet: boolean
}

function standPlate(g: T.Group, x: number, z: number, h = 0.62): void {
  box(g, x, 0, z, 0.22, 0.03, 0.22, BRASS)
  box(g, x, 0.03, z, 0.04, h - 0.06, 0.04, BRASS)
  box(g, x, h - 0.04, z, 0.48, 0.17, 0.04, '#5f4c2c')
  nameSign(g, 'CTO', x, h + 0.045, z + 0.025, 0.42, 0, '#5f4c2c')
}

const SEATS: Record<DuckSeat, Seat> = {
  /**
   * **A: the paddling pool in the courtyard.** The biggest he can be anywhere — a metre and a half of duck in a blue
   * inflatable pool at the open mouth of the courtyard garden, where the bench and arbor were, front and centre of the
   * frame and outdoors where nobody walks. The garden is outside the work floor (`HQ_GARDEN`), so he costs the walk
   * grid nothing.
   */
  pool: {
    x: 1.0, z: 7.95, y: -0.2, size: 1, scale: 1.25, at: [0, 0.33, 0],
    build(g) {
      cylinder(g, 0, 0, 0, 0.98, 0.34, '#3f7fc0')
      // The white rim is a disc, so the water is a smaller disc a hair above it: a ring of rim round a pool of water.
      cylinder(g, 0, 0.34, 0, 1.0, 0.06, '#f2f0e8')
      cylinder(g, 0, 0.34, 0, 0.84, 0.075, WATER)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8
        box(g, Math.cos(a) * 0.95, 0.12, Math.sin(a) * 0.95, 0.06, 0.1, 0.06, '#f2f0e8')
      }
    },
    plate(g) { standPlate(g, -0.85, 0.95) },
    ducklings: [[0.62, 0.41, 0.3], [0.45, 0.41, -0.55], [-0.6, 0.41, 0.35], [-0.35, 0.41, -0.6], [0.1, 0.41, 0.68]],
    pile: [1.15, 0, -0.3],
    wet: true,
  },
  /**
   * **B: the water cooler.** He bobs in an oversized open jug on the office water cooler — the place the room already
   * goes on its errands, so every developer who walks to the cooler is, in effect, explaining their bug to the duck.
   * Rubber-duck debugging by the water cooler is the joke the room was already making.
   */
  cooler: {
    x: 10.0, z: -6.5, y: 0, size: 1.5, scale: 0.55, at: [0, 1.32, 0],
    build(g) {
      box(g, 0, 0, 0, 0.82, 0.95, 0.72, '#d9dedd')
      box(g, 0, 0.95, 0, 0.88, 0.05, 0.78, '#b7bfbd')
      for (const [x, c] of [[-0.14, '#d1473b'], [0.14, '#4a7fb0']] as const) box(g, x, 0.62, 0.37, 0.07, 0.07, 0.07, c)
      box(g, 0, 0.4, 0.37, 0.36, 0.04, 0.1, '#8d9594')
      const jug = cylinder(g, 0, 1.0, 0, 0.52, 0.62, '#8dc3da')
      jug.material = sharedMaterial('duck-jug-glass', () => new T.MeshStandardMaterial({ color: '#8dc3da', transparent: true, opacity: 0.38, depthWrite: false, roughness: 0.25 }))
      cylinder(g, 0, 1.0, 0, 0.5, 0.32, WATER)
      // The jug's lip as a ring of eight short boxes: a disc here would be a lid over him.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8
        const lip = box(g, Math.cos(a) * 0.5, 1.6, Math.sin(a) * 0.5, 0.06, 0.04, 0.4, '#cfe2e6')
        lip.rotation.y = -a
      }
    },
    plate(g) { box(g, 0, 0.72, 0.365, 0.4, 0.14, 0.01, '#5f4c2c'); nameSign(g, 'CTO', 0, 0.79, 0.372, 0.36, 0, '#5f4c2c') },
    ducklings: [[0.28, 1.32, 0.18], [-0.3, 1.32, -0.12], [0.1, 1.32, -0.32], [-0.18, 1.32, 0.28], [0.32, 1.32, -0.2]],
    pile: [0.62, 0, 0.1],
    wet: true,
  },
  /**
   * **C: the corner office.** A tiny executive desk with a laptop, and a leather wingback far too big for him, on a
   * rug in the clear floor north of the east pods. The corporate joke played straight: the CTO has the best chair in
   * the building and has never stood up from it.
   */
  office: {
    x: 10.0, z: -6.5, y: 0, size: 1.45, scale: 0.62, at: [-0.15, 0.47, 0],
    build(g) {
      box(g, 0.1, 0.004, 0, 2.0, 0.012, 1.6, '#3f6e78', false)
      // The chair: seat, a back that stands over him, wings, and arms kept low so the lens still sees him.
      box(g, -0.15, 0.12, 0, 0.66, 0.35, 0.72, '#7a3b2e')
      box(g, -0.15, 0.08, 0, 0.5, 0.06, 0.5, '#4a2a22')
      box(g, -0.58, 0.12, 0, 0.18, 1.18, 0.78, '#7a3b2e')
      box(g, -0.6, 1.3, 0, 0.22, 0.08, 0.82, '#8c4636')
      for (const side of [-1, 1]) box(g, -0.15, 0.47, side * 0.38, 0.62, 0.16, 0.1, '#8c4636')
      for (const sx of [-0.4, 0.1]) for (const sz of [-0.3, 0.3]) box(g, sx, 0, sz, 0.06, 0.12, 0.06, '#2b211c')
      // The desk, in front of his beak: low, so he is over it.
      box(g, 0.72, 0.5, 0, 0.5, 0.06, 1.0, '#ba9263')
      box(g, 0.72, 0, 0, 0.44, 0.5, 0.94, '#34494f')
      // A laptop, open towards him, and a mug.
      box(g, 0.74, 0.56, -0.1, 0.24, 0.02, 0.32, '#8d9594')
      const lid = box(g, 0.86, 0.58, -0.1, 0.02, 0.2, 0.32, '#8d9594')
      lid.rotation.z = 0.25
      box(g, 0.85, 0.6, -0.1, 0.005, 0.16, 0.27, '#5fd08a')
      cylinder(g, 0.66, 0.56, 0.32, 0.05, 0.09, '#f2ead0')
    },
    plate(g) { box(g, 0.72, 0.56, 0.36, 0.08, 0.07, 0.24, '#5f4c2c'); nameSign(g, 'CTO', 0.72, 0.6, 0.481, 0.22, 0, '#5f4c2c') },
    ducklings: [[0.62, 0.56, 0.12], [0.8, 0.56, 0.2], [0.6, 0.56, -0.38], [0.82, 0.56, 0.38], [0.64, 0.56, 0.4]],
    pile: [0.75, 0.56, -0.38],
    wet: false,
  },
  /**
   * **D: the plinth.** A museum piece: a dark plinth with a brass plaque, two posts and a red velvet rope, in the clear
   * floor north of the east pods. The founder's lucky duck, promoted to an exhibit. (It was tried by the founder's desk
   * first, on the podium's east end; between the lamp and the bookcase it was a smudge.)
   */
  plinth: {
    // [2026-10-22, second pass] Lower, wider and white, with a bigger duck on it: the first plinth was a tall dark
    // column with a small duck balanced on top, a plinth that happened to have a duck on it, and near-black on the
    // room's dark floor swallowed him. A museum's white stone sets the yellow off.
    x: 10.0, z: -6.5, y: 0, size: 1.3, scale: 0.82, at: [0, 0.56, 0],
    build(g) {
      box(g, 0, 0, 0, 0.98, 0.06, 0.98, '#c9c3b6')
      box(g, 0, 0.06, 0, 0.8, 0.44, 0.8, '#ece7dc')
      box(g, 0, 0.5, 0, 0.94, 0.06, 0.94, '#c9c3b6')
      for (const sx of [-1, 1]) {
        box(g, sx * 0.72, 0, 0.78, 0.1, 0.03, 0.1, BRASS)
        box(g, sx * 0.72, 0.03, 0.78, 0.04, 0.5, 0.04, BRASS)
        sphere(g, sx * 0.72, 0.56, 0.78, 0.04, BRASS, true)
      }
      for (let i = 0; i < 6; i++) {
        const t = i / 5, x = -0.66 + t * 1.32, sag = 0.1 * Math.sin(Math.PI * t)
        box(g, x, 0.47 - sag, 0.78, 0.28, 0.04, 0.04, '#9e2a2f')
      }
    },
    plate(g) { box(g, 0, 0.18, 0.402, 0.44, 0.15, 0.01, BRASS); nameSign(g, 'CTO', 0, 0.255, 0.409, 0.36, 0, '#5f4c2c') },
    ducklings: [[0.3, 0.06, 0.44], [0.42, 0.06, 0.28], [-0.32, 0.06, 0.45], [0.44, 0.06, -0.3], [-0.44, 0.06, -0.32]],
    pile: [0.62, 0, -0.62],
    wet: false,
  },
}

let chosenSeat: DuckSeat = 'pool'
/** Pick the seat the next garage is built with — the demo's switch, set by the stage from `?duck=`. */
export function setDuckSeat(seat: DuckSeat): void { chosenSeat = seat }
export function duckSeat(): DuckSeat { return chosenSeat }

// --- the office ----------------------------------------------------------------------

export interface DuckOffice {
  /** Redraw him for a look. True when anything changed (the room must redraw). */
  setLook(look: DuckLook): boolean
  /** A tap landed on him: a squeak, which is a squash and a stretch. */
  squeak(now: number): void
  /** Advance the squeak. True while he is moving. */
  update(now: number): boolean
  /** The invisible volume a tap has to land in. */
  readonly hit: T.Mesh
  /** His head, in the world, for the dialogue's lens. */
  head(out: T.Vector3): T.Vector3
}

const hitMaterial = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })

/** A duckling, in the seat's frame. */
function duckling(g: T.Group, [x, y, z]: readonly [number, number, number], s: number): void {
  box(g, x, y, z, 0.18 * s, 0.11 * s, 0.14 * s, YELLOW)
  box(g, x + 0.04 * s, y + 0.11 * s, z, 0.1 * s, 0.1 * s, 0.1 * s, YELLOW)
  box(g, x + 0.11 * s, y + 0.14 * s, z, 0.05 * s, 0.025 * s, 0.06 * s, BEAK)
}

/** Stacks of printouts: the code he has been read. */
function printouts(g: T.Group, [x, y, z]: readonly [number, number, number], n: number, s: number): void {
  for (let i = 0; i < n; i++) box(g, x, y, z + i * 0.2 * s, 0.22 * s, (0.1 + i * 0.05) * s, 0.16 * s, '#efe9d8')
}

export function duckOffice(parent: T.Object3D, seatId: DuckSeat = chosenSeat): DuckOffice {
  const seat = SEATS[seatId]
  const root = new T.Group()
  root.name = `duck-${seatId}`
  root.position.set(seat.x, seat.y, seat.z)
  root.rotation.y = Math.PI / 4
  root.scale.setScalar(seat.size)
  parent.add(root)
  seat.build(root)

  const live = new T.Group()
  live.userData.dynamic = true
  root.add(live)
  // He turns three-quarters inside the seat, so the seat can face the lens square while he shows his profile.
  const body = new T.Group()
  body.position.set(...seat.at)
  body.rotation.y = TURN - Math.PI / 4
  live.add(body)
  const outfit = new T.Group()
  outfit.scale.setScalar(seat.scale)
  body.add(outfit)
  const extras = new T.Group()
  live.add(extras)

  const hit = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1, 12), hitMaterial)
  hit.position.set(seat.at[0], seat.at[1] + 0.55 * seat.scale, seat.at[2])
  hit.scale.set(1.3 * seat.scale, 1.2 * seat.scale, 1.3 * seat.scale)
  hit.userData.hit = true
  root.add(hit)

  let shown = ''
  let squeakAt = -1
  const s = seat.scale

  const setLook = (look: DuckLook): boolean => {
    const key = lookKey(look)
    if (key === shown) return false
    shown = key
    outfit.clear()
    extras.clear()
    figure(outfit)
    for (const slot of ['head', 'face', 'neck'] as const) {
      const id = look.outfit[slot]
      if (id) WEAR[id]?.(outfit)
    }
    if (look.outfit.tub === 'bubbles') {
      const ring: readonly [number, number][] = [[0.55, 0.3], [0.3, -0.6], [-0.6, 0.35], [-0.5, -0.4], [0.7, -0.15], [0.05, 0.62]]
      for (const [x, z] of ring) sphere(extras, seat.at[0] + x * s * 1.1, seat.at[1] + (seat.wet ? 0.02 : 0.9 * s), seat.at[2] + z * s * 1.1, 0.09 * Math.max(0.7, s), '#f6f4ee', true)
    }
    for (let i = 0; i < look.ducklings; i++) duckling(extras, seat.ducklings[i], Math.max(0.8, s))
    printouts(extras, seat.pile, look.printouts, Math.max(0.8, s))
    if (look.promoted) seat.plate(extras)
    return true
  }
  setLook(NO_DUCK_LOOK)

  return {
    setLook,
    squeak(now) { squeakAt = now },
    update(now) {
      if (squeakAt < 0) return false
      const t = now - squeakAt
      // Down and wide for a tenth of a second, up and thin for a tenth, and back: the squeak is the squash.
      const u = t < 0.1 ? t / 0.1 : t < 0.2 ? 1 - (t - 0.1) / 0.1 * 2 : t < 0.32 ? -1 + (t - 0.2) / 0.12 : 0
      body.scale.set(1 + 0.14 * u, 1 - 0.22 * u, 1 + 0.14 * u)
      if (t >= 0.32) { squeakAt = -1; body.scale.set(1, 1, 1) }
      return true
    },
    hit,
    head(out) {
      root.updateMatrixWorld(true)
      return outfit.localToWorld(out.set(A.head.x, A.head.y, 0))
    },
  }
}
