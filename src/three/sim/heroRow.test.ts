import { describe, expect, it } from 'vitest'
import {
  BILLY_PLAZA,
  GARAGE_DECK,
  GARAGE_DECK_ENTRY,
  GARAGE_FURNITURE,
  GARAGE_HERO_SCALE,
  GARAGE_LEADERS,
  GARAGE_PLATFORMS,
  GARAGE_PODIUM,
  GARAGE_PODS,
  GARAGE_WALLS,
  GARAGE_WALL_FACES,
  HERO_SITES,
  LEADER_IDS,
  benches,
  destinationsIn,
  heroDesktop,
  leaderDesks,
  leaderSeat,
  studioFloorContains,
  walkable,
  walkableRegions,
} from './floorPlan.ts'

/**
 * The HQ has a place for everybody who works there [2026-10-04, GDD §7.8.12, re-planned
 * 2026-10-05 for the sixth time].
 *
 * Found by playing: Billy, Serena and Matt arrived in a dialogue and then had nowhere to sit.
 * Then, on being sent a screenshot with no heroes in it, that a row of desks behind James's was
 * not a place anybody could *see*; then, on being sent the stage, that three frontages of one
 * width were a shop window and not a room; then that the boss in a corner was not *prominent*, and
 * that Billy talking to a wall was a man meeting himself. These pin the claims, not the coordinates —
 * every person has a station; the founder is at the top of the picture on a platform of their own
 * with James beside them a step down; Matt and Serena stand on sites of their own against the north
 * wall and Billy stands in the mix of the developers; no site is on top of anything, nobody's errand
 * sends them on to one, and the floor is still one place you can walk across. (禁止穿模 itself is
 * looked at, and for the sets' own geometry measured, in `render/hqSets.test.ts`.)
 */

type Box = { x0: number; x1: number; z0: number; z1: number }
type Rect = { x: number; z: number; w: number; d: number }
/** Two rectangles that share an edge do not overlap: the tolerance is the float error of two edges that are the same number. */
const overlap = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-9 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-9
const rectOf = (b: Box): Rect => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, w: b.x1 - b.x0, d: b.z1 - b.z0 })
/** A furniture entry's footprint is authored as the world rectangle it blocks: `w` along x, `d` along z. */
const footprint = (f: { x: number; z: number; w: number; d: number }): Rect => ({ x: f.x, z: f.z, w: f.w, d: f.d })
const inside = (inner: Rect, outer: Rect, slack = 1e-9) =>
  inner.x - inner.w / 2 >= outer.x - outer.w / 2 - slack && inner.x + inner.w / 2 <= outer.x + outer.w / 2 + slack &&
  inner.z - inner.d / 2 >= outer.z - outer.d / 2 - slack && inner.z + inner.d / 2 <= outer.z + outer.d / 2 + slack

const HEROES = ['matt', 'serena', 'billy'] as const
const WALL_HEROES = ['matt', 'serena'] as const
const leader = (id: string) => GARAGE_LEADERS.find((l) => l.id === id)!
/** The gap between two rectangles along the axis they are apart on (0 where they overlap). */
const gap = (a: Rect, b: Rect) => Math.hypot(
  Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2),
  Math.max(0, Math.abs(a.z - b.z) - (a.d + b.d) / 2))

describe('the hero quarter', () => {
  it('seats everybody the cast names, and nobody twice', () => {
    expect(GARAGE_LEADERS.map((s) => s.id).sort()).toEqual([...LEADER_IDS].sort())
    expect(new Set(GARAGE_LEADERS.map((s) => s.seat)).size).toBe(LEADER_IDS.length)
    for (const s of GARAGE_LEADERS) expect(s.seat).toBe(leaderSeat(s.id))
  })

  it('puts Matt and Serena against the north wall, facing the room', () => {
    for (const id of WALL_HEROES) {
      const site = HERO_SITES[id], s = leader(id)
      expect(site.wall).toBe('north')
      expect(s.rot).toBe(0) // facing +z, which is into the room from the north wall
      // The site touches its wall: the terraces the room is built with run right up to the wall face.
      expect(site.z0).toBe(GARAGE_WALL_FACES.north)
      // They stand on it, not on its edge.
      expect(s.x).toBeGreaterThan(site.x0)
      expect(s.x).toBeLessThan(site.x1)
      expect(s.z).toBeGreaterThan(site.z0)
      expect(s.z).toBeLessThan(site.z1)
      // And all of it is inside the building.
      for (const [x, z] of [[site.x0, site.z0], [site.x1, site.z0], [site.x1, site.z1], [site.x0, site.z1]]) {
        expect(studioFloorContains(x + Math.sign(site.x0 + site.x1 - 2 * x) * 0.01, z + Math.sign(site.z0 + site.z1 - 2 * z) * 0.01), `${id} ${x},${z}`).toBe(true)
      }
    }
  })

  it('puts Billy on the open floor, away from every wall, facing the lens', () => {
    // *"they don't have to be all around the wall, put billy in the mix of devs"* (2026-10-05). Every earlier cut had
    // him against a wall, talking to it.
    const site = HERO_SITES.billy, s = leader('billy')
    expect(site.wall).toBe('free')
    expect(s.rot).toBe(45) // the diagonal that §12.1's camera looks back along: he faces us
    expect(s.x).toBeGreaterThan(site.x0)
    expect(s.x).toBeLessThan(site.x1)
    expect(s.z).toBeGreaterThan(site.z0)
    expect(s.z).toBeLessThan(site.z1)
    // A metre of floor between his site and each back wall (a corner is a wall twice), and the near walls are further.
    expect(site.x0 - GARAGE_WALL_FACES.west).toBeGreaterThanOrEqual(5)
    expect(site.z0 - GARAGE_WALL_FACES.north).toBeGreaterThanOrEqual(5)
    for (const [x, z] of [[site.x0, site.z0], [site.x1, site.z0], [site.x1, site.z1], [site.x0, site.z1]]) expect(studioFloorContains(x, z)).toBe(true)
  })

  it('puts Billy in the mix of the developers: a pod within a stride either side of him, and none on top of him', () => {
    const footing = footprint(GARAGE_FURNITURE.find((f) => f.kind === 'easel')!)
    const s = leader('billy')
    const tables = benches('garage')
    // The nearest pod either side of him along the avenue: the ones whose tables are beside his footprint, not the far column.
    const beside = tables.filter((t) => Math.abs(t.z - s.z) < 5)
    const nearest = (side: -1 | 1) => beside.filter((t) => Math.sign(t.x - s.x) === side).sort((p, q) => gap(footing, p) - gap(footing, q))[0]
    for (const side of [-1, 1] as const) {
      const t = nearest(side)
      expect(t, `a pod to his ${side < 0 ? 'west' : 'east'}`).toBeDefined()
      // Close enough that they are his audience, far enough that a developer is not at his elbow — and a metre of it, which
      // is what the half-metre grid needs to leave a lane beside a footprint it pads by a quarter on each side.
      expect(gap(footing, t), `pod at ${t.x},${t.z}`).toBeGreaterThanOrEqual(1.0)
      expect(gap(footing, t), `pod at ${t.x},${t.z}`).toBeLessThanOrEqual(1.5)
    }
    for (const t of tables) expect(overlap(footing, t), `pod at ${t.x},${t.z}`).toBe(false)
  })

  it('draws his footprint from what he stands on and beside: the dais under him and the board at his side', () => {
    const footing = footprint(GARAGE_FURNITURE.find((f) => f.kind === 'easel')!)
    const s = leader('billy')
    // the dais, an octagon with its flats to the axes, is inside it
    expect(inside({ x: s.x, z: s.z, w: 2 * BILLY_PLAZA.dais.apothem, d: 2 * BILLY_PLAZA.dais.apothem }, footing, 1e-6)).toBe(true)
    // …and so is the middle of the board, which is `board.x` to his side and `board.z` behind him, in a frame turned an eighth
    const a = (s.rot * Math.PI) / 180
    const centre = { x: s.x + BILLY_PLAZA.board.x * Math.cos(a) + BILLY_PLAZA.board.z * Math.sin(a), z: s.z - BILLY_PLAZA.board.x * Math.sin(a) + BILLY_PLAZA.board.z * Math.cos(a) }
    expect(inside({ ...centre, w: 0, d: 0 }, footing)).toBe(true)
    // …and the whole of it is Billy's: inside his site
    expect(inside(footing, rectOf(HERO_SITES.billy), 1e-6)).toBe(true)
    // The board stands to his left and a step behind, on §12.1's lens: screen-left of him, so he is not in front of the face.
    // Screen-left is toward (−1, +1), so ((x − z) of the board) is less than his.
    expect(centre.x - centre.z).toBeLessThan(s.x - s.z)
  })

  it('gives every hero a floor of their own, and the boss a corner of their own', () => {
    // The founder's podium, James's deck and the three sites: no two share a floor.
    const floors: [string, Rect][] = [
      ['podium', rectOf(GARAGE_PODIUM)], ['deck', rectOf(GARAGE_DECK)],
      ...HEROES.map((id): [string, Rect] => [id, rectOf(HERO_SITES[id])]),
    ]
    for (let i = 0; i < floors.length; i++) {
      for (let j = i + 1; j < floors.length; j++) expect(overlap(floors[i][1], floors[j][1]), `${floors[i][0]}/${floors[j][0]}`).toBe(false)
    }
    // …and between the three along the north wall there is a metre of floor at least (the first cut had 0.4): the podium,
    // Matt, Serena, in that order.
    const along = [GARAGE_PODIUM, HERO_SITES.matt, HERO_SITES.serena].sort((p, q) => p.x0 - q.x0)
    for (let i = 1; i < along.length; i++) expect(along[i].x0 - along[i - 1].x1, `gap ${i}`).toBeGreaterThanOrEqual(1.0)
  })

  it('raises the boss above everything, James a step above the floor, and every wall hero a step too', () => {
    // *"I want the me even more promenant, on a platform"* (2026-10-05): the podium is the highest thing in the room, and
    // James is *above the floor* and below the boss, which is the org chart drawn as a plan.
    for (const id of WALL_HEROES) expect(HERO_SITES[id].rise).toBeGreaterThan(0.1) // a step is what closes a terrace to routing
    expect(GARAGE_DECK.rise).toBeGreaterThan(0.1)
    expect(GARAGE_DECK.rise).toBeLessThan(GARAGE_PODIUM.rise)
    for (const p of GARAGE_PLATFORMS) if (p !== GARAGE_PODIUM) expect(GARAGE_PODIUM.rise, `${p.rise}`).toBeGreaterThan(p.rise)
    // Billy is on the floor, on a dais he stands on and nobody walks on: low enough that it is not a terrace.
    expect(BILLY_PLAZA.dais.rise).toBeGreaterThan(0)
    expect(BILLY_PLAZA.dais.rise).toBeLessThanOrEqual(0.3)
    expect(HERO_SITES.billy.rise).toBe(0)
  })

  it('makes the back walls taller than anything that stands against them, with a sign’s height to spare', () => {
    // *"I see the wall are tool low, make them higher"* (2026-10-05): 3.2 m was lower than a standing figure on the tallest
    // platform with a name over them. A founder on the podium is 2.5 m of person (a 2 m body at the heroes' 1.25), and the
    // studio's sign is a metre and a bit above that.
    expect(GARAGE_WALLS.height).toBeGreaterThan(3.2)
    expect(GARAGE_PODIUM.rise + 2 * GARAGE_HERO_SCALE + 0.8).toBeLessThanOrEqual(GARAGE_WALLS.height)
  })

  it('puts the founder at the top of the picture, on the podium, with James beside them', () => {
    // §12.1's camera looks along (−1, −1), so what is *up* the picture is toward (−1, −1), which is −x − z. The founder is
    // the highest station in the picture, nobody above them, and James — the nearest station to them — is on the deck at
    // the podium's foot, along the same wall, a desk's length south and looking across the room.
    const up = (l: { x: number; z: number }) => -l.x - l.z
    const founder = leader('founder'), james = leader('james')
    for (const l of GARAGE_LEADERS) if (l.id !== 'founder') expect(up(founder), l.id).toBeGreaterThan(up(l))
    expect(james.rot).toBe(90) // along the west wall, facing across the room
    const dist = (l: { x: number; z: number }) => Math.hypot(l.x - founder.x, l.z - founder.z)
    for (const l of GARAGE_LEADERS) if (l.id !== 'founder' && l.id !== 'james') expect(dist(james), l.id).toBeLessThan(dist(l))
    expect(james.z - founder.z).toBeGreaterThan(3)
    expect(james.z - founder.z).toBeLessThan(5)
    // The podium is the north-west corner, and the deck runs on from its south face along the west wall.
    expect(GARAGE_PODIUM.x0).toBe(GARAGE_WALL_FACES.west)
    expect(GARAGE_PODIUM.z0).toBe(GARAGE_WALL_FACES.north)
    expect(GARAGE_DECK.x0).toBe(GARAGE_WALL_FACES.west)
    expect(GARAGE_DECK.z0).toBe(GARAGE_PODIUM.z1)
  })

  it('faces the founder’s whole station the isometric way, as Matt’s and Serena’s are: desk, chair and person', () => {
    // *"not toward james, I mean facing down right, the isometric way, like matt and serena"* (2026-10-07). A station's `rot`
    // is its yaw in degrees (0 faces +z, 90 faces +x) and everything in it — the person facing the desk, the desk in front
    // of them, the credenza behind — is built in that frame, so one number turns all of it. Square to the walls, into the room.
    const founder = leader('founder')
    expect(founder.rot).toBe(leader('matt').rot)
    expect(founder.rot).toBe(leader('serena').rot)
    // …and not the diagonal the corner office was first built on (turned to the lens), nor an angle between.
    expect(founder.rot % 90).toBe(0)
  })

  it('puts each leader’s desk on their own platform, and both platforms inside the building', () => {
    const desks = leaderDesks('garage')
    expect(desks.map((x) => x.seat).sort()).toEqual([leaderSeat('founder'), leaderSeat('james')].sort())
    for (const [id, platform] of [['founder', GARAGE_PODIUM], ['james', GARAGE_DECK]] as const) {
      // The *desktop* is what has to sit on the platform; `leaderDesks` is the padded rectangle the desk and its chair
      // close to walking, which overhangs a platform's edge by design.
      const desk = heroDesktop('garage', leaderSeat(id))!
      expect(desk, id).not.toBeNull()
      expect(inside(desk, rectOf(platform)), id).toBe(true)
      // …and the whole desk with its chair is on it too, at the boss's diagonal as at James's quarter turn.
      const routing = desks.find((d) => d.seat === leaderSeat(id))!
      expect(inside(routing, rectOf(platform), 0.35), `${id}'s chair and pedestals`).toBe(true)
    }
    for (const p of [GARAGE_PODIUM, GARAGE_DECK]) {
      for (const [x, z] of [[p.x0 + 0.01, p.z0 + 0.01], [p.x1 - 0.01, p.z1 - 0.01]]) expect(studioFloorContains(x, z)).toBe(true)
    }
  })

  it('keeps the leaders’ desktops clear of every hero’s site', () => {
    for (const seat of [leaderSeat('founder'), leaderSeat('james')]) {
      const desk = heroDesktop('garage', seat)!
      for (const id of HEROES) expect(overlap(desk, rectOf(HERO_SITES[id])), `${seat}/${id}`).toBe(false)
    }
  })

  it('leaves the boss room: no pod within two metres of the podium, none on the deck, and nothing stands on either', () => {
    // A pod pressed against the boss's desk is the clutter the user named. The podium is the corner and has the north court
    // in front of it; the deck is beside the north-west pod, whose table rectangle (which is padded for its chairs, and
    // is wider than the table you see) stands 0.18 m off its edge — a lane the walk grid closes, and a metre of real
    // clearance between the deck's desk and the pod's furniture.
    for (const b of benches('garage')) {
      expect(gap(b, rectOf(GARAGE_PODIUM)), `pod at ${b.x},${b.z} / podium`).toBeGreaterThanOrEqual(2.0)
      expect(overlap(b, rectOf(GARAGE_DECK)), `pod at ${b.x},${b.z} / deck`).toBe(false)
    }
    for (const platform of [rectOf(GARAGE_PODIUM), rectOf(GARAGE_DECK)]) {
      for (const f of GARAGE_FURNITURE) expect(overlap(footprint(f), platform), f.kind).toBe(false)
    }
  })

  it('has no desk on top of a pod or a piece of furniture', () => {
    for (const desk of leaderDesks('garage')) {
      for (const f of GARAGE_FURNITURE) expect(overlap(desk, footprint(f)), `desk ${desk.seat} / ${f.kind}`).toBe(false)
      for (const p of GARAGE_PODS) {
        const r = { x: p.x, z: p.z, w: p.rot === 90 ? 1.45 : 3.05, d: p.rot === 90 ? 3.05 : 1.45 }
        expect(overlap(desk, r), `desk ${desk.seat} / pod`).toBe(false)
      }
    }
  })

  it('keeps the room’s furniture off the heroes’ sites: nothing it stands there blocks a set', () => {
    // Billy's own footprint is the one piece of furniture that is *his*: it is the board and the dais, in the plan so that
    // the walk grid closes them, and it is inside his site (above).
    for (const f of GARAGE_FURNITURE) {
      if (f.kind === 'easel') continue
      for (const id of HEROES) expect(overlap(footprint(f), rectOf(HERO_SITES[id])), `${f.kind} / ${id}`).toBe(false)
    }
  })

  it('never sends anybody on an errand on to a terrace, or into Billy’s board', () => {
    // The window errand was in the clerestory band on the far wall, and the hero stage was built over
    // it: two developers walked up an invisible stair and stood sunk in Billy's terrace. A destination is
    // a place the room draws and the walk reaches, and the terraces are neither.
    const easel = footprint(GARAGE_FURNITURE.find((f) => f.kind === 'easel')!)
    for (const dest of destinationsIn('garage')) {
      for (const s of dest.slots) {
        for (const p of GARAGE_PLATFORMS) {
          expect(s.x > p.x0 && s.x < p.x1 && s.z > p.z0 && s.z < p.z1, `${dest.kind} at ${s.x},${s.z}`).toBe(false)
        }
        expect(overlap({ x: s.x, z: s.z, w: 0, d: 0 }, easel), `${dest.kind} at ${s.x},${s.z}`).toBe(false)
      }
    }
  })

  it('closes the terraces and Billy’s board to routing, and leaves the floor one place you can walk across', () => {
    // Nobody walks on to them: the heroes are pinned (§18.1) and each is a step up.
    expect(walkable('garage', 4.4, -8)).toBe(false) // the Ops Room
    expect(walkable('garage', -1.6, -8)).toBe(false) // Matt's riser
    expect(walkable('garage', -7.0, -7.5)).toBe(false) // the boss's podium
    expect(walkable('garage', -8.4, -3)).toBe(false) // James's deck
    expect(walkable('garage', leader('billy').x, leader('billy').z)).toBe(false) // Billy's dais and board
    // …but the way on to the podium is a lane: the foot of the stair is floor.
    expect(walkable('garage', GARAGE_DECK_ENTRY.x, GARAGE_DECK_ENTRY.z)).toBe(true)
    expect(walkableRegions('garage')).toHaveLength(1)
  })
})
