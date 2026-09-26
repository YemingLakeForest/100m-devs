/*
 * Copied from the rebuild (100m-devs-three/src/render/city/endlessCity.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * **The endless city, drawn** — GDD §6 [amended 2026-09-24], phase 5, third pass.
 *
 * `sim/cityGrid.ts` says what stands on every block, `cityBlocks.ts` builds it,
 * and this streams it around wherever the camera looks. The user's brief, and
 * where each promise is kept:
 *
 * - **"we can drag and drag there are still people"** — 3 × 3-block chunks are
 *   built around the view's centre, one a frame, and dropped behind it.
 * - **"fog or fade out to represend the vastness of our swarm"** — a radial fog
 *   on the ground plane from the view's centre, so it rings the picture instead
 *   of lying across it as depth fog does under an orthographic camera.
 * - **"the background ambient is very important"** — a day/dusk/night cycle,
 *   cloud shadows, traffic, street lamps, and real sun shadows (`worldScene`
 *   follows the view with the sun).
 * - **"never show a number without a person on screen you could name"** —
 *   every window is lit by a seat behind it, in the Ledger's own colours
 *   (`sim/losses.ts`, `art/stateLights.ts`), so a studio in a meeting is a blue
 *   city at night and a blue-tinted one by day.
 *
 * [2026-09-24, third pass — *"Still ugly, not what I expect"*.] The people used
 * to be a point per seat, and at city distance a million coloured points is
 * confetti: it read as noise, not as people. The approved city concept lights
 * the *windows*, and so does this. See `cityBlocks.ts` for the rest of the
 * argument.
 */
import * as T from 'three'
import {
  blockKind, blockOrigin, blockPeople, FLOOR_H, frontierIndex, LOT_D, LOT_W, officeCell, officeOrdinal, officesOpen,
  PITCH_X, PITCH_Z, SEATS,
} from '../../sim/cityGrid.ts'
import { LOSS_KINDS, type Breakdown } from '../../sim/losses.ts'
import { STATE_LIGHT } from '../../art/stateLights.ts'
import { buildBlock, builtRoof, HQ_TOWER, Mesher, rand } from './cityBlocks.ts'
import { SKINS, type WorldSkin } from './worldSkins.ts'

const CHUNK = 3
/** One chunk a frame: a drag never hitches on a wall of new blocks (phone p95, 2026-09-24). */
const BUILDS_PER_FRAME = 1
/** The day, in seconds of play. Four minutes: long enough to feel, short enough to see. */
export const DAY_SECONDS = 240

export interface CityFrame {
  /** The view's centre on the ground, world metres. */
  x: number
  z: number
  /** Visible width of the view, world metres. */
  span: number
  /** Pixels per world metre, for lamp sizes. */
  pxPerMetre: number
  /** Seconds, the scene's clock. */
  t: number
  heads: number
  breakdown: Breakdown | null
  /** A fixed time of day (0..1), for the HQ floor's backdrop; absent, the clock runs. */
  tod?: number
}

/** One of the studio's offices, at the top of its tallest roof, in world metres. */
export interface OfficeAnchor {
  i: number
  j: number
  /** Which office this is, counting from 1 in the order the studio moved in. */
  ordinal: number
  x: number
  y: number
  z: number
}

export interface EndlessCity {
  root: T.Group
  update(frame: CityFrame): void
  /** §6 [2026-09-26] — the studio's offices near the view, for their speech balloons. */
  offices(): readonly OfficeAnchor[]
  /** Offices that opened near the view since the last call, for the ribbon over each. */
  drainOpened(): OfficeAnchor[]
  /** The sky and the fog are one colour: what the city dissolves into. */
  sky: T.Color
  /** 0 by day, 1 at night, for the caller's lights. */
  night: number
  dispose(): void
}

const c = (rgb: readonly number[]) => [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255] as [number, number, number]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => lerp(v, b[i], t))

/**
 * The sky: the garage's paper by day, a warm dusk, a deep blue night. The day
 * is the garage's own background tone (`INK.paper`, a little cooler), so the
 * city and the room it zooms out of are one world.
 */
const STREET = [146, 152, 154]

/** Dusk and night as two weights from the time of day. */
export function daylight(t: number): { dusk: number; night: number; tod: number } {
  const tod = ((t / DAY_SECONDS) % 1 + 1) % 1
  const dusk = Math.max(0, 1 - Math.abs(tod - 0.5) / 0.1)
  const night = tod < 0.5 ? 0 : tod < 0.6 ? (tod - 0.5) / 0.1 : tod < 0.88 ? 1 : Math.max(0, 1 - (tod - 0.88) / 0.1)
  const dawn = Math.max(0, 1 - Math.abs(tod - 0.95) / 0.05)
  return { dusk: Math.max(dusk, dawn * 0.7), night, tod }
}

// --- the city's material -----------------------------------------------------------

const UNIFORMS = () => ({
  uFocus: { value: new T.Vector2() },
  uFogNear: { value: 200 },
  uFogFar: { value: 500 },
  uFogColor: { value: new T.Color() },
  uNight: { value: 0 },
  uDusk: { value: 0 },
  uTime: { value: 0 },
  uCum: { value: new Array(8).fill(1) as number[] },
  uCol: { value: (['work', ...LOSS_KINDS] as const).map(k => new T.Color(STATE_LIGHT[k])) },
  /** The studio's average light: what a window grid too small to resolve adds up to. */
  uAvg: { value: new T.Color() },
  /** §6 [2026-09-25] — the world's light, multiplied over the city. */
  uGrade: { value: new T.Color(1, 1, 1) },
  /** Extra haze toward the sky, 0..1: the HQ floor's backdrop recedes. */
  uHaze: { value: 0 },
})

/**
 * Lambert, vertex colours and the garage's lights and shadows, with four
 * things patched in: the window grid on facade faces, each window lit by a
 * seat's state; the dusk warmth; the night; and the radial fog.
 */
function cityMaterial(u: ReturnType<typeof UNIFORMS>, opts: T.MeshLambertMaterialParameters = {}): T.MeshLambertMaterial {
  const m = new T.MeshLambertMaterial({ vertexColors: true, ...opts })
  const facades = opts.vertexColors !== false
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = (facades ? 'attribute vec2 aFacade;\n' : '') + 'varying vec2 vFacade; varying vec3 vCityWorld; varying vec3 vCityNormal;\n' + shader.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vCityNormal = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  vCityWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vFacade = ${facades ? 'aFacade' : 'vec2(0.0)'};`)
    shader.fragmentShader = `uniform vec2 uFocus; uniform float uFogNear; uniform float uFogFar; uniform vec3 uFogColor;
uniform float uNight; uniform float uDusk; uniform float uTime; uniform float uCum[8]; uniform vec3 uCol[8]; uniform vec3 uAvg; uniform float uHaze; uniform vec3 uGrade;
varying vec2 vFacade; varying vec3 vCityWorld; varying vec3 vCityNormal;
float cityHash(float a, float b) { return fract(sin(a * 12.9898 + b * 78.233) * 43758.5453); }
` + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  float cityWin = 0.0;
  float cityU = 0.0;
  float cityFar = 0.0;
  float cityArea = 0.0;
  float cityRaw = 0.0;
  vec3 cityPerson = vec3(0.0);
  vec3 cityWinCol = vec3(0.0);
  if (vFacade.y > 0.5 && abs(vCityNormal.y) < 0.5) {
    bool xFace = abs(vCityNormal.x) > 0.5;
    float u = xFace ? vCityWorld.z : vCityWorld.x;
    cityU = floor(u / 1.9) + (xFace ? 91.0 : 0.0);
    float v = vCityWorld.y;
    bool curtain = vFacade.y > 1.5;
    float bay = curtain ? 2.0 : 1.9;
    float fu = fract(u / bay), fv = fract(v / ${FLOOR_H.toFixed(1)});
    float cu = floor(u / bay), cv = floor(v / ${FLOOR_H.toFixed(1)});
    float inU = curtain ? step(0.07, fu) * step(fu, 0.93) : step(0.2, fu) * step(fu, 0.8);
    float inV = curtain ? step(0.12, fv) * step(fv, 0.92) : step(0.3, fv) * step(fv, 0.86);
    cityWin = inU * inV;
    /*
     * **Filtered by its size on screen.** Once a bay is a few pixels wide the
     * grid aliases, and at the zoom ceiling that was an orange-and-blue static
     * over every facade — the confetti again. So as the bay shrinks the window
     * fades to what the grid averages to: the lit share of the wall, and the
     * studio's average light (uAvg), rather than one sampled window.
     */
    // Filtered per axis: bays alias long before floors do, so far away the
    // bays blend into a ribbon per floor while the floors stay drawn — which
    // is how a distant office tower actually reads.
    float farU = smoothstep(0.14, 0.34, fwidth(u / bay));
    float farV = smoothstep(0.2, 0.45, fwidth(v / ${FLOOR_H.toFixed(1)}));
    float areaU = curtain ? 0.86 : 0.6, areaV = curtain ? 0.8 : 0.56;
    cityWin = mix(inU, areaU, farU) * mix(inV, areaV, farV);
    // Night keeps the individual lights: a lit window on a dark wall is a
    // point of light, which twinkles rather than aliases, and it is the whole
    // look of a night city (the concept, and the second pass, which was right).
    cityRaw = inU * mix(inV, areaV, farV);
    cityFar = farU;
    cityArea = cityWin;
    // The person behind this window: one seat of the bay, holding a state for
    // six seconds on its own beat (sim/unitLights.ts's LIGHT_PERIOD).
    float id = vFacade.x * 131.0 + cu * 17.0 + cv * 3.1 + (xFace ? 57.0 : 0.0);
    float phase = cityHash(id, 7.0) * 6.0;
    float r = cityHash(id * 1.37, floor((uTime + phase) / 6.0));
    vec3 col = uCol[7];
    for (int k = 7; k >= 0; k--) { if (r < uCum[k]) col = uCol[k]; }
    cityWinCol = mix(col, uAvg, cityFar);
    cityPerson = col;
    // By day, glass that reflects the sky, faintly tinted by whoever sits behind it.
    vec3 glass = mix(vec3(0.33, 0.42, 0.50), vec3(0.68, 0.77, 0.84), mix(fv, 0.55, cityFar));
    vec3 pane = mix(mix(glass, col, 0.14), glass, cityFar);
    diffuseColor.rgb = mix(diffuseColor.rgb, pane, cityWin);
  }`)
      .replace('#include <fog_fragment>', `
  gl_FragColor.rgb *= uGrade;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(1.06, 0.88, 0.74), uDusk * 0.45);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.20, 0.23, 0.36), uNight);
  // At night the windows are the light: the people, in the Ledger's colours.
  // Not every light is on — the concept city's night is lamplight with dark
  // panes between, and a wall where every window blazed read as a pattern,
  // not a building. A light holds for about half a minute on its own beat, and
  // what it shows is the person's state, warmed toward lamplight.
  float cityLit = step(0.45, cityHash(vFacade.x * 7.3 + floor(vCityWorld.y / ${FLOOR_H.toFixed(1)}) * 1.7 + cityU, floor(uTime / 29.0)));
  float cityGlow = cityRaw * cityLit;
  // Lamplight first, the person's state as the tint of their own window.
  gl_FragColor.rgb += cityGlow * mix(vec3(1.0, 0.8, 0.5), cityPerson, 0.42) * uNight * 0.9;
  float cityFog = smoothstep(uFogNear, uFogFar, distance(vCityWorld.xz, uFocus));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, max(cityFog, uHaze));
  #include <fog_fragment>`)
  }
  return m
}

// --- the chunk ------------------------------------------------------------------------

interface Chunk {
  signature: string
  mesh: T.Mesh
}

function chunkSignature(ci: number, cj: number, heads: number, frontier: number, rising: ReadonlyMap<string, unknown>): string {
  let s = ''
  for (let di = 0; di < CHUNK; di++) for (let dj = 0; dj < CHUNK; dj++) {
    const i = ci * CHUNK + di, j = cj * CHUNK + dj
    if (rising.has(i + ',' + j)) { s += 'R,'; continue }
    const kind = blockKind(i, j, heads, frontier)
    s += kind[0] + (kind === 'built' ? Math.ceil(blockPeople(i, j, heads) / SEATS) : '') + ','
  }
  return s
}

// --- the city ---------------------------------------------------------------------------

export interface CityOptions {
  /**
   * §5 [2026-09-24] — the city seen from the HQ floor: HQ's own tower left out
   * (the room stands in its place), no crown or beacon, and more haze, so the
   * city recedes the way it does in the concept rather than competing with the
   * authored room in front of it.
   */
  backdrop?: boolean
  /** §6 [2026-09-25] — whose world this city is on. Absent, Earth. */
  skin?: WorldSkin
  /** A colony: HQ is the outpost dome. */
  colony?: boolean
}

export function createEndlessCity(opts: CityOptions = {}): EndlessCity {
  const root = new T.Group()
  root.name = 'endless-city'
  const u = UNIFORMS()
  if (opts.backdrop) u.uHaze.value = 0.22
  const skin = opts.skin ?? SKINS.earth
  u.uGrade.value.setRGB(...skin.grade)
  const solid = cityMaterial(u)

  // The street: one plane under everything, following the view.
  const ground = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), cityMaterial(u, { vertexColors: false, color: new T.Color(...c(STREET)) }))
  ground.position.y = -0.02
  ground.receiveShadow = true
  root.add(ground)

  // Street lamps at every corner near the view, lit at dusk.
  const lampMat = new T.PointsMaterial({ color: new T.Color('#ffd68c'), size: 4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false })
  const lamps = new T.Points(new T.BufferGeometry(), lampMat)
  root.add(lamps)

  // Traffic: a fixed fleet recycled around the view, in the garage's quiet colours.
  const FLEET = 90
  const carGeo = new T.BoxGeometry(4.2, 1.4, 2)
  const cars = new T.InstancedMesh(carGeo, cityMaterial(u, { vertexColors: false }), FLEET)
  const carColours = [[245, 237, 219], [72, 86, 92], [185, 144, 89], [57, 63, 61], [212, 162, 78]]
  for (let k = 0; k < FLEET; k++) cars.setColorAt(k, new T.Color(...c(carColours[k % carColours.length])))
  cars.frustumCulled = false
  cars.castShadow = true
  root.add(cars)

  // Cloud shadows: soft dark discs sliding over the city.
  const cloudTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128
    const g = cv.getContext('2d')!
    const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64)
    gr.addColorStop(0, 'rgba(30,40,50,0.14)'); gr.addColorStop(1, 'rgba(30,40,50,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
    return new T.CanvasTexture(cv)
  })()
  const clouds: T.Mesh[] = []
  for (let k = 0; k < 6; k++) {
    const m = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false }))
    m.renderOrder = 3
    clouds.push(m); root.add(m)
  }

  /*
   * HQ's crown: outside the night tint, so HQ is always the highest lit floor
   * (§6), and a beacon on its spire that says *home* from ten blocks away.
   */
  const [hx, hz] = blockOrigin(0, 0)
  const H = HQ_TOWER
  const topX = hx + H.dx + H.setback, topZ = hz + H.dz + H.setback
  const topW = H.w - H.setback * 2, topD = H.d - H.setback * 2
  const topY = (H.floors + H.upper) * FLOOR_H
  const crown = new T.Mesh(new T.BoxGeometry(topW + 0.4, 3.2, topD + 0.4), new T.MeshBasicMaterial({ color: new T.Color('#e0b25e') }))
  crown.position.set(topX + topW / 2, topY + 1.6, topZ + topD / 2)
  if (!opts.backdrop && !opts.colony) root.add(crown)
  const beacon = new T.Points(
    new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([hx + H.dx + H.w / 2, topY + 3.2 + 16.5, hz + H.dz + H.d / 2], 3)),
    new T.PointsMaterial({ color: new T.Color('#ff5a3c'), size: 6, sizeAttenuation: false, transparent: true, depthWrite: false }),
  )
  if (!opts.backdrop && !opts.colony) root.add(beacon)

  /*
   * **Opening an office is an event** — §6 [amended 2026-09-26]: *"it should
   * be rewarding to add new buildings"*. A block the studio moves into near the
   * view is taken out of its chunk and drawn on its own, rising out of the
   * ground with an overshoot, then folded back in. The scene puts the office's
   * name over it (`drainOpened`). Twelve at once at most: at 100M a single hire
   * opens hundreds of blocks, and the few in view are the ones worth a show.
   */
  const RISE_SECONDS = 2.4
  const rising = new Map<string, { i: number; j: number; start: number; mesh: T.Mesh }>()
  const world = { colony: !!opts.colony, wild: skin.wild }
  let lastOpen = -1
  let opened: OfficeAnchor[] = []
  let anchors: OfficeAnchor[] = []
  let anchorKey = ''

  /*
   * **Build sparks** — the work, visible. A finished build leaves an office
   * roof and arcs home to HQ in the Ledger's *work* colour, as many as the
   * studio is working: a studio losing most of its heads to meetings sends up a
   * thin trickle, and a well-run one a stream.
   */
  const SPARKS = 120
  const sparkPos = new Float32Array(SPARKS * 3)
  const sparkGeo = new T.BufferGeometry()
  sparkGeo.setAttribute('position', new T.BufferAttribute(sparkPos, 3))
  // A round glow, not a square point: a white core in a green halo reads on
  // the pale day city and glows over the night one (measured: plain 6 px
  // points were invisible by day, 2026-09-26).
  const sparkTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64
    const g = cv.getContext('2d')!
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(210,255,225,1)')
    gr.addColorStop(0.5, 'rgba(60,200,110,0.75)'); gr.addColorStop(1, 'rgba(40,160,90,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
    return new T.CanvasTexture(cv)
  })()
  const sparkMat = new T.PointsMaterial({ size: 14, map: sparkTex, sizeAttenuation: false, transparent: true, depthWrite: false, depthTest: false })
  const sparks = new T.Points(sparkGeo, sparkMat)
  sparks.frustumCulled = false
  sparks.renderOrder = 4
  root.add(sparks)
  const [hqX0, hqZ0] = blockOrigin(0, 0)
  const home = opts.colony
    ? [hqX0 + 40, 16, hqZ0 + 24]
    : [hqX0 + HQ_TOWER.dx + HQ_TOWER.w / 2, (HQ_TOWER.floors + HQ_TOWER.upper) * FLOOR_H + 8, hqZ0 + HQ_TOWER.dz + HQ_TOWER.d / 2]

  const chunks = new Map<string, Chunk>()
  const sky = new T.Color()
  let lastLamps = ''
  const tmp = new T.Object3D()
  const handle: EndlessCity = {
    root,
    sky,
    night: 0,
    offices: () => anchors,
    drainOpened() { const out = opened; opened = []; return out },
    update(f) {
      const fixed = f.tod ?? skin.tod ?? undefined
      const { dusk, night } = fixed !== undefined ? daylight(fixed * DAY_SECONDS) : daylight(f.t)
      handle.night = night
      sky.setRGB(...c(mix(mix(skin.sky.day, skin.sky.dusk, dusk), skin.sky.night, night)))
      // The fog rings the view: clear across most of it, gone before the corners.
      const near = Math.max(180, f.span * 0.42)
      const far = Math.max(380, f.span * 0.8)
      // The fog is measured in world space: offset by wherever the city's root stands.
      u.uFocus.value.set(f.x + root.position.x, f.z + root.position.z)
      u.uFogNear.value = near
      u.uFogFar.value = far
      u.uFogColor.value.copy(sky)
      u.uNight.value = night
      u.uDusk.value = dusk
      u.uTime.value = f.t
      ;(beacon.material as T.PointsMaterial).opacity = Math.sin(f.t * 3) > 0 ? 1 : 0.2

      // The state lights, cumulative, in the Ledger's order.
      const b = f.breakdown
      let acc = 0
      ;(['work', ...LOSS_KINDS] as const).forEach((k, idx) => { acc += b ? b[k] : (k === 'work' ? 1 : 0); u.uCum.value[idx] = Math.min(1, acc) })
      u.uCum.value[7] = 1.01
      const avg = u.uAvg.value.setRGB(0, 0, 0)
      ;(['work', ...LOSS_KINDS] as const).forEach((k, idx) => {
        const share = b ? b[k] : (k === 'work' ? 1 : 0)
        avg.r += u.uCol.value[idx].r * share; avg.g += u.uCol.value[idx].g * share; avg.b += u.uCol.value[idx].b * share
      })

      ground.position.set(f.x, -0.02, f.z)
      ground.scale.set(far * 2.8, 1, far * 2.8)

      // Which chunks the fog lets you see; the nearest missing one is built.
      const reach = far + PITCH_X * 2
      const ci0 = Math.floor((f.x - reach) / (PITCH_X * CHUNK)), ci1 = Math.floor((f.x + reach) / (PITCH_X * CHUNK))
      const cj0 = Math.floor((f.z - reach) / (PITCH_Z * CHUNK)), cj1 = Math.floor((f.z + reach) / (PITCH_Z * CHUNK))
      const frontier = frontierIndex(f.heads)
      const wanted = new Set<string>()
      let best: [number, number, number] | null = null
      for (let ci = ci0; ci <= ci1; ci++) for (let cj = cj0; cj <= cj1; cj++) {
        const key = ci + ',' + cj
        wanted.add(key)
        const d = Math.hypot((ci + 0.5) * PITCH_X * CHUNK - f.x, (cj + 0.5) * PITCH_Z * CHUNK - f.z)
        const have = chunks.get(key)
        if ((!have || have.signature !== chunkSignature(ci, cj, f.heads, frontier, rising)) && (!best || d < best[0])) best = [d, ci, cj]
      }
      for (const [key, ch] of chunks) if (!wanted.has(key)) { disposeChunk(ch); chunks.delete(key) }
      for (let n = 0; n < BUILDS_PER_FRAME && best; n++) {
        const [, ci, cj] = best
        const key = ci + ',' + cj
        const old = chunks.get(key)
        if (old) disposeChunk(old)
        chunks.set(key, buildChunk(ci, cj, f.heads, frontier))
        best = null
      }

      // Lamps at the corners near the view, rebuilt only when the view crosses a block.
      const bi = Math.round(f.x / PITCH_X), bj = Math.round(f.z / PITCH_Z)

      // §6 [2026-09-26] — newly opened offices near the view rise; far ones just appear.
      const open = officesOpen(f.heads)
      if (lastOpen >= 0 && open > lastOpen && !opts.backdrop) {
        for (let k = Math.max(lastOpen + 1, open - 400); k <= open; k++) {
          const [i, j] = officeCell(k)
          const [ox, oz] = blockOrigin(i, j)
          if (Math.hypot(ox + LOT_W / 2 - f.x, oz + LOT_D / 2 - f.z) > near) continue
          const [x, y, z] = builtRoof(i, j, f.heads)
          if (startRise(i, j, f.t, f.heads, frontier)) opened.push({ i, j, ordinal: k, x: x + root.position.x, y: y + root.position.y, z: z + root.position.z })
        }
      }
      lastOpen = open
      for (const [key, r] of rising) {
        const p = (f.t - r.start) / RISE_SECONDS
        if (p >= 1 || p < 0) {
          rising.delete(key)
          rebuildChunkOf(r.i, r.j, f.heads, frontier)
          root.remove(r.mesh); r.mesh.geometry.dispose()
          continue
        }
        // Out of the ground and a little past, then settling: a building
        // arriving, not a bar filling. Slow enough to be watched rise.
        const q = Math.min(1, p / 0.8)
        r.mesh.scale.y = Math.max(0.02, p < 0.8 ? q * q * (3 - 2 * q) * 1.05 : 1.05 - 0.05 * ((p - 0.8) / 0.2))
      }

      // The offices in reach of the view, refreshed when the view crosses a block or the studio grows.
      const anchorsAt = `${bi},${bj},${Math.round(near / 50)},${open}`
      if (anchorsAt !== anchorKey) {
        anchorKey = anchorsAt
        anchors = []
        const r = Math.ceil(near / PITCH_X)
        for (let i = bi - r; i <= bi + r; i++) for (let j = bj - r; j <= bj + r; j++) {
          if (blockKind(i, j, f.heads, frontier) !== 'built') continue
          const [ox, oz] = blockOrigin(i, j)
          if (Math.hypot(ox + LOT_W / 2 - f.x, oz + LOT_D / 2 - f.z) > near) continue
          const [x, y, z] = builtRoof(i, j, f.heads)
          anchors.push({ i, j, ordinal: officeOrdinal(i, j), x: x + root.position.x, y: y + root.position.y, z: z + root.position.z })
        }
      }

      // Build sparks, as many as the studio is working.
      const working = f.breakdown ? f.breakdown.work : 1
      // A floor under the stream: even a studio losing four-fifths of its heads ships something.
      const live = anchors.length && !opts.backdrop ? Math.round(SPARKS * Math.min(1, 0.15 + working)) : 0
      sparkMat.size = Math.max(11, Math.min(20, 9 + f.pxPerMetre * 3))
      const flight = 2.8
      for (let k = 0; k < SPARKS; k++) {
        if (k >= live) { sparkPos[k * 3 + 1] = -1e4; continue }
        const phase = rand(k, 50) * flight
        const cycle = Math.floor((f.t + phase) / flight)
        const p = (f.t + phase) / flight - cycle
        const o = anchors[Math.floor(rand(k * 131 + cycle, 51) * anchors.length)]
        const ox = o.x - root.position.x, oy = o.y - root.position.y, oz = o.z - root.position.z
        const dist = Math.hypot(home[0] - ox, home[2] - oz)
        const e = p * p * (3 - 2 * p)
        sparkPos[k * 3] = lerp(ox, home[0], e)
        sparkPos[k * 3 + 1] = lerp(oy, home[1], e) + Math.sin(Math.PI * p) * Math.min(260, 30 + dist * 0.35)
        sparkPos[k * 3 + 2] = lerp(oz, home[2], e)
      }
      sparkGeo.attributes.position.needsUpdate = true
      const lampKey = `${bi},${bj},${Math.round(far / 100)}`
      if (lampKey !== lastLamps) {
        lastLamps = lampKey
        const pos: number[] = []
        const r = Math.ceil(far / PITCH_X) + 1
        for (let i = bi - r; i <= bi + r; i++) for (let j = bj - r; j <= bj + r; j++) {
          const [x0, z0] = blockOrigin(i, j)
          pos.push(x0 - 6, 5, z0 - 6)
        }
        lamps.geometry.dispose()
        lamps.geometry = new T.BufferGeometry()
        lamps.geometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
      }
      lampMat.opacity = Math.min(1, night * 1.2 + dusk * 0.3)
      lampMat.size = Math.max(2, Math.min(6, f.pxPerMetre * 1.2))

      // Traffic: each car runs its own street on a loop through the view.
      for (let k = 0; k < FLEET; k++) {
        const horizontal = rand(k, 1) < 0.5
        const lane = Math.floor((rand(k, 2) - 0.5) * 2 * (far / (horizontal ? PITCH_Z : PITCH_X)))
        const speed = (9 + rand(k, 3) * 7) * (rand(k, 4) < 0.5 ? 1 : -1)
        const length = far * 2.4
        const along = (((rand(k, 5) * length + f.t * speed) % length) + length) % length - length / 2
        if (horizontal) {
          const z = (Math.round(f.z / PITCH_Z) + lane) * PITCH_Z - LOT_D / 2 - 7 + (speed > 0 ? -2.5 : 2.5)
          tmp.position.set(f.x + along, 0.75, z); tmp.rotation.set(0, 0, 0)
        } else {
          const x = (Math.round(f.x / PITCH_X) + lane) * PITCH_X - LOT_W / 2 - 9 + (speed > 0 ? 2.5 : -2.5)
          tmp.position.set(x, 0.75, f.z + along); tmp.rotation.set(0, Math.PI / 2, 0)
        }
        tmp.updateMatrix()
        cars.setMatrixAt(k, tmp.matrix)
      }
      cars.instanceMatrix.needsUpdate = true

      // Cloud shadows drift east-north-east and wrap round the view.
      clouds.forEach((m, k) => {
        const size = 300 + rand(k, 9) * 280
        const wrap = far * 3
        const ox = ((((rand(k, 7) - 0.5) * wrap + f.t * 6) % wrap) + wrap) % wrap - wrap / 2
        const oz = ((((rand(k, 8) - 0.5) * wrap + f.t * 2.5) % wrap) + wrap) % wrap - wrap / 2
        m.position.set(Math.round(f.x / wrap) * wrap + ox, 80 + k, Math.round(f.z / wrap) * wrap + oz)
        m.scale.set(size, 1, size * 0.7)
        ;(m.material as T.MeshBasicMaterial).opacity = 1 - night * 0.9
      })
    },
    dispose() {
      for (const ch of chunks.values()) disposeChunk(ch)
      chunks.clear()
      for (const r of rising.values()) { root.remove(r.mesh); r.mesh.geometry.dispose() }
      rising.clear()
      sparkGeo.dispose(); sparkMat.dispose(); sparkTex.dispose()
      solid.dispose(); lampMat.dispose(); cloudTex.dispose(); carGeo.dispose()
      ;(ground.material as T.Material).dispose(); ground.geometry.dispose(); lamps.geometry.dispose()
      ;(cars.material as T.Material).dispose()
      crown.geometry.dispose(); (crown.material as T.Material).dispose(); beacon.geometry.dispose(); (beacon.material as T.Material).dispose()
      clouds.forEach(m => { m.geometry.dispose(); (m.material as T.Material).dispose() })
    },
  }

  function buildChunk(ci: number, cj: number, heads: number, frontier: number): Chunk {
    const m = new Mesher()
    for (let di = 0; di < CHUNK; di++) for (let dj = 0; dj < CHUNK; dj++) {
      const i = ci * CHUNK + di, j = cj * CHUNK + dj
      if (rising.has(i + ',' + j)) continue
      buildBlock(m, i, j, blockKind(i, j, heads, frontier), heads, !opts.backdrop, world)
    }
    const mesh = new T.Mesh(m.geometry(), solid)
    mesh.castShadow = true
    mesh.receiveShadow = true
    root.add(mesh)
    return { signature: chunkSignature(ci, cj, heads, frontier, rising), mesh }
  }

  /** Rebuild the loaded chunk holding block (i, j) now, not in its turn: a rise's hand-over. */
  function rebuildChunkOf(i: number, j: number, heads: number, frontier: number) {
    const ci = Math.floor(i / CHUNK), cj = Math.floor(j / CHUNK)
    const key = ci + ',' + cj
    const old = chunks.get(key)
    if (!old) return
    disposeChunk(old)
    chunks.set(key, buildChunk(ci, cj, heads, frontier))
  }

  function startRise(i: number, j: number, t: number, heads: number, frontier: number): boolean {
    const key = i + ',' + j
    if (rising.has(key) || rising.size >= 12) return false
    if (!chunks.has(Math.floor(i / CHUNK) + ',' + Math.floor(j / CHUNK))) return false
    const m = new Mesher()
    buildBlock(m, i, j, 'built', heads, !opts.backdrop, world)
    const mesh = new T.Mesh(m.geometry(), solid)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.scale.y = 0.02
    root.add(mesh)
    rising.set(key, { i, j, start: t, mesh })
    rebuildChunkOf(i, j, heads, frontier)
    return true
  }

  function disposeChunk(ch: Chunk) {
    root.remove(ch.mesh)
    ch.mesh.geometry.dispose()
  }

  return handle
}
