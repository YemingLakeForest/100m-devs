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

import {
  AdvancedBloomFilter,
  CRTFilter,
  RGBSplitFilter,
  TiltShiftFilter,
  ZoomBlurFilter,
} from 'pixi-filters'
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
    /**
     * [2026-09-26] How much of pass 5's line contrast to draw, 0..1 (default 1):
     * *"the CRT lines are distorting our character's faces"*. See `update`.
     */
    lines?: number
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
 * desk.
 *
 * **Was 110**, sized to one desk assembly (-70..+60) so the monitor and hands
 * stayed sharp and the floor fell away. That is the correct number for a photo
 * of one desk and the wrong one for a *room*: at ten developers the §7.8.1 floor
 * is several hundred units deep, so most of the studio sat outside the band —
 * and with it the §6.3 speech bubbles, which are dialogue, which is the product.
 * They arrived as an illegible smear and §7.6a is unambiguous about that.
 *
 * Widened to cover the room the camera is actually framing. The pass still
 * falls off past the floor's edge, which is all it was ever contributing to an
 * **isometric** scene — a projection with no perspective has no focal plane to
 * shift, so a literal depth of field here was always decoration rather than a
 * camera model.
 */
const FOCAL_HALF_HEIGHT = 420

export const ALL_PASSES: readonly PassName[] = ['tilt', 'zoom', 'bloom', 'rgb', 'crt']

export function createPostProcess({
  reduceMotion = false,
  passes = new Set(ALL_PASSES),
}: PostProcessOptions = {}): PostProcess {
  // 1. Tilt-shift — desk zoom only, keeps the target row razor-sharp (GDD §8.1).
  const tiltShift = new TiltShiftFilter({ blur: 0, gradientBlur: 600 })

  // 2. Radial zoom blur — fires on a rapid dolly (GDD §8.1, §20.4).
  const zoomBlur = new ZoomBlurFilter({ strength: 0, radius: -1, innerRadius: 80 })

  /*
   * 3. Bloom — rises with strain.
   *
   * §7.8.0c [amended 2026-09-03] — **and it only picks up what is actually
   * bright.** `BloomFilter` blurs the whole frame and adds it back, so every
   * surface in the picture glows a little: measured on the garage's completed
   * frame it lifted the mean by 48 per cent, which turned a dark room with warm
   * pools in it into a pale room with warm patches. The pools stopped being
   * pools, and the faces, desk edges and monitor silhouettes inside them went
   * soft — the one thing §7.8.0c's lighting section says must not happen.
   *
   * `AdvancedBloomFilter` extracts by **threshold** first, so the concrete, the
   * block and the road contribute nothing and the lamps, the screens and the
   * glass contribute all of it. That is the same picture the concept draws and
   * it is what "bloom is a suggestion, not a glow" was always trying to say —
   * the old filter could only make the suggestion quieter, never narrower.
   *
   * It costs a second pass over the frame, which is the honest price and is
   * paid at the one place §23.3's budget is measured: the same five-filter
   * chain, one of them now two-stage.
   */
  const bloom = new AdvancedBloomFilter({
    // Above the room's own surfaces and below its lights. The garage's floor
    // and block sit at the bottom third of the ramp; a lamp pool, a monitor
    // face and the sign's lettering are the things above this line.
    threshold: 0.74,
    bloomScale: 1,
    brightness: 1,
    blur: 2,
    quality: 2,
  })

  // 4. Chromatic aberration — subtle, with a brief punch on crits.
  const rgbSplit = new RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } })

  // 5 + 6. Scanlines, roll and noise, plus the barrel curvature and vignette
  // that weld the two registers together. One filter carries both because
  // curvature has to be applied to the scanlines too — a flat scanline over a
  // curved image reads as an overlay rather than as glass.
  const crt = new CRTFilter({
    // Curvature stays: it is pass 6, the weld, and §6 forbids removing it. What
    // came down is the scanline contrast — a hard dark line every 1.4px over a
    // 9px glyph removes about a third of the glyph.
    curvature: 3,
    lineWidth: 1.4,
    lineContrast: 0.14,
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

    update({ glass, zoom, zoomVelocity, critPunch, width, height, lines = 1 }) {
      elapsed += 1 / 60

      // 1. Depth of field belongs to the desk. It fades out as the camera
      // pulls back, because at global scale there is no "target row" to hold.
      //
      // 6px, not the 14 an earlier pass used: at 14 the blur was wide enough to
      // smear the desk itself rather than just the surround, which reads as an
      // out-of-focus photograph instead of a tilt-shifted one.
      // **The vibe, not the effect** — GDD §7.6a. At 6px this was a real
      // tilt-shift and it was doing real damage: the §6.3 speech bubbles, which
      // are dialogue, which is the product, stopped being readable the moment
      // the floor filled up. The pass exists to say "a camera is focused on
      // something here", and 2px says that. Where legibility and the filter
      // disagree, legibility wins — every time, and without a setting.
      const deskness = Math.max(0, 1 - zoom * 3)
      tiltShift.blur = reduceMotion ? 0 : 2 * deskness
      // The band is expressed in the WORLD container's local space, not the
      // screen's — this filter hangs off `world`, whose origin is the focal
      // desk. Using screen coordinates here put the sharp band somewhere above
      // the subject and blurred the one thing it exists to keep crisp.
      tiltShift.start = { x: -width, y: -FOCAL_HALF_HEIGHT }
      tiltShift.end = { x: width, y: FOCAL_HALF_HEIGHT }

      // 2. Velocity-driven smear. Clamped: a fling gesture can produce a
      // spike large enough to white out the frame otherwise.
      // Halved, and clamped harder. §7.6a again: a dolly should feel like
      // movement, not like the picture coming apart, and this pass fires during
      // exactly the gesture the player uses to go and read something.
      zoomBlur.strength = reduceMotion ? 0 : Math.min(0.18, zoomVelocity * 0.45)
      zoomBlur.center = { x: width / 2, y: height / 2 }

      /*
       * 3. **Bloom is a suggestion, not a glow** (§7.6a). At `2 + E*10` a
       * strained studio washed out, and a wash is the same as a blur for
       * anything with text on it. It still rises with strain — that reading is
       * load-bearing for §21 Act IV — it just stops arriving as fog.
       *
       * The strain now moves `bloomScale`, which is *how much* of the extracted
       * highlights come back, rather than the blur radius. A calm studio gets a
       * tight halo on its lamps; a seizing one gets the same lamps blown out,
       * which is the reading §21 Act IV wants and is a thing that happens to
       * the lights rather than to the room.
       */
      bloom.bloomScale = 0.55 + glass.bloom * 1.5

      // 4. Entropy sets the floor, a crit adds a punch on top of it.
      // Fringing is the single worst pass for small text, because it attacks the
      // edges glyphs are made of. Enough to see on a crit, not enough to double
      // a letterform.
      const split = glass.chromaticAberration * 2 + critPunch * 3
      rgbSplit.red = { x: -split, y: 0 }
      rgbSplit.green = { x: 0, y: 0 }
      rgbSplit.blue = { x: split, y: 0 }

      // 5. The roll is a slow vertical drift, not an animation loop — under
      // load the picture should look like it is failing to hold sync. The
      // floor was 0.25 rad/s, which turns one scanline period in ~25 s and so
      // reads as static rather than as glass; 7.2 rad/s (~6 px/s) is a visible
      // but gentle fall, and the load term still takes it from drift to sync-
      // loss as entropy climbs.
      crt.time = reduceMotion ? 0 : elapsed * (7.2 + glass.scanlineRoll * 2.0)
      crt.noise = glass.scanlineNoise * 0.09
      /*
       * [2026-09-26] **Lines, not bars across a face.** The contrast was set for
       * a pixel room of 9 px glyphs and 11 px people, where a dark line every
       * 1.4 px is texture. Over the 3D room a face is a hundred pixels of smooth
       * shading, and the same line reads as a comb drawn across it — worse as it
       * rolls. The stage scales it down there (`lines`); the glass stays, the
       * curvature and vignette (pass 6, the weld) are untouched.
       */
      crt.lineContrast = (0.14 + glass.scanlineNoise * 0.1) * Math.max(0, Math.min(1, lines))

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
