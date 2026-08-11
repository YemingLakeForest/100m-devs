import { describe, expect, it } from 'vitest'
import { pokeTextOffsets } from './pokeText.ts'

describe('poke numeral and snippet layout', () => {
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
