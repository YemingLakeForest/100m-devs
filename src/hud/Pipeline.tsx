/**
 * The pipeline — GDD §10.7 [amended 2026-09-26], drawn in STUDIO_OS.
 *
 * *"port the release little game and the pipeline, it needs to fit the current
 * game aesthetics."* The rebuild drew this as nodes and wires in its Ledger
 * corner (Code → Build → Test → buffer slots, ending in SHIP!). The mechanics
 * came across whole (`sim/pipeline.ts`); the drawing is this build's own:
 * ART_DIRECTION's one hue at a time, 1px rules, integer type, and state said
 * by **shape** — a jammed stage and a full buffer invert, the way a filled
 * selection does (§10.8a) — rather than by a new colour.
 *
 * It lives in the PROJECT block, under the burn-down, because the burn-down
 * *is* the Code stage: the line runs down, the build drops onto the belt, and
 * the belt runs out to the key that ships it. One block, not two, so the rail
 * does not spend a label and a border on a thing that is the same story.
 *
 * The key is a full-width button because it is the loop's payoff and a thumb
 * lands on it several times a minute. It is drawn before anything is on the
 * belt, disabled, so a player meets the control before they need it rather
 * than watching one appear under their thumb.
 */

import { Button } from '../ui/Button.tsx'
import { beltView, openLaunch, pipelineOpen, type GameState } from '../game/store.ts'

import '../styles/pipeline.css'

/** Past this many slots the buffer is a count, not a row of squares. */
const MAX_DRAWN_SLOTS = 8

export function Pipeline({ state, onBoard }: { state: GameState; onBoard?: () => void }) {
  const belt = beltView(state)
  const full = belt.buffer >= belt.capacity
  const inFlight = belt.build + belt.test
  const drawn = Math.min(belt.capacity, MAX_DRAWN_SLOTS)
  const board = onBoard && pipelineOpen()
  const auto = belt.autoShip && belt.autoShipIn !== null ? `AUTO ${Math.ceil(belt.autoShipIn)}s` : null

  const summary =
    `Pipeline: ${belt.build} building, ${belt.test} testing, ${belt.ready} ready to ship, ` +
    `${belt.buffer} of ${belt.capacity} slots used.${full ? ' Full: nobody can code until something ships.' : ''}` +
    `${auto ? ` Auto-ship in ${Math.ceil(belt.autoShipIn ?? 0)} seconds.` : ''}`

  const row = (
    <>
      <span className="pipe__node" data-state={belt.buildJam ? 'jam' : belt.build ? 'busy' : 'idle'}>
        BUILD<b>{belt.build}</b>
      </span>
      <span className="pipe__wire" aria-hidden="true" />
      <span className="pipe__node" data-state={belt.testJam ? 'jam' : belt.test ? 'busy' : 'idle'}>
        TEST<b>{belt.test}</b>
      </span>
      <span className="pipe__wire" aria-hidden="true" />
      <span className="pipe__slots" data-full={full ? 'true' : 'false'} aria-hidden="true">
        {belt.capacity > MAX_DRAWN_SLOTS ? (
          <span className="pipe__tally">
            {belt.buffer}/{belt.capacity}
          </span>
        ) : (
          Array.from({ length: drawn }, (_, i) => (
            <i key={i} data-slot={i < belt.ready ? 'ready' : i < belt.ready + inFlight ? 'flight' : 'free'} />
          ))
        )}
      </span>
    </>
  )

  return (
    <div className="pipe" data-full={full ? 'true' : 'false'}>
      {board ? (
        <button type="button" className="pipe__belt pipe__belt--tap" onClick={onBoard} aria-label={`${summary} Open Serena's card.`}>
          {row}
        </button>
      ) : (
        <div className="pipe__belt" role="group" aria-label={summary}>
          {row}
        </div>
      )}
      <Button
        className="pipe__ship"
        data-ready={belt.ready > 0 ? 'true' : 'false'}
        data-full={full ? 'true' : 'false'}
        disabled={belt.ready === 0 || state.scene !== null}
        onClick={() => openLaunch()}
        aria-label={
          belt.ready === 0
            ? `Ship. Nothing ready yet.${auto ? ` ${auto}.` : ''}`
            : `Ship ${state.shelf[0]?.name ?? ''}. ${belt.ready} ready.${full ? ' The buffer is full.' : ''}`
        }
      >
        {/* The word only: how many are ready, and whether the buffer is full,
            are the slots' to say (a full buffer inverts them and the key
            blinks). A count or a FULL in the label ran into the button's own
            bracket on the narrow rail. */}
        {auto && belt.ready === 0 ? auto : 'SHIP!'}
      </Button>
    </div>
  )
}
