import * as T from 'three'
import { personColours, type Look } from './repo.ts'
import { HEX, glslColour } from './palette.ts'

/**
 * The legacy people, instanced: *"no feet … just a head and body hop about"*.
 * The dimensions are `studioPeople.ts`'s STUDIO_OS block figure (torso 0.43 x
 * 0.52, head 0.43 x 0.44, crown and eyes where the garage puts them) and the
 * colours are its `personColours`, so developer 4,000 in a tower is drawn by the
 * same recipe as developer 4 in the garage.
 *
 * Seated is the construction's rest pose; a standing body is the same blocks
 * lowered onto the floor (the garage's "bean"), done by the instance matrix.
 */
export const SEAT_Y = 0.66

function boxes(list: readonly (readonly number[])[]): T.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], part: number[] = [], idx: number[] = []
  let base = 0
  for (const [x, y, z, w, h, d, p] of list) {
    const g = new T.BoxGeometry(w, h, d)
    g.translate(x, y + h / 2, z)
    const gp = g.getAttribute('position'), gn = g.getAttribute('normal')
    for (let i = 0; i < gp.count; i++) {
      pos.push(gp.getX(i), gp.getY(i), gp.getZ(i)); nor.push(gn.getX(i), gn.getY(i), gn.getZ(i)); part.push(p)
    }
    const index = g.getIndex()!
    for (let i = 0; i < index.count; i++) idx.push(index.getX(i) + base)
    base += gp.count
  }
  const out = new T.BufferGeometry()
  out.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3))
  out.setAttribute('aPart', new T.Float32BufferAttribute(part, 1))
  out.setIndex(idx)
  return out
}

/** Parts: 0 shirt, 1 skin, 2 hair, 3 ink. The face is on local -z, as in the garage. */
const PERSON = boxes([
  [0, SEAT_Y, 0.04, 0.43, 0.52, 0.29, 0],
  [0, 1.18, 0, 0.43, 0.44, 0.38, 1],
  [0, 1.55, 0.026, 0.47, 0.2, 0.44, 2],
  [0, 1.32, 0.18, 0.44, 0.24, 0.075, 2],
  [-0.092, 1.38, -0.2, 0.083, 0.067, 0.02, 3],
  [0.092, 1.38, -0.2, 0.083, 0.067, 0.02, 3],
  [0, 1.23, -0.2, 0.1, 0.033, 0.02, 3],
])

/** A desk in front of the seat, a chair under it: parts 0 desk, 1 chair. */
const DESK = boxes([
  [0, 0.72, -0.62, 1.2, 0.05, 0.62, 0],
  [-0.55, 0, -0.62, 0.06, 0.72, 0.55, 0],
  [0.55, 0, -0.62, 0.06, 0.72, 0.55, 0],
  [0, 0.42, 0.02, 0.5, 0.08, 0.5, 1],
  [0, 0.5, 0.25, 0.5, 0.52, 0.07, 1],
  [0, 0.08, 0.02, 0.07, 0.34, 0.07, 1],
])

const MONITOR = boxes([[0, 0.8, -0.8, 0.54, 0.34, 0.03, 0]])

const PERSON_VERT = /* glsl */ `
  attribute float aPart;
  attribute vec3 aShirt;
  attribute vec3 aSkin;
  attribute vec3 aHair;
  attribute vec4 aAnim;
  uniform float uTime;
  varying vec3 vColour;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying float vFace;
  varying float vHi;
  void main() {
    vec3 p = position;
    // aAnim: x phase, y hop height, z screen light on the face, w highlight.
    float hop = aAnim.y * abs(sin(uTime * 7.0 + aAnim.x));
    p.y += hop;
    vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vColour = aPart < 0.5 ? aShirt : aPart < 1.5 ? aSkin : aPart < 2.5 ? aHair : vec3(0.02, 0.025, 0.03);
    vFace = (normal.z < -0.5 ? 1.0 : 0.0) * aAnim.z;
    vHi = aAnim.w;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`

const PERSON_FRAG = /* glsl */ `
  uniform vec3 uMoon;
  uniform vec3 uCam;
  uniform float uMode;
  uniform vec3 uP2;
  uniform vec3 uP3;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vColour;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying float vFace;
  varying float vHi;
  void main() {
    if (uMode > 0.5) { gl_FragColor = vec4(mix(uP2, uP3, vHi), 1.0); return; }
    vec3 N = normalize(vNormalW);
    float l = 0.38 + 0.62 * max(dot(N, uMoon), 0.0);
    vec3 c = vColour * l + vColour * ${glslColour(HEX.screen)} * vFace * 0.55 + ${glslColour(HEX.lamp)} * vColour * 0.12;
    c += ${glslColour(HEX.calm[2])} * vHi * (0.6 + 0.4 * sin(vWorld.y * 20.0));
    float fog = smoothstep(uFogNear, uFogFar, length(vWorld - uCam));
    gl_FragColor = vec4(mix(c, ${glslColour(HEX.n1)} * 0.55, fog * 0.85), 1.0);
  }`

const FURN_FRAG = /* glsl */ `
  uniform vec3 uMoon;
  uniform vec3 uCam;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uMode;
  uniform vec3 uP0;
  varying vec3 vColour;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  void main() {
    if (uMode > 0.5) { gl_FragColor = vec4(uP0 * 1.5, 1.0); return; }
    float l = 0.4 + 0.6 * max(dot(normalize(vNormalW), uMoon), 0.0);
    vec3 c = vColour * l;
    float fog = smoothstep(uFogNear, uFogFar, length(vWorld - uCam));
    gl_FragColor = vec4(mix(c, ${glslColour(HEX.n1)} * 0.55, fog * 0.85), 1.0);
  }`

const FURN_VERT = /* glsl */ `
  attribute float aPart;
  uniform vec3 uColA;
  uniform vec3 uColB;
  varying vec3 vColour;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vColour = aPart < 0.5 ? uColA : uColB;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`

export interface PeopleUniforms {
  uTime: { value: number }
  uMoon: { value: T.Vector3 }
  uCam: { value: T.Vector3 }
  uMode: { value: number }
  uP0: { value: T.Color }
  uP2: { value: T.Color }
  uP3: { value: T.Color }
  uFogNear: { value: number }
  uFogFar: { value: number }
}

export interface Crowd {
  mesh: T.InstancedMesh
  capacity: number
  count: number
  /** Place person `i`: a matrix, who they are, and how they move. */
  set(i: number, m: T.Matrix4, look: Look, hop: number, phase: number, face: number, highlight?: number): void
  setMatrix(i: number, m: T.Matrix4): void
  setHighlight(i: number, on: number): void
  commit(): void
}

export function createCrowd(capacity: number, uniforms: PeopleUniforms): Crowd {
  const geometry = new T.InstancedBufferGeometry()
  geometry.index = PERSON.index
  for (const name of ['position', 'normal', 'aPart']) geometry.setAttribute(name, PERSON.getAttribute(name))
  const shirt = new Float32Array(capacity * 3), skin = new Float32Array(capacity * 3), hair = new Float32Array(capacity * 3)
  const anim = new Float32Array(capacity * 4)
  const aShirt = new T.InstancedBufferAttribute(shirt, 3), aSkin = new T.InstancedBufferAttribute(skin, 3)
  const aHair = new T.InstancedBufferAttribute(hair, 3), aAnim = new T.InstancedBufferAttribute(anim, 4)
  for (const a of [aShirt, aSkin, aHair, aAnim]) a.setUsage(T.DynamicDrawUsage)
  geometry.setAttribute('aShirt', aShirt); geometry.setAttribute('aSkin', aSkin)
  geometry.setAttribute('aHair', aHair); geometry.setAttribute('aAnim', aAnim)
  const material = new T.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, T.IUniform>,
    vertexShader: PERSON_VERT, fragmentShader: PERSON_FRAG,
  })
  const mesh = new T.InstancedMesh(geometry, material, capacity)
  mesh.frustumCulled = false
  mesh.count = 0
  const c = new T.Color()
  const crowd: Crowd = {
    mesh, capacity, count: 0,
    set(i, m, look, hop, phase, face, highlight = 0) {
      mesh.setMatrixAt(i, m)
      const col = personColours(look)
      c.set(col.shirt); shirt.set([c.r, c.g, c.b], i * 3)
      c.set(col.skin); skin.set([c.r, c.g, c.b], i * 3)
      c.set(col.hair); hair.set([c.r, c.g, c.b], i * 3)
      anim.set([phase, hop, face, highlight], i * 4)
    },
    setMatrix(i, m) { mesh.setMatrixAt(i, m) },
    setHighlight(i, on) { anim[i * 4 + 3] = on; aAnim.needsUpdate = true },
    commit() {
      mesh.count = crowd.count
      mesh.instanceMatrix.needsUpdate = true
      aShirt.needsUpdate = true; aSkin.needsUpdate = true; aHair.needsUpdate = true; aAnim.needsUpdate = true
    },
  }
  return crowd
}

export interface Furniture {
  desks: T.InstancedMesh
  monitors: T.InstancedMesh
  slabs: T.InstancedMesh
}

export function createFurniture(capacity: number, slabCapacity: number, uniforms: PeopleUniforms): Furniture {
  const mk = (geo: T.BufferGeometry, a: string, b: string, n: number) => {
    const mat = new T.ShaderMaterial({
      uniforms: { ...(uniforms as unknown as Record<string, T.IUniform>), uColA: { value: new T.Color(a) }, uColB: { value: new T.Color(b) } },
      vertexShader: FURN_VERT, fragmentShader: FURN_FRAG,
    })
    const mesh = new T.InstancedMesh(geo, mat, n)
    mesh.frustumCulled = false
    mesh.count = 0
    return mesh
  }
  const desks = mk(DESK, HEX.wood[1], HEX.n2, capacity)
  // Monitors are light, not lit: a colour past 1.0 in the float targets is what the bloom takes.
  const monitors = new T.InstancedMesh(MONITOR, new T.MeshBasicMaterial({ color: new T.Color(HEX.screen).multiplyScalar(1.6) }), capacity)
  monitors.frustumCulled = false
  monitors.count = 0
  const slabGeo = boxes([[0, -0.12, 0, 1, 0.12, 1, 0]])
  const slabs = mk(slabGeo, HEX.n3, HEX.n3, slabCapacity)
  return { desks, monitors, slabs }
}

/**
 * Where the desks go on one storey `w` x `d` holding `per` people: pods of four,
 * two facing two, in a block centred on the floor (the garage's own pods, §7.8.0).
 * Returns local x, z and the yaw that turns a seated person to their desk.
 */
export function floorLayout(w: number, d: number, per: number): { x: number; z: number; yaw: number }[] {
  const pods = Math.ceil(per / 4)
  const cols = Math.max(1, Math.min(pods, Math.round(Math.sqrt(pods * (w / d) * (5.0 / 4.2)))))
  const rows = Math.ceil(pods / cols)
  const px = Math.min(4.2, (w - 3) / cols)
  const pz = Math.min(5.0, (d - 3) / rows)
  const out: { x: number; z: number; yaw: number }[] = []
  for (let k = 0; k < per; k++) {
    const pod = Math.floor(k / 4), slot = k % 4
    const cx = (pod % cols - (cols - 1) / 2) * px
    const cz = (Math.floor(pod / cols) - (rows - 1) / 2) * pz
    const sx = slot % 2 === 0 ? -0.66 : 0.66
    const front = slot < 2
    out.push({ x: cx + sx, z: cz + (front ? -1.2 : 1.2), yaw: front ? Math.PI : 0 })
  }
  return out
}
