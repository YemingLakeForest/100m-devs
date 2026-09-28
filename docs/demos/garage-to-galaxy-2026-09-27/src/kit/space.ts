import * as T from 'three'
import { HEX } from './palette.ts'
import { rnd } from './grid.ts'

/**
 * Space, at the planet's toy scale (grid.ts): a far star field for depth, and
 * Proxima's red sun. The top of the ladder is the colony network (network.ts,
 * netview.ts), not a galaxy — the user, 2026-09-27: *"the milky way is good but
 * it's kind of unnecssary details for us at this point"*.
 */
export interface Space {
  group: T.Group
  sky: T.Points
  proxima: T.Mesh
  uniforms: { uMode: { value: number }; uP1: { value: T.Color }; uP2: { value: T.Color }; uP3: { value: T.Color }; uScale: { value: number }; uDim: { value: number } }
}

const PT_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColour;
  uniform float uScale;
  uniform float uMode;
  varying vec3 vColour;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float size = aSize * uScale / max(1.0, -mv.z);
    gl_PointSize = uMode > 0.5 ? clamp(size / 3.0, 1.0, 2.0) : clamp(size, 1.2, 6.0);
    vColour = aColour;
    gl_Position = projectionMatrix * mv;
  }`
const PT_FRAG = /* glsl */ `
  uniform float uMode;
  uniform float uDim;
  uniform vec3 uP1;
  uniform vec3 uP2;
  varying vec3 vColour;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (uMode > 0.5) { gl_FragColor = vec4((uP1 * 0.8 + uP2 * 0.15 * dot(vColour, vec3(0.33))) * uDim, 1.0); return; }
    float r = length(c);
    float a = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vColour * (0.6 + 0.8 * smoothstep(0.25, 0.0, r)) * a * uDim, a);
  }`

export function createSpace(sky: T.Scene, proximaAt: T.Vector3): Space {
  const uniforms: Space['uniforms'] = {
    uMode: { value: 0 }, uP1: { value: new T.Color(HEX.calm[1]) }, uP2: { value: new T.Color(HEX.calm[2]) },
    uP3: { value: new T.Color(HEX.calm[3]) }, uScale: { value: 2.5e8 }, uDim: { value: 1 },
  }
  const group = new T.Group()
  const tints = [HEX.n8, HEX.n7, HEX.warn[3], HEX.calm[3], HEX.alarm[3]]
  // The far stars, on the sky's own sphere: they never get closer.
  const n = 5000
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n)
  const c = new T.Color()
  for (let i = 0; i < n; i++) {
    const z = rnd(i, 21) * 2 - 1, t = rnd(i, 22) * Math.PI * 2, r = Math.sqrt(1 - z * z)
    pos.set([r * Math.cos(t) * 1e8, z * 1e8, r * Math.sin(t) * 1e8], i * 3)
    c.set(tints[Math.floor(rnd(i, 23) * tints.length)]).multiplyScalar(0.35 + rnd(i, 24) * 0.5)
    col.set([c.r, c.g, c.b], i * 3)
    size[i] = 0.6 + rnd(i, 25) * 1.4
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.BufferAttribute(pos, 3))
  g.setAttribute('aColour', new T.BufferAttribute(col, 3))
  g.setAttribute('aSize', new T.BufferAttribute(size, 1))
  const skyPts = new T.Points(g, new T.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, T.IUniform>, vertexShader: PT_VERT, fragmentShader: PT_FRAG,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
  }))
  skyPts.frustumCulled = false
  sky.add(skyPts)

  // Proxima Centauri itself: a small red sun beside James's world.
  const proxima = new T.Mesh(new T.SphereGeometry(1400, 32, 16), new T.MeshBasicMaterial({ color: new T.Color(HEX.alarm[2]).multiplyScalar(2.2) }))
  proxima.position.copy(proximaAt)
  group.add(proxima)
  return { group, sky: skyPts, proxima, uniforms }
}

/** The filing cabinet James rides to Proxima b (§21.8: "it was already the right shape"). */
export function filingCabinet(): T.Group {
  const g = new T.Group()
  // Unlit: in space nothing lights it but its own flame.
  const grey = new T.MeshBasicMaterial({ color: HEX.n6 })
  const dark = new T.MeshBasicMaterial({ color: HEX.n3 })
  const body = new T.Mesh(new T.BoxGeometry(0.7, 1.4, 0.75), grey)
  body.position.y = 0.7
  g.add(body)
  for (let i = 0; i < 4; i++) {
    const drawer = new T.Mesh(new T.BoxGeometry(0.62, 0.02, 0.02), dark)
    drawer.position.set(0, 0.34 + i * 0.33, 0.38)
    g.add(drawer)
    const handle = new T.Mesh(new T.BoxGeometry(0.16, 0.04, 0.04), dark)
    handle.position.set(0, 0.22 + i * 0.33, 0.39)
    g.add(handle)
  }
  const flame = new T.Mesh(new T.ConeGeometry(0.28, 1.1, 10), new T.MeshBasicMaterial({ color: new T.Color(HEX.warn[2]).multiplyScalar(3) }))
  flame.rotation.x = Math.PI
  flame.position.y = -0.55
  flame.name = 'flame'
  g.add(flame)
  return g
}
