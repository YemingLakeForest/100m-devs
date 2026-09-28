import * as T from 'three'
import { standing, WORLD_SEATS, type Network, type Standing } from './network.ts'
import { HEX } from './palette.ts'

/**
 * The colony network, drawn. One plane through Sol, looked down on like a
 * strategy map: a glyph per system, a line per lane, the studio's territory as
 * a hatched field inside a bright border, fog past the frontier, and developers
 * streaming out along the lanes to the world being filled.
 *
 * It is drawn for the monitor first (the user, 2026-09-27: *"I like monitor
 * style lets go further with that approach"*). Every glyph is pixel art at the
 * monitor's own resolution, snapped to its pixel grid, so a colony is the same
 * seven-pixel ring wherever it sits on screen and never a smeared disc. The
 * other options get the same marks at three screen pixels to the glyph pixel.
 *
 * Colours are the live ramp's four values (`uP0`..`uP3`), so the map goes calm,
 * amber and red with everything else (§1.1).
 */

/**
 * Metres of the planet's toy space per light-year. The map shares the world's
 * space (a world sits at its system's point on the plane), so this is the one
 * number that decides how far apart worlds are in the zoom. At 20 km, the view
 * as the map opens (MAP in lens.ts, 2.5 ly tall) holds only home, and Proxima
 * comes into frame about eight wheel steps later; at 50 km (the first try)
 * those steps were twenty, all of them past an empty map.
 */
export const LY = 20_000
export const KINDS: readonly Standing[] = ['uncharted', 'surveyed', 'frontier', 'colony', 'home']
const KIND: Record<Standing, number> = { uncharted: 0, surveyed: 1, frontier: 2, colony: 3, home: 4 }
/** Glyph edge in the monitor's pixels, by kind: odd, so every glyph has a centre pixel. */
const GLYPH = [1, 3, 7, 7, 9]
/**
 * Territory reaches this far round each settled system, light-years: short of
 * Proxima's 4.24, so before the launch the next world blinks just outside the
 * border instead of already inside it, and far enough that neighbours' claims
 * merge into one border with no gaps between them.
 */
export const REACH = 3.4
/** Seconds a new colony's ping takes to spread and fade. */
const PING = 1.6

/**
 * A glyph's pixel (i, j), 0..1 — the fragment shader's rule, repeated here so
 * the legend draws exactly what the map draws.
 *
 * - home: a bullseye, two rings and a dot;
 * - colony: a ring, and a core as bright as the world is full;
 * - frontier: the ring in four dashes, blinking — the next world, named, not lit;
 * - surveyed: a plus; uncharted: one dim pixel.
 */
export function glyphPixel(kind: number, i: number, j: number, fill = 1): number {
  const S = GLYPH[kind]
  const qx = i - (S - 1) / 2, qy = j - (S - 1) / 2
  const d = Math.hypot(qx, qy)
  const ring = (r: number) => (Math.abs(d - r) <= 0.5 ? 1 : 0)
  switch (kind) {
    case 4: return Math.max(ring(4), ring(2), d <= 0.5 ? 1 : 0)
    case 3: return Math.max(ring(3), d <= 1 ? 0.4 + 0.6 * fill : 0)
    case 2: return ring(3) * (Math.floor(((Math.atan2(qy, qx + 1e-4) + Math.PI) / (2 * Math.PI)) * 8) % 2)
    case 1: return d <= 1 ? 1 : 0
    default: return 0.55
  }
}

/** A glyph as a mask image (white where lit), `scale` CSS pixels to its pixel. */
export function glyphMask(kind: number, scale = 2): string {
  const S = GLYPH[kind]
  const c = document.createElement('canvas')
  c.width = S * scale; c.height = S * scale
  const g = c.getContext('2d')!
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const a = glyphPixel(kind, i, j, 0.6)
    if (a <= 0) continue
    g.fillStyle = `rgba(255,255,255,${a})`
    g.fillRect(i * scale, j * scale, scale, scale)
  }
  return c.toDataURL()
}

/** The legend's other marks in the same pixels: a patch of territory, a lane, two packets. */
export function markMask(kind: 'territory' | 'lane' | 'transit', scale = 2): { mask: string; w: number; h: number } {
  const [W, H] = kind === 'territory' ? [9, 7] : kind === 'lane' ? [9, 1] : [9, 2]
  const c = document.createElement('canvas')
  c.width = W * scale; c.height = H * scale
  const g = c.getContext('2d')!
  const px = (i: number, j: number, a = 1) => { g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(i * scale, j * scale, scale, scale) }
  if (kind === 'lane') for (let i = 0; i < W; i++) px(i, 0)
  else if (kind === 'transit') for (const i of [1, 2, 6, 7]) { px(i, 0); px(i, 1) }
  else for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (i === 0 || j === 0 || i === W - 1 || j === H - 1) px(i, j)
    else if ((i + j) % 4 === 0) px(i, j, 0.6)
  }
  return { mask: c.toDataURL(), w: W * scale, h: H * scale }
}

export interface NetView {
  group: T.Group
  uniforms: {
    uMode: { value: number }; uTime: { value: number }; uPx: { value: number }; uRes: { value: T.Vector2 }; uFade: { value: number }
    uP0: { value: T.Color }; uP1: { value: T.Color }; uP2: { value: T.Color }; uP3: { value: T.Color }
  }
  /**
   * `settled` worlds hold anybody at headcount `n`; `arrivals` new packets set
   * out along the lanes this frame; `border` is the border's width in metres
   * (two of the monitor's pixels at the current zoom).
   */
  update(o: { n: number; settled: number; dt: number; arrivals: number; border: number }): void
  /** The system nearest a map point (metres on the plane), within `reach` metres; -1 if none. */
  pick(p: T.Vector3, reach: number): number
  position(s: number): T.Vector3
  standing(s: number): Standing
}

// Snap a sprite's centre to the target's pixel grid: an odd sprite centred on a
// pixel, an even one on a corner, so its pixels are the target's pixels.
const SNAP = /* glsl */ `
  vec4 snapped(vec4 clip, float size) {
    vec2 px = (clip.xy / clip.w * 0.5 + 0.5) * uRes;
    px = mod(size, 2.0) > 0.5 ? floor(px) + 0.5 : floor(px + 0.5);
    clip.xy = (px / uRes * 2.0 - 1.0) * clip.w;
    return clip;
  }`

const PT_VERT = /* glsl */ `
  attribute float aKind;
  attribute float aFill;
  uniform float uPx;
  uniform vec2 uRes;
  varying float vKind;
  varying float vFill;
  varying float vSize;
  ${SNAP}
  void main() {
    vKind = aKind;
    vFill = aFill;
    vSize = aKind > 3.5 ? 9.0 : aKind > 1.5 ? 7.0 : aKind > 0.5 ? 3.0 : 1.0;
    gl_PointSize = vSize * uPx;
    gl_Position = snapped(projectionMatrix * modelViewMatrix * vec4(position, 1.0), vSize * uPx);
  }`
const PT_FRAG = /* glsl */ `
  uniform float uMode;
  uniform float uTime;
  uniform float uFade;
  uniform vec3 uP1;
  uniform vec3 uP2;
  uniform vec3 uP3;
  varying float vKind;
  varying float vFill;
  varying float vSize;
  float ring(float d, float r) { return step(abs(d - r), 0.5); }
  void main() {
    vec2 q = floor(gl_PointCoord * vSize) - vec2((vSize - 1.0) * 0.5);
    float d = length(q);
    float a;
    vec3 col;
    if (vKind > 3.5) {
      a = max(max(ring(d, 4.0), ring(d, 2.0)), step(d, 0.5));
      col = uP3;
    } else if (vKind > 2.5) {
      float r = ring(d, 3.0);
      a = max(r, step(d, 1.0) * (0.4 + 0.6 * vFill));
      col = mix(uP2, uP3, max(r, vFill));
    } else if (vKind > 1.5) {
      float seg = floor((atan(q.y, q.x + 1e-4) + 3.14159265) / 6.2831853 * 8.0);
      a = ring(d, 3.0) * mod(seg, 2.0) * (0.45 + 0.55 * step(0.5, fract(uTime * 1.1)));
      col = uP3;
    } else if (vKind > 0.5) {
      a = step(d, 1.0);
      col = uP2;
    } else {
      a = 0.55;
      col = uP1;
    }
    if (a < 0.01) discard;
    // Laid over, not added: two glyphs a pixel apart (Proxima and Alpha
    // Centauri are 0.2 ly) must not sum to white and bloom.
    gl_FragColor = vec4(col * (uMode > 0.5 ? 1.0 : 1.5), a * uFade);
  }`

// A new colony announces itself: one ring, spreading from its glyph and fading.
const PING_VERT = /* glsl */ `
  attribute float aT;
  uniform float uPx;
  uniform vec2 uRes;
  varying float vT;
  varying float vSize;
  ${SNAP}
  void main() {
    vT = aT;
    vSize = 2.0 * floor(4.0 + aT * 16.0) + 1.0;
    gl_PointSize = vSize * uPx;
    gl_Position = snapped(projectionMatrix * modelViewMatrix * vec4(position, 1.0), vSize * uPx);
  }`
const PING_FRAG = /* glsl */ `
  uniform float uFade;
  uniform vec3 uP3;
  varying float vT;
  varying float vSize;
  void main() {
    vec2 q = floor(gl_PointCoord * vSize) - vec2((vSize - 1.0) * 0.5);
    float a = step(abs(length(q) - (vSize - 1.0) * 0.5), 0.5) * (1.0 - vT);
    if (a < 0.01) discard;
    gl_FragColor = vec4(uP3 * a * uFade, 1.0);
  }`

// Developers in transit: two pixels each, on the lanes.
const STREAM_VERT = /* glsl */ `
  uniform float uPx;
  uniform vec2 uRes;
  ${SNAP}
  void main() {
    gl_PointSize = 2.0 * uPx;
    gl_Position = snapped(projectionMatrix * modelViewMatrix * vec4(position, 1.0), 2.0 * uPx);
  }`
const STREAM_FRAG = /* glsl */ `
  uniform float uFade;
  uniform vec3 uP3;
  void main() { gl_FragColor = vec4(uP3, uFade); }`

// Lanes by tier: 2 inside the territory, 1 surveyed, 0 past the frontier (a
// faint web, so the fog still shows the map has more to it).
const LANE_VERT = /* glsl */ `
  attribute float aTier;
  varying float vTier;
  void main() { vTier = aTier; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const LANE_FRAG = /* glsl */ `
  uniform float uMode;
  uniform float uFade;
  uniform vec3 uP0;
  uniform vec3 uP1;
  uniform vec3 uP2;
  varying float vTier;
  void main() {
    vec3 c = vTier > 1.5 ? uP2 : vTier > 0.5 ? uP1 * 0.9 : uP0 * 1.3;
    gl_FragColor = vec4(c * uFade * (uMode > 0.5 ? 1.0 : 1.4), 1.0);
  }`

const FILL_VERT = /* glsl */ `
  void main() { gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`
const FILL_FRAG = /* glsl */ `
  uniform vec3 uCol;
  uniform vec3 uBg;
  uniform float uFade;
  uniform float uHatch;
  uniform float uSolid;
  void main() {
    // Shaded the way a terminal shades an area: one pixel in four, on the diagonals.
    if (uHatch > 0.5 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 4.0) > 0.5) discard;
    // The dark inside is laid down whole and faded against the night instead
    // of made see-through: half-faded, a see-through inside let the bright
    // rim under it shine through, and the whole territory went orange.
    gl_FragColor = uSolid > 0.5 ? vec4(mix(uBg, uCol, uFade), 1.0) : vec4(uCol, uFade);
  }`

export function createNetView(net: Network): NetView {
  const group = new T.Group()
  const uniforms: NetView['uniforms'] = {
    uMode: { value: 0 }, uTime: { value: 0 }, uPx: { value: 3 }, uRes: { value: new T.Vector2(1, 1) }, uFade: { value: 0 },
    uP0: { value: new T.Color() }, uP1: { value: new T.Color() }, uP2: { value: new T.Color() }, uP3: { value: new T.Color() },
  }
  const U = uniforms as unknown as Record<string, T.IUniform>
  const n = net.systems.length
  const pos = new Float32Array(n * 3)
  net.systems.forEach((s, i) => { pos[i * 3] = s.x * LY; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = s.z * LY })
  const kind = new Float32Array(n), fill = new Float32Array(n)
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.BufferAttribute(pos, 3))
  const aKind = new T.BufferAttribute(kind, 1).setUsage(T.DynamicDrawUsage)
  const aFill = new T.BufferAttribute(fill, 1).setUsage(T.DynamicDrawUsage)
  g.setAttribute('aKind', aKind); g.setAttribute('aFill', aFill)
  // Glyphs sit over everything, the planets included: past the map's edge a
  // world is its glyph.
  const additive = { transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending }
  const over = { transparent: true, depthTest: false, depthWrite: false, blending: T.NormalBlending }
  const points = new T.Points(g, new T.ShaderMaterial({ uniforms: U, vertexShader: PT_VERT, fragmentShader: PT_FRAG, ...over }))
  points.frustumCulled = false
  points.renderOrder = 6

  // Lanes: one segment each. They test depth (writing none), so a planet on
  // the plane hides the lane that runs into its centre.
  const lpos = new Float32Array(net.lanes.length * 6), tier = new Float32Array(net.lanes.length * 2)
  net.lanes.forEach(([a, b], k) => { lpos.set([pos[a * 3], 0, pos[a * 3 + 2], pos[b * 3], 0, pos[b * 3 + 2]], k * 6) })
  const lg = new T.BufferGeometry()
  lg.setAttribute('position', new T.BufferAttribute(lpos, 3))
  const aTier = new T.BufferAttribute(tier, 1).setUsage(T.DynamicDrawUsage)
  lg.setAttribute('aTier', aTier)
  const lines = new T.LineSegments(lg, new T.ShaderMaterial({ uniforms: U, vertexShader: LANE_VERT, fragmentShader: LANE_FRAG, ...additive, depthTest: true }))
  lines.frustumCulled = false
  lines.renderOrder = 4

  // Territory: a bright shape under a dark one — a disc per settled system and
  // a band along every lane between two of them, so worlds joined by a lane
  // are one territory and not a string of islands (the first picture had
  // three). Where the dark shapes overlap, the bright rims inside them are
  // covered and only the outline of the whole survives: the studio's border,
  // drawn the way a strategy map draws one. They sit below the planets'
  // undersides and test depth, so a planet on the plane is drawn over its own
  // territory.
  const disc = new T.CircleGeometry(1, 48)
  disc.rotateX(-Math.PI / 2)
  const band = new T.PlaneGeometry(1, 1)
  band.rotateX(-Math.PI / 2)
  const night = new T.Color(HEX.night)
  const mk = (geo: T.BufferGeometry, cap: number, col: T.Color, look: 'rim' | 'solid' | 'hatch', order: number) => {
    const m = new T.InstancedMesh(geo, new T.ShaderMaterial({
      uniforms: {
        uCol: { value: col }, uBg: { value: night }, uFade: uniforms.uFade,
        uHatch: { value: look === 'hatch' ? 1 : 0 }, uSolid: { value: look === 'solid' ? 1 : 0 },
      },
      vertexShader: FILL_VERT, fragmentShader: FILL_FRAG, transparent: true, depthTest: true, depthWrite: false,
    }), Math.max(1, cap))
    m.count = 0
    m.frustumCulled = false
    m.renderOrder = order
    return m
  }
  const borderCol = new T.Color(), fillCol = new T.Color(), gapCol = new T.Color()
  const L = net.lanes.length
  const border = [mk(disc, n, borderCol, 'rim', 1), mk(band, L, borderCol, 'rim', 1)] as const
  const gap = [mk(disc, n, gapCol, 'solid', 2), mk(band, L, gapCol, 'solid', 2)] as const
  const field = [mk(disc, n, fillCol, 'hatch', 3), mk(band, L, fillCol, 'hatch', 3)] as const
  const FLOOR = -4400
  /** A lane's band is this share of a system's reach wide, each side. */
  const BAND = 0.62
  group.add(...border, ...gap, ...field, lines, points)

  // Developers on their way: packets riding the lanes out from Sol.
  const MAX = 900
  const spos = new Float32Array(MAX * 3)
  const sg = new T.BufferGeometry()
  const aS = new T.BufferAttribute(spos, 3).setUsage(T.DynamicDrawUsage)
  sg.setAttribute('position', aS)
  sg.setDrawRange(0, 0)
  // Packets are laid over too: a hundred on one lane is a bright dotted line, not a white one.
  const streams = new T.Points(sg, new T.ShaderMaterial({ uniforms: U, vertexShader: STREAM_VERT, fragmentShader: STREAM_FRAG, ...over }))
  streams.frustumCulled = false
  streams.renderOrder = 5
  const packets: { path: number[]; seg: number; t: number; speed: number }[] = []
  const paths = new Map<number, number[]>()
  const pathTo = (s: number) => {
    let path = paths.get(s)
    if (!path) {
      path = []
      for (let i = s; i >= 0; i = net.parent[i]) path.unshift(i)
      paths.set(s, path)
    }
    return path
  }

  const PMAX = 48
  const ppos = new Float32Array(PMAX * 3), pt = new Float32Array(PMAX)
  const pg = new T.BufferGeometry()
  const aPP = new T.BufferAttribute(ppos, 3).setUsage(T.DynamicDrawUsage)
  const aPT = new T.BufferAttribute(pt, 1).setUsage(T.DynamicDrawUsage)
  pg.setAttribute('position', aPP); pg.setAttribute('aT', aPT)
  pg.setDrawRange(0, 0)
  const pingPts = new T.Points(pg, new T.ShaderMaterial({ uniforms: U, vertexShader: PING_VERT, fragmentShader: PING_FRAG, ...additive }))
  pingPts.frustumCulled = false
  pingPts.renderOrder = 7
  group.add(streams, pingPts)
  const pings: { s: number; t: number }[] = []

  let lastSettled = -1
  let lastBorder = -1
  let claimed: number[] = []
  const m = new T.Matrix4(), v = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3(), Y = new T.Vector3(0, 1, 0)
  /** Lay out one layer of the territory: `grow` metres wider than the claim itself. */
  const place = (layer: readonly [T.InstancedMesh, T.InstancedMesh], worlds: number, grow: number, y: number) => {
    const [discs, bands] = layer
    const r = REACH * LY + grow
    q.identity()
    for (let w = 0; w < worlds; w++) {
      const s = net.order[w]
      m.compose(v.set(pos[s * 3], y, pos[s * 3 + 2]), q, sc.set(r, 1, r))
      discs.setMatrixAt(w, m)
    }
    discs.count = worlds
    discs.instanceMatrix.needsUpdate = true
    claimed.forEach((k, i) => {
      const [a, b] = net.lanes[k]
      const dx = pos[b * 3] - pos[a * 3], dz = pos[b * 3 + 2] - pos[a * 3 + 2]
      q.setFromAxisAngle(Y, Math.atan2(-dz, dx))
      v.set((pos[a * 3] + pos[b * 3]) / 2, y, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2)
      m.compose(v, q, sc.set(Math.hypot(dx, dz), 1, 2 * (REACH * LY * BAND + grow)))
      bands.setMatrixAt(i, m)
    })
    bands.count = claimed.length
    bands.instanceMatrix.needsUpdate = true
  }
  const view: NetView = {
    group, uniforms,
    update({ n: headcount, settled, dt, arrivals, border: bw }) {
      uniforms.uTime.value += dt
      const on = uniforms.uMode.value > 0.5
      // The border in the ramp's second-brightest value: the brightest blooms to white.
      borderCol.copy(uniforms.uP2.value).multiplyScalar(on ? 1.0 : 1.3)
      gapCol.copy(uniforms.uP0.value).multiplyScalar(0.7)
      fillCol.copy(uniforms.uP1.value).multiplyScalar(0.55)
      const worlds = Math.min(settled, net.order.length)
      if (settled !== lastSettled) {
        // Every world that opened since the last look gets its ping, however
        // many a preset opened at once.
        if (lastSettled > 0) for (let w = lastSettled; w < worlds && pings.length < PMAX; w++) pings.push({ s: net.order[w], t: 0 })
        lastSettled = settled
        for (let i = 0; i < n; i++) kind[i] = KIND[standing(net, i, settled)]
        aKind.needsUpdate = true
        claimed = []
        net.lanes.forEach(([a, b], k) => { if (kind[a] >= 2.5 && kind[b] >= 2.5) claimed.push(k) })
        place(gap, worlds, 0, FLOOR + 200)
        place(field, worlds, 0, FLOOR + 300)
        lastBorder = -1
        net.lanes.forEach(([a, b], k) => {
          const ka = kind[a], kb = kind[b]
          const t = ka >= 2.5 && kb >= 2.5 ? 2 : ka >= 0.5 && kb >= 0.5 ? 1 : 0
          tier[k * 2] = t; tier[k * 2 + 1] = t
        })
        aTier.needsUpdate = true
      }
      // The border is a constant width on screen, so it is rebuilt as the zoom moves.
      if (Math.abs(bw - lastBorder) > lastBorder * 0.02) {
        lastBorder = bw
        place(border, worlds, bw, FLOOR)
      }
      for (let w = 0; w < worlds; w++) {
        const s = net.order[w]
        fill[s] = Math.min(1, Math.max(0, (headcount - w * WORLD_SEATS) / WORLD_SEATS))
      }
      aFill.needsUpdate = true

      // New arrivals go to the world being filled; a few to the others.
      if (worlds > 1) {
        for (let i = 0; i < Math.min(12, arrivals) && packets.length < MAX; i++) {
          const w = Math.random() < 0.8 ? worlds - 1 : 1 + Math.floor(Math.random() * (worlds - 1))
          const path = pathTo(net.order[w])
          if (path.length > 1) packets.push({ path, seg: 0, t: Math.random() * 0.2, speed: 5 + Math.random() * 4 })
        }
      }
      let c = 0
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]
        const a = net.systems[p.path[p.seg]], b = net.systems[p.path[p.seg + 1]]
        p.t += (dt * p.speed) / Math.max(0.5, Math.hypot(a.x - b.x, a.z - b.z))
        while (p.t >= 1 && p.seg < p.path.length - 2) { p.t -= 1; p.seg++ }
        if (p.t >= 1) { packets.splice(i, 1); continue }
        const a2 = net.systems[p.path[p.seg]], b2 = net.systems[p.path[p.seg + 1]]
        spos[c * 3] = (a2.x + (b2.x - a2.x) * p.t) * LY
        spos[c * 3 + 1] = 0
        spos[c * 3 + 2] = (a2.z + (b2.z - a2.z) * p.t) * LY
        c++
      }
      sg.setDrawRange(0, c)
      aS.needsUpdate = true

      let k = 0
      for (let i = pings.length - 1; i >= 0; i--) {
        const p = pings[i]
        p.t += dt / PING
        if (p.t >= 1) { pings.splice(i, 1); continue }
        ppos[k * 3] = pos[p.s * 3]; ppos[k * 3 + 1] = 0; ppos[k * 3 + 2] = pos[p.s * 3 + 2]
        pt[k] = p.t
        k++
      }
      pg.setDrawRange(0, k)
      aPP.needsUpdate = true
      aPT.needsUpdate = true
    },
    pick(p, reach) {
      let best = -1, bd = reach * reach
      for (let i = 0; i < n; i++) {
        const d = (pos[i * 3] - p.x) ** 2 + (pos[i * 3 + 2] - p.z) ** 2
        if (d < bd) { bd = d; best = i }
      }
      return best
    },
    position(s) { return new T.Vector3(pos[s * 3], 0, pos[s * 3 + 2]) },
    standing(s) { return KINDS[kind[s]] },
  }
  return view
}
