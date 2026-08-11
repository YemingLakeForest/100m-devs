import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConceptText } from './ConceptText.tsx'

describe('semantic concept colours', () => {
  it('assigns one stable class to every spelling and casing of a concept', () => {
    const { container } = render(
      <ConceptText text="STORY POINTS, story point, UPGRADES, upgrade, HEROES, hero, CASH, DEVS, developer, ENTROPY, VELOCITY" />,
    )

    expect([...container.querySelectorAll('.kw--story')].map((node) => node.textContent)).toEqual([
      'STORY POINTS',
      'story point',
    ])
    expect([...container.querySelectorAll('.kw--upgrades')].map((node) => node.textContent)).toEqual([
      'UPGRADES',
      'upgrade',
    ])
    expect([...container.querySelectorAll('.kw--heroes')].map((node) => node.textContent)).toEqual([
      'HEROES',
      'hero',
    ])
    expect(container.querySelector('.kw--cash')?.textContent).toBe('CASH')
    expect([...container.querySelectorAll('.kw--devs')].map((node) => node.textContent)).toEqual([
      'DEVS',
      'developer',
    ])
    expect(container.querySelector('.kw--entropy')?.textContent).toBe('ENTROPY')
    expect(container.querySelector('.kw--velocity')?.textContent).toBe('VELOCITY')
  })

  it('keeps a concept coloured while a typewriter reveals only part of it', () => {
    const { container } = render(<ConceptText text="STORY POINTS" to={5} />)
    expect(container.querySelector('.kw--story')?.textContent).toBe('STORY')
  })
})
