import * as T from 'three'
import { M, R, BLOCK, HQ_FACE, HQ_BLOCK, TPB } from './grid.ts'
import { HEX, glslColour } from './palette.ts'

/**
 * The planet's surface: the cube-sphere of blocks from `grid.ts`, drawn in the
 * shader so a street is the same street at every zoom.
 *
 * A block nobody has reached is surveyed ground — dark, with the grid faintly
 * pegged out and a dim zoning lamp at each corner — so the planet reads as a
 * city plan before it is a city, and the whole ball has structure from orbit.
 * A settled block gets its streets, pavements and warm lamp pools; the
 * frontier (part-filled) glows amber, because that is where the building is.
 *
 * `blocks` is a 6M x M texture, one texel per block: R = how full it is.
 */
export interface Ground {
  mesh: T.Mesh
  atmosphere: T.Mesh
  blocks: T.DataTexture
  data: Uint8Array
  uniforms: {
    uCam: { value: T.Vector3 }
    uTime: { value: number }
    uMoon: { value: T.Vector3 }
    uFogNear: { value: number }
    uFogFar: { value: number }
    uPhosphor: { value: number }
    uP0: { value: T.Color }
    uP1: { value: T.Color }
    uP2: { value: T.Color }
  }
  setBlock(block: number, fill: number): void
}

const CUBE = /* glsl */ `
  const float PI = 3.14159265;
  void cube(vec3 p, out float face, out vec2 ab) {
    vec3 a = abs(p);
    vec3 n; vec3 u; vec3 v;
    if (a.x >= a.y && a.x >= a.z) {
      if (p.x > 0.0) { face = 0.0; n = vec3(1.0, 0.0, 0.0); u = vec3(0.0, 0.0, -1.0); v = vec3(0.0, 1.0, 0.0); }
      else { face = 1.0; n = vec3(-1.0, 0.0, 0.0); u = vec3(0.0, 0.0, 1.0); v = vec3(0.0, 1.0, 0.0); }
    } else if (a.y >= a.z) {
      if (p.y > 0.0) { face = 2.0; n = vec3(0.0, 1.0, 0.0); u = vec3(1.0, 0.0, 0.0); v = vec3(0.0, 0.0, 1.0); }
      else { face = 3.0; n = vec3(0.0, -1.0, 0.0); u = vec3(1.0, 0.0, 0.0); v = vec3(0.0, 0.0, -1.0); }
    } else {
      if (p.z > 0.0) { face = 4.0; n = vec3(0.0, 0.0, 1.0); u = vec3(1.0, 0.0, 0.0); v = vec3(0.0, 1.0, 0.0); }
      else { face = 5.0; n = vec3(0.0, 0.0, -1.0); u = vec3(-1.0, 0.0, 0.0); v = vec3(0.0, 1.0, 0.0); }
    }
    float dn = dot(p, n);
    ab = vec2(atan(dot(p, u) / dn), atan(dot(p, v) / dn)) * 4.0 / PI;
  }`

export const CUBE_GLSL = CUBE

const VERT = /* glsl */ `
  varying vec3 vDir;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vDir = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }`

const FRAG = /* glsl */ `
  uniform sampler2D uBlocks;
  uniform vec3 uCam;
  uniform float uTime;
  uniform vec3 uMoon;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uPhosphor;
  uniform vec3 uP0;
  uniform vec3 uP1;
  uniform vec3 uP2;
  uniform float uLoss;
  uniform vec4 uCdfA;
  uniform vec4 uCdfB;
  uniform vec3 uStates[8];
  varying vec3 vDir;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  ${CUBE}
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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
    float face; vec2 ab;
    cube(normalize(vDir), face, ab);
    vec2 g = (ab + 1.0) * 0.5 * ${M.toFixed(1)};
    vec2 cell = min(floor(g), vec2(${(M - 1).toFixed(1)}));
    vec2 f = g - cell;
    vec2 tuv = vec2((face * ${M.toFixed(1)} + cell.x + 0.5) / ${(6 * M).toFixed(1)}, (cell.y + 0.5) / ${M.toFixed(1)});
    float fill = texture2D(uBlocks, tuv).r;
    bool hq = face == ${HQ_FACE.toFixed(1)} && cell.x == ${HQ_BLOCK.toFixed(1)} && cell.y == ${HQ_BLOCK.toFixed(1)};

    // Metres from the block's edge, and along it — the block is ${BLOCK} m.
    vec2 m = f * ${BLOCK.toFixed(1)};
    vec2 e = min(m, ${BLOCK.toFixed(1)} - m);
    float edge = min(e.x, e.y);
    float along = e.x < e.y ? m.y : m.x;
    // Lanes between the three-by-three towers of a block.
    vec2 inner = (m - 10.0) / ${(100 / TPB).toFixed(3)};
    vec2 lane2 = abs(fract(inner + 0.5) - 0.5) * ${(100 / TPB).toFixed(3)};
    float alley = min(lane2.x, lane2.y);
    float px = max(fwidth(g.x), fwidth(g.y)) * ${BLOCK.toFixed(1)};

    vec3 N = normalize(vNormalW);
    float light = 0.45 + 0.55 * max(dot(N, uMoon), 0.0);
    float settled = step(0.001, fill);
    vec3 col;
    float glow = 0.0;

    // Surveyed, empty ground.
    vec3 bare = ${glslColour(HEX.n1)} * (0.42 + 0.1 * hash2(cell + face * 17.0)) * light;
    float peg = 1.0 - smoothstep(0.0, max(px * 1.5, 0.6), edge - 0.6);
    bare += ${glslColour(HEX.n3)} * 0.22 * peg;
    // A point light that gets smaller than a pixel gets dimmer, not bigger:
    // spread over sigma, and scaled by the area it has to cover.
    float cs = max(px * 0.8, 0.9);
    float corner = exp(-dot(e, e) / (2.0 * cs * cs)) * min(1.0, 0.81 / (cs * cs));
    bare += ${glslColour(HEX.warn[1])} * corner * 1.4;

    // A settled block: street, pavement, lots, a lane between its four towers.
    vec3 street = ${glslColour(HEX.n1)} * 0.85 * light;
    float dash = step(0.5, fract(along / 6.0)) * (1.0 - smoothstep(0.0, max(px, 0.15), abs(edge - 0.0) - 0.12));
    street += ${glslColour(HEX.n4)} * 0.18 * dash;
    vec3 pave = ${glslColour(HEX.n2)} * 1.05 * light;
    vec3 lot = mix(${glslColour(HEX.n2)}, ${glslColour(HEX.n1)}, 0.55) * light;
    if (hq) lot = ${glslColour(HEX.n3)} * 0.9 * light;
    vec3 built = edge < 9.0 ? street : edge < 13.0 ? pave : (alley < 2.5 ? pave * 0.8 : lot);
    // Lamp pools every 24 m down each pavement, and the lamp heads for the bloom.
    float lampRow = exp(-pow(edge - 11.0, 2.0) / 18.0);
    float period = 0.5 + 0.5 * cos(along / 24.0 * 6.28318);
    built += ${glslColour(HEX.lamp)} * lampRow * period * 0.22;
    vec2 hv = vec2(edge - 11.0, (fract(along / 24.0 + 0.5) - 0.5) * 24.0);
    float hs = max(px * 0.8, 0.35);
    float head = exp(-dot(hv, hv) / (2.0 * hs * hs)) * min(1.0, 0.1225 / (hs * hs));
    glow = head * 3.0;
    built += ${glslColour(HEX.lamp)} * glow;
    // The frontier is lit by its building sites.
    float frontier = fill > 0.001 && fill < 0.999 ? 1.0 : 0.0;
    built += ${glslColour(HEX.warn[2])} * frontier * 0.08;

    // Far away a block is a few pixels: its average, not its pattern.
    vec3 bareAvg = ${glslColour(HEX.n1)} * 0.45 * light + ${glslColour(HEX.warn[1])} * 0.02;
    // From orbit a settled block is its lights: warm lamps, a little monitor blue.
    // From orbit a city at night is its lit streets: dark blocks, a web of lamp
    // light along every street, brighter where the block is full. The web holds
    // until a street is well under a pixel, and only then averages to a glow.
    float streetW = 1.0 - smoothstep(max(px * 0.9, 9.0), max(px * 1.9, 11.0), edge);
    float web = streetW * min(1.0, 9.0 / max(px, 9.0) * 2.2);
    vec3 night = ${glslColour(HEX.n1)} * 0.28 * light + ${glslColour(HEX.lamp)} * (0.12 + 0.2 * fill) * hash2(cell + face * 31.0)
      + ${glslColour(HEX.lamp)} * web * (0.55 + 0.45 * fill) + ${glslColour(HEX.screen)} * web * 0.08
      + ${glslColour(HEX.warn[2])} * frontier * 0.16;
    vec3 builtAvg = ${glslColour(HEX.n1)} * 0.3 * light + (${glslColour(HEX.lamp)} * 0.36 + ${glslColour(HEX.screen)} * 0.08) * (0.35 + 0.65 * fill) + ${glslColour(HEX.warn[2])} * frontier * 0.16;
    float lod = smoothstep(${(BLOCK / 18).toFixed(1)}, ${(BLOCK / 5).toFixed(1)}, px);
    float lod2 = smoothstep(${(BLOCK / 5).toFixed(1)}, ${(BLOCK / 1.2).toFixed(1)}, px);
    vec3 farBuilt = mix(night, builtAvg, lod2);
    // The loss view reaches orbit: each block glows the colour of what its people
    // are doing, so a hundred million reads as a patchwork of meetings (blue, the
    // biggest slice), waiting and duplicate work (ambers) and handoffs (teal).
    vec3 lossLight = stateColour(hash2(cell * 1.37 + face * 13.0)) * (0.3 + 0.45 * fill) * (0.6 + 0.8 * web);
    farBuilt = mix(farBuilt, ${glslColour(HEX.n1)} * 0.25 + lossLight, uLoss);
    col = mix(settled > 0.5 ? built : bare, settled > 0.5 ? farBuilt : bareAvg, lod);

    if (uPhosphor > 0.5) {
      // The monitor's and the swarm's globe: the street grid in the live
      // phosphor (ART_DIRECTION §1.1, one hue at a time), brighter where settled.
      float grid = 1.0 - smoothstep(0.0, max(px * 1.2, 0.8), edge - 0.4);
      vec3 ph = uP0 * 0.7 + uP1 * grid * (0.3 + 0.7 * settled) + uP2 * min(1.0, corner * 3.0) * 0.5;
      // The map keeps a district grid (every seventh street) and each block's
      // density, so from orbit the colonised area reads as a map, not a disc.
      vec2 dg = g / 7.0;
      vec2 de = min(fract(dg), 1.0 - fract(dg)) * 7.0 * ${BLOCK.toFixed(1)};
      float district = 1.0 - smoothstep(max(px * 0.8, 6.0), max(px * 1.8, 8.0), min(de.x, de.y));
      float dens = 0.55 + 0.45 * hash2(cell + face * 17.0);
      vec3 far = uP0 * 0.8 + (uP1 * 0.5 * dens + uP2 * 0.22) * settled * (0.4 + 0.6 * fill) - uP1 * district * settled * 0.35 + uP2 * district * (1.0 - settled) * 0.25;
      col = mix(ph, far, lod);
      if (uPhosphor > 1.5) {
        // The swarm's globe is only the stage for the people on it: dim, no hue.
        float g2 = grid * (0.25 + 0.5 * settled);
        col = mix(${glslColour(HEX.n1)} * 0.35 + ${glslColour(HEX.n3)} * g2 * 0.35, ${glslColour(HEX.n1)} * (0.35 + 0.25 * settled), lod);
      }
    }

    float dist = length(vWorld - uCam);
    float fog = smoothstep(uFogNear, uFogFar, dist);
    col = mix(col, ${glslColour(HEX.n1)} * 0.55, fog * 0.85);
    col = any(isnan(col)) ? vec3(0.0) : clamp(col, 0.0, 4.0);
    gl_FragColor = vec4(col, 1.0);
  }`

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }`
const ATMO_FRAG = /* glsl */ `
  uniform vec3 uCam;
  uniform vec3 uTint;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  void main() {
    vec3 v = normalize(uCam - vWorld);
    float rim = pow(1.0 - abs(dot(normalize(vNormalW), v)), 3.0);
    gl_FragColor = vec4(uTint * rim * 0.9, rim);
  }`

export function createGround(radius = R, segments = 256, tint = HEX.glow1): Ground {
  const data = new Uint8Array(6 * M * M * 4)
  const blocks = new T.DataTexture(data, 6 * M, M, T.RGBAFormat)
  blocks.magFilter = T.NearestFilter
  blocks.minFilter = T.NearestFilter
  blocks.needsUpdate = true
  const uniforms = {
    uBlocks: { value: blocks },
    uCam: { value: new T.Vector3() },
    uTime: { value: 0 },
    uMoon: { value: new T.Vector3(-0.4, 0.8, 0.45).normalize() },
    uFogNear: { value: 1e4 },
    uFogFar: { value: 2e4 },
    uPhosphor: { value: 0 },
    uP0: { value: new T.Color(HEX.calm[0]) },
    uP1: { value: new T.Color(HEX.calm[1]) },
    uP2: { value: new T.Color(HEX.calm[2]) },
    uLoss: { value: 0 },
    uCdfA: { value: new T.Vector4(1, 1, 1, 1) },
    uCdfB: { value: new T.Vector4(1, 1, 1, 1) },
    uStates: { value: [0, 1, 2, 3, 4, 5, 6, 7].map(() => new T.Color()) },
  }
  const material = new T.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG })
  // The ball sits a few centimetres under the plane the garage was drawn on.
  const mesh = new T.Mesh(new T.SphereGeometry(radius - 0.62, segments, segments / 2), material)
  const atmosphere = new T.Mesh(
    new T.SphereGeometry(radius * 1.035, 96, 48),
    new T.ShaderMaterial({
      uniforms: { uCam: uniforms.uCam, uTint: { value: new T.Color(tint) } },
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
      side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    }))
  return {
    mesh, atmosphere, blocks, data,
    uniforms: uniforms as Ground['uniforms'],
    setBlock(block, fill) {
      const face = Math.floor(block / (M * M))
      const rem = block - face * M * M
      const j = Math.floor(rem / M), i = rem - j * M
      const x = face * M + i
      data[(j * 6 * M + x) * 4] = Math.round(Math.max(0, Math.min(1, fill)) * 255)
      blocks.needsUpdate = true
    },
  }
}
