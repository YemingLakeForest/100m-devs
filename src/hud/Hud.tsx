import { useEffect, useState } from 'react'
import { applyEntropyTheme, entropyTheme } from '../art/entropyTheme.ts'
import {
  canHire,
  currentEntropy,
  hireDeveloper,
  massHire,
  nextHireCost,
  triggerParadigmShift,
  type GameState,
} from '../game/store.ts'
import { PHASE_COPY } from '../game/onboarding.ts'
import type { StageHandle } from '../render/stage.ts'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import { Typewriter } from '../ui/Typewriter.tsx'
import { BurnDown } from './BurnDown.tsx'
import { Cash, Devs, Shipped, Speedometer, Velocity } from './Readouts.tsx'
import { DialoguePreview } from './DialoguePreview.tsx'
import { Upgrades } from './Upgrades.tsx'
import { actionFor, formatMoney, type ActionSpec } from './hudModel.ts'
import { useGameState } from './useGameState.ts'

/**
 * Dev-only §10.7 preview — `?dialogue`. Read once, at module load, for the
 * same reason App.tsx reads `?act` there: a query string cannot change
 * mid-session, and re-parsing it every render would be work done 60 times a
 * second to reach the same answer.
 */
const PREVIEW_DIALOGUE =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('dialogue')

/**
 * The HUD — GDD §7.1, §10.1, §23.4.2, and the §21 script.
 *
 * **The frame is landscape and the layout is anchored to its edges.** §23.4.2
 * is the constraint that shapes everything below: phone landscape runs from
 * 1.78:1 to 2.4:1, the 2:1 isometric floor fits to *height* and therefore
 * leaves margin at the sides on anything wider than 2:1, and that margin is
 * where the HUD lives. So the frame is two fixed-width rails pinned to the left
 * and right edges with the simulation breathing between them: as the device
 * gets wider the rails stay put and the gap grows, which is the behaviour
 * "anchor to edges, never to fractions of the width" is asking for. The
 * previous layout stacked seven full-width rows and folded in on itself the
 * moment the frame was shorter than it was tall.
 *
 * The UI is a Layer (§7.1): overlayed, semi-transparent, contextual, and
 * `pointer-events: none` except on real controls, because the simulation behind
 * it must stay pokeable straight through the overlay. Nothing here is opaque
 * and nothing here is a window box.
 *
 * Per ART_DIRECTION §1.0a this layer is a second pane of glass in front of the
 * tube rather than phosphor burned into it — it does not pass through the Pixi
 * post-process, and it is held together by the palette and the type system
 * instead.
 */
export function Hud({ stage }: { stage: StageHandle | null }) {
  const state = useGameState()
  const entropy = currentEntropy(state)
  const theme = entropyTheme(entropy)
  const copy = PHASE_COPY[state.phase]

  // The interface hue is a direct function of Entropy — ART_DIRECTION §1.1.
  // Written to the document root so the CSS token cascade carries it to every
  // element at once, rather than each component subscribing to entropy itself.
  //
  // Driven by the true entropy rather than by the speedometer's sprung value:
  // colour is allowed to lead the number, and it should — the frame going amber
  // before the readout has finished climbing is the situation announcing itself.
  useEffect(() => {
    applyEntropyTheme(theme, document.documentElement)
  }, [theme])

  return (
    <div className="hud">
      {/* Top-left — §10.1's Active Project, "a descending line, not a filling bar". */}
      <div className="hud__project">
        <BurnDown state={state} />
      </div>

      {/* Mid-left — §10.1 puts the speedometer here and velocity directly under it. */}
      <div className="hud__gauges">
        <Speedometer entropy={entropy} />
        <Velocity state={state} />
      </div>

      {/* Top-right — §10.1's resource bar, turned on its side to use the margin. */}
      <div className="hud__resources">
        <Cash state={state} />
        <Devs state={state} />
        <Shipped state={state} />
      </div>

      <Bubble text={state.bubble?.text ?? null} />
      <ActionBar spec={actionFor(state.phase)} state={state} />

      <div className="hud__script">
        {/*
          The banner types itself in rather than appearing. A phase change that
          swaps one block of terminal text for another with no motion between
          them is F1 by the letter — and a terminal that types is the register
          the whole product is written in anyway (§10.7).
        */}
        {copy.terminal && (
          <pre className="hud__terminal">
            <Typewriter text={copy.terminal.join('\n')} />
          </pre>
        )}
        {copy.advisor && (
          <p className="hud__advisor">
            {/* The advisor is a character, so its letters land with a tick
                (§10.7). The banner above is machine output and stays silent —
                two typewriters ticking at once is a buzz, not a voice. */}
            <Typewriter text={copy.advisor} sound />
          </p>
        )}
      </div>

      <div className="hud__controls">
        <PerfOverlay stage={stage} />
        <Upgrades />
      </div>

      <Bankruptcy open={state.phase === 'bankrupt'} />
      {PREVIEW_DIALOGUE && <DialoguePreview />}
    </div>
  )
}

/** The three store verbs this layer is allowed to call, by `ActionSpec.action`. */
const RUN_ACTIONS: Record<ActionSpec['action'], () => void> = {
  hire: hireDeveloper,
  massHire,
  paradigmShift: triggerParadigmShift,
}

/**
 * The action the current beat is waiting on — §10.8 F1.
 *
 * The button used to be mounted and unmounted by a `switch` on the phase, which
 * meant it appeared and vanished on the frame the state flipped: the named F1
 * failure, on the most important control in the game. It now rides a `Panel`,
 * which keeps its children mounted through the exit so there is something left
 * to animate out.
 *
 * The spec is latched for exactly that reason. Once the phase has moved on
 * `actionFor` returns null, and rendering that directly would slide an empty
 * box down the screen while the button it was holding had already blinked out.
 */
function ActionBar({ spec, state }: { spec: ActionSpec | null; state: GameState }) {
  // React's "adjusting state when a prop changes" pattern: set during render,
  // never in an effect, so the latched spec and the `open` flag are committed
  // in the same paint. An effect would give the panel one frame holding the
  // wrong content, which is a flicker on the frame it is trying to smooth.
  // Compared by identity — `actionFor` returns module constants for this.
  const [shown, setShown] = useState(spec)
  if (spec !== null && spec !== shown) setShown(spec)

  return (
    <Panel open={spec !== null} from="bottom" className="hud__actions">
      {shown && (
        <Button
          variant={shown.variant}
          onClick={RUN_ACTIONS[shown.action]}
          // §21.0 — a hire the player cannot afford is refused by the store
          // anyway, but a button that looks live and does nothing is worse
          // than one that says so.
          disabled={shown.showsHireCost && !canHire(state)}
        >
          {shown.label}
          {shown.showsHireCost && <small>{formatMoney(nextHireCost(state))}</small>}
          {shown.note && <small>{shown.note}</small>}
        </Button>
      )}
    </Panel>
  )
}

/**
 * A line over the developer's head — §7.5 L1, §6.3.
 *
 * Same latch as the action bar, and for the same reason: the store clears
 * `bubble` when its TTL expires, so the text is gone before the panel has
 * finished leaving.
 *
 * Silent, unusually for a Panel. The bubble is always a consequence of
 * something that already made a noise — a poke, a hire, a phase turning over —
 * and F3 asks for a sound per state change, not per surface.
 */
function Bubble({ text }: { text: string | null }) {
  const [shown, setShown] = useState(text)
  if (text !== null && text !== shown) setShown(text)

  return (
    <Panel open={text !== null} from="top" silent className="hud__bubble">
      <span>{shown}</span>
    </Panel>
  )
}

/**
 * §21 Act V.
 *
 * Rendered inside the live HUD rather than replacing it. The previous version
 * early-returned a different tree the frame the phase flipped, so every readout
 * on screen vanished in one frame while the modal faded up over nothing — the
 * modal itself animated correctly and everything around it cut. Keeping the HUD
 * mounted underneath also satisfies §10.6: the studio is still there behind the
 * scrim, still simulating, which is what makes the bankruptcy land on a place
 * rather than on a screen.
 */
function Bankruptcy({ open }: { open: boolean }) {
  return (
    <Panel open={open} modal from="centre" className="bankruptcy">
      <h1>BANKRUPTCY</h1>
      <p>
        Your 1,000 developers spent 100% of their time arguing in Slack and zero seconds
        coding.
      </p>
      <p className="bankruptcy__result">$0 REVENUE — TOTAL LIQUIDATION</p>
      <p className="bankruptcy__lesson">
        LESSON LEARNED:
        <br />
        Manpower without Communication Infrastructure is Chaos.
      </p>
      <Button variant="bait" onClick={triggerParadigmShift}>
        TRIGGER PARADIGM SHIFT
      </Button>
      {/* James survives. Every other developer is liquidated. */}
      <p className="bankruptcy__james">James stayed.</p>
    </Panel>
  )
}

/** GDD §23.3 — frame-time and input-latency overlay. */
function PerfOverlay({ stage }: { stage: StageHandle | null }) {
  const [, force] = useState(0)

  useEffect(() => {
    // 4 Hz. Re-rendering the overlay every frame would itself cost frames,
    // which is a poor way to measure frames.
    const id = setInterval(() => force((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [])

  if (!stage) return null

  const fps = stage.frameMs > 0 ? 1000 / stage.frameMs : 0
  const latency = stage.latencyP95

  return (
    <div className="hud__perf">
      {/* Thresholds from GDD §23.3. Red means the gate is failing right now. */}
      <span className={fps < 55 ? 'is-bad' : undefined}>{fps.toFixed(0)} FPS</span>
      <span className={latency > 80 ? 'is-bad' : undefined}>
        {latency > 0 ? `${latency.toFixed(0)}ms TAP` : '— TAP'}
      </span>
    </div>
  )
}
