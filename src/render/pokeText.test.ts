import { describe, expect, it } from 'vitest'
import { pokeTextOffsets } from './pokeText.ts'

describe('poke numeral and snippet layout', () => {
  it('always leaves a visible gap between the numeral and code', () => {
    const smallest = pokeTextOffsets(20, () => 0)
    const largest = pokeTextOffsets(20, () => 1)

    expect(smallest.snippetY - (smallest.numeralY + 20)).toBeGreaterThanOrEqual(18)
    expect(largest.snippetY - (largest.numeralY + 20)).toBeGreaterThanOrEqual(18)
  })

  it('varies both pieces horizontally and vertically between draws', () => {
    const low = pokeTextOffsets(20, () => 0)
    const high = pokeTextOffsets(20, () => 1)

    expect(low.numeralX).not.toBe(high.numeralX)
    expect(low.numeralY).not.toBe(high.numeralY)
    expect(low.snippetX).not.toBe(high.snippetX)
    expect(low.snippetY).not.toBe(high.snippetY)
  })
})
