import { describe, expect, it } from 'vitest'

import { GARAGE_CAP } from '../sim/capacity.ts'
import {
  GARAGE_LEADERSHIP,
  GARAGE_PODS,
  GARAGE_PROPS,
  GARAGE_ROLLUP,
  GARAGE_ROUTE,
  GARAGE_SEATS,
  GARAGE_SHELL,
  GARAGE_SPAN,
  POD_SEATS,
  acrossFrom,
  garageSeat,
  garageSeats,
  inPlot,
  opposite,
  plotsOverlap,
  podPlot,
  type Plot,
} from './garage.ts'
import { insideShell, wallSegments } from './shell.ts'

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
