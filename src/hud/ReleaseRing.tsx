/**
 * The release ring — GDD §10.7 [amended 2026-09-26], the rebuild's circular
 * release game, drawn as a STUDIO_OS instrument.
 *
 * *"The release game should be ported too the circle dredge fishing game"*, and
 * then *"it needs to fit the current game aesthetics."* The rules of what a
 * release is worth are the rebuild's, unchanged and pure in `sim/release.ts`:
 * one ring is the calendar, the bugs sit on the inner track, the launch window
 * is at the top, and **one control** means whatever the head is over — fix it
 * on a bug, ship it in the window, and a miss anywhere else. The window is worth
 * less every year, so every bug the player stops to fix costs them the best
 * date this build will ever be offered.
 *
 * **[2026-10-16] How it plays is `sim/ringPlay.ts`'s**, on the user's play of
 * the first version: *"I like the roundal the art style, and the bug hit, but
 * it's too repeatative and not challenging enough."* A rushed fix or an armour
 * crack bounces the head back (a clean fix carries it on), a clean streak speeds it up, a miss stalls it while the year runs on,
 * and up the ladder the bugs crawl and grow armour. The roundel and its pixels
 * are kept exactly; what it draws gained the year's clock (the outermost ring),
 * a trail behind the head that says which way and how fast it is going, and a
 * sprite for each kind of bug.
 *
 * **[2026-10-16, later] The years are hype.** *"the year story on the release
 * isn't really fitting, that breaks the immersion."* The top of the ring is the
 * storefront's spotlight, and what drains is the game's hype, in four stages
 * (`ringPlay.HYPE`); a clean hit wins some of it back. The arithmetic under it is
 * the years', so `read.year` below is the hype stage by another name.
 *
 * **The brief on the right is a console, not a caption** (the same day: *"the
 * text on the right, they make very little sense, re-write them"*). It used to
 * say GOLD MASTER over every build whatever its state, BEST WINDOW NOW over a
 * multiplier with no unit, and one line of advice that changed under the
 * player's thumb. It now reads like the operating system the studio runs on:
 * the build's version, what the window is worth this year and next, the year's
 * clock as a bar, the three numbers the player is managing (bugs, streak,
 * speed), and a log — newest at the bottom, older lines dimming — that says in
 * plain words what the last press did.
 *
 * What is this build's own is the drawing:
 *
 *  - **Pixels, not paths.** The dial is a 96-pixel bitmap written one pixel at a
 *    time and shown at an integer scale with `image-rendering: pixelated`, so
 *    every edge on it is a hard pixel edge (ART_DIRECTION §3 rule 1).
 *  - **One hue, four values.** The calendar is drawn in the live phosphor
 *    (`--p0..--p3`), brightest where it pays most, and the bands dim year by
 *    year as their worth drains away. The bugs wear §4.15's defect colour
 *    (WARN[3]); armour is the neutral ramp, because it is not a colour, it is
 *    a plate.
 *  - **The frame every overlay wears** (§10.6a): an `OsWindow` titled RELEASE,
 *    and the whole body is the tap target — §23.4.2 is a phone held sideways.
 *
 * The head is driven by a clock, not by React: the dial is redrawn inside
 * `requestAnimationFrame` from `performance.now()`, and a press is scored
 * against where the head was when the finger came down (§10.8 F2).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OsWindow } from '../ui/OsWindow.tsx'
import { Button } from '../ui/Button.tsx'
import { Cover } from './Cover.tsx'
import { coverFor } from '../three/sim/cover.ts'
import { BLIP_SFX, playSfx } from '../audio/sfx.ts'
import { playUi } from '../ui/uiSfx.ts'
import { purchaseHaptic } from '../audio/haptics.ts'
import { useReducedMotion } from '../ui/motion.ts'
import {
  PROJECTS,
  closeLaunch,
  launchRelease,
  ringBuild,
  ringDefectCount,
  type GameState,
  type ShelvedBuild,
} from '../game/store.ts'
import {
  BUG_EXCLUSION,
  LAUNCH_BANDS,
  READINESS_BANDS,
  REACH_CLEAN,
  REACH_RUSHED,
  REDUCED_SWEEP_SCALE,
  SHIP_ZONE,
  YEARS,
  bandIndexFor,
  inShipZone,
  launchOutcome,
  stageFor,
  turnPeriodMs,
  wrapTurn,
  type LaunchOutcome,
  type ReadinessStage,
} from '../sim/release.ts'
import {
  bugUnderHead,
  createRingPlay,
  ringExpired,
  HYPE,
  hypeStage,
  stepRing,
  tapRing,
  hypeBurnt,
  type RingBug,
  type RingEvent,
  type RingPlay,
} from '../sim/ringPlay.ts'

import '../styles/release.css'

/** The dial's side, in bitmap pixels. Shown at 2x or 3x, never in between. */
export const DIAL = 96
/** How long the verdict holds before the window hands over to the reel. */
export const VERDICT_HOLD_MS = 620
/** Segments in the hype fuse. Ten, so each one is a tenth of a stage and nobody has to count. */
const CLOCK_SEGMENTS = 10
/** Lines the log keeps, the newest included. */
const LOG_LINES = 3

type Mode = 'ready' | 'fix' | 'crack' | 'ship' | 'commit' | 'stall'

type Tone = 'good' | 'bad' | 'warn' | 'info'
interface Line {
  id: number
  text: string
  tone: Tone
}

/**
 * The build's version, by the stage it would ship at now. A label that names a
 * state the build is actually in, where GOLD MASTER over an ALPHA was a label
 * that lied for the whole first half of every ring.
 */
const VERSION: Record<ReadinessStage, string> = {
  ALPHA: 'v0.3-ALPHA',
  BETA: 'v0.8-BETA',
  RC: 'v1.0-RC',
  GOLD: 'v1.0 GOLD',
}

/** What the log says about a press. Plain words, the studio's own voice, and never the rule restated. */
function lineFor(e: RingEvent, play: RingPlay): Line['text'] | null {
  switch (e.kind) {
    case 'start':
      return 'HYPE AT ITS PEAK. THE SPOTLIGHT PAYS BEST NOW'
    case 'miss':
      return 'MISSED. HEAD STALLED, HYPE DID NOT'
    case 'crack':
      return 'ARMOUR CRACKED. HIT IT AGAIN'
    case 'fix':
      if (e.regressed) return 'THAT PATCH BROKE SOMETHING. NEW BUG'
      if (e.cleared) return 'ZERO BUGS. SHIP AT THE TOP FOR GOLD'
      if (e.quality === 'rushed') return 'PATCHED, BARELY. STREAK LOST'
      if (e.streak >= 3) return `CLEAN ×${e.streak}. HYPE HOLDS, HEAD ${Math.round(play.tempo * 100)}%`
      return 'SQUASHED CLEAN. HYPE HOLDS'
    default:
      return null
  }
}

function toneFor(e: RingEvent): Tone {
  if (e.kind === 'miss') return 'bad'
  if (e.kind === 'fix' && e.regressed) return 'bad'
  if (e.kind === 'fix' && e.quality === 'rushed') return 'warn'
  if (e.kind === 'crack') return 'warn'
  return 'good'
}

/**
 * The ring for the shelf's head. Mounted by `Hud` while the store says the
 * studio is at the launch; keyed on the build, so a second build gets a fresh
 * ring rather than the first one's backlog.
 */
export function ReleaseRing({ state }: { state: GameState }) {
  const build = ringBuild(state)
  // [plan 2026-10-16, phase 4.5] A LAUNCH ×N is one ring for the held queue,
  // drawn for the head with the batch's bugs.
  const batch = build ? Math.max(1, Math.min(state.launchBatch, state.shelf.length)) : 1
  return build ? <Ring key={`${build.id}-${batch}`} build={build} batch={batch} seed={state.runSeed} /> : null
}

function Ring({ build, batch, seed }: { build: ShelvedBuild; batch: number; seed: number }) {
  const reduced = useReducedMotion()
  const marks = useMemo(() => ringDefectCount(build, batch), [build, batch])
  const period = useMemo(
    () => turnPeriodMs(build.projectIndex, PROJECTS.length, marks) * (reduced ? REDUCED_SWEEP_SCALE : 1),
    [build.projectIndex, marks, reduced],
  )

  const canvas = useRef<HTMLCanvasElement | null>(null)
  // The game itself lives in a ref: input reads it synchronously, because two
  // taps between paints must see each other, and React state is its echo.
  const [fresh] = useState(() => createRingPlay(seed, build.ordinal, marks, period, build.projectIndex, PROJECTS.length))
  const play = useRef<RingPlay>(fresh)
  const sampledAt = useRef<number | null>(null)
  const done = useRef(false)
  const lastTap = useRef(-Infinity)
  const told = useRef(new Set<number>())
  const flash = useRef(0)
  const shake = useRef(0)
  const sparks = useRef<{ x: number; y: number; vx: number; vy: number; life: number }[]>([])

  const [open, setOpen] = useState(fresh.bugs.length)
  const [read, setRead] = useState({
    mode: 'ready' as Mode,
    band: 0,
    year: 1,
    clean: false,
    streak: 0,
    tempo: 1,
    left: CLOCK_SEGMENTS,
  })
  const [log, setLog] = useState<Line[]>(() => [
    { id: 0, text: `QA FOUND ${marks} ${marks === 1 ? 'BUG' : 'BUGS'} ON THE CALENDAR`, tone: 'info' },
    { id: 1, text: 'HIT A BUG TO FIX IT. HIT THE TOP TO SHIP', tone: 'info' },
    { id: 2, text: 'TAP TO START THE CLOCK', tone: 'info' },
  ])
  const [verdict, setVerdict] = useState<LaunchOutcome | null>(null)
  const say = useCallback(
    (text: string, tone: Tone) =>
      setLog((was) => [...was, { id: (was[was.length - 1]?.id ?? 0) + 1, text, tone }].slice(-LOG_LINES)),
    [],
  )

  const stage = stageFor(open, marks)

  const cover = useMemo(
    () => coverFor(seed, build.ordinal, 0, build.name, build.genre),
    [seed, build.ordinal, build.name, build.genre],
  )

  /** Bring the game up to now. */
  const sample = useCallback(() => {
    const now = performance.now()
    if (sampledAt.current !== null) play.current = stepRing(play.current, now - sampledAt.current)
    sampledAt.current = now
    return play.current
  }, [])

  const ship = useCallback(
    (chosen: boolean) => {
      if (done.current) return
      done.current = true
      const p = sample()
      const outcome = launchOutcome({
        turn: p.turn,
        year: hypeStage(p),
        open: p.bugs.length,
        initial: marks,
        chosen: chosen && !ringExpired(p),
      })
      setVerdict(outcome)
      // [2026-10-15] Nothing in the release glides (`audio/glides.ts`): the date
      // locks on a latch, and a perfect one adds one note that holds its pitch.
      // [2026-10-16] The latch has weight now — two clicks over a low fifth —
      // where the desk switch it replaced was the same click as a poke.
      playSfx('ring-lock')
      if (outcome.timing.band === 'perfect') setTimeout(() => playSfx(BLIP_SFX[7]), 90)
      flash.current = 1
      shake.current = reduced ? 0 : 1.4
      setTimeout(() => launchRelease(outcome), VERDICT_HOLD_MS)
    },
    [marks, sample, reduced],
  )

  const burst = useCallback(
    (t: number, n: number) => {
      if (reduced) return
      const a = t * Math.PI * 2 - Math.PI / 2
      for (let i = 0; i < n; i++) {
        const dir = Math.random() * Math.PI * 2
        const v = 0.3 + Math.random() * 0.9
        sparks.current.push({
          x: DIAL / 2 + Math.cos(a) * TRACK_MID,
          y: DIAL / 2 + Math.sin(a) * TRACK_MID,
          vx: Math.cos(dir) * v,
          vy: Math.sin(dir) * v,
          life: 1,
        })
      }
    },
    [reduced],
  )

  /** The one control. What it does is whatever the head is over. */
  const act = useCallback(() => {
    if (done.current) return
    const now = performance.now()
    // A double-fire guard, not a rate limit: a pointerdown and the click it
    // becomes on the button must not count as two presses.
    if (now - lastTap.current < 90) return
    lastTap.current = now
    const before = sample()
    const { play: after, event } = tapRing(before, seed, build.ordinal)
    play.current = after
    if (event.kind === 'start') sampledAt.current = now
    if (event.kind === 'ship') return ship(true)
    if (event.kind === 'expired') return ship(false)
    const text = lineFor(event, after)
    if (text) say(text, event.kind === 'start' ? 'info' : toneFor(event))
    if (event.kind === 'start') return
    if (event.kind === 'miss') {
      playSfx('ring-miss')
      flash.current = 0.6
      shake.current = reduced ? 0 : 0.5
      return
    }
    setOpen(after.bugs.length)
    if (event.kind === 'crack') {
      playSfx('ring-crack')
      burst(event.bug.t, 6)
      shake.current = reduced ? 0 : 0.8
      return
    }
    const clean = event.quality === 'clean'
    burst(event.bug.t, event.cleared ? 28 : clean ? 14 : 6)
    shake.current = reduced ? 0 : clean ? 1 : 0.5
    if (event.regressed) {
      playSfx('ring-rushed')
      setTimeout(() => playSfx('poke-void'), 70)
      flash.current = 1
    } else if (event.cleared) {
      playSfx('ring-fix')
      purchaseHaptic()
    } else playSfx(clean ? 'ring-fix' : 'ring-rushed')
  }, [sample, ship, seed, build.ordinal, burst, reduced, say])

  // Keyboard: SPACE and ENTER are the control; ESCAPE leaves without shipping.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!done.current) closeLaunch()
        return
      }
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.preventDefault()
      if (!e.repeat) act()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act])

  // The dial. Nothing in here writes React state except the readout, and that
  // only when what it says has changed.
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const ink = readInk(el)
    const image = ctx.createImageData(DIAL, DIAL)
    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (play.current.started && !done.current) {
        const before = hypeStage(play.current)
        const p = sample()
        if (ringExpired(p)) {
          ship(false)
        } else {
          const year = hypeStage(p)
          if (year !== before) {
            playUi('tick')
            const worth = LAUNCH_BANDS[bandIndexFor(0, year)].multiplier
            say(
              year === YEARS
                ? 'FORGOTTEN. THE PUBLISHER SHIPS IT WHEN THIS RUNS OUT'
                : `THE HYPE COOLS: ${HYPE[year - 1]}. SPOTLIGHT ×${worth.toFixed(2)}`,
              'warn',
            )
          }
          // §10.8 F3 — the head ticks as it reaches each bug, so the player can
          // aim with their ears as well as their eyes.
          for (const b of p.bugs) {
            const near = Math.abs(wrapTurn(b.t - p.turn)) <= REACH_RUSHED
            if (near && !told.current.has(b.id)) {
              told.current.add(b.id)
              playUi('tick')
            } else if (!near) told.current.delete(b.id)
          }
        }
      }
      const p = play.current
      const year = hypeStage(p)
      const hit = bugUnderHead(p)
      const mode: Mode = !p.started
        ? 'ready'
        : p.stall > 0
          ? 'stall'
          : hit
            ? hit.bug.hp > 1
              ? 'crack'
              : 'fix'
            : inShipZone(p.turn)
              ? 'ship'
              : 'commit'
      const band = bandIndexFor(p.turn, year)
      const clean = hit?.quality === 'clean'
      const left = p.started ? Math.ceil((1 - hypeBurnt(p)) * CLOCK_SEGMENTS) : CLOCK_SEGMENTS
      setRead((was) =>
        was.mode === mode &&
        was.band === band &&
        was.year === year &&
        was.clean === clean &&
        was.streak === p.streak &&
        was.tempo === p.tempo &&
        was.left === left
          ? was
          : { mode, band, year, clean, streak: p.streak, tempo: p.tempo, left },
      )
      paint(image, ink, {
        play: p,
        year,
        flash: flash.current,
        sparks: sparks.current,
        frame: Math.floor(performance.now() / 140) % 2,
      })
      ctx.putImageData(image, 0, 0)
      if (shake.current > 0.05) {
        const dx = Math.round((Math.random() - 0.5) * 2 * shake.current)
        const dy = Math.round((Math.random() - 0.5) * 2 * shake.current)
        el.style.transform = `translate(${dx * 2}px, ${dy * 2}px)`
      } else if (el.style.transform) el.style.transform = ''
      shake.current *= 0.82
      flash.current *= 0.86
      for (let i = sparks.current.length - 1; i >= 0; i--) {
        const s = sparks.current[i]
        s.x += s.vx
        s.y += s.vy
        s.life -= 0.035
        if (s.life <= 0) sparks.current.splice(i, 1)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [sample, ship, say])

  const band = LAUNCH_BANDS[read.band]
  const best = LAUNCH_BANDS[bandIndexFor(0, read.year)]
  const next = read.year < YEARS ? LAUNCH_BANDS[bandIndexFor(0, read.year + 1)] : null
  const shown: ReadinessStage = open === 0 ? 'GOLD' : stage
  const label = verdict
    ? 'RELEASED'
    : read.mode === 'ready'
      ? 'START'
      : read.mode === 'stall'
        ? 'STALLED'
        : read.mode === 'crack'
          ? 'CRACK IT'
          : read.mode === 'fix'
            ? read.clean
              ? 'FIX IT · CLEAN'
              : 'FIX IT'
            : read.mode === 'ship'
              ? `SHIP IT · ×${band.multiplier.toFixed(2)}`
              : 'HOLD'
  const latest = log[log.length - 1]

  return (
    <OsWindow
      open
      from="centre"
      modal
      title={batch > 1 ? `LAUNCH ×${batch}` : 'RELEASE'}
      meta={HYPE[read.year - 1]}
      onClose={verdict ? undefined : () => closeLaunch()}
      className="release-frame ring-frame"
      bodyClassName="release ring"
      footer={
        <Button
          variant="primary"
          className="ring__act"
          data-mode={verdict ? 'done' : read.mode}
          disabled={verdict !== null}
          onClick={act}
        >
          {label}
        </Button>
      }
    >
      <div
        className="ring__catch"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          act()
        }}
        data-done={verdict ? 'true' : 'false'}
      >
        <div className="ring__dial">
          <canvas ref={canvas} className="ring__canvas" width={DIAL} height={DIAL} aria-hidden="true" />
          <div className="ring__hub" aria-hidden="true">
            <span className="ring__stage">{shown}</span>
            <b key={open} className="ring__left">{open}</b>
            <span className="ring__bugs">{open === 1 ? 'BUG' : 'BUGS'}</span>
          </div>
        </div>
        <div className="ring__brief">
          <div className="ring__shelf">
            <Cover spec={cover} title={build.name} unrated />
            <div className="ring__id">
              <p className="ring__kicker" data-stage={shown}>{VERSION[shown]}</p>
              <p className="ring__name">
                {build.name}
                {batch > 1 ? ` +${batch - 1}` : ''}
              </p>
            </div>
          </div>

          <div className="ring__value" aria-label={`The spotlight pays ×${best.multiplier.toFixed(2)} while the game is ${HYPE[read.year - 1]}`}>
            <span className="ring__k">SPOTLIGHT PAYS</span>
            <b key={read.year} className="ring__x" data-band={best.id}>
              ×{best.multiplier.toFixed(2)}
            </b>
            <span className="ring__next">{next ? `${HYPE[read.year]} ×${next.multiplier.toFixed(2)}` : 'LAST CHANCE'}</span>
          </div>

          <div className="ring__clock" aria-label={`Hype: ${HYPE[read.year - 1]}`}>
            <span className="ring__k">HYPE</span>
            <span className="ring__bar" data-low={read.left <= 3 ? 'true' : 'false'}>
              {Array.from({ length: CLOCK_SEGMENTS }, (_, i) => (
                <i key={i} data-on={i < read.left ? 'true' : 'false'} />
              ))}
            </span>
          </div>

          <div className="ring__stats">
            <span className="ring__stat" data-tone="bug">
              <b>{open}</b> {open === 1 ? 'BUG' : 'BUGS'}
            </span>
            <span className="ring__stat" data-hot={read.streak >= 3 ? 'true' : 'false'}>
              <b key={read.streak}>×{read.streak}</b> STREAK
            </span>
            <span className="ring__stat">
              <b>{Math.round(read.tempo * 100)}%</b> SPEED
            </span>
          </div>

          <div className="ring__row" aria-label={`Build stage ${shown}`}>
            {READINESS_BANDS.map((b) => (
              <span key={b.id} className="ring__pip" data-on={b.id === shown ? 'true' : 'false'}>
                {b.id}
              </span>
            ))}
          </div>

          <ol className="ring__log" aria-hidden="true">
            {log.slice(0, -1).map((l) => (
              <li key={l.id} data-tone={l.tone}>
                {l.text}
              </li>
            ))}
          </ol>
          <p
            key={verdict ? 'verdict' : latest?.id}
            className="ring__say"
            role="status"
            aria-live="polite"
            data-tone={verdict ? 'good' : latest?.tone}
            data-verdict={verdict ? verdict.timing.band : undefined}
          >
            {verdict ? `SHIPPED: ${verdict.timing.label} · ${verdict.stage}` : latest?.text}
          </p>
        </div>
      </div>
    </OsWindow>
  )
}

// --- the dial ------------------------------------------------------------------

/** Radii, in bitmap pixels from the centre. */
const OUTER = 45
const CAL_IN = 37
const TRACK_OUT = 33
const TRACK_IN = 25
const TRACK_MID = (TRACK_OUT + TRACK_IN) / 2
const HEAD_IN = 22
/** The hype fuse: a one-pixel ring outside the calendar, lit for what is left of this stage of hype. */
const CLOCK_IN = 46.2
const CLOCK_OUT = 47.6

type Rgb = readonly [number, number, number]

interface Ink {
  p: readonly [Rgb, Rgb, Rgb, Rgb]
  n0: Rgb
  n1: Rgb
  n2: Rgb
  n5: Rgb
  bug: Rgb
  bugDark: Rgb
  alarm: Rgb
}

function rgbOf(value: string, fallback: Rgb): Rgb {
  const hex = value.trim().replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback
  const n = parseInt(hex, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * The palette, read once when the ring opens. The phosphor is live (§1.1) but
 * the studio is stopped while the ring is up, so the hue it opened in is the
 * hue it closes in.
 */
function readInk(el: HTMLElement): Ink {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: Rgb) => rgbOf(css.getPropertyValue(name), fallback)
  return {
    p: [v('--p0', [10, 42, 48]), v('--p1', [26, 107, 120]), v('--p2', [53, 201, 217]), v('--p3', [184, 244, 255])],
    n0: v('--n0', [20, 18, 26]),
    n1: v('--n1', [36, 31, 46]),
    n2: v('--n2', [58, 50, 68]),
    n5: v('--n5', [140, 132, 150]),
    // §4.15 — a defect is WARN[3] everywhere it is drawn.
    bug: v('--warn-3', [255, 233, 176]),
    bugDark: v('--warn-1', [138, 92, 18]),
    alarm: v('--alarm-2', [230, 80, 80]),
  }
}

/**
 * The bugs, 7 by 7. `#` is the defect's ink, `+` its shade, `=` an armour
 * plate. The rebuild's rule, kept: *a body with legs is read before it is
 * explained*. A crawler has two frames, so it is seen walking; armour is a
 * shell over the body, and a cracked shell shows the crack.
 */
const SPRITES = {
  bug: [
    '.#...#.',
    '..#.#..',
    '#.###.#',
    '.##+##.',
    '#.#+#.#',
    '.##+##.',
    '#..#..#',
  ],
  walk: [
    '.#...#.',
    '..#.#..',
    '.#####.',
    '#.#+#.#',
    '.##+##.',
    '#.#+#.#',
    '.#.#.#.',
  ],
  armour: [
    '.#...#.',
    '..#.#..',
    '.=====.',
    '=======',
    '=======',
    '.=====.',
    '#.#.#.#',
  ],
  cracked: [
    '.#...#.',
    '..#.#..',
    '.==+==.',
    '===+=+=',
    '=+=+===',
    '.=+===.',
    '#.#.#.#',
  ],
} as const

interface Scene {
  play: RingPlay
  year: number
  flash: number
  sparks: readonly { x: number; y: number; life: number }[]
  /** Which walk frame the crawlers are on. */
  frame: number
}

function within(t: number, centre: number, half: number): boolean {
  return Math.abs(wrapTurn(t - centre)) <= half
}

function spriteOf(b: RingBug, frame: number): readonly string[] {
  if (b.kind === 'armoured') return b.hp > 1 ? SPRITES.armour : SPRITES.cracked
  if (b.kind === 'crawler' && frame === 1) return SPRITES.walk
  return SPRITES.bug
}

/**
 * One frame of the dial. Every rule it shows is a rule from the sim made
 * visible — the two reaches, the dead zone, the bands at this year's worth, the
 * year running out, which way the head is going — because a rule the player
 * cannot see is a rule they have to be told.
 */
function paint(image: ImageData, ink: Ink, s: Scene): void {
  const d = image.data
  const c = (DIAL - 1) / 2
  const p = s.play
  const started = p.started
  const put = (i: number, rgb: Rgb) => {
    d[i] = rgb[0]
    d[i + 1] = rgb[1]
    d[i + 2] = rgb[2]
    d[i + 3] = 255
  }
  /*
   * The calendar at *this year's* worth: each band is drawn in the ink of the
   * band it will actually pay, so the brightest arc is the perfect date in year
   * one and has gone dark by year three.
   */
  const worth = [ink.p[3], ink.p[2], ink.p[1], ink.n2]
  const at = (i: number) => worth[Math.min(worth.length - 1, i + Math.max(0, s.year - 1))]
  // What is left of this stage of hype, as a turn of the fuse ring from the top.
  const left = started ? 1 - hypeBurnt(p) : 1
  const stalled = p.stall > 0
  // The trail: how far behind the head it reaches, longer the faster it goes.
  const trail = 0.018 + 0.03 * p.tempo

  for (let y = 0; y < DIAL; y++) {
    for (let x = 0; x < DIAL; x++) {
      const i = (y * DIAL + x) * 4
      const dx = x - c
      const dy = y - c
      const r = Math.hypot(dx, dy)
      // Turns clockwise from the top, which is the release date.
      const t = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1
      const dist = Math.abs(wrapTurn(t))
      d[i + 3] = 0

      if (r >= CLOCK_IN && r <= CLOCK_OUT) {
        // The hype fuse: lit clockwise from the top for the time that is
        // left, so it empties the way a fuse burns down.
        put(i, t <= left ? (left < 0.3 ? ink.bug : ink.p[2]) : ink.n1)
      } else if (r >= CAL_IN && r <= OUTER) {
        if (dist <= SHIP_ZONE) {
          const band = dist * 2 <= LAUNCH_BANDS[0].edge ? 0 : dist * 2 <= LAUNCH_BANDS[1].edge ? 1 : 2
          put(i, at(band))
        } else put(i, ink.n1)
        // Quarter ticks round the ring the studio is aiming on.
        if (r > OUTER - 2 && [0.25, 0.5, 0.75].some((q) => Math.abs(t - q) < 0.004)) put(i, ink.p[1])
      } else if (r >= TRACK_IN && r <= TRACK_OUT) {
        // The backlog track, and the dead zone either side of the date that
        // makes one control possible: nothing to fix there, and not a release.
        const dead = dist > SHIP_ZONE && dist < BUG_EXCLUSION
        // Palette values only, no blends: a flash is a step up the ramp, not a
        // tint, because a mixed colour is a colour the palette does not have.
        let ink0: Rgb = dead ? ink.n0 : ink.n1
        if (!dead && p.bugs.length === 0) ink0 = ink.p[0]
        if (s.flash > 0.3) ink0 = ink.p[1]
        if (started && !stalled) {
          // The trail, behind the head only: which way it is going, and how fast.
          const back = wrapTurn((p.turn - t) * p.dir)
          if (back > 0 && back <= trail) ink0 = back < trail / 2 ? ink.p[1] : ink.p[0]
        }
        // The two reaches, drawn under the head: the wide one lands a fix, the
        // narrow core cleans it.
        if (started && within(t, p.turn, REACH_CLEAN)) ink0 = ink.p[1]
        else if (started && within(t, p.turn, REACH_RUSHED) && ink0 !== ink.p[1]) ink0 = ink.p[0]
        put(i, ink0)
        if (dead && (x + y) % 2 === 0) put(i, ink.n1)
      }

      // The head, from inside the track to past the calendar. About a pixel
      // and a half wide at every radius; the defect's alarm ink while stalled.
      if (r >= HEAD_IN && r <= OUTER + 1 && within(t, p.turn, 0.75 / (Math.PI * 2 * Math.max(1, r)))) {
        put(i, stalled ? ink.alarm : ink.p[3])
      }
    }
  }

  // The bugs, stamped on the track at whole pixels.
  for (const b of p.bugs) {
    const a = b.t * Math.PI * 2 - Math.PI / 2
    const bx = Math.round(c + Math.cos(a) * TRACK_MID - 3)
    const by = Math.round(c + Math.sin(a) * TRACK_MID - 3)
    const lit = started && within(b.t, p.turn, REACH_CLEAN)
    const sprite = spriteOf(b, s.frame)
    for (let yy = 0; yy < 7; yy++) {
      for (let xx = 0; xx < 7; xx++) {
        const ch = sprite[yy][xx]
        if (ch === '.') continue
        const px = bx + xx
        const py = by + yy
        if (px < 0 || py < 0 || px >= DIAL || py >= DIAL) continue
        const rgb = ch === '#' ? (lit ? ink.p[3] : ink.bug) : ch === '=' ? (lit ? ink.p[3] : ink.n5) : ink.bugDark
        put((py * DIAL + px) * 4, rgb)
      }
    }
  }

  for (const sp of s.sparks) {
    const px = Math.round(sp.x)
    const py = Math.round(sp.y)
    if (px < 0 || py < 0 || px >= DIAL || py >= DIAL || sp.life < 0.2) continue
    put((py * DIAL + px) * 4, sp.life > 0.6 ? ink.p[3] : ink.p[2])
  }
}
