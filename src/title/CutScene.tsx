import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Typewriter } from '../ui/Typewriter.tsx'
import { motionMs, useReducedMotion } from '../ui/motion.ts'
import { playUi } from '../ui/uiSfx.ts'
import { BOOT_EXIT_MS } from './studioBoot.ts'

import '../styles/studioBoot.css'

/**
 * A black screen with typed pages on it, and a tap to turn them.
 *
 * §10.9.3's STUDIO_OS boot was the only thing that did this, so the mechanism
 * lived inside it. §15.1a needs the same screen for a different beat — the
 * reboot between two realities — and *the same screen* is the whole point:
 * this is the surface the game uses to say **a studio is starting**, and a
 * player who has seen it once recognises it without a word of narration.
 *
 * So the shell is here and the words are the caller's. What it owns:
 *
 * - **The pace is the player's.** A click while a page is typing completes that
 *   page (§10.7 rule 1, the same impatience gesture the dialogue box owns); a
 *   click on a finished page turns it; the click on the last page lifts the
 *   screen. Nothing runs on a clock, so nobody is ever waiting on it.
 * - **The exit is a fade, not a cut** (§10.5), pushed down as a custom property
 *   so §10.5 rule 3's reduced-motion shortening applies to it.
 * - **The page is remounted per index**, so the typewriter's clock starts with
 *   the line it is drawing rather than carrying the last page's elapsed time.
 */
export interface CutSceneProps {
  /** One string per page. Newlines inside a page are drawn as a block. */
  pages: readonly string[]
  /** Called once the screen has faded and whatever is behind it may take over. */
  onDone: () => void
}

export function CutScene({ pages, onDone }: CutSceneProps) {
  const reduced = useReducedMotion()
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
      <pre className="studio-boot__page">
        <Typewriter
          key={page}
          text={pages[page] ?? ''}
          complete={completed}
          sound
          onComplete={() => setCompleted(true)}
        />
      </pre>
    </div>
  )
}
