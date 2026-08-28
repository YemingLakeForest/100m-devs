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
import { OsWindow } from '../ui/OsWindow.tsx'
import { Button } from '../ui/Button.tsx'
import {
  EFFECTIVE,
  PARADIGM_TREE,
  canAfford,
  cheapestAffordable,
  nextRung,
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
    <OsWindow
      open={open}
      modal
      from="centre"
      className="paradigm"
      bodyClassName="paradigm__body"
      title="PARADIGM TREE"
      /*
        The balance, in the bar. §13.12's whole screen is "what can I afford",
        so the wallet belongs where the window says what it is — and putting it
        there is what let the body below scroll without the number leaving with
        it.
      */
      meta={
        <span className="paradigm__bp">
          <b>{bp}</b> BP
        </span>
      }
      onClose={onClose}
    >
      {/*
        The cap is the number the whole tree is really about — §4.2 calls it
        "the only defence against §4.1" — so it is stated at the top rather than
        left to be inferred from a node description.
      */}
      <p className="paradigm__cap">
        <ConceptText text="DEVELOPER CAPACITY" /> <b>{formatCount(Math.round(state.devCap))}</b>
      </p>

      <NearMiss levels={levels} bp={bp} />

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

      {/*
        Left in the scroll rather than pinned to the window's foot: it is four
        readouts and an armed two-step, not a control strip, and §10.6a's foot
        is for the one action a window is about. The way out is the close box
        in the bar — which is the fix for the note in `ui-frame.acceptance.mjs`
        about CLOSE sitting below the fold of this very panel at 640x360.
      */}
      <ShiftOffer state={state} />
    </OsWindow>
  )
}

/**
 * §13.12.4 — **the half of the sentence the screen never said.**
 *
 * A number and a tree of prices is arithmetic homework. This says what the
 * player is saving for and how far off it is, which is the thing that makes
 * ending a run just short of something feel like a reason to start another one
 * rather than like nothing having happened.
 *
 * Renders nothing when {@link nextRung} returns null — the tree is maxed, or
 * something is already affordable and the board is drawing it lit.
 */
function NearMiss({ levels, bp }: { levels: Readonly<Record<string, number>>; bp: number }) {
  const rung = nextRung(levels, bp)
  if (!rung) return null
  return (
    <p className="paradigm__next">
      {/*
        One template string per phrase, not two expressions with JSX whitespace
        between them: the whitespace is not part of the accessible name, so a
        test querying for "9 BP SHORT" would miss a node rendered as {n}{' '}BP.
      */}
      <span className="paradigm__next-label">NEXT</span> {rung.node.name}{' '}
      <b>{`${rung.short} BP SHORT`}</b>
    </p>
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
 * The quote is live — §14.1 pays on this run's revenue and peak headcount, then
 * itemises reputation — so the player sees what another twenty minutes and a
 * better release would change before cashing out. That is the whole reason it
 * is shown *before* the decision rather than after it.
 *
 * Two presses, and the second one says what it costs. This throws the run away.
 */
function ShiftOffer({ state }: { state: GameState }) {
  const [armed, setArmed] = useState(false)
  const offer = paradigmShiftOffer(state)

  if (!offer.available) return null

  /**
   * §13.12.4 — **what taking it actually buys.**
   *
   * The quote above is a live number and the note on this function already says
   * why it is shown before the decision: watching it climb is the argument for
   * playing another twenty minutes. But a player deciding *now* is asking a
   * different question — does cashing out get me the thing — and until this
   * line existed they had to answer it by holding two numbers in their head and
   * subtracting.
   *
   * Computed against `bp + offer.bp`, the wallet as it would be **after** the
   * shift, so the sentence is about the decision rather than about the present.
   */
  const levels = getPermanent().layer1.paradigmLevels
  const after = getPermanent().layer1.bp + offer.bp
  const stillShort = nextRung(levels, after)
  const buys = stillShort ? null : cheapestAffordable(levels, after)

  return (
    <div className="paradigm__shift">
      <p className="paradigm__shift-quote">
        NEW BP THIS SHIFT <b>{offer.bp}</b>
      </p>
      <p className="paradigm__shift-reach">
        RUN PROGRESS {offer.baseBp} × REPUTATION {offer.reputationMultiplier.toFixed(2)}
      </p>
      {/*
        One template string per phrase — trap 31. The whole line is the readout,
        and a test asking for "THAT BUYS TELEPATHIC COMPRESSION" has to find it
        as one accessible string rather than as three adjacent expressions.
      */}
      {(stillShort || buys) && (
        <p className="paradigm__shift-reach">
          {stillShort
            ? `STILL ${stillShort.short} SHORT OF ${stillShort.node.name.toUpperCase()}`
            : `THAT BUYS ${buys!.name.toUpperCase()}`}
        </p>
      )}
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
