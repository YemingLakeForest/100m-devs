import { describe, expect, it } from 'vitest'
import {
  BRANCHES,
  BRANCH_DEFS,
  CHAIN_LENGTH,
  HERO_NODE_BY_ID,
  HERO_TREE,
  JACK_WEIGHT,
  OFF_BRANCH,
  STORY_STARTING_DEPTH,
  TRUNK_NODE,
  branchFold,
  connectorPath,
  heroBoardParent,
  nodePoints,
  nodeWeight,
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

  it('chains each speciality out past where a story hire starts', () => {
    // Engineering is the trunk, not a chain — §22.8 says James is the only hero
    // who starts *at* the centre. Every other branch runs further than
    // STORY_STARTING_DEPTH, because §13.9.1 wants an arrival to be "the
    // beginning of an argument, not the end of one" and a finished branch is
    // the end of one.
    for (const branch of BRANCHES.filter((b) => b !== 'engineering')) {
      const chain = HERO_TREE.filter((n) => n.branch === branch && n.depth > 0)
      expect(chain).toHaveLength(CHAIN_LENGTH)
      expect(CHAIN_LENGTH).toBeGreaterThan(STORY_STARTING_DEPTH)
    }
  })

  it('is right angles only — §11.4.1, including for the southern branches', () => {
    // Every connector is one or two axis-aligned segments. A diagonal anywhere
    // is the defect this test exists to catch: the first cut of this board put
    // Cloud on (1,1) (2,2) (3,3), which is a diagonal wearing grid coordinates.
    for (const node of HERO_TREE.filter((n) => n.depth > 0)) {
      const path = connectorPath(node.id)
      expect(path.length).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]
        const b = path[i]
        expect(a.x === b.x || a.y === b.y).toBe(true)
      }
      // And it starts at the parent and ends at the node.
      const parent = HERO_NODE_BY_ID.get(heroBoardParent(node.id)!)!
      expect(path[0]).toEqual({ x: parent.x, y: parent.y })
      expect(path[path.length - 1]).toEqual({ x: node.x, y: node.y })
    }
  })

  it('hangs the first node of every branch off the trunk', () => {
    for (const branch of BRANCHES.filter((b) => b !== 'engineering')) {
      expect(heroBoardParent(`${branch}:1`)).toBe(TRUNK_NODE)
      expect(heroBoardParent(`${branch}:2`)).toBe(`${branch}:1`)
    }
    expect(heroBoardParent(TRUNK_NODE)).toBeNull()
  })

  it('prices REACH above DEPTH, so §13.6.4’s invariant holds on points', () => {
    expect(nodePoints('reach')).toBeGreaterThan(nodePoints('depth'))
    expect(nodePoints('trunk')).toBe(0)
  })

  it('starts every chain with DEPTH, so a story hire arrives at reach zero', () => {
    // §13.9.1 pre-buys three. If any of the first three were REACH, every hero
    // would arrive covering a floor — the whole of a Run 2 studio — and §13.8's
    // placement puzzle would be solved before the player had seen it.
    for (const branch of BRANCHES.filter((b) => b !== 'engineering')) {
      for (let d = 1; d <= STORY_STARTING_DEPTH; d++) {
        expect(HERO_NODE_BY_ID.get(`${branch}:${d}`)!.kind).toBe('depth')
      }
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
      // Everybody owns the centre: Engineering is what everybody did before
      // they specialised, and a chain whose first node hangs off an unowned
      // parent is a board that cannot explain itself. Nobody *spends* there,
      // which is what §13.9.1 actually says.
      expect(nodes).toContain(TRUNK_NODE)
      if (branch === 'engineering') {
        // James starts at the centre and nowhere else.
        expect(nodes).toEqual([TRUNK_NODE])
        continue
      }
      expect(nodes).toHaveLength(STORY_STARTING_DEPTH + 1)
      for (const id of nodes.filter((n) => n !== TRUNK_NODE)) {
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

describe('§13.9.1 — a hero is a starting position, not a role', () => {
  it('is worth less outside your own branch, and never refuses the purchase', () => {
    // "Nothing stops Mo going down Cloud. She will be worse at it than Melany."
    expect(nodeWeight('quality', 'quality')).toBe(1)
    expect(nodeWeight('quality', 'cloud')).toBe(OFF_BRANCH)
    expect(OFF_BRANCH).toBeLessThan(1)
  })

  it('makes James the jack of all trades — full value in every direction', () => {
    // §13.9.1 amended. He has no speciality, so he pays no handicap: the 0.5 is
    // what a *speciality* costs, and James has not bought one. Charging him the
    // off-branch rate everywhere made him strictly dominated by all five
    // specialists at every node on the board, which is not a class.
    for (const branch of BRANCHES) {
      expect(nodeWeight('engineering', branch)).toBe(JACK_WEIGHT)
    }
    expect(JACK_WEIGHT).toBe(1)
    // Equal to a specialist at home, and better than one away from it — which
    // is the whole of the amendment, in two comparisons.
    expect(nodeWeight('engineering', 'quality')).toBe(nodeWeight('quality', 'quality'))
    expect(nodeWeight('engineering', 'cloud')).toBeGreaterThan(nodeWeight('quality', 'cloud'))
  })

  it('leaves the specialists paying for their focus', () => {
    // The handicap did not go away; it moved to the people it is about. James
    // being unpenalised must not read as "the board has no off-branch rate".
    expect(OFF_BRANCH).toBeLessThan(1)
    for (const hero of BRANCHES.filter((b) => b !== 'engineering')) {
      for (const node of BRANCHES.filter((b) => b !== hero)) {
        expect(nodeWeight(hero, node)).toBe(OFF_BRANCH)
      }
    }
  })
})
