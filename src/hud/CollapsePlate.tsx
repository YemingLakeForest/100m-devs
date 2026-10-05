import { effectiveDevCap, type GameState } from '../game/store.ts'
import {
  curvePath,
  peakHeads,
  plateCaption,
  plateX,
  plateY,
  workDone,
} from './collapseModel.ts'

const W = 320
const H = 96

/**
 * §21 Act IV [added 2026-10-04] — **the curve, drawn while it is being walked.**
 *
 * It shows from the Mass Hire to the bankruptcy and never otherwise: Run 1 has
 * one lever and one idea, and this plate is that idea. The hill is the studio's
 * output against its headcount; the dot is the studio right now; the player
 * watches it climb to the peak in the first wave, tip over, and run down the
 * far side while the headcount beside it only ever rises.
 *
 * It never says *entropy* (§4.3a). It says what the player can check against
 * the number beside it: how many people's worth of work the studio is getting.
 */
export function CollapsePlate({ state }: { state: GameState }) {
  // From the first wave (which lands with the signature, still in Act III's
  // phase) to the liquidation, whose receipt carries the same two numbers.
  if (!state.massHired || state.phase === 'bankrupt') return null

  const cap = effectiveDevCap(state)
  const peak = peakHeads(cap)
  const peakOutput = workDone(peak, cap)
  const x = plateX(state.devs, W)
  const y = plateY(workDone(state.devs, cap), peakOutput, H)
  const { work, past } = plateCaption(state.devs, cap)

  return (
    <aside className="collapse-plate" aria-label="Output against headcount">
      <p className="collapse-plate__title">WORK DONE vs DEVELOPERS</p>
      <svg
        className="collapse-plate__chart"
        viewBox={`-6 -6 ${W + 12} ${H + 12}`}
        role="img"
        aria-label={`${Math.floor(state.devs)} developers are doing ${work} developers' worth of work`}
      >
        <path className="collapse-plate__curve" d={curvePath(cap, W, H)} />
        <line className="collapse-plate__peak" x1={plateX(peak, W)} x2={plateX(peak, W)} y1={0} y2={H} />
        <text className="collapse-plate__peak-label" x={plateX(peak, W) + 4} y={10}>PEAK</text>
        <circle className={`collapse-plate__dot${past ? ' collapse-plate__dot--past' : ''}`} cx={x} cy={y} r={5} />
      </svg>
      <p className="collapse-plate__read">
        {Math.floor(state.devs).toLocaleString()} DEVELOPERS — DOING {work} DEVELOPERS’ WORTH OF WORK
      </p>
      {past && <p className="collapse-plate__past">PAST THE PEAK. EVERY HIRE NOW LOSES WORK.</p>}
    </aside>
  )
}
