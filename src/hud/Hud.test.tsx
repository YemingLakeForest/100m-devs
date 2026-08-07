import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { __resetStore, jumpToPhase } from '../game/store.ts'
import { Hud } from './Hud.tsx'

// The kit's sound bank goes through the native path, which has no business
// being loaded by a layout test.
vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))

afterEach(() => {
  cleanup()
  __resetStore()
})

/**
 * `Panel` defers its entrance by one frame — see the note in Panel.tsx: the
 * keyframe has to start from insertion, so the mount is scheduled on rAF rather
 * than done inline. A test that opens something therefore has to let a frame
 * pass before it can see it, which is the animation existing rather than a race.
 */
async function frame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  })
}

/**
 * §10.8 F1 — "anything pops in or out". The single named failure condition, and
 * the one that is invisible to whoever built the feature.
 *
 * The mechanism behind every instance of it is the same: React unmounts an
 * element the frame its condition goes false, so there is nothing left to
 * animate out. These assert that every surface in the HUD that comes and goes
 * is doing it through `Panel`, which owns that problem.
 */
describe('§10.8 F1 — nothing enters or leaves without motion', () => {
  it('brings the action button in on a panel rather than mounting it bare', () => {
    jumpToPhase('act2_offer_hire')
    const { container } = render(<Hud stage={null} />)

    const panel = container.querySelector('.hud__actions')
    expect(panel).not.toBeNull()
    expect(panel?.className).toContain('ui-panel')
    expect(panel?.getAttribute('data-phase')).toBe('in')
  })

  it('keeps the button on screen, mid-exit, after the beat it belonged to ends', () => {
    // This is the regression. The button used to be mounted by a switch on the
    // phase, so it vanished on the frame the phase flipped — F1 by the letter,
    // on the most important control in the game.
    jumpToPhase('act2_offer_hire')
    const { container } = render(<Hud stage={null} />)
    expect(screen.getByRole('button', { name: /HIRE DEVELOPER/ })).toBeInTheDocument()

    act(() => jumpToPhase('act2_ship'))

    const panel = container.querySelector('.hud__actions')
    expect(panel?.getAttribute('data-phase')).toBe('exit')
    // Still holding its content — an empty box sliding away is F1 with extra
    // steps, so the spec is latched through the exit.
    expect(panel?.textContent).toContain('HIRE DEVELOPER')
  })

  it('brings the bankruptcy screen in through a modal panel, over a live HUD', () => {
    jumpToPhase('bankrupt')
    const { container } = render(<Hud stage={null} />)

    const panel = container.querySelector('.bankruptcy')
    expect(panel?.getAttribute('data-phase')).toBe('in')
    // Semi-transparent and blurred, never an opaque sheet (§10.6).
    expect(container.querySelector('.ui-scrim')).not.toBeNull()
    // And the studio is still behind it, still reading out — the previous
    // version replaced the whole tree, so every readout on screen cut out in
    // one frame while the modal animated up over nothing.
    expect(container.querySelector('.hud__resources')).not.toBeNull()
    expect(container.querySelector('.burndown')).not.toBeNull()
  })

  it('has no bankruptcy panel in the tree before the run ends', () => {
    const { container } = render(<Hud stage={null} />)
    expect(container.querySelector('.bankruptcy')).toBeNull()
  })

  it('slides the speech bubble in rather than blinking it on', async () => {
    jumpToPhase('act3_bait')
    const { container } = render(<Hud stage={null} />)
    expect(container.querySelector('.hud__bubble')).toBeNull()

    // The Mass Hire is one of the three store verbs this layer may call, and
    // it sets a bubble, so it is the cheapest way to make one appear.
    fireEvent.click(screen.getByRole('button', { name: /HIRE 1,000/ }))
    await frame()

    const bubble = container.querySelector('.hud__bubble')
    expect(bubble?.className).toContain('ui-panel')
    expect(bubble?.getAttribute('data-phase')).toBe('in')
  })
})

/**
 * §10.8 F2 — "press and hold every interactive element without releasing. If
 * nothing changed, fail."
 */
describe('§10.8 F2 — every control answers the finger first', () => {
  it('depresses the Act II hire button on pointer-down', () => {
    jumpToPhase('act2_offer_hire')
    render(<Hud stage={null} />)

    const btn = screen.getByRole('button', { name: /HIRE DEVELOPER/ })
    fireEvent.pointerDown(btn)
    expect(btn.className).toContain('is-pressed')
  })

  it('depresses the Act III mousetrap, and keeps it begging', () => {
    jumpToPhase('act3_bait')
    render(<Hud stage={null} />)

    const btn = screen.getByRole('button', { name: /HIRE 1,000/ })
    expect(btn.className).toContain('ui-btn--bait')
    fireEvent.pointerDown(btn)
    expect(btn.className).toContain('is-pressed')
  })

  it('depresses the upgrades tab', () => {
    render(<Hud stage={null} />)
    const btn = screen.getByRole('button', { name: /UPGRADES/ })
    fireEvent.pointerDown(btn)
    expect(btn.className).toContain('is-pressed')
  })
})

/** GDD §11 has no tech tree yet, so the door has to be honest about it. */
describe('the upgrades entry point', () => {
  it('is present from the first frame, before anything is buyable', () => {
    render(<Hud stage={null} />)
    expect(screen.getByRole('button', { name: /UPGRADES/ })).toBeInTheDocument()
  })

  it('opens a drawer from the edge its button lives on, and closes again', async () => {
    const { container } = render(<Hud stage={null} />)
    expect(container.querySelector('.hud__upgrades')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /UPGRADES/ }))
    await frame()

    const drawer = container.querySelector('.hud__upgrades')
    // §10.5 rule 1 — enters from the edge it belongs to, exits back toward it.
    expect(drawer?.className).toContain('ui-panel--right')
    expect(drawer?.getAttribute('data-phase')).toBe('in')
    expect(drawer?.textContent).toContain('COMMUNICATION TECH TREE')

    fireEvent.click(screen.getByRole('button', { name: /BACK/ }))
    expect(container.querySelector('.hud__upgrades')?.getAttribute('data-phase')).toBe('exit')
  })

  it('is a drawer, not a modal — the swarm stays visible and pokeable beside it', async () => {
    const { container } = render(<Hud stage={null} />)
    fireEvent.click(screen.getByRole('button', { name: /UPGRADES/ }))
    await frame()
    expect(container.querySelector('.ui-scrim')).toBeNull()
  })
})

/** GDD §10.1 / §10.2 — what the HUD is actually obliged to say. */
describe('the readouts', () => {
  it('shows cash, headcount, velocity, the project and the speedometer at once', () => {
    const { container } = render(<Hud stage={null} />)
    const text = container.textContent ?? ''

    expect(text).toContain('CASH')
    expect(text).toContain('DEVS')
    expect(text).toContain('VELOCITY')
    expect(text).toContain('PROJECT')
    expect(text).toContain('SP LEFT')
    // §4.3a's ladder, at its bottom rung.
    expect(text).toContain('IN SYNC')
  })

  it('shows projects shipped, which had no readout at all', () => {
    const { container } = render(<Hud stage={null} />)
    expect(container.textContent).toContain('SHIPPED')
  })

  it('never prints the word the player is not allowed to read — §4.3a', () => {
    // Checked at the bottom of the ladder and at the top, because the label is
    // the one string in the HUD that changes with the model's own variable.
    for (const phase of ['act1_poke', 'act5_bleeding'] as const) {
      cleanup()
      jumpToPhase(phase)
      const { container } = render(<Hud stage={null} />)
      expect((container.textContent ?? '').toLowerCase()).not.toContain('entropy')
    }
  })

  it('states the scale exactly when one on-screen unit stops being one person', () => {
    // §7.7.5: a picture whose units silently changed is a lie. Silent below
    // 1,000 developers, where one sprite is one person and "1 PERSON = 1 DEVS"
    // would be noise — and speaking the moment the Mass Hire lands the studio
    // on rung 3, which is the one rung crossing Run 1 actually contains.
    const { container, rerender } = render(<Hud stage={null} />)
    expect(container.querySelector('.hud__scale')).toBeNull()

    act(() => jumpToPhase('act5_bleeding'))
    rerender(<Hud stage={null} />)
    expect(container.querySelector('.hud__scale')?.textContent).toBe('1 FLOOR = 1.0 K DEVS')
  })

  it('adds the burn and the runway once payroll starts — §21 Act V', () => {
    jumpToPhase('act5_bleeding')
    const { container } = render(<Hud stage={null} />)
    const text = container.textContent ?? ''

    expect(text).toContain('/SEC')
    expect(text).toContain('TO BANKRUPTCY')
  })

  it('keeps both of them off screen while the founders are still in the garage', () => {
    jumpToPhase('act2_ship')
    const { container } = render(<Hud stage={null} />)
    const text = container.textContent ?? ''

    expect(text).not.toContain('TO BANKRUPTCY')
    expect(container.querySelector('.hud__sub.is-bad')).toBeNull()
  })
})

/**
 * §7.1 — the UI is a Layer. The renderer's tap handling listens on the canvas
 * underneath the HUD, so anything here that takes pointer events without
 * needing them puts a dead patch on the simulation.
 */
describe('the Layer', () => {
  it('assigns every element a grid area of its own', () => {
    // Grid stacks children happily. The previous revision shared one area
    // between the burn-down and the terminal banner, and another between the
    // advisor and the action button, and both pairs rendered on top of each
    // other at landscape aspects.
    jumpToPhase('act3_bait')
    const { container } = render(<Hud stage={null} />)
    const hud = container.querySelector('.hud')!

    const areas = [...hud.children]
      .map((el) => el.className.split(' ').find((c) => c.startsWith('hud__')))
      .filter(Boolean)

    expect(new Set(areas).size).toBe(areas.length)
  })
})
