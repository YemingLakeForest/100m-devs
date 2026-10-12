import { describe, expect, it } from 'vitest'
import { numeralFace, pokeTextOffsets, type PokeFloater } from './pokeText.ts'

const floater = (over: Partial<PokeFloater> = {}): PokeFloater => ({
  id: 1, sp: 8, x: 0, y: 0, crit: false, bornAt: 0, snippet: null, unblocked: false, ...over,
})

describe('numeral face', () => {
  it('keeps a crit bigger than an ordinary tap at every yield', () => {
    for (const sp of [1, 10, 1_000, 1e9]) {
      expect(numeralFace(floater({ sp, crit: true }), 500).settled).toBeGreaterThan(numeralFace(floater({ sp }), 500).settled)
    }
  })

  it('keeps background output smaller than a tap at the same yield', () => {
    for (const sp of [1, 10, 1_000, 1e9]) {
      expect(numeralFace(floater({ sp, passive: true }), 500).settled).toBeLessThan(numeralFace(floater({ sp }), 500).settled)
    }
  })

  it('grows with what the numeral carries', () => {
    expect(numeralFace(floater({ sp: 5_000 }), 500).settled).toBeGreaterThan(numeralFace(floater({ sp: 5 }), 500).settled)
    expect(numeralFace(floater({ sp: 5_000, passive: true }), 500).settled).toBeGreaterThan(numeralFace(floater({ sp: 5, passive: true }), 500).settled)
  })

  it('arrives small, overshoots and rests at its settled size, which the pop never moves', () => {
    const f = floater({ sp: 8, bornAt: 1_000 })
    const settled = numeralFace(f, 1_000).settled
    expect(numeralFace(f, 1_000).shown).toBeLessThan(settled)
    expect(numeralFace(f, 1_080).shown).toBeGreaterThan(settled)
    expect(numeralFace(f, 1_300).shown).toBe(settled)
    for (const now of [1_000, 1_040, 1_080, 1_300]) expect(numeralFace(f, now).settled).toBe(settled)
  })

  it('does not pop under reduced motion, for taps or for background output', () => {
    expect(numeralFace(floater({ bornAt: 0 }), 0, true).shown).toBe(numeralFace(floater({ bornAt: 0 }), 0, true).settled)
    expect(numeralFace(floater({ passive: true, still: true }), 0).shown).toBe(numeralFace(floater({ passive: true, still: true }), 0).settled)
  })
})

describe('poke numeral and snippet layout', () => {
  it('launches every code line just above the head, in a compact band', () => {
    const lanes = Array.from({ length: 5 }, (_, i) => pokeTextOffsets(30, i))
    for (const lane of lanes) expect(lane.snippetY + 12).toBeLessThan(0)
    expect(Math.max(...lanes.map(l => l.numeralY)) - Math.min(...lanes.map(l => l.numeralY))).toBeLessThan(30)
  })
  it('always leaves a visible gap between the numeral and code', () => {
    const first = pokeTextOffsets(20, 0)
    const last = pokeTextOffsets(20, 4)

    expect(first.snippetY - (first.numeralY + 20)).toBe(8)
    expect(last.snippetY - (last.numeralY + 20)).toBe(8)
  })

  it('keeps the snippet registered to the numeral in every lane', () => {
    for (let sequence = 0; sequence < 20; sequence++) {
      const offsets = pokeTextOffsets(20, sequence)
      expect(offsets.snippetX).toBe(offsets.numeralX)
      expect(offsets.snippetY).toBe(offsets.numeralY + 28)
    }
  })

  it('never puts two subsequent callouts in the same location', () => {
    for (let sequence = 0; sequence < 20; sequence++) {
      const current = pokeTextOffsets(20, sequence)
      const next = pokeTextOffsets(20, sequence + 1)
      expect([next.numeralX, next.numeralY]).not.toEqual([current.numeralX, current.numeralY])
    }
  })
})
