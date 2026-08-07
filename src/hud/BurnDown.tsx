import { useEffect, useRef, useState } from 'react'
import { burnedFraction, remaining, type GameState } from '../game/store.ts'

/**
 * The sprint burn-down — GDD §10.1, §10.4.
 *
 * "Rendered as a sprint burn-down — a descending line, not a filling bar."
 * That distinction is the joke and the readability: a burn-down goes *down*,
 * and a sprint that is going badly is legible at a glance because the line
 * stops descending.
 *
 * Drawn as SVG with shape-rendering="crispEdges", which switches off
 * anti-aliasing. ART_DIRECTION §3 rule 1 forbids a smooth curve beside a hard
 * pixel edge, and an SVG polyline is anti-aliased by default.
 *
 * The chart scales to its container rather than to a fixed pixel width. It
 * lives in the §23.4.2 left rail, which is a fixed width anchored to the left
 * edge — but the viewBox means a future rail that breathes will not need this
 * file reopened.
 */

const WIDTH = 120
const HEIGHT = 40
/** One sample per second of play. 60 samples is the width of the chart. */
const SAMPLES = 60

export function BurnDown({ state }: { state: GameState }) {
  const [history, setHistory] = useState<number[]>([])
  // The chart samples once a second while the store updates at 60 Hz, so the
  // current value is parked in a ref for the sampler to read rather than
  // re-arming the interval on every tick.
  const latest = useRef(1)

  useEffect(() => {
    latest.current = 1 - burnedFraction(state)
  }, [state])

  useEffect(() => {
    const id = setInterval(() => {
      setHistory((h) => [...h, latest.current].slice(-SAMPLES))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // A new sprint is a new chart. Keeping the old samples drew the previous
  // project's descent and then a vertical jump back to full commitment, which
  // reads as scope creep (§18.4) — a real mechanic the game has, and one that
  // must not be simulated by accident every time something ships.
  //
  // Reset during render rather than in an effect, so the first frame of the new
  // project never shows the old project's line.
  const [sprint, setSprint] = useState(state.sprintName)
  if (sprint !== state.sprintName) {
    setSprint(state.sprintName)
    setHistory([])
  }

  // The ideal line: a straight descent from full commitment to zero across the
  // chart. Real velocity is compared against it, which is the whole point of a
  // burn-down — the gap between plan and reality.
  const ideal = `0,2 ${WIDTH},${HEIGHT - 2}`

  const points = history
    .map((v, i) => {
      const x = (i / Math.max(1, SAMPLES - 1)) * WIDTH
      const y = 2 + (1 - v) * (HEIGHT - 4)
      return `${x.toFixed(0)},${y.toFixed(0)}`
    })
    .join(' ')

  const left = remaining(state)

  return (
    <div className="burndown hud__block">
      <span className="hud__label">PROJECT</span>
      <div className="burndown__name">{state.sprintName.toUpperCase()}</div>
      <svg
        className="burndown__chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <polyline className="burndown__ideal" points={ideal} />
        {history.length > 1 && <polyline className="burndown__actual" points={points} />}
      </svg>
      <span className="hud__sub burndown__readout">
        {left.toFixed(0)} / {state.commitment.toFixed(0)} SP LEFT
      </span>
    </div>
  )
}
