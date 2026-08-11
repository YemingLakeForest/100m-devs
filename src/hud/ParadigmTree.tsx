/**
 * The Paradigm Talent Tree — GDD §13.2, §15.1.
 *
 * Opens after the first Paradigm Shift and is the only place BP is spent. Until
 * it existed a shift was a reset with a counter: the currency was never
 * computed, never stored, and had nothing to buy — so Run 2 was Run 1 again and
 * the game had a first hour and no second one.
 *
 * §10.6 — a panel over the running simulation, never a page. The studio keeps
 * working behind it, which is also the honest picture: this is a decision you
 * make *about* a company that is already running.
 */

import { useState } from 'react'
import { Panel } from '../ui/Panel.tsx'
import { Button } from '../ui/Button.tsx'
import {
  EFFECTIVE,
  PARADIGM_TREE,
  canAfford,
  nodeCost,
  type ParadigmNode,
} from '../sim/prestige.ts'
import {
  buyParadigmNode,
  getPermanent,
  paradigmShiftOffer,
  triggerParadigmShift,
  type GameState,
} from '../game/store.ts'
import { formatCount } from '../sim/headcount.ts'
import { ConceptText } from '../ui/ConceptText.tsx'

function Node({
  node,
  level,
  bp,
  onBuy,
}: {
  node: ParadigmNode
  level: number
  bp: number
  onBuy: () => void
}) {
  const maxed = level >= node.maxLevel
  const cost = nodeCost(node, level)
  const affordable = canAfford(node, level, bp)

  return (
    <div className="paradigm__node" data-owned={level > 0 ? 'true' : 'false'}>
      <div className="paradigm__node-head">
        <span className="paradigm__node-name">{node.name}</span>
        <span className="paradigm__node-level">
          {level}/{node.maxLevel}
        </span>
      </div>
      <p className="paradigm__node-effect">
        <ConceptText text={node.effect} />
        {/*
          Every node in §13.2's five is wired now, so this never renders — and
          it stays, because it is the thing that makes shipping an inert node
          *visible*. A tree with a button that takes the player's currency and
          changes nothing is worse than one that admits it is not ready, and the
          next node added without an effect should say so on its own card rather
          than pass quietly.
        */}
        {!EFFECTIVE.has(node.id) && <em className="paradigm__soon"> — not wired up yet</em>}
      </p>
      <Button onClick={onBuy} disabled={!affordable}>
        {maxed ? 'MAXED' : `${cost} BP`}
      </Button>
    </div>
  )
}

export function ParadigmTree({
  open,
  state,
  onClose,
}: {
  open: boolean
  state: GameState
  onClose: () => void
}) {
  const permanent = getPermanent()
  const bp = permanent.layer1.bp
  const levels = permanent.layer1.paradigmLevels

  return (
    <Panel open={open} modal from="centre" className="paradigm">
      <div className="paradigm__head">
        <h1 className="paradigm__title">PARADIGM TREE</h1>
        <p className="paradigm__bp">
          <b>{bp}</b> BP
        </p>
      </div>

      {/*
        The cap is the number the whole tree is really about — §4.2 calls it
        "the only defence against §4.1" — so it is stated at the top rather than
        left to be inferred from a node description.
      */}
      <p className="paradigm__cap">
        <ConceptText text="DEVELOPER CAPACITY" /> <b>{formatCount(Math.round(state.devCap))}</b>
      </p>

      <div className="paradigm__branches">
        {(['async', 'protocol'] as const).map((branch) => (
          <div key={branch} className="paradigm__branch">
            <h2 className="paradigm__branch-name">
              {branch === 'async' ? 'ASYNC MASTERY' : 'PROTOCOL ENGINE'}
            </h2>
            {PARADIGM_TREE.filter((n) => n.branch === branch).map((node) => (
              <Node
                key={node.id}
                node={node}
                level={levels[node.id] ?? 0}
                bp={bp}
                onBuy={() => buyParadigmNode(node.id)}
              />
            ))}
          </div>
        ))}
      </div>

      <ShiftOffer state={state} />

      <Button onClick={onClose}>CLOSE</Button>
    </Panel>
  )
}

/**
 * §13.1 — taking a Paradigm Shift on purpose.
 *
 * §13.1's trigger row lists three ways in, and only bankruptcy was ever built:
 * the shift lived on the Act V modal and nowhere else, which is **one prestige
 * per playthrough** in a game whose whole second half is the loop. A player
 * stalled at forty developers with money in the bank had to wait to go broke.
 *
 * The quote is live and it only ever goes up — §14.1 pays on lifetime revenue
 * and peak headcount, neither of which can fall — so watching this number climb
 * is the argument for playing another twenty minutes before cashing out. That
 * is the whole reason it is shown *before* the decision rather than after it.
 *
 * Two presses, and the second one says what it costs. This throws the run away.
 */
function ShiftOffer({ state }: { state: GameState }) {
  const [armed, setArmed] = useState(false)
  const offer = paradigmShiftOffer(state)

  if (!offer.available) return null

  return (
    <div className="paradigm__shift">
      <p className="paradigm__shift-quote">
        THIS RUN IS WORTH <b>{offer.bp}</b> BP
      </p>
      {armed ? (
        <>
          <p className="paradigm__shift-warning">
            <ConceptText text="Rewrite the core. You keep every Bandwidth Point and every node; you lose the treasury, the swarm and everything bought with cash this run." />
          </p>
          <Button variant="bait" onClick={triggerParadigmShift}>
            REWRITE THE CORE
          </Button>
          <Button onClick={() => setArmed(false)}>NOT YET</Button>
        </>
      ) : (
        <Button onClick={() => setArmed(true)}>PARADIGM SHIFT</Button>
      )}
    </div>
  )
}
