/**
 * The queue gauge — GDD §10.7 [amended 2026-10-04], in the top-left PROJECT block.
 *
 * Build and Test are gone: *"as soon as one sprint is done, it's in the build
 * queue, waiting to be shipped by the person or automatically."* So the gauge is
 * the queue and nothing else: the one line a manager acts on (how long until the
 * queue stops the floor), and under it the pipeline as GitLab draws one in a list
 * — a short row of nodes, CODE → QUEUE → SHIP (`PipelineGraph.tsx` has the
 * argument). The SHIP node is the key, so there is one control, not a picture of
 * one beside a button.
 *
 * A game finishing pops into the queue node with a click; SHIP! sends the front
 * game and the node empties by one; a tight queue blinks its line and a full one
 * reds its node. Reduce-motion keeps every state.
 *
 * A tap on the CODE and QUEUE nodes opens `QueueWindow`; Serena's card, where its
 * size and speed are bought, is a button inside that.
 */

import { useEffect, useRef } from 'react'

import { Button } from '../ui/Button.tsx'
import { playUi } from '../ui/uiSfx.ts'
import { openLaunch, type GameState } from '../game/store.ts'
import { PipelineRow } from './PipelineGraph.tsx'
import { queueLine, queueTone, queueView } from './queueModel.ts'

import '../styles/pipeline.css'

export function PipelineStrip({ state, onOpen }: { state: GameState; onOpen: () => void }) {
  const q = queueView(state)
  const tone = queueTone(q)
  const full = q.flow === 'stopped'
  const ready = q.games.length
  const line = queueLine(q)

  // Sound, from the diff: a click when a game joins the queue. Refs only —
  // nothing here sets state.
  const seen = useRef<Set<number> | null>(null)
  useEffect(() => {
    const now = new Set(q.games.map((g) => g.id))
    const before = seen.current
    seen.current = now
    if (before && [...now].some((id) => !before.has(id))) playUi('click')
  })

  const summary =
    `Build queue: ${ready} of ${q.capacity} slots used. ${line}.` + (full ? ' Full: nobody can code until something ships.' : '')

  return (
    <div className="qgauge" data-tone={tone} data-full={full ? 'true' : 'false'} data-ready={ready > 0 ? 'true' : 'false'}>
      <span className="qgauge__head">
        <span className="qgauge__title">QUEUE</span>
        <span className="qgauge__count">
          <b key={ready}>{ready}</b>/{q.capacity}
        </span>
        <span className="qgauge__eta" data-tone={tone}>
          {/* "FULL IN ~49s" on a tall frame, "FULL ~49s" on a short one. */}
          {line.startsWith('FULL IN ') ? (
            <>
              <span className="qgauge__in">FULL IN </span>
              <span className="qgauge__in qgauge__in--short">FULL </span>
              {line.slice('FULL IN '.length)}
            </>
          ) : (
            line
          )}
        </span>
      </span>

      <PipelineRow v={q} onOpen={onOpen} label={`${summary} Open the queue.`}>
        <Button
          className="pipe__ship qgauge__ship"
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
          {ready > 0 ? (
            <b className="qgauge__badge" key={ready}>
              {ready}
            </b>
          ) : null}
        </Button>
      </PipelineRow>
    </div>
  )
}
