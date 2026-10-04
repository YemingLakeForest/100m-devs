/**
 * The build queue, read for the screen — GDD §10.7 [amended 2026-10-03].
 *
 * The mechanic was already the right shape and the screen did not say so: Code,
 * Build and Test all draw from **one** capacity, and a full queue stops the
 * floor. That makes two things the player is always trading — how *fast* the
 * studio turns out builds, and how *many* it can hold while it waits for
 * somebody to ship them — and a tally of slots is not enough to see the trade.
 * What the player needs is the one number a manager actually acts on: **how long
 * until it stops me.** That is {@link QueueView.fullIn}, and it is the whole
 * reason this file exists. It falls as the studio gets faster and rises as the
 * queue gets longer or somebody ships, so speed and room read as the opposed
 * pressures they are.
 *
 * Pure over a state: nothing here writes.
 */

import {
  getState,
  bufferCount,
  currentVelocity,
  shelfCapacity,
  stageSecondsFor,
  pipelineOf,
  type GameState,
  type ShelvedBuild,
} from '../game/store.ts'

export type CellStage = 'build' | 'test' | 'ready'

export interface QueueCell {
  build: ShelvedBuild
  stage: CellStage
  /** 0..1 through the stage it is in; 1 once it is ready. */
  progress: number
  /** Seconds to leave the stage — null while it waits behind another build. */
  secondsLeft: number | null
  /** Parked behind the head of its lane: the jam §11.4 draws. */
  waiting: boolean
}

/**
 * - `stopped` — the queue is full, nobody codes, and only a ship starts it.
 * - `filling` — builds arrive faster than they leave; `fullIn` is the countdown.
 * - `steady`  — Auto-Ship leaves at least as fast as builds arrive.
 * - `idle`    — nothing is being coded (no velocity), so there is no rate to read.
 */
export type QueueFlow = 'stopped' | 'filling' | 'steady' | 'idle'

export interface QueueView {
  /** Oldest first: ready, then Test, then Build — the order they will be shippable. */
  cells: QueueCell[]
  used: number
  capacity: number
  free: number
  /** The project being coded now, 0..1 — the head of the pipe, before Build. */
  coding: number
  /** Seconds until the next build leaves Code. */
  nextBuildIn: number | null
  /** Seconds between builds at today's speed. */
  cycle: number | null
  /** Seconds until the queue is full and the floor stops, if nothing ships. */
  fullIn: number | null
  autoShip: boolean
  /** Seconds between auto-ships, and the seconds to the next. */
  autoEvery: number | null
  autoIn: number | null
  flow: QueueFlow
  buildSpeed: number
  testSpeed: number
}

export function queueView(s: GameState = getState()): QueueView {
  const fx = pipelineOf(s)
  const capacity = shelfCapacity(s)
  const used = bufferCount(s)

  const lane = (stage: 'build' | 'test'): QueueCell[] =>
    s.pipeline[stage].map((f, i) => {
      const seconds = stageSecondsFor(s, stage, f.item)
      return {
        build: f.item,
        stage,
        progress: Math.min(1, Math.max(0, f.progress)),
        secondsLeft: i === 0 ? Math.max(0, (1 - f.progress) * seconds) : null,
        waiting: i > 0,
      }
    })
  const cells: QueueCell[] = [
    ...s.shelf.map((build): QueueCell => ({ build, stage: 'ready', progress: 1, secondsLeft: 0, waiting: false })),
    ...lane('test'),
    ...lane('build'),
  ]

  const commitment = s.commitment.toNumber()
  const left = Math.max(0, commitment - s.burned.toNumber())
  const velocity = currentVelocity(s)
  const coding = commitment > 0 ? Math.min(1, Math.max(0, s.burned.toNumber() / commitment)) : 0
  const live = Number.isFinite(velocity) && velocity > 0
  const nextBuildIn = live ? left / velocity : null
  const cycle = live && commitment > 0 ? commitment / velocity : null

  const free = Math.max(0, capacity - used)
  // Each free slot takes one more build. The first arrives at `nextBuildIn`,
  // the rest a cycle apart. An estimate — the next project is a different size —
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
    cells,
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
    buildSpeed: fx.buildSpeed,
    testSpeed: fx.testSpeed,
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
      return v.cells.length ? 'WAITING' : 'EMPTY'
  }
}

/** The queue's mood as a shape the CSS can switch on. */
export function queueTone(v: QueueView): 'calm' | 'tight' | 'stopped' {
  if (v.flow === 'stopped') return 'stopped'
  if (v.flow === 'filling' && v.free <= 1) return 'tight'
  return 'calm'
}
