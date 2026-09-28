/**
 * **The stage** — the three.js studio, the hand on it, and the glass over it.
 *
 * [rewritten 2026-09-28] **The Pixi stage is decommissioned.** The user:
 * *"pixi scenes are supposed to be completed decommissioned. we should do that
 * first if there are gates/validation any productivity drags because of
 * them"* — after *"I noticed when you hire 25 or more, then game went back to
 * old pixi 2d scene, this is not wat I wanted"*. This file was a Pixi
 * `Application` holding the whole §7.4a ladder (room, office, building, block,
 * district, park, globe and star field, 18,000 lines of `render/`), with the
 * three.js garage as a texture inside it for the first twenty developers and a
 * hinge between the two renderers. All of that is gone, and what is left is
 * the garage, drawn straight to the screen:
 *
 * - **The picture** is `three/render/garageView.ts`. It redraws the room only
 *   when something in it moved, into its composer's targets.
 * - **The glass** (ART_DIRECTION §6) is `three/render/glass.ts`, the last draw
 *   of every frame: the room, the poke numerals under the lines, the
 *   scanlines, the vignette and the colour split. Bloom went into the garage's
 *   own composer.
 * - **The hand** is here: a tap pokes, codes, inspects or does nothing by
 *   §7.7.6b's latch; a drag pans; a pinch and the wheel zoom about the point
 *   under them. Nothing a finger does on the glass changes *level* any more,
 *   because there is one level: the room.
 * - **The lens as the simulation reads it**, §7.2's Z, is the garage's zoom
 *   mapped onto the room's three stops (desk, squad, floor), so the music, the
 *   poke sounds and the store's tier still hear the same numbers.
 *
 * **What is not drawn now, and is not pretended.** Past twenty the studio's
 * rank and file are not on screen until the storey across the lane lands in
 * three.js (PLAN-2026-09-27-garage-to-galaxy, decision 7), and there is
 * nothing above the street until the three.js city and planet do (phases 5–7).
 * §21 Act IV's collapse overlay was a Pixi picture of the Pixi office and went
 * with it; the score's collapse (§20.7.4) is audio and stays.
 */

import { createGarageView, GARAGE_REST_ZOOM, GARAGE_ZOOM_MAX, GARAGE_ZOOM_MIN } from '../three/render/garageView.ts'
import { createGlass, type GlassPasses } from '../three/render/glass.ts'
import * as T from 'three'
import { founderLook, readStudioName } from '../game/founderProfile.ts'
import { entropyTheme } from '../art/entropyTheme.ts'
import {
  arrivedHeroes,
  currentEntropy,
  FLOATER_LIFE_MS,
  getState,
  poke,
  pokeFounder,
  pokeJames,
  selectDeveloper,
  setCameraRung,
  setZoom,
  tick,
} from '../game/store.ts'
import { playKeyboardClick, playSfx, pokeSfxForZoom } from '../audio/sfx.ts'
import { playUi } from '../ui/uiSfx.ts'
import { MusicBus } from '../audio/music.ts'
import { pokeHaptic } from '../audio/haptics.ts'
import { exceedsSlop } from './navigation.ts'
import { createPokeCanvas } from './pokeText.ts'
import { tapVerb } from '../game/touchMode.ts'
import { DEBUG_TOOLS_ENABLED, debugSearchParams } from '../dev/debugAccess.ts'
import { getViewModes, onViewModes } from '../dev/viewModes.ts'
import { getSimSpeed } from '../dev/simSpeed.ts'
import { FrameSampler, LatencySampler } from '../perf/metrics.ts'
import type { BenchHooks } from '../perf/bench.ts'
import type { FounderProfile } from '../game/founderProfile.ts'
import type { HeroId } from '../sim/storyHeroes.ts'
import { JAMES_DROPS_AT_LINE, SCENE_JAMES_ARRIVES } from '../game/scenes.ts'

/**
 * The lens, as the things that were written against the Pixi lens still read
 * it: §7.2's Z, and a door to set it. `?z`, the dev scenarios and the §23.3
 * bench drive it; the music and the store hear it.
 */
export interface StageCamera {
  readonly z: number
  set(z: number): void
}

export interface StageHandle {
  /** Rolling frame time in ms, for the GDD §23.3 overlay. */
  readonly frameMs: number
  /** p95 tap -> numeral latency in ms. Criterion 1's threshold is 80 ms. */
  readonly latencyP95: number
  readonly camera: StageCamera
  /**
   * §7.8.12 — **TEAM: the way back to the room.** The room is the whole of the
   * picture now, so this eases the camera back to it framed at rest.
   */
  focusTeam(): void
  /**
   * §10.7a.1 — point the lens at the dialogue's current speaker. `'founder'`
   * is the corner desk, a number is a story hero's index (0 is James), `null`
   * is `STUDIO_OS`, which has no body, so the camera holds. Called by the
   * dialogue box on every page turn; the return when the scene ends is handled
   * here, from the store's scene state.
   */
  focusDialogue(focus: 'founder' | number | null): void
  /** The line of the scene now on screen — stage directions key off it. */
  setSceneLine(line: number | null): void
  /** Has James finished landing? The dialogue holds his *Ouch.* for it. */
  jamesLanded(): boolean
  /**
   * The founder has said *What—*: the lens goes to James's empty spot, and his
   * desk, chair and James drop once it is there.
   */
  cueJames(): void
  /** Code at your own desk with the standard numeral/snippet feedback. */
  codeFounder(): number
  /** React hook for opening the founder profile when the world avatar is tapped. */
  setFounderInspect(handler: (() => void) | null): void
  /** React hook for opening a hero's pass from their body in the room. */
  setHeroInspect(handler: ((id: HeroId) => void) | null): void
  /** Replace the default figure once first-start setup has been submitted. */
  setFounderProfile(profile: FounderProfile): void
  /** Everything the GDD §23.3 acceptance run needs to drive and measure the app. */
  readonly bench: BenchHooks & { frames: FrameSampler }
  destroy(): void
}

/** James's seat in the 3D garage (`floorPlan.leaderSeat('james')`). */
const JAMES_SEAT = -2
/** The founder's. */
const FOUNDER_SEAT = -1

/** Samples kept for the latency percentile. 120 taps is ~24 s at 5 taps/sec. */
const LATENCY_WINDOW = 120

/**
 * A finger that has not been heard from in this long is not on the glass.
 *
 * `pointerup` is not guaranteed to arrive: it is lost on alt-tab, on some
 * pointercancel paths, and whenever a synthetic `pointerdown` arrives with no
 * partner — which is exactly what browser automation produces. Two leaked
 * entries put the camera permanently into pinch mode, where every later move
 * rewrites the zoom; expiring by age fixes it without trusting any event to be
 * delivered.
 */
const POINTER_STALE_MS = 2000

/*
 * **The room's three stops, as the garage's zoom.**
 *
 * §7.2's Z is what the music's zone beds, §8.2's poke sounds and the store's
 * `zoom` tier are all written against, and the room is the bottom three
 * levels of it: desk (0), squad (1), floor (2). The garage's zoom is
 * continuous from a face (`GARAGE_ZOOM_MAX`) to the room with its street
 * around it (`GARAGE_ZOOM_MIN`), so the mapping is log-linear in two pieces
 * that meet at the room framed at rest, which is the squad — the level the
 * room has always been played at, and the one whose poke is a keyboard click.
 */
const SQUAD_LEVEL = 1
const FLOOR_LEVEL = 2

function levelOfZoom(zoom: number): number {
  const z = Math.max(GARAGE_ZOOM_MIN, Math.min(GARAGE_ZOOM_MAX, zoom))
  if (z >= GARAGE_REST_ZOOM) return SQUAD_LEVEL * Math.log(GARAGE_ZOOM_MAX / z) / Math.log(GARAGE_ZOOM_MAX / GARAGE_REST_ZOOM)
  return SQUAD_LEVEL + (FLOOR_LEVEL - SQUAD_LEVEL) * Math.log(GARAGE_REST_ZOOM / z) / Math.log(GARAGE_REST_ZOOM / GARAGE_ZOOM_MIN)
}

function zoomOfLevel(level: number): number {
  const l = Math.max(0, Math.min(FLOOR_LEVEL, level))
  if (l <= SQUAD_LEVEL) return GARAGE_ZOOM_MAX / Math.pow(GARAGE_ZOOM_MAX / GARAGE_REST_ZOOM, l / SQUAD_LEVEL)
  return GARAGE_REST_ZOOM / Math.pow(GARAGE_REST_ZOOM / GARAGE_ZOOM_MIN, (l - SQUAD_LEVEL) / (FLOOR_LEVEL - SQUAD_LEVEL))
}

/** The §7.4 tier a level sounds like — §8.2's poke sounds and §20.2's zones. */
const tierOfLevel = (level: number): 1 | 2 => (level < SQUAD_LEVEL + 0.5 ? 1 : 2)

export async function createStage(host: HTMLElement): Promise<StageHandle> {
  const params = debugSearchParams()
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /*
   * [2026-09-26] **A phone gets the lighter room** — no SSAO pass, one pixel per
   * CSS pixel, a smaller shadow map (`GarageViewOptions.lite`). *"The
   * conversation in phone is very clunky"*: a touch screen with a phone's short
   * side. `?gpu=lite` and `?gpu=full` force either on a local build.
   */
  const gpu = params.get('gpu')
  const lite = gpu === 'lite' || (gpu !== 'full'
    && window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 600)

  let w = Math.max(1, host.clientWidth)
  let h = Math.max(1, host.clientHeight)
  const garage = createGarageView(w, h, undefined, { lite })
  const canvas = garage.canvas
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  // The page must not scroll or zoom under a pinch that is meant for the room.
  canvas.style.touchAction = 'none'
  host.appendChild(canvas)
  garage.setLens(GARAGE_REST_ZOOM)

  /*
   * ?nopost (and `C`, `?crt=off`) takes the glass off; ?post=rgb,crt attaches
   * just those parts. The switch the Pixi stack had for bisecting a frame
   * budget, kept for the same reason.
   */
  const requested = params.get('post')
  const passes: GlassPasses = requested
    ? { rgb: requested.split(',').includes('rgb'), crt: requested.split(',').includes('crt') }
    : { rgb: true, crt: true }
  const bloomOn = requested ? requested.split(',').includes('bloom') : true
  const glass = createGlass(passes, reduceMotion)
  const applyGlass = () => { glass.enabled = getViewModes().crt }
  applyGlass()
  const stopWatchingModes = onViewModes(applyGlass)

  // §8.2 — the numerals, on their own canvas, under the glass's lines.
  const numerals = createPokeCanvas()
  const numeralTexture = new T.CanvasTexture(numerals.canvas)
  numeralTexture.colorSpace = T.NoColorSpace
  numeralTexture.minFilter = T.NearestFilter
  numeralTexture.magFilter = T.NearestFilter
  const sizeNumerals = () => numerals.resize(w, h, garage.renderer.getPixelRatio())
  sizeNumerals()

  /** Client point -> the canvas's CSS pixels. */
  const toCanvas = (x: number, y: number) => {
    const r = canvas.getBoundingClientRect()
    return { x: (x - r.left) * w / Math.max(1, r.width), y: (y - r.top) * h / Math.max(1, r.height) }
  }
  /** Canvas CSS pixels -> client, for the numerals, which the store holds in client space. */
  const toClient = (x: number, y: number) => {
    const r = canvas.getBoundingClientRect()
    return { x: r.left + x * r.width / Math.max(1, w), y: r.top + y * r.height / Math.max(1, h) }
  }
  /** Who is under a client point: a seat, the founder (-1), James (-2), or nobody. */
  const pickAt = (x: number, y: number): number | null => {
    const at = toCanvas(x, y)
    return garage.pick(at.x, at.y)
  }
  /** Where a person is, in client pixels, or null if they are not in the frame. */
  const personAt = (seat: number): { x: number; y: number } | null => {
    const at = garage.screenOf(seat)
    return at ? toClient(at.x, at.y) : null
  }

  // --- the dialogue's camera --------------------------------------------------

  /** The scene line on screen, and whether a scene has moved the camera. */
  let sceneLine: number | null = null
  let sceneFocus = false
  /** The founder has said *What—* and the lens has gone to James's spot. */
  let jamesCued = false
  let jamesInRoom = false

  const focusDialogue = (focus: 'founder' | number | null) => {
    // Over the room the lens goes to the speaker; STUDIO_OS has no body, so the
    // camera holds where it is for its lines. A hero the garage does not hold
    // (Mo, Serena …) leaves the lens alone.
    const seat = focus === 'founder' ? FOUNDER_SEAT : focus === 0 ? JAMES_SEAT : null
    if (seat === null) return
    garage.focus(seat)
    sceneFocus = true
  }

  // --- taps ------------------------------------------------------------------

  const tapLatency = new LatencySampler(LATENCY_WINDOW)
  const audioLatency = new LatencySampler(LATENCY_WINDOW)
  const frames = new FrameSampler()
  let critPunch = 0

  let founderInspect: (() => void) | null = null
  let heroInspect: ((id: HeroId) => void) | null = null

  /** Where the lens is on the room's three stops, continuously. */
  const level = () => levelOfZoom(garage.zoom)

  /**
   * §4.5d — the founder codes at their own desk. The finger is on them, or the
   * rail's CODE was pressed; either way the founder is in the picture, so
   * nothing flies.
   */
  const codeAtFounderDesk = ({ t0, sound = false }: { t0?: number; sound?: boolean } = {}): number => {
    const at = personAt(FOUNDER_SEAT) ?? { x: w / 2, y: h / 2 }
    const paid = pokeFounder(at.x, at.y)
    garage.hop(FOUNDER_SEAT)
    if (paid <= 0) return 0
    if (sound) playKeyboardClick()
    if (t0 !== undefined) requestAnimationFrame(() => tapLatency.push(performance.now() - t0))
    return paid
  }

  /**
   * §7.8.8 — the neutral latch's tap: who is this? The founder opens their
   * profile, James his pass, anybody else becomes the selected developer, and
   * empty floor deselects — the only way out that does not need a close button
   * within reach of a thumb.
   */
  const doSelect = (who: number | null) => {
    if (who === JAMES_SEAT) {
      selectDeveloper(null)
      playUi('click')
      heroInspect?.('james')
      return
    }
    if (who === FOUNDER_SEAT) {
      selectDeveloper(null)
      playUi('click')
      founderInspect?.()
      return
    }
    selectDeveloper(who === null || who < 0 ? null : who)
    playUi(who === null || who < 0 ? 'close' : 'whoosh')
  }

  const doPoke = (x: number, y: number, t0: number) => {
    const who = pickAt(x, y)
    // James is tappable in the room: a poke on him is code (2026-09-26).
    if (who === JAMES_SEAT) {
      const at = personAt(JAMES_SEAT) ?? { x, y }
      const paid = pokeJames(at.x, at.y)
      garage.hop(JAMES_SEAT)
      if (paid > 0) playKeyboardClick()
      else playSfx('poke-void')
      return
    }
    // The selected tool means the same thing on every person: CODE on the
    // founder codes.
    if (who === FOUNDER_SEAT) {
      codeAtFounderDesk({ t0, sound: true })
      return
    }
    // Empty floor, furniture or sky is a miss rather than a free point:
    // §7.7.6 makes the world addressable, and an addressable world has places
    // where nobody is standing.
    if (who === null || who < 0) return
    garage.hop(who)

    const lvl = level()
    const result = poke(x, y, { rung: Math.round(lvl), index: who })

    // Sound first: criterion 2's budget is the tightest at 60 ms p95.
    const tier = tierOfLevel(lvl)
    if (result.crit) playSfx('poke-crit')
    else if (result.sp === 0) playSfx('poke-void')
    else if (tier === 1) playKeyboardClick()
    else playSfx(pokeSfxForZoom(tier))
    // Only the JS half of the audio path — see the CAVEAT in perf/metrics.ts.
    audioLatency.push(performance.now() - t0)
    pokeHaptic(getState().dev.state)
    if (result.crit) critPunch = 1
    // Measured on the next frame, which is when the numeral is visible.
    requestAnimationFrame(() => tapLatency.push(performance.now() - t0))
  }

  // --- the hand: tap, drag, pinch, wheel ---------------------------------------
  //
  // §7.7.6 — the tap fires on the *release*, and only if the finger barely
  // moved: a pan that pokes costs the player Entropy every time they look
  // around. §7.7.6b — what the release then does is the latch on the HUD, not
  // a clock.

  let drag: { id: number; x0: number; y0: number; px: number; py: number } | null = null
  const pointers = new Map<number, { x: number; y: number; seen: number }>()
  let pinch: { distance: number; zoom: number } | null = null

  const expireStalePointers = (now: number) => {
    for (const [id, p] of pointers) if (now - p.seen > POINTER_STALE_MS) pointers.delete(id)
    if (pointers.size < 2) pinch = null
  }

  const onPointerDown = (ev: PointerEvent) => {
    const now = ev.timeStamp || performance.now()
    expireStalePointers(now)
    // Only the first finger drags; a second means a pinch.
    if (drag === null && pointers.size === 0) {
      drag = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, px: ev.clientX, py: ev.clientY }
    }
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, seen: now })
  }

  const onPointerMove = (ev: PointerEvent) => {
    const now = ev.timeStamp || performance.now()
    expireStalePointers(now)
    if (!pointers.has(ev.pointerId)) return
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, seen: now })

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      // Two contacts can begin on the same pixel (or be coalesced there). A
      // zero baseline makes the next ratio 0/0, and a NaN zoom blanks the room.
      if (!pinch) {
        if (distance > 0 && Number.isFinite(distance)) pinch = { distance, zoom: garage.zoom }
        return
      }
      const ratio = distance / pinch.distance
      if (!(ratio > 0) || !Number.isFinite(ratio)) return
      // §7.7.6 — about the point between the fingers, updated every move: a
      // two-finger gesture drifts, and a stale anchor drags the room away.
      const at = toCanvas((a.x + b.x) / 2, (a.y + b.y) / 2)
      garage.zoomTo(pinch.zoom * ratio, at.x, at.y)
      // The finger left on the glass afterwards pans on from where it is now,
      // not from where it was when the pinch began.
      const held = drag ? pointers.get(drag.id) : undefined
      if (drag && held) {
        drag.px = held.x
        drag.py = held.y
      }
      return
    }

    if (!drag || ev.pointerId !== drag.id) return
    const r = canvas.getBoundingClientRect()
    garage.panBy((ev.clientX - drag.px) * w / Math.max(1, r.width), (ev.clientY - drag.py) * h / Math.max(1, r.height))
    drag.px = ev.clientX
    drag.py = ev.clientY
  }

  const onPointerUp = (ev: PointerEvent) => {
    pointers.delete(ev.pointerId)
    if (pointers.size < 2) pinch = null
    if (!drag || ev.pointerId !== drag.id) return
    const t = ev.timeStamp || performance.now()
    const travelled = exceedsSlop(ev.clientX - drag.x0, ev.clientY - drag.y0)
    drag = null
    // §7.7.6b — one question, and it is not "how long". A finger that
    // travelled was the camera; one that stayed put meant the latched verb.
    if (travelled || ev.type !== 'pointerup') return
    switch (tapVerb(getState().touchMode, true)) {
      case 'inspect':
        doSelect(pickAt(ev.clientX, ev.clientY))
        break
      case 'grab':
        // §7.8.9's carry was drawn by the Pixi room's hands, and the 3D room
        // has no wanderers to carry yet; a release in DRAG does nothing rather
        // than reaching past what the latch says.
        break
      default:
        doPoke(ev.clientX, ev.clientY, t)
    }
  }

  // Desktop convenience — the dolly needs to be drivable without a
  // touchscreen. Exponential in the delta, so one notch is one constant
  // proportion wherever the camera is, and anchored at the pointer and never
  // pulled back — "the zoom should not resist me" (2026-09-26).
  const onWheel = (ev: WheelEvent) => {
    ev.preventDefault()
    const at = toCanvas(ev.clientX, ev.clientY)
    garage.zoomAt(Math.exp(-ev.deltaY * 0.0016), at.x, at.y)
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: true })
  canvas.addEventListener('pointermove', onPointerMove, { passive: true })
  canvas.addEventListener('pointerup', onPointerUp, { passive: true })
  canvas.addEventListener('pointercancel', onPointerUp, { passive: true })
  canvas.addEventListener('pointerleave', onPointerUp, { passive: true })
  canvas.addEventListener('wheel', onWheel, { passive: false })

  const resized = new ResizeObserver(() => {
    const nw = Math.max(1, host.clientWidth)
    const nh = Math.max(1, host.clientHeight)
    if (nw === w && nh === h) return
    w = nw
    h = nh
    garage.resize(w, h)
    sizeNumerals()
  })
  resized.observe(host)

  // --- frame loop ----------------------------------------------------------------

  const music = new MusicBus()
  // Not awaited: a missing stem set must not hold up the first frame, and the
  // bus is silent rather than absent until its buffers arrive.
  void music.init()
  /** §20.7.4 fires once per run; a Paradigm Shift clears `massHired` and this. */
  let musicCollapsed = false
  /** Last consumed §7.7.2 spawn, so one hire produces one stinger. */
  let lastSpawnId = 0
  /** Last consumed §10.8a ship, so one ship produces one punch. */
  let lastShipId = 0
  let shipShake = 0
  let lastFrame = performance.now()
  let frameMs = 0
  let raf = 0
  let numeralsLive = false

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const rawFrameMs = now - lastFrame
    const dt = Math.min(0.1, rawFrameMs / 1000)
    lastFrame = now
    frameMs = rawFrameMs
    frames.sample(rawFrameMs)

    // §26.1.8's `?speed`, a dial rather than a constant: repeated whole ticks,
    // never a bigger `dt` (`dev/simSpeed.ts`).
    const steps = getSimSpeed()
    for (let step = 0; step < steps; step += 1) tick(dt)

    const state = getState()

    garage.setHeadcount(state.devs)
    // James arrives after the founder's *What—*, once the lens has reached his
    // empty spot (`cueJames`): desk, chair, then him, and the dialogue holds
    // *Ouch.* until he is down. A scene already past the line has him there.
    jamesInRoom = arrivedHeroes().has('james')
      || (state.scene === SCENE_JAMES_ARRIVES.id && sceneLine !== null
        && (sceneLine >= JAMES_DROPS_AT_LINE || (jamesCued && !garage.easing)))
    garage.setJames(jamesInRoom)
    // The scene is over: the lens goes back to where the player had it.
    if (!state.scene) {
      sceneLine = null
      jamesCued = false
      if (sceneFocus) {
        garage.focus(null)
        sceneFocus = false
      }
    }

    // §20.7.4 — the one scripted override of the score, once per run. The
    // camera's half of §21 Act IV (the dolly out over the thousand) was the
    // Pixi office's and is not drawn until the lane is.
    if (state.massHired && !musicCollapsed) {
      musicCollapsed = true
      music.triggerActIV()
    }
    // A Paradigm Shift clears massHired for the next run: both halves of the
    // bus reset, or the score stays collapsed through the next Act I.
    if (!state.massHired && musicCollapsed) {
      musicCollapsed = false
      music.clearActIV()
    }
    // §20.7.2 — a rung promotion gets a stinger, once per spawn event. Skipped
    // on the first one observed, which may be a jumped-to phase rather than a
    // hire the player made.
    if (state.spawn && state.spawn.id !== lastSpawnId) {
      const first = lastSpawnId === 0
      lastSpawnId = state.spawn.id
      if (!first && state.spawn.promotedTo !== null) void music.playStinger('sting-promotion')
    }
    // §10.8a — a ship lands one punch on the glass, consumed once.
    if (state.ship && state.ship.id !== lastShipId) {
      lastShipId = state.ship.id
      shipShake = 1
    }

    const lvl = level()
    // §20.7.3 — the score is a mix, driven every frame from the same Z the
    // picture uses and the same Entropy the readout does.
    music.update(lvl / 9, currentEntropy(state))
    const tier = tierOfLevel(lvl)
    if (tier !== state.zoom) setZoom(tier)
    setCameraRung(Math.round(lvl))

    critPunch = Math.max(0, critPunch - dt * 4)
    const shipAmp = shipShake * (reduceMotion ? 1.5 : 7)
    const shake = { x: Math.sin(now * 0.9) * shipAmp, y: Math.cos(now * 1.1) * shipAmp * 0.7 }
    shipShake *= Math.exp(-dt * 12)

    // §8.2 — each numeral/snippet callout arcs up and fades. The store holds
    // them in client pixels; the canvas is drawn in its own. One layout read a
    // frame, not one per floater.
    let floaters = state.floaters
    if (floaters.length > 0) {
      const r = canvas.getBoundingClientRect()
      const sx = w / Math.max(1, r.width)
      const sy = h / Math.max(1, r.height)
      floaters = floaters.map((f) => ({ ...f, x: (f.x - r.left) * sx, y: (f.y - r.top) * sy }))
    }
    if (numerals.draw(floaters, performance.now(), FLOATER_LIFE_MS)) numeralTexture.needsUpdate = true
    numeralsLive = floaters.length > 0

    const theme = entropyTheme(currentEntropy(state))
    // §6 pass 3: a calm studio gets a tight halo on its lamps, a seizing one
    // the same lamps blown out — the strain moves *how much* comes back.
    garage.setBloom(glass.enabled && bloomOn ? (0.55 + theme.glass.bloom * 1.5) * 0.3 : 0)
    garage.render(now / 1000)
    glass.render(garage.renderer, garage.output, numeralsLive ? numeralTexture : null, {
      glass: theme.glass,
      critPunch,
      // A third of the line contrast over the room, and less as faces fill the frame.
      lines: Math.max(0.12, 0.35 / Math.max(1, garage.zoom)),
      shake,
      seconds: now / 1000,
      width: w,
      height: h,
    })

    // Local-browser-only inspection seams, in the same family as ?act and ?bench.
    if (DEBUG_TOOLS_ENABLED) {
      const g = globalThis as unknown as Record<string, unknown>
      /*
       * §4.5d — **where the founder is, in screen pixels**, and James: aiming
       * rather than hunting, so "the person is not in the frame" and "the
       * person is in the frame and tapping does nothing" stay two findings.
       */
      g.__founderAt = () => {
        const at = personAt(FOUNDER_SEAT)
        return at ? { x: Math.round(at.x), y: Math.round(at.y) } : null
      }
      g.__jamesAt = () => {
        const at = personAt(JAMES_SEAT)
        return at ? { x: Math.round(at.x), y: Math.round(at.y) } : null
      }
      ;(window as unknown as Record<string, unknown>).__stage = {
        z: +(lvl / 9).toFixed(4),
        level: +lvl.toFixed(2),
        zoom: +garage.zoom.toFixed(3),
        easing: garage.easing,
        devs: state.devs,
        drawn: Math.min(20, state.devs),
        viewport: `${Math.round(w)}x${Math.round(h)}`,
        massHired: state.massHired,
        dt: +dt.toFixed(4),
      }
    }
  }
  raf = requestAnimationFrame(frame)

  const camera: StageCamera = {
    get z() {
      return level() / 9
    },
    set(z: number) {
      if (!Number.isFinite(z)) return
      garage.setLens(zoomOfLevel(z * 9))
    },
  }

  return {
    get frameMs() {
      return frameMs
    },
    get latencyP95() {
      return tapLatency.p95
    },
    camera,
    focusTeam() {
      garage.home()
      playUi('whoosh')
    },
    focusDialogue(focus) {
      focusDialogue(focus)
    },
    setSceneLine(line) {
      sceneLine = line
    },
    cueJames() {
      if (jamesCued) return
      jamesCued = true
      garage.focus(JAMES_SEAT)
      sceneFocus = true
    },
    jamesLanded() {
      return !garage.animating(JAMES_SEAT) && sceneLine !== null && jamesInRoom
    },
    codeFounder() {
      return codeAtFounderDesk({ sound: true })
    },
    setFounderInspect(handler) {
      founderInspect = handler
    },
    setHeroInspect(handler) {
      heroInspect = handler
    },
    setFounderProfile(profile: FounderProfile) {
      // The room's founder is the one the player made, not the default.
      garage.setIdentity(founderLook(profile), readStudioName())
    },
    bench: {
      camera,
      tap: () => {
        const at = toClient(w / 2, h / 2)
        doPoke(at.x, at.y, performance.now())
      },
      tapLatency,
      audioLatency,
      frames,
      // §23.3 criterion 4 named the Pixi floor's 1,000 sprites. The room draws
      // what it draws; there is no population to force until the lane does.
      setFloorPopulationOverride: () => {},
    },
    destroy() {
      cancelAnimationFrame(raf)
      resized.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      void music.unload()
      stopWatchingModes()
      glass.dispose()
      numeralTexture.dispose()
      garage.dispose()
      canvas.remove()
    },
  }
}
