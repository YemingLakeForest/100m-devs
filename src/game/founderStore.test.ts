/**
 * You, wired — GDD §4.5d, §13.7.1. R16 and R20.
 *
 * `sim/founder.test.ts` proves the curve. This proves the three claims that
 * only exist once the curve is plugged into the store, and every one of them is
 * a sentence §4.5d writes as a requirement rather than as a number:
 *
 *   - your output is **not** divided by §4.1's Entropy;
 *   - your output is **not** multiplied by the swarm;
 *   - it lands in §10.1's `you` half, not the `swarm` half.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  baseVelocity,
  buyFounderNode,
  currentEffectiveVelocity,
  currentEntropy,
  founderOf,
  founderPassiveVelocity,
  founderVelocity,
  getPermanent,
  getState,
  pokeFounder,
  pokeVelocity,
  tick,
} from './store.ts'
import { FOUNDER_BASE_RATE, TYPING_STEP, founderCost, FOUNDER_BY_ID } from '../sim/founder.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { SCENE_FOUNDER_BOARD } from './scenes.ts'

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
  localStorage.clear()
})

describe('the curve nothing can touch — §4.5d', () => {
  it('does not fall when the studio collapses', () => {
    // The claim, stated as the harshest case in the game. A thousand developers
    // on a cap of a hundred is §21 Act IV: Entropy near 1, the swarm producing
    // almost nothing. Your desk does not notice.
    __setState({ devs: 2, devCap: 100 })
    const healthy = founderVelocity()
    const healthySwarm = baseVelocity()

    __setState({ devs: 1_000, devCap: 100 })
    expect(currentEntropy()).toBeGreaterThan(0.9)
    expect(baseVelocity()).toBeLessThan(healthySwarm)
    expect(founderVelocity()).toBe(healthy)
  })

  it('does not rise when the studio does', () => {
    __setState({ devs: 2, devCap: 100 })
    const small = founderVelocity()
    __setState({ devs: 76, devCap: 100 })
    expect(baseVelocity()).toBeGreaterThan(1)
    expect(founderVelocity()).toBe(small)
  })

  it('is banked by tick, and it is the only thing moving in a seized studio', () => {
    // §4.5d: "late game, your own hands are a small but reliable contribution in
    // a studio where nothing else is reliable."
    // Cash, or §4.10d's payroll bankrupts a hundred thousand people inside the
    // first frame and `tick` stops early — which would measure the guard rather
    // than the founder.
    __setState({ devs: 100_000, devCap: 100, cash: 1e12 })
    const before = getState().burned.toNumber()
    for (let i = 0; i < 60; i++) tick(1 / 60)
    const banked = getState().burned.toNumber() - before
    // A second of ticks, so a second of your own rate, give or take the swarm's
    // near-zero contribution.
    expect(banked).toBeGreaterThanOrEqual(FOUNDER_BASE_RATE * 0.99)
  })
})

describe('the garage is a clicker — §4.5d, amended 2026-08-30', () => {
  /**
   * Reported as "when there's only us, the story points should not drop
   * without us clicking".
   *
   * The order is the claim, not the numbers (§25.3.2): before the first hire
   * the burn-down moves *only* on a tap, and from the first hire on it moves on
   * its own. §21.7.1's closing announcement — STORY POINTS NOW BURN DOWN
   * AUTOMATICALLY. NO TAPPING REQUIRED. — is the machine reading these two
   * assertions out, so if either one flips the scene starts lying.
   */
  it('banks nothing while the studio is only you', () => {
    __setState({ devs: 0 })
    const before = getState().burned.toNumber()
    for (let i = 0; i < 60; i++) tick(1 / 60)
    expect(getState().burned.toNumber()).toBe(before)
  })

  it('still pays for a tap on your own desk, which is the whole act', () => {
    // §4.5d failure condition 1 inverted: the trickle waits for a colleague,
    // the *tap* never waits for anything.
    __setState({ devs: 0 })
    const before = getState().burned.toNumber()
    expect(pokeFounder()).toBeGreaterThan(0)
    expect(getState().burned.toNumber()).toBeGreaterThan(before)
  })

  it('starts trickling the moment there is somebody else on the floor', () => {
    __setState({ devs: 0 })
    expect(founderPassiveVelocity()).toBe(0)
    __setState({ devs: 1 })
    expect(founderPassiveVelocity()).toBe(founderVelocity())
  })

  it('does not claim a velocity the burn-down is not moving at', () => {
    // §10.1's readout and the bar have to agree, or the player is told they
    // are producing while nothing produces.
    __setState({ devs: 0 })
    expect(currentEffectiveVelocity()).toBe(0)
    expect(pokeVelocity()).toBe(0)
  })
})

describe('§10.1’s split — the you half is finally you', () => {
  it('counts your desk as you, never as the swarm', () => {
    __setState({ devs: 40, devCap: 100 })
    // R11 built this split so the player could tell their own contribution
    // apart. Until §4.5d there was nothing in it but pokes.
    expect(pokeVelocity()).toBeGreaterThanOrEqual(founderVelocity())

    // The swarm half must be untouched by the founder, however good you get.
    const swarmOnly = baseVelocity()
    setPermanent({
      ...getPermanent(),
      meta: { ...getPermanent().meta, founderLevels: { 'M-ENG': 10 } },
    })
    expect(baseVelocity()).toBe(swarmOnly)
    // …and the you half moved by exactly the skill that was bought.
    expect(pokeVelocity()).toBeCloseTo(founderVelocity(), 8)
  })
})

describe('tapping your own desk — §4.5d', () => {
  it('pays without needing a target, a zoom or a mood', () => {
    // `poke` resolves a dev state, a zoom yield and a context switch. None of
    // them is a statement about you, which is why this is its own verb.
    const before = getState().burned.toNumber()
    const paid = pokeFounder()
    expect(paid).toBeGreaterThan(0)
    expect(getState().burned.toNumber() - before).toBeCloseTo(paid, 8)
  })

  it('throws the same Story Point and code-line feedback as a developer', () => {
    const paid = pokeFounder(123, 234)
    const floater = getState().floaters.at(-1)

    expect(floater).toMatchObject({ sp: paid, x: 123, y: 234, crit: false })
    expect(floater?.snippet).toBeTruthy()
  })

  it('is worth more than standing still, or it is an idler and not a clicker', () => {
    // §4.5d failure condition 1.
    expect(pokeFounder()).toBeGreaterThan(founderVelocity())
  })

  it('is inert during a scene and after bankruptcy, like every other tap', () => {
    __setState({ scene: 'anything' })
    expect(pokeFounder()).toBe(0)
    __setState({ scene: null, phase: 'bankrupt' })
    expect(pokeFounder()).toBe(0)
  })

  it('does not earn cash until Founder-Led Sales is bought', () => {
    __setState({ cash: 0 })
    pokeFounder()
    expect(getState().cash).toBe(0)

    setPermanent({
      ...getPermanent(),
      meta: { ...getPermanent().meta, founderLevels: { 'M-SUP': 1 } },
    })
    pokeFounder()
    expect(getState().cash).toBeGreaterThan(0)
  })
})

describe('buying a skill — §13.7.1', () => {
  /**
   * §21.7.7 — the board has been handed over.
   *
   * The tree is an instrument and it arrives with a scene, so a fresh save
   * cannot buy from it at all. That is asserted on its own below; every test in
   * this block is about the *purchase*, so each one starts from a player who
   * has met their own board.
   */
  beforeEach(() => {
    const p = getPermanent()
    setPermanent({
      ...p,
      meta: {
        ...p.meta,
        paradigmShifts: 1,
        milestones: [...p.meta.milestones, SCENE_FOUNDER_BOARD.id],
      },
    })
  })

  /**
   * §21.7.7 — and here is the gate itself, from the other side.
   *
   * A Run 1 founder has a desk, a CODE button and no board. §21.0c is explicit
   * that Run 1 carries one idea, and a personal skill tree bought with the
   * money the trap is about to take is a second one.
   */
  it('refuses everything before the board has been introduced', () => {
    setPermanent(emptyPermanent())
    __setState({ cash: 1e12 })
    expect(buyFounderNode('M-ENG')).toBe(false)
    expect(founderVelocity()).toBe(FOUNDER_BASE_RATE)
  })

  it('refuses what the treasury cannot pay for', () => {
    const typing = FOUNDER_BY_ID.get('M-ENG')!
    __setState({ cash: founderCost(typing, 0) - 1 })
    expect(buyFounderNode('M-ENG')).toBe(false)
    expect(founderVelocity()).toBe(FOUNDER_BASE_RATE)
  })

  it('raises your rate the instant it is bought', () => {
    // Buying a skill and not feeling it until the next run would make the tree a
    // shopping list rather than a decision — the same rule `buyParadigmNode`
    // follows for the developer cap.
    const typing = FOUNDER_BY_ID.get('M-ENG')!
    __setState({ cash: founderCost(typing, 0) })
    expect(buyFounderNode('M-ENG')).toBe(true)
    expect(founderVelocity()).toBeCloseTo(FOUNDER_BASE_RATE + TYPING_STEP, 8)
    expect(getState().cash).toBe(0)
  })

  it('refuses an id that is not in the tree', () => {
    __setState({ cash: 1e12 })
    expect(buyFounderNode('M-NONSENSE')).toBe(false)
  })

  it('puts the level somewhere a Paradigm Shift cannot reach', () => {
    // §4.5d — "it grows only because *you* got better". A skill you learned is
    // not something a rewrite of the company's architecture takes away, so it
    // lives in `meta` rather than `layer1`.
    const typing = FOUNDER_BY_ID.get('M-ENG')!
    __setState({ cash: founderCost(typing, 0) })
    buyFounderNode('M-ENG')
    expect(getPermanent().meta.founderLevels?.['M-ENG']).toBe(1)
    expect(getPermanent().layer1.paradigmLevels['M-ENG']).toBeUndefined()
  })

  it('only works offline once Always On Call is bought', () => {
    expect(founderOf().worksOffline).toBe(false)
    setPermanent({
      ...getPermanent(),
      meta: { ...getPermanent().meta, founderLevels: { 'M-REL': 1 } },
    })
    expect(founderOf().worksOffline).toBe(true)
  })
})
