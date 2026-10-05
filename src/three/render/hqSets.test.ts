import * as T from 'three'
import { describe, expect, it } from 'vitest'
import { GARAGE_LEADERS, GARAGE_STAGE, HERO_SLOTS } from '../sim/floorPlan.ts'
import { HQ_PAINTINGS, NO_HQ_READOUTS, buildHqSets, type HqReadouts } from './hqSets.ts'
import { defaultCast } from './studioPeople.ts'
import type { Environment } from './worldEnvironments.ts'

/**
 * The heroes' sets [2026-10-04, GDD §7.8.12] — **measured, not looked at.**
 *
 * `CLAUDE.md` says 禁止穿模 is looked at and not tested, and that was right for a
 * room whose geometry nobody could query. These sets are built from code that
 * knows where its own boxes are, so the claim that matters most — *a set never
 * leaves its slot of the stage, and never goes through the wall, the ceiling or
 * its neighbour* — is a measurement, and a first draft failed it twice (a rug that
 * overlapped the next set's by a quarter of a metre, and a plate hung outside the
 * building).
 */
const HEROES = ['matt', 'serena', 'billy'] as const

function build() {
  const stage = new T.Group()
  stage.position.y = GARAGE_STAGE.rise
  const props = new Map()
  const env = { props, root: stage, targets: [], occluders: [], people: [] } as unknown as Environment
  const at = Object.fromEntries(HEROES.map((id) => {
    const s = GARAGE_LEADERS.find((l) => l.id === id)!
    return [id, { x: s.x, z: s.z }]
  })) as Record<(typeof HEROES)[number], { x: number; z: number }>
  const sets = buildHqSets({ env, stage, cast: defaultCast(), at, bodies: {}, present: new Set(HEROES) })
  stage.updateMatrixWorld(true)
  const box = (id: (typeof HEROES)[number]) => {
    const b = new T.Box3()
    for (const key of [`desk:${id}`, `chair:${id}`]) {
      const handle = props.get(key)
      if (handle) b.union(new T.Box3().setFromObject(handle.group))
    }
    return b
  }
  return { sets, box, props }
}

describe('a set stays inside its slot of the stage', () => {
  const { box } = build()
  for (const id of HEROES) {
    it(`${id}: inside the slot, behind the lip, in front of the wall and under the ceiling`, () => {
      const b = box(id)
      expect(b.isEmpty()).toBe(false)
      const slot = HERO_SLOTS[id]
      expect(b.min.x).toBeGreaterThanOrEqual(slot.x0 - 1e-6)
      expect(b.max.x).toBeLessThanOrEqual(slot.x1 + 1e-6)
      // Wall-hung work may touch the wall's face (a painted panel is 0.1 deep) but not go through it.
      expect(b.min.z).toBeGreaterThanOrEqual(GARAGE_STAGE.z0 - 0.06)
      expect(b.max.z).toBeLessThanOrEqual(GARAGE_STAGE.z1 + 1e-6)
      // The north wall is 3.2 m; the set stands on the stage.
      expect(b.max.y).toBeLessThanOrEqual(3.2)
      expect(b.min.y).toBeGreaterThanOrEqual(GARAGE_STAGE.rise - 1e-6)
    })
  }

  it('shares no floor with its neighbour', () => {
    const boxes = HEROES.map((id) => box(id)).sort((a, b) => a.min.x - b.min.x)
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].min.x).toBeGreaterThanOrEqual(boxes[i - 1].max.x - 1e-6)
  })
})

describe('the sets are only built for who is here', () => {
  it('builds nothing for a hero who is not in the cast', () => {
    const stage = new T.Group()
    const props = new Map()
    const env = { props, root: stage } as unknown as Environment
    buildHqSets({ env, stage, cast: defaultCast(), at: { matt: { x: -7.5, z: -8.2 }, serena: { x: -2.85, z: -8.2 }, billy: { x: 3.6, z: -8.9 } }, bodies: {}, present: new Set(['serena']) })
    expect([...props.keys()]).toContain('desk:serena')
    expect([...props.keys()]).not.toContain('desk:matt')
    expect([...props.keys()]).not.toContain('desk:billy')
  })

  it('registers Billy’s audience as his chair, so they drop in with him', () => {
    const { props } = build()
    expect(props.get('chair:billy')).toBeDefined()
    expect(props.get('desk:billy')).toBeDefined()
  })
})

describe('the paintings', () => {
  /** A 2D context that accepts anything and draws nothing: enough to prove a painting does not throw. */
  const stub = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D

  const readings: Array<[string, HqReadouts]> = [
    ['an empty studio', NO_HQ_READOUTS],
    ['a busy one', { ...NO_HQ_READOUTS, queueUsed: 5, queueCapacity: 5, autoShipIn: 12, incidents: ['A', 'B', 'C', 'D', 'E'], tickets: 4000, defects: 900, syncPct: 31, devs: 800, devCap: 100, velocity: 1e6, shipped: 50 }],
    ['a seized one', { ...NO_HQ_READOUTS, devs: 1000, devCap: 100, velocity: 1e-23, syncPct: 0, tickets: 1e9 }],
    ['nonsense', { ...NO_HQ_READOUTS, devs: Number.NaN, devCap: 0, velocity: Number.NaN, syncPct: Number.NaN, tickets: -5, queueCapacity: 0 }],
  ]

  for (const [name, r] of readings) {
    it(`paints every screen for ${name} without throwing`, () => {
      for (const p of HQ_PAINTINGS) for (const s of [0, 3.3, 9, 17, 123.4]) expect(() => p.paint(stub, 420, 240, s, r), p.name).not.toThrow()
    })
  }

  it('repaints a screen only when what it shows has changed', () => {
    const wall = HQ_PAINTINGS.find((p) => p.name === 'tickets')!
    const base = { ...NO_HQ_READOUTS, tickets: 100 }
    expect(wall.key(1, base)).toBe(wall.key(1, { ...base }))
    expect(wall.key(1, base)).not.toBe(wall.key(1, { ...base, tickets: 200 }))
    expect(wall.key(1, base)).not.toBe(wall.key(1, { ...base, incidents: ['X'] }))
    const queue = HQ_PAINTINGS.find((p) => p.name === 'queue')!
    expect(queue.key(1, base)).toBe(queue.key(50, base))
    expect(queue.key(1, base)).not.toBe(queue.key(1, { ...base, queueUsed: 2 }))
  })

  it('moves the whiteboard on with the meeting, and begins it again', () => {
    const board = HQ_PAINTINGS.find((p) => p.name === 'whiteboard')!
    expect(board.key(0, NO_HQ_READOUTS)).not.toBe(board.key(8, NO_HQ_READOUTS))
  })
})
