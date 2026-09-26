import { describe, expect, it } from 'vitest'
import {
  dialogueReducer,
  initDialogue,
  isArmed,
  isComplete,
  type DialogueEvent,
  type DialogueState,
} from './dialogue.ts'

/** Three pages, one second of typing each. */
const DURATIONS = [1000, 1000, 1000]

function run(events: DialogueEvent[], durations = DURATIONS): DialogueState {
  return events.reduce((s, e) => dialogueReducer(s, e, durations), initDialogue())
}

const tick = (dt: number): DialogueEvent => ({ type: 'tick', dt })
const tap: DialogueEvent = { type: 'tap' }

describe('§10.7 rule 1 — a mid-page tap completes the page and nothing else', () => {
  it('fills the page in', () => {
    const s = run([tick(200), tap])
    expect(isComplete(s)).toBe(true)
  })

  it('does not move past it', () => {
    // "Impatience is served — but it fills the text in, it does not move past
    // it." The page index is the assertion; everything else is decoration.
    const s = run([tick(200), tap])
    expect(s.page).toBe(0)
    expect(s.finished).toBe(false)
  })

  it('completes a page that had already typed itself out, without advancing', () => {
    const s = run([tick(1000)])
    expect(isComplete(s)).toBe(true)
    expect(s.page).toBe(0)
  })
})

describe('§10.7 rule 2 — a single tap can never both complete and advance', () => {
  it('needs two taps to leave the first page', () => {
    const one = run([tick(200), tap])
    expect(one.page).toBe(0)

    const two = run([tick(200), tap, tap])
    expect(two.page).toBe(1)
  })

  it('turns a complete page on the very next tap — no window to wait out [2026-09-26]', () => {
    // "make it light immediately so people can keep clicking though": a player
    // tapping through at 5 Hz reads every page at two taps each.
    const burst: DialogueEvent[] = []
    for (let i = 0; i < 6; i++) burst.push(tick(200), tap)
    expect(run(burst).finished).toBe(true)
    expect(run(burst.slice(0, -2)).finished).toBe(false)
  })

  it('accepts the advance the same way whether the page was completed by tap or by typing', () => {
    const typed = run([tick(1000), tap])
    expect(typed.page).toBe(1)
    const tapped = run([tick(200), tap, tap])
    expect(tapped.page).toBe(1)
    expect(tapped.elapsed).toBe(0)
    expect(isComplete(tapped)).toBe(false)
  })

  it('lights the caret the instant the page is complete', () => {
    expect(isArmed(run([tick(999)]))).toBe(false)
    expect(isArmed(run([tick(1000)]))).toBe(true)
    expect(isArmed(run([tick(200), tap]))).toBe(true)
  })
})

describe('§10.7 rule 3 — there is no skip', () => {
  it('costs two taps per page, every page, to the end of the script', () => {
    const events: DialogueEvent[] = []
    for (let i = 0; i < DURATIONS.length; i++) {
      events.push(tick(200), tap, tap)
    }
    const s = run(events)
    expect(s.finished).toBe(true)

    // One tap short of the full price leaves the script unfinished.
    expect(run(events.slice(0, -1)).finished).toBe(false)
  })

  it('never moves more than one page for one tap', () => {
    let s = initDialogue()
    for (const e of [tick(2000), tap, tap]) {
      const before = s.page
      s = dialogueReducer(s, e, DURATIONS)
      expect(s.page - before).toBeLessThanOrEqual(1)
    }
  })

  it('does nothing at all once the script is over', () => {
    // No auto-advance timer, and no way back in. The caller owns what happens
    // next; the machine is inert.
    const done = run([tick(2000), tap, tick(2000), tap, tick(2000), tap])
    expect(done.finished).toBe(true)
    expect(dialogueReducer(done, tap, DURATIONS)).toBe(done)
    expect(dialogueReducer(done, tick(10000), DURATIONS)).toBe(done)
  })
})

describe('instant-fill pages — reduce-motion, and the previously-seen replay', () => {
  const instant = [0, 0]

  it('still requires the deliberate advance tap', () => {
    // §10.7 accessibility: "That is a rendering accommodation and still
    // requires the deliberate advance tap of rule 2 — the content is never
    // shortened or auto-dismissed."
    const s = run([tick(16)], instant)
    expect(isComplete(s)).toBe(true)
    expect(s.page).toBe(0)
  })

  it('advances on a genuine second tap, like any other page', () => {
    const s = run([tick(16), tap], instant)
    expect(s.page).toBe(1)
  })
})
