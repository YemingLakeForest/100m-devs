import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import { TECH_TREE, type TechBranch, type TechNode } from '../sim/techTree.ts'
import { buyTech, techQuote, type GameState } from '../game/store.ts'
import { formatMoney } from './hudModel.ts'
import { useGameState } from './useGameState.ts'
import { ConceptText } from '../ui/ConceptText.tsx'
import { Kw } from './Kw.tsx'

import '../styles/tech.css'

/**
 * The §11 in-run tech tree — GDD §10.1's bottom-nav `UPGRADES` tab.
 *
 * **This door was built empty on purpose and this is it opening.** The previous
 * version's note is worth keeping in mind: the frame was divided while the tree
 * did not exist, at the size and in the place the real one would occupy, so
 * that the control would not later have to be wedged into a layout that had
 * already agreed how to spend its edges. Nothing about the frame changed here.
 * Only the room behind it.
 *
 * The drawer slides from the right edge because that is the edge its button
 * lives on — §10.5 rule 1, an element enters from where it belongs and exits
 * back toward it. It is a drawer rather than a modal for §7.1: the swarm stays
 * visible and pokeable everywhere the panel is not, which matters more now that
 * the panel is somewhere a player will stand for a while.
 */

const BRANCH_NAME: Record<TechBranch, string> = {
  protocol: 'COMMUNICATION PROTOCOLS',
  culture: 'CULTURE & JUICE',
}

/** §11.2 and §11.3's own one-line theses, for the branch headers. */
const BRANCH_BLURB: Record<TechBranch, string> = {
  protocol: 'Suppress the entropy. Everything here has a price you keep paying.',
  culture: 'Sharpen the thumb. Every point you add, you add to the interruption.',
}

function Node({ node, state }: { node: TechNode; state: GameState }) {
  const q = techQuote(node.id, state)
  if (!q) return null

  return (
    <div
      className="tech__node"
      data-owned={q.level > 0 ? 'true' : 'false'}
      data-locked={q.unlocked ? 'false' : 'true'}
    >
      <div className="tech__node-head">
        <span className="tech__node-name">{node.name}</span>
        {node.maxLevel > 1 && (
          <span className="tech__node-level">
            {q.level}/{node.maxLevel}
          </span>
        )}
      </div>

      {/*
        The flavour line is half the reason §11 exists — the tree is the game's
        satire delivered as a shopping list — so it is not a tooltip. On a phone
        there is nowhere for a tooltip to live and nothing to hover with.
      */}
      <p className="tech__node-flavour"><ConceptText text={node.flavour} /></p>
      <p className="tech__node-effect"><ConceptText text={node.effect} /></p>

      {node.granted ? (
        // §11.5 — Instant Messenger is *given*, by James, in §21.7.2. It is the
        // only node in the game with no price, so it has no button: an enabled
        // control that cannot do anything is worse than no control, and a
        // disabled one priced at $0 reads as a bug.
        <p className="tech__node-granted">{q.level > 0 ? 'A GIFT FROM JAMES' : 'NOT YET'}</p>
      ) : q.unlocked ? (
        <Button onClick={() => buyTech(node.id)} disabled={!q.affordable}>
          {q.maxed ? 'OWNED' : formatMoney(q.cost)}
        </Button>
      ) : (
        // Named rather than hidden. A tree that reveals nodes as you buy them
        // cannot be planned, and planning is the whole of §11's "upgrading
        // Workforce without Communication Infra" warning.
        <p className="tech__node-locked">NEEDS {node.requires}</p>
      )}
    </div>
  )
}

/**
 * The panel only. **The nav bar it used to carry moved up to `Hud`** when the
 * Paradigm Tree gained a door of its own: two components each rendering their
 * own `.hud__nav` would be two absolutely-positioned bars in the same corner,
 * and the second one to mount would win. One bar, owned by the thing that owns
 * the frame, with the panels beneath it.
 */
export function Upgrades({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useGameState()

  return (
    <>
      <Panel open={open} from="right" className="hud__upgrades">
        <div className="hud__upgrades-body">
          <div className="tech__head">
            <h2 className="hud__upgrades-title"><Kw kind="upgrades">UPGRADES</Kw></h2>
            <span className="tech__cash">{formatMoney(state.cash)}</span>
          </div>

          <div className="tech__branches">
            {(['protocol', 'culture'] as const).map((branch) => (
              <section key={branch} className="tech__branch">
                <h3 className="tech__branch-name">{BRANCH_NAME[branch]}</h3>
                <p className="tech__branch-blurb"><ConceptText text={BRANCH_BLURB[branch]} /></p>
                {TECH_TREE.filter((n) => n.branch === branch).map((node) => (
                  <Node key={node.id} node={node} state={state} />
                ))}
              </section>
            ))}
          </div>

          <Button onClick={onClose}>BACK</Button>
        </div>
      </Panel>
    </>
  )
}
