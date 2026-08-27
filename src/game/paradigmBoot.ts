/**
 * The cut scene between two realities — GDD §15.1a, and §15.1's unbuilt half.
 *
 * §15.1 has specified this since the beginning and only ever got the modal:
 *
 * > When `[ REWRITE CODEBASE ]` is confirmed, a **CRT monitor reboot animation**
 * > wipes the screen, the camera zooms into a single pixel desk, and the new run
 * > begins with permanent BP perks applied.
 *
 * What shipped was the liquidation and nothing else: the bankruptcy panel closed,
 * the floor emptied, James said *"How did you find me in every single reality?"*
 * and the player was in a new studio. **The largest thing that happens in this
 * game happened in a cut.** §10.5's rule that nothing in the product cuts was
 * being broken by the one beat that most needed the opposite.
 *
 * So the reboot is the boot. It is the same surface as §10.9.3's STUDIO_OS cut
 * scene — same black, same scanlines, same typed pages, same tap-at-your-own-
 * speed — because that is the screen this game already uses to say *a studio is
 * starting*, and a Paradigm Shift is a studio starting. What it adds is the part
 * §15.1 could not have known it needed: **an account of the reality that just
 * ended**, and the lesson it taught (`lessons.ts`).
 *
 * ## Why the receipt is not the prestige screen
 *
 * §15.1's execution modal is a *quote*: it prices the shift before the player
 * takes it, so they can decide. This is the *receipt*: it lands after, when
 * nothing can be decided, and it exists to close the run rather than to sell the
 * next one. Two surfaces, opposite jobs, and the difference is that one of them
 * has buttons.
 *
 * Pure — no store, no clock, no renderer. The store assembles the report and the
 * component draws these strings.
 */

import { LESSONS, type LessonId } from './lessons.ts'
import { bootLines } from '../title/studioBoot.ts'

/** What the shift is accounting for. Assembled by the store at the moment it happens. */
export interface ShiftReport {
  /** Which shift this is. The first is 1. */
  shift: number
  /** BP the shift paid out — §14.1. */
  bp: number
  /** The reality's total revenue. */
  revenue: number
  /** Highest headcount it reached — §14.1's other input. */
  peakDevs: number
  /** Games it shipped. */
  shipped: number
  /** Simulated seconds it lasted. */
  seconds: number
  /** What it taught — `lessons.ts`. */
  learned: LessonId
  /** Every lesson known after it, in catalogue order. */
  ledger: LessonId[]
  /** The project the next reality opens on, for the boot's `project:` page. */
  nextProject: string
}

/** Three digits, so `SHIFT 002` and `SHIFT 040` are the same width on the screen. */
export function shiftLabel(shift: number): string {
  const n = Math.max(0, Math.floor(shift))
  return String(n).padStart(3, '0')
}

/**
 * Money, at a glance rather than to the dollar.
 *
 * Not `hudModel.formatMoney`: that is the *HUD's* format and it belongs to a
 * readout that is counting. This is a closed book, and a closed book is rounded.
 * It also keeps `game/` free of a `hud/` import, which is the standing rule.
 */
export function shortMoney(v: number): string {
  const n = Math.max(0, v)
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${Math.round(n)}`
}

/** Whole numbers with a separator that is the same character on every device. */
export function grouped(v: number): string {
  return Math.max(0, Math.round(v))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** `12m 04s`, because a run is minutes long and an hour is a different sentence. */
export function duration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}h ${mm}m` : `${m}m ${ss}s`
}

/** Label and value on one line, with the value flushed to a fixed column. */
function row(label: string, value: string): string {
  return `  ${label.padEnd(12)}${value}`
}

/**
 * How many pages this screen may ever be.
 *
 * **A cut scene the player sees once is a beat; one they see forty times is an
 * obstacle** — `bootFlag.ts` makes exactly that argument about the install boot,
 * and it applies with more force here, because this one is unavoidable. Four is
 * the budget, a test holds it, and anything added to this screen has to take the
 * place of something already on it.
 */
export const MAX_PAGES = 4

/**
 * The pages, in order. One tap each — the shell owns the turning.
 *
 * Four, and each is a *block* rather than a line, which is the difference
 * between this and §10.9.3's boot. The receipt is a table, and a table read one
 * cell at a time is not a table; the ledger is a set, and the point of a set is
 * seeing it together.
 *
 * The last page is §10.9.3's boot — the same four lines, in the same words, out
 * of the same function — **all at once**. On the install's first launch they
 * arrive one page at a time because they are being introduced. Here they are
 * being recognised, and a reboot is quicker than a boot. That the screen comes
 * back at all is what says *this is a beginning*, with no narration near it.
 */
export function paradigmBootPages(report: ShiftReport, founderName: string): string[] {
  const total = Object.keys(LESSONS).length
  return [
    `PARADIGM SHIFT ${shiftLabel(report.shift)}`,
    [
      `REALITY ${shiftLabel(report.shift)} — LIQUIDATED`,
      '',
      row('revenue', shortMoney(report.revenue)),
      row('peak', `${grouped(report.peakDevs)} developers`),
      row('shipped', `${grouped(report.shipped)} games`),
      row('lasted', duration(report.seconds)),
      row('bandwidth', `+${grouped(report.bp)} BP`),
    ].join('\n'),
    [
      `LESSONS LEARNT — ${report.ledger.length} OF ${total}`,
      '',
      // The one this run taught is marked, and the mark is the only thing that
      // distinguishes it: a player on their ninth shift is reading a list they
      // mostly already know, and what they came for is which line is new to it.
      ...report.ledger.map((id) => `${id === report.learned ? '>' : ' '} ${LESSONS[id]}`),
    ].join('\n'),
    bootLines(founderName, report.nextProject).join('\n'),
  ]
}
