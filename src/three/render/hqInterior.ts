/** §7.8.12 [2026-10-07]: a workshop with a gallery and garden, keeping the hero stations intact. */
import * as T from 'three'
import { GARAGE_PODS, HQ_FINISHES, HQ_GARDEN } from '../sim/floorPlan.ts'
import { box, slab } from './worldArt.ts'
import { lamp } from './glowArt.ts'
import { leafyPlanter } from './garageCraft.ts'

export function hqInterior(g: T.Group): void {
  // Flush stone paths give the room a readable cross and spine without closing walking lanes.
  for (const f of HQ_FINISHES) {
    slab(g, [[f.x0, f.z0], [f.x1, f.z0], [f.x1, f.z1], [f.x0, f.z1]], .018, .009, f.colour)
  }
  // Woven islands distinguish teams from the shared avenue; a finish is present even before a desk arrives.
  for (const p of GARAGE_PODS) {
    const w = p.rot === 90 ? 4.15 : 4.7, d = p.rot === 90 ? 4.6 : 4.1
    box(g, p.x, .018, p.z, w, .009, d, '#718f8b', false)
    box(g, p.x, .028, p.z - d / 2 + .12, w - .24, .004, .045, '#bdc8b6', false)
  }
  // The backing colours frame work and people; their branch accents can remain small and purposeful.
  box(g, -7.6, 1.22, -9.655, 4.15, 2.25, .025, '#526e68', false)
  for (let x = -9.5; x < -5.55; x += .23) box(g, x, 1.22, -9.62, .045, 2.25, .035, '#b08c5c', false)
  box(g, -1.6, .22, -9.655, 4, 3.2, .025, '#728a70', false)
  box(g, 4.4, .92, -9.655, 4.8, 2.6, .025, '#4b6874', false)
  // A continuous warm diffuser ties the disparate work areas together, without a coloured light on faces.
  lamp(g, 2.4, 3.45, -9.56, 14, .045, .055, '#dfd8b9')
  lamp(g, -9.73, 3.45, -5.95, .055, .045, 7.1, '#dfd8b9')
  // An actual open-air court cuts into the frontage. It is outside the work floor,
  // so the grass and planting cannot become a shortcut through an invisible wall.
  const c = HQ_GARDEN
  box(g, (c.x0 + c.x1) / 2, -.28, (c.z0 + c.z1) / 2, c.x1 - c.x0, .08, c.z1 - c.z0, '#7e9365', false)
  for (const [x, z] of [[-1.3, 5.7], [3.3, 5.7], [3.3, 8.3]]) leafyPlanter(g, x, z, .7)
  for (let x = -.6; x < 2.6; x += .6) box(g, x, -.195, 7.0, .42, .03, .72, '#c4bca3', false)
  box(g, 1, -.2, 8.4, 2.5, .46, .5, '#927b56')
  box(g, 1, .26, 8.4, 2.6, .09, .55, '#aab7a4')
}
