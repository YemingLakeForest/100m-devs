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
  grabDeveloper,
  releaseDeveloper,
  FLOATER_LIFE_MS,
  getState,
  heroCoverageOf,
  heroRoster,
  poke,
  pokeFounder,
  previewHeroAt,
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
  BLOCK,
  BUILDING,
  bandRect,
  DESK,
  DEVS_PER_FLOOR,
  FLOOR,
  LEVEL_NAMES,
  PARK,
  SQUAD,
  TOWER_CROWN,
  TOP_LEVEL,
  blockAtPark,
  blockChromeAlpha,
  blockOf,
  blockToBuilding,
  blocksFor,
  buildingAt,
  buildingAtBlock,
  buildingChromeAlpha,
  buildingOf,
  buildingsIn,
  devsIn,
  devsOnBlock,
  floorScaleAt,
  floorSeatRect,
  parkChromeAlpha,
  parkToBlock,
  globeToPark,
  plotOf,
  roomResolved,
  seatOfBlock,
  seatOfPlot,
  seatOfStorey,
  siteOf,
  sitesFor,
  devsOnSite,
  globeChromeAlpha,
  seatOfSite,
  GLOBE,
  squadOf,
  storeyAtBuilding,
  storeyOf,
  storeysIn,
  type Level,
} from './frames.ts'
import { buildPark } from './park.ts'
import { buildGlobe } from './globe.ts'
import { ALL_PASSES, createPostProcess, type PassName } from './postProcess.ts'
import { buildScene } from './scene.ts'
import { LITERAL_RUNG_LIMIT, maxZoomFor, rungFor, zoomCeilingLifted } from '../sim/headcount.ts'
import { branchColour } from '../sim/heroTree.ts'
import { roomSeatMarks, type RoomPosting, type SeatMark } from './heroBadges.ts'
import { createCollapse } from './collapse.ts'
import { createPokeTypeset } from './pokeText.ts'
import { DEBUG_TOOLS_ENABLED, debugSearchParams } from '../dev/debugAccess.ts'
import { getSimSpeed } from '../dev/simSpeed.ts'
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
import type { HeroPlacement } from '../sim/heroRoster.ts'
import { nominalUnitSize, unitSeats } from '../sim/units.ts'

/** What the HUD needs to draw the breadcrumb and the lift panel. */
export interface NavState {
  /** Continuous position on the ladder, 0 desk to 6 globe. */
  level: number
  /** The level it would settle on, and the word for it. */
  at: Level
  name: string
  /**
   * The address, unpacked.
   *
   * `building` is the plot of its own block — the number the HUD says out loud
   * — and not {@link buildingOf}'s park-wide one. A player reading
   * `BLOCK 03 / BUILDING 07` is naming the seventh tower of the third block,
   * and "building 27" is a number nothing on the screen is labelled with.
   */
  site: number
  block: number
  building: number
  storey: number
  squad: number
  seat: number
  /** How many storeys stand in the building the address is in. */
  storeys: number
  /** How many buildings stand on the block the address is in. */
  buildings: number
  /** How many blocks stand in the park. */
  blocks: number
  /** How many sites the studio has settled. */
  sites: number
  /** The storey named but not yet entered, or −1. */
  selected: number
  /** The building named but not yet entered, or −1. */
  selectedBuilding: number
  /** The block named but not yet entered, or −1. */
  selectedBlock: number
  /** The site named but not yet entered, or −1. */
  selectedSite: number
  /** Developers on each built storey of this building, ground floor first. */
  occupancy: number[]
  /** Developers in each built building of this block, first plot first. */
  blockOccupancy: number[]
  /** Developers on each built block of the park, first parcel first. */
  parkOccupancy: number[]
  /** Developers on each settled site of the planet, first site first. */
  globeOccupancy: number[]
}

export interface StageHandle {
  /** Rolling frame time in ms, for the GDD §23.3 overlay. */
  readonly frameMs: number
  /** p95 tap -> numeral latency in ms. Criterion 1's threshold is 80 ms. */
  readonly latencyP95: number
  readonly camera: Lens
  /**
   * Project a hero's assignment into the scene the player is currently seeing.
   *
   * `null` means the assignment is outside the visible hierarchy. `context`
   * means the camera is inside the assigned unit, so the marker describes the
   * whole current scene rather than one pinpoint target within it.
   */
  heroAnchor(placement: HeroPlacement): { x: number; y: number; context: boolean } | null
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
  /** Go into a building of the block — the picker's building rows. */
  enterBuilding(building: number): void
  /** Go into a block of the park — the picker's block rows. */
  enterBlock(block: number): void
  /** Go into a site of the planet — the picker's site rows. */
  enterSite(site: number): void
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
 * six levels this scope draws are its first six. A tap at the building level
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
  const params = debugSearchParams()
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
  /*
   * **One object in the world, and everything else is inside it.** There is no
   * far-to-near list of views, because there are no longer several pictures of
   * the same studio to order: the park holds ten parcels, a parcel holds a
   * block, a block holds ten plots, a plot holds a building, a building holds
   * ten plates, a plate holds the room, and depth is the scene graph's own
   * business.
   *
   * The building the address is in is parented *into its own plot of its own
   * block*, so it is drawn at that plot's scale in that plot's place and the
   * block skips its tower. Descending the whole six-deep chain is one affine
   * transform and every hand-off is invisible, because both sides of each one
   * are the same drawing at the same size.
   */
  /*
   * **The planet holds the park, and the park holds everything else.**
   *
   * One more link on the same chain, and the reason the park is parented into
   * the globe rather than beside it: `intoGlobe` is a pure scale about the
   * origin, so the whole studio below rung 6 rides one container whose transform
   * *is* that scale. The planet then turns so the site the address is in is the
   * one facing the camera, which is what lets a park's position inside the globe
   * be a constant and rung 6 be a place the camera can be sent to.
   */
  const globe = buildGlobe()
  world.addChild(globe.container)
  const park = buildPark()
  globe.parkHost.addChild(park.container)
  park.blockAt(0).plotHost(0).addChild(building.container)
  let hostedBuilding = 0
  let hostedBlock = 0

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
      // §13.8c — once a candidate is under inspection the floor answers the
      // proposed move, while the world pin continues to show the committed
      // anchor. Drawing both footprints would turn a comparison into an
      // overlap that the simulation will never actually have.
      if (state.posting === hero.id && state.postingTarget) continue
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

    const previewHero = state.posting === null
      ? null
      : heroRoster(state).find((hero) => hero.id === state.posting) ?? null
    const preview = state.postingTarget
    if (previewHero && preview && preview.rung <= LITERAL_RUNG_LIMIT) {
      postings.push({
        branch: previewHero.branch,
        colour: branchColour(previewHero.branch),
        index: preview.index,
        reachDevs: previewHero.reachDevs,
        // The outline is already the visual grammar for coverage that is not
        // active yet. A preview is deliberately never painted as live work.
        settling: true,
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
    // Park space out of the camera, then the parcel, then the plot: the tower
    // is authored in its own coordinates and stands in a plot of a block of the
    // park, so the finger has to come back the same way the drawing went out.
    const b = buildingOf(focusSeat)
    const w = blockToBuilding(inBlock(x, y, blockOf(focusSeat)), plotOf(b))
    return storeyAtBuilding(w.x, w.y, storeysIn(hereDevs(getState().devs), b), storeyOf(focusSeat))
  }

  /**
   * Screen point -> park space.
   *
   * **The camera speaks globe space now**, and this is the one line that knows
   * it. `toWorld` undoes the camera and lands in whatever the outermost space
   * is; every picker below wants the park, so the conversion is written once
   * here rather than at each of the three call sites that used to do it.
   *
   * It was not written once, first. `inBlock` and `pickBlock` each called
   * `toWorld` and fed the result straight to a park-space function, so when the
   * globe added a division both were silently out by a factor of two — a
   * uniform scale about the origin, which is exactly the kind of wrong that
   * still works near the middle of the screen. `test:ui-frame` caught it as
   * *nine of ten buildings reachable*, which is a much better description of
   * the defect than anything the arithmetic would have said.
   */
  const inPark = (x: number, y: number) => globeToPark(camera.toWorld(x, y))

  /** Screen point -> that point in one block's own space. */
  const inBlock = (x: number, y: number, block: number) => parkToBlock(inPark(x, y), block)

  /**
   * Screen point -> the building of the address's own block under it, as a plot
   * of that block, or −1.
   *
   * **Of the address's block**, which is the whole of what the fifth level
   * changed here: at the block level the camera is inside one parcel, so the
   * only ten towers a tap can be aimed at are that parcel's ten. Asking the
   * park would name a tower two parcels away that the frame does not contain.
   */
  const pickBuilding = (x: number, y: number): number => {
    const devs = getState().devs
    const block = blockOf(focusSeat)
    const w = inBlock(x, y, block)
    return buildingAtBlock(w.x, w.y, buildingsIn(hereDevs(devs), block), (i) =>
      storeysIn(hereDevs(devs), buildingAt(i, block)),
    )
  }

  /** Screen point -> the block of the park under it, or −1. */
  const pickBlock = (x: number, y: number): number => {
    const w = inPark(x, y)
    return blockAtPark(w.x, w.y, blocksFor(hereDevs(getState().devs)))
  }

  /**
   * Screen point -> the site of the planet under it, or −1.
   *
   * Asked of `globe.ts` rather than worked out here, because the planet's own
   * orientation is the only thing that knows where a site currently is and two
   * derivations of that is one too many. It is a nearest search over the sites
   * the studio has actually settled, so tapping ground nobody has bought is
   * tapping nothing.
   */
  const pickSite = (x: number, y: number): number => {
    const w = camera.toWorld(x, y)
    return globe.siteUnder(w.x, w.y)
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
    if (rung >= GLOBE) {
      // The planet. A site is a park, and §7.7.1's rung 6 band opens at a
      // million — which is exactly what a park holds, so `unitSeats(6, i)` was
      // already the right window before there was a planet to spend it on.
      const site = pickSite(x, y)
      return site < 0 ? null : { rung: 6, index: site }
    }
    if (rung >= PARK) {
      // The park. A parcel is a block, and §7.7.1's rung 5 unit is exactly the
      // hundred thousand seats one holds — `unitSeats(5, i)`, which the rung
      // table has had in it since before there was a park to spend it on.
      const b = pickBlock(x, y)
      return b < 0 ? null : { rung: 5, index: b }
    }
    if (rung >= BLOCK) {
      // The block. A slot is a building, and §7.7.1's rung 4 *is* a building —
      // `unitSeats(4, i)` is exactly the ten thousand seats it holds. The index
      // goes to the store, and the store counts buildings across the whole
      // studio: a plot of block 3 is building 30-something, never plot 0-9.
      const b = pickBuilding(x, y)
      return b < 0 ? null : { rung: 4, index: buildingAt(b, blockOf(focusSeat)) }
    }
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
    // §13.8c — the world tap names the candidate; it does not start the walk.
    // The banner owns the explicit confirmation so touch gets the same preview
    // desktop receives from hover.
    previewHeroAt(target)
    playUi('click')
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
   * §7.7.6 — **the world names things; it does not move the camera.**
   *
   * A tap picks: at the building it names a storey, below it it names a person,
   * and that is the whole of what a finger on the glass does to the lens.
   * Changing *level* is the pinch, the wheel, and the rail — three controls
   * that exist for it and cannot be produced by accident.
   *
   * This replaces a double-tap descend and a tap-the-selected-floor-again, and
   * both went for the same reason: **a tap is already §8.2's primary verb.**
   * POKE is latched from boot over a script that reads TAP TO CODE, a clicker
   * is played by clicking, and any rule of the form "two taps mean something
   * else" fires constantly on a player who is simply playing. It ate every
   * second click and flew the lens onto whoever was under the thumb — three
   * separate reports, the last of them "double taps should not zoom, only zoom
   * with pinch".
   *
   * What the player asked for originally — *"I need the option to click and
   * choose which floor to go into"* — is not lost and is arguably clearer: tap
   * the tower to name a floor, and the lift panel's row for it lights up and is
   * the door. A picker with a label beats a gesture nobody was told about.
   */

  /** The storey named but not yet entered, or −1. */
  let selectedStorey = -1
  /** The building named but not yet entered, or −1. */
  let selectedBuilding = -1
  /** The block named but not yet entered, or −1. */
  let selectedBlock = -1
  /** The site named but not yet entered, or −1. */
  let selectedSite = -1

  const tapSelectsAFloor = () => settleLevel(currentLevel) === BUILDING
  const tapSelectsABuilding = () => settleLevel(currentLevel) === BLOCK
  const tapSelectsABlock = () => settleLevel(currentLevel) === PARK
  const tapSelectsASite = () => settleLevel(currentLevel) === GLOBE

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
   * first corner: descending into the third town and then the fifth site gave
   * site five *of the studio*. Nothing past the tenth unit at any rung had an
   * address at all.
   */
  let focusSeat = 0

  /** Which storey the address is in, and which thousand seats that is. */
  const focusStorey = () => storeyOf(focusSeat)
  /**
   * The developers who are on the site the address is in.
   *
   * The one line the sixth level cost every consumer below it. `park.ts`,
   * `block.ts` and `building.ts` already draw *a park given a headcount* and
   * none of them learns that a planet exists; what changed is that they are
   * handed this rather than the studio's whole payroll. Hand them `state.devs`
   * at a hundred million and every site draws a full park, which is a hundred
   * copies of the same picture and not a world.
   */
  const hereDevs = (devs: number) => devsOnSite(devs, siteOf(focusSeat))
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
    tellAddress()
  }

  /**
   * Hand the address to the lens: the seat, the storeys of *its* building, and
   * how many buildings there are.
   *
   * Three numbers rather than one because two of them move on their own — a
   * hire adds a storey and a storey adds a building — and the lens frames every
   * level from all three.
   */
  const tellAddress = () => {
    const devs = getState().devs
    camera.setAddress(
      focusSeat,
      storeysIn(hereDevs(devs), buildingOf(focusSeat)),
      buildingsIn(hereDevs(devs), blockOf(focusSeat)),
      blocksFor(hereDevs(devs)),
      sitesFor(devs),
    )
  }

  /**
   * §13.11.1 — put a hero's name on the unit their placement names.
   *
   * Coverage tint answers “how far does the effect travel?” but not “who is
   * responsible for this place?”. The latter needs an identity marker tied to
   * the same hierarchy the placement tap used. This projects that hierarchy
   * into screen space without teaching React any of the scene graph.
   */
  const heroAnchor = (
    placement: HeroPlacement,
  ): { x: number; y: number; context: boolean } | null => {
    const rung = Math.max(0, Math.floor(placement.rung))
    const index = Math.max(0, Math.floor(placement.index))
    const devs = getState().devs
    const range = unitSeats(rung, index, devs)
    const view = settleLevel(currentLevel)
    const holdsFocus = focusSeat >= range.from && focusSeat < range.to

    // Looking *inside* a floor/building/site that owns the placement: there is
    // no smaller point to pin because the whole current scene is the target.
    if (view < rung) {
      return holdsFocus
        ? { x: app.screen.width / 2, y: Math.min(92, app.screen.height * 0.26), context: true }
        : null
    }

    const firstSeat = index * nominalUnitSize(rung)
    const targetSite = siteOf(firstSeat)
    if (targetSite !== siteOf(focusSeat)) return null

    const targetBuilding = buildingOf(firstSeat)
    const targetBlock = blockOf(firstSeat)
    const targetStorey = storeyOf(firstSeat)

    // A building view contains one building; a block view contains one block.
    // Markers elsewhere in the site become the component's explicit AWAY chip
    // rather than pretending an invisible unit is somewhere in this picture.
    if (view <= BUILDING && targetBuilding !== buildingOf(focusSeat)) return null
    if (view === BLOCK && targetBlock !== blockOf(focusSeat)) return null

    const point = (x: number, y: number, context = false) =>
      Number.isFinite(x) && Number.isFinite(y) ? { x, y, context } : null

    if (rung <= 2 && roomIsUp) {
      const local = localSeat(index)
      const desk = local >= 0 ? room.deskAt(local) : null
      if (desk) {
        const at = room.container.toGlobal({ x: desk.x, y: desk.y - 30 })
        return point(at.x, at.y)
      }
    }

    if (rung <= 3) {
      const host = park.blockAt(targetBlock).plotHost(plotOf(targetBuilding))
      const band = bandRect(targetStorey)
      const at = host.toGlobal({ x: band.cx, y: band.cy })
      return point(at.x, at.y)
    }

    if (rung === 4) {
      const host = park.blockAt(targetBlock).plotHost(plotOf(targetBuilding))
      const storeys = storeysIn(hereDevs(devs), targetBuilding)
      const top = bandRect(Math.max(0, storeys - 1))
      const at = host.toGlobal({ x: top.cx, y: top.cy - top.h / 2 - TOWER_CROWN * 0.35 })
      return point(at.x, at.y)
    }

    if (rung === 5) {
      const at = park.blockAt(targetBlock).container.toGlobal({ x: 0, y: -80 })
      return point(at.x, at.y)
    }

    // A site or anything above it owns the whole current park. At globe scale
    // the park host is the visible territory; inside it this becomes context.
    const at = park.container.toGlobal({ x: 0, y: -100 })
    return point(at.x, at.y, rung > GLOBE)
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
    const b = buildingOf(focusSeat)
    const n = storeysIn(hereDevs(getState().devs), b)
    if (!(storey >= 0) || storey >= n) return false
    setFocus(seatOfStorey(storey, b, siteOf(focusSeat)))
    selectedStorey = storey
    focal = null
    camera.flyTo(FLOOR)
    playUi('whoosh')
    return true
  }

  /**
   * Go into a building — the lift panel's building rows, one level up.
   *
   * The same shape as {@link enterStorey} and for the same reason: the address
   * moves *first*, so the frame the lens flies to is the frame of the building
   * that was chosen rather than of the one it was already over. Landing on that
   * building's ground floor rather than on whichever storey the last building
   * happened to be open at — a floor number is only a floor number of
   * something, and carrying it across would name a storey nobody chose.
   */
  const enterBuilding = (b: number): boolean => {
    const devs = getState().devs
    const block = blockOf(focusSeat)
    if (!(b >= 0) || b >= buildingsIn(hereDevs(devs), block)) return false
    setFocus(seatOfPlot(b, block, siteOf(focusSeat)))
    selectedBuilding = b
    selectedStorey = -1
    focal = null
    camera.flyTo(BUILDING)
    playUi('whoosh')
    return true
  }

  /**
   * Go into a block — the lift panel's block rows, one level up again.
   *
   * The same shape as {@link enterBuilding} and for the same reason, one rung
   * further out: the address moves first, and it lands on the block's *first*
   * building rather than carrying the plot number across from whichever block
   * was open before. A building number is only a building number of something.
   */
  const enterBlock = (b: number): boolean => {
    if (!(b >= 0) || b >= blocksFor(hereDevs(getState().devs))) return false
    setFocus(seatOfBlock(b, siteOf(focusSeat)))
    selectedBlock = b
    selectedBuilding = -1
    selectedStorey = -1
    focal = null
    camera.flyTo(BLOCK)
    playUi('whoosh')
    return true
  }

  /**
   * Go into a site — the picker's site rows, and the last door on the ladder.
   *
   * The same shape as {@link enterBlock} one rung further out, and the same
   * rule about what is *not* carried across: the address lands on the site's
   * first block rather than keeping whichever parcel was open on the last
   * territory. A block number is only a block number of somewhere.
   */
  const enterSite = (i: number): boolean => {
    if (!(i >= 0) || i >= sitesFor(getState().devs)) return false
    setFocus(seatOfSite(i))
    selectedSite = i
    selectedBlock = -1
    selectedBuilding = -1
    selectedStorey = -1
    focal = null
    camera.flyTo(PARK)
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
    if (who < 0) return false

    // **The simulation decides, and it says yes to everybody but one.** §7.8.9's
    // old refusal — nobody mid-behaviour — was overruled on 2026-08-26: a
    // minigame about dragging wanderers back cannot decline to catch the one who
    // is walking away. The store call is what makes the lift cost output; the
    // room call is what makes the body follow the finger.
    //
    // §21.7.0 rule 6 is the exception, and the press is still **consumed** when
    // he refuses. Falling through to a camera drag would answer "I tried to pick
    // James up" by panning the room, which reads as the game ignoring the input
    // — and the refusal has already put his line on screen, so something did
    // happen and the player should be looking at it.
    const grab = grabDeveloper(who)
    if (!grab.held) {
      if (grab.says) room.sayOver(who, grab.says)
      playUi('close')
      return true
    }
    room.hands.hold(who)

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
    const dx = ev.clientX - drag.px
    const dy = ev.clientY - drag.py
    // Incremental, because the lens clamps to its own bounds every frame and a
    // drag rebuilt from its origin would keep pushing against a wall it has
    // already hit and then jump when the finger came back.
    //
    // At the top rung the subject is a sphere: panning it *is* spinning it.
    // Keep that exception here, at the gesture boundary, so every lower rung
    // retains the fixed affine camera and entering a site can still freeze the
    // globe back to that site's address orientation.
    if (tapSelectsASite()) globe.rotateBy(dx, dy)
    else camera.panBy(dx, dy, t)
    drag.px = ev.clientX
    drag.py = ev.clientY
  }

  const onDragEnd = (ev: PointerEvent) => {
    if (carryId === ev.pointerId) {
      carryId = -1
      // Dropped onto a seat, or onto the floor. `pickDeveloper` answers "whose
      // desk is under the finger", which is exactly the question.
      const who = room.hands.carrying
      const onDesk = pickDeveloper(ev.clientX, ev.clientY) >= 0
      room.hands.release()
      if (who >= 0) releaseDeveloper(who, onDesk)
      // §7.8.5's bum-hits-seat for a landing, the close whisper for a shrug.
      //
      // **These now differ by more than a sound.** §7.8.6 rule 2 was reversed:
      // a landing puts somebody back to work and a shrug leaves them walking
      // home, not producing, for as long as the walk takes.
      if (onDesk) playSfx('poke-floor')
      else playUi('close')
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

    // **The park names a block**, and the block names a building, and the
    // building names a floor — one rule, said at every level it applies to: the
    // tap selects and pokes, and the rail is the door.
    if (tapSelectsASite()) {
      const i = pickSite(ev.clientX, ev.clientY)
      if (i < 0) {
        selectedSite = -1
        playUi('close')
        return
      }
      if (i !== selectedSite) {
        selectedSite = i
        setFocus(seatOfSite(i))
        playUi('click')
      }
      doPoke(ev.clientX, ev.clientY, t)
      return
    }

    if (tapSelectsABlock()) {
      const b = pickBlock(ev.clientX, ev.clientY)
      if (b < 0) {
        selectedBlock = -1
        playUi('close')
        return
      }
      if (b !== selectedBlock) {
        selectedBlock = b
        setFocus(seatOfBlock(b, siteOf(focusSeat)))
        playUi('click')
      }
      doPoke(ev.clientX, ev.clientY, t)
      return
    }

    if (tapSelectsABuilding()) {
      const b = pickBuilding(ev.clientX, ev.clientY)
      if (b < 0) {
        selectedBuilding = -1
        playUi('close')
        return
      }
      if (b !== selectedBuilding) {
        selectedBuilding = b
        // **In this block.** `pickBuilding` answers in plots because that is
        // what the block draws, and the address is a seat of the whole park —
        // trap 52a's shape exactly, and the reason `seatOfPlot` takes both.
        setFocus(seatOfPlot(b, blockOf(focusSeat), siteOf(focusSeat)))
        playUi('click')
      }
      doPoke(ev.clientX, ev.clientY, t)
      return
    }

    // **The building names a floor.** The tap selects and pokes — §4.5b's unit
    // poke, which is what it would have done anyway — and the lift panel's row
    // for that floor is the door. Tapping the same storey twice selects it
    // twice; nothing on the glass changes the level.
    if (tapSelectsAFloor()) {
      const storey = pickStorey(ev.clientX, ev.clientY)
      if (storey < 0) {
        selectedStorey = -1
        playUi('close')
        return
      }
      if (storey !== selectedStorey) {
        selectedStorey = storey
        // **In this building, on this site.** `pickStorey` answers in storeys of
        // the tower under the thumb and the address is a seat of the whole
        // planet, so both have to be said. A floor number is only a floor number
        // of something: naming a storey without saying whose tower it is on
        // moved the address to building 1 and took the room with it, and one
        // rung further out the same omission moves it to another territory.
        setFocus(seatOfStorey(storey, buildingOf(focusSeat), siteOf(focusSeat)))
        playUi('click')
      }
      doPoke(ev.clientX, ev.clientY, t)
      return
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
    // A mouse can compare anchors continuously before committing. Touch gets
    // the same answer from `doPost` on its first tap, then confirms on the HUD.
    if (getState().posting !== null && ev.pointerType === 'mouse' && pointers.size === 0) {
      previewHeroAt(pickUnit(ev.clientX, ev.clientY))
    }
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

  app.ticker.add(() => {
    const now = performance.now()
    const rawFrameMs = now - lastFrame
    const dt = Math.min(0.1, rawFrameMs / 1000)
    lastFrame = now
    frames.sample(rawFrameMs)

    /*
     * §26.1.8's `?speed`, now a dial rather than a constant — see
     * `dev/simSpeed.ts` for why it is repeated whole ticks and never a bigger
     * `dt`, and for the gate that keeps it out of deployed HTML.
     *
     * Read **here**, on the frame, rather than captured once above: the whole
     * point of moving it onto a control is that the answer changes mid-session,
     * and a value sampled at stage construction would give the scenario bar a
     * slider that moved and a studio that did not.
     */
    const steps = getSimSpeed()
    for (let step = 0; step < steps; step += 1) tick(dt)

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
      //
      // **Both halves, or neither.** Clearing the latch alone left the bus
      // holding its Act IV start time, so `mix()` went on ducking all four zone
      // beds to zero and holding the collapse layer at full for the rest of the
      // session, and the *next* `triggerActIV` was a no-op besides. That is the
      // "the music never went back" report: the renderer had reset and the
      // score had not.
      musicCollapsed = false
      music.clearActIV()
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
        // Capped at the top of the ladder, not at the building: the ten
        // thousandth hire is the one that buys the block, and a reveal that
        // stopped at the tower would pull back to the thing the player has
        // just outgrown.
        camera.flyTo(settleLevel(Math.min(TOP_LEVEL, maxZoomFor(state.devs) * 9)))
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
    // §7.8.9 — hand the room this tick's away roster, **before** it animates.
    //
    // Pushed rather than pulled: `render/room.ts` does not import the store and
    // should not start. This is the one seam where the simulation's opinion
    // about who is out of their chair reaches the bodies that draw it — and it
    // has to be on this side of `animate`, or a developer the player has just
    // grabbed spends one frame sitting at their desk before the hand takes
    // hold, which is exactly long enough to see.
    room.setAway(state.slack.away)
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
    const focusBlock = blockOf(focusSeat)
    const focusBuilding = buildingOf(focusSeat)
    const focusPlot = plotOf(focusBuilding)
    const storeys = storeysIn(hereDevs(state.devs), focusBuilding)
    camera.setViewport(viewport)
    tellAddress()
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

    // --- the park and the block --------------------------------------------
    //
    // Ten parcels, ten blocks, a hundred plots and one door at each level. The
    // building the address is in is *parented into its plot of its block*, so
    // when the address moves the container moves with it and the block it left
    // starts drawing a tower there again. Re-parenting rather than re-drawing
    // is what keeps any two of them from ever being on screen at once.
    /*
     * --- the planet ------------------------------------------------------
     *
     * **The hand-off, and it is a cross-fade of one picture rather than two.**
     *
     * `globe.ts` draws every settled site as one building on territory ground,
     * and `park.ts` draws the address's detailed city on that exact same ground
     * colour — so what fades here is *detail*, not subject. The
     * artefact §10.5 forbids is two pictures of the same thing at different
     * sizes blended together; these are the same size by construction, because
     * `intoGlobe` is the scale the park host is already carrying.
     */
    const globeAlpha = globeChromeAlpha(currentLevel)
    globe.setHeadcount(state.devs)
    globe.setFocus(siteOf(focusSeat))
    globe.setSelected(selectedSite)
    globe.setChromeAlpha(globeAlpha)
    // And the studio goes as the planet arrives. One container: the park, its
    // ten blocks, the building and the room all ride the same fade, because
    // they are all inside the site that is becoming a mark on a world.
    globe.parkHost.alpha = 1 - globeAlpha
    globe.parkHost.visible = globeAlpha < 0.996

    const parkAlpha = parkChromeAlpha(currentLevel)
    const blockAlpha = blockChromeAlpha(currentLevel)
    // The ground this park stands on, asked of the planet rather than worked
    // out twice. It is what stops the studio being a grey mat on a green world.
    const ground = globe.groundAt(siteOf(focusSeat))
    park.setTerrain(ground.biome, ground.step)
    park.setHeadcount(hereDevs(state.devs))
    park.setFocus(focusBlock, focusPlot)
    park.setSelected(selectedBlock)
    park.setChromeAlpha(parkAlpha)

    const block = park.blockAt(focusBlock)
    block.setSelected(selectedBuilding)
    block.setChromeAlpha(blockAlpha)
    if (focusBuilding !== hostedBuilding || focusBlock !== hostedBlock) {
      hostedBuilding = focusBuilding
      hostedBlock = focusBlock
      block.plotHost(focusPlot).addChild(building.container)
    }

    // --- the building ------------------------------------------------------
    //
    // The address decides which plate is open and which plate the room lives
    // in, and those two are the same number: a floor you are looking into is a
    // floor you can be inside.
    const storey = focusStorey()
    building.setSeat(focusBuilding)
    building.setHeadcount(devsIn(hereDevs(state.devs), focusBuilding))
    /*
     * **No storey is lit while the block is the subject** — `drawTower`'s own
     * rule, which the ninety-nine cheap towers obey because they are passed
     * `focus = -1` and which the hosted one did not, because this line was
     * written when a building was the only thing on screen.
     *
     * `building.ts`: *"A block does not light a storey: at that scale a band is
     * 19 px and the thing being chosen is the building."* At the park it is 9
     * px, and one tower in a hundred wore a cyan smear across two faces. The
     * neighbouring `setPlanAlpha` line already guards the *plan* on exactly
     * this test and nobody carried it across to the lighting.
     */
    const litStorey = blockAlpha > 0 ? -1 : storey
    building.setFocus(litStorey)
    scene.hostRoomOn(storey)
    // The plan and the room are the same picture at the size the swap happens,
    // so this is a swap the player cannot see rather than a fade between two
    // that never match.
    building.setPlanHidden(storey, roomIsUp)
    // And it does not exist at all while the block does: 286 units of plan
    // against a 130-unit plot stride is a plan drawn through the neighbours.
    building.setPlanAlpha(1 - blockAlpha)
    building.setChromeAlpha(buildingChromeAlpha(currentLevel))
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
      const who = room.hands.carrying
      room.hands.release()
      if (who >= 0) releaseDeveloper(who, false)
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

    // Local-browser-only inspection seam, in the same family as ?bench / ?act / ?nopost.
    // The Act IV beat is three systems deep — store flag, camera dolly, LOD
    // weight — and "nothing is on screen" is the same symptom for all three.
    if (DEBUG_TOOLS_ENABLED) {
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
        block: blockOf(focusSeat),
        blocks: blocksFor(hereDevs(state.devs)),
        sites: sitesFor(state.devs),
        // The plot of its own block, which is the number the HUD says; the
        // park-wide one is `buildingOf` and is what the store counts in.
        building: plotOf(buildingOf(focusSeat)),
        buildings: buildingsIn(hereDevs(state.devs), blockOf(focusSeat)),
        storey,
        /*
         * **Which storey is actually lit on the tower**, which is not the same
         * number as `storey` and is the only way to see this from outside: a
         * band 9 px tall drawn in the wrong place is invisible to `__pick`,
         * which answers off the model, and to a screenshot assertion, which has
         * no idea which tower is the hosted one.
         */
        litStorey,
        selectedStorey,
        selectedBuilding,
        selectedBlock,
        storeys,
        seatWindow: room.seatWindow,
        drawn: room.drawn,
        roomIsUp,
        scale: +camera.scale.toFixed(5),
        floorScale: +currentFloorScale.toFixed(5),
        // **How much of each level's chrome is on screen.** Here because a
        // composition hand-off is invisible to every other probe: `__pick`
        // answers off the model and will happily name ten towers that are being
        // drawn at alpha zero, which is exactly the state "at 100k still just
        // one tower" was reported from.
        parkAlpha: +parkChromeAlpha(currentLevel).toFixed(3),
        blockAlpha: +blockChromeAlpha(currentLevel).toFixed(3),
        buildingAlpha: +buildingChromeAlpha(currentLevel).toFixed(3),
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
    heroAnchor(placement) {
      return heroAnchor(placement)
    },
    nav() {
      const all = getState().devs
      const devs = hereDevs(all)
      const block = blockOf(focusSeat)
      const b = buildingOf(focusSeat)
      const mine = devsIn(devs, b)
      const n = storeysIn(devs, b)
      const occupancy: number[] = []
      for (let f = 0; f < n; f++) {
        occupancy.push(Math.max(0, Math.min(DEVS_PER_FLOOR, mine - f * DEVS_PER_FLOOR)))
      }
      const m = buildingsIn(devs, block)
      const blockOccupancy: number[] = []
      for (let i = 0; i < m; i++) blockOccupancy.push(devsIn(devs, buildingAt(i, block)))
      const k = blocksFor(devs)
      const parkOccupancy: number[] = []
      for (let i = 0; i < k; i++) parkOccupancy.push(devsOnBlock(devs, i))
      const j = sitesFor(all)
      const globeOccupancy: number[] = []
      for (let i = 0; i < j; i++) globeOccupancy.push(devsOnSite(all, i))
      const at = settleLevel(currentLevel)
      return {
        level: currentLevel,
        at,
        name: LEVEL_NAMES[at],
        site: siteOf(focusSeat),
        block,
        building: plotOf(b),
        storey: focusStorey(),
        squad: squadOf(focusSeat),
        seat: focusSeat,
        storeys: n,
        buildings: m,
        blocks: k,
        sites: j,
        selected: selectedStorey,
        selectedBuilding,
        selectedBlock,
        selectedSite,
        occupancy,
        blockOccupancy,
        parkOccupancy,
        globeOccupancy,
      }
    },
    enterFloor(storey: number) {
      enterStorey(storey)
    },
    enterBuilding(b: number) {
      enterBuilding(b)
    },
    enterBlock(b: number) {
      enterBlock(b)
    },
    enterSite(i: number) {
      enterSite(i)
    },
    goToLevel(level: Level) {
      // Going *up* is a plain reframe; going down needs an address, and the
      // address is already the one the breadcrumb is naming.
      selectedStorey = level >= BUILDING ? selectedStorey : focusStorey()
      selectedBuilding = level >= BLOCK ? selectedBuilding : plotOf(buildingOf(focusSeat))
      selectedBlock = level >= PARK ? selectedBlock : blockOf(focusSeat)
      selectedSite = level >= GLOBE ? selectedSite : siteOf(focusSeat)
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
