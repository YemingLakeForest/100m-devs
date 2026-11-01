import * as T from 'three'
import { createThrusters } from './thrusters.ts'
import { createOfficeTile, SIDES, CARPET, type Side } from './officeTile.ts'
import { TILE_W, TILE_D, TILE_LEVEL, CITY_CAPACITY, HOUSE_CAPACITY, UNFOLD_SECONDS, UNFOLD_SINK, WAVE_START, WAVE_SPEED, officeTile, tileAt, cityHinge, cityParent, houseUnfold } from './cityGrid.ts'
import { GARAGE_CAP } from '../../sim/capacity.ts'
import { defaultCast, type StudioCast } from './studioPeople.ts'
import type { FlowLot } from './flow.ts'
import type { FlashPad } from './unitFlash.ts'

/** `hired`: somebody has dropped onto a desk in a tile that was already standing. */
/** `deskLanded`: a hire's desk has hit the floor of an open tile, a beat before its developer (`cityInterior.ts`, 2026-10-18). */
/** `left`: somebody laid off has been yanked out of a tile, or a tile a layoff emptied has lifted off its place in the floor (2026-10-19). */
interface Events { landed(box: T.Box3): void; ignited(): void; hired(): void; deskLanded?(): void; left?(): void }

/**
 * **The office** [2026-11-01, at the user's instruction: *"I don't want the houses unfolded one by one, I want the entire place as
 * one big office"*, then *"I want the tile by tile expansion"*, then *"no need for the inner wall around the HQ"*]. §7.7.2 used to
 * put a house on each block with a street between; now the city is tiles of one floor laid edge to edge (`officeTile.ts`), each
 * one hinged on the edge it shares with its oldest neighbour (the garage being the oldest of all) and hung from that
 * neighbour's panel while it swings, so a burst of them folds open as a chain. A tile opens when the next hire needs a desk in
 * it, and the wall round the outside of the open floor follows it out: a side comes down when the tile beyond it starts to
 * open, and comes back up when that tile goes. The name stays (`createCityHouses`, `Events`) because the view, the flow and the
 * district's atlas speak it; what stands on a block is a tile of the floor now.
 */
export function createCityHouses(events: Events, cast: () => StudioCast = defaultCast) {
  const root = new T.Group()
  type Tile = ReturnType<typeof createOfficeTile> & {
    k: number; ix: number; iz: number
    /** Carries the tile's body, so a layoff can lift the whole slab off its place on thrusters. */
    group: T.Group; rig: ReturnType<typeof createThrusters>
    hinge: T.Group; panel: T.Group; nx: number; nz: number
    leaving: number | null; start: number | null; wait: number
    /** The swing has begun (the tile is out of the dark), the furniture's wave has passed, the slam has been told. */
    started: boolean; ready: boolean; landed: boolean; ignited: boolean
    hop: number | null; sag: number | null; shown: number
  }
  const tiles: Tile[] = []
  /**
   * Tiles a layoff emptied, on their way up: the liquidation's lift-off (`liquidate`), one tile at a time. Out of `tiles` at
   * once, so the place they leave is free for the next hire and nothing counts, picks or flashes a tile that is leaving.
   */
  const departing: Tile[] = []
  let clock = 0, staff = 0, offset = 0
  /**
   * **The garage keeps its twenty** [2026-10-15, at the user's instruction: *"when we move up to new office space, it now move all
   * devs up and put them to new office, i don't want that, I want the garage/hq still filled and new people hired in new space"*].
   * In the home city the first tile's first twenty seats are the garage's, so they are never drawn here and the first tile
   * stands once there is a twenty-first person to put in it. Every other city (`setOffset`) is all tiles.
   */
  const reserved = () => (offset === 0 ? GARAGE_CAP : 0)
  function footprint(k: number) {
    const at = officeTile(k)
    return new T.Box3(new T.Vector3(at.x - TILE_W / 2, TILE_LEVEL, at.z - TILE_D / 2), new T.Vector3(at.x + TILE_W / 2, 4, at.z + TILE_D / 2))
  }
  /**
   * **A side of a tile is walled while nothing stands beyond it** — and the garage is something. A tile whose neighbour has begun
   * to open (or is loaded already open) has that side down; one whose neighbour has gone has it up again, because the floor
   * ends there. `delay` is how long after the cause the wall moves: a tile's seam comes down a beat after it starts swinging, and
   * a wall goes back up at once. No `now` does it all at once (a floor built around a loaded save).
   */
  const standing = (ix: number, iz: number) => {
    const k = tileAt(ix, iz)
    if (k === undefined) return false
    if (k === 0) return offset === 0
    const t = tiles[k - 1]
    return !!t && t.started && t.leaving === null
  }
  function syncWalls(now?: number, delay = 0) {
    for (const t of tiles) for (const side of Object.keys(SIDES) as Side[]) {
      const [dx, dz] = SIDES[side]
      t.setWall(side, !standing(t.ix + dx, t.iz + dz), now, delay)
    }
  }
  /**
   * A tile hung from a neighbour's panel (`buildTile`) is let go to the floor when that neighbour has finished opening: at
   * rest the panel's frame is the world's, so nothing moves. Anything that ends a tile early (a layoff, a liquidation, a
   * reset) must do the same, and hand it back flat.
   */
  function flatten(t: Tile) {
    t.hinge.rotation.set(0, 0, 0); t.hinge.visible = true
    for (const c of tiles.concat(departing)) if (c.hinge.parent === t.panel) root.add(c.hinge)
  }
  function remove(t: Tile) {
    flatten(t); t.hinge.removeFromParent()
    t.group.removeFromParent(); t.body.removeFromParent(); t.dispose(); t.rig.dispose()
  }
  /** A tile's furniture has finished rising: whoever is already seated in it arrives, one by one, as a hire does in a standing tile. */
  function settle(t: Tile) {
    t.ready = true
    const people = Math.min(HOUSE_CAPACITY, staff - (t.k - 1) * HOUSE_CAPACITY)
    if (people <= 0) return
    t.fill(people, clock)
    t.shown = people
    if (!t.interior?.root.visible) { t.hop = clock; events.hired() }
  }
  return {
    root,
    get count() { return tiles.length },
    reset() { while (tiles.length) remove(tiles.pop()!); while (departing.length) remove(departing.pop()!) },
    /**
     * §15.1a [2026-10-04] — **the first death's last shot: every tile lifts off.**
     * The landing played backwards — the thrusters light, the slab rises on them
     * ever faster until it is out of the frame, one after another — and its place in the floor is
     * left empty, the walls beside it standing back up. Resolved by `update`, which removes each tile when it has gone.
     */
    liquidate() {
      tiles.forEach((t, i) => { if (t.leaving === null) { flatten(t); t.leaving = clock + i * 0.25; t.start = null; t.wave.value = 400 } })
      syncWalls(clock)
    },
    /** Is a tile still on its way out? */
    get liquidating() { return tiles.some(t => t.leaving !== null) },
    setOffset(next: number) {
      if (next === offset) return
      while (tiles.length) remove(tiles.pop()!)
      while (departing.length) remove(departing.pop()!)
      offset = next
    },
    /** `laidOff`: the staff fell to §10.10.5's LAY OFF, so the people go on screen and an emptied tile lifts off (`garageView`). */
    setStaff(n: number, animate: boolean, laidOff = false) {
      staff = Math.min(CITY_CAPACITY, Math.max(0, Math.floor(n)))
      const count = staff > reserved() ? Math.ceil(staff / HOUSE_CAPACITY) : 0
      let removed = false
      for (let j = 0; tiles.length > count; j++) {
        const t = tiles.pop()!
        removed = true
        if (!laidOff || t.start !== null || t.leaving !== null) { remove(t); continue }
        // The outermost tile goes first, as it was the last to open.
        t.leaving = clock + j * .25; t.cutaway(false)
        departing.push(t); events.left?.()
      }
      let queued = tiles.reduce((delay, t) => Math.max(delay, t.start === null ? 0 : t.start + UNFOLD_SECONDS + t.wait - clock), 0)
      let built = false
      while (tiles.length < count) {
        const i = tiles.length, k = i + 1, at = officeTile(k), dir = cityHinge(k), parentTile = tiles[cityParent(k) - 1]
        const model = createOfficeTile(offset / 100 + i, cast, i === 0 ? reserved() : 0, { k, ix: at.ix, iz: at.iz }, dir)
        // The tile stands in a panel that hangs from a hinge on its inner edge (`houseUnfold`): the hinge group sits UNFOLD_SINK
        // under the floor and the panel UNFOLD_SINK over it, so at rest the two cancel and every child keeps its world
        // coordinates; folded, the panel is mirrored under the neighbour it is hinged to. A neighbour that is itself still opening
        // carries it, so the two swing as one chain.
        const hx = at.x + dir.dx * TILE_W / 2, hz = at.z + dir.dz * TILE_D / 2
        const hinge = new T.Group(); hinge.position.set(hx, -UNFOLD_SINK, hz)
        const panel = new T.Group(); panel.position.set(-hx, UNFOLD_SINK, -hz); hinge.add(panel)
        ;(parentTile && parentTile.start !== null ? parentTile.panel : root).add(hinge)
        const group = new T.Group(); group.position.set(at.x, TILE_LEVEL, at.z); group.add(model.body); panel.add(group)
        const rig = createThrusters(TILE_W - 6, TILE_D - 6); rig.root.position.y = -.3; group.add(rig.root); rig.update(0, false, clock)
        const t: Tile = { ...model, get interior() { return model.interior }, k, ix: at.ix, iz: at.iz, group, rig, hinge, panel, nx: dir.dx, nz: dir.dz,
          leaving: null, start: animate ? clock : null, wait: queued, started: !animate, ready: !animate, landed: !animate, ignited: false, hop: null, sag: null, shown: -1 }
        tiles.push(t); queued += .22
        hinge.visible = !animate
        if (animate) t.wave.value = -10
        // Its own walls stand where nothing is open beside it, from the first frame: the neighbours' are told when it starts.
        for (const side of Object.keys(SIDES) as Side[]) t.setWall(side, !standing(t.ix + SIDES[side][0], t.iz + SIDES[side][1]))
        built = true
      }
      // A floor loaded whole (no animation) has its walls where they belong at once; an opening one is told as each tile starts.
      if (built && !animate) syncWalls()
      tiles.forEach((t, i) => {
        // A tile still opening is told who is in it once its furniture has risen (`settle`).
        if (!t.ready) return
        const people = Math.min(HOUSE_CAPACITY, staff - i * HOUSE_CAPACITY)
        // A hire into a tile that is standing, not into one still opening (its rising is the event) or one just built around a
        // loaded save (whoever is here, is here).
        const arrives = animate && t.shown >= 0 && people > t.shown && t.start === null && t.leaving === null
        const leaves = laidOff && t.shown >= 0 && people < t.shown && t.start === null && t.leaving === null
        t.fill(people, arrives ? clock : undefined, leaves ? clock : undefined)
        // A tile cut open drops them in and tells us as each one lands (`update`); a closed one has nobody to watch, so the
        // far field takes the thump itself.
        if (arrives && !t.interior?.root.visible) { t.hop = clock; events.hired() }
        // And a closed tile a layoff thins sags where a hire's would bounce.
        if (leaves && !t.interior?.root.visible) { t.sag = clock; events.left?.() }
        t.shown = people
      })
      // The floor ends where a tile has gone: the walls beside it come back up, at once for a reset and as it lifts for a layoff.
      if (removed) syncWalls(departing.length ? clock : undefined)
    },
    setView(camera: T.Camera, pixelsPerMetre: number) {
      let changed = false
      root.updateMatrixWorld(true)
      tiles.forEach(t => {
        // Is any of the tile's floor on screen? Its centre is not the question: a tile is 33 m across, and at the zoom that opens it a
        // tile whose middle is off the edge of the frame still fills half of it (its far field, drawn that close, is a field of
        // white boxes).
        const c = t.group.getWorldPosition(new T.Vector3())
        const ndc = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => new T.Vector3(c.x + sx * TILE_W / 2, c.y, c.z + sz * TILE_D / 2).project(camera))
        const visible = Math.min(...ndc.map(v => v.x)) < 1.5 && Math.max(...ndc.map(v => v.x)) > -1.5 && Math.min(...ndc.map(v => v.y)) < 1.5 && Math.max(...ndc.map(v => v.y)) > -1.5 && ndc.some(v => v.z >= -1 && v.z <= 1)
        const close = pixelsPerMetre >= (t.field.visible ? 10 : 8)
        if (t.cutaway(close && visible && t.start === null)) changed = true
      })
      return changed
    },
    update(now: number) {
      clock = now
      let active = false
      const lift = (t: Tile, i: number) => {
        const age = now - t.leaving!
        if (age < 0) return
        const rise = 3 + 90 * (age / 2) ** 2
        t.group.position.y = TILE_LEVEL + rise
        t.rig.update(rise, true, now + i)
        t.body.scale.y = age < .15 ? 1 + .02 * (age / .15) : 1
      }
      departing.forEach((t, i) => { active = true; lift(t, i) })
      for (let i = departing.length - 1; i >= 0; i--) if (now - departing[i].leaving! >= 2.2) { remove(departing[i]); departing.splice(i, 1) }
      tiles.forEach((t, i) => {
        if (t.update(now)) active = true
        if (t.interior?.update(now)) active = true
        for (let landed = t.takeDeskLandings(); landed > 0; landed--) events.deskLanded?.()
        for (let landed = t.takeLandings(); landed > 0; landed--) events.hired()
        for (let gone = t.takeDepartures(); gone > 0; gone--) events.left?.()
        if (t.sag !== null) {
          active = true
          // Down a little and back, slower than a hire's bounce: the floor takes the loss, it does not celebrate it.
          const age = now - t.sag
          t.field.scale.y = age < .5 ? 1 - .07 * Math.sin(Math.PI * age / .5) : 1
          if (age >= .5) t.sag = null
        }
        if (t.leaving !== null) {
          active = true
          lift(t, i)
          return
        }
        if (t.start !== null) {
          active = true
          const age = now - t.start, pose = houseUnfold(age, t.wait)
          t.hinge.visible = pose.started
          t.hinge.rotation.set(t.nz * pose.phi, 0, -t.nx * pose.phi)
          // The tile's neighbours' walls come down a beat after it starts to swing, so the sheet never rises through one.
          if (pose.started && !t.started) { t.started = true; syncWalls(now, .15) }
          if (pose.started && !t.ignited) { t.ignited = true; events.ignited() }
          if (pose.landed && !t.landed) { t.landed = true; events.landed(footprint(t.k)) }
          // The furniture rises in a wave away from the seam, starting just before the tile is flat.
          if (!t.ready) {
            const since = age - t.wait - WAVE_START
            t.wave.value = since < 0 ? -10 : since * WAVE_SPEED - 2
            if (t.wave.value >= t.depth + 9) { t.wave.value = 400; settle(t) }
          }
          if (pose.done && t.ready) { t.start = null; flatten(t) }
        } else if (t.hop !== null) {
          active = true
          const age = now - t.hop
          t.field.position.y = CARPET + (age < .4 ? .35 * Math.sin(Math.PI * age / .4) : 0)
          if (age >= .4) t.hop = null
        }
      })
      // A tile that has cleared the top of the frame is gone.
      for (let i = tiles.length - 1; i >= 0; i--) {
        const t = tiles[i]
        if (t.leaving !== null && now - t.leaving >= 2.2) { remove(t); tiles.splice(i, 1); active = true }
      }
      return active
    },
    hop(seat: number, mild = false) { const t = tiles[Math.floor((seat - offset) / HOUSE_CAPACITY)]; if (t && t.start === null) { if (t.interior?.root.visible) t.interior.hop(seat, clock, mild); else if (!mild) t.hop = clock } },
    codingSeats() { return tiles.flatMap(t => t.interior?.root.visible ? t.interior.targets.filter(m => m.visible).map(m => Number(m.userData.seat)) : []) },
    /** Every tile's floor, nearest the garage first: the units a finished build flashes (move 3). */
    pads(): FlashPad[] {
      return tiles.filter(t => t.leaving === null && t.start === null).map(t => ({ x: t.group.position.x, z: t.group.position.z, y: TILE_LEVEL + CARPET + .01, half: TILE_D / 2 - 1 }))
    },
    /**
     * One flow lot per open tile: where the work lands (§8.2a) is the open aisle along its south edge, and every worker the cutaway
     * shows sends to it. A closed tile has no workers on screen to speak for.
     */
    lots(): FlowLot[] {
      return tiles.flatMap(t => t.interior?.root.visible
        ? [{ sink: t.body.localToWorld(new T.Vector3(0, 1.4, 10)), floor: t.body.localToWorld(new T.Vector3(0, CARPET, 0)).y, standAt: t.body.localToWorld(new T.Vector3(-3.1, 0, 10)), sources: t.interior.targets.filter(m => m.visible).map(m => t.interior!.headOf(Number(m.userData.seat))) }]
        : [])
    },
    headOf(seat: number) { const t = tiles[Math.floor((seat - offset) / HOUSE_CAPACITY)]; return t && seat >= offset && seat < offset + staff ? (t.interior?.root.visible ? t.interior.headOf(seat) : t.group.position.clone().add(new T.Vector3(0, 3, 0))) : null },
    pick(ray: T.Raycaster) {
      root.updateMatrixWorld(true)
      const candidates: { mesh: T.Object3D; seat: number }[] = []
      tiles.forEach((tile, i) => {
        if (tile.interior?.root.visible) {
          tile.interior.targets.forEach(mesh => { if (mesh.visible) candidates.push({ mesh, seat: Number(mesh.userData.seat) }) })
        } else if (tile.shown > 0) candidates.push({ mesh: tile.field, seat: offset + Math.max(i * HOUSE_CAPACITY, i === 0 ? reserved() : 0) })
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
    bounds() { return tiles.length ? tiles.reduce((bounds, t) => bounds.union(footprint(t.k)), new T.Box3()) : null },
    /** For the tests: how far up each side of tile `i`'s wall stands. */
    wallHeights(i: number) { return tiles[i].wallHeights() },
    dispose() { tiles.forEach(remove); departing.forEach(remove) },
  }
}
