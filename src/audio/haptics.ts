/**
 * Haptic responses — GDD §8.2, §8.3.
 *
 * Each dev state gets a distinct feel, because the haptic is how the poke's
 * *outcome* is communicated before the numeral has finished arcing. A 10x
 * Engineer quitting must not feel like a routine tap.
 */

import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { getSettings } from '../settings/settings.ts'
import type { DevState } from '../sim/poke.ts'

const isNative = Capacitor.isNativePlatform()

/**
 * Whether to buzz at all — Appendix F2.1.
 *
 * Read live rather than mirrored, unlike `sfx.ts`'s volume: this is a property
 * lookup on a module object, the native calls below are already un-awaited, and
 * the setting has to be able to stop a haptic that is about to fire on the very
 * next tap after the toggle.
 *
 * A phone that vibrates in a quiet room is the one piece of feedback in this
 * game that can embarrass its player, and until now it could not be turned off.
 */
function enabled(): boolean {
  return isNative && getSettings().haptics
}

/**
 * Fire the haptic for a poked developer's state.
 *
 * Un-awaited on purpose: the plugin call crosses the bridge, and awaiting it
 * would put bridge latency inside the tap handler that GDD §23.3 criterion 1
 * measures.
 */
/**
 * The hold has registered — GDD §7.7.6a.
 *
 * **The one place §8.1's haptics are load-bearing rather than juice.** A touch
 * screen has no cursor, so the moment a press stops being a poke and becomes a
 * grab is otherwise invisible: the player finds out by watching a developer
 * they did not mean to pick up follow their thumb around.
 *
 * This fires *at the instant the timer elapses*, while the finger is still on
 * the glass and before anything has moved. That is the whole solution — it
 * converts an invisible mode change into a felt one, so the boundary is learned
 * in one accidental attempt rather than in twenty.
 *
 * Medium rather than Light: it has to be distinguishable from the Light tick a
 * routine poke fires, or it is telling the player something they cannot hear.
 */
export function holdHaptic(): void {
  if (!enabled()) return
  void Haptics.impact({ style: ImpactStyle.Medium })
}

/** A single confident confirmation when a permanent multiplier resolves. */
export function purchaseHaptic(): void {
  if (!enabled()) return
  void Haptics.impact({ style: ImpactStyle.Medium })
}

export function pokeHaptic(state: DevState): void {
  if (!enabled()) return

  switch (state) {
    // "Short tick" — the baseline poke.
    case 'working':
      void Haptics.impact({ style: ImpactStyle.Light })
      break

    // "Sharp, double tap".
    case 'slacking':
      void Haptics.impact({ style: ImpactStyle.Medium })
      setTimeout(() => void Haptics.impact({ style: ImpactStyle.Light }), 60)
      break

    // "Long rumble" — head on keyboard.
    case 'overwhelmed':
      void Haptics.vibrate({ duration: 220 })
      break

    // "Light tickle / high-freq" — pixel stars, steam from the ears.
    case 'flow':
      void Haptics.impact({ style: ImpactStyle.Light })
      setTimeout(() => void Haptics.impact({ style: ImpactStyle.Light }), 40)
      setTimeout(() => void Haptics.impact({ style: ImpactStyle.Light }), 80)
      break

    // "Warning pulse" — they were about to break the build.
    case 'rogue':
      void Haptics.notification({ type: NotificationType.Warning })
      break

    // "Heavy double thud" — they turn to face the camera, then walk off-screen.
    case 'tenx':
      void Haptics.impact({ style: ImpactStyle.Heavy })
      setTimeout(() => void Haptics.impact({ style: ImpactStyle.Heavy }), 110)
      break
  }
}
