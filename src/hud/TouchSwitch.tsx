import { setTouchMode, type GameState } from '../game/store.ts'
import {
  TOUCH_ICON,
  TOUCH_LABEL,
  TOUCH_LATCHES,
  touchHint,
  type TouchLatch,
} from '../game/touchMode.ts'
import { playUi } from '../ui/uiSfx.ts'

/**
 * What the finger does, said out loud — GDD §7.7.6b.
 *
 * Two latches and a caption. The caption is the part that does the teaching:
 * POKE and GRAB name the modes, and the line under them names the *consequence*
 * — TAP TO CODE, DRAG PEOPLE, TAP TO CHECK — which is what a player reads when
 * they are wondering why the last tap did not do what they expected.
 *
 * **Not a `Button`.** §10.8 F2's control is a sprung slab that reports a
 * discrete action; this reports a *state*, and it has to still be legible as
 * on or off while the thumb is nowhere near it. So it takes the readout
 * treatment instead — the §7.1 wash, the rail's rule, phosphor ink — and the
 * lit one inverts. It is the same idiom as §10.10.1's hire dial, which is the
 * other control in this game that says which of several things a later gesture
 * will mean, and two controls doing that job should look like each other.
 *
 * It sits at the **foot of the right rail** rather than beside the readouts,
 * next to the thumb that uses it: §23.4.2's frame is landscape, held in two
 * hands, and this is a control the player reaches for mid-poke rather than
 * once a session.
 */
export function TouchSwitch({ state }: { state: GameState }) {
  const press = (latch: TouchLatch) => {
    // F3 — one sound per state change. `click` rather than `whoosh`: this is a
    // switch being thrown, not a panel arriving.
    playUi('click')
    setTouchMode(latch)
  }

  return (
    <div className="touch">
      <div className="touch__latches">
        {TOUCH_LATCHES.map((latch) => {
          const lit = state.touchMode === latch
          return (
            <button
              key={latch}
              type="button"
              className={`touch__latch${lit ? ' is-lit' : ''}`}
              // The state is on the element rather than only in its colour, so
              // the control is a switch to a screen reader and not two buttons
              // that happen to look different.
              aria-pressed={lit}
              onPointerDown={() => press(latch)}
            >
              <span className="touch__icon" aria-hidden="true">{TOUCH_ICON[latch]}</span>
              <span>{TOUCH_LABEL[latch]}</span>
            </button>
          )
        })}
      </div>
      <span className="touch__hint">{touchHint(state.touchMode, state.cameraRung)}</span>
    </div>
  )
}
