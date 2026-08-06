import { useEffect, useState } from 'react'
import { applyEntropyTheme, entropyTheme } from '../art/entropyTheme.ts'
import { currentEntropy, currentVelocity, setDevs, setDevState } from '../game/store.ts'
import { optimalHeadcount } from '../sim/entropy.ts'
import type { DevState } from '../sim/poke.ts'
import type { StageHandle } from '../render/stage.ts'
import { BurnDown } from './BurnDown.tsx'
import { useGameState } from './useGameState.ts'

/**
 * The HUD — GDD §7.1, §10.1.
 *
 * The UI is a Layer: overlayed, semi-transparent, contextual. The simulation
 * stays 100% visible behind it. Nothing here is opaque and nothing here is a
 * window box.
 *
 * ADR §7.2 item 5 asks for exactly one DOM element over the canvas to prove
 * the boundary. That is the Velocity readout; everything else on this screen
 * is spike instrumentation (§7.2 item 6) or the burn-down the spike is
 * required to bind to real state (item 4).
 */

const DEV_STATES: DevState[] = ['working', 'slacking', 'flow', 'overwhelmed', 'rogue', 'tenx']

export function Hud({ stage }: { stage: StageHandle | null }) {
  const state = useGameState()
  const entropy = currentEntropy(state)
  const velocity = currentVelocity(state)
  const theme = entropyTheme(entropy)

  // The interface hue is a direct function of Entropy — ART_DIRECTION §1.1.
  // Written to the document root so the CSS token cascade carries it to every
  // element at once, rather than each component subscribing to entropy itself.
  useEffect(() => {
    applyEntropyTheme(theme, document.documentElement)
  }, [theme])

  return (
    <div className="hud">
      <header className="hud__top">
        <span className="hud__stat">
          DEVS <b>{state.devs.toLocaleString()}</b>
        </span>
        <span className="hud__stat">
          CAP <b>{state.devCap.toLocaleString()}</b>
        </span>
      </header>

      {/* ADR §7.2 item 5 — the one DOM element over the canvas. */}
      <div className="hud__velocity">
        <span className="hud__velocity-label">VELOCITY</span>
        <span className="hud__velocity-value">{formatVelocity(velocity)}</span>
        <span className="hud__velocity-unit">SP/SEC</span>
      </div>

      <div className="hud__entropy">
        <span className="hud__stat">
          ENTROPY <b>{(entropy * 100).toFixed(entropy > 0.99 ? 3 : 1)}%</b>
        </span>
        <div className="hud__entropy-bar">
          <div className="hud__entropy-fill" style={{ width: `${entropy * 100}%` }} />
        </div>
        {theme.state === 'lock' && <div className="hud__lock">ENTROPY LOCK</div>}
      </div>

      <BurnDown state={state} />

      <SpikeControls devs={state.devs} devCap={state.devCap} devState={state.devState} />
      <PerfOverlay stage={stage} />
    </div>
  )
}

/**
 * Spike-only controls.
 *
 * ADR §7.3 puts entropy simulation out of scope "beyond driving the interface
 * hue" — so headcount is exposed directly rather than simulated. Dragging it
 * past the optimum is also the fastest possible demonstration of the §4.1
 * curve, which is the thing most worth having in front of a playtester.
 */
function SpikeControls({
  devs,
  devCap,
  devState,
}: {
  devs: number
  devCap: number
  devState: DevState
}) {
  const optimum = Math.round(optimalHeadcount(devCap))

  return (
    <div className="hud__controls">
      <label className="hud__control">
        <span>HEADCOUNT — optimum {optimum}</span>
        <input
          type="range"
          min={1}
          max={400}
          value={devs}
          onChange={(e) => setDevs(Number(e.target.value))}
        />
      </label>
      <div className="hud__states">
        {DEV_STATES.map((s) => (
          <button
            key={s}
            type="button"
            className={s === devState ? 'is-active' : undefined}
            onClick={() => setDevState(s)}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

/** ADR §7.2 item 6 — frame-time and input-latency overlay. */
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
      {/* Thresholds from ADR §7.5. Red means the gate is failing right now. */}
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
