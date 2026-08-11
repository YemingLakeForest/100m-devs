import { entropyLabel } from '../game/vocabulary.ts'
import {
  baseVelocity,
  currentEffectiveVelocity,
  currentPayroll,
  nextPayout,
  pokeVelocity,
  secondsToPayout,
  type GameState,
} from '../game/store.ts'
import { formatCount, scaleBar } from '../sim/headcount.ts'
import { isCashCritical, secondsUntilBankrupt } from '../sim/economy.ts'
import { useSpring } from '../ui/useSpring.ts'
import { SPRING_HEAVY } from '../ui/spring.ts'
import { Counter } from './Counter.tsx'
import { Kw } from './Kw.tsx'
import { ConceptText } from '../ui/ConceptText.tsx'
import {
  burnReadout,
  entropyPercent,
  formatMoney,
  formatVelocity,
  payoutReadout,
  runwayReadout,
  velocitySplit,
} from './hudModel.ts'

/**
 * The readouts of GDD §10.1 and §10.2, as edge-anchored blocks.
 *
 * §10.2's per-zoom table fixes what the HUD says — cash, headcount, the
 * speedometer, the active project, velocity — and §10.1 fixes roughly where:
 * project top-left, speedometer mid-left with velocity beneath it, resources on
 * the bar. Those positions were written for a landscape frame and they work in
 * one, so the layout follows them rather than inventing a scheme.
 *
 * Nothing here decides its own place on screen. Each block is a plain flow
 * element; `.hud`'s grid assigns the cell, so re-composing the frame is a
 * change to one stylesheet rule rather than to five components.
 */

/* --- resources, top-right ------------------------------------------------ */

/**
 * Cash, the burn, and the runway — §10.1's resource bar, plus the two rows
 * §21 Act V needs.
 *
 * Cash is the headline figure rather than "a tiny corner afterthought": from
 * the Mass Hire onward it is the number the whole run turns on, and Act V only
 * lands if the player is already in the habit of reading it.
 *
 * It is drawn straight from the store with no spring on it. See `Counter` —
 * payroll makes this figure move every frame anyway, and a spring over a ramp
 * would put the displayed cash a few hundred dollars behind the cash that
 * triggers bankruptcy.
 */
export function Cash({ state }: { state: GameState }) {
  const payroll = currentPayroll(state)
  const burn = burnReadout(payroll)
  const toPayout = secondsToPayout(state)
  const payout = payoutReadout(nextPayout(state), toPayout)
  const runway = runwayReadout(secondsUntilBankrupt(state.cash, state.devs))
  // §4.10d — alarm on whether the payout is reachable, not on the sign of the
  // balance. Revenue arrives on ship and payroll runs continuously, so a
  // perfectly healthy studio is overdrawn for most of every project; colouring
  // on `cash < 0` told that player they were failing while they were winning.
  const bad = isCashCritical(state.cash, state.devs, toPayout)

  return (
    <div className="hud__block hud__block--cash">
      <span className="hud__label"><Kw kind="cash">CASH</Kw></span>
      <b className={`hud__num hud__num--major${bad ? ' is-bad' : ''}`}>{formatMoney(state.cash)}</b>
      {/* Both rows are conditional on the economy, not on the script: the burn
          exists exactly while somebody is being paid, and the clock exists
          exactly while the runway is short enough to be a threat. */}
      {burn && <span className="hud__sub is-bad">{burn}</span>}
      {/* The money on its way, in the colour money arrives in. Shown whenever
          there is a burn to explain rather than only when the balance is
          negative: the point is context, not consolation. */}
      {burn && payout && <span className="hud__sub is-good">{payout}</span>}
      {burn && runway && <span className="hud__sub is-bad hud__sub--blink">{runway}</span>}
    </div>
  )
}

/**
 * Headcount, and the §7.7.5 scale bar under it.
 *
 * The scale bar is not decoration. Once one on-screen unit stops being one
 * developer the HUD has to say so, exactly as a map states its scale — a
 * picture whose units silently changed is a lie. It is null through the whole
 * of Run 1 (rungs 0–2) and the row simply is not there, which is why it is
 * rendered as its own line rather than appended to the count: an appended
 * suffix would change the width of the headcount row when it arrived.
 */
export function Devs({ state }: { state: GameState }) {
  const bar = scaleBar(state.devs)

  return (
    <div className="hud__block">
      <span className="hud__label"><Kw kind="devs">DEVS</Kw></span>
      <Counter value={state.devs} format={formatCount} bounce />
      {bar && <span className="hud__sub hud__scale"><ConceptText text={bar} /></span>}
    </div>
  )
}

/*
 * There is no MAN-WEEKS readout, and its absence is a decision rather than an
 * omission.
 *
 * It reported what the player *assumed* the studio would deliver — one person,
 * one man-week — against what it actually did, on the theory that the gap is
 * the §6 joke stated in the units the plan was written in. On screen it was a
 * third big number in a rail that already had cash and headcount in it, saying
 * something the speedometer and the velocity split were already saying better,
 * and it read as telemetry rather than as a punchline. Withdrawn by the author
 * of the idea. The unit survives nowhere in the build; if it ever comes back it
 * comes back as copy, not as a fourth counter.
 */

/**
 * Projects shipped — §10.1's "Releases", which had no readout at all.
 *
 * It is the only counter in the HUD that measures what the studio has actually
 * *achieved*; everything else measures what it is currently doing. In Run 1 it
 * reaches one, and one is the joke.
 */
export function Shipped({ state }: { state: GameState }) {
  return (
    <div className="hud__block">
      <span className="hud__label">SHIPPED</span>
      <Counter value={state.projectsShipped} format={(n) => String(Math.round(n))} bounce />
    </div>
  )
}

/* --- gauges, mid-left ---------------------------------------------------- */

/**
 * The speedometer — GDD §4.3, named by §4.3a.
 *
 * **The player never reads the word "entropy".** The readout escalates its own
 * name as E climbs, from `IN SYNC` to `STUDIO SEIZED`, and the number sits
 * beside it because the escalating word is drama and the percentage is the
 * honest reading. Hiding the number would make the HUD a mood ring.
 *
 * The displayed value is sprung, and that is a deliberate reading of §4.3a's
 * closing note. The Mass Hire adds a thousand developers in a single frame, so
 * the readout would otherwise jump `CHATTY` -> `STUDIO SEIZED` with the four
 * middle labels traversed between two frames — the entire escalation ladder,
 * unseen. §4.3a's own fix is to drive the readout off *landed* developers,
 * which is a simulation change this pass does not own; springing the display
 * produces the same sweep through the same labels from the HUD side, and it
 * settles in about a third of a second, so the number is honest again well
 * inside the beat.
 *
 * Clamped to [0, 1] because a spring overshoots by design, and a speedometer
 * that reads 101% is a bug rather than a flourish.
 */
export function Speedometer({ entropy }: { entropy: number }) {
  const swept = Math.min(1, Math.max(0, useSpring(entropy, SPRING_HEAVY)))
  const seized = entropy >= 0.99

  return (
    <div className={`hud__block hud__gauge${seized ? ' is-seized' : ''}`}>
      <span className="hud__label">{entropyLabel(swept)}</span>
      <b className="hud__num hud__num--major">{entropyPercent(swept)}</b>
      <div className="hud__gauge-track">
        {/*
          Width is the sprung value too, so the bar and the word travel
          together. §10.8a asks a filling bar to overshoot and settle rather
          than to arrive; the spring is where that comes from.
        */}
        <div className="hud__gauge-fill" style={{ width: `${swept * 100}%` }} />
      </div>
    </div>
  )
}

/**
 * Velocity — §10.1, "the clicker layer's scoreboard", which sits under the
 * speedometer because the speedometer is the reason it is the number it is.
 *
 * Not sprung: this figure already moves every frame, and the spike when the
 * player pokes is the whole readout. Damping it would remove the feedback the
 * row exists to give.
 */
export function Velocity({ state }: { state: GameState }) {
  // The two halves come from the store already separated, and R14 moved where
  // the line between them falls. It used to be `currentVelocity` against
  // `pokeRate`; §4.5a then routed three quarters of every poke into a buff on
  // the people poked, and a buff raises `currentVelocity` — so that reading now
  // credits **the swarm** with most of what the player just did. Which is §25.1's
  // original complaint arriving through the opposite door, and just as untrue.
  //
  // `baseVelocity` is the swarm on its own; `pokeVelocity` is the instant
  // payout plus everything the player's buffs are adding. The good side effect
  // is that the line stops emptying two seconds after the last tap and instead
  // sags as the buffs do — which is §4.5a's maintenance loop, finally legible.
  const swarm = baseVelocity(state)
  const split = velocitySplit(swarm, pokeVelocity(state))
  return (
    <div className="hud__block">
      <span className="hud__label"><Kw kind="velocity">VELOCITY</Kw></span>
      <b className="hud__num hud__num--major">{formatVelocity(currentEffectiveVelocity(state))}</b>
      <span className="hud__sub">
        <Kw>story points</Kw>/SEC
      </span>
      {/* Only while the player is actually poking, so the row is an event
          rather than furniture. */}
      {split && <span className="hud__sub hud__sub--split">{split}</span>}
    </div>
  )
}
