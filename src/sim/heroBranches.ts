/**
 * The four hero branches — GDD §22.8 [amended 2026-10-04: Quality and Cloud went with Mo and Melany].
 *
 * What is left of §13.9's shared hero board [amended 2026-09-26]. The board —
 * one centre-out tree every hero opened, bought with XP earned only while the
 * hero was posted onto the floor — was retired with placement, at the user's
 * instruction (*"Some mechanics in the old game I want remove, hero placement,
 * different types of hires"*). XP under coverage was its only currency, so a
 * board with no placement was a board nobody could ever buy from. Each hero's
 * upgrades are their own tree now (`upgradeTrees.ts`, GDD §8).
 *
 * The branches survive because they are the heroes' *colours* and specialities:
 * the card band, the desk plate and the room's lamps all read them here.
 */

/** §13.9's branches, now four. The centre is Engineering; the rest are compass headings. */
export type HeroBranch =
  | 'engineering'
  | 'reliability'
  | 'support'
  | 'cohesion'

export const BRANCHES: readonly HeroBranch[] = [
  'engineering',
  'reliability',
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
  { branch: 'reliability', name: 'Reliability', hero: 'Serena', bends: '§10.7 the build queue, and §4.12 the defects it catches', colour: '#d05050' },
  { branch: 'support', name: 'Support', hero: 'Matt', bends: '§4.13 ticket capacity, and §4.12a incident clearance', colour: '#78c078' },
  { branch: 'cohesion', name: 'Cohesion', hero: 'Billy', bends: '§4.1 Entropy directly', colour: '#b088d0' },
]

export const BRANCH_BY_ID = new Map(BRANCH_DEFS.map((d) => [d.branch, d]))

/** The branch colour, or the trunk's, for an unknown id. */
export function branchColour(branch: HeroBranch): string {
  return BRANCH_BY_ID.get(branch)?.colour ?? '#d8d8c0'
}

