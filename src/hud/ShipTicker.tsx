/**
 * The auto-ship ticker — GDD §10.8b [amended 2026-10-16, plan phase 4.1].
 *
 * The review reel is for a release the player attended: a ring was played, so
 * its date and stage are worth reporting back, and three critics and a verdict
 * are the payoff for the play. Serena's auto-ship releases with nobody there,
 * and at §14.8.7's faster cadence it does so every twenty seconds; a reel for
 * each of those was a celebration of nothing the player did, played over most
 * of the hour. So an auto-ship is one line here — the game's name and its score
 * — and it holds for a moment and goes, with no flash, no bars and no sound.
 *
 * Latched by the event's id, as the reel is, so a re-render cannot replay it.
 */

import { useEffect, useState } from 'react'
import type { GameState } from '../game/store.ts'

import '../styles/release.css'

/** How long one line stays up. Shorter than the floor of §14.8.7's cadence, so two never queue. */
export const TICKER_MS = 2_600

export function ShipTicker({ state }: { state: GameState }) {
  const event = state.autoShipped
  const [shownId, setShownId] = useState<number | null>(null)
  const [held, setHeld] = useState(event)
  const [open, setOpen] = useState(false)
  if (event && event.id !== shownId) {
    setShownId(event.id)
    setHeld(event)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setOpen(false), TICKER_MS)
    return () => clearTimeout(t)
  }, [open, shownId])

  if (!held || !open) return null
  return (
    <p className="ticker" role="status" aria-live="polite" data-testid="ship-ticker">
      <span className="ticker__k">AUTO-SHIPPED</span> {held.name}
      {held.count > 1 ? ` +${held.count - 1}` : ''} · {Math.round(held.rating)}/100
    </p>
  )
}
