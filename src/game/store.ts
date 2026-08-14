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
import { nextOrdinal, recordRelease, type ReleaseRecord } from '../sim/history.ts'
import {
  addHires,
  countsOf,
  newRoster,
  removeAtSeat,
  roleShare,
  type Role,
  type Roster,
} from '../sim/roles.ts'
import { advanceDefects, defectsFromPoke, shipDefects } from '../sim/defects.ts'
import {
  advanceIncidents,
  clearanceCapacity,
  incidentRate,
  suppressedReleases,
  type Incident,
} from '../sim/incidents.ts'
import { advanceTickets, catalogueMultiplier, serviceRatio } from '../sim/support.ts'
import {
  BASELINE_RATING,
  DEFECT_DENSITY_ANCHOR,
  advanceReputation,
  rateRelease,
  reputationMultiplier,
  revenueMultiplier,
} from '../sim/rating.ts'
import {
  NODE_BY_ID,
  bpFor,
  canAfford,
  chainedPokeRows,
  devCapFor,
  meetingBanActive,
  nodeCost,
  zeroTrustActive,
} from '../sim/prestige.ts'
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
  FOUNDER_BY_ID,
  FOUNDER_ROLE_HEADS,
  MANAGEMENT_DILUTION,
  canBuyFounder,
  founderCost,
  founderEffects,
  founderLevel,
  type FounderEffects,
} from '../sim/founder.ts'
import {
  FIRST_PROTOCOL_NODE,
  TECH_BY_ID,
  boardCost,
  canBuyTech,
  inStandup,
  ringOpen,
  standupFactor,
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
import { SCENE_JAMES_ARRIVES, SCENE_JAMES_INSTANT_MESSENGER } from './scenes.ts'
import {
  SCENE_BILLY_ARRIVES,
  SCENE_MATT_ARRIVES,
  SCENE_MELANY_ARRIVES,
  SCENE_MO_ARRIVES,
  SCENE_SERENA_ARRIVES,
} from './scenes.ts'
import { arrivalPredicate, type StorySnapshot } from './storyTriggers.ts'
import { ARRIVAL_HEROES, type HeroId } from '../sim/storyHeroes.ts'
import { unlocksFor, type Unlocks } from './unlocks.ts'
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
import { jamesPresent } from '../sim/james.ts'
import {
  NODE_CI_CD_AUTOPILOT,
  offlineCapSeconds,
  offlineRateMultiplier,
  offlineYield,
  type OfflineReport,
} from '../sim/offline.ts'
import {
  clearSave,
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
 * *Flappy Square 1.0* used to be 1,000 SP because §21 Act I said so, and at
 * the 1 SP/sec baseline that is exactly the 0.1%/sec fill rate the script
 * states. Resized to 300 on 2026-08-14: at that baseline 1,000 SP is a quarter
 * of an hour of uninterrupted thumb, and Act I hands the player a half-rate
 * founder and one unpaid friend to do it with. The teaching project exists to
 * sell the clicker layer, not to survive it — the old 1,000 put the hardest
 * climb of the whole run first, when the studio is smallest, and made the
 * ladder open **1,000 → 400**, which is backwards before it is anything else.
 * At 300 the ladder is monotonic — **300 → 400 → 1,000 → 4,000** — and the
 * first ship lands after about a minute of poking, James arriving a quarter of
 * the way in.
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
  // r = $0.17/SP. The joke, and a loss-maker the moment payroll starts.
  { name: 'Flappy Square 1.0', commitment: 300, payout: 50 },
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

/** Shared by simulation expiry and render motion so a floater fades before removal. */
export const FLOATER_LIFE_MS = 1000

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
   * §4.11 — who you hired, in the order you hired them.
   *
   * The run-length-encoded hire history from `roles.ts`, not four counters:
   * a seat has to know its own role, and four counters can only derive that by
   * ordering the roles and laying them out — which relabels every QA above a
   * newly hired developer. §7.8.7 generates a face from the seat index, so the
   * player would watch a specific person change jobs because somebody else was
   * hired.
   *
   * `headcountOf(roster)` and {@link GameState.devs} are the same number. The
   * count is kept because every hot path in the game reads it and a scan per
   * frame over a list is a scan nobody needs; the roster is the *shape* of that
   * number. `hire` is the one place both move, which is what keeps them equal.
   */
  roster: Roster
  /**
   * §4.11, §10.10 — which job the dial is hiring into.
   *
   * Persists, like the multiplier and for the same reason: a player who
   * selected QA meant it, and a control that silently reset to DEVELOPER
   * between sessions would spend the player's money on the wrong people.
   */
  hireRole: Role
  /**
   * §4.12 — defects on the bench, for the project currently being built.
   *
   * Run state. Reset to zero on ship, because shipping does not forgive the
   * backlog: it **transfers** it to the release as a density, where §4.12a
   * charges it forever. Anyone tempted to make this persist across a ship has
   * confused the two sections.
   */
  defects: number
  /**
   * §4.12a — open incidents, one per downed release, oldest first.
   *
   * Persisted rather than ephemeral, unlike §4.5a's buffs: an incident is a
   * *state of the world* rather than a fading effect, its release is frozen
   * while it is open, and a reload that quietly cleared them would be a reload
   * that repaired the studio.
   */
  incidents: Incident[]
  /**
   * The fractional part of §4.12a's arrival, carried between ticks.
   *
   * Without it an arrival rate of 0.3/s raises nothing at all at 60 fps,
   * because every individual step floors to zero. Ephemeral — at most one
   * incident's worth, and restoring it would be restoring a state the player
   * cannot see the cause of.
   */
  incidentPending: number
  /** §4.13 — tickets waiting. Never reaches zero for long, and never can. */
  tickets: number
  /**
   * §21.7.3, Matt — seconds the ticket queue has gone unanswered. Ephemeral
   * (§24.2): it is a *sustained* condition the trigger needs, and restoring a
   * clock the player cannot see the cause of would be a mystery.
   */
  ticketsUnservedFor: number
  /**
   * §4.14 — a slow-moving average of recent ratings.
   *
   * Run state, and that is a decision rather than an oversight: reputation is
   * a fact about *this studio*, and §13.2 liquidates the studio at a Paradigm
   * Shift. Carrying it across would make the first release of Run 9 be judged
   * on games built in a universe that no longer exists.
   */
  reputation: number

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
  /**
   * §10.11 — simulated seconds spent on the current project.
   *
   * Advanced with the simulation clock (§10.7a.3 pauses it with everything
   * else), so "dev time elapsed" is the same seconds the studio was actually
   * paid for. Resets on ship; the shipped figure is copied into the history
   * record. Ephemeral (§24.2) — a reload mid-project restarts the clock on the
   * one project that is still in flight, which under-reports a few minutes at
   * most and never rewrites a shipped game's record.
   */
  projectSeconds: number
  /**
   * §10.11.2 — ∫ headcount dt over the current project, in seconds.
   *
   * The *labour* figure, integrated from the raw headcount rather than the
   * working headcount and deliberately **not** divided by efficiency: §10.11.2
   * is explicit that labour is "headcount integrated over build time, and it is
   * NOT divided by efficiency" — the receipt the player paid for, not the work
   * that was useful. Resets on ship, like {@link projectSeconds}.
   */
  projectLabourSeconds: number
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
    // The founder is modelled separately and starts alone. The first employee
    // only exists after the player presses HIRE.
    devs: 0,
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
    peakDevs: 0,
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
    projectSeconds: 0,
    projectLabourSeconds: 0,
    // §4.11 — an empty studio. There is no QA in a garage, and the joke §4.11
    // is making only lands once the player has been given something to protect.
    roster: newRoster(0),
    hireRole: 'dev',
    defects: 0,
    incidents: [],
    incidentPending: 0,
    tickets: 0,
    ticketsUnservedFor: 0,
    reputation: BASELINE_RATING,
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
/** §4.12a — one id per page, so §4.15's chip stack can key and animate them. */
let nextIncidentId = 1

/**
 * §4.12a — every release's shipped defect density, keyed by release id.
 *
 * Built per frame rather than cached, and that is a deliberate non-optimisation:
 * §4.10e retires a release after four minutes, so the catalogue is bounded at a
 * few dozen entries however long the session runs. A cache here would be a
 * second copy of a fact the releases already hold, invalidated on ship and on
 * retire, to save a loop over thirty objects.
 */
function densitiesOf(releases: readonly Release[]): Map<number, number> {
  const out = new Map<number, number>()
  for (const r of releases) out.set(r.id, r.defectDensity)
  return out
}

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
  return s.devs * t.activeDevFraction * standupFactor(s.runSeconds, standupsRunning(s))
}

/**
 * §11.2 B2 bought the meeting; §13.2 L1-2A cancels it.
 *
 * **This is the single most satisfying purchase in the Paradigm Tree**, and it
 * is only satisfying because the pause is real: B2's entropy ceiling is
 * enormous and its cost is that the company stops to talk about itself every
 * minute, for ever, and there is nothing the player can do about it inside a
 * run. Meeting Ban is the thing they can do about it across runs. The node
 * keeps the ceiling and deletes the meeting.
 */
function standupsRunning(s: GameState = state): boolean {
  return techOf(s).standups && !meetingBanActive(getPermanent().layer1.paradigmLevels)
}

/** §11.2 — is the studio in its daily standup right now? */
export function inMeeting(s: GameState = state): boolean {
  return inStandup(s.runSeconds, standupsRunning(s))
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
  return currentVelocity(s) + Math.max(0, s.pokeRate) + founderVelocity()
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
  return Math.max(0, s.pokeRate) + (currentVelocity(s) - baseVelocity(s)) + founderVelocity()
}

// --- you — GDD §4.5d, §7.8.10, §13.7.1 -------------------------------------

/** §13.7.1 — the Management tree's current effects. Permanent, never per-run. */
export function founderOf(): FounderEffects {
  return founderEffects(getPermanent().meta.founderLevels)
}

/**
 * Your own output, in story points a second — §4.5d.
 *
 * **The one rate in this game that is not multiplied by the swarm and not
 * divided by §4.1's Entropy.** It takes no `GameState` at all, and that is the
 * signature saying so: there is no headcount argument and no efficiency
 * argument because neither can reach it. Every other velocity function in this
 * file takes the studio; this one takes nothing, because it is you.
 *
 * It lands in §10.1's `you` half rather than the `swarm` half, which is what
 * R11 built that split for — the readout can finally answer "what am *I*
 * contributing" with something that is true even when the player's thumb is
 * still.
 */
export function founderVelocity(): number {
  return founderOf().rate
}

/**
 * A tap on your own desk — §4.5d, "clicking your own desk generates story
 * points on its own growth curve".
 *
 * Separate from `poke` on purpose. `poke` resolves §4.7's dev state, §4.8's
 * zoom yield, §4.9's context switch and §4.5a's buff, every one of which is a
 * statement about *somebody else* being interrupted. None of them applies to
 * you: you do not have a mood the player has to read, your yield does not fall
 * as the camera pulls back — §4.5d's "clickable from anywhere" is exactly the
 * claim that it does not — and you cannot interrupt yourself.
 *
 * §13.7.1's Support node is the only thing that also pays cash, because a
 * founder answering the support mail is the one kind of work in this game that
 * bills directly.
 */
export function pokeFounder(x = 0, y = 0): number {
  if (state.scene !== null || state.phase === 'bankrupt') return 0

  const f = founderOf()
  const sp = f.tapValue
  const patch: Partial<GameState> = {
    burned: state.burned.plus(sp),
    pokeRate: state.pokeRate + sp / POKE_RATE_TAU,
    pokeCount: state.pokeCount + 1,
    // Your code is still code. Use the same flying Story Point and source-line
    // feedback as every other developer instead of silently changing numbers
    // in the HUD. The stage supplies the founder's screen position; tests and
    // non-rendered callers safely fall back to the origin.
    floaters: [
      ...state.floaters,
      {
        id: nextFloaterId++,
        sp,
        x,
        y,
        crit: false,
        bornAt: performance.now(),
        snippet: snippets.next('working'),
        unblocked: false,
      },
    ],
  }
  if (f.cashPerPoint > 0) patch.cash = state.cash + sp * f.cashPerPoint

  // §13.7.1's REACH node, and it is deliberately a weaker Chained Poke (§13.2
  // L1-2B) — "every node is a weaker version of somebody else's". Walking the
  // floor nudges the rows nearest your corner, at the diluted share.
  if (f.reachRows > 0 && state.devs > 0) {
    const unitOutput = baseVelocity() / state.devs
    let buffs = state.buffs
    let overflow = 0
    for (let i = 0; i < f.reachRows; i++) {
      const chained = addBuff(buffs, { rung: 2, index: i }, sp * MANAGEMENT_DILUTION, unitOutput)
      buffs = chained.buffs
      overflow += chained.overflow
    }
    patch.buffs = buffs
    if (overflow > 0) patch.burned = state.burned.plus(sp + overflow)
  }

  set(patch)
  return sp
}

/**
 * §13.7.1's Always On Call — what your desk contributes to §24.5's absence.
 *
 * Zero unless the node is owned, which is what makes it a node rather than a
 * gift. It is the one place the founder's curve touches the offline model, and
 * it is the Reliability spine diluted into something a studio with no incidents
 * can still feel: the specialist version will shorten time-to-recover; yours
 * just means you never really stopped.
 */
function offlineFounderVelocity(): number {
  const f = founderOf()
  return f.worksOffline ? f.rate : 0
}

/** §13.7.1 — buy a Management node with cash. The levels are permanent. */
export function buyFounderNode(id: string): boolean {
  const node = FOUNDER_BY_ID.get(id)
  if (!node) return false
  const p = getPermanent()
  const levels = p.meta.founderLevels ?? {}
  if (!canBuyFounder(node, levels, state.cash)) return false

  const level = founderLevel(levels, id)
  setPermanent({
    ...p,
    meta: { ...p.meta, founderLevels: { ...levels, [id]: level + 1 } },
  })
  set({ cash: state.cash - founderCost(node, level) })
  saveGame()
  return true
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
  // §4.12a and §4.13 — the readout must agree with the till. A downed release
  // is earning nothing and a queue nobody is answering is taking a share of
  // what the rest earn, and both have to be *in* this number rather than
  // applied somewhere further along: §10.6's rule is that the interface never
  // tells the player something the simulation is not doing.
  const held = suppressedReleases(s.incidents)
  const support = countsOf(s.roster).support + FOUNDER_ROLE_HEADS
  return catalogueIncome(s.releases, held) * catalogueMultiplier(s.tickets, support)
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

/**
 * §10.11 — fold a shipped release into the career history.
 *
 * The history lives in `PermanentSave.meta` rather than in `GameState` because
 * it is career-wide: §13.2 liquidates the run and the catalogue but never what
 * the player has made. Written through {@link setPermanent} so the next
 * `saveGame` serialises it alongside the run.
 */
function recordHistoryRelease(record: ReleaseRecord): void {
  const p = getPermanent()
  setPermanent({
    ...p,
    meta: { ...p.meta, history: recordRelease(p.meta.history, record) },
  })
}

/** Ship the current project and roll to the next — §21 Act II. */
function shipProject(s: GameState): Partial<GameState> {
  const tech = techEffects(s.tech)

  /**
   * §4.14 — the only number in this game that can go **down** while everything
   * else goes up, and the first thing that rewards playing well rather than
   * playing more.
   *
   * §4.12: shipping does not forgive the defect backlog, it **transfers** it.
   * The bench goes to zero and the density leaves with the release, where
   * §4.12a charges it for as long as anybody is still playing.
   */
  /**
   * §21.0c — **Run 1 ships at the baseline by construction.**
   *
   * Not "Run 1 happens to score the baseline because its defect bench is empty".
   * Those are different claims and only the first one is safe: a bench of zero
   * is *better* than §4.14.1's anchor, so running the live rating during Run 1
   * would hand every first-run release a quality bonus and quietly re-tune the
   * economy §21 is paced against — Flappy Square's $45 is a measured number, and
   * §25.6.2a measured it. Stamping the anchor and the baseline makes every
   * multiplier exactly ×1, which is the economy the script was written for.
   */
  const graded = currentUnlocks().backlogs
  const density = graded
    ? shipDefects(s.defects, s.commitment.toNumber()).density
    : DEFECT_DENSITY_ANCHOR
  const rating = graded
    ? rateRelease({
        defects: s.defects,
        storyPoints: s.commitment.toNumber(),
        // §13.6 coverage over the team that built it. No hero cards are
        // reachable yet (§13.6.7a), so this is honestly zero rather than
        // optimistically absent — and §4.14.1's baseline is derived *from* a
        // studio with no heroes, so a garage still scores ×1. See `rating.ts`.
        heroCoverage: 0,
        // §4.9a pins the roster mean at 1.0, and `craftScore` turns that into
        // ½. The term goes quiet as the studio grows, which §4.14 calls design.
        craft: 1,
      })
    : BASELINE_RATING

  // §11.2 B3 doubles the payout and §11.3 C9 takes the consultants' 10%. Both
  // land on the ladder's figure rather than on the tail, so §4.10e's integral
  // still pays out exactly what the release says it is worth.
  //
  // §4.14 adds two more, and this is where quality finally becomes money: the
  // release's own score, and the studio's standing reputation. Both are applied
  // to the payout rather than to the tail, for the same reason the tech
  // multipliers are — the release must be worth exactly what it says it is.
  const revenue =
    projectRevenue(s.projectIndex) *
    tech.revenueMultiplier *
    revenueMultiplier(rating) *
    reputationMultiplier(s.reputation)
  const nextIndex = Math.min(s.projectIndex + 1, PROJECTS.length - 1)
  const next = PROJECTS[nextIndex]

  // §10.11 — the permanent record, before the run moves on and forgets the
  // build time and the labour. Written to permanent state in memory; it is
  // serialised by the next `saveGame`, on the same cadence the live catalogue
  // (`releases`) already follows rather than on every ship.
  recordHistoryRelease({
    ordinal: nextOrdinal(getPermanent().meta.history),
    run: getPermanent().meta.paradigmShifts,
    name: s.sprintName,
    rating,
    payout: revenue,
    buildSeconds: s.projectSeconds,
    labourSeconds: s.projectLabourSeconds,
    seed: s.runSeed,
  })

  return {
    // The bench is clear. Whatever was on it is now the release's problem.
    defects: 0,
    reputation: advanceReputation(s.reputation, rating),
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
        defectDensity: density,
        rating,
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
    // §10.11 — the build that just finished is recorded, so the clock starts
    // again from zero for the next project. The figures themselves left with
    // the history record a few lines above.
    projectSeconds: 0,
    projectLabourSeconds: 0,
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

/**
 * Advance the simulation. Driven by the Pixi ticker so both layers share a clock.
 *
 * §10.7a.3 — **while a scene is up, the clock is stopped.** Nobody codes, the
 * burn-down does not move, payroll does not run, entropy does not decay. The
 * dialogue advances on the player's taps, never on the simulation, so the
 * numbers the scene talks about are the numbers the player last saw rather
 * than the ones the conversation drifted past. The room shows the same fact —
 * the floor's ambient life freezes on the frame the scene opened (see
 * `room.animate`'s `frozen`), because a studio that keeps visibly working
 * through a conversation is one the pause has not happened to.
 *
 * The one thing that still runs is cosmetic expiry: floaters and bubbles
 * measure their life in wall-clock, and a numeral frozen mid-air for the
 * length of a scene would be a visual bug that outlives the dialogue.
 */
export function tick(dtSeconds: number): void {
  if (dtSeconds <= 0 || state.phase === 'bankrupt') return

  if (state.scene !== null) {
    const now = performance.now()
    const patch: Partial<GameState> = {}
    const floaters = state.floaters.filter((f) => now - f.bornAt < FLOATER_LIFE_MS)
    if (floaters.length !== state.floaters.length) patch.floaters = floaters
    if (state.bubble && now - state.bubble.bornAt > state.bubble.ttl) patch.bubble = null
    if (patch.floaters !== undefined || patch.bubble !== undefined) set(patch)
    return
  }

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
  // §4.5d — your own desk, added rather than multiplied in. It is outside the
  // §4.1 curve entirely, which is the whole point of the section: this is the
  // one term that does not fall when the studio does.
  const gained =
    currentVelocity({ ...state, localEntropy, buffs }) * dtSeconds + founderVelocity() * dtSeconds
  // What the buffs that just expired had left to give — see `decayBuffs`. The
  // last few per cent of a poke, paid rather than swallowed, so what a tap is
  // worth does not quietly depend on how big the studio was when it landed.
  const settled = settleDroppedBuffs(decayed.dropped, { ...state, localEntropy })

  // §4.11 — who is on the floor, read once and shared by all three backlogs.
  const counts = countsOf(state.roster)
  const qaShare = roleShare(counts, 'qa')
  const sreShare = roleShare(counts, 'sre')

  // §21.0c — Run 1 has one lever and it is hiring. The three backlogs are a
  // system, and a system arriving during the four minutes §21 spends teaching
  // one sentence is a second sentence.
  const open = currentUnlocks().backlogs

  // §4.12a — a downed release does not age, does not earn, and does not page.
  // Computed before the tail so all three agree about the same frame.
  const held = suppressedReleases(state.incidents)

  // §4.10e — the back catalogue pays first, before anything reads the cash.
  const tail = advanceTail(state.releases, dtSeconds, held)

  // §4.12 — defects accrue from the work itself, in proportion to it. Charged
  // against `gained`, which is realised output *after* §4.1: a studio in §6.3's
  // lock produces nothing and therefore breaks nothing.
  const defects = open ? advanceDefects(state.defects, gained / dtSeconds, qaShare, dtSeconds) : 0

  // §4.12a — the released catalogue pages you, weighted by who is still playing.
  const incidents = open
    ? advanceIncidents(
        state.incidents,
        incidentRate(tail.releases, densitiesOf(tail.releases), sreShare, held),
        // §13.7.1 — you carry the pager when nobody else does. Without the founder
        // term `clearanceCapacity(0)` is zero, an incident never closes, and a
        // frozen release never comes back: a fail state, which §4.12 forbids.
        clearanceCapacity(counts.sre + FOUNDER_ROLE_HEADS),
        dtSeconds,
        state.incidentPending,
        nextIncidentId,
        tail.releases,
      )
    : { incidents: [] as Incident[], pending: 0, cleared: 0, restored: [] }
  // Ids only ever increase, so the high-water mark is the whole bookkeeping.
  // Deriving it from the returned list rather than counting arrivals means a
  // change to how `advanceIncidents` raises them cannot silently start reusing
  // an id, which §4.15's chip stack keys on.
  for (const i of incidents.incidents) nextIncidentId = Math.max(nextIncidentId, i.id + 1)

  // §4.13 — and the people who bought them write in, forever.
  const support = counts.support + FOUNDER_ROLE_HEADS
  const tickets = open
    ? advanceTickets(state.tickets, state.projectsShipped, defects, support, dtSeconds)
    : { queue: 0, served: 0 }

  // §4.13 — unanswered tickets tax the **catalogue**, never the current
  // project. You are losing money on the games you already made, which is the
  // whole sentence, and a player in trouble can always still ship their way out.
  //
  // Exactly 1 during Run 1, which is the same number a studio keeping up gets:
  // §21's economy was tuned against an untaxed catalogue and must stay tuned.
  const ticketTax = open ? catalogueMultiplier(tickets.queue, support) : 1

  // §21.7.3, Matt — the queue is "unserved" while the studio is falling behind:
  // arrival outruns capacity (§4.15's bar reads below 1). Tracked as a running
  // clock so the trigger can demand a *sustained* period rather than a spike.
  const fallingBehind =
    open && serviceRatio(state.projectsShipped, defects, support) < 1
  const ticketsUnservedFor = fallingBehind ? state.ticketsUnservedFor + dtSeconds : 0

  let patch: Partial<GameState> = {
    localEntropy,
    buffs,
    defects,
    incidents: incidents.incidents,
    incidentPending: incidents.pending,
    tickets: tickets.queue,
    ticketsUnservedFor,
    // §11.2 B2's meeting clock. Simulated seconds, not wall-clock — see the
    // field's note. Advanced before anything reads it so the standup boundary
    // lands on the same frame the velocity does.
    runSeconds: state.runSeconds + dtSeconds,
    // §10.11 — the project's build time and its labour (§10.11.2). Labour is
    // the raw headcount, not the working headcount and not efficiency-adjusted.
    projectSeconds: state.projectSeconds + dtSeconds,
    projectLabourSeconds: state.projectLabourSeconds + state.devs * dtSeconds,
    // Exponential decay towards zero. Paired with the impulse `poke` adds, this
    // settles on the player's true taps-per-second rather than spiking on each
    // one — a readout that jumped to a huge number and back on every tap would
    // be unreadable at the rate §21 asks them to tap.
    pokeRate: state.pokeRate * Math.exp(-dtSeconds / POKE_RATE_TAU),
    dev: advanceDevState(state.dev, dtSeconds, {
      entropy: e,
      // §11.3 C2 — the chairs only shorten the lockup, never Flow.
      overwhelmedScale: techOf().overwhelmedScale,
      // §13.2 L1-3A — nobody goes rogue in a zero-trust codebase.
      zeroTrust: zeroTrustActive(getPermanent().layer1.paradigmLevels),
    }),
    // §13.7.1's Support spine — "the work you do personally also earns cash",
    // which has to include the work you do while not tapping, or the node would
    // quietly be a tap bonus wearing a sales node's name.
    cash:
      state.cash -
      currentPayroll() * dtSeconds +
      tail.earned * ticketTax +
      founderVelocity() * dtSeconds * founderOf().cashPerPoint,
    lifetimeRevenue: state.lifetimeRevenue + tail.earned * ticketTax,
    releases: tail.releases,
    burned: gained + settled > 0 ? state.burned.plus(gained + settled) : state.burned,
  }

  const now = performance.now()
  const floaters = state.floaters.filter((f) => now - f.bornAt < FLOATER_LIFE_MS)
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
  // §21.0b — after `set`, because the beat reads the phase the machine just
  // moved to and grants a hire, which is a second write. Running it inside the
  // patch would mean composing a hire into a partial state that has not been
  // published yet, and `hire` reads `state` for the roster.
  advanceAct1(after.phase, patch.phase)
  // §21.7.3 — after `set`, so the snapshot reads the frame's final state.
  checkStoryTriggers(getState())
}

/**
 * §21.0b / §21.7 — Act I's one story beat, which is a hire rather than a banner.
 *
 * Something happens here that happens nowhere else in the game: **somebody is
 * given to the player for free.** That is §21.7's rule — *a hero arrives the
 * first time you feel the problem they solve* — applied to the only problem Act
 * I has, which is being alone.
 *
 * **Instant Messenger used to be given here too, and it is not any more.**
 * §21.0c moves it back to Run 2, where §21.6 always had it. The reasoning that
 * moved it forward was sound about the joke — the player *is* sitting side by
 * side with James, at two desks, on screen — and wrong about everything else: it
 * put an upgrade tree, a free node and a second cutscene inside the four minutes
 * §21 spends teaching one sentence, and it handed away the root of a board the
 * player could not open. The joke survives the move intact, because in Run 2
 * they are still sitting side by side.
 *
 * Driven off the phase *transition* rather than off the phase, so it fires
 * exactly once even though the machine can sit in a phase for thousands of
 * frames.
 */
function advanceAct1(from: Phase, to: Phase | undefined): void {
  if (to === undefined || to === from) return

  if (to === 'act1_james' && state.devs === 0) {
    // §21.7.1 — the scene opens on `APPLICANT AT DOOR.` with the desk still
    // empty. The hire itself is {@link grantJames}, called from the dialogue
    // when it reaches {@link JAMES_DROPS_AT_LINE}, so the beat is "the door,
    // then the drop, then the conversation" rather than a scene played over a
    // developer who is already there.
    set({ scene: SCENE_JAMES_ARRIVES.id })
  }
}

/**
 * §21.7.1 — James falls in, exactly like any other hire.
 *
 * Fired by the dialogue box when it reaches {@link JAMES_DROPS_AT_LINE}, so the
 * `APPLICANT AT DOOR.` beat holds before the drop. Idempotent: he is free and
 * he is granted once, and §4.10a's payroll starts at the third head, so this
 * costs the economy nothing.
 */
export function grantJames(): boolean {
  if (state.devs !== 0) return false
  set(hire(0, 1, 'dev'))
  return true
}

/** §21.7.3 — the hero each arrival scene is about, and the scene it plays. */
const HERO_SCENE: Record<HeroId, string> = {
  james: SCENE_JAMES_ARRIVES.id,
  mo: SCENE_MO_ARRIVES.id,
  serena: SCENE_SERENA_ARRIVES.id,
  matt: SCENE_MATT_ARRIVES.id,
  melany: SCENE_MELANY_ARRIVES.id,
  billy: SCENE_BILLY_ARRIVES.id,
}

/**
 * §21.7.3 — the one rule, asked every tick.
 *
 * A hero arrives the first time the player feels the problem they solve. The
 * predicate is pure; this builds its snapshot, and the `milestones` union
 * (§24.3) makes it fire once — {@link showScene} is idempotent and
 * {@link dismissScene} records the scene as seen.
 *
 * §21.0c puts a floor under it: the whole ladder is Run 2+, because the
 * systems each trigger reads are all gated behind the first shift already.
 */
function checkStoryTriggers(s: GameState): void {
  if (getPermanent().meta.paradigmShifts <= 0) return
  if (s.scene !== null) return

  const snapshot: StorySnapshot = {
    paradigmShifts: getPermanent().meta.paradigmShifts,
    releases: s.releases.map((r) => ({ defectDensity: r.defectDensity })),
    hasIncident: s.incidents.length > 0,
    tickets: s.tickets,
    ticketsUnservedFor: s.ticketsUnservedFor,
    devs: s.devs,
    devCap: effectiveDevCap(s),
    cash: s.cash,
    entropy: currentEntropy(s),
  }

  for (const hero of ARRIVAL_HEROES) {
    const predicate = arrivalPredicate(hero.id)
    const sceneId = HERO_SCENE[hero.id]
    if (predicate && predicate(snapshot) && !hasSeenScene(sceneId)) {
      showScene(sceneId)
      return
    }
  }
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
 * What a chained row gets, as a share of what the poked unit got — §13.2 L1-2B.
 *
 * A first guess, and marked as one. A half is the largest number that keeps the
 * node an *amplifier* rather than a replacement for aiming: at 1.0 the player
 * stops caring which unit they hit, which would delete §4.5c's "who you poke
 * matters" for anyone who bought it. Wants play-testing against §4.9a's spread.
 */
export const CHAIN_SHARE = 0.5

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

  // §21.7.0 rule 5 — James is at the gym, ten to eleven, every single day.
  // Poke his desk in that hour and he is not there; the desk says so. Seat 0 is
  // James (§7.8.7) and the room is the only rung with seats, so `rung === 0`.
  if (rung === 0 && index === 0 && state.devs > 0 && !jamesPresent(state.runSeconds)) {
    set(showBubble('He’s at the gym. Ten to eleven, every single day.', 5000))
    return { sp: 0, localEntropyAdded: 0, crit: false, quits: false }
  }

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

  /**
   * §13.2 L1-2B, Chained Poke Reaction — "a shockwave that wakes up 1
   * additional row of developers per level".
   *
   * The chain **adds** value rather than dividing the tap's. That is the
   * distinction between a prestige node and a rebalance: 500 BP has to buy
   * something, and a shockwave that made the person you actually poked weaker
   * would be a downgrade dressed as an unlock. Each neighbouring unit gets half
   * of what the target got, so the node is worth 1.5x, 2x, 2.5x at its three
   * levels — real, and short of doubling the clicker layer at level one.
   *
   * Neighbours are the *next* units along at the same rung, which in the room
   * is literally the next row of desks and above it the next building along.
   * Units past the end of the studio are skipped rather than clamped: buffing
   * seat range [n, n) is an entry in the overlay that decays to nothing while
   * occupying one of §4.5a's 64 slots.
   */
  const chainRows = chainedPokeRows(getPermanent().layer1.paradigmLevels)
  let buffs = buffed.buffs
  let chainOverflow = 0
  for (let k = 1; k <= chainRows; k++) {
    const neighbour = index + k
    if (unitSeats(rung, neighbour, state.devs).to <= unitSeats(rung, neighbour, state.devs).from) {
      break
    }
    const chained = addBuff(buffs, { rung, index: neighbour }, converted * CHAIN_SHARE, unitOutput)
    buffs = chained.buffs
    chainOverflow += chained.overflow
  }

  // §11.3 C1 — Nitro Cold Brew. `hasCultureUpgrade` was this effect before
  // there was a tree to own it, and it is still honoured: the field predates
  // §11 and a save that has it set earned it.
  const { machine, devLeaves: wouldLeave } = pokeDevState(
    state.dev,
    state.hasCultureUpgrade || techOf().flowSurvivesPoke,
  )

  /**
   * §22.3 — **LOYAL: never quits when poked.** James is seat 0 and he is the
   * one developer in the game who cannot be lost.
   *
   * This is canon and it was also a live bug. `dev` is one studio-wide state
   * machine, so it can enter `tenx` while the studio *is* James — and a poke
   * then cashed him out, leaving Act I with zero developers, a phase machine
   * already past the beat that grants him, and no way back. It reproduced
   * intermittently, because whether the machine is in `tenx` on the frame the
   * player happens to tap is a real dice roll.
   *
   * Guarded on the seat rather than on the headcount: "the last developer never
   * leaves" would be a different rule that happens to cover this case today and
   * would stop covering it the moment somebody is hired.
   */
  const devLeaves = wouldLeave && seats.from > 0

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
  // The chained rows' overflow is paid the same way the target's is — a
  // shockwave landing on a unit already at the ceiling still owes its points.
  const paidNow = banked + buffed.overflow + chainOverflow

  const patch: Partial<GameState> = {
    burned: state.burned.plus(paidNow),
    // §13.7.1's borrowed Quality spine — a manager who reads it back before
    // they speak costs the studio less concentration per interruption.
    localEntropy: state.localEntropy + result.localEntropyAdded * founderOf().contextSwitchScale,
    buffs,
    // The impulse half of the rate estimate. Dividing by the time constant is
    // what makes a steady R points per second converge on exactly R.
    pokeRate: state.pokeRate + paidNow / POKE_RATE_TAU,
    floaters: [...state.floaters, floater],
    pokeCount: state.pokeCount + 1,
    desperateTaps,
    dev: machine,
    // §4.12 — **interrupting somebody is how defects get written.** Charged on
    // the points this poke actually banked, at `β + ε` where ε is the same
    // context-switch coefficient §4.9 uses for Entropy, so a poked Story Point
    // carries twice the bugs of a passively-produced one.
    //
    // Charged on `paidNow` rather than on the poke's full value because the
    // rest arrives as a §4.5a buff, and the buff's points are ordinary work
    // that `tick` already charges at β. Charging the whole poke here would bill
    // three quarters of it twice.
    //
    // §21.0c — and not at all during Run 1, where the counter would be the
    // first system on screen and there is nobody to hire against it.
    defects: currentUnlocks().backlogs
      ? state.defects + defectsFromPoke(paidNow, roleShare(countsOf(state.roster), 'qa'))
      : 0,
    // The 10x Engineer quits permanently on the poke that cashes them out.
    devs: devLeaves ? Math.max(0, state.devs - 1) : state.devs,
    // §4.11 — **and the roster shrinks with them.** `headcountOf(roster)` and
    // `devs` are the same number, kept equal by there being one writer for each
    // direction; `hire` is the other one. Without this a departure leaves the
    // roster describing somebody who is not there, and every role share in
    // §4.12–§4.13 is divided by a denominator that is too large.
    //
    // Found by a test that asserts the two agree, which failed intermittently
    // because whether seat 0 is a 10x Engineer depends on the run seed.
    roster: devLeaves ? removeAtSeat(state.roster, seats.from) : state.roster,
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
function hire(before: number, after: number, role: Role = 'dev'): Partial<GameState> {
  return {
    devs: after,
    // §4.11 — the roster and the count move together, here and nowhere else.
    // Every path that raises headcount goes through this function, which is
    // what keeps `headcountOf(roster)` equal to `devs` without a reconciliation
    // step that could disagree.
    roster: addHires(state.roster, role, Math.max(0, Math.floor(after) - Math.floor(before))),
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
  const shifts = getPermanent().meta.paradigmShifts
  if (!canBuyTech(node, state.tech, state.cash, shifts)) return false

  set({
    cash: state.cash - boardCost(node, level, shifts),
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
  const shifts = getPermanent().meta.paradigmShifts
  return {
    node,
    level,
    cost: boardCost(node, level, shifts),
    maxed: level >= node.maxLevel,
    unlocked: node.requires === undefined || techLevel(s.tech, node.requires) > 0,
    ringOpen: ringOpen(node.ring, shifts),
    affordable: canBuyTech(node, s.tech, s.cash, shifts),
  }
}

/**
 * §13.1 — what a Paradigm Shift is worth right now, and whether it is offered.
 *
 * §13.1's trigger row reads "Max Entropy stall / **Bankruptcy** / Forced
 * liquidation", and only the middle one was ever built: the shift lived on the
 * §21 Act V bankruptcy modal and nowhere else. That is one prestige per
 * playthrough, in a game whose entire second half is the loop — a player who
 * stalls at forty developers with a healthy treasury has no way out but to wait
 * to go broke.
 *
 * **Offered from the second run onward, and never during the first.** §21's
 * trap is the first run's whole argument and a visible escape hatch during Act
 * III is an invitation to skip it; by Act V the bankruptcy modal is the door.
 * After that the player knows what a shift is, so it is simply available —
 * `paradigmShifts` is the flag, and it is the same counter §24.5 already uses
 * to unlock offline accrual.
 *
 * The quote is live rather than computed on press. §14.1 pays on *lifetime*
 * revenue and *peak* headcount, so it only ever goes up, and watching it climb
 * is the argument for playing another twenty minutes before cashing out.
 */
export function paradigmShiftOffer(s: GameState = state): { bp: number; available: boolean } {
  const p = getPermanent()
  const bp = bpFor(
    Math.max(p.meta.lifetimeRevenue, s.lifetimeRevenue),
    Math.max(p.meta.peakDevs, s.peakDevs),
  )
  return { bp, available: p.meta.paradigmShifts > 0 && s.phase !== 'bankrupt' }
}

/** §13.2 — has the player ever prestiged? The Paradigm Tree's door. */
export function hasPrestiged(): boolean {
  return getPermanent().meta.paradigmShifts > 0
}

/**
 * §21.0c — which systems this player has, and the only place that is asked.
 *
 * Not held in {@link GameState}: it is a fact about the *player*, not about the
 * run, and a copy of it in the run state would be a second thing that can
 * disagree with `paradigmShifts` after a save migration. Cheap enough to call
 * from `tick` — `getPermanent` is a module variable read, not a storage hit.
 *
 * Callers get one of two constants, so a React render may depend on the result
 * by identity. Every one of them changes on the same frame `triggerParadigmShift`
 * publishes its `set`, which is what makes the whole unlock a single event.
 */
export function currentUnlocks(): Unlocks {
  return unlocksFor(getPermanent().meta.paradigmShifts)
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
  // §10.7a.3 — the scrim already eats the tap; this is the same rule at the
  // model level, so a call path that skips the UI cannot sign a term sheet
  // mid-conversation either.
  if (state.scene !== null) return false
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
 * §4.11 — pick the job the next hire is for.
 *
 * There is deliberately no companion function that *moves* somebody between
 * roles. §4.11: "A role is chosen at hire, not reassigned." Its absence is the
 * design — reassignment would turn every failure into a slider adjustment, and
 * §6's thesis is that you cannot fix an organisation by moving people around
 * after the fact.
 */
export function setHireRole(role: Role): void {
  set({ hireRole: role })
}

/** §4.11 — how many of each kind the studio has. Derived; never stored. */
export function roleCounts(s: GameState = state) {
  return countsOf(s.roster)
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
  // §10.7a.3 — nothing is clickable while a scene is up. The scrim blocks the
  // HUD; this is the same rule at the model level, because `grantJames` —
  // which *must* hire mid-scene — is the one path that deliberately bypasses
  // it and it calls `hire` directly, not this.
  if (state.scene !== null) return false
  // §10.10 — the dial decides the batch. It reads 1 until the dial unlocks at
  // 25 developers, so Act I and Act II behave exactly as they did.
  const { count, cost, affordable } = hireQuote()
  if (!affordable || count <= 0) return false
  set({ ...hire(state.devs, state.devs + count, state.hireRole), cash: state.cash - cost })
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
  // §10.7a.3 — the trap is a decision, and a decision cannot be made through a
  // dialogue box.
  if (state.scene !== null) return false
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
    // §4.11 — and the roster has to say the same thing. `freshRun()` returns an
    // empty studio, so leaving this out would hand Run 2 two people that
    // `roleAtSeat` reads as developers by fallback rather than by record — the
    // two numbers would agree by luck, and stop agreeing at the first hire.
    roster: newRoster(2),
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
    // §11.5 / §21.0c — and he arrives holding the thing. Instant Messenger is
    // the only free node in the game and this is where it is given: the scene
    // above hands it over in dialogue, and the board it sits at the centre of
    // opens for the first time on the same frame.
    //
    // `run` is `freshRun()`, whose `tech` is `{}`, so this is the whole of Run
    // 2's tech state and every later shift re-grants it. A node granted once and
    // carried in `PermanentSave` would be a second place the same fact lives.
    tech: { [FIRST_PROTOCOL_NODE]: 1 },
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
  // §21.7.1 — if the arrival scene ever ends without James having dropped in
  // (a test harness that dismisses the box rather than tapping through it), he
  // is granted on the way out, so the run can never be parked at the empty
  // desk. In play the dialogue reaches {@link JAMES_DROPS_AT_LINE} first and
  // this is a no-op.
  if (id === SCENE_JAMES_ARRIVES.id && state.devs === 0) grantJames()
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

/**
 * Begin again from the landing screen. This is deliberately stronger than a
 * Paradigm Shift: run progress and permanent progression are replaced by a
 * clean studio. Install identity lives under its own key and is retained.
 */
export function startNewGame(): void {
  clearSave()
  state = freshRun()
  nextFloaterId = 1
  nextSpawnId = 1
  nextShipId = 1
  nextReleaseId = 1
  setPermanent(emptyPermanent())
  pendingSnapshot = null
  for (const fn of listeners) fn()
  // Write the replacement immediately. Closing the app on the first frame of
  // the new run must not allow the erased studio to return.
  saveGame()
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
      // Defaulted by `normaliseReleases` to the garage figures, never to zero —
      // a restored release with no density would be a *flawless* game, and a
      // reload would silently upgrade the whole back catalogue and mute §4.12a.
      defectDensity: rel.defectDensity ?? DEFECT_DENSITY_ANCHOR,
      rating: rel.rating ?? BASELINE_RATING,
    })),
    // §4.11 — `normaliseRoster` has already reconciled this against `devs`, so
    // it is taken as given rather than re-derived here. One repair, in the
    // module that owns the document.
    roster: (r.roster ?? [{ role: 'dev' as const, count: r.devs }]).map((run) => ({
      role: run.role as Role,
      count: run.count,
    })),
    hireRole: (r.hireRole ?? 'dev') as Role,
    defects: r.defects ?? 0,
    tickets: r.tickets ?? 0,
    reputation: r.reputation ?? BASELINE_RATING,
    incidents: (r.incidents ?? []).map((i) => ({ ...i })),
    // §24.2 ephemeral — at most one incident's worth of fraction, and a state
    // the player cannot see the cause of.
    incidentPending: 0,
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
      velocity: baseVelocity(restored) + offlineFounderVelocity(),
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
  // §10.7a.3 — a collection is a decision about money, and the report panel
  // sits under the dialogue scrim. Belt and braces: the same rule as hiring.
  if (state.scene !== null) return

  const report = offlineYield(
    {
      savedAt: snap.savedAt,
      // Unbuffed, for the same reason as the restore path above: a player who
      // was mid-poke when they closed the tab must not earn eight hours of a
      // buff that would have faded in fifteen seconds.
      velocity: baseVelocity(state) + offlineFounderVelocity(),
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
 * **name** and project 0's **300-point commitment** — a HUD reading
 * "FLAPPY SQUARE 1.0 · 215 / 300 SP LEFT · +$25.0K IN 91s", which is three
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
    case 'act1_ship':
      // The grind between James sitting down and the first sale — no cash, no
      // hire button, just the founders and the burn-down.
      set({ ...run, phase, devs: 1, pokeCount: 12 })
      break
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
