import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { playSfx } from '../audio/sfx.ts'
import type { StageHandle } from '../render/stage.ts'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import { Typewriter } from '../ui/Typewriter.tsx'
import { motionMs, useReducedMotion } from '../ui/motion.ts'
import { revealTimeline, typingDuration } from '../ui/typewriter.ts'
import { playUi } from '../ui/uiSfx.ts'
import { useTitleCamera } from './useTitleCamera.ts'
import {
  BOOT_EXIT_MS,
  BOOT_TEXT,
  COUNT_GHOST,
  EXIT_ITEM_MS,
  EXIT_LIGHTS_MS,
  EXIT_LOGO_MS,
  LAND_MS,
  LOGO_IN_MS,
  MENU_ITEMS,
  MENU_ITEM_MS,
  OS_BANNER,
  RULE_MS,
  TAGLINE,
  TAGLINE_MS,
  bootClockScale,
  countAt,
  exitDelayMs,
  exitTotalMs,
  groupDigits,
  menuInDelayMs,
  titleTimeline,
  type MenuItem,
} from './titleSequence.ts'

/**
 * The title screen — GDD §10.9.
 *
 * The room behind this is the *game's* room, drifting on the *game's* camera,
 * and pressing START does not load anything: it lights the room, pushes the
 * camera in, and takes the interface away. §10.9.1's claim that "the first cut
 * of the game is not a cut at all" is only true if there is nothing here to
 * cut *to*, so there is no second scene, no loader and no fade — this is an
 * overlay on a simulation that has been running the whole time.
 *
 * Two things are worth knowing before editing:
 *
 * **The entrances are scheduled by CSS, not by React.** Every part mounts at
 * t=0 holding its from-state through `animation-fill-mode: both`, and arrives
 * on its own `animation-delay` off {@link titleTimeline}. Mount-gating each
 * part on a clock was the first draft and it is subtly F1-unsafe: a render
 * that lands one frame late inserts an element whose animation has already
 * begun, so it appears part-way through — a pop, produced by the code written
 * to prevent pops. The browser is a better scheduler than a React state update.
 *
 * **The one thing React drives is the number**, because it is a value and not
 * a transition. That loop stops the moment the count lands (§10.9.4's idle
 * motion is all CSS and the Pixi ticker), so a settled title screen costs no
 * React frames against the §23.3 budget.
 */

export interface TitleScreenProps {
  stage: StageHandle | null
  /** Fired on press, before the exit runs — the game may start arriving. */
  onStart: () => void
  /** Fired when the last slab has left. The title may be unmounted. */
  onExited: () => void
  /** §10.9.3 — true replays the boot sequence. Injected so it is testable. */
  firstLaunch: boolean
}

/** OPTIONS and CREDITS are §10.9.2 stubs: the slabs are real, the screens are not. */
type Stub = Exclude<MenuItem, 'START'>

const STUB_COPY: Record<Stub, readonly string[]> = {
  OPTIONS: [
    'OPTIONS  --  NOT WIRED UP YET',
    '',
    'SOUND, HAPTICS AND REDUCE MOTION LAND',
    'WITH THE STUDIO_OS CONFIG TERMINAL.',
  ],
  CREDITS: [
    'CREDITS  --  NOT WIRED UP YET',
    '',
    '100,000,000 DEVELOPERS',
    'A STUDIO_OS PRODUCTION.',
  ],
}

export function TitleScreen({ stage, onStart, onExited, firstLaunch }: TitleScreenProps) {
  const reduced = useReducedMotion()
  const t = useMemo(() => titleTimeline(firstLaunch, reduced), [firstLaunch, reduced])

  const [exiting, setExiting] = useState(false)
  const [count, setCount] = useState(() => countAt(0, t.countMs))
  const [stub, setStub] = useState<Stub | null>(null)
  // Latched separately from `stub`, because `Panel` keeps its children mounted
  // through the exit animation and children derived straight from `stub` would
  // blank on the frame it goes null.
  const [stubShown, setStubShown] = useState<Stub>('OPTIONS')

  useTitleCamera(stage, exiting)

  // --- the count — §10.9.1, "and the logo counts" -------------------------

  const landed = useRef(false)

  useEffect(() => {
    let frame = 0
    const started = performance.now()

    const step = (now: number) => {
      const elapsed = now - started - t.countStart
      setCount(countAt(elapsed, t.countMs))

      if (elapsed >= t.countMs) {
        if (!landed.current) {
          landed.current = true
          // F3 — the landing is a state change, so it makes a sound. §10.8a's
          // arrival bounce is the picture of it; this is the half you hear.
          playUi('whoosh')
        }
        return
      }

      // The digits roll audibly. `playUi` throttles the tick to ~11/sec on its
      // own, so this is a counter ticking rather than a 60 Hz buzz.
      if (elapsed >= 0) playUi('tick')
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [t])

  // --- the boot — §10.9.3, first launch only ------------------------------

  const bootTimeline = useMemo(() => revealTimeline(BOOT_TEXT), [])
  const bootScale = useMemo(
    () => bootClockScale(typingDuration(bootTimeline), t.bootMs),
    [bootTimeline, t.bootMs],
  )
  const [bootWall, setBootWall] = useState(0)
  const bootOutMs = motionMs(BOOT_EXIT_MS, reduced)
  const bootVisible = t.bootMs > 0 && bootWall < t.bootMs + bootOutMs

  useEffect(() => {
    if (t.bootMs === 0) return

    let frame = 0
    const started = performance.now()
    const step = (now: number) => {
      const wall = now - started
      setBootWall(wall)
      // Kept running through the exit animation so the unmount happens after
      // the block has finished lifting away, not on the frame it starts.
      if (wall < t.bootMs + bootOutMs) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [t.bootMs, bootOutMs])

  // --- exit — §10.9.4 ------------------------------------------------------

  const start = useCallback(() => {
    if (exiting) return
    setExiting(true)
    onStart()
    // The push-in is a zoom, so it gets the zoom's voice rather than a UI
    // sound: this is the camera moving, not a control acknowledging a finger.
    playSfx('zoom-in')
  }, [exiting, onStart])

  // Latched rather than depended on, as in Panel: an inline arrow from the
  // caller changes identity on every parent render and would restart the exit
  // timer, so the title would never actually leave.
  const exited = useRef(onExited)
  useEffect(() => {
    exited.current = onExited
  }, [onExited])

  useEffect(() => {
    if (!exiting) return
    const timer = setTimeout(() => exited.current(), exitTotalMs(reduced))
    return () => clearTimeout(timer)
  }, [exiting, reduced])

  function openStub(name: Stub) {
    setStubShown(name)
    setStub(name)
  }

  /**
   * One element's slot in whichever direction the screen is currently going.
   * Both phases are expressed the same way so nothing can end up carrying an
   * entrance delay while it is leaving.
   */
  const slot = (inDelay: number, inMs: number, outDelay: number, outMs: number): CSSProperties =>
    exiting
      ? { animationDelay: `${outDelay}ms`, animationDuration: `${motionMs(outMs, reduced)}ms` }
      : { animationDelay: `${inDelay}ms`, animationDuration: `${motionMs(inMs, reduced)}ms` }

  const logoSlot = slot(t.countStart, LOGO_IN_MS, exitDelayMs('logo', 0, reduced), EXIT_LOGO_MS)

  return (
    <div className="title" data-phase={exiting ? 'exit' : 'in'}>
      {/*
        The night, and the one lit monitor — §10.9.1.

        A wash on the interface plane rather than a change to the room
        geometry, and that is a design decision rather than a shortcut:
        ART_DIRECTION §1.0a establishes the interface as a second pane of glass
        in front of the tube, and "the room at night" is a property of the
        light in front of the world, not of the desks in it. It also makes
        "the room lights come up" one opacity ramp instead of a scene rebuild
        on the frame the player presses START.

        It has no entrance. Night is the scene's initial condition, not
        something that arrives — fading it *in* would flash the lit room and
        then darken it, which is a worse F1 than the one it would be avoiding.
      */}
      <div
        className="title__night"
        style={exiting ? { animationDuration: `${motionMs(EXIT_LIGHTS_MS, reduced)}ms` } : undefined}
        aria-hidden="true"
      />
      {/*
        §10.9.6 — the middle distance.

        Dust in the monitor's beam, on three planes moving at three speeds.
        Nothing here is an object; it is the *air*, and it exists because a
        blurred room behind a wash gives the eye one distance to sit at. Motes
        crossing in front of it at different rates are the cheapest parallax
        there is, and parallax is the only depth cue a still frame keeps.
      */}
      <div className="title__motes" data-plane="far" aria-hidden="true" />
      <div className="title__motes" data-plane="mid" aria-hidden="true" />
      <div className="title__motes" data-plane="near" aria-hidden="true" />

      {/*
        §10.9.6 — the near field.

        An empty chair and the edge of the desk it belongs to, in the immediate
        foreground, cropped by the frame and thrown out of focus. Silhouette
        only: an unlit object between the camera and the one light in the room
        has no visible surface, so this is a *hole* in the picture rather than a
        drawing of a chair — which is why it costs no art and cannot go out of
        step with §22.7.

        It is doing the job §10.9.5 forbids solving with an illustration. The
        composition had two planes, the room and the type, and two planes read
        as a photograph with a caption. A third in front of both makes the
        camera feel like it is *in* the room rather than looking at a picture
        of one, and it does it with the room's own 2:1 geometry.
      */}
      <div className="title__near" aria-hidden="true">
        <div className="title__near-back" />
        <div className="title__near-seat" />
        <div className="title__near-post" />
        <div className="title__near-desk" />
      </div>

      {/*
        §10.9.4, "scanlines roll". The Pixi CRT pass grades the world but not
        the DOM (ART_DIRECTION §1.0a), so without this the type would be the
        one thing on screen not behind glass. This is §1.0a's own named cheap
        fix, scoped to the title.

        Above the near field on purpose: the glass is in front of everything in
        the room, including the things nearest the camera.
      */}
      <div className="title__scanlines" aria-hidden="true" />

      <div className="title__os" style={logoSlot}>
        {OS_BANNER}
      </div>

      {bootVisible && (
        <pre
          className="title__boot"
          style={{ animationDelay: `${t.bootMs}ms`, animationDuration: `${bootOutMs}ms` }}
        >
          {/*
            Controlled clock — see `bootClockScale` for why the elapsed value
            is not wall time. §10.7's 28 chars/sec is canon for dialogue; this
            is a banner, so it borrows the reveal and not the rate.
          */}
          <Typewriter text={BOOT_TEXT} elapsedMs={bootWall * bootScale} sound />
        </pre>
      )}

      <div className="title__logo" style={logoSlot}>
        {/*
          The ghost reserves the full nine-digit width from the first frame, so
          `1` -> `100,000,000` grows rightward inside a box that never moves.
          Without it the rule, the tagline and the whole left column would
          re-lay-out sixty times a second while the logo counted, which is
          §10.6's "numbers that snap" failure with extra steps.
        */}
        <div className="title__count">
          <span className="title__count-ghost" aria-hidden="true">
            {COUNT_GHOST}
          </span>
          <span
            className="title__count-live"
            style={{ animationDelay: `${t.landAt}ms`, animationDuration: `${motionMs(LAND_MS, reduced)}ms` }}
          >
            {groupDigits(count)}
          </span>
        </div>

        {/*
          §10.9.2 — `DEVELOPERS` at a quarter the size, justified to the same
          total width. Laid out as one flex row of letters rather than with
          `text-align-last: justify`, which only distributes at word boundaries
          unless `text-justify: inter-character` is supported. Ten letters
          spread across eleven numerals is the relationship the logo *is*, so
          it may not rest on a property that can silently no-op.
        */}
        <div className="title__word" aria-label="DEVELOPERS">
          {'DEVELOPERS'.split('').map((ch, i) => (
            <span key={i} aria-hidden="true">
              {ch}
            </span>
          ))}
        </div>

        <div
          className="title__rule"
          style={slot(t.ruleStart, RULE_MS, exitDelayMs('rule', 0, reduced), EXIT_ITEM_MS)}
          aria-hidden="true"
        />

        <p
          className="title__tagline"
          style={slot(t.taglineStart, TAGLINE_MS, exitDelayMs('tagline', 0, reduced), EXIT_ITEM_MS)}
        >
          {TAGLINE}
        </p>
      </div>

      <nav className="title__menu">
        {MENU_ITEMS.map((item, i) => (
          <div
            key={item}
            className="title__slab"
            style={slot(
              t.menuStart + menuInDelayMs(i, reduced),
              MENU_ITEM_MS,
              exitDelayMs('menu', i, reduced),
              EXIT_ITEM_MS,
            )}
          >
            <Button onClick={() => (item === 'START' ? start() : openStub(item))}>{item}</Button>
          </div>
        ))}
      </nav>

      {/*
        The stubs. Semi-transparent and blurred over the title rather than an
        opaque page (§10.6) — the room keeps drifting behind them, which is
        also the honest thing to show given there is nothing else to show yet.
      */}
      <Panel open={stub !== null} from="left" modal className="title__stub">
        <pre className="title__stub-copy">{STUB_COPY[stubShown].join('\n')}</pre>
        <Button onClick={() => setStub(null)}>CLOSE</Button>
      </Panel>
    </div>
  )
}
