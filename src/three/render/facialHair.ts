import type { Object3D } from 'three'
import { box } from './worldArt.ts'

/** §7.8.12 [2026-10-09]: hair follows the cheek and jaw, with an open mouth, instead of hanging beneath the chin. */
export function sculptFacialHair(head: Object3D, style: number, hair: string): void {
  const mark = (x: number, y: number, z: number, w: number, h: number, d = .018) => {
    const m = box(head, x, y, z, w, h, d, hair, false)
    m.receiveShadow = false
  }
  if (style === 1 || style === 2 || style === 3) {
    for (const side of [-1, 1]) mark(side * .047, .085, -.202, .078, .025)
  }
  if (style === 2) {
    for (const side of [-1, 1]) mark(side * .063, .021, -.202, .025, .060)
    mark(0, .009, -.204, .145, .028)
  }
  if (style === 3) {
    for (const side of [-1, 1]) {
      mark(side * .164, .031, -.200, .094, .143)
      mark(side * .213, .028, -.048, .022, .162, .27)
      mark(side * .206, .17, -.035, .028, .115, .29)
    }
    mark(0, .007, -.204, .35, .029)
    for (const side of [-1, 1]) mark(side * .084, .027, -.203, .047, .052)
  }
}
