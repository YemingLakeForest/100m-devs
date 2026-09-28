import * as T from 'three'
import { HEX } from './palette.ts'

/**
 * **Option D: the ladder as nested dioramas.** The same world, shown one rung
 * at a time: whatever is outside the rung's radius is simply not drawn, and the
 * rung stands on a plinth in the dark, the way the legacy tower and globe stood
 * alone on the screen. Zooming past a rung's edge surfaces to the next one up
 * (the doll opens and its siblings come out of the dark); zooming into anything
 * dives into it, and that unit becomes the diorama. It is GDD §7.4a's lens —
 * discrete stops, every stop an addressable unit — drawn in 3D.
 */
export interface Rung { id: string; label: string; caption: string; radius: number; min: number; max: number; rest: number }

export const RUNGS: readonly Rung[] = [
  { id: 'garage', label: 'G  GARAGE', caption: 'the room: every desk is a person', radius: 30, min: 8, max: 80, rest: 44 },
  { id: 'block', label: '1  HQ BLOCK', caption: 'the garage and the plots round it', radius: 66, min: 40, max: 240, rest: 150 },
  { id: 'district', label: '2  DISTRICT', caption: 'nine blocks: every window is a person', radius: 190, min: 140, max: 700, rest: 440 },
  { id: 'city', label: '3  CITY', caption: 'the sprawl, as far as it goes', radius: 1150, min: 500, max: 3600, rest: 2500 },
  { id: 'planet', label: '4  PLANET', caption: 'the whole world, full at 100,000,000', radius: 1e9, min: 2600, max: 45000, rest: 17000 },
  // The top of the ladder is the colony map, not a galaxy (the user, 2026-09-27).
  { id: 'network', label: '5  NETWORK', caption: 'the colony map: one glyph is one world of 100,000,000', radius: 1e9, min: 40000, max: 1.1e7, rest: 2.2e6 },
]

const CLIP = /* glsl */ `
  if (uClip.w < 1.0e8) {
    vec3 cd = vWorldClip - uClip.xyz;
    float along = dot(cd, uClipUp);
    if (length(cd - uClipUp * along) > uClip.w) discard;
  }`

export interface Plinth {
  ring: T.Group
  uniform: { uClip: { value: T.Vector4 }; uClipUp: { value: T.Vector3 } }
  /** Add the clip to one of the demos' own shaders (they all carry `vWorld`). */
  patch(m: T.ShaderMaterial): void
  set(centre: T.Vector3, up: T.Vector3, radius: number, dt: number): void
}

export function createPlinth(): Plinth {
  const uniform = { uClip: { value: new T.Vector4(0, 0, 0, 1e9) }, uClipUp: { value: new T.Vector3(0, 1, 0) } }
  const ring = new T.Group()
  // The plinth: a phosphor rim just outside the cut, and a dark drum under it,
  // the way the upgrade trees stand their nodes on iso plinths (§11.4).
  const rim = new T.Mesh(new T.RingGeometry(1.0, 1.018, 256, 1), new T.MeshBasicMaterial({ color: new T.Color(HEX.calm[2]).multiplyScalar(1.8), side: T.DoubleSide }))
  rim.rotation.x = -Math.PI / 2
  rim.position.y = 0.004
  ring.add(rim)
  const skirt = new T.Mesh(new T.CylinderGeometry(1.018, 1.018, 1, 256, 1, true), new T.MeshBasicMaterial({ color: new T.Color(HEX.n1).multiplyScalar(0.8), side: T.DoubleSide }))
  skirt.position.y = -0.5
  ring.add(skirt)
  const foot = new T.Mesh(new T.RingGeometry(1.0, 1.018, 256, 1), new T.MeshBasicMaterial({ color: new T.Color(HEX.calm[1]), side: T.DoubleSide }))
  foot.rotation.x = -Math.PI / 2
  foot.name = 'foot'
  ring.add(foot)
  const floor = new T.Mesh(new T.CircleGeometry(1.0, 256), new T.MeshBasicMaterial({ color: new T.Color(HEX.n1).multiplyScalar(0.6), side: T.DoubleSide }))
  floor.rotation.x = -Math.PI / 2
  floor.name = 'floor'
  ring.add(floor)
  let shown = 30
  return {
    ring, uniform,
    patch(m) {
      m.uniforms.uClip = uniform.uClip
      m.uniforms.uClipUp = uniform.uClipUp
      m.fragmentShader = 'uniform vec4 uClip;\nuniform vec3 uClipUp;\n' + m.fragmentShader
        .replace(/varying vec3 vWorld;/, 'varying vec3 vWorld;\n#define vWorldClip vWorld')
        .replace('void main() {', 'void main() {' + CLIP)
      m.needsUpdate = true
    },
    set(centre, up, radius, dt) {
      // The plinth opens and closes in log space: a rung is ten times the one
      // below, so equal steps of the ratio read as equal steps of the ladder.
      if (radius >= 1e8) shown = 1e9
      else {
        if (shown > radius * 20) shown = radius * 20
        shown = Math.exp(Math.log(shown) + (Math.log(radius) - Math.log(shown)) * Math.min(1, dt * 7))
      }
      const on = shown < 5e4 && radius < 1e8
      uniform.uClip.value.set(centre.x, centre.y, centre.z, on ? shown : 1e9)
      uniform.uClipUp.value.copy(up)
      ring.visible = on
      if (!on) return
      ring.position.copy(centre)
      ring.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), up)
      const depth = Math.max(4, shown * 0.08)
      ring.scale.set(shown, depth, shown)
      ring.getObjectByName('foot')!.position.y = -1
      ring.getObjectByName('floor')!.position.y = -1
    },
  }
}

/**
 * The same clip, injected into the garage's own materials (the game's
 * MeshStandardMaterials), so the room is cut by the plinth like everything else.
 */
export function clipMaterials(root: T.Object3D, uniform: Plinth['uniform']): void {
  const done = new Set<T.Material>()
  root.traverse((o) => {
    const mats = (o as T.Mesh).material
    if (!mats) return
    for (const mat of Array.isArray(mats) ? mats : [mats]) {
      if (done.has(mat)) continue
      done.add(mat)
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uClip = uniform.uClip
        shader.uniforms.uClipUp = uniform.uClipUp
        shader.vertexShader = 'varying vec3 vWorldClip;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
          vec4 clipW = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            clipW = instanceMatrix * clipW;
          #endif
          vWorldClip = (modelMatrix * clipW).xyz;`)
        shader.fragmentShader = 'uniform vec4 uClip;\nuniform vec3 uClipUp;\nvarying vec3 vWorldClip;\n' + shader.fragmentShader.replace('void main() {', 'void main() {' + CLIP)
      }
      mat.needsUpdate = true
    }
  })
}
