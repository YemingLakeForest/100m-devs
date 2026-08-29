/**
 * The launch window — GDD §10.8b.
 *
 * The one screen in this game where the player is asked to be *accurate*.
 * Everything else they do is a decision about allocation — who to hire, what to
 * buy, which backlog to let rot — and none of it has a hand in it. This does:
 * a needle sweeps a market calendar and the player picks the day.
 *
 * `sim/release.ts` owns the whole model and this file owns none of it. The
 * needle's position is `markerAt` of a clock, the rings are `LAUNCH_BANDS`, and
 * the verdict is `launchHit`. That split is not tidiness — it is the only way
 * the multiplier the player is aiming at can be tested without a browser.
 *
 * ## Three things this had to get right
 *
 * 1. **The needle is driven by a clock, not by React.** A `setState` per frame
 *    on a HUD that already re-renders six times a second is a stutter on the
 *    one surface in the product where a stutter is a wrong answer rather than
 *    an ugly one. The needle is a ref and a CSS custom property written
 *    straight to the DOM inside `requestAnimationFrame`; React renders this
 *    component about four times in its whole life.
 * 2. **The press must be readable at the instant it lands.** The position is
 *    sampled from `performance.now()` in the handler rather than from whatever
 *    the last animation frame wrote, so a press is scored against where the
 *    needle *was when the finger came down* — §10.8 F2, "on down, never on up",
 *    read as a fairness rule instead of a feel one.
 * 3. **It ends by itself.** A modal that halts the studio owes the player an
 *    exit that does not need them. After three sweeps the window fires at the
 *    neutral ×1 — see `release.ts` for why that is the honest
 *    reading of an unattended launch rather than a punishment for one.
 *
 * Reduced motion slows the sweep rather than shortening it — §10.5 rule 3
 * inverted on purpose, because this is gameplay. The scale is declared in
 * `sim/release.ts` even though it is applied here, because the simulation's
 * backstop has to be sized for the longer sweep it produces.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OsWindow } from '../ui/OsWindow.tsx'
import { Button } from '../ui/Button.tsx'
import { Cover } from './Cover.tsx'
import { coverFor } from '../sim/cover.ts'
import { nextOrdinal } from '../sim/history.ts'
import { playSfx } from '../audio/sfx.ts'
import { playUi } from '../ui/uiSfx.ts'
import { useReducedMotion } from '../ui/motion.ts'
import { getState, lockRelease, releaseNow, type GameState } from '../game/store.ts'
import {
  autoLaunchMs,
  LAUNCH_BANDS,
  launchHit,
  markerAt,
  REDUCED_SWEEP_SCALE,
  type LaunchHit,
} from '../sim/release.ts'

import '../styles/release.css'

/** How long the verdict stays up after a press, before the window hands over. */
export const LOCK_HOLD_MS = 620

/**
 * The rings, unrolled into the seven segments actually drawn.
 *
 * `LAUNCH_BANDS` is a fold about the centre, because the payout is symmetric.
 * The bar is not: it runs early → late, so the outer rings appear twice with
 * different names on them. Built once at module load — it is a constant.
 */
const SEGMENTS = (() => {
  const out: { id: string; band: string; from: number; to: number; label: string }[] = []
  // Early half, outermost first: the bar reads left to right.
  for (let i = LAUNCH_BANDS.length - 1; i >= 0; i--) {
    const b = LAUNCH_BANDS[i]
    const inner = i === 0 ? 0 : LAUNCH_BANDS[i - 1].edge
    out.push({
      id: `early-${b.id}`,
      band: b.id,
      from: 0.5 - b.edge / 2,
      to: 0.5 - inner / 2,
      label: b.label.early,
    })
  }
  for (let i = 0; i < LAUNCH_BANDS.length; i++) {
    const b = LAUNCH_BANDS[i]
    const inner = i === 0 ? 0 : LAUNCH_BANDS[i - 1].edge
    out.push({
      id: `late-${b.id}`,
      band: b.id,
      from: 0.5 + inner / 2,
      to: 0.5 + b.edge / 2,
      label: b.label.late,
    })
  }
  // The two halves of the centre ring are one plate with one name on it.
  return out.filter((s) => s.to > s.from)
})()

export function ReleaseWindow({ state }: { state: GameState }) {
  const reduced = useReducedMotion()
  const shelved = state.pendingRelease

  // Latched by id, the same pattern the ship toast and the action bar use: the
  // window plays its own exit, so it has to outlive the state that raised it.
  const [shownId, setShownId] = useState<number | null>(null)
  const [held, setHeld] = useState(shelved)
  const [hit, setHit] = useState<LaunchHit | null>(null)
  if (shelved && shelved.id !== shownId) {
    setShownId(shelved.id)
    setHeld(shelved)
    // The store's verdict, not null: a window whose date is already fixed must
    // come up *showing* it. That is the honest reading of the state either way,
    // and it is what makes a re-mount during the hold — a HUD remount, a
    // fixture loaded straight into a locked shelf — resume the beat rather than
    // start the needle sweeping over a decision already made.
    setHit(shelved.hit)
  }

  const needle = useRef<HTMLDivElement | null>(null)
  // The verdict is written through a ref by the auto-fire timer as well as by
  // the press, and both have to be able to see whether the other got there
  // first. State alone cannot answer that inside a rAF callback.
  const locked = useRef(false)

  // §10.5 rule 3, inverted — `REDUCED_SWEEP_SCALE` and the reason it lives in
  // the model rather than here. The simulation's backstop is already sized for
  // this longer sweep, so slowing the needle cannot cost the player the window.
  const sweepMs = (held?.sweepMs ?? 1_000) * (reduced ? REDUCED_SWEEP_SCALE : 1)
  const openedAt = held?.openedAt ?? 0
  const deadline = autoLaunchMs(sweepMs)

  /** Where the needle is *now* — the single source of truth for both readers. */
  const positionAt = useCallback(
    (now: number) => markerAt(Math.max(0, now - openedAt), sweepMs),
    [openedAt, sweepMs],
  )

  const lock = useCallback(
    (at: number | null) => {
      if (locked.current) return
      locked.current = true
      const verdict = at === null ? null : launchHit(at)
      setHit(verdict)
      // Fixed in the store *now*, shipped after the hold. That order is what
      // keeps the simulation's backstop from replacing a date the player has
      // already picked while the beat that shows it is still playing.
      lockRelease(at)
      // F3 — the press makes a noise, and it is the *lock* sound rather than a
      // click: `entropy-lock` is already the game's "a number has been fixed"
      // cue, and this is the last frame anybody can change what the release is
      // worth. A perfect hit gets the crit chime stacked on top, which is the
      // one moment in the product two clips are deliberately layered.
      playSfx('entropy-lock')
      if (verdict?.band === 'perfect') setTimeout(() => playSfx('poke-crit'), 90)
      // The hold is what makes it a verdict rather than a transition: the
      // needle stops, the ring it stopped in lights, and *then* the studio
      // moves on. Without it the window would be gone before the eye arrived.
      setTimeout(() => releaseNow(), LOCK_HOLD_MS)
    },
    [],
  )

  // The needle. Nothing in here touches React state — see the file header.
  useEffect(() => {
    if (!held) return
    locked.current = held.hit !== null
    let raf = 0
    let lastSegment = -1

    const frame = () => {
      // Stop rather than reschedule when the shelf has cleared: §10.8b's
      // simulation-side backstop can release a build this loop is still
      // sweeping for — a tab that was hidden long enough — and a needle that
      // kept running would fire a launch at a studio that has already shipped.
      if (!getState().pendingRelease) return
      raf = requestAnimationFrame(frame)
      if (locked.current) return
      const now = performance.now()
      if (now - openedAt >= deadline) {
        lock(null)
        return
      }
      const at = positionAt(now)
      needle.current?.style.setProperty('--at', `${at * 100}%`)
      // §10.8 F3, and the reason this is worth eight lines: the bar *ticks* as
      // the needle crosses each ring, so the rhythm accelerates toward the
      // centre and slows away from it. The player can aim with their ears.
      const segment = SEGMENTS.findIndex((s) => at >= s.from && at < s.to)
      if (segment !== lastSegment) {
        lastSegment = segment
        playUi('tick', now)
      }
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [held, openedAt, deadline, positionAt, lock])

  // §10.9.4's keyboard path. SPACE is where a hand already is on a desktop, and
  // a launch button you have to aim a mouse at is a second accuracy test nobody
  // asked for.
  useEffect(() => {
    if (!shelved) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.preventDefault()
      lock(positionAt(performance.now()))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shelved, positionAt, lock])

  // §10.11.3's tile for the thing on the shelf. Rolled from the *next* ordinal,
  // which is the one `shipProject` is about to stamp into the history record —
  // so the cover the player is looking at while they aim is the same cover the
  // review reel and the gallery will show. A second roll here would be a
  // different game on the box.
  const cover = useMemo(
    () =>
      held
        ? coverFor(state.runSeed, nextOrdinal(state.history), state.reputation, held.name)
        : null,
    // Only the shelved build matters: re-rolling on a reputation that moves
    // every frame would redraw the box art while the player was aiming at it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [held],
  )

  if (!held) return null

  return (
    <OsWindow
      open={shelved !== null}
      from="centre"
      modal
      title="RELEASE"
      // The one number this window is about, per §10.6a — and it is the prize
      // rather than the clock. "SWEEP ×3" answered a question nobody was
      // asking; what the player needs in the corner is what the centre plate is
      // worth, so that aiming at it is a decision and not an instinct.
      meta={`PERFECT ×${LAUNCH_BANDS[0].multiplier.toFixed(2)}`}
      className="release-frame"
      bodyClassName="release"
      footer={
        <Button
          className="release__go"
          // The whole surface is the button as far as a thumb is concerned —
          // see `.release__catch` — and this is the label that says so.
          onClick={() => lock(positionAt(performance.now()))}
          disabled={hit !== null}
        >
          {/* Not the band again — it is already the largest thing on the
              screen. A control that repeats the headline is a control with
              nothing to say; this one confirms that the press landed. */}
          {hit ? 'LAUNCHED' : 'RELEASE'}
        </Button>
      }
    >
      {/*
        The tap target is the body, not the button. §23.4.2 is landscape on a
        handset and an accuracy test that asks a thumb to travel to a footer is
        an accuracy test about travel time. The button stays because §10.8 F4
        wants a named control, and both fire the same `lock`.
      */}
      <div
        className="release__catch"
        onPointerDown={() => lock(positionAt(performance.now()))}
        data-locked={hit ? 'true' : 'false'}
      >
        <div className="release__shelf">
          {cover && <Cover spec={cover} />}
          <div className="release__id">
            <p className="release__kicker">GOLD MASTER</p>
            <p className="release__name">{held.name}</p>
          </div>
        </div>

        <div className="release__track" data-locked={hit ? 'true' : 'false'}>
          {SEGMENTS.map((s) => (
            <span
              key={s.id}
              className="release__zone"
              data-band={s.band}
              data-hit={hit && hit.label === s.label ? 'true' : 'false'}
              style={{ left: `${s.from * 100}%`, width: `${(s.to - s.from) * 100}%` }}
            />
          ))}
          <div
            className="release__needle"
            ref={needle}
            style={{ '--at': '50%' } as React.CSSProperties}
            data-locked={hit ? 'true' : 'false'}
          />
          <span className="release__end release__end--early">TOO EARLY</span>
          <span className="release__end release__end--late">TOO LATE</span>
        </div>

        {/*
          One line, and it changes exactly once. Before the press it is an
          instruction; after it, it is the verdict — same lane, same size, so
          the eye that was reading the instruction is already looking at the
          answer. §10.8a's "filled selection": the verdict is a *shape* change.
        */}
        <p className="release__verdict" data-band={hit?.band ?? 'none'} data-locked={hit ? 'true' : 'false'}>
          {hit ? hit.label : 'PICK THE RELEASE DATE'}
        </p>
        {hit && <p className="release__mult">×{hit.multiplier.toFixed(2)} ON REVENUE</p>}
      </div>
    </OsWindow>
  )
}
