import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { DURATION, motionMs, useReducedMotion } from './motion.ts'
import { playUi } from './uiSfx.ts'

/**
 * A surface that enters and leaves with direction — GDD §10.5, and the whole
 * of the §10.8 F1 gate.
 *
 * F1 is the single named failure condition in the presentation gate, and the
 * mechanism that causes it is always the same: React unmounts the element the
 * instant its condition goes false, so there is nothing left to animate out.
 * Panel owns that. It keeps its children mounted through the exit and removes
 * them afterwards, which is the only reason an exit transition can exist at
 * all. Every overlay in the product goes through here rather than re-deriving
 * that, because the second time it is derived it will be derived wrong.
 *
 * The motion is a CSS *animation* rather than a transition, and that is
 * load-bearing rather than a style preference. A transition needs the element
 * painted once in its start state and once in its end state, which means a
 * two-frame class flip that is easy to get wrong and silently degrades to a
 * pop when the two frames get batched into one style recalculation — F1, with
 * the code to prevent it already written. A keyframe animation runs from
 * insertion, so the phase here is derived straight from the `open` prop and
 * there is no start state to miss.
 *
 * The transform carries the motion. Opacity rides along with it and is never
 * alone: an element whose only change is 0 -> 1 opacity is the snap F1 names,
 * however long it is given.
 */

/**
 * The edge the panel belongs to. It enters from there and leaves back toward
 * it: §10.5 rule 1, "outgoing elements exit toward where they went".
 */
export type PanelOrigin = 'bottom' | 'top' | 'left' | 'right' | 'centre'

export interface PanelProps {
  open: boolean
  from?: PanelOrigin
  /**
   * Dim and blur the simulation behind the panel. Per §10.6 the scrim is
   * semi-transparent and the blur ramps up over the same 320 ms rather than
   * snapping to blurred — the swarm keeps simulating underneath, visibly.
   */
  modal?: boolean
  /** Panels that open as part of a larger scored beat suppress their own whoosh. */
  silent?: boolean
  className?: string
  children: ReactNode
  /** Fired after the exit animation has finished and the panel has unmounted. */
  onExited?: () => void
}

export function Panel({
  open,
  from = 'bottom',
  modal = false,
  silent = false,
  className,
  children,
  onExited,
}: PanelProps) {
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(open)

  // Latched rather than depended on: an inline arrow from the caller would
  // otherwise change identity on every parent render and restart the exit
  // timer, so the panel would never actually leave.
  const exited = useRef(onExited)
  useEffect(() => {
    exited.current = onExited
  }, [onExited])

  const inMs = motionMs(DURATION.panelIn, reduced)
  const outMs = motionMs(DURATION.panelOut, reduced)

  useEffect(() => {
    if (open === mounted) return

    if (open) {
      if (!silent) playUi('whoosh')
      const frame = requestAnimationFrame(() => setMounted(true))
      return () => cancelAnimationFrame(frame)
    }

    if (!silent) playUi('close')
    // The element is already rendering at data-phase="exit" by now — this only
    // decides when it stops existing.
    const timer = setTimeout(() => {
      setMounted(false)
      exited.current?.()
    }, outMs)
    return () => clearTimeout(timer)
  }, [open, mounted, outMs, silent])

  if (!mounted) return null

  const style = {
    '--ui-in': `${inMs}ms`,
    '--ui-out': `${outMs}ms`,
  } as CSSProperties

  // Derived from the prop, not held in state: there is exactly one source of
  // truth for whether this panel is coming or going.
  const phase = open ? 'in' : 'exit'

  const panel = (
    <div
      className={`ui-panel ui-panel--${from}${className ? ` ${className}` : ''}`}
      data-phase={phase}
      style={style}
    >
      {children}
    </div>
  )

  if (!modal) return panel

  return (
    <div className="ui-scrim" data-phase={phase} style={style}>
      {panel}
    </div>
  )
}
