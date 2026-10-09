/*
 * Copied from the rebuild (100m-devs-three/src/render/founderSculpt.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
import * as T from 'three'
import type { Look } from '../sim/identity.ts'
import { sculptFacialHair } from './facialHair.ts'
import { box } from './worldArt.ts'

/** Hero-level detail, driven by the saved choices in both portrait and world. */
export function founderHead(head: T.Group, look: Look, skin: string, hair: string) {
  box(head, 0, 0, 0, .43, .44, .38, skin)
  for (const s of [-1, 1]) {
    box(head, s * .224, .13, 0, .05, .105, .09, skin)
    box(head, s * .085, .208, -.198, .032, .055, .018, '#303432')
    box(head, s * .088, .298, -.199, .075, .019, .018, hair)
  }
  box(head, .005, .147, -.21, .046, .067, .047, skin)
  box(head, 0, .084, -.2, .077, .015, .016, '#895f48')
  const top = look.hair === 2 ? .54 : look.hair === 0 ? .435 : .485
  box(head, 0, .378, .018, .455, top - .378, .425, hair)
  box(head, 0, .19, .19, .445, .22, .065, hair)
  if (look.hair !== 0) {
    box(head, -.045, top, .03, .33, .036, .35, hair)
    box(head, -.06, .356, -.196, .30, .052, .055, hair)
    box(head, .168, .326, -.12, .065, .09, .22, hair)
  }
  if (look.hair === 3) {
    for (const s of [-1, 1]) box(head, s * .224, .08, .08, .065, .32, .30, hair)
  }
  if (look.hair === 2) {
    for (let i = 0; i < 3; i++) box(head, -.14 + i * .14, .515, -.11, .115, .075 + (i % 2) * .025, .18, hair)
  }
  sculptFacialHair(head, look.facialHair % 4, hair)
  if (look.glasses) {
    for (const s of [-1, 1]) {
      for (const y of [.19, .281]) box(head, s * .092, y, -.229, .145, .014, .02, '#293a42')
      for (const x of [.027, .158]) box(head, s * x, .204, -.229, .014, .077, .02, '#293a42')
      box(head, s * .218, .264, -.08, .014, .018, .30, '#293a42')
    }
    box(head, 0, .251, -.231, .044, .014, .02, '#293a42')
  }
  if (look.headphones) {
    for (const s of [-1, 1]) {
      box(head, s * .262, .13, 0, .077, .18, .16, '#344952')
      box(head, s * .272, .18, -.004, .084, .07, .085, '#a9c4c9')
      box(head, s * .26, .30, 0, .035, top + .06 - .30, .08, '#344952')
    }
    box(head, 0, top + .06, 0, .555, .035, .09, '#344952')
  }
}

/**
 * The torso's front face: `studioPeople` builds it 0.29 deep, centred at z 0.04.
 *
 * [2026-09-26] Everything worn on the chest is placed against it (or against a
 * layer that is). The founder turns on the character screen now (*"make it we
 * can rotate him"*), and the badge had hung 4.5 cm in front of the shirt, the
 * tie 1 cm off the jacket and the knit's collar 2 cm off the jumper: invisible
 * from the one angle the room ever used, and the first thing a turn shows.
 */
const CHEST = -.105

export function founderClothes(torso: T.Group, look: Look, shirt: string) {
  const trim = '#dbe4df'
  const seam = new T.Color(shirt).multiplyScalar(.72).getStyle()
  box(torso, 0, .014, -.113, .43, .04, .027, seam)
  if (look.body === 0) {
    box(torso, 0, .095, -.125, .29, .115, .043, seam)
    box(torso, 0, .12, -.15, .23, .065, .02, shirt)
    for (const s of [-1, 1]) box(torso, s * .075, .29, CHEST - .0105, .017, .15, .021, trim)
  } else if (look.body === 2) {
    for (const s of [-1, 1]) {
      const lapel = box(torso, s * .095, .30, CHEST - .0175, .075, .19, .035, seam)
      lapel.rotation.z = s * -.23
      box(torso, s * .14, .14, CHEST - .01, .09, .02, .02, trim)
    }
    // On the shirt panel `studioPeople` lays over the chest (0.018 deep at -0.112).
    box(torso, .018, .09, -.121 - .009, .018, .23, .018, '#b6b7ac')
  } else if (look.body === 3) {
    for (let i = 0; i < 5; i++) box(torso, -.16 + i * .08, .08, -.113, .013, .30, .018, seam)
    box(torso, 0, .40, CHEST - .0085, .025, .10, .017, seam)
  } else {
    box(torso, 0, .455, -.115, .19, .04, .025, seam)
  }
  // A little terminal badge identifies the player across all four outfits.
  box(torso, -.13, .31, CHEST - .0095, .079, .06, .019, '#dbe4df')
  box(torso, -.141, .329, CHEST - .019 - .004, .019, .018, .008, '#344952')
  box(torso, -.116, .32, CHEST - .019 - .004, .023, .009, .008, '#344952')
}
