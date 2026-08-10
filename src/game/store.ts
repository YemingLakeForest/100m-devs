/**
 * Run 1 game state — GDD §4 (production), §6 (the trap), §21 (the script).
 *
 * A tiny external store rather than a state library: GDD §23.2 non-negotiable 3
 * fixes the DOM/canvas boundary and requires that "game state lives in one
 * store both read from". Pixi reads it every frame; React subscribes. Adding
 * a dependency to hold twenty numbers would obscure that boundary rather than
 * clarify it.
 *
 * Scope is Run 1 only. No tech tree, no prestige beyond the button that ends
 * the run. **Save is local only** — GDD §24 decides the document and the
 * offline model, `save.ts` implements them, and `game-cloud` is a separate task
 * that needs Firebase credentials.
 */

import Decimal from 'break_infinity.js'
import { quote, type Multiplier, type Quote } from '../sim/hireDial.ts'
import { developerAt, type Identity } from '../sim/identity.ts'
import { outputClass, outputShare, shareSum, type OutputClass } from '../sim/output.ts'
import {
  advanceTail,
  catalogueIncome,
  catalogueOutstanding,
  rollShape,
  type Release,
} from '../sim/revenue.ts'
import { NODE_BY_ID, bpFor, canAfford, devCapFor, nodeCost } from '../sim/prestige.ts'
import {
  BANKRUPTCY_THRESHOLD,
  hireCost,
  massHireCost,
  isBankrupt,
  payrollPerSecond,
  projectRevenue,
} from '../sim/economy.ts'
import {
  D_BASE,
  SP_PER_DEV_PER_SEC,
  decayLocalEntropy,
  devEfficiency,
  efficiency,
} from '../sim/entropy.ts'
import {
  TECH_BY_ID,
  canBuyTech,
  inStandup,
  standupFactor,
  techCost,
  techEffects,
  techLevel,
  type TechEffects,
} from '../sim/techTree.ts'
import {
  advanceDevState,
  initialDevState,
  pokeDevState,
  type DevStateMachine,
} from '../sim/devStates.ts'
import { rungCrossed, spawnBurst, type Rung } from '../sim/headcount.ts'
import { SnippetBag } from './snippets.ts'
import {
  INITIAL_TOUCH_MODE,
  toggleTouch,
  type TouchLatch,
  type TouchMode,
} from './touchMode.ts'
import { SCENE_JAMES_INSTANT_MESSENGER } from './scenes.ts'
import type { DevState, ZoomLevel } from '../sim/poke.ts'
import { resolvePoke } from '../sim/poke.ts'
import { BUFF_TAU, addBuff, buffLift, decayBuffs, strengthOnSeat, type Buff } from '../sim/buffs.ts'
import { unitSeats, unitSizeAt } from '../sim/units.ts'
import {
  MASS_HIRE_COUNT,
  SEED_ROUND_AT,
  SEED_ROUND_CASH,
  REBUKE_LINE,
  advanceOnboarding,
  shouldRebuke,
  type Phase,
} from './onboarding.ts'
import {
  NODE_CI_CD_AUTOPILOT,
  offlineCapSeconds,
  offlineRateMultiplier,
  offlineYield,
  type OfflineReport,
} from '../sim/offline.ts'
import {
  emptyPermanent,
  getPermanent,
  makeSaveData,
  paradigmShiftPermanent,
  readSave,
  setPermanent,
  toDecimal,
  writeSave,
} from './save.ts'

/**
 * The Run 1 project ladder — GDD §5, Era 1.
 *
 * *Flappy Square 1.0* is 1,000 SP because §21 Act I says so, and because at
 * the 1 SP/sec baseline that is exactly the 0.1%/sec fill rate the script
 * states. **It is the only large one**, and deliberately so: it is the
 * teaching project, shipped almost entirely by thumb.
 *
 * Everything after it was resized on 2026-08-07 for §21.0's Act IIa loop. The
 * old ladder climbed 1,000 → 2,500 → 8,000, which was written for Act I's pace
 * and not for a loop that turns over four times: simulated, it put Run 1 at
 * **11.4 minutes and still only reached 36 developers**, because each project
 * grew faster than velocity did. Sized against the headcount the player
 * actually has when they reach each one, the same loop hits 40 developers in
 * **6.1 minutes** with a treasury left to gamble.
 *
 * The names still escalate in ambition while the commitments do not, which is
 * its own joke about scope.
 */
/**
 * The Run 1 ladder — GDD §4.10c.
 *
 * `payout` is authored per project rather than derived from `commitment`,
 * because **revenue per Story Point is not a constant of the universe, it is a
 * fact about your studio's reputation.** A flat $/SP was §4.10's first
 * assumption and it made the game unplayable from three developers onward: the
 * cost of a Story Point is `wage × (n−2)/n`, which climbs toward $50 and stays
 * there, so a flat $0.05/SP is six hundred times underwater at n = 5.
 *
 * The rule the ladder has to satisfy is short enough to state exactly, and
 * §4.10c derives it: profit per second is `n·r − n·W + 2·W`, so
 *
 *     d(profit)/dn = r − W
 *
 * **Hiring pays if and only if revenue per Story Point exceeds the wage per
 * developer per second.** Every payout below is chosen against that one line.
 *
 * *Flappy Square 1.0* keeps its $50 (§21 Act II states it) and is therefore
 * catastrophically below the line — which is not a flaw but the best detail in
 * the table: **your first game would have lost money the instant you hired
 * anybody.** It only turns a profit because you and James are not paid.
 */
export const PROJECTS = [
  // r = $0.05/SP. The joke, and a loss-maker the moment payroll starts.
  { name: 'Flappy Square 1.0', commitment: 1000, payout: 50 },
  // r = $62.50/SP. The first project that clears the wage, and the one that
  // funds Act IIa — shipped at two unpaid founders, so all of it is profit.
  { name: 'Flappy Square 2.0 (Now With Ads)', commitment: 400, payout: 25_000 },
  // r = $120/SP.
  { name: 'Untitled Roguelike Deckbuilder', commitment: 1000, payout: 120_000 },
  // r = $137.50/SP. The ladder's terminal rung — `maxProjectIndex` repeats it,
  // so this is the rate the studio runs at for the rest of the run.
  { name: 'Open-World Survival Craft (Early Access)', commitment: 4000, payout: 550_000 },
] as const

export interface FloatingNumeral {
  id: number
  sp: number
  x: number
  y: number
  crit: boolean
  bornAt: number
  /**
   * GDD §8.2a — the line of code the poke knocked loose. Null for an
   * Overwhelmed developer, who has nothing to say.
   */
  snippet: string | null
  /**
   * GDD §25.1, R11 — this poke was worth zero points **and that was the point**.
   *
   * §4.7 sets an Overwhelmed developer's multiplier to exactly 0: "the poke's
   * value is clearing their lockup, not the points". The maths is right and
   * the readout was wrong — a numeral saying `+0` is indistinguishable from a
   * broken button, and it was reported as one.
   *
   * Set here rather than inferred from `sp === 0` downstream, because there is
   * a second way to reach zero — §4.1's Entropy Lock taxes every poke to
   * nothing — and telling the player they *unblocked* somebody when the whole
   * studio is seized would be a worse lie than the one being fixed.
   */
  unblocked: boolean
}

/**
 * GDD §7.7.2–7.7.3 — one hire, as the renderer needs to see it.
 *
 * The store publishes the *ratio-scaled* body count rather than the raw number
 * hired, because §7.7 is explicit that the raw number is the thing that stops
 * being a feeling: at 10¹² a hire of 10⁹ is 0.1%, and the picture has to say so.
 */
export interface SpawnEvent {
  id: number
  /**
   * §7.7.3 arrival weight — {@link spawnBurst}, 1..120.
   *
   * The *spectacle* size, for tiers where one sprite is not one person. It is
   * emphatically **not** how many developers arrived, and using it as though it
   * were is what made every early hire drop a body onto the founder's head:
   * §7.7.3 scales it by the ratio, so the hire that takes a studio from one
   * developer to two is worth twelve bodies. Anything that lands on a *seat*
   * wants {@link from} and {@link to} instead.
   */
  bodies: number
  /** First seat index this hire filled, inclusive. */
  from: number
  /** Last seat index this hire filled, exclusive. */
  to: number
  /** Set when this hire crossed a §7.7.1 rung — a scored §7.7.2 construction gag. */
  promotedTo: Rung | null
  bornAt: number
}

/** A transient line over the developer's head. */
export interface Bubble {
  text: string
  bornAt: number
  /** ms. Rebukes linger; ordinary chatter does not. */
  ttl: number
}

export interface GameState {
  devs: number
  devCap: number

  cash: number
  projectIndex: number
  sprintName: string
  commitment: Decimal
  burned: Decimal
  projectsShipped: number
  lifetimeRevenue: number

  localEntropy: number
  dev: DevStateMachine
  hasCultureUpgrade: boolean

  tier: number
  zoom: ZoomLevel

  floaters: FloatingNumeral[]
  bubble: Bubble | null
  /** GDD §7.7 — the most recent hire, for the renderer's spawn puff. */
  spawn: SpawnEvent | null

  pokeCount: number
  /** Taps made while the studio is locked — drives the §6.3 rebuke. */
  desperateTaps: number

  phase: Phase
  /** Set once, so the collapse beat only fires its camera kick a single time. */
  massHired: boolean
  /** §10.10 — the hire dial's selection. Persists; a player who chose MAX meant it. */
  hireMultiplier: Multiplier
  /**
   * Story Points per second currently coming from the *thumb* — §10.1.
   *
   * A decaying rate estimate rather than a counter, so it converges on the true
   * poking rate and falls away when the player stops. Display only: `tick`
   * banks poke SP at the moment of the poke, so including this in the
   * simulation's own velocity would pay for every tap twice.
   */
  pokeRate: number
  /**
   * §4.5a — the units the player has recently poked, and by how much.
   *
   * **The per-employee state §4.5a says there is no way around**, kept as a
   * sparse decaying overlay rather than a table: a studio of ten trillion
   * carries at most `MAX_BUFFS` small objects and usually none. Unlike
   * `pokeRate` this is *not* display only — it is a real change to the rate,
   * and `tick` integrates it.
   *
   * §24.2 ephemeral, alongside `localEntropy` and `floaters`. A buff's whole
   * life is fifteen seconds; carrying one across a reload would mean restoring a
   * state the player cannot see the cause of.
   */
  buffs: Buff[]
  /**
   * §7.8.7 — the seed every developer's name, face and stats are generated
   * from. One integer stands in for the entire roster.
   *
   * Part of the *run*, not of permanent state, so a Paradigm Shift returns a
   * different studio with the same James in it (§21.6). Persisted, because a
   * reload that reshuffled forty faces would undo the whole point of them.
   */
  runSeed: number
  /**
   * §14.1 — the highest headcount this run reached.
   *
   * Tracked rather than read off `devs` at shift time, because Act V ends with
   * a bankruptcy that has already liquidated the swarm: a player who peaked at
   * a thousand and prestiges at two must be paid for the thousand.
   */
  peakDevs: number
  /**
   * The last project to ship, and what it paid — §10.8a.
   *
   * Held as an *event* with an id rather than as a flag, so the renderer and
   * the HUD can both notice it exactly once. Shipping is the loop's payoff and
   * it was completely silent: the burn-down reset, the cash readout stepped up,
   * and nothing marked the moment. A player in Act I could ship their first
   * project without realising they had.
   */
  ship: { id: number; name: string; revenue: number; at: number } | null
  /**
   * §4.10e — the back catalogue. Every game still earning, and what it has
   * paid so far.
   *
   * Run state, not permanent: a Paradigm Shift liquidates the studio and its
   * catalogue with it. Persisted, because a reload that wiped five shipped
   * games would take the player's runway with it and look exactly like the
   * bug §4.10d was reported as.
   */
  releases: Release[]

  /** §21.0a — the term sheet has been signed. Grants cash and the dial. */
  seedTaken: boolean
  /**
   * §7.8.8 — the selected developer's seat index, or null.
   *
   * A seat, not an identity. The identity is generated from it on demand
   * (§7.8.7), so selection costs one integer and survives a rebuild.
   */
  selected: number | null
  /**
   * §7.7.6b — what a tap on the room means: poke, grab, or check.
   *
   * Ephemeral, and deliberately not saved. It is an input *mode*, and a mode
   * restored from a previous session is a control the player did not set
   * looking exactly like a game that has stopped responding — you tap a
   * developer, no numeral appears, and nothing on screen explains why until you
   * find the switch. Every session opens on {@link INITIAL_TOUCH_MODE}.
   */
  touchMode: TouchMode
  /**
   * §10.10.2 — is the hire dial available?
   *
   * Gated on the Seed Round rather than on a headcount. A capability that
   * arrives because the player earned an event is a reward; one that arrives
   * because a counter crossed 25 is a surprise, and the earlier draft was the
   * latter. Outside Run 1 this is simply true from the first frame — the funnel
   * is a first-run device and re-teaching it is an insult.
   */
  dialUnlocked: boolean

  /**
   * GDD §24.8 — the Overnight Build Report waiting to be shown, or null.
   *
   * The store owns the numbers; the HUD owns the screen. Ephemeral (§24.2):
   * never serialised, recomputed from `savedAt` on every load.
   */
  pendingOffline: OfflineReport | null
  /**
   * The §21.6-class scene currently on screen, or null.
   *
   * Only the id lives in state; the script is looked up from `SCENES`. Keeping
   * the lines out of the store means a scene cannot end up in the save
   * document, where it would be a copy of the script frozen at whatever
   * revision the player last played.
   */
  scene: string | null

  /**
   * §11 — levels bought in the in-run tech tree, by node id.
   *
   * In the *run* block rather than the permanent one because §13.2 says a
   * Paradigm Shift "resets Cash, Dev Swarm Count, and In-Run Tech Upgrades".
   * The tree is what you built this time; the Paradigm Tree is what you learned.
   */
  tech: Record<string, number>

  /**
   * Seconds of simulated time since this run began — §11.2 B2's meeting clock.
   *
   * Wall-clock elapsed would drift from the simulation every time the tab was
   * backgrounded or a frame was long, and §24's offline resolution advances the
   * economy without advancing `performance.now()`. This counts the same seconds
   * the studio was actually paid for, so a meeting cannot happen while nobody
   * is working.
   */
  runSeconds: number
}

/**
 * The Sprint Commitment of the nth project, clamped to the ladder's end.
 *
 * Exported because §24.6's offline chain-shipping walks it, and it must be the
 * same walk the live game does or an absence and a session disagree about what
 * project the player is on.
 */
export function commitmentFor(index: number): Decimal {
  const clamped = Math.min(Math.max(0, Math.floor(index)), PROJECTS.length - 1)
  return new Decimal(PROJECTS[clamped].commitment)
}

/**
 * A new studio.
 *
 * `Date.now()` rather than `Math.random()` so a save written and reloaded in
 * the same millisecond is still the same studio, and so the value is a plain
 * integer the save format already knows how to carry.
 */
function newSeed(): number {
  return (Date.now() ^ (Date.now() >>> 9)) >>> 0
}

function freshRun(): GameState {
  return {
    runSeed: newSeed(),
    devs: 1,
    devCap: D_BASE,
    cash: 0,
    projectIndex: 0,
    sprintName: PROJECTS[0].name,
    commitment: new Decimal(PROJECTS[0].commitment),
    burned: new Decimal(0),
    projectsShipped: 0,
    lifetimeRevenue: 0,
    localEntropy: 0,
    dev: initialDevState(),
    hasCultureUpgrade: false,
    tier: 1,
    zoom: 1,
    floaters: [],
    bubble: null,
    spawn: null,
    pokeCount: 0,
    desperateTaps: 0,
    phase: 'act1_poke',
    massHired: false,
    hireMultiplier: 1,
    pokeRate: 0,
    buffs: [],
    peakDevs: 1,
    ship: null,
    releases: [],
    seedTaken: false,
    selected: null,
    touchMode: INITIAL_TOUCH_MODE,
    dialUnlocked: false,
    pendingOffline: null,
    scene: null,
    tech: {},
    runSeconds: 0,
  }
}

let state: GameState = freshRun()
const listeners = new Set<() => void>()
let nextFloaterId = 1
let nextSpawnId = 1

/**
 * GDD §8.2a. Module-level rather than per-poke so the shuffle bag persists —
 * a bag rebuilt on every tap would be an independent random draw, which is the
 * thing it exists not to be.
 */
const snippets = new SnippetBag()

let nextShipId = 1
/** §4.10e — one id per game put on sale, so the graph can key its bands. */
let nextReleaseId = 1

export function getState(): GameState {
  return state
}

/**
 * Test-only state injection, in the same family as `__resetStore`.
 *
 * Exists so a test can put the run in a state the *simulation* would take
 * minutes to reach — an Act III studio with an empty treasury, for instance,
 * which is a real and reachable state and a tedious one to arrive at honestly.
 * Not exported from anything the game imports.
 */
export function __setState(patch: Partial<GameState>): void {
  set(patch)
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function set(patch: Partial<GameState>): void {
  state = { ...state, ...patch }
  // Dev-only inspection seam, in the same family as `window.__stage`. Reading
  // the store from a console or a browser-automation session was otherwise
  // impossible, and "the HUD shows 2 but the scale bar says 1,000" is not a
  // question a screenshot can answer.
  if (import.meta.env?.DEV) {
    ;(globalThis as unknown as Record<string, unknown>).__store = state
  }
  for (const fn of listeners) fn()
}

// --- derived ---------------------------------------------------------------

/** §11 — what the in-run tree currently does. One object, computed in one place. */
export function techOf(s: GameState = state): TechEffects {
  return techEffects(s.tech)
}

/**
 * §4.2's capacity with §11.2's protocol nodes on it.
 *
 * The tree multiplies the cap rather than subtracting from the load because
 * §4.1 only ever sees the ratio — see the note on `TechEffects.devCapMultiplier`.
 */
export function effectiveDevCap(s: GameState = state): number {
  return s.devCap * techOf(s).devCapMultiplier
}

/**
 * Developers actually at a keyboard this frame — §11.2 B2 and B3.
 *
 * **Deliberately not the same number that generates communication load.** A
 * developer in a meeting is not coding and is *emphatically* still
 * communicating; a pair-programming studio has half as many keyboards and
 * exactly as many people to keep in the loop. So this reduces output and the
 * load keeps counting everybody, which is why §11.2 B3 has to state its 60%
 * entropy cut separately — if halving the workforce also halved the load, the
 * node would pay twice and be the only purchase in the branch worth making.
 */
export function workingDevs(s: GameState = state): number {
  const t = techOf(s)
  return s.devs * t.activeDevFraction * standupFactor(s.runSeconds, t.standups)
}

/** §11.2 — is the studio in its daily standup right now? */
export function inMeeting(s: GameState = state): boolean {
  return inStandup(s.runSeconds, techOf(s).standups)
}

export function currentEfficiency(s: GameState = state): number {
  const raw = efficiency(s.devs, effectiveDevCap(s))
  // §11.2's entropy caps, applied as an efficiency *floor* so the two readouts
  // cannot disagree — `currentEntropy` is defined as one minus this.
  //
  // Note what B2 and B4 therefore buy: at an 80% ceiling §6.3's Entropy Lock
  // can never fire again. That is the node working, not a hole. The player paid
  // for a company that cannot seize, and §25.3.2's "none of this may become a
  // fail state" is untouched — this removes one, it does not add one.
  return Math.max(1 - techOf(s).entropyCap, raw)
}

export function currentEntropy(s: GameState = state): number {
  return 1 - currentEfficiency(s)
}

/**
 * Passive swarm output, taxed by the poked developer's local entropy — and
 * **without §4.5a's buffs**.
 *
 * The unbuffed rate has to be nameable for two reasons. §24's offline
 * resolution multiplies a velocity by hours, and a player who was mid-buff when
 * they closed the tab must not earn eight hours of a fifteen-second effect. And
 * §10.1's readout splits the swarm from the thumb, which needs the two halves
 * separately rather than their sum.
 */
export function baseVelocity(s: GameState = state): number {
  // Not `passiveVelocity(devs, cap)` any more: §11 splits the headcount that
  // *produces* from the headcount that *costs*, so the two arguments come from
  // different places. With an empty tree they are the same two numbers and this
  // is the same product it always was.
  return workingDevs(s) * currentEfficiency(s) * SP_PER_DEV_PER_SEC * devEfficiency(1, s.localEntropy)
}

/**
 * What §4.5a's buffs are adding, as a fraction of the passive rate.
 *
 * Weighted by §4.9a's shares, so buffing a 10x Engineer lifts the studio by ten
 * times what buffing the person beside them would — "who you poke matters", as
 * arithmetic rather than as a second rule.
 */
export function buffMultiplier(s: GameState = state): number {
  if (s.buffs.length === 0) return 1
  return 1 + buffLift(s.buffs, s.devs, (from, to) => shareSum(s.runSeed, s.devs, from, to))
}

/**
 * The rate the studio is actually producing at — GDD §4.5a.
 *
 * Passive output with the buffs on it. **This is a real rate and `tick`
 * integrates it**, which is the whole of R14: §4.5's tap used to pay a coin and
 * be forgotten, and now most of what it is worth arrives through here over the
 * next few seconds instead.
 */
export function currentVelocity(s: GameState = state): number {
  return baseVelocity(s) * buffMultiplier(s)
}

/**
 * How fast the studio is *actually* going — passive output plus the thumb.
 *
 * §10.1 calls the VELOCITY readout "the clicker layer's scoreboard", and it was
 * showing a number the clicker layer had no effect on. In Act I that is not a
 * rounding error, it is the whole beat inverted: §21's opening asks the player
 * to poke "3–5 times a second" and feel the burn-down outpace the passive rate,
 * and the one readout claiming to measure that sat flat while they did it.
 *
 * **Display only.** `tick` banks passive SP and `poke` banks tapped SP at the
 * moment of the tap, so feeding this back into the simulation would pay for
 * every poke twice. The separation is the point of having two functions.
 */
export function currentEffectiveVelocity(s: GameState = state): number {
  return currentVelocity(s) + Math.max(0, s.pokeRate)
}

/**
 * The half of the velocity that is **the player** — §10.1, §25.1.
 *
 * > `VELOCITY: 4,120 SP/s` / `(3,880 swarm + 240 poke)`
 *
 * §25.1 calls that split "the only thing on screen that can answer *did my tap
 * do anything*", and R14 both complicates and completes it. Complicates,
 * because a poke's Story Points now arrive in two places: a quarter on the
 * frame of the tap (`pokeRate`) and the rest as a lift on the people poked
 * (`currentVelocity − baseVelocity`). Completes, because summing them is what
 * the player is actually owed an answer about — and unlike `pokeRate`, which
 * empties two seconds after they stop, this number **holds while the buffs do**.
 *
 * That is the readout finally describing the loop §4.5a asks for: it stays up
 * while the player maintains their targets and sags when they neglect them.
 */
export function pokeVelocity(s: GameState = state): number {
  return Math.max(0, s.pokeRate) + (currentVelocity(s) - baseVelocity(s))
}

// --- per-developer output — GDD §4.9a ---------------------------------------
//
// The store modelled *one* studio: one velocity, one dev-state machine, one of
// everything. §4.9a's whole point is that a studio where everybody produces the
// mean is a spreadsheet, so this is the seam where the singular becomes plural.
//
// It is a seam and not a table. Nothing per-developer is *stored* — the roll
// comes from the seat index and the run seed, the same contract §7.8.7 uses for
// names and faces — so a studio of ten trillion still costs one integer, and
// the person who is a 10x Engineer is the same person after a reload.

/**
 * Seat `index`'s output, as a multiple of the average developer — §4.9a.
 *
 * Exported rather than folded into {@link developerVelocity} because §8.2b's
 * numeral, §7.8.8's card and §14.4's hero classes all want the *ratio* rather
 * than the rate: "worth ten of the person next to them" is a comparison, and a
 * SP/sec figure at a hundred thousand developers is not one.
 */
export function developerShare(index: number, s: GameState = state): number {
  return outputShare(s.runSeed, s.devs, index)
}

/**
 * What seat `index` is producing right now, in Story Points per second — §8.2b.
 *
 * The studio's passive velocity divided among its people in proportion to their
 * roll. **The sum over the roster is the studio's velocity exactly** — see
 * `outputShare`; the shares are normalised by the mean the roster actually
 * rolled, so widening §4.9a's spread cannot move the total by a single point.
 *
 * Passive only, deliberately. The thumb's contribution is §10.1's separate
 * `poke` half of the readout and belongs to whoever was tapped, not spread
 * across a floor that was not.
 */
export function developerVelocity(index: number, s: GameState = state): number {
  if (s.devs <= 0) return 0
  // §4.5a — plus whatever the player has recently poked onto this seat, so a
  // buffed developer's §8.2b numeral visibly speeds up. **The two are the same
  // sum grouped differently**: adding this over the roster gives
  // `currentVelocity` exactly, because `buffLift` divides by the same headcount
  // and `units.ts` guarantees the seat ranges tile it.
  const lift = 1 + strengthOnSeat(s.buffs, Math.max(0, Math.floor(index)), s.devs)
  return (baseVelocity(s) / s.devs) * developerShare(index, s) * lift
}

/** §14.4 — which band of the roll this seat is in, for a card or a badge. */
export function developerClass(index: number, s: GameState = state): OutputClass {
  return outputClass(developerShare(index, s))
}

/**
 * How quickly the poke rate forgets, in seconds.
 *
 * Short enough that letting go shows up almost immediately — this is feedback
 * on what the player is doing *now* — and long enough that the number does not
 * flicker between taps at a human tapping speed. Two seconds is about four
 * pokes at §21's target rate.
 */
export const POKE_RATE_TAU = 2

/**
 * Seconds until the current project ships, at the rate it is actually going.
 *
 * `Infinity` when nothing is moving — a seized studio (§21 Act V) is not
 * "eighty seconds from a payout", it is never getting one, and §4.10d's
 * criticality test depends on telling those two apart.
 */
export function secondsToPayout(s: GameState = state): number {
  const remaining = s.commitment.minus(s.burned).toNumber()
  if (remaining <= 0) return 0
  const rate = currentEffectiveVelocity(s)
  return rate > 0 ? remaining / rate : Number.POSITIVE_INFINITY
}

/** §4.10d — what the next ship is worth, for the runway readout. */
export function nextPayout(s: GameState = state): number {
  return projectRevenue(s.projectIndex)
}

export function currentPayroll(s: GameState = state): number {
  return payrollPerSecond(s.devs)
}

/**
 * §4.10e — dollars a second coming in from games already on sale.
 *
 * Zero in Act I, and it stays zero until something ships. That is the readout
 * earning its place rather than a gap: a studio with no back catalogue *has* no
 * income between payouts, and the line arriving the moment the first game ships
 * is the clearest possible statement of what shipping bought.
 */
export function catalogueRate(s: GameState = state): number {
  return catalogueIncome(s.releases)
}

/** §4.10e — money already earned that has not arrived yet. The runway behind the runway. */
export function outstandingRevenue(s: GameState = state): number {
  return catalogueOutstanding(s.releases)
}

/**
 * Net dollars per second — what the player actually watches in Act V.
 *
 * **This used to be the burn alone**, on the correct reasoning that revenue was
 * realised on ship and there was no such thing as a running income. §4.10e
 * makes that false: the back catalogue pays continuously, and a "net" figure
 * that ignored half the flow would be the *readout* telling the lie §4.10e
 * exists to stop the *economy* telling. Act V is no less brutal for it — the
 * catalogue is four minutes deep and payroll at a thousand developers is
 * $50,000 a second, so the sign does not change; it is simply now true.
 */
export function netCashFlow(s: GameState = state): number {
  return catalogueRate(s) - currentPayroll(s)
}

export function remaining(s: GameState = state): Decimal {
  const left = s.commitment.minus(s.burned)
  return left.lt(0) ? new Decimal(0) : left
}

export function burnedFraction(s: GameState = state): number {
  if (s.commitment.lte(0)) return 1
  return Math.min(1, s.burned.div(s.commitment).toNumber())
}

export function isLocked(s: GameState = state): boolean {
  return currentEntropy(s) >= 0.99
}

// --- actions ---------------------------------------------------------------

function showBubble(text: string, ttl = 4000): Partial<GameState> {
  return { bubble: { text, bornAt: performance.now(), ttl } }
}

/** Ship the current project and roll to the next — §21 Act II. */
function shipProject(s: GameState): Partial<GameState> {
  const tech = techEffects(s.tech)
  // §11.2 B3 doubles the payout and §11.3 C9 takes the consultants' 10%. Both
  // land on the ladder's figure rather than on the tail, so §4.10e's integral
  // still pays out exactly what the release says it is worth.
  const revenue = projectRevenue(s.projectIndex) * tech.revenueMultiplier
  const nextIndex = Math.min(s.projectIndex + 1, PROJECTS.length - 1)
  const next = PROJECTS[nextIndex]

  return {
    // §10.8a — the moment gets an event. Named with the project that just
    // shipped rather than the one now starting: the celebration is *for* the
    // thing that finished, and by the time it renders `sprintName` has already
    // moved on.
    //
    // `revenue` here is still the whole §4.10c payout, and the toast still
    // announces all of it. §4.10e changes when the money *arrives*, not what
    // the game is worth, and a celebration that read "+$3,200, the rest to
    // follow" would be describing an accounting policy rather than a launch.
    ship: { id: nextShipId++, name: s.sprintName, revenue, at: performance.now() },
    // §4.10e — no lump. The game goes on sale and starts earning; `tick` banks
    // the tail. The books stay afloat between ships because the *catalogue*
    // covers the burn, which is the whole point of the change.
    releases: [
      ...s.releases,
      {
        id: nextReleaseId++,
        name: s.sprintName,
        payout: revenue,
        age: 0,
        paid: 0,
        shape: rollShape(s.runSeed, s.projectsShipped),
      },
    ],
    projectsShipped: s.projectsShipped + 1,
    projectIndex: nextIndex,
    sprintName: next.name,
    // §11.3 C10 — "it's basically done". A flat 5% off every burn-down, for
    // ever. Applied to the commitment itself rather than to the ship test, so
    // §10.4's burn-down bar still reaches its own end and the player is not
    // watching a gauge that ships at 95% full.
    commitment: new Decimal(next.commitment).times(tech.commitmentFraction),
    burned: new Decimal(0),
  }
}

/**
 * The Story Points a set of just-expired buffs still owed — GDD §4.5a.
 *
 * A buff of strength `s` on a unit producing `u` per second is worth `s · u ·
 * τ` from here on, which is the same arithmetic `sim/buffs.ts` used to create
 * it, run backwards. `buffs.ts` cannot do this itself because it deliberately
 * does not know what a developer is worth (§4.9a) — it takes the shares as a
 * question, and this is the answer.
 */
function settleDroppedBuffs(dropped: readonly Buff[], s: GameState): number {
  if (dropped.length === 0 || s.devs <= 0) return 0
  const perSecond = baseVelocity(s) / s.devs
  if (!(perSecond > 0)) return 0

  let owed = 0
  for (const b of dropped) {
    const { from, to } = unitSeats(b.rung, b.index, s.devs)
    if (to > from) owed += b.strength * perSecond * shareSum(s.runSeed, s.devs, from, to) * BUFF_TAU
  }
  return owed
}

/** Advance the simulation. Driven by the Pixi ticker so both layers share a clock. */
export function tick(dtSeconds: number): void {
  if (dtSeconds <= 0 || state.phase === 'bankrupt') return

  const e = currentEntropy()
  const localEntropy = decayLocalEntropy(state.localEntropy, dtSeconds)
  // §4.5a — the buffs fade before they are integrated, so a poke pays for the
  // frame after it and not for the frame it happened on. That frame's value is
  // the instant payout `poke` already banked.
  const decayed = decayBuffs(state.buffs, dtSeconds)
  const buffs = decayed.buffs
  // NOT `currentEffectiveVelocity` — see its note. `currentVelocity` carries
  // §4.5a's buffs because they are a real rate; `pokeRate` is display only and
  // its Story Points were banked by `poke` at the moment of the tap.
  const gained = currentVelocity({ ...state, localEntropy, buffs }) * dtSeconds
  // What the buffs that just expired had left to give — see `decayBuffs`. The
  // last few per cent of a poke, paid rather than swallowed, so what a tap is
  // worth does not quietly depend on how big the studio was when it landed.
  const settled = settleDroppedBuffs(decayed.dropped, { ...state, localEntropy })

  // §4.10e — the back catalogue pays first, before anything reads the cash.
  const tail = advanceTail(state.releases, dtSeconds)

  let patch: Partial<GameState> = {
    localEntropy,
    buffs,
    // §11.2 B2's meeting clock. Simulated seconds, not wall-clock — see the
    // field's note. Advanced before anything reads it so the standup boundary
    // lands on the same frame the velocity does.
    runSeconds: state.runSeconds + dtSeconds,
    // Exponential decay towards zero. Paired with the impulse `poke` adds, this
    // settles on the player's true taps-per-second rather than spiking on each
    // one — a readout that jumped to a huge number and back on every tap would
    // be unreadable at the rate §21 asks them to tap.
    pokeRate: state.pokeRate * Math.exp(-dtSeconds / POKE_RATE_TAU),
    dev: advanceDevState(state.dev, dtSeconds, {
      entropy: e,
      // §11.3 C2 — the chairs only shorten the lockup, never Flow.
      overwhelmedScale: techOf().overwhelmedScale,
    }),
    cash: state.cash - currentPayroll() * dtSeconds + tail.earned,
    lifetimeRevenue: state.lifetimeRevenue + tail.earned,
    releases: tail.releases,
    burned: gained + settled > 0 ? state.burned.plus(gained + settled) : state.burned,
  }

  const now = performance.now()
  const floaters = state.floaters.filter((f) => now - f.bornAt < 900)
  if (floaters.length !== state.floaters.length) patch.floaters = floaters

  if (state.bubble && now - state.bubble.bornAt > state.bubble.ttl) patch.bubble = null

  // Ship, if the burn-down reached zero this frame.
  const merged = { ...state, ...patch } as GameState
  if (merged.burned.gte(merged.commitment)) {
    patch = { ...patch, ...shipProject(merged) }
  }

  const after = { ...state, ...patch } as GameState
  const bankrupt = isBankrupt(after.cash)

  patch.phase = advanceOnboarding(after.phase, {
    seedTaken: after.seedTaken,
    pokeCount: after.pokeCount,
    devs: after.devs,
    projectsShipped: after.projectsShipped,
    cash: after.cash,
    entropy: currentEntropy(after),
    bankrupt,
  })

  set(patch)
}

/**
 * What a tap landed on — GDD §4.5b, §7.7.1.
 *
 * A rung and which unit at it. In the room that is a seat; above it a floor, a
 * building, a town. `units.ts` turns the pair into the seats it covers.
 */
export interface PokeTarget {
  rung: number
  index: number
}

/**
 * How much of a poke is paid on the frame of the tap — GDD §4.5a.
 *
 * > The one-off payout does not vanish entirely, because instant feedback on a
 * > tap is non-negotiable (10.8 F2). It is now the *smaller* half of what a poke
 * > does, and the buff is the larger.
 *
 * A quarter is unambiguously the smaller half. **It is not a balance knob** —
 * the other three quarters are converted into a buff that pays them back over
 * {@link BUFF_TAU}, so moving this changes when a poke arrives and never what
 * it is worth.
 */
export const POKE_PAYOUT_SHARE = 0.25

/**
 * Resolve one tap — the whole clicker layer, GDD §4.5, §4.5a, §4.5b.
 *
 * `target` is the unit that was under the thumb. Defaulting it to one
 * developer at rung 0 is what `poke(x, y)` means for the §23.3 bench and for
 * Run 1's simulation: the founder's own desk, one person, §4.8's L1 yield.
 *
 * **The formula below is §4.5's, unchanged.** §4.5a is explicit that "4.7's dev
 * states still scale it, 4.6's Fibonacci ladder still sets the base, and 4.1's
 * Entropy still taxes it. What changes is the *destination* of the number." So
 * what changed here is the last third of the function: a quarter of the Story
 * Points are banked now, and the rest becomes a buff on the thing that was
 * poked.
 */
export function poke(x: number, y: number, target: PokeTarget | null = null) {
  // §10.6 says the swarm keeps simulating behind a panel, but the poke path is
  // inert while a scene is up: the dialogue box is eating those taps for its
  // own advance, and a tap that both advances a page and banks a Story Point
  // is the player being charged Entropy for reading.
  if (state.scene !== null) {
    return { sp: 0, localEntropyAdded: 0, crit: false, quits: false }
  }
  if (state.phase === 'bankrupt') {
    return { sp: 0, localEntropyAdded: 0, crit: false, quits: false }
  }

  const rung = Math.max(0, Math.floor(target?.rung ?? 0))
  const index = Math.max(0, Math.floor(target?.index ?? 0))

  // §4.5b — the reach is the unit that was actually hit, not a zoom band. A tap
  // in the room lands on one person, which is what §7.7.6's "the actual
  // developer under the thumb" has always promised and what §4.8's row-shaped
  // blast radius quietly contradicted once §7.4a made rungs 0–2 all the room.
  const unitSize = Math.max(1, unitSizeAt(rung, index, state.devs))
  const seats = unitSeats(rung, index, state.devs)

  const base = resolvePoke({
    // §11.3's estimation sub-branch is the only thing that moves the ladder, so
    // the tree's tier wins wherever it is higher. `state.tier` stays as the
    // floor rather than being deleted: §24 already persists it, and a save from
    // before the tree existed carries a tier that was legitimately earned.
    tier: Math.max(state.tier, techOf().estimationTier),
    state: state.dev.state,
    zoom: state.zoom,
    efficiency: currentEfficiency(),
    devs: state.devs,
    unitSize,
  })

  // §4.9a — the tap is worth what the people you poked are worth, summed over
  // the unit and divided by its size because `resolvePoke` has already charged
  // for the reach. In the room that is exactly `developerShare(index)`.
  //
  // Applied to the Story Points only: the Entropy a context switch costs is a
  // fact about being interrupted, and a 10x Engineer is not cheaper to
  // interrupt than anybody else. If anything they are dearer, but that is
  // §4.5c's business.
  const unitWorth = seats.to > seats.from ? shareSum(state.runSeed, state.devs, seats.from, seats.to) : 1
  const result = { ...base, sp: (base.sp * unitWorth) / unitSize }

  // §4.5a — the destination. What the unit currently produces is what a
  // percentage has to be a percentage *of*, so the strength is solved against
  // it rather than picked; see `sim/buffs.ts`. A negative poke (a Rogue
  // Refactorer gives points back) is not a buff and is paid straight through.
  const unitOutput = state.devs > 0 ? (baseVelocity() / state.devs) * unitWorth : 0
  const banked = result.sp > 0 ? result.sp * POKE_PAYOUT_SHARE : result.sp
  const converted = result.sp > 0 ? result.sp - banked : 0
  const buffed = addBuff(state.buffs, { rung, index }, converted, unitOutput)

  // §11.3 C1 — Nitro Cold Brew. `hasCultureUpgrade` was this effect before
  // there was a tree to own it, and it is still honoured: the field predates
  // §11 and a save that has it set earned it.
  const { machine, devLeaves } = pokeDevState(
    state.dev,
    state.hasCultureUpgrade || techOf().flowSurvivesPoke,
  )

  const floater: FloatingNumeral = {
    id: nextFloaterId++,
    sp: result.sp,
    x,
    y,
    crit: result.crit,
    // Read from the state before the poke resolved, like the snippet below and
    // for the same reason: what you interrupted, not what you made of them.
    unblocked: state.dev.state === 'overwhelmed',
    bornAt: performance.now(),
    // Read from the state BEFORE the poke resolved: the line is what they were
    // doing when you interrupted them, not what your interruption made of them.
    snippet: snippets.next(state.dev.state),
  }

  const locked = isLocked()
  const desperateTaps = locked ? state.desperateTaps + 1 : state.desperateTaps

  // §4.5a — what lands now. The quarter this poke pays immediately, plus
  // anything the buff could not take: a unit already at the strength ceiling,
  // or a seized studio with no rate to raise. Nothing is lost in either
  // direction, which is what makes "a poke is worth what §4.5 says it is" an
  // invariant rather than an intention.
  const paidNow = banked + buffed.overflow

  const patch: Partial<GameState> = {
    burned: state.burned.plus(paidNow),
    localEntropy: state.localEntropy + result.localEntropyAdded,
    buffs: buffed.buffs,
    // The impulse half of the rate estimate. Dividing by the time constant is
    // what makes a steady R points per second converge on exactly R.
    pokeRate: state.pokeRate + paidNow / POKE_RATE_TAU,
    floaters: [...state.floaters, floater],
    pokeCount: state.pokeCount + 1,
    desperateTaps,
    dev: machine,
    // The 10x Engineer quits permanently on the poke that cashes them out.
    devs: devLeaves ? Math.max(1, state.devs - 1) : state.devs,
  }

  // §6.3 — the thesis, delivered by the person being interrupted.
  if (shouldRebuke(desperateTaps, currentEntropy())) {
    Object.assign(patch, showBubble(REBUKE_LINE, 6000))
  } else if (state.pokeCount === 0) {
    // §21 Act I's first-poke teaching moment: establishes the Fibonacci ladder
    // in one line, with no tutorial box.
    Object.assign(patch, showBubble('It’s a one. Everything is a one right now.'))
  }

  set(patch)
  return result
}

/**
 * GDD §7.7.2–7.7.3 — the patch that makes a hire visible.
 *
 * Every path that changes headcount upward goes through here, so there is
 * exactly one place the ladder can be forgotten. The renderer reads `spawn`;
 * nothing else does.
 */
function hire(before: number, after: number): Partial<GameState> {
  return {
    devs: after,
    peakDevs: Math.max(state.peakDevs, after),
    spawn: {
      id: nextSpawnId++,
      bodies: spawnBurst(before, after),
      // The seats this hire actually took. Every path that changes headcount
      // upward goes through here, so this is the one place the range can be
      // wrong — and the one place it can be right.
      from: Math.max(0, Math.floor(before)),
      to: Math.max(0, Math.floor(after)),
      promotedTo: rungCrossed(before, after),
      bornAt: performance.now(),
    },
  }
}

/**
 * §14.1 — BP awarded by the most recent Paradigm Shift, for the screen that
 * announces it. Module state rather than game state: it belongs to the moment
 * rather than to the run, and a run that has just been replaced cannot hold it.
 */
let lastShiftBp = 0

export function bpFromLastShift(): number {
  return lastShiftBp
}

/**
 * §11 — spend cash on an in-run tech node.
 *
 * Saves on purchase, like `buyParadigmNode`: a node bought and then lost to a
 * crash is money the player watched leave and got nothing for, which is the
 * one accounting error an idle game may never make.
 */
export function buyTech(id: string): boolean {
  const node = TECH_BY_ID.get(id)
  if (!node) return false
  const level = techLevel(state.tech, id)
  if (!canBuyTech(node, state.tech, state.cash)) return false

  set({
    cash: state.cash - techCost(node, level),
    tech: { ...state.tech, [id]: level + 1 },
  })
  saveGame()
  return true
}

/** What the next level of a node costs, or null if it cannot be bought at all. */
export function techQuote(id: string, s: GameState = state) {
  const node = TECH_BY_ID.get(id)
  if (!node) return null
  const level = techLevel(s.tech, id)
  return {
    node,
    level,
    cost: techCost(node, level),
    maxed: level >= node.maxLevel,
    unlocked: node.requires === undefined || techLevel(s.tech, node.requires) > 0,
    affordable: canBuyTech(node, s.tech, s.cash),
  }
}

/** §13.2 — spend BP on a Paradigm Tree node. */
export function buyParadigmNode(id: string): boolean {
  const node = NODE_BY_ID.get(id)
  if (!node) return false
  const p = getPermanent()
  const level = p.layer1.paradigmLevels[id] ?? 0
  if (!canAfford(node, level, p.layer1.bp)) return false

  const levels = { ...p.layer1.paradigmLevels, [id]: level + 1 }
  setPermanent({
    ...p,
    layer1: {
      ...p.layer1,
      bp: p.layer1.bp - nodeCost(node, level),
      paradigmNodes: p.layer1.paradigmNodes.includes(id)
        ? p.layer1.paradigmNodes
        : [...p.layer1.paradigmNodes, id],
      paradigmLevels: levels,
    },
  })
  // §4.2 — the cap moves immediately. Buying capacity and not feeling it until
  // the next run would make the tree a shopping list rather than a decision.
  set({ devCap: devCapFor(levels) })
  saveGame()
  return true
}

/**
 * §13.2 — the permanent block, re-exported for the tree screen.
 *
 * It lives in `save.ts` and the interface has no business importing from there:
 * §24's document format is the store's private business, and a component
 * reaching past the store to read it is how a save-format change starts
 * breaking panels.
 */
export { getPermanent }

/** What the next developer costs right now — §21.0. */
export function nextHireCost(s: GameState = state): number {
  return hireCost(s.devs)
}

export function canHire(s: GameState = state): boolean {
  return hireQuote(s).affordable
}

/**
 * §21.0a — accept the term sheet.
 *
 * The only beat in Run 1 that is pure upside, and it still has to be *taken*:
 * §6's lesson needs every step into the trap to have been a decision, including
 * the ones that felt like good news at the time. It is also the moment the
 * money stops being the player's — which is what makes Act V's bankruptcy land
 * on somebody else's investment rather than on their savings.
 */
export function takeSeedRound(): boolean {
  if (state.seedTaken) return false
  set({
    seedTaken: true,
    dialUnlocked: true,
    cash: state.cash + SEED_ROUND_CASH,
    ...showBubble('Wait, we can just… hire more people now?', 6000),
  })
  return true
}

/**
 * §7.8.8 — select a developer, or clear the selection.
 *
 * Deliberately *not* a poke. §8.2's tap is the game's primary verb and fires
 * hundreds of times a session; selection is a different intent with a different
 * payoff, and giving the two the same gesture would mean either poking opened a
 * panel — unusable — or selection needed a mode.
 *
 * **It needed a mode** (§7.7.6b). The sentence above was written when the two
 * were told apart by how long the finger rested, and that is what was reported
 * as uncontrollable from a phone. Selection is now the neutral latch rather
 * than a slow tap — which is the same conclusion, reached by the player.
 */
export function selectDeveloper(index: number | null): void {
  const next = index !== null && index >= 0 ? index : null
  if (next === state.selected) return
  set({ selected: next })
}

/** §7.8.8 — who is selected, generated on demand. Null if nobody. */
export function selectedIdentity(s: GameState = state): Identity | null {
  return s.selected === null ? null : developerAt(s.runSeed, s.selected)
}

/**
 * §7.7.6b — press a latch on the touch switch.
 *
 * Leaving GRAB drops whoever is in the player's hand — the renderer owns the
 * carry and watches the mode for exactly this, because a developer stuck
 * mid-air because the mode changed under them is the §7.7.6a failure with a new
 * cause. Leaving `inspect` closes the card for the same reason: the panel is a
 * consequence of the mode, so it should not outlive it.
 */
export function setTouchMode(latch: TouchLatch): void {
  const next = toggleTouch(state.touchMode, latch)
  if (next === state.touchMode) return
  set({ touchMode: next, ...(next === 'inspect' ? {} : { selected: null }) })
}

/** §10.10 — set the dial. Pure selection; nothing is bought until HIRE. */
export function setHireMultiplier(m: Multiplier): void {
  set({ hireMultiplier: m })
}

/**
 * What the dial is currently offering — count, price, and whether it is live.
 *
 * Derived rather than stored, because MAX's count changes on its own as cash
 * accrues (§10.10.1) and a stored copy would be one frame stale on the only
 * segment where that is visible.
 */
export function hireQuote(s: GameState = state): Quote {
  // A locked dial is pinned to one at a time, whatever the stored selection
  // says — a save carried across a Paradigm Shift must not hand a fresh Act I
  // player a x100 button.
  return quote(s.devs, s.cash, s.dialUnlocked ? s.hireMultiplier : 1)
}

/**
 * §21 Act II and the §21.0 loop — hire developers, for money.
 *
 * Hiring used to be free, which quietly removed the whole of Act IIa: with no
 * cost there is no loop, no reason to ship, and no treasury to spend on the
 * trap. §21.0's "each hire is bought with money the player made, costs more
 * than the last, and *works*" needs all three clauses, and only the third was
 * true.
 *
 * Returns false rather than throwing or silently succeeding, so the caller can
 * say why. A hire the player cannot afford must not leave them poorer.
 */
export function hireDeveloper(): boolean {
  // §10.10 — the dial decides the batch. It reads 1 until the dial unlocks at
  // 25 developers, so Act I and Act II behave exactly as they did.
  const { count, cost, affordable } = hireQuote()
  if (!affordable || count <= 0) return false
  set({ ...hire(state.devs, state.devs + count), cash: state.cash - cost })
  return true
}

/** What the mousetrap costs — §21.0. Everything, by design. */
export function currentMassHireCost(s: GameState = state): number {
  return massHireCost(s.cash)
}

/**
 * Can the player actually spring the trap right now?
 *
 * §4.10a claimed the Mass Hire was "always affordable and always ruinous",
 * which is true of the *price* and not of the player: payroll runs continuously
 * and can empty the treasury faster than shipping refills it, so a studio can
 * sit in Act III with less than the minimum. The offer stays on screen, priced
 * and disabled — hiding it would delete the beat the whole act is built on.
 */
export function canMassHire(s: GameState = state): boolean {
  return !s.massHired && s.cash >= currentMassHireCost(s)
}

/**
 * §21 Act III/IV — the mousetrap, and it is no longer free.
 *
 * "Cost: FREE (Trial Promo)" made it a button rather than a decision, and §6
 * is explicit that the lesson needs the player to *choose* it. It now takes
 * the entire treasury: always affordable, always ruinous, and leaving exactly
 * zero buffer — which is what makes Act V's bankruptcy arrive in seconds
 * rather than needing a scripted nudge.
 */
export function massHire(): boolean {
  if (state.massHired) return false
  const cost = currentMassHireCost()
  // The offer is priced at the whole treasury with a floor under it, so a
  // player whose treasury is *below* that floor cannot pay — and this was not
  // checked. Pressing it at $0 charged $50 and took them to -$50: a control
  // labelled "Cost: YOUR ENTIRE TREASURY" completing successfully against an
  // empty one. Every other spend in the game refuses; this one has to as well.
  if (state.cash < cost) return false
  set({
    ...hire(state.devs, state.devs + MASS_HIRE_COUNT),
    cash: state.cash - cost,
    massHired: true,
    ...showBubble('Wait — who’s writing this function?', 6000),
  })
  return true
}

/**
 * §21 Act V — the run ends and Layer 1 prestige unlocks.
 *
 * James survives the bankruptcy; every other developer is liquidated. For now
 * this restarts Run 1, because the prestige tree (§13) does not exist yet —
 * the button is wired to the right moment, not to the right destination.
 */
export function triggerParadigmShift(): void {
  const run = freshRun()
  // §14.1 — what the run was worth. Computed before the reset, and from the
  // *permanent* high-water marks rather than the live ones: Act V ends with a
  // bankruptcy that has already liquidated the swarm, so a player who peaked at
  // a thousand developers and prestiges at two must be paid for the thousand.
  const before = getPermanent()
  const earned = bpFor(
    Math.max(before.meta.lifetimeRevenue, state.lifetimeRevenue),
    Math.max(before.meta.peakDevs, state.peakDevs),
  )
  lastShiftBp = earned

  // §24.4 — a Paradigm Shift clears the run and touches nothing permanent
  // except Layer 1. §24.5 gates offline accrual on the first one, so the
  // counter is the unlock.
  setPermanent(paradigmShiftPermanent(before, earned))
  set({
    ...run,
    // §4.2 — the cap the tree has bought, applied to the new run. Reading it
    // from `freshRun()` would hand every prestige back the base hundred.
    devCap: devCapFor(getPermanent().layer1.paradigmLevels),
    // "So. Same time tomorrow?"
    devs: 2,
    /**
     * **Run 2 opens on the loop, not on the trap.**
     *
     * This said `act3_bait`, which meant a Paradigm Shift dropped the player at
     * Act III with two developers and no money: the mousetrap on screen, priced
     * at a treasury they did not have, and the only exit from that phase being
     * `devs > 502`. There is no way to hire five hundred people on nothing, so
     * the offer sat there greyed out **for ever** and the run could not advance.
     * That is what "the HIRE 1,000 DEVS button is always there" was.
     *
     * §21.6 is Run 2 *Act 0* — James arriving with Instant Messenger — and Act 0
     * is the start of a run, not its penultimate beat.
     */
    phase: 'act2b_loop',
    projectsShipped: 1,
    // §10.10.2 — "outside Run 1 the dial is simply present from the first
    // frame. The funnel is a first-run device and re-teaching it is an insult."
    // The seed round is the same: it is a story beat, and it has happened.
    seedTaken: true,
    dialUnlocked: true,
    // §21.6 — Run 2 opens on James. The scene rather than the bubble carries
    // the beat now; the bubble stays for the runs after this one, when the
    // scene has already played and the line is all that is left of it.
    scene: SCENE_JAMES_INSTANT_MESSENGER.id,
    ...showBubble('So. Same time tomorrow?', 6000),
  })
  // §24.9 — a prestige is the highest-value write in the game. Do not wait for
  // a backgrounding that may never come.
  saveGame()
}

/**
 * Put a scene on screen — GDD §21.6.
 *
 * Idempotent for the scene already showing, because the phase machine can
 * satisfy a trigger on several consecutive frames and restarting a typed page
 * under the player's thumb is the worst possible failure of §10.7 rule 2.
 */
export function showScene(id: string): void {
  if (state.scene === id) return
  set({ scene: id })
}

/**
 * Dismiss the current scene and mark it seen.
 *
 * `milestones` is a monotonic union in permanent state (§24.3), so "seen" is
 * one of the few facts that survives a Paradigm Shift, a Codebase Fork and a
 * reinstall-with-cloud-save. That is deliberate: §10.7's faster replay is
 * per-line across runs, and a player on Run 40 who is made to sit through
 * James's introduction at full typing speed for the fortieth time will hate
 * the one thing this game is made of.
 */
export function dismissScene(): void {
  const id = state.scene
  if (!id) return
  const permanent = getPermanent()
  if (!permanent.meta.milestones.includes(id)) {
    setPermanent({
      ...permanent,
      meta: { ...permanent.meta, milestones: [...permanent.meta.milestones, id] },
    })
    // A scene is cheap to re-show and expensive to lose. Write now rather than
    // waiting for a backgrounding that may never come (§24.9).
    saveGame()
  }
  set({ scene: null })
}

/** Has this scene been played to the end before? §10.7's replay exception. */
export function hasSeenScene(id: string): boolean {
  return getPermanent().meta.milestones.includes(id)
}

export function setZoom(zoom: ZoomLevel): void {
  if (zoom !== state.zoom) set({ zoom })
}

/** Test/debug seam — drives the dev-only dev-state selector. */
export function setDevState(devState: DevState): void {
  set({ dev: { state: devState, elapsed: 0 } })
}

export function __resetStore(): void {
  state = freshRun()
  nextFloaterId = 1
  nextSpawnId = 1
  setPermanent(emptyPermanent())
  pendingSnapshot = null
  for (const fn of listeners) fn()
}

// --- persistence -----------------------------------------------------------
//
// GDD §24. The document lives in save.ts; this is the wiring. `game-cloud` is
// not connected — that needs Firebase credentials and is its own task — but
// `makeSaveData` is already exactly the `serialize` contract it will call, so
// the wiring is additive rather than a rewrite.

/**
 * The absence being reported, kept so the MONETISATION §4 R1 2x offer can be
 * *recomputed* rather than post-multiplied.
 *
 * Doubling `report.storyPoints` after the fact would be wrong the moment
 * chain-shipping is in play: twice the Story Points can ship a further project,
 * and a doubled total that ships one fewer game is a number the player can
 * catch us on.
 */
let pendingSnapshot: { savedAt: number; rateMultiplier: number; capSeconds: number } | null = null

/** Write the save. Cheap enough to call on any beat worth not losing. */
export function saveGame(): boolean {
  return writeSave(makeSaveData(state))
}

/**
 * Load, and resolve the absence — §24.5.
 *
 * `now` is a parameter rather than a call to `Date.now()` so the whole path is
 * testable without touching the system clock, which is the one thing a save
 * system must be able to lie about in a test.
 *
 * Returns the §24.8 report if one should be shown, and null otherwise. The
 * yield is **not applied here**: it lands on collect, so the player sees where
 * the numbers went (§24.8).
 */
export function loadGame(now: number = Date.now()): OfflineReport | null {
  const save = readSave()
  if (!save) return null

  setPermanent(save.permanent)
  const { layer1, meta } = save.permanent
  const r = save.run

  const commitment = toDecimal(r.commitment, commitmentFor(r.projectIndex))
  const restored: GameState = {
    ...freshRun(),
    devs: r.devs,
    peakDevs: Math.max(r.devs, save.permanent.meta.peakDevs),
    // §4.2 — derived from the tree, never from the saved run. A cap read back
    // out of run state would silently keep whatever it was when the file was
    // written, so a node bought on another device would appear to do nothing.
    devCap: devCapFor(save.permanent.layer1.paradigmLevels),
    cash: r.cash,
    projectIndex: r.projectIndex,
    sprintName: PROJECTS[Math.min(r.projectIndex, PROJECTS.length - 1)].name,
    commitment,
    burned: toDecimal(r.burned, new Decimal(0)),
    projectsShipped: r.projectsShipped,
    lifetimeRevenue: meta.lifetimeRevenue,
    hasCultureUpgrade: r.hasCultureUpgrade,
    tier: r.tier,
    pokeCount: r.pokeCount,
    desperateTaps: r.desperateTaps,
    phase: r.phase,
    // §21.0a — both were persisted and neither was read back, so a returning
    // player lost the dial and was offered the term sheet a second time. The
    // save has carried these since they existed; only the restore was missing.
    seedTaken: r.seedTaken,
    dialUnlocked: r.dialUnlocked,
    massHired: r.massHired,
    // §11 — the tree you built this run, and the meeting clock that goes with
    // it. `?? {}` rather than a bare read: the fields are optional on the save
    // (older documents predate the tree) and a spread of `undefined` would put
    // `undefined` into a field every derived function indexes.
    tech: r.tech ?? {},
    runSeconds: r.runSeconds ?? 0,
    // §4.10e — the back catalogue comes back with its ages and its shapes. A
    // reload that wiped five shipped games would take the studio's whole
    // runway with it, and would be reported as exactly the §4.10d bug the
    // tail was built to fix.
    releases: (r.releases ?? []).map((rel) => ({
      id: rel.id,
      name: rel.name,
      payout: rel.payout,
      age: rel.age,
      paid: rel.paid,
      shape: { spikeShare: rel.spikeShare, spikeTau: rel.spikeTau, tailTau: rel.tailTau },
    })),
    // localEntropy, floaters, bubble, spawn and zoom are §24.2 ephemeral. Local
    // entropy in particular decays to baseline in ~8 seconds (§4.9), so any
    // absence long enough to save through has already erased it — it restores
    // to zero by definition, not by choice.
  }

  const capSeconds = offlineCapSeconds(layer1.paradigmNodes, meta.entitlements)
  const rateMultiplier = offlineRateMultiplier(layer1.paradigmLevels, meta.entitlements)
  const config = {
    capSeconds,
    rateMultiplier,
    // §24.5 — offline accrual does not exist during Run 1. §21 paces Run 1 at
    // about four minutes and scripts every beat of it; an overnight summary
    // landing mid-trap would resolve §6's lesson while the player was asleep.
    unlocked: meta.paradigmShifts > 0,
  }

  const report = offlineYield(
    {
      savedAt: save.savedAt,
      // Recomputed from the restored run rather than stored, so it can never
      // disagree with the state it is derived from. **Unbuffed** — §4.5a's
      // buffs live fifteen seconds and this number is about to be multiplied by
      // hours; a restored run has none anyway (§24.2), and naming the base rate
      // here is what keeps that true if one ever survives a reload.
      velocity: baseVelocity(restored),
      maxProjectIndex: PROJECTS.length - 1,
      commitment: restored.commitment,
      burned: restored.burned,
      projectIndex: restored.projectIndex,
      commitmentFor,
      revenueFor: projectRevenue,
      autoShip: meta.forkNodes.includes(NODE_CI_CD_AUTOPILOT),
    },
    config,
    now,
  )

  pendingSnapshot = report.qualifies ? { savedAt: save.savedAt, rateMultiplier, capSeconds } : null
  state = { ...restored, pendingOffline: report.qualifies ? report : null }
  for (const fn of listeners) fn()
  return state.pendingOffline
}

/**
 * Bank the offline yield — the §24.8 collect button.
 *
 * `rewardMultiplier` is 2 for MONETISATION §4 R1's OVERNIGHT BUILD. **Collect
 * is never gated on it**: the ad is an upgrade to a payout the player already
 * owns, so a 1x collect must always be available and must always work.
 */
export function collectOffline(rewardMultiplier = 1, now: number = Date.now()): void {
  const snap = pendingSnapshot
  if (!snap || !state.pendingOffline) return

  const report = offlineYield(
    {
      savedAt: snap.savedAt,
      // Unbuffed, for the same reason as the restore path above: a player who
      // was mid-poke when they closed the tab must not earn eight hours of a
      // buff that would have faded in fifteen seconds.
      velocity: baseVelocity(state),
      maxProjectIndex: PROJECTS.length - 1,
      commitment: state.commitment,
      burned: state.burned,
      projectIndex: state.projectIndex,
      commitmentFor,
      revenueFor: projectRevenue,
      autoShip: getPermanent().meta.forkNodes.includes(NODE_CI_CD_AUTOPILOT),
    },
    {
      capSeconds: snap.capSeconds,
      rateMultiplier: snap.rateMultiplier * Math.max(1, rewardMultiplier),
      unlocked: true,
    },
    now,
  )

  const revenue = report.revenue.toNumber()
  const permanent = getPermanent()
  setPermanent({
    ...permanent,
    meta: {
      ...permanent.meta,
      // Capped seconds, not elapsed: §22.5 #6 rewards banked offline time, and
      // crediting a fortnight's absence as a fortnight would earn Bruno for
      // uninstalling the game.
      totalOfflineSeconds: permanent.meta.totalOfflineSeconds + report.paidSeconds,
      lifetimeRevenue: permanent.meta.lifetimeRevenue + revenue,
      lifetimeProjectsShipped: permanent.meta.lifetimeProjectsShipped + report.projectsShipped,
    },
  })

  pendingSnapshot = null
  set({
    burned: report.burned,
    commitment: report.commitment,
    projectIndex: report.projectIndex,
    sprintName: PROJECTS[Math.min(report.projectIndex, PROJECTS.length - 1)].name,
    projectsShipped: state.projectsShipped + report.projectsShipped,
    cash: state.cash + revenue,
    lifetimeRevenue: state.lifetimeRevenue + revenue,
    pendingOffline: null,
  })
  saveGame()
}

/**
 * Save on backgrounding, not on quit — SAVE.md §5.2, GDD §24.9.
 *
 * A save written at the last *interaction* under-counts the away period by
 * however long the phone sat on the desk with the game open, which is the most
 * common way an idle game is left. `pagehide` is belt and braces: an Android
 * WebView is not obliged to give us both, and the one it withholds is the one
 * that mattered.
 */
export function installAutoSave(): () => void {
  if (typeof document === 'undefined') return () => {}

  const onHide = () => {
    if (document.visibilityState === 'hidden') saveGame()
  }
  const onPageHide = () => saveGame()

  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onPageHide)
  return () => {
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onPageHide)
  }
}

/**
 * Load the save and start persisting. Idempotent.
 *
 * Called at module scope below rather than from `App.tsx`, which another agent
 * owns — and because the load must happen before the first render reads state,
 * not inside an effect that runs after it.
 */
let persistenceStarted = false

export function initPersistence(now: number = Date.now()): OfflineReport | null {
  if (persistenceStarted) return state.pendingOffline
  persistenceStarted = true
  const report = loadGame(now)
  installAutoSave()
  return report
}

// Not under test: a test importing this module must not inherit whatever save
// the last test left in jsdom's localStorage, and every save test drives
// loadGame/saveGame explicitly anyway.
if (import.meta.env?.MODE !== 'test') initPersistence()

/**
 * Jump the script to a phase — `?act=act3_bait`.
 *
 * Run 1 is paced to take about four minutes, which §21 intends (James is
 * "proven wrong four minutes from now"). That is right for a player and
 * unworkable for someone iterating on Act V's copy, so the script is
 * addressable. Sets up whatever state the phase assumes, so the jump lands on
 * a coherent run rather than a contradictory one.
 */
/**
 * Put the run *on* a project — name, commitment and burn-down together.
 *
 * `shipProject` sets all four of these in one object and they are only correct
 * as a set. {@link jumpToPhase} used to write `projectIndex` alone on top of a
 * fresh run, which left the studio on project 1's **payout** with project 0's
 * **name** and project 0's **1,000-point commitment** — a HUD reading
 * "FLAPPY SQUARE 1.0 · 915 / 1000 SP LEFT · +$25.0K IN 91s", which is three
 * numbers from two different projects and cannot happen in play.
 *
 * That is worse than a cosmetic bug, because handoff trap 4 makes these seams
 * the way screenshots are taken: **every frame reviewed from `?act=` was of a
 * state the game cannot reach**, and the cash arithmetic in it was being read
 * as if it were real.
 */
function onProject(index: number): Partial<GameState> {
  const clamped = Math.min(Math.max(0, Math.floor(index)), PROJECTS.length - 1)
  return {
    projectIndex: clamped,
    sprintName: PROJECTS[clamped].name,
    commitment: commitmentFor(clamped),
    burned: new Decimal(0),
  }
}

export function jumpToPhase(phase: Phase): void {
  const run = freshRun()

  switch (phase) {
    case 'act2_offer_hire':
      set({ ...run, phase, pokeCount: 12 })
      break
    case 'act2_ship':
      set({ ...run, phase, devs: 2, pokeCount: 12 })
      break
    case 'act2a_loop':
      // Mid-loop rather than at either end: §21.0's Act IIa runs 2 -> ~40, and
      // the interesting states are all in the middle of it — the dial has just
      // unlocked at 25 and the readout has not twitched yet.
      set({ ...run, phase, devs: 26, projectsShipped: 1, cash: 2_000, ...onProject(1) })
      break
    case 'act2a_seed':
      set({ ...run, phase, devs: SEED_ROUND_AT, projectsShipped: 2, cash: 400, ...onProject(2) })
      break
    case 'act2b_loop':
      // Post-round: the money is in and the dial is live, which is the state
      // §21.0a's Act IIb actually starts from.
      set({
        ...run,
        phase,
        devs: SEED_ROUND_AT,
        projectsShipped: 2,
        cash: SEED_ROUND_CASH,
        ...onProject(2),
        seedTaken: true,
        dialUnlocked: true,
      })
      break
    case 'act3_bait':
      // The offer is a temptation beside the ordinary control now, so this
      // seam has to set up a studio that could plausibly take it *or not*.
      set({
        ...run,
        phase,
        devs: 40,
        projectsShipped: 3,
        cash: 8_000,
        ...onProject(3),
        seedTaken: true,
        dialUnlocked: true,
      })
      break
    case 'act4_collapse':
    case 'act5_bleeding':
      set({
        ...run,
        phase,
        devs: 2 + MASS_HIRE_COUNT,
        projectsShipped: 1,
        cash: 50,
        ...onProject(1),
        massHired: true,
      })
      break
    case 'bankrupt':
      set({ ...run, phase, devs: 2 + MASS_HIRE_COUNT, cash: BANKRUPTCY_THRESHOLD, massHired: true })
      break
    default:
      set(run)
  }
}

export { BANKRUPTCY_THRESHOLD }
