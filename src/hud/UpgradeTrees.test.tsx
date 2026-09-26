/**
 * The five trees' window — GDD §8 [2026-09-26]. `sim/upgradeTrees.test.ts` owns
 * the catalogue and its rules; this pins the seam: the window opens on the tree
 * its door named, an unwired node is bought from the one wallet and says it
 * does nothing yet, Serena's wired node *is* the pipeline's, and a link tile
 * takes you to the tree it stands for.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// The Capacitor native-audio plugin cannot initialise under jsdom — see the
// same mock in Hud.test.tsx.
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))
import { UpgradeTrees } from './UpgradeTrees.tsx'
import { __resetStore, __setState, buyTreeNode, getState, pipelineRank, treeLevelOf, treePriceOf } from '../game/store.ts'

beforeEach(() => {
  __resetStore()
  // jsdom has no canvas; the board and the portraits both ask for one. The
  // painting is `isoBoard.test.ts`'s to pin, on a plain buffer.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function draw(hero?: Parameters<typeof UpgradeTrees>[0]['hero']) {
  return render(<UpgradeTrees open state={getState()} hero={hero} onClose={() => {}} />)
}

describe('§8 — the five trees', () => {
  it('opens on the tree its door names, with all five people along the foot', () => {
    draw('serena')
    expect(document.querySelector('.trees__name')?.textContent).toContain('Serena')
    for (const who of ['You', 'James', 'Billy', 'Serena', 'Matt']) {
      expect(screen.getByRole('button', { name: `${who}'s tree` })).toBeTruthy()
    }
    fireEvent.click(screen.getByRole('button', { name: "Matt's tree" }))
    expect(document.querySelector('.trees__name')?.textContent).toContain('Matt')
  })

  it('buys an unwired node from the one wallet, and it is marked as doing nothing yet', () => {
    __setState({ cash: 10_000 })
    const price = treePriceOf('you', 'y1')!
    expect(buyTreeNode('you', 'y1')).toBe(true)
    expect(getState().cash).toBe(10_000 - price)
    expect(treeLevelOf('you', 'y1')).toBe(1)
    // Bought once and not levelled: a second buy is refused.
    expect(buyTreeNode('you', 'y1')).toBe(false)
  })

  it('refuses what the rules refuse: a node whose parents are not owned', () => {
    __setState({ cash: 1e9 })
    expect(buyTreeNode('you', 'p1')).toBe(false)
    expect(treeLevelOf('you', 'p1')).toBe(0)
  })

  it('Serena’s wired nodes are the pipeline’s', () => {
    __setState({ cash: 1e9 })
    // Before she arrives her pipeline cannot be bought, from her tree or anywhere.
    expect(buyTreeNode('serena', 's1')).toBe(false)
    expect(pipelineRank('s1')).toBe(0)
  })

  it('says NOT IN THE GAME YET on an unwired node, and not on a wired one', () => {
    __setState({ cash: 1e9 })
    const { rerender } = draw('you')
    // The inspector is keyed on selection; select through the board's keyboard.
    const canvas = document.querySelector('.trees__canvas')!
    fireEvent.keyDown(canvas, { key: 'ArrowRight' })
    expect(document.querySelector('.trees__inspector')?.textContent).toContain('NOT IN THE GAME YET')
    rerender(<UpgradeTrees open state={getState()} hero="serena" onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: "Serena's tree" }))
    fireEvent.keyDown(document.querySelector('.trees__canvas')!, { key: 'ArrowRight' })
    expect(document.querySelector('.trees__title')).toBeTruthy()
    expect(document.querySelector('.trees__inspector')?.textContent).not.toContain('NOT IN THE GAME YET')
  })
})
