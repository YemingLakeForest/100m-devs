import { describe, expect, it } from 'vitest'
import { PHASE_COPY } from './onboarding.ts'
import { D_BASE, entropy } from '../sim/entropy.ts'
import { ENTROPY_LABELS, entropyLabel, entropyReadout, isSeized } from './vocabulary.ts'

describe('the player never reads the word "entropy" — GDD §4.3a', () => {
  it('is absent from every label on the ladder', () => {
    for (const { label } of ENTROPY_LABELS) {
      expect(label.toLowerCase()).not.toContain('entropy')
    }
  })

  it('is absent from every line of the §21 script', () => {
    // The script is the largest body of player-facing copy in the product and
    // the easiest place for the internal word to leak back in.
    const copy = Object.values(PHASE_COPY).flatMap((c) => [
      ...(c.terminal ?? []),
      c.bubble ?? '',
      c.advisor ?? '',
      c.action ?? '',
    ])
    const leaked = copy.filter((line) => /entropy/i.test(line))
    expect(leaked).toEqual([])
  })
})

describe('the escalation ladder — GDD §4.3a', () => {
  it('names every level, including the ends', () => {
    // A HUD element that sometimes has no label is one that jitters in width,
    // which ART_DIRECTION §3 rule 3 forbids.
    for (const e of [0, 0.5, 0.99, 1, 2, -1, Number.NaN]) {
      expect(entropyLabel(e)).toBeTruthy()
    }
  })

  it('escalates as the studio degrades — the free drama', () => {
    expect(entropyLabel(0.005)).toBe('IN SYNC')
    expect(entropyLabel(0.03)).toBe('CHATTY')
    expect(entropyLabel(0.3)).toBe('BOGGED DOWN')
    expect(entropyLabel(0.5)).toBe('PRODUCTIVITY BREAKDOWN')
    expect(entropyLabel(0.85)).toBe('TOTAL GRIDLOCK')
    expect(entropyLabel(0.95)).toBe('MELTDOWN')
    expect(entropyLabel(0.999)).toBe('STUDIO SEIZED')
  })

  it('reaches CHATTY inside the §21.0 loop — Appendix C #14', () => {
    // The bug this pins: bands spread evenly over 0-100% left five of seven
    // labels unreachable in Run 1, because the load curve keeps E under 3%
    // until ~50 developers. A player must meet CHATTY during the earn-and-hire
    // loop, dismiss it, and only then be offered the trap.
    expect(entropyLabel(entropy(40, D_BASE))).toBe('CHATTY')
    expect(entropyLabel(entropy(50, D_BASE))).toBe('CHATTY')
    // ...and must NOT meet it while hiring is still teaching them it works.
    expect(entropyLabel(entropy(10, D_BASE))).toBe('IN SYNC')
  })

  it('never goes backwards as E climbs', () => {
    let seen = -1
    for (let e = 0; e <= 1.2; e += 0.005) {
      const index = ENTROPY_LABELS.findIndex((b) => b.label === entropyLabel(e))
      expect(index).toBeGreaterThanOrEqual(seen)
      seen = index
    }
  })
})

describe('the readout — GDD §4.3a', () => {
  it('always shows the number beside the word', () => {
    // The escalating word is drama; the percentage is the honest reading.
    // Hiding it would turn the HUD into a mood ring.
    expect(entropyReadout(0.5)).toBe('PRODUCTIVITY BREAKDOWN 50%')
    expect(entropyReadout(0.005)).toMatch(/^IN SYNC \d+%$/)
  })

  it('keeps a decimal in the last stretch, where 99.0 and 99.9 differ', () => {
    expect(entropyReadout(0.99)).toBe('STUDIO SEIZED 99.0%')
    expect(entropyReadout(0.999)).toBe('STUDIO SEIZED 99.9%')
  })
})

describe('isSeized', () => {
  it('matches the §4.3 lock threshold the script advances on', () => {
    expect(isSeized(0.989)).toBe(false)
    expect(isSeized(0.99)).toBe(true)
  })
})
