/**
 * The interface is alive, and Entropy drives it — ART_DIRECTION §1.1.
 *
 * The interface hue is a direct function of Communication Entropy (E). Not
 * decoration: the same variable the simulation runs on. One driver instead of
 * five hand-authored states, and it costs shader time rather than art time.
 *
 *   E              state      hue                glass
 *   0    – 0.25    calm       cyan               clean scanlines, minimal bloom
 *   0.25 – 0.60    loaded     cyan -> amber      scanlines gain slight roll
 *   0.60 – 0.85    strained   amber              bloom rises, first fringing
 *   0.85 – 0.99    critical   amber -> red       micro-jitter, scanline noise
 *   >= 0.99        lock       alarm red          heavy fringe, tear, burn-in
 */

import { RAMPS, hexToRgb, rgbToHex } from './palette.ts'

export type InterfaceState = 'calm' | 'loaded' | 'strained' | 'critical' | 'lock'

/** The four phosphor values the interface is drawn in, darkest to brightest. */
export type PhosphorRamp = readonly [string, string, string, string]

export interface GlassParams {
  /** Post-process pass 3. Rises with strain. */
  bloom: number
  /** Post-process pass 4. Subtle; a brief punch on crits is added on top. */
  chromaticAberration: number
  /** Pass 5 roll speed — scanlines gain a slow vertical drift under load. */
  scanlineRoll: number
  /** Pass 5 noise — grain in the scanlines once the studio is straining. */
  scanlineNoise: number
  /** GDD §8.1: the whole screen micro-jitters above 80% entropy. */
  jitter: number
  /** Entropy Lock only — horizontal tear and phosphor burn-in ghosting. */
  tear: number
}

export interface EntropyTheme {
  state: InterfaceState
  phosphor: PhosphorRamp
  glass: GlassParams
}

/** Linear interpolation between two `#rrggbb` values, in sRGB. */
function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const m = (x: number, y: number) => Math.round(x + (y - x) * t)
  return rgbToHex(m(ar, br), m(ag, bg), m(ab, bb))
}

function mixRamp(a: readonly string[], b: readonly string[], t: number): PhosphorRamp {
  return [
    mixHex(a[0], b[0], t),
    mixHex(a[1], b[1], t),
    mixHex(a[2], b[2], t),
    mixHex(a[3], b[3], t),
  ] as const
}

/** Normalised 0–1 position of `v` inside `[lo, hi]`, clamped. */
function span(v: number, lo: number, hi: number): number {
  if (hi <= lo) return 0
  return Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
}

export function interfaceState(e: number): InterfaceState {
  if (e >= 0.99) return 'lock'
  if (e >= 0.85) return 'critical'
  if (e >= 0.6) return 'strained'
  if (e >= 0.25) return 'loaded'
  return 'calm'
}

/** Resolve the whole interface look from one number. */
export function entropyTheme(rawEntropy: number): EntropyTheme {
  const e = Math.min(1, Math.max(0, rawEntropy))
  const state = interfaceState(e)

  let phosphor: PhosphorRamp
  switch (state) {
    case 'calm':
      phosphor = RAMPS.CALM as unknown as PhosphorRamp
      break
    case 'loaded':
      // The crossfade the table calls for — cyan bleeding to amber.
      phosphor = mixRamp(RAMPS.CALM, RAMPS.WARN, span(e, 0.25, 0.6))
      break
    case 'strained':
      phosphor = RAMPS.WARN as unknown as PhosphorRamp
      break
    case 'critical':
      phosphor = mixRamp(RAMPS.WARN, RAMPS.ALARM, span(e, 0.85, 0.99))
      break
    case 'lock':
      phosphor = RAMPS.ALARM as unknown as PhosphorRamp
      break
  }

  return {
    state,
    phosphor,
    glass: {
      // Bloom is flat while calm and climbs once the studio is loaded, so a
      // healthy studio reads clean rather than merely "less bloomy".
      bloom: 0.15 + 0.85 * span(e, 0.25, 1),
      chromaticAberration: span(e, 0.6, 1) * (state === 'lock' ? 1 : 0.6),
      scanlineRoll: span(e, 0.25, 0.85),
      scanlineNoise: span(e, 0.6, 1),
      // GDD §8.1 puts the jitter threshold at >80%, slightly ahead of the
      // ART_DIRECTION §1.1 'critical' band at 85%. The earlier of the two wins:
      // the screen should already be unsettled as the player crosses into
      // critical, not start moving exactly on the boundary.
      jitter: span(e, 0.8, 1),
      tear: state === 'lock' ? 1 : 0,
    },
  }
}

/** Push a theme onto the document as the `--p0..--p3` custom properties. */
export function applyEntropyTheme(theme: EntropyTheme, root: HTMLElement): void {
  const [p0, p1, p2, p3] = theme.phosphor
  root.style.setProperty('--p0', p0)
  root.style.setProperty('--p1', p1)
  root.style.setProperty('--p2', p2)
  root.style.setProperty('--p3', p3)
  root.dataset.entropyState = theme.state
}
