/**
 * The five upgrade trees — GDD §8 [ported 2026-09-26, visual first].
 *
 * *"I want the isometric upgrade tree like the one in new game artifact"*, and
 * then, when the port started to bend itself around this build's tech board and
 * hero points: *"i am not bind to current game's economics/upgrade tree, this
 * needs to be reworked. I just want the upgrade tree isometric visual ported
 * first."* So this is the rebuild's approved demo
 * (`100m-devs-three/docs/design/garage-to-galaxy-2026-09-24/upgrade-trees/`),
 * brought over as a catalogue and drawn in STUDIO_OS by `hud/UpgradeTrees.tsx`,
 * and **most of it does nothing yet**. The demo's node contents were always a
 * proposal (the rebuild's GDD §8 says so), the loss slices they move are the
 * rebuild's seven-slice ledger that this build has not taken yet, and the
 * economy they price against is due a rework. Faking effects to fill the trees
 * would be building that rework blind.
 *
 * **What is real is Serena's pipeline.** Her capacity, speed, quality and flow
 * nodes are `sim/pipeline.ts`'s catalogue, read from it rather than copied: the
 * name, era, levels, requirements and fork all come from there, and buying one
 * buys the pipeline node (`store.buyTreeNode`). The pipeline catalogue owns
 * their board cells too, so the layout below cannot drift from the thing it
 * draws. Everything else is marked `wired: false`, and the inspector says so.
 *
 * The rest follows the demo exactly: a board cell per node, parents, *every*
 * parent where `all` is set, pick-one forks, levels, era gates, gold
 * breakthroughs, and link tiles that stand for a node in someone else's tree.
 * Two departures, both forced by Serena's real rules:
 *
 * - Her Auto-Ship does not wait for your Big Red Button, because the pipeline's
 *   does not (§10.7 records why), so her tree has no link tile back to yours.
 *   Yours still points forward to hers.
 * - Continuous Everything needs Build Farm and Parallel Tests, as the pipeline
 *   says, rather than the demo's Canary Worlds and Builds in Flight. Those two
 *   stay on the board, unwired, where they fit around it.
 *
 * **And two roots carry the old studio board's effects** [amended later on
 * 2026-09-26]. *"retire the old tree, but the story of james introducing us
 * instant messenger should be how upgrade trees are introduced so we need that
 * back in the new isometric tree."* So James's root is Instant Messenger — the
 * old board's granted centre, handed over in his Run 2 scene — and Billy's root
 * is the Daily Standup, because his arrival scene is him bringing it. A node's
 * `tech` names the effect in `techTree.ts` it carries; the store folds those
 * into `techOf`, so the old effects arrive through the trees and nowhere else.
 *
 * Pure — no store, no clock, no renderer.
 */

import { PIPELINE_ERA_COST, PIPELINE_LEVEL_STEP, PIPELINE_TREE, type PipelineNode } from './pipeline.ts'
import type { CoordKind } from './dysfunction.ts'

export const TREE_HEROES = ['you', 'james', 'billy', 'serena', 'matt'] as const
export type TreeHero = typeof TREE_HEROES[number]

/** The rebuild's seven named slices of lost work (its §2.1), in the legend's order. */
export const LOSS_SLICES = ['slacking', 'meetings', 'onboarding', 'waiting', 'duplicate', 'handoffs', 'lag'] as const
export type LossSlice = typeof LOSS_SLICES[number]

export const SLICE_NAME: Record<LossSlice, string> = {
  slacking: 'Slacking',
  meetings: 'Meetings',
  onboarding: 'Onboarding',
  waiting: 'Waiting',
  duplicate: 'Duplicate work',
  handoffs: 'Handoffs',
  lag: 'Lag',
}

export interface TreeHeroDef {
  id: TreeHero
  name: string
  role: string
  /** One line: what this person's tree is about. */
  line: string
  /** The slices of the loss this person owns. */
  slices: readonly LossSlice[]
}

export const TREE_HERO_DEFS: Record<TreeHero, TreeHeroDef> = {
  you: {
    id: 'you', name: 'You', role: 'Founder', slices: ['slacking', 'onboarding'],
    line: 'The garage, the poke, the hiring dial and every building you move into. Your own desk is the one output that never dilutes.',
  },
  james: {
    id: 'james', name: 'James', role: 'Engineering', slices: ['duplicate', 'lag'],
    line: 'No speciality. Point him at anything and he does it properly. Half his tree only opens after he is blasted off to Proxima b.',
  },
  billy: {
    id: 'billy', name: 'Billy', role: 'Scrum Master', slices: ['meetings'],
    line: '“I’ve taken the liberty of booking a quarter of an hour.” Owns the meetings, and the coordination value behind k and the cap.',
  },
  serena: {
    id: 'serena', name: 'Serena', role: 'Site Reliability', slices: ['waiting'],
    line: '“It was never really down. It was degraded.” The pipeline is hers: the buffer, its speed, auto-ship and quality.',
  },
  matt: {
    id: 'matt', name: 'Matt', role: 'Customer Support', slices: ['handoffs'],
    line: '“Four hundred people wrote in about the same button.” Tickets, incidents, and the four §17 puzzles in order.',
  },
}

/**
 * `root` is where a tree starts, owned from the beginning. `link` is not a node
 * at all: it stands for one in another tree, and is owned when that one is.
 * `key` is a breakthrough (deletes most of one slice) and `launch` is James's.
 */
export type TreeNodeKind = 'root' | 'node' | 'key' | 'link' | 'launch'

/** A proposed move of loss between slices, per level. `units` is the demo's; `share` is the pipeline's real fix. */
export interface LossMove {
  from: LossSlice
  to: LossSlice
  units?: number
  share?: number
}

export interface TreeNode {
  id: string
  /** Board cell. */
  x: number
  y: number
  name: string
  /** A key into `art/voxelIcons.ts`. */
  icon: string
  /** The era it opens in, `sim/eras.ts`'s index. */
  era: number
  parents: readonly string[]
  /** Needs *every* parent, rather than any one. */
  all: boolean
  /** Nodes sharing a fork are a pick-one: owning one closes the others. */
  fork?: string
  /** Levels; 1 for a plain node. */
  max: number
  kind: TreeNodeKind
  /** A link's target. */
  to?: { hero: TreeHero; id: string }
  /** The demo's line, or the pipeline's flavour. */
  text: string
  /** The pipeline's effect line, for a wired node. */
  effect?: string
  move?: LossMove
  /** Coordination levels (Billy's k), per level. */
  coord?: number
  /** The slice a breakthrough deletes most of. */
  breakthrough?: LossSlice
  /** True when it is one of Serena's pipeline nodes, bought through the pipeline. */
  wired: boolean
  /**
   * The old studio board's effect this node carries, by `techTree.ts` id — the
   * two roots that took over Instant Messenger and the Daily Standup. A node
   * with one does something in this build; its `effect` says what.
   */
  tech?: string
}

interface Opts {
  t?: 'root' | 'lvl' | 'key' | 'link' | 'launch'
  p?: string[]
  all?: boolean
  max?: number
  ex?: string
  mv?: [LossSlice, LossSlice, number]
  k?: number
  sl?: LossSlice
  to?: string
  d?: string
  /** `TreeNode.tech`, and the effect line that goes with it. */
  tech?: string
  fx?: string
}

/** The demo's own constructor, so the table below reads like the demo's. */
function N(id: string, x: number, y: number, name: string, icon: string, era: number, o: Opts = {}): TreeNode {
  const kind: TreeNodeKind = o.t === 'root' || o.t === 'key' || o.t === 'link' || o.t === 'launch' ? o.t : 'node'
  let to: TreeNode['to']
  if (o.to) {
    const [hero, target] = o.to.split(':')
    to = { hero: hero as TreeHero, id: target }
  }
  return {
    id, x, y, name, icon, era, kind, to,
    parents: o.p ?? [],
    all: !!o.all,
    fork: o.ex,
    max: o.max ?? 1,
    text: o.d ?? '',
    move: o.mv ? { from: o.mv[0], to: o.mv[1], units: o.mv[2] } : undefined,
    coord: o.k,
    breakthrough: o.sl,
    wired: false,
    tech: o.tech,
    effect: o.fx,
  }
}

const COORD_SLICE: Record<CoordKind, LossSlice> = { meet: 'meetings', wait: 'waiting', dup: 'duplicate', handoff: 'handoffs' }

/** Each pipeline node's picture. The cell is the pipeline's own. */
const PIPELINE_ICON: Record<string, string> = {
  s1: 'shelf', s2: 'rack', s3: 'farm', s4: 'ring',
  v1: 'laptop', v2: 'cache', v3: 'parallel', q1: 'magnifier',
  a1: 'robotarm', a2: 'gauge', a3a: 'calendar', a3b: 'traffic', K: 'belt',
}

function fromPipeline(n: PipelineNode): TreeNode {
  return {
    id: n.id,
    x: n.x,
    y: n.y,
    name: n.name,
    icon: PIPELINE_ICON[n.id] ?? 'crate',
    era: n.era,
    // The two first rungs need nothing in the pipeline; on the board they grow
    // out of her root, which is owned from the start.
    parents: n.requires.length ? n.requires : ['R'],
    all: n.requires.length > 1,
    fork: n.fork,
    max: n.maxLevel,
    kind: n.breakthrough ? 'key' : 'node',
    text: n.flavour ?? n.effect,
    effect: n.effect,
    move: n.fix ? { from: COORD_SLICE[n.fix.cuts], to: COORD_SLICE[n.fix.feeds], share: n.fix.share } : undefined,
    breakthrough: n.breakthrough ? COORD_SLICE[n.breakthrough] : undefined,
    wired: true,
  }
}

export const TREES: Record<TreeHero, readonly TreeNode[]> = {
  you: [
    N('R', 0, 0, 'The Garage', 'garage', 0, { t: 'root', d: 'Four desks, one extension cord. The garage stays, and it can be upgraded.' }),
    N('y1', 1, 0, 'Second Monitor', 'monitor', 0, { p: ['R'], d: 'Your own desk writes more. It is the one output in the company that never dilutes.' }),
    N('y2', 0, 1, 'Beanbag Row', 'beanbag', 0, { p: ['R'], t: 'lvl', max: 3, d: 'Two more garage seats per level.' }),
    N('y3', 1, 1, 'The Big Red Button', 'button', 0, { p: ['y1', 'y2'], d: 'SHIP! by hand. It clunks. Every release is your finger until Serena automates it.' }),
    N('gS', 1, 2, 'Serena · Auto-Ship', '', 0, { t: 'link', to: 'serena:a1', p: ['y3'] }),
    N('p1', 2, 0, 'Look Over Their Shoulder', 'head', 0, { p: ['y1'], d: 'A poke wakes one slacker. The effect wears off, which is what pokes are for.' }),
    N('p2', 3, 0, 'Walk the Floor', 'shoe', 1, { p: ['p1'], d: 'A poke reaches a whole pod.' }),
    N('p3a', 4, 0, 'All-Hands Email', 'envelope', 2, { p: ['p2'], ex: 'A', mv: ['slacking', 'meetings', 5], d: 'Pokes a whole tower at once. They discuss it in a meeting about the email.' }),
    N('p3b', 3, -1, 'Glass Walls', 'glass', 2, { p: ['p2'], ex: 'A', mv: ['slacking', 'duplicate', 5], d: 'Nobody slacks where you can see them. Two teams build the same thing so they look busy.' }),
    N('p4', 4, -1, 'Keynote', 'podium', 3, { p: ['p3a', 'p3b'], mv: ['slacking', 'onboarding', 5], d: 'Pokes all of Earth. A hundred million people rewatch it at 1.5×.' }),
    N('p6', 4, -2, 'Take a Holiday', 'suitcase', 3, { p: ['p4'], d: 'You leave for a week. Output doesn’t drop. Nobody mentions it.' }),
    N('p5', 5, -1, 'Hologram Founder', 'holo', 4, { p: ['p4'], d: 'Your pokes reach colony worlds, years late.' }),
    N('K1', 5, -2, 'Leave Them Alone', 'hammock', 4, { t: 'key', sl: 'slacking', p: ['p5', 'p6'], all: true, d: 'The only upgrade that works by you doing less.' }),
    N('m1', 0, -1, 'Garage Loft', 'ladder', 0, { p: ['R'], t: 'lvl', max: 2, d: 'The garage grows up instead of out. Two more seats per level.' }),
    N('m2', 0, -2, 'Moving Day', 'truck', 1, { p: ['m1'], d: 'The team moves to the HQ floor, the top storey of the first tower. The garage is kept exactly as it was.' }),
    N('m3', -1, -2, 'Corner Office', 'glassbox', 1, { p: ['m2'], mv: ['slacking', 'handoffs', 3], d: 'A glass box on the HQ floor. You can see everyone, and everything goes through your door.' }),
    N('m4', 0, -3, 'Buy the Block', 'tower', 2, { p: ['m2'], d: 'The city fills outward from HQ in square rings.' }),
    N('m5', 1, -3, 'Cranes', 'crane', 2, { p: ['m4'], t: 'lvl', max: 3, d: 'Frontier towers rise a floor faster per level.' }),
    N('m6', 0, -4, 'Launch Pad on the Lawn', 'pad', 3, { p: ['m4'], d: 'Earth is full at 100,000,000. Something on the lawn is fuelled with Diet Coke.' }),
    N('gJ', 1, -4, 'James · Bye, Earthling.', '', 3, { t: 'link', to: 'james:L', p: ['m6'] }),
    N('h1', -1, 0, 'Post on a Forum', 'bubble', 0, { p: ['R'], d: 'Hires two to four.' }),
    N('h2', -2, 0, 'Hiring Dial', 'dial', 1, { p: ['h1'], t: 'lvl', max: 5, d: 'Hire faster. Every hire joins the square root.' }),
    N('h3', -2, 1, 'Referral Bonus', 'twoheads', 1, { p: ['h2'], mv: ['onboarding', 'slacking', 4], d: 'Friends onboard faster. They also chat.' }),
    N('h4a', -3, 0, 'Bootcamp', 'tent', 2, { p: ['h2'], ex: 'B', mv: ['onboarding', 'duplicate', 5], d: 'New hires learn by building the same to-do app, forty thousand times.' }),
    N('h4b', -3, 1, 'Buddy System', 'buddy', 2, { p: ['h3'], ex: 'B', mv: ['onboarding', 'waiting', 5], d: 'Every hire gets a buddy, and the buddies stop shipping.' }),
    N('h5', -4, 1, 'Day-One Laptops', 'laptop', 2, { p: ['h4a', 'h4b'], d: 'Every hire has a working laptop on the first morning. It costs a fortune.' }),
    N('h6', -5, 1, 'Hire Where You Look', 'flag', 4, { p: ['h5'], d: 'Hiring lands on the world in view.' }),
    N('h7', -4, 2, 'Recruiters on Every World', 'planet', 4, { p: ['h5'], t: 'lvl', max: 3, d: 'Colony hiring runs faster per level.' }),
    N('K2', -5, 2, 'They Already Know the Codebase', 'gradcap', 4, { t: 'key', sl: 'onboarding', p: ['h6', 'h7'], all: true, d: 'Hires arrive onboarded. Nobody asks how.' }),
  ],
  james: [
    N('R', 0, 0, 'Instant Messenger', 'monitor', 0, { t: 'root', tech: 'B1', fx: 'Communication load −5%', d: 'He brought it at the start of the run, so you don’t have to speak to each other any more. You are sitting side by side.' }),
    N('j1', 1, 0, 'Diet Coke Stack', 'cans', 0, { p: ['R'], t: 'lvl', max: 5, d: 'Everything in his pod +3% per level. You can see the stack from the door.' }),
    N('j2', 0, 1, 'Pair With the Founder', 'twoheads', 0, { p: ['R'], d: 'Your taps count double near him.' }),
    N('j3', 1, 1, 'Knows a Chap', 'phone', 1, { p: ['j1', 'j2'], d: 'Introduces Billy. Billy’s tree opens.' }),
    N('gB', 2, 1, 'Billy · the Board', '', 1, { t: 'link', to: 'billy:R', p: ['j3'] }),
    N('j4', -1, 0, 'Torn Elbows', 'jumper', 0, { p: ['R'], d: 'He has worn that jumper since the garage, and it is load-bearing. His pod ships a little faster.' }),
    N('j5a', -2, 0, 'Shared Snippets Folder', 'folder', 1, { p: ['j4'], ex: 'C', mv: ['duplicate', 'handoffs', 4], d: 'Nobody rewrites the date picker, but somebody has to own the folder.' }),
    N('j5b', -1, -1, 'Rewrite It Over the Weekend', 'coffee', 1, { p: ['j4'], ex: 'C', mv: ['duplicate', 'waiting', 4], d: 'Monday morning brings one very large merge.' }),
    N('j6', -2, -1, 'Grep Everything', 'magnifier', 2, { p: ['j5a', 'j5b'], mv: ['duplicate', 'waiting', 3], d: 'Search before you build. The index rebuilds hourly, and everyone waits for it.' }),
    N('j7', -3, -1, 'Inner Source', 'guild', 2, { p: ['j6'], mv: ['duplicate', 'meetings', 5], d: 'Any team may use any team’s code, once the review guild has met.' }),
    N('j8', -2, -2, 'The Diet Coke Pyramid', 'pyramid', 3, { p: ['j6'], d: 'The stack reaches the HQ ceiling. Someone asks what it is for.' }),
    N('K1', -3, -2, 'Someone Already Wrote That', 'book', 3, { t: 'key', sl: 'duplicate', p: ['j7', 'j8'], all: true, d: 'One library, every world. Mostly.' }),
    N('d1', 0, -1, 'Takes His Desk With Him', 'crate', 3, { p: ['R'], d: 'He used to never leave his desk. Now he takes it with him.' }),
    N('gP', 1, -2, 'You · Launch Pad', '', 3, { t: 'link', to: 'you:m6' }),
    N('L', 0, -2, 'Bye, Earthling.', 'rocket', 3, { t: 'launch', p: ['d1', 'gP'], all: true, d: 'The first launch, and it always goes to Proxima b. He waves a can on the way up. JAMES!!! His head reads “Proxima b · 4.24 ly” from now on.' }),
    N('q1', 0, -3, 'Forgot My Diet Coke', 'can', 4, { p: ['L'], d: 'Message from Proxima b, arriving in 4 years, 3 months. Builds in flight travel faster.' }),
    N('q2', -1, -3, 'Local Studio', 'dome', 4, { p: ['q1'], mv: ['lag', 'duplicate', 6], d: 'Proxima builds its own games: less lag, and a second copy of everything HQ already made.' }),
    N('q3', 1, -3, 'Out-of-Office Reply', 'envelope', 4, { p: ['q1'], d: 'His tickets arrive four years late and perfectly answered.' }),
    N('gM', 2, -3, 'Matt · Tickets From Proxima', '', 4, { t: 'link', to: 'matt:t4', p: ['q3'] }),
    N('q4', 0, -4, 'Dome Two', 'dome', 4, { p: ['q1'], t: 'lvl', max: 3, d: 'More seats under the twilight.' }),
    N('q5', -1, -4, 'Tidal-Lock Timezone', 'sunset', 4, { p: ['q2'], mv: ['lag', 'meetings', 4], d: 'It is always dusk on Proxima b, so standup is whenever someone says so.' }),
    N('q6', 1, -4, 'Relay Buoy', 'antenna', 4, { p: ['q3'], t: 'lvl', max: 3, mv: ['lag', 'waiting', 3], d: 'Lag drops along a lane, and builds queue at the buoy instead.' }),
    N('K2', 0, -5, 'Ansible', 'ansible', 4, { t: 'key', sl: 'lag', p: ['q4', 'q5', 'q6'], all: true, d: 'Faster than light, for one sentence at a time.' }),
  ],
  billy: [
    N('R', 0, 0, 'Daily Standup', 'whiteboard', 1, { t: 'root', p: ['gJ'], tech: 'B2', fx: 'Entropy can never pass 80% — but every minute a fifth of the studio stops for 5s, and Billy keeps half the floor working through it', d: 'He arrives when sync collapses, and James knows a chap: fifteen minutes, standing up, in a fixed order.' }),
    N('gJ', 0, -1, 'James · Knows a Chap', '', 1, { t: 'link', to: 'james:j3' }),
    N('c1', 1, 0, 'Sticky Notes', 'sticky', 1, { p: ['R'], t: 'lvl', max: 3, k: 1, d: 'Coordination +1 per level.' }),
    N('c2', 2, 0, 'Kanban', 'kanban', 1, { p: ['c1'], k: 1, d: 'Coordination +1. The columns are Doing, Doing and Done.' }),
    N('c3', 2, -1, 'Scrum of Scrums', 'guild', 2, { p: ['c2'], k: 1, mv: ['meetings', 'handoffs', 4], d: 'One standup per tower, then a standup of standups.' }),
    N('c4', 3, -1, 'Org Chart', 'orgchart', 2, { p: ['c3'], t: 'lvl', max: 3, k: 1, mv: ['handoffs', 'meetings', 2], d: 'Coordination +1 per level. Each level is a layer of managers, and managers have meetings.' }),
    N('c5', 3, -2, 'Planetary PI Planning', 'planet', 3, { p: ['c4'], k: 2, d: 'Earth stops for thirty seconds to plan the quarter, and then nobody meets for ten minutes.' }),
    N('c6', 4, -2, 'Interstellar Standup', 'antenna', 4, { p: ['c5'], k: 2, mv: ['meetings', 'lag', 5], d: 'Your answer to “what did you do yesterday” arrives in four years.' }),
    N('b1', -1, 0, 'Timebox', 'hourglass', 1, { p: ['R'], mv: ['meetings', 'waiting', 4], d: 'Meetings end on time, and the decisions wait for the next one.' }),
    N('b2', -1, 1, 'Walking Meeting', 'shoe', 2, { p: ['b1'], ex: 'D', mv: ['meetings', 'slacking', 5], d: 'Meetings happen outdoors. Some attendees never come back.' }),
    N('b3', -2, 0, 'Async Standup', 'paper', 2, { p: ['b1'], ex: 'D', mv: ['meetings', 'handoffs', 5], d: 'Standup becomes a written update nobody finishes reading.' }),
    N('b4', -2, 1, 'No-Meeting Wednesdays', 'calendar', 2, { p: ['b2', 'b3'], mv: ['meetings', 'waiting', 3], d: 'Wednesday’s meetings move to Thursday.' }),
    N('b5', -3, 1, 'Decline by Default', 'xmark', 2, { p: ['b4'], mv: ['meetings', 'duplicate', 4], d: 'Nobody attends, so two teams each decide the same thing alone.' }),
    N('b6', -3, 0, 'Shared Calendar', 'calendar', 2, { p: ['b3'], d: 'Everyone can see everyone’s day, so the meetings find the gaps.' }),
    N('b7', -4, 0, 'Calendar Tetris', 'blocks', 3, { p: ['b6'], mv: ['meetings', 'onboarding', 3], d: 'New hires spend their first week finding a free slot.' }),
    N('K', -4, 1, 'It Could Have Been an Email, and It Was', 'envelope', 3, { t: 'key', sl: 'meetings', p: ['b5', 'b7'], all: true, d: '“If we shan’t need it, we shall give it back.” He gives it back.' }),
    N('d1', 0, 1, 'Loss on the Wall', 'chart', 1, { p: ['R'], d: 'Billy draws the seven slices on his board, and the loss bar is read off it.' }),
    N('d2', 0, 2, 'Retro', 'sticky', 1, { p: ['d1'], d: 'Every sprint the team names the slice that hurt most. Nothing else happens.' }),
    N('d4', 1, 1, 'Team Topologies', 'blocks', 2, { p: ['c1', 'd1'], k: 1, mv: ['handoffs', 'meetings', 3], d: 'Coordination +1. Teams are redrawn around the work, in a series of workshops.' }),
    N('d3', 1, 2, 'Definition of Done', 'check', 2, { p: ['d2', 'd4'], mv: ['duplicate', 'meetings', 3], d: 'Everyone agrees what “finished” means, at length.' }),
    N('gS', 2, 2, 'Serena · Ship on Green', '', 2, { t: 'link', to: 'serena:a3b', p: ['d3'] }),
  ],
  serena: [
    N('R', 0, 0, 'Serena’s Dashboards', 'dashboard', 0, { t: 'root', d: 'The pipeline is a buffer: how long you can walk away. Capacity and speed are upgraded separately.' }),
    ...PIPELINE_TREE.map(fromPipeline),
    // The demo's two world-scale flow nodes wait for worlds (phase 7).
    N('f1', 4, 1, 'Builds in Flight', 'crate', 4, { p: ['s4'], d: 'Colony builds cross space to Sol, and they count as buffer while they travel.' }),
    N('a4', 3, -2, 'Canary Worlds', 'bird', 4, { p: ['a3a', 'a3b'], d: 'A release lands on one colony first.' }),
    // Reliability, the half of her tree the pipeline does not cover.
    N('r1', -1, 0, 'Wrote the Runbook', 'book', 1, { p: ['R'], d: 'A new incident opens half worked.' }),
    N('r2', -2, 0, 'On-Call Rota', 'phone', 1, { p: ['r1'], mv: ['waiting', 'slacking', 3], d: 'Incidents get answered at 3 a.m., and on-call sleeps at their desk the next day.' }),
    N('r3', -2, 1, 'Rollback Button', 'cassette', 2, { p: ['r2'], d: 'A rollback spends a real build from the buffer.' }),
    N('gM', -2, 2, 'Matt · Rollback puzzle', '', 2, { t: 'link', to: 'matt:m5', p: ['r3'] }),
    N('r4', -3, 0, 'Error Budget', 'coins', 2, { p: ['r2'], t: 'lvl', max: 3, d: 'How often an incident may happen before shipping pauses.' }),
    N('r5', -4, 0, 'It Was Degraded', 'shield', 3, { p: ['r4'], d: 'Incidents no longer stop the belt. “There’s a difference, and it matters.”' }),
  ],
  matt: [
    N('R', 0, 0, 'Matt’s Ticket Wall', 'ticketwall', 1, { t: 'root', d: 'He arrives with the first ticket queue nobody is serving.' }),
    N('m1', 1, 0, 'Headset', 'headset', 1, { p: ['R'], d: 'Matt resolving · 0.5 work/s. The ticket flood gets a rescue dock.' }),
    N('m2', 2, 0, 'Read the Logs', 'scroll', 1, { p: ['m1'], d: '§17 puzzle 1: find the line where it started.' }),
    N('m3', 2, 1, 'Support Triage', 'sort', 2, { p: ['m2'], d: 'Puzzle 2: sort the flood before it sorts you.' }),
    N('m4', 3, 1, 'Draw the UML', 'uml', 2, { p: ['m3'], d: 'Puzzle 3: draw the boxes before you believe the arrows.' }),
    N('m5', 3, 2, 'Rollback', 'cassette', 2, { p: ['m4'], d: 'Puzzle 4: the rollback cards are real builds from Serena’s buffer.' }),
    N('gS', 4, 2, 'Serena · Rollback Button', '', 2, { t: 'link', to: 'serena:r3', p: ['m5'] }),
    N('m6', 4, 1, 'Burning Systems', 'fire', 4, { p: ['m4'], d: 'Incidents show on the galaxy map, on fire.' }),
    N('t1', 0, 1, 'Inbox', 'inbox', 1, { p: ['R'], t: 'lvl', max: 5, d: 'More tickets answered per second, per level.' }),
    N('i1', 1, 1, 'Incident Inspector', 'magnifier', 1, { p: ['m1', 't1'], d: 'Diagnose, Runbook, Assign team.' }),
    N('t2', 0, 2, 'Second Headset', 'headset', 2, { p: ['t1'], t: 'lvl', max: 5, d: 'More support heads per level.' }),
    N('t3', -1, 2, 'Call Centre Floor', 'crowd', 2, { p: ['t2'], d: 'A whole HQ floor of headsets.' }),
    N('t4', -1, 3, 'Tickets From Proxima', 'envelope', 4, { p: ['t3'], d: 'Tickets from far worlds arrive late by the light-time.' }),
    N('t5', 0, 3, 'Priority: Urgent', 'hourglass', 4, { p: ['t2', 't4'], d: 'A ticket from the galactic core, filed 26,000 years ago.' }),
    N('gJ', 1, 3, 'James · Out-of-Office Reply', '', 4, { t: 'link', to: 'james:q3', p: ['t5'] }),
    N('h1', -1, 0, 'Macros', 'stamp', 1, { p: ['R'], mv: ['handoffs', 'duplicate', 4], d: 'The same answer, four hundred times.' }),
    N('h2', -1, -1, 'Ticket Owner', 'badge', 1, { p: ['h1'], mv: ['handoffs', 'waiting', 4], d: 'Whoever picks it up keeps it, however long that takes.' }),
    N('h3a', -2, -1, 'Swarming', 'crowd', 2, { p: ['h2'], ex: 'F', mv: ['handoffs', 'meetings', 5], d: 'Everyone works one ticket at once, in a call.' }),
    N('h3b', -1, -2, 'Follow the Sun', 'sun', 4, { p: ['h2'], ex: 'F', mv: ['handoffs', 'lag', 5], d: 'Tickets pass from world to world, across light-years.' }),
    N('h4', -2, -2, 'Rescue Dock', 'dock', 2, { p: ['h3a', 'h3b'], d: 'Grab a drowning ticket and pull it in.' }),
    N('h5', -3, -1, 'Status Page', 'status', 2, { p: ['h3a'], mv: ['handoffs', 'slacking', 3], d: 'Everyone can see it’s down, so nobody has to ask. Some stop working.' }),
    N('K', -3, -2, 'An FAQ People Read', 'faq', 3, { t: 'key', sl: 'handoffs', p: ['h4', 'h5'], all: true, d: 'It has never happened before, anywhere.' }),
  ],
}

const byId = (h: TreeHero): ReadonlyMap<string, TreeNode> => new Map(TREES[h].map((n) => [n.id, n]))

export const TREE_BY_ID: Record<TreeHero, ReadonlyMap<string, TreeNode>> = {
  you: byId('you'),
  james: byId('james'),
  billy: byId('billy'),
  serena: byId('serena'),
  matt: byId('matt'),
}

export function treeNode(hero: TreeHero, id: string): TreeNode | undefined {
  return TREE_BY_ID[hero].get(id)
}

/** The save key for an unwired node's level. */
export const treeKey = (hero: TreeHero, id: string) => `${hero}:${id}`

// --- the rules --------------------------------------------------------------

/**
 * What the rules need to know about a studio. `level` answers for any real
 * node in any tree; roots and links are resolved here, so the caller only has
 * to know where levels are kept.
 */
export interface TreeView {
  level(hero: TreeHero, id: string): number
  era: number
  cash: number
  price(hero: TreeHero, node: TreeNode): number | null
}

/** Owned levels. A root is always 1; a link is 1 while its target is owned. */
export function levelOf(view: TreeView, hero: TreeHero, node: TreeNode): number {
  if (node.kind === 'root') return 1
  if (node.kind === 'link') {
    const target = node.to && treeNode(node.to.hero, node.to.id)
    return target && levelOf(view, node.to!.hero, target) > 0 ? 1 : 0
  }
  return Math.min(node.max, Math.max(0, Math.floor(view.level(hero, node.id) || 0)))
}

export function ownedIn(view: TreeView, hero: TreeHero, id: string): boolean {
  const node = treeNode(hero, id)
  return !!node && levelOf(view, hero, node) > 0
}

/** Parents satisfied: every one where `all` is set, any one otherwise. */
export function parentsMet(view: TreeView, hero: TreeHero, node: TreeNode): boolean {
  if (!node.parents.length) return true
  const met = node.parents.map((id) => ownedIn(view, hero, id))
  return node.all ? met.every(Boolean) : met.some(Boolean)
}

/** The other side of a pick-one that has been taken, if any. */
export function closedBy(view: TreeView, hero: TreeHero, node: TreeNode): TreeNode | null {
  if (!node.fork) return null
  return TREES[hero].find((o) => o !== node && o.fork === node.fork && levelOf(view, hero, o) > 0) ?? null
}

/**
 * Why a node cannot be bought, or null if it can. `absent` is a wired node
 * whose owner has not arrived; `root` and `link` are not for sale at all.
 */
export type TreeRefusal = null | 'root' | 'link' | 'maxed' | 'era' | 'fork' | 'requires' | 'cash' | 'absent'

/** The demo's rule, in the demo's order. Wired nodes ask their own system instead. */
export function treeRefusal(view: TreeView, hero: TreeHero, node: TreeNode): TreeRefusal {
  if (node.kind === 'root') return 'root'
  if (node.kind === 'link') return 'link'
  const level = levelOf(view, hero, node)
  if (level >= node.max) return 'maxed'
  if (node.era > view.era) return 'era'
  if (closedBy(view, hero, node)) return 'fork'
  if (!parentsMet(view, hero, node)) return 'requires'
  const price = view.price(hero, node)
  if (price === null || !(view.cash >= price)) return 'cash'
  return null
}

/**
 * The demo's price: a few minutes of income in the node's era, four times that
 * for a breakthrough and three for the launch, and 1.6 times more per level.
 * The table is the pipeline's, which is the same demo's, so the two cannot
 * price one era differently. `floor` is §2.7's income floor, as the pipeline
 * applies it.
 */
export function treePrice(node: TreeNode, level: number, floor = 0): number {
  const base = PIPELINE_ERA_COST[Math.min(Math.max(0, node.era), PIPELINE_ERA_COST.length - 1)]
  const kind = node.kind === 'key' ? 4 : node.kind === 'launch' ? 3 : 1
  const authored = base * kind * PIPELINE_LEVEL_STEP ** Math.max(0, level)
  return Math.round(Math.max(authored, Number.isFinite(floor) ? floor : 0))
}

/**
 * How a tile is drawn. `partial` has levels and more to buy; the `+` forms are
 * affordable right now, which is what makes a tile pulse.
 */
export type TileState = 'root' | 'link' | 'owned' | 'partial' | 'partial+' | 'live' | 'short' | 'locked' | 'era' | 'closed'

/** The one mapping from a refusal to a picture, for wired and unwired nodes alike. */
export function tileStateOf(refusal: TreeRefusal, level: number): TileState {
  switch (refusal) {
    case 'root': return 'root'
    case 'link': return 'link'
    case 'maxed': return 'owned'
    case 'fork': return level > 0 ? 'partial' : 'closed'
    case 'era': return level > 0 ? 'partial' : 'era'
    case 'requires':
    case 'absent': return level > 0 ? 'partial' : 'locked'
    case 'cash': return level > 0 ? 'partial' : 'short'
    case null: return level > 0 ? 'partial+' : 'live'
  }
}

export function isBreakthrough(node: TreeNode): boolean {
  return node.kind === 'key' || node.kind === 'launch'
}

// --- the board's geometry ---------------------------------------------------

type Cell = readonly [number, number]

function cellsOf(tree: readonly TreeNode[]): Set<string> {
  return new Set(tree.map((n) => `${n.x},${n.y}`))
}

/** The cells strictly between two cells on one row or column. */
function between(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = []
  const dx = Math.sign(b[0] - a[0])
  const dy = Math.sign(b[1] - a[1])
  let x = a[0] + dx
  let y = a[1] + dy
  while (x !== b[0] || y !== b[1]) {
    out.push([x, y])
    x += dx
    y += dy
  }
  return out
}

function clear(path: readonly Cell[], occupied: Set<string>): boolean {
  for (let i = 0; i + 1 < path.length; i++) {
    for (const c of between(path[i], path[i + 1])) if (occupied.has(`${c[0]},${c[1]}`)) return false
  }
  // Corners are free cells too; the ends are the two tiles being joined.
  for (let i = 1; i + 1 < path.length; i++) if (occupied.has(`${path[i][0]},${path[i][1]}`)) return false
  return true
}

/**
 * The connector from `parentId` to `node`, as board cells to join with straight
 * runs — right angles only, and **never through a tile it does not join**.
 *
 * The demo always turned at the parent's column, which its hand-made layouts
 * were drawn around. Serena's cells now come from the pipeline, so the route
 * is chosen: straight if it can be, then the two elbows, then the shortest
 * two-turn detour. A layout with no clear route still gets the first elbow —
 * and `upgradeTrees.test.ts` fails, because that is a layout bug to fix.
 */
export function connectorRoute(hero: TreeHero, node: TreeNode, parentId: string): Cell[] {
  const parent = treeNode(hero, parentId)
  if (!parent) return []
  const p: Cell = [parent.x, parent.y]
  const n: Cell = [node.x, node.y]
  const occupied = cellsOf(TREES[hero])
  const tries: Cell[][] = []
  if (p[0] === n[0] || p[1] === n[1]) tries.push([p, n])
  else tries.push([p, [p[0], n[1]], n], [p, [n[0], p[1]], n])
  for (const t of tries) if (clear(t, occupied)) return t
  // Two turns: out along one axis to a free lane, across, and in.
  const detours: Cell[][] = []
  for (let d = 1; d <= 6; d++) {
    for (const m of [Math.min(p[1], n[1]) - d, Math.max(p[1], n[1]) + d, p[1] + d, p[1] - d]) {
      detours.push([p, [p[0], m], [n[0], m], n])
    }
    for (const m of [Math.min(p[0], n[0]) - d, Math.max(p[0], n[0]) + d, p[0] + d, p[0] - d]) {
      detours.push([p, [m, p[1]], [m, n[1]], n])
    }
  }
  const length = (t: readonly Cell[]) => t.reduce((a, c, i) => (i ? a + Math.abs(c[0] - t[i - 1][0]) + Math.abs(c[1] - t[i - 1][1]) : 0), 0)
  const ok = detours.filter((t) => clear(t, occupied)).sort((a, b) => length(a) - length(b))
  return ok[0] ?? tries[0]
}

/** Every connector in a tree, parent first. */
export function treeConnectors(hero: TreeHero): { node: TreeNode; parent: string; cells: Cell[] }[] {
  const out: { node: TreeNode; parent: string; cells: Cell[] }[] = []
  for (const node of TREES[hero]) for (const parent of node.parents) out.push({ node, parent, cells: connectorRoute(hero, node, parent) })
  return out
}
