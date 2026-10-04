/**
 * The queue as a pipeline graph — GDD §10.7 [amended 2026-10-04].
 *
 * *"Still too AI-sloppy. I want the general GitLab pipeline layout, with a thick
 * stroke pixelated art style. Don't over-complicate it."* So this is GitLab's
 * pipeline graph and nothing cleverer: **stages are columns, jobs are cards in
 * them, and a line runs from each stage to the next** with square elbows.
 *
 *     CODE            QUEUE                SHIP
 *    ┌────────┐      ┌───────────────┐
 *    │ ◐ CODE │──┬───│ ✓ Nova Turret │──┐
 *    │  name  │  ├───│ ✓ Pixel Quest │──┼──┌────────┐
 *    └────────┘  └───│ – EMPTY       │──┘  │ ▶ SHIP!│
 *                    └───────────────┘     └────────┘
 *
 * The CODE job is running while the studio works, blocked when the queue is full,
 * and idle when nothing is being made. The QUEUE stage has a job for every slot:
 * passed (a tick, and the game's cover) when a game is in it, an empty dashed one
 * when not. The SHIP job is the manual one — GitLab's play button — and it is the
 * control: it ships the front game.
 *
 * The art is thick and blunt: 3px strokes, notched square corners, a hard offset
 * shadow, chunky pixel icons drawn as rectangles. No glow, no gradient, no blur,
 * no canvas, and no motion beyond a stepped spinner and a stepped pop when a game
 * arrives. (The previous pass — a canvas bitmap of a pipe — was more clever than
 * this and read as less like what it is.)
 *
 * `PipelineGraph` is the window's; `PipelineRow` is the rail's: the same three
 * stages as one short row of nodes, which is how GitLab draws a pipeline in a list.
 */

import type { CSSProperties } from 'react'

import { coverFor } from '../three/sim/cover.ts'
import type { GameState } from '../game/store.ts'
import { Cover } from './Cover.tsx'
import { clock, queueTone, type QueueView } from './queueModel.ts'

import '../styles/graph.css'

/** Job cards shown in the QUEUE stage; a longer queue is a count. */
const MAX_ROWS = 4
const SEGMENTS = 6

type IconKind = 'check' | 'x' | 'play' | 'dash' | 'spin'

/** Thick pixel icons on a 9 by 9 grid, as rectangles. */
const CELLS: Record<Exclude<IconKind, 'spin'>, readonly (readonly [number, number])[]> = {
  check: [[1, 4], [2, 5], [3, 6], [4, 5], [5, 4], [6, 3], [7, 2], [1, 5], [2, 6], [3, 7], [4, 6], [5, 5], [6, 4], [7, 3]],
  x: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [7, 1], [6, 2], [5, 3], [3, 5], [2, 6], [1, 7], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [7, 6], [6, 1], [5, 2], [3, 4], [2, 5], [1, 6]],
  play: [
    [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8],
    [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7],
    [4, 2], [4, 3], [4, 4], [4, 5], [4, 6],
    [5, 3], [5, 4], [5, 5],
    [6, 4],
  ],
  dash: [[1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5]],
}

function Icon({ kind }: { kind: IconKind }) {
  if (kind === 'spin') return <span className="gl__spin" aria-hidden="true" />
  return (
    <svg className="gl__svg" viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true">
      {CELLS[kind].map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} />
      ))}
    </svg>
  )
}

function Segs({ progress }: { progress: number }) {
  const on = Math.round(Math.min(1, Math.max(0, progress)) * SEGMENTS)
  return (
    <span className="gl__segs" aria-hidden="true">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <i key={i} data-on={i < on ? 'true' : 'false'} />
      ))}
    </span>
  )
}

/** The CODE job's state: running, blocked by a full queue, or idle. */
function codeState(v: QueueView): { kind: IconKind; state: 'run' | 'block' | 'idle' } {
  if (queueTone(v) === 'stopped') return { kind: 'x', state: 'block' }
  if (v.nextBuildIn === null) return { kind: 'dash', state: 'idle' }
  return { kind: 'spin', state: 'run' }
}

/** The line from a stage to the next: a stub out, a bar, a stub into each job. */
function Link({ rows, side, lit }: { rows: number; side: 'in' | 'out'; lit: number }) {
  return (
    <div className="gl__link" data-side={side} data-lit={lit > 0 ? 'true' : 'false'} style={{ '--rows': rows } as CSSProperties} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <i key={i} data-pos={rows === 1 ? 'only' : i === 0 ? 'first' : i === rows - 1 ? 'last' : 'mid'} data-on={i < lit ? 'true' : 'false'} />
      ))}
    </div>
  )
}

export function PipelineGraph({
  v,
  state,
  onShip,
}: {
  v: QueueView
  state: GameState
  /** The SHIP job, which is the control. */
  onShip: () => void
}) {
  const rows = Math.max(1, Math.min(v.capacity, MAX_ROWS))
  const code = codeState(v)
  const tone = queueTone(v)
  const ready = v.games.length
  const flowing = code.state === 'run'
  const more = v.capacity - rows

  return (
    <div className="gl" data-size="full" data-tone={tone} style={{ '--rows': rows } as CSSProperties}>
      <div className="gl__col">
        <p className="gl__head">CODE</p>
        <div className="gl__jobs gl__jobs--one">
          <div className="gl__job" data-state={code.state}>
            <span className="gl__icon">
              <Icon kind={code.kind} />
            </span>
            <span className="gl__txt">
              <b>{code.state === 'block' ? 'BLOCKED' : code.state === 'idle' ? 'IDLE' : 'CODING'}</b>
              <Segs progress={v.coding} />
            </span>
          </div>
        </div>
      </div>

      <Link rows={rows} side="in" lit={flowing ? rows : 0} />

      <div className="gl__col gl__col--queue">
        <p className="gl__head">
          QUEUE <b>{v.used}/{v.capacity}</b>
        </p>
        <div className="gl__jobs">
          {Array.from({ length: rows }, (_, i) => {
            const game = v.games[i]
            if (!game) {
              return (
                <div key={`e${i}`} className="gl__job" data-state="none">
                  <span className="gl__icon">
                    <Icon kind="dash" />
                  </span>
                  <span className="gl__txt">
                    <b>EMPTY</b>
                    <i>{i === rows - 1 && more > 0 ? `+${more} more slots` : 'free slot'}</i>
                  </span>
                </div>
              )
            }
            return (
              <div key={game.id} className="gl__job" data-state="pass" data-front={i === 0 ? 'true' : undefined}>
                <span className="gl__icon">
                  <Icon kind="check" />
                </span>
                <span className="gl__cover">
                  <Cover spec={coverFor(state.runSeed, game.ordinal, 0, game.name, game.genre)} title={game.name} unrated />
                </span>
                <span className="gl__txt">
                  <b>{game.name}</b>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <Link rows={rows} side="out" lit={ready > 0 ? Math.min(rows, ready) : 0} />

      <div className="gl__col">
        <p className="gl__head">SHIP</p>
        <div className="gl__jobs gl__jobs--one">
          <button type="button" className="gl__job gl__job--button" data-state={ready > 0 ? 'manual' : 'none'} onClick={onShip} disabled={ready === 0 || state.scene !== null}>
            <span className="gl__icon">
              <Icon kind="play" />
            </span>
            <span className="gl__txt">
              <b>SHIP!</b>
              <i>{v.autoShip && v.autoIn !== null ? `AUTO ${clock(v.autoIn)}` : 'BY HAND'}</i>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * The rail's version: the same three stages as a short row of nodes, which is how
 * GitLab draws a pipeline in a list. The CODE and QUEUE nodes are one button that
 * opens the queue; the SHIP node is the key, passed in.
 */
export function PipelineRow({
  v,
  onOpen,
  label,
  children,
}: {
  v: QueueView
  onOpen: () => void
  label: string
  children: React.ReactNode
}) {
  const code = codeState(v)
  const slots = Math.max(1, Math.min(v.capacity, 6))
  const used = v.games.length
  const lit = used >= v.capacity ? slots : used === 0 ? 0 : Math.max(1, Math.round((used * slots) / v.capacity))
  return (
    <span className="gl gl--row" data-size="mini" data-tone={queueTone(v)}>
      <button type="button" className="gl__open" data-key="queue" onClick={onOpen} aria-label={label}>
        <span className="gl__node gl__node--code" data-state={code.state}>
          <span className="gl__icon">
            <Icon kind={code.kind} />
          </span>
          <span className="gl__fill" style={{ '--p': v.coding } as CSSProperties} />
        </span>
        <i className="gl__line" data-on={code.state === 'run' ? 'true' : 'false'} />
        <span className="gl__node gl__node--queue" data-full={used >= v.capacity ? 'true' : 'false'}>
          {Array.from({ length: slots }, (_, k) => (
            <i key={k} data-on={k < lit ? 'true' : 'false'} />
          ))}
        </span>
      </button>
      <i className="gl__line" data-on={used > 0 ? 'true' : 'false'} />
      {children}
    </span>
  )
}
