/*
 * Copied from the rebuild (100m-devs-three/src/render/heroHead.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
import * as T from 'three'
import { box } from './worldArt.ts'
import type { LeaderId } from '../sim/floorPlan.ts'

/** GDD §7.6: sculpt the named cast from the identity board, at gameplay scale.
 * Open spectacle frames leave skin around the eyes; solid lenses at this size
 * turn the entire face into a black band. All details remain cuboid geometry.
 */
export function heroHead(head: T.Group, id: LeaderId, skin: string, hair: string): void {
  const james = id === 'james', billy = id === 'billy', serena = id === 'serena'
  const ink = '#303432'
  box(head, 0, 0, 0, .43, .44, .38, skin)
  for (const s of [-1, 1]) {
    box(head, s * .224, .13, -.005, .045, .10, .085, skin)
    box(head, s * .086, .208, -.196, .034, .054, .014, ink)
    box(head, s * .086, .296, -.198, .073, .019, .016, hair)
  }
  box(head, .006, .151, -.208, .047, .06, .041, skin)
  box(head, 0, .089, -.197, .082, .014, .014, '#93694e')

  // Layered crown and an offset part read as hair, rather than a single cap.
  box(head, 0, .377, .014, .455, .092, .43, hair)
  box(head, -.049, .469, .027, .34, .035, .35, hair)
  box(head, 0, .22, .185, .445, .18, .07, hair)
  if (serena) {
    for (const s of [-1, 1]) {
      box(head, s * .229, .032, .038, .066, .365, .35, hair)
      box(head, s * .193, .333, -.179, .075, .065, .06, hair)
    }
    box(head, -.037, .357, -.199, .31, .039, .05, hair)
    box(head, 0, .045, .196, .45, .26, .073, hair)
  } else {
    box(head, -.062, .358, -.196, .305, .063, .057, hair)
    box(head, .161, .325, -.12, .065, .105, .22, hair)
    if (!billy && !james) {
      for (const s of [-1, 1]) box(head, s * .218, .248, .018, .029, .128, .27, '#aaa89e')
      box(head, -.065, .379, -.198, .29, .04, .019, '#99978f')
    }
  }
  if (james || billy) {
    // Carry the temple hair down in front of each ear. James's longer
    // sideburns meet his beard; Billy's finish above his clean-shaven cheeks.
    const bottom = james ? .18 : .235
    for (const s of [-1, 1]) {
      box(head, s * .218, bottom, -.12, .035, .395 - bottom, .12, hair)
    }
  }
  if (james || billy) {
    // Wrap the crown over the sides and around the front corner. A strip
    // only on the side leaves a visible skin notch above the cheek beard.
    const bottom = james ? .15 : .235
    for (const s of [-1, 1]) {
      box(head, s * .218, .225, .018, .04, .18, .34, hair)
      box(head, s * .218, bottom, -.12, .04, .405 - bottom, .14, hair)
      box(head, s * .198, bottom, -.187, .043, .405 - bottom, .063, hair)
    }
  }
  if (james) {
    // Cheeks, moustache and chin leave a small readable mouth opening.
    for (const s of [-1, 1]) {
      box(head, s * .164, .022, -.192, .095, .173, .066, hair)
      box(head, s * .222, .056, -.051, .035, .21, .25, hair)
      box(head, s * .069, .112, -.224, .10, .035, .051, hair)
    }
    box(head, 0, -.036, -.198, .33, .108, .082, hair)
    box(head, 0, -.064, -.17, .244, .047, .11, hair)
  }
  if (james || billy || serena) {
    const rim = james ? .014 : .011
    for (const s of [-1, 1]) {
      const x = s * .103, width = .169, height = .128, y = .183
      box(head, x, y, -.23, width, rim, .014, ink)
      box(head, x, y + height - rim, -.23, width, rim, .014, ink)
      for (const edge of [-1, 1]) box(head, x + edge * (width - rim) / 2,
        y + rim, -.23, rim, height - rim * 2, .014, ink)
      box(head, s * .203, .252, -.105, .012, .013, .25, ink)
    }
    box(head, 0, .243, -.232, .041, .013, .014, ink)
  }
  if (id === 'matt') {
    for (const s of [-1, 1]) {
      box(head, s * .252, .155, .016, .062, .135, .12, ink)
      box(head, s * .244, .283, .038, .026, .22, .045, ink)
    }
    box(head, 0, .504, .038, .51, .027, .055, ink)
    box(head, .259, .153, -.103, .023, .022, .23, ink)
    box(head, .177, .153, -.212, .17, .022, .022, ink)
    box(head, .101, .144, -.215, .048, .038, .033, ink)
  }
}
