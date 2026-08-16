import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EventBanner, EventCard } from './EventCard.tsx'
import { THREAD, beginEvent, routeEvent } from '../sim/events.ts'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))

afterEach(cleanup)

const unrouted = { live: beginEvent(THREAD), def: THREAD }
const routed = { live: routeEvent(beginEvent(THREAD)), def: THREAD }

describe('§18.0a — the card is mandatory', () => {
  it('offers two exits and no third one', () => {
    render(<EventCard event={unrouted} onRoute={() => {}} onReply={() => {}} />)
    expect(screen.getByRole('button', { name: THREAD.routeLabel })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /REPLY TO ALL/ })).toBeInTheDocument()
    // No dismiss, no close, no later. Both ways off this card are decisions.
    expect(screen.queryByRole('button', { name: /CLOSE|LATER|DISMISS|SKIP/i })).toBeNull()
  })

  it('says what it costs, in the machine’s own words', () => {
    render(<EventCard event={unrouted} onRoute={() => {}} onReply={() => {}} />)
    expect(screen.getByText(THREAD.name)).toBeInTheDocument()
    expect(screen.getByText(THREAD.headline)).toBeInTheDocument()
  })

  /**
   * Trap 31 — `{n}{' '}{word}` gives `Button` two children and the JSX
   * whitespace between two expressions is not in the computed accessible name,
   * so a label built that way renders correctly and is unfindable by role. The
   * count is in one template string, and this is the test that says so.
   */
  it('puts the tap count in the button’s accessible name', () => {
    render(<EventCard event={unrouted} onRoute={() => {}} onReply={() => {}} />)
    expect(
      screen.getByRole('button', { name: `REPLY TO ALL · ${THREAD.clearTaps}` }),
    ).toBeInTheDocument()
  })

  it('stands down once the player has chosen', () => {
    // Not gone — the banner takes over. What has gone is the scrim.
    const { container } = render(
      <EventCard event={routed} onRoute={() => {}} onReply={() => {}} />,
    )
    expect(container.querySelector('.ui-scrim[data-phase="in"]')).toBeNull()
  })

  it('fires the exit the player pressed', () => {
    const onRoute = vi.fn()
    const onReply = vi.fn()
    render(<EventCard event={unrouted} onRoute={onRoute} onReply={onReply} />)
    fireEvent.click(screen.getByRole('button', { name: THREAD.routeLabel }))
    expect(onRoute).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: /REPLY TO ALL/ }))
    expect(onReply).toHaveBeenCalledOnce()
  })
})

describe('the banner is what "still happening" looks like', () => {
  it('draws nothing until the player has chosen an exit', () => {
    const { container } = render(
      <EventBanner event={unrouted} onRoute={() => {}} onReply={() => {}} />,
    )
    expect(container.querySelector('.event-banner')).toBeNull()
  })

  it('draws nothing at all when the floor is quiet', () => {
    const { container } = render(<EventBanner event={null} onRoute={() => {}} onReply={() => {}} />)
    expect(container.querySelector('.event-banner')).toBeNull()
  })

  it('keeps both exits, so nothing the player chose becomes the only option', () => {
    render(<EventBanner event={routed} onRoute={() => {}} onReply={() => {}} />)
    expect(screen.getByRole('button', { name: THREAD.routeLabel })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /REPLY TO ALL/ })).toBeInTheDocument()
  })

  it('states the cost the speedometer cannot explain', () => {
    render(<EventBanner event={routed} onRoute={() => {}} onReply={() => {}} />)
    expect(screen.getByText(`OUTPUT ${Math.round(THREAD.ceiling * 100)}%`)).toBeInTheDocument()
  })

  it('counts down as replies land', () => {
    const half = { live: { ...routed.live, remaining: 7 }, def: THREAD }
    render(<EventBanner event={half} onRoute={() => {}} onReply={() => {}} />)
    expect(screen.getByRole('button', { name: 'REPLY TO ALL · 7' })).toBeInTheDocument()
  })
})
