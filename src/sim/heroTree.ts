/**
 * The shared hero tree — GDD §13.9, §13.13, R36, R37, R52, R64.
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
 * ## Three build decisions, recorded so they are not made twice
 *
 * **Right angles, including the two southern branches.** §11.4.1 forbids
 * diagonals and the first cut of this board put Cloud on `(1,1) (2,2) (3,3)`,
 * which is a diagonal wearing grid coordinates. Support and Cloud now hang off a
 * short southern stem and run parallel — the connector is an *elbow*, two
 * axis-aligned segments, which is what "right angles only" means for a node that
 * is not on your axis. {@link connectorPath} is where that lives.
 *
 * **A chain alternates DEPTH and REACH, and there is no purchasable TRAIT.**
 * §13.6.4's third node kind is priced in GP (§13.6.5a), and GP is Layer 2, so a
 * TRAIT node on this board would be permanently unbuyable — the exact "tray onto
 * an empty board" mistake §13.6.7a declined to make. Each of the six *arrives*
 * with their signature trait instead: it is who they are (§13.9.1), it is on the
 * card (§22.9.2), and it is the one thing about a hero that cannot be ground.
 *
 * **James has no home branch, and that is his class.** Everyone else is worth
 * full value in their own branch and {@link OFF_BRANCH} elsewhere — §13.9.1's
 * "she will be worse at it than Melany" as arithmetic. James is worth
 * {@link JACK_WEIGHT} *everywhere*, which is the same as everybody else's
 * off-branch rate: never penalised for going anywhere, never the best at
 * anything, exactly §13.6.3's "small at every rung and never scales". The joke
 * is now a number.
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
  /** §13.11.1 — the colour coverage, the desk plate and the card band all share. */
  colour: string
}

export const BRANCH_DEFS: readonly BranchDef[] = [
  { branch: 'engineering', name: 'Engineering', hero: 'James', bends: '§4.1 velocity, weakly, everywhere', colour: '#d8d8c0' },
  { branch: 'quality', name: 'Quality', hero: 'Mo', bends: '§4.12 defect arrival rate', colour: '#e0a03c' },
  { branch: 'reliability', name: 'Reliability', hero: 'Serena', bends: '§4.12a incident arrival rate', colour: '#d05050' },
  { branch: 'cloud', name: 'Cloud', hero: 'Melany', bends: '§4.2 developer cap — and the bill', colour: '#58b0d0' },
  { branch: 'support', name: 'Support', hero: 'Matt', bends: '§4.13 ticket capacity, and incident clearance', colour: '#78c078' },
  { branch: 'cohesion', name: 'Cohesion', hero: 'Billy', bends: '§4.1 Entropy directly', colour: '#b088d0' },
]

export const BRANCH_BY_ID = new Map(BRANCH_DEFS.map((d) => [d.branch, d]))

/** The branch colour, or the trunk's, for an unknown id. */
export function branchColour(branch: HeroBranch): string {
  return BRANCH_BY_ID.get(branch)?.colour ?? '#d8d8c0'
}

/**
 * §13.6.4's node kinds, minus the one that cannot be bought yet.
 *
 * `trunk` is the centre — owned by everybody, free, and the anchor the reveal
 * grows out of. It is not a purchase and it is not a kind of upgrade.
 */
export type HeroNodeKind = 'trunk' | 'depth' | 'reach'

/** §13.13 — what one node costs in points. REACH is always the dearest available. */
export const DEPTH_POINTS = 1
export const REACH_POINTS = 3

export function nodePoints(kind: HeroNodeKind): number {
  return kind === 'reach' ? REACH_POINTS : kind === 'depth' ? DEPTH_POINTS : 0
}

/** One node on the shared board. */
export interface HeroTreeNode {
  /** Stable id — `${branch}:${depth}`. Never renumber one. */
  id: string
  branch: HeroBranch
  /** 0 is the trunk; 1..{@link CHAIN_LENGTH} is how far out along the branch. */
  depth: number
  kind: HeroNodeKind
  /** Board grid cell, centre at (0,0). */
  x: number
  y: number
  /** The node's own text — what owning it does. */
  effect: string
}

/**
 * How long a branch runs — §11.4.1's "a level is a node", applied here.
 *
 * Six rather than §13.9's diagram's three, for one reason: a story hire arrives
 * {@link STORY_STARTING_DEPTH} deep, and a three-node chain would mean every
 * hero arrives with their own branch **finished**. §13.9.1 wants the arrival to
 * be "the beginning of an argument, not the end of one", and a completed branch
 * is the end of one.
 */
export const CHAIN_LENGTH = 6

/**
 * The kind of each rung of a chain, in order.
 *
 * The first three are DEPTH so a story hire's pre-bought position (§13.9.1) is
 * depth in their speciality and **reach zero** — a row, eight people. That is
 * deliberate: a hero who arrived covering a floor would cover the whole of a
 * Run 2 studio, and §13.8's placement puzzle would be solved before the player
 * had seen it. The first REACH node is the visible goal instead.
 */
const CHAIN_KINDS: readonly HeroNodeKind[] = ['depth', 'depth', 'depth', 'reach', 'depth', 'reach']

/** Where each branch's chain runs, in board cells, from the cell nearest the centre. */
const CHAIN_PATHS: Record<Exclude<HeroBranch, 'engineering'>, ReadonlyArray<readonly [number, number]>> = {
  // North.
  quality: [[0, -1], [0, -2], [0, -3], [0, -4], [0, -5], [0, -6]],
  // East.
  reliability: [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]],
  // West.
  cohesion: [[-1, 0], [-2, 0], [-3, 0], [-4, 0], [-5, 0], [-6, 0]],
  // South-west, off the southern stem — see {@link connectorPath}.
  support: [[-2, 2], [-2, 3], [-2, 4], [-2, 5], [-2, 6], [-2, 7]],
  // South-east, the same.
  cloud: [[2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7]],
}

const CHAIN_EFFECT: Record<Exclude<HeroBranch, 'engineering'>, string> = {
  quality: 'Defects arrive slower',
  reliability: 'Incidents arrive slower',
  cohesion: 'Entropy stays down',
  support: 'More tickets answered, incidents cleared faster',
  cloud: 'Raises the developer cap',
}

function branchChain(branch: Exclude<HeroBranch, 'engineering'>): HeroTreeNode[] {
  return CHAIN_PATHS[branch].map(([x, y], i) => ({
    id: `${branch}:${i + 1}`,
    branch,
    depth: i + 1,
    kind: CHAIN_KINDS[i] ?? 'depth',
    x,
    y,
    effect: CHAIN_KINDS[i] === 'reach' ? 'Reaches one rung further up §7.7’s ladder' : CHAIN_EFFECT[branch],
  }))
}

/** §13.9's board. The trunk at the centre, five branches on compass headings. */
export const HERO_TREE: readonly HeroTreeNode[] = [
  { id: 'engineering:0', branch: 'engineering', depth: 0, kind: 'trunk', x: 0, y: 0, effect: 'What everybody did, before they specialised' },
  ...branchChain('quality'),
  ...branchChain('reliability'),
  ...branchChain('cohesion'),
  ...branchChain('support'),
  ...branchChain('cloud'),
]

export const HERO_NODE_BY_ID = new Map(HERO_TREE.map((n) => [n.id, n]))

/** The trunk — owned by every hero, free, and the anchor of the reveal. */
export const TRUNK_NODE = 'engineering:0'

/**
 * The node this one hangs off. The first of a chain hangs off the trunk.
 *
 * Mirrors `techBoard.boardParent` deliberately: §11.4.1's "one board grammar,
 * learned once, used in two places" is only true if both boards answer the same
 * questions the same way.
 */
export function heroBoardParent(id: string): string | null {
  const node = HERO_NODE_BY_ID.get(id)
  if (!node || node.depth === 0) return null
  return node.depth === 1 ? TRUNK_NODE : `${node.branch}:${node.depth - 1}`
}

/** A polyline in board cells — one point per corner, two segments at most. */
export type BoardPath = ReadonlyArray<{ x: number; y: number }>

/**
 * §11.4.1 — **right angles only**, including for a node that is not on the
 * parent's axis.
 *
 * A straight run when the two share a row or column; an **elbow** otherwise,
 * turning once. Support and Cloud both leave the trunk southward and then step
 * aside, so their first connectors share the `(0,0) → (0,2)` stem and the board
 * reads as a trunk that forks — which is what a tree does, and what §13.9's own
 * diagram was drawing when it reached for diagonals.
 */
export function connectorPath(id: string): BoardPath {
  const node = HERO_NODE_BY_ID.get(id)
  const parentId = heroBoardParent(id)
  const parent = parentId ? HERO_NODE_BY_ID.get(parentId) : null
  if (!node || !parent) return []
  if (parent.x === node.x || parent.y === node.y) {
    return [{ x: parent.x, y: parent.y }, { x: node.x, y: node.y }]
  }
  // Vertical first, then across: the corner sits on the parent's column, which
  // is what makes the two southern branches share a stem rather than cross.
  return [
    { x: parent.x, y: parent.y },
    { x: parent.x, y: node.y },
    { x: node.x, y: node.y },
  ]
}

/** Every connector on the board, parent-first. §11.4.2 — a dark node still shows one. */
export function heroConnectors(): BoardPath[] {
  return HERO_TREE.filter((n) => n.depth > 0).map((n) => connectorPath(n.id))
}

/** The board's grid extent, in cells, for sizing the pannable world. */
export function heroBoardBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = 0
  let maxX = 0
  let minY = 0
  let maxY = 0
  for (const node of HERO_TREE) {
    minX = Math.min(minX, node.x)
    maxX = Math.max(maxX, node.x)
    minY = Math.min(minY, node.y)
    maxY = Math.max(maxY, node.y)
  }
  return { minX, maxX, minY, maxY }
}

/**
 * §13.9.1 — **a story hire arrives already good at their job.**
 *
 * Three nodes deep into their own branch and nothing else. It states the
 * character mechanically before a line of dialogue does, teaches the tree by
 * example, and is the *beginning* of an argument rather than the end — nothing
 * stops Mo going down Cloud, she is merely worse at it than Melany.
 */
export const STORY_STARTING_DEPTH = 3

/**
 * The node ids a hero of this branch arrives with, pre-bought and unpaid for.
 *
 * The trunk is always in it. Every hero owns the centre because Engineering is
 * what everybody did before they specialised — and because a chain whose first
 * node hangs off an unowned parent is a board that cannot explain itself.
 * §13.9.1's "neither has spent a point at the centre" is preserved exactly:
 * nobody *spends* there, they simply start there.
 */
export function startingNodes(branch: HeroBranch): string[] {
  // §22.8 — James is the trunk's hero and the only one who starts *only* at the
  // centre. Being good at nothing in particular is the whole class.
  if (branch === 'engineering') return [TRUNK_NODE]
  return [
    TRUNK_NODE,
    ...HERO_TREE.filter((n) => n.branch === branch && n.depth > 0)
      .slice(0, STORY_STARTING_DEPTH)
      .map((n) => n.id),
  ]
}

// --- what a branch does to the studio --------------------------------------

/** The fields a branch can bend. Each is a multiplier (or an additive heads term). */
export type BranchField = 'yield' | 'entropy' | 'cap' | 'defects' | 'incidents' | 'support' | 'clearance'

/**
 * §22.8's branch effects, as the studio fold reads them.
 *
 * Every magnitude here is a **first pass** (§25.6.3 refuses to decide the
 * numbers). What is pinned is the *direction*: quality reduces defects,
 * reliability reduces incidents, cloud raises the cap, support adds heads to
 * both ends of the incident pipe, cohesion reduces entropy. `perNode` is the
 * multiplier (or heads) one fully-placed DEPTH node of that branch contributes.
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

/**
 * §13.9.1 — what a node is worth to *this* hero.
 *
 * Full value in their own branch, {@link OFF_BRANCH} outside it: "nothing stops
 * Mo going down Cloud. She will be worse at it than Melany." A player who does
 * it anyway has made a real decision about a specific person, which is the
 * sentence this function exists to make true.
 *
 * **James is the exception and it is his entire class.** He has no home branch
 * — the trunk is not a speciality — so a rule that charged him the off-branch
 * rate everywhere would make the jack of all trades strictly the worst hero in
 * the game. He is worth {@link JACK_WEIGHT} in every direction instead: never
 * penalised for going anywhere, never better than a specialist at home, and
 * never scaling. §13.6.3's joke, as arithmetic.
 */
export const OFF_BRANCH = 0.5
export const JACK_WEIGHT = 0.5

export function nodeWeight(heroBranch: HeroBranch, nodeBranch: HeroBranch): number {
  if (heroBranch === 'engineering') return JACK_WEIGHT
  return nodeBranch === heroBranch ? 1 : OFF_BRANCH
}
