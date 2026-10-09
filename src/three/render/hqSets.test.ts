import * as T from 'three'
import { describe, expect, it } from 'vitest'
import { BILLY_PLAZA, GARAGE_HERO_SCALE, GARAGE_LEADERS, GARAGE_WALLS, GARAGE_WALL_FACES, HERO_SITES } from '../sim/floorPlan.ts'
import { HQ_PAINTINGS, NO_HQ_READOUTS, buildHqSets, type HqReadouts } from './hqSets.ts'
import type { Environment } from './worldEnvironments.ts'

/**
 * The heroes' sets [2026-10-04, GDD §7.8.12, re-planned 2026-10-05] — **measured, not looked at.**
 *
 * `CLAUDE.md` says 禁止穿模 is looked at and not tested, and that was right for a
 * room whose geometry nobody could query. These sets are built from code that
 * knows where its own boxes are, so the claim that matters most — *a set never
 * leaves its site, and never goes through the wall, the ceiling or its neighbour* —
 * is a measurement, and a first draft failed it twice (a rug that overlapped the next set's by
 * a quarter of a metre, and a plate hung outside the building). One of the three is turned an eighth
 * now, to face the lens, and stands on the open floor, so this also pins that the *frame* is right:
 * a set built in its station's own frame and measured in the world's is the test of the turn.
 */
const HEROES = ['matt', 'serena', 'billy'] as const

function build() {
  const props = new Map()
  const root = new T.Group()
  const env = { props, root, targets: [], occluders: [], people: [] } as unknown as Environment
  const at = Object.fromEntries(HEROES.map((id) => {
    const s = GARAGE_LEADERS.find((l) => l.id === id)!
    const parent = new T.Group()
    parent.position.y = HERO_SITES[id].rise
    root.add(parent)
    return [id, { parent, x: s.x, z: s.z, rot: s.rot }]
  })) as unknown as Parameters<typeof buildHqSets>[0]['at']
  const sets = buildHqSets({ env, at, bodies: {}, present: new Set(HEROES) })
  root.updateMatrixWorld(true)
  const box = (id: (typeof HEROES)[number]) => {
    const b = new T.Box3()
    for (const key of [`desk:${id}`, `chair:${id}`]) {
      const handle = props.get(key)
      // Precise, from the vertices: Billy's rug is an octagon turned an eighth, and the box of its box is a third wider than it is.
      if (handle) b.union(new T.Box3().setFromObject(handle.group, true))
    }
    return b
  }
  return { sets, box, props }
}

describe('a set stays inside its site', () => {
  const { box } = build()
  for (const id of HEROES) {
    it(`${id}: inside the site, in front of its wall and under the ceiling`, () => {
      const b = box(id)
      expect(b.isEmpty()).toBe(false)
      const site = HERO_SITES[id]
      // Wall-hung work may touch the wall's face (a painted panel is 0.1 deep) but not go through it.
      const slack = 0.06
      expect(b.min.x).toBeGreaterThanOrEqual(site.x0 - (site.wall === 'west' ? slack : 0) - 1e-6)
      expect(b.max.x).toBeLessThanOrEqual(site.x1 + 1e-6)
      expect(b.min.z).toBeGreaterThanOrEqual(site.z0 - (site.wall === 'north' ? slack : 0) - 1e-6)
      expect(b.max.z).toBeLessThanOrEqual(site.z1 + 1e-6)
      // The walls are 4.6 m, and the back wall's clerestory is the top metre of it, centred 3.6 m up: the work hangs
      // under the glazing and never across it. The set stands on its platform.
      expect(b.max.y).toBeLessThanOrEqual(GARAGE_WALLS.height - 1.0)
      expect(b.min.y).toBeGreaterThanOrEqual(site.rise - 1e-6)
    })
  }

  it('shares no floor with its neighbours', () => {
    const boxes = HEROES.map((id) => box(id))
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]
        const apart = a.max.x <= b.min.x + 1e-6 || b.max.x <= a.min.x + 1e-6 || a.max.z <= b.min.z + 1e-6 || b.max.z <= a.min.z + 1e-6
        expect(apart, `${HEROES[i]}/${HEROES[j]}`).toBe(true)
      }
    }
  })

  it('hangs the wall heroes’ sets on their wall: they reach the wall, and do not stand off it', () => {
    // Matt's ticket wall is the thin panel nearest the wall; if a set's frame were wrong it would be a metre out from the
    // wall, or on the wrong side of the station, and the box test above would have said so. This asks the other half:
    // that the set *reaches* the wall.
    for (const id of HEROES) {
      const b = box(id), site = HERO_SITES[id]
      if (site.wall === 'north') expect(b.min.z).toBeLessThan(site.z0 + 0.25)
      else if (site.wall === 'west') expect(b.min.x).toBeLessThan(site.x0 + 0.25)
    }
  })

  it('keeps Billy on the open floor: his set is nowhere near a wall', () => {
    // *"put billy in the mix of devs"* (2026-10-05): the first five cuts hung his board on a wall and had him talk to it.
    const b = box('billy')
    expect(HERO_SITES.billy.wall).toBe('free')
    expect(b.min.x - GARAGE_WALL_FACES.west).toBeGreaterThanOrEqual(5)
    expect(b.min.z - GARAGE_WALL_FACES.north).toBeGreaterThanOrEqual(5)
  })
})

describe('the sets are only built for who is here', () => {
  it('builds nothing for a hero who is not in the cast', () => {
    const props = new Map()
    const root = new T.Group()
    const env = { props, root } as unknown as Environment
    const at = Object.fromEntries(HEROES.map((id) => {
      const s = GARAGE_LEADERS.find((l) => l.id === id)!
      return [id, { parent: root, x: s.x, z: s.z, rot: s.rot }]
    })) as unknown as Parameters<typeof buildHqSets>[0]['at']
    buildHqSets({ env, at, bodies: {}, present: new Set(['serena']) })
    expect([...props.keys()]).toContain('desk:serena')
    expect([...props.keys()]).not.toContain('desk:matt')
    expect([...props.keys()]).not.toContain('desk:billy')
  })

  it('gives Billy the planning table and board without adding fictional people or a seated arrival', () => {
    const { props } = build()
    expect(props.get('desk:billy')).toBeDefined()
    expect(props.get('chair:billy')).toBeUndefined()
  })
})

describe('Billy addresses the developer pod', () => {
  /** A set with a body in it, so that the set can move him; the body is the bare group the garage's builder hands over. */
  function withBilly() {
    const props = new Map()
    const root = new T.Group()
    const env = { props, root, targets: [], occluders: [], people: [] } as unknown as Environment
    const s = GARAGE_LEADERS.find((l) => l.id === 'billy')!
    const parent = new T.Group()
    root.add(parent)
    const body = new T.Group()
    body.rotation.y = Math.PI
    const sets = buildHqSets({
      env, at: { billy: { parent, x: s.x, z: s.z, rot: s.rot }, serena: { parent, x: 0, z: 0, rot: 0 }, matt: { parent, x: 0, z: 0, rot: 0 } },
      bodies: { billy: body }, present: new Set(['billy']),
    })
    return { sets, body, set: props.get('desk:billy')!.group as T.Group }
  }

  it('turns Billy’s set toward the east developer pod', () => {
    const { set } = withBilly()
    expect(set.rotation.y).toBeCloseTo(Math.PI / 2, 9)
  })

  it('keeps Billy addressing the east pod throughout his presentation', () => {
    // His five-degree presentation sway stays directed at the east-pod audience.
    const { sets, body } = withBilly()
    const seen: number[] = []
    for (let t = 0; t < 40; t += 0.37) { sets.update(t, NO_HQ_READOUTS); seen.push(body.rotation.y) }
    expect(Math.max(...seen)).toBeGreaterThan(Math.PI)
    expect(Math.min(...seen)).toBeLessThan(Math.PI)
    for (const y of seen) {
      expect(y).toBeLessThanOrEqual(Math.PI + .081)
      expect(y).toBeGreaterThanOrEqual(Math.PI - .081)
    }
  })

  it('keeps Billy grounded on his shared timber floor parent', () => {
    const { sets, body } = withBilly()
    for (const t of [0, 1, 2.2, 5]) {
      sets.update(t, NO_HQ_READOUTS)
      // the body is in the scaled station group and the dais in the set's unscaled metres
      expect(body.position.y * GARAGE_HERO_SCALE).toBeGreaterThanOrEqual(BILLY_PLAZA.dais.rise - 1e-9)
      expect(body.position.y * GARAGE_HERO_SCALE).toBeLessThan(BILLY_PLAZA.dais.rise + 0.05)
    }
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
    ['a NaN ticket count', { ...NO_HQ_READOUTS, tickets: Number.NaN }],
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

  it('reads the ticket count off the front of Matt’s counter, and only repaints when it changes', () => {
    const sign = HQ_PAINTINGS.find((p) => p.name === 'helpdesk')!
    const base = { ...NO_HQ_READOUTS, tickets: 100 }
    expect(sign.key(1, base)).toBe(sign.key(9, base))
    expect(sign.key(1, base)).not.toBe(sign.key(1, { ...base, tickets: 101 }))
    expect(() => sign.key(1, { ...base, tickets: Number.NaN })).not.toThrow()
  })

  it('moves the whiteboard on with the meeting, and begins it again', () => {
    const board = HQ_PAINTINGS.find((p) => p.name === 'whiteboard')!
    expect(board.key(0, NO_HQ_READOUTS)).not.toBe(board.key(8, NO_HQ_READOUTS))
  })
})
