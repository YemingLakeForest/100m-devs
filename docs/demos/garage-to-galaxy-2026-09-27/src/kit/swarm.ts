import * as T from 'three'
import { FLOOR_H } from './grid.ts'
import { HEX, glslColour, STATE_COLOURS } from './palette.ts'
import type { Breakdown } from './repo.ts'

/**
 * **Option C: the swarm is the picture.** Past the street, the buildings go to
 * outlines and what is drawn is the people: one dot per developer, at their
 * desk, on their storey, coloured by what they are doing right now (the seven
 * loss slices). A city is a cloud of people in the shape of towers; a planet is
 * a crust of them. New hires fall in from above.
 *
 * A dot is exactly one developer up to `max` of them. Past that, one dot is
 * every `stride`-th seat — seat 0, k, 2k … — so a dot is still a specific
 * person you can name, and the scale bar says how many it stands for (§7.7.5:
 * "never a silent unit change").
 */
export interface SwarmSource {
  S: { name: string; count: number; w: Float32Array; d: Float32Array; per: Float32Array; seed: Float32Array; seatBase: Float64Array; offset: number; parent: T.Object3D; base: T.Matrix4[] }
  occ: Float32Array
}

export interface Swarm {
  points: T.Points
  stride: number
  dirty: boolean
  update(sources: SwarmSource[], n: number, bd: Breakdown, cdfA: T.Vector4, cdfB: T.Vector4, dt: number, t: number, camera: T.Camera): void
}

const VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aLocal;
  attribute float aBirth;
  uniform float uTime;
  uniform float uScale;
  uniform vec4 uCdfA;
  uniform vec4 uCdfB;
  uniform vec3 uStates[8];
  varying vec3 vColour;
  float seatHash(float seed, float local, float ch) {
    uint h = uint(seed) * 747796405u + uint(local) * 2891336453u + uint(ch) * 1597334677u;
    h ^= h >> 16u; h *= 0x7feb352du; h ^= h >> 15u; h *= 0x846ca68bu; h ^= h >> 16u;
    return float(h) / 4294967295.0;
  }
  vec3 stateColour(float r) {
    if (r < uCdfA.x) return uStates[0];
    if (r < uCdfA.y) return uStates[1];
    if (r < uCdfA.z) return uStates[2];
    if (r < uCdfA.w) return uStates[3];
    if (r < uCdfB.x) return uStates[4];
    if (r < uCdfB.y) return uStates[5];
    if (r < uCdfB.z) return uStates[6];
    return uStates[7];
  }
  void main() {
    vec3 p = position;
    float age = uTime - aBirth;
    if (age < 0.9) p += normalize(p) * pow(1.0 - age / 0.9, 2.0) * 160.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(1.3 * uScale / max(1.0, -mv.z), 1.6, 5.0);
    float bucket = floor(uTime / 20.0 + seatHash(aSeed, aLocal, 3.0));
    vColour = stateColour(seatHash(aSeed, aLocal, 10.0 + mod(bucket, 1000.0))) * (age < 0.9 ? 2.4 : 1.35);
    gl_Position = projectionMatrix * mv;
  }`
const FRAG = /* glsl */ `
  varying vec3 vColour;
  void main() { gl_FragColor = vec4(vColour, 1.0); }`

export function createSwarm(max: number): Swarm {
  const pos = new Float32Array(max * 3), seed = new Float32Array(max), local = new Float32Array(max), birth = new Float32Array(max).fill(-10)
  const g = new T.BufferGeometry()
  const aPos = new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage)
  const aSeed = new T.BufferAttribute(seed, 1).setUsage(T.DynamicDrawUsage)
  const aLocal = new T.BufferAttribute(local, 1).setUsage(T.DynamicDrawUsage)
  const aBirth = new T.BufferAttribute(birth, 1).setUsage(T.DynamicDrawUsage)
  g.setAttribute('position', aPos); g.setAttribute('aSeed', aSeed); g.setAttribute('aLocal', aLocal); g.setAttribute('aBirth', aBirth)
  g.setDrawRange(0, 0)
  const uniforms = {
    uTime: { value: 0 }, uScale: { value: 900 },
    uCdfA: { value: new T.Vector4() }, uCdfB: { value: new T.Vector4() },
    uStates: { value: STATE_COLOURS.map((c) => c.clone()) },
  }
  const points = new T.Points(g, new T.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG }))
  points.frustumCulled = false
  points.visible = false
  void glslColour; void HEX

  let count = 0
  let upTo = 0
  const v = new T.Vector3(), m = new T.Matrix4()
  const swarm: Swarm = {
    points, stride: 1, dirty: true,
    update(sources, n, _bd, cdfA, cdfB, _dt, t, camera) {
      uniforms.uTime.value = t
      uniforms.uCdfA.value.copy(cdfA); uniforms.uCdfB.value.copy(cdfB)
      const cam = camera as T.PerspectiveCamera
      uniforms.uScale.value = 900 * (cam.fov ? 24 / cam.fov : 1)
      if (!swarm.dirty) return
      swarm.dirty = false
      const stride = Math.max(1, Math.ceil(n / max))
      let from = 0
      if (stride !== swarm.stride || n < upTo) { count = 0; upTo = 0; swarm.stride = stride }
      else from = upTo
      const fresh = from > 0
      const first = count
      // Walk the seats this dot grid covers, from where the last update stopped.
      for (const src of sources) {
        const S = src.S
        if (S.offset !== 0) continue
        let k = 0
        let mk = -1
        for (let s = Math.ceil(from / stride) * stride; s < n && count < max; s += stride) {
          if (s < S.seatBase[0]) continue
          while (k < S.count - 1 && S.seatBase[k + 1] <= s) k++
          const j = s - S.seatBase[k]
          // The plots are a short list with an end; past the last one, the planet's set has the seat.
          if (S.name === 'lots' && j >= src.occ[k]) { if (k === S.count - 1) break; continue }
          const per = S.per[k], w = S.w[k], d = S.d[k]
          const floor = Math.floor(j / per), i = j % per
          const cols = Math.max(1, Math.ceil(Math.sqrt(per * (w / d))))
          const rows = Math.ceil(per / cols)
          // People are not on a lattice: each is somewhere in their cell of the floor.
          const jx = (((j * 2654435761) >>> 0) % 1000) / 1000 - 0.5, jz = (((j * 2246822519) >>> 0) % 1000) / 1000 - 0.5
          v.set((((i % cols) + 0.5 + jx * 0.9) / cols - 0.5) * (w - 4), floor * FLOOR_H + 1.2, ((Math.floor(i / cols) + 0.5 + jz * 0.9) / rows - 0.5) * (d - 4))
          if (mk !== k) { m.multiplyMatrices(S.parent.matrixWorld, S.base[k]); mk = k }
          v.applyMatrix4(m)
          pos[count * 3] = v.x; pos[count * 3 + 1] = v.y; pos[count * 3 + 2] = v.z
          seed[count] = S.seed[k]; local[count] = j; birth[count] = fresh ? t + Math.random() * 0.3 : -10
          count++
        }
      }
      upTo = n
      g.setDrawRange(0, count)
      if (count > first) {
        for (const [a, size] of [[aPos, 3], [aSeed, 1], [aLocal, 1], [aBirth, 1]] as const) {
          a.clearUpdateRanges()
          a.addUpdateRange(first * size, (count - first) * size)
          a.needsUpdate = true
        }
      }
    },
  }
  return swarm
}
