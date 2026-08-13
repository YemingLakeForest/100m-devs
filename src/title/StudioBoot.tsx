import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Typewriter } from '../ui/Typewriter.tsx'
import { motionMs, useReducedMotion } from '../ui/motion.ts'
import { playUi } from '../ui/uiSfx.ts'
import { BOOT_EXIT_MS, bootPages } from './studioBoot.ts'

import '../styles/studioBoot.css'

export interface StudioBootProps {
  /** The founder just built — named by the boot's `founder:` page. */
  founderName: string
  /** The run's first project — named by the boot's `project:` page. */
  projectName: string
  /** Called when the boot has lifted and the game may take the screen. */
  onDone: () => void
}

/**
 * The black cut scene between the founder creator and the game.
 *
 * The stage is already running behind this — §10.9.1's rule that the
 * simulation is never stopped means the boot is an overlay on a lit room, not
 * a screen that loads anything. Each page types itself out and waits for a
 * click: a click mid-reveal completes the page, a click on a finished page
 * moves on, and the click on the last page lifts the overlay and hands the
 * desk over. The player reads the boot at their own speed — it is a scene,
 * not a wait.
 */
export function StudioBoot({ founderName, projectName, onDone }: StudioBootProps) {
  const reduced = useReducedMotion()
  const pages = useMemo(() => bootPages(founderName, projectName), [founderName, projectName])
  const [page, setPage] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const exitMs = motionMs(BOOT_EXIT_MS, reduced)
  const last = page >= pages.length - 1

  // Latched, for the same reason the title latches its own: an inline arrow
  // from the caller changes identity on every parent render and would restart
  // the exit timer mid-fade.
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => done.current(), exitMs)
    return () => clearTimeout(timer)
  }, [leaving, exitMs])

  function handleTap() {
    if (leaving) return
    if (!completed) {
      // §10.7 rule 1 — the first click completes the page it interrupts.
      setCompleted(true)
    } else if (!last) {
      setPage((p) => p + 1)
      setCompleted(false)
    } else {
      // §10.9.4's "lights come up" — the same beat the title exit scores,
      // because this is the second half of the same transition.
      playUi('start')
      setLeaving(true)
    }
  }

  return (
    <div
      className="studio-boot"
      data-phase={leaving ? 'exit' : 'in'}
      style={{ '--boot-exit': `${exitMs}ms` } as CSSProperties}
      onClick={handleTap}
    >
      <div className="studio-boot__scanlines" aria-hidden="true" />
      {/*
        Remounted per page so the typewriter's own clock starts with the line
        it is drawing rather than carrying the previous page's elapsed time.
      */}
      <pre className="studio-boot__page">
        <Typewriter
          key={page}
          text={pages[page]}
          complete={completed}
          sound
          onComplete={() => setCompleted(true)}
        />
      </pre>
    </div>
  )
}
