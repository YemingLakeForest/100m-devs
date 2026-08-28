/**
 * The release gallery — GDD §10.11, as a wall you slide through.
 *
 * §4.10e turned the back catalogue into a *rate*, which is the right readout
 * for "am I earning" and the wrong one for "what have I made". The instant a
 * project ships the burn-down resets, the name changes, and four minutes of
 * play becomes a thin band under tomorrow's launch. This is the screen where a
 * run — and a career — acquires a history, and §10.11.3 is explicit about the
 * form it takes: **a wall of covers that reads as a quality history before a
 * single number has been read.**
 *
 * ## Why a slide-through and not a list
 *
 * A table of releases is a spreadsheet about your own work, and §10.11.5 is a
 * list of things this screen must never become — every one of them is a way of
 * turning a record into an accounting screen. The covers are the point:
 * §10.11.3 generates one per release, tints its frame by §4.14's band, and the
 * whole design of that system is wasted at 48 px in a column.
 *
 * So the wall is a **carousel with one cover in focus**, the neighbours turned
 * away in perspective, and everything the focused release is worth written
 * underneath it. Scrolling back through a career is the reward the section is
 * for: you slide past a wall of your own games, each one a different shape,
 * with the good ones framed in gold and cyan and the shovelware in grey.
 *
 * ## Revenue is what arrived, and nothing else
 *
 * §10.11.1 fixes the wording and the code had drifted from it: *"Revenue —
 * total handed over so far, and the live rate beside it. A release whose tail
 * has been paid out reads `RETIRED` where the rate was."*
 *
 * There is deliberately **no figure for what a release is going to be worth**.
 * A payout the player has not been paid is a promise, and a screen that quotes
 * one is a screen that can be wrong — it is the same class of lie §4.10e was
 * written to stop the economy telling. What is shown is money in the bank and
 * the speed it is still arriving at.
 *
 * ## And the rating is where the money came from
 *
 * §4.14: "§4.10e's payout scales with the rating." That is the whole reason the
 * score exists, and until now the two facts sat on the same card without ever
 * being connected. The focused release prints its score **and the multiplier
 * that score put on its ladder payout** — `62/100 → ×1.24 ON REVENUE` — with
 * the six inputs that made it broken out underneath. A player looking at a poor
 * game can see exactly what it cost them, which is the only way a rating stops
 * being decoration.
 *
 * A full-screen sheet rather than a 360 px drawer (§10.11.4): the swarm keeps
 * simulating behind it and the panel is not modal. It is read-only — there is
 * deliberately no button in here that changes a release.
 *
 * §10.6a — the masthead and the way out are the STUDIO_OS window's now, and the
 * transport sits in its foot. What is left in here is the ledger, the wall and
 * the receipt, which were always the only three things on the screen.
 */

import { useEffect, useState } from 'react'
import { getState, subscribe } from '../game/store.ts'
import { OsWindow } from '../ui/OsWindow.tsx'
import { Cover } from './Cover.tsx'
import { coverFor } from '../sim/cover.ts'
import { aggregateRating, type History, type ReleaseRecord } from '../sim/history.ts'
import { formatBuildTime, formatLabour } from '../sim/labour.ts'
import { formatMoney } from './hudModel.ts'
import { earningRate, outstandingByOrdinal, type Release } from '../sim/revenue.ts'
import { BASELINE_RATING, ratingBreakdown, revenueMultiplier } from '../sim/rating.ts'
import { GARAGE_SYNC } from '../sim/teamSync.ts'
import { formatRate } from './revenueModel.ts'

import '../styles/gallery.css'

/**
 * How often the money on screen is re-read, in ms.
 *
 * **Not a store subscription.** The store publishes at 60 Hz and this screen is
 * a wall of covers under perspective transforms; re-rendering all of it every
 * frame to move a dollar figure is a frame budget spent on a number nobody can
 * read that fast. Six times a second is past the rate a person perceives as
 * "counting up" and is an order of magnitude cheaper.
 */
const REFRESH_MS = 160

/** How far a neighbouring cover sits from the focused one, in px. */
const FOCUS_GAP = 132
/** And from each other, beyond the first. */
const SIDE_STEP = 46
/** Past this many either side, the covers stop moving and simply stack. */
const DEPTH = 7

/** One thing on the wall — a release, or a whole title folded into one. */
interface Slide {
  key: string
  name: string
  rating: number
  seed: number
  ordinal: number
  run: number
  /** Money that has actually arrived, in dollars. */
  earned: number
  /** Dollars a second it is bringing in right now. Zero once the tail is done. */
  rate: number
  buildSeconds: number
  labourSeconds: number
  /** 1 for a single release, N for a folded title. */
  count: number
  /** Present only for a single release — the aggregates do not keep a breakdown. */
  record?: ReleaseRecord
}

interface Live {
  history: History
  slides: Slide[]
  career: { count: number; earned: number; labour: number; ratingSum: number }
}

function readLive(): Live {
  // §10.11 — run state since 2026-08-27: the gallery is the catalogue this
  // studio is selling, and a Paradigm Shift liquidates it with everything else.
  const history = getState().history
  const releases = getState().releases
  const outstanding = outstandingByOrdinal(releases)
  const byOrdinal = new Map<number, Release>()
  for (const r of releases) if (r.ordinal >= 0) byOrdinal.set(r.ordinal, r)

  const slides: Slide[] = []
  let count = 0
  let earned = 0
  let labour = 0
  let ratingSum = 0

  // Newest first — a career is read backwards from what you just shipped.
  for (const r of [...history.recent].reverse()) {
    const paid = Math.max(0, r.payout - (outstanding.get(r.ordinal) ?? 0))
    const live = byOrdinal.get(r.ordinal)
    slides.push({
      key: `r${r.ordinal}`,
      name: r.name,
      rating: r.rating,
      seed: r.seed,
      ordinal: r.ordinal,
      run: r.run,
      earned: paid,
      rate: live ? earningRate(live) : 0,
      buildSeconds: r.buildSeconds,
      labourSeconds: r.labourSeconds,
      count: 1,
      record: r,
    })
    count += 1
    earned += paid
    labour += r.labourSeconds
    ratingSum += r.rating
  }

  for (const a of [...history.aggregates].sort((x, y) => y.lastOrdinal - x.lastOrdinal)) {
    const owed = outstanding.get(a.lastOrdinal) ?? 0
    const paid = Math.max(0, a.payoutSum - owed)
    const live = byOrdinal.get(a.lastOrdinal)
    slides.push({
      key: `a${a.name}`,
      name: a.name,
      rating: aggregateRating(a),
      seed: a.seed,
      ordinal: a.lastOrdinal,
      run: a.lastRun,
      earned: paid,
      rate: live ? earningRate(live) : 0,
      buildSeconds: a.buildSecondsSum,
      labourSeconds: a.labourSecondsSum,
      count: a.count,
    })
    count += a.count
    earned += paid
    labour += a.labourSecondsSum
    ratingSum += a.ratingSum
  }

  return { history, slides, career: { count, earned, labour, ratingSum } }
}

/**
 * Re-read the catalogue on a clock, and **read it during render**.
 *
 * The state here is a bare counter rather than the data. Holding the snapshot
 * in state would mean the screen paints whatever the last interval left behind
 * — which, on a panel closed and reopened minutes later, is a lifetime revenue
 * figure from the previous session of looking at it.
 */
function useLiveCatalogue(open: boolean, onShip: () => void): Live {
  const [, bump] = useState(0)

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => bump((n) => n + 1), REFRESH_MS)
    // A ship is a step change rather than a drift, so it jumps the queue rather
    // than waiting for the interval — the cover appears on the same frame the
    // toast fires.
    let known = getState().releases.length
    const stop = subscribe(() => {
      const n = getState().releases.length
      if (n === known) return
      known = n
      onShip()
      bump((v) => v + 1)
    })
    return () => {
      clearInterval(id)
      stop()
    }
  }, [open, onShip])

  return readLive()
}

/**
 * §10.11.1's rating — the ten-cell block bar §7.8.8's card already spends, not
 * a star rating and not a percentage with a ring.
 */
function RatingBar({ rating }: { rating: number }) {
  const lit = Math.max(0, Math.min(10, Math.round(rating / 10)))
  return (
    <span className="gallery__rating-bar" aria-hidden="true">
      {'##########'.slice(0, lit).padEnd(10, '.')}
    </span>
  )
}

/** The six inputs §4.14 scored this release on, in a fixed order. */
const BREAKDOWN_ORDER = ['defects', 'heroes', 'sync', 'luck', 'craft', 'traits'] as const

const BREAKDOWN_LABEL: Record<(typeof BREAKDOWN_ORDER)[number], string> = {
  defects: 'DEFECTS',
  heroes: 'HEROES',
  sync: 'TEAM SYNC',
  luck: 'RECEPTION',
  craft: 'CRAFT',
  traits: 'TRAITS',
}

function breakdownOf(record: ReleaseRecord): Record<(typeof BREAKDOWN_ORDER)[number], number> {
  const parts = ratingBreakdown({
    // The record keeps the *inputs* for the three added terms and only the
    // *score* for §4.14's original three, so the defect term is recovered as
    // the remainder rather than re-derived. Inventing a defect density to draw
    // it with would be a chart about a game that was never built.
    defects: 0,
    storyPoints: 1,
    heroCoverage: record.heroCoverage ?? 0,
    craft: 1,
    sync: record.sync ?? GARAGE_SYNC,
    traits: record.traits ?? 0,
    luck: record.luck ?? 0.5,
  })
  const known = parts.heroes + parts.sync + parts.luck + parts.traits + parts.craft
  return { ...parts, defects: Math.max(0, record.rating - known) }
}

/**
 * The card under the wall — everything the focused release is worth.
 *
 * The order is the argument: what it is, what it scored, **what that score did
 * to the money**, and then the money. A revenue figure printed above its own
 * cause is a number the player reads as arbitrary.
 */
function Focused({ slide, laurels }: { slide: Slide; laurels: readonly string[] }) {
  const parts = slide.record ? breakdownOf(slide.record) : null
  const multiplier = revenueMultiplier(slide.rating)
  /*
   * Three states, not two.
   *
   * §4.10e's tail approaches its asymptote long before the release retires, so
   * there is a stretch — minutes of it, on an old game — where the rate is
   * genuinely above zero and `formatRate` prints `$0.0/s`. That is a true
   * number that reads as a broken one. A release in that state is still on
   * sale and is no longer worth quoting a rate for, so it says exactly that.
   */
  const state = slide.rate >= 0.05 ? 'earning' : slide.rate > 0 ? 'trickle' : 'retired'

  return (
    /*
      §10.6a — the window's rail measures *this*, not the whole body: the wall
      above must not scroll (it is a carousel, and a shelf that scrolls is two
      gestures fighting), and the receipt is the one thing in the gallery that
      genuinely runs past its box. On the wide layout it used to be clipped
      outright.
    */
    <div className="gallery__now" data-os-scroll>
      <div className="gallery__now-head">
        <h3 className="gallery__now-name">
          {/* The title in its own element, so the laurels beside it are not
              part of the release's name to anything reading the heading. */}
          <span className="gallery__now-title">{slide.name}</span>
          {/*
            §10.11.5 forbids a leaderboard and this is not one — there is no
            ranking and nobody to beat. It is the studio noticing its own best
            work, which is the whole reason to slide back through a career.
          */}
          {laurels.map((laurel) => (
            <span key={laurel} className="gallery__laurel">
              {laurel}
            </span>
          ))}
        </h3>
        <p className="gallery__now-meta">
          {slide.count > 1 ? `×${slide.count} shipped` : `#${slide.ordinal + 1}`}
          {' · RUN '}
          {slide.run + 1}
          {' · BUILT IN '}
          {formatBuildTime(slide.buildSeconds)}
          {' · '}
          {formatLabour(slide.labourSeconds)}
        </p>
      </div>

      {/*
        §4.14 and §4.10e, on one line, because they are one fact. The score is
        the cause and the multiplier is what it did — a rating printed without
        its consequence is the decoration §4.14 exists not to be.
      */}
      <div className="gallery__verdict">
        <span className="gallery__score" data-band={slide.rating >= BASELINE_RATING ? 'up' : 'down'}>
          {Math.round(slide.rating)}
          <em>/100</em>
        </span>
        <RatingBar rating={slide.rating} />
        <span
          className="gallery__mult"
          data-band={multiplier >= 1 ? 'up' : 'down'}
          title="what this score did to §4.10c's ladder payout"
        >
          ×{multiplier.toFixed(2)} ON REVENUE
        </span>
      </div>

      {parts && (
        <ul className="gallery__breakdown">
          {BREAKDOWN_ORDER.map((key) => (
            <li key={key} className="gallery__part">
              <span className="gallery__slice" data-part={key} aria-hidden="true" />
              <span className="gallery__part-name">{BREAKDOWN_LABEL[key]}</span>
              <span className="gallery__part-value">+{Math.round(parts[key])}</span>
            </li>
          ))}
        </ul>
      )}

      {/*
        §10.11.1, word for word: total handed over so far, and the live rate
        beside it. Nothing here is a forecast.
      */}
      <p className="gallery__money">
        <span className="gallery__money-label">LIFETIME REVENUE</span>
        <b>{formatMoney(slide.earned)}</b>
        {state === 'earning' && (
          <span className="gallery__earning">{formatRate(slide.rate)}, still earning</span>
        )}
        {state === 'trickle' && <span className="gallery__retired">STILL ON SALE</span>}
        {state === 'retired' && <span className="gallery__retired">RETIRED</span>}
      </p>
    </div>
  )
}

export function Gallery({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [focus, setFocus] = useState(0)
  const live = useLiveCatalogue(
    open,
    /*
     * A ship prepends a cover, and what happens to the focus depends entirely
     * on where the player already was.
     *
     * **At the front, follow it; anywhere else, hold still.** The wall is
     * newest-first, so every release shifts one place right when a new one
     * lands — a focus left alone would silently start pointing at a different
     * game. Incrementing keeps the player looking at the release they chose,
     * which matters most in exactly the case this is easiest to get wrong: a
     * studio shipping every few seconds while somebody reads their back
     * catalogue. Snapping to the newest every time would make the screen
     * unusable at speed, and it was doing that.
     */
    () => setFocus((i) => (i === 0 ? 0 : i + 1)),
  )
  const slides = live.slides
  const at = Math.min(focus, Math.max(0, slides.length - 1))
  const current = slides[at]

  // The two things worth being told about your own catalogue. Recomputed each
  // render rather than cached: it is two passes over a list bounded by
  // RECENT_KEEP plus the title ladder, and a stale laurel is worse than none.
  let bestRated = current
  let bestEarner = current
  for (const slide of slides) {
    if (slide.rating > (bestRated?.rating ?? -1)) bestRated = slide
    if (slide.earned > (bestEarner?.earned ?? -1)) bestEarner = slide
  }
  const laurels: string[] = []
  if (current && slides.length > 1) {
    if (bestRated?.key === current.key) laurels.push('BEST REVIEWED')
    if (bestEarner?.key === current.key) laurels.push('BIGGEST EARNER')
  }
  const total = live.career
  const average = total.count > 0 ? total.ratingSum / total.count : BASELINE_RATING

  // The wall is a listbox, so the arrow keys have to work on it — and sliding
  // a career with a fingertip on the arrows is the whole gesture the screen is
  // built around.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setFocus((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setFocus((i) => Math.min(slides.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, slides.length])

  return (
    <OsWindow
      open={open}
      from="right"
      className="hud__gallery"
      bodyClassName="os-window__body--flush"
      title="GALLERY"
      meta="RELEASE LEDGER // ALL RUNS"
      onClose={onClose}
      footer={
        slides.length > 1 ? (
          <div className="gallery__nav">
            <button
              type="button"
              className="gallery__arrow"
              onClick={() => setFocus((i) => Math.max(0, i - 1))}
              disabled={at === 0}
              aria-label="Newer release"
            >
              ◀
            </button>
            <span className="gallery__count">
              {at + 1} / {slides.length}
            </span>
            <button
              type="button"
              className="gallery__arrow"
              onClick={() => setFocus((i) => Math.min(slides.length - 1, i + 1))}
              disabled={at === slides.length - 1}
              aria-label="Older release"
            >
              ▶
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="gallery">
        <div className="gallery__head">
          {/*
            The career in four figures. `LIFETIME REVENUE` counts money that has
            arrived, so it moves while the screen is open — and there is no
            fifth figure for money that has not, on the same rule the cards
            follow.
          */}
          <dl className="gallery__ledger">
            <div>
              <dt>TITLES</dt>
              <dd>{total.count}</dd>
            </div>
            <div className="gallery__ledger-wide">
              <dt>LIFETIME REVENUE</dt>
              <dd>{formatMoney(total.earned)}</dd>
            </div>
            <div>
              <dt>MEAN RATING</dt>
              <dd>{Math.round(average)}/100</dd>
            </div>
            <div>
              <dt>LABOUR</dt>
              <dd>{formatLabour(total.labour)}</dd>
            </div>
          </dl>
        </div>

        {slides.length === 0 ? (
          <p className="gallery__empty">Nothing shipped yet.</p>
        ) : (
          <div className="gallery__flow" role="listbox" aria-label="Shipped games">
            {slides.map((slide, i) => {
              const d = i - at
              const near = Math.min(Math.abs(d), DEPTH)
              const dir = Math.sign(d)
              const x = d === 0 ? 0 : dir * (FOCUS_GAP + (near - 1) * SIDE_STEP)
              return (
                <button
                  key={slide.key}
                  type="button"
                  className="gallery__slide"
                  role="option"
                  aria-selected={d === 0}
                  data-focused={d === 0 ? 'true' : 'false'}
                  onClick={() => setFocus(i)}
                  style={{
                    // The iTunes trick, and it is only three numbers: step
                    // sideways, turn away from the viewer, and fall back. The
                    // covers past DEPTH stop moving and stack, so a career of a
                    // thousand games costs the same layout as a career of ten.
                    transform: `translateX(calc(-50% + ${x}px)) rotateY(${
                      d === 0 ? 0 : dir * -52
                    }deg) scale(${d === 0 ? 1 : 0.74})`,
                    zIndex: DEPTH + 1 - near,
                    opacity: d === 0 ? 1 : Math.max(0.14, 1 - near * 0.17),
                  }}
                  title={slide.name}
                >
                  <span className="gallery__art">
                    <Cover spec={coverFor(slide.seed, slide.ordinal, slide.rating, slide.name)} />
                  </span>
                  {/* The reflection, which is what makes a row of tiles read as
                      a shelf. Masked rather than faded, so it never becomes a
                      second, dimmer cover competing with the first. */}
                  <span className="gallery__reflect" aria-hidden="true">
                    <Cover spec={coverFor(slide.seed, slide.ordinal, slide.rating, slide.name)} />
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/*
          The receipt scrolls and the wall above it does not — §10.11.2's
          breakdown is six rows on a phone and the covers are the screen. The
          rail down the window's edge is measuring this, which is the one place
          in the gallery there is genuinely more below.
        */}
        {current && <Focused slide={current} laurels={laurels} />}
      </div>
    </OsWindow>
  )
}
