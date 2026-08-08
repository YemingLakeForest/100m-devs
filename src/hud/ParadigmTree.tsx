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

import { Panel } from '../ui/Panel.tsx'
import { Button } from '../ui/Button.tsx'
import {
  EFFECTIVE,
  PARADIGM_TREE,
  canAfford,
  nodeCost,
  type ParadigmNode,
} from '../sim/prestige.ts'
import { buyParadigmNode, getPermanent, type GameState } from '../game/store.ts'
import { formatCount } from '../sim/headcount.ts'

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
        {node.effect}
        {/*
          §13.2 lists five nodes and two of them are wired. Saying so on the
          card is the only honest option: a tree with three buttons that take
          the player's currency and change nothing is worse than a tree with
          three buttons that say they are not ready.
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
        DEVELOPER CAPACITY <b>{formatCount(Math.round(state.devCap))}</b>
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

      <Button onClick={onClose}>CLOSE</Button>
    </Panel>
  )
}
