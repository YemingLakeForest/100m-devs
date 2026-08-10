/**
 * The OPTIONS terminal — GDD Appendix F2.1, §10.6, §20.
 *
 * F2.1 is the register's bluntest row: *"❌ All of it. §10.6 says style it as a
 * `STUDIO_OS` terminal and §10.8 lists it as a scene; nothing says what is in
 * it."* This is what is in it, and every row exists because something in the
 * game could not otherwise be turned down or turned off:
 *
 *   - **the §20 mixer**, which nothing exposed — a phone's volume rocker is one
 *     control, so wanting quiet music under loud pokes was previously unsayable;
 *   - **haptics**, which could not be disabled at all;
 *   - **reduce motion**, which was whatever the operating system said;
 *   - **reset progress**, the local half of F1.4's data deletion. A save that
 *     cannot be cleared is a game that can only be reviewed once.
 *
 * Restore purchases (F1.5) is deliberately absent rather than stubbed: there is
 * no RevenueCat in this build, and a button that cannot restore anything is a
 * worse answer to that row than an honest gap.
 *
 * **Rendered as readouts, not as form controls.** §10.6 names the axis-aligned
 * rounded rectangle and the native widget as the two things that make a screen
 * look like a web page, so a volume is a ten-cell meter that is *typed* rather
 * than an `<input type="range">`, and a toggle is a pair of bracketed words.
 * Everything here is the same slab the rest of the game presses.
 */

import { useEffect, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import {
  VOLUME_STEP,
  VOLUME_STEPS,
  getSettings,
  setSettings,
  subscribeSettings,
  type MotionPreference,
  type Settings,
} from '../settings/settings.ts'
import { clearSave } from '../game/save.ts'

/** Subscribe a component to the settings module. */
function useSettings(): Settings {
  const [s, setS] = useState(getSettings)
  useEffect(() => subscribeSettings(setS), [])
  return s
}

/**
 * A volume as ten cells.
 *
 * Filled cells are a solid block and empty ones a light shade, which is the
 * same two-value trick the §10.4 burn-down uses — at the type sizes §23.4's
 * design box allows, a bar drawn in box characters reads at a glance and a
 * percentage does not.
 */
function Meter({ value }: { value: number }) {
  const filled = Math.round(value * VOLUME_STEPS)
  return (
    <span className="opt__meter" aria-hidden="true">
      {'█'.repeat(filled)}
      {'░'.repeat(VOLUME_STEPS - filled)}
    </span>
  )
}

function VolumeRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const percent = Math.round(value * 100)
  return (
    <div className="opt__row">
      <span className="opt__label">{label}</span>
      <div className="opt__control">
        <Button
          onClick={() => onChange(value - VOLUME_STEP)}
          disabled={value <= 0}
          aria-label={`${label} down`}
        >
          −
        </Button>
        <Meter value={value} />
        <Button
          onClick={() => onChange(value + VOLUME_STEP)}
          disabled={value >= 1}
          aria-label={`${label} up`}
        >
          +
        </Button>
        {/* The number is for screen readers and for anyone who wants it; the
            meter is what the eye actually uses. */}
        <span className="opt__value">{percent}%</span>
      </div>
    </div>
  )
}

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; text: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="opt__row">
      <span className="opt__label">{label}</span>
      <div className="opt__control">
        {options.map((o) => (
          <Button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={o.value === value ? 'is-chosen' : undefined}
            aria-pressed={o.value === value}
          >
            {o.text}
          </Button>
        ))}
      </div>
    </div>
  )
}

const MOTION_OPTIONS: readonly { value: MotionPreference; text: string }[] = [
  { value: 'system', text: 'SYSTEM' },
  { value: 'full', text: 'FULL' },
  { value: 'reduced', text: 'REDUCED' },
]

export function Options() {
  const s = useSettings()
  // Two presses to wipe a save, and the second one says what it does. §10.6
  // forbids a native dialog and F2's "press and hold changed nothing" rule
  // means this cannot hide behind a long-press either.
  const [armed, setArmed] = useState(false)

  return (
    <div className="opt">
      <h2 className="opt__title">OPTIONS</h2>

      <VolumeRow label="MUSIC" value={s.music} onChange={(music) => setSettings({ music })} />
      <VolumeRow label="EFFECTS" value={s.sfx} onChange={(sfx) => setSettings({ sfx })} />

      <ChoiceRow
        label="HAPTICS"
        value={s.haptics ? 'on' : 'off'}
        options={[
          { value: 'on', text: 'ON' },
          { value: 'off', text: 'OFF' },
        ]}
        onChange={(v) => setSettings({ haptics: v === 'on' })}
      />

      <ChoiceRow
        label="MOTION"
        value={s.motion}
        options={MOTION_OPTIONS}
        onChange={(motion) => setSettings({ motion })}
      />

      <div className="opt__row opt__row--danger">
        <span className="opt__label">PROGRESS</span>
        <div className="opt__control">
          {armed ? (
            <>
              <Button
                variant="bait"
                onClick={() => {
                  clearSave()
                  // A reload rather than a store reset: §24's permanent block is
                  // held in a module variable and the renderer has a floor built
                  // for the headcount that no longer exists. Rebuilding both by
                  // hand is a second reset path to keep correct forever, and the
                  // one moment a player is guaranteed not to mind a relaunch is
                  // the one where they just asked to erase everything.
                  location.reload()
                }}
              >
                ERASE EVERYTHING
              </Button>
              <Button onClick={() => setArmed(false)}>KEEP IT</Button>
            </>
          ) : (
            <Button onClick={() => setArmed(true)}>RESET</Button>
          )}
        </div>
      </div>

      {armed && (
        <p className="opt__warning">
          This deletes the run, every Bandwidth Point and every lifetime total. There is no
          undo and there is no cloud copy.
        </p>
      )}
    </div>
  )
}
