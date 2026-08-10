import { useEffect, useRef, useState } from 'react'
import { initSfx } from './audio/sfx.ts'
import { __setState, jumpToPhase, selectDeveloper } from './game/store.ts'
import { PHASE_ORDER, type Phase } from './game/onboarding.ts'
import { Hud } from './hud/Hud.tsx'
import { createStage, type StageHandle } from './render/stage.ts'
import { runBench } from './perf/bench.ts'
import { markInteractive } from './perf/metrics.ts'
import { TitleScreen } from './title/TitleScreen.tsx'
import { FounderSetup } from './title/FounderSetup.tsx'
import { hasBooted, markBooted } from './title/bootFlag.ts'
import {
  DEFAULT_FOUNDER,
  readFounderProfile,
  type FounderProfile,
} from './game/founderProfile.ts'

import './styles/title.css'

/**
 * Query flags that put the app straight into the game.
 *
 * `?act` and `?bench` both drive the app to a specific state and neither wants
 * a title screen in front of it; `?notitle` is the explicit form, and it is
 * the one the other workstreams want while iterating on the HUD. Read at
 * module load for the same reason Hud.tsx reads `?dialogue` there — a query
 * string cannot change mid-session.
 */
const SKIP_TITLE = (() => {
  if (typeof location === 'undefined') return false
  const q = new URLSearchParams(location.search)
  return q.has('notitle') || q.has('act') || q.has('bench')
})()

/**
 * App root — the Pixi canvas under the React HUD, and the GDD §10.9 title in
 * front of both.
 *
 * The DOM/canvas boundary of GDD §23.2 non-negotiable 3 lives here: if it is
 * wrong, it is wrong here first.
 *
 * The title is an overlay on a running stage rather than a route, because
 * §10.9.1 makes the room and its camera continuous from title to gameplay.
 * There is deliberately no state in which the simulation is not running: a
 * "title mode" the stage knew about would be a second scene, and the point of
 * the whole screen is that there is only ever one.
 */
export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<StageHandle | null>(null)
  const [benchText, setBenchText] = useState<string | null>(null)

  // §10.9.3 — read once, before it is written, so the first launch of a
  // session sees the boot it has earned. StrictMode double-invokes the effect
  // below; `markBooted` is idempotent and this initialiser is not re-run.
  const [firstLaunch] = useState(() => !SKIP_TITLE && !hasBooted())
  const [titleUp, setTitleUp] = useState(!SKIP_TITLE)
  const [titleExiting, setTitleExiting] = useState(false)
  const [started, setStarted] = useState(SKIP_TITLE)
  const [founderSetupUp, setFounderSetupUp] = useState(false)
  const [founderProfile, setFounderProfile] = useState<FounderProfile | null>(() =>
    readFounderProfile(),
  )

  useEffect(() => {
    if (!SKIP_TITLE) markBooted()
  }, [])

  useEffect(() => {
    stage?.setFounderProfile(founderProfile ?? DEFAULT_FOUNDER)
  }, [stage, founderProfile])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let handle: StageHandle | null = null
    let cancelled = false

    // Preload audio before the stage exists: criterion 6 gives cold start a 3 s
    // budget, and decoding on the first tap would land inside the criterion-2
    // measurement instead of before it.
    void initSfx()

    // ?act=act5_bleeding jumps the §21 script, for iterating on copy without
    // replaying the four minutes Run 1 is deliberately paced to take.
    const act = new URLSearchParams(location.search).get('act')
    if (act && (PHASE_ORDER as readonly string[]).includes(act)) {
      jumpToPhase(act as Phase)
    }

    // ?select=4 selects a developer without holding on one — §7.8.8, in the
    // same family as ?overnight and ?dialogue. Worth having for the same reason
    // those were: the card's copy, its live §19 quote and the turn animation
    // all want iterating on, and reaching them by hand means finding a specific
    // seat in a room that has been panned somewhere else.
    const select = new URLSearchParams(location.search).get('select')
    if (select !== null) selectDeveloper(Number(select))

    // ?devs=250000 forces a headcount, for looking at the §7.8.2 rungs.
    //
    // Same family as ?select and ?act, and it exists for the same reason they
    // do: rung 5 is a hundred thousand developers, and there is no way to reach
    // that by playing that does not take longer than a session. Deliberately
    // *not* routed through the economy — it sets the count and nothing else, so
    // what you are looking at is the renderer's answer to a headcount and not a
    // save file somebody has to unpick afterwards.
    const devs = new URLSearchParams(location.search).get('devs')
    if (devs !== null && Number.isFinite(Number(devs))) {
      const n = Math.max(1, Math.floor(Number(devs)))
      // Cash comes with it, because §4.10d's payroll is continuous and a studio
      // of forty thousand people handed no money bankrupts inside one tick —
      // which is correct behaviour and is not what anybody typing this flag is
      // trying to look at.
      __setState({ devs: n, cash: n * 1e6, devCap: n * 2 })
    }

    void createStage(host).then((h) => {
      if (cancelled) {
        h.destroy()
        return
      }
      handle = h

      // ?z=0.5 parks the Omni-Lens, so a screenshot can be taken of a tier
      // rather than of whatever the camera happened to be doing. Clamped by
      // §7.7.1's zoom ceiling like every other way of moving the lens — the
      // studio you can see is still the studio you have.
      const z = new URLSearchParams(location.search).get('z')
      if (z !== null && Number.isFinite(Number(z))) h.camera.set(Number(z))
      // Criterion 6's stopwatch stops here: the renderer is up and the first
      // frame is pokeable. Anything after this is the player's own reaction
      // time, not the app's cold start.
      markInteractive()
      setStage(h)

      // ?bench runs the GDD §23.3 acceptance sequence. ?bench=10 shortens the
      // 60-second sustained-tap leg, for checking the harness itself without
      // sitting through the real thing.
      const bench = new URLSearchParams(location.search).get('bench')
      if (bench !== null) startBench(h, Number(bench) > 0 ? Number(bench) : 60)
    })

    return () => {
      cancelled = true
      handle?.destroy()
    }
  }, [])

  /**
   * Kick off the §7.5 run and publish the report both on screen and to the
   * console — the console copy is what `adb logcat` picks up, so a device run
   * does not depend on anyone transcribing numbers off a photo of a phone.
   */
  function startBench(handle: StageHandle, seconds: number) {
    setBenchText('GDD §23.3 acceptance run — measuring…')
    void runBench(handle.bench, handle.bench.frames, { sustainedSeconds: seconds }).then((r) => {
      setBenchText(r.text)
      console.log('[BENCH] ' + r.text.replace(/\n/g, ' | '))
    })
  }

  const appClass = ['app', titleUp && 'is-title', titleUp && titleExiting && 'is-title-exiting']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={appClass}>
      <div className="app__canvas" ref={hostRef} />
      {titleUp && (
        <TitleScreen
          stage={stage}
          firstLaunch={firstLaunch}
          onStart={() => {
            // The title still owns the first frame. START hands a new install
            // to identity setup, then identity setup hands it to the game.
            // A returning player goes straight through the same camera push.
            setTitleExiting(true)
            if (founderProfile) setStarted(true)
          }}
          onExited={() => {
            setTitleUp(false)
            if (!founderProfile) setFounderSetupUp(true)
          }}
        />
      )}
      {founderSetupUp && (
        <FounderSetup
          onComplete={(profile) => {
            setFounderProfile(profile)
            setFounderSetupUp(false)
            setStarted(true)
          }}
        />
      )}
      {/*
        The HUD mounts on the press, not on the unmount — it arrives on the
        tail of the §10.9.4 stagger while the title is still leaving, so the
        interface is never a thing that appears on an already-lit room. The
        wrapper carries that entrance and is skipped entirely when there was no
        title to hand off from.
      */}
      {started &&
        (SKIP_TITLE ? (
          <Hud stage={stage} />
        ) : (
          <div className="title-handoff">
            <Hud stage={stage} />
          </div>
        ))}
      {/*
        A Capacitor-bundled app has no query string, so ?bench cannot reach it
        on a device. This is the on-device trigger, and it is compiled out of
        any build that does not explicitly ask for it — build with
        VITE_BENCH=1 to get it, and a shipping build never will.
      */}
      {import.meta.env.VITE_BENCH === '1' && stage && benchText === null && (
        <button type="button" className="bench-trigger" onClick={() => startBench(stage, 60)}>
          RUN §7.5
        </button>
      )}
      {benchText !== null && <pre className="bench-report">{benchText}</pre>}
    </div>
  )
}
