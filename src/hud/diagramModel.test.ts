import { describe, expect, it } from 'vitest'
import {
  ARROW_LENGTH,
  connector,
  junctions,
  toPixels,
  worldFor,
  type BoardMetrics,
} from './diagramModel.ts'

const M: BoardMetrics = {
  cellX: 100,
  cellY: 80,
  originX: 2,
  originY: 2,
  nodeW: 60,
  nodeH: 40,
}

function points(s: string): Array<{ x: number; y: number }> {
  return s
    .split(' ')
    .filter(Boolean)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number)
      return { x, y }
    })
}

describe('cells to pixels', () => {
  it('puts the origin cell where the origin says', () => {
    expect(toPixels({ x: 0, y: 0 }, M)).toEqual({ x: 200, y: 160 })
    expect(toPixels({ x: 1, y: -1 }, M)).toEqual({ x: 300, y: 80 })
  })
})

describe('the connector', () => {
  it('starts at the parent border rather than at its centre', () => {
    // A line from centre to centre is a line underneath two boxes. Half the box
    // is the whole trim, because §11.4.1 forbids anything but right angles.
    const [start] = points(connector([{ x: 0, y: 0 }, { x: 1, y: 0 }], M).line)
    expect(start.x).toBe(200 + M.nodeW / 2)
    expect(start.y).toBe(160)
  })

  it('stops short of the child border by exactly the arrowhead', () => {
    const line = points(connector([{ x: 0, y: 0 }, { x: 1, y: 0 }], M).line)
    const end = line[line.length - 1]
    // Child centre 300, border at 300 − 30, arrow base another ARROW_LENGTH back.
    expect(end.x).toBeCloseTo(300 - M.nodeW / 2 - ARROW_LENGTH, 5)
  })

  it('puts the arrow apex on the child border, pointing the way the tree grows', () => {
    const arrow = points(connector([{ x: 0, y: 0 }, { x: 1, y: 0 }], M).arrow)
    expect(arrow).toHaveLength(3)
    // Apex first, on the border and on the axis.
    expect(arrow[0].x).toBeCloseTo(300 - M.nodeW / 2, 5)
    expect(arrow[0].y).toBeCloseTo(160, 5)
    // The base is square to the segment, so its two corners share an x and
    // straddle the axis — a triangle that leans is a diagram nobody trusts.
    expect(arrow[1].x).toBeCloseTo(arrow[2].x, 5)
    expect(arrow[1].y + arrow[2].y).toBeCloseTo(2 * 160, 5)
  })

  it('trims on the vertical axis when the segment is vertical', () => {
    const [start] = points(connector([{ x: 0, y: 0 }, { x: 0, y: -1 }], M).line)
    expect(start.x).toBe(200)
    expect(start.y).toBe(160 - M.nodeH / 2)
  })

  it('keeps the elbow of a three-point path', () => {
    // The corner is the whole reason §11.4.1 exists. Trimming must touch the
    // ends and never the turn.
    const line = points(
      connector([{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }], M).line,
    )
    expect(line).toHaveLength(3)
    expect(line[1]).toEqual({ x: 200, y: 320 })
  })

  it('returns nothing at all for a path with no segments', () => {
    expect(connector([], M)).toEqual({ line: '', arrow: '' })
    expect(connector([{ x: 0, y: 0 }], M)).toEqual({ line: '', arrow: '' })
  })
})

describe('junctions', () => {
  it('marks a corner two connectors share', () => {
    // §13.9's board: Support and Cloud both leave the trunk southward and turn
    // at the same cell. A fork nobody drew reads as two lines crossing.
    const forks = junctions(
      [
        [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 2 }],
        [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }],
      ],
      M,
    )
    expect(forks).toEqual([toPixels({ x: 0, y: 2 }, M)])
  })

  it('leaves a lone corner undotted', () => {
    expect(junctions([[{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }]], M)).toEqual([])
  })

  it('never dots an endpoint, however many connectors meet there', () => {
    // Every chain begins at the trunk. A dot there is a dot under a box.
    expect(
      junctions(
        [
          [{ x: 0, y: 0 }, { x: 1, y: 0 }],
          [{ x: 0, y: 0 }, { x: -1, y: 0 }],
          [{ x: 0, y: 0 }, { x: 0, y: -1 }],
        ],
        M,
      ),
    ).toEqual([])
  })
})

describe('the world', () => {
  it('pads far enough that an edge node is not half off the board', () => {
    const world = worldFor({ minX: -6, maxX: 6, minY: -6, maxY: 7 }, 100, 80, 60, 40, 1)
    // The outermost node's centre must sit at least half a box inside.
    const left = toPixels({ x: -6, y: 0 }, world)
    expect(left.x).toBeGreaterThanOrEqual(60 / 2)
    expect(world.width - toPixels({ x: 6, y: 0 }, world).x).toBeGreaterThanOrEqual(60 / 2)
    expect(world.height).toBeGreaterThan(0)
  })
})
