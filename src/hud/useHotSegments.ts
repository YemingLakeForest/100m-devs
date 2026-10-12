import { useState } from 'react'
import { hotSegments } from '../sim/juice.ts'

/**
 * Which segments of a stepped bar have just come on — the ones the stylesheet draws hot
 * (`graph.css`, `gl-hot`).
 *
 * The marker is set during render, not in an effect, for the reason `Counter` gives: the new
 * segment and its flash have to commit in the same paint, or the flash lands a frame after the
 * segment. `clear` is meant to be the segment's `onAnimationEnd`, not a timer, so a re-render
 * mid-flight cannot leave a segment stuck hot.
 *
 * Composition over `sim/juice.ts`'s `hotSegments`, which holds the logic; this only holds the
 * one frame of memory the logic needs.
 */
export function useHotSegments(on: number): { isHot: (i: number) => boolean; clear: () => void } {
  const [previous, setPrevious] = useState(on)
  const [hot, setHot] = useState<{ from: number; to: number } | null>(null)
  if (on !== previous) {
    setPrevious(on)
    setHot(hotSegments(previous, on))
  }
  return {
    isHot: (i) => hot !== null && i >= hot.from && i < hot.to,
    clear: () => setHot(null),
  }
}
