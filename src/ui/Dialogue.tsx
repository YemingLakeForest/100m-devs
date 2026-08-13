import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from './motion.ts'
import { Panel } from './Panel.tsx'
import { Typewriter } from './Typewriter.tsx'
import { paginate, revealTimeline, typingDuration } from './typewriter.ts'
import {
  dialogueReducer,
  initDialogue,
  isArmed,
  isComplete,
  type DialogueEvent,
  type DialogueState,
} from './dialogue.ts'

/**
 * The §10.7 dialogue box.
 *
 * Departure Mono, semi-transparent over a simulation that keeps running behind
 * it, a speaker name plate above and a blinking advance caret in the corner a
 * Game Boy would put it. The rules it exists to enforce are in dialogue.ts,
 * where they can be tested; this file is the box.
 *
 * Three things here are load-bearing rather than decorative:
 *
 * 1. The box is short and anchored to the real edge — **§10.7a.2 moves it to
 *    the lower third and grows the type**, because the script is the product
 *    and it was being rendered as a status bar. §10.7's "it never covers the
 *    speaker" survives the move and is finally *enforceable*: §10.7a.1 frames
 *    the speaker in the upper half deliberately, so the clearance is by
 *    construction rather than by luck. Two lines of pre-wrapped monospace is
 *    still a known height, so the frame is the same size on a 1.78:1 phone and
 *    a 2.4:1 one and the camera can be composed against it.
 * 2. The whole overlay takes pointer events. The HUD is otherwise transparent
 *    to taps so the swarm stays pokeable through it (§7.1) — but while a page
 *    is on screen every tap belongs to the dialogue, or a player mashing at
 *    5 Hz would be poking developers through the text they are supposed to be
 *    reading.
 * 3. There is no close button and no skip. §10.7 rule 3.
 */

/**
 * §10.7a.1 — who is speaking, *in the world*.
 *
 * `'founder'` is the corner desk (§7.8.10); a number is a seat index. `null` —
 * or an absent `focus` — means nobody: `STUDIO_OS` has no body, and the camera
 * holds wherever it is rather than cutting to a machine.
 *
 * A seat rather than an identity, on the same argument §7.8.8 makes for
 * selection: identities are generated from the seat on demand (§7.8.7), so a
 * script costs one integer per line and survives a rebuild.
 */
export type SpeakerFocus = 'founder' | number | null

export interface DialogueLine {
  /** `JAMES`, `ADVISOR`, `STUDIO_OS`. Rendered as given. */
  speaker: string
  text: string
  /**
   * §10.7a.1 — where the lens goes for this line.
   *
   * Optional, and an absent value is not "unknown" but "nobody" — see
   * {@link SpeakerFocus}. Held on the line rather than derived from `speaker`
   * because the same name can be at different desks in different scenes, and a
   * lookup table from name to seat is a second place the two could disagree.
   */
  focus?: SpeakerFocus
}

export interface DialogueProps {
  script: readonly DialogueLine[]
  /** Called once the box has finished its exit transition, not when the last page is tapped. */
  onFinished?: () => void
  /**
   * §10.7a.1 — who is speaking, in the world, for the page now on screen.
   *
   * Fired on every page turn with the page's `focus` (or null for `STUDIO_OS`,
   * which has no body). The box owns *when* a page changes; the camera owns
   * *where the lens goes* for it, so the handoff is a callback rather than a
   * stage import — this component is pure presentation and must not know the
   * renderer exists.
   */
  onFocus?: (focus: SpeakerFocus | null) => void
  /**
   * §21.7.1 — the source line index for the page now on screen.
   *
   * Fired on every page turn with the *line* the page came from, so stage
   * directions keyed to a line — James dropping in, the `hey` notification —
   * can fire from the box without the box knowing what they do. A line, not a
   * page: a long line paginates into several boxes and all of them share one
   * index.
   */
  onLine?: (lineIndex: number) => void
  /**
   * §10.7's one exception: dialogue already seen in a previous run fills
   * instantly. It is not a skip — rule 2's deliberate advance tap still applies
   * to every page. First viewing of any line is always fully typed, so this is
   * the caller's fact to know, not this component's.
   */
  seen?: boolean
  /**
   * Box width in characters. Fixed rather than measured: a monospace face plus
   * a fixed column count is what makes the reveal reflow-free, and a box that
   * re-wraps on a device rotation mid-scene would re-paginate under the player.
   */
  columns?: number
}

interface Page {
  speaker: string
  text: string
  /**
   * §10.7a.1 — carried through pagination so the camera knows who is speaking
   * even when one `DialogueLine` becomes several boxes. A long `STUDIO_OS`
   * announcement is four pages and one focus; every one of those pages is the
   * machine, so the lens holds rather than cutting anywhere.
   */
  focus?: SpeakerFocus
  /** The source `DialogueLine` index, for stage directions keyed to a line. */
  line: number
}

/**
 * §10.7a.2 — **narrower in characters, wider on screen.**
 *
 * Forty columns at the terminal scale became twenty-eight at 1.5x it: the same
 * physical measure, a larger apparent size, and a better ragged edge. Fixed
 * rather than measured for the reason {@link DialogueProps.columns} gives — a
 * monospace face plus a fixed column count is what makes the reveal
 * reflow-free.
 */
const DEFAULT_COLUMNS = 28

/**
 * §10.7a.2 — two lines a page, not three.
 *
 * Fewer words, larger, more pages. A page turn is a beat, and §10.7's rule 2
 * already made turning one a deliberate act — so spending more of them is
 * spending the thing the scene is made of rather than padding it.
 */
const LINES_PER_PAGE = 2

export function Dialogue({
  script,
  onFinished,
  onFocus,
  onLine,
  seen = false,
  columns = DEFAULT_COLUMNS,
}: DialogueProps) {
  const reduced = useReducedMotion()

  const pages = useMemo<Page[]>(
    () =>
      script.flatMap((line, lineIndex) =>
        paginate(line.text, columns, LINES_PER_PAGE).map((lines) => ({
          speaker: line.speaker,
          text: lines.join('\n'),
          focus: line.focus,
          line: lineIndex,
        })),
      ),
    [script, columns],
  )

  const durations = useMemo(
    // Instant-fill is a rendering accommodation in both cases — reduce-motion
    // (§10.7 accessibility) and the previously-seen replay. Neither shortens
    // the script or removes a tap.
    () => pages.map((p) => (reduced || seen ? 0 : typingDuration(revealTimeline(p.text)))),
    [pages, reduced, seen],
  )

  const [state, setState] = useState<DialogueState>(initDialogue)

  // The reducer is pure and takes the page durations as an argument, so it is
  // driven through a state updater rather than through `useReducer` — that
  // keeps `durations` a plain value in render scope instead of something that
  // has to be smuggled into the reducer through a ref.
  const send = useCallback(
    (event: DialogueEvent) => setState((s) => dialogueReducer(s, event, durations)),
    [durations],
  )

  // The clock. It runs while the page is still typing and through the rule-2
  // arming window, then stops — once the caret is blinking nothing else is a
  // function of time, and a rAF loop left running behind a static box would be
  // spending frames out of the §23.3 budget for nothing.
  const armed = isArmed(state)
  useEffect(() => {
    if (state.finished || armed) return

    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      send({ type: 'tick', dt: now - last })
      last = now
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [state.finished, armed, state.page, send])

  // Pointer-down, not click: F2 wants the acknowledgement on the way down, and
  // a `click` only resolves on release, which on a phone is 60–100 ms later.
  const onPointerDown = useCallback(() => send({ type: 'tap' }), [send])

  const page = pages[Math.min(state.page, pages.length - 1)]
  const focus = page?.focus ?? null

  // §10.7a.1 — the lens follows the speaker. Reported from a page change (the
  // same instant the name plate swaps) so the camera move and the subtitle
  // reveal are one event, never a camera that jumps then waits for the text.
  //
  // Held in a ref rather than read directly: the host re-renders every frame
  // (it subscribes to the store) and an inline `onFocus` would therefore be a
  // new function each render, re-firing the effect even though the page — the
  // thing the camera actually cares about — has not changed.
  const onFocusRef = useRef(onFocus)
  useEffect(() => {
    onFocusRef.current = onFocus
  }, [onFocus])
  useEffect(() => {
    onFocusRef.current?.(focus)
  }, [focus])

  const line = page?.line ?? 0
  const onLineRef = useRef(onLine)
  useEffect(() => {
    onLineRef.current = onLine
  }, [onLine])
  useEffect(() => {
    onLineRef.current?.(line)
  }, [line])

  if (!page) return null

  // Panel's `open` is the machine's own terminal state: the box leaves when the
  // script is over, and Panel is what keeps it alive long enough to leave with
  // a transition rather than vanishing (F1).
  return (
    <Panel open={!state.finished} from="bottom" className="ui-dialogue" onExited={onFinished}>
      {/*
        The whole frame is the advance tap, not just the box. §10.7's "every tap
        belongs to the dialogue" is meant literally: a transparent full-screen
        scrim eats the pointer-down, so a thumb can land anywhere — on the box,
        beside it, over the swarm — and still turn the page.
      */}
      <div className="ui-dialogue__scrim" onPointerDown={onPointerDown} />
      <div className="ui-dialogue__hit">
        <div className="ui-dialogue__plate">{page.speaker}</div>
        <div className="ui-dialogue__box">
          <Typewriter
            className="ui-dialogue__text"
            text={page.text}
            elapsedMs={state.elapsed}
            complete={isComplete(state)}
            sound
          />
          {/*
            The caret is the affordance for rule 2, so it appears exactly when
            the advance tap arms — not when the page completes. A player who
            taps while it is dark has their tap swallowed, and the box has
            already told them why.
          */}
          {armed && <span className="ui-dialogue__caret" aria-hidden="true" />}
        </div>
      </div>
    </Panel>
  )
}
