import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'
import { FounderAvatar } from '../ui/FounderAvatar.tsx'
import {
  FOUNDER_TREE,
  founderBoardBounds,
  founderConnectorPath,
  founderCost,
  founderLevel,
  founderMastery,
  type FounderNode,
} from '../sim/founder.ts'
import { RATING_WEIGHTS, TRAIT_SPLIT } from '../sim/rating.ts'
import { connector, junctions, worldFor } from './diagramModel.ts'
import {
  buyFounderNode,
  currentUnlocks,
  founderOf,
  getPermanent,
  pokeFounder,
} from '../game/store.ts'
import { formatMoney } from './hudModel.ts'
import { DEFAULT_FOUNDER, readFounderProfile } from '../game/founderProfile.ts'
import type { StageHandle } from '../render/stage.ts'
import { useGameState } from './useGameState.ts'
import { ConceptText } from '../ui/ConceptText.tsx'
import { Kw } from './Kw.tsx'
import { playKeyboardClick } from '../audio/sfx.ts'
import { PurchaseEffect } from './PurchaseEffect.tsx'
import { usePurchaseEffect } from './usePurchaseEffect.ts'
import { founderEffectReceipt } from './upgradeEffectModel.ts'

import '../styles/diagram.css'
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
        sound={false}
        onClick={() => {
          if (stage) stage.codeFounder()
          else {
            playKeyboardClick()
            pokeFounder()
          }
        }}
      >
        CODE
      </Button>
    </div>
  )
}

/**
 * The grid, in CSS px. Wide cells, for the same reason §13.9's board has them.
 *
 * Taller boxes than the hero board's, because a Management node carries one
 * thing a hero node does not: a **price**, on a button, which is a control and
 * cannot be clamped the way a sentence can. Everything above it gets whatever
 * room is left and the button always gets its own.
 */
const CELL_X = 117
const CELL_Y = 150
const NODE_W = 200
const NODE_H = 140

function Node({
  node,
  cash,
  guided,
  flash,
  style,
  onBuy,
}: {
  node: FounderNode
  cash: number
  guided?: boolean
  flash?: boolean
  style?: CSSProperties
  onBuy: (node: FounderNode) => void
}) {
  const levels = getPermanent().meta.founderLevels ?? {}
  const level = founderLevel(levels, node.id)
  const maxed = level >= node.maxLevel
  const cost = founderCost(node, level)

  return (
    <div
      className="founder__node uml"
      data-owned={level > 0 ? 'true' : 'false'}
      data-guide={guided ? 'true' : 'false'}
      data-flash={flash ? 'true' : 'false'}
      data-maxed={maxed ? 'true' : 'false'}
      style={style}
    >
      <div className="founder__node-head uml__head">
        {/*
          §13.7.1 — the class each node is a weaker copy of, printed on the
          box as its stereotype. The joke only lands if the player can see that
          every skill they have is somebody else's, and it is the one label
          that makes the four specialist trees legible before they exist.
        */}
        <span className="founder__node-borrowed uml__stereo">
          «{node.kind.toLowerCase()} · {node.borrowedFrom}»
        </span>
        <span className="founder__node-name uml__name">{node.name}</span>
      </div>
      <div className="uml__body">
        <p className="founder__node-effect uml__attr">
          <span className="uml__vis">+</span>
          <span className="uml__text">
            <ConceptText text={node.effect} />
          </span>
        </p>
        <p className="founder__node-flavour uml__attr">
          <span className="uml__vis">#</span>
          <span className="uml__text">
            <ConceptText text={node.flavour} />
          </span>
        </p>
        <p className="uml__attr founder__node-level">
          <span className="uml__vis">−</span>
          level : <b>{level}/{node.maxLevel}</b>
        </p>
        <Button
          onClick={() => onBuy(node)}
          disabled={maxed || cash < cost}
        >
          {maxed ? 'LEARNED' : formatMoney(cost)}
          {node.maxLevel > 1 && !maxed && ` · ${level}/${node.maxLevel}`}
        </Button>
      </div>
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
export function FounderBranch({
  cash,
  guided = false,
  onGuidedComplete,
}: {
  cash: number
  guided?: boolean
  onGuidedComplete?: () => void
}) {
  const f = founderOf()
  const purchase = usePurchaseEffect()
  const levels = getPermanent().meta.founderLevels ?? {}
  const mastery = founderMastery(levels)

  const board = worldFor(founderBoardBounds(), CELL_X, CELL_Y, NODE_W, NODE_H, 0.6)

  /*
   * **This board fits; it does not pan.**
   *
   * §11.4.1's "larger than its viewport" is a property of §11's and §13.9's
   * boards, and it earns its place there: those are thirty-odd nodes and a
   * player exploring them is doing something. This one is a hub and five
   * spokes — the *whole shape* is the argument (§13.7.1: breadth, and nothing
   * of its own), and a shape you have to scroll to see is a shape nobody sees.
   * So it scales to whatever room it is given, and the scale is measured rather
   * than guessed at, because the room depends on the frame.
   */
  const scroller = useRef<HTMLDivElement | null>(null)
  const [fit, setFit] = useState(1)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => {
      // The 2 px is the scroller's own rule, which is inside `clientWidth` and
      // would otherwise put the outermost box exactly on the border.
      const w = (el.clientWidth - 4) / board.width
      const h = (el.clientHeight - 4) / board.height
      setFit(Math.max(0.4, Math.min(1, w, h)))
    }
    measure()
    /*
     * `ResizeObserver` is the right instrument and it does not exist in jsdom,
     * so it is asked for rather than assumed. The fallback is a window resize
     * listener, which is worse — it misses a container that changes size
     * without the window doing so — and is exactly good enough for the one
     * environment that needs it, which is a test renderer with no layout at
     * all. A component that throws in a test harness is a component nobody can
     * write a test for.
     */
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [board.width, board.height])
  const paths = FOUNDER_TREE.map((node) => ({ node, path: founderConnectorPath(node.id) }))
  const forks = junctions(
    paths.map((p) => p.path),
    board,
  )
  const owned = (node: FounderNode) => founderLevel(levels, node.id) > 0

  const buy = (node: FounderNode) => {
    const before = founderOf()
    if (!buyFounderNode(node.id)) return
    purchase.begin(
      node.id,
      founderEffectReceipt(node.name, before, founderOf()),
      guided ? onGuidedComplete : undefined,
    )
  }

  const at = (x: number, y: number, w: number, h: number): CSSProperties => ({
    left: (x + board.originX) * CELL_X - w / 2,
    top: (y + board.originY) * CELL_Y - h / 2,
    width: w,
    height: h,
  })

  return (
    <section className="founder__board" data-guided={guided ? 'true' : 'false'}>
      <header className="founder__board-head">
        <h3 className="founder__board-name">MANAGEMENT — YOU</h3>
        <p className="founder__board-blurb">
          A bit of engineering, a bit of QA, a bit of support, a bit of ops. You are the only
          person here who can do all five.
        </p>
        <p className="founder__rate-line">
          YOUR OUTPUT <b>{f.rate.toFixed(1)}</b> <Kw>story points</Kw> a second — and nothing the
          studio does can raise it or take it away.
        </p>
        {/*
          §4.14 — the founder's half of the trait term, where the levels are
          bought. It is a rating input, so the board it is bought on has to say
          so; a lever whose effect is only visible on another screen is a lever
          the player never connects to the number.
        */}
        <p className="founder__maturity">
          <span>MANAGEMENT MATURITY</span>
          <span className="founder__meter" aria-hidden="true">
            <i style={{ width: `${Math.round(mastery * 100)}%` }} />
          </span>
          <b>{Math.round(mastery * 100)}%</b>
          <em>
            up to {Math.round(RATING_WEIGHTS.traits * TRAIT_SPLIT.founder * 100)} rating on every
            game you ship
          </em>
        </p>
        {/*
          **Inside the header, not beside it.**

          `.founder__board` is a two-row grid and this paragraph only exists in
          §21.7.7's guided pass. As a sibling it became a *third* child, so the
          board slid up into the `auto` row and sized itself to its own content
          — a diagram that measured 295 px of room inside a 550 px column and
          scaled itself to 47% to fit. An optional element in a fixed grid is a
          layout that is only correct half the time.
        */}
        {guided && (
          <p className="board-teaching" role="status">
            <b>JAMES //</b> Buy one skill you can afford. Watch your own desk change, then get back to the studio.
          </p>
        )}
      </header>

      {/*
        §11.4.1's grammar, third board. A hub with five spokes and no depth
        anywhere — which is §13.7.1 drawn rather than described, because the
        specialist trees are six-deep spines and this one visibly is not.
      */}
      <div className="founder__board-scroll" ref={scroller}>
        <div
          className="founder__board-world"
          style={{
            width: board.width * fit,
            height: board.height * fit,
            ['--fit' as string]: fit,
          }}
        >
          <div
            className="founder__board-canvas"
            style={{ width: board.width, height: board.height }}
          >
          <svg
            className="founder__links gliffy"
            viewBox={`0 0 ${board.width} ${board.height}`}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            {paths.map(({ node, path }) => (
              <polyline
                key={node.id}
                points={connector(path, board).line}
                data-owned={owned(node) ? 'true' : 'false'}
              />
            ))}
            {forks.map((p, i) => (
              <circle key={i} className="gliffy__junction" cx={p.x} cy={p.y} r={4} />
            ))}
            {paths.map(({ node, path }) => (
              <polygon
                key={`arrow-${node.id}`}
                className="gliffy__arrow"
                points={connector(path, board).arrow}
                data-owned={owned(node) ? 'true' : 'false'}
              />
            ))}
          </svg>

          {/* The manager, at the origin every spoke generalises from. */}
          <div className="founder__hub uml" style={at(0, 0, NODE_W, 96)}>
            <div className="uml__head">
              <span className="uml__stereo">«instance»</span>
              <span className="uml__name">you : Manager</span>
            </div>
            <div className="uml__body">
              <p className="uml__attr">
                <span className="uml__vis">+</span>
                output : <b>{f.rate.toFixed(1)}/s</b>
              </p>
              <p className="uml__attr">
                <span className="uml__vis">+</span>
                perTap : <b>{f.tapValue.toFixed(0)}</b>
              </p>
              <p className="uml__attr">
                <span className="uml__vis">−</span>
                payroll : <b>$0</b>
              </p>
            </div>
          </div>

          {FOUNDER_TREE.map((node) => (
            <Node
              key={node.id}
              node={node}
              cash={cash}
              guided={guided && node.id === 'M-ENG'}
              flash={purchase.effect?.nodeId === node.id}
              style={at(node.x, node.y, NODE_W, NODE_H)}
              onBuy={buy}
            />
          ))}
          </div>
        </div>
      </div>
      <div className="founder__effect"><PurchaseEffect effect={purchase.effect} /></div>
    </section>
  )
}

/**
 * Clicking the person in the room opens their own surface: identity on the
 * left, the permanent Management tree on the right. Coding stays on the rail
 * button, so inspecting yourself never spends a tap and tapping CODE never
 * unexpectedly opens navigation.
 */
export function FounderProfilePanel({
  open,
  guided = false,
  onGuidedComplete,
  onClose,
}: {
  open: boolean
  guided?: boolean
  onGuidedComplete?: () => void
  onClose: () => void
}) {
  const state = useGameState()
  const founder = readFounderProfile() ?? DEFAULT_FOUNDER
  /*
   * §21.7.7 — **the desk is not gated and the board is.**
   *
   * §4.5d is explicit that the corner seat is yours from the garage and
   * clickable at every zoom, so this panel opens from Act I and always has.
   * What §21.7.6's rule caught is that the tree inside it is an *instrument*:
   * it was reachable on the first frame of Run 1, which is a personal skill
   * shop bought with the money the trap is about to take.
   *
   * The tree is **not drawn at all** before its scene — no placeholder, no
   * greyed rows. §21.7.6b's rule: a silent row is the loudest kind of
   * furniture, and reserving space for a board that does not exist yet is the
   * board being asserted before it exists.
   */
  const hasBoard = currentUnlocks().founderBoard

  return (
    <OsWindow
      open={open}
      modal
      from="centre"
      className="founder-profile"
      /* The board inside is panned; the identity column beside it scrolls with
         the frame it is in. */
      bodyClassName="os-window__body--flush"
      title={`PERSONNEL // ${founder.name.toUpperCase()}`}
      meta="FOUNDER · MANAGEMENT · STILL CODES"
      onClose={onClose}
    >
      <div className="founder-profile__body">
        <aside className="founder-profile__identity">
          <FounderAvatar {...founder} label="YOU" />
          <dl>
            <div><dt>OUTPUT</dt><dd>{founderOf().rate.toFixed(1)} <Kw>STORY POINTS</Kw>/S</dd></div>
            <div><dt>PER TAP</dt><dd>+{founderOf().tapValue.toFixed(0)} <Kw>STORY POINTS</Kw></dd></div>
            <div><dt>PAYROLL</dt><dd>$0</dd></div>
          </dl>
        </aside>

        {hasBoard && (
          <div className="founder-profile__tree">
            <FounderBranch
              cash={state.cash}
              guided={guided}
              onGuidedComplete={onGuidedComplete}
            />
          </div>
        )}
      </div>
    </OsWindow>
  )
}
