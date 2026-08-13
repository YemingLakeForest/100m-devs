import { describe, expect, it } from 'vitest'
import { newHero } from '../sim/heroes.ts'
import { unitFootprint } from './heroBadges.ts'

describe('§13.11.1 — who covers this?', () => {
  it('folds each hero to a coverage claim over the unit', () => {
    const fp = unitFootprint(
      [
        { heroId: 'mo', branch: 'quality', state: newHero('james') },
        { heroId: 'melany', branch: 'cloud', state: newHero('james') },
      ],
      8,
    )
    expect(fp.claims).toHaveLength(2)
    for (const claim of fp.claims) expect(claim.fraction).toBeGreaterThan(0)
  })

  it('cross-hatches when two heroes of one branch overlap — §13.8 rule 3', () => {
    const fp = unitFootprint(
      [
        { heroId: 'a', branch: 'quality', state: newHero('james') },
        { heroId: 'b', branch: 'quality', state: newHero('james') },
        { heroId: 'c', branch: 'cloud', state: newHero('james') },
      ],
      8,
    )
    expect(fp.overlapped.has('quality')).toBe(true)
    expect(fp.overlapped.has('cloud')).toBe(false)
  })

  it('flags nothing wasted on a unit with one hero per branch', () => {
    const fp = unitFootprint(
      [
        { heroId: 'mo', branch: 'quality', state: newHero('james') },
        { heroId: 'serena', branch: 'reliability', state: newHero('james') },
      ],
      8,
    )
    expect(fp.overlapped.size).toBe(0)
  })
})
