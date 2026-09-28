/**
 * **The glass** — ART_DIRECTION §6, in three.js [ported 2026-09-28].
 *
 * The Pixi stage is decommissioned — the user, 2026-09-28: *"pixi scenes are
 * supposed to be completed decommissioned. we should do that first if there
 * are gates/validation any productivity drags because of them"* — and the
 * glass was the one part of it that the 3D garage was actually wearing: the
 * garage drew into its own canvas, the Pixi stage took that canvas as a
 * texture, and `render/postProcess.ts` (pixi-filters) went over the top. Now
 * the garage's renderer draws the studio into a target and this is the last
 * draw of every frame, onto the screen.
 *
 * What was ported, pass by pass, and what was not:
 *
 *  1. **Tilt-shift — not ported.** It hung off the Pixi *world* container,
 *     which was hidden whenever the 3D garage was on screen; it never once
 *     touched the room.
 *  2. **Zoom blur — not ported.** The stage zeroed it over the 3D room (a hire
 *     flew the hidden lens, and its smear would have blurred a still picture).
 *  3. **Bloom** — in the garage's own composer (`garageView.setBloom`), after
 *     its output pass, so AdvancedBloomFilter's 0.74 threshold still means what
 *     it meant: brightness as displayed. It is drawn when the room is.
 *  4. **Chromatic aberration** — here, as a horizontal split in pixels.
 *  5 and 6. **Scanlines, roll, noise and vignette** — here, pixi-filters' CRT
 *     shader line for line. Its *curvature* bends the scanline pattern and
 *     nothing else: the image was never barrel-warped, so a tap lands on what
 *     is drawn under it. The old stage's note that taps near the frame's edge
 *     were "a few pixels off" was about a distortion that did not exist.
 *
 * Two things the Pixi glass container carried as well, because they were
 * children of it: **the screen shake** (a ship's punch; it slid the picture and
 * its lines together) and **the poke numerals** (§8.2), which sit *under* the
 * lines — §6's weld — and are composited here from their own canvas.
 *
 * Pass 6 is the weld and §6 forbids removing it. The view-mode switch (`C`,
 * `?crt=off`) still takes the whole glass off, as it did.
 */

import * as T from 'three'
import type { GlassParams } from '../../art/entropyTheme.ts'

/** Which parts of the glass are attached — `?post=rgb,crt`, the old bisecting switch. */
export interface GlassPasses {
  rgb: boolean
  crt: boolean
}

export interface GlassFrame {
  /** Entropy-derived parameters, ART_DIRECTION §1.1. */
  glass: GlassParams
  /** 0..1, a decaying kick from a Flow State or 10x poke. */
  critPunch: number
  /**
   * How much of the scanline contrast to draw, 0..1. *"The CRT lines are
   * distorting our character's faces"* (2026-09-26): over a 3D room a face is a
   * hundred pixels of smooth shading and a hard line every 1.4 px is a comb
   * drawn across it, so the stage turns it down as faces fill the frame.
   */
  lines: number
  /** The picture's shift, in CSS pixels. */
  shake: { x: number; y: number }
  /** Seconds, for the roll. */
  seconds: number
  /** Frame size in CSS pixels; the CRT's lines are measured in these. */
  width: number
  height: number
}

export interface Glass {
  /** Whether any of it is on — the view mode's switch. */
  enabled: boolean
  /**
   * Draw `scene` (and `overlay`, under the lines) to the screen through the glass.
   * `overlay` is premultiplied-free RGBA with alpha — the numerals' canvas.
   */
  render(renderer: T.WebGLRenderer, scene: T.Texture, overlay: T.Texture | null, frame: GlassFrame): void
  dispose(): void
}

/** §6 pass 5 and 6, as `postProcess.ts` configured pixi-filters' `CRTFilter`. */
const CRT = { curvature: 3, lineWidth: 1.4, lineContrast: 0.14, vignetting: 0.28, vignettingAlpha: 0.85, vignettingBlur: 0.4 }

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/*
 * pixi-filters 6.1's `crt.wgsl`, ported to GLSL: `vignette`, `noise` and
 * `interlaceLines` are the same arithmetic on the same uniforms. The one change
 * is the frame: a Pixi filter samples a padded input texture and converts with
 * `uInputSize / uDimensions`; this samples a full-frame target, so that ratio
 * is one and `coord` is the uv.
 */
const fragmentShader = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tOverlay;
uniform float uHasOverlay;
uniform vec2 uDimensions;
uniform vec2 uShake;
uniform float uSplit;
uniform vec4 uLine;
uniform vec2 uNoise;
uniform vec3 uVignette;
uniform float uSeed;
uniform float uTime;
uniform float uCrt;
varying vec2 vUv;

const float SQRT_2 = 1.414213;

vec3 layer(vec2 uv) {
  vec3 colour = texture2D(tScene, uv).rgb;
  if (uHasOverlay > 0.5) {
    vec4 o = texture2D(tOverlay, uv);
    colour = mix(colour, o.rgb, o.a);
  }
  return colour;
}

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float vignette(vec2 coord) {
  float outter = SQRT_2 - uVignette.x * SQRT_2;
  vec2 dir = vec2(0.5) - coord;
  dir.y *= uDimensions.y / uDimensions.x;
  float darker = clamp((outter - length(dir) * SQRT_2) / (0.00001 + uVignette.z * SQRT_2), 0.0, 1.0);
  return darker + (1.0 - darker) * (1.0 - uVignette.y);
}

float noise(vec2 coord) {
  vec2 pixelCoord = coord * uDimensions;
  pixelCoord.x = floor(pixelCoord.x / uNoise.y);
  pixelCoord.y = floor(pixelCoord.y / uNoise.y);
  return (rand(pixelCoord * uNoise.y * uSeed) - 0.5) * uNoise.x;
}

vec3 interlaceLines(vec3 co, vec2 coord) {
  vec3 colour = co;
  float curvature = uLine.x;
  float lineWidth = uLine.y;
  float lineContrast = uLine.z;
  float verticalLine = uLine.w;
  vec2 dir = coord - 0.5;
  float c = curvature > 0.0 ? curvature : 1.0;
  float k = curvature > 0.0 ? (length(dir * dir) * 0.25 * c * c + 0.935 * c) : 1.0;
  vec2 uv = dir * k;
  float v = (verticalLine > 0.5 ? uv.x * uDimensions.x : uv.y * uDimensions.y) * min(1.0, 2.0 / lineWidth) / c;
  float j = 1.0 + cos(v * 1.2 - uTime) * 0.5 * lineContrast;
  colour *= j;
  float segment = verticalLine > 0.5 ? mod((dir.x + 0.5) * uDimensions.x, 4.0) : mod((dir.y + 0.5) * uDimensions.y, 4.0);
  colour *= 0.99 + ceil(segment) * 0.015;
  return colour;
}

void main() {
  vec2 uv = vUv - uShake;
  vec3 colour;
  if (uSplit > 0.01) {
    vec2 d = vec2(uSplit / uDimensions.x, 0.0);
    colour = vec3(layer(uv - d).r, layer(uv).g, layer(uv + d).b);
  } else {
    colour = layer(uv);
  }
  if (uCrt > 0.5) {
    if (uNoise.x > 0.0 && uNoise.y > 0.0) colour += vec3(noise(vUv));
    if (uVignette.x > 0.0) colour *= vignette(vUv);
    if (uLine.y > 0.0) colour = interlaceLines(colour, vUv);
  }
  gl_FragColor = vec4(colour, 1.0);
}
`

export function createGlass(passes: GlassPasses, reduceMotion: boolean): Glass {
  const material = new T.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      tScene: { value: null },
      tOverlay: { value: null },
      uHasOverlay: { value: 0 },
      uDimensions: { value: new T.Vector2(1, 1) },
      uShake: { value: new T.Vector2() },
      uSplit: { value: 0 },
      uLine: { value: new T.Vector4(CRT.curvature, CRT.lineWidth, CRT.lineContrast, 0) },
      uNoise: { value: new T.Vector2(0, 1) },
      uVignette: { value: new T.Vector3(CRT.vignetting, CRT.vignettingAlpha, CRT.vignettingBlur) },
      uSeed: { value: 0 },
      uTime: { value: 0 },
      uCrt: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
  })
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const scene = new T.Scene()
  scene.add(quad)
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const u = material.uniforms

  const glass: Glass = {
    enabled: true,
    render(renderer, source, overlay, frame) {
      const on = glass.enabled
      u.tScene.value = source
      u.tOverlay.value = overlay
      u.uHasOverlay.value = overlay ? 1 : 0
      u.uDimensions.value.set(Math.max(1, frame.width), Math.max(1, frame.height))
      // The shake slides the picture and keeps the lines where they are drawn,
      // which is what a shaken container under a fixed scanline pass did.
      u.uShake.value.set(frame.shake.x / Math.max(1, frame.width), -frame.shake.y / Math.max(1, frame.height))
      // 4. Entropy sets the floor, a crit adds a punch on top of it. Fringing
      // attacks the edges glyphs are made of, so enough to see on a crit and
      // not enough to double a letterform (postProcess.ts, pass 4).
      u.uSplit.value = on && passes.rgb ? frame.glass.chromaticAberration * 2 + frame.critPunch * 3 : 0
      u.uCrt.value = on && passes.crt ? 1 : 0
      // 5. The roll is a slow vertical drift, not an animation loop; under load
      // the picture looks like it is failing to hold sync.
      u.uTime.value = reduceMotion ? 0 : frame.seconds * (7.2 + frame.glass.scanlineRoll * 2)
      u.uNoise.value.set(frame.glass.scanlineNoise * 0.09, 1)
      u.uLine.value.z = (CRT.lineContrast + frame.glass.scanlineNoise * 0.1) * Math.max(0, Math.min(1, frame.lines))
      // Entropy Lock: the tear drives the seed, never the curvature (§6: the
      // glass itself is constant).
      u.uSeed.value = frame.glass.tear > 0 ? Math.random() : 0
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
    },
    dispose() {
      quad.geometry.dispose()
      material.dispose()
    },
  }
  return glass
}
