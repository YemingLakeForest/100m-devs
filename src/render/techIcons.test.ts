import { describe, expect, it } from 'vitest'
import { TECH_BY_ID, TECH_TREE } from '../sim/techTree.ts'
import { TECH_ICON_IDS, techIcon } from './techIcons.ts'

describe('§11.4.4 — every node has a procedural icon', () => {
  it('covers every node in the tree', () => {
    for (const node of TECH_TREE) {
      expect(TECH_ICON_IDS.has(node.id)).toBe(true)
    }
  })

  it('draws a 16x16 grid, and none of them is blank', () => {
    for (const node of TECH_TREE) {
      const grid = techIcon(node.id)
      expect(grid).not.toBeNull()
      expect(grid).toHaveLength(16)
      let filled = 0
      for (const row of grid!) {
        expect(row).toHaveLength(16)
        for (const cell of row) if (cell === '#') filled++
      }
      expect(filled).toBeGreaterThan(0)
    }
  })

  it('draws the centre node distinctly — a speech bubble, not a category', () => {
    // §11.4.4: the icon is a picture of the *thing*, not its category. IM is a
    // speech bubble with a bolt through it; its grid is its own shape.
    const im = techIcon('B1')!
    expect(im).not.toEqual(techIcon('B2'))
    expect(TECH_BY_ID.get('B1')!.name).toBe('Instant Messenger')
  })
})
