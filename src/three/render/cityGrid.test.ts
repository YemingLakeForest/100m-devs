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
    const city = createCityHouses({ landed: () => landings.push(now), ignited: () => ignitions.push(now), exhaust() {}, hired() {} })
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
  it('leaves the garage its twenty: no house stands for them, the first stands for the twenty-first (2026-10-15)', () => {
    // *"I want the garage/hq still filled and new people hired in new space."* The home city's first house holds seats 20 and on;
    // a studio of twenty is a full garage and an empty street, and every other city is houses from its first seat.
    const city = createCityHouses({ landed() {}, ignited() {}, exhaust() {}, hired() {} })
    city.setStaff(20, false); city.update(0)
    expect(city.count).toBe(0)
    city.setStaff(21, false); city.update(0)
    expect(city.count).toBe(1)
    city.setOffset(1800); city.setStaff(21, false)
    expect(city.count).toBe(1)
    city.setStaff(1, false)
    expect(city.count).toBe(1)
    city.dispose()
  })

  it('shows none of a house’s reserved seats, and keeps the global numbers of the rest', () => {
    const inside = createCityInterior(0, defaultCast(), 20)
    inside.fill(25)
    expect(inside.targets.filter(t => t.visible)).toHaveLength(5)
    expect(inside.targets.filter(t => t.visible).map(t => t.userData.seat)).toEqual([20, 21, 22, 23, 24])
    inside.dispose()
  })

  it('tells the view of a hire into a standing house: closed, at once; open, as each one lands', () => {
    const hires: number[] = []
    let now = 0
    const city = createCityHouses({ landed() {}, ignited() {}, exhaust() {}, hired: () => hires.push(now) })
    // A house built around a loaded save, and a person added to it: the closed house takes the thump itself.
    city.setStaff(30, false); city.update(0)
    city.setStaff(31, true)
    expect(hires).toHaveLength(1)
    // The same house cut open: three hires fall in a beat apart, and each is told as it lands, not as it is hired.
    const head = city.headOf(20)!
    const lens = new T.OrthographicCamera(-40, 40, 40, -40, .1, 400)
    lens.position.set(head.x, 100, head.z - 8); lens.lookAt(head.x, 0, head.z - 8)
    lens.updateProjectionMatrix(); lens.updateMatrixWorld(true)
    city.setView(lens, 20)
    now = 5; city.update(now)
    hires.length = 0
    city.setStaff(34, true)
    expect(hires).toHaveLength(0)
    for (now = 5; now < 7; now += 1 / 60) city.update(now)
    expect(hires).toHaveLength(3)
    expect(new Set(hires.map(t => t.toFixed(2))).size).toBe(3)
    // Nobody is told twice, and a house that is only loaded (no animation) tells nobody.
    city.update(9)
    expect(hires).toHaveLength(3)
    city.setStaff(40, false)
    expect(hires).toHaveLength(3)
    city.dispose()
  })

  it('drops each hire from above a beat apart, and tells the view once as each one lands', () => {
    const inside = createCityInterior(0, defaultCast(), 20)
    inside.fill(21)
    inside.fill(23, 10)
    const heights = () => inside.targets.slice(21, 23).map(t => t.visible)
    expect(heights()).toEqual([true, true])
    inside.update(10.05)
    inside.update(10.5)
    expect(inside.takeLandings()).toBe(1)
    inside.update(10.7)
    expect(inside.takeLandings()).toBe(1)
    for (let t = 11; t < 12; t += 1 / 30) inside.update(t)
    expect(inside.update(13)).toBe(false)
    expect(inside.takeLandings()).toBe(0)
    inside.dispose()
  })

  it('fits a hundred distinct workstations inside the house with space between desk tops', () => {
    const desks = Array.from({ length: HOUSE_CAPACITY }, (_, i) => {
      const at = houseSeat(i)
      return { ...at, z: at.z + (Math.floor(i / 10) % 2 ? -.46 : .46) }
    })
    expect(new Set(desks.map(d => `${d.x},${d.y},${d.z}`)).size).toBe(HOUSE_CAPACITY)
    desks.forEach((d, i) => {
      expect(Math.abs(d.x) + .57).toBeLessThan(8.87)
      // The centre aisle, x ±.51, stays clear of desks.
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
  it('hands the city every seat its open house shows, and takes them back when the lens leaves', () => {
    // The cutaway builds the interior lazily, so the building's `interior` is a
    // getter; spreading the model froze it at null, and every seat query
    // (coding, hop, head, pick) behaved as if no house had ever been opened.
    const city = createCityHouses({ landed() {}, ignited() {}, exhaust() {}, hired() {} })
    city.setStaff(30, false); city.update(0)
    const head = city.headOf(20)!
    const lens = new T.OrthographicCamera(-40, 40, 40, -40, .1, 400)
    lens.position.set(head.x, 100, head.z - 8); lens.lookAt(head.x, 0, head.z - 8)
    lens.updateProjectionMatrix(); lens.updateMatrixWorld(true)
    expect(city.codingSeats()).toEqual([])
    city.setView(lens, 20)
    // Thirty people in all, and the garage has the first twenty: the house shows the ten after them, and never a seat that is the
    // garage's (2026-10-15).
    expect(city.codingSeats().sort((a, b) => a - b)).toEqual(Array.from({ length: 10 }, (_, i) => 20 + i))
    expect(city.headOf(20)).not.toEqual(head)
    city.setView(lens, 2)
    expect(city.codingSeats()).toEqual([])
    city.dispose()
  })
})
