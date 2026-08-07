/**
 * The Pixi stage — simulation canvas, camera, and the post-process weld.
 *
 * GDD §23.2 non-negotiable 3 fixes the boundary: simulation, camera and
 * particles live here; everything with structured text, numbers or navigation
 * is React. Structured text stays there; the poke numeral and its GDD §8.2a
 * code line are drawn here because they are scenery that must sit under the
 * glass — see pokeText.ts.
 */

import { Application, Container } from 'pixi.js'
import { entropyTheme } from '../art/entropyTheme.ts'
import { currentEntropy, getState, poke, setZoom, tick } from '../game/store.ts'
import { pokeSfxForZoom, playSfx } from '../audio/sfx.ts'
import { pokeHaptic } from '../audio/haptics.ts'
import { LensCamera, lodWeights, tierScale } from './omniLens.ts'
import { ALL_PASSES, createPostProcess, type PassName } from './postProcess.ts'
import { TIER_EXTENTS, buildScene } from './scene.ts'
import { createCollapse } from './collapse.ts'
import { createPokeTypeset } from './pokeText.ts'
import { FrameSampler, LatencySampler } from '../perf/metrics.ts'
import type { BenchHooks } from '../perf/bench.ts'

export interface StageHandle {
  /** Rolling frame time in ms, for the GDD §23.3 overlay. */
  readonly frameMs: number
  /** p95 tap -> numeral latency in ms. Criterion 1's threshold is 80 ms. */
  readonly latencyP95: number
  readonly camera: LensCamera
  /** Everything the GDD §23.3 acceptance run needs to drive and measure the app. */
  readonly bench: BenchHooks & { frames: FrameSampler }
  destroy(): void
}

/** Samples kept for the latency percentile. 120 taps is ~24 s at 5 taps/sec. */
const LATENCY_WINDOW = 120

export async function createStage(host: HTMLElement): Promise<StageHandle> {
  const app = new Application()

  await app.init({
    background: 0x14121a, // NEUTRAL[0]
    antialias: false, // ART_DIRECTION §7: hard pixels only.
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    resizeTo: host,
    // powerPreference matters on the §23.3 test device, where the default can
    // land on the integrated path and cost the criterion-3 dolly its margin.
    powerPreference: 'high-performance',
  })

  host.appendChild(app.canvas)

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // World sits behind the glass; the post-process is applied to the container
  // that holds it, so every tier passes through the same grade.
  const world = new Container()
  const glass = new Container()
  glass.addChild(world)
  app.stage.addChild(glass)

  // ?nopost drops the glass entirely; ?post=bloom,crt attaches just those
  // passes. The stack is six passes deep, so being able to bisect it without a
  // rebuild is what separates "the scene is too heavy" from "one filter is".
  const params = new URLSearchParams(location.search)
  const requested = params.get('post')
  const passes = params.has('nopost')
    ? new Set<PassName>()
    : requested
      ? new Set(requested.split(',').filter((p): p is PassName => (ALL_PASSES as string[]).includes(p)))
      : new Set(ALL_PASSES)

  const post = createPostProcess({ reduceMotion, passes })
  if (post.worldFilters.length > 0) world.filters = post.worldFilters
  if (post.filters.length > 0) glass.filters = post.filters

  const { tiers, floor } = buildScene(app.renderer)
  for (const level of [4, 3, 2, 1] as const) world.addChild(tiers[level])

  // §21 Act IV. Its overlay goes inside the glass, above the world and below
  // the numerals — the badges and chatter are scenery and must never bury the
  // one piece of feedback the clicker layer depends on (GDD §8.2).
  const collapse = createCollapse({ renderer: app.renderer, floor, reduceMotion })
  glass.addChild(collapse.overlay)

  const camera = new LensCamera(0)

  // --- poke input --------------------------------------------------------
  //
  // Bound on the canvas rather than through Pixi's event system: the tap must
  // reach the store, the sound and the haptic before anything yields, and
  // going straight to the DOM event removes a layer of dispatch from the path
  // GDD §23.3 criteria 1 and 2 measure.

  const tapLatency = new LatencySampler(LATENCY_WINDOW)
  const audioLatency = new LatencySampler(LATENCY_WINDOW)
  const frames = new FrameSampler()
  let critPunch = 0

  /** The whole tap path, shared by real pointers and the §23.3 bench. */
  const doPoke = (x: number, y: number, t0: number) => {
    const result = poke(x, y)

    // Sound first: criterion 2's budget is the tightest at 60 ms p95.
    playSfx(result.crit ? 'poke-crit' : result.sp === 0 ? 'poke-void' : pokeSfxForZoom(camera.level))
    // Only the JS half of the audio path. See the CAVEAT in perf/metrics.ts —
    // the mixer, buffer, DAC and speaker are invisible from here, so this is a
    // lower bound and criterion 2 cannot be passed on it alone.
    audioLatency.push(performance.now() - t0)

    pokeHaptic(getState().dev.state)

    if (result.crit) critPunch = 1

    // Measured on the next frame, which is when the numeral is actually
    // visible — measuring at dispatch would report the number we want rather
    // than the one the thumb feels.
    requestAnimationFrame(() => tapLatency.push(performance.now() - t0))
  }

  const onPointerDown = (ev: PointerEvent) => {
    doPoke(ev.clientX, ev.clientY, ev.timeStamp || performance.now())
  }

  app.canvas.addEventListener('pointerdown', onPointerDown, { passive: true })

  // --- pinch zoom --------------------------------------------------------

  const pointers = new Map<number, { x: number; y: number; seen: number }>()
  let pinchStart: { distance: number; z: number } | null = null

  /**
   * A finger that has not been heard from in this long is not on the glass.
   *
   * `pointerup` is not guaranteed to arrive: it is lost on alt-tab, on some
   * pointercancel paths, and whenever a synthetic `pointerdown` arrives with
   * no partner — which is exactly what browser automation produces. A leaked
   * entry is not harmless, because two of them put the camera permanently into
   * pinch mode, where every later `pointermove` rewrites Z. The symptom is the
   * camera drifting on its own and scripted dollies appearing never to arrive,
   * which is very hard to read from the outside; it cost most of a session
   * once. Expiring by age fixes it without trusting any event to be delivered.
   */
  const POINTER_STALE_MS = 2000

  function expireStalePointers(now: number) {
    for (const [id, p] of pointers) {
      if (now - p.seen > POINTER_STALE_MS) pointers.delete(id)
    }
    if (pointers.size < 2) pinchStart = null
  }

  const onPointerMove = (ev: PointerEvent) => {
    const now = ev.timeStamp || performance.now()
    expireStalePointers(now)
    if (!pointers.has(ev.pointerId)) return
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, seen: now })

    if (pointers.size !== 2) return
    const [a, b] = [...pointers.values()]
    const distance = Math.hypot(a.x - b.x, a.y - b.y)

    if (!pinchStart) {
      pinchStart = { distance, z: camera.z }
      return
    }

    // Pinching in pulls the camera toward the desk. The ratio is log-mapped
    // because Z itself is already logarithmic in scale — a linear gesture then
    // produces a constant *rate* of scale change, which is what reads as
    // smooth across nine orders of magnitude.
    const ratio = distance / pinchStart.distance
    camera.set(pinchStart.z - Math.log10(Math.max(0.01, ratio)) * 0.6)
  }

  const onPointerUp = (ev: PointerEvent) => {
    pointers.delete(ev.pointerId)
    if (pointers.size < 2) pinchStart = null
  }

  const trackPointer = (ev: PointerEvent) => {
    const now = ev.timeStamp || performance.now()
    expireStalePointers(now)
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, seen: now })
  }

  app.canvas.addEventListener('pointerdown', trackPointer, { passive: true })
  app.canvas.addEventListener('pointermove', onPointerMove, { passive: true })
  app.canvas.addEventListener('pointerup', onPointerUp, { passive: true })
  app.canvas.addEventListener('pointercancel', onPointerUp, { passive: true })
  app.canvas.addEventListener('pointerleave', onPointerUp, { passive: true })


  // Desktop convenience — the dolly needs to be drivable without a touchscreen
  // while developing. Never the path a pass/fail is measured on.
  const onWheel = (ev: WheelEvent) => {
    ev.preventDefault()
    camera.nudge(ev.deltaY * 0.0008)
  }
  app.canvas.addEventListener('wheel', onWheel, { passive: false })

  // --- floating numerals -------------------------------------------------
  //
  // Drawn in Pixi rather than the DOM. GDD §8.2 calls the flying numeral "the
  // clicker layer's entire feedback loop", and it has to sit *under* the glass
  // — a DOM numeral would float above the curvature and break the weld.

  const numerals = new Container()
  app.stage.addChild(numerals)
  // The numerals are inside the glass too, so they share the grade.
  glass.addChild(numerals)

  // GDD §8.2 + §8.2a. Built once — see pokeText.ts for why nothing here may
  // typeset on the tap frame.
  const typeset = createPokeTypeset(app.renderer)
  const numeralGfx = new Map<number, Container>()

  // --- frame loop --------------------------------------------------------

  let lastFrame = performance.now()
  /** §21 Act IV's scripted dolly. Null when the camera is the player's again. */
  let dollyTarget: number | null = null
  let dollyFired = false

  app.ticker.add(() => {
    const now = performance.now()
    const rawFrameMs = now - lastFrame
    const dt = Math.min(0.1, rawFrameMs / 1000)
    lastFrame = now
    frames.sample(rawFrameMs)

    tick(dt)

    const state = getState()

    // §21 Act IV: "a heavy bass-drop THUD shakes the screen as the camera
    // violently zooms out to Level 2." Driven here rather than by the store,
    // because the camera is the renderer's business — the store just says the
    // swarm arrived.
    if (state.massHired && !dollyFired) {
      dollyFired = true
      dollyTarget = 0.35
      playSfx('zoom-out')
      // Parts 2–4 of the same beat: the swarm falling, the Slack web, the
      // @everyone flood and the audio shift.
      collapse.trigger()
    }
    // A Paradigm Shift clears massHired for the next run. Without this the
    // dolly and the whole Act IV beat are one-shot for the lifetime of the
    // page, so a player who springs the trap again in Run 2 gets silence.
    if (!state.massHired && dollyFired) {
      dollyFired = false
      collapse.reset()
    }
    if (dollyTarget !== null) {
      // Eased rather than snapped: §10.5 says nothing cuts, and the zoom-blur
      // pass needs real velocity to have anything to smear.
      const next = camera.z + (dollyTarget - camera.z) * Math.min(1, dt * 2.2)
      camera.set(next)
      if (Math.abs(dollyTarget - camera.z) < 0.002) dollyTarget = null
    }

    camera.sample(dt)
    critPunch = Math.max(0, critPunch - dt * 4)

    const level = camera.level
    if (level !== state.zoom) setZoom(level)

    // Cross-fade the tiers, and frame each one — GDD §10.5, §23.4.1.
    //
    // Scale is applied PER TIER rather than to `world`, because the tiers
    // differ in intrinsic size by more than 5x and no single scale frames both
    // the desk and the floor. See tierScale() for what that cost when it was
    // one shared value.
    const viewport = { w: app.screen.width, h: app.screen.height }
    const weights = lodWeights(camera.z)
    for (const l of [1, 2, 3, 4] as const) {
      const tier = tiers[l]
      tier.alpha = weights[l]
      // Culling the invisible tiers is what keeps the criterion-3 dolly
      // affordable: without it the 1,000-particle floor is submitted every
      // frame even at galactic zoom.
      tier.renderable = weights[l] > 0.002
      // Only the visible ones need their transform recomputed.
      if (tier.renderable) tier.scale.set(tierScale(l, camera.z, viewport, TIER_EXTENTS))
    }

    world.position.set(app.screen.width / 2, app.screen.height / 2)

    // §21 Act IV. The sustained level is Entropy rather than a timer: the room
    // does not calm down in Act V, and reading it off the simulation means the
    // noise is a symptom of the studio's state rather than a scripted flourish
    // that happens to coincide with it.
    const shake = collapse.update({
      dt,
      width: app.screen.width,
      height: app.screen.height,
      intensity: Math.min(1, currentEntropy() / 0.99),
    })
    // Applied to the glass, so the world, the numerals and the Act IV overlay
    // all shake together. Shaking only the world would slide the picture out
    // from under its own scanlines.
    glass.position.set(shake.x, shake.y)

    // Numerals arc up and fade over ~900 ms (GDD §8.2).
    const live = new Set<number>()
    for (const f of state.floaters) {
      live.add(f.id)
      let g = numeralGfx.get(f.id)
      if (!g) {
        // The real numeral and the §8.2a code line. This was a plain rectangle
        // during the spike, on the reasoning that text belongs in React — that
        // holds for the HUD and not for this, which is scenery under the glass.
        g = typeset.build(f.sp, f.crit, f.snippet)
        numerals.addChild(g)
        numeralGfx.set(f.id, g)
      }
      const age = (now - f.bornAt) / 900
      g.position.set(f.x, f.y - age * 70)
      g.alpha = Math.max(0, 1 - age)
    }
    for (const [id, g] of numeralGfx) {
      if (!live.has(id)) {
        g.destroy()
        numeralGfx.delete(id)
      }
    }

    // Dev-only inspection seam, in the same family as ?bench / ?act / ?nopost.
    // The Act IV beat is three systems deep — store flag, camera dolly, LOD
    // weight — and "nothing is on screen" is the same symptom for all three.
    if (import.meta.env.DEV) {
      const snapshot = {
        z: +camera.z.toFixed(4),
        level: camera.level,
        scale: +tierScale(camera.level, camera.z, viewport, TIER_EXTENTS).toFixed(5),
        // What the dominant tier actually measures on screen, in CSS px. This
        // is the number GDD §23.4.1 exists to make non-zero, so it is the one
        // worth being able to read without a screenshot.
        tierPx: (() => {
          const ts = tierScale(camera.level, camera.z, viewport, TIER_EXTENTS)
          return `${Math.round(TIER_EXTENTS[camera.level].w * ts)}x${Math.round(TIER_EXTENTS[camera.level].h * ts)}`
        })(),
        fillShortAxis: +(() => {
          const ts = tierScale(camera.level, camera.z, viewport, TIER_EXTENTS)
          return Math.max(
            (TIER_EXTENTS[camera.level].w * ts) / app.screen.width,
            (TIER_EXTENTS[camera.level].h * ts) / app.screen.height,
          )
        })().toFixed(3),
        viewport: `${Math.round(app.screen.width)}x${Math.round(app.screen.height)}`,
        weights,
        massHired: state.massHired,
        dollyTarget,
        dollyFired,
        dt: +dt.toFixed(4),
        collapseActive: collapse.active,
      }
      ;(window as unknown as Record<string, unknown>).__stage = snapshot
    }

    post.update({
      glass: entropyTheme(currentEntropy()).glass,
      zoom: camera.z,
      zoomVelocity: camera.velocity,
      critPunch,
      width: app.screen.width,
      height: app.screen.height,
    })
  })

  return {
    get frameMs() {
      return app.ticker.deltaMS
    },
    get latencyP95() {
      return tapLatency.p95
    },
    camera,
    bench: {
      camera,
      tap: () => doPoke(app.screen.width / 2, app.screen.height / 2, performance.now()),
      tapLatency,
      audioLatency,
      frames,
    },
    destroy() {
      app.canvas.removeEventListener('pointerdown', onPointerDown)
      app.canvas.removeEventListener('pointerdown', trackPointer)
      app.canvas.removeEventListener('pointermove', onPointerMove)
      app.canvas.removeEventListener('pointerup', onPointerUp)
      app.canvas.removeEventListener('pointercancel', onPointerUp)
      app.canvas.removeEventListener('pointerleave', onPointerUp)
      app.canvas.removeEventListener('wheel', onWheel)
      collapse.destroy()
      typeset.destroy()
      post.destroy()
      app.destroy(true, { children: true })
    },
  }
}
