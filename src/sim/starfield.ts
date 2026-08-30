/**
 * Rung 7 — the galactic network, procedurally, and forever. GDD §7.7.1a.
 *
 * §13.5's gate is a hundred million developers and `frames.ts` is emphatic
 * about why that number is not a decision somebody made: *"The planet is full
 * at exactly 100,000,000 developers. Not roughly, and not because somebody
 * stopped adding sites. The geometry says it."* A hundred parks of a million
 * tile a sphere, the sphere is full, and there is nowhere left to put a desk.
 *
 * So the eighth rung is not a bigger planet. It is **another one**, around
 * another star, and then another — which is the one direction the ladder can
 * still go and the only one that does not need a new number written down every
 * time the studio doubles. §7.7.1's rungs were a table with a last row; this is
 * a *function*, and a function does not run out.
 *
 * Three properties the rest of the game leans on, and each of them is why this
 * file is pure arithmetic with no store, no clock and no renderer in it:
 *
 *  1. **A star's position is a function of its index.** Nothing is stored, so a
 *     studio of 10^18 developers costs the same to describe as a studio of two
 *     worlds. `galaxy.ts` draws a neighbourhood by asking for indices, and a
 *     save file never carries a star map.
 *  2. **Index order is radius order, and radius bounds distance.** Radius goes
 *     as `√i`, which is what uniform areal density means, so the nearest worlds
 *     are also the lowest-numbered ones to within a band — and since two stars
 *     can never be closer than the difference of their radii, that band is a
 *     bounded search rather than a scan over an unbounded set.
 *  3. **Sol is 0 and Proxima Centauri is 1**, at the real 4.2465 light-years,
 *     because §21.8's whole scene is about the second one and a beat that names
 *     a star should be standing on the distance to it.
 */

/**
 * One full planet — GDD §13.5's gate, and therefore one star's whole world.
 *
 * **Written here rather than imported**, because `sim/` may not reach into
 * `render/` and `render/frames.ts` is where `GLOBE_CAP` is *derived* from the
 * tiling. Two derivations of one number is how a table drifts from the geometry
 * it was copied out of, so `frames.test.ts` pins them equal instead: the
 * renderer's planet and the simulation's world are the same hundred million or
 * the test fails.
 */
export const WORLD_CAP = 1e8

/** Proxima Centauri, in light-years. The real figure; see the header. */
export const PROXIMA_LY = 4.2465

export interface Star {
  x: number
  y: number
  z: number
}

/**
 * The golden angle — `π(3 − √5)`, in radians.
 *
 * **The angular law, and it replaced a pair of spiral arms because the arms put
 * two worlds in the same pixel.** The first version wound the stars onto two
 * logarithmic arms, which looks like a galaxy and is wrong for the one thing
 * this rung must guarantee: `r = P√i` means consecutive radii close up as `i`
 * grows — at the eighth world the radial gap is already a third of what it was
 * at the second — so anything that also correlates their *angles* stacks them.
 * Drawn at rung 7 that was pairs of planets overlapping, which is not a network
 * and cannot be tapped.
 *
 * Turning each successive star by the golden angle is the classic even packing
 * (Vogel's model, the one sunflower seeds use): no two indices ever share an
 * angle, and the nearest-neighbour distance stays close to `PROXIMA_LY` at
 * every radius, forever. Which is exactly the invariant `NODE_PITCH` in
 * `frames.ts` is sized against.
 *
 * The spiral is not lost — it moved to where it belongs. `galaxy.ts` draws the
 * *haze* on a logarithmic spiral, so the arms are the galaxy the studio has not
 * reached, and the worlds it has are evenly spread through them. That is also
 * the honest picture: a hundred settled worlds out of a hundred billion do not
 * trace a structure.
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/**
 * How far a star may wander off the exact packing angle, in radians.
 *
 * Enough that the field does not read as the sunflower it is, little enough
 * that it does not undo the packing. At 0.22 the worst pair measured across the
 * first ten thousand indices still clears two node radii.
 */
const ANGLE_SCATTER = 0.22

/**
 * How far off the plane a world may sit, as a fraction of its own radius.
 *
 * **The neighbourhood is a sphere, not a disc, and that is the true thing as
 * well as the legible one.** The first pass gave every world a lift of twelve
 * per cent of its radius — a galactic disc, exaggerated tenfold — and it read
 * exactly as reported: sixteen stars on one plane, and a rung whose entire
 * gesture is *you can turn this* with nothing to reveal by turning it.
 *
 * The error was applying the galaxy's shape at the neighbourhood's scale. The
 * Milky Way's disc is something like a thousand light-years thick and the frame
 * here is about twenty across, so **within it the field is not flattened at
 * all** — the local stellar neighbourhood really is isotropic, and Sol's own
 * nearest few dozen stars are scattered in every direction rather than laid out
 * on a table. Seven tenths of the radius is a roughly spherical cloud, which is
 * what that looks like.
 *
 * It flattens where a disc actually starts to mean something, at
 * {@link DISC_HALF_LY} — which is past ten thousand worlds, and therefore a
 * promise about the far field rather than anything the camera is likely to see.
 */
const LOCAL_ISOTROPY = 0.7

/** Half the disc's thickness, in light-years. The far field's ceiling. */
const DISC_HALF_LY = 500

/**
 * Deterministic [0, 1) from an index and a salt.
 *
 * A hash rather than a seeded stream, because the caller asks for star 4,001
 * without having asked for the four thousand before it — the whole point of
 * generating on demand. The constants are the usual 32-bit finaliser; nothing
 * about them is load-bearing beyond avalanche.
 */
function hash(index: number, salt: number): number {
  let h = (Math.floor(index) ^ Math.imul(salt, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 0x1_0000_0000
}

function clampIndex(index: number): number {
  if (!Number.isFinite(index)) return 0
  return Math.max(0, Math.floor(index))
}

/**
 * Where star `index` is, in light-years, with Sol at the origin.
 *
 * `r = PROXIMA_LY * √(i + jitter)` is the whole of the radial law and it is the
 * one line that makes the rung infinite: area goes as `r²`, so a count that
 * goes as `r²` is a **constant density of worlds**, at every radius, forever.
 * A galaxy that got sparser as it grew would make the thousandth world less of
 * an event than the second, and one that got denser would eventually put two
 * suns in the same pixel.
 */
export function starAt(index: number): Star {
  const i = clampIndex(index)
  // Sol. The world the player has already filled, and the origin every distance
  // in this file is measured from.
  if (i === 0) return { x: 0, y: 0, z: 0 }

  // **Proxima is placed, not generated.** §21.8 sends James to a star by name
  // and at a stated distance; a generated first neighbour would put the scene's
  // one hard number somewhere the map disagrees with.
  if (i === 1) return { x: PROXIMA_LY, y: 0, z: 0 }

  // A quarter of a cell of radial jitter, not a whole one: `√(i + u)` with `u`
  // uniform on [0, 1) moves a star up to a full nearest-neighbour distance
  // inward, which is enough to undo the packing the angle just bought.
  const jitter = hash(i, 1) * 0.25
  const r = PROXIMA_LY * Math.sqrt(i + jitter)
  const theta = i * GOLDEN_ANGLE + (hash(i, 2) - 0.5) * ANGLE_SCATTER
  const lift = Math.min(r * LOCAL_ISOTROPY, DISC_HALF_LY)
  return {
    x: r * Math.cos(theta),
    y: r * Math.sin(theta),
    // Triangular rather than uniform, so the cloud has a middle. Two draws
    // summed is the cheapest distribution that is denser at the centre than at
    // the edges, which is what a field of stars looks like from inside it.
    z: (hash(i, 3) + hash(i, 4) - 1) * lift,
  }
}

/** Distance between two stars, in light-years. */
export function lightYears(a: number, b: number): number {
  const p = starAt(a)
  const q = starAt(b)
  return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)
}

/** How far star `index` is from Sol. */
export function lightYearsFromSol(index: number): number {
  return lightYears(0, index)
}

/**
 * How many worlds a headcount has settled — the rung's own count.
 *
 * `frames.ts`'s `sitesFor` one rung up, and the only one of the family with no
 * ceiling on it. That is the point: every count below this saturates at the
 * thing it fills — ten storeys, ten plots, a hundred sites — and this one does
 * not, because there is no last star.
 */
export function worldsFor(devs: number): number {
  if (!Number.isFinite(devs) || devs <= 0) return 1
  return Math.max(1, Math.ceil(devs / WORLD_CAP))
}

/** How many developers stand on one world. The last one is ragged. */
export function devsOnWorld(devs: number, world: number): number {
  const w = Math.max(0, Math.floor(Number.isFinite(world) ? world : 0))
  const left = (Number.isFinite(devs) ? devs : 0) - w * WORLD_CAP
  return Math.max(0, Math.min(WORLD_CAP, left))
}

/**
 * The radius the settled worlds occupy, in light-years.
 *
 * The inverse of the radial law, so it is exact rather than a bound: `n` worlds
 * settled in index order reach `PROXIMA_LY * √n`. The renderer uses it for the
 * haze beyond the neighbourhood and the HUD says it out loud, and both want the
 * same number.
 */
export function settledRadiusLy(worlds: number): number {
  const n = Math.max(1, Math.floor(Number.isFinite(worlds) ? worlds : 1))
  return PROXIMA_LY * Math.sqrt(n)
}

/**
 * How wide a search either side of the focus finds its true nearest neighbours.
 *
 * **Derived from the radial law, not guessed at, and it is not a constant.**
 * Radius goes as `√i`, so a band of `±ρ` light-years about a star at index `i`
 * spans `2√i·ρ/PROXIMA_LY` indices — the further out the studio has settled,
 * the more indices one light-year covers. A fixed window is therefore correct
 * near Sol and quietly wrong a few thousand worlds later: measured at index
 * 1,500 it missed four of the true twenty-five and offered four that were
 * further away, which is exactly the kind of wrong that still looks right.
 *
 * `want` stars occupy a disc of radius `PROXIMA_LY·√want` at this density, so
 * {@link SEARCH_REACH} is how many of those radii the band covers.
 *
 * **Three, not two**, since {@link LOCAL_ISOTROPY} lifted the field off the
 * plane: a cloud spends part of every separation on the axis the radial law
 * knows nothing about, so the answer reaches further out in radius than a flat
 * field's would. Measured across the first four thousand indices at sixteen,
 * twenty-five and forty neighbours, three finds every one; two missed four in
 * twenty-five.
 */
const SEARCH_REACH = 3

/**
 * The most candidates a search will look at either side, whatever the maths says.
 *
 * The band above grows as `√focus`, so at the ten billion worlds a studio of
 * 10^18 developers has settled it would want a million distance checks. That is
 * a one-off on entering a node rather than a per-frame cost, but it is still
 * twenty milliseconds spent to reorder a picture of twenty-five identical dots.
 *
 * Past the cap the result stops being provably the nearest and becomes the
 * nearest of a thin annulus around the focus — which at that scale is a field
 * of stars at the same radius and the same density, and is indistinguishable.
 * Said out loud rather than left as a surprise: the guarantee holds while the
 * band fits, and `starfield.test.ts` tests it where it holds.
 */
const SEARCH_CAP = 6000

/**
 * The `count` settled worlds nearest `focus`, nearest first, focus included.
 *
 * **A neighbourhood, not the galaxy**, and that is the decision that keeps the
 * rung drawable. At 10^18 developers there are ten billion worlds and the
 * nearest four hundred thousand of them are inside one pixel; a camera fitted
 * to *all* of them is a fog with a dot in it, which is a picture of a number
 * rather than a picture of a place. So rung 7 frames the worlds around the one
 * the address is on, exactly as rung 3 frames the storeys of the tower the
 * address is in, and travelling is done by entering a node — which recentres
 * the neighbourhood, because a neighbourhood is only ever a neighbourhood of
 * somewhere.
 *
 * Bounded work: a band of indices around the focus, sorted. Nothing scans the
 * unbounded set, and nothing is stored between calls.
 */
export function neighbourhood(focus: number, worlds: number, count: number): number[] {
  const n = Math.max(1, Math.floor(Number.isFinite(worlds) ? worlds : 1))
  const want = Math.max(1, Math.min(n, Math.floor(Number.isFinite(count) ? count : 1)))
  const at = Math.max(0, Math.min(n - 1, clampIndex(focus)))

  const spread = Math.min(
    SEARCH_CAP,
    Math.ceil(2 * Math.sqrt(at + 1) * SEARCH_REACH * Math.sqrt(want)) + 2 * want,
  )
  const from = Math.max(0, at - spread)
  const to = Math.min(n - 1, at + spread)

  const found: Array<{ index: number; d: number }> = []
  for (let i = from; i <= to; i++) found.push({ index: i, d: lightYears(at, i) })
  // The focus is at distance zero and therefore already first; the index breaks
  // ties, so the order is stable across calls and across machines.
  found.sort((a, b) => a.d - b.d || a.index - b.index)
  return found.slice(0, want).map((s) => s.index)
}

/**
 * The catalogues a hundred billion worlds would actually be named out of.
 *
 * Generated the way §7.8.7 generates a developer: from the index, on demand,
 * never stored. The two anchors are real and the rest is a catalogue number,
 * which is funnier for being flat — nobody names the four billionth colony.
 */
const CATALOGUES: readonly string[] = [
  'KEPLER',
  'GLIESE',
  'TRAPPIST',
  'WOLF',
  'ROSS',
  'LUYTEN',
  'TEEGARDEN',
  'KAPTEYN',
  'LACAILLE',
  'TYCHO',
  'HD',
  'LHS',
]

/** The letter after the catalogue number. These are planets, so: from b. */
const DESIGNATIONS = 'bcdefgh'

export function starName(index: number): string {
  const i = clampIndex(index)
  if (i === 0) return 'SOL'
  if (i === 1) return 'PROXIMA CENTAURI'
  const catalogue = CATALOGUES[Math.floor(hash(i, 5) * CATALOGUES.length) % CATALOGUES.length]
  const number = 100 + Math.floor(hash(i, 6) * 9900)
  const letter = DESIGNATIONS[Math.floor(hash(i, 7) * DESIGNATIONS.length) % DESIGNATIONS.length]
  return `${catalogue}-${number} ${letter}`
}
