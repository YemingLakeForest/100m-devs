/**
 * The post-process stack — ART_DIRECTION §6.
 *
 * Applied over BOTH the world canvas and the interface layer, in this order:
 *
 *   1. Tilt-shift depth of field   <- zoom level
 *   2. Radial / zoom blur          <- camera velocity
 *   3. Bloom                       <- Entropy
 *   4. Chromatic aberration        <- Entropy + poke crits
 *   5. Scanlines + roll            <- Entropy
 *   6. Barrel curvature + vignette <- fixed
 *
 * Pass 6 is the weld. It is the reason a purchased desk sprite and a
 * hand-drawn card frame read as the same product. Never disable it, and never
 * apply it to only one layer.
 */

import { BloomFilter, CRTFilter, RGBSplitFilter, TiltShiftFilter, ZoomBlurFilter } from 'pixi-filters'
import type { Filter } from 'pixi.js'
import type { GlassParams } from '../art/entropyTheme.ts'

export interface PostProcess {
  /**
   * Pass 1 only — depth of field, which belongs on the WORLD container.
   *
   * Two reasons it is split out rather than sitting in the main chain. It is a
   * world-space effect: it models a camera focusing on a plane among the desks,
   * and there is no sensible focal plane for a HUD. And empirically, stacking
   * TiltShiftFilter ahead of the other four in one chain renders black — it is
   * internally two axis passes whose padding does not survive being fed into
   * the bloom/CRT chain. ART_DIRECTION §6's non-negotiable is that pass 6
   * covers every layer; it does not require all six to share one container.
   */
  worldFilters: Filter[]
  /** Passes 2–6, in §6 order. Assign onto the container holding the world. */
  filters: Filter[]
  /**
   * Drive the whole stack from the frame's state.
   *
   * @param glass         entropy-derived parameters, ART_DIRECTION §1.1
   * @param zoom          0 (desk) .. 1 (cosmic), the continuous Omni-Lens Z
   * @param zoomVelocity  |dZ/dt|, drives the radial smear on a rapid dolly
   * @param critPunch     0..1, decaying kick from a Flow State or 10x poke
   * @param width/height  canvas size in pixels; several passes are in pixels
   */
  update(args: {
    glass: GlassParams
    zoom: number
    zoomVelocity: number
    critPunch: number
    width: number
    height: number
  }): void
  destroy(): void
}

/**
 * Reduce-motion, GDD §10.5. Shortens passes 2 and 5; it never removes pass 6,
 * because pass 6 is what makes the layers one product rather than a preference.
 */
export interface PostProcessOptions {
  reduceMotion?: boolean
  /**
   * Which passes to actually attach, by §6 name. Defaults to all six.
   *
   * The stack is where a frame budget goes to die, and it is also where a
   * single mis-parameterised filter can black out the whole screen. Being able
   * to bisect it without a rebuild is worth the one branch.
   */
  passes?: ReadonlySet<PassName>
}

export type PassName = 'tilt' | 'zoom' | 'bloom' | 'rgb' | 'crt'

/**
 * Half-height of the in-focus band, in world units either side of the focal
 * desk. The desk assembly spans roughly -70..+60 locally, so 110 keeps the
 * monitor and the developer's hands sharp and lets the floor fall away.
 */
const FOCAL_HALF_HEIGHT = 110

export const ALL_PASSES: readonly PassName[] = ['tilt', 'zoom', 'bloom', 'rgb', 'crt']

export function createPostProcess({
  reduceMotion = false,
  passes = new Set(ALL_PASSES),
}: PostProcessOptions = {}): PostProcess {
  // 1. Tilt-shift — desk zoom only, keeps the target row razor-sharp (GDD §8.1).
  const tiltShift = new TiltShiftFilter({ blur: 0, gradientBlur: 600 })

  // 2. Radial zoom blur — fires on a rapid dolly (GDD §8.1, §20.4).
  const zoomBlur = new ZoomBlurFilter({ strength: 0, radius: -1, innerRadius: 80 })

  // 3. Bloom — rises with strain.
  const bloom = new BloomFilter({ strength: 2 })

  // 4. Chromatic aberration — subtle, with a brief punch on crits.
  const rgbSplit = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } })

  // 5 + 6. Scanlines, roll and noise, plus the barrel curvature and vignette
  // that weld the two registers together. One filter carries both because
  // curvature has to be applied to the scanlines too — a flat scanline over a
  // curved image reads as an overlay rather than as glass.
  const crt = new CRTFilter({
    curvature: 3,
    lineWidth: 1.4,
    lineContrast: 0.22,
    verticalLine: false,
    noise: 0,
    noiseSize: 1,
    vignetting: 0.28,
    vignettingAlpha: 0.85,
    vignettingBlur: 0.4,
    time: 0,
  })

  let elapsed = 0

  const byName: Record<PassName, Filter> = {
    tilt: tiltShift,
    zoom: zoomBlur,
    bloom,
    rgb: rgbSplit,
    crt,
  }

  return {
    worldFilters: passes.has('tilt') ? [tiltShift] : [],
    // Order is §6 order, filtered by what was asked for — never reordered.
    filters: ALL_PASSES.filter((p) => p !== 'tilt' && passes.has(p)).map((p) => byName[p]),

    update({ glass, zoom, zoomVelocity, critPunch, width, height }) {
      elapsed += 1 / 60

      // 1. Depth of field belongs to the desk. It fades out as the camera
      // pulls back, because at global scale there is no "target row" to hold.
      //
      // 6px, not the 14 an earlier pass used: at 14 the blur was wide enough to
      // smear the desk itself rather than just the surround, which reads as an
      // out-of-focus photograph instead of a tilt-shifted one.
      const deskness = Math.max(0, 1 - zoom * 3)
      tiltShift.blur = reduceMotion ? 0 : 6 * deskness
      // The band is expressed in the WORLD container's local space, not the
      // screen's — this filter hangs off `world`, whose origin is the focal
      // desk. Using screen coordinates here put the sharp band somewhere above
      // the subject and blurred the one thing it exists to keep crisp.
      tiltShift.start = { x: -width, y: -FOCAL_HALF_HEIGHT }
      tiltShift.end = { x: width, y: FOCAL_HALF_HEIGHT }

      // 2. Velocity-driven smear. Clamped: a fling gesture can produce a
      // spike large enough to white out the frame otherwise.
      zoomBlur.strength = reduceMotion ? 0 : Math.min(0.35, zoomVelocity * 0.9)
      zoomBlur.center = { x: width / 2, y: height / 2 }

      // 3.
      bloom.strength = 2 + glass.bloom * 10

      // 4. Entropy sets the floor, a crit adds a punch on top of it.
      const split = glass.chromaticAberration * 4 + critPunch * 6
      rgbSplit.red = { x: -split, y: 0 }
      rgbSplit.green = { x: 0, y: 0 }
      rgbSplit.blue = { x: split, y: 0 }

      // 5. The roll is a slow vertical drift, not an animation loop — under
      // load the picture should look like it is failing to hold sync.
      crt.time = reduceMotion ? 0 : elapsed * (0.25 + glass.scanlineRoll * 2.5)
      crt.noise = glass.scanlineNoise * 0.18
      crt.lineContrast = 0.22 + glass.scanlineNoise * 0.2

      // Entropy Lock: horizontal tear. Driving seed rather than curvature
      // keeps the glass itself constant, which §6 requires.
      crt.seed = glass.tear > 0 ? Math.random() : 0

      // 6. Fixed. Deliberately not touched by any of the above.
    },

    destroy() {
      for (const f of [tiltShift, zoomBlur, bloom, rgbSplit, crt]) f.destroy()
    },
  }
}
