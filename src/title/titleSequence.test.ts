import { describe, expect, it } from 'vitest'
import {
  BOOT_TEXT,
  COUNT_GHOST,
  COUNT_MS_FIRST,
  COUNT_MS_RETURN,
  COUNT_TARGET,
  EXIT_ITEM_MS,
  MENU_ITEMS,
  STAGGER_MS,
  bootClockScale,
  countAt,
  exitDelayMs,
  exitTotalMs,
  groupDigits,
  menuInDelayMs,
  titleTimeline,
} from './titleSequence.ts'
import { revealTimeline, typingDuration } from '../ui/typewriter.ts'

describe('countAt — GDD §10.9.1', () => {
  it('starts at one developer and ends at a hundred million', () => {
    expect(countAt(0, COUNT_MS_FIRST)).toBe(1)
    expect(countAt(COUNT_MS_FIRST, COUNT_MS_FIRST)).toBe(COUNT_TARGET)
  })

  it('never overshoots or reverses past the end', () => {
    expect(countAt(COUNT_MS_FIRST * 4, COUNT_MS_FIRST)).toBe(COUNT_TARGET)
    expect(countAt(-500, COUNT_MS_FIRST)).toBe(1)
  })

  it('is monotonic non-decreasing — a counter that goes backwards reads as a bug', () => {
    let previous = 0
    for (let ms = 0; ms <= COUNT_MS_FIRST; ms += 8) {
      const value = countAt(ms, COUNT_MS_FIRST)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  /**
   * The whole reason the interpolation is logarithmic. A linear ramp is in the
   * tens of millions within the first 2% of the clock, so the player never
   * sees a small number and the joke — one developer becomes a hundred million
   * — never happens.
   */
  it('spends real time in every order of magnitude', () => {
    const decadesSeen = new Set<number>()
    for (let ms = 0; ms < COUNT_MS_FIRST; ms += 16) {
      decadesSeen.add(Math.floor(Math.log10(countAt(ms, COUNT_MS_FIRST))))
    }
    decadesSeen.add(Math.floor(Math.log10(countAt(COUNT_MS_FIRST, COUNT_MS_FIRST))))
    // 0 through 8 inclusive: every decade from a single developer upward, and
    // none of them passed through inside a single frame.
    expect([...decadesSeen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('reaches the §10.9.1 midpoint neighbourhood halfway through', () => {
    // Log-space midpoint of 1..1e8 is 1e4. The ease is symmetric, so this
    // pins both the space and the curve in one assertion.
    expect(countAt(COUNT_MS_FIRST / 2, COUNT_MS_FIRST)).toBe(10_000)
  })

  it('runs the same shape on a return visit, only faster', () => {
    expect(countAt(COUNT_MS_RETURN / 2, COUNT_MS_RETURN)).toBe(
      countAt(COUNT_MS_FIRST / 2, COUNT_MS_FIRST),
    )
    // §10.9.1: faster, "but never skipped".
    expect(COUNT_MS_RETURN).toBeGreaterThan(0)
    expect(countAt(0, COUNT_MS_RETURN)).toBe(1)
  })
})

describe('groupDigits', () => {
  it('groups in threes without localising', () => {
    expect(groupDigits(1)).toBe('1')
    expect(groupDigits(14)).toBe('14')
    expect(groupDigits(1092)).toBe('1,092')
    expect(groupDigits(4318779)).toBe('4,318,779')
    expect(groupDigits(COUNT_TARGET)).toBe('100,000,000')
  })

  it('publishes the widest string the count will ever show', () => {
    // The ghost reserves the logo's width, so it has to be an upper bound on
    // every intermediate value or the layout moves mid-count.
    for (let ms = 0; ms <= COUNT_MS_FIRST; ms += 16) {
      expect(groupDigits(countAt(ms, COUNT_MS_FIRST)).length).toBeLessThanOrEqual(COUNT_GHOST.length)
    }
  })
})

describe('titleTimeline — GDD §10.9.3, §10.9.4', () => {
  it('boots only on a first launch', () => {
    expect(titleTimeline(true).bootMs).toBeGreaterThan(0)
    expect(titleTimeline(false).bootMs).toBe(0)
  })

  it('counts on both, and faster on the return visit', () => {
    const cold = titleTimeline(true)
    const warm = titleTimeline(false)
    expect(warm.countMs).toBeGreaterThan(0)
    expect(warm.countMs).toBeLessThan(cold.countMs)
    // §10.9.3: "every subsequent launch skips straight to the logo".
    expect(warm.countStart).toBe(0)
  })

  it('orders the entrance: count, then rule, then tagline, then menu', () => {
    const t = titleTimeline(true)
    expect(t.countStart).toBe(t.bootMs)
    expect(t.landAt).toBe(t.countStart + t.countMs)
    expect(t.ruleStart).toBeGreaterThan(t.landAt)
    expect(t.taglineStart).toBeGreaterThan(t.ruleStart)
    expect(t.menuStart).toBeGreaterThan(t.taglineStart)
    expect(t.settledAt).toBeGreaterThan(t.menuStart)
  })

  it('shortens under reduce-motion without collapsing the order', () => {
    const full = titleTimeline(true)
    const reduced = titleTimeline(true, true)
    expect(reduced.settledAt).toBeLessThan(full.settledAt)
    // §10.9.1 — the count survives the accessibility path.
    expect(reduced.countMs).toBeGreaterThan(0)
    expect(reduced.ruleStart).toBeGreaterThan(reduced.landAt)
    expect(reduced.menuStart).toBeGreaterThan(reduced.taglineStart)
  })
})

describe('the stagger — GDD §10.9.4, §10.8a', () => {
  it('offsets menu entry by 60 ms per slab', () => {
    expect(menuInDelayMs(0)).toBe(0)
    expect(menuInDelayMs(1)).toBe(STAGGER_MS)
    expect(menuInDelayMs(2)).toBe(STAGGER_MS * 2)
  })

  it('never arrives as a block', () => {
    const delays = MENU_ITEMS.map((_, i) => menuInDelayMs(i))
    expect(new Set(delays).size).toBe(MENU_ITEMS.length)
  })

  it('leaves logo first, then the menu, one slab at a time', () => {
    expect(exitDelayMs('logo')).toBe(0)
    expect(exitDelayMs('rule')).toBeGreaterThan(exitDelayMs('logo'))
    expect(exitDelayMs('tagline')).toBeGreaterThan(exitDelayMs('rule'))
    expect(exitDelayMs('menu', 0)).toBeGreaterThan(exitDelayMs('tagline'))

    const menu = MENU_ITEMS.map((_, i) => exitDelayMs('menu', i))
    for (let i = 1; i < menu.length; i++) {
      expect(menu[i] - menu[i - 1]).toBe(STAGGER_MS)
    }
  })

  it('covers every part before it reports the exit finished', () => {
    const total = exitTotalMs()
    expect(total).toBeGreaterThanOrEqual(
      exitDelayMs('menu', MENU_ITEMS.length - 1) + EXIT_ITEM_MS,
    )
    // F6 — the press-start beat is allowed past 400 ms, but not by much: it is
    // a scored transition, not a loading screen.
    expect(total).toBeLessThan(800)
  })

  it('shortens the exit under reduce-motion', () => {
    expect(exitTotalMs(true)).toBeLessThan(exitTotalMs())
    // Never to nothing — §10.5 rule 3 shortens, it does not cut.
    expect(exitTotalMs(true)).toBeGreaterThan(0)
  })
})

describe('the boot — GDD §10.9.3', () => {
  it('compresses the typewriter timeline into roughly two seconds', () => {
    const t = titleTimeline(true)
    const natural = typingDuration(revealTimeline(BOOT_TEXT))
    const scale = bootClockScale(natural, t.bootMs)

    // The dot leaders make the unassisted reveal many times longer than the
    // §10.9.3 budget, which is the reason the scale exists at all.
    expect(natural).toBeGreaterThan(t.bootMs * 2)
    // At the end of the wall-clock budget the last character has landed.
    expect(t.bootMs * scale).toBeGreaterThanOrEqual(natural)
  })

  it('is a no-op when there is no boot to run', () => {
    expect(bootClockScale(5000, 0)).toBe(0)
  })

  it('carries no emoji — ART_DIRECTION §3.1, enforced by art:check', () => {
    expect(/\p{Extended_Pictographic}/u.test(BOOT_TEXT)).toBe(false)
  })
})
