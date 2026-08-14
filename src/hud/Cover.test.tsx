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

  it('fills the glyph in one accent colour', () => {
    const { container } = render(
      <Cover spec={coverFor(1, 0, 50, 'Untitled Roguelike Deckbuilder')} />,
    )
    const glyph = container.querySelectorAll('.cover__glyph')
    expect(glyph.length).toBeGreaterThan(0)
    const fills = new Set(Array.from(glyph).map((r) => r.getAttribute('fill')))
    expect(fills.size).toBe(1)
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
