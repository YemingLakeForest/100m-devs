import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import { FounderAvatar } from '../ui/FounderAvatar.tsx'
import {
  FOUNDER_TREE,
  founderCost,
  founderLevel,
  type FounderNode,
} from '../sim/founder.ts'
import { buyFounderNode, founderOf, getPermanent, pokeFounder } from '../game/store.ts'
import { formatMoney } from './hudModel.ts'
import { DEFAULT_FOUNDER, readFounderProfile } from '../game/founderProfile.ts'
import type { StageHandle } from '../render/stage.ts'
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
 * A control that only worked while the camera happened to be in the room would
 * fail that sentence at rung 3 and above, which is most of the game. So the
 * action has a permanent affordance, and §7.8.10's corner seat is the *picture*
 * of the same thing rather than the only way to reach it.
 *
 * **One button, and that is a hard constraint rather than a preference.** The
 * right rail was measured at every frame in §23.4's design box, and the note on
 * the 336 px media query records that adding §7.7.6b's touch latches already
 * cost the rail a row — "a new control does not get to evict canon". So the
 * desk is a single slab that shares §13.2's row, and the rate it produces is
 * read off §10.1's `swarm + you` split where it already appears. The person's
 * own world hit target opens the identity/tree screen; CODE remains only CODE.
 */
export function FounderDesk({ stage }: { stage: StageHandle | null }) {
  const founder = readFounderProfile() ?? DEFAULT_FOUNDER

  return (
    <div className="founder__corner">
      <div className="founder__corner-label">
        <span>MANAGER CORNER</span>
        <b>{founder.name.toUpperCase()}</b>
      </div>
      <Button
        className="founder__tap"
        onClick={() => {
          if (stage) stage.codeFounder()
          else pokeFounder()
        }}
      >
        CODE — YOU
      </Button>
    </div>
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
 * The Management tree — §13.7.1, rendered inside the founder profile screen.
 *
 * > The Management tree contains a diluted copy of every other tree's spine,
 * > and nothing of its own. You can do a bit of engineering, a bit of QA, a bit
 * > of support, a bit of ops. Each node is meaningfully weaker than the
 * > specialist equivalent, costs more, and is available earlier.
 *
 * The founder portrait and live personal output sit beside it, so each purchase
 * has a visible owner. It still spends the same cash as §11; the separation is
 * about whose screen the skills belong to, not a second economy.
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

/**
 * Clicking the person in the room opens their own surface: identity on the
 * left, the permanent Management tree on the right. Coding stays on the rail
 * button, so inspecting yourself never spends a tap and tapping CODE never
 * unexpectedly opens navigation.
 */
export function FounderProfilePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useGameState()
  const founder = readFounderProfile() ?? DEFAULT_FOUNDER

  return (
    <Panel open={open} modal from="centre" className="founder-profile">
      <div className="founder-profile__head">
        <div>
          <span className="founder-profile__kicker">PERSONNEL // 00</span>
          <h2>{founder.name.toUpperCase()}</h2>
          <p>FOUNDER · MANAGEMENT · STILL CODES</p>
        </div>
        <Button onClick={onClose}>BACK</Button>
      </div>

      <div className="founder-profile__body">
        <aside className="founder-profile__identity">
          <FounderAvatar head={founder.head} body={founder.body} label="YOU" />
          <dl>
            <div><dt>OUTPUT</dt><dd>{founderOf().rate.toFixed(1)} SP/S</dd></div>
            <div><dt>PER TAP</dt><dd>+{founderOf().tapValue.toFixed(0)} SP</dd></div>
            <div><dt>PAYROLL</dt><dd>$0</dd></div>
          </dl>
        </aside>

        <div className="founder-profile__tree">
          <FounderBranch cash={state.cash} />
        </div>
      </div>
    </Panel>
  )
}
