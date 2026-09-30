import * as T from 'three'
import { OS } from '../art/skin.ts'
import { box, cylinder, batchArt, disposeArt, sharedMaterial } from './worldArt.ts'
import { BLOCK_SIZE, BLOCK_PITCH, CITY_CAPACITY, HOUSE_CAPACITY, cityBlock, houseLanding } from './cityGrid.ts'
import { createThrusters } from './thrusters.ts'
import { createCityHouse, dressCityLot } from './cityHouse.ts'
import { defaultCast, type StudioCast } from './studioPeople.ts'

/** Fine, deterministic aggregate in asphalt and concrete, shared across the city. */
function paving(colour: string) {
  return sharedMaterial(`city:paving:${colour}`, () => {
    const data = new Uint8Array(64 * 64 * 4)
    let seed = 913
    for (let i = 0; i < data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const grain = 210 + seed % 46
      data[i] = grain; data[i + 1] = grain; data[i + 2] = grain; data[i + 3] = 255
    }
    const map = new T.DataTexture(data, 64, 64)
    map.wrapS = map.wrapT = T.RepeatWrapping; map.repeat.set(8, 8)
    map.magFilter = T.LinearFilter; map.minFilter = T.LinearMipmapLinearFilter; map.generateMipmaps = true; map.needsUpdate = true
    return new T.MeshStandardMaterial({ color: colour, map, roughness: 1 })
  })
}

/** Moonlit surfaces must still read outside the garage's small pools of light. */
function moonlit(group: T.Group) {
  group.traverse(o => {
    if (!(o instanceof T.Mesh) || !(o.material instanceof T.MeshStandardMaterial)) return
    const source = o.material
    o.material = sharedMaterial(`city:moon:${source.uuid}`, () => {
      const lit = source.clone()
      lit.emissive.copy(source.color); lit.emissiveIntensity = .45
      lit.emissiveMap = source.map
      return lit
    })
  })
}

interface Events { landed(box: T.Box3): void; ignited(): void; exhaust(box: T.Box3): void }
export function createCityHouses(events: Events, cast: () => StudioCast = defaultCast) {
  const root = new T.Group()
  const ground = new T.Group(); root.add(ground)
  const tiles: T.Group[] = []
  // Streets are the negative space between square lots, including the garage.
  for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) {
    const tile = new T.Group(); tile.position.set(x * BLOCK_PITCH, 0, z * BLOCK_PITCH); ground.add(tile); tiles.push(tile)
    const base = x === 0 && z === 0 ? -.175 : 0
    box(tile, 0, -.49 + base, 0, BLOCK_PITCH, .05, BLOCK_PITCH, OS.n1, false).material = paving(OS.n1)
    box(tile, 0, -.43 + base, 0, BLOCK_SIZE, .08, BLOCK_SIZE, OS.n3, false)
    box(tile, 0, -.34 + base, 0, BLOCK_SIZE - 1, .02, BLOCK_SIZE - 1, OS.n2, false).material = paving(OS.n2)
    for (const offset of [-12, 0, 12]) {
      box(tile,  BLOCK_PITCH / 2, -.42,  offset, .12, .015, 3, OS.n4, false)
      box(tile,  offset, -.42,  BLOCK_PITCH / 2, 3, .015, .12, OS.n4, false)
    }
    // Footway joints are narrow grooves in concrete, not a glowing placement outline.
    for (let offset = -12; offset <= 12; offset += 3) for (const side of [-1, 1]) {
      box(tile,  side * 14.7, -.341,  offset, .6, .008, .025, OS.n2, false)
      box(tile,  offset, -.341,  side * 14.7, .025, .008, .6, OS.n2, false)
    }
    if ((x + z) % 2 === 0) {
      const lx =  14, lz =  14
      cylinder(tile, lx, -.3, lz, .075, 3.7, OS.n3)
      box(tile, lx - .45, 3.3, lz, 1, .09, .09, OS.n3)
      box(tile, lx - .85, 3.2, lz, .45, .12, .32, OS.lamp, false).material = sharedMaterial('city:street-lamp', () => new T.MeshBasicMaterial({ color: OS.lamp }))
    }
  }
  moonlit(ground)
  tiles.forEach(tile => batchArt(tile))
  type Building = ReturnType<typeof createCityHouse> & { group: T.Group; lot: T.Group; rig: ReturnType<typeof createThrusters>; marker: T.LineLoop; legs: T.Group; start: number | null; wait: number; landed: boolean; ignited: boolean; dust: boolean; hop: number | null }
  const buildings: Building[] = []
  let clock = 0, staff = 0, offset = 0
  function footprint(i: number) {
    const at = cityBlock(i + 1)
    return new T.Box3(new T.Vector3(at.x - 16, -.3, at.z - 14), new T.Vector3(at.x + 16, 9.2, at.z + 17))
  }
  function remove(b: Building) {
    b.group.removeFromParent(); b.lot.removeFromParent(); disposeArt(b.lot); b.marker.removeFromParent(); b.dispose(); b.rig.dispose()
    b.marker.geometry.dispose(); (b.marker.material as T.Material).dispose()
  }
  return {
    root,
    get count() { return buildings.length },
    reset() { while (buildings.length) remove(buildings.pop()!) },
    setOffset(next: number) {
      if (next === offset) return
      while (buildings.length) remove(buildings.pop()!)
      offset = next
    },
    setStaff(n: number, animate: boolean) {
      staff = Math.min(CITY_CAPACITY, Math.max(0, Math.floor(n)))
      const count = Math.ceil(staff / HOUSE_CAPACITY)
      while (buildings.length > count) remove(buildings.pop()!)
      let queued = buildings.reduce((delay, b) => Math.max(delay, b.start === null ? 0 : b.start + 1.5 + b.wait - clock), 0)
      while (buildings.length < count) {
        const i = buildings.length, at = cityBlock(i + 1), model = createCityHouse(offset / 100 + i, cast)
        const group = new T.Group(); group.position.set(at.x, -.3, at.z); group.add(model.body); root.add(group)
        const rig = createThrusters(19, 18); group.add(rig.root)
        const legs = new T.Group(); group.add(legs)
        for (const x of [-10, 10]) for (const z of [-9.5, 9.5]) box(legs, x, 0, z, .45, .65, .45, OS.n4)
        const edge = BLOCK_SIZE / 2 - 1
        const marker = new T.LineLoop(new T.BufferGeometry().setFromPoints([
          new T.Vector3(-edge, 0, -edge), new T.Vector3(edge, 0, -edge), new T.Vector3(edge, 0, edge), new T.Vector3(-edge, 0, edge),
        ]), new T.LineBasicMaterial({ color: OS.calm2, transparent: true }))
        marker.position.set(at.x, -.29, at.z); root.add(marker)
        const b: Building = { ...model, group, lot: dressCityLot(root, at.x, at.z), rig, marker, legs, start: animate ? clock : null, wait: queued,
          landed: !animate, ignited: false, dust: false, hop: null }
        buildings.push(b); queued += .22
        group.position.y += animate ? 30 : 0
        marker.visible = animate; legs.visible = false; rig.update(0, false, clock)
      }
      tiles.forEach(tile => { tile.visible = (offset === 0 && tile.position.x === 0 && tile.position.z === 0) || buildings.some(b => Math.abs(b.group.position.x - tile.position.x) < 1 && Math.abs(b.group.position.z - tile.position.z) < 1) })
      buildings.forEach((b, i) => { b.fill(Math.min(HOUSE_CAPACITY, staff - i * HOUSE_CAPACITY)) })
    },
    setView(camera: T.Camera, pixelsPerMetre: number) {
      let changed = false
      root.updateMatrixWorld(true)
      buildings.forEach(b => {
        const at = b.group.getWorldPosition(new T.Vector3()).project(camera)
        const visible = Math.abs(at.x) < 1.5 && Math.abs(at.y) < 1.5 && at.z >= -1 && at.z <= 1
        const close = pixelsPerMetre >= (b.exterior.visible ? 10 : 8)
        if (b.cutaway(close && visible && b.start === null)) changed = true
      })
      return changed
    },
    update(now: number) {
      clock = now
      let active = false
      buildings.forEach((b, i) => {
        if (b.interior?.update(now)) active = true
        if (b.start !== null) {
          active = true
          const t = now - b.start, pose = houseLanding(t, b.wait)
          b.group.position.y = -.3 + pose.height
          b.body.scale.y = pose.squash
          b.rig.update(pose.height, pose.burning, now + i)
          b.legs.visible = pose.height < 1 && !pose.landed
          // Legs retract into the base; they never protrude through the pavement.
          b.legs.position.y = -Math.min(.3, pose.height)
          b.marker.visible = !pose.landed
          b.marker.scale.setScalar(1 - .35 * Math.min(1, t / 1.5))
          if (pose.burning && !b.ignited) { b.ignited = true; events.ignited() }
          if (pose.burning && pose.height < 4 && !b.dust) { b.dust = true; events.exhaust(footprint(i)) }
          if (pose.landed && !b.landed) { b.landed = true; events.landed(footprint(i)) }
          if (t >= 1.7 + b.wait) { b.start = null; b.body.scale.y = 1 }
        } else if (b.hop !== null) {
          active = true
          const t = now - b.hop
          b.body.position.y = t < .4 ? .35 * Math.sin(Math.PI * t / .4) : 0
          if (t >= .4) b.hop = null
        }
      })
      return active
    },
    hop(seat: number) { const b = buildings[Math.floor((seat - offset) / HOUSE_CAPACITY)]; if (b && b.start === null) { if (b.interior?.root.visible) b.interior.hop(seat, clock); else b.hop = clock } },
    headOf(seat: number) { const b = buildings[Math.floor((seat - offset) / HOUSE_CAPACITY)]; return b && seat >= offset && seat < offset + staff ? (b.interior?.root.visible ? b.interior.headOf(seat) : b.group.position.clone().add(new T.Vector3(0, 4, 8))) : null },
    pick(ray: T.Raycaster) {
      root.updateMatrixWorld(true)
      const candidates: { mesh: T.Object3D; seat: number }[] = []
      buildings.forEach((building, i) => {
        if (building.interior?.root.visible) {
          building.interior.targets.forEach(mesh => { if (mesh.visible) candidates.push({ mesh, seat: Number(mesh.userData.seat) }) })
        } else candidates.push({ mesh: building.exterior, seat: offset + i * HOUSE_CAPACITY })
      })
      const hits = ray.intersectObjects(candidates.map(c => c.mesh), true)
      for (const hit of hits) {
        for (let o: T.Object3D | null = hit.object; o; o = o.parent) {
          const found = candidates.find(c => c.mesh === o)
          if (found) return found.seat
        }
      }
      return null
    },
    bounds() { return buildings.length ? buildings.reduce((bounds, _, i) => bounds.union(footprint(i)), new T.Box3()) : null },
    dispose() { buildings.forEach(remove); disposeArt(ground) },
  }
}
