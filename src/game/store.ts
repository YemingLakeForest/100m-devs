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
  decayLocalEntropy,
  devEfficiency,
  efficiency,
  entropy,
  passiveVelocity,
} from '../sim/entropy.ts'
import {
  advanceDevState,
  initialDevState,
  pokeDevState,
  type DevStateMachine,
} from '../sim/devStates.ts'
import { rungCrossed, spawnBurst, type Rung } from '../sim/headcount.ts'
import { SnippetBag } from './snippets.ts'
import { SCENE_JAMES_INSTANT_MESSENGER } from './scenes.ts'
import type { DevState, ZoomLevel } from '../sim/poke.ts'
import { resolvePoke } from '../sim/poke.ts'
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
  /** §7.7.3 arrival weight — {@link spawnBurst}, 1..120. */
  bodies: number
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
   * §7.8.7 — the seed every developer's name, face and stats are generated
   * from. One integer stands in for the entire roster.
   *
   * Part of the *run*, not of permanent state, so a Paradigm Shift returns a
   * different studio with the same James in it (§21.6). Persisted, because a
   * reload that reshuffled forty faces would undo the whole point of them.
   */
  runSeed: number
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
    ship: null,
    seedTaken: false,
    selected: null,
    dialUnlocked: false,
    pendingOffline: null,
    scene: null,
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

export function currentEfficiency(s: GameState = state): number {
  return efficiency(s.devs, s.devCap)
}

export function currentEntropy(s: GameState = state): number {
  return entropy(s.devs, s.devCap)
}

/** Passive swarm output, taxed by the poked developer's local entropy. */
export function currentVelocity(s: GameState = state): number {
  return passiveVelocity(s.devs, s.devCap) * devEfficiency(1, s.localEntropy)
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

/** Net dollars per second — what the player actually watches in Act V. */
export function netCashFlow(s: GameState = state): number {
  // Revenue is realised on ship, not continuously, so the running rate is the
  // burn alone. That is deliberate: it is what makes the Act V readout brutal.
  return -currentPayroll(s)
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
  const revenue = projectRevenue(s.projectIndex)
  const nextIndex = Math.min(s.projectIndex + 1, PROJECTS.length - 1)
  const next = PROJECTS[nextIndex]

  return {
    // §10.8a — the moment gets an event. Named with the project that just
    // shipped rather than the one now starting: the celebration is *for* the
    // thing that finished, and by the time it renders `sprintName` has already
    // moved on.
    ship: { id: nextShipId++, name: s.sprintName, revenue, at: performance.now() },
    cash: s.cash + revenue,
    lifetimeRevenue: s.lifetimeRevenue + revenue,
    projectsShipped: s.projectsShipped + 1,
    projectIndex: nextIndex,
    sprintName: next.name,
    commitment: new Decimal(next.commitment),
    burned: new Decimal(0),
  }
}

/** Advance the simulation. Driven by the Pixi ticker so both layers share a clock. */
export function tick(dtSeconds: number): void {
  if (dtSeconds <= 0 || state.phase === 'bankrupt') return

  const e = currentEntropy()
  const localEntropy = decayLocalEntropy(state.localEntropy, dtSeconds)
  // NOT `currentEffectiveVelocity` — see its note. Poke SP is banked by `poke`.
  const gained = currentVelocity({ ...state, localEntropy }) * dtSeconds

  let patch: Partial<GameState> = {
    localEntropy,
    // Exponential decay towards zero. Paired with the impulse `poke` adds, this
    // settles on the player's true taps-per-second rather than spiking on each
    // one — a readout that jumped to a huge number and back on every tap would
    // be unreadable at the rate §21 asks them to tap.
    pokeRate: state.pokeRate * Math.exp(-dtSeconds / POKE_RATE_TAU),
    dev: advanceDevState(state.dev, dtSeconds, { entropy: e }),
    cash: state.cash - currentPayroll() * dtSeconds,
    burned: gained > 0 ? state.burned.plus(gained) : state.burned,
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

/** Resolve one tap — the whole clicker layer, GDD §4.5. */
export function poke(x: number, y: number) {
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

  const result = resolvePoke({
    tier: state.tier,
    state: state.dev.state,
    zoom: state.zoom,
    efficiency: currentEfficiency(),
    // §4.8 — a cosmic-zoom tap on a studio of forty hits forty people.
    devs: state.devs,
  })

  const { machine, devLeaves } = pokeDevState(state.dev, state.hasCultureUpgrade)

  const floater: FloatingNumeral = {
    id: nextFloaterId++,
    sp: result.sp,
    x,
    y,
    crit: result.crit,
    bornAt: performance.now(),
    // Read from the state BEFORE the poke resolved: the line is what they were
    // doing when you interrupted them, not what your interruption made of them.
    snippet: snippets.next(state.dev.state),
  }

  const locked = isLocked()
  const desperateTaps = locked ? state.desperateTaps + 1 : state.desperateTaps

  const patch: Partial<GameState> = {
    burned: state.burned.plus(result.sp),
    localEntropy: state.localEntropy + result.localEntropyAdded,
    // The impulse half of the rate estimate. Dividing by the time constant is
    // what makes a steady R points per second converge on exactly R.
    pokeRate: state.pokeRate + result.sp / POKE_RATE_TAU,
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
    spawn: {
      id: nextSpawnId++,
      bodies: spawnBurst(before, after),
      promotedTo: rungCrossed(before, after),
      bornAt: performance.now(),
    },
  }
}

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
  // §24.4 — a Paradigm Shift clears the run and touches nothing permanent.
  // §24.5 gates offline accrual on the first one, so the counter is the unlock.
  setPermanent(paradigmShiftPermanent(getPermanent()))
  set({
    ...run,
    // "So. Same time tomorrow?"
    devs: 2,
    phase: 'act3_bait',
    projectsShipped: 1,
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
    devCap: r.devCap,
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
    massHired: r.massHired,
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
      // disagree with the state it is derived from.
      velocity: currentVelocity(restored),
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
      velocity: currentVelocity(state),
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
      set({ ...run, phase, devs: 26, projectsShipped: 1, cash: 2_000, projectIndex: 1 })
      break
    case 'act2a_seed':
      set({ ...run, phase, devs: SEED_ROUND_AT, projectsShipped: 2, cash: 400, projectIndex: 1 })
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
        projectIndex: 1,
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
        projectIndex: 1,
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
