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
  cancelPosting,
  currentEntropy,
  developerVelocity,
  FLOATER_LIFE_MS,
  getState,
  heroCoverageOf,
  heroRoster,
  poke,
  pokeFounder,
  postHeroAt,
  selectDeveloper,
  setCameraRung,
  setZoom,
  tick,
  type GameState,
  type PokeTarget,
} from '../game/store.ts'
import { playKeyboardClick, pokeSfxForZoom, playSfx } from '../audio/sfx.ts'
import { playUi } from '../ui/uiSfx.ts'
import { MusicBus } from '../audio/music.ts'
import { holdHaptic, pokeHaptic } from '../audio/haptics.ts'
import { Lens, settleLevel } from './lens.ts'
import {
  BUILDING,
  DESK,
  DEVS_PER_FLOOR,
  FLOOR,
  LEVEL_NAMES,
  SQUAD,
  buildingChromeAlpha,
  descendOnDoubleTap,
  floorScaleAt,
  floorSeatRect,
  roomResolved,
  seatOfSquad,
  seatOfStorey,
  squadAtFloor,
  squadOf,
  storeyAtBuilding,
  storeyOf,
  storeysFor,
  type Level,
} from './frames.ts'
import { ALL_PASSES, createPostProcess, type PassName } from './postProcess.ts'
import { buildScene } from './scene.ts'
import { LITERAL_RUNG_LIMIT, maxZoomFor, rungFor, zoomCeilingLifted } from '../sim/headcount.ts'
import { branchColour } from '../sim/heroTree.ts'
import { roomSeatMarks, type RoomPosting, type SeatMark } from './heroBadges.ts'
import { createCollapse } from './collapse.ts'
import { createPokeTypeset } from './pokeText.ts'
import {
  capForLevel,
  createTallies,
  sourceWindow,
  spanForLevel,
  tallySources,
  type TallySource,
} from './tallies.ts'
import { createArrivals } from './arrivals.ts'
import { ROOM_DEV_CAP } from './room.ts'
import { exceedsSlop, pickNearest } from './navigation.ts'
import { tapVerb } from '../game/touchMode.ts'
import { FrameSampler, LatencySampler } from '../perf/metrics.ts'
import type { BenchHooks } from '../perf/bench.ts'
import type { FounderProfile } from '../game/founderProfile.ts'

/** What the HUD needs to draw the breadcrumb and the lift panel. */
export interface NavState {
  /** Continuous position on the ladder, 0 desk to 3 building. */
  level: number
  /** The level it would settle on, and the word for it. */
  at: Level
  name: string
  /** The address, unpacked. */
  storey: number
  squad: number
  seat: number
  /** How many storeys the headcount has built, and how full each one is. */
  storeys: number
  /** The storey named but not yet entered, or −1. */
  selected: number
  /** Developers on each built storey, ground floor first. */
  occupancy: number[]
}

export interface StageHandle {
  /** Rolling frame time in ms, for the GDD §23.3 overlay. */
  readonly frameMs: number
  /** p95 tap -> numeral latency in ms. Criterion 1's threshold is 80 ms. */
  readonly latencyP95: number
  readonly camera: Lens
  /**
   * Where the lens is, for §10's breadcrumb and lift panel.
   *
   * Sampled by React rather than pushed, in the same family as the scenario
   * bar's two readouts: the camera is not in the store and does not notify, and
   * a subscription for something a component already re-renders ten times a
   * second is machinery with nothing to buy.
   */
  nav(): NavState
  /** Go into a storey — the lift panel, and the second tap on a floor. */
  enterFloor(storey: number): void
  /** Go to a level of the ladder — the breadcrumb. */
  goToLevel(level: Level): void
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

/**
 * The smallest §4.5d's "tap yourself" may measure on screen, as a radius.
 *
 * §23.4.2's design box wants a 44 px target; this is half of it, applied to the
 * founder's own hit box so the one person the player is guaranteed to look for
 * is findable at every level of the §7.4 ladder rather than only at the two
 * where their desk happens to be large.
 */
const FOUNDER_TOUCH_PX = 22

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

/** Shared empty list, so a level with no heads does not allocate one per frame. */
const NO_TALLIES: readonly TallySource[] = []

/**
 * §4.5b's rung, from the lens's level.
 *
 * The **simulation keeps its ladder** and only the camera changed, which is
 * what makes this rewrite affordable: `sim/units.ts`, `sim/poke.ts`,
 * `sim/headcount.ts` and the store all still speak in §7.7.1's rungs, and the
 * four levels this scope draws are its first four. A tap at the building level
 * therefore still resolves through `unitSeats(3, storey, devs)` and still
 * covers exactly the thousand seats that storey holds.
 */
const rungOfLevel = (level: number): number => settleLevel(level)

/**
 * The §7.4 tier a level sounds like — §8.2's poke sounds and §20.2's zones.
 *
 * Three where there were four. The cosmic tier went with the rungs above the
 * building, and giving the building a tier of its own rather than folding it
 * into the floor's keeps the §20.2 register change on a level boundary.
 */
const tierOfLevel = (level: number): 1 | 2 | 3 =>
  level < SQUAD + 0.5 ? 1 : level < FLOOR + 0.5 ? 2 : 3

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
  const { floor, room, building } = scene
  // **One object in the world, and the room is inside it.** There is no
  // far-to-near list of views any more because there are no longer several
  // pictures of the same studio to order: the building holds ten plates, one
  // plate holds the room, and depth is the scene graph's own business.
  world.addChild(building.container)

  // §21 Act IV. Its overlay goes inside the glass, above the world and below
  // the numerals — the badges and chatter are scenery and must never bury the
  // one piece of feedback the clicker layer depends on (GDD §8.2).
  const collapse = createCollapse({ renderer: app.renderer, floor, reduceMotion })
  glass.addChild(collapse.overlay)

  // §7.7.2 — hires arrive on screen. Parented into the room so they share its
  // transform, and land in room-local coordinates.
  const arrivals = createArrivals()
  room.container.addChild(arrivals.layer)

  const camera = new Lens({ w: app.screen.width, h: app.screen.height })

  /**
   * §13.11.1 — who covers which seat, at four hertz.
   *
   * Throttled rather than driven by a change signal, and that is the honest
   * trade rather than the lazy one. Two of the three inputs announce themselves
   * (`heroPlacements` is a fresh object on every placement, `devs` is a number),
   * but the third is **time**: §13.8 rule 4's settling period ends on a clock
   * nobody publishes an event for, and a footprint that waited for the next
   * placement to appear would arrive minutes after the hero it belongs to
   * finished walking.
   *
   * Four hertz against a twenty-second settle is invisible, and `setCoverage`
   * throws away the result unless the marks actually moved, so the cost of the
   * poll is six objects and a short string a quarter of a second — not a
   * redraw. §23.3's frame budget never sees it.
   */
  const COVERAGE_HZ = 4
  let marksAt = Number.NEGATIVE_INFINITY
  let marks: ReadonlyMap<number, SeatMark> = new Map()
  const seatMarks = (state: GameState): ReadonlyMap<number, SeatMark> => {
    const now = performance.now()
    if (now - marksAt < 1000 / COVERAGE_HZ) return marks
    marksAt = now

    const postings: RoomPosting[] = []
    for (const hero of heroRoster(state)) {
      const at = hero.placement
      // Rungs 0–2 only: above the room a unit is a floor or a town and the
      // decal belongs on *its* face, which is §13.11.1's badge and is not built.
      // The store charges for the coverage either way — this is the picture
      // being behind the simulation, which is the right way round.
      if (!at || at.rung > LITERAL_RUNG_LIMIT) continue
      postings.push({
        branch: hero.branch,
        colour: branchColour(hero.branch),
        index: at.index,
        reachDevs: hero.reachDevs,
        settling: heroCoverageOf(hero, state).settling,
      })
    }

    // §26.2.2 — the marks come back in the studio's numbering and the room
    // draws its own chairs, so a window that is not at seat zero has to shift
    // them and drop the ones that fall outside it. A hero covering a block on
    // the other side of the company is covering it; they are simply not in
    // this picture, which is what "on demand" means.
    const studio = roomSeatMarks(postings, state.devs)
    if (room.seatWindow === 0) {
      marks = studio
      return marks
    }
    const windowed = new Map<number, SeatMark>()
    for (const [seat, mark] of studio) {
      const local = localSeat(seat)
      if (local >= 0) windowed.set(local, mark)
    }
    marks = windowed
    return marks
  }

  /**
   * The view the camera is looking at, and the scale it is drawn at.
   *
   * Published out of the ticker because the hit test, the pan limits and the
   * selection all have to agree with what was last *drawn* — deriving each of
   * them from the camera independently is three chances to disagree by a frame,
   * and the one that shows is the poke landing on the wrong developer.
   */
  let currentLevel: number = BUILDING
  /** Effective scale of floor space — what every level-of-detail rule reads. */
  let currentFloorScale = 0
  /** True while the room is drawing real people rather than the plate a plan. */
  let roomIsUp = false

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
    // Only where the room is actually drawing people. Below that the plate is
    // showing a plan, and the right answer to "who is under the thumb" is
    // nobody — the same rule as before, asked of the level of detail rather
    // than of a view name.
    if (!roomIsUp) return -1
    if (!(currentFloorScale > 0)) return -1

    // Screen -> room-local, **through the plate the room is parented in.**
    // Pixi composes the whole chain, so this one call already undoes the
    // camera, the plate's position and `PLATE_SCALE` — which is the payoff for
    // the room being inside the building rather than beside it.
    const local = room.container.toLocal({ x, y })
    const seats = roomSeats()
    // A generous radius: a fingertip is about 9 mm and the desks are small.
    // Scaled into room space so it stays a thumb-sized target at any zoom.
    return pickNearest(seats, local.x, local.y, 26 / Math.max(0.05, currentFloorScale) + 14)
  }

  /**
   * Screen point -> the storey under it, or −1 — the building's own hit test.
   *
   * Asked of the geometry rather than of a screen offset, so "which floor did I
   * tap" is answered by the same function the stack is drawn from. The camera's
   * inverse is one call because the whole world is one transform now.
   */
  const pickStorey = (x: number, y: number): number => {
    const w = camera.toWorld(x, y)
    return storeyAtBuilding(w.x, w.y, storeysFor(getState().devs), storeyOf(focusSeat))
  }

  /** Screen point -> the squad under it, or −1. Floor space, through the plate. */
  const pickSquad = (x: number, y: number): number => {
    const local = room.container.toLocal({ x, y })
    return squadAtFloor(local.x, local.y)
  }

  /**
   * Screen point -> the §7.7.1 unit under it, or null — GDD §4.5b, R15.
   *
   * §4.5b: a tap lands on "whatever unit §7.7.1 says the camera is currently
   * holding", and the buff applies to everything inside it. The **simulation's
   * rungs are unchanged** — a person at rungs 0–2, a floor at rung 3 — so this
   * asks the level what is under the thumb and hands `sim/units.ts` a rung and
   * a global index exactly as it did before.
   */
  const pickUnit = (x: number, y: number): PokeTarget | null => {
    const rung = rungOfLevel(currentLevel)
    if (rung >= FLOOR + 1) {
      // The building. A slot is a storey, and a storey is `unitSeats(3, f)` —
      // exactly the thousand seats that floor holds.
      const storey = pickStorey(x, y)
      return storey < 0 ? null : { rung: 3, index: storey }
    }
    // Rungs 0–2 — one sprite is one person, and empty floor is a miss. Answered
    // in the studio's numbering, because a `PokeTarget` goes to the store and
    // the store has never heard of a window.
    const seat = pickDeveloper(x, y)
    return seat < 0 ? null : { rung, index: globalSeat(seat) }
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
  /**
   * Room-local seat -> the studio's own seat number, and back — §26.2.2.
   *
   * The room draws a *window* of the studio now, so its local index 0 is the
   * studio's seat `room.seatWindow`. Everything outside this file speaks the
   * studio's numbering — the store's `selected`, a hero's coverage, a spawn,
   * §4.9a's shares — and everything inside the room speaks its own.
   *
   * **The conversion is here rather than in the room** because the room is the
   * thing that does not know what a studio is; it draws a thousand chairs and
   * whoever is in them. Putting the offset on its side would have meant every
   * one of its methods taking a number in a different space from the geometry
   * underneath it, which is trap 38's shape — one picture, two coordinate
   * systems, agreeing only where the offset happens to be zero.
   */
  const globalSeat = (local: number) => (local < 0 ? -1 : room.seatWindow + local)
  const localSeat = (seat: number) => {
    if (!(seat >= 0)) return -1
    const i = Math.floor(seat) - room.seatWindow
    return i >= 0 && i < room.drawn ? i : -1
  }

  const roomSeats = () => {
    if (seatCacheFor !== room.drawn) {
      seatCache = Array.from({ length: room.drawn }, (_, i) => room.deskAt(i)!)
      seatCacheFor = room.drawn
    }
    return seatCache
  }

  const founderHit = (x: number, y: number): 'avatar' | 'desk' | null => {
    if (!roomIsUp || !(currentFloorScale > 0)) return null
    const local = room.container.toLocal({ x, y })
    const at = room.founderDeskAt()
    /*
     * **A thumb's worth of screen, whatever the zoom.**
     *
     * `reach` is in room-local units, and the old `10/s + 4` came out at a
     * constant ten *screen* pixels — so §4.5d's "tap yourself" was a twenty-one
     * pixel target at every level of the ladder, on a floor of a thousand
     * people, next to nine hundred and ninety-nine other desks. §23.4.2's
     * design box asks for forty-four, and this is the one target in the game
     * the player is guaranteed to want and cannot search for: it is *them*.
     *
     * Found by `test:walk`, which sweeps the frame in 20x28 px steps looking
     * for the founder and simply stepped over them.
     *
     * It stays a *floor* of the reach rather than a replacement, so at Desk
     * zoom — where the workstation is already hundreds of pixels across — the
     * geometry below still owns the hit and this contributes nothing.
     */
    const s = Math.max(0.05, currentFloorScale)
    const reach = Math.max(FOUNDER_TOUCH_PX / s, 10 / s + 4)

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
    if (!roomIsUp) return false
    if (founderHit(x, y)) {
      selectDeveloper(null)
      playUi('click')
      founderInspect?.()
      return true
    }
    const target = pickDeveloper(x, y)
    selectDeveloper(target < 0 ? null : globalSeat(target))
    // §26.2.2 — **inspecting somebody makes them the address.** The room is the
    // bottom of the ladder and a person is the smallest unit on it, so this is
    // how the last three rungs are steered: pick the person, then zoom, and the
    // lens holds them instead of holding the middle of the floor. Without it
    // the descent could name a storey and never anybody in it.
    if (target >= 0) setFocus(globalSeat(target))
    playUi(target < 0 ? 'close' : 'whoosh')
    return true
  }

  /**
   * §13.8's interim placement gesture — the armed tap.
   *
   * Checked before every other verb and before the double-tap descend, because
   * while somebody is armed **the finger means one thing only**. That is the
   * §7.7.6b rule the touch latches are built on, applied to a mode the player
   * entered from a hero's card one tap ago: a placement that also poked, or
   * that also flew the camera down a rung, would be the mode reaching past what
   * the banner says it does.
   *
   * A tap on open ground disarms rather than doing nothing, so there is a way
   * out that does not need the CANCEL button to be under a thumb.
   */
  const doPost = (x: number, y: number): void => {
    const target = pickUnit(x, y)
    if (!target) {
      cancelPosting()
      playUi('close')
      return
    }
    if (postHeroAt(target)) {
      if (roomIsUp) room.jolt(localSeat(target.index))
      playSfx('poke-floor')
    } else {
      playUi('close')
    }
  }

  const doPoke = (x: number, y: number, t0: number) => {
    const founderTarget = founderHit(x, y)
    // The selected tool means the same thing on every person. CODE on the
    // founder codes; INFO (handled by doSelect) opens the profile. The old
    // avatar-only exception made players learn two meanings for one tap.
    if (founderTarget === 'avatar' || founderTarget === 'desk') {
      // The finger is on them; there is nowhere to fly to. See the note there.
      codeAtFounderDesk({ t0, sound: true, take: false })
      return
    }

    // §4.5b — what was actually poked. Null means the tap landed on empty
    // floor, open ground or sky, which is a miss rather than a free point:
    // §7.7.6 makes the world addressable, and an addressable world has places
    // where nothing is standing.
    const target = pickUnit(x, y)
    if (!target) return
    if (roomIsUp) room.jolt(localSeat(target.index))

    const result = poke(x, y, target)

    // Sound first: criterion 2's budget is the tightest at 60 ms p95.
    const tier = tierOfLevel(currentLevel)
    if (result.crit) playSfx('poke-crit')
    else if (result.sp === 0) playSfx('poke-void')
    else if (tier === 1) playKeyboardClick()
    else playSfx(pokeSfxForZoom(tier))
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

  /** The in-progress drag, or null. */
  let drag: { id: number; x0: number; y0: number; px: number; py: number; t0: number } | null = null
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

  /**
   * §7.7.6 — descending, and why the building does it differently.
   *
   * Below the building a tap is already §8.2's primary verb, so "go in" is the
   * second tap of a **double-tap**: making every poke wait 300 ms to find out
   * whether a second one is coming would put the clicker layer behind a timer,
   * and §23.3 criterion 1 gives that path eighty milliseconds.
   *
   * At the building there is no such contention — the units are ten floors, not
   * a thousand people — so it uses the plainer and far more discoverable form:
   * **tap once to select, tap the selected floor again to enter it.** No timing
   * window, nothing to learn, and a label on screen the whole time saying which
   * floor is named. That is the player's "I need the option to click and choose
   * which floor to go into", answered without a gesture anybody has to be told
   * about.
   */
  const DOUBLE_TAP_MS = 300
  const DOUBLE_TAP_SLOP = 24
  let lastTap = { t: 0, x: 0, y: 0 }

  /** The storey named but not yet entered, or −1. */
  let selectedStorey = -1

  const tapSelectsAFloor = () => settleLevel(currentLevel) === BUILDING
  /** §7.7.6, and it is a rule rather than a level — see `descendOnDoubleTap`. */
  const doubleTapDescends = () => descendOnDoubleTap(settleLevel(currentLevel), getState().devs)

  /**
   * **The address** — which part of the studio the lens is over. GDD §26.2.2.
   *
   * One global seat number, and everything on screen is derived from it: the
   * unit in view at any rung is the one holding this seat, the units *beside*
   * it are that unit's siblings, and the room is a picture of the thousand
   * people in the storey containing it. See `sim/units.ts`'s {@link unitWindow}
   * for why it is a seat and not a path.
   *
   * Before this existed every view was fed the studio's own headcount and drew
   * units 0–9 of it, so the ladder was five unrelated pictures of the studio's
   * first corner: descending into the third town and then the fifth campus gave
   * campus five *of the studio*. Nothing past the tenth unit at any rung had an
   * address at all.
   */
  let focusSeat = 0

  /** Which storey the address is in, and which thousand seats that is. */
  const focusStorey = () => storeyOf(focusSeat)
  const seatWindowFor = () => focusStorey() * DEVS_PER_FLOOR

  /**
   * Move the address, and tell the lens at once.
   *
   * The lens has to know **before** the next `flyTo`, because every frame it
   * names is derived from the address: sending the camera to the squad level
   * with a stale seat aims it at the squad you were in a moment ago, which is
   * exactly the class of bug §26.2.2 exists to close.
   */
  const setFocus = (seat: number) => {
    const next = Math.max(0, Math.floor(seat))
    if (next === focusSeat) return
    focusSeat = next
    camera.setAddress(focusSeat, storeysFor(getState().devs))
  }

  /** The rail's CODE — YOU action owns the lens until the corner desk lands. */
  let founderFocus = false

  /**
   * §10.7a.1 — the dialogue's current speaker, and the camera the scene found
   * itself in. The push to Desk zoom and the per-line re-centre are driven from
   * here; {@link focusDialogue} just says who is talking.
   */
  let savedSceneCamera: { level: Level } | null = null

  const focusFounderCamera = () => {
    founderFocus = true
    focal = null
    camera.flyTo(DESK, room.founderDeskAt())
  }

  /**
   * §10.7a.1 — who is talking, in the world. The camera push itself is handled
   * in the frame loop off the store's scene state; this records the speaker and
   * turns them to face the lens for the duration of their line.
   */
  const focusDialogue = (focus: 'founder' | number | null) => {
    room.setSpeaker(typeof focus === 'number' ? localSeat(focus) : -1)
    // A scene always plays at Desk zoom, so every line that names somebody
    // re-asserts it — and a line with nobody (STUDIO_OS) holds it rather than
    // cutting away.
    if (focus !== null) {
      const at = typeof focus === 'number' ? room.deskFor(localSeat(focus)) : room.founderDeskAt()
      camera.flyTo(DESK, at ?? undefined)
    }
  }

  /**
   * §4.5d — the founder codes at their own desk.
   *
   * `take` is whether this also **takes the camera home**, and the two callers
   * want opposite answers.
   *
   * The rail's CODE button does: §7.7.4 promises the way back to your own desk
   * is always one control away, and it has to work from a floor you are not on.
   * That is the whole reason the button exists.
   *
   * A tap **on the founder, in the world**, does not — the finger is already on
   * them. Flying to somebody who is under the thumb can only take the picture
   * away from where the player was looking, and it takes the *person* with it:
   * the lens walks the corner desk toward the middle of the frame, so the next
   * tap of a studio whose entire script is TAP TO CODE lands on empty floor.
   *
   * `test:walk` found that and worked around it rather than reporting it — see
   * `pokeAt`, which learned to re-find the founder after every tap because
   * fifty pokes at a fixed point were arriving as seven. **A gate that
   * accommodates a defect hides it**, and this one hid it for as long as it
   * took a player to say "clicking one of us to code, it should not zoom to the
   * person".
   */
  const codeAtFounderDesk = ({
    t0,
    sound = false,
    take = true,
  }: { t0?: number; sound?: boolean; take?: boolean } = {}): number => {
    const local = room.founderDeskAt()
    const at = room.container.toGlobal({ x: local.x, y: local.y - 30 })
    const paid = pokeFounder(at.x, at.y)
    if (paid <= 0) return 0

    if (take) focusFounderCamera()
    room.joltFounder()
    if (sound) playKeyboardClick()
    if (t0 !== undefined) {
      requestAnimationFrame(() => tapLatency.push(performance.now() - t0))
    }
    return paid
  }

  /**
   * Go into a storey — the second tap on a selected floor, and the lift panel.
   *
   * **Descending names a unit, and everything below becomes a picture of what
   * is inside it** (§26.2.2). The address moves first, so the frame the lens
   * flies to is the frame of the floor that was tapped rather than of the one
   * it was already over.
   */
  const enterStorey = (storey: number): boolean => {
    const n = storeysFor(getState().devs)
    if (!(storey >= 0) || storey >= n) return false
    setFocus(seatOfStorey(storey))
    selectedStorey = storey
    focal = null
    camera.flyTo(FLOOR)
    playUi('whoosh')
    return true
  }

  /**
   * §7.7.6 — descend one level, centred on what was tapped.
   *
   * One level, never "all the way in". The complaint the whole ladder exists to
   * answer is precisely that the lens *skipped*, and a control that jumps three
   * levels inward to fix one that jumped three outward is the same bug facing
   * the other way.
   */
  const descendOne = (x: number, y: number): boolean => {
    const level = settleLevel(currentLevel)
    if (level <= DESK) return false
    focal = { x, y }

    if (level === BUILDING) return enterStorey(pickStorey(x, y))

    if (level === FLOOR) {
      const squad = pickSquad(x, y)
      if (squad < 0) return false
      setFocus(seatOfSquad(focusStorey(), squad))
      camera.flyTo(SQUAD)
      playUi('whoosh')
      return true
    }

    // Squad -> desk. The person under the finger becomes the address, which is
    // how the last level is steered: pick somebody, then go in, and the lens
    // holds them rather than the middle of the pod.
    const seat = pickDeveloper(x, y)
    if (seat < 0) return false
    setFocus(globalSeat(seat))
    camera.flyTo(DESK)
    playUi('whoosh')
    return true
  }

  /**
   * §7.8.9 — screen coordinates to room-local, for carrying somebody.
   *
   * The tier's pivot is baked into its own transform, so `toLocal` is both
   * shorter and safer than re-deriving the camera's arithmetic here.
   */
  const toRoom = (x: number, y: number) => room.container.toLocal({ x, y })

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
    if (!roomIsUp) return false
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
      // The armed placement outranks GRAB on the press for the same reason it
      // outranks every verb on the release: a hand that picked somebody up
      // would eat the tap the banner has just asked the player for.
      if (
        getState().posting === null &&
        tapVerb(getState().touchMode, roomIsUp) === 'grab'
      ) {
        if (tryGrab(ev.clientX, ev.clientY, ev.pointerId)) return
      }
      drag = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, px: ev.clientX, py: ev.clientY, t0: t }
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
    // Incremental, because the lens clamps to its own bounds every frame and a
    // drag rebuilt from its origin would keep pushing against a wall it has
    // already hit and then jump when the finger came back.
    camera.panBy(ev.clientX - drag.px, ev.clientY - drag.py, t)
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

    if (travelled) return

    if (getState().posting !== null) {
      doPost(ev.clientX, ev.clientY)
      return
    }

    // **The building's two taps.** Select a floor, then enter it — no timing
    // window, and a label on screen naming the selection the whole time. The
    // first tap still pokes the storey, which is §4.5b's unit poke and is the
    // same thing the tap would have done anyway.
    if (tapSelectsAFloor()) {
      const storey = pickStorey(ev.clientX, ev.clientY)
      if (storey < 0) {
        selectedStorey = -1
        playUi('close')
        return
      }
      if (storey === selectedStorey) {
        enterStorey(storey)
        return
      }
      selectedStorey = storey
      setFocus(seatOfStorey(storey))
      playUi('click')
      doPoke(ev.clientX, ev.clientY, t)
      return
    }

    if (doubleTapDescends()) {
      const near = Math.hypot(ev.clientX - lastTap.x, ev.clientY - lastTap.y) <= DOUBLE_TAP_SLOP
      if (near && t - lastTap.t < DOUBLE_TAP_MS) {
        lastTap = { t: 0, x: 0, y: 0 }
        descendOne(ev.clientX, ev.clientY)
        return
      }
      lastTap = { t, x: ev.clientX, y: ev.clientY }
    }

    switch (tapVerb(getState().touchMode, roomIsUp)) {
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
  let pinchStart: { distance: number; scale: number } | null = null

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
      pinchStart = { distance, scale: camera.scale }
      return
    }

    // **The pinch is now a ratio of scales, not a mapping through Z.** Two
    // fingers moving apart by a factor of two make the world twice as big, at
    // every level, which is the one thing a pinch is allowed to mean. Anchored
    // at the point between the fingers so the thing being pinched stays under
    // them.
    const ratio = distance / pinchStart.distance
    if (!(ratio > 0) || !Number.isFinite(ratio)) return
    camera.zoomBy((pinchStart.scale * ratio) / camera.scale, focal, now)
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
    // Exponential in the delta, so one notch is one constant *proportion* of
    // the scale wherever the camera happens to be. The magnetic stop then
    // catches whatever the last notch left behind.
    camera.zoomBy(Math.exp(-ev.deltaY * 0.0016), focal, ev.timeStamp || performance.now())
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

  /**
   * `?speed=40` runs the simulation's clock forty times faster — **and nothing
   * else.** Same family as `?act`, `?devs` and `?select`, and here for the
   * reason §26.1.8 gives: its gate lines are things a player does, in order,
   * without leaving the game, and §21 paces Run 1 at four minutes with Run 2's
   * climb to the cap longer again — three careers of that is most of a morning.
   * A walk nobody can afford to run is a walk that goes stale, which is exactly
   * how items 2a and 11 sat false for weeks.
   *
   * **Repeated whole ticks, never a bigger `dt`.** Multiplying `dt` would be a
   * different simulation — payroll, entropy, the tail and §4.12's arrival rates
   * are all integrated per frame, and a fortyfold step changes what they
   * compute. N calls at the frame's own `dt` is arithmetically the same thing as
   * N frames, so a run walked at speed 40 passes through every state a run
   * walked at speed 1 does, in the same order. It supplies no left-hand side to
   * anything: every trigger still fires off real state, and every tap in the
   * walk is a real tap on a real control.
   *
   * Clamped at sixty, because the honest version of this flag has a limit: at
   * some multiple the frame's own work stops fitting in a frame and the walk is
   * measuring the harness rather than the game. Sixty is one simulated minute
   * per wall second at a full frame rate, which is where the walk's Run 2 stops
   * being the thing that takes the time.
   */
  const SIM_STEPS = (() => {
    const raw = Number(new URLSearchParams(location.search).get('speed') ?? '1')
    return Number.isFinite(raw) ? Math.max(1, Math.min(60, Math.floor(raw))) : 1
  })()

  app.ticker.add(() => {
    const now = performance.now()
    const rawFrameMs = now - lastFrame
    const dt = Math.min(0.1, rawFrameMs / 1000)
    lastFrame = now
    frames.sample(rawFrameMs)

    for (let step = 0; step < SIM_STEPS; step += 1) tick(dt)

    const state = getState()

    // §10.7a.1 — a scene pushes to Desk zoom on the way in and returns to where
    // the player was on the way out. Driven off the store's scene id, so the
    // dialogue box needs no knowledge of the camera and a scene can never leave
    // the player somewhere they did not choose to be.
    if (state.scene && savedSceneCamera === null) {
      /*
       * **A level, not a Z, and the difference is a camera that never comes to
       * rest.**
       *
       * This used to save `camera.z` and restore it with `camera.set`, and
       * `set` is the continuous door into the lens — it is what `?z` and the
       * §23.3 bench drive a dolly with, so it parks wherever it is told and
       * turns the magnetic stop off while it is there. Restoring a Z sampled
       * while the camera happened to be *moving* therefore parked the studio
       * permanently between two levels: measured after the prologue, level
       * 0.35, not settling, and §7.8.10's corner desk 148 px above the top of
       * the frame. Act I's whole script is TAP TO CODE and there was nobody on
       * the screen to tap.
       *
       * It was invisible until now because the §7.7.1 ceiling used to be
       * enforced from out here by re-cutting the camera every frame, which
       * quietly put it back on a stop — a defect held down by another defect.
       * A level restores through `flyTo`, which is a stop, an ease rather than
       * a cut (§10.5), and subject to the ceiling like every other flight.
       */
      savedSceneCamera = { level: settleLevel(camera.level) }
      camera.flyTo(DESK)
    } else if (!state.scene && savedSceneCamera !== null) {
      camera.flyTo(savedSceneCamera.level)
      savedSceneCamera = null
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
      // *floor*: the thousand developers have just landed on it and the shot is
      // of them, not of the building they are in.
      camera.flyTo(FLOOR)
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
      // §26.2.2 — into this window's numbering, and clipped to it. A hire that
      // lands in a block the player is not looking at has nothing to animate
      // here; the seat it took is real and is somewhere else.
      const from = Math.min(Math.max(0, state.spawn.from - room.seatWindow), ROOM_DEV_CAP)
      const to = Math.min(Math.max(0, state.spawn.to - room.seatWindow), ROOM_DEV_CAP)
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
        // A hire that buys a whole new register of the lens is a reveal, not a
        // hire. Pull back to the level the headcount has just earned.
        camera.flyTo(settleLevel(Math.min(BUILDING, maxZoomFor(state.devs) * 9)))
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

    critPunch = Math.max(0, critPunch - dt * 4)

    // --- the camera --------------------------------------------------------
    //
    // **One transform, applied once, to one container.** What was here iterated
    // seven views, fitted each one to the viewport separately and blended them
    // by rung distance — which is what drew the same building at 190 px and at
    // 724 px on the same frame. There is nothing left to blend: the world is a
    // building, the room is inside a plate of it, and the camera is a scale and
    // a centre.
    const viewport = { w: app.screen.width, h: app.screen.height }
    const storeys = storeysFor(state.devs)
    camera.setViewport(viewport)
    camera.setAddress(focusSeat, storeys)
    // The room is the authority on its own size, because it is the thing that
    // draws the walls. Below the unfold that is a garage growing; above it, a
    // constant.
    camera.setFloorRect(room.shellRect)
    /*
     * GDD §7.7.1 — the studio you can see is the studio you have. Told to the
     * camera rather than done to it, and that is the fix: this used to be
     * `if (camera.z > ceiling) camera.set(ceiling)` every frame, which is an
     * opinion about the camera's Z held by something that cannot see the ladder
     * the Z comes from. On a new game the rungs crossed, the assertion stopped
     * satisfying itself, and it re-cut the camera every frame for as long as
     * the game was open — no wheel, pinch or drag survived to the next frame.
     * The lens holds it as a bound now; see `Lens.setCeiling`.
     */
    camera.setCeiling(maxZoomFor(state.devs) * 9)
    camera.update(dt, now)

    currentLevel = camera.level
    currentFloorScale = floorScaleAt(camera.scale)
    roomIsUp = roomResolved(currentFloorScale)

    const view = camera.transform()
    world.position.set(view.x, view.y)
    world.scale.set(view.scale)

    const tier = tierOfLevel(currentLevel)
    if (tier !== state.zoom) setZoom(tier)
    // §7.7.1 — and the rung, which the tier cannot stand in for: the desk and
    // the squad share a tier, and those two are the difference between holding
    // one developer and holding a hundred.
    setCameraRung(rungOfLevel(currentLevel))

    // --- the building ------------------------------------------------------
    //
    // The address decides which plate is open and which plate the room lives
    // in, and those two are the same number: a floor you are looking into is a
    // floor you can be inside.
    const storey = focusStorey()
    building.setHeadcount(state.devs)
    building.setFocus(storey)
    scene.hostRoomOn(storey)
    // The plan and the room are the same picture at the size the swap happens,
    // so this is a swap the player cannot see rather than a fade between two
    // that never match.
    building.setPlanHidden(storey, roomIsUp)
    building.setChromeAlpha(buildingChromeAlpha(currentFloorScale))
    building.update(now)

    // --- the room ----------------------------------------------------------
    //
    // §7.8.1 — rebuilt when the headcount changes, never per frame.
    // §7.8.7 — identities before headcount, so a rebuild triggered by the seed
    // does not immediately get overwritten by one triggered by the count.
    // §26.2.2 — **which** thousand, before how many of them: the window throws
    // away every generated person, so a `setHeadcount` on the other side of it
    // is what refills the room.
    room.container.renderable = roomIsUp
    room.setSeed(state.runSeed)
    room.setSelected(localSeat(state.selected ?? -1))
    room.setSeatWindow(seatWindowFor())
    room.setHeadcount(Math.min(state.devs, arrivals.revealed))
    room.setCoverage(seatMarks(state))
    // §21 Act IV only. The particle swarm is not a level — the room draws the
    // people wherever a person is a person — so it shows nobody unless the trap
    // has sprung and there is a thousand-body drop to stage. See scene.ts.
    floor.setPopulation(collapse.active ? state.devs : 0)

    // §7.7.6b — the mode owns the hand, so leaving GRAB puts down whoever is in
    // it. Without this a developer is left stranded in mid-air by a button
    // press on the other side of the screen, following a finger that is no
    // longer allowed to be carrying them. `drop(null)` is §7.8.9's escape: they
    // walk back to their desk, unhurried, rather than teleporting. Zooming out
    // of the room does the same thing, and for the same reason — there is no
    // hand at the building.
    if (carryId >= 0 && tapVerb(state.touchMode, roomIsUp) !== 'grab') {
      room.hands.drop(null)
      carryId = -1
    }

    // §7.8.10 and §10.7a.1 — the Hero Anchor and the dialogue speaker.
    //
    // **Both are one call to the lens now, not a per-frame lerp against a pan
    // limit.** `flyTo` already carries the camera in *and* centres it, and the
    // ease is the lens's own, so the two beats cannot arrive at different
    // speeds or fight the clamp. All that is left here is noticing when the
    // flight has landed and handing the camera back.
    if (founderFocus && !camera.settling) founderFocus = false


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
    // Only where the room is drawing people: above that the unit on screen is
    // a floor, and "+1 over each head" has no head to sit over. That is a scope
    // rather than a gap — §8.2b's thinning rule aggregates *within* a floor of
    // people, and the level above it is already the aggregate.
    if (roomIsUp) {
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
      //
      // Capped by the *lens* as well as by the headcount — see `SOURCE_CAP`.
      // A numeral speaks for the smallest group whose edges are on screen, so
      // standing outside the floor thins a hundred of them down to one per
      // squad rather than stacking them over a plan the size of a postcard.
      const sources = tallySources(seats, drawn, (i) => developerVelocity(globalSeat(i), state), {
        cap: capForLevel(currentLevel),
        ...sourceWindow(drawn, focusSeat - room.seatWindow, spanForLevel(currentLevel)),
      })
      const container = room.container
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
      // §26.2.2 — **ask what is under a point without pressing it.** The
      // hierarchy is only navigable if a tap lands on the thing that was
      // pointed at, and "did the tap land on the right unit" is not a question
      // a screenshot can answer: every unit at every rung is drawn in the same
      // ten places. Same family as `__store` and `__stage`, and the §26.2.5
      // walk will need it for the same reason the ladder probe needed `wheelTo`
      // to fail loudly — a gesture that missed looks exactly like one that
      // landed somewhere boring.
      ;(globalThis as unknown as Record<string, unknown>).__pick = (x: number, y: number) =>
        pickUnit(x, y)
      /*
       * §4.5d — **where is the founder's own avatar, in screen pixels.**
       *
       * Same family as `__pick`, and here for the same reason: §26.1.8 item 9
       * has to open the founder's screen, §13.6.7 says the door has to be a
       * person, and the walk's only way to find that person was to tap a grid
       * over the whole frame until something opened. That was tolerable while a
       * tap did nothing but select. It is not now — a tap navigates, so five
       * hundred of them walk the camera down the ladder and away from the thing
       * being hunted, and "no tap reached the founder" ends up meaning "the
       * sweep drove the lens to Desk on somebody else's squad".
       *
       * Aiming instead of hunting also splits a failure the sweep conflated:
       * *the avatar is not in the frame* (§13.7.1a's known trade) is a
       * different finding from *the avatar is in the frame and tapping it does
       * nothing*, and only the second is a bug.
       *
       * Null when the room is not drawn, which is itself the answer to "why did
       * the tap miss".
       */
      ;(globalThis as unknown as Record<string, unknown>).__founderAt = () => {
        if (!roomIsUp) return null
        const at = room.founderDeskAt()
        const p = room.container.toGlobal({ x: at.x, y: at.y - 18 })
        return { x: Math.round(p.x), y: Math.round(p.y) }
      }
      // The one measurement the whole rebuild is answerable to: how much of
      // the frame the *developers* actually cover. It was 48% at a full floor
      // and 28% at a hundred, and both were invisible from a screenshot without
      // measuring the seat block by hand.
      const seatsPx = floorSeatRect().w * currentFloorScale
      const snapshot = {
        z: +camera.z.toFixed(4),
        // Where the camera is on the level ladder, continuously, and which
        // level that settles to. Reading them apart is the difference between
        // "the camera is between two levels" and "the camera is on one".
        level: +currentLevel.toFixed(2),
        at: LEVEL_NAMES[settleLevel(currentLevel)],
        ceilingRung: rungFor(state.devs).rung,
        // §26.2.2 — the address. Which part of the studio the lens is over, and
        // which thousand people the room is a picture of.
        focusSeat,
        storey,
        selectedStorey,
        storeys,
        seatWindow: room.seatWindow,
        drawn: room.drawn,
        roomIsUp,
        scale: +camera.scale.toFixed(5),
        floorScale: +currentFloorScale.toFixed(5),
        centre: `${Math.round(camera.centre.cx)},${Math.round(camera.centre.cy)}`,
        // **The number this rebuild exists to make large.** How wide the seat
        // block measures on screen, and what fraction of the frame that is.
        seatsPx: Math.round(seatsPx),
        fillFrame: +(seatsPx / app.screen.width).toFixed(3),
        viewport: `${Math.round(app.screen.width)}x${Math.round(app.screen.height)}`,
        massHired: state.massHired,
        settling: camera.settling,
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
    nav() {
      const devs = getState().devs
      const n = storeysFor(devs)
      const occupancy: number[] = []
      for (let f = 0; f < n; f++) {
        occupancy.push(Math.max(0, Math.min(DEVS_PER_FLOOR, devs - f * DEVS_PER_FLOOR)))
      }
      const at = settleLevel(currentLevel)
      return {
        level: currentLevel,
        at,
        name: LEVEL_NAMES[at],
        storey: focusStorey(),
        squad: squadOf(focusSeat),
        seat: focusSeat,
        storeys: n,
        selected: selectedStorey,
        occupancy,
      }
    },
    enterFloor(storey: number) {
      enterStorey(storey)
    },
    goToLevel(level: Level) {
      // Going *up* is a plain reframe; going down needs an address, and the
      // address is already the one the breadcrumb is naming.
      selectedStorey = level >= BUILDING ? selectedStorey : focusStorey()
      camera.flyTo(level)
      playUi('whoosh')
    },
    focusFounder() {
      focusFounderCamera()
    },
    focusDialogue(focus) {
      focusDialogue(focus)
    },
    codeFounder() {
      // The rail's CODE — YOU, which is §7.7.4's way home as much as it is a
      // poke, so this one does take the camera.
      return codeAtFounderDesk({ sound: true })
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
