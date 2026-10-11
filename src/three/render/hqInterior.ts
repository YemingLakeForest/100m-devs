/** §7.8.12 [2026-10-07]: a workshop with a gallery and garden, keeping the hero stations intact. */
import * as T from 'three'
import { GARAGE_PODS, GARAGE_POD_LAYOUT, GARAGE_FURNITURE, HQ_FINISHES, GARAGE_HERO_DECK } from '../sim/floorPlan.ts'
import { box, sharedMaterial } from './worldArt.ts'
import { courtyardGarden } from './garageGarden.ts'
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

/** Low-detail books and stepped plants give scale to the working wall at the room camera. */
function studioBookcase(g: T.Group, x: number, z: number): void {
  box(g, x, 0, z, 1.05, .10, .65, '#34494f')
  for (const dx of [-.49, .49]) box(g, x + dx, .10, z, .07, 2.30, .65, '#76583d')
  box(g, x, .10, z - .29, .96, 2.30, .035, '#34494f')
  for (const y of [.65, 1.20, 1.75, 2.30]) {
    box(g, x, y, z, 1.05, .065, .65, '#ba9263')
    if (y < 2) for (let i = 0; i < 5; i++)
      box(g, x - .35 + i * .15, y + .065, z + .07, .10, .32 + i % 2 * .08, .30,
        ['#688f9a', '#b19665', '#61745d', '#a2a99a', '#76583d'][i])
  }
  const plant = new T.Group(); plant.position.y = 2.37; g.add(plant)
  leafyPlanter(plant, x, z, .38)
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
  // The diagonal backdrop belongs to the real chamfer, aligned with the founder's six-o'clock desk.
  const backdrop = new T.Group(); backdrop.name = 'founder-diagonal-backdrop'
  backdrop.position.set(-8.5, 0, -8.3); backdrop.rotation.y = Math.PI / 4; g.add(backdrop)
  box(backdrop, 0, .24, .08, 3.50, 4.05, .03, '#3a565e', false)
  for (let x = -1.575; x < 1.7; x += .21) box(backdrop, x, .24, .115, .045, 4.05, .035, '#b08c5c', false)
  const workwall = new T.Group(); workwall.position.y = GARAGE_HERO_DECK.rise; g.add(workwall)
  box(workwall, -1.6, .22, -9.655, 4, 3.2, .025, '#3a565e', false)
  box(workwall, 4.4, .22, -9.655, 4.8, 3.2, .025, '#3a565e', false)
  // A creative wall fills the early bay without an unexplained enclosure.
  // The studies give way to Serena's working dashboards when she arrives.
  for (let i = 0; i < 3; i++) galleryStudy(studies, 3 + i, 3 + i * 1.4, true)
  for (const x of [2.16, 6.64]) {
    box(workwall, x, .22, -9.60, .08, 3.1, .055, '#ba9263', false)
  }
  const storage = GARAGE_FURNITURE.find(f => f.kind === 'shelving')!
  box(workwall, storage.x, 0, storage.z, storage.w, 1.04, storage.d, '#34494f')
  box(workwall, storage.x, 1.04, storage.z, storage.w + .06, .065, storage.d + .04, '#ba9263')
  for (const side of [-1, 1]) {
    const x = storage.x + side * .32
    box(workwall, x, .09, storage.z + storage.d / 2 + .015, .59, .84, .025, '#76583d')
    box(workwall, x - side * .20, .55, storage.z + storage.d / 2 + .033, .025, .14, .025, '#879e9f')
  }
  // Cohesion comes from the work wall and material system; personal desktops stay separate.
  studioBookcase(workwall, -4.55, -9.08)
  studioBookcase(workwall, 8, -9.08)
  // Matching stiles and header join the hero bays into one architectural work wall.
  for (const x of [-3.55, .35, 2.05, 6.75]) box(workwall, x, 1.0, -9.59, .07, 2.35, .065, '#ba9263')
  box(workwall, 1.6, 3.35, -9.59, 10.5, .08, .065, '#ba9263')
  // [2026-10-11, at the user's instruction: *"don't like the white line on the back and side wall"*] There used to be
  // a "continuous warm diffuser" here: two 5 cm cream bars of unlit emissive, one 14 m long across the north wall and
  // one 7 m long down the west one, at 3.45 m. It was meant to tie the work areas together and read as a stripe
  // drawn on the plaster, stopping and starting at nothing. The sconces and the sky rig are what light the room.
  // An actual open-air court cuts into the frontage. It is outside the work floor,
  // so the grass and planting cannot become a shortcut through an invisible wall.
  const garden = new T.Group(); garden.position.y = -.20; g.add(garden)
  courtyardGarden(garden)
}
