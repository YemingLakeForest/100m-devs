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

/*
 * **[amended 2026-09-26] There is no arming window: a complete page turns on
 * the next tap.** *"the tap to continue light up a moment after the line ends,
 * this made the experience clunky, make it light immediately so people can
 * keep clicking though."*
 *
 * There used to be 260 ms of enforced quiet after a page completed, and a tap
 * inside it was swallowed and restarted it — written so that §21 Act I's 5 Hz
 * thumb could not carry a page away before the eye reached it. It did that, and
 * it made every page a small wait: the caret and the hint lit a beat after the
 * line had visibly finished, and a player reading at their own pace felt the
 * box resist them on every turn. Rules 1 and 3 still hold — a tap mid-page only
 * fills it in, so no single tap both finishes a page and dismisses it, and a
 * page still costs its taps — and the caret now lights the instant the page is
 * complete, which is when the tap that turns it is accepted.
 */

export interface DialogueState {
  /** Index into the page list. */
  page: number
  /** Milliseconds spent on the current page. */
  elapsed: number
  /**
   * `elapsed` at the moment the page finished revealing — by typing itself out
   * or by rule 1's impatience tap. Null while still typing.
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

/** The next tap turns the page, and the caret says so: the moment the page is complete. */
export function isArmed(s: DialogueState): boolean {
  return s.completedAt !== null
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

      // Rule 2 — the second tap, on a complete page, turns it. At once: see the
      // note at the top of this file for the window that used to sit here.
      const next = state.page + 1
      if (next >= durations.length) {
        return { ...state, finished: true }
      }
      return { page: next, elapsed: 0, completedAt: null, finished: false }
    }
  }
}
