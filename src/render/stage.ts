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
import {
  currentEntropy,
  developerVelocity,
  FLOATER_LIFE_MS,
  getState,
  poke,
  pokeFounder,
  selectDeveloper,
  setZoom,
  tick,
  type PokeTarget,
} from '../game/store.ts'
import { playKeyboardClick, pokeSfxForZoom, playSfx } from '../audio/sfx.ts'
import { playUi } from '../ui/uiSfx.ts'
import { MusicBus } from '../audio/music.ts'
import { holdHaptic, pokeHaptic } from '../audio/haptics.ts'
import { LensCamera, fitScale } from './omniLens.ts'
import { ALL_PASSES, createPostProcess, type PassName } from './postProcess.ts'
import { buildScene } from './scene.ts'
import { maxZoomFor, rungFor, zoomCeilingLifted } from '../sim/headcount.ts'
import {
  TOP_RUNG,
  VIEWS,
  dominantView,
  earnedViewWeights,
  rungAt,
  viewStopZ,
  zAtRung,
  type ViewKind,
} from '../sim/ladder.ts'
import { storeyAtLocal, storeysFor } from './tower.ts'
import { unitAtLocal } from './city.ts'
import { createCollapse } from './collapse.ts'
import { createPokeTypeset } from './pokeText.ts'
import { createTallies, tallySources, type TallySource } from './tallies.ts'
import { createArrivals } from './arrivals.ts'
import { ROOM_DEV_CAP } from './room.ts'
import {
  clampPan,
  exceedsSlop,
  flingVelocity,
  initPan,
  panLimit,
  pickNearest,
  stepPan,
  type PanState,
} from './navigation.ts'
import { tapVerb } from '../game/touchMode.ts'
import { FrameSampler, LatencySampler } from '../perf/metrics.ts'
import type { BenchHooks } from '../perf/bench.ts'
import type { FounderProfile } from '../game/founderProfile.ts'

export interface StageHandle {
  /** Rolling frame time in ms, for the GDD §23.3 overlay. */
  readonly frameMs: number
  /** p95 tap -> numeral latency in ms. Criterion 1's threshold is 80 ms. */
  readonly latencyP95: number
  readonly camera: LensCamera
  /** §7.8.10 Hero Anchor: return smoothly to the manager corner. */
  focusFounder(): void
  /**
   * §10.7a.1 — point the lens at the dialogue's current speaker. `'founder'`
   * is the corner desk, a number is a seat index, `null` is `STUDIO_OS` (the
   * lens holds where it is). Called by the dialogue box on every page turn;
   * the camera push to Desk zoom and the return are handled here, from the
   * store's scene state, so the box does not need to know the camera exists.
   */
  focusDialogue(focus: 'founder' | number | null): void
  /** Code at your own desk with the standard numeral/snippet feedback. */
  codeFounder(): number
  /** React hook for opening the founder profile when the world avatar is tapped. */
  setFounderInspect(handler: (() => void) | null): void
  /** Replace the default figure once first-start setup has been submitted. */
  setFounderProfile(profile: FounderProfile): void
  /** Everything the GDD §23.3 acceptance run needs to drive and measure the app. */
  readonly bench: BenchHooks & { frames: FrameSampler }
  destroy(): void
}

/** Samples kept for the latency percentile. 120 taps is ~24 s at 5 taps/sec. */
const LATENCY_WINDOW = 120

/**
 * How long a poke floater lives, and what fraction of that is the fade.
 *
 * Longer and later than the first pass. The numeral reads instantly; the §8.2a
 * code snippet beside it is the payload, and a line of code that starts fading
 * on the frame it appears is a joke told at a volume nobody can hear.
 */
const FLOATER_FADE = 0.3

/** Shared empty list, so a rung with no heads does not allocate one per frame. */
const NO_TALLIES: readonly TallySource[] = []

/**
 * Which of the three city instances draws each view — GDD §7.4a.
 *
 * `scene.city` is keyed by the rung an instance *is*, and the cross-fade means
 * the rung the camera is nearest is not always that one. Kept as a table so the
 * R15 hit test asks the geometry that is actually on screen.
 */
const CITY_RUNG_OF = { block: 4, park: 5, sprawl: 6 } as const

/**
 * The room is the only view with individual people that must stay clear of the
 * two HUD rails. Fitting it to the entire canvas put the founder—the room's
 * north-east extreme—directly under CASH and the interaction stack.
 */
export function viewportForView(
  view: ViewKind,
  viewport: { w: number; h: number },
): { w: number; h: number } {
  if (view !== 'room') return viewport
  const rail = Math.min(176, viewport.w * 0.13)
  return { w: Math.max(280, viewport.w - rail * 2), h: viewport.h }
}

export function roomHudBiasY(_viewportHeight: number): number {
  // The folded room now anchors its floor to the founder at the true north
  // vertex.  The old upward shove compensated for the founder being buried
  // inside a shell centred on the other desks; keeping it would clip the
  // founder, desk and mat above the canvas.
  return 0
}

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

  const scene = buildScene(app.renderer)
  const { views, floor, room, tower, city } = scene
  // §7.4a — far to near, so the galaxy is behind the room rather than over it.
  // One container per rung of the ladder, which is what makes every rung a
  // place the camera can stop instead of a tier it has to skip.
  const FAR_TO_NEAR = [...VIEWS].reverse().map((v) => v.view)
  for (const view of FAR_TO_NEAR) world.addChild(views[view])

  // §21 Act IV. Its overlay goes inside the glass, above the world and below
  // the numerals — the badges and chatter are scenery and must never bury the
  // one piece of feedback the clicker layer depends on (GDD §8.2).
  const collapse = createCollapse({ renderer: app.renderer, floor, reduceMotion })
  glass.addChild(collapse.overlay)

  // §7.7.2 — hires arrive on screen. Parented into the room so they share its
  // transform and its cross-fade, and land in room-local coordinates.
  const arrivals = createArrivals()
  room.container.addChild(arrivals.layer)

  const camera = new LensCamera(0)

  /**
   * The view the camera is looking at, and the scale it is drawn at.
   *
   * Published out of the ticker because the hit test, the pan limits and the
   * pinch anchor all have to agree with what was last *drawn* — deriving each
   * of them from Z independently is three chances to disagree by a frame, and
   * the one that shows is the poke landing on the wrong developer.
   */
  let currentView: ViewKind = 'room'
  let currentScale = 1

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
    // §7.4a — only the room has anybody to pick, and the room is now all three
    // rungs where one sprite is one person. Above it the unit is a floor, a
    // building, a town, and the right answer to "who is under the thumb" is
    // nobody.
    if (currentView !== 'room') return -1
    if (!(currentScale > 0)) return -1

    const container = views[currentView]
    // Screen -> view-local. The view's pivot is baked into its own transform,
    // so working through the container is safer than re-deriving it here.
    const local = container.toLocal({ x, y })
    const seats = roomSeats()
    // A generous radius: a fingertip is about 9 mm and the desks are small.
    // Scaled into view space so it stays a thumb-sized target at any zoom.
    return pickNearest(seats, local.x, local.y, 26 / Math.max(0.15, currentScale) + 14)
  }

  /**
   * Screen point -> the §7.7.1 unit under it, or null — GDD §4.5b, R15.
   *
   * **The gap this closes.** `pickDeveloper` deliberately answers −1 above the
   * room, because above the room there is no developer to name — and `doPoke`
   * took that as a miss and returned. So a tap at rung 4 did *nothing at all*:
   * the game's primary verb switched itself off at exactly the headcount where
   * the player has the most developers to be doing something with.
   *
   * §4.5b's answer is that a tap lands on "whatever unit §7.7.1 says the camera
   * is currently holding", so this asks each view what it is showing and lets
   * `sim/units.ts` turn the answer into the seats it covers. The rung comes
   * from the camera rather than from the view because two of the views span a
   * pair of rungs, and the rung is what decides how big the unit is.
   */
  const pickUnit = (x: number, y: number): PokeTarget | null => {
    const rung = Math.max(0, Math.min(TOP_RUNG, Math.round(rungAt(camera.z))))

    switch (currentView) {
      case 'room': {
        // Rungs 0–2 — one sprite is one person, and empty floor is a miss.
        const seat = pickDeveloper(x, y)
        return seat < 0 ? null : { rung, index: seat }
      }
      case 'tower': {
        const local = views.tower.toLocal({ x, y })
        const storey = storeyAtLocal(local.x, local.y, storeysFor(getState().devs))
        return storey < 0 ? null : { rung, index: storey }
      }
      case 'block':
      case 'park':
      case 'sprawl': {
        // The three city instances are keyed by the rung each one *is*, which
        // is not necessarily the rung the camera is nearest — the cross-fade
        // reaches a rung either side. Asking the handle keeps the hit test on
        // the geometry that is actually drawn.
        const handle = scene.city[CITY_RUNG_OF[currentView]]
        const local = views[currentView].toLocal({ x, y })
        const unit = unitAtLocal(local.x, local.y, handle.units, handle.rung)
        return unit < 0 ? null : { rung, index: unit }
      }
      default:
        // §7.8.2 — rungs 7–9 have no geometry of their own yet, so there is one
        // thing on screen and a tap lands on it. That is not a placeholder for
        // the hit test: a nation *is* one unit at rung 7, and when the lit
        // coastline is built this stays true and only gets more to aim at.
        return { rung, index: 0 }
    }
  }

  /**
   * The room's desks, in room-local coordinates.
   *
   * Cached on the drawn count rather than rebuilt per call. It was rebuilt per
   * *tap*, which was free; §8.2b's tallies now ask for it every frame, and a
   * hundred and twenty object literals sixty times a second is a GC churn the
   * §23.3 frame budget should not be paying for a list that changes only when
   * somebody is hired.
   */
  let seatCache: Array<{ x: number; y: number }> = []
  let seatCacheFor = -1
  const roomSeats = () => {
    if (seatCacheFor !== room.drawn) {
      seatCache = Array.from({ length: room.drawn }, (_, i) => room.deskAt(i)!)
      seatCacheFor = room.drawn
    }
    return seatCache
  }

  const founderHit = (x: number, y: number): 'avatar' | 'desk' | null => {
    if (currentView !== 'room' || !(currentScale > 0)) return null
    const local = views.room.toLocal({ x, y })
    const at = room.founderDeskAt()
    const reach = 10 / Math.max(0.15, currentScale) + 4

    // The person owns the upper/front part of the workstation. It is checked
    // first so tapping YOU opens YOU even where their body overlaps the desk.
    if (
      Math.abs(local.x - at.x) <= 12 + reach &&
      local.y >= at.y - 34 - reach &&
      local.y <= at.y + 10 + reach
    ) return 'avatar'

    // The normal developer desk sits north-west of its seat. Keep this a large
    // thumb target without swallowing the avatar above it.
    // The founder workstation is mirrored to face the studio.
    const deskX = at.x + 13
    const deskY = at.y - 8
    return Math.hypot(local.x - deskX, local.y - deskY) <= 24 + reach ? 'desk' : null
  }

  let founderInspect: (() => void) | null = null

  /** The whole tap path, shared by real pointers and the §23.3 bench. */
  /**
   * §7.8.8 — the neutral mode's tap.
   *
   * Rung 2 only. You cannot select a person who is two pixels wide, and
   * §7.7.4's promise that the player can always zoom back to a floor with
   * people on it is what makes that a scope rather than a limitation. Tapping
   * empty floor deselects, which is the only way out that does not need a
   * close button to be within reach of a thumb.
   */
  const doSelect = (x: number, y: number): boolean => {
    if (currentView !== 'room') return false
    if (founderHit(x, y)) {
      selectDeveloper(null)
      playUi('click')
      founderInspect?.()
      return true
    }
    const target = pickDeveloper(x, y)
    selectDeveloper(target < 0 ? null : target)
    playUi(target < 0 ? 'close' : 'whoosh')
    return true
  }

  const doPoke = (x: number, y: number, t0: number) => {
    const founderTarget = founderHit(x, y)
    // The selected tool means the same thing on every person. CODE on the
    // founder codes; INFO (handled by doSelect) opens the profile. The old
    // avatar-only exception made players learn two meanings for one tap.
    if (founderTarget === 'avatar' || founderTarget === 'desk') {
      codeAtFounderDesk(t0, true)
      return
    }

    // §4.5b — what was actually poked. Null means the tap landed on empty
    // floor, open ground or sky, which is a miss rather than a free point:
    // §7.7.6 makes the world addressable, and an addressable world has places
    // where nothing is standing.
    const target = pickUnit(x, y)
    if (!target) return
    if (currentView === 'room') room.jolt(target.index)

    const result = poke(x, y, target)

    // Sound first: criterion 2's budget is the tightest at 60 ms p95.
    if (result.crit) playSfx('poke-crit')
    else if (result.sp === 0) playSfx('poke-void')
    else if (camera.level === 1) playKeyboardClick()
    else playSfx(pokeSfxForZoom(camera.level))
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

  // --- pan, and telling a tap from a drag (GDD §7.7.6, §7.7.6b) ------------
  //
  // The poke no longer fires on pointerdown. It fires on pointer*up*, and only
  // if the pointer barely moved — §7.7.6 is explicit that a pan which pokes
  // costs the player Entropy every time they look around, and a poke which
  // pans loses the clicker layer. The cost is that criterion 1's stopwatch now
  // starts at the release rather than the press, which is the same instant a
  // player perceives their own tap.
  //
  // **What the release then does is the §7.7.6b mode, not the clock.** There is
  // one question left for a finger to answer — did it travel — and the two
  // answers are "the camera" and "whatever the HUD says is latched". Every
  // duration threshold that used to sit here is gone: a slow tap and a quick
  // tap are the same tap, which is the whole of what was reported as being
  // hard to control.

  let pan: PanState = initPan()
  /** The in-progress drag, or null. */
  let drag: { id: number; x0: number; y0: number; px: number; py: number; t0: number; panX: number; panY: number } | null = null
  /** Live pan limits, recomputed each frame from the dominant tier's size. */
  let limitX = 0
  let limitY = 0
  /** §7.8.9 — the pointer currently carrying somebody, or -1. */
  let carryId = -1

  /**
   * §7.7.6 — the screen point the lens is zooming toward, or null for the
   * middle of the frame.
   *
   * Without it a pinch scales about the centre of the screen, so zooming in on
   * a squad at the edge of the floor walks the squad off it — which is exactly
   * the "zoom to any squad" half of R5 failing for a reason that has nothing to
   * do with squads. Anchoring the gesture at its own focal point is the whole
   * fix, and it generalises: it is also what makes a double-tap land on the
   * building that was tapped.
   */
  let focal: { x: number; y: number } | null = null
  /** The dominant view's scale last frame, which is what the anchor corrects against. */
  let lastScale = 0
  let lastScaleView: ViewKind = 'room'

  /**
   * §7.7.6 — "double-tap a unit: zoom into it, one rung down, centred on what
   * was tapped."
   *
   * Live only where a tap is *not* already the poke. At the room and the floor
   * §8.2's primary verb owns the gesture, and making every poke wait 300 ms to
   * find out whether a second one is coming would put the clicker layer behind
   * a timer — §23.3 criterion 1 measures that path at 80 ms.
   */
  const DOUBLE_TAP_MS = 300
  const DOUBLE_TAP_SLOP = 24
  let lastTap = { t: 0, x: 0, y: 0 }

  /**
   * §7.7.6 — is double-tap-to-descend available here?
   *
   * Only above the room, because the room is the bottom of the ladder and
   * there is nothing below it to descend to.
   *
   * **This used to be called `tapIsAPoke`, and after R15 that name was a lie.**
   * A tap is a poke at every rung now (§4.5b), so the thing this actually
   * decides is whether a second tap means "go in" — and a predicate whose name
   * has stopped describing what it returns is how a reader ends up believing
   * pokes are still room-only.
   */
  const doubleTapDescends = () => currentView !== 'room'

  /** §21 Act IV's scripted dolly, and §7.7.6's double-tap. Null when the camera is the player's again. */
  let dollyTarget: number | null = null
  /** The rail's CODE — YOU action owns the lens until the corner desk lands. */
  let founderFocus = false

  /**
   * §10.7a.1 — the dialogue's current speaker, and the camera the scene found
   * itself in. The push to Desk zoom and the per-line re-centre are driven from
   * here; {@link focusDialogue} just says who is talking.
   */
  let dialogueFocus: 'founder' | number | null = null
  let savedSceneCamera: { z: number; panX: number; panY: number } | null = null

  const focusFounderCamera = () => {
    founderFocus = true
    focal = null
    pan.vx = 0
    pan.vy = 0
    dollyTarget = zAtRung(0)
  }

  /**
   * §10.7a.1 — who is talking, in the world. The camera push itself is handled
   * in the frame loop off the store's scene state; this records the speaker and
   * turns them to face the lens for the duration of their line.
   */
  const focusDialogue = (focus: 'founder' | number | null) => {
    dialogueFocus = focus
    room.setSpeaker(typeof focus === 'number' ? focus : -1)
    // A scene always plays at Desk zoom, so every line that names somebody
    // re-asserts it — and a line with nobody (STUDIO_OS) holds it rather than
    // cutting away.
    if (focus !== null) dollyTarget = zAtRung(0)
  }

  const codeAtFounderDesk = (t0?: number, sound = false): number => {
    const local = room.founderDeskAt()
    const at = views.room.toGlobal({ x: local.x, y: local.y - 30 })
    const paid = pokeFounder(at.x, at.y)
    if (paid <= 0) return 0

    focusFounderCamera()
    room.joltFounder()
    if (sound) playKeyboardClick()
    if (t0 !== undefined) {
      requestAnimationFrame(() => tapLatency.push(performance.now() - t0))
    }
    return paid
  }

  /**
   * §7.7.6 — descend one rung of the §7.4a ladder, centred on `(x, y)`.
   *
   * One rung, never "back to the desk". §7.4a's complaint is precisely that the
   * lens *skipped*, and a control that jumps four rungs inward to fix a control
   * that jumped four rungs outward would be the same bug facing the other way.
   */
  const descendOneRung = (x: number, y: number): boolean => {
    const rung = Math.round(rungAt(camera.z))
    if (rung <= 0) return false
    focal = { x, y }
    dollyTarget = zAtRung(rung - 1)
    playUi('whoosh')
    return true
  }

  /**
   * §7.8.9 — screen coordinates to room-local, for carrying somebody.
   *
   * The tier's pivot is baked into its own transform, so `toLocal` is both
   * shorter and safer than re-deriving the camera's arithmetic here.
   */
  const toRoom = (x: number, y: number) => views.room.toLocal({ x, y })

  /**
   * §7.7.6b — the grab, on the press, because the player already said GRAB.
   *
   * **This is `pointerdown` again, and that is not a regression.** §7.7.6a
   * moved the grab off the press onto a hold timer, and its reasoning was
   * exactly right *for a game with no mode switch*: a press that silently
   * picked somebody up taught the player about a mode change by making them
   * watch a developer they did not mean to touch follow their thumb around.
   *
   * With GRAB latched on the HUD, that sentence no longer describes anything.
   * The mode was entered deliberately, it is lit on screen, and the caption
   * under it says DRAG PEOPLE — so the press has nothing left to disambiguate
   * and every millisecond it waits is lag on the only verb the mode has. The
   * haptic tick §7.7.6a made load-bearing stays: it is now an acknowledgement
   * rather than an announcement, which is the cheaper job it was always doing
   * best.
   *
   * Returns true if somebody was picked up, in which case the press is not
   * also the start of a camera drag.
   */
  const tryGrab = (x: number, y: number, pointerId: number): boolean => {
    if (currentView !== 'room') return false
    const who = pickDeveloper(x, y)
    if (who < 0 || !room.hands.pickUp(who)) return false

    const at = toRoom(x, y)
    room.hands.carryTo(at.x, at.y)
    carryId = pointerId
    holdHaptic()
    playUi('click')
    return true
  }

  const onPointerDown = (ev: PointerEvent) => {
    const t = ev.timeStamp || performance.now()
    // A hand on the world takes the camera back from a scripted Hero Anchor.
    founderFocus = false

    // Only the first finger drags; a second means a pinch, handled below.
    if (drag === null && pointers.size === 0) {
      // The grab is checked first and, when it lands, no drag is started at
      // all: the camera must let go of the world the instant the hand takes
      // hold of somebody, or the grab drags the floor along with the developer.
      if (tapVerb(getState().touchMode, currentView === 'room') === 'grab') {
        if (tryGrab(ev.clientX, ev.clientY, ev.pointerId)) return
      }
      drag = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, px: ev.clientX, py: ev.clientY, t0: t, panX: pan.x, panY: pan.y }
      pan.vx = 0
      pan.vy = 0
    }
  }

  const onDragMove = (ev: PointerEvent) => {
    if (carryId === ev.pointerId) {
      const at = toRoom(ev.clientX, ev.clientY)
      room.hands.carryTo(at.x, at.y)
      return
    }
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
    if (carryId === ev.pointerId) {
      carryId = -1
      // Dropped onto a seat, or onto the floor. `pickDeveloper` answers "whose
      // desk is under the finger", which is exactly the question.
      const onto = pickDeveloper(ev.clientX, ev.clientY)
      const what = room.hands.drop(onto)
      // §7.8.5's bum-hits-seat for a landing, the close whisper for a shrug.
      // §7.8.6 rule 2 still holds: neither changes a single Story Point.
      if (what === 'seated') playSfx('poke-floor')
      else if (what === 'walking') playUi('close')
      return
    }
    if (!drag || ev.pointerId !== drag.id) return
    const t = ev.timeStamp || performance.now()
    const dx = ev.clientX - drag.x0
    const dy = ev.clientY - drag.y0
    // §7.7.6b — one question, and it is not "how long". A finger that travelled
    // was the camera; a finger that stayed put meant the latched verb, however
    // long it took to say so.
    const travelled = exceedsSlop(dx, dy)
    drag = null

    if (travelled) {
      const f = flingVelocity(pan.vx, pan.vy)
      pan.vx = f.vx
      pan.vy = f.vy
      return
    }

    pan.vx = 0
    pan.vy = 0

    if (doubleTapDescends()) {
      const near = Math.hypot(ev.clientX - lastTap.x, ev.clientY - lastTap.y) <= DOUBLE_TAP_SLOP
      if (near && t - lastTap.t < DOUBLE_TAP_MS) {
        lastTap = { t: 0, x: 0, y: 0 }
        descendOneRung(ev.clientX, ev.clientY)
        return
      }
      lastTap = { t, x: ev.clientX, y: ev.clientY }
    }

    switch (tapVerb(getState().touchMode, currentView === 'room')) {
      case 'inspect':
        doSelect(ev.clientX, ev.clientY)
        break
      case 'grab':
        // The press already picked somebody up and the release already put them
        // down, both above. A release that gets here in GRAB mode landed on
        // nobody — and doing anything at all with it would be the mode reaching
        // past what it says it does.
        break
      default:
        // The *first* tap of a descend still pokes, and after R15 that now costs
        // §4.9 Entropy where it used to cost nothing. Left deliberately: the only
        // way to avoid it is to hold every poke above the room for
        // DOUBLE_TAP_MS to see whether a second one is coming, and §23.3
        // criterion 1 gives the whole tap-to-numeral path eighty milliseconds.
        // A navigation gesture that also buffs the thing you navigated to is a
        // far smaller sin than a clicker with 300 ms of input lag.
        doPoke(ev.clientX, ev.clientY, t)
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

    // §7.7.6 — the pinch zooms toward the point between the fingers. Updated
    // every move rather than latched at the start, because a two-finger gesture
    // drifts and a stale anchor would slowly drag the world away from the hands
    // holding it.
    focal = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }

    if (!pinchStart) {
      // Two contacts can begin on the same physical pixel (or be coalesced
      // there by the browser). Latching a zero baseline makes the next ratio
      // 0/0 or x/0 and used to blank every scene layer via a NaN camera.
      if (!(distance > 0) || !Number.isFinite(distance)) return
      pinchStart = { distance, z: camera.z }
      return
    }

    // Pinching in pulls the camera toward the desk. The ratio is log-mapped
    // because Z itself is already logarithmic in scale — a linear gesture then
    // produces a constant *rate* of scale change, which is what reads as
    // smooth across nine orders of magnitude.
    const ratio = distance / pinchStart.distance
    if (!(ratio > 0) || !Number.isFinite(ratio)) return
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
    founderFocus = false
    focal = { x: ev.clientX, y: ev.clientY }
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

  // §8.2b — the passive `+1`s. *Below* the poke numerals in the same container,
  // so a tap is never buried under the heartbeat it interrupted.
  const tallies = createTallies(app.renderer)
  numerals.addChildAt(tallies.container, 0)

  // --- frame loop --------------------------------------------------------

  let lastFrame = performance.now()
  let dollyFired = false
  /** Last consumed §7.7.2 spawn, so one hire produces one arrival. */
  let lastSpawnId = 0
  let hireShake = 0
  /** Last consumed §10.8a ship, so one ship produces one camera punch. */
  let lastShipId = 0
  let shipShake = 0
  /** §20.7.4 fires once per run; a Paradigm Shift clears `massHired` and this. */
  let musicCollapsed = false
  const music = new MusicBus()
  // Not awaited. A missing stem set — which is every stem, until §20.7.6's
  // paid-plan blocker clears — must not hold up the first frame, and the bus
  // is silent rather than absent until its buffers arrive.
  void music.init()
  let devsBefore = getState().devs

  app.ticker.add(() => {
    const now = performance.now()
    const rawFrameMs = now - lastFrame
    const dt = Math.min(0.1, rawFrameMs / 1000)
    lastFrame = now
    frames.sample(rawFrameMs)

    tick(dt)

    const state = getState()

    // §10.7a.1 — a scene pushes to Desk zoom on the way in and returns to where
    // the player was on the way out. Driven off the store's scene id, so the
    // dialogue box needs no knowledge of the camera and a scene can never leave
    // the player somewhere they did not choose to be.
    if (state.scene && savedSceneCamera === null) {
      savedSceneCamera = { z: camera.z, panX: pan.x, panY: pan.y }
      dollyTarget = zAtRung(0)
    } else if (!state.scene && savedSceneCamera !== null) {
      camera.set(savedSceneCamera.z)
      pan.x = savedSceneCamera.panX
      pan.y = savedSceneCamera.panY
      savedSceneCamera = null
      dialogueFocus = null
      room.setSpeaker(-1)
    }

    // §21 Act IV: "a heavy bass-drop THUD shakes the screen as the camera
    // violently zooms out to Level 2." Driven here rather than by the store,
    // because the camera is the renderer's business — the store just says the
    // swarm arrived.
    // §20.7.4 — the one scripted override. Fires once, on the frame the trap
    // springs, and the bus owns the three beats from there.
    if (state.massHired && !musicCollapsed) {
      musicCollapsed = true
      music.triggerActIV()
    }
    if (state.massHired && !dollyFired) {
      dollyFired = true
      // §21 Act IV — "the camera violently zooms out to Level 2", which is the
      // *floor*. This was a hardcoded 0.35, written when Z was four uneven
      // bands; under §7.4a's ladder 0.35 is rung 3.15, so the trap sprang and
      // the camera pulled back to a one-storey tower instead of to the floor
      // the thousand developers had just landed on. A regression introduced by
      // the ladder and invisible until somebody watched Act IV.
      dollyTarget = zAtRung(2)
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
      // §20.7.4 is once per run, and a Paradigm Shift starts a new one. Without
      // this the score would stay collapsed for every subsequent run — four
      // minutes of Act I under a stem written for a seized studio.
      musicCollapsed = false
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
      // §7.7.2 — the seats this hire actually took, not §7.7.3's ratio-scaled
      // body count. Handing the weight to something that lands on *seats* is
      // what dropped a stranger onto the founder on every early hire; see the
      // header of arrivals.ts. Clamped to the room's cap, because above it the
      // unit on screen stops being a person and the spectacle belongs to the
      // floor tier.
      const from = Math.min(state.spawn.from, ROOM_DEV_CAP)
      const to = Math.min(state.spawn.to, ROOM_DEV_CAP)
      // **Not** gated on `first`, unlike the camera reveal below. A spawn event
      // is only ever published by a real hire — `jumpToPhase`, `loadGame` and
      // `?devs=` all leave it null — so the "first observed event" is the
      // player's first hire of the session, and skipping it meant the very
      // first developer anybody hires appeared with no animation at all.
      arrivals.spawn(from, to, state.runSeed, now)
      // A hire that buys a whole new register of the lens is a reveal, not a
      // hire. Kick the camera out to show what just opened up. Skipped on the
      // first observed event, which may be a jumped-to phase rather than a
      // hire the player made.
      // §20.7.2 — a rung promotion gets a stinger. One-shot, in key, landing
      // on the beat; the mix underneath it never changes.
      if (!first && state.spawn.promotedTo !== null) void music.playStinger('sting-promotion')
      if (!first && zoomCeilingLifted(devsBefore, state.devs)) {
        dollyTarget = maxZoomFor(state.devs)
        playSfx('zoom-out')
      }
    }
    devsBefore = state.devs
    arrivals.update(now)
    hireShake = Math.max(hireShake, arrivals.consumeImpact())

    // §10.8a — the launch. A ship lands one camera punch, consumed once like
    // the spawn above; the DOM flash and the toast own the rest of the beat.
    // The kick decays in the shake sum below.
    if (state.ship && state.ship.id !== lastShipId) {
      lastShipId = state.ship.id
      shipShake = 1
    }

    // §20.7.3 — the score is a mix, not a playlist. Driven every frame from
    // the same camera Z the picture uses and the same Entropy the readout
    // does, so picture, ambience and music change register on the same frame.
    // Costs a handful of gain writes; `update` skips any that have not moved.
    music.update(camera.z, currentEntropy(state))

    // §7.8.3 — everybody types. Cheap: one sine per visible developer.
    // §7.8.6 — and some of them get up. Entropy drives the rate, so the floor
    // gets visibly busier as the studio gets worse at its job: the §4.1 curve
    // told in behaviour rather than in a number.
    // §10.7a.3 — and while a scene is up the floor holds its breath: `tick`
    // stops the numbers and the frozen room stops the bodies, so the picture
    // and the ledger agree about time being stopped.
    room.animate(now / 1000, state.dev.state, dt, currentEntropy(state), state.scene !== null)

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
    room.setSelected(state.selected ?? -1)
    // §7.7.2 — a seat is withheld until its arrival has landed. Without this
    // the room draws the hire on the frame the store publishes them and the
    // falling silhouette lands on somebody already sitting in the chair, which
    // is most of why a hire read as a glitch.
    room.setHeadcount(Math.min(state.devs, arrivals.revealed))
    // §21 Act IV only. The particle swarm is no longer a ladder stop — the room
    // draws the people at every rung where a person is a person — so it shows
    // nobody unless the trap has sprung and there is a thousand-body drop to
    // stage. See scene.ts.
    floor.setPopulation(collapse.active ? state.devs : 0)
    // §7.4a — **all of them, every frame.** These used to be mutually exclusive,
    // chosen by headcount, and that was the bug: a studio of three million was
    // *only ever* a sprawl, so the tower and the block it was built out of could
    // not be looked at. Each is now fed the same headcount and answers for its
    // own rung — three million is three towns, or thirty campuses, or three
    // hundred buildings saturating at ten. The camera picks which is true today.
    tower.setHeadcount(state.devs)
    for (const r of [4, 5, 6] as const) {
      city[r].setHeadcount(state.devs)
      city[r].update(now)
    }
    tower.update(now)

    // §7.4a — the cross-fade is per *rung* now, not per tier. Weights come from
    // where the camera is on the ladder, and the studio's own rung gates what
    // may light up at all: the ceiling stops the camera short of an unearned
    // rung, but the fade reaches one rung past wherever it is parked, so
    // without the gate the campus the player has not built ghosts in behind the
    // block they have.
    const studioRung = rungFor(state.devs).rung
    const weights = earnedViewWeights(camera.z, studioRung)
    const view = dominantView(camera.z)
    for (const spec of VIEWS) {
      const container = views[spec.view]
      container.alpha = weights[spec.view]
      // Culling the invisible views is what keeps the criterion-3 dolly
      // affordable: without it the 1,000-particle floor is submitted every
      // frame even at galactic zoom.
      container.renderable = weights[spec.view] > 0.002
      // Only the visible ones need their transform recomputed.
      if (container.renderable) {
        const fitViewport = viewportForView(spec.view, viewport)
        const scale = fitScale(scene.extentOf(spec.view), fitViewport, camera.z, viewStopZ(spec.view))
        container.scale.set(scale)
        // The room's folded fit is already composed around the founder at its
        // north vertex. Other views remain truly centred as well.
        container.position.set(
          0,
          spec.view === 'room' ? -roomHudBiasY(viewport.h) : 0,
        )
      }
    }

    // §7.7.6 — pan. Limits come from how far the dominant view overhangs the
    // frame, so a view that already fits does not slide around: panning
    // something that fits is how a player ends up lost in an empty frame.
    const domExtent = scene.extentOf(view)
    const domScale = fitScale(domExtent, viewportForView(view, viewport), camera.z, viewStopZ(view))
    currentView = view
    currentScale = domScale

    // §7.7.6 — hold the focal point still while the scale changes underneath
    // it. A view-local point q sits at `centre + pan + q·scale`, so keeping q
    // fixed across a scale change is one subtraction per axis. Skipped across a
    // change of view, where the two scales are not measuring the same object
    // and the correction would be a lurch rather than an anchor.
    if (focal && lastScale > 0 && view === lastScaleView && domScale !== lastScale) {
      const qx = (focal.x - (viewport.w / 2 + pan.x)) / lastScale
      const qy = (focal.y - (viewport.h / 2 + pan.y)) / lastScale
      pan.x += qx * (lastScale - domScale)
      pan.y += qy * (lastScale - domScale)
    }
    lastScale = domScale
    lastScaleView = view

    // §7.7.6b — the mode owns the hand, so leaving GRAB puts down whoever is in
    // it. Without this a developer is left stranded in mid-air by a button
    // press on the other side of the screen, following a finger that is no
    // longer allowed to be carrying them. `drop(null)` is §7.8.9's escape:
    // they walk back to their desk, unhurried, rather than teleporting.
    //
    // Zooming out of the room does the same thing, and for the same reason —
    // there is no hand at rung 3.
    if (carryId >= 0 && tapVerb(state.touchMode, view === 'room') !== 'grab') {
      room.hands.drop(null)
      carryId = -1
    }

    limitX = panLimit(domExtent.w * domScale, viewport.w)
    limitY = panLimit(domExtent.h * domScale, viewport.h)
    if (founderFocus && view === 'room') {
      const at = room.founderDeskAt()
      const roomView = views.room
      const targetX = Math.min(
        limitX,
        Math.max(-limitX, -((at.x - roomView.pivot.x) * domScale + roomView.position.x)),
      )
      const targetY = Math.min(
        limitY,
        Math.max(-limitY, -((at.y - roomView.pivot.y) * domScale + roomView.position.y)),
      )
      const move = Math.min(1, dt * 6.5)
      pan.x += (targetX - pan.x) * move
      pan.y += (targetY - pan.y) * move
      pan.vx = 0
      pan.vy = 0
      if (camera.z < 0.002 && Math.hypot(targetX - pan.x, targetY - pan.y) < 0.8) {
        founderFocus = false
      }
    }

    // §10.7a.1 — the same lerp, aimed at whoever is speaking. It runs for the
    // whole scene, re-aiming on every line: the ~15% of screen width that says
    // *this one is talking*, never a whip, and the speaker is already in frame.
    //
    // `deskFor` rather than `deskAt`: a seat's *place* exists before the seat
    // is drawn. During James's §21.7.1 drop the room withholds his desk until
    // the arrival lands, so `deskAt(0)` is null for the whole fall — and the
    // camera has to be able to point at the empty space he is about to land in.
    if (dialogueFocus !== null && view === 'room') {
      const at = dialogueFocus === 'founder' ? room.founderDeskAt() : room.deskFor(dialogueFocus)
      if (at) {
        const roomView = views.room
        const targetX = Math.min(
          limitX,
          Math.max(-limitX, -((at.x - roomView.pivot.x) * domScale + roomView.position.x)),
        )
        const targetY = Math.min(
          limitY,
          Math.max(-limitY, -((at.y - roomView.pivot.y) * domScale + roomView.position.y)),
        )
        const move = Math.min(1, dt * 6.5)
        pan.x += (targetX - pan.x) * move
        pan.y += (targetY - pan.y) * move
        pan.vx = 0
        pan.vy = 0
      }
    }
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
    // Every hire has a small physical landing. Batch size increases the
    // impulse logarithmically, so a thousand hires feel larger without moving
    // the camera a thousand times farther than one hire.
    const hireAmp = hireShake * (reduceMotion ? 1.2 : 4.5)
    const hireX = Math.sin(now * 0.31) * hireAmp
    const hireY = Math.cos(now * 0.43) * hireAmp * 0.65
    // §10.8a — the ship's camera punch rides the same glass, a single damped
    // kick rather than the hire's continuous wobble. Faster and shorter, so a
    // launch reads as a thump, not as more arrivals.
    const shipAmp = shipShake * (reduceMotion ? 1.5 : 7)
    const shipX = Math.sin(now * 0.9) * shipAmp
    const shipY = Math.cos(now * 1.1) * shipAmp * 0.7
    glass.position.set(shake.x + hireX + shipX, shake.y + hireY + shipY)
    hireShake *= Math.exp(-dt * 12)
    shipShake *= Math.exp(-dt * 10)

    // §8.2b — the passive `+1`s over each head.
    //
    // Only at the two rungs where one sprite is one person: above them the unit
    // on screen is a floor or a building, and "+1 over each head" has no head
    // to sit over. That is a scope rather than a gap — §8.2b's thinning rule
    // aggregates *within* a floor of people, and the rung above it is already
    // the aggregate.
    if (currentView === 'room') {
      const seats = roomSeats()
      const drawn = room.drawn
      // §4.9a — each seat's share of the studio, so the numerals differ by as
      // much as the people do. The shares sum to the headcount, so the numerals
      // on screen add up to the velocity in the readout.
      //
      // **Asked of the store rather than reconstructed here**, and after R14
      // that is load-bearing rather than tidiness. This used to be
      // `currentVelocity / devs * developerShare(i)`, which was the same number
      // until §4.5a's buffs existed — a buff raises `currentVelocity`, so the
      // hand-rolled version spreads one poked developer's lift evenly over
      // every head on the floor. §4.5c requires the opposite: "modifiers must be
      // legible on the target, not buried in a panel." `developerVelocity`
      // carries only that seat's own buff, so the numeral over the person you
      // poked is the one that speeds up. Pinned in `pokeBuff.test.ts`.
      const sources = tallySources(seats, drawn, (i) => developerVelocity(i, state))
      const container = views[currentView]
      for (const source of sources) {
        // View-local -> screen. The offset is applied *before* the transform so
        // it is measured in desks rather than in pixels: the numeral sits over
        // the head at every zoom instead of drifting off it as the room grows.
        //
        // Clear of the monitor as well as the head. §8.2b says "over the
        // person, not under the thumb", and at 16 it sat across the screen the
        // person is typing at — technically above the desk and reading as part
        // of the furniture.
        const at = container.toGlobal({ x: source.x, y: source.y - 30 })
        source.x = at.x
        source.y = at.y
      }
      tallies.update(now, dt, sources)
    } else {
      tallies.update(now, dt, NO_TALLIES)
    }

    // Each paired numeral/snippet callout arcs up and fades over one second.
    const live = new Set<number>()
    for (const f of state.floaters) {
      live.add(f.id)
      let g = numeralGfx.get(f.id)
      if (!g) {
        // The real numeral and the §8.2a code line. This was a plain rectangle
        // during the spike, on the reasoning that text belongs in React — that
        // holds for the HUD and not for this, which is scenery under the glass.
        g = typeset.build(f.sp, f.crit, f.snippet, f.unblocked, f.id - 1)
        numerals.addChild(g)
        numeralGfx.set(f.id, g)
      }
      // §8.2a — the snippet is a *joke*, and a joke has to be finished being
      // read. At 900 ms fading linearly from the first frame it was gone before
      // it registered: the numeral is a number and reads instantly, but
      // `while (true) { }` is four words and needs about a second of full
      // opacity before it starts leaving.
      const age = (now - f.bornAt) / FLOATER_LIFE_MS
      g.position.set(f.x, f.y - age * 58)
      g.alpha = Math.max(0, Math.min(1, (1 - age) / FLOATER_FADE))
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
        // §7.4a — the two numbers that used to be one. `rung` is where the
        // camera is on the Construction Ladder and `view` is what that makes it
        // a picture of; `level` is only which tier's geometry is behind it.
        // Reading them apart is the difference between "the camera skipped the
        // city" and "the city is not drawing".
        rung: +rungAt(camera.z).toFixed(2),
        view,
        ceilingRung: rungFor(state.devs).rung,
        scale: +domScale.toFixed(5),
        // What the dominant view actually measures on screen, in CSS px. This
        // is the number GDD §23.4.1 exists to make non-zero, so it is the one
        // worth being able to read without a screenshot.
        tierPx: `${Math.round(domExtent.w * domScale)}x${Math.round(domExtent.h * domScale)}`,
        fillShortAxis: +Math.max(
          (domExtent.w * domScale) / app.screen.width,
          (domExtent.h * domScale) / app.screen.height,
        ).toFixed(3),
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
    focusFounder() {
      focusFounderCamera()
    },
    focusDialogue(focus) {
      focusDialogue(focus)
    },
    codeFounder() {
      return codeAtFounderDesk(undefined, true)
    },
    setFounderInspect(handler: (() => void) | null) {
      founderInspect = handler
    },
    setFounderProfile(profile: FounderProfile) {
      room.setFounderProfile(profile)
    },
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
      tallies.destroy()
      void music.unload()
      typeset.destroy()
      post.destroy()
      app.destroy(true, { children: true })
    },
  }
}
