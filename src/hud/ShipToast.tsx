/**
 * The ship celebration — GDD §10.8a, §10.4.
 *
 * Shipping is the entire point of the loop and it was **silent**. The burn-down
 * reset, the cash readout stepped up by a few hundred, and nothing marked the
 * moment; a player in Act I could ship their first project without noticing
 * they had. That is the loop's payoff going unpaid.
 *
 * Three beats, in order, and the order is the whole design:
 *
 *  1. **SHIPPED**, with the project's name — *what* happened.
 *  2. **The money, in green, large, counting up** — what it was *worth*. This is
 *     the one the player must not be able to miss, and it is why the toast
 *     exists rather than a line of terminal text.
 *  3. **The next project's name**, small — where they are now.
 *
 * The cash readout in the corner still moves at the same time. That is
 * deliberate duplication: the toast says the number arrived, the readout shows
 * the total it arrived into, and a player watching either one is told the truth.
 */

import { useEffect, useState } from 'react'
import { Counter } from './Counter.tsx'
import { formatMoney } from './hudModel.ts'
import { motionMs, useReducedMotion } from '../ui/motion.ts'
import { playSfx } from '../audio/sfx.ts'
import type { GameState } from '../game/store.ts'

/** How long the toast stays up. Long enough to read the number and the name. */
export const SHIP_TOAST_MS = 2600

export function ShipToast({ state }: { state: GameState }) {
  const reduced = useReducedMotion()
  const ship = state.ship
  const [shownId, setShownId] = useState<number | null>(null)
  const [open, setOpen] = useState(false)

  // Latched by id, the same pattern the action bar uses: the store keeps the
  // event around, so without an id the toast would re-open on every render.
  const [held, setHeld] = useState(ship)
  if (ship && ship.id !== shownId) {
    setShownId(ship.id)
    setHeld(ship)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    // F3 — a state change this large makes a noise. The crit chime is already
    // the game's "something good just landed" sound, so shipping borrows it
    // rather than introducing a second vocabulary for the same feeling.
    playSfx('poke-crit')
    const timer = setTimeout(() => setOpen(false), motionMs(SHIP_TOAST_MS, reduced))
    return () => clearTimeout(timer)
  }, [open, shownId, reduced])

  if (!held) return null

  return (
    <div className="ship-toast" data-open={open ? 'true' : 'false'} aria-live="polite">
      <p className="ship-toast__label">SHIPPED</p>
      <p className="ship-toast__name">{held.name}</p>
      {/*
        Counted rather than printed. §10.8a — "counters roll and bounce on
        arrival"; a revenue figure that simply appears reads as a label, and
        one that rolls up reads as money arriving.
      */}
      <p className="ship-toast__cash">
        <Counter value={held.revenue} format={(n) => `+${formatMoney(n)}`} bounce />
      </p>
    </div>
  )
}
