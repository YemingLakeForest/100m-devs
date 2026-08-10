import { useEffect, useState } from 'react'
import { applyEntropyTheme, entropyTheme } from '../art/entropyTheme.ts'
import {

  canMassHire,
  collectOffline,
  currentMassHireCost,
  getPermanent,
  currentEntropy,
  dismissScene,
  hasSeenScene,
  hireDeveloper,
  hireQuote,
  massHire,
  setHireMultiplier,
  takeSeedRound,
  triggerParadigmShift,
  type GameState,
} from '../game/store.ts'
import { MASS_HIRE_COUNT, PHASE_COPY } from '../game/onboarding.ts'
import type { StageHandle } from '../render/stage.ts'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import { Typewriter } from '../ui/Typewriter.tsx'
import { BurnDown } from './BurnDown.tsx'
import { RevenueGraph } from './RevenueGraph.tsx'
import { ShipToast } from './ShipToast.tsx'
import { TouchSwitch } from './TouchSwitch.tsx'
import { DevCard } from './DevCard.tsx'
import { HireDial } from './HireDial.tsx'
import { Cash, Devs, Shipped, Speedometer, Velocity } from './Readouts.tsx'
import { DialoguePreview } from './DialoguePreview.tsx'
import { OvernightReport } from './OvernightReport.tsx'
import { OvernightPreview } from './OvernightPreview.tsx'
import { Dialogue } from '../ui/Dialogue.tsx'
import { SCENES } from '../game/scenes.ts'
import { shouldShowReport } from './overnightModel.ts'
import { Upgrades } from './Upgrades.tsx'
import { ParadigmTree } from './ParadigmTree.tsx'
import { actionFor, formatMoney, offerFor, type ActionSpec } from './hudModel.ts'
import { useGameState } from './useGameState.ts'

/**
 * Dev-only §10.7 preview — `?dialogue`. Read once, at module load, for the
 * same reason App.tsx reads `?act` there: a query string cannot change
 * mid-session, and re-parsing it every render would be work done 60 times a
 * second to reach the same answer.
 */
/**
 * `?ad` pretends a rewarded ad is filled, so §24.8's 2x path can be seen and
 * §10.8-gated before AdMob is wired.
 *
 * Without it the button is correctly *absent* — no ad network means no fill —
 * which is the right shipping behaviour and completely untestable by eye.
 */
const FAKE_AD_READY =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('ad')

const PREVIEW_OVERNIGHT =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('overnight')
const PREVIEW_OVERNIGHT_CAPPED =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('overnight') === 'capped'

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
  const [treeOpen, setTreeOpen] = useState(false)
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
      {/*
        The left rail — **one column, not two grid rows.**

        §10.1 puts the project at the top and the gauges under it, and the
        previous frame expressed that as two grid areas: project in an `auto`
        row anchored to the top, gauges in a `1fr` row anchored to the bottom.
        On a phone that is *332 CSS pixels tall* the 1fr row is shorter than the
        gauges are, and a block anchored to the end of a row it does not fit
        overflows upward — straight through the revenue graph above it. It was
        reported from a handset and it reproduces exactly at 748x336.

        Stacked in one flow the two can no longer be laid on top of each other
        by any frame size, because that is not something a column does. The
        gauges keep their pin to the bottom (`margin-top: auto`), so on a frame
        with room to spare the composition is the one §10.1 asks for.
      */}
      <div className="hud__left">
        {/* Top-left — §10.1's Active Project, "a descending line, not a filling bar". */}
        <div className="hud__project">
          <BurnDown state={state} />
          {/*
            §4.10e — the back catalogue, under the burn-down that will join it.
            Directly under on purpose: the two charts are the same story told at
            two ends, work going down and money coming in, and the whole reason
            the revenue graph exists is that a player watching only the first one
            concluded they were failing.
          */}
          <RevenueGraph state={state} />
        </div>

        {/* Mid-left — §10.1 puts the speedometer here and velocity directly under it. */}
        <div className="hud__gauges">
          <Speedometer entropy={entropy} />
          <Velocity state={state} />
        </div>
      </div>

      <Bubble text={state.bubble?.text ?? null} />

      {/*
        The right rail, and the same fix for the same defect: the resource
        blocks were in the top row and the action bar in the middle one, and at
        336 px the HIRE DEVELOPER button was drawn straight over the SHIPPED
        readout. One column, button pinned to the bottom.
      */}
      <div className="hud__right">
        {/* Top-right — §10.1's resource bar, turned on its side to use the margin. */}
        <div className="hud__resources">
          <Cash state={state} />
          <Devs state={state} />
          <Shipped state={state} />
        </div>
        <ActionBar
          spec={actionFor(state.phase)}
          offer={offerFor(state.phase, state.massHired)}
          state={state}
        />

        {/*
          The foot of the right rail: the §23.3 overlay and §10.1's nav, under
          the button they sit under on every frame that has room for all three.
          Inside the rail rather than in a cell of their own, because the rail
          now spans the full height of the frame — see the note on `.hud`.
        */}
        <div className="hud__controls">
          {/*
            §7.7.6b — what the finger does, above the nav and under the button,
            because it is the control the thumb reaches for *between* pokes
            rather than once a session.
          */}
          <TouchSwitch state={state} />
          <PerfOverlay stage={stage} />
          {/*
            §13.2 — the tree appears only once a Paradigm Shift has happened.
            Before the first one BP does not exist, and a permanently visible
            button onto an empty currency would be the §10.6 web-page tell.
          */}
          {getPermanent().meta.paradigmShifts > 0 && (
            <Button onClick={() => setTreeOpen(true)}>PARADIGM</Button>
          )}
          <Upgrades />
        </div>
      </div>

      <ShipToast state={state} />
      <DevCard state={state} />

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

      <ParadigmTree open={treeOpen} state={state} onClose={() => setTreeOpen(false)} />

      <Bankruptcy open={state.phase === 'bankrupt'} />
      {/*
        §24.8 — before the swarm, before the rest of the HUD. `collectOffline`
        clears `pendingOffline`, so this unmounts on collect and the Panel
        plays its exit rather than vanishing.
      */}
      {shouldShowReport(state.pendingOffline) && (
        <OvernightReport
          report={state.pendingOffline}
          // Hard false until game-monetise is wired. §24.8 says an unfilled
          // slot means the button is absent, so this is the correct shipping
          // value rather than a placeholder that flatters the screenshot.
          adReady={FAKE_AD_READY}
          onCollect={collectOffline}
        />
      )}

      {/*
        §21.6 and its ladder. Rendered above the HUD and below nothing: while a
        scene is up the poke path is inert (see `poke` in the store), so the
        box is the only thing taking taps.
      */}
      {state.scene && SCENES[state.scene] && (
        <Dialogue
          key={state.scene}
          script={SCENES[state.scene].script}
          seen={hasSeenScene(state.scene)}
          onFinished={dismissScene}
        />
      )}

      {PREVIEW_OVERNIGHT && (
        <OvernightPreview capped={PREVIEW_OVERNIGHT_CAPPED} adReady={FAKE_AD_READY} />
      )}

      {PREVIEW_DIALOGUE && <DialoguePreview />}
    </div>
  )
}

/** The store verbs this layer is allowed to call, by `ActionSpec.action`. */
const RUN_ACTIONS: Record<ActionSpec['action'], () => void> = {
  hire: hireDeveloper,
  massHire,
  paradigmShift: triggerParadigmShift,
  takeSeed: takeSeedRound,
}

/** What an action costs right now, or null if it is free. */
function priceOf(spec: ActionSpec | null, state: GameState) {
  if (spec?.priced === 'hire') return hireQuote(state)
  if (spec?.priced === 'massHire') {
    return {
      count: MASS_HIRE_COUNT,
      cost: currentMassHireCost(state),
      affordable: canMassHire(state),
    }
  }
  return null
}

/**
 * One button, priced and gated.
 *
 * Shared by the primary action and §21.0a's offer, because they are now on
 * screen together and the two must not drift: a temptation styled or gated
 * differently from the control beside it is a second thing to keep in sync
 * every time either changes.
 */
function ActionButton({ spec, state }: { spec: ActionSpec; state: GameState }) {
  const q = priceOf(spec, state)
  return (
    <Button
      variant={spec.variant}
      onClick={RUN_ACTIONS[spec.action]}
      // §21.0 — a purchase the player cannot afford is refused by the store
      // anyway, but a button that looks live and does nothing is worse than one
      // that says so.
      disabled={q !== null && !q.affordable}
    >
      {/*
        The face carries the batch, because at x100 "HIRE DEVELOPER" is a lie
        about what the tap does. Below the dial's unlock it reads exactly as it
        always did — the multiplier is 1 and the count is suppressed rather than
        rendered as "x1".
      */}
      {spec.showsHireCost && q && q.count > 1 ? `${spec.label}  x${q.count}` : spec.label}
      {/*
        The mousetrap shows its joke *and* its figure. "Cost: YOUR ENTIRE
        TREASURY" is funny while there is a treasury and says nothing at all
        when there is not, so the number goes underneath it — which is also
        what tells a broke player what they are waiting for.
      */}
      {spec.note && <small>{spec.note}</small>}
      {q && <small>{formatMoney(q.cost)}</small>}
    </Button>
  )
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
function ActionBar({
  spec,
  offer,
  state,
}: {
  spec: ActionSpec | null
  offer: ActionSpec | null
  state: GameState
}) {
  // React's "adjusting state when a prop changes" pattern: set during render,
  // never in an effect, so the latched spec and the `open` flag are committed
  // in the same paint. An effect would give the panel one frame holding the
  // wrong content, which is a flicker on the frame it is trying to smooth.
  // Compared by identity — `actionFor` returns module constants for this.
  const [shown, setShown] = useState(spec)
  if (spec !== null && spec !== shown) setShown(spec)

  // The offer is latched the same way and for the same reason, but separately:
  // it arrives and leaves on its own schedule and must not drag the primary
  // control's animation with it.
  const [shownOffer, setShownOffer] = useState(offer)
  if (offer !== null && offer !== shownOffer) setShownOffer(offer)

  return (
    <Panel open={spec !== null} from="bottom" className="hud__actions">
      {/*
        §21.0a — the temptation sits ABOVE the ordinary control, and both are
        live. Act III used to *replace* the hire button with this, which turns a
        trap into a corridor: a player left no alternative has not chosen
        anything, and §6's lesson only lands if the decision was theirs.
      */}
      <Panel open={offer !== null} from="bottom" className="hud__offer" silent>
        {shownOffer && <ActionButton spec={shownOffer} state={state} />}
      </Panel>

      {shown?.showsHireCost && state.dialUnlocked && (
        // Above the button, per §10.10.1's layout: the multiplier is chosen
        // and *then* committed, so it belongs earlier in the reading order and
        // further from the thumb than the thing it commits.
        <HireDial
          devs={state.devs}
          cash={state.cash}
          value={state.hireMultiplier}
          onChange={setHireMultiplier}
        />
      )}
      {shown && <ActionButton spec={shown} state={state} />}
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
      {/*
        The build stamp. Small, permanently on, and worth every pixel: a stale
        bundle is indistinguishable from a bug that will not die, and this turns
        "am I looking at the code you just changed" into something a screenshot
        answers.
      */}
      <span className="hud__build">{__BUILD_AT__}</span>
    </div>
  )
}
