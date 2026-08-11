/**
 * The Overnight Build Report — GDD §24.8, MONETISATION §4 R1.
 *
 * The first thing a returning player sees, and the single highest-value
 * placement in the game: one impression per session, at peak intent, on a
 * player who has just been handed something. §24.8's rules are followed
 * literally, and the three that are easiest to erode are called out where they
 * are implemented rather than only in the spec.
 *
 * `overnightModel.ts` decides what it says; this decides how it arrives.
 */

import { useEffect, useState } from 'react'
import { Panel } from '../ui/Panel.tsx'
import { Button } from '../ui/Button.tsx'
import { motionMs, useReducedMotion } from '../ui/motion.ts'
import { Counter } from './Counter.tsx'
import type { OfflineReport } from '../sim/offline.ts'
import {
  doubleLabel,
  idleLine,
  reportRows,
  rowDelay,
  totalDelay,
} from './overnightModel.ts'
import { ConceptText } from '../ui/ConceptText.tsx'
import { Kw } from './Kw.tsx'

export interface OvernightReportProps {
  report: OfflineReport
  /**
   * Is a rewarded ad actually filled and ready *right now*?
   *
   * §24.8: "If it is not filled, the 2× button is **absent**, not greyed — a
   * dead button is a broken promise, and this is the one placement per session
   * at peak intent." So this is a boolean about the ad network's real state,
   * never an optimistic guess, and the caller must not pass true in the hope
   * that one arrives.
   */
  adReady: boolean
  onCollect: (multiplier: number) => void
}

/**
 * How many rows and the headline have revealed so far.
 *
 * Driven by one timer against wall-clock ms rather than a chain of nested
 * timeouts: a stagger built from `setTimeout` inside `setTimeout` drifts, and
 * under reduce-motion it has to collapse to "everything, now" without leaving
 * orphaned callbacks behind.
 */
function useStagger(count: number, reduced: boolean): { rows: number; total: boolean } {
  const [elapsed, setElapsed] = useState(reduced ? Number.POSITIVE_INFINITY : 0)

  useEffect(() => {
    if (reduced) return
    const start = performance.now()
    let raf = 0
    const tick = () => {
      setElapsed(performance.now() - start)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  let rows = 0
  for (let i = 0; i < count; i++) if (elapsed >= motionMs(rowDelay(i), reduced)) rows = i + 1
  return { rows, total: elapsed >= motionMs(totalDelay(count), reduced) }
}

export function OvernightReport({ report, adReady, onCollect }: OvernightReportProps) {
  const reduced = useReducedMotion()
  const rows = reportRows(report)
  const revealed = useStagger(rows.length, reduced)
  const idle = idleLine(report)
  const storyPoints = report.storyPoints.toNumber()

  return (
    <Panel open modal from="centre" className="overnight">
      <h1 className="overnight__title">OVERNIGHT BUILD</h1>

      <dl className="overnight__rows">
        {rows.map((row, i) => (
          <div
            key={row.key}
            className="overnight__row"
            // Rows do not mount late — they are present and hidden, so the
            // panel's height is settled before the first one appears. A table
            // that grows while it reveals pushes the collect button down the
            // screen under the player's thumb.
            data-revealed={i < revealed.rows ? 'true' : 'false'}
          >
            <dt><ConceptText text={row.label} /></dt>
            <dd>
              {i < revealed.rows ? (
                <Counter value={row.value} format={row.format} bounce />
              ) : (
                <span aria-hidden="true">&nbsp;</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {/*
        §24.8 — the headline lands LAST, after every row, "so it reads as a
        summation rather than a lookup". It is the same number as the Story
        Points row; the point is the order in which the player meets it.
      */}
      <p className="overnight__total" data-revealed={revealed.total ? 'true' : 'false'}>
        <span className="overnight__total-label">BANKED</span>
        {revealed.total && (
          <span className="overnight__total-value">
            <Counter value={storyPoints} format={(n) => String(Math.round(n))} bounce />{' '}
            <Kw>STORY POINTS</Kw>
          </span>
        )}
      </p>

      {idle && (
        // The diegetic sell for the cap raise, and the honest one: this is
        // time the player actually lost, stated plainly rather than as an
        // upsell wearing a costume.
        <p className="overnight__idle"><ConceptText text={idle} /></p>
      )}

      <div className="overnight__actions">
        {/*
          MONETISATION §4 R1: the 2x button sits ABOVE collect. Not beside it,
          not after it. And it is absent rather than disabled when no ad is
          filled — a dead button here is a broken promise at the one moment per
          session the player is paying attention.
        */}
        {adReady && (
          <Button variant="bait" onClick={() => onCollect(2)}>
            {doubleLabel(report)}
          </Button>
        )}
        {/* Always available, never gated, never on a timer. The ad is an
            upgrade to a payout the player already owns. */}
        <Button onClick={() => onCollect(1)}>COLLECT</Button>
      </div>
    </Panel>
  )
}
