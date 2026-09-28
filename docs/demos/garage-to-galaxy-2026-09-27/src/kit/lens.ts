import * as T from 'three'

/**
 * **The lens: one camera from a face to the colony map.**
 *
 * It orbits a focus point on the surface of whatever world it is on, at a
 * distance that runs over seven orders of magnitude. Close in, it looks down at
 * the garage's own angle (§12.1's (1,1,1), a 35.26° elevation); far out it
 * swings round to look at the planet's centre, so pulling back ends with the
 * whole world in frame rather than a horizon; past MAP it is looking straight
 * down on the colony network, and a drag pans the map.
 *
 * - Zoom is anchored at the pointer: the ground under the finger stays under it
 *   (the garage's rule: *"the zoom should not resist me"*).
 * - A drag moves the focus over the surface — which, far out, is spinning the
 *   globe in your hand. The heading is parallel-transported as it goes, so
 *   "up the screen" never snaps.
 * - `flyTo` is the Powers of Ten move: up far enough to see both ends, across,
 *   down. It is how "find anyone" crosses a planet without a cut (§10.5).
 */
export const ISO_TILT = Math.atan(1 / Math.SQRT2)
/**
 * Past this distance the lens is a map: the colony network's plane, looked down
 * on, where a drag pans (as on any strategy map) instead of spinning a planet.
 * Between RIGHT and MAP the camera swings over the pole, so the map always
 * opens north-up with home in the middle.
 */
export const MAP = 120_000
const RIGHT = 40_000
const POLE = new T.Vector3(0, 1, 0)

export interface World {
  centre: T.Vector3
  radius: number
}

interface Flight {
  from: { f: T.Vector3; h: T.Vector3; dist: number; world: World }
  to: { f: T.Vector3; h: T.Vector3; dist: number; world: World }
  peak: number
  t: number
  duration: number
  done?: () => void
}

export class Lens {
  world: World
  /** Focus: a unit direction from the world's centre. */
  f = new T.Vector3(0, 1, 0)
  /** Heading: the tangent the camera looks along, toward the focus. */
  h = new T.Vector3(-1, 0, -1).normalize()
  dist = 40
  min = 4
  max = 1e9
  /** Metres above the surface the camera aims at. */
  lift = 1
  private flight: Flight | null = null
  /** How far round to looking at the centre, 0..1 — the HUD reads it. */
  far = 0
  /** On the map: how far the view has been dragged from the world it rose from. */
  offset = new T.Vector3()
  /**
   * Asked when a zoom takes the map back below MAP: which world is under the
   * view (it may be built on the spot). Null means empty space, and the zoom
   * stops at the map.
   */
  descend: ((mapPoint: T.Vector3) => World | null) | null = null

  constructor(world: World) { this.world = world }

  get flying(): boolean { return this.flight !== null }

  /** The world point the camera looks at, and where it stands. */
  pose(camera: T.PerspectiveCamera): void {
    const { centre, radius } = this.world
    const focus = centre.clone().addScaledVector(this.f, radius + this.lift)
    this.far = smooth(radius * 0.25, radius * 2.2, this.dist)
    const tilt = ISO_TILT + (Math.PI / 2 - 0.02 - ISO_TILT) * this.far
    const back = this.h.clone().negate()
    const offset = back.multiplyScalar(Math.cos(tilt)).addScaledVector(this.f, Math.sin(tilt)).multiplyScalar(this.dist)
    const target = focus.clone().lerp(centre, this.far)
    camera.position.copy(focus).add(offset)
    if (this.far > 0) camera.position.copy(target).add(offset.clone().setLength(this.dist + radius * this.far))
    target.add(this.offset)
    camera.position.add(this.offset)
    camera.up.copy(this.f).lerp(this.h, this.far).normalize()
    camera.lookAt(target)
    camera.near = Math.max(0.05, this.dist * 0.004)
    camera.far = (this.dist + radius) * 20
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }

  /** The surface point under a picture NDC, or null for sky. */
  ground(camera: T.PerspectiveCamera, ndc: T.Vector2): T.Vector3 | null {
    const ray = new T.Raycaster()
    ray.setFromCamera(ndc, camera)
    const hit = new T.Vector3()
    const sphere = new T.Sphere(this.world.centre, this.world.radius)
    return ray.ray.intersectSphere(sphere, hit) ? hit : null
  }

  /** The map target: the point on the plane the camera looks down at. */
  mapTarget(): T.Vector3 {
    return this.world.centre.clone().add(this.offset).setY(0)
  }

  /**
   * A flight the user interrupts (a zoom, a drag) leaves the lens between two
   * worlds. It is handed to the destination with the gap as a map offset: the
   * picture does not move, and a zoom back in slides onto a real world instead
   * of orbiting a point in empty space.
   */
  private interrupt(): void {
    const fl = this.flight
    this.flight = null
    if (!fl || fl.from.world === fl.to.world || this.world === fl.to.world) return
    this.offset.add(this.world.centre).sub(fl.to.world.centre).setY(0)
    this.world = fl.to.world
  }

  zoomAt(factor: number, camera: T.PerspectiveCamera, ndc: T.Vector2 | null): void {
    this.interrupt()
    let next = clamp(this.dist * factor, this.min, this.max)
    if (this.dist >= MAP && next < MAP) {
      // Leaving the map for a world: whichever one is under the view.
      const w = this.descend?.(this.mapTarget()) ?? null
      if (!w) next = MAP
      else if (w !== this.world) {
        const t = this.mapTarget()
        this.world = w
        this.offset.copy(t.sub(w.centre).setY(0))
        this.f.copy(POLE)
      }
    }
    const k = next / this.dist
    if (next >= MAP || this.dist >= MAP) {
      // On the map the point under the pointer stays under it, on the plane.
      if (ndc) {
        const ray = new T.Raycaster()
        ray.setFromCamera(ndc, camera)
        const hit = new T.Vector3()
        if (ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), hit)) {
          const t = this.mapTarget()
          this.offset.addScaledVector(hit.sub(t).setY(0), 1 - k)
        }
      }
      this.dist = next
      return
    }
    // Below the map the drag-offset melts away as the world fills the view.
    this.offset.multiplyScalar(clamp((next - RIGHT) / (MAP - RIGHT), 0, 1))
    if (ndc) {
      const g = this.ground(camera, ndc)
      if (g) {
        const dir = g.sub(this.world.centre).normalize()
        // Near the surface the point under the pointer stays put; far out the
        // globe does not slide under a zoom, it only grows.
        const share = (1 - k) * (1 - this.far)
        this.moveTo(slerp(this.f, dir, clamp(share, -1, 1)))
      }
    }
    this.dist = next
  }

  pan(dx: number, dy: number, camera: T.PerspectiveCamera, viewHeight: number): void {
    this.interrupt()
    const r = this.world.radius
    if (this.dist >= MAP) {
      const mppMap = (2 * (this.dist + r) * Math.tan((camera.fov * Math.PI) / 360)) / viewHeight
      const right = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize()
      const up = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).setY(0).normalize()
      this.offset.addScaledVector(right, -dx * mppMap).addScaledVector(up, dy * mppMap)
      return
    }
    const mpp = (2 * (this.dist + r * this.far) * Math.tan((camera.fov * Math.PI) / 360)) / viewHeight
    const right = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    const move = right.multiplyScalar(-dx * mpp).addScaledVector(up, dy * mpp)
    move.addScaledVector(this.f, -move.dot(this.f))
    // Near the ground a drag moves the ground under the finger. Far out that
    // same rule turns a pixel into thousands of kilometres and the planet spins
    // like a top (the user, 2026-09-27: "the galaxy level drag/spin too
    // sensitive"), so the turn is capped at a steady orbit: about half a turn
    // for a drag the width of the planet as it is framed from orbit.
    const angle = Math.min(move.length() / (r * (1 + this.far * 0.6)), Math.hypot(dx, dy) * 0.0055)
    if (angle < 1e-12) return
    const axis = new T.Vector3().crossVectors(this.f, move).normalize()
    const q = new T.Quaternion().setFromAxisAngle(axis, angle)
    this.f.applyQuaternion(q).normalize()
    this.h.applyQuaternion(q)
    this.orthonormal()
  }

  turn(angle: number): void {
    this.interrupt()
    this.h.applyAxisAngle(this.f, angle)
    this.orthonormal()
  }

  /** Move the focus to a new direction, carrying the heading with it. */
  moveTo(dir: T.Vector3): void {
    const q = new T.Quaternion().setFromUnitVectors(this.f, dir.clone().normalize())
    this.f.copy(dir).normalize()
    this.h.applyQuaternion(q)
    this.orthonormal()
  }

  flyTo(world: World, dir: T.Vector3, dist: number, done?: () => void): void {
    if (this.offset.lengthSq() > 0) {
      // Fold a map drag into the start, so the flight leaves from what is on screen.
      this.world = { centre: this.world.centre.clone().add(this.offset), radius: this.world.radius }
      this.offset.set(0, 0, 0)
    }
    const same = world === this.world
    const from = { f: this.f.clone(), h: this.h.clone(), dist: this.dist, world: this.world }
    const q = new T.Quaternion().setFromUnitVectors(this.f, dir.clone().normalize())
    const toH = this.h.clone().applyQuaternion(q)
    const to = { f: dir.clone().normalize(), h: toH, dist: clamp(dist, this.min, this.max), world }
    const across = same
      ? Math.acos(clamp(from.f.dot(to.f), -1, 1)) * world.radius
      : from.world.centre.distanceTo(world.centre) + world.radius
    const peak = Math.max(from.dist, to.dist, across * 1.1)
    const decades = Math.log10(peak / Math.max(1, Math.min(from.dist, to.dist)))
    this.flight = { from, to, peak, t: 0, duration: 1.1 + 0.42 * decades, done }
  }

  update(dt: number): void {
    const fl = this.flight
    if (!fl) {
      if (this.dist > RIGHT) {
        const t = clamp((this.dist - RIGHT) / (MAP - RIGHT), 0, 1)
        const want = slerp(this.f, POLE, Math.min(1, dt * 4 * t))
        if (want.distanceTo(this.f) > 1e-6) this.moveTo(want)
      }
      return
    }
    fl.t = Math.min(1, fl.t + dt / fl.duration)
    const s = fl.t * fl.t * (3 - 2 * fl.t)
    // Log distance goes up to the peak and back down; the focus crosses in the middle.
    const L0 = Math.log(fl.from.dist), L1 = Math.log(fl.to.dist), Lp = Math.log(fl.peak)
    const mid = 2 * Lp - (L0 + L1) / 2
    const L = (1 - s) * (1 - s) * L0 + 2 * s * (1 - s) * Math.max(mid, Math.max(L0, L1)) + s * s * L1
    const cross = smooth(0.2, 0.8, fl.t)
    if (fl.from.world !== fl.to.world) {
      // Between worlds the orbit's centre slides from one to the other while the
      // camera is far out, so the crossing is one move through space, not a cut.
      const a = fl.from.world, b = fl.to.world
      this.world = { centre: a.centre.clone().lerp(b.centre, cross), radius: a.radius + (b.radius - a.radius) * cross }
    }
    this.dist = Math.exp(L)
    this.f.copy(slerp(fl.from.f, fl.to.f, cross))
    this.h.copy(fl.from.h).lerp(fl.to.h, cross)
    this.orthonormal()
    if (fl.t >= 1) {
      this.flight = null
      this.world = fl.to.world
      fl.done?.()
    }
  }

  private orthonormal(): void {
    this.h.addScaledVector(this.f, -this.h.dot(this.f))
    if (this.h.lengthSq() < 1e-10) this.h.set(1, 0, 0).addScaledVector(this.f, -this.f.x)
    this.h.normalize()
  }
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
export function slerp(a: T.Vector3, b: T.Vector3, t: number): T.Vector3 {
  const d = clamp(a.dot(b), -1, 1)
  const theta = Math.acos(d)
  if (theta < 1e-6) return a.clone()
  const s = Math.sin(theta)
  return a.clone().multiplyScalar(Math.sin((1 - t) * theta) / s).addScaledVector(b, Math.sin(t * theta) / s).normalize()
}
