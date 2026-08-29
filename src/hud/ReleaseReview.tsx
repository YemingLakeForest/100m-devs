/**
 * The reception — GDD §10.8b, and the beat that replaced §10.8a's cheque.
 *
 * ## What changed, and why it is written down here
 *
 * §10.8a specified four beats and made the fourth one load-bearing: *"the
 * money, in green, large, counting up — what it was worth. This is the one the
 * player must not be able to miss, and it is why the toast exists rather than a
 * line of terminal text."* That figure is **gone** [amended 2026-08-29], on the
 * user's instruction, and the section has been amended to match.
 *
 * The argument for taking it out is better than the argument that put it in.
 * §4.10e already made the payout a *rate* rather than a lump — the money does
 * not arrive at the launch, it arrives over the following four minutes — so a
 * large green number at the moment of release was announcing an event that had
 * not happened. Worse, it made every release the same beat: the figure only
 * ever goes up, so the celebration could not tell the player whether the thing
 * they had just made was any good. §4.14 spent a whole section building the one
 * number in this game that *can* go down, and it was on a wall in another room.
 *
 * So the reel is about reception, and it runs in §10.8a's own summary-screen
 * vocabulary with the subject changed:
 *
 *  1. **The launch flash** — full-frame, two or three frames. Unchanged.
 *  2. **The cover, stamped in** — §10.11.3's tile, read back from the history
 *     record written on the same frame, so it is exactly the cover the gallery
 *     will show.
 *  3. **The launch date**, if the player picked one — §10.8b's band, and the
 *     only place their aim is ever reported back to them.
 *  4. **Three critics, one at a time** — §10.8a, "rows reveal one at a time".
 *  5. **The aggregate, last** — §10.8a, "the total counts last", so it reads as
 *     a summation rather than a lookup. It is §4.14's rating, unchanged.
 *  6. **The verdict**, stamped, with sparks on the good bands only.
 *
 * The cash readout in the corner still moves through all of this, and that is
 * where the money now lives — one place instead of two.
 */

import { useEffect, useState } from 'react'
import { Counter } from './Counter.tsx'
import { motionMs, useReducedMotion } from '../ui/motion.ts'
import { playSfx } from '../audio/sfx.ts'
import { playUi } from '../ui/uiSfx.ts'
import { getState, type GameState } from '../game/store.ts'
import { coverFor } from '../sim/cover.ts'
import { Cover } from './Cover.tsx'
import { RATING_WEIGHTS, ratingBand } from '../sim/rating.ts'
import { reviewsFor, verdictFor } from '../sim/reviews.ts'

import '../styles/release.css'

/**
 * The reel, in milliseconds from the launch flash.
 *
 * One table rather than six constants, because the whole design is the
 * *order* and the gaps: quotes on a 120 ms stagger read as three opinions
 * arriving, the same three at 0 ms read as a paragraph. Scaled together under
 * reduce-motion (§10.5 rule 3) so a shortened reel is still this reel.
 *
 * The total exceeds §10.8 F6's 400 ms ceiling, which F6 exempts by name for "a
 * deliberately scored beat". It is also under the ~6 s the top of §4.10c's
 * ladder takes to build the next project, which is the real budget.
 */
const REVIEW_BEATS = {
  timing: 260,
  quotes: 420,
  /** Between one critic and the next. */
  quoteStagger: 120,
  score: 1_000,
  verdict: 1_560,
  /** The whole thing, including the hold on the verdict. */
  total: 3_400,
} as const

/** How many sparks the verdict throws, on bands 2 and 3 only. */
const SPARKS = 8

export function ReleaseReview({ state }: { state: GameState }) {
  const reduced = useReducedMotion()
  const ship = state.ship
  const [shownId, setShownId] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  /**
   * The aggregate's target. It starts at zero and is moved to the rating one
   * beat later, which is the only way `Counter` can *roll*: `useSpring`
   * initialises at its target, so a counter mounted holding the answer has
   * already arrived. §10.8a — "counters roll, never set".
   */
  const [score, setScore] = useState(0)

  // Latched by id, the same pattern the action bar uses: the store keeps the
  // event around, so without an id the reel would replay on every render.
  const [held, setHeld] = useState(ship)
  if (ship && ship.id !== shownId) {
    setShownId(ship.id)
    setHeld(ship)
    setOpen(true)
    setScore(0)
  }

  const ms = (n: number) => motionMs(n, reduced)

  useEffect(() => {
    if (!open) return
    // F3 — a state change this large makes a noise. The crit chime is already
    // the game's "something good just landed" sound, so a launch borrows it
    // rather than introducing a second vocabulary for the same feeling.
    playSfx('poke-crit')
    const timers = [
      // §10.8 F3 — **the release is a cue, not a clink.** One noise for the
      // largest event in the loop would be the same mistake §10.8a's summary
      // screens are written against: a beat with four movements and one sound
      // reads as a still image with a chime over it. So the reel is *scored*
      // out of the bank that already exists — a tick under each critic as they
      // land, a rising note as the total starts counting, and the lock when the
      // verdict stamps. Nothing new to generate, and the rhythm is the point.
      ...[0, 1, 2].map((i) =>
        setTimeout(
          () => playUi('tick'),
          ms(REVIEW_BEATS.quotes + i * REVIEW_BEATS.quoteStagger),
        ),
      ),
      setTimeout(() => playUi('whoosh'), ms(REVIEW_BEATS.score)),
      // The aggregate, one frame after its block mounts. See `score` above.
      setTimeout(() => setScore(held?.rating ?? 0), ms(REVIEW_BEATS.score) + 60),
      // The verdict lands on its own sound rather than on the tail of the
      // launch chime: §10.8a's summary screens put the total *after* the rows,
      // and a total nobody hears arrive is a total that was always there.
      setTimeout(() => playSfx('entropy-lock'), ms(REVIEW_BEATS.verdict)),
      setTimeout(() => setOpen(false), ms(REVIEW_BEATS.total)),
    ]
    return () => timers.forEach(clearTimeout)
    // `held` is latched with `open`, so it cannot change while this is running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shownId, reduced])

  if (!held) return null

  // §10.11 — the cover of the thing that just shipped. The history record is
  // written on the same frame the ship event is published, and a new release is
  // always the last entry in the recent window, so this reads the same seed,
  // ordinal and rating the gallery will render from. If a ship arrived without
  // a record — a test seam, or a save from before history existed — there is
  // simply no cover, and the rest of the beat plays on.
  const history = getState().history
  const record = history.recent[history.recent.length - 1]
  const cover =
    record && record.name === held.name
      ? coverFor(record.seed, record.ordinal, record.rating, record.name)
      : null

  const reviews = reviewsFor(record?.seed ?? 0, held.ordinal, held.rating)
  const band = ratingBand(held.rating)
  const heroCoverage = record?.heroCoverage ?? 0

  return (
    <>
      {/* Keyed on the ship so the flash replays on the next one rather than
          staying on: the flash is a single CSS animation, and remounting is
          how it re-fires without a timer to reset. */}
      <div key={`flash-${held.id}`} className="ship-flash" aria-hidden="true" />
      <div key={`reel-${held.id}`} className="review" data-open={open ? 'true' : 'false'} aria-live="polite">
        {/*
          A plate, not floating text. The reel sits over the middle of the frame
          and §4.15's rails own the sides, so at 640 px the two meet — and eleven
          words of review copy over a live cash readout is two illegible things
          instead of one. The card is what lets the beat keep the centre of the
          screen without taking the interface with it.
        */}
        <div className="review__card">
        {cover && <Cover spec={cover} />}
        <p className="review__name">{held.name}</p>

        {/* §10.8b — the player's own aim, reported back. Absent for a release
            that went out on the train, because there was no bar to miss. */}
        {held.timingLabel && (
          <p
            className="review__timing"
            data-good={held.timing > 1 ? 'true' : 'false'}
            style={{ '--in': `${ms(REVIEW_BEATS.timing)}ms` } as React.CSSProperties}
          >
            {held.timingLabel} · ×{held.timing.toFixed(2)}
          </p>
        )}

        {heroCoverage > 0 && (
          <p
            className="review__timing"
            style={{ '--in': `${ms(REVIEW_BEATS.timing + 80)}ms` } as React.CSSProperties}
          >
            HERO COVERAGE {Math.round(heroCoverage * 100)}% · +
            {Math.round(heroCoverage * RATING_WEIGHTS.heroes * 100)} RATING
          </p>
        )}

        <ul className="review__quotes">
          {reviews.map((r, i) => (
            <li
              key={r.outlet}
              className="review__quote"
              style={{ '--in': `${ms(REVIEW_BEATS.quotes + i * REVIEW_BEATS.quoteStagger)}ms` } as React.CSSProperties}
            >
              {/* Two rows, always. Left to wrap, a short quote sat on one line
                  and a long one on two, so three reviews arrived in three
                  different shapes — which reads as a layout accident rather
                  than as a column of pull quotes. */}
              <span className="review__by">
                <span className="review__outlet">{r.outlet}</span>
                <span className="review__score">{r.score}/10</span>
              </span>
              <span className="review__line">“{r.quote}”</span>
            </li>
          ))}
        </ul>

        <div
          className="review__score-block"
          style={{ '--in': `${ms(REVIEW_BEATS.score)}ms` } as React.CSSProperties}
        >
          <Counter
            className="review__aggregate"
            value={score}
            format={(n) => `${Math.round(n)}/100`}
            bounce
          />
          <div className="review__bar">
            <span
              style={
                {
                  '--fill': `${Math.max(0, Math.min(100, held.rating))}%`,
                  '--in': `${ms(REVIEW_BEATS.score)}ms`,
                } as React.CSSProperties
              }
            />
          </div>
        </div>

        {/* The sparks are a *sibling* of the word, not a child of it: the
            verdict is stamped with a scale overshoot, and a burst nested
            inside it would be scaled by the same transform — a firework that
            shrinks as it flies. */}
        <div className="review__stamp">
          {band >= 2 && (
            <span className="review__sparks" aria-hidden="true">
              {Array.from({ length: SPARKS }, (_, i) => {
                // A ring, not a scatter: eight evenly spaced sparks read as a
                // burst, and eight random ones read as dirt on the screen.
                const angle = (i / SPARKS) * Math.PI * 2
                return (
                  <span
                    key={i}
                    className="review__spark"
                    style={
                      {
                        '--dx': `${Math.cos(angle) * 54}px`,
                        '--dy': `${Math.sin(angle) * 34}px`,
                        '--in': `${ms(REVIEW_BEATS.verdict + i * 18)}ms`,
                      } as React.CSSProperties
                    }
                  />
                )
              })}
            </span>
          )}
          <p
            className="review__verdict"
            data-band={band}
            style={{ '--in': `${ms(REVIEW_BEATS.verdict)}ms` } as React.CSSProperties}
          >
            {verdictFor(held.rating)}
          </p>
        </div>
        </div>
      </div>
    </>
  )
}
