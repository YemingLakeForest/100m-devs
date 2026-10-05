import { describe, expect, it } from 'vitest'
import { GARAGE_ASSEMBLED, buildGarageEnvironment, showGarageStations } from './garageEnvironment.ts'
import { defaultCast } from './studioPeople.ts'
import { LEADER_IDS, leaderSeat } from '../sim/floorPlan.ts'

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

  it('stands Billy at an easel with no desk and no chair', () => {
    const env = buildGarageEnvironment(3, cast, 'on', false, GARAGE_ASSEMBLED, true)
    expect(env.props?.get('desk:billy')).toBeDefined() // the easel, which is what drops in first
    expect(env.props?.get('chair:billy')).toBeUndefined()
    expect(env.props?.get('chair:serena')).toBeDefined()
  })
})
