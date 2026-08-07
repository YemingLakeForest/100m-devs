/**
 * Haptic responses — GDD §8.2, §8.3.
 *
 * Each dev state gets a distinct feel, because the haptic is how the poke's
 * *outcome* is communicated before the numeral has finished arcing. A 10x
 * Engineer quitting must not feel like a routine tap.
 */

import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { DevState } from '../sim/poke.ts'

const isNative = Capacitor.isNativePlatform()

/**
 * Fire the haptic for a poked developer's state.
 *
 * Un-awaited on purpose: the plugin call crosses the bridge, and awaiting it
 * would put bridge latency inside the tap handler that GDD §23.3 criterion 1
 * measures.
 */
export function pokeHaptic(state: DevState): void {
  if (!isNative) return

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
