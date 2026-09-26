/*
 * Copied from the rebuild (100m-devs-three/src/render/studioPeople.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/** The same cuboid person and workstation kit at both playable desk scales.
 * Identity comes from sim/identity, not a colour roll in the renderer. §7.0.
 */
import * as T from 'three'
import { OS_SKIN } from '../art/skin.ts'
import { developerAt, heroIdentity, type Look } from '../sim/identity.ts'
import { DEFAULT_FOUNDER, founderLook } from '../game/founderProfile.ts'
import { AVATAR_HAIR, frontAvatarParts } from './avatarParts.ts'
import { heroHead } from './heroHead.ts'
import { founderHead, founderClothes } from './founderSculpt.ts'
import { box, cylinder, INK } from './worldArt.ts'
import type { LeaderId } from '../sim/floorPlan.ts'
import { RAMPS } from '../art/palette.ts'

export interface StudioCast { seed: number; founder: Look; heroes: readonly LeaderId[]; studio?: string }
export const defaultCast = (): StudioCast => ({ seed: 1, founder: founderLook(DEFAULT_FOUNDER), heroes: [] })
const SKINS = [RAMPS.SKIN[0], RAMPS.SKIN[1], RAMPS.SKIN[3], RAMPS.SKIN[5]]
const HAIR = [RAMPS.WOOD[1], RAMPS.WOOD[0], RAMPS.NEUTRAL[1], RAMPS.WOOD[2], '#cf792f', '#d4b05d', '#72716c']
const SHIRTS = ['#368d90', '#679477', '#d59643', '#6689a6', '#77718a', '#eee9df', '#9dbbd1']
const FOUNDER_SHIRTS = [RAMPS.NEUTRAL[6], RAMPS.CALM[1], RAMPS.WARN[1], RAMPS.FOLIAGE[1], RAMPS.NEUTRAL[3]]
/**
 * One colour each, far enough apart to be one colour each.
 *
 * Matt used to be `#448986`, which is **ΔE 4.3 from the founder's `#368c87`**
 * in Lab — the threshold at which two colours are only separable side by side
 * under good light. Every other pair on the roster is 23.8 or more, so two of
 * the five role colours were the same colour, and anything that codes a hero by
 * hue (§7.4's name in the role colour, the card frame, a station) was coding
 * two of them identically. The deeper petrol is still the teal §7.1 gives him —
 * "teal collared knit", "teal speech-stack emblem" — and reads 26.7 from the
 * founder and 35.8 from Billy. `environments.test.ts` holds the line at 20
 * rather than holding these values, so a future colour can move without the
 * test arguing about taste.
 */
export const LEADER_COLOURS: Record<LeaderId, string> = {
  founder: INK.teal, james: INK.amber, billy: '#719ab8',
  serena: '#bf7050', matt: '#0f4c52',
}

/**
 * §12.11 — what the plate over each hero's head says.
 *
 * The founder is **YOU**, which is the same word `scenes.PLAYER` puts on their
 * dialogue: the studio belongs to the person holding the phone, and a plate
 * carrying the name they typed would be the game introducing them to
 * themselves. Everybody else is their first name in capitals, because that is
 * how the cast refers to each other.
 */
export const HERO_LABELS: Record<string, string> = {
  founder: 'YOU', james: 'JAMES', billy: 'BILLY', serena: 'SERENA', matt: 'MATT', melany: 'MELANY', mo: 'MO',
}

/**
 * The standing leg, and the hip it hangs from.
 *
 * The hip is the leg plus the 0.16 that puts the shoe's underside on the floor
 * at 0.07, and the torso's lift is set so its bottom lands just under the hip.
 * Written as two names because three call sites used to carry the same numbers
 * independently, and a leg lengthened in one of them would have left the body
 * hanging in the air.
 */
const LEG = 0.78
const HIP = LEG + 0.16

/** Shared by scene people and their selectable HUD portraits. */
export function personColours(look: Look, id?: LeaderId) {
  return { skin: id === 'matt' ? SKINS[1] : id === 'serena' ? RAMPS.SKIN[2] : SKINS[look.skin % SKINS.length], hair: HAIR[look.hairColour] ?? HAIR[0],
    shirt: id === 'founder' ? FOUNDER_SHIRTS[look.shirt % FOUNDER_SHIRTS.length] : id && id !== 'james' && id !== 'billy'
      ? LEADER_COLOURS[id] : SHIRTS[look.shirt] ?? SHIRTS[0] }
}

export function chair(parent: T.Object3D, x: number, z: number, facing: number): T.Group {
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = facing; parent.add(g)
  box(g, 0, 0.51, 0.08, 0.55, 0.12, 0.55, INK.metal)
  box(g, 0, 0.65, 0.37, 0.55, 0.55, 0.1, '#576568')
  cylinder(g, 0, 0.13, 0.12, 0.045, 0.38, INK.metal)
  for (const r of [0, Math.PI / 2]) {
    const foot = box(g, 0, 0.08, 0.12, 0.65, 0.06, 0.07, INK.metal); foot.rotation.y = r
  }
  return g
}

/**
 * One person, seated at a desk or standing up.
 *
 * `upright` is §18's addition. Billy has always been the standing figure —
 * §7 gives him a board rather than a chair — but an away developer is the same
 * ordinary body out of its seat, and a seated pose gliding across the floor
 * with its thighs still horizontal is the single most obviously wrong thing the
 * mechanic can draw. So the standing construction is available to anybody, and
 * Billy's clipboard and marker moved off it onto his own name: they were
 * riding `standing` because he was the only one, which made them a property of
 * posture instead of a property of Billy.
 *
 * The standing legs hang from named hip groups (`leg-1`, `leg1`) so
 * `render/errands.ts` can swing them. A seated body has no such groups and
 * needs none — nothing about sitting animates below the waist.
 */
export function studioPerson(parent: T.Object3D, x: number, z: number, facing: number,
  look: Look, id?: LeaderId, upright = false,
  /**
   * [2026-09-26] The whole person — arms, legs, the rebuild's figure — even
   * where this build draws the room's people as head-and-body blocks. The
   * character screen and every portrait use it: *"Why can't you port the exact
   * same character creation models?"* The room keeps the blocks: *"no feet …
   * just a head and body hop about"*.
   */
  full = false): T.Group {
  const blocks = OS_SKIN && !full
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = facing; parent.add(g)
  g.userData.dynamic = true
  g.userData.identity = { ...look }
  const { skin, hair, shirt } = personColours(look, id)
  const broad = id === 'billy' ? 0.87 : 1
  const standing = id === 'billy' || upright
  /*
   * **How far a standing body rises off its seated construction, and why it is
   * not 0.4 any more.**
   *
   * The seated pose is what almost every person on screen is in, and it is
   * right; the standing one is Billy, §18's away developers, and the founder
   * preview. Measured off renders of this model: at a 0.93 leg the standing
   * figure was 3.97 heads tall with the legs at 51% of its height and a
   * torso-to-leg ratio of 1:1.79. A blocky character normally sits near 1:1,
   * and four proportions rendered side by side agreed with the eye &mdash; it
   * read as stilts.
   *
   * The seated construction is untouched, so the torso and head keep their
   * sizes and only the leg and the rise change: leg 0.93 -> 0.78, a little
   * thicker with it, and the lift follows so the shoes stay on the floor.
   * That gives 3.68 heads, legs at 47%, and 1:1.53. Shorter was tried and
   * reads child-like; this is the point where the legs stop being the first
   * thing you notice.
   *
   * `LEG` and `lift` are tied: the hip must sit just under the torso and the
   * shoe must reach the floor, so both are derived below rather than typed in
   * three places that can drift apart.
   */
  const extraHeight = id === 'billy' ? .06 : 0
  const legLength = LEG + extraHeight
  const lift = standing ? 0.25 + extraHeight : 0
  g.userData.standing = standing
  /*
   * STUDIO_OS (`art/skin.ts`): the legacy figure — a head on a body block, no
   * legs and no arms. *"The old game people have no feet that fits the game
   * style well just a head and body hop about and it works well with catapult
   * game."* An abstraction a hundred million of can stay funny, where a person
   * with hands asks to be cared about one at a time. Standing, the block sits
   * on the floor; seated, it sits on the chair where it always did.
   */
  const bean = blocks && standing
  const torso = new T.Group(); torso.position.y = bean ? 0 : 0.66 + lift; g.add(torso)
  torso.name = 'torso'
  box(torso, 0, 0, 0.04, 0.43 * broad, 0.52, 0.29, shirt)
  // One extra construction feature carries each clothing silhouette.
  if (look.body === 0) box(torso, 0, 0.4, 0.13, 0.46, 0.17, 0.23, shirt)
  if (look.body === 2) box(torso, 0, 0.02, -0.112, 0.13, 0.47, 0.018, INK.trim)
  if (look.body === 3 && id !== 'matt') box(torso, 0, 0.44, -0.12, 0.27, 0.07, 0.025, INK.trim)
  if (id === 'founder') founderClothes(torso, look, shirt)
  if (id === 'billy' || id === 'james' || id === 'matt' || id === 'serena') {
    for (const s of [-1, 1]) box(torso, s * 0.09, 0.43, -0.12, 0.10, 0.075, 0.025, id === 'serena' ? shirt : INK.trim)
    if (id === 'james' || id === 'billy') for (let i = 0; i < 3; i++) box(torso, 0, 0.10 + i * 0.11, -0.117, 0.027, 0.027, 0.015, INK.grout)
  }
  if (id === 'james' || id === 'billy' || id === 'serena') {
    box(torso, -.105, .27, -.119, .10, .085, .022, shirt)
  }
  if (id === 'serena') {
    box(torso, .14, .03, -.137, .074, .055, .029, INK.metal)
    box(torso, .14, .049, -.154, .047, .021, .01, INK.glassLight)
  }
  for (const s of [-1, 1]) {
    if (blocks) continue
    if (standing) {
      // Hung from the hip so the leg can swing about it. The box's `y` is its
      // bottom, so a 0.93 leg whose top is at the hip starts at −0.93.
      const leg = new T.Group(); leg.position.set(s * 0.13, HIP + extraHeight, 0); g.add(leg)
      leg.name = `leg${s}`
      box(leg, 0, -legLength, .012, 0.175 * broad, legLength, 0.21, '#343d45')
      box(leg, 0, -(legLength + 0.09), -0.06, 0.215, 0.10, 0.30, INK.metal)
    } else {
      box(g, s * 0.13, 0.57, -0.1, 0.16, 0.16, 0.43, '#343d45')
      box(g, s * 0.13, 0.16, -0.30, 0.15, 0.43, 0.16, '#343d45')
      box(g, s * 0.13, 0.07, -0.36, 0.19, 0.10, 0.30, INK.metal)
    }
    const arm = new T.Group(); arm.position.set(s * 0.29 * broad, 1.07 + lift, 0); g.add(arm)
    arm.name = `arm${s}`
    if (standing) {
      /*
       * **A standing arm hangs.** The seated arm below is an L — upper arm
       * down, forearm forward, hand out over a desk — and it is right for the
       * ninety-odd people who are at one. It was also being built for everyone
       * who is *not*: Billy at his board, §18's away developers, and the
       * founder in the creator all stood with both forearms reaching for a
       * desk that was not there, which from a three-quarter view reads as
       * pointing at something.
       *
       * One drop from the shoulder plus a hand. The length puts the fingertips
       * at 0.79 against a hip at 0.94 and a knee at 0.55 — mid-thigh, where a
       * relaxed arm ends.
       */
      box(arm, 0, -0.42, 0, 0.14, 0.56, 0.17, shirt)
      box(arm, 0, -0.53, 0, 0.14, 0.11, 0.15, skin)
      if (id === 'james') {
        box(arm, s * .072, -.22, 0, .014, .085, .074, skin)
        for (let i = 0; i < 3; i++) box(arm, s * .082, -.225 + i * .033,
          (i % 2 ? -1 : 1) * .035, .01, .018, .026, shirt)
      }
    } else {
      box(arm, 0, -0.17, 0, 0.14, 0.31, 0.17, shirt)
      box(arm, 0, -0.17, -0.17, 0.14, 0.14, 0.36, shirt)
      box(arm, 0, -0.15, -0.39, 0.14, 0.11, 0.14, skin)
      if (id === 'james') {
        box(arm, s * 0.071, -0.14, 0, 0.015, 0.12, 0.11, skin)
        for (let i = 0; i < 4; i++) box(arm, s * .082, -.15 + i * .035, (i % 2 ? -1 : 1) * .05, .013, .025, .04, shirt)
      }
    }
  }
  const head = new T.Group(); head.position.set(0, bean ? 0.52 : 1.18 + lift, 0); g.add(head); head.name = 'head'
  const namedHero = id === 'james' || id === 'billy' || id === 'serena' || id === 'matt'
  if (id === 'founder') {
    founderHead(head, look, skin, hair)
  } else if (namedHero) {
    heroHead(head, id, skin, hair)
  } else {
    box(head, 0, 0, 0, 0.43, 0.44, 0.38, skin)
    const style = AVATAR_HAIR[look.hair % AVATAR_HAIR.length]
    /*
     * The crown, seated 4mm proud of the face rather than flush with it.
     *
     * It was 0.43 deep centred at 0.025, which put its front face at exactly
     * -0.19 &mdash; the head's own front plane. Two coplanar faces in two
     * colours is a z-fight, and it drew as a hatched band across the hairline at
     * every hair shape. The fringe below hides the middle of that band, which is
     * why it read as a smudge on one side rather than a line all the way across.
     */
    box(head, 0, 0.37, 0.026, style.w / 30, style.h / 65, 0.44, hair)
    /*
     * **There is no fringe, and the crown is the hairline.**
     *
     * There used to be an asymmetric hair block on the forehead, and it was
     * asked about three times in three shapes. As a 0.23-wide bar centred at
     * x 0.13 it hung to y 0.30 against eyes that top out at 0.267, and read as
     * one eyebrow. Widened to span the forehead it read as a unibrow &mdash;
     * there is no width at which a hair-coloured bar above the eyes stops
     * meaning "brow", because that is what a brow is. Cut back to a single step
     * at the temple it read as a stray tab of hair.
     *
     * The lesson is not about that block's dimensions. `avatarParts.ts` gives
     * this face two eyes and a mouth and nothing else, so anything the head adds
     * near the brow line is read as a feature whether it was meant as one or
     * not. The crown's underside at y 0.37 is a clean hairline on its own, which
     * is how the seated crowd has always read at distance. Nothing replaces it.
     */
    box(head, 0, 0.14, 0.18, 0.44, 0.24, 0.075, hair)
    const colours = { ink: '#242c2d', mouth: '#895f48', hair, glasses: '#29302f' }
    /*
     * The creator's exact facial parts, mapped onto the front of the 3D head.
     *
     * **Each layer gets its own depth, because they overlap.** Every part used
     * to be placed at z -0.203, and the ones that share the same patch of face
     * therefore shared a plane: a full beard covers the mouth, a moustache
     * straddles it, and a spectacle rim crosses both. Coplanar faces in two
     * colours stripe against each other, which drew as a hatched smear over the
     * mouth on every bearded person. The offsets below are 2-3 mm apart and in
     * the order the things actually sit on a face: skin marks, then hair growing
     * out of it, then glasses resting on that. Headphones are not in this list:
     * they are built below, in three dimensions, because they go over the ears.
     */
    const depth: Record<keyof typeof colours, number> = {
      ink: -0.203, mouth: -0.203, hair: -0.2055, glasses: -0.209,
    }
    for (const p of frontAvatarParts(look)) {
      box(head, (p.x + p.w / 2) / 30, (-(p.y + p.h) - 12) / 30,
        depth[p.colour], p.w / 30, p.h / 30,
        0.023, colours[p.colour])
    }
    /*
     * **Headphones, worn on the head rather than printed on the face.**
     *
     * Two cups on the *sides* at x +/-0.245 &mdash; just outside the head's own
     * +/-0.215 &mdash; centred on z 0 so they sit over the middle of the skull
     * where an ear is, and on y 0.13-0.30, which straddles the eyes at
     * 0.20-0.267. Two arms rise from the cups to a band that lands on the
     * crown's upper surface, so the set adjusts to whichever hair is underneath
     * it instead of floating above a short crop or sinking into a tall one.
     *
     * The band is drawn last and slightly wider than the arms, which is what
     * makes the three pieces read as one object rather than three.
     */
    if (look.headphones) {
      const crownTop = 0.37 + style.h / 65
      for (const s of [-1, 1]) {
        box(head, s * 0.245, 0.13, 0, 0.06, 0.17, 0.16, '#465462')
        box(head, s * 0.245, 0.30, 0, 0.045, crownTop - 0.30, 0.09, '#303b43')
      }
      box(head, 0, crownTop, 0, 0.53, 0.05, 0.11, '#303b43')
    }
  }

  // Billy's clipboard and marker. They used to hang off `standing`, which read
  // as "standing people carry clipboards" the moment anybody else stood up.
  if (id === 'billy') {
    const arm = g.getObjectByName('arm1')!
    arm.rotation.x = -.35
    box(arm, 0, -.48, -.11, .25, .33, .034, INK.woodEdge)
    box(arm, 0, -.45, -.133, .21, .26, .012, INK.paper)
    box(arm, 0, -.18, -.143, .075, .039, .018, INK.metal)
    for (let i = 0; i < 3; i++) box(arm, 0, -.39 + i * .068, -.143,
      .13, .011, .01, INK.grout)
  }

  return g
}

export const workerLook = (cast: StudioCast, seat: number): Look => developerAt(cast.seed, seat).look
export const leaderLook = (cast: StudioCast, id: LeaderId): Look => id === 'founder' ? cast.founder : heroIdentity(id)!.look

/** A single-sided hero desk, with a signature prop even before its occupant arrives. */
export function leaderDesk(parent: T.Object3D, x: number, z: number, id: LeaderId): void {
  const g = new T.Group(); g.position.set(x, 0, z); parent.add(g)
  g.name = `${id}-station`
  if (id === 'billy') {
    // Billy facilitates standing up: a board, cards, marker tray and clipboard,
    // never an extra office chair or a seated typing animation.
    box(g, -0.9, 1, 0.85, 2.3, 1.3, 0.12, INK.metal)
    box(g, -0.9, 1.06, 0.93, 2.17, 1.17, 0.035, INK.paper)
    for (const dx of [-1.85, 0.05]) {
      box(g, dx, 0, 0.85, 0.06, 1.1, 0.07, INK.metal)
      box(g, dx, 0.05, 0.85, 0.08, 0.07, 0.7, INK.metal)
    }
    for (let col = 0; col < 3; col++) {
      box(g, -1.62 + col * 0.7, 2.04, 0.96, 0.44, 0.065, 0.014, INK.glassLight)
      for (let row = 0; row < 3 - col % 2; row++) box(g, -1.62 + col * 0.7, 1.28 + row * 0.23, 0.96,
        0.23, 0.16, 0.02, [INK.amber, INK.teal, '#829caa'][col])
    }
    box(g, -0.9, 0.99, 1, 2.3, 0.035, 0.25, INK.metal)
    return
  }
  box(g, 0, 0.8, 0.8, 2.05, 0.12, 0.95, INK.wood)
  for (const dx of [-0.85, 0.85]) box(g, dx, 0, 0.8, 0.12, 0.8, 0.78, INK.metal)
  box(g, 0, 0.92, 0.92, 0.08, 0.18, 0.13, INK.metal)
  box(g, 0, 1.06, 0.96, 0.72, 0.47, id === 'james' ? 0.30 : 0.06, id === 'james' ? INK.trim : INK.metal)
  box(g, 0, 1.1, id === 'james' ? 0.801 : 0.925, 0.61, 0.35, 0.012, INK.glass)
  box(g, 0, 0.925, 0.49, 0.57, 0.025, 0.20, INK.grout)
  box(g, 0.72, 0.925, 1.12, 0.36, 0.10, 0.13, LEADER_COLOURS[id])
  cylinder(g, -0.72, 0.92, 0.51, 0.075, 0.15, INK.trim)
  if (id === 'serena') {
    box(g, -0.65, 0.925, 0.87, 0.30, 0.23, 0.27, INK.trim)
    box(g, 0.66, 0.925, 0.52, 0.17, 0.055, 0.26, INK.metal)
    box(g, 0.66, 0.983, 0.52, 0.12, 0.005, 0.18, INK.amber)
  }
  if (id === 'matt') {
    for (let i = 0; i < 3; i++) box(g, -0.69, 0.93 + i * 0.07, 0.93, 0.40, 0.05, 0.32, INK.paper)
    box(g, 0.67, 0.93, 0.76, 0.26, 0.25, 0.045, INK.woodEdge)
    box(g, 0.67, 0.96, 0.729, 0.20, 0.17, 0.01, INK.teal)
  }
}
