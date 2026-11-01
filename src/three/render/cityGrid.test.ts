import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { TILE_W, TILE_D, CITY_CAPACITY, HOUSE_CAPACITY, cityBlock, districtBlock, officeTile, tileAt, cityParent, houseUnfold, cityHinge, UNFOLD_SECONDS } from './cityGrid.ts'
import { createCityHouses } from './cityHouses.ts'
import { createThrusters } from './thrusters.ts'
import { createCityInterior, houseSeat, INTERIOR_SCALE } from './cityInterior.ts'
import { defaultCast } from './studioPeople.ts'

describe('the city blocks (§7.7.2)', () => {
  it('reserves the origin for the garage and fills nearest first (the district\'s order)', () => {
    const blocks = Array.from({ length: CITY_CAPACITY / HOUSE_CAPACITY + 1 }, (_, i) => cityBlock(i))
    expect(blocks[0]).toEqual({ x: 0, z: 0 })
    blocks.forEach((b, i) => { if (i) expect(b.x ** 2 + b.z ** 2).toBeGreaterThanOrEqual(blocks[i - 1].x ** 2 + blocks[i - 1].z ** 2) })
  })
  it('lays the office in tiles that touch: no street, no gap, no overlap, and the garage\'s own apron is the first of them (2026-11-01)', () => {
    // *"I want the entire place as one big office"* — the claim is that nothing is between one tile and the next, not the pitch.
    const tiles = Array.from({ length: CITY_CAPACITY / HOUSE_CAPACITY + 1 }, (_, i) => officeTile(i))
    expect(tiles[0]).toMatchObject({ x: 1.5, z: 1.1 })   // the apron `garageEnvironment` lays under the garage, so the first seam is flush with it
    tiles.forEach((t, i) => {
      // the same addresses as the district's, in the same order: zooming out reshuffles nothing
      expect(tileAt(t.ix, t.iz)).toBe(i)
      tiles.slice(0, i).forEach(a => {
        const apartX = Math.abs(a.x - t.x), apartZ = Math.abs(a.z - t.z)
        expect(apartX >= TILE_W - 1e-9 || apartZ >= TILE_D - 1e-9).toBe(true)    // never overlapping
      })
      // and each one touches an older one along a whole edge
      if (i) expect(tiles.slice(0, i).some(a => (Math.abs(a.x - t.x) === TILE_W && a.z === t.z) || (Math.abs(a.z - t.z) === TILE_D && a.x === t.x))).toBe(true)
    })
  })
  it('hangs every tile from the oldest tile beside it, the garage being the oldest of all', () => {
    for (let i = 1; i <= 18; i++) {
      const parent = cityParent(i), { dx, dz } = cityHinge(i)
      expect(parent).toBeLessThan(i)
      const here = officeTile(i), there = officeTile(parent)
      expect([there.x - here.x, there.z - here.z]).toEqual([dx * TILE_W, dz * TILE_D])
      // nothing older is beside it on any other side
      for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const other = tileAt(here.ix + sx, here.iz + sz)
        if (other !== undefined) expect(other).toBeGreaterThanOrEqual(parent)
      }
    }
    // the first four hang from the garage, so the office opens on every side of it
    expect([1, 2, 3, 4].map(cityParent)).toEqual([0, 0, 0, 0])
    expect(tileAt(40, 40)).toBeUndefined()
  })
  it('keeps neighbourhood addresses fixed when the district becomes visible', () => {
    for (let i=0;i<=18;i++) expect(districtBlock(i)).toEqual(cityBlock(i))
    const positions = Array.from({length:418},(_,i)=>districtBlock(i))
    expect(new Set(positions.map(p=>p.x+','+p.z)).size).toBe(418)
    for(let i=1;i<positions.length;i++) expect(positions[i].x**2+positions[i].z**2).toBeGreaterThanOrEqual(positions[i-1].x**2+positions[i-1].z**2)
  })
  it('unfolds from under its neighbour, arrives flat, and settles without lifting a nine-metre wall far (2026-10-31)', () => {
    // *"each office expansion it's a unfold and expand to a new office space"* — the claim is the order (folded, sweeping up,
    // flat, a small rebound, still), not the timings.
    expect(houseUnfold(0, 1).phi).toBeLessThan(-3)
    expect(houseUnfold(0, 1).started).toBe(false)
    let previous = -Infinity
    for (let t = 1; t < 1 + UNFOLD_SECONDS; t += .01) {
      const pose = houseUnfold(t, 1)
      expect(pose.phi).toBeGreaterThanOrEqual(previous)
      expect(pose.phi).toBeLessThanOrEqual(0)
      previous = pose.phi
    }
    expect(houseUnfold(1 + UNFOLD_SECONDS, 1).landed).toBe(true)
    for (let t = 1 + UNFOLD_SECONDS; t < 6; t += .005) expect(Math.abs(houseUnfold(t, 1).phi)).toBeLessThanOrEqual(.09)
    expect(houseUnfold(6, 1)).toMatchObject({ phi: 0, done: true })
  })
  it('hinges every block on a standing neighbour nearer the garage, so the city opens in every direction', () => {
    const seen = new Set<string>()
    for (let i = 1; i <= 18; i++) {
      const { dx, dz } = cityHinge(i), at = cityBlock(i)
      expect(Math.abs(dx) + Math.abs(dz)).toBe(1)
      seen.add(dx + ',' + dz)
      // the neighbour exists among the older addresses
      const near = Array.from({ length: i }, (_, k) => cityBlock(k)).some(o => Math.abs(o.x - at.x) <= 41 && Math.abs(o.z - at.z) <= 41 && (o.x === at.x || o.z === at.z))
      expect(near).toBe(true)
    }
    expect(seen.size).toBeGreaterThanOrEqual(3)
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
    const city = createCityHouses({ landed: () => landings.push(now), ignited: () => ignitions.push(now), hired() {} })
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
    const city = createCityHouses({ landed() {}, ignited() {}, hired() {} })
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
    const city = createCityHouses({ landed() {}, ignited() {}, hired: () => hires.push(now) })
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
    // Each desk lands first, then its developer .25 s later (2026-10-18): two hires .12 s apart, four contacts in that order.
    inside.update(10.05)
    inside.update(10.5)
    expect(inside.takeDeskLandings()).toBe(1)
    expect(inside.takeLandings()).toBe(0)
    inside.update(10.62)
    expect(inside.takeDeskLandings()).toBe(1)
    inside.update(10.75)
    expect(inside.takeLandings()).toBe(1)
    inside.update(10.87)
    expect(inside.takeLandings()).toBe(1)
    for (let t = 11; t < 12.5; t += 1 / 30) inside.update(t)
    expect(inside.update(13)).toBe(false)
    expect(inside.takeLandings()).toBe(0)
    inside.dispose()
  })

  it('welcomes a hire: neighbours hop after the landing, and the hire hops twice once settled (2026-10-18)', () => {
    // *"I want more satisfaction when hiring devs."* The claim is the order — contact, then the room, then the hire — not the heights.
    const inside = createCityInterior(0, defaultCast(), 20)
    inside.fill(40)
    inside.fill(41, 10)
    const people: T.Object3D[] = []
    // People only: a desk carries its seat's number too, and stays put while its instances fall.
    inside.root.traverse(o => { if (typeof o.userData.seat === 'number' && !(o instanceof T.Mesh) && o.userData.dynamic === false) people.push(o) })
    const hire = people.find(o => o.userData.seat === 40)!
    const neighbours = people.filter(o => o.visible && o !== hire)
    const lifted = () => neighbours.some(o => o.position.y > .05)
    let contact = -1, firstNeighbour = -1
    const hireHops: number[] = []
    let wasUp = false
    for (let t = 10; t < 12.5; t += 1 / 120) {
      inside.update(t)
      if (contact < 0 && inside.takeLandings() > 0) contact = t
      if (contact >= 0 && firstNeighbour < 0 && lifted()) firstNeighbour = t
      const up = contact >= 0 && t > contact + .23 && hire.position.y > .05
      if (up && !wasUp) hireHops.push(t)
      wasUp = up
    }
    expect(contact).toBeGreaterThan(0)
    expect(firstNeighbour).toBeGreaterThan(contact)
    expect(hireHops).toHaveLength(2)
    expect(inside.update(13)).toBe(false)
    inside.dispose()
  })

  it('plays a layoff: a gulp in the seat, then out through the roof, the neighbours duck, and the seat ends empty (2026-10-19)', () => {
    // *"I want some game juice to show the layoff as well."* The claim is the order — sitting, gulp, yank, flinch — not the heights.
    const inside = createCityInterior(0, defaultCast(), 20)
    inside.fill(40)
    const people: T.Object3D[] = []
    inside.root.traverse(o => { if (typeof o.userData.seat === 'number' && !(o instanceof T.Mesh) && o.userData.dynamic === false) people.push(o) })
    const gone = people.find(o => o.userData.seat === 39)!
    const neighbours = people.filter(o => o.visible && o !== gone)
    inside.fill(39, undefined, 10)
    // Let go, but still sitting there until their turn; nobody can click them.
    expect(gone.visible).toBe(true)
    expect(inside.targets[39].visible).toBe(false)
    let yank = -1, firstDuck = -1, gulped = false
    for (let t = 10; t < 12; t += 1 / 120) {
      inside.update(t)
      if (yank < 0 && gone.scale.y !== .8 && gone.position.y < .01) gulped = true
      if (yank < 0 && inside.takeDepartures() > 0) yank = t
      if (yank >= 0 && firstDuck < 0 && neighbours.some(o => o.scale.y < .79)) firstDuck = t
    }
    expect(gulped).toBe(true)
    expect(yank).toBeGreaterThan(10.3)
    expect(firstDuck).toBeGreaterThan(yank)
    expect(neighbours.every(o => o.position.y === 0)).toBe(true)
    expect(gone.visible).toBe(false)
    expect(inside.update(13)).toBe(false)
    // A fall that is not a layoff (a reset, a load) empties the seat at once.
    inside.fill(30)
    expect(people.find(o => o.userData.seat === 35)!.visible).toBe(false)
    inside.dispose()
  })

  it('lifts a house a layoff empties off its lot, and removes one a reset empties at once (2026-10-19)', () => {
    const left: number[] = []
    let now = 0
    const city = createCityHouses({ landed() {}, ignited() {}, hired() {}, left: () => left.push(now) })
    city.setStaff(250, false); city.update(0)
    expect(city.count).toBe(3)
    city.setStaff(150, true, true)
    expect(city.count).toBe(2)
    expect(left).toHaveLength(2)
    let rose = false
    for (now = 0; now < 3; now += 1 / 30) { city.update(now); city.root.traverse(o => { if (o.position.y > 20) rose = true }) }
    expect(rose).toBe(true)
    city.setStaff(50, true)
    expect(city.count).toBe(1)
    expect(left).toHaveLength(2)
    city.dispose()
  })

  it('walls a side of a tile only while nothing is open beyond it, and takes the wall down as the tile beyond starts to open (2026-11-01)', () => {
    // *"no need for the inner wall around the HQ"* and the wall that follows the floor out: the claim is where a wall stands and
    // that it moves, not how high or how fast.
    let now = 0
    const city = createCityHouses({ landed() {}, ignited() {}, hired() {} })
    city.setStaff(150, false); city.update(0)
    // Tiles 0 and 1 are the garage's north and west neighbours (addresses (0,-1) and (-1,0)): each has the garage on its inner side,
    // and the garage is not walled off from it. Everything else faces the outside.
    expect(city.wallHeights(0)).toEqual({ N: 1, S: 0, W: 1, E: 1 })
    expect(city.wallHeights(1)).toEqual({ N: 1, S: 1, W: 1, E: 0 })
    // Two more tiles open: the fifth is the diagonal (-1,-1), beside both of them.
    city.setStaff(450, true)
    expect(city.count).toBe(5)
    for (now = 0; now < 4; now += 1 / 30) city.update(now)
    expect(city.wallHeights(0).W).toBe(0)    // tile 0's west side faces the fifth tile
    expect(city.wallHeights(1).N).toBe(0)    // tile 1's north side faces it too
    expect(city.wallHeights(0).N).toBe(1)    // and the outside is still walled
    // Let the fifth go (a layoff): its place in the floor is empty, so the walls beside it stand back up.
    city.setStaff(150, true, true)
    for (now = 4; now < 8; now += 1 / 30) city.update(now)
    expect(city.wallHeights(0).W).toBe(1)
    expect(city.wallHeights(1).N).toBe(1)
    // A city that is not the home one has no garage: the side that would face it is the outside.
    city.setOffset(1800); city.setStaff(100, false); city.update(8)
    expect(city.wallHeights(0).S).toBe(1)
    city.dispose()
  })
  it('thumps a new tile once, when its furniture has risen, and not when it was ordered (2026-11-01)', () => {
    // The first tile's people are told when the wave has passed their desks: a hire into a floor that has not finished rising has
    // nothing to land on.
    const hires: number[] = []
    let now = 0
    const city = createCityHouses({ landed() {}, ignited() {}, hired: () => hires.push(now) })
    city.setStaff(30, true)
    expect(hires).toHaveLength(0)
    for (now = 0; now < 1.2; now += 1 / 60) city.update(now)
    expect(hires).toHaveLength(0)
    for (now = 1.2; now < 6; now += 1 / 60) city.update(now)
    expect(hires).toHaveLength(1)
    expect(hires[0]).toBeGreaterThan(1.5)
    city.dispose()
  })
  it('fits a hundred distinct workstations in one tile, with an aisle between every island and the room strips clear (2026-11-01)', () => {
    // A tile is 33 x 25 m. Its walls and columns take the outer metre and a half; the strips of meeting rooms and pantries along its
    // north and south edges (`officeTile.ts`) start at z = ±10.2. The claim is that the hundred desks fit between them and never
    // touch: not the pitch.
    const desks = Array.from({ length: HOUSE_CAPACITY }, (_, i) => {
      const at = houseSeat(i)
      return { x: at.x * INTERIOR_SCALE, y: at.y, z: (at.z + (Math.floor(i / 10) % 2 ? -.46 : .46)) * INTERIOR_SCALE, standingZ: at.z * INTERIOR_SCALE }
    })
    expect(new Set(desks.map(d => `${d.x},${d.y},${d.z}`)).size).toBe(HOUSE_CAPACITY)
    desks.forEach((d, i) => {
      expect(Math.abs(d.x) + .57 * INTERIOR_SCALE).toBeLessThan(TILE_W / 2 - 1.5)
      // The developer stands on the outside of the island, a little further out than the desk.
      expect(Math.abs(d.standingZ) + .4).toBeLessThan(10.2)
      desks.slice(0, i).forEach(other => {
        if (other.y === d.y) expect(Math.abs(other.x - d.x) >= 1.14 * INTERIOR_SCALE || Math.abs(other.z - d.z) >= .6 * INTERIOR_SCALE).toBe(true)
      })
    })
    // An aisle at least a metre wide runs between neighbouring islands, across and along.
    const islandsX = [...new Set(Array.from({ length: 10 }, (_, c) => Math.floor(c / 2)))].map(k => houseSeat(k * 2).x * INTERIOR_SCALE)
    islandsX.slice(1).forEach((x, k) => expect(x - islandsX[k] - 2 * (.72 + .57) * INTERIOR_SCALE).toBeGreaterThan(1))
    const pairsZ = Array.from({ length: 5 }, (_, p) => houseSeat(p * 20).z * INTERIOR_SCALE)
    pairsZ.slice(1).forEach((z, k) => expect(z - pairsZ[k] - (1.6 + 2 * .3) * INTERIOR_SCALE).toBeGreaterThan(1))
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
    const city = createCityHouses({ landed() {}, ignited() {}, hired() {} })
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
