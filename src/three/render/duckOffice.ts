/**
 * The CTO's corner bath — GDD §11.7 [2026-10-21].
 *
 * *"put him somewhere in our office, instead of on our desk right now"*. He was
 * a crowned box on the founder's desk (`garageDeskStory`, 2026-10-05 to
 * 2026-10-21); he is a rubber duck in a clawfoot bath in the north-east corner
 * now (`floorPlan.DUCK_BATH` has where and why), and he is the one figure in the
 * room whose upgrades are visible on him.
 *
 * **Few big readable pieces** (the user's standing preference for scenery): a
 * bath on a mat, a duck in it, a brass stand with his title on it once he has
 * one. Everything he wears is a handful of boxes hung on his head, his face or
 * under his beak, and each is sized to read at the room's resting zoom rather
 * than at a face's.
 *
 * Two layers, because only one of them changes. The bath and its mat are the
 * room's, and go into the batch with everything else. The duck, his outfit and
 * the things that come and go around the bath are one `dynamic` group that the
 * batcher skips (`worldArt.batchArt`), rebuilt from boxes when his look
 * changes — which is a purchase or a wardrobe tap, a handful of times a run.
 *
 * He is not in `env.targets`: a target is somebody who codes, the room's work
 * stream leaves from every visible one, and he has never written a line. The
 * view asks {@link DuckOffice.hit} itself.
 */

import * as T from 'three'
import { box, sphere, sharedMaterial } from './worldArt.ts'
import { nameSign } from './garageDetails.ts'
import { DUCK_BATH } from '../sim/floorPlan.ts'
import { NO_DUCK_LOOK, lookKey, type DuckLook } from '../../sim/duck.ts'

const YELLOW = '#edbe47'
const YELLOW_TOP = '#f4cf58'
const BEAK = '#d77b36'
const EYE = '#263c3c'
const ENAMEL = '#e9ecea'
const ENAMEL_SIDE = '#cfd6d4'
const WATER = '#8dc3da'
const BRASS = '#c49b3c'
const GOLD = '#e8b541'

/** The duck's head, in the bath's own frame: everything he wears is placed off it. */
const HEAD = { x: -0.28, y: 1.12, z: 0.04, s: 0.4 }
/**
 * He is drawn larger than a bath duck has any right to be: at 1:1 his head was a 0.4 m block, about twenty pixels at the
 * room's resting zoom, and a crown on it was three (found by looking). Scaled about the water line, so he grows up out of
 * the bath rather than through its floor. Everything he wears scales with him.
 */
const DUCK_SCALE = 1.4
/** The front of his body, under his beak, where a tie hangs. */
const CHEST_Z = 0.27

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

/** The bath and the mat — static, batched with the room. */
function bath(g: T.Group): void {
  const { length: L, width: W } = DUCK_BATH
  // A bath mat on the floor in front, and a rug under the lot so the corner reads as a room of his.
  box(g, 0, 0.004, 0.12, L + 0.5, 0.012, W + 0.75, '#3f6e78', false)
  box(g, -0.15, 0.016, W / 2 + 0.32, 0.7, 0.012, 0.36, '#d8d2c4', false)
  // Four brass feet, then the bath: a deep box with a rolled rim, enamel outside, water inside.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, sx * (L / 2 - 0.14), 0, sz * (W / 2 - 0.12), 0.1, 0.14, 0.1, BRASS)
  box(g, 0, 0.12, 0, L, 0.5, W, ENAMEL_SIDE)
  box(g, 0, 0.62, 0, L + 0.06, 0.07, W + 0.06, ENAMEL)
  box(g, 0, 0.6, 0, L - 0.14, 0.04, W - 0.14, WATER, false)
  // Taps at the far end, against the wall side: a pillar and a spout.
  box(g, L / 2 - 0.12, 0.69, -0.12, 0.06, 0.2, 0.06, BRASS)
  box(g, L / 2 - 0.2, 0.84, -0.12, 0.18, 0.05, 0.05, BRASS)
}

/** The duck: body, tail, head, beak, eyes and a wing either side. */
function duck(g: T.Group): void {
  box(g, HEAD.x + 0.08, 0.5, -0.04, 0.66, 0.44, 0.56, YELLOW)
  box(g, HEAD.x - 0.27, 0.86, -0.22, 0.16, 0.16, 0.16, YELLOW)
  for (const side of [-1, 1]) box(g, HEAD.x + 0.08 + side * 0.34, 0.62, -0.04, 0.04, 0.2, 0.32, YELLOW_TOP)
  box(g, HEAD.x, HEAD.y - HEAD.s / 2, HEAD.z, HEAD.s, HEAD.s, HEAD.s, YELLOW_TOP)
  box(g, HEAD.x, HEAD.y - 0.07, HEAD.z + HEAD.s / 2 + 0.06, 0.2, 0.08, 0.13, BEAK)
  for (const side of [-1, 1]) box(g, HEAD.x + side * 0.09, HEAD.y + 0.04, HEAD.z + HEAD.s / 2 + 0.005, 0.06, 0.08, 0.02, EYE)
}

const FRONT = HEAD.z + HEAD.s / 2 + 0.012
const TOP = HEAD.y + HEAD.s / 2

/** What each item is, as boxes on the duck. */
const WEAR: Record<string, (g: T.Group) => void> = {
  crown: (g) => {
    // Darker than his head and taller than a hat band, or gold on yellow is no crown at all.
    box(g, HEAD.x, TOP, HEAD.z, 0.32, 0.09, 0.32, '#c08a2a')
    for (const dx of [-0.12, 0, 0.12]) for (const dz of [-0.12, 0.12]) box(g, HEAD.x + dx, TOP + 0.09, HEAD.z + dz, 0.07, 0.12, 0.07, '#c08a2a')
    box(g, HEAD.x, TOP + 0.02, HEAD.z + 0.152, 0.05, 0.04, 0.01, '#b0443a')
  },
  tophat: (g) => {
    box(g, HEAD.x, TOP, HEAD.z, 0.46, 0.03, 0.46, '#22262a')
    box(g, HEAD.x, TOP + 0.03, HEAD.z, 0.28, 0.34, 0.28, '#22262a')
    box(g, HEAD.x, TOP + 0.06, HEAD.z, 0.286, 0.06, 0.286, '#a24a3f')
  },
  partyhat: (g) => {
    box(g, HEAD.x, TOP, HEAD.z, 0.24, 0.1, 0.24, '#7b5aa6')
    box(g, HEAD.x, TOP + 0.1, HEAD.z, 0.16, 0.1, 0.16, '#5f9e6e')
    box(g, HEAD.x, TOP + 0.2, HEAD.z, 0.08, 0.1, 0.08, '#d1473b')
    sphere(g, HEAD.x, TOP + 0.34, HEAD.z, 0.045, '#f2ead0', true)
  },
  helmet: (g) => {
    const glass = box(g, HEAD.x, HEAD.y - HEAD.s / 2 - 0.04, HEAD.z, HEAD.s + 0.1, HEAD.s + 0.1, HEAD.s + 0.1, '#b1c7c8', false)
    glass.material = sharedMaterial('duck-helmet-glass', () => new T.MeshStandardMaterial({ color: '#b1c7c8', transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.3 }))
    box(g, HEAD.x, HEAD.y - HEAD.s / 2 - 0.08, HEAD.z, HEAD.s + 0.14, 0.06, HEAD.s + 0.14, '#e9ecea')
    box(g, HEAD.x + 0.14, TOP + 0.06, HEAD.z - 0.1, 0.02, 0.2, 0.02, '#8d9594')
    sphere(g, HEAD.x + 0.14, TOP + 0.28, HEAD.z - 0.1, 0.035, '#d1473b', true)
  },
  readers: (g) => {
    for (const side of [-1, 1]) {
      box(g, HEAD.x + side * 0.09, HEAD.y + 0.0, FRONT, 0.13, 0.11, 0.015, EYE)
      box(g, HEAD.x + side * 0.09, HEAD.y + 0.015, FRONT + 0.009, 0.09, 0.07, 0.01, WATER)
    }
    box(g, HEAD.x, HEAD.y + 0.04, FRONT, 0.06, 0.02, 0.015, EYE)
  },
  shades: (g) => {
    box(g, HEAD.x, HEAD.y + 0.0, FRONT, 0.34, 0.1, 0.02, '#141414')
    box(g, HEAD.x - 0.12, HEAD.y + 0.05, FRONT + 0.012, 0.05, 0.02, 0.01, '#8d9594')
  },
  monocle: (g) => {
    box(g, HEAD.x + 0.09, HEAD.y + 0.0, FRONT, 0.14, 0.14, 0.015, GOLD)
    box(g, HEAD.x + 0.09, HEAD.y + 0.015, FRONT + 0.009, 0.09, 0.09, 0.01, WATER)
    box(g, HEAD.x + 0.15, HEAD.y - 0.24, FRONT - 0.01, 0.012, 0.24, 0.012, GOLD)
  },
  lanyard: (g) => {
    box(g, HEAD.x, 0.9, CHEST_Z, 0.34, 0.035, 0.02, '#b0443a')
    box(g, HEAD.x, 0.74, CHEST_Z + 0.005, 0.13, 0.15, 0.02, '#f2ead0')
    box(g, HEAD.x, 0.82, CHEST_Z + 0.012, 0.13, 0.03, 0.01, '#b0443a')
  },
  bowtie: (g) => {
    for (const side of [-1, 1]) box(g, HEAD.x + side * 0.07, 0.86, CHEST_Z, 0.1, 0.09, 0.03, '#b0443a')
    box(g, HEAD.x, 0.875, CHEST_Z + 0.01, 0.05, 0.06, 0.03, '#d1473b')
  },
  necktie: (g) => {
    box(g, HEAD.x, 0.86, CHEST_Z, 0.08, 0.07, 0.03, '#4a7fb0')
    box(g, HEAD.x, 0.64, CHEST_Z, 0.07, 0.22, 0.025, '#4a7fb0')
  },
  bubbles: (g) => {
    const at: readonly [number, number, number][] = [[0.18, 0.04, 0.12], [0.36, 0.09, -0.16], [0.55, 0.06, 0.15], [-0.62, 0.05, -0.18], [-0.05, 0.03, 0.27], [0.62, 0.11, -0.05]]
    for (const [x, r, z] of at) sphere(g, x, 0.66, z, r + 0.05, '#f6f4ee', true)
  },
}

/** A duckling, floating at (x, z) in the bath's frame. */
function duckling(g: T.Group, x: number, z: number): void {
  box(g, x, 0.6, z, 0.16, 0.1, 0.13, YELLOW)
  box(g, x - 0.02, 0.7, z + 0.01, 0.09, 0.09, 0.09, YELLOW_TOP)
  box(g, x - 0.02, 0.73, z + 0.07, 0.05, 0.025, 0.04, BEAK)
}

/**
 * A stack of printouts on the mat in front of the bath's right-hand end: the code he has been read. In front and not
 * beyond the end, because the far end is a hand off the wall; low, so they hide nothing of him.
 */
function printouts(g: T.Group, i: number): void {
  const x = 0.25 + i * 0.24, z = DUCK_BATH.width / 2 + 0.17
  const h = 0.12 + i * 0.05
  box(g, x, 0.02, z, 0.24, h, 0.2, '#efe9d8')
  box(g, x, 0.02 + h * 0.5, z + 0.101, 0.18, 0.012, 0.004, '#8d9594')
}

/** The brass stand with his title on it, by the bath's near end: beside him and never in front of him. */
function plaque(g: T.Group): void {
  const x = -DUCK_BATH.length / 2 - 0.14, z = 0.25
  box(g, x, 0, z, 0.22, 0.03, 0.22, BRASS)
  box(g, x, 0.03, z, 0.04, 0.58, 0.04, BRASS)
  box(g, x, 0.6, z, 0.46, 0.17, 0.04, '#5f4c2c')
  nameSign(g, 'CTO', x, 0.685, z + 0.025, 0.4, 0, '#5f4c2c')
}

export function duckOffice(parent: T.Object3D): DuckOffice {
  const root = new T.Group()
  root.name = 'duck-office'
  root.position.set(DUCK_BATH.x, 0, DUCK_BATH.z)
  root.rotation.y = DUCK_BATH.yaw
  parent.add(root)
  bath(root)

  // The part that changes: skipped by the batcher, rebuilt on a new look.
  const live = new T.Group()
  live.userData.dynamic = true
  root.add(live)
  // The squash pivots on the water line, so he squeaks in place rather than sinking.
  const body = new T.Group()
  body.scale.setScalar(DUCK_SCALE)
  body.position.y = 0.6
  live.add(body)
  const outfit = new T.Group()
  outfit.position.y = -0.6
  body.add(outfit)
  const extras = new T.Group()
  live.add(extras)

  const hit = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1, 12), hitMaterial)
  hit.position.set(HEAD.x * DUCK_SCALE, 1.05, 0)
  hit.scale.set(1.3, 1.3, 1.3)
  hit.userData.hit = true
  root.add(hit)

  let shown = ''
  let squeakAt = -1

  const setLook = (look: DuckLook): boolean => {
    const key = lookKey(look)
    if (key === shown) return false
    shown = key
    outfit.clear()
    extras.clear()
    duck(outfit)
    for (const slot of ['head', 'face', 'neck'] as const) {
      const id = look.outfit[slot]
      if (id) WEAR[id]?.(outfit)
    }
    if (look.outfit.tub === 'bubbles') WEAR.bubbles(extras)
    for (let i = 0; i < look.ducklings; i++) duckling(extras, 0.12 + (i % 3) * 0.22, i < 3 ? 0.14 : -0.16)
    for (let i = 0; i < look.printouts; i++) printouts(extras, i)
    if (look.promoted) plaque(extras)
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
      body.scale.set(DUCK_SCALE * (1 + 0.14 * u), DUCK_SCALE * (1 - 0.22 * u), DUCK_SCALE * (1 + 0.14 * u))
      if (t >= 0.32) { squeakAt = -1; body.scale.setScalar(DUCK_SCALE) }
      return true
    },
    hit,
    head(out) {
      root.updateMatrixWorld(true)
      return outfit.localToWorld(out.set(HEAD.x, HEAD.y, HEAD.z))
    },
  }
}
