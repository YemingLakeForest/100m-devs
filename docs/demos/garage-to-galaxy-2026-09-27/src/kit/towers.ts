import * as T from 'three'
import { FLOOR_H, WIN } from './grid.ts'
import { HEX, glslColour, STATE_COLOURS } from './palette.ts'

/**
 * **A window is a seat.** Every tower is one instance of a two-segment box, and
 * its fragment shader numbers the windows floor by floor, face by face, lighting
 * window `s` if seat `s` of that tower is filled. The picture is not a texture
 * of "a lit city": it is the headcount, one developer per window, and the
 * frontier tower is the one that is half lit.
 *
 * A tower is exactly as tall as its occupied storeys (§7.7.2): a storey exists
 * once its first seat does. The box is built as two segments — everything below
 * the top storey, and the top storey — so the top one can **fall out of the sky
 * and land** (`drop`, metres above its resting place) and the whole building can
 * squash and settle (`squash`) when it does.
 *
 * `open` (0..1) takes the roof and the top storey's walls down to a parapet, the
 * garage's own cutaway, so the camera can look in at the people up there.
 * `xray` (0..1) draws a tower as its outline, for the one standing between the
 * lens and whoever it is looking at.
 *
 * `uMode` draws the same towers three ways: 0 lit (the world), 1 phosphor (the
 * monitor: flat isometric faces in the live interface hue, windows as pixel
 * dots, ART_DIRECTION §1.1's four values), 2 outline.
 */
export interface TowerSpec {
  count: number
  pos: Float32Array
  quat: Float32Array
  w: Float32Array
  d: Float32Array
  floors: Float32Array
  perFloor: Float32Array
  seed: Float32Array
  /** 0 office, 1 plot building by the garage, 2 marker (the garage glyph on the monitor). */
  kind?: Float32Array
}

export interface TowerMesh {
  mesh: T.InstancedMesh
  count: number
  /** Occupied seats drawn per tower (a drop can lag the headcount); `commit` after writing. */
  occ: Float32Array
  /** Occupied seats the headcount says, which `occ` catches up to. */
  target: Float32Array
  /** The dollhouse cut, metres above the tower's base: 0 is a closed roof. */
  open: Float32Array
  drop: Float32Array
  squash: Float32Array
  xray: Float32Array
  /** Upload occupancy for towers `from .. to - 1`. */
  commit(from?: number, to?: number): void
  /** Mark a tower's open / drop / squash / xray as changed; `flush` uploads the marked ones. */
  touch(k: number): void
  flush(): void
}

const VERT = /* glsl */ `
  attribute float aSeg;
  attribute vec4 aDims;
  attribute vec4 aOcc;
  attribute vec4 aAnim;
  uniform float uFloorH;
  uniform float uPxScale;
  uniform vec3 uCam;
  varying vec3 vLocal;
  varying vec3 vNormalL;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying vec4 vDims;
  varying vec4 vOcc;
  varying vec4 vAnim;
  varying float vBuilt;
  void main() {
    float per = aDims.w;
    float built = aOcc.w > 1.5 ? aDims.z : min(aDims.z, ceil(aOcc.x / per - 0.0001));
    // A tower smaller than a couple of pixels is not drawn as a tower: it sinks
    // into the ground, whose block average says the same thing without shimmer.
    vec3 baseW = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float px = max(aDims.x, aDims.y) * uPxScale / max(1.0, distance(baseW, uCam));
    float keep = aOcc.w > 1.5 ? 1.0 : smoothstep(2.5, 6.0, px);
    float lower = max(0.0, built - 1.0) * uFloorH * keep;
    float top = (built * uFloorH + 0.6) * keep;
    float y = aSeg < 0.5 ? position.y * 2.0 * lower : lower + (position.y - 0.5) * 2.0 * (top - lower);
    vec3 local = vec3(position.x * aDims.x, y, position.z * aDims.y);
    if ((aOcc.x <= 0.0 && aOcc.w < 1.5) || keep < 0.01) local = vec3(0.0);
    vLocal = local;
    float squash = aAnim.y;
    vec3 shaped = vec3(local.x / sqrt(squash), local.y * squash + (aSeg > 0.5 ? aAnim.x : 0.0), local.z / sqrt(squash));
    vNormalL = normal;
    vec4 world = modelMatrix * instanceMatrix * vec4(shaped, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vDims = aDims;
    vOcc = aOcc;
    vAnim = aAnim;
    vBuilt = built;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFloorH;
  uniform float uWin;
  uniform vec3 uMoon;
  uniform vec3 uCam;
  uniform vec3 uCamRight;
  uniform float uLoss;
  uniform vec4 uCdfA;
  uniform vec4 uCdfB;
  uniform vec3 uStates[8];
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uMode;
  uniform vec3 uP0;
  uniform vec3 uP1;
  uniform vec3 uP2;
  uniform vec3 uP3;
  varying vec3 vLocal;
  varying vec3 vNormalL;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying vec4 vDims;
  varying vec4 vOcc;
  varying vec4 vAnim;
  varying float vBuilt;

  float hash(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
  // The same integer hash as seatHash() in state.ts, so the loss view's colour
  // for a window is the state the person card reports for that developer.
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

  // The light behind one window: a desk lamp or a monitor, or in the loss view
  // what that developer is doing instead of working. States turn over every
  // twenty seconds, each seat on its own offset.
  vec3 windowLight(float seat, float seed) {
    float r = seatHash(seed, seat, 1.0);
    float v = seatHash(seed, seat, 2.0);
    // A night facade: warm desk lamps, some monitors, and one window in eight
    // dark because whoever sits there is somewhere else (§18's away share).
    vec3 c = r < 0.62 ? ${glslColour(HEX.lamp)} * (0.32 + 0.3 * v)
      : r < 0.88 ? ${glslColour(HEX.screen)} * (0.38 + 0.35 * v)
      : ${glslColour(HEX.n1)} * 0.5;
    float bucket = floor(uTime / 20.0 + seatHash(seed, seat, 3.0));
    vec3 s = stateColour(seatHash(seed, seat, 10.0 + mod(bucket, 1000.0))) * 0.8;
    return mix(c, s, uLoss);
  }

  void outline(float strong, float faint, float fog, vec3 tint) {
    float lw = max(fwidth(strong) * 1.2, 0.03);
    float lf = max(fwidth(faint) * 1.2, 0.03);
    float a = (1.0 - smoothstep(lw, lw * 2.0, strong)) + 0.35 * (1.0 - smoothstep(lf, lf * 2.0, faint));
    a = min(a, 1.0) * (1.0 - fog * 0.85);
    if (a < 0.02) discard;
    gl_FragColor = vec4(tint * a, a);
  }

  void main() {
    vec3 nL = vNormalL;
    float kind = vOcc.w;
    float per = vDims.w;
    float occ = kind > 1.5 ? 1e9 : vOcc.x;
    float open = vOcc.z;
    float built = vBuilt;
    float roofY = built * uFloorH;
    float y = vLocal.y;
    bool side = abs(nL.y) < 0.5;
    float w = vDims.x, d = vDims.y;
    // The garage's glyph exists only on the monitor; in the world the garage is the garage.
    if (kind > 1.5 && uMode < 0.5) discard;

    // The dollhouse: everything above the cut goes, down to a parapet on the
    // storey being looked into. The cut follows the eye down a tall tower.
    if (open > 0.01 && y > open && uMode < 0.5) discard;

    float dist = length(vWorld - uCam);
    float fog = smoothstep(uFogNear, uFogFar, dist);
    float edgeU = abs(nL.x) > 0.5 ? d * 0.5 - abs(vLocal.z) : w * 0.5 - abs(vLocal.x);
    float rim = min(w * 0.5 - abs(vLocal.x), d * 0.5 - abs(vLocal.z));
    float storey = abs(fract(y / uFloorH + 0.5) - 0.5) * uFloorH;

    if (uMode > 1.5 || (vAnim.z > 0.5 && uMode < 0.5)) {
      outline(side ? min(edgeU, abs(roofY + 0.6 - y)) : rim, side ? storey : 1e3, fog, ${glslColour(HEX.calm[1])});
      return;
    }

    // Window grid, shared by the lit and the phosphor drawings.
    float nx = max(1.0, floor(w / uWin)), nz = max(1.0, floor(d / uWin));
    float u, faceW, nWin, offset;
    if (abs(nL.x) > 0.5) {
      faceW = d; nWin = nz; u = vLocal.z + d * 0.5;
      offset = nL.x > 0.0 ? nx : 2.0 * nx + nz;
      if (nL.x < 0.0) u = d - u;
    } else {
      faceW = w; nWin = nx; u = vLocal.x + w * 0.5;
      offset = nL.z > 0.0 ? 0.0 : nx + nz;
      if (nL.z < 0.0) u = w - u;
    }
    float cx = u / faceW * nWin;
    float fl = floor(y / uFloorH);
    float fy = fract(y / uFloorH);
    float fx = fract(cx);
    float seat = fl * per + offset + min(floor(cx), nWin - 1.0);
    bool inWin = side && fx > 0.13 && fx < 0.87 && fy > 0.24 && fy < 0.84 && y < roofY;
    bool on = seat < occ;
    float px = max(fwidth(cx), fwidth(y / uFloorH));
    float floorLit = clamp((occ - fl * per) / per, 0.0, 1.0);
    float towerLit = clamp(occ / max(1.0, built * per), 0.0, 1.0);
    float share = mix(floorLit, towerLit, smoothstep(0.9, 2.2, px));

    if (uMode > 0.5) {
      // The monitor: three flat values for three faces, the building's edge in
      // the brightest, and a lit window as a single bright pixel.
      vec3 N = normalize(vNormalW);
      vec3 face = !side ? uP1 : (dot(N, uCamRight) > 0.0 ? uP0 * 1.4 : uP1 * 0.7);
      float edge = side ? min(edgeU, abs(roofY + 0.6 - y)) : rim;
      float ew = max(fwidth(edge) * 1.1, 0.05);
      // An edge is a line only while the face is several pixels across; on a
      // speck of a building it would be the whole building, and wash it out.
      float faceSpan = min(w, d) / max(fwidth(vLocal.x) + fwidth(vLocal.z), 1e-4);
      float e = (1.0 - smoothstep(ew, ew * 2.0, edge)) * smoothstep(3.0, 8.0, faceSpan);
      vec3 dots = inWin && on ? uP2 : face;
      vec3 far = face + (uP2 - face) * share * 0.55;
      vec3 c = mix(dots, far, smoothstep(0.3, 0.75, px));
      c = mix(c, uP3, e * 0.85);
      if (kind > 1.5) c = !side ? uP3 : mix(uP2, uP3, e);
      gl_FragColor = vec4(c, 1.0);
      return;
    }

    vec3 wall = mix(${glslColour(HEX.n2)}, ${glslColour(HEX.n3)}, hash(vOcc.y) * 0.7);
    // The plots by the garage are the studio's own: warm like the garage's timber, not the city's grey.
    if (kind > 0.5) wall = mix(${glslColour(HEX.wood[0])}, ${glslColour(HEX.wood[1])}, 0.5 + 0.3 * hash(vOcc.y));
    vec3 N = normalize(vNormalW);
    float lambert = max(dot(N, uMoon), 0.0);
    float street = exp(-y / 9.0) * 0.55;
    vec3 lit = wall * (0.34 + 0.55 * lambert) + ${glslColour(HEX.lamp)} * street * 0.35;
    vec3 col = lit;

    if (!gl_FrontFacing) {
      // Inside an open storey: dark walls with the floor's own light on them.
      col = ${glslColour(HEX.n1)} * 0.7 + ${glslColour(HEX.lamp)} * 0.05;
    } else if (side) {
      vec3 glass = ${glslColour(HEX.n1)} * 0.55 + ${glslColour(HEX.glow0)} * 0.18 * (1.0 - abs(dot(N, normalize(uCam - vWorld))));
      vec3 detail = inWin ? (on ? windowLight(seat, vOcc.y) : glass) : lit;
      // Far away a window is less than a pixel: average the facade instead of
      // letting the grid shimmer, first per storey and then per tower.
      vec3 avgLight = mix(windowLight(fl * 7.0 + 3.0, vOcc.y), windowLight(fl * 13.0 + 1.0, vOcc.y), 0.5);
      // At night a far facade is its light, not its wall: the average leans on the windows.
      vec3 avg = lit * 0.4 + (avgLight * share * 1.35 + glass * (1.0 - share)) * 0.6;
      col = mix(detail, avg, smoothstep(0.3, 0.75, px));
      if (fl < 0.5 && y < roofY) col += ${glslColour(HEX.lamp)} * 0.08;
    } else if (nL.y > 0.5) {
      col = ${glslColour(HEX.n1)} * (0.6 + 0.4 * lambert) + (rim < 0.7 ? ${glslColour(HEX.n3)} * 0.35 : vec3(0.0));
    }
    col = mix(col, ${glslColour(HEX.n1)} * 0.55, fog * 0.85);
    // A stray value past the float target's range would be smeared across the
    // whole frame by the bloom (it was: the planet went white at 12 km). Clamp.
    col = any(isnan(col)) ? vec3(0.0) : clamp(col, 0.0, 4.0);
    gl_FragColor = vec4(col, 1.0);
  }`

export function towerUniforms() {
  return {
    uTime: { value: 0 },
    uFloorH: { value: FLOOR_H },
    uWin: { value: WIN },
    uMoon: { value: new T.Vector3(-0.4, 0.8, 0.45).normalize() },
    uCam: { value: new T.Vector3() },
    uCamRight: { value: new T.Vector3(1, 0, -1).normalize() },
    uPxScale: { value: 1000 },
    uLoss: { value: 0 },
    uCdfA: { value: new T.Vector4(1, 1, 1, 1) },
    uCdfB: { value: new T.Vector4(1, 1, 1, 1) },
    uStates: { value: STATE_COLOURS.map((c) => c.clone()) },
    uFogNear: { value: 1e4 },
    uFogFar: { value: 2e4 },
    uMode: { value: 0 },
    uP0: { value: new T.Color(HEX.calm[0]) },
    uP1: { value: new T.Color(HEX.calm[1]) },
    uP2: { value: new T.Color(HEX.calm[2]) },
    uP3: { value: new T.Color(HEX.calm[3]) },
  }
}

export type TowerUniforms = ReturnType<typeof towerUniforms>

/** Two stacked unit boxes (y 0..0.5 and 0.5..1), each with its own faces, and a segment id. */
function segmentedBox(): T.BufferGeometry {
  const parts = [0, 1].map((seg) => {
    const g = new T.BoxGeometry(1, 0.5, 1)
    g.translate(0, 0.25 + seg * 0.5, 0)
    const n = g.getAttribute('position').count
    g.setAttribute('aSeg', new T.Float32BufferAttribute(new Float32Array(n).fill(seg), 1))
    return g
  })
  const out = new T.BufferGeometry()
  const pos: number[] = [], nor: number[] = [], seg: number[] = [], idx: number[] = []
  let base = 0
  for (const g of parts) {
    const p = g.getAttribute('position'), nn = g.getAttribute('normal'), s = g.getAttribute('aSeg')
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(nn.getX(i), nn.getY(i), nn.getZ(i)); seg.push(s.getX(i))
    }
    const index = g.getIndex()!
    for (let i = 0; i < index.count; i++) idx.push(index.getX(i) + base)
    base += p.count
  }
  out.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3))
  out.setAttribute('aSeg', new T.Float32BufferAttribute(seg, 1))
  out.setIndex(idx)
  return out
}

const SHARED = segmentedBox()

export function createTowers(spec: TowerSpec, uniforms: TowerUniforms): TowerMesh {
  const geometry = new T.InstancedBufferGeometry()
  geometry.index = SHARED.index
  geometry.setAttribute('position', SHARED.getAttribute('position'))
  geometry.setAttribute('normal', SHARED.getAttribute('normal'))
  geometry.setAttribute('aSeg', SHARED.getAttribute('aSeg'))
  const n = spec.count
  const dims = new Float32Array(n * 4)
  const occAttr = new Float32Array(n * 4)
  const animAttr = new Float32Array(n * 4)
  for (let k = 0; k < n; k++) {
    dims[k * 4] = spec.w[k]; dims[k * 4 + 1] = spec.d[k]; dims[k * 4 + 2] = spec.floors[k]; dims[k * 4 + 3] = spec.perFloor[k]
    occAttr[k * 4 + 1] = spec.seed[k]
    occAttr[k * 4 + 3] = spec.kind ? spec.kind[k] : 0
    animAttr[k * 4 + 1] = 1
  }
  const aDims = new T.InstancedBufferAttribute(dims, 4)
  const aOcc = new T.InstancedBufferAttribute(occAttr, 4)
  const aAnim = new T.InstancedBufferAttribute(animAttr, 4)
  aOcc.setUsage(T.DynamicDrawUsage)
  aAnim.setUsage(T.DynamicDrawUsage)
  geometry.setAttribute('aDims', aDims)
  geometry.setAttribute('aOcc', aOcc)
  geometry.setAttribute('aAnim', aAnim)
  const material = new T.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, T.IUniform>,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: T.DoubleSide,
    transparent: true,
  })
  const mesh = new T.InstancedMesh(geometry, material, n)
  mesh.frustumCulled = false
  const m = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), one = new T.Vector3(1, 1, 1)
  for (let k = 0; k < n; k++) {
    p.set(spec.pos[k * 3], spec.pos[k * 3 + 1], spec.pos[k * 3 + 2])
    q.set(spec.quat[k * 4], spec.quat[k * 4 + 1], spec.quat[k * 4 + 2], spec.quat[k * 4 + 3])
    m.compose(p, q, one)
    mesh.setMatrixAt(k, m)
  }
  mesh.instanceMatrix.needsUpdate = true
  const occ = new Float32Array(n), open = new Float32Array(n), drop = new Float32Array(n)
  const squash = new Float32Array(n).fill(1), xray = new Float32Array(n)
  const dirty = new Set<number>()
  return {
    mesh, count: n, occ, target: new Float32Array(n), open, drop, squash, xray,
    commit(from = 0, to = n) {
      if (to <= from) return
      for (let k = from; k < to; k++) occAttr[k * 4] = occ[k]
      aOcc.addUpdateRange(from * 4, (to - from) * 4)
      aOcc.needsUpdate = true
    },
    touch(k) { dirty.add(k) },
    flush() {
      if (!dirty.size) return
      for (const k of dirty) {
        occAttr[k * 4 + 2] = open[k]
        animAttr[k * 4] = drop[k]; animAttr[k * 4 + 1] = squash[k]; animAttr[k * 4 + 2] = xray[k]
        aOcc.addUpdateRange(k * 4, 4)
        aAnim.addUpdateRange(k * 4, 4)
      }
      dirty.clear()
      aOcc.needsUpdate = true
      aAnim.needsUpdate = true
    },
  }
}
