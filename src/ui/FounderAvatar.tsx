import { useEffect, useMemo, useRef } from 'react'
import type {
  FounderAccessory,
  FounderBody,
  FounderBodyColour,
  FounderHairColour,
  FounderHead,
  FounderFacialHair,
  FounderSkin,
} from '../game/founderProfile.ts'
import { founderLook } from '../game/founderProfile.ts'
import { personPortrait } from '../three/render/portrait.ts'
import { createTurntable, type Turntable } from '../three/render/turntable.ts'
import type { Look } from '../three/sim/identity.ts'

import '../styles/founderAvatar.css'

/**
 * The founder, previewed — **as the rebuild's person** (2026-09-26).
 *
 * *"any scenes with arvatar should be the 3d model not the old 2d"* and *"Why
 * can't you port the exact same character creation models?"* This was a block
 * figure assembled from `div`s with an SVG face over it: a second construction
 * of a person beside the room's, which drifts from it the moment either
 * changes. It now draws `studioPerson()` whole, exactly as the rebuild's
 * character screen does (`three/render/portrait.ts`). The name tag stays: a
 * label on a stalk is how the room names a person.
 */
export function FounderAvatar({
  head,
  hairColour = 0,
  skin = 2,
  accessory = 'none',
  facialHair = 'none',
  body,
  bodyColour = 1,
  label = 'YOU',
  large = false,
}: {
  head: FounderHead
  hairColour?: FounderHairColour
  skin?: FounderSkin
  accessory?: FounderAccessory
  facialHair?: FounderFacialHair
  body: FounderBody
  bodyColour?: FounderBodyColour
  label?: string
  /** The character screen's size, rather than a card's. */
  large?: boolean
}) {
  const look = useMemo(
    () => founderLook({ name: label, head, hairColour, skin, accessory, facialHair, body, bodyColour }),
    [label, head, hairColour, skin, accessory, facialHair, body, bodyColour],
  )
  // The character screen's figure turns (`TurnableFounder`); a card's is a still.
  const src = useMemo(() => (large ? null : personPortrait(look, 'founder', 'figure')), [look, large])

  return (
    <div
      className={`founder-avatar${large ? ' founder-avatar--large' : ''}`}
      data-head={head}
      data-hair-shape={look.hair}
      data-hair-colour={hairColour}
      data-skin={skin}
      data-accessory={accessory}
      data-facial-hair={facialHair}
      data-body={body}
      data-body-shape={look.body}
      data-body-colour={bodyColour}
      aria-label="Your founder, as they will appear at their desk"
    >
      <div className="founder-avatar__signal">{label}</div>
      {large ? <TurnableFounder look={look} /> : src && <img className="founder-avatar__render" src={src} alt="" aria-hidden="true" />}
    </div>
  )
}

/** How far a pixel of drag turns the figure: a full turn across about 520 px. */
const TURN_PER_PX = 0.012

/**
 * [2026-09-26] *"make it we can rotate him"* — drag across the figure, or use
 * the arrow keys on it, and it turns. Drawn by `three/render/turntable.ts`.
 */
function TurnableFounder({ look }: { look: Look }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const table = useRef<Turntable | null>(null)
  const drag = useRef<{ id: number; x: number } | null>(null)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const t = createTurntable(el)
    table.current = t
    if (!t) return
    const fit = () => t.resize(el.clientWidth, el.clientHeight)
    fit()
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    watch?.observe(el)
    return () => {
      watch?.disconnect()
      t.dispose()
      table.current = null
    }
  }, [])

  useEffect(() => {
    table.current?.setLook(look, 'founder')
  }, [look])

  return (
    <>
      <canvas
        ref={canvas}
        className="founder-avatar__stage"
        tabIndex={0}
        aria-label="Turn your founder: drag, or use the arrow keys"
        onPointerDown={(e) => {
          drag.current = { id: e.pointerId, x: e.clientX }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          table.current?.turn((e.clientX - d.x) * TURN_PER_PX)
          d.x = e.clientX
        }}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault()
            table.current?.turn(e.key === 'ArrowLeft' ? -0.3 : 0.3)
          }
        }}
      />
      <div className="founder-avatar__turn-hint" aria-hidden="true">DRAG TO TURN</div>
    </>
  )
}
