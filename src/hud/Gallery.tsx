/**
 * The release gallery — GDD §10.11.
 *
 * §4.10e turned the back catalogue into a *rate* and that is the right readout
 * for "am I earning" and the wrong one for "what have I made". The instant a
 * project ships, the burn-down resets, the name changes, and four minutes of
 * play becomes a thin band under tomorrow's launch. This is the screen where a
 * run — and a career — acquires a history.
 *
 * Three tiers, each answering a different question:
 *
 * - **Recent** — the last releases, one row each, exact. Money, dev time and
 *   labour per project, which is where §4.14's rating finally sits next to its
 *   own neighbours as a trend rather than as a single score.
 * - **Back catalogue** — one row per title ever shipped, summed. This is the
 *   tier that survives a million ships: the count, the total money and the
 *   total labour of a title, in bounded memory (§10.11.2's own-unit rule makes
 *   the column a readout).
 * - **Career summary** — the whole thing at the top, three figures.
 *
 * A right-edge drawer, not a modal (§10.11.4, §7.1): the swarm keeps simulating
 * and the player keeps poking everywhere the panel is not. It is read-only —
 * §10.11.5 forbids the gallery from becoming a second idle game, and there is
 * deliberately no button in here that changes a release.
 */

import { getPermanent } from '../game/store.ts'
import { Panel } from '../ui/Panel.tsx'
import { Button } from '../ui/Button.tsx'
import { Cover } from './Cover.tsx'
import { coverFor } from '../sim/cover.ts'
import {
  aggregateRating,
  type History,
  type ReleaseRecord,
  type TitleAggregate,
} from '../sim/history.ts'
import { formatBuildTime, formatLabour } from '../sim/labour.ts'
import { formatMoney } from './hudModel.ts'
import { RATING_WEIGHTS } from '../sim/rating.ts'

import '../styles/gallery.css'

/**
 * §10.11.1's rating — the ten-cell block bar §7.8.8's card already spends, not
 * a star rating and not a percentage with a ring.
 */
function Rating({ rating }: { rating: number }) {
  const lit = Math.max(0, Math.min(10, Math.round(rating / 10)))
  return (
    <span className="gallery__rating">
      <span className="gallery__rating-bar" aria-hidden="true">
        {'##########'.slice(0, lit).padEnd(10, '.')}
      </span>
      <span className="gallery__rating-num">{Math.round(rating)}/100</span>
    </span>
  )
}

/** A single shipped release — §10.11.1's card. */
function ReleaseRow({ record }: { record: ReleaseRecord }) {
  const spec = coverFor(record.seed, record.ordinal, record.rating, record.name)
  return (
    <div className="gallery__row">
      <Cover spec={spec} />
      <div className="gallery__info">
        <p className="gallery__name">{record.name}</p>
        <p className="gallery__ordinal">#{record.ordinal + 1}</p>
        <Rating rating={record.rating} />
        {(record.heroCoverage ?? 0) > 0 && (
          <p className="gallery__line">
            HERO COVERAGE <b>{Math.round((record.heroCoverage ?? 0) * 100)}%</b>
            {' · '}+{Math.round((record.heroCoverage ?? 0) * RATING_WEIGHTS.heroes * 100)} RATING
          </p>
        )}
        <p className="gallery__line">
          REVENUE <b>{formatMoney(record.payout)}</b>
        </p>
        <p className="gallery__line">
          DEV TIME <b>{formatBuildTime(record.buildSeconds)}</b>
        </p>
        <p className="gallery__line">
          LABOUR <b>{formatLabour(record.labourSeconds)}</b>
        </p>
      </div>
    </div>
  )
}

/** Every release of one title folded together — the tier that scales. */
function AggregateRow({ aggregate }: { aggregate: TitleAggregate }) {
  const rating = aggregateRating(aggregate)
  const spec = coverFor(aggregate.seed, aggregate.lastOrdinal, rating, aggregate.name)
  return (
    <div className="gallery__row">
      <Cover spec={spec} />
      <div className="gallery__info">
        <p className="gallery__name">{aggregate.name}</p>
        <p className="gallery__ordinal">×{aggregate.count} shipped</p>
        <Rating rating={rating} />
        <p className="gallery__line">
          REVENUE <b>{formatMoney(aggregate.payoutSum)}</b>
        </p>
        <p className="gallery__line">
          LABOUR <b>{formatLabour(aggregate.labourSecondsSum)}</b>
        </p>
      </div>
    </div>
  )
}

/** The career in three figures, for the top of the drawer. */
function career(history: History): { count: number; revenue: number; labour: number } {
  let count = history.recent.length
  let revenue = 0
  let labour = 0
  for (const r of history.recent) {
    revenue += r.payout
    labour += r.labourSeconds
  }
  for (const a of history.aggregates) {
    count += a.count
    revenue += a.payoutSum
    labour += a.labourSecondsSum
  }
  return { count, revenue, labour }
}

export function Gallery({ open, onClose }: { open: boolean; onClose: () => void }) {
  const history = getPermanent().meta.history
  const recent = [...history.recent].reverse()
  const aggregates = [...history.aggregates].sort((a, b) => b.lastOrdinal - a.lastOrdinal)
  const total = career(history)

  return (
    <Panel open={open} from="right" className="hud__gallery">
      <div className="gallery">
        <div className="gallery__head">
          <h2 className="gallery__title">GALLERY</h2>
          <p className="gallery__summary">
            <b>{total.count}</b> {total.count === 1 ? 'TITLE' : 'TITLES'} ·{' '}
            <b>{formatMoney(total.revenue)}</b> · <b>{formatLabour(total.labour)}</b>
          </p>
        </div>

        <div className="gallery__scroll">
          {recent.length > 0 && <h3 className="gallery__section">RECENT</h3>}
          {recent.map((r) => (
            <ReleaseRow key={r.ordinal} record={r} />
          ))}
          {aggregates.length > 0 && <h3 className="gallery__section">BACK CATALOGUE</h3>}
          {aggregates.map((a) => (
            <AggregateRow key={a.name} aggregate={a} />
          ))}
          {recent.length === 0 && aggregates.length === 0 && (
            <p className="gallery__empty">Nothing shipped yet.</p>
          )}
        </div>

        <div className="gallery__footer">
          <Button onClick={onClose}>BACK</Button>
        </div>
      </div>
    </Panel>
  )
}
