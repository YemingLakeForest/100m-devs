/**
 * The shared hero tree — GDD §13.9, R36, R37.
 *
 * §13.7 gave each class its own tree ("one grammar, five vocabularies") and the
 * cost of that became obvious the moment the story roster arrived: five trees is
 * five things to balance, five things to learn and five screens. **There is one
 * tree.** Every hero opens the same board, and what differs is where they
 * already are on it (§13.9.1): a story hire arrives three nodes deep into their
 * own branch and nowhere else.
 *
 * The board is centre-out, exactly like §11.4's tech board, and it reuses that
 * grammar on purpose — one board grammar, learned once, used in two places. The
 * engineering trunk sits at the centre (§13.9: "what everybody does, before they
 * specialised") and the five specialities radiate on compass headings.
 *
 * Everything here is pure data plus the two things a hero asks of it: their
 * starting position, and what a branch *does* in the studio fold.
 */

/** §13.9's six branches. The centre is Engineering; the rest are compass headings. */
export type HeroBranch =
  | 'engineering'
  | 'quality'
  | 'reliability'
  | 'cloud'
  | 'support'
  | 'cohesion'

export const BRANCHES: readonly HeroBranch[] = [
  'engineering',
  'quality',
  'reliability',
  'cloud',
  'support',
  'cohesion',
]

/** §22.8 — one sentence of who each branch is for, and the hero who owns it. */
export interface BranchDef {
  branch: HeroBranch
  name: string
  hero: string
  /** §22.8's "bends" column — the system the branch touches. */
  bends: string
}

export const BRANCH_DEFS: readonly BranchDef[] = [
  { branch: 'engineering', name: 'Engineering', hero: 'James', bends: '§4.1 velocity, weakly, everywhere' },
  { branch: 'quality', name: 'Quality', hero: 'Mo', bends: '§4.12 defect arrival rate' },
  { branch: 'reliability', name: 'Reliability', hero: 'Serena', bends: '§4.12a incident arrival rate' },
  { branch: 'cloud', name: 'Cloud', hero: 'Melany', bends: '§4.2 developer cap — and the bill' },
  { branch: 'support', name: 'Support', hero: 'Matt', bends: '§4.13 ticket capacity, and incident clearance' },
  { branch: 'cohesion', name: 'Cohesion', hero: 'Billy', bends: '§4.1 Entropy directly' },
]

export const BRANCH_BY_ID = new Map(BRANCH_DEFS.map((d) => [d.branch, d]))

/** One node on the shared board. */
export interface HeroTreeNode {
  /** Stable id — `${branch}:${depth}`. Never renumber one. */
  id: string
  branch: HeroBranch
  /** 0 is the trunk; 1..3 is how far out along the branch. */
  depth: number
  /** Board grid cell, centre at (0,0). */
  x: number
  y: number
  /** §13.10 — the XP price of the *next* purchase is derived, not stored; this is the node's own text. */
  effect: string
}

function branchChain(branch: HeroBranch, points: ReadonlyArray<readonly [number, number]>, effect: string): HeroTreeNode[] {
  return points.map(([x, y], i) => ({ id: `${branch}:${i + 1}`, branch, depth: i + 1, x, y, effect }))
}

/**
 * §13.9's board. The trunk at the centre, five branches on compass headings,
 * three nodes each. The three-node chain is §13.9's own diagram (`o--o--o`).
 */
export const HERO_TREE: readonly HeroTreeNode[] = [
  { id: 'engineering:0', branch: 'engineering', depth: 0, x: 0, y: 0, effect: 'Velocity, weakly, everywhere' },
  ...branchChain('quality', [[0, -1], [0, -2], [0, -3]], 'Defects arrive slower'),
  ...branchChain('reliability', [[1, 0], [2, 0], [3, 0]], 'Incidents arrive slower'),
  ...branchChain('cloud', [[1, 1], [2, 2], [3, 3]], 'Raises the developer cap'),
  ...branchChain('support', [[-1, 1], [-2, 2], [-3, 3]], 'More tickets answered, incidents cleared faster'),
  ...branchChain('cohesion', [[-1, 0], [-2, 0], [-3, 0]], 'Entropy stays down'),
]

export const HERO_NODE_BY_ID = new Map(HERO_TREE.map((n) => [n.id, n]))

/**
 * §13.9.1 — **a story hire arrives already good at their job.**
 *
 * Three nodes deep into their own branch and nothing else. It states the
 * character mechanically before a line of dialogue does, teaches the tree by
 * example, and is the *beginning* of an argument rather than the end — nothing
 * stops Mo going down Cloud, she is merely worse at it than Melany.
 */
export const STORY_STARTING_DEPTH = 3

/** The node ids a hero of this branch arrives with pre-bought. */
export function startingNodes(branch: HeroBranch): string[] {
  // §22.8 — James is the trunk's hero and the only one who starts *at* the
  // centre, so his pre-bought position is the trunk itself, not a chain.
  if (branch === 'engineering') return ['engineering:0']
  return HERO_TREE.filter((n) => n.branch === branch && n.depth > 0)
    .slice(0, STORY_STARTING_DEPTH)
    .map((n) => n.id)
}

// --- what a branch does to the studio --------------------------------------

/** The five fields a branch can bend. Each is a multiplier (or an additive heads term). */
export type BranchField = 'yield' | 'entropy' | 'cap' | 'defects' | 'incidents' | 'support' | 'clearance'

/**
 * §22.8's branch effects, as the studio fold reads them.
 *
 * Every magnitude here is a **first pass** (§25.6.3 refuses to decide the
 * numbers). What is pinned is the *direction*: quality reduces defects,
 * reliability reduces incidents, cloud raises the cap, support adds heads to
 * both ends of the incident pipe, cohesion reduces entropy. `perNode` is the
 * multiplier (or heads) one fully-placed node of that branch contributes.
 */
export interface BranchFold {
  field: BranchField
  /** Multiplier applied by one node (below 1 for the "slower" branches). */
  perNode: number
}

const BRANCH_FOLD: Record<HeroBranch, BranchFold> = {
  engineering: { field: 'yield', perNode: 0.03 },
  quality: { field: 'defects', perNode: 0.85 },
  reliability: { field: 'incidents', perNode: 0.85 },
  cloud: { field: 'cap', perNode: 0.15 },
  support: { field: 'support', perNode: 1 },
  cohesion: { field: 'entropy', perNode: 0.9 },
}

export function branchFold(branch: HeroBranch): BranchFold {
  return BRANCH_FOLD[branch]
}
