/**
 * The pipeline strip — GDD §10.7 [amended 2026-10-03], the queue on the base HUD.
 *
 * *"top hud not changed, the UI is bad. I want pipelines similar to gitlab… as
 * soon as game is built, it goes to pipeline… look gamey with game juice."* The
 * previous gauge was a line of small text in the left rail, two counters
 * (BUILD 0, TEST 0) nobody could act on, and a status line the rail truncated.
 * This is the replacement: a plate in the **top-left** PROJECT block, under the
 * burn-down that feeds it, that shows the queue the way a CI board shows runs.
 *
 * Every build that leaves Code is **a pipeline run, and it appears here the
 * moment it is built.** A run is a cover and three connected jobs
 * (BUILD → TEST → SHIP), each a node in one of five states (`PipeNode`). The
 * slots that are still free are dashed outlines, so the queue's size is the
 * number of boxes on the plate and a full plate is a plate with no gaps.
 *
 * ## Juice, and what each bit is for
 *
 * Every state change in the queue is an event the player caused or earned, so
 * every one of them is felt (§10.8 F3, "a state change this large makes a
 * noise"):
 *
 *  - a new run **drops in** from above with a squash, and ticks;
 *  - a job that finishes **pops** (the node remounts on its new state);
 *  - a run that reaches SHIP is **gold, bobbing and glowing**, and the SHIP! key
 *    beside it pulses with a count that bounces when it changes;
 *  - SHIP! **bursts** pixel sparks and the run that went flies off toward it;
 *  - a full plate **shakes, inverts and says FULL** — the same shape change the
 *    rest of the interface uses for a stopped thing, and the loudest thing on
 *    the screen, because the studio has stopped.
 *
 * Reduce-motion keeps every state and drops the movement (stylesheet), and skips
 * the exit ghosts, which only exist to be animated.
 */

import { useEffect, useRef, useState } from 'react'

import { Button } from '../ui/Button.tsx'
import { useReducedMotion } from '../ui/motion.ts'
import { playUi } from '../ui/uiSfx.ts'
import { coverFor } from '../three/sim/cover.ts'
import { openLaunch, type GameState } from '../game/store.ts'
import { Cover } from './Cover.tsx'
import { PipeNode } from './PipeNode.tsx'
import { JOB_LABELS, jobStates } from './pipeJobs.ts'
import { clock, queueLine, queueTone, queueView, type QueueCell } from './queueModel.ts'

import '../styles/pstrip.css'
import '../styles/pipeline.css'

/** Runs drawn on the plate; the rest are a count. A plate wider than this is not a glance. */
const MAX_DRAWN = 4
/** Sparks in a ship burst. Even, so the fan is symmetrical. */
const SPARKS = 10

function Chip({ cell, seed, out = false, onGone }: { cell: QueueCell; seed: number; out?: boolean; onGone?: () => void }) {
  const jobs = jobStates(cell)
  const { build } = cell
  return (
    <span
      className="pchip"
      data-stage={cell.stage}
      data-out={out ? 'true' : undefined}
      onAnimationEnd={out ? onGone : undefined}
      title={`${build.name} — ${cell.stage === 'ready' ? 'ready to ship' : cell.stage}`}
    >
      <span className="pchip__cover">
        <Cover spec={coverFor(seed, build.ordinal, 0, build.name, build.genre)} unrated />
      </span>
      <span className="pchip__jobs">
        {jobs.map((state, i) => (
          <span key={i} className="pchip__job">
            {i > 0 ? <i className="pchip__link" data-done={jobs[i - 1] === 'pass' ? 'true' : 'false'} /> : null}
            {/* Keyed on the state: a job that changes remounts, and its mount
                animation is the pop. */}
            <PipeNode key={state} state={state} label={JOB_LABELS[i]} />
          </span>
        ))}
      </span>
      {/* What the run is doing, in words: the rail is wide enough on a tall
          frame, and drops this on a short one. */}
      <span className="pchip__label">
        {cell.stage === 'ready' ? 'SHIP!' : cell.waiting ? 'QUEUED' : cell.secondsLeft !== null ? clock(cell.secondsLeft) : ''}
      </span>
    </span>
  )
}

/**
 * Runs that have left the queue, kept for the length of their exit animation.
 *
 * Derived while rendering, from the previous frame's ids, the same way the
 * action bar latches its spec — an effect that set state would paint the
 * departure one frame late.
 */
function useGhosts(cells: QueueCell[], reduced: boolean) {
  const key = cells.map((c) => c.build.id).join(',')
  const [prev, setPrev] = useState({ key, cells })
  const [ghosts, setGhosts] = useState<QueueCell[]>([])
  if (prev.key !== key) {
    setPrev({ key, cells })
    if (!reduced) {
      const gone = prev.cells.filter((p) => !cells.some((c) => c.build.id === p.build.id))
      if (gone.length) setGhosts((g) => [...g, ...gone])
    }
  }
  return { ghosts, drop: (id: number) => setGhosts((g) => g.filter((c) => c.build.id !== id)) }
}

export function PipelineStrip({ state, onOpen }: { state: GameState; onOpen: () => void }) {
  const reduced = useReducedMotion()
  const q = queueView(state)
  const tone = queueTone(q)
  const full = q.flow === 'stopped'
  const ready = q.cells.filter((c) => c.stage === 'ready').length
  const { ghosts, drop } = useGhosts(q.cells, reduced)

  // Oldest first, so the run that will ship next is at the top, next to the key.
  const drawn = q.cells.slice(0, MAX_DRAWN)
  const hidden = q.cells.length - drawn.length
  const room = Math.max(0, Math.min(q.capacity, MAX_DRAWN) - drawn.length)
  const line = queueLine(q)

  // Sound, from the diff: a tick when a job finishes, a click when a run
  // becomes shippable. Refs only — nothing here sets state.
  const seen = useRef<Map<number, string> | null>(null)
  useEffect(() => {
    const now = new Map(q.cells.map((c) => [c.build.id, c.stage]))
    const before = seen.current
    seen.current = now
    if (!before) return
    let ticked = false
    let readied = false
    for (const [id, stage] of now) {
      const was = before.get(id)
      if (was === undefined) ticked = true
      else if (was !== stage) {
        if (stage === 'ready') readied = true
        else ticked = true
      }
    }
    if (readied) playUi('click')
    else if (ticked) playUi('tick')
  })

  const summary =
    `Build queue: ${q.cells.length} of ${q.capacity} pipelines, ${ready} ready to ship. ${line}.` +
    (full ? ' Full: nobody can code until something ships.' : '')

  return (
    <div className="pstrip" data-tone={tone} data-full={full ? 'true' : 'false'} data-ready={ready > 0 ? 'true' : 'false'}>
      <button type="button" className="pstrip__main" data-key="queue" onClick={onOpen} aria-label={`${summary} Open the queue.`}>
        <span className="pstrip__head">
          <span className="pstrip__title">PIPELINES</span>
          <span className="pstrip__count">
            <b key={q.cells.length}>{q.cells.length}</b>/{q.capacity}
          </span>
          <span className="pstrip__eta" data-tone={tone}>
            {/* "FULL IN ~49s" on a tall frame, "FULL ~49s" on a short one. */}
            {line.startsWith('FULL IN ') ? (
              <>
                <span className="pstrip__in">FULL IN </span>
                <span className="pstrip__in pstrip__in--short">FULL </span>
                {line.slice('FULL IN '.length)}
              </>
            ) : (
              line
            )}
          </span>
        </span>
        <span className="pstrip__runs">
          {drawn.map((c) => (
            <Chip key={c.build.id} cell={c} seed={state.runSeed} />
          ))}
          {ghosts.map((c) => (
            <Chip key={`g${c.build.id}`} cell={c} seed={state.runSeed} out onGone={() => drop(c.build.id)} />
          ))}
          {Array.from({ length: room }, (_, i) => (
            <span key={`e${i}`} className="pchip pchip--empty" aria-hidden="true">
              <span className="pchip__cover" />
              <span className="pchip__jobs">
                <span className="pchip__dash" />
              </span>
              <span className="pchip__label">EMPTY</span>
            </span>
          ))}
          {hidden > 0 ? <span className="pstrip__more">+{hidden}</span> : null}
        </span>
      </button>

      <span className="pstrip__shipwrap">
        <Button
          className="pipe__ship pstrip__ship"
          data-key="ship"
          data-ready={ready > 0 ? 'true' : 'false'}
          data-full={full ? 'true' : 'false'}
          disabled={ready === 0 || state.scene !== null}
          onClick={() => openLaunch()}
          aria-label={
            ready === 0
              ? `Ship. Nothing ready yet.${q.autoIn !== null ? ` Auto-ship in ${Math.ceil(q.autoIn)} seconds.` : ''}`
              : `Ship ${state.shelf[0]?.name ?? ''}. ${ready} ready.${full ? ' The queue is full.' : ''}`
          }
        >
          {q.autoIn !== null && ready === 0 ? `AUTO ${Math.ceil(q.autoIn)}s` : 'SHIP!'}
          {ready > 0 ? <b className="pstrip__badge" key={ready}>{ready}</b> : null}
        </Button>
        {/* A burst per release, keyed on the release so it plays once. */}
        {state.ship && !reduced ? (
          <span className="pstrip__burst" key={state.ship.id} aria-hidden="true">
            {Array.from({ length: SPARKS }, (_, i) => {
              const a = (i / SPARKS) * Math.PI * 2
              return (
                <i
                  key={i}
                  style={{ '--dx': `${Math.round(Math.cos(a) * 34)}px`, '--dy': `${Math.round(Math.sin(a) * 26)}px` } as React.CSSProperties}
                />
              )
            })}
          </span>
        ) : null}
      </span>
    </div>
  )
}
