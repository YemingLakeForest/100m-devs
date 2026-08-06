import { useEffect, useRef, useState } from 'react'
import { initSfx } from './audio/sfx.ts'
import { jumpToPhase } from './game/store.ts'
import { PHASE_ORDER, type Phase } from './game/onboarding.ts'
import { Hud } from './hud/Hud.tsx'
import { createStage, type StageHandle } from './render/stage.ts'

/**
 * The spike — ADR 0001 §7.2 and §7.2a.
 *
 * A Pixi canvas under a React HUD, which is the whole architectural claim the
 * ADR is making. If the boundary is wrong, it is wrong here first.
 */
export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<StageHandle | null>(null)

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
      setStage(h)
    })

    return () => {
      cancelled = true
      handle?.destroy()
    }
  }, [])

  return (
    <div className="app">
      <div className="app__canvas" ref={hostRef} />
      <Hud stage={stage} />
    </div>
  )
}
