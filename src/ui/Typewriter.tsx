import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from './motion.ts'
import { playUi } from './uiSfx.ts'
import { charsRevealedAt, revealTimeline, typingDuration } from './typewriter.ts'
import { ConceptText } from './ConceptText.tsx'

/**
 * Per-character reveal — GDD §10.7's timing table, rendered.
 *
 * The text is expected to be pre-wrapped (see `paginate`) and is drawn with
 * `white-space: pre`, so no glyph moves once it has been drawn. §10.7 calls a
 * reflowing reveal "a rendering fault" and it is right: the eye tracks the
 * moving edge of the text, and a word jumping to the next line pulls it away
 * from the character that is actually arriving.
 *
 * The clock is optional. Left alone the component drives itself from mount,
 * which is what a terminal banner wants; `Dialogue` passes `elapsedMs` instead,
 * because it already owns a clock for the §10.7 rule-2 arming window and two
 * clocks on one page would drift apart.
 */

export interface TypewriterProps {
  text: string
  /**
   * Controlled elapsed time in ms. Omit to self-drive. When supplied, the
   * caller owns the frame loop and this component is a pure function of it.
   */
  elapsedMs?: number
  /**
   * Force the whole string in — §10.7 rule 1's impatience tap, and the
   * "already seen in a previous run" replay path.
   */
  complete?: boolean
  /**
   * §10.7: "letters land with a tick." Off for text that is not a character
   * speaking, since F3 asks for sound on state changes, not on every glyph in
   * the product.
   */
  sound?: boolean
  className?: string
  onComplete?: () => void
}

export function Typewriter({
  text,
  elapsedMs,
  complete = false,
  sound = false,
  className,
  onComplete,
}: TypewriterProps) {
  const reduced = useReducedMotion()
  const timeline = useMemo(() => revealTimeline(text), [text])
  const duration = useMemo(() => typingDuration(timeline), [timeline])

  // The self-driven clock carries the text it belongs to, so a new line resets
  // it by comparison in render rather than by an effect that fires a frame
  // late and shows the tail of the previous line against the new one.
  const [self, setSelf] = useState({ text, elapsed: 0 })
  const selfElapsed = self.text === text ? self.elapsed : 0
  const controlled = elapsedMs !== undefined

  useEffect(() => {
    // §10.7 accessibility: reduce-motion sets the rate to instant-fill per
    // page. It shortens nothing and dismisses nothing — the content is
    // identical, only the reveal is gone.
    if (controlled || reduced || complete) return

    let frame = 0
    const started = performance.now()
    const step = (now: number) => {
      const t = now - started
      setSelf({ text, elapsed: t })
      if (t < duration) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [controlled, duration, reduced, complete, text])

  const elapsed = controlled ? (elapsedMs as number) : selfElapsed
  const revealed =
    complete || reduced ? text.length : Math.min(text.length, charsRevealedAt(timeline, elapsed))

  const seen = useRef({ text: '', revealed: 0, announced: false })

  useEffect(() => {
    const s = seen.current
    if (s.text !== text) {
      s.text = text
      s.revealed = 0
      s.announced = false
    }

    if (sound && revealed > s.revealed) playUi('tick')
    s.revealed = revealed

    if (revealed >= text.length && !s.announced) {
      s.announced = true
      onComplete?.()
    }
  }, [revealed, sound, text, onComplete])

  return (
    <span className={className}>
      <ConceptText text={text} to={revealed} />
      {/*
        The unrevealed remainder is still laid out, in transparent ink. Without
        it the box would resize as the last line fills, and a frame that
        changes shape while text arrives is the §10.6 "numbers that snap"
        failure wearing a different hat.
      */}
      <span className="ui-type__ghost" aria-hidden="true">
        <ConceptText text={text} from={revealed} />
      </span>
    </span>
  )
}
