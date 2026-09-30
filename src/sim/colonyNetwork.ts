function rnd(i: number, salt: number) { let n = Math.imul(i ^ salt * 374761393, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296 }

/**
 * **The colony network — a Stellaris-style map of where the studio lives.**
 *
 * The user, 2026-09-27: *"the milky way is good but it's kind of unnecssary
 * details for us at this point, we can make it a stellaris style colony
 * network"*. So the top of the ladder is a map, not a galaxy: star systems
 * joined by lanes, the studio's territory with a border round it, and fog past
 * the frontier. It is drawn on the monitor like everything above the block.
 *
 * - **Real stars first.** Sol is world 0 and Proxima Centauri world 1, at the
 *   real 4.24 ly (§7.7.1a, §21.8). The named neighbours sit at their real
 *   distances from Sol, in the direction their right ascension points; the map
 *   is a drawing of a volume, so distance from home is kept and height is not.
 * - **Lanes are a Gabriel graph**, thinned: planar, never crossing, a few per
 *   system — the look of a strategy map rather than a web.
 * - **A world holds 100,000,000**, like Earth, and the next world is the
 *   nearest along the lanes from the territory (Dijkstra from Sol). Nobody
 *   routes freight or picks planets: hiring fills them, which is §7.7.1a's
 *   "not a colony manager" kept.
 *
 * Pure: no renderer, no store. Positions are light-years on the map plane.
 */
export const WORLD_SEATS = 100_000_000

export interface System {
  name: string
  /** Map position, light-years from Sol. */
  x: number
  z: number
  /** Distance from Sol, light-years (the light-lag in years, §16.0a). */
  ly: number
  real: boolean
}

export interface Network {
  systems: System[]
  lanes: [number, number][]
  /** Systems in the order they are settled: order[0] is Sol, order[1] Proxima. */
  order: number[]
  /** World index of each system, or -1 if it is never reached. */
  worldOf: Int32Array
  /** For the stream of arrivals: the lane path from Sol to each system. */
  parent: Int32Array
  neighbours: number[][]
}

/** Name, distance (ly) and right ascension (hours). */
const REAL: readonly [string, number, number][] = [
  ['Proxima Centauri', 4.24, 14.49], ['Alpha Centauri', 4.37, 14.66], ["Barnard's Star", 5.96, 17.96],
  ['Wolf 359', 7.86, 10.94], ['Lalande 21185', 8.31, 11.06], ['Sirius', 8.6, 6.75], ['Luyten 726-8', 8.73, 1.65],
  ['Ross 154', 9.69, 18.83], ['Ross 248', 10.3, 23.7], ['Epsilon Eridani', 10.5, 3.55], ['Lacaille 9352', 10.7, 23.1],
  ['Ross 128', 11.0, 11.8], ['EZ Aquarii', 11.1, 22.65], ['61 Cygni', 11.4, 21.12], ['Procyon', 11.46, 7.65],
  ['Struve 2398', 11.5, 18.71], ['Groombridge 34', 11.6, 0.3], ['Epsilon Indi', 11.8, 22.05], ['DX Cancri', 11.8, 8.5],
  ['Tau Ceti', 11.9, 1.73], ['GJ 1061', 12.0, 3.6], ['YZ Ceti', 12.1, 1.2], ["Luyten's Star", 12.2, 7.45],
  ["Teegarden's Star", 12.5, 2.89], ["Kapteyn's Star", 12.8, 5.19], ['Lacaille 8760', 12.9, 21.28], ['Kruger 60', 13.1, 22.47],
  ['Wolf 1061', 14.0, 16.5], ["Van Maanen's Star", 14.1, 0.82], ['Gliese 1', 14.2, 0.09], ['Gliese 687', 14.8, 17.6],
  ['Gliese 674', 14.8, 17.48], ['Gliese 876', 15.2, 22.88], ['Altair', 16.7, 19.85], ['70 Ophiuchi', 16.6, 18.09],
  ['Gliese 832', 16.2, 21.55], ['Sigma Draconis', 18.8, 19.54], ['Eta Cassiopeiae', 19.4, 0.82], ['36 Ophiuchi', 19.5, 17.26],
  ['82 Eridani', 19.7, 3.33], ['Delta Pavonis', 19.9, 20.15], ['Gliese 581', 20.5, 15.32], ['Xi Bootis', 22.0, 14.85],
  ['Gliese 667', 23.6, 17.32], ['Beta Hydri', 24.3, 0.43], ['Vega', 25.0, 18.62], ['Fomalhaut', 25.1, 22.96],
  ['Beta Canum Venaticorum', 27.4, 12.56], ['61 Virginis', 27.9, 13.31], ['Zeta Tucanae', 28.0, 0.33],
  ['Pollux', 33.8, 7.76], ['Gliese 86', 35.2, 2.17], ['Arcturus', 36.7, 14.26], ['Denebola', 36.0, 11.82],
  ['TRAPPIST-1', 40.7, 23.1], ['55 Cancri', 41.0, 8.88], ['HD 40307', 42.0, 5.9], ['Capella', 42.9, 5.28],
  ['Upsilon Andromedae', 44.0, 1.61], ['47 Ursae Majoris', 45.9, 10.99], ['51 Pegasi', 50.9, 22.95],
  ['Tau Bootis', 51.0, 13.79], ['Castor', 51.0, 7.58], ['Aldebaran', 65.0, 4.6], ['Regulus', 79.0, 10.14],
]

const PREFIX = ['HD', 'GJ', 'HIP', 'LHS', 'Wolf', 'Ross', 'LP', 'G', 'Kepler', 'TOI']

export function buildNetwork(seed: number, radius = 95, count = 420): Network {
  const systems: System[] = [{ name: 'Sol', x: 0, z: 0, ly: 0, real: true }]
  for (const [name, ly, ra] of REAL) {
    if (ly > radius) continue
    const a = (ra / 24) * Math.PI * 2
    systems.push({ name, x: Math.cos(a) * ly, z: Math.sin(a) * ly, ly, real: true })
  }
  // The rest, dart-thrown: denser in clusters, never closer than 3.4 ly to a
  // neighbour, so the map has both crowds and voids to steer through.
  let tries = 0
  while (systems.length < count && tries < count * 60) {
    tries++
    const i = tries
    const r = Math.sqrt(rnd(seed * 97 + i, 41)) * radius
    if (r < 13) continue
    const t = rnd(seed * 97 + i, 42) * Math.PI * 2
    const x = Math.cos(t) * r, z = Math.sin(t) * r
    const cluster = 0.5 + 0.5 * Math.sin(x * 0.09 + seed) * Math.cos(z * 0.08 - seed * 0.7)
    if (rnd(seed * 97 + i, 43) > 0.35 + 0.65 * cluster) continue
    if (systems.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 3.4 * 3.4)) continue
    const p = PREFIX[Math.floor(rnd(seed * 97 + i, 44) * PREFIX.length)]
    const num = 100 + Math.floor(rnd(seed * 97 + i, 45) * 89900)
    systems.push({ name: `${p} ${num}`, x, z, ly: Math.round(r * 10) / 10, real: false })
  }

  // Gabriel graph: i-j is a lane when no other system sits inside the circle
  // whose diameter is i-j. Planar by construction.
  const n = systems.length
  const lanes: [number, number][] = []
  const near = (i: number, k: number) => systems
    .map((s, j) => ({ j, d: (s.x - systems[i].x) ** 2 + (s.z - systems[i].z) ** 2 }))
    .filter((e) => e.j !== i).sort((a, b) => a.d - b.d).slice(0, k).map((e) => e.j)
  const seen = new Set<string>()
  for (let i = 0; i < n; i++) {
    for (const j of near(i, n - 1)) {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`
      if (seen.has(key)) continue
      seen.add(key)
      const mx = (systems[i].x + systems[j].x) / 2, mz = (systems[i].z + systems[j].z) / 2
      const r2 = ((systems[i].x - systems[j].x) ** 2 + (systems[i].z - systems[j].z) ** 2) / 4
      let empty = true
      for (let k = 0; k < n && empty; k++) {
        if (k === i || k === j) continue
        if ((systems[k].x - mx) ** 2 + (systems[k].z - mz) ** 2 < r2) empty = false
      }
      if (empty) lanes.push([i, j])
    }
  }
  // Thin it to a strategy map's sparseness, keeping everything reachable:
  // drop the longest lanes of well-connected systems first.
  const degree = new Int32Array(n)
  for (const [a, b] of lanes) { degree[a]++; degree[b]++ }
  const len = (l: [number, number]) => Math.hypot(systems[l[0]].x - systems[l[1]].x, systems[l[0]].z - systems[l[1]].z)
  const sorted = [...lanes].sort((a, b) => len(b) - len(a))
  const keep = new Set(lanes)
  for (const l of sorted) {
    // Proxima is the first desk move, so thinning may not erase the home route.
    if (l.includes(0) && l.includes(1)) continue
    if (degree[l[0]] <= 2 || degree[l[1]] <= 2) continue
    if (rnd(l[0] * 131 + l[1], 46) < 0.55) continue
    keep.delete(l)
    if (!connected(n, [...keep])) { keep.add(l); continue }
    degree[l[0]]--; degree[l[1]]--
  }
  const finalLanes = [...keep]
  const neighbours: number[][] = Array.from({ length: n }, () => [])
  for (const [a, b] of finalLanes) { neighbours[a].push(b); neighbours[b].push(a) }

  // Settlement order: the nearest system along the lanes from anything settled.
  const dist = new Float64Array(n).fill(Infinity)
  const parent = new Int32Array(n).fill(-1)
  const done = new Uint8Array(n)
  dist[0] = 0
  const order: number[] = []
  for (let step = 0; step < n; step++) {
    let best = -1
    for (let i = 0; i < n; i++) if (!done[i] && (best < 0 || dist[i] < dist[best])) best = i
    if (best < 0 || dist[best] === Infinity) break
    done[best] = 1
    order.push(best)
    for (const j of neighbours[best]) {
      const d = dist[best] + Math.hypot(systems[best].x - systems[j].x, systems[best].z - systems[j].z)
      if (d < dist[j]) { dist[j] = d; parent[j] = best }
    }
  }
  const worldOf = new Int32Array(n).fill(-1)
  order.forEach((s, w) => { worldOf[s] = w })
  return { systems, lanes: finalLanes, order, worldOf, parent, neighbours }
}

function connected(n: number, lanes: [number, number][]): boolean {
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (const [a, b] of lanes) { adj[a].push(b); adj[b].push(a) }
  const seen = new Uint8Array(n)
  const stack = [0]
  seen[0] = 1
  let count = 1
  while (stack.length) {
    const i = stack.pop()!
    for (const j of adj[i]) if (!seen[j]) { seen[j] = 1; count++; stack.push(j) }
  }
  return count === n
}

/** How many worlds hold anybody at headcount `n`. */
export const worldsSettled = (n: number): number => Math.max(1, Math.ceil(n / WORLD_SEATS))

/** Catalogue rings extend the chart without moving an existing address or lane.
 * Each ring joins the previous chart at its easternmost point, outside its
 * bounding circle. Its perimeter and outward spoke cannot cross older lanes.
 * New addresses alternate round the ring, nearest along those lanes first.
 */
export function extendNetwork(net: Network, minimum: number): void {
  while (net.order.length < minimum) {
    const first = net.systems.length
    const radius = Math.max(...net.systems.map(s => Math.hypot(s.x, s.z))) + 28
    let anchor = 0
    net.systems.forEach((s, i) => { if (s.x > net.systems[anchor].x) anchor = i })
    const worldOf = new Int32Array(first + 64), parent = new Int32Array(first + 64)
    worldOf.set(net.worldOf); parent.set(net.parent)
    for (let i = 0; i < 64; i++) {
      const angle = i / 64 * Math.PI * 2
      net.systems.push({ name: `CAT ${first + i}`, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, ly: radius, real: false })
      net.neighbours.push([])
    }
    const link = (a: number, b: number) => { net.lanes.push([a, b]); net.neighbours[a].push(b); net.neighbours[b].push(a) }
    link(anchor, first); parent[first] = anchor
    for (let i = 0; i < 64; i++) link(first + i, first + (i + 1) % 64)
    const order = [0]
    for (let i = 1; i <= 32; i++) { order.push(i); if (i < 32) order.push(64 - i) }
    for (const i of order) {
      const id = first + i
      worldOf[id] = net.order.length; net.order.push(id)
      if (i) parent[id] = i <= 32 ? id - 1 : first + (i + 1) % 64
    }
    net.worldOf = worldOf; net.parent = parent
  }
}

/**
 * A system's standing on the map when `settled` worlds hold anybody. It takes
 * the count rather than the headcount because the count is not always the
 * headcount's: until James has flown, a full Earth is still one world.
 */
export type Standing = 'home' | 'colony' | 'frontier' | 'surveyed' | 'uncharted'
export function standing(net: Network, s: number, settled: number): Standing {
  const w = net.worldOf[s]
  if (w === 0) return 'home'
  if (w >= 0 && w < settled) return 'colony'
  if (w === settled) return 'frontier'
  // Surveyed: within two lanes of anything settled.
  for (const a of net.neighbours[s]) {
    if (net.worldOf[a] >= 0 && net.worldOf[a] < settled) return 'surveyed'
    for (const b of net.neighbours[a]) if (net.worldOf[b] >= 0 && net.worldOf[b] < settled) return 'surveyed'
  }
  return 'uncharted'
}
