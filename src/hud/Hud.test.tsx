import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  __resetStore,
  __setState,
  baseVelocity,
  getState,
  jumpToPhase,
  poke,
  pokeVelocity,
  showScene,
  tick,
} from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import {
  SCENE_MATT_ARRIVES,
  SCENE_MO_ARRIVES,
  SCENE_SERENA_ARRIVES,
  SCENE_THREAD_CLEARED,
} from '../game/scenes.ts'
import { Hud } from './Hud.tsx'

/**
 * §21.0c — a player who has already been through the trap.
 *
 * Roles, the three backlogs and the upgrade board are all gated on the first
 * Paradigm Shift, so a test about any of them has to say which side of it the
 * player is on. Saying so out loud is the point: a test rendering the HUD at
 * `paradigmShifts: 0` is testing **Run 1's** frame, and Run 1's frame is
 * deliberately almost empty.
 */
function prestiged() {
  const p = emptyPermanent()
  setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1 } })
}

/**
 * §21.7.6 — prestiged, *and* the named heroes have walked through their doors.
 *
 * An arrival is its scene id in `milestones` (§24.3), which is the same list
 * `hasSeenScene` reads: one source of truth, and no second flag to disagree
 * with it after a merge.
 */
function withHeroes(...scenes: { id: string }[]) {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    meta: { ...p.meta, paradigmShifts: 1, milestones: scenes.map((s) => s.id) },
  })
}

// The kit's sound bank goes through the native path, which has no business
// being loaded by a layout test. `sfx.ts` joined the list when the ship
// celebration started scoring itself: it pulls in the Capacitor native-audio
// plugin, which throws at import time under jsdom.
vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))

afterEach(() => {
  cleanup()
  __resetStore()
  // The unlock lives in permanent state, so it leaks between tests unless it is
  // put back — and the failure would be a Run 1 test quietly passing because an
  // earlier test had prestiged.
  setPermanent(emptyPermanent())
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
    // §21.0e — the hire control does not exist in Run 1, so a test about it has
    // to be about a player who has been through the trap.
    prestiged()
    jumpToPhase('act2_loop')
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
    prestiged()
    jumpToPhase('act2_loop')
    const { container } = render(<Hud stage={null} />)
    expect(screen.getByRole('button', { name: /HIRE DEVELOPER/ })).toBeInTheDocument()

    act(() => jumpToPhase('act4_collapse'))

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
  it('depresses the hire button on pointer-down', () => {
    prestiged()
    jumpToPhase('act2_loop')
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
    prestiged()
    render(<Hud stage={null} />)
    const btn = screen.getByRole('button', { name: /UPGRADES/ })
    fireEvent.pointerDown(btn)
    expect(btn.className).toContain('is-pressed')
  })
})

/**
 * §21.0c — **what Act I's frame contains, said as an inventory.**
 *
 * The gate lives in `unlocks.ts` and its simulation half is pinned in
 * `backlogs.test.ts`. This is the third place it has to hold: what a first-time
 * player actually sees. Written as "these things are absent" rather than as
 * "these things are present", because the failure mode is additive — every one
 * of the readouts below was added to Act I by somebody building a feature that
 * was correct in isolation.
 */
describe('§21.0c — Act I shows one lever', () => {
  it('offers no job but developer, whatever the studio has been through', () => {
    // `jumpToPhase` replaces the whole run — it is a seam for reaching a beat,
    // not a patch — so the state it is being asked about has to go on after it.
    jumpToPhase('act2_loop')
    // The conditions in `rolesAvailable` are all satisfied: a defect bench, a
    // shipped catalogue, a live incident. In Run 1 none of them opens a row.
    __setState({
      defects: 40,
      projectsShipped: 3,
      incidents: [{ id: 1, releaseId: 1, releaseName: 'Flappy Square', age: 1, work: 10 }],
    })
    render(<Hud stage={null} />)

    expect(screen.queryByRole('button', { name: 'QA' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'SRE' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'SUPPORT' })).toBeNull()
  })

  it('shows no backlog, even holding one', () => {
    __setState({
      defects: 40,
      projectsShipped: 3,
      tickets: 900,
      incidents: [{ id: 1, releaseId: 1, releaseName: 'Flappy Square', age: 1, work: 10 }],
    })
    const { container } = render(<Hud stage={null} />)
    expect(container.querySelector('.backlog')).toBeNull()
  })

  it('opens the tree the moment the player prestiges', () => {
    // The same state, one Paradigm Shift apart — so this is a gate rather than a
    // feature that was never wired.
    prestiged()
    jumpToPhase('act2_loop')
    __setState({ defects: 40, projectsShipped: 3, tickets: 900 })
    render(<Hud stage={null} />)
    expect(screen.getByRole('button', { name: /UPGRADES/ })).toBeInTheDocument()
  })

  /**
   * §21.7.6 — **the shift is the floor, not the ceiling.**
   *
   * This test used to assert that everything appeared on the frame of the
   * prestige, which was right when the shift was the only gate. It is now the
   * evidence for the second one: the mechanism runs (the state below holds forty
   * defects, nine hundred tickets and an open incident), and not one of the
   * three instruments is drawn, because nobody has arrived holding it.
   */
  it('still shows no backlog after the shift, until somebody brings one', () => {
    prestiged()
    jumpToPhase('act2_loop')
    __setState({
      defects: 40,
      projectsShipped: 3,
      tickets: 900,
      incidents: [{ id: 1, releaseId: 1, releaseName: 'Flappy Square', age: 1, work: 10 }],
    })
    const { container } = render(<Hud stage={null} />)

    expect(container.querySelector('.backlog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'QA' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'SRE' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'SUPPORT' })).toBeNull()
  })

  it('draws each colour when its own hero sits down, and no others', () => {
    withHeroes(SCENE_MO_ARRIVES)
    jumpToPhase('act2_loop')
    __setState({
      defects: 40,
      projectsShipped: 3,
      tickets: 900,
      incidents: [{ id: 1, releaseId: 1, releaseName: 'Flappy Square', age: 1, work: 10 }],
    })
    const { container } = render(<Hud stage={null} />)

    // Mo brings defects, and the role that answers them.
    expect(container.querySelectorAll('.backlog').length).toBe(1)
    expect(screen.getByRole('button', { name: 'QA' })).toBeInTheDocument()
    // Serena and Matt have not arrived, so neither has their bar.
    expect(screen.queryByRole('button', { name: 'SRE' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'SUPPORT' })).toBeNull()
  })

  it('completes the set once all three have arrived — §21.7.6b', () => {
    withHeroes(SCENE_MO_ARRIVES, SCENE_SERENA_ARRIVES, SCENE_MATT_ARRIVES)
    jumpToPhase('act2_loop')
    __setState({
      defects: 40,
      projectsShipped: 3,
      tickets: 900,
      incidents: [{ id: 1, releaseId: 1, releaseName: 'Flappy Square', age: 1, work: 10 }],
    })
    const { container } = render(<Hud stage={null} />)

    expect(container.querySelectorAll('.backlog').length).toBe(3)
    expect(screen.getByRole('button', { name: 'QA' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SRE' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SUPPORT' })).toBeInTheDocument()
  })
})

/** GDD §11 — the door, and the tree that now stands behind it. */
describe('the upgrades entry point', () => {
  beforeEach(prestiged)

  /**
   * §21.0c — **there is no upgrade screen during Run 1.**
   *
   * This test used to read "is present from the first frame, before anything is
   * buyable", and the argument for that was §10.6: a door that appears partway
   * through is a door the player has to notice. It is the right argument about
   * the wrong door. Run 1's entire claim is that there is one lever and it is
   * hiring, and an UPGRADES button is the interface promising a second one —
   * §13.2's PARADIGM button has been hidden on exactly this reasoning since it
   * was written, and this now joins it.
   */
  it('does not exist during Run 1', () => {
    setPermanent(emptyPermanent())
    render(<Hud stage={null} />)
    expect(screen.queryByRole('button', { name: /UPGRADES/ })).toBeNull()
    // MENU is right beside it and is not gated, so this is the door being shut
    // rather than the whole nav failing to render.
    expect(screen.getByRole('button', { name: 'MENU' })).toBeInTheDocument()
  })

  it('is present from the first frame of Run 2, before anything is buyable', () => {
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
    // §11.4 — the tree is a centre-out board now, and the centre is Instant
    // Messenger, given rather than sold.
    expect(drawer?.textContent).toContain('Instant Messenger')
    expect(drawer?.querySelector('.upgrade-board__node[data-owned="true"]')).not.toBeNull()

    // §10.6a — the way out is the close box in the window's title bar, named
    // CLOSE, in the corner every window in the product now puts it.
    fireEvent.click(screen.getByRole('button', { name: 'CLOSE' }))
    expect(container.querySelector('.hud__upgrades')?.getAttribute('data-phase')).toBe('exit')
  })

  it('reveals the next purchase and keeps far nodes as a stub — §11.4.2', async () => {
    const { container } = render(<Hud stage={null} />)
    fireEvent.click(screen.getByRole('button', { name: /UPGRADES/ }))
    await frame()

    const drawer = container.querySelector('.hud__upgrades')
    // A node one step from the centre is visible as a silhouette.
    expect(drawer?.querySelector('.upgrade-board__node[data-state="silhouette"]')).not.toBeNull()
    // Further out, the board's shape is still there — a stub, never nothing.
    expect(drawer?.querySelector('.upgrade-board__node[data-state="dark"]')).not.toBeNull()
    expect(drawer?.querySelector('.upgrade-board__stub')).not.toBeNull()
  })

  it('prices a node the player cannot yet afford rather than offering a dead button', async () => {
    __setState({ cash: 0 })
    const { container } = render(<Hud stage={null} />)
    fireEvent.click(screen.getByRole('button', { name: /UPGRADES/ }))
    await frame()

    // §11.4.2 — the next purchase carries its price as a silhouette, no text,
    // and no buy control that would just refuse the player.
    const silhouette = container.querySelector('.upgrade-board__node[data-state="silhouette"]')
    expect(silhouette).not.toBeNull()
    expect(silhouette?.textContent).toMatch(/\$/)
  })

  /**
   * §11.5 — Instant Messenger has **no price and no button**. An enabled control
   * that cannot do anything is worse than no control, and a disabled one priced
   * at $0 reads as a bug rather than as a gift.
   */
  it('never offers the granted node for sale, at any price', async () => {
    __setState({ cash: 1e9 })
    const { container } = render(<Hud stage={null} />)
    fireEvent.click(screen.getByRole('button', { name: /UPGRADES/ }))
    await frame()

    const centre = container.querySelector('.upgrade-board__node[data-owned="true"]')
    expect(centre?.textContent).toContain('Instant Messenger')
    expect(screen.queryByRole('button', { name: /^\$0$/ })).toBeNull()
  })

  it('is a drawer, not a modal — the swarm stays visible and pokeable beside it', async () => {
    const { container } = render(<Hud stage={null} />)
    fireEvent.click(screen.getByRole('button', { name: /UPGRADES/ }))
    await frame()
    expect(container.querySelector('.ui-scrim')).toBeNull()
  })
})

/**
 * §10.6b — **no window is open while somebody is talking.**
 *
 * The rule exists because of one real sequence: a player who opens §11's board
 * themselves and buys the node that clears THE THREAD gets `thread-cleared`
 * played *over the open board*, so James congratulates them through a tech
 * tree. Every window in the product is covered by the same gate, so the tests
 * here take one door the HUD owns and one window a *state* raises — the two
 * halves behave differently on the way out and both halves matter.
 */
describe('§10.6b — a conversation clears the desk', () => {
  beforeEach(prestiged)

  it('shuts a door the player opened, and does not open it again afterwards', async () => {
    const { container } = render(<Hud stage={null} />)

    fireEvent.click(screen.getByRole('button', { name: /UPGRADES/ }))
    await frame()
    expect(container.querySelector('.hud__upgrades')?.getAttribute('data-phase')).toBe('in')

    await act(async () => {
      showScene(SCENE_THREAD_CLEARED.id)
    })
    expect(container.querySelector('.hud__upgrades')?.getAttribute('data-phase')).toBe('exit')

    // And it stays shut. A window that springs back when the box goes away is
    // the lingering pop-up wearing a delay — so what is checked is that it
    // never returns to `in`, not merely that it left.
    await act(async () => {
      __setState({ scene: null })
    })
    await frame()
    const after = container.querySelector('.hud__upgrades')
    expect(after === null || after.getAttribute('data-phase') === 'exit').toBe(true)
  })

  it('stands the term sheet down for the scene and gives it back after', async () => {
    // §21.0a's window is raised by a *phase*, which is still true while the box
    // is up — so this one is suppressed rather than closed, and it has to
    // return or the run is stranded with no way to take the money.
    await act(async () => {
      jumpToPhase('act2_termsheet')
    })
    const { container } = render(<Hud stage={null} />)
    await frame()
    expect(container.querySelector('.term-sheet')).not.toBeNull()

    await act(async () => {
      showScene(SCENE_THREAD_CLEARED.id)
    })
    expect(container.querySelector('.term-sheet')?.getAttribute('data-phase')).toBe('exit')

    await act(async () => {
      __setState({ scene: null })
    })
    await frame()
    expect(container.querySelector('.term-sheet')?.getAttribute('data-phase')).toBe('in')
  })

  it('puts down a personnel record the store was holding open', async () => {
    // The two selections are the store's, so `showScene` is where they are
    // cleared — the HUD cannot see them to close them.
    await act(async () => {
      __setState({ selected: 3 })
    })
    expect(getState().selected).toBe(3)

    await act(async () => {
      showScene(SCENE_THREAD_CLEARED.id)
    })
    expect(getState().selected).toBeNull()
    expect(getState().selectedHero).toBeNull()
  })
})

describe('the in-game menu', () => {
  it('opens from gameplay, resumes, and can hand back to the main screen', () => {
    const onMainMenu = vi.fn()
    render(<Hud stage={null} onMainMenu={onMainMenu} />)

    fireEvent.click(screen.getByRole('button', { name: 'MENU' }))
    expect(screen.getByText('GAME MENU')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'RESUME' }))
    expect(onMainMenu).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'MENU' }))
    fireEvent.click(screen.getByRole('button', { name: 'MAIN SCREEN' }))
    expect(onMainMenu).toHaveBeenCalledOnce()
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
    expect(text).toContain('STORY POINTS LEFT')
    // §10.2a, R12 — **never "SP"**. An abbreviation that means something to the
    // people who wrote it and nothing to anybody else, sitting in the largest
    // readouts on the screen. Asserted as an absence because that is the only
    // way this stays fixed: the phrase is easy to reintroduce one label at a
    // time, and each one looks harmless on its own.
    expect(text).not.toMatch(/\bSP\b/)
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
    expect(container.querySelector('.hud__scale')?.textContent).toBe('1 FLOOR = 100 DEVS')
  })

  it('adds the burn and the runway once payroll starts — §21 Act V', () => {
    jumpToPhase('act5_bleeding')
    const { container } = render(<Hud stage={null} />)
    const text = container.textContent ?? ''

    expect(text).toContain('/SEC')
    expect(text).toContain('TO BANKRUPTCY')
  })

  it('keeps both of them off screen while the founders are still in the garage', () => {
    jumpToPhase('act1_ship')
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

describe('§10.1’s velocity split after R14 — the "you" half is the whole of you', () => {
  /** The two numbers out of `3,880 swarm + 240 you`. */
  function splitFrom(container: HTMLElement): { swarm: number; you: number } | null {
    const line = [...container.querySelectorAll('.hud__sub--split')]
      .map((n) => n.textContent ?? '')
      .find((t) => t.includes('swarm'))
    if (!line) return null
    const m = line.match(/^([\d,.]+) swarm \+ ([\d,.]+) you$/)
    if (!m) throw new Error(`unreadable split: ${line}`)
    return { swarm: Number(m[1].replace(/,/g, '')), you: Number(m[2].replace(/,/g, '')) }
  }

  it('counts a buff as the player’s work, not as the swarm’s', () => {
    // R14 routes three quarters of a poke into a buff on the people poked, and
    // that buff raises `currentVelocity`. So the old reading — swarm =
    // `currentVelocity`, you = `pokeRate` — now credits the swarm with most of
    // what the player just did, which is §25.1's original complaint arriving
    // through the opposite door.
    // A studio big enough that one buffed developer is a visible slice of it,
    // so the two halves are told apart by the readout rather than by rounding.
    __setState({ devs: 4, devCap: 80, peakDevs: 4 })

    act(() => {
      for (let i = 0; i < 6; i++) poke(0, 0, { rung: 2, index: 1 })
    })
    const { container } = render(<Hud stage={null} />)

    const split = splitFrom(container)
    expect(split).not.toBeNull()
    // Exactly the two numbers the store separates, to the precision they are
    // printed at. The swarm half is the *passive* rate; everything the buff is
    // adding belongs on the other side of the plus sign.
    expect(split!.swarm).toBeCloseTo(baseVelocity(), 2)
    expect(split!.you).toBeCloseTo(pokeVelocity(), 2)
    expect(pokeVelocity()).toBeGreaterThan(getState().pokeRate)
  })

  it('keeps reading while the buff lasts, not just while the thumb moves', () => {
    // §4.5a's loop is "maintain the people who are worth maintaining", and this
    // line is the only thing on screen that can show it decaying.
    // `dev` is pinned to `working`, and that is not decoration. It is one
    // studio-wide machine that transitions on a real dice roll, and a poke
    // landing while it happens to be in `tenx` cashes that developer out — the
    // headcount drops, the poked unit can end up empty, and the buff this test
    // is actually about contributes nothing. That made it fail about one run in
    // three for a reason with nothing to do with buff decay.
    __setState({ devs: 40, devCap: 80, peakDevs: 40, dev: { state: 'working', elapsed: 0 } })
    act(() => {
      poke(0, 0, { rung: 2, index: 7 })
    })
    // Measured, not assumed. A poke is worth what the person poked is worth,
    // and §4.9a says that is a log-normal roll off `runSeed` — which is the
    // clock. An absolute floor here was therefore a bet on the time of day: the
    // same assertion, unchanged, failed 42% of runs and passed the rest, which
    // is a coin toss wearing a gate's clothes. Decay is a *ratio*, so measure
    // the ratio and the dice stop mattering.
    const atRelease = getState().pokeRate

    act(() => {
      // Long enough that `pokeRate` has all but emptied (tau = 2 s) while the
      // buff (tau = 5 s) is still plainly up. Three time constants leaves
      // e^-3 — about a twentieth.
      for (let i = 0; i < 60 * 6; i++) tick(1 / 60)
    })

    const { container } = render(<Hud stage={null} />)
    expect(getState().pokeRate).toBeLessThan(atRelease * 0.06)
    // And the point of the line: what is left on the "you" side is *more* than
    // the thumb's residue, so something outlasting the tap is holding it up.
    // Stronger than "> 0", which the residue alone would have satisfied.
    expect(splitFrom(container)!.you).toBeGreaterThan(getState().pokeRate)
  })
})
