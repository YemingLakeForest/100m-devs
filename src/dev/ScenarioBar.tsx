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
 * `import.meta.env.DEV` is true under `npm run dev` — and `npm run dev` is what
 * `scripts/ui-frame.acceptance.mjs` starts. A bar that appeared on every dev
 * build would therefore appear in all 68 of that gate's screens, overlap the
 * things it measures the overlap of, and fail it. So this is gated on the query
 * flag as well, in the same family as `?ad`, `?overnight` and `?dialogue`: dev
 * builds only, and only when asked for by name.
 *
 * It folds, because it is fixed to the bottom of the viewport and the bottom of
 * the viewport is where §10's GALLERY button and the studio log live. An
 * instrument that covers part of the thing it is an instrument for is worth one
 * toggle: click DEVS, or press 0.
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
import { SCENARIOS, applyScenario, scenarioRung, type Scenario } from '../game/scenarios.ts'
import { getState, subscribe } from '../game/store.ts'
import { dominantView, rungAt, zAtRung } from '../sim/ladder.ts'
import type { StageHandle } from '../render/stage.ts'
import '../styles/scenarios.css'

export default function ScenarioBar({ stage }: { stage: StageHandle | null }) {
  const [loaded, setLoaded] = useState<Scenario | null>(null)
  const [folded, setFolded] = useState(false)
  const [devs, setDevs] = useState(() => getState().devs)
  // The camera is not in the store and does not notify, so the two lens
  // readouts are sampled on a frame rather than subscribed to. A tenth of a
  // second is faster than anybody reads a number and is not a per-frame cost.
  const [z, setZ] = useState(0)

  useEffect(() => subscribe(() => setDevs(getState().devs)), [])

  useEffect(() => {
    if (!stage) return
    const id = setInterval(() => setZ(stage.camera.z), 100)
    return () => clearInterval(id)
  }, [stage])

  const load = (s: Scenario) => {
    applyScenario(s)
    setLoaded(s)
    // The lens, second and separately — `applyScenario` is store-side and does
    // not know the renderer exists. Parked at the rung the headcount has just
    // earned, because the alternative is landing at a hundred million
    // developers with the camera still on somebody's desk.
    stage?.camera.set(zAtRung(scenarioRung(s)))
  }

  // 1-9 pick a scenario. Not a shortcut for its own sake: stepping the ladder
  // with a fingertip on the number row is how the comparison above actually
  // gets made, and reaching for a button breaks it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '0') {
        setFolded((f) => !f)
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
        <span className="scenarios__note">{loaded?.note ?? 'pick a decade, or press 1-9'}</span>
      </div>
    </div>
  )
}
