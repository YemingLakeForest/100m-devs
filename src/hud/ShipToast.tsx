/**
 * The ship celebration — GDD §10.8a, §10.4, §10.11.
 *
 * Shipping is the entire point of the loop and it was **silent**. The burn-down
 * reset, the cash readout stepped up by a few hundred, and nothing marked the
 * moment; a player in Act I could ship their first project without noticing
 * they had. That is the loop's payoff going unpaid.
 *
 * Four beats, in order, and the order is the whole design:
 *
 *  1. **A launch flash** — a full-frame white burst, two or three frames, so the
 *     moment lands on the whole screen rather than only on a corner label.
 *  2. **The cover, stamped in** — §10.11.3's generated tile for the thing that
 *     just shipped, read back from the history record written on the same frame
 *     so the cover is exactly the one the gallery will show, never a second roll.
 *  3. **SHIPPED**, with the project's name — *what* happened.
 *  4. **The money, in green, large, counting up** — what it was *worth*. This is
 *     the one the player must not be able to miss, and it is why the toast
 *     exists rather than a line of terminal text.
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
import { getState, type GameState } from '../game/store.ts'
import { coverFor } from '../sim/cover.ts'
import { Cover } from './Cover.tsx'
import { RATING_WEIGHTS } from '../sim/rating.ts'

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

  // §10.11 — the cover of the thing that just shipped. The history record is
  // written on the same frame the ship event is published, and a new release is
  // always the last entry in the recent window, so this reads the same seed,
  // ordinal and rating the gallery will render from. If a ship arrived without
  // a record — a test seam, or a save from before history existed — there is
  // simply no cover, and the rest of the beat plays on.
  const history = getState().history
  const record = history.recent[history.recent.length - 1]
  const cover =
    record && record.name === held.name
      ? coverFor(record.seed, record.ordinal, record.rating, record.name)
      : null

  return (
    <>
      {/* Keyed on the ship so the flash replays on the next one rather than
          staying on: the flash is a single CSS animation, and remounting is
          how it re-fires without a timer to reset. */}
      <div key={`flash-${held.id}`} className="ship-flash" aria-hidden="true" />
      <div className="ship-toast" data-open={open ? 'true' : 'false'} aria-live="polite">
        {cover && <Cover spec={cover} />}
        <p className="ship-toast__label">SHIPPED</p>
        <p className="ship-toast__name">{held.name}</p>
        {(record?.heroCoverage ?? 0) > 0 && (
          <p className="ship-toast__heroes">
            HERO COVERAGE {Math.round((record?.heroCoverage ?? 0) * 100)}% · +
            {Math.round((record?.heroCoverage ?? 0) * RATING_WEIGHTS.heroes * 100)} RATING
          </p>
        )}
        {/*
          Counted rather than printed. §10.8a — "counters roll and bounce on
          arrival"; a revenue figure that simply appears reads as a label, and
          one that rolls up reads as money arriving.
        */}
        <p className="ship-toast__cash">
          <Counter value={held.revenue} format={(n) => `+${formatMoney(n)}`} bounce />
        </p>
      </div>
    </>
  )
}
