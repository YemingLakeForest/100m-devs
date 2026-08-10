import { Button } from '../ui/Button.tsx'
import {
  FOUNDER_TREE,
  founderCost,
  founderLevel,
  type FounderNode,
} from '../sim/founder.ts'
import { buyFounderNode, founderOf, getPermanent, pokeFounder } from '../game/store.ts'
import { formatMoney } from './hudModel.ts'

import '../styles/founder.css'

/**
 * Your desk — GDD §4.5d, §7.8.10, §13.7.1. R16 and R20.
 *
 * **§4.5d's hardest requirement is the placement one**, and it is why this is a
 * rail control rather than only a seat on the floor:
 *
 * > It is clickable from anywhere. You do not have to fly the camera home to
 * > use it. The desk is where it *lives* … but the action is available at every
 * > zoom — because it is you, and you are always present.
 *
 * A control that only worked while the camera happened to be in the room would
 * fail that sentence at rung 3 and above, which is most of the game. So the
 * action has a permanent affordance, and §7.8.10's corner seat is the *picture*
 * of the same thing rather than the only way to reach it.
 *
 * **One button, and that is a hard constraint rather than a preference.** The
 * right rail was measured at every frame in §23.4's design box, and the note on
 * the 336 px media query records that adding §7.7.6b's touch latches already
 * cost the rail a row — "a new control does not get to evict canon". So the
 * desk is a single slab that shares §13.2's row, the rate it produces is read
 * off §10.1's `swarm + you` split where it already appears, and the Management
 * tree lives in the UPGRADES drawer beside the other things cash buys.
 */
export function FounderDesk() {
  return (
    <Button className="founder__tap" onClick={() => pokeFounder()}>
      YOUR DESK
    </Button>
  )
}

function Node({ node, cash }: { node: FounderNode; cash: number }) {
  const levels = getPermanent().meta.founderLevels ?? {}
  const level = founderLevel(levels, node.id)
  const maxed = level >= node.maxLevel
  const cost = founderCost(node, level)

  return (
    <div className="founder__node" data-owned={level > 0 ? 'true' : 'false'}>
      <div className="founder__node-head">
        <span className="founder__node-name">{node.name}</span>
        {/*
          §13.7.1 — the class each node is a weaker copy of, printed on the
          card. The joke only lands if the player can see that every skill they
          have is somebody else's, and it is the one label that makes the four
          specialist trees legible before they exist.
        */}
        <span className="founder__node-borrowed">{node.borrowedFrom.toUpperCase()}</span>
      </div>
      <p className="founder__node-flavour">{node.flavour}</p>
      <p className="founder__node-effect">{node.effect}</p>
      <Button onClick={() => buyFounderNode(node.id)} disabled={maxed || cash < cost}>
        {maxed ? 'LEARNED' : formatMoney(cost)}
        {node.maxLevel > 1 && !maxed && ` · ${level}/${node.maxLevel}`}
      </Button>
    </div>
  )
}

/**
 * The Management tree — §13.7.1, rendered as a branch of the §11 drawer.
 *
 * > The Management tree contains a diluted copy of every other tree's spine,
 * > and nothing of its own. You can do a bit of engineering, a bit of QA, a bit
 * > of support, a bit of ops. Each node is meaningfully weaker than the
 * > specialist equivalent, costs more, and is available earlier.
 *
 * **It sits inside UPGRADES rather than behind a door of its own**, and that is
 * a design answer as much as a layout one: this is bought with cash, like every
 * §11 node, so putting it anywhere else would mean two screens spending one
 * currency. It also lands the joke without a line of copy — your own skills are
 * a line item in the same budget as the coffee machine.
 *
 * The header states the thesis once. Nothing else explains it, because §13.7.1
 * is explicit that the player should "discover this by buying the nodes and
 * watching them underperform".
 */
export function FounderBranch({ cash }: { cash: number }) {
  const f = founderOf()

  return (
    <section className="tech__branch">
      <h3 className="tech__branch-name">MANAGEMENT — YOU</h3>
      <p className="tech__branch-blurb">
        A bit of engineering, a bit of QA, a bit of support, a bit of ops. You are the only
        person here who can do all five.
      </p>
      <p className="founder__rate-line">
        YOUR OUTPUT <b>{f.rate.toFixed(1)}</b> story points a second — and nothing the studio
        does can raise it or take it away.
      </p>
      {FOUNDER_TREE.map((node) => (
        <Node key={node.id} node={node} cash={cash} />
      ))}
    </section>
  )
}
