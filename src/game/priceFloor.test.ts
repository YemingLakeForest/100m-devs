/**
 * The income floor under every one-off node — GDD §2.7, amended 2026-10-28.
 *
 * The claim is that a price holds still while income wobbles: the floor reads
 * the best rate the run has reached, so a tail decaying (live rate down) cannot
 * make anything cheaper, and only a new best makes it dearer.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetStore, __setState, catalogueRate, pipelinePriceFloor, PRICE_FLOOR_SECONDS } from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('the price floor holds still', () => {
  it('does not fall when the live income is below the best the run has seen', () => {
    __setState({ peakDevs: 5_000, incomeHigh: 40 })
    expect(catalogueRate()).toBe(0)
    expect(pipelinePriceFloor()).toBe(PRICE_FLOOR_SECONDS * 40)
  })

  it('rises when the studio earns a new best', () => {
    __setState({ peakDevs: 5_000, incomeHigh: 40 })
    const before = pipelinePriceFloor()
    __setState({ incomeHigh: 80 })
    expect(pipelinePriceFloor()).toBeGreaterThan(before)
  })

  it('is zero in the garage, whose prices were set by hand', () => {
    __setState({ peakDevs: 3, incomeHigh: 40 })
    expect(pipelinePriceFloor()).toBe(0)
  })
})
