/*
 * Copied from the rebuild (100m-devs-three/src/render/garageBackyard.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
import * as T from 'three'
import { box, cylinder, INK, line, material, sphere } from './worldArt.ts'

/** A quiet duck pool in the planted courtyard. */
export function garageBackyard(parent: T.Group): void {
  const yard = new T.Group(); yard.position.y = -.5; parent.add(yard)
  // Continuous paving joins the back-lane crossing to the garage's paved apron.
  box(yard, -10, 0, -12.35, 1.2, .1, 6.9, '#c6c4b2')
  for (let z = -15; z < -9; z += .75) box(yard, -10, .101, z, 1.18, .003, .014, '#aaaE9c', false)
  const fountain = new T.Group(); fountain.position.set(-5.9, 0, -13.1); yard.add(fountain)
  const mesh = (geometry: T.BufferGeometry, colour: string, y = 0) => {
    const m = new T.Mesh(geometry, material(colour)); m.position.y = y
    m.userData.ownGeometry = true; m.castShadow = true; m.receiveShadow = true; fountain.add(m)
    return m
  }
  // A shallow, genuinely hollow stone basin. 3.5 m across, knee-high coping.
  mesh(new T.CylinderGeometry(1.87, 1.92, .08, 32), '#a6ab99', .04)
  mesh(new T.LatheGeometry([
    new T.Vector2(0, .08), new T.Vector2(1.73, .08),
    new T.Vector2(1.73, .31), new T.Vector2(1.79, .34),
    new T.Vector2(1.79, .43), new T.Vector2(1.48, .43),
    new T.Vector2(1.48, .16), new T.Vector2(0, .16),
  ], 32), '#c3c4b3')
  mesh(new T.CylinderGeometry(1.47, 1.47, .018, 48), '#659d9f', .285)
  // Fine radial joints make the coping read as fitted stone, not a solid disk.
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2
    line(fountain, [new T.Vector3(Math.cos(a) * 1.5, .432, Math.sin(a) * 1.5),
      new T.Vector3(Math.cos(a) * 1.77, .432, Math.sin(a) * 1.77)], '#9da697')
  }
  cylinder(fountain, 0, .16, 0, .39, .26, '#aab4a7')
  const duck = new T.Group(); duck.position.y = .447; duck.scale.setScalar(.78); duck.rotation.y = .55; fountain.add(duck)
  const form = (x: number, y: number, z: number, r: number, colour: string, stretch: [number, number, number]) => {
    const part = sphere(duck, x, y, z, r, colour)
    part.scale.multiply(new T.Vector3(...stretch)); return part
  }
  form(0, .43, 0, .62, '#dfbd54', [1, .75, 1.25])
  form(0, .94, .38, .37, '#e8cc69', [1, 1, 1])
  form(0, .84, .78, .22, '#c58845', [1.05, .32, 1.15])
  for (const side of [-1, 1]) {
    form(side * .51, .46, -.03, .3, '#cda744', [.32, .7, 1.3])
    sphere(duck, side * .27, 1.02, .59, .041, '#383e34')
  }
  form(0, .5, -.65, .25, '#dfbd54', [.6, .65, 1.1]).rotation.x = -.4

  // A small planted bed and a two-seat bench occupy the rear lawn.
  box(yard, -.75, 0, -14.7, 3.5, .1, .7, '#77805d')
  for (let i = 0; i < 9; i++) {
    const x = -2.2 + i * .36
    sphere(yard, x, .24, -14.7, .19, '#81905e', true)
    sphere(yard, x, .4, -14.67, .07, i % 2 ? '#b7a7bf' : '#dbc48c', true)
  }
  for (const x of [-1.5, .1]) box(yard, x, 0, -13.7, .09, .44, .52, INK.metal)
  for (const z of [-13.9, -13.72, -13.54]) box(yard, -.7, .44, z, 2.15, .07, .14, INK.wood)
  for (const x of [-1.5, .1]) box(yard, x, .44, -14, .07, .45, .07, INK.metal)
  for (const y of [.64, .83]) box(yard, -.7, y, -14, 2.15, .12, .06, INK.wood)
}

