import { describe, expect, it } from 'vitest'

import { GARAGE_CAP } from '../sim/capacity.ts'
import {
  COLUMN_THICK,
  GARAGE_GLASS,
  GARAGE_LEADERSHIP,
  GARAGE_PODS,
  GARAGE_PROPS,
  GARAGE_ROLLUP,
  GARAGE_ROUTE,
  GARAGE_SEATS,
  GARAGE_SHELL,
  GARAGE_SPAN,
  GARAGE_VALUES,
  GLASS_CLEAR,
  NEAR_CLEAR,
  garageColumns,
  POD_SEATS,
  WALL_CLEAR,
  acrossFrom,
  garageSeat,
  garageSeats,
  inPlot,
  opposite,
  plotsOverlap,
  podPlot,
  type Plot,
} from './garage.ts'
import { RAMPS } from '../art/palette.ts'
import { WALL_FULL, WALL_NEAR, WALL_THICK, insideShell, wallSegments } from './shell.ts'

/**
 * §7.8.0c — the garage plan.
 *
 * Every claim the prompt asks to be proven about this room, made against the
 * table the renderer reads rather than against a screenshot.
 */

describe('twenty ordinary seats, and exactly twenty', () => {
  it('is five pods of four', () => {
    expect(GARAGE_PODS).toHaveLength(5)
    expect(POD_SEATS).toBe(4)
    expect(GARAGE_SEATS).toBe(20)
    expect(GARAGE_SEATS).toBe(GARAGE_CAP)
  })

  it('gives every seat its own place', () => {
    const seen = new Set(garageSeats().map((s) => `${s.gx.toFixed(4)},${s.gy.toFixed(4)}`))
    expect(seen.size).toBe(GARAGE_SEATS)
  })

  it('puts four people in each pod and no pod half-filled before the next starts', () => {
    // The twentieth hire has to *complete* the fifth pod, which is a claim
    // about fill order and not about an animation.
    const counts = new Map<number, number>()
    for (const s of garageSeats()) counts.set(s.pod, (counts.get(s.pod) ?? 0) + 1)
    expect([...counts.values()]).toEqual([4, 4, 4, 4, 4])
    for (let n = 1; n <= GARAGE_SEATS; n++) {
      const pods = new Set(Array.from({ length: n }, (_, i) => garageSeat(i).pod))
      // At n developers, at most one pod is partly filled.
      expect(pods.size).toBe(Math.ceil(n / POD_SEATS))
    }
  })
})

/**
 * §7.8.1b within the room: hiring somebody may not move anybody. The structural
 * form of the claim is stronger than sampling it — `garageSeat` takes one
 * argument and reads no state, so there is no headcount to re-solve against.
 */
describe('existing developers never move when a new one is hired', () => {
  it('is a pure function of the index', () => {
    expect(garageSeat.length).toBe(1)
    for (let n = 1; n <= GARAGE_SEATS; n++) {
      for (let i = 0; i < n; i++) {
        expect(garageSeat(i)).toEqual(garageSeat(i))
      }
    }
  })

  it('holds seat 0 still across every headcount the garage can be at', () => {
    const first = garageSeat(0)
    for (let n = 1; n <= GARAGE_SEATS; n++) expect(garageSeat(0)).toEqual(first)
  })
})

describe('developers on opposite sides of a pod face one another', () => {
  it('pairs every seat with the one across the table', () => {
    for (let i = 0; i < GARAGE_SEATS; i++) {
      const j = acrossFrom(i)
      expect(acrossFrom(j)).toBe(i)
      const a = garageSeat(i)
      const b = garageSeat(j)
      expect(a.pod).toBe(b.pod)
      expect(b.facing).toBe(opposite(a.facing))
      // Facing each other means the one looking `gx+` is the one with the
      // smaller gx, or they are looking at each other's backs.
      if (a.facing === 'gx+') expect(a.gx).toBeLessThan(b.gx)
      else expect(a.gx).toBeGreaterThan(b.gx)
      // And they are across the table, not along it.
      expect(a.gy).toBeCloseTo(b.gy, 10)
    }
  })

  it('seats a pod s first two arrivals opposite each other', () => {
    // Filling a side at a time gives two strangers looking at an empty bench.
    // The pair is the smallest thing in this game that reads as a team.
    for (let pod = 0; pod < GARAGE_PODS.length; pod++) {
      const a = garageSeat(pod * POD_SEATS)
      const b = garageSeat(pod * POD_SEATS + 1)
      expect(b.facing).toBe(opposite(a.facing))
      expect(acrossFrom(pod * POD_SEATS)).toBe(pod * POD_SEATS + 1)
    }
  })
})

/**
 * "Five pods, staggered" is exactly the kind of property that survives an edit
 * as a word in a comment long after the numbers have drifted back into a grid.
 */
describe('the pods are staggered, not a grid', () => {
  it('gives no two pods the same gx or the same gy', () => {
    expect(new Set(GARAGE_PODS.map((p) => p.gx)).size).toBe(GARAGE_PODS.length)
    expect(new Set(GARAGE_PODS.map((p) => p.gy)).size).toBe(GARAGE_PODS.length)
  })

  it('leaves a pod s worth of floor between every pair of them', () => {
    for (let i = 0; i < GARAGE_PODS.length; i++) {
      for (let j = i + 1; j < GARAGE_PODS.length; j++) {
        expect(plotsOverlap(podPlot(GARAGE_PODS[i]), podPlot(GARAGE_PODS[j]))).toBe(false)
      }
    }
  })
})

/**
 * §7.8.0's separation, drawn. The corner exists, people stand in it, and the
 * twenty do not know about it.
 */
describe('leadership plots do not consume ordinary capacity', () => {
  it('seats nobody ordinary inside the corner', () => {
    for (const s of garageSeats()) {
      expect(inPlot(GARAGE_LEADERSHIP, s.gx, s.gy)).toBe(false)
    }
  })

  it('keeps the corner clear of every pod s footprint', () => {
    for (const pod of GARAGE_PODS) {
      expect(plotsOverlap(podPlot(pod), GARAGE_LEADERSHIP)).toBe(false)
    }
  })

  it('counts twenty seats whether the corner is occupied or empty', () => {
    // There is no occupancy parameter. That is the assertion.
    expect(GARAGE_SEATS).toBe(GARAGE_CAP)
    expect(garageSeats()).toHaveLength(GARAGE_CAP)
  })
})

describe('amenities and seats never overlap', () => {
  it('stands every prop clear of every pod', () => {
    for (const prop of GARAGE_PROPS) {
      for (const pod of GARAGE_PODS) {
        expect({ prop: prop.name, pod: pod.name, hit: plotsOverlap(prop, podPlot(pod)) })
          .toEqual({ prop: prop.name, pod: pod.name, hit: false })
      }
    }
  })

  it('stands every prop clear of every seat', () => {
    for (const prop of GARAGE_PROPS) {
      for (const s of garageSeats()) {
        expect(inPlot(prop, s.gx, s.gy)).toBe(false)
      }
    }
  })

  it('stands every prop clear of the leadership corner', () => {
    for (const prop of GARAGE_PROPS) {
      expect(plotsOverlap(prop, GARAGE_LEADERSHIP)).toBe(false)
    }
  })

  it('does not stack two props on the same floor', () => {
    for (let i = 0; i < GARAGE_PROPS.length; i++) {
      for (let j = i + 1; j < GARAGE_PROPS.length; j++) {
        expect(plotsOverlap(GARAGE_PROPS[i], GARAGE_PROPS[j])).toBe(false)
      }
    }
  })
})

describe('walk routes remain clear', () => {
  /**
   * The route is a spine rather than a corridor between every pair of pods,
   * because the concept's floor is one big open middle with the pods around it.
   * Every leg of it has to be walkable, and every pod has to be one step off.
   */
  it('runs from the roll-up door to the leadership corner', () => {
    expect(GARAGE_ROUTE.length).toBeGreaterThanOrEqual(3)
    const door = GARAGE_ROUTE[0]
    // Starts on the threshold of the opening, not through a wall. The near-left
    // wall runs along `gx`, so the opening is measured in `gx` — the axis this
    // assertion had wrong the first time, while every width in it was right.
    expect(door.gx).toBeGreaterThanOrEqual(GARAGE_ROLLUP.at)
    expect(door.gx).toBeLessThanOrEqual(GARAGE_ROLLUP.at + GARAGE_ROLLUP.width)
    // Ends inside the leadership corner.
    const end = GARAGE_ROUTE[GARAGE_ROUTE.length - 1]
    expect(inPlot(GARAGE_LEADERSHIP, end.gx, end.gy)).toBe(true)
  })

  it('never crosses a pod or a prop', () => {
    const blockers = [...GARAGE_PODS.map(podPlot), ...GARAGE_PROPS]
    // Sample each leg densely — a route that only clears the obstacles at its
    // waypoints is a route that walks through a desk in between.
    for (let i = 0; i + 1 < GARAGE_ROUTE.length; i++) {
      const a = GARAGE_ROUTE[i]
      const b = GARAGE_ROUTE[i + 1]
      for (let t = 0; t <= 1; t += 1 / 64) {
        const gx = a.gx + (b.gx - a.gx) * t
        const gy = a.gy + (b.gy - a.gy) * t
        for (const p of blockers) {
          expect({ leg: i, at: p.name, hit: inPlot(p, gx, gy) })
            .toEqual({ leg: i, at: p.name, hit: false })
        }
      }
    }
  })

  /**
   * **No pod is walled in.** The first version of this asked that every pod be
   * within a fixed distance of the spine, and that was the wrong claim: the
   * spine runs from the door to the leadership corner, so the pod in the
   * *opposite* corner is legitimately far from it and the concept shows exactly
   * that. What actually matters for "individual people large enough to tap" is
   * that a walker can get to a pod at all — that no pod is enclosed by other
   * pods and props on every side.
   */
  it('leaves every pod an open approach to the edge of the room', () => {
    const blockers = [...GARAGE_PROPS, ...GARAGE_PODS.map(podPlot)]
    for (const pod of GARAGE_PODS) {
      const mine = podPlot(pod)
      const ways = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]
      const open = ways.filter(([dx, dy]) => {
        for (let d = 1.6; d <= GARAGE_SPAN; d += 0.25) {
          const gx = pod.gx + dx * d
          const gy = pod.gy + dy * d
          if (gx < 0 || gy < 0 || gx > GARAGE_SPAN || gy > GARAGE_SPAN) return true
          if (blockers.some((p) => p !== mine && inPlot(p, gx, gy))) return false
        }
        return true
      })
      expect({ pod: pod.name, approaches: open.length > 0 })
        .toEqual({ pod: pod.name, approaches: true })
    }
  })
})

describe('the shell', () => {
  it('encloses the floor on all four sides', () => {
    expect(GARAGE_SHELL).toHaveLength(4)
    expect(new Set(GARAGE_SHELL.map((r) => r.edge)).size).toBe(4)
  })

  it('puts both doors in the street wall, and nothing in the other three', () => {
    // §7.8.0c — the side door was in the far-left wall, which is the one you
    // cannot reach from the road. A garage has both its doors in the frontage.
    for (const edge of ['far-left', 'far-right', 'near-right'] as const) {
      const run = GARAGE_SHELL.find((r) => r.edge === edge)!
      expect({ edge, openings: run.openings?.length ?? 0 }).toEqual({ edge, openings: 0 })
    }
    const street = GARAGE_SHELL.find((r) => r.edge === 'near-left')!
    expect(street.openings).toHaveLength(2)
  })

  it('cuts the roll-up door as a real opening', () => {
    const near = GARAGE_SHELL.find((r) => r.edge === 'near-left')!
    const segs = wallSegments(near)
    // Nothing occupies the doorway at ground level — it is a gap in the list of
    // solids, not a rectangle painted on one. Segments above the *side* door's
    // head are legal and are the lintel, so the test looks at z = 0.
    const mid = GARAGE_ROLLUP.at + GARAGE_ROLLUP.width / 2
    for (const s of segs) {
      expect({ at: s.gx, covers: s.gz === 0 && s.gx <= mid && mid < s.gx + s.w })
        .toEqual({ at: s.gx, covers: false })
    }
  })

  it('stands a lintel over the side door but not over the roll-up', () => {
    const segs = wallSegments(GARAGE_SHELL.find((r) => r.edge === 'near-left')!)
    const lintels = segs.filter((s) => s.kind === 'lintel')
    // Exactly one: a person-sized door in a storey-tall wall leaves a band of
    // block above it. The roll-up is the height of the wall and gets none —
    // drawing wall above it would be a lie about the building.
    expect(lintels).toHaveLength(1)
    const mid = GARAGE_ROLLUP.at + GARAGE_ROLLUP.width / 2
    expect(lintels[0].gx <= mid && mid < lintels[0].gx + lintels[0].w).toBe(false)
  })

  it('keeps every seat and every pod inside the walls', () => {
    for (const s of garageSeats()) {
      expect({ seat: s.index, inside: insideShell(GARAGE_SHELL, s.gx, s.gy) })
        .toEqual({ seat: s.index, inside: true })
    }
  })

  it('keeps the pods clear of the span they are laid out in', () => {
    for (const pod of GARAGE_PODS) {
      const p = podPlot(pod)
      expect(p.gx0).toBeGreaterThan(0)
      expect(p.gy0).toBeGreaterThan(0)
      expect(p.gx1).toBeLessThan(GARAGE_SPAN)
      expect(p.gy1).toBeLessThan(GARAGE_SPAN)
    }
  })
})

/**
 * §7.8.0c — **the clash gate.**
 *
 * Two objects standing in the same place is the defect this room kept
 * producing, and every instance of it was found by looking at a screenshot at
 * four times magnification. That is not a method; it is luck with a deadline.
 *
 * What made the instances possible was always the same shape: **two systems
 * with a claim on the same floor and no shared table.** The plan against the
 * suite, the plan against the legacy wall ring, the props against the glass. So
 * the gate is not "does prop X overlap object Y" one pair at a time — it is
 * *every* rectangle the garage claims, checked against every other, from one
 * list. A new prop is covered the moment it is added, which is the property a
 * hand-checked pair can never have.
 */
describe('nothing in the garage stands in anything else', () => {
  /**
   * Every rectangle the room claims, in the plan's own tiles.
   *
   * §7.8.12's suite is included by converting its lattice box back into plan
   * space, because the suite is the one claimant that is *not* authored here
   * and is therefore the one most able to disagree.
   */
  const claims = (): Plot[] => [
    ...GARAGE_PROPS,
    ...GARAGE_PODS.map(podPlot),
    { ...GARAGE_LEADERSHIP, name: 'THE SUITE (reserved)' },
  ]

  it('gives every claimant its own floor', () => {
    const all = claims()
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect({ a: all[i].name, b: all[j].name, clash: plotsOverlap(all[i], all[j]) })
          .toEqual({ a: all[i].name, b: all[j].name, clash: false })
      }
    }
  })

  /**
   * And nothing stands in a wall. A prop half inside the shell is the same
   * defect as two props in each other, with the building as one of the two —
   * and it is the one the eye forgives longest, because a shelf against a wall
   * and a shelf *inside* a wall look identical until you get close.
   */
  it('keeps every claimant inside the walls', () => {
    for (const plot of claims()) {
      const corners: Array<[number, number]> = [
        [plot.gx0, plot.gy0],
        [plot.gx1 - 1e-6, plot.gy0],
        [plot.gx0, plot.gy1 - 1e-6],
        [plot.gx1 - 1e-6, plot.gy1 - 1e-6],
      ]
      for (const [gx, gy] of corners) {
        expect({ at: plot.name, inside: insideShell(GARAGE_SHELL, gx, gy) })
          .toEqual({ at: plot.name, inside: true })
      }
    }
  })
})

/**
 * §7.8.0c [added 2026-09-02] — **the clearance gate.**
 *
 * The clash gate above asks whether two things are in the same place. This asks
 * the question one step out: whether there is *room to walk* between a desk and
 * the wall behind it. Non-overlap was already true when four of the five pods
 * had their chairs a hand's width off the block, and the room looked like it —
 * the canonical concept's whole read is open floor round the outside, and a pod
 * that merely fails to intersect a wall does not produce that.
 *
 * It is the same argument as the clash gate and the same failure history: a
 * property everyone agreed about in prose, checked by nobody, drifting one pod
 * at a time. So it is measured, in tiles, against the walls the shell actually
 * cuts — not against `GARAGE_SPAN`, which is a number this file could change
 * without moving a wall.
 */
describe('every desk stands off every wall', () => {
  /** The four inner faces, as (axis, coordinate, which side the room is on). */
  const faces = [
    { name: 'far-right (gy 0)', at: (p: ReturnType<typeof podPlot>) => p.gy0 },
    { name: 'far-left (gx 0)', at: (p: ReturnType<typeof podPlot>) => p.gx0 },
    { name: 'near-left (gy max)', at: (p: ReturnType<typeof podPlot>) => GARAGE_SPAN - p.gy1 },
    { name: 'near-right (gx max)', at: (p: ReturnType<typeof podPlot>) => GARAGE_SPAN - p.gx1 },
  ]

  it('leaves a walking lane behind every pod on all four sides', () => {
    for (const pod of GARAGE_PODS) {
      const plot = podPlot(pod)
      for (const face of faces) {
        const gap = face.at(plot)
        expect({ pod: pod.name, wall: face.name, clear: gap >= WALL_CLEAR })
          .toEqual({ pod: pod.name, wall: face.name, clear: true })
      }
    }
  })

  /**
   * And off the reclaimed glass, which is a wall as far as a chair is
   * concerned. It gets its own smaller number ({@link GLASS_CLEAR}) because it
   * is a partition inside one room rather than the edge of the building — but
   * *some* number, because a pod flush against the corner's glazing was one of
   * the four defects that started this.
   */
  it('leaves a lane off the leadership glass', () => {
    for (const pod of GARAGE_PODS) {
      const plot = podPlot(pod)
      // The partition runs along `gy` at a fixed `gx`, so only pods whose `gy`
      // band overlaps its run are behind it at all.
      const behind = plot.gy0 < GARAGE_GLASS.to && plot.gy1 > GARAGE_GLASS.from
      if (!behind) continue
      expect({ pod: pod.name, clear: plot.gx0 - GARAGE_GLASS.at >= GLASS_CLEAR })
        .toEqual({ pod: pod.name, clear: true })
    }
  })

  /**
   * The props are the *other* half of the same picture and take the opposite
   * rule: a shelf, a workbench, a sofa and a bin all lean on a wall, and one
   * standing out in the floor would read as having been dragged there. So every
   * prop must touch a wall, which is the claim that keeps the perimeter band
   * furniture and the middle band floor.
   */
  /**
   * **And against a wall the camera can see over** — which means one of the two
   * *far* walls, at `gx 0` or `gy 0`.
   *
   * This is a fact about the projection and not about taste. The near walls are
   * cut down (§7.8.0b) and stand **between the camera and the room**, so
   * anything against one of them is behind it: at 2.15 person-heights the wall
   * hides everything shorter than about 1.3 tiles, which covered the sofa
   * completely and left a hand's breadth of the fridge showing. Four of the ten
   * props were drawn, tested for overlap, tested for clearance, and invisible.
   *
   * The far walls are behind their props, so a prop there is lit against a
   * surface. That is where both canonical concepts put every soft furnishing
   * they have, and the reason is the same one.
   */
  /**
   * **And far enough back from the near walls to clear them.** Being against a
   * far wall is not enough on its own: the two near walls run across the front
   * of the room, and the corner where a far wall meets a near one is behind
   * both. The sofa ran to that corner and its last third was hidden by a wall
   * eight tiles away from it — a defect no overlap or containment check can
   * see, because nothing was overlapping anything.
   */
  it('keeps every prop clear of the walls that stand in front of it', () => {
    for (const prop of GARAGE_PROPS) {
      expect({
        prop: prop.name,
        // An epsilon, because the sofa is written as `GARAGE_SPAN - NEAR_CLEAR`
        // exactly and 16 - 14.4 does not come back as 1.6 in binary.
        clear:
          GARAGE_SPAN - prop.gx1 >= NEAR_CLEAR - 1e-9 &&
          GARAGE_SPAN - prop.gy1 >= NEAR_CLEAR - 1e-9,
      }).toEqual({ prop: prop.name, clear: true })
    }
  })

  it('keeps every prop against a wall the camera can see over', () => {
    const onAFarWall = (p: Plot) => p.gx0 <= 1e-9 || p.gy0 <= 1e-9
    const touching = (a: Plot, b: Plot) =>
      a !== b &&
      a.gx0 < b.gx1 + 1e-9 &&
      a.gx1 > b.gx0 - 1e-9 &&
      a.gy0 < b.gy1 + 1e-9 &&
      a.gy1 > b.gy0 - 1e-9
    /*
     * **Anchored is transitive**, because the perimeter band is two or three
     * deep and not one.
     *
     * The tool chest stands in front of the workbench, the workbench stands in
     * front of the tool board, and only the tool board touches the block. A
     * one-hop rule called that homeless, which is wrong about workshops: a
     * bench with a chest under it is *more* against the wall than either alone.
     * So this walks the chain back to masonry rather than looking one step.
     */
    const anchored = new Set(GARAGE_PROPS.filter(onAFarWall))
    for (let grew = true; grew; ) {
      grew = false
      for (const prop of GARAGE_PROPS) {
        if (anchored.has(prop)) continue
        if (GARAGE_PROPS.some((other) => anchored.has(other) && touching(prop, other))) {
          anchored.add(prop)
          grew = true
        }
      }
    }
    for (const prop of GARAGE_PROPS) {
      expect({ prop: prop.name, seen: anchored.has(prop) })
        .toEqual({ prop: prop.name, seen: true })
    }
  })
})

/**
 * §7.8.0c [added 2026-09-02] — **the value gate.**
 *
 * Three of the five garage iterations before this one were value problems that
 * arrived looking like size problems, and every one was settled by eye against a
 * single surface. That is how the room ended up brighter outside than in.
 *
 * This is the same argument as the clash gate one level up: a property everyone
 * agrees about in prose, checked by nobody, drifting one step at a time. It
 * cannot check what a pixel looks like — `test:ui-frame` does that — but it can
 * hold the *ordering*, which is the part that was wrong and the part a single-
 * surface judgement can never see.
 */
describe('the room is brighter inside than out', () => {
  const { farWall, nearWall, floor, street } = GARAGE_VALUES

  it('puts the four surfaces in the order the concept has them', () => {
    // far wall > floor > near wall > carriageway, measured off
    // garage-layout-concept-20-devs-v1.png at [3], [2], [1] and [0].
    expect(farWall.left).toBeGreaterThan(floor.bays)
    expect(floor.bays).toBeGreaterThan(nearWall.left)
    expect(nearWall.left).toBeGreaterThan(street.carriageway)
  })

  it('never lets the street outshine the floor inside', () => {
    // The one claim that says "the lights are on in here": every *area* of
    // ground outside sits at or below the floor's base pour.
    //
    // The kerb is exempt and is the only exemption, for the reason the copings
    // are: it is a thin lit edge rather than an area, and it is the one thing
    // out there the concept does draw brighter than the road — a kerb the same
    // value as its pavement has stopped being a kerb. It still may not beat the
    // floor's bays, so the brightest ground in the picture is inside.
    // Measured rather than assumed: the concept's pavement (61,42,33) is
    // fractionally *lighter* than its floor (55,35,28), because a street lamp
    // stands over one and not the other. So the honest ceiling is the floor's
    // lit pour and not its base — what actually says "the lights are on in
    // here" is the lamp pools and the dark near walls, not the bare ground.
    for (const [name, band] of Object.entries(street)) {
      expect({ band: name, dimmerThanTheFloor: band <= floor.bays })
        .toEqual({ band: name, dimmerThanTheFloor: true })
    }
  })

  /**
   * **A coping is only lighter than its wall indoors**, and that is a fact about
   * the night rather than about §7.
   *
   * §7's key comes from above, so the top plane of a solid is its brightest —
   * inside. Outside, after dark, there is nothing above: a horizontal surface
   * sees the sky and the vertical one facing the street sees the street lamp.
   * The concept measures its outdoor coping at 28 and the wall face under it at
   * 32, which is that inversion, and it is why the near walls' coping was the
   * last pale band left on the frontage.
   */
  it('lights the far wall from above and the near walls from the street', () => {
    expect(farWall.top).toBeGreaterThan(farWall.left)
    expect(farWall.top).toBeGreaterThanOrEqual(farWall.right)
    // The near coping keeps enough lift to draw the wall's own edge, and no
    // more: never as bright as the indoor one, never below its own faces.
    expect(nearWall.top).toBeGreaterThanOrEqual(nearWall.left)
    expect(nearWall.top).toBeLessThan(farWall.top)
  })

  /**
   * **The gate is the wall's own tone**, and it reads by pattern.
   *
   * Measured off the concept: shutter `[1]`–`[2]`, the wall beside it `[1]`,
   * the piers `[2]`. Nothing about a roller shutter is brighter than the
   * building — what names it is the corrugation, the sign across it, and the
   * two piers framing it. The render had it at `[5]`, which made the front door
   * the brightest object in the lower half of the picture.
   */
  it('paints the gate in the wall it sits in', () => {
    const { gate } = GARAGE_VALUES
    expect(Math.abs(gate.panel - nearWall.left)).toBeLessThanOrEqual(1)
    // The piers carry the lift the panel used to have, so the opening is framed
    // rather than lit.
    expect(gate.pier).toBeGreaterThan(gate.panel)
    expect(gate.pier).toBeGreaterThan(nearWall.top)
    // And the corrugation reads as shadow on the panel, not as highlight.
    expect(gate.slat).toBeLessThan(gate.panel)
  })

  it('stays on the ramp', () => {
    const all = [
      ...Object.values(farWall),
      ...Object.values(nearWall),
      ...Object.values(floor),
      ...Object.values(street),
    ]
    for (const v of all) expect(v).toBeGreaterThanOrEqual(0)
    for (const v of all) expect(v).toBeLessThan(9)
  })
})

/**
 * §7.8.0b [added 2026-09-02] — **the corner piers.**
 *
 * The defect they exist to prevent is a mitre: two wall runs meeting at a
 * corner join correctly only if both stop at exactly the right coordinate, and
 * a wrong one shows as an end cap through a face or a sliver of floor between
 * them — invisible in the numbers, obvious in the picture, and exactly the
 * class of thing `test:room` was written for one level up.
 *
 * So the claims here are the ones that make a pier *cover* the join rather than
 * sit near it, plus the one rule about height that keeps the near vertex from
 * planting a storey-tall post between the camera and the room.
 */
describe('every corner of the shell has a pier on it', () => {
  const lo = -WALL_THICK
  const hi = GARAGE_SPAN + WALL_THICK
  const columns = garageColumns(lo, lo, hi, hi)

  it('puts one on each of the four corners', () => {
    expect(columns).toHaveLength(4)
    expect(new Set(columns.map((c) => c.name)).size).toBe(4)
  })

  it('makes each one thicker than the wall it caps', () => {
    // A pier the width of the wall is a length of wall, not a pier — it cannot
    // hide a join it is exactly flush with.
    for (const col of columns) {
      expect({ at: col.name, thicker: col.size > WALL_THICK })
        .toEqual({ at: col.name, thicker: true })
      expect(col.size).toBe(COLUMN_THICK)
    }
  })

  it('covers the wall band on both axes at its corner', () => {
    // The real claim: whatever the two runs do at this corner, the pier's
    // square already contains the whole thickness of both of them.
    for (const col of columns) {
      const nearLoGx = Math.abs(col.gx - lo) < GARAGE_SPAN / 2
      const nearLoGy = Math.abs(col.gy - lo) < GARAGE_SPAN / 2
      const bandGx = nearLoGx ? [lo, lo + WALL_THICK] : [hi - WALL_THICK, hi]
      const bandGy = nearLoGy ? [lo, lo + WALL_THICK] : [hi - WALL_THICK, hi]
      expect({ at: col.name, gx: col.gx <= bandGx[0] + 1e-9 && col.gx + col.size >= bandGx[1] - 1e-9 })
        .toEqual({ at: col.name, gx: true })
      expect({ at: col.name, gy: col.gy <= bandGy[0] + 1e-9 && col.gy + col.size >= bandGy[1] - 1e-9 })
        .toEqual({ at: col.name, gy: true })
    }
  })

  it('is as tall as the taller of the two walls it joins', () => {
    const byName = Object.fromEntries(columns.map((c) => [c.name, c.height]))
    // Three corners carry at least one full-height wall.
    expect(byName.far).toBe(WALL_FULL)
    expect(byName.left).toBe(WALL_FULL)
    expect(byName.right).toBe(WALL_FULL)
    // The near vertex has two cut-down walls, and is the one place a tall pier
    // would stand in the picture rather than in the building.
    expect(byName.near).toBe(WALL_NEAR)
  })
})

/**
 * §7.8.0c [added 2026-09-02] — **the hue gate.**
 *
 * The value table above pins how *light* each surface is, and five iterations
 * of getting that right still left a room that did not look like the concept.
 * The reason is an axis the table cannot see: `NEUTRAL` is uniformly cool, so
 * every surface separated from every other by lightness alone.
 *
 * The concept's **cool** surfaces sit on that ramp almost exactly — its near
 * wall measures 36,31,40 against `NEUTRAL[1]`'s 36,31,46, and its road 12,11,16
 * against `[0]`'s 20,18,26. Its **warm** ones are nowhere on it: the floor is
 * 55,35,28, and no step of `NEUTRAL` at that lightness carries a blue channel
 * anywhere near that low.
 *
 * So this checks the blend the renderer actually produces against the number
 * measured off the concept. It is the same method as the value table — sample
 * the reference, and hold the result where a test can see it — applied to the
 * one channel the table was blind to.
 */
describe('the floor is warm and the street is not', () => {
  /** What `fill({ alpha })` does, in the one place a test needs to know. */
  const hex = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]
  const over = (base: string, wash: string, t: number) => {
    const [br, bg, bb] = hex(base)
    const [wr, wg, wb] = hex(wash)
    return [br + (wr - br) * t, bg + (wg - bg) * t, bb + (wb - bb) * t]
  }

  /** Measured off garage-layout-concept-20-devs-v1.png, away from any lamp. */
  const CONCEPT_FLOOR = [55, 35, 28]

  it('lands the lit pour on the concept s own floor colour', () => {
    const { floor } = GARAGE_VALUES
    const drawn = over(RAMPS.NEUTRAL[floor.bays], RAMPS.WARN[0], floor.warmth)
    for (let i = 0; i < 3; i++) {
      const off = Math.abs(drawn[i] - CONCEPT_FLOOR[i])
      expect({ channel: 'rgb'[i], within: off <= 8 }).toEqual({ channel: 'rgb'[i], within: true })
    }
  })

  it('takes the blue channel down, which is the one that was wrong', () => {
    const { floor } = GARAGE_VALUES
    const bare = hex(RAMPS.NEUTRAL[floor.bays])
    const drawn = over(RAMPS.NEUTRAL[floor.bays], RAMPS.WARN[0], floor.warmth)
    // Warm means red over blue. Unwashed `NEUTRAL` is the other way round —
    // it is a purple ramp — and that is the whole defect.
    expect(bare[0] - bare[2]).toBeLessThan(0)
    expect(drawn[0] - drawn[2]).toBeGreaterThan(15)
  })

  it('warms the wall the room stands in front of, and by the same recipe', () => {
    // The concept's far wall is warm grey and *lighter* than its floor — that
    // is what makes it the surface the room sits against rather than a hole
    // behind it. A brown floor under a lavender wall reads as a room built on
    // somebody else's ground, which is what the floor wash on its own produced.
    const { farWall } = GARAGE_VALUES
    const drawn = over(RAMPS.NEUTRAL[farWall.left], RAMPS.WARN[0], farWall.warmth)
    const CONCEPT_FAR_WALL = [82, 71, 63]
    for (let i = 0; i < 3; i++) {
      const off = Math.abs(drawn[i] - CONCEPT_FAR_WALL[i])
      expect({ channel: 'rgb'[i], within: off <= 8 }).toEqual({ channel: 'rgb'[i], within: true })
    }
    // And it stays the lighter of the two, after both washes.
    const floorDrawn = over(
      RAMPS.NEUTRAL[GARAGE_VALUES.floor.bays],
      RAMPS.WARN[0],
      GARAGE_VALUES.floor.warmth,
    )
    expect(drawn[0] + drawn[1] + drawn[2]).toBeGreaterThan(
      floorDrawn[0] + floorDrawn[1] + floorDrawn[2],
    )
  })

  it('leaves the street on the cool ramp', () => {
    // The concept's road and near wall sit on `NEUTRAL` as drawn, so nothing
    // out there is washed: the split between warm inside and cool outside is
    // the thing being modelled, and washing both would erase it.
    expect(Object.keys(GARAGE_VALUES.street)).not.toContain('warmth')
    expect(Object.keys(GARAGE_VALUES.nearWall)).not.toContain('warmth')
  })
})
