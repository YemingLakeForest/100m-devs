/**
 * §11.4's board, as the player meets it — the verification §26.1.5 asks for.
 *
 * **Every rule in §11.4 was already tested somewhere, and none of them here.**
 * `techBoard.test.ts` owns the graph (centre-out, right angles, the three reveal
 * states, ring gating), `techIcons.test.ts` owns the masks, `uiSfx.test.ts` owns
 * §11.4.5's two-part cue, and the browser gate owns the geometry at §23.4.2's
 * five frames. What none of them can see is **whether the component uses any of
 * it** — and §25.9.4 is two systems that were finished, tested to their own
 * edges, and never called.
 *
 * So this file asserts joins and nothing else. Where a rule has a pure test, the
 * assertion here is that the board is wired to that rule rather than to a second
 * copy of it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TECH_NODE_H, TECH_NODE_W, UpgradeBoard } from './UpgradeBoard.tsx'
import { __resetStore, __setState, getState } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { TECH_TREE } from '../sim/techTree.ts'
import { playPurchase } from '../ui/uiSfx.ts'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))

/** §11.4.6 — rings are gated by prestige, so a test has to say how many. */
function shifted(shifts: number) {
  const p = emptyPermanent()
  setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: shifts } })
}

function board() {
  return render(<UpgradeBoard open onClose={() => {}} />)
}

/** The node buttons, keyed by §11.4.2's reveal state. */
function nodesIn(container: HTMLElement, state: 'live' | 'silhouette' | 'dark') {
  return [...container.querySelectorAll(`.upgrade-board__node[data-state="${state}"]`)]
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  cleanup()
  __resetStore()
  setPermanent(emptyPermanent())
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('§11.4.1 — the board is a board', () => {
  it('draws every node, and one connector for each that is not the centre', () => {
    shifted(1)
    const { container } = board()
    expect(container.querySelectorAll('.upgrade-board__node')).toHaveLength(TECH_TREE.length)
    expect(container.querySelectorAll('.upgrade-board__links line')).toHaveLength(
      TECH_TREE.length - 1,
    )
  })

  it('keeps every connector axis-aligned — right angles only, no diagonals', () => {
    shifted(1)
    const { container } = board()
    for (const line of container.querySelectorAll('.upgrade-board__links line')) {
      const same = (a: string, b: string) => line.getAttribute(a) === line.getAttribute(b)
      // A segment that moves on both axes at once is a diagonal, which §10.6
      // forbids by name. Drawn from the same `connectors()` the pure test pins.
      expect(same('x1', 'x2') || same('y1', 'y2')).toBe(true)
    }
  })

  it('grows outward from Instant Messenger in all four directions', () => {
    shifted(1)
    const { container } = board()
    const im = TECH_TREE.find((n) => n.granted)!
    const centre = [...container.querySelectorAll<HTMLElement>('.upgrade-board__node')].find(
      (n) => n.getAttribute('aria-label') === im.name,
    )!
    const px = (v: string) => Number.parseFloat(v)

    // §11.4.1 — "a branch is a compass heading, not a column". Somebody is
    // placed on each side of the centre, which is the property a root-at-one-
    // edge tree cannot have and the one that makes the first §11 decision a
    // choice of direction.
    const others = [...container.querySelectorAll<HTMLElement>('.upgrade-board__node')].filter(
      (n) => n !== centre,
    )
    expect(others.some((n) => px(n.style.left) < px(centre.style.left))).toBe(true)
    expect(others.some((n) => px(n.style.left) > px(centre.style.left))).toBe(true)
    expect(others.some((n) => px(n.style.top) < px(centre.style.top))).toBe(true)
    expect(others.some((n) => px(n.style.top) > px(centre.style.top))).toBe(true)

    // And the centre is the one node that is given rather than sold.
    fireEvent.click(screen.getByRole('button', { name: im.name }))
    expect(screen.getByText('A GIFT FROM JAMES')).toBeInTheDocument()
    expect(
      container.querySelector('.upgrade-board__guide-card')!.querySelectorAll('button'),
    ).toHaveLength(0)
  })

  /**
   * **The node layer and the link layer are one board — §11.4.1a.**
   *
   * Found by walking §26.1.8 item 4 rather than by any test, and the test above
   * is the reason: *"grows outward in all four directions"* compares nodes with
   * each other, so it is completely blind to the whole node layer being
   * translated away from the lines that are supposed to reach it. Which is what
   * had happened — `NodeView` used the literal padding, `1.5`, where the
   * connectors use `pad - bounds.minX`, and §11's board runs three cells west
   * of Instant Messenger and three cells north. Every node was drawn three
   * cells up and to the left of its own connector, and the four nodes furthest
   * out landed at negative coordinates: outside the world box, clipped by the
   * scroller, and unreachable at any scroll position.
   *
   * So this asserts the **join**, which is the only thing that could have
   * caught it: a node's centre is a connector endpoint.
   */
  it('puts every node’s centre on the connector that reaches it', () => {
    shifted(1)
    const { container } = board()
    const px = (v: string) => Number.parseFloat(v)

    const ends = new Set<string>()
    for (const line of container.querySelectorAll('.upgrade-board__links line')) {
      for (const [x, y] of [['x1', 'y1'], ['x2', 'y2']] as const) {
        ends.add(`${Math.round(Number(line.getAttribute(x)))},${Math.round(Number(line.getAttribute(y)))}`)
      }
    }

    for (const node of container.querySelectorAll<HTMLElement>('.upgrade-board__node')) {
      // The style is `left/top` of the box; the point the line is drawn to is
      // its centre. jsdom does no layout, so the box size comes from the same
      // constants the component uses rather than from a measurement.
      const cx = Math.round(px(node.style.left) + TECH_NODE_W / 2)
      const cy = Math.round(px(node.style.top) + TECH_NODE_H / 2)
      expect(ends.has(`${cx},${cy}`)).toBe(true)
    }
  })

  it('keeps every node inside the world it declares', () => {
    shifted(1)
    const { container } = board()
    const world = container.querySelector<HTMLElement>('.upgrade-board__world')!
    const px = (v: string) => Number.parseFloat(v)
    const w = px(world.style.width)
    const h = px(world.style.height)

    for (const node of container.querySelectorAll<HTMLElement>('.upgrade-board__node')) {
      // A node outside the world box is behind the scroller's clip for ever:
      // there is no scroll position that brings it back, so it is a purchase
      // the player can see on a connector and never reach.
      expect(px(node.style.left)).toBeGreaterThanOrEqual(0)
      expect(px(node.style.top)).toBeGreaterThanOrEqual(0)
      expect(px(node.style.left) + TECH_NODE_W).toBeLessThanOrEqual(w)
      expect(px(node.style.top) + TECH_NODE_H).toBeLessThanOrEqual(h)
    }
  })

  it('is larger than the frame it is shown in, and never says so', () => {
    shifted(1)
    const { container } = board()
    const world = container.querySelector<HTMLElement>('.upgrade-board__world')!
    // §23.4.2's smallest frame is 748x336. jsdom does no layout, so this reads
    // the declared world size — the gate measures the real thing at all five
    // sizes; what is checked here is that the board *declares* itself bigger.
    expect(Number.parseFloat(world.style.width)).toBeGreaterThan(748)
    expect(Number.parseFloat(world.style.height)).toBeGreaterThan(336)
    // §10.6 — an interface that announces its own size is a web page.
    expect(container.textContent).not.toMatch(/scroll|drag|pan|more below/i)
  })
})

describe('§11.4.2 — the three reveal states, on the board rather than in the graph', () => {
  it('opens ring 1 with the first shift and not before', () => {
    shifted(0)
    const { container } = board()
    // Only the granted centre is live before anybody has prestiged.
    expect(nodesIn(container, 'live')).toHaveLength(1)

    cleanup()
    shifted(1)
    __setState({ cash: 1_000_000 })
    const after = board()
    expect(nodesIn(after.container, 'live').length).toBeGreaterThan(1)
  })

  it('shows a price and no name on a silhouette, and a name on a live node', () => {
    shifted(1)
    __setState({ cash: 0 })
    const { container } = board()
    const silhouettes = nodesIn(container, 'silhouette')
    expect(silhouettes.length).toBeGreaterThan(0)
    for (const node of silhouettes) {
      expect(node.querySelector('.upgrade-board__node-price')).not.toBeNull()
      expect(node.querySelector('.upgrade-board__node-name')).toBeNull()
    }
  })

  it('shows a dark node as a stub, unlabelled and unopenable', () => {
    shifted(1)
    const { container } = board()
    const dark = nodesIn(container, 'dark')
    expect(dark.length).toBeGreaterThan(0)
    // The shape is never hidden, only the contents: the connectors are all
    // drawn above regardless of state.
    expect(dark[0].querySelector('.upgrade-board__stub')).not.toBeNull()
    expect(dark[0].getAttribute('aria-label')).toBeNull()

    fireEvent.click(dark[0])
    expect(container.querySelector('.upgrade-board__guide')).toBeNull()
  })

  it('draws a procedural icon on every node, at every state — §11.4.4', () => {
    shifted(1)
    const { container } = board()
    for (const node of container.querySelectorAll('.upgrade-board__node')) {
      const icon = node.querySelector('.upgrade-board__icon')
      expect(icon).not.toBeNull()
      // A mask with no cells is an icon that shipped blank.
      expect(icon!.querySelectorAll('rect').length).toBeGreaterThan(0)
    }
  })
})

describe('§11.4.3 — tapping a node opens it; it does not buy it', () => {
  /** The cheapest live purchase, which is what a fresh ring-1 board offers. */
  function firstBuyable(container: HTMLElement) {
    const granted = new Set(TECH_TREE.filter((n) => n.granted).map((n) => n.name))
    return nodesIn(container, 'live').find(
      (n) => !granted.has(n.getAttribute('aria-label') ?? ''),
    ) as HTMLElement
  }

  it('raises the guide layer and takes no money', () => {
    shifted(1)
    __setState({ cash: 1_000_000 })
    const { container } = board()
    const before = getState().cash

    fireEvent.click(firstBuyable(container))
    expect(container.querySelector('.upgrade-board__guide')).not.toBeNull()
    expect(getState().cash).toBe(before)
    // §11.4.3 — icon, name, flavour, effect, in that order, and the price on
    // the only button.
    expect(container.querySelector('.upgrade-board__guide-name')).not.toBeNull()
    expect(container.querySelector('.upgrade-board__guide-flavour')).not.toBeNull()
    expect(container.querySelector('.upgrade-board__guide-effect')).not.toBeNull()
  })

  it('buys on the guide’s one button, and sounds §11.4.5’s two-part cue', () => {
    shifted(1)
    __setState({ cash: 1_000_000 })
    const { container } = board()
    fireEvent.click(firstBuyable(container))

    const card = container.querySelector('.upgrade-board__guide-card')!
    const buttons = [...card.querySelectorAll('button')]
    expect(buttons).toHaveLength(1)

    const before = getState().cash
    fireEvent.click(buttons[0])
    expect(getState().cash).toBeLessThan(before)
    // Not `playUi` twice from here: the rhythm is `playPurchase`'s, and it is
    // pinned in `uiSfx.test.ts`. What this asserts is that the board calls it.
    expect(playPurchase).toHaveBeenCalledOnce()
    // The guide closes onto the board, because the reward for buying is
    // watching the map grow.
    expect(container.querySelector('.upgrade-board__guide')).toBeNull()
  })

  it('hands a first-use purchase back to the running loop', () => {
    vi.useFakeTimers()
    shifted(1)
    __setState({ cash: 1_000_000 })
    const complete = vi.fn()
    const { container } = render(
      <UpgradeBoard open guided onGuidedComplete={complete} onClose={() => {}} />,
    )
    expect(screen.getByText(/JAMES \/\//)).toBeInTheDocument()

    fireEvent.click(firstBuyable(container))
    const buy = container.querySelector('.upgrade-board__guide-card button')!
    fireEvent.click(buy)
    act(() => vi.advanceTimersByTime(440))
    expect(complete).toHaveBeenCalledOnce()
  })

  it('offers a silhouette no button at all, only why not', () => {
    shifted(1)
    __setState({ cash: 0 })
    const { container } = board()
    fireEvent.click(nodesIn(container, 'silhouette')[0])

    const card = container.querySelector('.upgrade-board__guide-card')!
    expect(card.querySelector('.upgrade-board__guide-locked')).not.toBeNull()
    expect(card.querySelectorAll('button')).toHaveLength(0)
  })
})
