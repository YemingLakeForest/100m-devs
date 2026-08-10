import { useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import {
  FOUNDER_TREE,
  founderCost,
  founderLevel,
  founderTotalLevels,
  type FounderNode,
} from '../sim/founder.ts'
import {
  buyFounderNode,
  founderOf,
  founderVelocity,
  getPermanent,
  pokeFounder,
} from '../game/store.ts'
import { formatMoney } from './hudModel.ts'
import { useGameState } from './useGameState.ts'

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
 * A control that only worked when the camera happened to be in the room would
 * fail that sentence at rung 3 and above, which is most of the game. So the
 * desk has a permanent affordance in the rail, and §7.8.10's corner seat is the
 * *picture* of the same thing rather than the only way to reach it.
 *
 * §7.7.7 forbids "a menu with a picture behind it", and this is deliberately
 * not one: it is a single slab that does one thing, sitting with the other
 * controls the thumb already lives on, and the tree behind it is a panel like
 * every other tree in the product.
 */
export function FounderDesk() {
  const [treeOpen, setTreeOpen] = useState(false)
  const rate = founderVelocity()

  return (
    <>
      <div className="founder__desk">
        {/*
          The rate is on the control because it is the only number in the game
          that answers "what am I worth" rather than "what is the company
          worth", and §10.1's split cannot show it alone — there it is summed
          with the thumb.
        */}
        <Button className="founder__tap" onClick={() => pokeFounder()}>
          YOUR DESK
        </Button>
        <span className="founder__rate">{rate.toFixed(1)}/s</span>
        <Button className="founder__tree-door" onClick={() => setTreeOpen((was) => !was)}>
          SKILLS
        </Button>
      </div>

      <FounderTree open={treeOpen} onClose={() => setTreeOpen(false)} />
    </>
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
 * The Management tree — §13.7.1.
 *
 * > The Management tree contains a diluted copy of every other tree's spine,
 * > and nothing of its own. You can do a bit of engineering, a bit of QA, a bit
 * > of support, a bit of ops. Each node is meaningfully weaker than the
 * > specialist equivalent, costs more, and is available earlier.
 *
 * The header says so out loud, once, because that is the game's thesis and this
 * screen is where a player meets it as a *purchase* rather than as a curve.
 * Nothing else in the panel explains it — §13.7.1 is explicit that the player
 * should "discover this by buying the nodes and watching them underperform".
 */
export function FounderTree({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Subscribed here rather than taking `state` as a prop: this panel is mounted
  // from the rail control rather than from `Hud`, and threading the whole game
  // state through two components to price five buttons is a prop nobody would
  // keep correct.
  const cash = useGameState().cash
  const levels = getPermanent().meta.founderLevels ?? {}
  const f = founderOf()

  return (
    <Panel open={open} modal from="centre" className="founder">
      <div className="founder__head">
        <h1 className="founder__title">MANAGEMENT</h1>
        <p className="founder__learned">{founderTotalLevels(levels)} LEARNED</p>
      </div>

      <p className="founder__thesis">
        A bit of engineering, a bit of QA, a bit of support, a bit of ops. You are the only
        person here who can do all five.
      </p>

      <p className="founder__rate-line">
        YOUR OUTPUT <b>{f.rate.toFixed(1)}</b> story points a second — and nothing the studio
        does can raise it or take it away.
      </p>

      <div className="founder__nodes">
        {FOUNDER_TREE.map((node) => (
          <Node key={node.id} node={node} cash={cash} />
        ))}
      </div>

      <Button onClick={onClose}>CLOSE</Button>
    </Panel>
  )
}
