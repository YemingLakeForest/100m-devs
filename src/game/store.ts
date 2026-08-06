/**
 * Spike game state — GDD §4.4 (Story Points) and §4.1 (Entropy).
 *
 * A tiny external store rather than a state library: ADR 0001 §5 mitigation 3
 * fixes the DOM/canvas boundary and requires that "game state lives in one
 * store both read from". Pixi reads it every frame; React subscribes. Adding
 * a dependency to hold nine numbers would obscure that boundary rather than
 * clarify it.
 *
 * Scope is ADR §7.2/§7.2a only. No tech tree, no prestige, no save, and no
 * entropy simulation beyond driving the interface hue.
 */

import Decimal from 'break_infinity.js'
import {
  D_BASE,
  decayLocalEntropy,
  devEfficiency,
  efficiency,
  entropy,
  passiveVelocity,
} from '../sim/entropy.ts'
import type { DevState, ZoomLevel } from '../sim/poke.ts'
import { resolvePoke } from '../sim/poke.ts'

/**
 * Run 1's opening project — GDD §21 Act I. 1,000 SP is exactly the "1,000
 * lines of code" the solo dev promises, and at the 1 SP/sec baseline it burns
 * down in 1,000 seconds: the 0.1%/sec fill rate the onboarding script states.
 */
export const OPENING_SPRINT = {
  name: 'Flappy Square 1.0',
  commitment: new Decimal(1000),
} as const

export interface FloatingNumeral {
  id: number
  /** The Fibonacci payout, already resolved. Negative for a rogue refactor. */
  sp: number
  /** Screen-space spawn point, in CSS pixels. */
  x: number
  y: number
  crit: boolean
  /** Performance.now() at spawn — the numeral arcs up and fades over ~900 ms. */
  bornAt: number
}

export interface GameState {
  /** Headcount. The spike exposes this as a control so Entropy can be driven. */
  devs: number
  devCap: number

  /** The sprint being burned down. */
  sprintName: string
  commitment: Decimal
  burned: Decimal

  /** GDD §4.9 — the poked developer's context-switch penalty. */
  localEntropy: number

  /** What the developer at the desk is currently doing (GDD §4.7). */
  devState: DevState
  /** Fibonacci ladder tier. F1 from the first tap of the game. */
  tier: number
  zoom: ZoomLevel

  floaters: FloatingNumeral[]

  /** Total taps this session — feeds the latency overlay's sample count. */
  pokeCount: number
}

const initial: GameState = {
  devs: 1,
  devCap: D_BASE,
  sprintName: OPENING_SPRINT.name,
  commitment: OPENING_SPRINT.commitment,
  burned: new Decimal(0),
  localEntropy: 0,
  devState: 'working',
  tier: 1,
  zoom: 1,
  floaters: [],
  pokeCount: 0,
}

let state: GameState = initial
const listeners = new Set<() => void>()
let nextFloaterId = 1

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

/** Global efficiency eta — GDD §4.1. */
export function currentEfficiency(s: GameState = state): number {
  return efficiency(s.devs, s.devCap)
}

/** The Entropy Speedometer readout, E = 1 - eta. */
export function currentEntropy(s: GameState = state): number {
  return entropy(s.devs, s.devCap)
}

/**
 * Velocity — GDD §4.4. Passive swarm output plus the clicker layer.
 *
 * Only the passive half is continuous, so this is what the HUD shows as
 * SP/sec; poke yield arrives as discrete spikes and is read off the floaters.
 */
export function currentVelocity(s: GameState = state): number {
  return passiveVelocity(s.devs, s.devCap) * devEfficiency(1, s.localEntropy)
}

export function remaining(s: GameState = state): Decimal {
  const left = s.commitment.minus(s.burned)
  return left.lt(0) ? new Decimal(0) : left
}

/** 0–1 burn-down progress, for the descending line in the HUD. */
export function burnedFraction(s: GameState = state): number {
  if (s.commitment.lte(0)) return 1
  return Math.min(1, s.burned.div(s.commitment).toNumber())
}

// --- actions ---------------------------------------------------------------

/** Advance the simulation. Driven by the Pixi ticker so both layers share a clock. */
export function tick(dtSeconds: number): void {
  if (dtSeconds <= 0) return

  const localEntropy = decayLocalEntropy(state.localEntropy, dtSeconds)
  const gained = currentVelocity({ ...state, localEntropy }) * dtSeconds

  const now = performance.now()
  // Floaters live ~900 ms. Filtering here rather than on a timer per numeral
  // keeps a 5-taps/sec burst from spawning 5 timers a second.
  const floaters = state.floaters.filter((f) => now - f.bornAt < 900)

  set({
    localEntropy,
    burned: gained > 0 ? state.burned.plus(gained) : state.burned,
    floaters: floaters.length === state.floaters.length ? state.floaters : floaters,
  })
}

/**
 * Resolve one tap — the whole clicker layer, GDD §4.5.
 *
 * Returns the result so the caller can fire sound and haptics without reading
 * back from the store; the ordering there is latency-critical.
 */
export function poke(x: number, y: number) {
  const result = resolvePoke({
    tier: state.tier,
    state: state.devState,
    zoom: state.zoom,
    efficiency: currentEfficiency(),
  })

  const floater: FloatingNumeral = {
    id: nextFloaterId++,
    sp: result.sp,
    x,
    y,
    crit: result.crit,
    bornAt: performance.now(),
  }

  set({
    burned: state.burned.plus(result.sp),
    localEntropy: state.localEntropy + result.localEntropyAdded,
    floaters: [...state.floaters, floater],
    pokeCount: state.pokeCount + 1,
  })

  return result
}

export function setDevs(devs: number): void {
  set({ devs: Math.max(0, devs) })
}

export function setZoom(zoom: ZoomLevel): void {
  if (zoom !== state.zoom) set({ zoom })
}

export function setDevState(devState: DevState): void {
  set({ devState })
}

/** Test seam — the store is module-level singleton state. */
export function __resetStore(): void {
  state = { ...initial, burned: new Decimal(0), floaters: [] }
  nextFloaterId = 1
  for (const fn of listeners) fn()
}
