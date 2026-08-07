/**
 * The §10.7 tap machine — rules 1, 2 and 3.
 *
 * This is the part of the dialogue system that is actually load-bearing, so it
 * is a pure reducer with no React, no timers and no DOM: the rules are worth
 * pinning in tests, and none of them are testable through a rendered box at
 * 5 taps per second.
 *
 * Rule 3 is enforced by omission and that is deliberate. There is no `skip`
 * event, no `jumpTo`, no `advanceAll`. The only way to reach the end of a
 * script is to have paid for every page on the way, and the cheapest way to
 * keep it that way is to give the machine no vocabulary for anything else.
 */

/**
 * How long after a page completes before an advance tap is accepted.
 *
 * Rule 2 says a single tap can never both complete and advance a page. Taken
 * literally that is satisfied by counting taps — but §21 Act I trains the
 * player to tap five times a second, so their second tap lands ~200 ms after
 * the first, and the "deliberate second tap" the rule asks for would in
 * practice be the involuntary next beat of a tap burst. The page would be gone
 * before their eye reached it.
 *
 * So the arming window is 260 ms of *quiet*: longer than the 200 ms gap of a
 * trained 5 Hz thumb, short enough that a player who is deliberately advancing
 * never notices it. Quiet, not merely elapsed — a tap that arrives inside the
 * window is swallowed **and restarts it**, so a sustained burst never advances
 * at all rather than advancing every 260 ms for as long as it lasts. That is
 * the difference between the rule surviving the trained thumb and merely
 * slowing it down.
 *
 * The blinking caret appears exactly when the window closes, so the affordance
 * and the rule are the same event: a tap while the caret is dark is a tap the
 * box has already said would not count.
 */
export const ADVANCE_ARM_MS = 260

export interface DialogueState {
  /** Index into the page list. */
  page: number
  /** Milliseconds spent on the current page. */
  elapsed: number
  /**
   * `elapsed` at the moment the page finished revealing — by typing itself out
   * or by rule 1's impatience tap. Null while still typing.
   *
   * Doubles as the arming reference, and a swallowed tap pushes it forward to
   * the present: the window measures quiet, not time since completion.
   */
  completedAt: number | null
  /** The script is over. Terminal: no event moves out of it. */
  finished: boolean
}

export type DialogueEvent =
  /** Frame tick. `dt` in milliseconds. */
  | { type: 'tick'; dt: number }
  /** One pointer-down on the box. The only input the system has. */
  | { type: 'tap' }

export function initDialogue(): DialogueState {
  return { page: 0, elapsed: 0, completedAt: null, finished: false }
}

/** Is the page revealed in full? Rule 1's outcome, and rule 2's precondition. */
export function isComplete(s: DialogueState): boolean {
  return s.completedAt !== null
}

/** Complete, and the arming window has passed — the caret is blinking. */
export function isArmed(s: DialogueState): boolean {
  return s.completedAt !== null && s.elapsed - s.completedAt >= ADVANCE_ARM_MS
}

/**
 * @param durations typing duration of each page, in ms, in page order. Under
 *   reduce-motion or a §10.7 "already seen in a previous run" replay these are
 *   all zero — the page fills instantly and rule 2 still applies to it, because
 *   that accommodation is a rendering change and not a content change.
 */
export function dialogueReducer(
  state: DialogueState,
  event: DialogueEvent,
  durations: readonly number[],
): DialogueState {
  if (state.finished) return state

  const duration = durations[state.page] ?? 0

  switch (event.type) {
    case 'tick': {
      if (event.dt <= 0 && state.completedAt !== null) return state
      const elapsed = state.elapsed + Math.max(0, event.dt)
      const completedAt =
        state.completedAt ?? (elapsed >= duration ? Math.max(elapsed, duration) : null)
      return { ...state, elapsed, completedAt }
    }

    case 'tap': {
      // Rule 1 — impatience is served, but it fills the text in, it does not
      // move past it. This branch never touches `page`.
      if (state.completedAt === null) {
        return { ...state, completedAt: state.elapsed }
      }

      // Rule 2 — the deliberate second tap. Anything inside the arming window
      // is the tail of the burst that completed the page: swallowed, and it
      // restarts the window, so mashing holds the page open indefinitely
      // rather than clearing one every 260 ms.
      if (!isArmed(state)) return { ...state, completedAt: state.elapsed }

      const next = state.page + 1
      if (next >= durations.length) {
        return { ...state, finished: true }
      }
      return { page: next, elapsed: 0, completedAt: null, finished: false }
    }
  }
}
