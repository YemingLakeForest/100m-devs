/**
 * The HQ's architecture: the pieces of the hero quarter that are *room* and not *set* —
 * GDD §7.8.12 [re-planned 2026-10-05, at the user's instruction, six times].
 *
 * A hero's set (`hqSets.ts`) is what arrives: the desk, the chair, the person, the screens. This
 * is what it arrives *into*, and it is built into the shell from the first frame, for the reason
 * the garage's other pieces are: a room whose geometry changes when somebody lands recompiles
 * every material in it.
 *
 * - **The ziggurat** — the founder's podium (1.2 m, a stair on its east face, a brass rail on the two faces the camera
 *   sees, lit edges) and, at its foot along the west wall, James's deck (0.24 m). The boss is *above* James and James
 *   is above the floor, which is the org chart drawn as a plan.
 * - **The Ops Room's plinth**, 0.9 m of slate with a lit lip and a line of Serena's red at its foot, and its step.
 * - **Matt's riser**, a hand high, in oak like the deck with a lit edge in his colour.
 */
import * as T from 'three'
import { box, INK, slab } from './worldArt.ts'
import { garagePlatformFloor } from './garageCraft.ts'
import { lamp } from './glowArt.ts'
import { branchColour } from '../../sim/heroBranches.ts'
import { HERO_BY_ID } from '../../sim/storyHeroes.ts'
import { GARAGE_DECK, GARAGE_PODIUM, HERO_SITES } from '../sim/floorPlan.ts'

/** A hero's colour, from the branch the card, the survey's pip and Sol's ring all take it from. */
const heroColour = (id: 'billy' | 'serena' | 'matt') => branchColour(HERO_BY_ID.get(id)!.branch)

const AMBER = '#e0a52e'
const BRASS = '#425b62'
const WALNUT = '#30444b'

const rectOf = (r: { x0: number; x1: number; z0: number; z1: number }) => [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]] as [number, number][]

/**
 * **The ziggurat.** Returns the two groups the founder's and James's stations stand on, each at its platform's height.
 *
 * The podium is a solid block of walnut with a parquet top, one lit amber line a hand below its top edge on the east
 * and south faces (the two the camera sees) and a dimmer one at its foot; its stair is two treads of 0.4 m on the east
 * face, centred on z = −7.1, lit along the nosings; and a brass rail, two bars on posts a metre apart, runs along both
 * seen edges and stops at the stair on one of them. The rail is *thin on purpose*: it is there to say "edge" and not to
 * hide the founder, whose desk is most of a metre behind it.
 *
 * The deck is oak, a step up, with a dim amber line at its foot. Nobody walks on either (the walk grid is closed over
 * both): the stair is a picture, and the way on to the podium is a lane the opening will want
 * (`floorPlan.GARAGE_DECK_ENTRY`).
 */
export function ziggurat(g: T.Group): { podium: T.Group; deck: T.Group } {
  const P = GARAGE_PODIUM, D = GARAGE_DECK
  slab(g, rectOf(P), 0, P.rise - 0.014, WALNUT)
  garagePlatformFloor(g, P)
  slab(g, rectOf(D), 0, D.rise - 0.014, INK.woodEdge)
  garagePlatformFloor(g, D)

  // the podium's lit lines
  const mid = (a: number, b: number) => (a + b) / 2
  lamp(g, P.x1 + 0.004, P.rise - 0.14, mid(P.z0, P.z1), 0.01, 0.04, P.z1 - P.z0, AMBER)
  lamp(g, mid(P.x0, P.x1), P.rise - 0.14, P.z1 + 0.004, P.x1 - P.x0, 0.04, 0.01, AMBER)
  lamp(g, P.x1 + 0.004, 0.06, mid(P.z0, P.z1), 0.01, 0.03, P.z1 - P.z0, '#8a6420')
  lamp(g, mid(P.x0, P.x1), 0.06, P.z1 + 0.004, P.x1 - P.x0, 0.03, 0.01, '#8a6420')

  // the stair on the east face
  const sz = -7.1, sw = 1.8
  for (const [x, top] of [[P.x1 + 0.2, 0.8], [P.x1 + 0.6, 0.4]] as const) {
    box(g, x, 0, sz, 0.4, top, sw, WALNUT)
    box(g, x, top - 0.02, sz, 0.42, 0.04, sw + 0.04, INK.woodEdge)
    lamp(g, x + 0.2 + 0.004, top - 0.05, sz, 0.01, 0.03, sw - 0.1, AMBER)
  }

  // the brass rail, along the east edge either side of the stair and along the whole south edge
  const rail = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 1.0))
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0)
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t
      box(g, x, P.rise, z, 0.06, 0.94, 0.06, BRASS)
    }
    // A single substantial handrail opens the silhouette of the boss's station;
    // the double bright bars made it look like a fenced industrial platform.
    box(g, (x0 + x1) / 2, P.rise + .88, (z0 + z1) / 2, along ? len + .06 : .07, .07, along ? .07 : len + .06, BRASS)
  }
  const ex = P.x1 - 0.08, sy = P.z1 - 0.08
  rail(ex, P.z0 + 0.3, ex, sz - sw / 2 - 0.1)
  rail(ex, sz + sw / 2 + 0.1, ex, sy)
  rail(P.x0 + 0.3, sy, ex, sy)

  // the deck's dim line at its foot
  lamp(g, D.x1 + 0.004, 0.05, mid(D.z0, D.z1), 0.01, 0.03, D.z1 - D.z0, '#8a6420')
  lamp(g, mid(D.x0, D.x1), 0.05, D.z1 + 0.004, D.x1 - D.x0, 0.03, 0.01, '#8a6420')

  const podium = new T.Group(); podium.position.y = P.rise; g.add(podium)
  const deck = new T.Group(); deck.position.y = D.rise; g.add(deck)
  return { podium, deck }
}

/**
 * Serena's plinth. Returns the group her set is built on, at the plinth's height, so that a set's
 * own y = 0 is the floor it stands on.
 */
export function opsPlinth(g: T.Group, baseGroup: T.Group = g): T.Group {
  const s = HERO_SITES.serena
  slab(baseGroup, rectOf(s), 0, s.rise, '#3d4d52')
  // the lip: a cyan line along the two faces the camera sees, a hand below the top edge — the room's own
  // light, which is cyan — and, at the foot, a thin line in *her* colour, which is red and which on her own
  // screens means an incident: here it is the emergency lighting at the foot of a control room
  const lip = '#36c3d8', base = heroColour('serena')
  const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2
  lamp(baseGroup, mx, s.rise - 0.1, s.z1 + 0.004, s.x1 - s.x0, 0.03, 0.01, lip)
  lamp(baseGroup, s.x1 + 0.004, s.rise - 0.1, mz, 0.01, 0.03, s.z1 - s.z0, lip)
  lamp(baseGroup, mx, 0.06, s.z1 + 0.004, s.x1 - s.x0, 0.025, 0.01, base)
  lamp(baseGroup, s.x1 + 0.004, 0.06, mz, 0.01, 0.025, s.z1 - s.z0, base)
  const platform = new T.Group()
  platform.position.y = s.rise
  g.add(platform)
  return platform
}

/**
 * The open operations deck's two access treads stay on its east end.
 * The step is an arrival prop: an empty staircase would still suggest a
 * hidden station before Serena arrives. It lands with the deck and console.
 * {@link OPS_STEP} fixes its place; `showGarageStations` shows it with her.
 */
export const OPS_STEP = { x: HERO_SITES.serena.x1 - 0.6, z: HERO_SITES.serena.z1 + 0.3 } as const
export function opsStep(step: T.Group): void {
  const rise = HERO_SITES.serena.rise / 3
  box(step, 0, 0, 0.17, 0.95, rise, 0.34, '#4a5b60')
  box(step, 0, 0, -0.17, 0.95, rise * 2, 0.34, '#4a5b60')
  box(step, 0, rise - 0.02, 0.17, 0.97, 0.02, 0.36, '#5a6a6d')
  box(step, 0, rise * 2 - 0.02, -0.17, 0.97, 0.02, 0.36, '#5a6a6d')
}

/**
 * Matt's riser: a hand high, in oak like the deck's own, with a lit edge in his colour along the two faces the
 * camera sees. It is a platform and not just a rug because a platform is what closes the walk grid to it — nobody
 * walks through a counter — and because a step is what makes a place a *place* in a room that is otherwise one
 * floor. Returns the group the set is built on.
 *
 * **What you see of it is a prop of its own** (`shell`, registered by the caller as `riser:matt`) that comes with
 * him, like the Ops Room's step: he has no old wall to hide behind, and an empty platform with a lit edge in the
 * early garage, with nothing on it, was a thing the player would wonder about.
 */
export function heroRiser(g: T.Group, shell: T.Group, id: 'matt'): T.Group {
  const s = HERO_SITES[id]
  slab(shell, rectOf(s), 0, s.rise - 0.014, INK.woodEdge)
  garagePlatformFloor(shell, s)
  // the faces the camera sees are the south and the east ones
  const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2
  lamp(shell, mx, s.rise - 0.07, s.z1 + 0.004, s.x1 - s.x0, 0.03, 0.01, heroColour(id))
  lamp(shell, s.x1 + 0.004, s.rise - 0.07, mz, 0.01, 0.03, s.z1 - s.z0, heroColour(id))
  const platform = new T.Group()
  platform.position.y = s.rise
  g.add(platform)
  return platform
}
