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
import { ROLES, ROLE_BLURB, ROLE_LABEL, type Role } from '../sim/roles.ts'

export interface HireDialProps {
  devs: number
  cash: number
  value: Multiplier
  onChange: (value: Multiplier) => void
  /** §4.11 — which job the next hire is for. */
  role: Role
  onRoleChange: (role: Role) => void
  /** §4.11 — the roles the studio has a reason to hire yet. */
  availableRoles?: readonly Role[]
}

/**
 * §4.11 — the job, above the count.
 *
 * A second row of segments in the same grammar as the multiplier: one tap sets
 * it, nothing is a stepper, and the selection persists. §10.10's argument for
 * the multiplier applies unchanged.
 *
 * **Roles appear as the studio earns them.** A garage has one job in it and
 * showing four would be four-fifths noise plus a question the player has no
 * information to answer — §4.11's joke only lands once they have been given
 * something to protect. `availableRoles` is the caller's judgement about that;
 * a single-entry list renders nothing at all, so Act I's frame is untouched.
 */
function RoleDial({
  role,
  roles,
  onChange,
}: {
  role: Role
  roles: readonly Role[]
  onChange: (role: Role) => void
}) {
  if (roles.length < 2) return null

  return (
    <div className="hire-dial hire-dial--role" role="group" aria-label="Hire role">
      {roles.map((r) => (
        <button
          key={r}
          type="button"
          className="hire-dial__seg"
          data-selected={r === role ? 'true' : 'false'}
          data-affordable="true"
          aria-pressed={r === role}
          // §4.11's "Produces" column, so the choice explains itself without a
          // legend. On a phone there is nowhere for a tooltip to live, so this
          // is also the accessible name.
          title={`${ROLE_LABEL[r]} — ${ROLE_BLURB[r]}`}
          onPointerDown={() => playUi('click')}
          onClick={() => onChange(r)}
        >
          {ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  )
}

export function HireDial({
  devs,
  cash,
  value,
  onChange,
  role,
  onRoleChange,
  availableRoles = ROLES,
}: HireDialProps) {
  const segments = segmentsFor(devs)
  // The role row outlives the multiplier row: §10.10.2 hides the multiplier
  // below 25 developers, and a studio of ten that has just shipped a buggy game
  // very much needs to be able to hire QA.
  const roleDial = <RoleDial role={role} roles={availableRoles} onChange={onRoleChange} />
  if (segments.length === 0) return roleDial

  return (
    <>
      {roleDial}
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
    </>
  )
}
