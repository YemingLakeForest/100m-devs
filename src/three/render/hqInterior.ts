/** §7.8.12 [2026-10-07]: a workshop with a gallery and garden, keeping the hero stations intact. */
import * as T from 'three'
import { GARAGE_PODS, GARAGE_POD_LAYOUT, GARAGE_FURNITURE, HQ_FINISHES, HQ_GARDEN } from '../sim/floorPlan.ts'
import { box, sharedMaterial } from './worldArt.ts'
import { lamp } from './glowArt.ts'
import { leafyPlanter } from './garageCraft.ts'
import { paintCover } from '../art/coverPixels.ts'
import { coverFor } from '../sim/cover.ts'

/** Studio concept studies, using the game's own pixel painter rather than foreign art. */
function galleryStudy(parent: T.Group, ordinal: number, along: number, north = false): void {
  const frame = new T.Group()
  frame.position.set(north ? along : -12.83, 0, north ? -9.58 : along)
  frame.rotation.y = north ? 0 : Math.PI / 2
  parent.add(frame)
  box(frame, 0, 1.96, 0, 1.16, 1.38, .10, '#24383f')
  box(frame, 0, 2.03, .063, 1.02, 1.24, .026, '#eceee4', false)
  const mat = sharedMaterial(`hq-study:${ordinal}`, () => {
    const bitmap = paintCover(coverFor(71, ordinal, 85, 'Studio study', ordinal === 0 ? 'arcade' : ordinal === 1 ? 'rpg' : 'puzzle'))
    const bytes = new Uint8Array(bitmap.size * bitmap.size * 4)
    bitmap.cells.forEach((cell, i) => {
      const colour = Number.parseInt(bitmap.palette[cell].slice(1), 16)
      bytes.set([colour >> 16, (colour >> 8) & 255, colour & 255, 255], i * 4)
    })
    const map = new T.DataTexture(bytes, bitmap.size, bitmap.size)
    map.colorSpace = T.SRGBColorSpace; map.magFilter = T.NearestFilter; map.minFilter = T.NearestFilter
    map.flipY = true; map.needsUpdate = true
    return new T.MeshBasicMaterial({ map, color: '#b8b8b8' })
  })
  const picture = new T.Mesh(new T.PlaneGeometry(.90, .90), mat)
  picture.position.set(0, 2.67, .084)
  picture.userData.ownGeometry = true; frame.add(picture)
}

export function hqInterior(g: T.Group, studies: T.Group): void {
  // Fine inlays show circulation without the oversized carpet cross of the first cut.
  for (const f of HQ_FINISHES) {
    const x = (f.x0 + f.x1) / 2, z = (f.z0 + f.z1) / 2
    for (const edge of [f.z0, f.z1]) box(g, x, .018, edge, f.x1 - f.x0, .003, .025, '#879e9f', false)
    for (const edge of [f.x0, f.x1]) box(g, edge, .018, z, .025, .003, f.z1 - f.z0, '#879e9f', false)
  }
  // Oak work bays are architectural insets, not empty carpet rectangles. They
  // remain ready for the next team without adding fake desks to the headcount.
  for (const p of GARAGE_PODS) {
    const w = p.rot === 90 ? GARAGE_POD_LAYOUT.matAcross : GARAGE_POD_LAYOUT.matAlong
    const d = p.rot === 90 ? GARAGE_POD_LAYOUT.matAlong : GARAGE_POD_LAYOUT.matAcross
    box(g, p.x, .018, p.z, w, .008, d, '#42575a', false)
    box(g, p.x, .028, p.z, w - .10, .006, d - .10, '#b0926c', false)
    for (let z = p.z - d / 2 + .55; z < p.z + d / 2 - .1; z += .55) {
      box(g, p.x, .037, z, w - .20, .002, .012, '#9a805e', false)
    }
  }
  // The lounge belongs to a creative studio: oak acoustic backing and framed
  // pixel studies, at eye level and wholly within the existing wall/sofa bay.
  box(g, -12.87, .22, 5.8, .026, 3.14, 3.64, '#947a58', false)
  for (let z = 4.05; z < 7.55; z += .20) box(g, -12.85, .24, z, .026, 3.08, .025, '#6c604d', false)
  for (let i = 0; i < 3; i++) galleryStudy(g, i, 4.6 + i * 1.2)
  // The backing colours frame work and people; their branch accents can remain small and purposeful.
  box(g, -7.6, 1.22, -9.655, 4.15, 2.25, .025, '#3a565e', false)
  for (let x = -9.5; x < -5.55; x += .23) box(g, x, 1.22, -9.62, .045, 2.25, .035, '#b08c5c', false)
  box(g, -1.6, .22, -9.655, 4, 3.2, .025, '#3a565e', false)
  box(g, 4.4, .92, -9.655, 4.8, 2.6, .025, '#3a565e', false)
  // A creative wall fills the early bay without an unexplained enclosure.
  // The studies give way to Serena's working dashboards when she arrives.
  for (let i = 0; i < 3; i++) galleryStudy(studies, 3 + i, 3 + i * 1.4, true)
  for (const x of [2.16, 6.64]) {
    box(g, x, .96, -9.60, .08, 2.5, .055, '#ba9263', false)
  }
  const storage = GARAGE_FURNITURE.find(f => f.kind === 'shelving')!
  box(g, storage.x, 0, storage.z, storage.w, 1.04, storage.d, '#34494f')
  box(g, storage.x, 1.04, storage.z, storage.w + .06, .065, storage.d + .04, '#ba9263')
  for (const side of [-1, 1]) {
    const x = storage.x + side * .32
    box(g, x, .09, storage.z + storage.d / 2 + .015, .59, .84, .025, '#76583d')
    box(g, x - side * .20, .55, storage.z + storage.d / 2 + .033, .025, .14, .025, '#879e9f')
  }
  // Matching stiles and header join the hero bays into one architectural work wall.
  for (const x of [-3.55, .35, 2.05, 6.75]) box(g, x, 1.0, -9.59, .07, 2.35, .065, '#ba9263')
  box(g, 1.6, 3.35, -9.59, 10.5, .08, .065, '#ba9263')
  // A continuous warm diffuser ties the disparate work areas together, without a coloured light on faces.
  lamp(g, 2.4, 3.45, -9.56, 14, .045, .055, '#dfd8b9')
  lamp(g, -9.73, 3.45, -5.95, .055, .045, 7.1, '#dfd8b9')
  // An actual open-air court cuts into the frontage. It is outside the work floor,
  // so the grass and planting cannot become a shortcut through an invisible wall.
  const c = HQ_GARDEN
  const garden = new T.Group(); garden.position.y = -.20; g.add(garden)
  box(garden, (c.x0 + c.x1) / 2, -.08, (c.z0 + c.z1) / 2, c.x1 - c.x0, .08, c.z1 - c.z0, '#52755a', false)
  // Continuous paving and planted edges give the courtyard a purpose and ground every object.
  // A single paving grid prevents the old crossing paths from sharing faces.
  for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) {
    const x = -.95 + col * .65, z = 5.55 + row * .65
    if (col === 2 || col === 3 || row === 3 || row === 4 && col > 0 && col < 6)
      box(garden, x, .01, z, .615, .045, .615, '#aaa58e', false)
  }
  for (const x of [-1.45, 3.45]) {
    box(garden, x, 0, 6.1, .65, .23, 1.85, '#41565b')
    box(garden, x, .23, 6.1, .57, .035, 1.77, '#60513b')
    box(garden, x, .23, 6.1, .71, .045, 1.91, '#87938a')
    box(garden, x, .276, 6.1, .53, .015, 1.73, '#60513b')
    for (const z of [5.55, 6.1, 6.65]) {
      box(garden, x, .27, z, .45, .28, .45, '#416652')
      box(garden, x - .07, .55, z, .33, .16, .34, '#63836a')
      box(garden, x + .11, .40, z + .11, .23, .20, .25, '#52765b')
    }
  }
  for (const x of [-.15, 2.15]) box(garden, x, .03, 8.37, .10, .41, .48, '#34494f')
  for (let z = 8.12; z < 8.65; z += .15) box(garden, 1, .44, z, 2.6, .065, .12, '#a18b65')
  for (const x of [-.15, 2.15]) box(garden, x, .45, 8.62, .07, .53, .07, '#34494f')
  for (const y of [.66, .84]) box(garden, 1, y, 8.62, 2.6, .12, .06, '#a18b65')
  leafyPlanter(garden, -1.30, 8.35, .65)
  leafyPlanter(garden, 3.30, 8.35, .65)
  // A small garden tree, layered understory and a light timber arbor frame the seating pocket.
  box(garden, -1.42, .08, 7.48, .11, 1.30, .11, '#76583d')
  for (const [dx, dy, dz, w, h] of [[0, 1.18, 0, .70, .52], [-.22, 1.45, .07, .49, .36], [.20, 1.40, -.10, .48, .38]])
    box(garden, -1.42 + dx, dy, 7.48 + dz, w, h, w, '#416652')
  for (const x of [-1.4, 3.4]) for (const z of [5.65, 6.35]) {
    box(garden, x + .16, .48, z, .12, .16, .12, '#63836a')
    box(garden, x + .16, .64, z, .13, .08, .13, '#8f8395')
  }
  for (const x of [-.40, 2.40]) {
    box(garden, x, 0, 8.8, .13, 2.12, .13, '#76583d')
    box(garden, x, .01, 8.8, .18, .10, .18, '#34494f')
  }
  box(garden, 1, 2.12, 8.8, 3.12, .13, .15, '#a18b65')
  for (let x = -.4; x < 2.6; x += .40) box(garden, x, 2.22, 8.40, .08, .09, .94, '#a18b65')
  for (const x of [-1.91, 3.91]) box(garden, x, 0, 7, .16, .02, 3.9, '#87938a', false)

}
