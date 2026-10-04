/**
 * §21.0f — James explains SHIP! the first time there is a build to ship.
 *
 * The claims: it waits for James, it waits for a build, it happens once, and it
 * is Run 1's — a career that has shipped, or shifted, is not walked through the
 * button again.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetStore, __setState, dismissScene, getState, tick, type ShelvedBuild } from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { SCENE_JAMES_ARRIVES, SCENE_JAMES_SHIP } from './scenes.ts'

function career(opts: { james: boolean; seen?: boolean; shifts?: number }) {
  const p = emptyPermanent()
  const milestones = [
    ...(opts.james ? [SCENE_JAMES_ARRIVES.id] : []),
    ...(opts.seen ? [SCENE_JAMES_SHIP.id] : []),
  ]
  setPermanent({ ...p, meta: { ...p.meta, milestones, paradigmShifts: opts.shifts ?? 0 } })
}

const build = { name: 'Flappy Square', density: 0 } as unknown as ShelvedBuild

describe('James explains SHIP!', () => {
  beforeEach(() => __resetStore())
  afterEach(() => {
    career({ james: false })
    __resetStore()
  })

  it('opens on the first build once he is at his desk', () => {
    career({ james: true })
    __setState({ shelf: [build] })
    tick(0.1)
    expect(getState().scene).toBe(SCENE_JAMES_SHIP.id)
  })

  it('waits for the build, and waits for James', () => {
    career({ james: true })
    tick(0.1)
    expect(getState().scene).not.toBe(SCENE_JAMES_SHIP.id)
    career({ james: false })
    __setState({ shelf: [build] })
    tick(0.1)
    expect(getState().scene).not.toBe(SCENE_JAMES_SHIP.id)
  })

  it('happens once', () => {
    career({ james: true })
    __setState({ shelf: [build] })
    tick(0.1)
    dismissScene()
    tick(0.1)
    expect(getState().scene).toBeNull()
  })

  it('is Run 1’s: not after a game has shipped, nor after a shift', () => {
    career({ james: true })
    __setState({ shelf: [build], projectsShipped: 1 })
    tick(0.1)
    expect(getState().scene).toBeNull()
    __resetStore()
    career({ james: true, shifts: 1 })
    __setState({ shelf: [build] })
    tick(0.1)
    expect(getState().scene).not.toBe(SCENE_JAMES_SHIP.id)
  })
})
