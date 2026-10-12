import { useEffect, useState } from 'react'
import { BREATH_MS, breathShown, crossedMilestone } from '../sim/heldBreath.ts'

/**
 * The headcount the counter should show while a decade's payoff is withheld (§10.8a, move 6), or
 * null when it should simply show the real one.
 *
 * Composition over `sim/heldBreath.ts`, which owns the argument. The crossing is noticed during
 * render, as `Counter` and `useHotSegments` do, so the held figure is in the same paint as the
 * jump it hides; the clock that walks it through the hold and the roll is an effect, because time
 * is not a prop (and reading it in render is impure). A count a saved game *loads with* is not an
 * arrival and is never held.
 */
export function useHeldCount(value: number, reduced: boolean): number | null {
  const [previous, setPrevious] = useState(value)
  const [breath, setBreath] = useState<{ id: number; from: number; to: number; milestone: number } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  if (value !== previous) {
    setPrevious(value)
    const milestone = crossedMilestone(previous, value)
    if (milestone !== null) { setBreath({ id: (breath?.id ?? 0) + 1, from: previous, to: value, milestone }); setElapsed(0) }
    else if (breath) setBreath({ ...breath, to: value })
  }

  const id = breath?.id
  useEffect(() => {
    if (id === undefined) return
    const start = performance.now()
    const timer = setInterval(() => {
      const t = performance.now() - start
      setElapsed(t)
      if (t >= BREATH_MS) { setBreath(null); clearInterval(timer) }
    }, 40)
    return () => clearInterval(timer)
  }, [id]) // a later `to` re-aims the roll; only a new crossing restarts the clock

  if (!breath) return null
  return breathShown(elapsed, breath.from, breath.to, breath.milestone, reduced)
}
