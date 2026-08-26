/**
 * §13.9's board — one tree, six branches, and every hero opens the same one.
 *
 * **The grammar is §11.4's, deliberately.** Centre-out, right angles only, one
 * node per level, §11.4.2's three reveal states, §11.4.3's guide layer on tap,
 * and §11.4.5's purchase cue. §11.4.1 says so out loud — *"one board grammar,
 * learned once, used in two places"* — so this file is the tech board's shape
 * with a different set of nouns, and where it differs from `UpgradeBoard.tsx`
 * that is a decision rather than drift:
 *
 * | | Tech board | Here |
 * |---|---|---|
 * | Paid in | Cash | §13.13's points |
 * | Origin | Instant Messenger, granted | The Engineering trunk, owned by everybody |
 * | What varies per opener | Nothing — one board, one state | **Where this hero already is** (§13.9.1) |
 *
 * The last row is the whole point of the design. A player's first sight of this
 * board is a shape somebody already made, which is a far better tutorial than an
 * empty grid and a legend — and it is the beginning of an argument rather than
 * the end of one, because nothing stops Mo going down Cloud.
 *
 * ## Why it is a class diagram now
 *
 * The nodes were 58 px squares with a pixel icon in them, which is the right
 * node for a board whose nodes have one fact each. §4.14 gave every branch a
 * *second* fact — what it is worth to the rating as well as to the studio — and
 * a square that has to carry two numbers carries neither.
 *
 * So the board is drawn in the notation the player is being satirised for
 * knowing: UML class boxes with a stereotype, a name and an attribute
 * compartment, on right-angled Gliffy connectors with generalisation arrows
 * pointing the way the tree grows. `styles/diagram.css` argues the case at
 * length. It is bigger, so it zooms, and the zoom is the diagram-tool control
 * anybody who has opened one of these expects to find.
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import {
  BRANCH_BY_ID,
  BRANCH_DEFS,
  HERO_NODE_BY_ID,
  HERO_TREE,
  branchColour,
  connectorPath,
  heroBoardBounds,
  nodePoints,
  nodeWeight,
  type HeroTreeNode,
} from '../sim/heroTree.ts'
import { OWN_CHAIN_POINTS, heroMastery, heroNodeState, type HeroRuntime } from '../sim/heroRoster.ts'
import { RATING_WEIGHTS } from '../sim/rating.ts'
import { heroIcon } from '../render/heroIcons.ts'
import { buyHeroTreeNode } from '../game/store.ts'
import { playPurchase } from '../ui/uiSfx.ts'
import { connector, junctions, worldFor } from './diagramModel.ts'

import '../styles/diagram.css'
import '../styles/heroes.css'

/**
 * The grid, in CSS px — **and it is not square.**
 *
 * A class box is much wider than it is tall, so a square cell spaces the
 * east/west chains forty pixels apart and the north/south ones a hundred and
 * forty. Two axes means the gap between two boxes is about the same wherever
 * you are on the board, which is the only reason the right angles read as one
 * diagram rather than as two.
 */
const CELL_X = 200
const CELL_Y = 140
const NODE_W = 162
const NODE_H = 100

/** The zoom stops. A diagram tool has these; a board this size needs them. */
const ZOOMS = [0.55, 0.75, 1] as const

function PixelIcon({ grid, className }: { grid: readonly string[]; className?: string }) {
  const rects: Array<{ x: number; y: number }> = []
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === '#') rects.push({ x, y })
    }
  }
  return (
    <svg className={className} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={1} height={1} />
      ))}
    </svg>
  )
}

/**
 * The UML type name for a node — `QualityDepth4`, `EngineeringTrunk`.
 *
 * PascalCase because that is what a class is called, and the joke is only funny
 * if the notation is obeyed exactly. It is also the most compact honest label
 * available: the branch and the rung, in one word, at the width of a box.
 */
function typeName(node: HeroTreeNode): string {
  const branch = BRANCH_BY_ID.get(node.branch)?.name.replace(/[^A-Za-z]/g, '') ?? 'Node'
  if (node.depth === 0) return `${branch}Trunk`
  return `${branch}${node.kind === 'reach' ? 'Reach' : 'Depth'}${node.depth}`
}

export function HeroTree({
  hero,
  open,
  guided = false,
  onGuidedComplete,
  onClose,
}: {
  hero: HeroRuntime | null
  open: boolean
  guided?: boolean
  onGuidedComplete?: () => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  /**
   * §11.4.5 — the node that just resolved, for one frame of flash.
   *
   * Held here rather than derived from `owned`, because "owned" is true for
   * ever and the cue is about the *moment*. The pulse leaves along the
   * connectors and the adjacent nodes resolve out of silhouette as it reaches
   * them, so the reward for buying is watching the map grow.
   */
  const [flash, setFlash] = useState<string | null>(null)

  /*
   * §11.4.1 — the board is bigger than its viewport, so it **opens on the
   * centre**.
   *
   * Without this it opens at scroll (0, 0), which on a centre-out board is the
   * top-left corner of empty grid: the first thing the player sees of the
   * skill tree is a blank rectangle with their own name over it. The trunk is
   * the origin and the origin is the thing to look at.
   */
  /**
   * The board's geometry. Computed **above** the early return and the effect
   * that reads it, because a hook cannot live below a conditional return and
   * the scroll effect needs the origin to know where the trunk is.
   */
  const board = worldFor(heroBoardBounds(), CELL_X, CELL_Y, NODE_W, NODE_H, 1.1)

  const scroller = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = scroller.current
    if (!open || !el) return
    /*
     * **On the trunk, not on the middle of the world.**
     *
     * Those are different points and only the first is right. The board is
     * symmetric east-to-west and is not symmetric north-to-south — Support and
     * Cloud hang two cells below the centre and run eight further down — so
     * centring on the world's own middle opens the tree a full box below the
     * origin, with the top of the northern chain cut off by the frame. The
     * trunk is what §13.9 calls the centre and it is what the player is looking
     * for.
     */
    const x = (0 + board.originX) * CELL_X * zoom
    const y = (0 + board.originY) * CELL_Y * zoom
    el.scrollLeft = Math.max(0, x - el.clientWidth / 2)
    el.scrollTop = Math.max(0, y - el.clientHeight / 2)
  }, [open, zoom, board.originX, board.originY])

  if (!hero) return <Panel open={false} from="bottom" className="herotree"><span /></Panel>


  const paths = HERO_TREE.filter((n) => n.depth > 0).map((n) => ({
    node: n,
    path: connectorPath(n.id),
  }))
  const forks = junctions(
    paths.map((p) => p.path),
    board,
  )

  const selectedNode = selected ? HERO_NODE_BY_ID.get(selected) ?? null : null
  const selectedState = selected ? heroNodeState(hero, selected) : null
  const guidedNode = guided
    ? HERO_TREE
        .filter((node) => {
          const state = heroNodeState(hero, node.id)
          return state === 'live' && !hero.nodes.includes(node.id) && hero.points >= nodePoints(node.kind)
        })
        .sort((a, b) => nodePoints(a.kind) - nodePoints(b.kind) || a.id.localeCompare(b.id))[0] ?? null
    : null

  const nodeStyle = (node: HeroTreeNode) => ({
    left: (node.x + board.originX) * CELL_X - NODE_W / 2,
    top: (node.y + board.originY) * CELL_Y - NODE_H / 2,
    width: NODE_W,
    height: NODE_H,
    ['--branch' as string]: branchColour(node.branch),
  })

  /** §4.14's trait term, for this hero, right now — the rail's headline. */
  const mastery = heroMastery(hero)

  return (
    <Panel open={open} from="bottom" className="herotree">
      <div className="herotree__frame">
        <header className="herotree__head">
          <div className="herotree__ident">
            <span className="herotree__kicker">CAPABILITY MODEL // {hero.hero.id.toUpperCase()}</span>
            <h2 className="herotree__title">{hero.hero.name.toUpperCase()}</h2>
            <p className="herotree__role">{hero.hero.role}</p>
          </div>
          <div className="herotree__toolbar">
            {/*
              The zoom control a diagram tool has. Not a preference: at 100% the
              board is about 2,600 px across and the question "where does Cloud
              actually go" cannot be answered without one.
            */}
            <span className="herotree__toolbar-label">ZOOM</span>
            {ZOOMS.map((z) => (
              <button
                key={z}
                type="button"
                className="herotree__zoom"
                data-on={zoom === z ? 'true' : 'false'}
                onClick={() => setZoom(z)}
                aria-label={`Zoom to ${Math.round(z * 100)} per cent`}
                aria-pressed={zoom === z}
              >
                {Math.round(z * 100)}
              </button>
            ))}
            <span className="herotree__points" data-spare={hero.points > 0 ? 'true' : 'false'}>
              {`${hero.points} ${hero.points === 1 ? 'POINT' : 'POINTS'}`}
            </span>
          </div>
          {/* Inside the header for the reason the Management board's is — an
              optional sibling in a fixed-row grid moves every row below it. */}
          {guided && (
            <p className="board-teaching" role="status">
              <b>JAMES //</b> Open the pulsing node and spend one point. It changes this person immediately; then you are back on the floor.
            </p>
          )}
        </header>

        <div className="herotree__stage">
          <div className="herotree__scroll" ref={scroller}>
            <div
              className="herotree__world"
              style={{
                width: board.width * zoom,
                height: board.height * zoom,
                ['--zoom' as string]: zoom,
              }}
            >
              <div className="herotree__canvas" style={{ width: board.width, height: board.height }}>
                {/*
                  §11.4.2 — **a dark node still shows its connector.** The board's
                  shape is never hidden, only its contents: a player must always be
                  able to see that the branch they are on goes somewhere, or the tree
                  reads as finished and they stop looking at it.
                */}
                <svg
                  className="herotree__links gliffy"
                  viewBox={`0 0 ${board.width} ${board.height}`}
                  shapeRendering="crispEdges"
                  aria-hidden="true"
                >
                  {paths.map(({ node, path }) => {
                    const owned = hero.nodes.includes(node.id) ? 'true' : 'false'
                    return (
                      <polyline
                        key={node.id}
                        points={connector(path, board).line}
                        data-owned={owned}
                      />
                    )
                  })}
                  {/* Rule 3 — the fork Support and Cloud share on the way south. */}
                  {forks.map((p, i) => (
                    <circle key={i} className="gliffy__junction" cx={p.x} cy={p.y} r={4} />
                  ))}
                  {/* Rule 2 — generalisation arrows, in their own pass. */}
                  {paths.map(({ node, path }) => (
                    <polygon
                      key={`arrow-${node.id}`}
                      className="gliffy__arrow"
                      points={connector(path, board).arrow}
                      data-owned={hero.nodes.includes(node.id) ? 'true' : 'false'}
                    />
                  ))}
                </svg>

                {HERO_TREE.map((node) => {
                  const vis = heroNodeState(hero, node.id)
                  const grid = heroIcon(node.branch, node.kind)
                  const cost = nodePoints(node.kind)
                  const weight = nodeWeight(hero.branch, node.branch)
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className="herotree__node uml"
                      data-state={vis}
                      data-kind={node.kind}
                      data-flash={flash === node.id ? 'true' : 'false'}
                      data-guide={guidedNode?.id === node.id ? 'true' : 'false'}
                      style={nodeStyle(node)}
                      onClick={() => vis !== 'dark' && setSelected(node.id)}
                      /*
                        Unique, and a sentence a screen reader can say: two nodes of
                        one branch and kind are different purchases, and a label that
                        cannot tell them apart is a label that cannot be clicked.
                      */
                      aria-label={
                        vis === 'dark'
                          ? undefined
                          : node.depth === 0
                            ? 'Engineering trunk'
                            : `${BRANCH_BY_ID.get(node.branch)?.name} ${node.kind} ${node.depth}`
                      }
                    >
                      <span className="uml__head">
                        <span className="uml__stereo">
                          «{node.depth === 0 ? 'abstract' : node.kind}»
                        </span>
                        <span className="uml__name">
                          {grid && <PixelIcon grid={grid} className="herotree__icon" />}
                          {vis === 'dark' ? '████████' : typeName(node)}
                        </span>
                      </span>
                      {/*
                        §11.4.2's three states, in the compartment rather than in
                        the border alone. A dark node keeps its shape and loses its
                        contents, which is the rule stated in the one place a player
                        looks: the box itself.
                      */}
                      <span className="uml__body">
                        {vis === 'dark' ? (
                          <span className="uml__attr herotree__stub">
                            <span className="uml__vis">#</span> undisclosed
                          </span>
                        ) : (
                          <>
                            <span className="uml__attr">
                              <span className="uml__vis">+</span>
                              <span className="uml__text">{node.effect}</span>
                            </span>
                            <span className="uml__attr herotree__cost">
                              <span className="uml__vis">−</span>
                              {vis === 'owned' ? (
                                <b>owned</b>
                              ) : (
                                <>
                                  cost : <b>{cost} pt</b>
                                </>
                              )}
                              {weight < 1 && vis !== 'owned' && (
                                <em className="herotree__offbranch">·{Math.round(weight * 100)}%</em>
                              )}
                            </span>
                          </>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/*
            The inspector rail — the half of "there is much to show" that is not
            about the board being bigger.
            §13.9's board answers "what can this person become". Nothing on it
            answered "what is this person worth *now*", which is exactly the
            question §4.14's trait term made worth asking.
          */}
          <aside className="herotree__rail">
            <section className="herotree__panel">
              <h3 className="herotree__panel-title">INSTANCE</h3>
              <dl className="herotree__stats">
                <div>
                  <dt>branch</dt>
                  <dd style={{ color: branchColour(hero.branch) }}>
                    {BRANCH_BY_ID.get(hero.branch)?.name ?? hero.branch}
                  </dd>
                </div>
                <div>
                  <dt>level</dt>
                  <dd>{hero.progress.level}</dd>
                </div>
                <div>
                  <dt>spent</dt>
                  <dd>
                    {hero.spent} / {OWN_CHAIN_POINTS}
                  </dd>
                </div>
                <div>
                  <dt>reach</dt>
                  <dd>{hero.reachDevs.toLocaleString()} devs</dd>
                </div>
                <div>
                  <dt>posted</dt>
                  <dd>{hero.placement ? `rung ${hero.placement.rung}` : 'benched'}</dd>
                </div>
              </dl>
              {/*
                §4.14 — the trait term, per person, where the points are spent.
                A rating input the player cannot see the lever for is a rating
                input they will read as noise.
              */}
              <p className="herotree__mastery">
                <span>MATURITY</span>
                <span className="herotree__meter" aria-hidden="true">
                  <i style={{ width: `${Math.round(mastery * 100)}%` }} />
                </span>
                <b>{Math.round(mastery * 100)}%</b>
              </p>
              <p className="herotree__mastery-note">
                Posted, a fully developed hero is worth up to{' '}
                <b>{Math.round(RATING_WEIGHTS.traits * 100)} rating</b> across the bench.
              </p>
            </section>

            <section className="herotree__panel">
              <h3 className="herotree__panel-title">PACKAGES</h3>
              <ul className="herotree__legend">
                {BRANCH_DEFS.map((def) => (
                  <li key={def.branch} style={{ ['--branch' as string]: branchColour(def.branch) }}>
                    <span className="herotree__swatch" aria-hidden="true" />
                    <span className="herotree__legend-name">{def.branch}</span>
                    <span className="herotree__legend-weight">
                      {Math.round(nodeWeight(hero.branch, def.branch) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
              <p className="herotree__legend-note">
                §13.9.1 — nothing stops {hero.hero.name} going down another package. They are
                merely worse at it.
              </p>
            </section>
          </aside>
        </div>

        <footer className="herotree__footer">
          <Button onClick={onClose}>BACK</Button>
        </footer>
      </div>

      {/*
        §11.4.3 — **tapping a node opens it; it does not buy it.** A purchase
        that fires on the same tap that first shows the price is how a player
        buys the wrong thing on a phone, once, and stops trusting the screen.
      */}
      {selectedNode && selectedState && selectedState !== 'dark' && (
        <div className="herotree__guide" onClick={() => setSelected(null)}>
          <div
            className="herotree__guide-card uml"
            style={{ ['--branch' as string]: branchColour(selectedNode.branch) }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="uml__head">
              <span className="uml__stereo">«{selectedNode.kind}»</span>
              <span className="uml__name herotree__guide-name">{typeName(selectedNode)}</span>
            </span>
            <div className="uml__body">
              {heroIcon(selectedNode.branch, selectedNode.kind) && (
                <PixelIcon
                  grid={heroIcon(selectedNode.branch, selectedNode.kind)!}
                  className="herotree__guide-icon"
                />
              )}
              <p className="uml__attr herotree__guide-effect">
                <span className="uml__vis">+</span>
                {selectedNode.effect}
              </p>
              <p className="uml__attr">
                <span className="uml__vis">#</span>
                package : <b>{BRANCH_BY_ID.get(selectedNode.branch)?.name}</b>
              </p>
              <p className="uml__attr">
                <span className="uml__vis">−</span>
                cost : <b>{nodePoints(selectedNode.kind)} pt</b>
              </p>

              {/*
                §13.9.1, on the node the player is looking at — "she will be worse
                at it than Melany", said at the moment the decision is made rather
                than in a rule nobody reads. Nothing here refuses the purchase.
              */}
              {nodeWeight(hero.branch, selectedNode.branch) < 1 && (
                <p className="herotree__guide-off">
                  Not {hero.hero.name}&rsquo;s branch — worth{' '}
                  {Math.round(nodeWeight(hero.branch, selectedNode.branch) * 100)}% here.
                </p>
              )}

              {selectedState === 'owned' ? (
                <p className="herotree__guide-owned">OWNED</p>
              ) : (
                <Button
                  /*
                   * **Affordability, not just reachability.**
                   *
                   * This read `disabled={selectedState !== 'live'}` alone, and a
                   * REACH node costs three points against a DEPTH node's one — so
                   * a hero holding two points was shown a live, enabled button for
                   * a node they could not buy, and pressing it did nothing at all.
                   * `buyHeroTreeNode` returned false and the guide sat there.
                   *
                   * §26.1.8's walk found it as an intermittent failure at item 10
                   * — *"the point was not spent — the board still reads 2 POINTS"*
                   * — because which live off-branch node it reaches first depends
                   * on the board, so it only sometimes landed on a REACH. It was
                   * read as a flake twice. It is a dead control: §10.2a's rule is
                   * that a control a player has to be told about is not ready to
                   * be on screen, and one that looks ready and does nothing is
                   * worse than one that says why not.
                   */
                  disabled={selectedState !== 'live' || hero.points < nodePoints(selectedNode.kind)}
                  onClick={() => {
                    if (buyHeroTreeNode(hero.id, selectedNode.id)) {
                      playPurchase()
                      setFlash(selectedNode.id)
                      setSelected(null)
                      if (guided) onGuidedComplete?.()
                      window.setTimeout(() => setFlash(null), 420)
                    }
                  }}
                >
                  {/* One string, not two spans and a space: `Button` wraps each
                      child in its own element, and the accessible name of
                      `{n}{' '}{word}` comes out as "1POINT". */}
                  {hero.points < nodePoints(selectedNode.kind)
                    ? `NEEDS ${nodePoints(selectedNode.kind)}`
                    : `${nodePoints(selectedNode.kind)} ${nodePoints(selectedNode.kind) === 1 ? 'POINT' : 'POINTS'}`}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}
