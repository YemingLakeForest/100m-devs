/** §7.8.12: a continuous L-shaped oak deck, not separate hero display bases. */
import * as T from 'three'
import { box, slab } from './worldArt.ts'
import { GARAGE_HERO_DECK, HERO_SITES } from '../sim/floorPlan.ts'

function floorGroup(g: T.Group): T.Group {
  const floor = new T.Group(); floor.position.y = GARAGE_HERO_DECK.rise; g.add(floor)
  return floor
}

/** Clip a board to the founder corner so timber never extends through the diagonal shell. */
function clipBoards(points: [number, number][], signedDistance: (p: [number, number]) => number): [number, number][] {
  const result: [number, number][] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    const da = signedDistance(a), db = signedDistance(b)
    if (da >= 0) result.push(a)
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db)
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return result
}

export function ziggurat(g: T.Group): { podium: T.Group; deck: T.Group } {
  const d = GARAGE_HERO_DECK
  const timber = new T.Group(); timber.name = 'shared-L-timber-platform'; g.add(timber)
  slab(timber, d.outline.map(p => [p[0], p[1]]), 0, d.rise - .025, '#76583d')
  // Clip the same plank grid to the actual deck outline, including the recessed and diagonal edges.
  const contour = d.outline.map(([x, z]) => new T.Vector2(x, z))
  const triangles = T.ShapeUtils.triangulateShape(contour, []).map(indices => {
    const points = indices.map(i => [contour[i].x, contour[i].y] as [number, number])
    const [a, b, c] = points
    if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) points.reverse()
    return points
  })
  for (let row = Math.floor(-9.68 / .32); row * .32 < 2.3; row++) {
    const bottom = row * .32, end = (row + 1) * .32
    for (let x = -12 + Math.abs(row % 2) * 1.1, col = 0; x < 8.65; x += 2.2, col++) {
      const plank: [number, number][] = [[x + .006, bottom + .004], [x + 2.194, bottom + .004],
        [x + 2.194, end - .004], [x + .006, end - .004]]
      for (const triangle of triangles) {
        let board = plank
        for (let i = 0; i < 3; i++) {
          const a = triangle[i], b = triangle[(i + 1) % 3]
          board = clipBoards(board, p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]))
        }
        if (board.length >= 3) slab(timber, board, d.rise - .025, .025,
          ['#ae8960', '#b08b62', '#b38d63'][((row + col) % 3 + 3) % 3])
      }
    }
  }
  // The access tread follows the founder's diagonal edge rather than projecting from the recessed ops bays.
  const step = new T.Group(); step.position.set(-5.3, 0, -4.8); step.rotation.y = Math.PI / 4; timber.add(step)
  box(step, 0, 0, .22, 1.8, .12, .44, '#76583d')
  box(step, 0, .12, .22, 1.82, .025, .45, '#b08b62')
  // The wide front tread belongs to the shared deck, outside the briefing furniture footprint.
  box(timber, 2.5, 0, 2.52, 1.6, .12, .44, '#76583d')
  box(timber, 2.5, .12, 2.52, 1.62, .025, .45, '#b08b62')
  return { podium: floorGroup(g), deck: floorGroup(g) }
}
export function opsPlinth(g: T.Group, _baseGroup: T.Group = g): T.Group { return floorGroup(g) }
export const OPS_STEP = { x: HERO_SITES.serena.x1 - .6, z: HERO_SITES.serena.z1 + .3 } as const
/** The shared architectural tread is built once, rather than arriving with individual stations. */
export function opsStep(_step: T.Group): void {}
export function heroRiser(g: T.Group, _shell: T.Group, _id: 'matt'): T.Group { return floorGroup(g) }
