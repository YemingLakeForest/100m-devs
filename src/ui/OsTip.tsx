import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ConceptText } from './ConceptText.tsx'
import type { Concept } from './concepts.ts'
import { GLOSSARY } from './glossary.ts'

import '../styles/osTip.css'

/**
 * The one tooltip — GDD §10.6c [CANON - added 2026-10-20].
 *
 * Every hover in Studio OS is the same object: a name, a tag in the corner, a
 * few stat rows, then one or two sentences. Lonestar teaches its entire system
 * through exactly this panel, and the reviews that praise the game praise it for
 * the panel. The HUD had nothing of the kind — a readout said a number and the
 * reasons lived in the GDD.
 *
 * **Keywords chain.** The body is `ConceptText`, so the tracked nouns arrive
 * already inked; resting on one opens a second panel beside the first with that
 * noun's line from `glossary.ts`. The first panel stays up while the pointer
 * travels into it, which is what makes the chain reachable at all.
 *
 * Touch has no hover, so a tap on the wrapped element toggles the panel and a
 * tap anywhere else puts it away. The panel is portalled to `<body>` and placed
 * with `fixed` coordinates so no rail's `overflow: hidden` can clip it.
 */

export interface TipSpec {
  title: string
  tag?: string
  rows?: ReadonlyArray<readonly [string, ReactNode]>
  body?: string
}

/** How long a panel waits for the pointer to arrive before it goes. */
const LINGER_MS = 180

export function Tipped({
  tip,
  className,
  children,
}: {
  /** Called only while the panel is open, so an expensive row costs nothing at rest. */
  tip: () => TipSpec
  className?: string
  children: ReactNode
}) {
  // State, not a ref: the panel is placed against this element during render.
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [chain, setChain] = useState<Concept | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const hold = useCallback(() => {
    window.clearTimeout(timer.current)
  }, [])
  const letGo = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setOpen(false)
      setChain(null)
    }, LINGER_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // A tap outside closes a panel opened by a tap.
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      const t = e.target as Node
      if (anchor?.contains(t)) return
      if ((t as Element).closest?.('.os-tip')) return
      setOpen(false)
      setChain(null)
    }
    window.addEventListener('pointerdown', away)
    return () => window.removeEventListener('pointerdown', away)
  }, [open, anchor])

  return (
    <div
      ref={setAnchor}
      className={['os-tipped', className].filter(Boolean).join(' ')}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return
        hold()
        setOpen(true)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') letGo()
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return
        setOpen((was) => !was)
        setChain(null)
      }}
    >
      {children}
      {open && anchor && (
        <TipPanels anchor={anchor} spec={tip()} chain={chain} onChain={setChain} onHold={hold} onLetGo={letGo} />
      )}
    </div>
  )
}

function TipPanels({
  anchor,
  spec,
  chain,
  onChain,
  onHold,
  onLetGo,
}: {
  anchor: HTMLElement
  spec: TipSpec
  chain: Concept | null
  onChain: (c: Concept | null) => void
  onHold: () => void
  onLetGo: () => void
}) {
  const main = useRef<HTMLDivElement>(null)
  const second = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const [chainAt, setChainAt] = useState<{ x: number; y: number } | null>(null)

  // Placed after layout, against the frame (`#root`) rather than the window:
  // on the web the game is letterboxed, and a tip that hangs into the black bar
  // is a tip drawn off the picture.
  useLayoutEffect(() => {
    const el = main.current
    if (!el) return
    const frame = (document.getElementById('root') ?? document.body).getBoundingClientRect()
    const a = anchor.getBoundingClientRect()
    const w = el.offsetWidth
    const h = el.offsetHeight
    let x = a.left
    let y = a.bottom + 6
    if (x + w > frame.right - 6) x = frame.right - 6 - w
    if (y + h > frame.bottom - 6) y = a.top - 6 - h
    setAt({ x: Math.max(frame.left + 6, x), y: Math.max(frame.top + 6, y) })
  }, [anchor, spec.title, spec.rows?.length])

  useLayoutEffect(() => {
    const el = second.current
    const m = main.current
    if (!el || !m || !chain) return
    const frame = (document.getElementById('root') ?? document.body).getBoundingClientRect()
    const r = m.getBoundingClientRect()
    const w = el.offsetWidth
    let x = r.right + 6
    if (x + w > frame.right - 6) x = r.left - 6 - w
    let y = r.top
    if (y + el.offsetHeight > frame.bottom - 6) y = frame.bottom - 6 - el.offsetHeight
    setChainAt({ x: Math.max(frame.left + 6, x), y: Math.max(frame.top + 6, y) })
  }, [chain, at])

  const onOver = (e: ReactPointerEvent) => {
    const kw = (e.target as Element).closest('.kw')
    if (!kw) return
    const concept = [...kw.classList].find((c) => c.startsWith('kw--'))?.slice(4) as Concept | undefined
    if (concept && concept in GLOSSARY) onChain(concept)
  }

  const g = chain ? GLOSSARY[chain] : null
  return createPortal(
    <>
      <div
        ref={main}
        className="os-tip"
        role="tooltip"
        style={{ left: at?.x ?? -9999, top: at?.y ?? -9999 }}
        onPointerEnter={onHold}
        onPointerLeave={onLetGo}
        onPointerOver={onOver}
      >
        <div className="os-tip__head">
          <b>{spec.title}</b>
          {spec.tag && <span className="os-tip__tag">{spec.tag}</span>}
        </div>
        {spec.rows && spec.rows.length > 0 && (
          <dl className="os-tip__rows">
            {spec.rows.map(([k, v]) => (
              <div key={k}>
                <dt>
                  <ConceptText text={k} />
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {spec.body && (
          <p className="os-tip__body">
            <ConceptText text={spec.body} />
          </p>
        )}
      </div>
      {g && (
        <div
          ref={second}
          className="os-tip os-tip--chain"
          role="tooltip"
          style={{ left: chainAt?.x ?? -9999, top: chainAt?.y ?? -9999 }}
          onPointerEnter={onHold}
          onPointerLeave={onLetGo}
        >
          <div className="os-tip__head">
            <b>{g.title}</b>
            <span className="os-tip__tag">KEYWORD</span>
          </div>
          <p className="os-tip__body">{g.body}</p>
        </div>
      )}
    </>,
    document.body,
  )
}
