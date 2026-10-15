/**
 * Letting people go — GDD §10.10.5 [CANON - added 2026-10-15].
 *
 * Hiring was the only way headcount moved. A player who over-hired — and the
 * playthrough that found MAX's one-tap bankruptcy found plenty of ways to — was
 * stuck with a payroll they could see blinking and could not touch, until the
 * run ended and took everybody anyway. That is not a hard game, it is a game
 * with a verb missing: §4.1's whole thesis is *past the peak every hire makes
 * the studio slower*, and the only remedy for having crossed it was a
 * bankruptcy screen.
 *
 * ## It is not an undo, and the price is why
 *
 * A layoff that refunded the hire would make hiring risk-free — hire a thousand,
 * and if the clock starts, un-hire them — and §4.10a's whole argument is that the
 * hire price is what the player weighs. So a layoff costs **severance**
 * ({@link SEVERANCE_SECONDS} of the wage per head), and the hire price is gone.
 *
 * Thirty seconds is also a statement about *when* it helps. A head let go stops
 * costing the wage and costs thirty seconds of it once, so a layoff only pays for
 * itself if the studio would have lived longer than that anyway: **at under thirty
 * seconds from the line, cutting makes it worse.** That is true to life, and it is
 * what gives the bankruptcy clock's ninety seconds a reason to be ninety: the
 * window in which the player can still do something about it.
 *
 * ## What it can touch
 *
 * Only **paid** heads (§4.10's unpaid founder stays — nobody lays off James), and
 * the *newest* seats first, because a developer's face and name are a function of
 * their seat (§7.8.7): taking the end of the roster leaves everybody who stays
 * exactly who they were. Run 1 has no layoffs — it has no hiring, and the thousand
 * who arrive are the trap (§21.0e); `unlocks.manualHire` gates both.
 *
 * Pure — no store, no clock, no renderer.
 */

import {
  BANKRUPTCY_THRESHOLD,
  WAGE_PER_DEV_PER_SEC,
  paidHeadcount,
  secondsUntilBankrupt,
} from './economy.ts'
import { MAX_RUNWAY_SECONDS, type Multiplier } from './hireDial.ts'

/** Seconds of the wage paid, per head, to let somebody go. */
export const SEVERANCE_SECONDS = 30

/** What one head costs to let go, in dollars. */
export const SEVERANCE_PER_HEAD = SEVERANCE_SECONDS * WAGE_PER_DEV_PER_SEC

/** Seconds from the bankruptcy line **after** letting `count` go and paying `severance`. */
export function runwayAfterLayoff(devs: number, cash: number, count: number, severance: number): number {
  return secondsUntilBankrupt(cash - severance, Math.max(0, Math.floor(devs) - Math.max(0, count)))
}

/**
 * MAX, for a layoff: **the fewest heads that put the studio back
 * {@link MAX_RUNWAY_SECONDS} from the line** — the same line MAX hire refuses to
 * cross, approached from the other side.
 *
 * Closed form, because the dial prices it every frame. Writing `R` for the
 * treasury above the line in seconds of wage and `p` for the paid heads, letting
 * `n` go leaves `(R − S·n) / (p − n)` seconds, with `S` the severance. The sign of
 * its derivative is the sign of `R − S·p` and nothing else — constant in `n` — so
 * it is monotone: with more than `S` seconds in hand every further cut helps, and
 * with fewer every cut hurts. That gives `n ≥ (T·p − R) / (T − S)` for a target
 * `T`, and no search.
 *
 * Zero when the studio is already safe, and zero when it is inside the severance
 * itself: there is no number of people to let go that helps.
 */
export function trimToRunway(devs: number, cash: number): number {
  const paid = paidHeadcount(Math.floor(devs))
  if (paid <= 0) return 0
  const room = (cash - BANKRUPTCY_THRESHOLD) / WAGE_PER_DEV_PER_SEC
  if (!(room > 0)) return 0
  const runway = room / paid
  if (runway >= MAX_RUNWAY_SECONDS) return 0
  if (runway <= SEVERANCE_SECONDS) return 0
  const n = Math.ceil((MAX_RUNWAY_SECONDS * paid - room) / (MAX_RUNWAY_SECONDS - SEVERANCE_SECONDS))
  return Math.min(paid, Math.max(1, n))
}

export interface LayoffQuote {
  /** Heads that would go. Never more than the paid headcount. */
  count: number
  /** Severance, in dollars. */
  cost: number
  /** Seconds from the bankruptcy line once it is done. */
  runwayAfter: number
  /** Can it be done *now* — it has a count, and the severance does not itself end the run. */
  affordable: boolean
}

/**
 * What the LAY OFF button is offering at this dial setting.
 *
 * The shape of {@link import('./hireDial.ts').quote}, and the same rule 1: a fixed
 * multiplier the studio cannot do is **shown, priced and dimmed**, with the count
 * it would really take, rather than silently turned into a smaller one. A button
 * that says `x100` and lets fifty go is the interface lying about the one thing it
 * is for.
 *
 * Affordability is *not* "cash covers the severance". A studio in the red is
 * exactly who uses this, so severance may be paid from below zero — it must only
 * not carry the studio over the line itself, or the button is a bankruptcy
 * dressed as a rescue.
 */
export function layoffQuote(devs: number, cash: number, value: Multiplier): LayoffQuote {
  const paid = paidHeadcount(Math.floor(devs))
  const wanted = value === 'max' ? trimToRunway(devs, cash) : Math.max(0, Math.floor(value))
  const count = Math.min(paid, wanted)
  const cost = count * SEVERANCE_PER_HEAD
  return {
    count,
    cost,
    runwayAfter: runwayAfterLayoff(devs, cash, count, cost),
    affordable: count > 0 && cash - cost > BANKRUPTCY_THRESHOLD,
  }
}
