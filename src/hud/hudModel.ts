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
  if (n >= 1e12) return `${sign}$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `${sign}$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`
  return `${sign}$${n.toFixed(0)}`
}

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
  action: 'hire' | 'massHire' | 'paradigmShift'
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
      return HIRE
    case 'act3_bait':
      return MASS_HIRE
    default:
      return null
  }
}

/* --- the upgrades entry point, GDD §11 ----------------------------------- */

/**
 * §11's tech tree does not exist, and the honest thing is to say so in the
 * game's own voice rather than to hide the tab.
 *
 * The button has to be here now regardless, because §10.1's bottom nav lists
 * UPGRADES as persistent furniture and because the shape of the HUD is being
 * settled in this pass — a control added later would have to be squeezed in
 * beside a layout that had already agreed how to divide the frame.
 */
export const UPGRADES_COPY: readonly string[] = [
  'COMMUNICATION TECH TREE',
  '',
  'No nodes available.',
  '',
  'Workforce Scale, Communication Protocols and',
  'Culture & Juice are specified but not built.',
  'Run 1 has nothing to buy — and buying your way',
  'out is the lesson this run is withholding.',
]
