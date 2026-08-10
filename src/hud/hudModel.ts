/**
 * The HUD's logic, with no React in it — formatting, thresholds, and which
 * control the script is waiting on.
 *
 * Split out from the components for two reasons. The first is testability: a
 * threshold that decides whether the §21 Act V panic is on screen deserves an
 * assertion, and asserting it through a render tree tests the render tree.
 * The second is that everything here is a *contract with the design document* —
 * §4.3a owns the entropy wording, §7.7.5 owns the scale bar, §21 owns the
 * runway — and a contract is easier to keep when it is in one file that names
 * its clauses.
 */

import { entropyLabel } from '../game/vocabulary.ts'
import type { Phase } from '../game/onboarding.ts'

/* --- money and rates ----------------------------------------------------- */

/**
 * Cash, short-formed — `$1.2K`, `−$847K`.
 *
 * The minus is U+2212, not a hyphen: ART_DIRECTION §3 rule 3 wants numerals
 * that do not jitter, and a hyphen-minus is narrower than a digit in most
 * faces. It is also simply the right character for a negative number.
 */
export function formatMoney(v: number): string {
  const sign = v < 0 ? '−' : ''
  const n = Math.abs(v)
  if (!Number.isFinite(n)) return `${sign}$∞`
  if (n >= 1e3) {
    // The ladder runs out long before this game's numbers do. It used to stop
    // at T, so anything past a trillion fell through `(n/1e12).toFixed(2)` and
    // printed **`$5.3368125747253396e+22T`** — a hire price at a thousand
    // developers, where 1.08^n has already passed 10^34. Scientific notation
    // with a magnitude suffix stuck on the end is not a number anybody can read
    // and it is not a shape the interface uses anywhere else.
    const magnitude = Math.floor(Math.log10(n) / 3)
    if (magnitude >= SUFFIXES.length) {
      // Past the ladder entirely. An exponent with no suffix is honest and
      // short; an exponent *with* one is the bug this replaced.
      return `${sign}$${n.toExponential(1).replace('e+', 'e')}`
    }
    const scaled = n / 10 ** (magnitude * 3)
    // Precision matches what the shorter ladder used: one decimal at K, two
    // above it. Changing that would move every figure in the interface for no
    // reason connected to the fix.
    return `${sign}$${scaled.toFixed(magnitude === 1 ? 1 : 2)}${SUFFIXES[magnitude]}`
  }
  return `${sign}$${n.toFixed(0)}`
}

/**
 * Short-scale magnitude suffixes, to a decillion.
 *
 * §1 promises 10^8 developers and §16's endgame goes further, and hire costs
 * are *geometric* in headcount — so the money outruns the people by a wide
 * margin and the ladder has to be long enough that nothing falls off the end.
 * Past decillion the numbers stop being read and start being watched, which is
 * what break_infinity.js is for; this is the display path, not the model.
 */
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'] as const

/**
 * Velocity spans 1e-6 SP/s in a seized studio to millions at scale, so a fixed
 * format is unreadable at one end or the other.
 */
export function formatVelocity(v: number): string {
  if (!Number.isFinite(v)) return '∞'
  if (v === 0) return '0'
  if (v < 0.001) return v.toExponential(2)
  if (v < 1000) return v.toFixed(2)
  // Not Intl: a localised separator changes the string width, which §3 rule 3
  // forbids beside a monospace face that is counting up.
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/**
 * §10.1's velocity split — `3,880 swarm + 240 you` — GDD §25.1, R11.
 *
 * §10.1 has specified this since the beginning and it was never built:
 *
 * > `VELOCITY: 4,120 SP/s` / `(3,880 swarm + 240 poke)`
 *
 * Its absence produced a real bug report, and a fair one. The commitment burns
 * down continuously from passive output whatever the player does, so a tap
 * worth `+0.80` at global zoom looks like it did nothing while the burn-down
 * visibly moves and the total velocity rises. **Nothing on screen could answer
 * "did my tap do anything".**
 *
 * "you" rather than §10.1's "poke", because the player is not thinking about a
 * mechanic called a poke; they are thinking about whether *they* are helping.
 *
 * Null while the thumb is idle — a permanent `+ 0` is furniture, and this line
 * is only interesting when there is something in it.
 */
export function velocitySplit(swarm: number, poke: number): string | null {
  if (!(poke > 0.005)) return null
  return `${formatVelocity(swarm)} swarm + ${formatVelocity(poke)} you`
}

/**
 * The burn line — `−$50.0K/SEC` — or null when nothing is draining.
 *
 * §21's economy has no payroll until the Mass Hire (the founders are in a
 * garage), so this is silent for the whole first half of Run 1 and then
 * arrives as the trap closes. That silence is the point: a burn readout that
 * is always present is furniture, and one that appears is an event.
 */
export function burnReadout(payrollPerSecond: number): string | null {
  if (!(payrollPerSecond > 0)) return null
  return `−${formatMoney(payrollPerSecond)}/SEC`
}

/**
 * Seconds of runway, shown only once it is short enough to be a threat.
 *
 * §21 Act V is a panic, and a panic needs a clock. Ninety seconds is about the
 * length of the act; above that the number is trivia and would train the
 * player to ignore the row it lives in.
 */
export const RUNWAY_WARN_SECONDS = 90

/**
 * §4.10d — "+$550K IN 82s", the line that stops the negative from lying.
 *
 * A player watching `CASH −$11.8K` with every button greyed has no way to know
 * they are eighty seconds from the biggest payment they have ever received. The
 * balance is true and it is not what is happening; this is the missing half.
 *
 * Only shown while somebody is being paid — in the garage there is no hole to
 * explain — and only while a payout is actually on its way. A seized studio
 * (§21 Act V) gets nothing here, because nothing is coming, and inventing a
 * reassurance for that beat would undo it.
 */
export function payoutReadout(amount: number, seconds: number): string | null {
  if (!Number.isFinite(seconds) || amount <= 0) return null
  if (seconds > 600) return null
  return `+${formatMoney(amount)} IN ${Math.max(1, Math.round(seconds))}s`
}

export function runwayReadout(secondsRemaining: number): string | null {
  if (!Number.isFinite(secondsRemaining)) return null
  if (secondsRemaining >= RUNWAY_WARN_SECONDS) return null
  return `${Math.max(0, secondsRemaining).toFixed(0)}s TO BANKRUPTCY`
}

/* --- the speedometer, GDD §4.3a ------------------------------------------ */

/**
 * The numeral half of §4.3a's readout.
 *
 * `entropyReadout` in the vocabulary module produces the whole string, which is
 * right for a banner and wrong here: the label and the number are set in
 * different phosphor values, so they have to be two elements. Rather than
 * splitting a formatted string back apart on a space — and the labels contain
 * spaces — the rule is restated, and a test pins it against `entropyReadout` so
 * the two cannot drift.
 */
export function entropyPercent(e: number): string {
  const pct = Math.min(99.9, Math.max(0, e * 100))
  // One decimal only in the last stretch, where 99.0 and 99.9 are different
  // situations and a whole number would show both as "99%".
  return `${e >= 0.95 ? pct.toFixed(1) : Math.round(pct)}%`
}

/** Re-exported so a HUD component never reaches past this module for wording. */
export { entropyLabel }

/* --- the script's one control -------------------------------------------- */

/**
 * What the action bar is offering right now.
 *
 * `action` is a key rather than a function so this module stays pure and the
 * store binding lives at the call site — the HUD is forbidden from writing to
 * the store beyond the three existing verbs, and keeping the verbs enumerable
 * here is what makes that checkable.
 */
export interface ActionSpec {
  label: string
  /** Second line, smaller. The Act III promo pitch. */
  note?: string
  variant: 'default' | 'bait'
  action: 'hire' | 'massHire' | 'paradigmShift' | 'takeSeed'
  /**
   * Render the live price beneath the label — §21.0, hiring costs money.
   *
   * A flag rather than the price itself, because these specs are compared by
   * identity (see below) and a note containing the current cost would produce
   * a fresh object every time cash changed. The action bar would then read
   * every tick as a new action and re-run its entrance animation.
   */
  showsHireCost?: boolean
  /**
   * How this action is priced, and therefore when it is dead.
   *
   * The action bar used to gate `disabled` on `showsHireCost`, which meant the
   * **mousetrap was never disabled at any cash level** — a bait button reading
   * "Cost: YOUR ENTIRE TREASURY" stayed live and pressable against an empty
   * treasury. Naming the pricing separately from whether a figure is drawn is
   * what stops the two ever drifting apart again.
   */
  priced?: 'hire' | 'massHire'
}

/**
 * The specs are module constants rather than object literals built per call,
 * and that is a requirement rather than a micro-optimisation. The action bar
 * latches the last non-null spec so it has something to draw while it animates
 * out (§10.8 F1), and the latch compares by identity — a fresh object every
 * render would look like a new action on every frame.
 */
const HIRE: ActionSpec = {
  label: 'HIRE DEVELOPER',
  variant: 'default',
  action: 'hire',
  showsHireCost: true,
  priced: 'hire',
}

const TAKE_SEED: ActionSpec = {
  label: 'ACCEPT TERM SHEET',
  note: '+$50,000',
  variant: 'default',
  action: 'takeSeed',
}

const MASS_HIRE: ActionSpec = {
  label: 'HIRE 1,000 DEVS NOW',
  // §21.0 — no longer free. "Cost: FREE (Trial Promo)" made it a button rather
  // than a decision, and §6 needs the player to *choose* it. Taking the whole
  // treasury is also the better joke, and the same joke the offer is making.
  note: 'Cost: YOUR ENTIRE TREASURY',
  variant: 'bait',
  action: 'massHire',
  priced: 'massHire',
}

/**
 * Exactly one action at a time, and only during the beats that wait on one.
 *
 * §21 is a funnel; a second choice anywhere in it would let the player sidestep
 * the trap they are supposed to walk into. `bankrupt` returns null because that
 * beat's button belongs to the bankruptcy panel — an action bar sliding up
 * underneath a modal would be two surfaces competing for the same decision.
 */
export function actionFor(phase: Phase): ActionSpec | null {
  switch (phase) {
    case 'act2_offer_hire':
    // §21.0's Act IIa is the honest loop — "ship, earn, hire, ship faster" —
    // so the hire control is the *whole* interface of that beat and must be
    // continuously available through it. It was previously offered for the
    // single hire that brings James and then taken away again, which left the
    // act with a verb and no button.
    // falls through
    case 'act2a_loop':
    case 'act2b_loop':
    // §21.0a — **the mousetrap no longer replaces the hire control.** Act III
    // keeps the ordinary verb; the offer arrives beside it as `offerFor`.
    // falls through
    case 'act3_bait':
      return HIRE
    case 'act2a_seed':
      return TAKE_SEED
    default:
      return null
  }
}

/**
 * The temptation, if this beat has one — §21.0a.
 *
 * Separate from {@link actionFor} because it is a *second* control on screen at
 * the same time, which is the one place §21's funnel deliberately widens. The
 * earlier design had Act III swap the hire button for the offer, and that turns
 * a trap into a corridor: **a player who is left no alternative has not chosen
 * anything**, and §6's lesson is only a lesson if the decision was theirs.
 *
 * So both are live. Hiring past the threshold by ordinary means still reaches
 * Act IV; it just takes longer and costs more, which is the point — and is, if
 * anything, the more honest version of the lesson.
 */
export function offerFor(phase: Phase, massHired = false): ActionSpec | null {
  // **A one-shot offer disappears once it has been taken.** It stayed, greyed
  // out, because `canMassHire` correctly refuses a second Mass Hire and the
  // disabled styling then did its job on a control that had no business still
  // being there. A dead button is honest about a price the player cannot meet
  // yet; it is just clutter for an offer that is over.
  return phase === 'act3_bait' && !massHired ? MASS_HIRE : null
}

/* --- the upgrades entry point, GDD §11 -----------------------------------
 *
 * `UPGRADES_COPY` used to live here: eight lines of terminal output saying the
 * tech tree was specified and not built, shown inside a drawer that was built
 * at full size so the real tree would have somewhere to arrive. The tree is in
 * `sim/techTree.ts` now and the drawer renders it, so the placeholder is gone
 * rather than commented out — a stub kept "for reference" beside the thing that
 * replaced it is the next contributor's afternoon.
 */
