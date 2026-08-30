import { describe, expect, it } from 'vitest'
import {
  CHARS_PER_SECOND,
  PAUSE_MS,
  charsRevealedAt,
  paginate,
  pauseAfter,
  revealTimeline,
  typingDuration,
} from './typewriter.ts'

const STEP = 1000 / CHARS_PER_SECOND

describe('§10.7 timing table', () => {
  it('runs at the stated 28 characters per second', () => {
    // Twenty-eight plain characters and no punctuation is exactly one second.
    const timeline = revealTimeline('abcdefghijklmnopqrstuvwxyzab')
    expect(timeline).toHaveLength(28)
    expect(typingDuration(timeline)).toBeCloseTo(1000, 6)
  })

  it('pauses 120 ms after a comma', () => {
    const timeline = revealTimeline('a,b')
    expect(timeline[2] - timeline[1]).toBeCloseTo(STEP + PAUSE_MS.comma, 6)
  })

  it('pauses 260 ms after each of . ? !', () => {
    for (const ch of ['.', '?', '!']) {
      const timeline = revealTimeline(`a${ch}b`)
      expect(timeline[2] - timeline[1]).toBeCloseTo(STEP + PAUSE_MS.sentence, 6)
    }
  })

  it('pauses 200 ms after an em dash', () => {
    const timeline = revealTimeline('a—b')
    expect(timeline[2] - timeline[1]).toBeCloseTo(STEP + PAUSE_MS.dash, 6)
  })

  it('treats a hyphen as an ordinary character', () => {
    // The table names the em dash. A hyphen is not a dash and must not pause,
    // or every hyphenated word in the script gains 200 ms.
    expect(pauseAfter('-')).toBe(0)
  })

  it('charges no pause for the final character', () => {
    // F6: the player would otherwise wait 260 ms at a finished box for a full
    // stop that has already been drawn.
    expect(typingDuration(revealTimeline('ab.'))).toBeCloseTo(3 * STEP, 6)
  })

  it('is monotonically increasing, so no character is revealed before an earlier one', () => {
    const timeline = revealTimeline('One. Two, three — four!')
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i]).toBeGreaterThan(timeline[i - 1])
    }
  })
})

describe('reveal lookup', () => {
  const timeline = revealTimeline('hello, world.')

  it('shows nothing before the first character lands', () => {
    expect(charsRevealedAt(timeline, 0)).toBe(0)
    expect(charsRevealedAt(timeline, STEP - 0.001)).toBe(0)
  })

  it('reveals a character exactly at its timeline entry', () => {
    expect(charsRevealedAt(timeline, timeline[0])).toBe(1)
    expect(charsRevealedAt(timeline, timeline[4])).toBe(5)
  })

  it('holds the count flat across a pause', () => {
    // Six characters land — `hello,` — and then the comma buys 120 ms of
    // stillness before the space arrives.
    const afterComma = timeline[5]
    expect(charsRevealedAt(timeline, afterComma + PAUSE_MS.comma - 1)).toBe(6)
  })

  it('never exceeds the page length however long it is left', () => {
    expect(charsRevealedAt(timeline, 1e9)).toBe(timeline.length)
  })
})

describe('pagination — §10.7 "3 lines max, then wait for advance"', () => {
  const text =
    'Math doesn’t lie! If 2 devs make games 2x faster, 1,000 devs will make ' +
    'games 1,000x faster! Tap the button. Do it. What could possibly go wrong?'

  it('never emits a page longer than three lines', () => {
    for (const page of paginate(text, 40)) expect(page.length).toBeLessThanOrEqual(3)
  })

  it('never emits a line wider than the box', () => {
    for (const page of paginate(text, 40)) {
      for (const line of page) expect(line.length).toBeLessThanOrEqual(40)
    }
  })

  it('loses no words', () => {
    const out = paginate(text, 40).flat().join(' ').split(/\s+/).filter(Boolean)
    expect(out).toEqual(text.split(/\s+/).filter(Boolean))
  })

  it('hard-splits a word wider than the box rather than overflowing the frame', () => {
    const page = paginate('a'.repeat(25), 10)
    for (const line of page.flat()) expect(line.length).toBeLessThanOrEqual(10)
  })

  it('always yields at least one page, so an empty line still costs a tap', () => {
    // Rule 3: a page the script contains is a page the player advances past.
    expect(paginate('', 40)).toHaveLength(1)
  })
})

describe('§10.7a.4 — a sentence is the unit of the box', () => {
  /**
   * The reported defect, verbatim: `STUDIO_OS` announces two facts and the box
   * cut the second one in half, so the player read `NO TAPPING`, tapped, and
   * was shown `REQUIRED.` on its own. Pinned against the real line at the real
   * width, because the whole claim is about how this line lands.
   */
  it('does not cut a sentence in half across a page turn', () => {
    const pages = paginate('STORY POINTS NOW BURN DOWN AUTOMATICALLY. NO TAPPING REQUIRED.', 28, 2)

    expect(pages).toEqual([
      ['STORY POINTS NOW BURN DOWN', 'AUTOMATICALLY.'],
      ['NO TAPPING REQUIRED.'],
    ])
  })

  it('lets two sentences share a line when the second one fits whole', () => {
    // Rule 1 is "starts on a fresh line unless *all* of it fits", not "always
    // starts on a fresh line" — a box holding one short exchange should hold it
    // as one line, and James's correction is the canonical case.
    expect(paginate('Fewer. It’s countable.', 28, 2)).toEqual([['Fewer. It’s countable.']])
  })

  it('starts a sentence on a new line rather than carrying its tail over', () => {
    expect(paginate('I live off Diet Coke. I have brought my own.', 28, 2)).toEqual([
      ['I live off Diet Coke.', 'I have brought my own.'],
    ])
  })

  it('opens a new page for a sentence that would straddle this one', () => {
    // Two lines left over one line of room: the sentence moves rather than
    // splitting, and the page it leaves behind stays short.
    expect(paginate('HEADCOUNT REVIEW. YOUR SHARE OF THIS SPRINT’S OUTPUT: 2%.', 28, 2)).toEqual([
      ['HEADCOUNT REVIEW.'],
      ['YOUR SHARE OF THIS SPRINT’S', 'OUTPUT: 2%.'],
    ])
  })

  it('packs a sentence too long for one page rather than deferring it forever', () => {
    // The exemption. There is no break that would keep this whole, so it wraps
    // greedily — a rule that cannot be satisfied must not become a rule that
    // empties every page.
    const pages = paginate('a'.repeat(12) + ' b'.repeat(30) + '.', 28, 2)
    expect(pages[0]).toHaveLength(2)
  })

  it('keeps a decimal, an initial and a leading ellipsis out of the split', () => {
    // The terminator only counts when whitespace follows it, which is what
    // keeps these three one sentence each.
    expect(paginate('...Fewer?', 28, 2)).toEqual([['...Fewer?']])
    expect(paginate('SHIPPED AT $1.5M.', 28, 2)).toEqual([['SHIPPED AT $1.5M.']])
    expect(paginate('EMPLOYEE ONBOARDED: J.', 28, 2)).toEqual([['EMPLOYEE ONBOARDED: J.']])
  })

  it('still loses no words and still respects the frame', () => {
    const text =
      'The game. It was never really down. It was degraded. There’s a ' +
      'difference and it matters.'
    const pages = paginate(text, 28, 2)

    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(2)
      for (const line of page) expect(line.length).toBeLessThanOrEqual(28)
    }
    expect(pages.flat().join(' ').split(/\s+/).filter(Boolean)).toEqual(
      text.split(/\s+/).filter(Boolean),
    )
  })
})
