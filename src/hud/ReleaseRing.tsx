/**
 * The release ring — GDD §10.7 [amended 2026-09-26], the rebuild's circular
 * release game, drawn as a STUDIO_OS instrument.
 *
 * *"The release game should be ported too the circle dredge fishing game"*, and
 * then *"it needs to fit the current game aesthetics."* The rules are the
 * rebuild's, unchanged and pure in `sim/release.ts`: one ring is one fiscal
 * year, one head sweeps it, the bugs sit on the inner track, the launch window
 * is at the top, and **one control** means whatever the head is over — fix it
 * on a bug, ship it in the window, and a stray commit anywhere else. The window
 * is worth less every year the head goes round, so every bug the player stops
 * to fix costs them the best date this build will ever be offered.
 *
 * What is this build's own is the drawing:
 *
 *  - **Pixels, not paths.** The dial is a 96-pixel bitmap written one pixel at a
 *    time and shown at an integer scale with `image-rendering: pixelated`, so
 *    every edge on it is a hard pixel edge (ART_DIRECTION §3 rule 1 — a smooth
 *    arc beside Departure Mono is the failure that document exists to stop).
 *  - **One hue, four values.** The calendar is drawn in the live phosphor
 *    (`--p0..--p3`), brightest where it pays most, and the bands dim year by
 *    year as their worth drains away. The only other ink is the bugs', which is
 *    §4.15's defect colour (WARN[3]) — the same noun in the same ink as the
 *    defect bar on the rail.
 *  - **The frame every overlay wears** (§10.6a): an `OsWindow` titled RELEASE,
 *    and the whole body is the tap target, as the old launch window's was —
 *    §23.4.2 is a phone held sideways, and an aim test that asks a thumb to
 *    travel to a footer is a test of travel time.
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
import { playSfx } from '../audio/sfx.ts'
import { playUi } from '../ui/uiSfx.ts'
import { purchaseHaptic } from '../audio/haptics.ts'
import { useReducedMotion } from '../ui/motion.ts'
import {
  PROJECTS,
  closeLaunch,
  launchRelease,
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
  defectRing,
  fixQuality,
  inShipZone,
  launchClock,
  launchOutcome,
  regresses,
  stageFor,
  turnPeriodMs,
  wrapTurn,
  type LaunchOutcome,
} from '../sim/release.ts'

import '../styles/release.css'

/** The dial's side, in bitmap pixels. Shown at 2x or 3x, never in between. */
export const DIAL = 96
/** How long the verdict holds before the window hands over to the reel. */
export const VERDICT_HOLD_MS = 620

interface Mark {
  id: number
  t: number
  /** The head has already ticked past it this pass. */
  told: boolean
}

type Mode = 'ready' | 'fix' | 'ship' | 'commit'

/**
 * The ring for the shelf's head. Mounted by `Hud` while the store says the
 * studio is at the launch; keyed on the build, so a second build gets a fresh
 * ring rather than the first one's backlog.
 */
export function ReleaseRing({ state }: { state: GameState }) {
  const build = state.launching ? state.shelf[0] : undefined
  return build ? <Ring key={build.id} build={build} seed={state.runSeed} /> : null
}

function Ring({ build, seed }: { build: ShelvedBuild; seed: number }) {
  const reduced = useReducedMotion()
  const marks = useMemo(() => ringDefectCount(build), [build])
  const period = useMemo(
    () => turnPeriodMs(build.projectIndex, PROJECTS.length, marks) * (reduced ? REDUCED_SWEEP_SCALE : 1),
    [build.projectIndex, marks, reduced],
  )

  const canvas = useRef<HTMLCanvasElement | null>(null)
  const opened = useRef<number | null>(null)
  const done = useRef(false)
  const lastTap = useRef(-Infinity)
  const turn = useRef(SHIP_ZONE + 0.01)
  const year = useRef(1)
  const fixes = useRef(0)
  const nextId = useRef(marks)
  const flash = useRef(0)
  const shake = useRef(0)
  const sparks = useRef<{ x: number; y: number; vx: number; vy: number; life: number }[]>([])

  const [open, setOpen] = useState<Mark[]>(() =>
    defectRing(seed, build.ordinal, marks).map((t, id) => ({ id, t, told: false })),
  )
  // Input reads the backlog synchronously — two taps between paints must see
  // each other — so the list lives in a ref and the state is its echo.
  const backlog = useRef(open)
  const [read, setRead] = useState<{ mode: Mode; band: number; year: number; clean: boolean }>({
    mode: 'ready',
    band: 0,
    year: 1,
    clean: false,
  })
  const [say, setSay] = useState({ text: 'PRESS TO START THE CLOCK', id: 0 })
  const [verdict, setVerdict] = useState<LaunchOutcome | null>(null)
  const announce = (text: string) => setSay((was) => ({ text, id: was.id + 1 }))

  const stage = stageFor(open.length, marks)

  const cover = useMemo(
    () => coverFor(seed, build.ordinal, 0, build.name, build.genre),
    [seed, build.ordinal, build.name, build.genre],
  )

  const sample = useCallback(() => {
    const clock = launchClock(opened.current === null ? 0 : performance.now() - opened.current, period)
    turn.current = clock.turn
    year.current = clock.year
    return clock
  }, [period])

  /** The bug under the head, if one is within the wide reach. */
  const underHead = useCallback(() => {
    let best: Mark | null = null
    let bestD = REACH_RUSHED
    for (const m of backlog.current) {
      const d = Math.abs(wrapTurn(m.t - turn.current))
      if (d <= bestD) {
        bestD = d
        best = m
      }
    }
    return best ? { mark: best, quality: fixQuality(bestD) } : null
  }, [])

  const ship = useCallback(
    (chosen: boolean) => {
      if (done.current) return
      done.current = true
      const clock = sample()
      const outcome = launchOutcome({
        turn: clock.turn,
        year: clock.year,
        open: backlog.current.length,
        initial: marks,
        chosen: chosen && !clock.expired,
      })
      setVerdict(outcome)
      // The lock sound is the game's "a number has been fixed" cue, and a
      // perfect date stacks the crit chime on it — the one moment two clips
      // are deliberately layered, as they were on the old launch window.
      playSfx('entropy-lock')
      if (outcome.timing.band === 'perfect') setTimeout(() => playSfx('poke-crit'), 90)
      setTimeout(() => launchRelease(outcome), VERDICT_HOLD_MS)
    },
    [marks, sample],
  )

  const burst = useCallback(
    (t: number, n: number) => {
      if (reduced) return
      const a = t * Math.PI * 2 - Math.PI / 2
      for (let i = 0; i < n; i++) {
        const dir = Math.random() * Math.PI * 2
        const v = 0.3 + Math.random() * 0.7
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
    if (opened.current === null) {
      opened.current = now
      announce('FIX THE BUGS, THEN SHIP IN THE WINDOW')
      return
    }
    const clock = sample()
    if (clock.expired) {
      ship(false)
      return
    }
    const hit = underHead()
    if (!hit && inShipZone(turn.current)) {
      ship(true)
      return
    }
    if (!hit) {
      // A mistimed tap breaks nothing in the codebase — the rebuild tried
      // opening a defect here and it read as noise — it just says so.
      announce('NOTHING THERE. WAIT FOR A BUG')
      playSfx('poke-void')
      flash.current = 0.5
      return
    }
    const { mark, quality } = hit
    const clean = quality === 'clean'
    fixes.current += 1
    const broke = !clean && regresses(seed, build.ordinal, mark.id, fixes.current)
    const left = backlog.current.filter((m) => m.id !== mark.id)
    // A rushed fix that regressed reopens in the same slot, so a retry can
    // never land on top of another bug or spawn somewhere unaimable.
    if (broke) left.push({ id: nextId.current++, t: mark.t, told: true })
    backlog.current = left
    setOpen(left)
    burst(mark.t, left.length === 0 ? 24 : clean ? 12 : 5)
    shake.current = reduced ? 0 : clean ? 1 : 0.5
    if (broke) {
      playSfx('poke-void')
      flash.current = 1
      announce('IT BROKE SOMETHING ELSE. AIM FOR THE CENTRE')
    } else if (left.length === 0) {
      playSfx('poke-crit')
      purchaseHaptic()
      announce('ALL CLEAR. SHIP IT IN THE WINDOW')
    } else {
      playSfx(clean ? 'poke-crit' : 'poke-desk')
      announce(clean ? 'CLEAN FIX' : 'FIXED. THE CENTRE NEVER REGRESSES')
    }
  }, [sample, underHead, ship, seed, build.ordinal, burst, reduced])

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
      if (opened.current !== null && !done.current) {
        const before = year.current
        const clock = sample()
        if (clock.expired) {
          ship(false)
        } else {
          if (clock.year !== before) playUi('tick')
          // §10.8 F3 — the head ticks as it reaches each bug, so the player can
          // aim with their ears as well as their eyes.
          for (const m of backlog.current) {
            const near = Math.abs(wrapTurn(m.t - turn.current)) <= REACH_RUSHED
            if (near && !m.told) {
              m.told = true
              playUi('tick')
            } else if (!near) m.told = false
          }
        }
      }
      const hit = underHead()
      const mode: Mode =
        opened.current === null ? 'ready' : hit ? 'fix' : inShipZone(turn.current) ? 'ship' : 'commit'
      const band = bandIndexFor(turn.current, year.current)
      const clean = hit?.quality === 'clean'
      setRead((was) =>
        was.mode === mode && was.band === band && was.year === year.current && was.clean === clean
          ? was
          : { mode, band, year: year.current, clean },
      )
      paint(image, ink, {
        turn: turn.current,
        year: year.current,
        open: backlog.current,
        flash: flash.current,
        sparks: sparks.current,
        started: opened.current !== null,
      })
      ctx.putImageData(image, 0, 0)
      if (shake.current > 0.05) {
        const dx = Math.round((Math.random() - 0.5) * 2 * shake.current)
        const dy = Math.round((Math.random() - 0.5) * 2 * shake.current)
        el.style.transform = `translate(${dx * 2}px, ${dy * 2}px)`
      } else if (el.style.transform) el.style.transform = ''
      shake.current *= 0.82
      flash.current *= 0.88
      for (let i = sparks.current.length - 1; i >= 0; i--) {
        const p = sparks.current[i]
        p.x += p.vx
        p.y += p.vy
        p.life -= 0.035
        if (p.life <= 0) sparks.current.splice(i, 1)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [sample, ship, underHead])

  const band = LAUNCH_BANDS[read.band]
  const best = LAUNCH_BANDS[bandIndexFor(0, read.year)]
  const label = verdict
    ? 'RELEASED'
    : read.mode === 'ready'
      ? 'START'
      : read.mode === 'fix'
        ? read.clean
          ? 'FIX IT · CLEAN'
          : 'FIX IT'
        : read.mode === 'ship'
          ? `SHIP IT · ×${band.multiplier.toFixed(2)}`
          : 'WAIT FOR A BUG'

  return (
    <OsWindow
      open
      from="centre"
      modal
      title="RELEASE"
      meta={`YEAR ${read.year}/${YEARS}`}
      onClose={verdict ? undefined : () => closeLaunch()}
      className="release-frame ring-frame"
      bodyClassName="release ring"
      footer={
        <Button
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
            <span className="ring__stage">{open.length === 0 ? 'GOLD' : stage}</span>
            <b className="ring__left">{open.length}</b>
            <span className="ring__bugs">{open.length === 1 ? 'BUG' : 'BUGS'}</span>
          </div>
        </div>
        <div className="ring__brief">
          <div className="ring__shelf">
            <Cover spec={cover} title={build.name} unrated />
            <div className="ring__id">
              <p className="ring__kicker">GOLD MASTER</p>
              <p className="ring__name">{build.name}</p>
            </div>
          </div>
          <div className="ring__row" aria-label={`Build quality ${open.length === 0 ? 'GOLD' : stage}`}>
            <span className="ring__k">BUILD</span>
            {READINESS_BANDS.map((b) => (
              <span key={b.id} className="ring__pip" data-on={b.id === (open.length === 0 ? 'GOLD' : stage) ? 'true' : 'false'}>
                {b.id}
              </span>
            ))}
          </div>
          <div className="ring__row" aria-label={`Year ${read.year} of ${YEARS}`}>
            <span className="ring__k">YEAR</span>
            {Array.from({ length: YEARS }, (_, i) => (
              <span
                key={i}
                className="ring__pip"
                data-on={i + 1 === read.year ? 'true' : 'false'}
                data-past={i + 1 < read.year ? 'true' : 'false'}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <p className="ring__best">
            BEST WINDOW NOW <b>×{best.multiplier.toFixed(2)}</b>
          </p>
          <p className="ring__say" role="status" aria-live="polite" data-verdict={verdict ? verdict.timing.band : undefined}>
            {verdict ? `${verdict.timing.label} · ${verdict.stage}` : say.text}
          </p>
        </div>
      </div>
    </OsWindow>
  )
}

// --- the dial ------------------------------------------------------------------

/** Radii, in bitmap pixels from the centre. */
const OUTER = 46
const CAL_IN = 38
const TRACK_OUT = 34
const TRACK_IN = 26
const TRACK_MID = (TRACK_OUT + TRACK_IN) / 2
const HEAD_IN = 23

type Rgb = readonly [number, number, number]

interface Ink {
  p: readonly [Rgb, Rgb, Rgb, Rgb]
  n0: Rgb
  n1: Rgb
  n2: Rgb
  bug: Rgb
  bugDark: Rgb
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
    // §4.15 — a defect is WARN[3] everywhere it is drawn.
    bug: v('--warn-3', [255, 233, 176]),
    bugDark: v('--warn-1', [138, 92, 18]),
  }
}

/**
 * A bug, 7 by 7 — antennae, head, six legs and a split back. `#` is the
 * defect's ink, `+` its shade. The rebuild's rule, kept: *a body with legs is
 * read before it is explained*, where a plain mark has to be learned from the
 * button's label.
 */
const BUG = [
  '.#...#.',
  '..#.#..',
  '#.###.#',
  '.##+##.',
  '#.#+#.#',
  '.##+##.',
  '#..#..#',
] as const

interface Scene {
  turn: number
  year: number
  open: readonly Mark[]
  flash: number
  sparks: readonly { x: number; y: number; life: number }[]
  started: boolean
}

/** Signed distance from `t` to `from..to` on the ring, 0 when inside. */
function within(t: number, centre: number, half: number): boolean {
  return Math.abs(wrapTurn(t - centre)) <= half
}

/**
 * One frame of the dial. Every rule it shows is a rule from `sim/release.ts`
 * made visible — the two reaches, the dead zone, the bands at this year's worth
 * — because a rule the player cannot see is a rule they have to be told.
 */
function paint(image: ImageData, ink: Ink, s: Scene): void {
  const d = image.data
  const c = (DIAL - 1) / 2
  const put = (i: number, rgb: Rgb) => {
    d[i] = rgb[0]
    d[i + 1] = rgb[1]
    d[i + 2] = rgb[2]
    d[i + 3] = 255
  }
  /*
   * The calendar at *this year's* worth: each band is drawn in the ink of the
   * band it will actually pay, so the brightest arc is the perfect date in year
   * one and has gone dark by year three. The player watches the best launch
   * this build will ever be offered leave.
   */
  const worth = [ink.p[3], ink.p[2], ink.p[1], ink.n2]
  const at = (i: number) => worth[Math.min(worth.length - 1, i + Math.max(0, s.year - 1))]

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

      if (r >= CAL_IN && r <= OUTER) {
        if (dist <= SHIP_ZONE) {
          const band = dist * 2 <= LAUNCH_BANDS[0].edge ? 0 : dist * 2 <= LAUNCH_BANDS[1].edge ? 1 : 2
          put(i, at(band))
        } else put(i, ink.n1)
        // Quarter ticks: the fiscal year the studio is aiming inside.
        if (r > OUTER - 2 && [0.25, 0.5, 0.75].some((q) => Math.abs(t - q) < 0.004)) put(i, ink.p[1])
      } else if (r >= TRACK_IN && r <= TRACK_OUT) {
        // The backlog track, and the dead zone either side of the date that
        // makes one control possible: nothing to fix there, and not a release.
        const dead = dist > SHIP_ZONE && dist < BUG_EXCLUSION
        // Palette values only, no blends: a flash is a step up the ramp, not a
        // tint, because a mixed colour is a colour the palette does not have.
        let ink0: Rgb = dead ? ink.n0 : ink.n1
        if (!dead && s.open.length === 0) ink0 = ink.p[0]
        if (s.flash > 0.3) ink0 = ink.p[1]
        // The two reaches, drawn under the head: the wide one lands a fix, the
        // narrow core cleans it.
        if (s.started && within(t, s.turn, REACH_CLEAN)) ink0 = ink.p[1]
        else if (s.started && within(t, s.turn, REACH_RUSHED)) ink0 = ink.p[0]
        put(i, ink0)
        if (dead && (x + y) % 2 === 0) put(i, ink.n1)
      }

      // The head, from inside the track to past the calendar.
      // About a pixel and a half wide at every radius.
      if (r >= HEAD_IN && r <= OUTER + 1 && within(t, s.turn, 0.75 / (Math.PI * 2 * Math.max(1, r)))) put(i, ink.p[3])
    }
  }

  // The bugs, stamped on the track at whole pixels.
  for (const m of s.open) {
    const a = m.t * Math.PI * 2 - Math.PI / 2
    const bx = Math.round(c + Math.cos(a) * TRACK_MID - 3)
    const by = Math.round(c + Math.sin(a) * TRACK_MID - 3)
    const lit = s.started && within(m.t, s.turn, REACH_CLEAN)
    for (let yy = 0; yy < 7; yy++) {
      for (let xx = 0; xx < 7; xx++) {
        const ch = BUG[yy][xx]
        if (ch === '.') continue
        const px = bx + xx
        const py = by + yy
        if (px < 0 || py < 0 || px >= DIAL || py >= DIAL) continue
        put((py * DIAL + px) * 4, ch === '#' ? (lit ? ink.p[3] : ink.bug) : ink.bugDark)
      }
    }
  }

  for (const p of s.sparks) {
    const px = Math.round(p.x)
    const py = Math.round(p.y)
    if (px < 0 || py < 0 || px >= DIAL || py >= DIAL || p.life < 0.2) continue
    put((py * DIAL + px) * 4, p.life > 0.6 ? ink.p[3] : ink.p[2])
  }
}
