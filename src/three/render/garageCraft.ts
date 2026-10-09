/*
 * Copied from the rebuild (100m-devs-three/src/render/garageCraft.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/** Tactile garage art: reusable materials and deliberately authored furniture. */
import * as T from 'three'
import { OS_SKIN } from '../art/skin.ts'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { box, cylinder, INK, line, sharedMaterial, sphere, worktable } from './worldArt.ts'
import { studioFloorContains } from '../sim/floorPlan.ts'

const finishes = new Map<string, T.MeshStandardMaterial>()
// Furniture catches a controlled highlight; people and architecture keep hard
// construction edges. Applying one bevel to everything was the old mismatch.
const furnitureEdge = new RoundedBoxGeometry(1, 1, 1, 2, .025)
function grain(kind: 'wood' | 'stone' | 'cloth'): T.DataTexture {
  // §7.8.12 [2026-10-07]: restrained grain supports the silhouette. The first
  // cut's repeating bands made plaster and joinery look like patterned wallpaper.
  const size = 32, bytes = new Uint8Array(size * size * 4)
  let seed = 71
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const noise = (seed >>> 24) / 255
    const shade = kind === 'wood' ? (y % 9 === 0 && noise > .35 ? .94 : noise > .9 ? .97 : 1)
      : kind === 'cloth' ? ((x + y) % 4 === 0 ? .98 : 1)
        : (noise > .96 ? .98 : 1)
    const at = (y * size + x) * 4
    bytes[at] = bytes[at + 1] = bytes[at + 2] = Math.min(255, shade * 255); bytes[at + 3] = 255
  }
  const t = new T.DataTexture(bytes, size, size)
  t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.NearestFilter; t.minFilter = T.NearestMipmapNearestFilter
  t.generateMipmaps = true; t.needsUpdate = true; return t
}
const maps = { wood: grain('wood'), stone: grain('stone'), cloth: grain('cloth') }
maps.cloth.repeat.set(1, 1)
function finish(colour: string, kind: keyof typeof maps): T.MeshStandardMaterial {
  const key = `${colour}:${kind}`
  if (!finishes.has(key)) finishes.set(key, new T.MeshStandardMaterial({ color: colour, map: kind === 'stone' ? null : maps[kind],
    roughness: .94, flatShading: true }))
  return finishes.get(key)!
}

/** Broad tiles keep the floor quieter than the cast in the voxel review cut (§7.4a). */
export function garagePlatformFloor(g: T.Group, d: { x0: number; x1: number; z0: number; z1: number; rise: number }): void {
  const block = 1.4
  for (let x = d.x0, col = 0; x < d.x1; x += block, col++) {
    for (let z = d.z0, row = 0; z < d.z1; z += block, row++) {
      const x1 = Math.min(d.x1, x + block), z1 = Math.min(d.z1, z + block)
      const board = box(g, (x + x1) / 2, d.rise - .010, (z + z1) / 2,
        x1 - x - .008, .018, z1 - z - .008, '#aa7b4d', false)
      board.material = finish(['#ae8960', '#b08b62', '#b38d63'][(col + row) % 3], 'wood')
    }
  }
}

/** Shared texture resources live with the existing world material cache. */
export function finishGarage(root: T.Group): void {
  root.traverse(node => {
    if (!(node instanceof T.Mesh) || node.userData.hit || !(node.material instanceof T.MeshStandardMaterial) || node.material.map || node.material.transparent) return
    const colour = `#${node.material.color.getHexString()}`
    const wood = [INK.wood, INK.woodEdge, '#c39760', '#b7a37a'].includes(colour)
    const cloth = ['#3c6591', '#345b86', '#829caa', '#a8c2ba', '#576568', '#393f3d'].includes(colour)
    const stone = [INK.wall, INK.trim, '#e8e2d4', '#d3d1c5'].includes(colour)
    if (wood || cloth || stone) node.material = finish(colour, wood ? 'wood' : cloth ? 'cloth' : 'stone')
    let actor = false
    for (let p = node.parent; p && p !== root; p = p.parent) if (p.userData.identity) actor = true
    if (!actor && (wood || cloth) && node.geometry.type === 'BoxGeometry' && !node.userData.ownGeometry
      && Math.max(...node.scale.toArray()) < 3.5 && Math.min(...node.scale.toArray()) > .08) node.geometry = furnitureEdge
  })
}

const panels = new Map<string, T.MeshBasicMaterial>()
function printed(g: T.Object3D, key: string, w: number, h: number, x: number, y: number, z: number, paint: (c: CanvasRenderingContext2D) => void, yaw = 0): void {
  if (typeof document === 'undefined' || /jsdom/i.test(navigator.userAgent)) return
  if (!panels.has(key)) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 512
    const c = canvas.getContext('2d')!; paint(c)
    const t = new T.CanvasTexture(canvas); t.colorSpace = T.SRGBColorSpace
    const material = new T.MeshBasicMaterial({ map: t })
    // §7.8.12 [2026-10-07]: screens carry information; the shared room rig lights faces.
    if (OS_SKIN && key.startsWith('screen-')) material.color.setScalar(.9)
    panels.set(key, material)
  }
  const mesh = new T.Mesh(new T.PlaneGeometry(w, h), panels.get(key))
  mesh.position.set(x, y, z); mesh.rotation.y = yaw; mesh.userData.ownGeometry = true; g.add(mesh)
}

export function garageScreen(g: T.Object3D, id: string, x: number, y: number, z: number, yaw = 0, width = .81, height = .45): void {
  printed(g, `screen-${id}`, width, height, x, y, z, c => {
    c.fillStyle = '#172b34'; c.fillRect(0, 0, 768, 512)
    c.fillStyle = '#36515a'; c.fillRect(0, 0, 768, 40)
    if (id === 'founder') {
      c.fillStyle = '#95c9d8'; c.fillRect(18, 58, 510, 410)
      c.fillStyle = '#e9f0d8'; for (let i = 0; i < 4; i++) c.fillRect(40 + i * 120, 100 + i % 2 * 35, 70, 25)
      c.fillStyle = '#547344'; c.fillRect(18, 398, 510, 70)
      for (let i = 0; i < 4; i++) { c.fillStyle = '#759c50'; c.fillRect(90 + i * 100, 350 - i % 2 * 65, 70, 18); c.fillStyle = '#a07b50'; c.fillRect(90 + i * 100, 368 - i % 2 * 65, 70, 20) }
      c.fillStyle = '#d39240'; c.fillRect(223, 298, 23, 29); c.fillStyle = '#e7c392'; c.fillRect(225, 279, 19, 19)
    }
    for (let i = 0; i < 22; i++) {
      c.fillStyle = ['#86b9a3', '#d6b779', '#91b2c8'][i % 3]
      c.fillRect(id === 'founder' ? 554 : 35 + i % 3 * 20, 66 + i * 18, id === 'founder' ? 80 + i % 3 * 25 : 220 + i * 37 % 360, 5)
    }
  }, yaw)
}

export function craftedPod(g: T.Group, x: number, z: number, rotation: number): void {
  const pod = worktable(g, x, z, 3.05, 1.45); pod.rotation.y = rotation
  for (const side of [-1, 1]) {
    box(pod, side * 1.27, .08, 0, .32, .76, 1.25, INK.woodEdge)
    for (let i = 0; i < 3; i++) {
      box(pod, side * 1.27, .12 + i * .23, side * .637, .29, .19, .03, '#53746c')
      box(pod, side * 1.27, .25 + i * .23, side * .66, .12, .018, .02, INK.trim)
    }
    for (const dx of [-.66, .66]) garageScreen(pod, 'developer', dx, 1.225, side * .209, side > 0 ? 0 : Math.PI, .49, .29)
  }
  const plant = new T.Group(); plant.position.y = .93; pod.add(plant); leafyPlanter(plant, 0, 0, .19)
  for (const side of [-1, 1]) box(pod, .06, .93, side * .51, .25, .035, .16, '#c3ac80')
}

export function lamp(g: T.Group, x: number, z: number): void {
  cylinder(g, x, .93, z, .13, .045, INK.metal)
  line(g, [new T.Vector3(x, .97, z), new T.Vector3(x + .08, 1.57, z), new T.Vector3(x - .27, 1.82, z)], INK.metal)
  const stem = box(g, x + .04, .98, z, .045, .6, .045, INK.metal); stem.rotation.z = -.13
  const arm = box(g, x - .09, 1.56, z, .43, .045, .045, INK.metal); arm.rotation.z = -.58
  cylinder(g, x - .29, 1.7, z, .14, .12, '#c9a364')
  const bulb = cylinder(g, x - .29, 1.694, z, .11, .015, '#ffe6af')
  bulb.material = sharedMaterial('lamp-bulb', () => new T.MeshBasicMaterial({ color: '#ffe5a8' }))
}

export function craftedHeroDesk(g: T.Group, id: string): void {
  const desk = new T.Group(); desk.name = `${id}-station`; g.add(desk)
  // Heavy joinery, drawers and the modest asymmetry of two real personal desks.
  box(desk, 0, .78, .8, 2.24, .14, 1.03, INK.wood)
  box(desk, -.79, .08, .84, .48, .7, .86, INK.woodEdge)
  for (let i = 0; i < 3; i++) {
    box(desk, -.79, .12 + i * .21, .397, .44, .18, .035, id === 'founder' ? '#477671' : INK.wood)
    box(desk, -.79, .24 + i * .21, .37, .19, .025, .025, '#b9beb7')
  }
  for (const zz of [.39, 1.2]) box(desk, .9, .02, zz, .1, .76, .1, INK.woodEdge)
  box(desk, 0, .16, 1.22, 1.7, .54, .08, '#34494f')
  for (let x = -.75; x < .85; x += .22) box(desk, x, .21, 1.267, .065, .44, .025, INK.wood)
  // Screen, keyboard and seated operator share the desk's local forward axis.
  const monitor = new T.Group(); monitor.position.set(-.04, 0, .92)
  monitor.rotation.y = Math.PI; desk.add(monitor)
  box(monitor, 0, .925, 0, .27, .035, .2, INK.metal)
  box(monitor, 0, .95, 0, .06, .18, .07, INK.metal)
  box(monitor, 0, 1.08, 0, 1.05, .63, .065, INK.metal)
  garageScreen(monitor, id, 0, 1.395, .038, 0, .96, .55)
  box(desk, -.06, .936, .48, .63, .025, .22, '#747f7b')
  for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) box(desk, -.32 + col * .065, .962, .415 + row * .06, .045, .007, .037, '#c5c8bd')
  box(desk, .46, .936, .49, .21, .018, .25, '#385359')
  box(desk, .46, .960, .48, .085, .04, .12, '#b7bdb9')
  lamp(desk, .89, 1.07)
  if (id === 'founder') {
    // [2026-09-26] The back of the monitor is bare: "I don't want the only works
    // on my machine note on the back on my PC".
    // A comically oversized release button, safely away from the typing keys.
    box(desk, .70, .92, .74, .38, .065, .32, '#374e50')
    cylinder(desk, .70, .985, .74, .13, .10, '#cf5441')
    printed(desk, 'founder-ship-it', .34, .12, .70, .96, .907, c => {
      c.fillStyle = '#f5edda'; c.fillRect(0, 0, 768, 512)
      c.fillStyle = '#7b352a'; c.textAlign = 'center'; c.font = 'bold 190px sans-serif'; c.fillText('SHIP IT', 384, 320)
    })
  }
  const plant = new T.Group(); plant.position.y = .92; desk.add(plant)
  leafyPlanter(plant, id === 'founder' ? .61 : -.73, 1.14, .19)
  if (id !== 'founder') for (let i = 0; i < 2; i++) box(desk, -.69, .925 + i * .042, .76, .3, .035, .21, i ? INK.paper : '#417174')
}

/**
 * **The founder's desk, redesigned** [2026-10-05, at the user's instruction: *"his desk redesigned"*].
 *
 * The oak workstation the founder shared with James was a desk with a monitor on it. The boss of a studio that is
 * going to be a galaxy sits at a desk with *presence*: a walnut top with a green pad edged in brass, a pedestal
 * either side, a credenza behind the chair with a globe and a trophy on it, a rug under the lot, a tall leather
 * chair. The jokes are all still here — the duck promoted to CTO and the pizza boxes (`garageDeskStory`), the
 * oversized SHIP IT button — because they were the point of it.
 *
 * It is drawn on the same axes as every station: the occupant at the origin facing +z, the desk in front. The
 * footprint the sim reads (`floorPlan.BOSS_DESK`) is x −1.15…1.15, the back of the chair at −0.45 and the front of
 * the desk at +1.33 — and the credenza's back is at −1.17, which at the station's 1.25 is the 1.46 m the station stands off the credenza's wall, less the 0.32 m of air behind it.
 * (The first cut had an L: a return along the desk's east end carrying a laptop. On the west wall the return
 * wants to run north, into the corner, and south it reaches James's desk; it is gone, and the laptop with it.)
 */
export function craftedBossDesk(g: T.Group): void {
  // Lighter than the first cut, which read as one dark brown mass under the room's lamps: a mid walnut top over a
  // deeper carcase, a green pad and brass. The footprint is `floorPlan`'s BOSS_DESK: x −1.15…1.75, desk front at 1.33.
  const WALNUT = '#76583d', EDGE = '#34494f', TOP = '#ba9263', PAD = '#35523f', BRASS = '#d4ae5a'
  const desk = new T.Group(); desk.name = 'founder-station'; g.add(desk)
  const top = .895 // the pad's surface: everything that stands on the desk stands on this
  // the rug: a deep teal wool with a brass border, under the desk and the chair. **An octagon**, since 2026-10-05, when the desk
  // stood on the podium's diagonal and a rectangle turned an eighth in a corner reached out past the rail on two sides; the desk is
  // square to the walls now and the octagon stayed — it reaches 1.85 m and clears every edge of the podium by 0.3 m. (It is the
  // room's own idiom — Billy's rug is one — and `round` is an eight-sided prism.)
  for (const [r, y, h, c] of [[1.6, .004, .02, '#2c5558'], [1.48, .022, .006, '#d1b25f'], [1.36, .028, .006, '#2c5558']] as const) {
    const disc = cylinder(desk, 0, y, .36, r, h, c)
    disc.castShadow = false
    disc.rotation.y = Math.PI / 8
  }
  // The broader body needs actual clearance at the desk edge; the rug and
  // credenza keep their footprint on the podium.
  const worktop = new T.Group(); worktop.name = 'founder-worktop'
  worktop.position.z = .18; desk.add(worktop)
  // the desk: a top, a deeper apron, a pedestal either side and a kneehole panel on the room side
  box(worktop, 0, .78, .8, 2.3, .1, 1.06, TOP)
  box(worktop, 0, .70, .8, 2.2, .08, .96, EDGE)
  box(worktop, 0, top - .007, .84, 1.5, .012, .62, PAD)
  box(worktop, 0, top - .004, 1.155, 1.56, .008, .02, BRASS)
  box(worktop, -.88, 0, .82, .52, .70, .86, WALNUT)
  for (let i = 0; i < 3; i++) {
    box(worktop, -.88, .08 + i * .21, .385, .46, .18, .03, EDGE)
    box(worktop, -.88, .155 + i * .21, .36, .16, .025, .025, BRASS)
  }
  box(worktop, .88, 0, .82, .52, .70, .86, WALNUT)
  box(worktop, .88, .08, .385, .46, .58, .03, EDGE)
  box(worktop, .66, .32, .36, .025, .14, .025, BRASS)
  box(worktop, 0, .24, 1.3, 1.2, .46, .04, WALNUT)
  // a brass nameplate on the desk's front edge: *the boss*, in a word
  box(worktop, 0, .82, 1.345, .5, .07, .015, BRASS)
  // a mug at the left hand, where the Diet Coke is not (the pizza boxes are `garageDeskStory`'s, beside it)
  cylinder(worktop, -1.02, top - .012, .92, .055, .1, '#e9e2d0')
  // the monitor: one wide screen, its back to the room, with the project on it
  const monitor = new T.Group(); monitor.position.set(0, 0, .95); monitor.rotation.y = Math.PI; worktop.add(monitor)
  box(monitor, 0, top - .012, 0, .3, .03, .22, INK.metal)
  box(monitor, 0, top + .018, 0, .07, .2, .07, INK.metal)
  box(monitor, 0, 1.06, 0, 1.3, .60, .065, INK.metal)
  garageScreen(monitor, 'founder', 0, 1.36, .038, 0, 1.19, .52)
  // keyboard and mouse
  box(worktop, -.06, top - .012, .48, .63, .025, .22, '#3a4144')
  for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) box(worktop, -.32 + col * .065, top + .013, .415 + row * .06, .045, .007, .037, '#c5c8bd')
  box(worktop, .44, top - .012, .5, .1, .03, .16, '#2b2f33')
  // a big red button, safely away from the typing keys, and the plain truth about it on its front
  box(worktop, .70, top - .012, .74, .38, .065, .32, '#374e50')
  cylinder(worktop, .70, top + .053, .74, .13, .10, '#cf5441')
  printed(worktop, 'founder-ship-it', .34, .12, .70, top + .05, .907, c => {
    c.fillStyle = '#f5edda'; c.fillRect(0, 0, 768, 512)
    c.fillStyle = '#7b352a'; c.textAlign = 'center'; c.font = 'bold 190px sans-serif'; c.fillText('SHIP IT', 384, 320)
  })
  lamp(worktop, 1.02, 1.12)
  const plant = new T.Group(); plant.position.y = top; worktop.add(plant)
  leafyPlanter(plant, .52, 1.16, .19)
  // the credenza behind the chair, under the window: a globe, a trophy, a framed print, a plant
  box(desk, 0, 0, -.95, 2.1, .78, .38, WALNUT)
  box(desk, 0, .78, -.95, 2.16, .05, .44, TOP)
  for (const x of [-.5, .5]) {
    box(desk, x, .08, -.755, .9, .6, .02, EDGE)
    box(desk, x + (x < 0 ? .34 : -.34), .36, -.74, .025, .12, .025, BRASS)
  }
  cylinder(desk, -.72, .83, -.95, .13, .03, BRASS)
  cylinder(desk, -.72, .86, -.95, .025, .2, BRASS)
  sphere(desk, -.72, 1.22, -.95, .19, '#3f7f9f')
  cylinder(desk, .55, .83, -.95, .06, .05, BRASS)
  cylinder(desk, .55, .88, -.95, .02, .12, BRASS)
  cylinder(desk, .55, 1.0, -.95, .1, .12, '#e1c070')
  box(desk, -.05, .83, -1.1, .36, .42, .03, EDGE)
  box(desk, -.05, .86, -1.083, .3, .34, .012, INK.paper)
  box(desk, -.05, .98, -1.074, .2, .14, .01, '#648079')
  const bloom = new T.Group(); bloom.position.y = .83; desk.add(bloom)
  leafyPlanter(bloom, .88, -.95, .26)
}

/**
 * The founder's chair: tall, leather, tufted, with arms — a hand taller than anybody else's. Authored like
 * {@link craftedChair}, with the back toward +z, so that a facing of π puts it behind the occupant.
 */
export function bossChair(g: T.Group, x: number, z: number, facing: number): T.Group {
  const chair = new T.Group(); chair.position.set(x, 0, z); chair.rotation.y = facing; g.add(chair)
  const LEATHER = '#8a5238', DARK = '#3a3938'
  box(chair, 0, .5, .06, .76, .15, .66, LEATHER)
  box(chair, 0, .64, .4, .74, .98, .15, LEATHER)
  box(chair, 0, 1.5, .4, .54, .2, .18, LEATHER)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) box(chair, (c - 1) * .22, .78 + r * .2, .322, .1, .1, .02, '#5e3624')
  for (const side of [-1, 1]) {
    box(chair, side * .42, .56, .05, .1, .06, .54, DARK)
    box(chair, side * .42, .4, -.02, .05, .17, .05, DARK)
  }
  cylinder(chair, 0, .15, .1, .05, .35, INK.metal)
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5, xx = Math.cos(angle) * .3, zz = .1 + Math.sin(angle) * .3
    const spoke = box(chair, xx / 2, .11, (zz + .1) / 2, .34, .045, .045, INK.metal)
    spoke.rotation.y = -angle
    cylinder(chair, xx, .045, zz, .052, .08, INK.metal)
  }
  return chair
}

let cokeMaterial: T.MeshStandardMaterial | undefined
export function dietCoke(g: T.Object3D, x: number, y: number, z: number): void {
  const body = cylinder(g, x, y, z, .085, .22, '#cdd1cd')
  if (typeof document !== 'undefined' && !/jsdom/i.test(navigator.userAgent)) {
    if (!cokeMaterial) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256
      const c = canvas.getContext('2d')!; c.fillStyle = '#d5d8d6'; c.fillRect(0, 0, 512, 256)
      for (let i = 0; i < 2; i++) {
        c.fillStyle = '#555b5b'; c.font = 'italic 36px sans-serif'; c.fillText('Diet', 26 + i * 256, 78)
        c.fillStyle = '#b72727'; c.font = 'bold italic 75px Georgia'; c.fillText('Coke', 8 + i * 256, 163)
      }
      const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace
      cokeMaterial = new T.MeshStandardMaterial({ map, roughness: .43, metalness: .24 })
    }
    body.material = cokeMaterial
  }
  cylinder(g, x, y + .219, z, .078, .01, '#a7afac')
  box(g, x, y + .23, z, .023, .005, .047, '#626a67')
}

export function craftedChair(g: T.Group, x: number, z: number, facing: number, hero = false): T.Group {
  const chair = new T.Group(); chair.position.set(x, 0, z); chair.rotation.y = facing; g.add(chair)
  const w = hero ? .66 : .55
  box(chair, 0, .5, .06, w, .15, .56, '#414c4b')
  // The larger developer torso needs a deeper chair back, while the seat stays
  // under the same hips. Hero chairs already sit farther behind their people.
  const backZ = hero ? .35 : .53
  box(chair, 0, .66, backZ, w, hero ? .81 : .57, .14, '#414c4b')
  if (!hero) for (const x of [-.22, .22]) {
    box(chair, x, .55, .42, .045, .06, .24, INK.metal)
    box(chair, x, .55, backZ, .045, .19, .045, INK.metal)
  }
  // Two designed upholstery panels read as a chair, instead of six raised tiles.
  box(chair, 0, .69, backZ + .085, w - .08, hero ? .70 : .46, .025, '#526970')
  box(chair, 0, .69, backZ + .111, .024, hero ? .70 : .46, .006, '#34484f')
  cylinder(chair, 0, .15, .1, .05, .35, INK.metal)
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5, xx = Math.cos(angle) * .29, zz = .1 + Math.sin(angle) * .29
    const spoke = box(chair, xx / 2, .11, (zz + .1) / 2, .33, .045, .045, INK.metal); spoke.rotation.y = -angle
    cylinder(chair, xx, .045, zz, .052, .08, INK.metal)
  }
  if (hero) for (const side of [-1, 1]) {
    box(chair, side * .47, .54, .02, .035, .28, .035, INK.metal)
    box(chair, side * .47, .8, -.04, .1, .045, .32, '#414c4b')
  }
  return chair
}

export function leafyPlanter(g: T.Group, x: number, z: number, size = .55): void {
  box(g, x, 0, z, size, size * .55, size, '#394e55')
  box(g, x, size * .50, z, size * 1.04, size * .06, size * 1.04, '#61767a')
  box(g, x, size * .55, z, size * .83, .025, size * .83, '#60513b')
  for (const side of [-1, 0, 1]) {
    box(g, x + side * size * .24, size * .57, z + side * size * .12,
      size * .32, size * (side === 0 ? 1.1 : .72), size * .34, side === 0 ? '#74956f' : '#436b51')
  }
}

/** One oak desk, drawers, screen and mug per developer, facing local +z. */
export function craftedSingleDesk(g: T.Group, index: number): void {
  box(g, 0, .78, .72, 1.64, .12, .88, INK.wood)
  box(g, -.62, .04, .74, .38, .74, .72, INK.woodEdge)
  for (let i = 0; i < 3; i++) {
    box(g, -.62, .1 + i * .22, .365, .33, .19, .025, '#648079')
    box(g, -.62, .22 + i * .22, .342, .12, .025, .025, INK.trim)
  }
  for (const z of [.38, 1.02]) box(g, .72, .02, z, .16, .76, .16, INK.woodEdge)
  box(g, 0, .9, .87, .34, .035, .22, INK.metal)
  box(g, 0, .93, .87, .065, .20, .07, INK.metal)
  box(g, 0, 1.08, .87, .94, .58, .075, INK.metal)
  garageScreen(g, 'developer', 0, 1.37, .827, Math.PI, .86, .50)
  // A distinct pad surface and keyboard base avoid near-coplanar flicker.
  box(g, 0, .904, .46, .96, .010, .36, '#385359', false)
  box(g, 0, .918, .45, .52, .025, .19, '#b5b9af')
  cylinder(g, .54, .9, .55, .07, .15, index % 2 ? '#c39955' : '#648079')
  box(g, -.58, .9, .92, .22, .045, .18, INK.paper)
  // A full workstation reads at the room camera: substantial screen, separate tower, tactile keys.
  for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++)
    box(g, -.215 + col * .06, .944, .39 + row * .048, .043, .006, .031, '#667776')
  box(g, .51, .10, .75, .22, .52, .46, '#31464d')
  box(g, .51, .12, .512, .17, .46, .012, '#24363d')
  for (let i = 0; i < 4; i++) box(g, .51, .20 + i * .055, .502, .12, .014, .014, '#596b70')
  box(g, .51, .54, .502, .035, .026, .014, '#739891')
  box(g, 0, .71, 1.10, 1.44, .06, .045, '#5f7778')
}

/** Surface details stay within the architectural slab and authored furniture. */
export function garageSurfaceDetails(g: T.Group): void {
  // Large, low-contrast mineral slabs leave timber for furniture and platforms.
  // The narrow perimeter remainder exposes the matching substrate, not a gap.
  for (let z = -10.5, row = 0; z < 12; z += 1, row++) {
    for (let x = -12.5, col = 0; x < 16; x += 1, col++) {
      if (![[x - .5, z - .5], [x + .5, z - .5], [x + .5, z + .5], [x - .5, z + .5]].every(([px, pz]) => studioFloorContains(px, pz))) continue
      box(g, x, .004, z, .996, .008, .996, ['#aab9ba', '#adbbbb', '#acbaba'][(col + row * 2) % 3], false)
    }
  }
  // Masonry joints belong to solid wall portions, not windows or doors: here, the kitchen's wall.
  // [2026-10-05] The joints on the old back wall's south face (z = −6.372) and the plants on its sill
  // are gone from here: they were hung on the *room*, so when the wall went up through the roof at a
  // hero's arrival they stayed behind, lines and flowerpots in the air. The joints are the partition's
  // own now (`garageEnvironment`'s HERO_BAYS); the sill went with the wall it was on.
  // Plaster is clean; the inherited masonry grid was visual clutter behind heroes.
}

/**
 * The lounge's soft furnishings, **in the sofa's own frame.**
 *
 * These were authored straight into world axes off `GARAGE_FURNITURE`'s sofa
 * entry — `sofa.x + i * .87` for the cushions, `sofa.z - .97` for the rug's
 * stitching — which was correct for exactly as long as the sofa faced −z.
 * Turning it to the west wall (2026-09-14) laid three cushions and a pillow
 * *across* the thing they belong to, at right angles, which is §9.2's defect in
 * its most literal form: the shell knew which way the sofa was pointing and its
 * upholstery did not.
 *
 * So the caller passes the group `placed()` already built, and everything here
 * is local: +z is the way the sitter looks, +x runs along the seat.
 */
export function loungeDressing(g: T.Object3D, len: number): void {
  for (let i = -1; i <= 1; i++) {
    box(g, i * .87, .6, .09, .83, .07, .53, '#4d738c')
    box(g, i * .87, .77, -.16, .81, .3, .05, '#4d738c')
  }
  for (const dx of [-1.05, 1]) {
    const pillow = box(g, dx, .66, -.01, .43, .39, .16, dx < 0 ? '#c6b18d' : '#c4bca9')
    pillow.rotation.z = dx < 0 ? .13 : -.1
  }
  // Stitching along the rug, run off the sofa's own length rather than off 3.1.
  for (let i = 0; i < 12; i++) box(g, -len / 2 + i * .28, .032, .97, .016, .004, 2.4, '#b8c2b8', false)
}
