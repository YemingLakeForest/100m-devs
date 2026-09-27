/**
 * The hire multiplier dial — GDD §10.10.
 *
 * A row of segments, **not a stepper**. One tap sets the multiplier; there is
 * never a sequence of taps to reach the one you want, which is the whole
 * argument of §10.10.1 — a stepper at `x1M` is forty taps.
 *
 * Below 25 developers this renders nothing at all (§10.10.2), and it is the
 * caller's job to be relaxed about that: the dial appearing mid-act,
 * unannounced, is the intended experience.
 *
 * **One row.** §4.11's role row (DEVELOPER / QA / SUPPORT / SRE) stood above
 * this one until 2026-09-26, when the professions were cut at the user's
 * instruction: *"Some mechanics in the old game I want remove, hero placement,
 * different types of hires (SRE QA ETC."* Every hire is a developer again.
 */

import { playUi } from '../ui/uiSfx.ts'
import { formatMoney } from './hudModel.ts'
import { quote, segmentsFor, type Multiplier } from '../sim/hireDial.ts'
import { HIRE_COST_GROWTH } from '../sim/economy.ts'

export interface HireDialProps {
  devs: number
  cash: number
  value: Multiplier
  onChange: (value: Multiplier) => void
  /**
   * §4.10a's growth base as the game will charge it — `store.hireGrowthNow`.
   *
   * **Required, and it was missing.** These segments are priced by `quote`, the
   * same function the transaction uses, and the call here passed no growth at
   * all — so the dial quoted §13.7.1's Recruiting away and, once §14.8.9's cap
   * normalisation landed, would have quoted that away too. `hireDial.ts` has the
   * rule in a comment already: if a cost curve has two entry points, both take
   * the modifier or neither does. This is the third.
   *
   * Optional in the type only so the default matches `quote`'s own; every caller
   * in the app passes it.
   */
  growth?: number
}

export function HireDial({
  devs,
  cash,
  value,
  onChange,
  growth = HIRE_COST_GROWTH,
}: HireDialProps) {
  const segments = segmentsFor(devs)
  if (segments.length === 0) return null

  return (
    <div className="hire-dial" role="group" aria-label="Hire multiplier">
        {segments.map((seg) => {
          const q = quote(devs, cash, seg.value, growth)
          const selected = seg.value === value
          return (
            <button
              key={seg.label}
              type="button"
              className="hire-dial__seg"
              data-selected={selected ? 'true' : 'false'}
              // §10.10.3 rule 1 — an unaffordable multiplier is **shown, priced
              // and dimmed**, never hidden and never disabled. Hiding it removes
              // exactly the information the player needs to decide what to save
              // for; disabling it would stop them selecting the thing they are
              // saving *towards*, which is a stranger punishment still. The HIRE
              // button below is the control that refuses.
              data-affordable={q.affordable ? 'true' : 'false'}
              aria-pressed={selected}
              // Priced in the label, so a player comparing segments does not
              // have to select each one to find out what it costs.
              title={`${q.count} for ${formatMoney(q.cost)}`}
              onPointerDown={() => playUi('click')}
              onClick={() => onChange(seg.value)}
            >
              {seg.label}
            </button>
          )
        })}
    </div>
  )
}
