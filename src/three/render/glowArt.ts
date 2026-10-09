/**
 * Things that give light, drawn — GDD §7.8.0c [amended 2026-10-05, at the user's instruction: *"make brighter and
 * don't have the screens to be only light emitter, the company sign needs to be light up too"*].
 *
 * The garage was a dark room lit by its own screens. It still has its screens, and now has the rest of what a lit
 * room has: lamps you can see, light you can see *falling* — a pool of it on a floor, a wash of it up a wall — and
 * a sign that is lit rather than painted. None of this adds a light to the scene: every real light in the scene is
 * something every material in the room pays for, per pixel. [2026-10-08] The OS studio skips these additive
 * pools and washes to preserve consistent material colours; its visible lamp faces are restrained. [2026-10-07] The HQ uses the shared sky/key/fill rig,
 * with no monitor or ceiling point lights. A pool is a soft additive disc laid just above the floor, a wash the same stood
 * against a wall; they cost one draw each and are what a lamp *looks* like it is doing.
 */
import * as T from 'three'
import { OS_SKIN } from '../art/skin.ts'
import { box, cylinder, sharedMaterial } from './worldArt.ts'

/** Canvas drawing exists in a browser and not under jsdom, where these are built bare. */
const canDraw = () => typeof document !== 'undefined' && !/jsdom/i.test(navigator.userAgent)

let falloff: T.CanvasTexture | null = null
/** One soft white disc, fading to nothing at the rim: the shape of light falling on a plane. */
function falloffMap(): T.CanvasTexture | null {
  if (!falloff && canDraw()) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    if (g) {
      const fall = g.createRadialGradient(64, 64, 4, 64, 64, 62)
      fall.addColorStop(0, 'rgba(255,255,255,1)'); fall.addColorStop(0.5, 'rgba(255,255,255,0.4)'); fall.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = fall; g.fillRect(0, 0, 128, 128)
      falloff = new T.CanvasTexture(c)
      falloff.colorSpace = T.SRGBColorSpace
    }
  }
  return falloff
}

const glowMaterial = (colour: string, strength: number) => {
  // §7.8.12 [2026-10-08]: coloured additive pools bleach local material colours.
  if (OS_SKIN) return null
  const map = falloffMap()
  return map ? sharedMaterial(`glow:${colour}:${strength}`, () => new T.MeshBasicMaterial({
    map, color: colour, transparent: true, opacity: strength, blending: T.AdditiveBlending, depthWrite: false,
  })) : null
}

/**
 * **A pool of light on the floor**: an additive disc laid just above it, `w` by `d` metres, in the colour of whatever
 * is lighting it. Skipped where there is no canvas to draw the falloff on.
 */
export function pool(parent: T.Object3D, x: number, z: number, w: number, d: number, colour: string, strength: number, y = 0.035): T.Mesh | null {
  const material = glowMaterial(colour, strength)
  if (!material) return null
  const m = new T.Mesh(new T.PlaneGeometry(1, 1), material)
  m.rotation.x = -Math.PI / 2
  m.position.set(x, y, z)
  m.scale.set(w, d, 1)
  m.userData.dynamic = true
  parent.add(m)
  return m
}

/**
 * **A wash of light on a wall**: the same disc stood up against a wall's face, `w` wide and `h` tall, centred at
 * height `y` — what a sconce or a wall-washer does to plaster. `yaw` turns it to the wall (0 faces +z, the north
 * wall's inner face; π/2 faces +x, the west one's); it stands 2 cm off the face.
 */
export function wash(parent: T.Object3D, x: number, y: number, z: number, w: number, h: number, yaw: number, colour: string, strength: number): T.Mesh | null {
  const material = glowMaterial(colour, strength)
  if (!material) return null
  const m = new T.Mesh(new T.PlaneGeometry(1, 1), material)
  m.position.set(x, y, z)
  m.rotation.y = yaw
  m.scale.set(w, h, 1)
  m.userData.dynamic = true
  parent.add(m)
  return m
}

/** A shared unlit material in a colour: a lamp's shade, a letter's face. It is what *is* the light, so nothing lights it. */
export const emissive = (colour: string): T.MeshBasicMaterial => sharedMaterial(`emissive:${colour}`, () => new T.MeshBasicMaterial({ color: new T.Color(colour).multiplyScalar(OS_SKIN ? .60 : 1) }))

/** A box that glows: not batched (it is dynamic), unlit. */
export function lamp(parent: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, colour: string): T.Mesh {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), emissive(colour))
  m.position.set(x, y + h / 2, z)
  m.userData.dynamic = true
  parent.add(m)
  return m
}

/**
 * **A standing lamp**: a weighted foot, a pole, and a drum shade that is the light — 1.9 m tall, with its pool at its
 * foot and a halo against whatever is behind it. Built in its own group so that it can be turned and placed.
 */
export function standingLamp(parent: T.Object3D, x: number, z: number, colour = '#ffd68c', y = 0): T.Group {
  const g = new T.Group()
  g.position.set(x, y, z)
  parent.add(g)
  cylinder(g, 0, 0, 0, 0.16, 0.05, '#2b2f2e')
  cylinder(g, 0, 0.05, 0, 0.025, 1.6, '#2b2f2e')
  const shade = new T.Mesh(new T.CylinderGeometry(0.2, 0.26, 0.36, 10, 1, true), sharedMaterial(`drum:${colour}`, () => new T.MeshBasicMaterial({ color: colour, side: T.DoubleSide })))
  shade.position.y = 1.78
  shade.userData.dynamic = true
  g.add(shade)
  lamp(g, 0, 1.6, 0, 0.12, 0.05, 0.12, '#fff3d0')
  pool(g, 0, 0, 2.4, 2.4, colour, 0.34)
  return g
}

const DRUM = new T.CylinderGeometry(1, 1, 1, 8)

/** An eight-sided drum that glows — a lantern's glass, as round as anything is in this room. Unlit, and not batched. */
function glowDrum(parent: T.Object3D, x: number, y: number, z: number, radius: number, h: number, colour: string): T.Mesh {
  const m = new T.Mesh(DRUM, emissive(colour))
  m.position.set(x, y + h / 2, z)
  m.scale.set(radius, h, radius)
  m.userData.dynamic = true
  parent.add(m)
  return m
}

/**
 * **A wall sconce**: a plate, a lantern on an arm with a dark cap above it and below, and the light it throws — a wash up
 * the plaster and a smaller one down it. `y` is the middle of the lantern; `yaw` faces it as {@link wash} does. (The
 * first cut was one lit box on a bracket, and on a pale wall it read as a white cube stuck to it.)
 */
export function sconce(parent: T.Object3D, x: number, y: number, z: number, yaw: number, colour = '#f3d79a'): T.Group {
  const g = new T.Group()
  g.position.set(x, y, z)
  g.rotation.y = yaw
  parent.add(g)
  box(g, 0, -0.3, 0.02, 0.16, 0.6, 0.04, '#2b2f2e')
  box(g, 0, -0.04, 0.07, 0.05, 0.05, 0.12, '#2b2f2e')
  glowDrum(g, 0, -0.2, 0.16, 0.1, 0.4, colour)
  cylinder(g, 0, 0.2, 0.16, 0.13, 0.04, '#2b2f2e')
  cylinder(g, 0, -0.24, 0.16, 0.13, 0.04, '#2b2f2e')
  wash(g, 0, 1.0, 0.03, 1.4, 2.2, 0, colour, 0.2)
  wash(g, 0, -0.85, 0.03, 1.1, 1.2, 0, colour, 0.12)
  return g
}
