import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'
import { TECH_BY_ID, TECH_TREE, techEffects, type TechNode } from '../sim/techTree.ts'
import { boardBounds, connectors, ownedIds, visibilityOf } from '../sim/techBoard.ts'
import { techIcon } from '../render/techIcons.ts'
import { buyTech, getPermanent, techQuote } from '../game/store.ts'
import { formatMoney } from './hudModel.ts'
import { useGameState } from './useGameState.ts'
import { Kw } from './Kw.tsx'
import { ConceptText } from '../ui/ConceptText.tsx'
import { PurchaseEffect } from './PurchaseEffect.tsx'
import { usePurchaseEffect } from './usePurchaseEffect.ts'
import { techEffectReceipt } from './upgradeEffectModel.ts'

import '../styles/diagram.css'
import '../styles/tech.css'

/** Same class-box dimensions and axis rhythm as the hero capability board. */
export const TECH_CELL_X = 200
export const TECH_CELL_Y = 140
export const TECH_NODE_W = 168
export const TECH_NODE_H = 104

const BRANCH_NAME = {
  protocol: 'CommunicationProtocol',
  culture: 'CultureProtocol',
  focus: 'FocusProtocol',
} as const

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
    <svg className={className} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      {rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={1} height={1} />)}
    </svg>
  )
}

function typeName(node: TechNode): string {
  const label = node.name.replace(/[^A-Za-z0-9]/g, '')
  return label || `${BRANCH_NAME[node.branch]}${node.id}`
}

function NodeView({
  node,
  state,
  shifts,
  origin,
  flash,
  onOpen,
}: {
  node: TechNode
  state: ReturnType<typeof useGameState>
  shifts: number
  origin: { x: number; y: number }
  flash: boolean
  onOpen: (id: string) => void
}) {
  const owned = ownedIds(state.tech)
  const vis = visibilityOf(node.id, state.tech, state.cash, shifts)
  const q = techQuote(node.id, state)
  const grid = techIcon(node.id)
  const style = {
    left: (node.x + origin.x) * TECH_CELL_X - TECH_NODE_W / 2,
    top: (node.y + origin.y) * TECH_CELL_Y - TECH_NODE_H / 2,
    width: TECH_NODE_W,
    height: TECH_NODE_H,
  }

  const contents = (
    <>
      <span className="uml__head">
        <span className="uml__stereo">«{node.granted ? 'instance' : node.branch}»</span>
        <span className="uml__name">
          {grid && <PixelIcon grid={grid} className="upgrade-board__icon" />}
          {vis === 'dark' ? '████████' : node.name}
        </span>
      </span>
      <span className="uml__body">
        {vis === 'dark' ? (
          <span className="uml__attr upgrade-board__stub"><span className="uml__vis">#</span> undisclosed</span>
        ) : vis === 'silhouette' ? (
          <>
            <span className="uml__attr"><span className="uml__vis">+</span> effect : ██████</span>
            <span className="uml__attr upgrade-board__node-price"><span className="uml__vis">−</span> cost : <b>{q ? formatMoney(q.cost) : '—'}</b></span>
          </>
        ) : (
          <>
            <span className="uml__attr"><span className="uml__vis">+</span><span className="uml__text">{node.effect}</span></span>
            <span className="uml__attr upgrade-board__node-price">
              <span className="uml__vis">−</span>
              {owned.has(node.id) ? <b>owned</b> : <>cost : <b>{q ? formatMoney(q.cost) : '—'}</b></>}
            </span>
          </>
        )}
      </span>
    </>
  )

  // An undisclosed node is map notation, not a control. Rendering it as a
  // button made a clipped, intentionally inert box look actionable to both
  // assistive technology and the small-frame hit-test gate.
  if (vis === 'dark') {
    return (
      <div
        className="upgrade-board__node uml"
        data-state={vis}
        data-owned="false"
        data-flash="false"
        style={style}
        aria-hidden="true"
      >
        {contents}
      </div>
    )
  }

  return (
    <button
      type="button"
      className="upgrade-board__node uml"
      data-state={vis}
      data-owned={owned.has(node.id) ? 'true' : 'false'}
      data-flash={flash ? 'true' : 'false'}
      style={style}
      onClick={() => onOpen(node.id)}
      aria-label={node.name}
    >
      {contents}
    </button>
  )
}

export function UpgradeBoard({
  open,
  guided = false,
  introNodeId = null,
  onIntroComplete,
  onGuidedComplete,
  onClose,
}: {
  open: boolean
  guided?: boolean
  introNodeId?: string | null
  onIntroComplete?: () => void
  onGuidedComplete?: () => void
  onClose: () => void
}) {
  const state = useGameState()
  const shifts = getPermanent().meta.paradigmShifts
  const [selected, setSelected] = useState<string | null>(null)
  const { effect: purchaseEffect, begin: beginPurchase } = usePurchaseEffect()
  const introduced = useRef<string | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)

  const bounds = boardBounds()
  const pad = 1.15
  const worldW = (bounds.maxX - bounds.minX + pad * 2) * TECH_CELL_X + TECH_NODE_W
  const worldH = (bounds.maxY - bounds.minY + pad * 2) * TECH_CELL_Y + TECH_NODE_H
  const ox = pad - bounds.minX + TECH_NODE_W / (2 * TECH_CELL_X)
  const oy = pad - bounds.minY + TECH_NODE_H / (2 * TECH_CELL_Y)

  useEffect(() => {
    const el = scroller.current
    if (!open || !el) return
    el.scrollLeft = Math.max(0, ox * TECH_CELL_X - el.clientWidth / 2)
    el.scrollTop = Math.max(0, oy * TECH_CELL_Y - el.clientHeight / 2)
  }, [open, ox, oy])

  /* James's last line is the purchase tap: open on B1 and prove the grant. */
  useEffect(() => {
    if (!open || !introNodeId || introduced.current === introNodeId) return
    const node = TECH_BY_ID.get(introNodeId)
    if (!node) return
    introduced.current = introNodeId
    const beforeLevels = { ...(state.tech ?? {}), [introNodeId]: 0 }
    beginPurchase(
      introNodeId,
      techEffectReceipt(node.name, techEffects(beforeLevels), techEffects(state.tech)),
      onIntroComplete,
    )
  }, [beginPurchase, introNodeId, onIntroComplete, open, state.tech])

  useEffect(() => {
    if (!introNodeId) introduced.current = null
  }, [introNodeId])

  const selectedNode = selected ? TECH_BY_ID.get(selected) ?? null : null
  const selectedQuote = selected ? techQuote(selected, state) : null
  const selectedVis = selected ? visibilityOf(selected, state.tech, state.cash, shifts) : null
  const effects = techEffects(state.tech)

  return (
    <OsWindow
      open={open}
      from="right"
      className="hud__upgrades"
      /* §11.4.1 — the board brings its own viewport, so the window gives up
         its padding and its scroll and points the rail at the board instead. */
      bodyClassName="os-window__body--flush"
      title={<Kw kind="upgrades">UPGRADES</Kw>}
      meta={<span className="tech__cash">{formatMoney(state.cash)}</span>}
      onClose={onClose}
      footer={
        guided ? (
          <p className="board-teaching" role="status">
            <b>JAMES //</b> Pick any lit node. One purchase clears the thread; then you are back on the floor.
          </p>
        ) : undefined
      }
    >
      <div className="upgrade-board">
        <div className="upgrade-board__stage">
          <div className="upgrade-board__scroll" ref={scroller} data-os-scroll>
            <div className="upgrade-board__world" style={{ width: worldW, height: worldH }}>
              <svg className="upgrade-board__links gliffy" viewBox={`0 0 ${worldW} ${worldH}`} shapeRendering="crispEdges" aria-hidden="true">
                {connectors().map((seg, i) => (
                  <line
                    key={i}
                    x1={(seg.from.x + ox) * TECH_CELL_X}
                    y1={(seg.from.y + oy) * TECH_CELL_Y}
                    x2={(seg.to.x + ox) * TECH_CELL_X}
                    y2={(seg.to.y + oy) * TECH_CELL_Y}
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
                  flash={purchaseEffect?.nodeId === node.id}
                  onOpen={setSelected}
                />
              ))}
            </div>
          </div>

          <aside className="upgrade-board__rail">
            {!purchaseEffect && (
              <section className="upgrade-board__panel">
                <h3>SYSTEM</h3>
                <dl>
                  <div><dt>communication load</dt><dd>{Math.round(100 / effects.devCapMultiplier)}%</dd></div>
                  <div><dt>entropy ceiling</dt><dd>{Math.round(effects.entropyCap * 100)}%</dd></div>
                  <div><dt>revenue</dt><dd>×{Number(effects.revenueMultiplier.toFixed(2))}</dd></div>
                  <div><dt>away from desk</dt><dd>{Math.round(effects.slackShare * 100)}%</dd></div>
                </dl>
              </section>
            )}
            <PurchaseEffect effect={purchaseEffect} />
            {!purchaseEffect && (
              <section className="upgrade-board__panel upgrade-board__panel--hint">
                <h3>EFFECT INSPECTOR</h3>
                <p>Purchase a node to see its exact before × factor = after result here.</p>
              </section>
            )}
          </aside>
        </div>

        {selectedNode && selectedQuote && selectedVis !== 'dark' && (
          <div className="upgrade-board__guide" onClick={() => setSelected(null)}>
            <div className="upgrade-board__guide-card uml" onClick={(event) => event.stopPropagation()}>
              <span className="uml__head">
                <span className="uml__stereo">«{selectedNode.branch}»</span>
                <span className="uml__name upgrade-board__guide-name">{typeName(selectedNode)}</span>
              </span>
              <div className="uml__body">
                {techIcon(selectedNode.id) && <PixelIcon grid={techIcon(selectedNode.id)!} className="upgrade-board__guide-icon" />}
                {selectedVis === 'live' ? (
                  <>
                    <p className="uml__attr upgrade-board__guide-effect"><span className="uml__vis">+</span><ConceptText text={selectedNode.effect} /></p>
                    <p className="uml__attr upgrade-board__guide-flavour"><span className="uml__vis">#</span><ConceptText text={selectedNode.flavour} /></p>
                  </>
                ) : (
                  <p className="upgrade-board__guide-locked">One step from what you own. Buy your way here and it opens.</p>
              )}
              {selectedNode.granted ? (
                <p className="tech__node-granted">A GIFT FROM JAMES</p>
              ) : selectedVis === 'live' && !selectedQuote.maxed ? (
                <Button
                  onClick={() => {
                    const before = techEffects(state.tech)
                    if (!buyTech(selectedNode.id)) return
                    const after = techEffects({ ...(state.tech ?? {}), [selectedNode.id]: selectedQuote.level + 1 })
                    beginPurchase(
                      selectedNode.id,
                      techEffectReceipt(selectedNode.name, before, after),
                      guided ? onGuidedComplete : undefined,
                    )
                    setSelected(null)
                  }}
                  disabled={!selectedQuote.affordable}
                >
                  {formatMoney(selectedQuote.cost)}
                </Button>
              ) : selectedQuote.maxed ? <p className="tech__node-granted">OWNED</p> : null}
            </div>
          </div>
        </div>
        )}
      </div>
    </OsWindow>
  )
}
