import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Cover } from './Cover.tsx'
import { coverFor } from '../sim/cover.ts'

afterEach(cleanup)

describe('§10.11.3 — the generated cover tile', () => {
  it('draws a 48×48 tile on the integer grid', () => {
    const { container } = render(<Cover spec={coverFor(1, 0, 50, 'Flappy Square 1.0')} />)
    const svg = container.querySelector('svg.cover')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('viewBox')).toBe('0 0 48 48')
    expect(svg!.getAttribute('shape-rendering')).toBe('crispEdges')
  })

  it('tints the frame by the rating band', () => {
    const low = render(<Cover spec={coverFor(1, 0, 10, 'Flappy Square 1.0')} />).container.querySelector(
      '.cover__frame',
    )!
    const high = render(<Cover spec={coverFor(1, 0, 95, 'Flappy Square 1.0')} />).container.querySelector(
      '.cover__frame',
    )!
    expect(low.getAttribute('fill')).not.toBe(high.getAttribute('fill'))
  })

  /**
   * The change that made the covers stop reading as random pixel blocks.
   *
   * A shape filled in one colour is a symbol; the second tone is what the eye
   * reads as *form*. This asserted `size === 1` for the flat silhouette it
   * replaced, and the inverted claim is the one worth keeping — the art is two
   * tones of the genre's own accent, and no more, so a cover can never acquire
   * a colour the palette does not carry.
   */
  it('draws the key art in exactly the genre’s light and shade', () => {
    const { container } = render(
      <Cover spec={coverFor(1, 0, 50, 'Untitled Roguelike Deckbuilder')} />,
    )
    const glyph = container.querySelectorAll('.cover__glyph')
    expect(glyph.length).toBeGreaterThan(40)
    const fills = new Set(Array.from(glyph).map((r) => r.getAttribute('fill')))
    expect(fills.size).toBe(2)
  })

  it('composes a scene rather than a mark on a field', () => {
    // Sky, ground, an inner rule, a title plate — whatever the layout rolled,
    // there is always *something* under the subject. A tile with no scene is
    // the icon-on-a-background this composition exists to stop being.
    const { container } = render(<Cover spec={coverFor(3, 11, 62, 'Cozy Farming Sim')} />)
    expect(container.querySelectorAll('.cover__scene').length).toBeGreaterThan(3)
  })

  // A hundred and twenty real renders. The default five seconds is vitest's
  // number rather than a considered budget for that, and it made this the one
  // test in the suite that failed on a loaded machine and passed on its own.
  it('keeps every rectangle inside the tile', { timeout: 30_000 }, () => {
    // The art is placed by its baseline and its bounding box, which is exactly
    // the arithmetic that can push a tall sprite out through the frame.
    for (let ordinal = 0; ordinal < 120; ordinal += 1) {
      const { container, unmount } = render(
        <Cover spec={coverFor(31, ordinal, (ordinal * 7) % 100, 'Some Game')} />,
      )
      for (const rect of container.querySelectorAll('rect')) {
        const x = Number(rect.getAttribute('x'))
        const y = Number(rect.getAttribute('y'))
        const w = Number(rect.getAttribute('width'))
        const h = Number(rect.getAttribute('height'))
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x + w).toBeLessThanOrEqual(48)
        expect(y + h).toBeLessThanOrEqual(48)
      }
      unmount()
    }
  })

  it('is deterministic for the same spec', () => {
    const spec = coverFor(7, 3, 50, 'Open-World Survival Craft (Early Access)')
    expect(render(<Cover spec={spec} />).container.innerHTML).toBe(
      render(<Cover spec={spec} />).container.innerHTML,
    )
  })

  it('draws a different glyph for a different genre', () => {
    const rocket = render(<Cover spec={coverFor(1, 0, 50, 'Flappy Square 1.0')} />).container
    const die = render(<Cover spec={coverFor(1, 0, 50, 'Untitled Roguelike Deckbuilder')} />).container
    expect(rocket.querySelectorAll('.cover__glyph').length).not.toBe(
      die.querySelectorAll('.cover__glyph').length,
    )
  })
})
