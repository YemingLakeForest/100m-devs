import { describe, expect, it } from 'vitest'
import { pokeTextOffsets } from './pokeText.ts'

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
