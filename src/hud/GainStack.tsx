import { useState } from 'react'
import type { GameState } from '../game/store.ts'
import { formatMoney } from './hudModel.ts'

/**
 * The gain stack — GDD §10.8a, "gain stacks".
 *
 * §10.8a's vocabulary lists "recent gains stack as a short column that pushes
 * older entries down and out". The ship celebration announces the money in the
 * middle of the screen, and this is the quieter echo of it in the rail: the
 * last few payouts, in green, each fading on its own. It is what makes the cash
 * figure *feel* like it arrived, because the player can see the exact amounts
 * that just landed rather than only a total that moved.
 *
 * Bounded at three, because a column is a readout, not a ledger — and because a
 * studio shipping at end-game speed must not grow a tower of entries faster
 * than the eye can read them.
 */

/** How many payouts the stack remembers. */
export const MAX_GAINS = 3

interface Gain {
  id: number
  revenue: number
}

export function GainStack({ state }: { state: GameState }) {
  const [gains, setGains] = useState<Gain[]>([])
  const [seenId, setSeenId] = useState<number | null>(null)

  // Set during render, not in an effect, so the new gain and the ship event
  // commit in the same paint. Newest first, so the column reads down from the
  // most recent payout.
  if (state.ship && state.ship.id !== seenId) {
    setSeenId(state.ship.id)
    setGains((g) =>
      [{ id: state.ship!.id, revenue: state.ship!.revenue }, ...g].slice(0, MAX_GAINS),
    )
  }

  if (gains.length === 0) return null

  return (
    <div className="hud__gains" aria-hidden="true">
      {gains.map((g) => (
        <span key={g.id} className="hud__gain">
          +{formatMoney(g.revenue)}
        </span>
      ))}
    </div>
  )
}
