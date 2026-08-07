import { useEffect, useState } from 'react'
import { applyEntropyTheme, entropyTheme } from '../art/entropyTheme.ts'
import { entropyLabel } from '../game/vocabulary.ts'
import { formatCount, scaleBar } from '../sim/headcount.ts'
import {
  currentEntropy,
  currentPayroll,
  currentVelocity,
  hireDeveloper,
  massHire,
  triggerParadigmShift,
  type GameState,
} from '../game/store.ts'
import { PHASE_COPY } from '../game/onboarding.ts'
import { secondsUntilBankrupt } from '../sim/economy.ts'
import type { StageHandle } from '../render/stage.ts'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import { BurnDown } from './BurnDown.tsx'
import { DialoguePreview } from './DialoguePreview.tsx'
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
 * The HUD — GDD §7.1, §10.1, and the §21 script.
 *
 * The UI is a Layer: overlayed, semi-transparent, contextual. The simulation
 * stays 100% visible behind it. Nothing here is opaque and nothing here is a
 * window box.
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
  useEffect(() => {
    applyEntropyTheme(theme, document.documentElement)
  }, [theme])

  if (state.phase === 'bankrupt') return <Bankruptcy />

  return (
    <div className="hud">
      <header className="hud__top">
        {/*
          GDD §7.7.5 — once one on-screen unit stops being one developer, the
          HUD says so, exactly as a map states its scale. A picture whose units
          silently changed is a lie.
        */}
        <span className="hud__stat">
          DEVS <b>{formatCount(state.devs)}</b>
          {scaleBar(state.devs) && <small className="hud__scale">{scaleBar(state.devs)}</small>}
        </span>
        <Cash state={state} />
      </header>

      {/* GDD §23.2 non-negotiable 3 — the DOM element over the canvas. */}
      <div className="hud__velocity">
        <span className="hud__velocity-label">VELOCITY</span>
        <span className="hud__velocity-value">{formatVelocity(currentVelocity(state))}</span>
        <span className="hud__velocity-unit">SP/SEC</span>
      </div>

      {copy.terminal && (
        <pre className="hud__terminal">{copy.terminal.join('\n')}</pre>
      )}

      {state.bubble && <div className="hud__bubble">{state.bubble.text}</div>}

      {/*
        GDD §4.3a — the readout escalates its own name as E climbs, and the
        word "entropy" never appears. The class names keep the model's term
        because they are read by engineers, not players.
      */}
      <div className="hud__entropy">
        <span className="hud__stat">
          {entropyLabel(entropy)} <b>{(entropy * 100).toFixed(entropy > 0.99 ? 3 : 1)}%</b>
        </span>
        <div className="hud__entropy-bar">
          <div className="hud__entropy-fill" style={{ width: `${entropy * 100}%` }} />
        </div>
        {theme.state === 'lock' && <div className="hud__lock">STUDIO SEIZED</div>}
      </div>

      <BurnDown state={state} />

      {copy.advisor && <p className="hud__advisor">{copy.advisor}</p>}

      <Actions state={state} />
      <PerfOverlay stage={stage} />
      {PREVIEW_DIALOGUE && <DialoguePreview />}
    </div>
  )
}

/**
 * Cash, and the runway once it starts draining.
 *
 * §21 Act V walks the player down through −$10,000 and −$100,000. Showing the
 * seconds remaining is what turns that from a cutscene into a panic — and the
 * panic is the point, because §6.3 wants the player tapping harder.
 */
function Cash({ state }: { state: GameState }) {
  const payroll = currentPayroll(state)
  const runway = secondsUntilBankrupt(state.cash, state.devs)

  return (
    <span className="hud__stat hud__cash">
      <b className={state.cash < 0 ? 'is-bad' : undefined}>{formatMoney(state.cash)}</b>
      {payroll > 0 && (
        <>
          <span className="hud__burn is-bad">−{formatMoney(payroll)}/SEC</span>
          {Number.isFinite(runway) && runway < 90 && (
            <span className="hud__burn is-bad">{runway.toFixed(0)}s TO BANKRUPTCY</span>
          )}
        </>
      )}
    </span>
  )
}

/**
 * The action the current beat is waiting on.
 *
 * Exactly one button at a time. §21 is a funnel, and offering a second choice
 * anywhere in it would let the player sidestep the trap they are supposed to
 * walk into.
 */
function Actions({ state }: { state: GameState }) {
  switch (state.phase) {
    case 'act2_offer_hire':
      return (
        <div className="hud__actions">
          <Button onClick={hireDeveloper}>HIRE DEVELOPER</Button>
        </div>
      )

    case 'act3_bait':
      return (
        <div className="hud__actions">
          {/* Glowing, pulsing, golden, and right in the middle of the UI. */}
          <Button variant="bait" onClick={massHire}>
            HIRE 1,000 DEVS NOW
            <small>Cost: FREE (Trial Promo)</small>
          </Button>
        </div>
      )

    default:
      return null
  }
}

/**
 * §21 Act V.
 *
 * Through `Panel` rather than rendered flat: this screen used to appear the
 * frame the phase flipped, which is precisely the §10.8 F1 failure — "a modal
 * that appears without a directed transition". It now scales and blurs up over
 * the §10.5 modal budget, and the swarm keeps simulating behind the scrim
 * instead of being covered by an opaque sheet (§10.6).
 */
function Bankruptcy() {
  return (
    <div className="hud hud--modal">
      <Panel open modal from="centre" className="bankruptcy">
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
    </div>
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

/**
 * Velocity spans from 1e-6 SP/s in Entropy Lock to millions at scale, so a
 * fixed format is unreadable at one end or the other.
 */
function formatVelocity(v: number): string {
  if (v === 0) return '0'
  if (v < 0.001) return v.toExponential(2)
  if (v < 1000) return v.toFixed(2)
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function formatMoney(v: number): string {
  const sign = v < 0 ? '−' : ''
  const n = Math.abs(v)
  if (n >= 1e9) return `${sign}$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`
  return `${sign}$${n.toFixed(0)}`
}
