import { useEffect, useRef, useState } from 'react'
import { initSfx } from './audio/sfx.ts'
import {
  __setState,
  jumpToPhase,
  PROJECTS,
  saveGame,
  selectDeveloper,
  startNewGame,
} from './game/store.ts'
import { PHASE_ORDER, type Phase } from './game/onboarding.ts'
import { Hud } from './hud/Hud.tsx'
import { createStage, type StageHandle } from './render/stage.ts'
import { runBench } from './perf/bench.ts'
import { markInteractive } from './perf/metrics.ts'
import { TitleScreen } from './title/TitleScreen.tsx'
import { FounderSetup } from './title/FounderSetup.tsx'
import { StudioBoot } from './title/StudioBoot.tsx'
import { hasBooted, markBooted } from './title/bootFlag.ts'
import {
  clearFounderProfile,
  DEFAULT_FOUNDER,
  readFounderProfile,
  type FounderProfile,
} from './game/founderProfile.ts'
import { getPermanent, setPermanent } from './game/save.ts'
import {
  SCENE_FOUNDER_BOARD,
  SCENE_HERO_BOARD,
  SCENE_JAMES_ARRIVES,
  SCENE_MATT_ARRIVES,
  SCENE_MO_ARRIVES,
  SCENE_SERENA_ARRIVES,
  SCENE_THE_THREAD,
} from './game/scenes.ts'
import { THREAD } from './sim/events.ts'
import ScenarioBar from './dev/ScenarioBar.tsx'
import { DEBUG_TOOLS_ENABLED, debugSearchParams } from './dev/debugAccess.ts'
import { SCENARIOS_UP, applyScenario, scenarioById, scenarioRung } from './game/scenarios.ts'
import { zAtRung } from './sim/ladder.ts'

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
const DEBUG_QUERY = debugSearchParams()

const SKIP_TITLE = (() => {
  const q = DEBUG_QUERY
  return q.has('notitle') || q.has('act') || q.has('bench') || q.has('scenarios') || q.has('scenario')
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
  const [studioBootUp, setStudioBootUp] = useState(false)
  const [founderProfile, setFounderProfile] = useState<FounderProfile | null>(() =>
    readFounderProfile(),
  )
  const [titleVisit, setTitleVisit] = useState(0)
  const newGameNeedsFounder = useRef(false)

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
    const act = DEBUG_QUERY.get('act')
    if (act && (PHASE_ORDER as readonly string[]).includes(act)) {
      jumpToPhase(act as Phase)
    }

    // ?select=4 selects a developer without holding on one — §7.8.8, in the
    // same family as ?overnight and ?dialogue. Worth having for the same reason
    // those were: the card's copy, its live §19 quote and the turn animation
    // all want iterating on, and reaching them by hand means finding a specific
    // seat in a room that has been panned somewhere else.
    const select = DEBUG_QUERY.get('select')
    if (select !== null) selectDeveloper(Number(select))

    // ?full is the **worst frame the HUD ever has to draw**, and it exists for
    // the §23.4.2 acceptance gate rather than for looking at.
    //
    // Every layout defect reported off a handset since §4.15 shipped has been in
    // the right rail, and every one of them needed a state the gate could not
    // reach by loading a URL: a studio that has prestiged (so §21.0c's roles,
    // backlogs and upgrade door all exist), with a defect bench, a downed
    // release and a ticket queue it is losing, in the act that also carries
    // §21.0a's offer and §10.10's dial. Reaching that by playing takes minutes
    // and lands somewhere slightly different every time.
    //
    // Same family as ?act, ?devs and ?select, and here for the same reason: the
    // frame is real, the way of getting to it is not.
    if (DEBUG_QUERY.has('full')) {
      const p = getPermanent()
      setPermanent({
        ...p,
        meta: {
          ...p.meta,
          paradigmShifts: 1,
          /*
           * §21.7.6 — **and the three heroes who bring the three backlogs.**
           *
           * Without them this fixture stopped being the worst frame the moment
           * the instrument rule landed: the shift alone opens the tree and the
           * simulation, but each bar and each role on the dial now waits for the
           * person who fixes it, so `?full` would have quietly become a frame
           * with three fewer readouts than the one it exists to reproduce.
           *
           * That is §25.7.3's fourth hole in a new coat — a gate that never
           * visits a frame where the HUD is full — and it would have shown up as
           * the rail budget passing.
           */
          milestones: [
            ...p.meta.milestones,
            // He arrived in Act I, so any prestiged save has him.
            SCENE_JAMES_ARRIVES.id,
            SCENE_MO_ARRIVES.id,
            SCENE_SERENA_ARRIVES.id,
            SCENE_MATT_ARRIVES.id,
            /*
             * §18.0a and §21.7.7 — **trap 28, applied in the same commit.**
             *
             * Three new scenes can claim this frame. The thread fires on the
             * first tick of any Run 2 studio past twelve developers with an
             * empty board, which is exactly what this fixture is, and a scene
             * halts the tick and covers the HUD with a dialogue box — so the
             * gate would have been measuring the §10.7 box rather than the
             * worst frame the HUD ever has to draw.
             *
             * Recorded rather than suppressed, on the same argument the four
             * arrivals above are recorded: a player at this point in a career
             * has been through all of them. The event itself is set live and
             * *routed* below, because §18.0's banner is part of the worst frame
             * and its modal is a different, simpler one.
             */
            SCENE_THE_THREAD.id,
            SCENE_FOUNDER_BOARD.id,
            SCENE_HERO_BOARD.id,
          ],
        },
      })
      __setState({
        devs: 12,
        roster: [{ role: 'dev', count: 12 }],
        cash: 40_000,
        dialUnlocked: true,
        projectsShipped: 5,
        defects: 37,
        // The longest name in `PROJECTS`, because a chip has to hold one.
        incidents: [
          { id: 1, releaseId: 1, releaseName: 'OPEN-WORLD SURVIVAL CRAFT', age: 3, work: 40 },
        ],
        // Deep enough that §4.13's bar reads FALLING BEHIND and names its cure.
        tickets: 400,
        // §18.0 — a live event, already routed, so the frame carries the
        // banner and its two controls. Mid-count, because `REPLY TO ALL · 14`
        // is a wider label than the first or last reading of it.
        //
        // `?full&event` leaves it *unrouted* instead, which is §18.0a's modal —
        // a different and simpler frame, gated separately.
        event: {
          id: THREAD.id,
          remaining: 14,
          age: 42,
          routed: !DEBUG_QUERY.has('event'),
        },
      })
    }

    // ?devs=250000 forces a headcount, for looking at the §7.8.2 rungs.
    //
    // Same family as ?select and ?act, and it exists for the same reason they
    // do: rung 5 is a hundred thousand developers, and there is no way to reach
    // that by playing that does not take longer than a session. Deliberately
    // *not* routed through the economy — it sets the count and nothing else, so
    // what you are looking at is the renderer's answer to a headcount and not a
    // save file somebody has to unpick afterwards.
    const devs = DEBUG_QUERY.get('devs')
    if (devs !== null && Number.isFinite(Number(devs))) {
      const n = Math.max(0, Math.floor(Number(devs)))
      // Cash comes with it, because §4.10d's payroll is continuous and a studio
      // of forty thousand people handed no money bankrupts inside one tick —
      // which is correct behaviour and is not what anybody typing this flag is
      // trying to look at.
      __setState({ devs: n, cash: n * 1e6, devCap: n * 2 })
    }

    // ?scenario=town is `?devs` with the script retired and the money already
    // in the bank — see `game/scenarios.ts` for why those two are the
    // difference between a headcount you can look at and one you cannot.
    // `?scenarios` (plural) is the picker that switches between them live.
    const scenario = scenarioById(
      DEBUG_QUERY.get('scenario') ?? '',
    )
    if (scenario) applyScenario(scenario)

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
      const z = DEBUG_QUERY.get('z')
      if (z !== null && Number.isFinite(Number(z))) h.camera.set(Number(z))
      // A scenario parks the lens at the rung its headcount has earned, unless
      // `?z` has asked for somewhere specific. Landing at a hundred million
      // developers with the camera still on somebody's desk is technically the
      // studio you asked for and is not the picture you wanted.
      else if (scenario) h.camera.set(zAtRung(scenarioRung(scenario)))
      // Criterion 6's stopwatch stops here: the renderer is up and the first
      // frame is pokeable. Anything after this is the player's own reaction
      // time, not the app's cold start.
      markInteractive()
      setStage(h)

      // ?bench runs the GDD §23.3 acceptance sequence. ?bench=10 shortens the
      // 60-second sustained-tap leg, for checking the harness itself without
      // sitting through the real thing.
      const bench = DEBUG_QUERY.get('bench')
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

  function returnToMainScreen() {
    saveGame()
    setStarted(false)
    setFounderSetupUp(false)
    setTitleExiting(false)
    setTitleVisit((visit) => visit + 1)
    setTitleUp(true)
  }

  return (
    <div className={appClass}>
      <div className="app__canvas" ref={hostRef} />
      {titleUp && (
        <TitleScreen
          stage={stage}
          firstLaunch={firstLaunch && titleVisit === 0}
          onStart={() => {
            // The title still owns the first frame. CONTINUE hands a new install
            // to identity setup, then identity setup hands it to the game.
            // A returning player goes straight through the same camera push.
            setTitleExiting(true)
            if (founderProfile) setStarted(true)
          }}
          onNewGame={() => {
            startNewGame()
            clearFounderProfile()
            setFounderProfile(null)
            setStarted(false)
            newGameNeedsFounder.current = true
            setTitleExiting(true)
          }}
          onExited={() => {
            setTitleUp(false)
            if (newGameNeedsFounder.current || !founderProfile) {
              newGameNeedsFounder.current = false
              setFounderSetupUp(true)
            }
          }}
        />
      )}
      {founderSetupUp && (
        <FounderSetup
          onComplete={(profile) => {
            setFounderProfile(profile)
            setFounderSetupUp(false)
            // Not straight into the game: the OS boots over a black screen
            // first, names the founder and the project, and only then hands
            // the desk over. The stage is already running behind it.
            setStudioBootUp(true)
          }}
        />
      )}
      {studioBootUp && founderProfile && (
        <StudioBoot
          founderName={founderProfile.name}
          projectName={PROJECTS[0].name}
          onDone={() => {
            setStudioBootUp(false)
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
          <Hud
            stage={stage}
            onMainMenu={returnToMainScreen}
          />
        ) : (
          <div className="title-handoff">
            <Hud
              stage={stage}
              onMainMenu={returnToMainScreen}
            />
          </div>
        ))}
      {/*
        An explicitly requested local-browser trigger. The runtime gate is
        load-bearing: Capacitor itself uses a localhost-looking origin, so the
        native-platform half of DEBUG_TOOLS_ENABLED keeps this off Android.
        Deployed HTML is also refused even if VITE_BENCH was set by mistake.
      */}
      {DEBUG_TOOLS_ENABLED && import.meta.env.VITE_BENCH === '1' && stage && benchText === null && (
        <button type="button" className="bench-trigger" onClick={() => startBench(stage, 60)}>
          RUN §7.5
        </button>
      )}
      {benchText !== null && <pre className="bench-report">{benchText}</pre>}
      {/*
        `?scenarios` — the §7.7.1 ladder on nine buttons. Local browser only,
        and only when named: the frame gate also runs locally, and a bar that
        showed up unasked would be in every one of its screens.
      */}
      {SCENARIOS_UP && <ScenarioBar stage={stage} />}
    </div>
  )
}
