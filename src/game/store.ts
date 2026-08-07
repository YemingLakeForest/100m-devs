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
 * the run, no save, no cloud.
 */

import Decimal from 'break_infinity.js'
import {
  BANKRUPTCY_THRESHOLD,
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
import type { DevState, ZoomLevel } from '../sim/poke.ts'
import { resolvePoke } from '../sim/poke.ts'
import {
  MASS_HIRE_COUNT,
  REBUKE_LINE,
  advanceOnboarding,
  shouldRebuke,
  type Phase,
} from './onboarding.ts'

/**
 * The Run 1 project ladder — GDD §5, Era 1.
 *
 * *Flappy Square 1.0* is 1,000 SP because §21 Act I says so, and because at
 * the 1 SP/sec baseline that is exactly the 0.1%/sec fill rate the script
 * states. Everything after it exists so that shipping is not a dead end if
 * the player somehow survives.
 */
export const PROJECTS = [
  { name: 'Flappy Square 1.0', commitment: 1000 },
  { name: 'Flappy Square 2.0 (Now With Ads)', commitment: 2500 },
  { name: 'Untitled Roguelike Deckbuilder', commitment: 8000 },
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
}

function freshRun(): GameState {
  return {
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

export function getState(): GameState {
  return state
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function set(patch: Partial<GameState>): void {
  state = { ...state, ...patch }
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
  const revenue = projectRevenue(s.commitment.toNumber())
  const nextIndex = Math.min(s.projectIndex + 1, PROJECTS.length - 1)
  const next = PROJECTS[nextIndex]

  return {
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
  const gained = currentVelocity({ ...state, localEntropy }) * dtSeconds

  let patch: Partial<GameState> = {
    localEntropy,
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
  if (state.phase === 'bankrupt') {
    return { sp: 0, localEntropyAdded: 0, crit: false, quits: false }
  }

  const result = resolvePoke({
    tier: state.tier,
    state: state.dev.state,
    zoom: state.zoom,
    efficiency: currentEfficiency(),
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

/** §21 Act II — hire James, the first named character and first Hero Card. */
export function hireDeveloper(): void {
  set(hire(state.devs, state.devs + 1))
}

/** §21 Act III/IV — the mousetrap. */
export function massHire(): void {
  if (state.massHired) return
  set({
    ...hire(state.devs, state.devs + MASS_HIRE_COUNT),
    massHired: true,
    ...showBubble('Wait — who’s writing this function?', 6000),
  })
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
  set({
    ...run,
    // "So. Same time tomorrow?"
    devs: 2,
    phase: 'act3_bait',
    projectsShipped: 1,
    ...showBubble('So. Same time tomorrow?', 6000),
  })
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
  for (const fn of listeners) fn()
}

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
    case 'act3_bait':
      set({ ...run, phase, devs: 2, projectsShipped: 1, cash: 50, projectIndex: 1 })
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
