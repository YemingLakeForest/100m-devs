/**
 * The build queue, read for the screen — GDD §10.7 [amended 2026-10-04].
 *
 * Build and Test are decommissioned: a finished project joins the queue at once
 * and waits there for SHIP!, so the queue is a list of games and nothing else.
 * What is left to read is the contest it exists for — how *fast* the studio
 * turns out games, against how many it can *hold* while it waits for somebody to
 * ship them — and the one number a manager acts on: **how long until it stops
 * me.** That is {@link QueueView.fullIn}. It falls as the studio gets faster and
 * rises as the queue gets longer or somebody ships, so speed and room read as
 * the opposed pressures they are.
 *
 * Pure over a state: nothing here writes.
 */

import {
  getState,
  bufferCount,
  currentVelocity,
  shelfCapacity,
  pipelineOf,
  type GameState,
  type ShelvedBuild,
} from '../game/store.ts'

/**
 * - `stopped` — the queue is full, nobody codes, and only a ship starts it.
 * - `filling` — games arrive faster than they leave; `fullIn` is the countdown.
 * - `steady`  — Auto-Ship leaves at least as fast as games arrive.
 * - `idle`    — nothing is being coded (no velocity), so there is no rate to read.
 */
export type QueueFlow = 'stopped' | 'filling' | 'steady' | 'idle'

export interface QueueView {
  /** Oldest first: the one at the front is the one SHIP! sends next. */
  games: ShelvedBuild[]
  used: number
  capacity: number
  free: number
  /** The project being coded now, 0..1 — the game that joins the queue next. */
  coding: number
  /** Seconds until it is finished and joins. */
  nextBuildIn: number | null
  /** Seconds between games at today's speed. */
  cycle: number | null
  /** Seconds until the queue is full and the floor stops, if nothing ships. */
  fullIn: number | null
  autoShip: boolean
  /** Seconds between auto-ships, and the seconds to the next. */
  autoEvery: number | null
  autoIn: number | null
  flow: QueueFlow
}

export function queueView(s: GameState = getState()): QueueView {
  const fx = pipelineOf(s)
  const capacity = shelfCapacity(s)
  const used = bufferCount(s)

  const commitment = s.commitment.toNumber()
  const left = Math.max(0, commitment - s.burned.toNumber())
  const velocity = currentVelocity(s)
  const coding = commitment > 0 ? Math.min(1, Math.max(0, s.burned.toNumber() / commitment)) : 0
  const live = Number.isFinite(velocity) && velocity > 0
  const nextBuildIn = live ? left / velocity : null
  const cycle = live && commitment > 0 ? commitment / velocity : null

  const free = Math.max(0, capacity - used)
  // Each free slot takes one more game. The first arrives at \`nextBuildIn\`, the
  // rest a cycle apart. An estimate — the next project is a different size —
  // and drawn with a tilde for that reason.
  const fullIn = free === 0 ? 0 : nextBuildIn !== null && cycle !== null ? nextBuildIn + (free - 1) * cycle : null

  const autoEvery = fx.autoShip && Number.isFinite(fx.autoShipSeconds) ? fx.autoShipSeconds : null
  const autoIn = autoEvery !== null ? Math.max(0, autoEvery - s.autoShipClock) : null

  let flow: QueueFlow
  if (free === 0) flow = 'stopped'
  else if (cycle === null) flow = 'idle'
  else if (autoEvery !== null && autoEvery <= cycle) flow = 'steady'
  else flow = 'filling'

  return {
    games: s.shelf,
    used,
    capacity,
    free,
    coding,
    nextBuildIn,
    cycle,
    fullIn,
    autoShip: autoEvery !== null,
    autoEvery,
    autoIn,
    flow,
  }
}

/** 42s, 3m 05s. Whole seconds: this is read, not timed. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** The one line under the gauge — what the queue is doing to the player. */
export function queueLine(v: QueueView): string {
  switch (v.flow) {
    case 'stopped':
      return 'FULL // SHIP TO CODE'
    case 'steady':
      return `AUTO ${clock(v.autoIn ?? 0)}`
    case 'filling':
      return v.fullIn === null ? 'FILLING' : `FULL IN ~${clock(v.fullIn)}`
    default:
      return v.games.length ? 'WAITING' : 'EMPTY'
  }
}

/** The queue's mood as a shape the CSS can switch on. */
export function queueTone(v: QueueView): 'calm' | 'tight' | 'stopped' {
  if (v.flow === 'stopped') return 'stopped'
  if (v.flow === 'filling' && v.free <= 1) return 'tight'
  return 'calm'
}
