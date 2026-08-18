import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import { TECH_TREE, type TechNode } from '../sim/techTree.ts'
import { boardBounds, connectors, ownedIds, visibilityOf } from '../sim/techBoard.ts'
import { techIcon } from '../render/techIcons.ts'
import { buyTech, getPermanent, techQuote } from '../game/store.ts'
import { formatMoney } from './hudModel.ts'
import { useGameState } from './useGameState.ts'
import { playPurchase } from '../ui/uiSfx.ts'
import { Kw } from './Kw.tsx'
import { ConceptText } from '../ui/ConceptText.tsx'

import '../styles/tech.css'

/**
 * The §11.4 upgrade board — GDD R33–R35, replacing the two-column `Upgrades`
 * drawer.
 *
 * The tree is a **board**, not a list. Instant Messenger sits at the centre and
 * every branch runs outward on a compass heading, connected by right-angle
 * lines. It is larger than the viewport and panned, which is how it is bigger
 * without a line of copy claiming to be — §10.6 forbids the interface that
 * announces its own size.
 *
 * §11.4.2's three reveal states are the whole point: a node you own is fully
 * legible, the next one is a silhouette with a price, and everything further
 * out is a connector and a stub. Buying one lights up the next, so the board
 * grows outward under the player instead of opening as a shop.
 */

/** Grid cell size, in CSS px. The board is drawn larger than its viewport. */
const CELL = 78
const NODE = 66

function PixelIcon({ grid, className }: { grid: readonly string[]; className?: string }) {
  const rects = useMemo(() => {
    const out: Array<{ x: number; y: number }> = []
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] === '#') out.push({ x, y })
      }
    }
    return out
  }, [grid])

  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={1} height={1} />
      ))}
    </svg>
  )
}

function NodeView({
  node,
  state,
  shifts,
  origin,
  onOpen,
}: {
  node: TechNode
  state: ReturnType<typeof useGameState>
  shifts: number
  /**
   * Where cell (0, 0) is, in cells from the world's top-left.
   *
   * **The same origin the connectors use, and it has to be passed in.** This
   * used to be the literal `1.5` — the padding — which is only the right answer
   * for a board whose top-left cell is (0, 0). §11's is not: `B4` sits three
   * cells west of Instant Messenger and `C2a` three cells north, so
   * `boardBounds` puts the origin at (4.5, 4.5) and every node here was drawn
   * three cells up and to the left of the line that was supposed to reach it.
   * See §11.4.1a for what that looked like.
   */
  origin: { x: number; y: number }
  onOpen: (id: string) => void
}) {
  const owned = ownedIds(state.tech)
  const vis = visibilityOf(node.id, state.tech, state.cash, shifts)
  const q = techQuote(node.id, state)
  const grid = techIcon(node.id)

  const style = {
    left: (node.x + origin.x) * CELL - NODE / 2,
    top: (node.y + origin.y) * CELL - NODE / 2,
  }

  return (
    <button
      type="button"
      className="upgrade-board__node"
      data-state={vis}
      data-owned={owned.has(node.id) ? 'true' : 'false'}
      style={style}
      onClick={() => vis !== 'dark' && onOpen(node.id)}
      aria-label={vis === 'dark' ? undefined : node.name}
    >
      {grid && <PixelIcon grid={grid} className="upgrade-board__icon" />}
      {vis === 'live' && <span className="upgrade-board__node-name">{node.name}</span>}
      {vis === 'silhouette' && q && <span className="upgrade-board__node-price">{formatMoney(q.cost)}</span>}
      {vis === 'dark' && <span className="upgrade-board__stub" />}
    </button>
  )
}

export function UpgradeBoard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useGameState()
  const shifts = getPermanent().meta.paradigmShifts
  const [selected, setSelected] = useState<string | null>(null)

  /**
   * §11.4.1 — the board is bigger than its viewport, so it **opens on Instant
   * Messenger**.
   *
   * `HeroTree` has carried this since the day it was written and this file
   * never had it, which is the half of §26.1.8 item 4 that survived the
   * coordinate fix: with the nodes finally in the same space as their
   * connectors, scroll (0, 0) is the top-left corner of empty grid and the
   * first thing a player sees of the studio's tech tree is a blank rectangle.
   * The origin is the thing to look at.
   *
   * Scrolled to the *centre node* rather than to the middle of the world,
   * because those are not the same point on a board whose branches are longer
   * to the east than to the west.
   */
  const scroller = useRef<HTMLDivElement | null>(null)

  const bounds = boardBounds()
  const pad = 1.5
  const worldW = (bounds.maxX - bounds.minX + pad * 2 + 1) * CELL
  const worldH = (bounds.maxY - bounds.minY + pad * 2 + 1) * CELL
  const ox = pad - bounds.minX
  const oy = pad - bounds.minY

  useEffect(() => {
    const el = scroller.current
    if (!open || !el) return
    el.scrollLeft = ox * CELL - el.clientWidth / 2
    el.scrollTop = oy * CELL - el.clientHeight / 2
  }, [open, ox, oy])

  const selectedNode = selected ? TECH_TREE.find((n) => n.id === selected) : null
  const selectedQuote = selected ? techQuote(selected, state) : null
  const selectedVis = selected ? visibilityOf(selected, state.tech, state.cash, shifts) : null

  return (
    <Panel open={open} from="right" className="hud__upgrades">
      <div className="upgrade-board">
        <div className="upgrade-board__head">
          <h2 className="hud__upgrades-title"><Kw kind="upgrades">UPGRADES</Kw></h2>
          <span className="tech__cash">{formatMoney(state.cash)}</span>
        </div>

        <div className="upgrade-board__scroll" ref={scroller}>
          <div className="upgrade-board__world" style={{ width: worldW, height: worldH }}>
            <svg className="upgrade-board__links" viewBox={`0 0 ${worldW} ${worldH}`} aria-hidden="true">
              {connectors().map((seg, i) => (
                <line
                  key={i}
                  x1={(seg.from.x + ox) * CELL}
                  y1={(seg.from.y + oy) * CELL}
                  x2={(seg.to.x + ox) * CELL}
                  y2={(seg.to.y + oy) * CELL}
                />
              ))}
            </svg>
            {TECH_TREE.map((node) => (
              <NodeView
                key={node.id}
                node={node}
                state={state}
                shifts={shifts}
                origin={{ x: ox, y: oy }}
                onOpen={setSelected}
              />
            ))}
          </div>
        </div>

        <div className="upgrade-board__footer">
          <Button onClick={onClose}>BACK</Button>
        </div>
      </div>

      {selectedNode && selectedQuote && selectedVis !== 'dark' && (
        <div className="upgrade-board__guide" onClick={() => setSelected(null)}>
          <div className="upgrade-board__guide-card" onClick={(e) => e.stopPropagation()}>
            {techIcon(selectedNode.id) && (
              <PixelIcon grid={techIcon(selectedNode.id)!} className="upgrade-board__guide-icon" />
            )}
            {selectedVis === 'live' && (
              <>
                <h3 className="upgrade-board__guide-name">{selectedNode.name}</h3>
                <p className="upgrade-board__guide-flavour"><ConceptText text={selectedNode.flavour} /></p>
                <p className="upgrade-board__guide-effect"><ConceptText text={selectedNode.effect} /></p>
              </>
            )}
            {selectedVis === 'silhouette' && (
              <p className="upgrade-board__guide-locked">
                One step from what you own. Buy your way here and it opens.
              </p>
            )}
            {selectedNode.granted ? (
              <p className="tech__node-granted">A GIFT FROM JAMES</p>
            ) : selectedVis === 'live' && !selectedQuote.maxed ? (
              <Button
                onClick={() => {
                  if (buyTech(selectedNode.id)) {
                    playPurchase()
                    setSelected(null)
                  }
                }}
                disabled={!selectedQuote.affordable}
              >
                {formatMoney(selectedQuote.cost)}
              </Button>
            ) : selectedQuote.maxed ? (
              <p className="tech__node-granted">OWNED</p>
            ) : null}
          </div>
        </div>
      )}
    </Panel>
  )
}
