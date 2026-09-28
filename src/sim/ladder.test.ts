import { describe, expect, it } from 'vitest'
import {
  TOP_RUNG,
  VIEWS,
  VIEW_KINDS,
  dominantView,
  rungAt,
  tierForRung,
  viewStopZ,
  viewWeights,
  zAtRung,
  type ViewKind,
} from './ladder.ts'
import { RUNGS } from './headcount.ts'

describe('the ladder is the navigation — GDD §7.4a', () => {
  it('gives every rung of §7.7.1 a stop the camera can park at', () => {
    // The requirement, stated as an assertion. "A rung that exists in the
    // simulation must exist in the lens" — so every rung in the headcount
    // table has to resolve to a view, and no rung may be reachable only by
    // passing through it.
    for (const rung of RUNGS) {
      const view = dominantView(zAtRung(rung.rung))
      expect(VIEW_KINDS).toContain(view)
    }
  })

  it('climbs one rung at a time and never skips one', () => {
    // §7.4a: "Zoom out today and you arrive at a galaxy, skipping the building,
    // the campus and the town." Walking Z from the desk to the galaxy must
    // visit *every* view in ladder order, with nothing jumped over.
    const seen: ViewKind[] = []
    for (let z = 0; z <= 1.0001; z += 0.002) {
      const view = dominantView(z)
      if (seen[seen.length - 1] !== view) seen.push(view)
    }
    expect(seen).toEqual(VIEWS.map((v) => v.view))
  })

  it('keeps the room a room for the whole garage-to-full-floor band', () => {
    // §7.8.0 — the room covers rungs 0 and 1: the full garage at twenty and
    // the full office floor at a hundred are the same room from two distances.
    // Above that the picture is a tower, because above that the thing that
    // arrives is a storey and not a person.
    expect(dominantView(zAtRung(0))).toBe('room')
    expect(dominantView(zAtRung(1))).toBe('room')
    expect(dominantView(zAtRung(2))).toBe('tower')
    expect(dominantView(zAtRung(3))).toBe('tower')
    expect(dominantView(zAtRung(4))).toBe('block')
  })

  it('puts the building, the campus and the town between the tower and the stars', () => {
    // The three rungs `render/city.ts` already draws and the camera never
    // showed — which §7.4a calls "the same failure as not having built them,
    // and more expensive".
    expect(dominantView(zAtRung(3))).toBe('tower')
    expect(dominantView(zAtRung(4))).toBe('block')
    expect(dominantView(zAtRung(5))).toBe('park')
    expect(dominantView(zAtRung(6))).toBe('sprawl')
    expect(dominantView(zAtRung(7))).toBe('grid')
    expect(dominantView(zAtRung(9))).toBe('cosmic')
  })

  it('is a round trip — a rung maps to a Z and back', () => {
    for (let rung = 0; rung <= TOP_RUNG; rung++) {
      expect(rungAt(zAtRung(rung))).toBeCloseTo(rung, 10)
    }
  })

  it('clamps rather than running off either end', () => {
    expect(zAtRung(-4)).toBe(0)
    expect(zAtRung(400)).toBe(1)
    expect(rungAt(-1)).toBe(0)
    expect(rungAt(2)).toBe(TOP_RUNG)
  })
})

describe('the cross-fade — GDD §10.5, nothing cuts', () => {
  it('always sums to 1, so a dolly holds constant brightness', () => {
    for (let z = 0; z <= 1.0001; z += 0.005) {
      const total = Object.values(viewWeights(z)).reduce((a, b) => a + b, 0)
      expect(total).toBeCloseTo(1, 10)
    }
  })

  it('peaks on the view whose stop Z is nearest', () => {
    for (const spec of VIEWS) {
      const w = viewWeights(viewStopZ(spec.view))
      const winner = VIEW_KINDS.reduce((a, b) => (w[b] > w[a] ? b : a))
      expect(winner).toBe(spec.view)
    }
  })

  it('overlaps its neighbour between two stops rather than swapping', () => {
    // Halfway between the tower and the block, both are on screen. Before
    // §7.4a there was no "between" — the two were mutually exclusive and chosen
    // by headcount, so the hand-off was a swap the camera could not even reach.
    const w = viewWeights(zAtRung(3.5))
    expect(w.tower).toBeGreaterThan(0.2)
    expect(w.block).toBeGreaterThan(0.2)
  })

  it('never lights a view two rungs away', () => {
    const w = viewWeights(zAtRung(2))
    expect(w.block).toBe(0)
    expect(w.grid).toBe(0)
    expect(w.cosmic).toBe(0)
  })

  it('is continuous — no weight jumps between adjacent samples', () => {
    // The bound is derived from the narrowest fade rather than picked. A
    // smoothstep's steepest slope is 1.5 per half-width, so a view whose fade
    // is `h` rungs wide changes at up to `1.5 / h` per rung — and `sprawl`'s is
    // deliberately the narrowest, because §7.7.1's town-to-nation rung is two
    // decades and deserves half the overlap the one-decade rungs get.
    // Then the renormalise roughly doubles it: the weights are divided by their
    // own sum, and where one view is falling fastest the sum is falling too, so
    // both the numerator and the denominator move the same way. Measured at
    // about 1.85x the raw slope; 2.5 is the headroom over that.
    const dz = 0.004
    const narrowest = Math.min(
      ...VIEWS.map((v) => Math.min(v.halfWidth, v.halfWidthOut ?? v.halfWidth)),
    )
    const bound = (1.5 / narrowest) * TOP_RUNG * dz * 2.5
    let prev = viewWeights(0)
    for (let z = dz; z <= 1; z += dz) {
      const next = viewWeights(z)
      for (const view of VIEW_KINDS) {
        expect(Math.abs(next[view] - prev[view])).toBeLessThan(bound)
      }
      prev = next
    }
  })

  it('shows the room at the very bottom, so §7.7.4 always has James in it', () => {
    // Pinching all the way in is the Hero Anchor and it is not allowed to fade
    // out into an empty frame on the way.
    expect(viewWeights(0).room).toBeCloseTo(1, 10)
  })

  it('fails visibly to the room instead of culling every view on invalid input', () => {
    // Asked of the earned-view weights until the zoom ceiling went (GDD §7.4a,
    // amended 2026-09-27); the claim was always about the fade underneath them.
    const weights = viewWeights(Number.NaN)
    expect(weights.room).toBeGreaterThan(0)
    expect(Object.values(weights).every(Number.isFinite)).toBe(true)
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })
})

/*
 * "The ceiling — §7.4a, a rung you have not earned is not reachable" stood here
 * until 2026-09-27: five tests that the ceiling stopped at the studio's own
 * rung, that it agreed with `maxZoomFor`, and that the unearned rung above was
 * gated out of the fade without dimming the picture. The user amended the rule
 * (*"no we don't keep the lock"*), the functions went with it, and the claim
 * that replaced it — every level reachable at any headcount, each drawing only
 * what the studio has — is pinned where the lens and the frames live
 * (`render/lens.test.ts`, `render/frames.test.ts`).
 */

describe('tiers are still tiers — §7.4a keeps the two concepts apart', () => {
  it('draws ten rungs out of four tiers, which is the whole distinction', () => {
    const tiers = new Set(RUNGS.map((r) => tierForRung(r.rung)))
    expect(tiers.size).toBe(4)
    expect(RUNGS.length).toBe(10)
  })

  it('never goes backwards down the tiers as the camera pulls out', () => {
    let previous = 1
    for (let rung = 0; rung <= TOP_RUNG; rung++) {
      const tier = tierForRung(rung)
      expect(tier).toBeGreaterThanOrEqual(previous)
      previous = tier
    }
  })
})
