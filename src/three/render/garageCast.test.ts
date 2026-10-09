import * as T from 'three'
import { describe, expect, it } from 'vitest'
import { GARAGE_ASSEMBLED, buildGarageEnvironment, showGarageStations } from './garageEnvironment.ts'
import { defaultCast } from './studioPeople.ts'
import { GARAGE_DECK, GARAGE_PODIUM, GARAGE_WALLS, HERO_SITES, LEADER_IDS, leaderSeat } from '../sim/floorPlan.ts'

/**
 * The garage can be built with the whole cast [2026-10-04, GDD §7.8.12].
 *
 * **This threw on the first frame.** Billy had never been built in STUDIO_OS's
 * head-and-body skin — his clipboard reached for an arm the skin does not draw —
 * because the 3D garage only ever held the founder and James. Giving the other
 * three a place meant building them for the first time, and a browser caught
 * what no test did, since there was no test that built the room with a hero in
 * it. This is that test.
 */
const cast = { ...defaultCast(), heroes: ['james', 'billy', 'serena', 'matt'] as never }

describe('the garage holds all five', () => {
  it('builds with every hero in the cast', () => {
    expect(() => buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)).not.toThrow()
  })

  it('gives every leader a person and a name plate', () => {
    const env = buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)
    for (const id of LEADER_IDS) {
      expect(env.props?.get(`body:${id}`), `body:${id}`).toBeDefined()
      expect(env.props?.get(`name:${id}`), `name:${id}`).toBeDefined()
      expect(env.people.some((p) => Number(p.userData.seat) === leaderSeat(id)), `seat ${id}`).toBe(true)
    }
  })

  it('shows a hero’s station only once they have arrived', () => {
    const env = buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)
    const bodyOf = (id: string) => env.people.find((p) => Number(p.userData.seat) === leaderSeat(id as never))!
    showGarageStations(env, { founder: true, james: 3, heroes: [] }, cast)
    expect(env.props!.get('ops:studies')!.group.visible).toBe(true)
    expect(bodyOf('serena').visible).toBe(false)
    expect(bodyOf('matt').visible).toBe(false)
    expect(bodyOf('billy').visible).toBe(false)
    showGarageStations(env, { founder: true, james: 3, heroes: ['serena'] }, cast)
    expect(bodyOf('serena').visible).toBe(true)
    expect(bodyOf('matt').visible).toBe(false)
  })

  it('uses comparable head and body sizes for Billy, leaders and developers', () => {
    const env = buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)
    const bodyOf = (seat: number) => env.people.find((p) => Number(p.userData.seat) === seat)!
    const billy = bodyOf(leaderSeat('billy'))
    expect(billy.children.map((part) => part.name)).toEqual(['torso', 'head'])
    expect(billy.getObjectByName('torso')!.position.y).toBe(0)
    env.root.updateMatrixWorld(true)
    const size = (seat: number, part: string) => {
      const body = bodyOf(seat)
      // Measure in the model's axes: Billy faces the lens and the seated crowd
      // faces their desks, so world-axis boxes inflate their widths differently.
      return new T.Box3().setFromObject(body.getObjectByName(part)!.clone()).getSize(new T.Vector3())
        .multiply(body.getWorldScale(new T.Vector3()))
    }
    const heads = [leaderSeat('billy'), leaderSeat('james'), 0, 1, 2].map((seat) => size(seat, 'head').y)
    // Hair may differ; a standing presenter must not become a different-sized species.
    expect(Math.max(...heads) / Math.min(...heads)).toBeLessThan(1.45)
    expect(size(0, 'torso').x / size(leaderSeat('james'), 'torso').x).toBeGreaterThan(.9)
    expect(size(leaderSeat('billy'), 'torso').x / size(0, 'torso').x).toBeLessThan(1.2)
    expect(bodyOf(0).getObjectByName('torso')!.position.y).toBeCloseTo(.66)
  })

  it('shows both operations platforms and the access step only with their heroes, and gives Billy no platform to show', () => {
    // An empty platform must not replace the removed enclosure in the early room.
    // Billy's board, rug and dais remain his set on the shared floor.
    const env = buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)
    const shown = (key: string) => env.props!.get(key)!.group.visible
    expect(env.props?.get('riser:billy')).toBeUndefined()
    expect(env.props?.get('partition:serena')).toBeUndefined()
    expect(shown('ops:studies')).toBe(false)
    showGarageStations(env, { founder: true, james: 3, heroes: [] }, cast)
    expect([shown('step:serena'), shown('riser:serena'), shown('riser:matt'), shown('desk:billy')]).toEqual([false, false, false, false])
    showGarageStations(env, { founder: true, james: 3, heroes: ['billy'] }, cast)
    expect([shown('step:serena'), shown('riser:matt'), shown('desk:billy')]).toEqual([false, false, true])
    showGarageStations(env, { founder: true, james: 3, heroes: ['billy', 'serena'] }, cast)
    expect(shown('step:serena')).toBe(true)
    expect(shown('riser:serena')).toBe(true)
    expect(shown('ops:studies')).toBe(false)
    showGarageStations(env, { founder: true, james: 3, heroes: ['billy', 'serena', 'matt'] }, cast)
    expect(shown('riser:matt')).toBe(true)
  })

  it('places the four desk heroes on the shared timber deck and Billy on the floor', () => {
    // The height a prop comes to rest at is the height of the floor it stands on. The founder's podium is the highest
    // thing in the room — *"I want the me even more promenant, on a platform"* — and James is a step above the floor.
    const env = buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)
    const restY = (key: string) => new T.Vector3().setFromMatrixPosition(env.props!.get(key)!.rest).y
    expect(restY('body:founder')).toBeCloseTo(GARAGE_PODIUM.rise, 6)
    expect(restY('body:james')).toBeCloseTo(GARAGE_DECK.rise, 6)
    expect(restY('body:serena')).toBeCloseTo(HERO_SITES.serena.rise, 6)
    expect(restY('body:matt')).toBeCloseTo(HERO_SITES.matt.rise, 6)
    expect(restY('body:billy')).toBeCloseTo(HERO_SITES.billy.rise, 6)
    const ys = LEADER_IDS.map((id) => restY(`body:${id}`))
    expect(Math.max(...ys)).toBeCloseTo(restY('body:founder'), 6)
  })

  it('resets support and operations while the founder faces screen-down', () => {
    // *"facing down right, the isometric way, like matt and serena"* (2026-10-07). A person's face is their local −z; the
    // world heading of that, through the station that turns them, is where they look.
    const env = buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)
    env.root.updateMatrixWorld(true)
    const looks = (id: 'founder' | 'matt' | 'serena' | 'james') => {
      const body = env.people.find((p) => Number(p.userData.seat) === leaderSeat(id))!
      return new T.Vector3(0, 0, -1).applyQuaternion(body.getWorldQuaternion(new T.Quaternion())).setY(0).normalize()
    }
    // The desk is in front of the person, so it faces the same way: the north wall's heroes look +z, into the room, and so does the boss.
    expect(looks('founder').dot(new T.Vector3(1, 0, 1).normalize())).toBeGreaterThan(0.999)
    for (const [id, name] of [['matt', 'support-workstation'], ['serena', 'operations-workstation']] as const) {
      const desk = env.root.getObjectByName(name)!
      const forward = new T.Vector3(0, 0, 1).applyQuaternion(desk.getWorldQuaternion(new T.Quaternion()))
      expect(looks(id).dot(forward), id).toBeGreaterThan(.999)
    }
    expect(looks('matt').dot(new T.Vector3(0, 0, 1))).toBeGreaterThan(.999)
    expect(looks('serena').dot(new T.Vector3(0, 0, 1))).toBeGreaterThan(.999)
    // James, on the west wall, looks across the room, east.
    expect(looks('james').dot(new T.Vector3(1, 0, 0))).toBeGreaterThan(0.999)
  })

  it('raises the back walls to the plan’s height, so that the sets hang on them', () => {
    // The bare shell, with no scenery: the highest thing in it is the wall's own cap, a hand above the wall.
    const shell = buildGarageEnvironment(0, cast, 'off', true, GARAGE_ASSEMBLED, true)
    shell.root.updateMatrixWorld(true)
    const top = new T.Box3().setFromObject(shell.root).max.y
    expect(top).toBeGreaterThanOrEqual(GARAGE_WALLS.height)
    expect(top).toBeLessThanOrEqual(GARAGE_WALLS.height + 0.3)
  })

  it('hangs the studio’s name over the founder, on the wall behind the podium', () => {
    const env = buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)
    const sign = env.root.getObjectByName('studio-wall-sign')
    expect(sign, 'the sign').toBeDefined()
    // on the north wall's face, and over the podium (not over the heroes' sites, whose walls are for their own work)
    expect(sign!.rotation.y).toBeCloseTo(Math.PI / 4)
    expect(sign!.position.x + sign!.position.z).toBeGreaterThan(-17.0)
    expect(sign!.position.x + sign!.position.z).toBeLessThan(-16.3)
    expect(sign!.position.x).toBeGreaterThan(GARAGE_PODIUM.x0)
    expect(sign!.position.x).toBeLessThan(GARAGE_PODIUM.x1)
  })

  it('gives Billy a board, and Serena and Matt a desk and a chair', () => {
    const env = buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)
    // Billy's set is `desk:billy` (the board, the rug and the dais), and he has no chair: he stands, alone.
    expect(env.props?.get('desk:billy')).toBeDefined()
    expect(env.props?.get('chair:billy')).toBeUndefined()
    expect(env.props?.get('chair:serena')).toBeDefined()
    expect(env.props?.get('chair:matt')).toBeDefined()
    expect(env.hq).toBeDefined()
  })
})
