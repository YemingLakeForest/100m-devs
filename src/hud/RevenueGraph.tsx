import { useEffect, useRef, useState } from 'react'
import { catalogueRate, currentPayroll, type GameState } from '../game/store.ts'
import { MAX_BANDS, bandsFor, formatRate } from './revenueModel.ts'
import { Kw } from './Kw.tsx'

/**
 * The revenue graph — GDD §4.10e.
 *
 * "A revenue stream nobody can see is indistinguishable from the lump it
 * replaced, so this ships with a revenue graph in the HUD: income over time,
 * one band per still-earning project, against the payroll line."
 *
 * **The bands are the point, not the total.** A single income line would be a
 * truer summary and a worse picture: what §4.10e is trying to make legible is
 * that the money is coming from *several games at once*, each on its own
 * decay, and that the one launching today will be the thin band underneath
 * tomorrow. That is what turns "I am always losing money" into "this one is
 * tailing off and the next one has to land", which is the sentence the whole
 * change exists to produce.
 *
 * §10.4's burn-down is the model in every other respect: SVG at
 * `shape-rendering="crispEdges"` because ART_DIRECTION §3 rule 1 forbids a
 * smooth curve beside a hard pixel edge, one sample a second, and a viewBox so
 * the chart belongs to its rail rather than to a pixel width.
 */

const WIDTH = 120
const HEIGHT = 34
/** One sample per second. Sixty seconds is the width of the chart. */
const SAMPLES = 60

interface Sample {
  /** Dollars/sec from each still-earning release, oldest band first. */
  bands: number[]
  payroll: number
}

export function RevenueGraph({ state }: { state: GameState }) {
  const [history, setHistory] = useState<Sample[]>([])
  // Sampled once a second while the store updates at 60 Hz, so the current
  // value is parked in a ref rather than re-arming the interval every tick —
  // the same arrangement, and for the same reason, as the burn-down's.
  const latest = useRef<Sample>({ bands: [], payroll: 0 })

  useEffect(() => {
    latest.current = { bands: bandsFor(state), payroll: currentPayroll(state) }
  }, [state])

  useEffect(() => {
    const id = setInterval(() => {
      setHistory((h) => {
        const s = latest.current
        // **Do not start the window until there is something in it.** §21 Act I
        // is one unpaid founder with nothing shipped, so every sample is a
        // zero — and a zero is still a sample, which made `history.length`
        // non-empty after one second and defeated the guard below. The block
        // then drew an empty chart from the first frame of the game, which is
        // exactly the "component apologising for itself" it is written not to
        // be. Invisible until the graph was restored on short frames, because
        // the chart it was drawing was the thing being hidden.
        if (h.length === 0 && s.payroll === 0 && s.bands.length === 0) return h
        return [...h, s].slice(-SAMPLES)
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const income = catalogueRate(state)
  const payroll = currentPayroll(state)

  // Nothing has shipped and nobody is paid. An empty chart with two axes is a
  // component apologising for itself; §10.1's rail is short and this earns its
  // place from the first ship rather than before it.
  if (history.length === 0 && income === 0 && payroll === 0) return null

  // Scaled to the tallest thing in the window rather than to a fixed ceiling.
  // A launch spike is two orders of magnitude above the tail it decays into,
  // and a fixed axis would draw either the spike or the catalogue, never both.
  const peak = Math.max(
    1,
    ...history.map((s) => Math.max(s.payroll, s.bands.reduce((a, b) => a + b, 0))),
    payroll,
    income,
  )

  const x = (i: number) => (i / Math.max(1, SAMPLES - 1)) * WIDTH
  const y = (v: number) => HEIGHT - Math.min(1, v / peak) * (HEIGHT - 1)

  // One filled band per release, stacked. Drawn as a closed polygon per band
  // rather than as an area chart with a library: four polygons is less code
  // than a dependency and it anti-aliases exactly as much as we tell it to.
  const bandCount = history.reduce((most, s) => Math.max(most, s.bands.length), 0)
  const bands: string[] = []
  for (let b = 0; b < bandCount; b++) {
    const top: string[] = []
    const bottom: string[] = []
    for (let i = 0; i < history.length; i++) {
      const stack = history[i].bands
      let below = 0
      for (let k = 0; k < b && k < stack.length; k++) below += stack[k]
      const value = b < stack.length ? stack[b] : 0
      top.push(`${x(i).toFixed(1)},${y(below + value).toFixed(1)}`)
      bottom.unshift(`${x(i).toFixed(1)},${y(below).toFixed(1)}`)
    }
    if (top.length > 1) bands.push([...top, ...bottom].join(' '))
  }

  const payrollLine = history
    .map((s, i) => `${x(i).toFixed(1)},${y(s.payroll).toFixed(1)}`)
    .join(' ')

  return (
    <div className="revenue hud__block">
      {/*
        The label carries the numbers rather than sitting on a line of its own.
        §23.4's frame is 448 px tall and the left rail already holds the
        burn-down, the speedometer, the velocity readout and §21's script; a
        second chart with its own header row pushed the gauges down into the
        copy, and §10.1 is explicit that the copy is what gives way last.
      */}
      <span className="hud__label revenue__head">
        REVENUE <span className="revenue__rates">{formatRate(income)} IN</span>
      </span>
      <svg
        className="revenue__chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {bands.map((points, i) => (
          <polygon key={i} className={`revenue__band revenue__band--${i % MAX_BANDS}`} points={points} />
        ))}
        {history.length > 1 && <polyline className="revenue__payroll" points={payrollLine} />}
      </svg>
      <span className="hud__sub revenue__readout">
        {/* R13's cash keyword, applied — it was defined and unused. */}
        {formatRate(payroll)} <Kw kind="cash">PAYROLL</Kw>
      </span>
    </div>
  )
}
