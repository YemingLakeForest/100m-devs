import { useEffect, useRef, useState } from 'react'
import { initSfx } from './audio/sfx.ts'
import { jumpToPhase } from './game/store.ts'
import { PHASE_ORDER, type Phase } from './game/onboarding.ts'
import { Hud } from './hud/Hud.tsx'
import { createStage, type StageHandle } from './render/stage.ts'
import { runBench } from './perf/bench.ts'
import { markInteractive } from './perf/metrics.ts'

/**
 * App root — the Pixi canvas under the React HUD.
 *
 * The DOM/canvas boundary of GDD §23.2 non-negotiable 3 lives here: if it is
 * wrong, it is wrong here first.
 */
export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<StageHandle | null>(null)
  const [benchText, setBenchText] = useState<string | null>(null)

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

    void createStage(host).then((h) => {
      if (cancelled) {
        h.destroy()
        return
      }
      handle = h
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

  return (
    <div className="app">
      <div className="app__canvas" ref={hostRef} />
      <Hud stage={stage} />
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
