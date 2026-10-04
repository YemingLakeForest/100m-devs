/**
 * The build queue, opened — GDD §10.7 [amended 2026-10-03].
 *
 * *"I want pipelines similar to gitlab."* So this is a pipeline graph: one row
 * per run, and across it the jobs the run passes through, each a node joined to
 * the next by a line that fills in as the stage before it passes. The columns
 * are labelled once at the top (BUILD, TEST, SHIP), the way a CI board labels
 * its stages; the rows carry the cover, the name and a status pill.
 *
 * Above the graph is the managing half — the two pressures the screen exists to
 * show. **How much room is left, and how long until it stops me**, and then
 * SPEED against ROOM side by side, each with what raises it. A player who reads
 * only the top of this window knows what to do; one who reads the graph knows
 * why.
 *
 * Drawn in the release ring's register — 1px rules, stepped bars, whole-pixel
 * covers — at sizes meant to be *read*: figures at 2x, labels in the bright ink
 * rather than the dim one (the dim ink was the complaint about the rest of the
 * HUD, and it is not repeated here).
 */

import { coverFor } from '../three/sim/cover.ts'
import { OsWindow } from '../ui/OsWindow.tsx'
import { Button } from '../ui/Button.tsx'
import { openLaunch, pipelineOpen, projectTitle, type GameState } from '../game/store.ts'
import { Cover } from './Cover.tsx'
import { PipeNode } from './PipeNode.tsx'
import { JOB_LABELS, jobStates, type NodeState } from './pipeJobs.ts'
import { clock, queueLine, queueTone, queueView, type CellStage, type QueueCell, type QueueView } from './queueModel.ts'

import '../styles/pstrip.css'
import '../styles/queue.css'

/** Past this many segments a bar is scaled, not drawn one-per-slot. */
const MAX_SEGMENTS = 24
/** Rows of empty slots drawn in the graph before it says how many more. */
const MAX_EMPTY_ROWS = 3
const SEGMENTS_PER_BAR = 12

const PILL: Record<CellStage, string> = { build: 'BUILDING', test: 'TESTING', ready: 'READY' }

/** One segment per slot (scaled when there are hundreds), in the order they fill. */
function slotSegments(v: QueueView): ('free' | CellStage)[] {
  const n = Math.min(v.capacity, MAX_SEGMENTS)
  const scale = v.capacity / n
  const counts: Record<CellStage, number> = { ready: 0, test: 0, build: 0 }
  for (const c of v.cells) counts[c.stage] += 1
  let ready = Math.round(counts.ready / scale)
  let flight = Math.round((counts.test + counts.build) / scale)
  // A non-zero count never rounds away: one build in a slot bar of two hundred
  // is still one lit segment, or the bar says the queue is empty when it is not.
  if (counts.ready > 0) ready = Math.max(1, ready)
  if (counts.test + counts.build > 0) flight = Math.max(1, flight)
  const out: ('free' | CellStage)[] = []
  for (let i = 0; i < n; i++) out.push(i < ready ? 'ready' : i < ready + flight ? 'test' : 'free')
  return out
}

function Bar({ progress }: { progress: number }) {
  const on = Math.round(progress * SEGMENTS_PER_BAR)
  return (
    <span className="queue__bar" aria-hidden="true">
      {Array.from({ length: SEGMENTS_PER_BAR }, (_, i) => (
        <i key={i} data-on={i < on ? 'true' : 'false'} />
      ))}
    </span>
  )
}

/** The three jobs of one run, joined by lines that fill as each stage passes. */
function Jobs({ states, detail }: { states: readonly NodeState[]; detail: (i: number) => string }) {
  return (
    <>
      {states.map((s, i) => (
        <span key={i} className="queue__job" data-state={s}>
          {i > 0 ? <i className="queue__wire" data-done={states[i - 1] === 'pass' ? 'true' : 'false'} /> : null}
          <PipeNode key={s} state={s} label={JOB_LABELS[i]} />
          <span className="queue__jobtext">{detail(i)}</span>
        </span>
      ))}
    </>
  )
}

function Run({ cell, seed }: { cell: QueueCell; seed: number }) {
  const { build } = cell
  const states = jobStates(cell)
  const detail = (i: number) => {
    const s = states[i]
    if (s === 'pass') return 'PASSED'
    if (s === 'ready') return 'SHIP ME'
    if (s === 'wait') return 'QUEUED'
    if (s === 'run') return cell.secondsLeft !== null ? clock(cell.secondsLeft) : 'RUNNING'
    return '—'
  }
  return (
    <li className="queue__run" data-stage={cell.stage}>
      <span className="queue__who">
        <span className="queue__cover">
          <Cover spec={coverFor(seed, build.ordinal, 0, build.name, build.genre)} title={build.name} unrated />
        </span>
        <span className="queue__id">
          <span className="queue__name">{build.name}</span>
          <span className="queue__pill" data-stage={cell.stage}>
            #{build.ordinal + 1} {PILL[cell.stage]}
          </span>
        </span>
      </span>
      <Jobs states={states} detail={detail} />
    </li>
  )
}

export function QueueWindow({
  open,
  state,
  onClose,
  onBoard,
}: {
  open: boolean
  state: GameState
  onClose: () => void
  /** Serena's card, where capacity, speed and Auto-Ship are bought. */
  onBoard: () => void
}) {
  const v = queueView(state)
  const tone = queueTone(v)
  const segs = slotSegments(v)
  const shownEmpty = Math.min(v.free, MAX_EMPTY_ROWS)
  const coding = projectTitle(state)
  const ready = v.cells.filter((c) => c.stage === 'ready').length
  const board = pipelineOpen()

  return (
    <OsWindow
      open={open}
      from="top"
      className="hud__queue"
      title="PIPELINES"
      meta={`${v.used}/${v.capacity}`}
      onClose={onClose}
      footer={
        <div className="queue__foot">
          <Button
            className="queue__ship"
            disabled={ready === 0 || state.scene !== null}
            onClick={() => {
              if (openLaunch()) onClose()
            }}
          >
            {ready > 0 ? `SHIP! (${ready})` : 'SHIP!'}
          </Button>
          {board ? (
            <Button className="queue__board" onClick={onBoard}>
              SERENA’S BOARD
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="queue" data-tone={tone}>
        {/* The room, and the clock on it. */}
        <section className="queue__gauge" aria-label="Queue capacity">
          <span className="queue__slots" aria-hidden="true">
            {segs.map((s, i) => (
              <i key={i} data-slot={s} />
            ))}
          </span>
          <p className="queue__line" role="status">
            {queueLine(v)}
          </p>
          <p className="queue__sub">
            {v.flow === 'stopped'
              ? 'The queue is full. Nobody can code until something ships.'
              : v.flow === 'steady'
                ? 'Auto-Ship leaves as fast as builds arrive.'
                : v.flow === 'filling'
                  ? 'Builds are arriving faster than they ship.'
                  : 'Nothing is being coded right now.'}
          </p>
        </section>

        {/* The contest. */}
        <section className="queue__trade" aria-label="Speed against room">
          <div className="queue__stat">
            <span className="queue__k">SPEED</span>
            <b>{v.cycle === null ? '--' : `1 / ${clock(v.cycle)}`}</b>
            <span className="queue__d">builds out of Code · Build x{v.buildSpeed.toFixed(2)} · Test x{v.testSpeed.toFixed(2)}</span>
          </div>
          <span className="queue__vs" aria-hidden="true">
            VS
          </span>
          <div className="queue__stat">
            <span className="queue__k">ROOM</span>
            <b>{v.free} FREE</b>
            <span className="queue__d">
              {v.autoShip && v.autoEvery !== null ? `Auto-Ship every ${clock(v.autoEvery)}` : 'you ship by hand'}
            </span>
          </div>
        </section>

        {/* The graph. */}
        <div className="queue__stagehead" aria-hidden="true">
          <span>PIPELINE</span>
          {JOB_LABELS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        <ul className="queue__list" aria-label="Pipelines in the queue">
          <li className="queue__run queue__run--code">
            <span className="queue__who">
              <span className="queue__id">
                <span className="queue__name">CODING · {coding.name}</span>
                <Bar progress={v.coding} />
              </span>
            </span>
            <span className="queue__codenote">{v.nextBuildIn === null ? 'paused' : `build starts in ${clock(v.nextBuildIn)}`}</span>
          </li>
          {v.cells.map((c) => (
            <Run key={c.build.id} cell={c} seed={state.runSeed} />
          ))}
          {Array.from({ length: shownEmpty }, (_, i) => (
            <li key={`e${i}`} className="queue__run queue__run--empty">
              <span className="queue__name">EMPTY SLOT</span>
            </li>
          ))}
          {v.free > shownEmpty ? <li className="queue__more">+{v.free - shownEmpty} MORE SLOTS FREE</li> : null}
        </ul>
      </div>
    </OsWindow>
  )
}
