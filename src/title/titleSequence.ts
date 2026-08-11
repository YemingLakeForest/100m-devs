/**
 * The title screen's clock — GDD §10.9.4, as numbers.
 *
 * Everything the title does in time lives here, pure, for the same reason
 * src/ui/typewriter.ts precomputes its reveal: the sequence is a *function of
 * elapsed milliseconds*, not a chain of timers. A chain of `setTimeout`s
 * cannot be tested, drifts, and — the failure that matters — leaves the screen
 * in an inconsistent half-state when a phase boundary is crossed inside a
 * dropped frame, which is F1 arriving through the back door.
 *
 * Durations pass through `motionMs`, so §10.5 rule 3 shortens the sequence
 * rather than cutting it. Nothing here may be shortened to zero: §10.9.1 says
 * the count is "never skipped", and §10.9.5 says a logo that does not count is
 * not the logo.
 */

import { motionMs } from '../ui/motion.ts'

/** The number the wordmark is. */
export const COUNT_TARGET = 100_000_000

/** log10(COUNT_TARGET) — the count sweeps this many decades. */
const COUNT_DECADES = 8

/** §10.9.1 — "about a second and a half" cold, "about 0.5 s" on a return visit. */
export const COUNT_MS_FIRST = 1500
export const COUNT_MS_RETURN = 500

/** §10.9.3 — "roughly two seconds" of boot, first launch only. */
export const BOOT_MS = 2000
/** The boot block lifting away as the logo arrives. They overlap; nothing waits. */
export const BOOT_EXIT_MS = 200

/** The logo block sliding in under its own count. */
export const LOGO_IN_MS = 240
/** §10.8a — "bounces on arrival": the scale overshoot on the digits. */
export const LAND_MS = 260
/** §10.9.4 — "rule draws left-to-right". */
export const RULE_MS = 240
export const TAGLINE_MS = 200
export const MENU_ITEM_MS = 220

/** §10.9.4 — "menu items stagger in on 60 ms offsets". §10.8a's 40–60 ms band. */
export const STAGGER_MS = 60

/** The landing-screen slabs. Exported so the stagger can be tested against it. */
export const MENU_ITEMS = ['START', 'NEW GAME', 'OPTIONS', 'CREDITS'] as const
export type MenuItem = (typeof MENU_ITEMS)[number]

/** §10.9.4 exit — each part's own animation, all comfortably inside F6's 400 ms. */
export const EXIT_LOGO_MS = 240
export const EXIT_ITEM_MS = 200
/** "The room lights come up." The night wash lifting off the canvas. */
export const EXIT_LIGHTS_MS = 380
/** "The camera pushes in to the desk." */
export const PUSH_IN_MS = 420

/**
 * §10.9.3's copy, verbatim.
 *
 * Note there is no emoji and no box-drawing here and there never may be —
 * ART_DIRECTION §3.1, and `npm run art:check` fails the build on one. The dot
 * leaders are load-bearing rhythm rather than decoration: `pauseAfter('.')`
 * charges 260 ms per full stop, so a leader is where the reveal visibly
 * stutters before the result lands. See {@link bootClockScale} for how that
 * survives being compressed into two seconds.
 */
export const BOOT_TEXT = [
  'STUDIO_OS v0.0.1',
  '  checking payroll .......... OK',
  '  checking morale ........... OK',
  '  checking headcount ........ 1',
  '  checking ambition ......... UNBOUNDED',
  'ready.',
].join('\n')

/** The §10.9.2 tagline, at body size under the rule. Lower case, as written. */
export const TAGLINE = 'an idle game about too many people'

/** §10.9.2 — the OS fiction. The title screen is the OS, not a menu on a game. */
export const OS_BANNER = 'STUDIO_OS v0.0.1'

/**
 * Absolute offsets from title mount, in milliseconds.
 *
 * Every field is a start time except the `*Ms` durations, so a component can
 * ask "where am I" with one subtraction instead of holding phase state that
 * can disagree with the clock.
 */
export interface TitleTimeline {
  /** 0 on a return visit — §10.9.3, "every subsequent launch skips straight to the logo". */
  readonly bootMs: number
  readonly countStart: number
  readonly countMs: number
  /** The instant the numerals reach COUNT_TARGET and the bounce fires. */
  readonly landAt: number
  readonly ruleStart: number
  readonly taglineStart: number
  readonly menuStart: number
  /** When the last slab has finished arriving and the screen is at rest. */
  readonly settledAt: number
}

export function titleTimeline(firstLaunch: boolean, reduced = false): TitleTimeline {
  const bootMs = firstLaunch ? motionMs(BOOT_MS, reduced) : 0
  const countMs = motionMs(firstLaunch ? COUNT_MS_FIRST : COUNT_MS_RETURN, reduced)

  const countStart = bootMs
  const landAt = countStart + countMs
  // The rule starts drawing while the digits are still bouncing rather than
  // after they have settled. Sequential-but-overlapping is what separates a
  // directed entrance from a queue of animations (F6).
  const ruleStart = landAt + Math.round(motionMs(LAND_MS, reduced) / 2)
  const taglineStart = ruleStart + motionMs(RULE_MS, reduced)
  const menuStart = taglineStart + motionMs(TAGLINE_MS, reduced)
  const settledAt =
    menuStart + (MENU_ITEMS.length - 1) * motionMs(STAGGER_MS, reduced) + motionMs(MENU_ITEM_MS, reduced)

  return { bootMs, countStart, countMs, landAt, ruleStart, taglineStart, menuStart, settledAt }
}

/** §10.9.4 — the entry stagger. Slab `i` starts this long after `menuStart`. */
export function menuInDelayMs(index: number, reduced = false): number {
  return index * motionMs(STAGGER_MS, reduced)
}

/**
 * §10.9.4 exit — "the logo and menu leave on a stagger".
 *
 * The logo goes first and the menu follows, rather than everything leaving at
 * once: §10.8a calls the staggered exit the single technique that does most of
 * the work, and a block exit is indistinguishable from a fade.
 */
export function exitDelayMs(part: 'logo' | 'rule' | 'tagline' | 'menu', index = 0, reduced = false): number {
  const stagger = motionMs(STAGGER_MS, reduced)
  switch (part) {
    case 'logo':
      return 0
    case 'rule':
      return Math.round(stagger * 0.7)
    case 'tagline':
      return Math.round(stagger * 1.3)
    case 'menu':
      return stagger * 2 + index * stagger
  }
}

/**
 * How long the whole §10.9.4 exit takes, including the slowest thing in it.
 *
 * This is the one duration in the file that exceeds F6's 400 ms, and it is
 * F6's stated exception: the press-start transition is *the* scored beat of
 * the title screen. Every individual animation inside it is still under 400 ms.
 */
export function exitTotalMs(reduced = false): number {
  const lastSlab = exitDelayMs('menu', MENU_ITEMS.length - 1, reduced) + motionMs(EXIT_ITEM_MS, reduced)
  return Math.max(lastSlab, motionMs(EXIT_LIGHTS_MS, reduced), motionMs(PUSH_IN_MS, reduced))
}

function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
}

/**
 * The headcount showing at `elapsed` ms into a count of `duration` ms.
 *
 * **Interpolated in log space, not linear space.** A linear ramp spends the
 * first 1.49 seconds of a 1.5-second count somewhere in the tens of millions
 * and the player never sees a small number at all — which throws away the
 * entire joke, because the joke is that it *starts at one*. Log space gives
 * every decade the same share of the clock, which is what produces §10.9.1's
 * `1 -> 14 -> 1,092 -> 4,318,779` and is also, not coincidentally, how the
 * §7.7.3 arrival burst reasons about growth.
 *
 * The ease is applied to the *exponent*, so the sweep starts and ends softly
 * without either end collapsing into a blur of digits.
 *
 * Monotonic non-decreasing by construction — `easeInOutCubic` is monotonic and
 * `10 ** x` is increasing — which matters because a counter that ever goes
 * backwards reads as a bug rather than as a count.
 */
export function countAt(elapsed: number, duration: number): number {
  if (!(duration > 0) || elapsed >= duration) return COUNT_TARGET
  if (elapsed <= 0) return 1
  const p = elapsed / duration
  return Math.max(1, Math.round(10 ** (COUNT_DECADES * easeInOutCubic(p))))
}

/**
 * Comma-group a headcount for the wordmark — `4318779` -> `4,318,779`.
 *
 * Deliberately **not** `formatCount`. That function is right everywhere else
 * in the product and wrong here: it abbreviates to `100 M`, and §10.9.2 is
 * explicit that all nine digits are the display element — "the numerals *are*
 * the wordmark; there is no wordmark to draw". Abbreviating the logo would
 * abbreviate the game's name.
 *
 * Also deliberately not `Intl.NumberFormat`, for the reason `formatCount`
 * gives: a localised separator changes the string width, and ART_DIRECTION §3
 * rule 3 forbids that beside a monospace face — here it would resize the logo.
 */
export function groupDigits(n: number): string {
  const digits = String(Math.max(0, Math.round(n)))
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ','
    out += digits[i]
  }
  return out
}

/** The widest string the count ever shows. Reserves the logo's width up front. */
export const COUNT_GHOST = groupDigits(COUNT_TARGET)

/**
 * Scale factor from wall-clock time onto the typewriter's own timeline.
 *
 * `Typewriter` reveals at a fixed 28 chars/sec plus §10.7's punctuation pauses,
 * which puts the §10.9.3 boot block — 150-odd characters, most of them dot
 * leaders worth 260 ms each — somewhere north of fifteen seconds. §10.9.3 asks
 * for two.
 *
 * Rather than add a rate knob to `Typewriter` (a second reveal primitive, and
 * §10.7's rate is canon for *dialogue*), the boot drives it through its
 * existing controlled clock at a multiplier. The relative rhythm survives
 * intact — the leaders still rip and still pause on each dot — it is only the
 * wall-clock length that changes. This is what the `elapsedMs` prop is for.
 */
export function bootClockScale(typingDurationMs: number, bootMs: number): number {
  if (!(bootMs > 0)) return 0
  return typingDurationMs / bootMs
}
