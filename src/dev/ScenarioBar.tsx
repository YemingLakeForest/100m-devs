/**
 * The scenario picker — `?scenarios`, and the reason it is not always on.
 *
 * A row of decades across the bottom of the screen. Press one and the studio
 * *is* that size, with the lens already parked at the rung that headcount has
 * earned. Press the next and it is that size instead, without a reload —
 * which is the whole point, because the question §26.2 keeps asking is
 * comparative ("does a town read as more than a campus, or just as blurrier?")
 * and a comparison you have to reload between is a comparison you do not make.
 *
 * ## Opt-in, and that is load-bearing
 *
 * Debug access is restricted to a loopback browser session, and the query flag
 * remains required. A bar that appeared on every local frame would appear in
 * all of the frame gate's screens, overlap the things it measures the overlap
 * of, and fail it. Deployed HTML and Capacitor-native Android cannot enable it.
 *
 * It folds, because it is fixed to the bottom of the viewport and the bottom of
 * the viewport is where §10's GALLERY button and the studio log live. An
 * instrument that covers part of the thing it is an instrument for is worth one
 * toggle: click DEVS, or press 0.
 *
 * ## The speed dial
 *
 * `?speed=40` shipped as a launch flag, and a pace you have to relaunch to
 * change is a pace nobody changes. The dial is the same mechanism on a control:
 * `dev/simSpeed.ts` holds the number, the frame loop reads it every frame, and
 * the question it finally makes askable is the one anybody watching a studio
 * has — *what does this look like in a minute?* — without throwing away the run
 * that prompted it. `-` and `=` step it; the box takes anything up to ×60.
 *
 * ## The three readouts
 *
 * Loading a headcount and looking at the screen leaves one question open —
 * *am I looking at the thing I asked for?* DEVS answers whether the store took
 * it, RUNG answers where the lens ended up, and VIEW answers which of §7.4a's
 * pictures that makes. They are the three numbers already on `window.__stage`,
 * put where they can be read without a console, because the failure this tool
 * is most likely to hand somebody is a camera that quietly did not move.
 */

import { useEffect, useState } from 'react'
import {
  SCENARIOS,
  addHeadcount,
  applyHeadcount,
  applyScenario,
  parseHeadcount,
  rungForCount,
  scenarioRung,
  type Scenario,
} from '../game/scenarios.ts'
import { PARK_CAP } from '../render/frames.ts'
import { SITES_PER_GLOBE } from '../render/worldMap.ts'
import { getState, subscribe } from '../game/store.ts'
import {
  SIM_SPEED_MAX,
  SIM_SPEED_MIN,
  SIM_SPEED_STOPS,
  clampSimSpeed,
  getSimSpeed,
  nudgeSimSpeed,
  setSimSpeed,
  stopIndexFor,
  subscribeSimSpeed,
} from './simSpeed.ts'
import { dominantView, rungAt, zAtRung } from '../sim/ladder.ts'
import type { StageHandle } from '../render/stage.ts'
import '../styles/scenarios.css'

function developerCountLabel(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'developer' : 'developers'}`
}

export default function ScenarioBar({ stage }: { stage: StageHandle | null }) {
  const [loaded, setLoaded] = useState<Scenario | null>(null)
  const [folded, setFolded] = useState(false)
  const [devs, setDevs] = useState(() => getState().devs)
  /** What is in the box. Parsed on every keystroke so the border can say so. */
  const [typed, setTyped] = useState('')
  /** The batch dial is logarithmic: one stop per decade, up to the game's gate. */
  const [batchIndex, setBatchIndex] = useState(0)
  const [note, setNote] = useState('type a headcount, pick a decade, or add a batch')
  // The camera is not in the store and does not notify, so the two lens
  // readouts are sampled on a frame rather than subscribed to. A tenth of a
  // second is faster than anybody reads a number and is not a per-frame cost.
  const [z, setZ] = useState(0)
  /**
   * The simulation clock, mirrored out of `dev/simSpeed.ts`.
   *
   * Mirrored rather than owned, because the frame loop reads the module
   * directly and `?speed` seeds it before this component has ever rendered. A
   * `useState` initialised from the module and kept in step by its subscription
   * is the same shape the DEVS readout uses on the store, for the same reason.
   */
  const [speed, setSpeed] = useState(getSimSpeed)
  /** What is in the speed box, if anything. Empty means "the dial is in charge". */
  const [typedSpeed, setTypedSpeed] = useState('')

  useEffect(() => subscribe(() => setDevs(getState().devs)), [])

  useEffect(() => subscribeSimSpeed(() => setSpeed(getSimSpeed())), [])

  useEffect(() => {
    if (!stage) return
    const id = setInterval(() => setZ(stage.camera.z), 100)
    return () => clearInterval(id)
  }, [stage])

  /**
   * Put the studio at a headcount somebody typed.
   *
   * The decades on the buttons are a list of *interesting* sizes, and the
   * interesting sizes are not always decades — rung 6 spans two of them, so
   * "what does forty million look like" has no button, and "what does the frame
   * after the sixty-first site look like" can only be asked by typing
   * 61,000,001. Same two steps as {@link load}: the store, and then the lens
   * separately, because `game/` may not import `render/`.
   */
  const go = () => {
    const n = parseHeadcount(typed)
    if (n === null) return
    applyHeadcount(n)
    setLoaded(null)
    setNote(`set the studio to ${n.toLocaleString()} developers`)
    stage?.camera.set(zAtRung(rungForCount(n)))
  }

  const batch = SCENARIOS[batchIndex]

  /**
   * Add rather than replace. This is the path for watching the arrival and
   * promotion machinery at a chosen scale; the number box above remains the
   * path for inspecting a static studio at an exact size.
   */
  const addBatch = () => {
    const next = addHeadcount(batch.devs)
    setLoaded(null)
    setNote(`added ${developerCountLabel(batch.devs)}`)
    stage?.camera.set(zAtRung(rungForCount(next)))
  }

  const load = (s: Scenario) => {
    applyScenario(s)
    setLoaded(s)
    setNote(s.note)
    // The lens, second and separately — `applyScenario` is store-side and does
    // not know the renderer exists. Parked at the rung the headcount has just
    // earned, because the alternative is landing at a hundred million
    // developers with the camera still on somebody's desk.
    stage?.camera.set(zAtRung(scenarioRung(s)))
  }

  /**
   * Move the clock, and say so in the note line.
   *
   * Every path in and out of the dial funnels through here so the note, the
   * slider and the box can never disagree about what the studio is running at —
   * the failure this bar's whole readout row exists to prevent.
   */
  const applySpeed = (next: number) => {
    const landed = setSimSpeed(next)
    setNote(
      landed === SIM_SPEED_MIN
        ? 'simulation running at real time'
        : `simulation running ×${landed} — ${landed} ticks a frame, not a ×${landed} step`,
    )
    return landed
  }

  /**
   * Rejects rather than clamps a non-number, on the same rule the headcount box
   * follows: `clampSimSpeed('banana')` is ×1, and a blur that silently put a
   * ×40 studio back into real time because there was a typo in the box is a
   * tool undoing the thing it was asked to do.
   */
  const goSpeed = () => {
    const raw = typedSpeed.trim()
    if (raw === '' || !Number.isFinite(Number(raw))) return
    applySpeed(clampSimSpeed(raw))
    setTypedSpeed('')
  }

  // 1-9 pick a scenario. Not a shortcut for its own sake: stepping the ladder
  // with a fingertip on the number row is how the comparison above actually
  // gets made, and reaching for a button breaks it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // **Not while somebody is typing a number.** The shortcut is 1-9 and so is
      // most of a headcount: without this, typing `40000000` loads scenario 4
      // and then eight studios of one developer, which is a tool fighting the
      // thing it is for.
      if (e.target instanceof HTMLElement && e.target.tagName === 'INPUT') return
      if (e.key === '0') {
        setFolded((f) => !f)
        return
      }
      // The clock, on the two keys next to the scenario row. Backtick is the way
      // back to real time in one press, which matters more than it sounds:
      // a studio left at ×60 while you go and read something is a studio that
      // has shipped forty games by the time you look up.
      if (e.key === '-' || e.key === '_') {
        applySpeed(nudgeSimSpeed(-1))
        return
      }
      if (e.key === '=' || e.key === '+') {
        applySpeed(nudgeSimSpeed(1))
        return
      }
      if (e.key === '`') {
        applySpeed(SIM_SPEED_MIN)
        return
      }
      const i = Number(e.key) - 1
      if (Number.isInteger(i) && i >= 0 && i < SCENARIOS.length) load(SCENARIOS[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const rung = rungAt(z)

  return (
    <div className={`scenarios${folded ? ' is-folded' : ''}`}>
      <div className="scenarios__row">
        <button
          type="button"
          className="scenarios__title"
          onClick={() => setFolded((f) => !f)}
          title="fold the bar out of the way — 0"
        >
          DEVS
        </button>
        <input
          className={`scenarios__box${typed && parseHeadcount(typed) === null ? ' is-bad' : ''}`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') go()
          }}
          placeholder="40m"
          title="any headcount — 250000, 40m, 1e8, 0.5b — then Enter"
          aria-label="headcount"
        />
        <button
          type="button"
          className="scenarios__pick"
          onClick={go}
          disabled={parseHeadcount(typed) === null}
          title="put the studio at exactly this many developers"
        >
          GO
        </button>
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`scenarios__pick${loaded?.id === s.id ? ' is-on' : ''}`}
            onClick={() => load(s)}
            title={`${s.id} — ${s.note}`}
          >
            <span className="scenarios__key">{i + 1}</span>
            {s.label}
          </button>
        ))}
        <div className="scenarios__dial">
          <label htmlFor="scenario-batch">BATCH</label>
          <input
            id="scenario-batch"
            type="range"
            min="0"
            max={SCENARIOS.length - 1}
            step="1"
            value={batchIndex}
            // A range emits `input` continuously while dragged and from its
            // arrow keys. Using that native event also keeps automation and
            // assistive input in the same path as a pointer drag.
            onInput={(e) => setBatchIndex(Number(e.currentTarget.value))}
            aria-label="Developer batch size"
            aria-valuetext={developerCountLabel(batch.devs)}
            title="choose how many developers the ADD button hires for free"
          />
          <output htmlFor="scenario-batch">+{batch.label.replace(' ', '')}</output>
          <button
            type="button"
            className="scenarios__pick scenarios__add"
            onClick={addBatch}
            aria-label={`Add ${developerCountLabel(batch.devs)}`}
            title="add this batch through the real hire and arrival path"
          >
            ADD
          </button>
        </div>
        {/*
          The clock. A second dial rather than a second row, because the
          question it answers ("what does this look like in a minute?") is asked
          *while* looking at a studio the row above just loaded — and a control
          on a row that is not on screen is a control nobody reaches for.
        */}
        <div className="scenarios__dial">
          <label htmlFor="scenario-speed">SPEED</label>
          <input
            id="scenario-speed"
            type="range"
            min="0"
            max={SIM_SPEED_STOPS.length - 1}
            step="1"
            // The slider is an *index into the stops*, not the multiplier — see
            // SIM_SPEED_STOPS for why a linear 1..60 slider is the wrong shape.
            // A typed value between two stops parks the thumb on the stop below
            // it, which is what `stopIndexFor` is for.
            value={stopIndexFor(speed)}
            onInput={(e) => applySpeed(SIM_SPEED_STOPS[Number(e.currentTarget.value)])}
            aria-label="Simulation speed"
            aria-valuetext={`${speed} times real time`}
            title="how many ticks of simulation each frame runs — ` for real time, - and = to step"
          />
          <output htmlFor="scenario-speed">×{speed}</output>
          <input
            className={`scenarios__box scenarios__box--speed${
              typedSpeed && clampSimSpeed(typedSpeed) !== Number(typedSpeed) ? ' is-bad' : ''
            }`}
            value={typedSpeed}
            onChange={(e) => setTypedSpeed(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') goSpeed()
            }}
            onBlur={goSpeed}
            placeholder="×"
            title={`any multiplier from ${SIM_SPEED_MIN} to ${SIM_SPEED_MAX}, then Enter`}
            aria-label="Simulation speed multiplier"
          />
          <button
            type="button"
            className={`scenarios__pick scenarios__add${speed === SIM_SPEED_MIN ? '' : ' is-on'}`}
            onClick={() => applySpeed(SIM_SPEED_MIN)}
            disabled={speed === SIM_SPEED_MIN}
            aria-label="Run at real time"
            title="back to real time — `"
          >
            1×
          </button>
        </div>
      </div>
      <div className="scenarios__read">
        <span>
          DEVS <b>{devs.toLocaleString()}</b>
        </span>
        <span>
          RUNG <b>{rung.toFixed(2)}</b>
        </span>
        <span>
          VIEW <b>{dominantView(z)}</b>
        </span>
        {/* The clock, beside the three lens readouts and for the same reason
            they are there: the failure this tool can hand somebody is a studio
            that quietly did not change pace. */}
        <span>
          SPEED <b>×{speed}</b>
        </span>
        {/* How much of the planet this headcount has taken — the number nothing
            else on screen can say, and the one rung 6 is entirely about. */}
        <span>
          SITES{' '}
          <b>
            {Math.max(1, Math.min(SITES_PER_GLOBE, Math.ceil(devs / PARK_CAP)))}/{SITES_PER_GLOBE}
          </b>
        </span>
        <span className="scenarios__note">
          {note}
        </span>
      </div>
    </div>
  )
}
