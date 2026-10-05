/**
 * One person's upgrades, drawn — GDD §8 [2026-09-26, visual first].
 *
 * The rebuild's approved demo, redrawn as a STUDIO_OS window: the isometric
 * board is `hud/isoBoard.ts` painted into a pixel buffer, and the inspector is
 * the demo's detail card set in the terminal face. The demo's Ledger card and
 * era switch are not here: the era is the studio's, and the Ledger is its own
 * phase.
 *
 * **One tree at a time, opened from that person's card** [amended later on
 * 2026-09-26]. The first cut had its own TREES door and a row of heads along
 * the bottom to switch between all five, and the answer was: *"what even is a
 * tree? Didn't we have a upgrade button before?"*, *"it should be opened by
 * heroes info page"*, *"I don't want the heroes tray"* and *"upgrades should
 * be shown per heroes introduction, not all trees at once"*. So the door is
 * UPGRADES on the person's card (`HeroCard.tsx`, and the founder's panel for
 * yours), it opens after the first Paradigm Shift (`unlocks.trees`), and a
 * tile that belongs to somebody else's tree says so rather than taking you
 * there.
 *
 * **Most of this does nothing yet, and the window says so** — `sim/upgradeTrees.ts`
 * has why. Serena's pipeline nodes are the real ones, bought through the
 * pipeline; everything else is priced from the one wallet and marked NOT IN
 * THE GAME YET, so a purchase is a choice made knowing it.
 *
 * The board is dragged to pan, wheeled or pinched to zoom by whole device
 * pixels, and tapped to select; arrows walk it and Enter buys (the demo's
 * keyboard, kept).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { OsWindow } from '../ui/OsWindow.tsx'
import { Button } from '../ui/Button.tsx'
import { formatMoney } from './hudModel.ts'
import { purchaseHaptic } from '../audio/haptics.ts'
import {
  buyTreeNode,
  treeLevelOf,
  treePriceOf,
  treeRefusalOf,
  treeTileState,
  treeView,
  type GameState,
} from '../game/store.ts'
import {
  SLICE_NAME,
  TREES,
  TREE_HERO_DEFS,
  closedBy,
  levelOf,
  ownedIn,
  treeNode,
  type TreeHero,
  type TreeNode,
  type TreeRefusal,
} from '../sim/upgradeTrees.ts'
import { ERAS } from '../sim/eras.ts'
import { Raster, iso, pack, paintBoard, pickNode, treeBounds, P, type BoardNode, type Ink } from './isoBoard.ts'

import '../styles/trees.css'

const ZOOM_MIN = 1
const ZOOM_MAX = 8
/** How far a press may travel and still be a tap rather than a pan, in CSS px. */
const TAP_SLOP = 5
/** The pulse on a tile you can buy: two phosphor steps, flipped this often. */
const BLINK_MS = 450

// --- ink --------------------------------------------------------------------

function hexOf(value: string, fallback: string): string {
  const v = value.trim()
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback
}

/** The live phosphor and the neutral ramp, read off the glass each paint: the hue follows entropy. */
function readInk(el: HTMLElement): Ink {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: string) => pack(hexOf(css.getPropertyValue(name), fallback))
  const neutral = ['#14121a', '#241f2e', '#3a3244', '#55495e', '#736579', '#968a96', '#b8aeb3', '#d8d2cf', '#f2eee8']
  return {
    p: [v('--p0', '#0a2a30'), v('--p1', '#1a6b78'), v('--p2', '#35c9d9'), v('--p3', '#b8f4ff')],
    n: neutral.map((hex, i) => v(`--n${i}`, hex)),
  }
}

// --- words --------------------------------------------------------------------

function eraName(era: number): string {
  return ERAS[Math.min(Math.max(0, era), ERAS.length - 1)].label.toUpperCase()
}

function refusalLine(hero: TreeHero, node: TreeNode, why: TreeRefusal, s: GameState): string | null {
  switch (why) {
    case null: return null
    case 'root': return 'WHERE THIS TREE STARTS'
    case 'link': return null
    case 'unbuilt': return 'NOT BUILT YET — NOTHING TO BUY'
    case 'maxed': return node.max > 1 ? 'ALL LEVELS OWNED' : 'OWNED'
    case 'era': return `OPENS AT ${eraName(node.era)}`
    case 'fork': {
      const other = closedBy(treeView(s), hero, node)
      return other ? `CLOSED: YOU CHOSE ${other.name.toUpperCase()}` : 'CLOSED BY A CHOICE'
    }
    case 'requires': return node.all ? 'NEEDS EVERY LINK' : 'NEEDS ONE LINK'
    case 'cash': return 'NOT ENOUGH CASH'
    case 'absent': return `${TREE_HERO_DEFS[hero].name.toUpperCase()} HAS NOT ARRIVED`
  }
}

/** The proposal a node makes, in the demo's words, for the nodes that do not do it yet. */
function proposal(node: TreeNode): string[] {
  const out: string[] = []
  const per = node.max > 1 ? ' per level' : ''
  if (node.move) {
    const amount = node.move.share !== undefined ? `${Math.round(node.move.share * 100)}% of` : `${node.move.units}`
    out.push(`Moves ${amount} loss${per}: ${SLICE_NAME[node.move.from]} → ${SLICE_NAME[node.move.to]}. Nothing is removed.`)
  }
  if (node.breakthrough) out.push(`Breakthrough: deletes 70% of whatever sits in ${SLICE_NAME[node.breakthrough]}, now and later.`)
  if (node.coord) out.push(`Coordination +${node.coord}${per}: raises k and the developer cap together.`)
  return out
}

// --- the window -----------------------------------------------------------------

export interface UpgradeTreesProps {
  open: boolean
  state: GameState
  /** Whose tree. The window shows this one and no other. */
  hero: TreeHero
  /**
   * A node to open on, selected — James's scene opens his tree on Instant
   * Messenger, which is how the trees are introduced (§21.6).
   */
  intro?: string | null
  /** One line of instruction over the board, while a scene has asked for something. */
  note?: string | null
  onClose: () => void
}

export function UpgradeTrees({ open, state, hero, intro = null, note = null, onClose }: UpgradeTreesProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [openedOn, setOpenedOn] = useState<TreeHero | null>(null)

  // Adjusting state to a prop, during render (React's own pattern): a fresh
  // door, or somebody else's card, starts with nothing selected.
  const key = open ? hero : null
  if (key !== openedOn) {
    setOpenedOn(key)
    if (key) {
      setSelected(intro)
      setShowKey(false)
    }
  }

  // The sheet holds one thing: a selection, or the key.
  const select = useCallback((id: string | null) => {
    setSelected(id)
    if (id) setShowKey(false)
  }, [])

  const def = TREE_HERO_DEFS[hero]
  const c = useMemo(() => {
    const v = treeView(state)
    const real = TREES[hero].filter((n) => n.kind !== 'root' && n.kind !== 'link')
    const keys = real.filter((n) => n.kind === 'key')
    return {
      owned: real.filter((n) => levelOf(v, hero, n) > 0).length,
      total: real.length,
      keys: keys.length,
      keysOwned: keys.filter((n) => levelOf(v, hero, n) > 0).length,
    }
  }, [hero, state])

  return (
    <OsWindow
      open={open}
      from="centre"
      modal
      title={hero === 'you' ? 'UPGRADES // YOU' : `UPGRADES // ${def.name.toUpperCase()}`}
      meta={<span className="trees__cash">{formatMoney(state.cash)}</span>}
      onClose={onClose}
      className="trees-frame"
      bodyClassName="trees"
    >
      <div className="trees__stage">
        <header className="trees__who">
          <h3 className="trees__name">
            {def.name} <span className="trees__role">{def.role.toUpperCase()}</span>
          </h3>
          <p className="trees__line">{def.line}</p>
          <p className="trees__progress">
            <b>{c.owned}</b> OF {c.total} OWNED · {c.keysOwned}/{c.keys} BREAKTHROUGH{c.keys === 1 ? '' : 'S'}
          </p>
          {note && <p className="board-teaching" role="status">{note}</p>}
        </header>
        {open && (
          <Board
            hero={hero}
            state={state}
            selected={selected}
            onSelect={select}
            onKey={() => {
              setSelected(null)
              setShowKey((was) => !was)
            }}
          />
        )}
      </div>
      <Inspector
        hero={hero}
        id={selected}
        showKey={showKey}
        state={state}
        onClear={() => {
          setSelected(null)
          setShowKey(false)
        }}
      />
    </OsWindow>
  )
}

// --- the board ------------------------------------------------------------------

interface Camera {
  /** Device px per board px. */
  z: number
  /** The tree origin's offset from the canvas centre, in board px. */
  x: number
  y: number
}

function Board({ hero, state, selected, onSelect, onKey }: {
  hero: TreeHero
  state: GameState
  selected: string | null
  onSelect: (id: string | null) => void
  onKey: () => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const cam = useRef<Camera>({ z: 1, x: 0, y: 0 })
  const [size, setSize] = useState<{ w: number; h: number; dpr: number } | null>(null)
  const [view, setView] = useState(0)
  const [hover, setHover] = useState<string | null>(null)
  const [blink, setBlink] = useState(false)
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: number; id: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; z: number } | null>(null)

  const nodes = useMemo<BoardNode[]>(() => {
    const v = treeView(state)
    return TREES[hero].map((node) => ({ node, state: treeTileState(hero, node.id, state), level: levelOf(v, hero, node) }))
  }, [hero, state])
  const pulsing = nodes.some((b) => b.state === 'live' || b.state === 'partial+')

  // The stage's size, in CSS and device px.
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight, dpr: window.devicePixelRatio || 1 })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** Frame the whole tree at the largest whole zoom that holds it. The camera is a ref: this paints nothing. */
  const frame = useCallback(() => {
    if (!size) return
    const b = treeBounds(hero)
    const devW = size.w * size.dpr
    const devH = size.h * size.dpr
    const z = Math.floor(Math.min(devW / (b.maxX - b.minX), devH / (b.maxY - b.minY)))
    cam.current = { z: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z || 1)), x: -(b.minX + b.maxX) / 2, y: -(b.minY + b.maxY) / 2 }
  }, [hero, size])
  // Which tree on which stage the camera was last framed for: a new tree, or a
  // new stage (a turned phone), is framed whole before it is painted.
  const framedFor = useRef('')
  const shownFor = useRef<string | null>(null)

  /**
   * On a phone the inspector is a sheet over the board, and the node it is
   * about must not be under it. Read after the sheet has laid out, so the
   * free region is measured rather than restated from the stylesheet.
   */
  const keepClear = useCallback((id: string) => {
    const host = wrap.current
    const node = treeNode(hero, id)
    if (!host || !node || !size) return
    const board = host.getBoundingClientRect()
    const sheet = host.closest('.trees')?.querySelector('.trees__inspector')?.getBoundingClientRect()
    let right = board.width
    let bottom = board.height
    if (sheet && sheet.width > 0 && sheet.left > board.left + 1 && sheet.left < board.right) right = sheet.left - board.left
    else if (sheet && sheet.height > 0 && sheet.top > board.top + 1 && sheet.top < board.bottom) bottom = sheet.top - board.top
    const { z } = cam.current
    const W = (size.w * size.dpr) / z
    const H = (size.h * size.dpr) / z
    const [bx, by] = iso(node.x, node.y)
    const x = ((bx + W / 2 + cam.current.x) * z) / size.dpr
    const y = ((by + H / 2 + cam.current.y) * z) / size.dpr
    const margin = 36
    if (x > margin && x < right - margin && y > margin && y < bottom - margin) return
    // Centre it in what is left.
    cam.current = {
      z,
      x: cam.current.x + ((right / 2 - x) * size.dpr) / z,
      y: cam.current.y + ((bottom / 2 - y) * size.dpr) / z,
    }
  }, [hero, size])

  const fit = () => {
    frame()
    setTip(null)
    setView((n) => n + 1)
  }

  useEffect(() => {
    if (!pulsing || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => setBlink((b) => !b), BLINK_MS)
    return () => window.clearInterval(t)
  }, [pulsing])

  // Paint.
  useEffect(() => {
    const el = canvas.current
    const host = wrap.current
    if (!el || !host || !size) return
    const framing = `${hero}:${size.w}x${size.h}@${size.dpr}`
    if (framedFor.current !== framing) {
      framedFor.current = framing
      frame()
    }
    if (selected !== shownFor.current) {
      shownFor.current = selected
      if (selected) keepClear(selected)
    }
    const { z } = cam.current
    const W = Math.max(1, Math.ceil((size.w * size.dpr) / z))
    const H = Math.max(1, Math.ceil((size.h * size.dpr) / z))
    if (el.width !== W) el.width = W
    if (el.height !== H) el.height = H
    el.style.width = `${(W * z) / size.dpr}px`
    el.style.height = `${(H * z) / size.dpr}px`
    const ctx = el.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(W, H)
    const r = new Raster(W, H, new Uint32Array(image.data.buffer))
    paintBoard(r, {
      hero,
      nodes,
      selected,
      hover,
      blink,
      ink: readInk(host),
      ox: Math.round(W / 2 + cam.current.x),
      oy: Math.round(H / 2 + cam.current.y),
    })
    ctx.putImageData(image, 0, 0)
  }, [hero, nodes, selected, hover, blink, size, view, frame, keepClear])

  /** A client point, as board px from the tree's origin. */
  const toBoard = (clientX: number, clientY: number): [number, number] | null => {
    const el = canvas.current
    if (!el || !size) return null
    const rect = el.getBoundingClientRect()
    const { z, x, y } = cam.current
    const W = el.width
    const H = el.height
    const bx = ((clientX - rect.left) * size.dpr) / z - Math.round(W / 2 + x)
    const by = ((clientY - rect.top) * size.dpr) / z - Math.round(H / 2 + y)
    return [bx, by]
  }

  /** A board point, as CSS px within the stage. */
  const toStage = (bx: number, by: number): [number, number] => {
    const el = canvas.current
    if (!el || !size) return [0, 0]
    const { z, x, y } = cam.current
    return [((bx + Math.round(el.width / 2 + x)) * z) / size.dpr, ((by + Math.round(el.height / 2 + y)) * z) / size.dpr]
  }

  const zoomAt = (nz: number, clientX?: number, clientY?: number) => {
    const el = canvas.current
    if (!el || !size) return
    nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nz))
    const c = cam.current
    if (nz === c.z) return
    const rect = el.getBoundingClientRect()
    const px = ((clientX ?? rect.left + size.w / 2) - rect.left) * size.dpr
    const py = ((clientY ?? rect.top + size.h / 2) - rect.top) * size.dpr
    // Keep the board point under the pointer where it is.
    const W0 = (size.w * size.dpr) / c.z
    const H0 = (size.h * size.dpr) / c.z
    const wx = px / c.z - W0 / 2 - c.x
    const wy = py / c.z - H0 / 2 - c.y
    const W1 = (size.w * size.dpr) / nz
    const H1 = (size.h * size.dpr) / nz
    cam.current = { z: nz, x: px / nz - W1 / 2 - wx, y: py / nz - H1 / 2 - wy }
    setTip(null)
    setView((n) => n + 1)
  }

  const showTip = (node: TreeNode | null) => {
    if (!node) {
      setTip(null)
      return
    }
    const [bx, by] = iso(node.x, node.y)
    const [x, y] = toStage(bx, by - P * 0.75)
    setTip({ id: node.id, x, y })
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, cx: cam.current.x, cy: cam.current.y, moved: 0, id: e.pointerId }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.current.z }
      drag.current = null
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.current.d)
      zoomAt(Math.round(pinch.current.z * ratio), (a.x + b.x) / 2, (a.y + b.y) / 2)
      return
    }
    const d = drag.current
    if (d && d.id === e.pointerId && size) {
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      d.moved = Math.max(d.moved, Math.hypot(dx, dy))
      if (d.moved > TAP_SLOP) {
        cam.current = { ...cam.current, x: d.cx + (dx * size.dpr) / cam.current.z, y: d.cy + (dy * size.dpr) / cam.current.z }
        setTip(null)
        setView((n) => n + 1)
        return
      }
    }
    if (e.pointerType === 'mouse' && !d) {
      const at = toBoard(e.clientX, e.clientY)
      const node = at ? pickNode(hero, at[0], at[1]) : null
      setHover(node?.id ?? null)
      showTip(node)
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    const d = drag.current
    if (d && d.id === e.pointerId && d.moved <= TAP_SLOP && e.type === 'pointerup') {
      const at = toBoard(e.clientX, e.clientY)
      const node = at ? pickNode(hero, at[0], at[1]) : null
      onSelect(node?.id ?? null)
    }
    if (pointers.current.size === 0) drag.current = null
  }

  // The wheel has to be a native listener: React's is passive, and a passive
  // wheel cannot stop the page scrolling under the board.
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(cam.current.z + (e.deltaY < 0 ? 1 : -1), e.clientX, e.clientY)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  })

  const onKeyDown = (e: React.KeyboardEvent) => {
    const tree = TREES[hero]
    const cur = (selected && treeNode(hero, selected)) || tree.find((n) => n.kind === 'root')!
    // The demo's arrows: screen directions on the iso board.
    const dirs: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const dir = dirs[e.key]
    if (dir) {
      e.preventDefault()
      const [sx, sy] = iso(cur.x, cur.y)
      let best: TreeNode | null = null
      let score = Infinity
      for (const n of tree) {
        if (n === cur) continue
        const [x, y] = iso(n.x, n.y)
        const vx = x - sx
        const vy = (y - sy) * 2
        const along = vx * dir[0] + vy * dir[1]
        if (along <= 0) continue
        const s = Math.hypot(vx, vy) - along * 0.5
        if (s < score) { score = s; best = n }
      }
      if (best) onSelect(best.id)
      return
    }
    if (e.key === 'Enter' && selected) {
      e.preventDefault()
      if (buyTreeNode(hero, selected)) purchaseHaptic()
    }
    if (e.key === '+' || e.key === '=') zoomAt(cam.current.z + 1)
    if (e.key === '-') zoomAt(cam.current.z - 1)
  }

  const tipNode = tip ? treeNode(hero, tip.id) : null
  const tipPrice = tipNode ? treePriceOf(hero, tipNode.id, state) : null

  return (
    <div className="trees__board" ref={wrap}>
      <canvas
        ref={canvas}
        className="trees__canvas"
        tabIndex={0}
        role="application"
        aria-label={`${TREE_HERO_DEFS[hero].name}'s upgrade tree. Arrow keys move between nodes; Enter buys.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          setHover(null)
          setTip(null)
        }}
        onKeyDown={onKeyDown}
      />
      {tipNode && tip && (
        <span className="trees__tip" style={{ left: tip.x, top: tip.y }}>
          {tipNode.name}
          {tipPrice !== null && tipNode.kind !== 'link' && <small> · {formatMoney(tipPrice)}</small>}
        </span>
      )}
      <div className="trees__zoom">
        <Button className="trees__zoom-btn" aria-label="How to read the tree" onClick={onKey}>KEY</Button>
        <Button className="trees__zoom-btn" aria-label="Zoom out" onClick={() => zoomAt(cam.current.z - 1)}>-</Button>
        <Button className="trees__zoom-btn" aria-label="Fit the tree" onClick={fit}>FIT</Button>
        <Button className="trees__zoom-btn" aria-label="Zoom in" onClick={() => zoomAt(cam.current.z + 1)}>+</Button>
      </div>
    </div>
  )
}

// --- the inspector --------------------------------------------------------------

function Inspector({ hero, id, showKey, state, onClear }: {
  hero: TreeHero
  id: string | null
  showKey: boolean
  state: GameState
  onClear: () => void
}) {
  const node = id ? treeNode(hero, id) : undefined
  if (!node) {
    return (
      <aside className="trees__inspector" data-empty={!showKey}>
        <p className="trees__eyebrow">HOW TO READ IT</p>
        <ul className="trees__key">
          <li><i data-tile="owned" />OWNED</li>
          <li><i data-tile="live" />CAN BUY NOW</li>
          <li><i data-tile="short" />OPEN, NOT ENOUGH CASH</li>
          <li><i data-tile="locked" />NEEDS THE NODE BEFORE IT</li>
          <li><i data-tile="key" />BREAKTHROUGH</li>
          <li><i data-tile="link" />A NODE IN SOMEONE ELSE’S TREE</li>
        </ul>
        <p className="trees__note">
          Dots where links arrive: needs every one. A dashed rule with a diamond: pick one, and the other closes. Pips are levels.
        </p>
        <p className="trees__note trees__note--warn">
          Only Serena’s pipeline is in the game yet. The other nodes can be bought and do nothing; the economy they belong to is being reworked.
        </p>
        <div className="trees__act">
          <Button className="trees__deselect" onClick={onClear}>BACK</Button>
        </div>
      </aside>
    )
  }

  if (node.kind === 'link' && node.to) {
    const target = treeNode(node.to.hero, node.to.id)!
    const on = ownedIn(treeView(state), node.to.hero, node.to.id)
    const owner = TREE_HERO_DEFS[node.to.hero].name
    return (
      <aside className="trees__inspector">
        <p className="trees__eyebrow">IN {owner.toUpperCase()}’S TREE</p>
        <h3 className="trees__title">{target.name}</h3>
        <p className="trees__text">{target.text}</p>
        <p className="trees__req" data-ok={on}>{on ? '+ OWNED' : '- NOT OWNED YET'} · {eraName(target.era)}</p>
        <p className="trees__note">Bought from {owner}’s card.</p>
        <div className="trees__act">
          <Button className="trees__deselect" onClick={onClear}>BACK</Button>
        </div>
      </aside>
    )
  }

  const v = treeView(state)
  const level = treeLevelOf(hero, node.id, state)
  const why = treeRefusalOf(hero, node.id, state)
  const price = treePriceOf(hero, node.id, state)
  const refusal = refusalLine(hero, node, why, state)
  const lines = node.wired || node.coord || node.lever ? [] : proposal(node)
  const others = node.fork ? TREES[hero].filter((o) => o !== node && o.fork === node.fork) : []

  return (
    <aside className="trees__inspector">
      <p className="trees__eyebrow">
        {TREE_HERO_DEFS[hero].name.toUpperCase()} · {node.kind === 'root' ? 'THE START' : eraName(node.era)}
      </p>
      <h3 className="trees__title">{node.name}</h3>
      <p className="trees__tags">
        {node.max > 1 && <span className="trees__tag">LEVEL {level}/{node.max}</span>}
        {node.kind === 'key' && <span className="trees__tag" data-kind="key">BREAKTHROUGH</span>}
        {node.kind === 'launch' && <span className="trees__tag" data-kind="key">LAUNCH</span>}
        {node.fork && <span className="trees__tag">PICK ONE</span>}
        {node.all && <span className="trees__tag">NEEDS EVERY LINK</span>}
      </p>
      <p className="trees__text">{node.text}</p>
      {(node.wired || node.tech || node.coord || node.lever) && node.effect && <p className="trees__effect">{node.effect}</p>}
      {!node.wired && !node.tech && !node.coord && !node.lever && node.kind !== 'root' && (
        <div className="trees__effect" data-wired="false">
          {lines.map((l) => <p key={l}>{l}</p>)}
          <p className="trees__unwired">NOT IN THE GAME YET</p>
        </div>
      )}
      {(node.parents.length > 0 || others.length > 0) && (
        <ul className="trees__reqs">
          {node.parents.map((pid) => {
            const p = treeNode(hero, pid)
            const ok = ownedIn(v, hero, pid)
            return <li key={pid} className="trees__req" data-ok={ok}>{ok ? '+' : '-'} {p?.name ?? pid}</li>
          })}
          {others.map((o) => <li key={o.id} className="trees__req" data-ok="false">x CLOSES {o.name.toUpperCase()}</li>)}
        </ul>
      )}
      <div className="trees__act">
        {node.kind !== 'root' && why !== 'maxed' ? (
          <Button
            className="trees__buy"
            disabled={why !== null}
            onClick={() => {
              if (buyTreeNode(hero, node.id)) purchaseHaptic()
            }}
            aria-label={`${node.name}. ${refusal ?? `Buy for ${price === null ? '' : formatMoney(price)}`}`}
          >
            {refusal ?? `${level > 0 ? 'LEVEL UP' : 'BUY'} · ${price === null ? '' : formatMoney(price)}`}
          </Button>
        ) : (
          <p className="trees__state">{refusal}</p>
        )}
        <Button className="trees__deselect" onClick={onClear}>BACK</Button>
      </div>
    </aside>
  )
}
