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
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import {
  BRANCH_BY_ID,
  HERO_NODE_BY_ID,
  HERO_TREE,
  branchColour,
  connectorPath,
  heroBoardBounds,
  nodePoints,
  nodeWeight,
  type HeroTreeNode,
} from '../sim/heroTree.ts'
import { heroNodeState, type HeroRuntime } from '../sim/heroRoster.ts'
import { heroIcon } from '../render/heroIcons.ts'
import { buyHeroTreeNode } from '../game/store.ts'
import { playPurchase } from '../ui/uiSfx.ts'

import '../styles/heroes.css'

/**
 * Grid cell size in CSS px. The board is drawn larger than its viewport.
 *
 * Smaller than `UpgradeBoard`'s 78 because this board is bigger: five chains of
 * six against §11's four short branches. At 78 the first thing a player saw of
 * it was the trunk and two nodes, which is a keyhole rather than a map.
 */
const CELL = 62
const NODE = 50

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

export function HeroTree({
  hero,
  open,
  onClose,
}: {
  hero: HeroRuntime | null
  open: boolean
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
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
  const scroller = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = scroller.current
    if (!open || !el) return
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2
  }, [open])

  if (!hero) return <Panel open={false} from="bottom" className="herotree"><span /></Panel>

  const bounds = heroBoardBounds()
  const pad = 1.5
  const worldW = (bounds.maxX - bounds.minX + pad * 2 + 1) * CELL
  const worldH = (bounds.maxY - bounds.minY + pad * 2 + 1) * CELL
  const ox = pad - bounds.minX
  const oy = pad - bounds.minY

  const selectedNode = selected ? HERO_NODE_BY_ID.get(selected) ?? null : null
  const selectedState = selected ? heroNodeState(hero, selected) : null

  const nodeStyle = (node: HeroTreeNode) => ({
    left: (node.x + ox) * CELL - NODE / 2,
    top: (node.y + oy) * CELL - NODE / 2,
    ['--branch' as string]: branchColour(node.branch),
  })

  return (
    <Panel open={open} from="bottom" className="herotree">
      <div className="herotree__frame">
        <header className="herotree__head">
          <h2 className="herotree__title">{hero.hero.name.toUpperCase()}</h2>
          <span className="herotree__points" data-spare={hero.points > 0 ? 'true' : 'false'}>
            {`${hero.points} ${hero.points === 1 ? 'POINT' : 'POINTS'}`}
          </span>
        </header>

        <div className="herotree__scroll" ref={scroller}>
          <div className="herotree__world" style={{ width: worldW, height: worldH }}>
            {/*
              §11.4.2 — **a dark node still shows its connector.** The board's
              shape is never hidden, only its contents: a player must always be
              able to see that the branch they are on goes somewhere, or the tree
              reads as finished and they stop looking at it.
            */}
            <svg className="herotree__links" viewBox={`0 0 ${worldW} ${worldH}`} aria-hidden="true">
              {HERO_TREE.filter((n) => n.depth > 0).map((n) => (
                <polyline
                  key={n.id}
                  points={connectorPath(n.id)
                    .map((p) => `${(p.x + ox) * CELL},${(p.y + oy) * CELL}`)
                    .join(' ')}
                  data-owned={hero.nodes.includes(n.id) ? 'true' : 'false'}
                />
              ))}
            </svg>

            {HERO_TREE.map((node) => {
              const vis = heroNodeState(hero, node.id)
              const grid = heroIcon(node.branch, node.kind)
              const cost = nodePoints(node.kind)
              return (
                <button
                  key={node.id}
                  type="button"
                  className="herotree__node"
                  data-state={vis}
                  data-kind={node.kind}
                  data-flash={flash === node.id ? 'true' : 'false'}
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
                  {grid && <PixelIcon grid={grid} className="herotree__icon" />}
                  {vis === 'silhouette' && <span className="herotree__cost">{cost}</span>}
                  {vis === 'dark' && <span className="herotree__stub" />}
                </button>
              )
            })}
          </div>
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
            className="herotree__guide-card"
            style={{ ['--branch' as string]: branchColour(selectedNode.branch) }}
            onClick={(e) => e.stopPropagation()}
          >
            {heroIcon(selectedNode.branch, selectedNode.kind) && (
              <PixelIcon
                grid={heroIcon(selectedNode.branch, selectedNode.kind)!}
                className="herotree__guide-icon"
              />
            )}
            <h3 className="herotree__guide-name">
              {BRANCH_BY_ID.get(selectedNode.branch)?.name.toUpperCase()} · {selectedNode.kind.toUpperCase()}
            </h3>
            <p className="herotree__guide-effect">{selectedNode.effect}</p>

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
                disabled={selectedState !== 'live'}
                onClick={() => {
                  if (buyHeroTreeNode(hero.id, selectedNode.id)) {
                    playPurchase()
                    setFlash(selectedNode.id)
                    setSelected(null)
                    window.setTimeout(() => setFlash(null), 420)
                  }
                }}
              >
                {/* One string, not two spans and a space: `Button` wraps each
                    child in its own element, and the accessible name of
                    `{n}{' '}{word}` comes out as "1POINT". */}
                {`${nodePoints(selectedNode.kind)} ${nodePoints(selectedNode.kind) === 1 ? 'POINT' : 'POINTS'}`}
              </Button>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}
