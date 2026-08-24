import { describe, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'

/**
 * A look at the planet, on demand — **not part of `npm test`.**
 *
 * ```
 * PREVIEW_OUT=globe.svg PREVIEW_DEVS=4000000 PREVIEW_T=0.62 npx vitest run src/render/__preview.test.ts
 * ```
 *
 * It records the real `Graphics` calls `globe.ts` makes and writes them out as
 * an SVG at the reference frame and at the scale the lens settles on for rung 6,
 * so what comes out is what a player would see.
 *
 * **It exists because three of the four defects in this level were invisible to
 * the arithmetic and obvious in a picture**, and every one of them had green
 * tests underneath it at the time:
 *
 *  - the lattice sorted by `surfaceAt` put the studio's first campus in
 *    Antarctica, and the planet turns to face site 0, so every render opened on
 *    the south pole;
 *  - four of the five terrain ramps opened on the background colour, so the
 *    unlit half of the world was exactly the colour of the gap around it and a
 *    sphere came out as a dome;
 *  - the campus lights and the address bracket were sized in pixels in a file
 *    that draws in globe units, where one unit is a twelfth of a pixel, so they
 *    were all sub-pixel and the planet had no lights on it at all.
 *
 * Skipped without `PREVIEW_OUT` so the suite neither runs it nor writes a file.
 */

type Op = { kind: string; fill?: number; stroke?: number; pts?: number[]; box?: number[] }

class FakeGraphics {
  ops: Op[] = []
  private pending: Op[] = []
  private path: number[] = []
  pos = { x: 0, y: 0 }
  position = {
    set: (x: number, y: number) => {
      this.pos = { x, y }
    },
  }
  clear() {
    this.ops = []
    this.pending = []
    this.path = []
    return this
  }
  circle(x: number, y: number, r: number) {
    this.pending.push({ kind: 'circle', box: [x, y, r] })
    return this
  }
  poly(pts: number[]) {
    this.pending.push({ kind: 'poly', pts: [...pts] })
    return this
  }
  rect(x: number, y: number, w: number, h: number) {
    this.pending.push({ kind: 'rect', box: [x, y, w, h] })
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

const { buildGlobe, DAY_MS } = await import('./globe.ts')
const { globeOrigin, globeFrame, fitScaleFor, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK } =
  await import('./frames.ts')
const { SITES_PER_GLOBE } = await import('./worldMap.ts')

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0')
}

describe('preview', () => {
  it.skipIf(!process.env.PREVIEW_OUT)('draws the planet to a file to be looked at', () => {
    const at = globeOrigin()
    // The reference frame, and the scale the lens would settle on at rung 6.
    const VIEW = { w: 997, h: 448 }
    const frame = globeFrame(SITES_PER_GLOBE, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK)
    const k = fitScaleFor(frame, VIEW)
    const devs = Number(process.env.PREVIEW_DEVS ?? 100e6)
    const t = Number(process.env.PREVIEW_T ?? 0.24)
    const site = Number(process.env.PREVIEW_SITE ?? 0)

    made.length = 0
    const g = buildGlobe()
    // The planet draws nothing while it is hidden, and it starts hidden.
    g.setChromeAlpha(1)
    g.setHeadcount(devs)
    g.setFocus(site)
    g.setClock(DAY_MS * t)

    const parts: string[] = []
    for (const gr of made) {
      const ox = gr.pos.x - at.x
      const oy = gr.pos.y - at.y
      for (const op of gr.ops) {
        const paint = op.fill !== undefined ? `fill="${hex(op.fill)}"` : 'fill="none"'
        const line =
          op.stroke !== undefined
            ? `fill="none" stroke="${hex(op.stroke)}" stroke-width="${1 / k}"`
            : paint
        if (op.kind === 'circle' && op.box) {
          parts.push(`<circle cx="${op.box[0] + ox}" cy="${op.box[1] + oy}" r="${op.box[2]}" ${paint}/>`)
        } else if (op.kind === 'rect' && op.box) {
          parts.push(
            `<rect x="${op.box[0] + ox}" y="${op.box[1] + oy}" width="${op.box[2]}" height="${op.box[3]}" ${paint}/>`,
          )
        } else if (op.pts) {
          const d = []
          for (let i = 0; i < op.pts.length; i += 2) d.push(`${op.pts[i] + ox},${op.pts[i + 1] + oy}`)
          const tag = op.kind === 'line' ? 'polyline' : 'polygon'
          parts.push(`<${tag} points="${d.join(' ')}" ${op.kind === 'line' ? line : paint}/>`)
        }
      }
    }
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW.w}" height="${VIEW.h}" ` +
      `viewBox="0 0 ${VIEW.w} ${VIEW.h}" shape-rendering="crispEdges">` +
      `<rect width="${VIEW.w}" height="${VIEW.h}" fill="#14121a"/>` +
      `<g transform="translate(${VIEW.w / 2},${VIEW.h / 2}) scale(${k})">${parts.join('')}</g></svg>`
    writeFileSync(process.env.PREVIEW_OUT ?? 'globe-preview.svg', svg)
  })
})
