import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { BLOCK_SIZE, STREET_WIDTH, CITY_CAPACITY, HOUSE_CAPACITY, cityBlock, districtBlock, houseLanding } from './cityGrid.ts'
import { createCityHouses } from './cityHouses.ts'
import { createThrusters } from './thrusters.ts'
import { createCityInterior, houseSeat } from './cityInterior.ts'
import { defaultCast } from './studioPeople.ts'

describe('the city blocks (§7.7.2)', () => {
  it('reserves the origin for the garage and fills nearest first, leaving streets between lots', () => {
    const blocks = Array.from({ length: CITY_CAPACITY / HOUSE_CAPACITY + 1 }, (_, i) => cityBlock(i))
    expect(blocks[0]).toEqual({ x: 0, z: 0 })
    blocks.forEach((b, i) => {
      if (i) expect(b.x ** 2 + b.z ** 2).toBeGreaterThanOrEqual(blocks[i - 1].x ** 2 + blocks[i - 1].z ** 2)
      blocks.slice(0, i).forEach(a => expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z))).toBeGreaterThanOrEqual(BLOCK_SIZE + STREET_WIDTH))
    })
  })
  it('keeps neighbourhood addresses fixed when the district becomes visible', () => {
    for (let i=0;i<=18;i++) expect(districtBlock(i)).toEqual(cityBlock(i))
    const positions = Array.from({length:418},(_,i)=>districtBlock(i))
    expect(new Set(positions.map(p=>p.x+','+p.z)).size).toBe(418)
    for(let i=1;i<positions.length;i++) expect(positions[i].x**2+positions[i].z**2).toBeGreaterThanOrEqual(positions[i-1].x**2+positions[i-1].z**2)
  })
  it('brakes continuously, waits above ground, then cuts its jets at contact', () => {
    let previous = Infinity
    for (let t = 0; t < 4; t += .005) {
      const pose = houseLanding(t, 1)
      expect(pose.height).toBeGreaterThanOrEqual(0)
      expect(pose.height).toBeLessThanOrEqual(previous)
      previous = pose.height
      if (pose.landed) expect(pose.burning).toBe(false)
    }
    expect(houseLanding(1.4, 1).height).toBeGreaterThan(0)
    expect(houseLanding(2.6, 1).landed).toBe(true)
  })
  it('clamps the entire exhaust geometry above ground, even at touchdown', () => {
    const rig = createThrusters(15, 13)
    for (const gap of [0, .01, .1, .4, 1, 4, 8]) {
      rig.update(gap, true, 1)
      rig.root.position.y = gap
      rig.root.updateMatrixWorld(true)
      expect(new T.Box3().setFromObject(rig.root).min.y).toBeGreaterThanOrEqual(-1e-6)
    }
    rig.dispose()
  })
  it('loads without arrival events, staggers a mass hire, and cancels removed buildings', () => {
    const landings: number[] = [], ignitions: number[] = []
    let now = 0
    const city = createCityHouses({ landed: () => landings.push(now), ignited: () => ignitions.push(now), exhaust() {} })
    city.setStaff(100, false); city.update(0)
    expect(landings).toHaveLength(0)
    city.setStaff(400, true)
    for (now = 0; now < 3; now += .02) city.update(now)
    expect(landings).toHaveLength(3)
    expect(ignitions).toHaveLength(3)
    expect(new Set(landings).size).toBe(3)
    city.setStaff(700, true); city.setStaff(0, false)
    city.update(20)
    expect(city.count).toBe(0)
    expect(landings).toHaveLength(3)
    expect(city.headOf(0)).toBeNull()
    city.dispose()
  })
  it('fits a hundred distinct workstations inside the house with space between desk tops', () => {
    const desks = Array.from({ length: HOUSE_CAPACITY }, (_, i) => {
      const at = houseSeat(i)
      return { ...at, z: at.z + (Math.floor(i / 10) % 2 ? -.46 : .46) }
    })
    expect(new Set(desks.map(d => `${d.x},${d.y},${d.z}`)).size).toBe(HOUSE_CAPACITY)
    desks.forEach((d, i) => {
      expect(Math.abs(d.x) + .57).toBeLessThan(8.87)
      // The central stair and its handrails occupy x ±.51.
      expect(Math.abs(d.x) - .57).toBeGreaterThan(.51)
      expect(Math.abs(d.z) + .3).toBeLessThan(7.37)
      desks.slice(0, i).forEach(other => {
        if (other.y === d.y) expect(Math.abs(other.x - d.x) >= 1.14 || Math.abs(other.z - d.z) >= .6).toBe(true)
      })
    })
  })
  it('exposes only hired people to picking and retains their global seat across the house boundary', () => {
    const inside = createCityInterior(1, defaultCast())
    inside.fill(21)
    expect(inside.targets.filter(t => t.visible)).toHaveLength(21)
    expect(inside.targets[0].userData.seat).toBe(100)
    expect(inside.targets[20].userData.seat).toBe(120)
    inside.fill(5)
    expect(inside.targets.filter(t => t.visible)).toHaveLength(5)
    inside.dispose()
  })
})
