/*
 * Copied from the rebuild (100m-devs-three/src/sim/galaxy.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * **The Milky Way** — GDD §9 [amended 2026-09-24, Garage to Galaxy decision 5],
 * phase 9: *"I still want the intergalatic Stellaris style map."*
 *
 * A seeded spiral of about 720 systems, with the real stars near Sol at their
 * real distances and bearings, joined by lanes to each system's three nearest
 * neighbours, then islands bridged so every system is reachable from Sol. It is
 * the prototype's generator (`docs/design/garage-to-galaxy-2026-09-24/
 * prototype/gal.js`), which the user played, made pure and deterministic.
 *
 * Units are light-years; the galactic centre is (0, 0) and Sol sits 26,000 ly
 * out, where it really is. Pure — no store, no clock, no renderer.
 */

export type StarClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M'

export interface StarSystem {
  name: string
  x: number
  y: number
  cls: StarClass
  /** A real, named star (or the core): drawn with its name at wider zooms. */
  named: boolean
  /** The world id when this system has an authored world (§6's skins). */
  wid?: string
  /** Light-years from Sol. */
  dist: number
}

export interface Galaxy {
  systems: StarSystem[]
  /** Neighbours by system index. */
  adj: Set<number>[]
  lanes: [number, number][]
}

export const SOL = 0
const SOL_AT: [number, number] = [0, 26000]

function hash(a: number, b: number): number {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  return (x ^ (x >>> 16)) >>> 0
}

/**
 * The neighbourhood, at real distances in light-years. Bearings are the
 * prototype's, chosen to spread the names out on the map rather than to match
 * the sky. TRAPPIST-1 and Kepler-452 are the named colony worlds of §6.
 */
const LOCAL: [string, number, number, StarClass, string?][] = [
  ['Proxima Centauri', 4.24, .6, 'M', 'proxima'], ["Barnard's Star", 5.96, 2.2, 'M'], ['Wolf 359', 7.86, 3.4, 'M'],
  ['Lalande 21185', 8.31, 1.4, 'M'], ['Sirius', 8.6, 4.3, 'A'], ['Ross 128', 11, 5.2, 'M'], ['Tau Ceti', 11.9, 5.9, 'G'],
  ['Gliese 581', 20.4, 2.8, 'M'], ['TRAPPIST-1', 40.7, .2, 'M', 'trappist'], ['55 Cancri', 41, 3.9, 'K'],
  ['Kepler-22', 640, 1.1, 'G'], ['Kepler-452', 1800, 4.6, 'G', 'kepler'],
]
const CATALOGUE = ['HD', 'GJ', 'HIP', 'TOI', 'Kepler', 'LHS', 'Wolf', 'Ross', 'Gliese', 'KOI']
const CLASSES = 'OBAFGKMMKG'

export function buildGalaxy(size = 720): Galaxy {
  const rnd = (k: number) => hash(k, 4099) / 4294967296
  const N: StarSystem[] = [{ name: 'Sol', x: SOL_AT[0], y: SOL_AT[1], cls: 'G', named: true, wid: 'earth', dist: 0 }]
  for (const [name, d, a, cls, wid] of LOCAL) {
    N.push({ name, x: SOL_AT[0] + Math.cos(a) * d, y: SOL_AT[1] + Math.sin(a) * d, cls, named: true, wid, dist: 0 })
  }
  N.push({ name: 'Sagittarius A*', x: 0, y: 0, cls: 'B', named: true, wid: 'core', dist: 0 })
  for (let k = 1; N.length < size && k < 30000; k++) {
    const u = rnd(k * 3), v = rnd(k * 3 + 1), w = rnd(k * 3 + 2)
    const r = 2500 + 47500 * Math.sqrt(u)
    // Four arms on a log spiral, with a scatter of field stars between them.
    const th = w < .72 ? (k % 4) * Math.PI / 2 + Math.log(r / 2500) / .28 + (v - .5) * .55 : v * Math.PI * 2
    const x = Math.cos(th) * r, y = Math.sin(th) * r
    if (Math.hypot(x - SOL_AT[0], y - SOL_AT[1]) < 2600) continue
    if (N.some(m => !m.named && (m.x - x) ** 2 + (m.y - y) ** 2 < 1400 * 1400)) continue
    N.push({
      name: `${CATALOGUE[hash(k, 5) % CATALOGUE.length]} ${1000 + hash(k, 6) % 9000}`,
      x, y, cls: CLASSES[hash(k, 7) % CLASSES.length] as StarClass, named: false, dist: 0,
    })
  }
  for (const n of N) n.dist = Math.hypot(n.x - SOL_AT[0], n.y - SOL_AT[1])

  const adj = N.map(() => new Set<number>())
  const lanes: [number, number][] = []
  const link = (a: number, b: number) => {
    if (a === b || adj[a].has(b)) return
    adj[a].add(b); adj[b].add(a); lanes.push([a, b])
  }
  for (let i = 0; i < N.length; i++) {
    const near = N.map((m, j) => [(N[i].x - m.x) ** 2 + (N[i].y - m.y) ** 2, j] as const).filter(([, j]) => j !== i)
    near.sort((a, b) => a[0] - b[0])
    for (let k = 0; k < 3; k++) link(i, near[k][1])
  }
  // Join the islands, nearest pair first, until every system is reachable from Sol.
  for (;;) {
    const seen = new Set([SOL]), stack = [SOL]
    while (stack.length) { const a = stack.pop()!; for (const b of adj[a]) if (!seen.has(b)) { seen.add(b); stack.push(b) } }
    if (seen.size === N.length) break
    let best: [number, number, number] = [Infinity, 0, 0]
    for (const a of seen) for (let b = 0; b < N.length; b++) {
      if (seen.has(b)) continue
      const d = (N[a].x - N[b].x) ** 2 + (N[a].y - N[b].y) ** 2
      if (d < best[0]) best = [d, a, b]
    }
    link(best[1], best[2])
  }
  return { systems: N, adj, lanes }
}

let cached: Galaxy | null = null
/** The one galaxy. Deterministic, so a cache is only a speed-up. */
export function galaxy(): Galaxy {
  return (cached ??= buildGalaxy())
}

/** Every system is found by index; these are the authored worlds'. */
export function systemOf(wid: string): number {
  return galaxy().systems.findIndex(s => s.wid === wid)
}

/** The world's name on a system: "Proxima b", "Earth", or the star's own "… b". */
export function worldName(node: number): string {
  const s = galaxy().systems[node]
  if (!s) return 'Unknown'
  return s.wid === 'earth' ? 'Earth' : s.wid === 'proxima' ? 'Proxima b' : s.wid === 'trappist' ? 'TRAPPIST-1e'
    : s.wid === 'kepler' ? 'Kepler-452b' : s.wid === 'core' ? 'The core' : `${s.name} b`
}

/** §9 — fog of war: owned systems, and everything within two lanes of them. */
export function explored(owned: readonly number[]): Set<number> {
  const g = galaxy()
  const out = new Set<number>()
  for (const n of owned) {
    out.add(n)
    for (const a of g.adj[n]) { out.add(a); for (const b of g.adj[a]) out.add(b) }
  }
  return out
}

/**
 * §9 — where the next colony ship may go: an unowned system next to your
 * territory. The first launch is James's, and it is always to Proxima (§5).
 */
export function colonisable(owned: readonly number[], node: number): boolean {
  if (owned.includes(node)) return false
  if (owned.length <= 1) return galaxy().systems[node]?.wid === 'proxima'
  for (const a of galaxy().adj[node]) if (owned.includes(a)) return true
  return false
}
