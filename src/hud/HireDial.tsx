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
 */

import { playUi } from '../ui/uiSfx.ts'
import { formatMoney } from './hudModel.ts'
import { quote, segmentsFor, type Multiplier } from '../sim/hireDial.ts'

export interface HireDialProps {
  devs: number
  cash: number
  value: Multiplier
  onChange: (value: Multiplier) => void
}

export function HireDial({ devs, cash, value, onChange }: HireDialProps) {
  const segments = segmentsFor(devs)
  if (segments.length === 0) return null

  return (
    <div className="hire-dial" role="group" aria-label="Hire multiplier">
      {segments.map((seg) => {
        const q = quote(devs, cash, seg.value)
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
