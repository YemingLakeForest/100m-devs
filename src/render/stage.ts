/**
 * The Pixi stage — simulation canvas, camera, and the post-process weld.
 *
 * ADR 0001 §5 mitigation 3 fixes the boundary: simulation, camera and
 * particles live here; everything with structured text, numbers or navigation
 * is React. This module never renders a glyph.
 */

import { Application, Container, Graphics } from 'pixi.js'
import { entropyTheme } from '../art/entropyTheme.ts'
import { currentEntropy, getState, poke, setZoom, tick } from '../game/store.ts'
import { pokeSfxForZoom, playSfx } from '../audio/sfx.ts'
import { pokeHaptic } from '../audio/haptics.ts'
import { LensCamera, lodWeights } from './omniLens.ts'
import { ALL_PASSES, createPostProcess, type PassName } from './postProcess.ts'
import { buildScene } from './scene.ts'

export interface StageHandle {
  /** Rolling frame time in ms, for the ADR §7.5 overlay. */
  readonly frameMs: number
  /** p95 tap -> numeral latency in ms. Criterion 1's threshold is 80 ms. */
  readonly latencyP95: number
  readonly camera: LensCamera
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
    // powerPreference matters on the §7.4 test device, where the default can
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

  const tiers = buildScene(app.renderer)
  for (const level of [4, 3, 2, 1] as const) world.addChild(tiers[level])

  const camera = new LensCamera(0)

  // --- poke input --------------------------------------------------------
  //
  // Bound on the canvas rather than through Pixi's event system: the tap must
  // reach the store, the sound and the haptic before anything yields, and
  // going straight to the DOM event removes a layer of dispatch from the path
  // ADR §7.5 criteria 1 and 2 measure.

  const latencies: number[] = []
  let critPunch = 0

  const onPointerDown = (ev: PointerEvent) => {
    const t0 = ev.timeStamp || performance.now()

    const result = poke(ev.clientX, ev.clientY)

    // Sound first: criterion 2's budget is the tightest at 60 ms p95.
    playSfx(result.crit ? 'poke-crit' : result.sp === 0 ? 'poke-void' : pokeSfxForZoom(camera.level))
    pokeHaptic(getState().dev.state)

    if (result.crit) critPunch = 1

    // Measured on the next frame, which is when the numeral is actually
    // visible — measuring at dispatch would report the number we want rather
    // than the one the thumb feels.
    requestAnimationFrame(() => {
      latencies.push(performance.now() - t0)
      if (latencies.length > LATENCY_WINDOW) latencies.shift()
    })
  }

  app.canvas.addEventListener('pointerdown', onPointerDown, { passive: true })

  // --- pinch zoom --------------------------------------------------------

  const pointers = new Map<number, { x: number; y: number }>()
  let pinchStart: { distance: number; z: number } | null = null

  const onPointerMove = (ev: PointerEvent) => {
    if (!pointers.has(ev.pointerId)) return
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })

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

  const trackPointer = (ev: PointerEvent) => pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })

  app.canvas.addEventListener('pointerdown', trackPointer, { passive: true })
  app.canvas.addEventListener('pointermove', onPointerMove, { passive: true })
  app.canvas.addEventListener('pointerup', onPointerUp, { passive: true })
  app.canvas.addEventListener('pointercancel', onPointerUp, { passive: true })

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

  const numeralGfx = new Map<number, Graphics>()

  // --- frame loop --------------------------------------------------------

  let frameMs = 16.7
  let lastFrame = performance.now()
  /** §21 Act IV's scripted dolly. Null when the camera is the player's again. */
  let dollyTarget: number | null = null
  let dollyFired = false

  app.ticker.add(() => {
    const now = performance.now()
    const dt = Math.min(0.1, (now - lastFrame) / 1000)
    lastFrame = now
    frameMs += ((now - lastFrame + dt * 1000) - frameMs) * 0.1

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

    // Cross-fade the tiers. Nothing cuts (GDD §10.5).
    const weights = lodWeights(camera.z)
    for (const l of [1, 2, 3, 4] as const) {
      const tier = tiers[l]
      tier.alpha = weights[l]
      // Culling the invisible tiers is what keeps the criterion-3 dolly
      // affordable: without it the 1,000-particle floor is submitted every
      // frame even at galactic zoom.
      tier.renderable = weights[l] > 0.002
    }

    // World scale. The desk tier is authored at 1:1, so the camera scale is
    // applied relative to it and the other tiers ride the cross-fade.
    const s = 1 / (1 + camera.z * 9)
    world.scale.set(s)
    world.position.set(app.screen.width / 2, app.screen.height / 2)

    // Numerals arc up and fade over ~900 ms (GDD §8.2).
    const live = new Set<number>()
    for (const f of state.floaters) {
      live.add(f.id)
      let g = numeralGfx.get(f.id)
      if (!g) {
        g = new Graphics()
        const size = f.crit ? 5 : 3
        const colour = f.sp < 0 ? 0xe03c3c : f.crit ? 0xb8f4ff : 0x35c9d9
        // A bar rather than a glyph: text lives in React, and the numeral's
        // *value* is read from the HUD. This is the motion, not the number.
        g.rect(0, 0, size * 6, size).fill(colour)
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
      if (latencies.length === 0) return 0
      const sorted = [...latencies].sort((a, b) => a - b)
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
    },
    camera,
    destroy() {
      app.canvas.removeEventListener('pointerdown', onPointerDown)
      app.canvas.removeEventListener('pointerdown', trackPointer)
      app.canvas.removeEventListener('pointermove', onPointerMove)
      app.canvas.removeEventListener('pointerup', onPointerUp)
      app.canvas.removeEventListener('pointercancel', onPointerUp)
      app.canvas.removeEventListener('wheel', onWheel)
      post.destroy()
      app.destroy(true, { children: true })
    },
  }
}
