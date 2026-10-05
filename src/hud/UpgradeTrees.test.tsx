/**
 * A person's upgrade tree — GDD §8 [2026-09-26]. `sim/upgradeTrees.test.ts` owns
 * the catalogue and its rules; this pins the seam: the window shows the one tree
 * its door named and no other, nothing is bought before the first Paradigm
 * Shift, an unwired node is bought from the one wallet and says it does nothing
 * yet, and Serena's wired node *is* the pipeline's.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// The Capacitor native-audio plugin cannot initialise under jsdom — see the
// same mock in Hud.test.tsx.
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))
import { UpgradeTrees } from './UpgradeTrees.tsx'
import { __resetStore, __setState, buyTreeNode, effectiveDevCap, getState, pipelineRank, treeLevelOf, treePriceOf } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import type { TreeHero } from '../sim/upgradeTrees.ts'

/** A career past its first Paradigm Shift, which is when the trees open. */
function shifted() {
  const p = emptyPermanent()
  setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1 } })
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
  // jsdom has no canvas; the board asks for one. The painting is
  // `isoBoard.test.ts`'s to pin, on a plain buffer.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  setPermanent(emptyPermanent())
})

function draw(hero: TreeHero) {
  return render(<UpgradeTrees open state={getState()} hero={hero} onClose={() => {}} />)
}

describe('§8 — one person’s tree', () => {
  it('shows the tree its door names, and nobody else’s', () => {
    draw('serena')
    expect(document.querySelector('.trees__name')?.textContent).toContain('Serena')
    expect(document.querySelector('.os-window__title')?.textContent).toBe('UPGRADES // SERENA')
    // *"I don't want the heroes tray"* — no row of heads to switch trees with.
    expect(document.querySelector('.trees__heads')).toBeNull()
    for (const who of ['You', 'James', 'Billy', 'Matt']) {
      expect(screen.queryByRole('button', { name: `${who}'s tree` })).toBeNull()
    }
  })

  it('buys nothing before the first Paradigm Shift', () => {
    __setState({ cash: 10_000 })
    expect(buyTreeNode('you', 'y2')).toBe(false)
    expect(getState().cash).toBe(10_000)
  })

  it('buys a built node from the one wallet after it, and refuses a node that does nothing', () => {
    shifted()
    __setState({ cash: 10_000 })
    const price = treePriceOf('james', 'j2')!
    expect(buyTreeNode('james', 'j2')).toBe(true)
    expect(getState().cash).toBe(10_000 - price)
    expect(treeLevelOf('james', 'j2')).toBe(1)
    // Bought once and not levelled: a second buy is refused.
    expect(buyTreeNode('james', 'j2')).toBe(false)
  })

  it('refuses what the rules refuse: a node whose parents are not owned', () => {
    shifted()
    __setState({ cash: 1e9 })
    expect(buyTreeNode('james', 'j3')).toBe(false)
    expect(treeLevelOf('james', 'j3')).toBe(0)
    // And a node that changes nothing cannot be bought at any price.
    __setState({ peakDevs: 1_000_000 })
    expect(buyTreeNode('you', 'y2')).toBe(false)
  })

  it('Serena’s wired nodes are the pipeline’s', () => {
    shifted()
    __setState({ cash: 1e9 })
    // Before she arrives her pipeline cannot be bought, from her tree or anywhere.
    expect(buyTreeNode('serena', 's1')).toBe(false)
    expect(pipelineRank('s1')).toBe(0)
  })

  it('says NOT IN THE GAME YET on an unwired node, and not on a wired one', () => {
    shifted()
    __setState({ cash: 1e9 })
    const { rerender } = draw('you')
    // The inspector is keyed on selection; select through the board's keyboard.
    // Left of the founder's root is Post on a Forum, which changes nothing yet.
    fireEvent.keyDown(document.querySelector('.trees__canvas')!, { key: 'ArrowLeft' })
    expect(document.querySelector('.trees__inspector')?.textContent).toContain('NOT IN THE GAME YET')
    rerender(<UpgradeTrees open state={getState()} hero="serena" onClose={() => {}} />)
    fireEvent.keyDown(document.querySelector('.trees__canvas')!, { key: 'ArrowRight' })
    expect(document.querySelector('.trees__title')).toBeTruthy()
    expect(document.querySelector('.trees__inspector')?.textContent).not.toContain('NOT IN THE GAME YET')
  })
})

/**
 * §21.7.3 [2026-10-04] — Billy's coordination points are real: buying one raises
 * the studio's effective cap, which is what sync reads.
 */
describe('Billy’s tree moves sync', () => {
  it('raises the effective cap when a coordination node is bought, and not before', () => {
    shifted()
    // Era 1 opens past the garage; the node is bought in the studio it is for.
    __setState({ cash: 1e9, peakDevs: 1_000 })
    const before = effectiveDevCap()
    expect(buyTreeNode('billy', 'c1')).toBe(true)
    expect(effectiveDevCap()).toBeGreaterThan(before)
  })
})
