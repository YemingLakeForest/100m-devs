import { describe, expect, it } from 'vitest'
import {
  BRANCHES,
  BRANCH_DEFS,
  HERO_NODE_BY_ID,
  HERO_TREE,
  STORY_STARTING_DEPTH,
  branchFold,
  startingNodes,
} from './heroTree.ts'

describe('§13.9 — one tree, five branches, engineering at the centre', () => {
  it('has six branches and one hero per branch — §22.8', () => {
    expect(BRANCHES).toHaveLength(6)
    expect(new Set(BRANCH_DEFS.map((d) => d.hero)).size).toBe(6)
  })

  it('puts the trunk at the origin and each branch on its own heading', () => {
    const trunk = HERO_NODE_BY_ID.get('engineering:0')!
    expect(trunk.x).toBe(0)
    expect(trunk.y).toBe(0)
    // No two branch nodes share a grid cell — the board must not self-intersect.
    const cells = new Set(HERO_TREE.map((n) => `${n.x},${n.y}`))
    expect(cells.size).toBe(HERO_TREE.length)
  })

  it('chains each speciality three nodes deep, like §13.9’s diagram', () => {
    // Engineering is the trunk, not a chain — §22.8 says James is the only hero
    // who starts *at* the centre.
    for (const branch of BRANCHES.filter((b) => b !== 'engineering')) {
      const chain = HERO_TREE.filter((n) => n.branch === branch && n.depth > 0)
      expect(chain).toHaveLength(STORY_STARTING_DEPTH)
    }
  })

  it('gives every node a stable, parseable id', () => {
    for (const node of HERO_TREE) {
      expect(node.id).toMatch(/^[a-z]+:\d+$/)
      expect(HERO_NODE_BY_ID.get(node.id)).toBe(node)
    }
  })
})

describe('§13.9.1 — a story hire arrives already good at their job', () => {
  it('pre-buys nodes in their own branch and nowhere else', () => {
    for (const branch of BRANCHES) {
      const nodes = startingNodes(branch)
      if (branch === 'engineering') {
        // James starts at the centre — the trunk node, nothing else.
        expect(nodes).toEqual(['engineering:0'])
        continue
      }
      expect(nodes).toHaveLength(STORY_STARTING_DEPTH)
      for (const id of nodes) {
        expect(HERO_NODE_BY_ID.get(id)!.branch).toBe(branch)
      }
    }
  })

  it('gives Mo Quality, Serena Reliability, and so on — §22.8', () => {
    const heroBranch: Record<string, string> = {}
    for (const def of BRANCH_DEFS) heroBranch[def.hero] = def.branch
    expect(heroBranch['Mo']).toBe('quality')
    expect(heroBranch['Serena']).toBe('reliability')
    expect(heroBranch['Matt']).toBe('support')
    expect(heroBranch['Melany']).toBe('cloud')
    expect(heroBranch['Billy']).toBe('cohesion')
    expect(heroBranch['James']).toBe('engineering')
  })
})

describe('§22.8 — what each branch bends', () => {
  it('reduces the arrival-rate branches and raises the cap branch', () => {
    // Quality and Reliability slow arrival; Cloud raises the cap; Support adds
    // heads; Cohesion reduces entropy. The *direction* is canon, the number is
    // a first pass.
    expect(branchFold('quality').perNode).toBeLessThan(1)
    expect(branchFold('reliability').perNode).toBeLessThan(1)
    expect(branchFold('cohesion').perNode).toBeLessThan(1)
    expect(branchFold('cloud').perNode).toBeGreaterThan(0)
    expect(branchFold('support').perNode).toBeGreaterThan(0)
  })

  it('gives each branch its own field to bend', () => {
    expect(branchFold('quality').field).toBe('defects')
    expect(branchFold('reliability').field).toBe('incidents')
    expect(branchFold('support').field).toBe('support')
    expect(branchFold('cloud').field).toBe('cap')
    expect(branchFold('cohesion').field).toBe('entropy')
    expect(branchFold('engineering').field).toBe('yield')
  })
})
