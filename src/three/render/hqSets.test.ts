import * as T from 'three'
import { describe, expect, it } from 'vitest'
import { statueModel, voxelsBuilt } from '../art/statueModel.ts'
import { GARAGE_HERO_SCALE, GARAGE_LEADERS, GARAGE_WALLS, GARAGE_WALL_FACES, HERO_SITES, STATUE_PLAZA } from '../sim/floorPlan.ts'
import { coverFor } from '../sim/cover.ts'
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
/** Two projects with different subjects: a rocket, and a ghost. */
const SPEC = coverFor(1, 0, 50, 'Hollow Orbit', 'arcade')
const SPEC2 = coverFor(1, 1, 50, 'Haunted Hollow', 'horror')

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
  // The statue is measured finished, which is the largest it is: the plinth alone is not what has to stay inside the site.
  sets.sink?.statue.update(SPEC, 'TEST', 1)
  root.updateMatrixWorld(true)
  const box = (id: (typeof HEROES)[number]) => {
    const b = new T.Box3()
    for (const key of [`desk:${id}`, `chair:${id}`]) {
      const handle = props.get(key)
      // Precise, from the vertices: Billy's rug is an octagon turned an eighth, and the box of its box is a third wider than it is.
      if (handle) b.union(new T.Box3().setFromObject(handle.group, true))
    }
    // The statue stands in the deck's own group, which no arrival moves (2026-10-13), and is still part of his site. The queue is not: it is
    // up the stem and measured against its own places (`heroRow.test.ts`).
    if (id === 'billy' && sets.sink) b.union(new T.Box3().setFromObject(sets.sink.statue.root, true))
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
      // The walls are 4.6 m, and the top metre of the back wall is kept clear — the name plates hang in it, and it was
      // the clerestory until 2026-10-11: the work hangs under that metre and never into it. The set stands on its platform.
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

describe('the project sink is the statue in the middle of the room (§8.2a, 2026-10-14)', () => {
  const sinkOf = () => {
    const props = new Map()
    const root = new T.Group()
    const env = { props, root, targets: [], occluders: [], people: [] } as unknown as Environment
    const s = GARAGE_LEADERS.find((l) => l.id === 'billy')!
    const parent = new T.Group(); root.add(parent)
    const sets = buildHqSets({
      env, at: { billy: { parent, x: s.x, z: s.z, rot: s.rot }, serena: { parent, x: 0, z: 0, rot: 0 }, matt: { parent, x: 0, z: 0, rot: 0 } },
      bodies: {}, present: new Set(['billy']),
    })
    return { sets, sink: sets.sink!, set: props.get('desk:billy')!.group as T.Group, props, parent }
  }
  /** What is drawn of the statue on the plinth: voxels standing, and the blueprint of the ones that are not. */
  const counts = (statue: { root: T.Object3D }) => {
    let built = 0, blueprint = 0
    statue.root.traverse((o) => {
      if (!(o instanceof T.InstancedMesh)) return
      if (o.material instanceof T.MeshBasicMaterial) blueprint += o.count; else built += o.count
    })
    return { built, blueprint }
  }
  /** The small statues in the queue: the groups in the queue's own group, each with a pedestal and a figure, that are drawn. */
  const minis = (sink: { statue: { queueRoot: T.Object3D } }, shown = true) =>
    sink.statue.queueRoot.children.filter((c) => c instanceof T.Group && (!shown || c.visible))
  const item = (id: number, spec = SPEC) => ({ id, spec, title: `GAME ${id}` })

  it('exists with Billy, and is not there without him', () => {
    expect(sinkOf().sink).toBeDefined()
    const env = { props: new Map(), root: new T.Group(), targets: [], occluders: [], people: [] } as unknown as Environment
    const parent = new T.Group()
    const at = { parent, x: 0, z: 0, rot: 0 }
    expect(buildHqSets({ env, at: { billy: at, serena: at, matt: at }, bodies: {}, present: new Set(['serena']) }).sink).toBeUndefined()
  })

  it('is there from the beginning: no hero’s set, which waits for its hero, holds the statue or its queue', () => {
    const { sink, props } = sinkOf()
    for (const [, prop] of props) {
      for (let o: T.Object3D | null = sink.anchor; o; o = o.parent) expect(o).not.toBe(prop.group)
      for (let o: T.Object3D | null = sink.statue.queueRoot; o; o = o.parent) expect(o).not.toBe(prop.group)
    }
    for (let o: T.Object3D | null = sink.statue.root; o; o = o.parent) expect(o.visible).toBe(true)
  })

  it('stands on its plinth where the plaza says, with its top under the wall’s clear metre', () => {
    const { sink } = sinkOf()
    expect(sink.anchor.position.x).toBe(STATUE_PLAZA.plinth.x)
    expect(sink.anchor.position.z).toBe(STATUE_PLAZA.plinth.z)
    expect(sink.anchor.position.y).toBe(0)
    // it is the tallest thing in the middle of the room, and still leaves the top metre of the walls as it leaves it for the heroes
    expect(sink.height).toBeGreaterThan(2.5)
    expect(HERO_SITES.billy.rise + sink.height).toBeLessThanOrEqual(GARAGE_WALLS.height - 1.0)
  })

  it('is built from the floor up as the project is: the share of the game built is the share of the statue standing, and the rest is its blueprint', () => {
    const { sink } = sinkOf()
    const n = statueModel(SPEC).voxels.length
    let last = -1
    for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      sink.statue.update(SPEC, 'TEST', p)
      const c = counts(sink.statue)
      expect(c.built, `at ${p}`).toBe(voxelsBuilt(n, p))
      expect(c.built + c.blueprint, `at ${p}`).toBe(n)
      expect(c.built).toBeGreaterThanOrEqual(last)
      last = c.built
    }
    expect(counts(sink.statue)).toEqual({ built: n, blueprint: 0 })
  })

  it('stands none of a project that has just begun, and none of a progress that is not a number', () => {
    const { sink } = sinkOf()
    sink.statue.update(SPEC, 'TEST', 1)
    sink.statue.update(SPEC, 'TEST', 0)
    expect(counts(sink.statue).built).toBe(0)
    expect(() => sink.statue.update(SPEC, 'TEST', Number.NaN)).not.toThrow()
    expect(counts(sink.statue).built).toBe(0)
  })

  it('is a new statue for a new project with a different subject, and a missing project is no statue', () => {
    const { sink } = sinkOf()
    sink.statue.update(SPEC, 'ONE', 1)
    sink.statue.update(SPEC2, 'TWO', 0.5)
    const n2 = statueModel(SPEC2).voxels.length
    expect(counts(sink.statue)).toEqual({ built: voxelsBuilt(n2, 0.5), blueprint: n2 - voxelsBuilt(n2, 0.5) })
    sink.statue.update(null, '', 0)
    expect(counts(sink.statue)).toEqual({ built: 0, blueprint: 0 })
  })

  it('says where the next voxel will stand, which climbs with the build and stays over the plinth', () => {
    const { sink, parent } = sinkOf()
    sink.statue.update(SPEC, 'TEST', 0); parent.updateMatrixWorld(true)
    const low = sink.statue.aim(new T.Vector3()), high = (sink.statue.update(SPEC, 'TEST', 0.95), parent.updateMatrixWorld(true), sink.statue.aim(new T.Vector3()))
    expect(high.y).toBeGreaterThan(low.y + 1)
    for (const p of [low, high]) {
      expect(Number.isFinite(p.x + p.y + p.z)).toBe(true)
      expect(Math.hypot(p.x - STATUE_PLAZA.plinth.x, p.z - STATUE_PLAZA.plinth.z)).toBeLessThan(STATUE_PLAZA.plinth.apothem + 1)
    }
    // with no project there is still somewhere to fly at: above the plinth
    sink.statue.update(null, '', 0)
    const idle = sink.statue.aim(new T.Vector3())
    expect(Number.isFinite(idle.y)).toBe(true)
  })

  describe('when the game is done', () => {
    const tick = (sink: ReturnType<typeof sinkOf>['sink'], from: number, to: number, project: { progress: number } = { progress: 0.02 }) => {
      for (let t = from; t <= to + 1e-9; t += 1 / 30) { sink.statue.update(SPEC2, 'NEXT', project.progress); sink.statue.tick(t) }
    }

    it('holds the finished statue through the beat, and takes the next project when it has left the plinth', () => {
      const { sink } = sinkOf()
      const n = statueModel(SPEC).voxels.length
      sink.statue.update(SPEC, 'DONE', 0.99)
      sink.statue.setQueue([item(1)], 5)
      sink.statue.tick(0)
      sink.statue.complete('build', false)
      // the stage hands over the next project, nothing built, in the same frame; the plinth still shows the one that is finished
      tick(sink, 0.05, 1.7)
      expect(counts(sink.statue)).toEqual({ built: n, blueprint: 0 })
      // it has left: the plinth is the next project's, and it is not the finished one
      tick(sink, 1.7, 2.0)
      const n2 = statueModel(SPEC2).voxels.length
      expect(counts(sink.statue).built + counts(sink.statue).blueprint).toBe(n2)
      expect(counts(sink.statue).built).toBeLessThan(5)
    })

    it('does not stand the new build in the queue until the statue has got there', () => {
      const { sink } = sinkOf()
      sink.statue.update(SPEC, 'DONE', 0.99)
      sink.statue.setQueue([item(1)], 5)
      sink.statue.tick(0)
      sink.statue.complete('build', false)
      expect(minis(sink)).toHaveLength(0)
      tick(sink, 0.05, 1.0)
      expect(minis(sink)).toHaveLength(0)
      tick(sink, 1.0, 3.0)
      expect(minis(sink)).toHaveLength(1)
    })

    it('has no beat under reduced motion: the build is in the queue at once and the plinth is the next project’s', () => {
      const { sink } = sinkOf()
      sink.statue.update(SPEC, 'DONE', 0.99)
      sink.statue.setQueue([item(1)], 5)
      sink.statue.tick(0)
      sink.statue.complete('build', true)
      expect(minis(sink)).toHaveLength(1)
      sink.statue.update(SPEC2, 'NEXT', 0)
      expect(counts(sink.statue).built).toBe(0)
    })

    it('never celebrates a release, which is the queue’s head leaving and not a statue arriving', () => {
      const { sink } = sinkOf()
      sink.statue.update(SPEC, 'WIP', 0.4)
      const before = counts(sink.statue)
      sink.statue.complete('release', false)
      sink.statue.tick(0); sink.statue.tick(1)
      expect(counts(sink.statue)).toEqual(before)
    })
  })

  describe('the queue', () => {
    it('is a small statue for each build waiting, as many as there are places and no more', () => {
      const { sink } = sinkOf()
      sink.statue.setQueue([], 5)
      expect(minis(sink)).toHaveLength(0)
      sink.statue.setQueue([item(1), item(2), item(3)], 5)
      expect(minis(sink)).toHaveLength(3)
      sink.statue.setQueue(Array.from({ length: 9 }, (_, i) => item(i + 1)), 9)
      expect(minis(sink)).toHaveLength(STATUE_PLAZA.queue.shown)
    })

    it('lets the head go when it is released, and closes up behind it', () => {
      const { sink } = sinkOf()
      sink.statue.setQueue([item(1), item(2), item(3)], 5)
      sink.statue.tick(0)
      sink.statue.setQueue([item(2), item(3)], 5)
      // the released statue is still there for a moment, going up; then it is gone
      expect(minis(sink).length).toBeGreaterThanOrEqual(2)
      for (let t = 1 / 30; t < 1.2; t += 1 / 30) sink.statue.tick(t)
      expect(minis(sink)).toHaveLength(2)
      // and the two that are left stand in the first two places
      const zs = minis(sink).map((m) => m.position.z).sort((a, b) => b - a)
      expect(zs[0] - zs[1]).toBeCloseTo(STATUE_PLAZA.queue.pitch, 6)
      expect(zs[0]).toBeCloseTo(STATUE_PLAZA.queue.zHead, 6)
    })

    it('marks the places the queue has room for, up to the ones it can show', () => {
      const { sink } = sinkOf()
      const marks = () => sink.statue.queueRoot.children.filter((c) => c instanceof T.Mesh && c.visible).length
      sink.statue.setQueue([], 3)
      expect(marks()).toBe(3)
      sink.statue.setQueue([], 500)
      expect(marks()).toBe(STATUE_PLAZA.queue.shown)
    })
  })

  it('cleans up after itself, and takes the queue and the statue with it', () => {
    const { sets, sink, parent } = sinkOf()
    sink.statue.update(SPEC, 'X', 0.5); sink.statue.setQueue([item(1)], 5)
    const root = sink.statue.root, queue = sink.statue.queueRoot
    expect(() => sets.dispose()).not.toThrow()
    expect(parent.children).not.toContain(root)
    expect(parent.children).not.toContain(queue)
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

  it('stands Billy’s set square to the room, as Matt’s and Serena’s are', () => {
    // [2026-10-14, *"change Billy's facing to same as Matt and Serena ... so it's sort of facing front"*] It was turned a
    // quarter to face the east pod; the man is now on the lens's side of the station, like theirs.
    const { set } = withBilly()
    expect(set.rotation.y).toBeCloseTo(0, 9)
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
      expect(body.position.y * GARAGE_HERO_SCALE).toBeGreaterThanOrEqual(STATUE_PLAZA.dais.rise - 1e-9)
      expect(body.position.y * GARAGE_HERO_SCALE).toBeLessThan(STATUE_PLAZA.dais.rise + 0.05)
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
})
