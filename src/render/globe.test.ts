import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A recording `Graphics`.
 *
 * The planet is the first thing in this render stack whose *drawing* is worth
 * asserting rather than only its geometry: `worldMap.test.ts` already pins where
 * the land and the campuses are, and what could still go wrong is the part a
 * reviewer put their finger on — a campus drawn in the studio's grey on a green
 * world, which is arithmetically perfect and reads as a sticker.
 *
 * So the calls are recorded and the colours are the assertion. This exercises
 * the shipped code path rather than a copy of it, which is the only kind of
 * drawing test worth having.
 */
type Op = { kind: string; fill?: number; stroke?: number; pts?: number[]; r?: number }

class FakeGraphics {
  ops: Op[] = []
  private pending: Op[] = []
  private path: number[] = []
  position = { set: vi.fn() }
  clear() {
    this.ops = []
    this.pending = []
    this.path = []
    return this
  }
  circle(_x: number, _y: number, r: number) {
    this.pending.push({ kind: 'circle', r })
    return this
  }
  poly(pts: number[]) {
    this.pending.push({ kind: 'poly', pts: [...pts] })
    return this
  }
  rect(_x: number, _y: number, _w: number, _h: number) {
    this.pending.push({ kind: 'rect' })
    return this
  }
  moveTo(x: number, y: number) {
    this.path = [x, y]
    return this
  }
  lineTo(x: number, y: number) {
    this.path.push(x, y)
    return this
  }
  fill(o: number | { color: number }) {
    const color = typeof o === 'number' ? o : o.color
    for (const s of this.pending) this.ops.push({ ...s, fill: color })
    this.pending = []
    return this
  }
  stroke(o: { color: number }) {
    for (const s of this.pending) this.ops.push({ ...s, stroke: o.color })
    if (this.path.length) this.ops.push({ kind: 'line', stroke: o.color, pts: [...this.path] })
    this.pending = []
    this.path = []
    return this
  }
}

/** Every `Graphics` the module made, in construction order. */
const made: FakeGraphics[] = []

class FakeContainer {
  children: unknown[] = []
  alpha = 1
  visible = true
  position = { set: vi.fn() }
  scale = { set: vi.fn() }
  addChild(...kids: unknown[]) {
    this.children.push(...kids)
    return kids[0]
  }
}

vi.mock('pixi.js', () => ({
  Container: FakeContainer,
  Graphics: class extends FakeGraphics {
    constructor() {
      super()
      made.push(this)
    }
  },
}))

const { buildGlobe, SURFACE_COLS, SURFACE_ROWS, DAY_MS } = await import('./globe.ts')
const { MASTER_PALETTE, RAMPS, hexToRgb } = await import('../art/palette.ts')
const { TERRAIN, SITES_PER_GLOBE, terrainShade } = await import('./worldMap.ts')

function num(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}
const PALETTE = new Set(MASTER_PALETTE.map(num))
const NEUTRALS = new Set(RAMPS.NEUTRAL.map(num))

/** surface, cables, campuses, marks — the order `buildGlobe` constructs them. */
const layer = { surface: 0, cables: 1, campuses: 2, marks: 3 }

describe('the planet', () => {
  beforeEach(() => {
    made.length = 0
  })

  it('draws nothing that is not in the master palette', () => {
    const g = buildGlobe()
    g.setChromeAlpha(1)
    g.setHeadcount(60e6)
    g.setClock(DAY_MS * 0.3)
    for (const gr of made) {
      for (const op of gr.ops) {
        if (op.fill !== undefined) expect(PALETTE).toContain(op.fill)
        if (op.stroke !== undefined) expect(PALETTE).toContain(op.stroke)
      }
    }
  })

  it('merges the surface into runs instead of a quad per cell', () => {
    // 80 x 40 is 3,200 cells and about half of them face the camera. Drawn one
    // at a time that is 1,600 polygons on every tick of the sun; run-length
    // merged along each parallel it is a couple of hundred, which is the
    // difference between rebuilding on a phone and not.
    const g = buildGlobe()
    g.setChromeAlpha(1)
    g.setClock(0)
    const polys = made[layer.surface].ops.filter((o) => o.kind === 'poly')
    expect(polys.length).toBeGreaterThan(SURFACE_ROWS)
    expect(polys.length).toBeLessThan((SURFACE_COLS * SURFACE_ROWS) / 4)
  })

  it('follows the curve along a run rather than cutting the corner', () => {
    // A run ten cells long is a quarter of the way round the planet. Drawn as a
    // quad between its ends it takes a chord, and the sea grows a straight edge
    // across the silhouette. Every run carries two points per cell for that.
    const g = buildGlobe()
    g.setChromeAlpha(1)
    g.setClock(0)
    const polys = made[layer.surface].ops.filter((o) => o.kind === 'poly')
    const longest = polys.reduce((a, b) => ((a.pts?.length ?? 0) > (b.pts?.length ?? 0) ? a : b))
    expect((longest.pts?.length ?? 0) / 2).toBeGreaterThan(4)
  })

  it('stands every campus on ground the planet chose, on decks the studio poured', () => {
    /*
     * **The anti-sticker gate, and it is two halves of one rule.**
     *
     * > Everything the studio *built* is neutral. Everything it *stands on*
     * > belongs to the planet.
     *
     * A site emits eleven filled polygons: its zoned ground, then ten decks. The
     * ground has to come off that site's own terrain ramp — ochre in the Sahara,
     * white on the ice, blue at sea — and the decks have to stay `NEUTRAL`,
     * because concrete is grey wherever you pour it and a deck that took the
     * biome's colour would be a campus painted like camouflage.
     *
     * A first version of this asserted the ground was simply *not* neutral and
     * it was wrong: tundra and ice are legitimately grey, and they share entries
     * with `RAMPS.NEUTRAL`. The gate has to be "the ramp this place uses", not
     * "any ramp but that one".
     */
    const g = buildGlobe()
    g.setChromeAlpha(1)
    g.setHeadcount(100e6)
    g.setClock(DAY_MS * 0.25)
    const filled = made[layer.campuses].ops.filter((o) => o.kind === 'poly' && o.fill !== undefined)
    expect(filled.length).toBeGreaterThan(22)
    expect(filled.length % 11).toBe(0)

    const anyTerrain = new Set<number>()
    for (const ramp of Object.values(TERRAIN)) for (const hex of ramp) anyTerrain.add(num(hex))

    for (let i = 0; i < filled.length; i += 11) {
      expect(anyTerrain).toContain(filled[i].fill)
      for (let d = 1; d < 11; d++) expect(NEUTRALS).toContain(filled[i + d].fill)
    }
  })

  it('tells the park the same ground it paints the site with', () => {
    /*
     * **The invisible-swap gate.**
     *
     * `park.ts` fills its board with `terrainShade(biome, step, -1)` from
     * `groundAt`, and this file fills the same site's mark with the same
     * expression. If the two ever diverge — a different rounding of the light, a
     * different offset down the ramp — the park stops being the planet's ground
     * and goes back to being a slab laid on it, which is the exact complaint
     * this level was rebuilt around.
     *
     * One site, so the first eleven polygons are unambiguously its own.
     */
    for (const t of [0, 0.2, 0.45, 0.7, 0.9]) {
      made.length = 0
      const g = buildGlobe()
      g.setChromeAlpha(1)
      g.setHeadcount(1e6)
      g.setClock(DAY_MS * t)
      const filled = made[layer.campuses].ops.filter(
        (o) => o.kind === 'poly' && o.fill !== undefined,
      )
      expect(filled).toHaveLength(11)
      const ground = g.groundAt(0)
      expect(filled[0].fill).toBe(num(terrainShade(ground.biome, ground.step, -1)))
    }
  })

  it('makes the Sahara sand and the temperate world green', () => {
    /*
     * The whole of what rung 6 has to say that rung 5 could not: **the studio is
     * a different colour in Lagos than in Reykjavik.** Swept over a day rather
     * than sampled at an hour, because which sites are lit depends on where the
     * sun is and an assertion that depends on the hour is an assertion that goes
     * red on a Tuesday.
     */
    const g = buildGlobe()
    g.setChromeAlpha(1)
    g.setHeadcount(100e6)
    const grounds = new Set<number | undefined>()
    for (let t = 0; t < 12; t++) {
      g.setClock((DAY_MS * t) / 12)
      const filled = made[layer.campuses].ops.filter(
        (o) => o.kind === 'poly' && o.fill !== undefined,
      )
      for (let i = 0; i < filled.length; i += 11) grounds.add(filled[i].fill)
    }
    // Sand, from the WOOD ramp that was already carrying crates.
    expect(grounds).toContain(num(RAMPS.WOOD[1]))
    // Grass, from the one green thing in the office.
    expect(grounds).toContain(num(RAMPS.FOLIAGE[0]))
    // And a platform at sea, from the GLOW that was already carrying data pipes.
    expect(grounds).toContain(num(RAMPS.GLOW[0]))
  })

  it('varies the ground from one continent to the next', () => {
    // The whole of what this rung has to say that rung 5 could not: the studio
    // is a different colour in the Sahara than it is in Siberia. If every site
    // came out the same colour the biomes would be doing nothing.
    const g = buildGlobe()
    g.setChromeAlpha(1)
    g.setHeadcount(100e6)
    g.setClock(DAY_MS * 0.4)
    const fills = new Set(
      made[layer.campuses].ops.filter((o) => o.kind === 'poly').map((o) => o.fill),
    )
    expect(fills.size).toBeGreaterThan(3)
  })

  it('lights the campuses on the night side and leaves the day side alone', () => {
    const g = buildGlobe()
    g.setChromeAlpha(1)
    g.setHeadcount(100e6)
    g.setClock(DAY_MS * 0.5)
    const lights = made[layer.campuses].ops.filter(
      (o) => o.kind === 'rect' && o.fill === num(RAMPS.CALM[3]),
    )
    // Some sites are in daylight and some are not, whatever the hour, so there
    // must be lights and there must be fewer of them than there are campuses.
    expect(lights.length).toBeGreaterThan(3)
    expect(lights.length).toBeLessThan(SITES_PER_GLOBE)
  })

  it('runs a cable only where the ground behind it is dark', () => {
    const g = buildGlobe()
    g.setChromeAlpha(1)
    g.setHeadcount(100e6)
    g.setClock(DAY_MS * 0.5)
    const runs = made[layer.cables].ops.filter((o) => o.kind === 'line')
    expect(runs.length).toBeGreaterThan(0)
    for (const r of runs) expect(r.stroke).toBe(num(RAMPS.CALM[1]))
  })

  it('brackets the site the address is in rather than recolouring it', () => {
    const g = buildGlobe()
    g.setChromeAlpha(1)
    g.setHeadcount(100e6)
    g.setFocus(12)
    const bracket = made[layer.marks].ops.filter((o) => o.fill === num(RAMPS.WARN[2]))
    // Eight segments: two arms at each of four corners.
    expect(bracket).toHaveLength(8)
  })

  it('draws nothing at all while nobody can see it', () => {
    /*
     * `HANDOFF-2026-08-22.md`'s trap 62 — *a `Graphics` costs what is in it every
     * frame* — one level along. A new game is one developer in a garage at rung
     * 1, where the planet's alpha is zero for as long as that lasts. Without the
     * gate it spent fourteen hundred polygons every two and a half seconds
     * redrawing a world nobody could see, and one more at boot, which is the
     * worst moment in the run to spend it.
     */
    const g = buildGlobe()
    expect(g.planet.visible).toBe(false)
    g.setHeadcount(100e6)
    g.setClock(DAY_MS * 0.3)
    g.setFocus(9)
    for (const gr of made) expect(gr.ops).toHaveLength(0)

    // And it is spent on the frame the planet actually arrives, not lost.
    g.setChromeAlpha(1)
    expect(made[layer.surface].ops.length).toBeGreaterThan(0)
    expect(made[layer.campuses].ops.length).toBeGreaterThan(0)
  })

  it('redraws for the sun and not for the frame', () => {
    // Nothing on this level moves except the light, and the light is quantised.
    // A tick that changes nothing has to cost nothing, or the planet is a
    // per-frame rebuild of fifteen hundred polygons.
    const g = buildGlobe()
    g.setChromeAlpha(1)
    g.setHeadcount(50e6)
    g.setClock(1000)
    const before = made[layer.surface].ops.length
    const spy = vi.spyOn(made[layer.surface], 'clear')
    g.setClock(1001)
    g.setClock(1002)
    expect(spy).not.toHaveBeenCalled()
    g.setClock(1000 + DAY_MS / 4)
    expect(spy).toHaveBeenCalled()
    expect(made[layer.surface].ops.length).toBeGreaterThan(before / 2)
  })

  it('picks the site under the thumb, and nothing when the ground is not bought', () => {
    const g = buildGlobe()
    g.setChromeAlpha(1)
    g.setHeadcount(100e6)
    g.setFocus(31)
    // The planet turns the address's own site to face the camera, so the middle
    // of the disc is always the site you are in.
    const at = g.container.children
    expect(at.length).toBeGreaterThan(0)
    const one = buildGlobe()
    one.setHeadcount(1e6)
    one.setFocus(0)
    expect(one.sites).toBe(1)
  })

  it('fades the planet without taking the studio standing on it', () => {
    /*
     * **The regression gate for a black screen.**
     *
     * The park is parented *inside* the globe, so fading the globe's root faded
     * the entire studio — and at rung 1 the planet's alpha is zero, which made a
     * new game open on nothing at all with a HUD over the top. A parent's
     * `visible` is not negotiable, so the planet's own layers had to become a
     * container of their own.
     */
    const g = buildGlobe()
    g.setChromeAlpha(0)
    expect(g.planet.visible).toBe(false)
    expect(g.container.visible).toBe(true)
    expect(g.parkHost.visible).toBe(true)
    g.setChromeAlpha(1)
    expect(g.planet.visible).toBe(true)
    expect(g.planet.alpha).toBe(1)
  })
})
