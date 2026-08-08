/**
 * The developer card — GDD §7.8.8.
 *
 * Slides in from the side, never a modal: §10.6 keeps the swarm simulating and
 * the player poking behind it, and a panel that stops the game to tell you
 * somebody's name is a worse game than one that does not have names.
 *
 * The important detail is that **the quote is live**. It is drawn from §19 for
 * this developer's *current* state and changes while the card is open, which is
 * the difference between a window onto a person and a record of one. A static
 * bio would be a stat block; a line that changes as they get overwhelmed is a
 * person having a bad afternoon.
 */

import { useEffect, useState } from 'react'
import { Panel } from '../ui/Panel.tsx'
import { Button } from '../ui/Button.tsx'
import { deskLine } from '../game/deskLines.ts'
import { selectDeveloper, selectedIdentity, type GameState } from '../game/store.ts'
import type { Identity } from '../sim/identity.ts'

/** How often the live quote is redrawn. Slow — this is a person, not a ticker. */
const QUOTE_MS = 4200

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="devcard__stat">
      <span className="devcard__stat-label">{label}</span>
      {/*
        A bar of blocks rather than a filled div, because ART_DIRECTION §1 says
        brackets and rules and this is the same idea in a readout: ten cells,
        some lit. It also stays legible at the size the card actually renders,
        where a 3px-tall progress bar is a smudge.
      */}
      <span className="devcard__stat-bar" aria-hidden="true">
        {'##########'.slice(0, Math.round(value / 10)).padEnd(10, '.')}
      </span>
      <span className="devcard__stat-value">{value}</span>
    </div>
  )
}

export function DevCard({ state }: { state: GameState }) {
  const who = selectedIdentity(state)

  // Latched, like every other Panel in this layer: the store clears `selected`
  // on deselect and the card has to survive its own exit animation.
  //
  // **Latched on the seat index, not on the identity.** The first version
  // compared the identity objects, and §7.8.7 *generates* those — a fresh
  // object on every call — so `who !== held` was true on every render, which
  // set state during render, which rendered again. An infinite loop that blanks
  // the whole app the instant anybody is selected.
  //
  // This is the trap in generating rather than storing, and it is worth naming:
  // a generated value is equal by *content* and never by reference, so anything
  // that keys off object identity has to key off the seed instead.
  const [heldSeat, setHeldSeat] = useState(state.selected)
  const [held, setHeld] = useState<Identity | null>(who)
  if (state.selected !== null && state.selected !== heldSeat) {
    setHeldSeat(state.selected)
    setHeld(who)
  }

  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (state.selected === null) return
    const timer = setInterval(() => setTick((n) => n + 1), QUOTE_MS)
    return () => clearInterval(timer)
  }, [state.selected])
  // Depends on the seat for the same reason the latch does, and this one would
  // have failed *silently*: a fresh `who` every render re-runs the effect every
  // render, so the interval is cleared and restarted before it can ever fire
  // and the "live" quote never changes once.

  const line =
    held && state.selected !== null
      ? deskLine(state.dev.state, state.selected + tick, 0.37)
      : null

  return (
    <Panel open={who !== null} from="right" className="devcard">
      {held && (
        <>
          <p className="devcard__name">{held.name}</p>
          <p className="devcard__sub">
            {held.stats.seniority >= 70 ? 'Senior' : held.stats.seniority >= 35 ? 'Mid' : 'Junior'}
            {held.trait ? ` · ${held.trait}` : ''}
          </p>

          <div className="devcard__stats">
            <Stat label="FOCUS" value={held.stats.focus} />
            <Stat label="CHATTER" value={held.stats.chatter} />
            <Stat label="SENIORITY" value={held.stats.seniority} />
          </div>

          {line && <p className="devcard__quote">&ldquo;{line}&rdquo;</p>}

          <Button onClick={() => selectDeveloper(null)}>CLOSE</Button>
        </>
      )}
    </Panel>
  )
}
