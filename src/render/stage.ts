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
import { DEVS_PER_STOREY } from './tower.ts'
import { maxZoomFor, zoomCeilingLifted } from '../sim/headcount.ts'
import { createCollapse } from './collapse.ts'
import { createPokeTypeset } from './pokeText.ts'
import { createArrivals } from './arrivals.ts'
import {
  clampPan,
  flingVelocity,
  initPan,
  isTap,
  panLimit,
  pickNearest,
  stepPan,
  type PanState,
} from './navigation.ts'
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

  const { tiers, floor, room, tower } = buildScene(app.renderer)
  for (const level of [4, 3, 2, 1] as const) world.addChild(tiers[level])

  // §21 Act IV. Its overlay goes inside the glass, above the world and below
  // the numerals — the badges and chatter are scenery and must never bury the
  // one piece of feedback the clicker layer depends on (GDD §8.2).
  const collapse = createCollapse({ renderer: app.renderer, floor, reduceMotion })
  glass.addChild(collapse.overlay)

  // §7.7.2 — hires arrive on screen. Parented into the room so they share its
  // transform and its cross-fade, and land in room-local coordinates.
  const arrivals = createArrivals()
  room.container.addChild(arrivals.layer)

  /** Level 2's live extent — the floor swarm, or the tower once it is taller. */
  const towerRungExtent = () =>
    getState().devs >= DEVS_PER_STOREY ? tower.extent : TIER_EXTENTS[2]

  const camera = new LensCamera(0)
  /** Latest tier extents, published for the hit test outside the ticker. */
  let currentExtents: Record<1 | 2 | 3 | 4, { w: number; h: number }> = {
    ...TIER_EXTENTS,
    1: room.extent,
  }

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

  /**
   * Screen point -> the index of the developer under it, or -1.
   *
   * §7.7.6 requires that "every one of the 1,000 floor sprites is individually
   * hit-testable... the actual developer under the thumb", and a
   * ParticleContainer offers nothing here — particles are not display objects
   * and Pixi will not test them. So the pick is done in tier-local space:
   * undo the world translation, the pan and the tier's own scale, then find
   * the nearest desk.
   */
  const pickDeveloper = (x: number, y: number): number => {
    const level = camera.level
    if (level > 2) return -1
    const scale = tierScale(level, camera.z, { w: app.screen.width, h: app.screen.height }, currentExtents)
    if (!(scale > 0)) return -1

    const tier = tiers[level]
    // Screen -> tier-local. The tier's pivot is baked into its own transform,
    // so working through the container is safer than re-deriving it here.
    const local = tier.toLocal({ x, y })
    const seats = level === 1 ? roomSeats() : floor.seats
    // A generous radius: a fingertip is about 9 mm and the desks are small.
    // Scaled into tier space so it stays a thumb-sized target at any zoom.
    return pickNearest(seats, local.x, local.y, 26 / Math.max(0.15, scale) + 14)
  }

  const roomSeats = () => Array.from({ length: room.drawn }, (_, i) => room.deskAt(i)!)

  /** The whole tap path, shared by real pointers and the §23.3 bench. */
  const doPoke = (x: number, y: number, t0: number) => {
    // Who was actually poked. -1 means empty floor, which is a miss rather
    // than a free point — §7.7.6 makes the world addressable, and an
    // addressable world has places where nobody is sitting.
    const target = pickDeveloper(x, y)
    if (target < 0) return
    if (camera.level === 1) room.jolt(target)

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

  // --- pan, and telling a tap from a drag (GDD §7.7.6) --------------------
  //
  // The poke no longer fires on pointerdown. It fires on pointer*up*, and only
  // if the pointer barely moved — §7.7.6 is explicit that a pan which pokes
  // costs the player Entropy every time they look around, and a poke which
  // pans loses the clicker layer. The cost is that criterion 1's stopwatch now
  // starts at the release rather than the press, which is the same instant a
  // player perceives their own tap.

  let pan: PanState = initPan()
  /** The in-progress drag, or null. */
  let drag: { id: number; x0: number; y0: number; px: number; py: number; t0: number; panX: number; panY: number } | null = null
  /** Live pan limits, recomputed each frame from the dominant tier's size. */
  let limitX = 0
  let limitY = 0

  const onPointerDown = (ev: PointerEvent) => {
    const t = ev.timeStamp || performance.now()
    // Only the first finger drags; a second means a pinch, handled below.
    if (drag === null && pointers.size === 0) {
      drag = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, px: ev.clientX, py: ev.clientY, t0: t, panX: pan.x, panY: pan.y }
      pan.vx = 0
      pan.vy = 0
    }
  }

  const onDragMove = (ev: PointerEvent) => {
    if (!drag || ev.pointerId !== drag.id || pointers.size >= 2) return
    const t = ev.timeStamp || performance.now()
    const dt = Math.max(1, t - (drag.t0 + 0)) / 1000
    pan = clampPan(
      { ...pan, x: drag.panX + (ev.clientX - drag.x0), y: drag.panY + (ev.clientY - drag.y0) },
      limitX,
      limitY,
    )
    // Instantaneous velocity from the last move, which is what a flick is.
    pan.vx = (ev.clientX - drag.px) / Math.max(0.008, dt)
    pan.vy = (ev.clientY - drag.py) / Math.max(0.008, dt)
    drag.px = ev.clientX
    drag.py = ev.clientY
  }

  const onDragEnd = (ev: PointerEvent) => {
    if (!drag || ev.pointerId !== drag.id) return
    const t = ev.timeStamp || performance.now()
    const dx = ev.clientX - drag.x0
    const dy = ev.clientY - drag.y0
    const tapped = isTap(dx, dy, t - drag.t0)
    drag = null

    if (tapped) {
      pan.vx = 0
      pan.vy = 0
      doPoke(ev.clientX, ev.clientY, t)
    } else {
      const f = flingVelocity(pan.vx, pan.vy)
      pan.vx = f.vx
      pan.vy = f.vy
    }
  }

  app.canvas.addEventListener('pointerdown', onPointerDown, { passive: true })
  app.canvas.addEventListener('pointermove', onDragMove, { passive: true })
  app.canvas.addEventListener('pointerup', onDragEnd, { passive: true })
  app.canvas.addEventListener('pointercancel', onDragEnd, { passive: true })

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
  /** Last consumed §7.7.2 spawn, so one hire produces one arrival. */
  let lastSpawnId = 0
  let devsBefore = getState().devs

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

    // §7.7.2 — consume the store's SpawnEvent. Until this existed the
    // headcount changed and the screen did not.
    if (state.spawn && state.spawn.id !== lastSpawnId) {
      const first = lastSpawnId === 0
      lastSpawnId = state.spawn.id
      const deskList = Array.from({ length: room.drawn }, (_, i) => room.deskAt(i)!)
      arrivals.spawn(deskList, state.spawn.bodies, now)
      // A hire that buys a whole new register of the lens is a reveal, not a
      // hire. Kick the camera out to show what just opened up. Skipped on the
      // first observed event, which may be a jumped-to phase rather than a
      // hire the player made.
      if (!first && zoomCeilingLifted(devsBefore, state.devs)) {
        dollyTarget = maxZoomFor(state.devs)
        playSfx('zoom-out')
      }
    }
    devsBefore = state.devs
    arrivals.update(now)
    // §7.8.3 — everybody types. Cheap: one sine per visible developer.
    // §7.8.6 — and some of them get up. Entropy drives the rate, so the floor
    // gets visibly busier as the studio gets worse at its job: the §4.1 curve
    // told in behaviour rather than in a number.
    room.animate(now / 1000, state.dev.state, dt, currentEntropy(state))

    // GDD §7.7.1 — the studio you can see is the studio you have. Applied
    // every frame rather than only on input, because the scripted dolly, the
    // wheel and the pinch are three separate paths into the camera and a
    // ceiling enforced on one of them is not a ceiling.
    const ceiling = maxZoomFor(state.devs)
    if (camera.z > ceiling) camera.set(ceiling)

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
    // §7.8.1 — the room is rebuilt when the headcount changes, never per
    // frame. Its live extent feeds the §23.4.1 fit, so a room that grows is
    // also a camera that pulls back, with nobody driving Z.
    // §7.8.7 — identities before headcount, so a rebuild triggered by the seed
    // does not immediately get overwritten by one triggered by the count.
    room.setSeed(state.runSeed)
    room.setHeadcount(state.devs)
    // §7.7.1 again, on the other tier: the floor shows the people who exist,
    // not a thousand placeholders ghosting in behind two developers.
    floor.setPopulation(state.devs)
    // §7.7.1 — above a thousand the unit is a floor, not a person. The two
    // representations share the Level 2 slot and swap rather than coexisting:
    // showing a floor of people *and* a stack of floors at once would be the
    // same studio counted twice.
    tower.setHeadcount(state.devs)
    const towerRung = state.devs >= DEVS_PER_STOREY
    floor.container.visible = !towerRung
    tower.container.visible = towerRung
    tower.update(now)
    const extents = {
      ...TIER_EXTENTS,
      1: room.extent,
      // Level 2's size depends on which representation is showing, and the
      // tower grows a storey at a time.
      2: towerRungExtent(),
    }
    currentExtents = extents
    const weights = lodWeights(camera.z)
    for (const l of [1, 2, 3, 4] as const) {
      const tier = tiers[l]
      tier.alpha = weights[l]
      // Culling the invisible tiers is what keeps the criterion-3 dolly
      // affordable: without it the 1,000-particle floor is submitted every
      // frame even at galactic zoom.
      tier.renderable = weights[l] > 0.002
      // Only the visible ones need their transform recomputed.
      if (tier.renderable) tier.scale.set(tierScale(l, camera.z, viewport, extents))
    }

    // §7.7.6 — pan. Limits come from how far the dominant tier overhangs the
    // frame, so a tier that already fits does not slide around: panning
    // something that fits is how a player ends up lost in an empty frame.
    const domScale = tierScale(camera.level, camera.z, viewport, extents)
    limitX = panLimit(extents[camera.level].w * domScale, viewport.w)
    limitY = panLimit(extents[camera.level].h * domScale, viewport.h)
    if (!drag) pan = stepPan(pan, dt, limitX, limitY)
    else pan = clampPan(pan, limitX, limitY)

    world.position.set(app.screen.width / 2 + pan.x, app.screen.height / 2 + pan.y)

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
        scale: +tierScale(camera.level, camera.z, viewport, extents).toFixed(5),
        // What the dominant tier actually measures on screen, in CSS px. This
        // is the number GDD §23.4.1 exists to make non-zero, so it is the one
        // worth being able to read without a screenshot.
        tierPx: (() => {
          const ts = tierScale(camera.level, camera.z, viewport, extents)
          return `${Math.round(extents[camera.level].w * ts)}x${Math.round(extents[camera.level].h * ts)}`
        })(),
        fillShortAxis: +(() => {
          const ts = tierScale(camera.level, camera.z, viewport, extents)
          return Math.max(
            (extents[camera.level].w * ts) / app.screen.width,
            (extents[camera.level].h * ts) / app.screen.height,
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
      // §23.3 criterion 4 names 1,000 sprites. The floor now follows the
      // headcount, so the bench has to ask for the full load explicitly.
      setFloorPopulationOverride: (n: number | null) => floor.setPopulationOverride(n),
    },
    destroy() {
      app.canvas.removeEventListener('pointerdown', onPointerDown)
      app.canvas.removeEventListener('pointermove', onDragMove)
      app.canvas.removeEventListener('pointerup', onDragEnd)
      app.canvas.removeEventListener('pointercancel', onDragEnd)
      app.canvas.removeEventListener('pointerdown', trackPointer)
      app.canvas.removeEventListener('pointermove', onPointerMove)
      app.canvas.removeEventListener('pointerup', onPointerUp)
      app.canvas.removeEventListener('pointercancel', onPointerUp)
      app.canvas.removeEventListener('pointerleave', onPointerUp)
      app.canvas.removeEventListener('wheel', onWheel)
      arrivals.destroy()
      collapse.destroy()
      typeset.destroy()
      post.destroy()
      app.destroy(true, { children: true })
    },
  }
}
