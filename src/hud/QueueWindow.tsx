/**
 * The build queue, opened — GDD §10.7 [amended 2026-10-04].
 *
 * Built the way the release ring is built — a centred frame, one instrument, the
 * brief, one chunky button, nothing that scrolls — and the instrument is GitLab's
 * pipeline graph, drawn thick: *"still too AI-sloppy… I want the general GitLab
 * pipeline layout, with thick stroke pixelated art style, don't over-complicate
 * it."* Three stages as columns (CODE, QUEUE, SHIP), a job card for every slot of
 * the queue, and a square-elbowed line from each stage to the next
 * (`PipelineGraph.tsx`). The SHIP job is the control: it ships the front game.
 *
 * Under it, the clock on the queue at 2x, and the ring's own rows: the game being
 * made (its cover, as the ring shows the build it is releasing), ROOM, the rate,
 * AUTO, and what ships next. No glow, no gradient, no box around anything that is
 * not a box.
 */

import { coverFor } from '../three/sim/cover.ts'
import { OsWindow } from '../ui/OsWindow.tsx'
import { Button } from '../ui/Button.tsx'
import { openLaunch, pipelineOpen, projectOrdinal, projectTitle, type GameState } from '../game/store.ts'
import { Cover } from './Cover.tsx'
import { PipelineGraph } from './PipelineGraph.tsx'
import { clock, queueLine, queueTone, queueView, type QueueView } from './queueModel.ts'

import '../styles/release.css'
import '../styles/queue.css'

/** ROOM pips drawn; a longer queue is a count. */
const PIPS_MAX = 8

function readout(v: QueueView): string {
  switch (v.flow) {
    case 'stopped':
      return 'The queue is full. Nobody can code until something ships.'
    case 'steady':
      return 'Auto-Ship leaves as fast as games arrive.'
    case 'filling':
      return 'Games are arriving faster than they ship.'
    default:
      return 'Nothing is being coded right now.'
  }
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
  const ready = v.games.length
  const pips = Math.max(1, Math.min(v.capacity, PIPS_MAX))
  const board = pipelineOpen()
  const making = projectTitle(state)
  const cover = coverFor(state.runSeed, projectOrdinal(state), 0, making.name, making.genre)

  const shipFront = () => {
    if (openLaunch()) onClose()
  }

  return (
    <OsWindow
      open={open}
      from="centre"
      modal
      title="BUILD QUEUE"
      meta={`${v.used}/${v.capacity}`}
      onClose={onClose}
      className="release-frame ring-frame"
      bodyClassName="release ring"
      footer={
        <Button className="ring__act queue__ship" disabled={ready === 0 || state.scene !== null} onClick={shipFront}>
          {ready > 0 ? `SHIP! (${ready})` : 'SHIP!'}
        </Button>
      }
    >
      <div className="ring__catch queue__catch" data-tone={tone}>
        <PipelineGraph v={v} state={state} onShip={shipFront} />

        <div className="queue__under">
          <div className="ring__brief">
            <p className="queue__big" role="status" data-tone={tone}>
              {queueLine(v)}
            </p>
            <div className="ring__shelf">
              <Cover spec={cover} title={making.name} unrated />
              <div className="ring__id">
                <p className="ring__kicker">NOW MAKING</p>
                <p className="ring__name">{making.name}</p>
              </div>
            </div>
            <p className="ring__say queue__say" data-tone={tone}>
              {readout(v)}
            </p>
          </div>
          <div className="ring__brief">
            <div className="ring__row" aria-label={`Room: ${v.free} free of ${v.capacity}`}>
              <span className="ring__k">ROOM</span>
              {Array.from({ length: pips }, (_, i) => (
                <span key={i} className="ring__pip" data-on={i < v.used ? 'true' : 'false'}>
                  {i + 1}
                </span>
              ))}
              {v.capacity > PIPS_MAX ? <span className="ring__best">+{v.capacity - PIPS_MAX}</span> : null}
            </div>
            <p className="ring__best">
              A GAME EVERY <b>{v.cycle === null ? 'NEVER' : clock(v.cycle)}</b>
            </p>
            <p className="ring__best">
              AUTO <b>{v.autoShip && v.autoEvery !== null ? `every ${clock(v.autoEvery)}` : 'you ship'}</b>
            </p>
            <p className="ring__best">
              NEXT OUT <b>{ready > 0 ? v.games[0].name : 'nothing yet'}</b>
            </p>
            {board ? (
              <Button className="queue__board" onClick={onBoard}>
                SERENA’S
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </OsWindow>
  )
}
