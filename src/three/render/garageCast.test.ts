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
    expect(bodyOf('serena').visible).toBe(false)
    expect(bodyOf('matt').visible).toBe(false)
    expect(bodyOf('billy').visible).toBe(false)
    showGarageStations(env, { founder: true, james: 3, heroes: ['serena'] }, cast)
    expect(bodyOf('serena').visible).toBe(true)
    expect(bodyOf('matt').visible).toBe(false)
  })

  it('shows the Ops Room’s step and Matt’s riser only with their heroes, and gives Billy no platform to show', () => {
    // Neither has an old wall to hide behind — the step is in front of Serena's, and Matt has none — so a standing platform
    // with a lit edge was in the early garage with nothing on it (found by looking). Billy stands on the open floor and
    // has no platform at all: his board, rug and dais are his *set* (`desk:billy`), which comes with him.
    const env = buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)
    const shown = (key: string) => env.props!.get(key)!.group.visible
    expect(env.props?.get('riser:billy')).toBeUndefined()
    showGarageStations(env, { founder: true, james: 3, heroes: [] }, cast)
    expect([shown('step:serena'), shown('riser:matt'), shown('desk:billy')]).toEqual([false, false, false])
    showGarageStations(env, { founder: true, james: 3, heroes: ['billy'] }, cast)
    expect([shown('step:serena'), shown('riser:matt'), shown('desk:billy')]).toEqual([false, false, true])
    showGarageStations(env, { founder: true, james: 3, heroes: ['billy', 'serena'] }, cast)
    expect(shown('step:serena')).toBe(true)
    showGarageStations(env, { founder: true, james: 3, heroes: ['billy', 'serena', 'matt'] }, cast)
    expect(shown('riser:matt')).toBe(true)
  })

  it('stands everybody on their own platform: the founder on the podium, James on the deck, each hero on their site', () => {
    // The height a prop comes to rest at is the height of the floor it stands on. The founder's podium is the highest
    // thing in the room — *"I want the me even more promenant, on a platform"* — and James is a step above the floor.
    const env = buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)
    const restY = (key: string) => new T.Vector3().setFromMatrixPosition(env.props!.get(key)!.rest).y
    expect(restY('body:founder')).toBeCloseTo(GARAGE_PODIUM.rise, 6)
    expect(restY('body:james')).toBeCloseTo(GARAGE_DECK.rise, 6)
    expect(restY('body:serena')).toBeCloseTo(HERO_SITES.serena.rise, 6)
    expect(restY('body:matt')).toBeCloseTo(HERO_SITES.matt.rise, 6)
    expect(restY('body:billy')).toBeCloseTo(0, 6)
    const ys = LEADER_IDS.map((id) => restY(`body:${id}`))
    expect(Math.max(...ys)).toBeCloseTo(restY('body:founder'), 6)
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
    expect(sign!.position.z).toBeGreaterThan(-9.7)
    expect(sign!.position.z).toBeLessThan(-9.5)
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
