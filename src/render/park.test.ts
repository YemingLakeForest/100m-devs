import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The park stands on the planet — the other half of `globe.test.ts`.
 *
 * `HANDOFF-2026-08-23.md` §3 states the rule this file exists to hold:
 *
 * > **Everything the studio *built* is neutral. Everything it *stands on*
 * > belongs to the planet.**
 *
 * Reported as a campus reading like *"a patched-on grey sticker"* laid on a
 * green world, which is exactly what `NEUTRAL[1]` at 0.72 alpha was. The two
 * assertions below are the two halves of the fix, and the second is the one that
 * is easy to lose: it is not enough for the ground to take the biome, the
 * *hardware* has to refuse it.
 */
type Op = { fill?: number; stroke?: number }

class FakeGraphics {
  ops: Op[] = []
  private pending = 0
  clear() {
    this.ops = []
    this.pending = 0
    return this
  }
  fill(o: number | { color: number }) {
    const color = typeof o === 'number' ? o : o.color
    for (let i = 0; i <= this.pending; i++) this.ops.push({ fill: color })
    this.pending = 0
    return this
  }
  stroke(o: number | { color: number }) {
    const color = typeof o === 'number' ? o : o.color
    this.ops.push({ stroke: color })
    this.pending = 0
    return this
  }
  /** Every other `Graphics` verb is a shape: counted, and otherwise a no-op. */
  private shape() {
    this.pending += 1
    return this
  }
  moveTo() {
    return this
  }
  lineTo() {
    return this
  }
  closePath() {
    return this
  }
  poly() {
    return this.shape()
  }
  rect() {
    return this.shape()
  }
  circle() {
    return this.shape()
  }
  ellipse() {
    return this.shape()
  }
  roundRect() {
    return this.shape()
  }
  arc() {
    return this
  }
  arcTo() {
    return this
  }
  quadraticCurveTo() {
    return this
  }
  bezierCurveTo() {
    return this
  }
  beginPath() {
    return this
  }
  regularPoly() {
    return this.shape()
  }
  position = { set: vi.fn() }
  scale = { set: vi.fn() }
  alpha = 1
  visible = true
}

const made: FakeGraphics[] = []

class FakeContainer {
  children: unknown[] = []
  alpha = 1
  visible = true
  label = ''
  position = { set: vi.fn() }
  scale = { set: vi.fn() }
  pivot = { set: vi.fn() }
  addChild(...kids: unknown[]) {
    this.children.push(...kids)
    return kids[0]
  }
  removeChildren() {
    this.children = []
  }
  destroy() {}
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

const { buildPark } = await import('./park.ts')
const { ARID, POLAR, TEMPERATE, TERRAIN, terrainShade } = await import('./worldMap.ts')
const { RAMPS, hexToRgb } = await import('../art/palette.ts')

function num(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/**
 * `buildPark` makes the board first, then the water, the wiring and the marks,
 * and only then the ten blocks. So the board is the first `Graphics` in the
 * file and the marks are the fourth.
 */
const BOARD = 0
const MARKS = 3

describe('the park stands on the planet', () => {
  beforeEach(() => {
    made.length = 0
  })

  it('takes the ground colour of wherever on the planet it is', () => {
    const park = buildPark()
    park.setHeadcount(1e6)

    for (const [biome, name] of [
      [TEMPERATE, 'grassland'],
      [ARID, 'desert'],
      [POLAR, 'ice'],
    ] as const) {
      park.setTerrain(biome, 3)
      const fills = new Set(made[BOARD].ops.map((o) => o.fill).filter((f) => f !== undefined))
      // The island is filled with the site's own ground, one step darker than
      // the field around it — the *same expression* `globe.ts` fills that site's
      // mark with, which is what makes the hand-off a swap.
      expect(fills, name).toContain(num(terrainShade(biome, 3, -1)))
      // And every colour on the board comes off that biome's ramp. A grey in
      // here is a mat, and a mat is what this replaced.
      const ramp = new Set(TERRAIN[biome].map(num))
      for (const op of made[BOARD].ops) {
        if (op.fill !== undefined) expect(ramp, name).toContain(op.fill)
        if (op.stroke !== undefined) expect(ramp, name).toContain(op.stroke)
      }
    }
  })

  it('accepts every fixed ground step the territory hand-off can provide', () => {
    const park = buildPark()
    park.setHeadcount(1e6)
    park.setTerrain(TEMPERATE, 4)
    const bright = made[BOARD].ops.map((o) => o.fill).join()
    expect(new Set(made[BOARD].ops.map((o) => o.fill))).toContain(
      num(terrainShade(TEMPERATE, 4, -1)),
    )
    park.setTerrain(TEMPERATE, 0)
    const dark = made[BOARD].ops.map((o) => o.fill).join()
    expect(dark).not.toBe(bright)
    expect(new Set(made[BOARD].ops.map((o) => o.fill))).toContain(num(TERRAIN[TEMPERATE][0]))
  })

  it('does not repaint a single thing the studio built', () => {
    /*
     * **The half of the rule that is easy to lose.**
     *
     * Concrete is grey wherever you pour it. A deck, a package, a bus, a
     * substation and a tower are things the studio *put there*, and a deck that
     * took the biome's colour would be a campus in camouflage — which reads as
     * *worse* than the grey mat, because it says the studio is part of the
     * landscape rather than something dropped onto it.
     *
     * Asserted as an identity rather than as a colour list, so it cannot be
     * satisfied by a ramp that happens to contain a grey: move the park from
     * grassland to desert to ice and the marks layer must not change **at all**.
     */
    const park = buildPark()
    park.setHeadcount(1e6)

    park.setTerrain(TEMPERATE, 3)
    const grass = JSON.stringify(made[MARKS].ops)
    park.setTerrain(ARID, 3)
    expect(JSON.stringify(made[MARKS].ops)).toBe(grass)
    park.setTerrain(POLAR, 0)
    expect(JSON.stringify(made[MARKS].ops)).toBe(grass)

    // And it is a real picture rather than an empty layer both times.
    expect(made[MARKS].ops.length).toBeGreaterThan(20)
    const neutrals = new Set(RAMPS.NEUTRAL.map(num))
    const deckTops = made[MARKS].ops.filter((o) => o.fill !== undefined && neutrals.has(o.fill))
    expect(deckTops.length).toBeGreaterThan(10)
  })
})
