import * as T from 'three'
import { RAMPS } from '../art/palette.ts'
import { OS } from '../art/skin.ts'
import { cellSize, statueModel, STATUE, voxelsBuilt, type StatueModel } from '../art/statueModel.ts'
import type { CoverSpec } from '../sim/cover.ts'
import { STATUE_PLAZA } from '../sim/floorPlan.ts'
import { QUEUE_SCALE, SHIP_SCALE, beatAt, hopAt, queueShown, queueSlot, type BeatFrame, type P3 } from '../sim/statueBeat.ts'
import { box, cylinder, INK, sharedMaterial } from './worldArt.ts'

/**
 * The game being built, as a statue — GDD §8.2a, §7.8.12 [CANON - added 2026-10-14].
 *
 * *"voxel statue! put it in the middle of the room and so you need to move Bill, design a new layout."* The sink the work flies to
 * used to be a whiteboard that printed the game's cover row by row; it is now the game's own cover subject stood up as voxels on a
 * plinth in the middle of the studio, built from the floor up as the project is, and when the game is done it flashes, turns round to
 * be looked at, shows its name and goes to the queue — a line of small statues up the deck's stem, which is what the HUD's QUEUE n/5
 * counts. Releasing the head of the queue (SHIP!) sends the head's statue away. All of it is picture: it is handed a project, a queue
 * and two events, and decides nothing. What it does is on a clock of hard steps (`sim/statueBeat.ts`), because the interface's motion
 * is `steps(n, end)` and the user does not want gradients, glows or fades.
 *
 * **The voxels are one instanced mesh.** A statue is 60 to 190 cubes and a queue of five is five more, so a draw call each would be
 * a dozen; instanced, the figure is the cube mesh drawn `built` times, laid out bottom row first so that what stands is a prefix. It
 * is never rebuilt as the project grows: only `count` moves.
 *
 * **It grows; it does not reveal** [2026-10-15, at the user's instruction: *"to voxel statue, make it grow instead of scratching out
 * the shade?"*]. The ones not yet standing used to be drawn as a second mesh of dark cubes, the blueprint of the finished subject, and
 * each voxel that stood scratched its own shade out. There is no shade now: nothing is drawn for a voxel that has not been built, so
 * the plinth starts bare and the figure is, at every moment, exactly as much of the game as is done.
 *
 * **The hot edge** is the concept page's: a voxel arrives white, goes light amber, and is itself. It is set on the voxels that have
 * just stood, a few at a time, and not on a statue that is being loaded or a project that has reset — those stand silently. And
 * **a voxel grows into its place**: it arrives at two fifths of its size, is seven tenths a step later and full a step after that, in
 * hard steps inside the same quarter-second (`grown`), so what was just added is seen to be added and the top of the figure moves.
 */

/** A jump of more than this many voxels in one update is a loaded save or a reset, not work, and does not flash. */
const HOT_MAX = 8
const HOT_WHITE_S = 0.1
const HOT_LAMP_S = 0.26
/** A new voxel's size as a share of its place, in two hard steps and then full: it grows in, it does not fade in. */
const GROW_FROM = 0.4
const GROW_MID = 0.7
const GROW_STEP_S = 0.09
export const grown = (age: number): number => (age < GROW_STEP_S ? GROW_FROM : age < GROW_STEP_S * 2 ? GROW_MID : 1)
const WHITE = new T.Color(RAMPS.NEUTRAL[8])
const LAMP = new T.Color(OS.lamp)
/** The statue faces the lens (§12.1 looks back along (+x, +z)), so its sprite is seen square. */
const FACING = Math.PI / 4
/** The queue's small statues stand on a low oak block of this height and width. */
const PEDESTAL = { h: 0.12, w: STATUE_PLAZA.queue.width }
/** A queue's place changes in five hard slides over this long. */
const SLIDE_S = 0.45
/** A released statue goes up in six hard steps and is gone. */
const LEAVE_S = 0.5
const LEAVE_STEP = 0.45

const canDraw = () => typeof document !== 'undefined' && !/jsdom/i.test(navigator.userAgent)

export interface QueueItem { id: number; spec: CoverSpec; title: string }

export interface Statue {
  /** At the plinth's foot, on the deck: the group the plinth and the statue stand in. */
  readonly root: T.Group
  /** At the deck's origin: the queue's small statues, the places they stand and the one flying to them. */
  readonly queueRoot: T.Group
  /** How high the finished statue's top stands above the deck, plinth included. */
  readonly height: number
  /** The project being built, as the HUD's project bar reads it. A null spec is no project. */
  update(spec: CoverSpec | null, title: string, progress: number): void
  /** The builds waiting to ship, head first, and how many places the queue has. */
  setQueue(items: readonly QueueItem[], capacity: number): void
  /** A build has landed in the queue, or a release has gone on sale. Reduced motion gets no beat. */
  complete(kind: 'build' | 'release', reduced: boolean): void
  /** Where the next voxel will stand, in front of it, in world space: where the work flies. */
  aim(out: T.Vector3): T.Vector3
  /** The plinth's foot in world space. */
  foot(out: T.Vector3): T.Vector3
  /** Advance the steps; `seconds` is the garage's own clock. */
  tick(seconds: number): void
  dispose(): void
}

interface Figure {
  readonly root: T.Group
  readonly model: StatueModel
  readonly cell: number
  readonly depth: number
  built: number
  setBuilt(n: number, clock: number | null): void
  tint(mode: 'white' | 'lamp' | null): void
  /** Advance the hot edge; whether any voxel is still hot. */
  step(clock: number): boolean
  dispose(): void
}

const litMaterial = () => sharedMaterial('statue:voxel', () => new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0, flatShading: true }))

/** One statue: `model.voxels` laid out once, bottom row first, drawn as many as stand. Nothing is drawn for the ones that do not. */
function makeFigure(geometry: T.BoxGeometry, spec: CoverSpec): Figure {
  const model = statueModel(spec)
  const cell = cellSize(model), depth = cell * STATUE.depthCells, total = model.voxels.length
  const root = new T.Group()
  const mesh = new T.InstancedMesh(geometry, litMaterial(), total)
  mesh.count = 0; mesh.frustumCulled = false; mesh.receiveShadow = true
  root.add(mesh)
  const base = model.voxels.map((v) => new T.Color(v.colour))
  const m = new T.Matrix4(), q = new T.Quaternion(), size = new T.Vector3()
  const centres = model.voxels.map((v) => new T.Vector3((v.col - (model.cols - 1) / 2) * cell, (v.row + 0.5) * cell, 0))
  /** Voxel `i` at `k` of its place, about its own centre: 1 is a cube that fills it. */
  const place = (i: number, k: number) => mesh.setMatrixAt(i, m.compose(centres[i], q, size.set(cell * k, cell * k, depth * k)))
  model.voxels.forEach((_, i) => { place(i, 1); mesh.setColorAt(i, base[i]) })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  const hotAt = new Map<number, number>()
  const paint = (i: number, c: T.Color) => mesh.setColorAt(i, c)
  /** Every voxel still arriving is stood at once, full size and its own colour. */
  const settle = () => { for (const i of hotAt.keys()) { paint(i, base[i]); place(i, 1) } hotAt.clear(); mesh.instanceMatrix.needsUpdate = true }
  const figure: Figure = {
    root, model, cell, depth, built: 0,
    setBuilt(n, clock) {
      n = Math.max(0, Math.min(total, n))
      if (n === figure.built) return
      if (n < figure.built) settle()
      else if (clock !== null && n - figure.built <= HOT_MAX) {
        // it stands at its first step at once: a frame at full size before it shrinks would be a flash, not a growth
        for (let i = figure.built; i < n; i++) { hotAt.set(i, clock); place(i, GROW_FROM) }
        mesh.instanceMatrix.needsUpdate = true
      }
      figure.built = n
      mesh.count = n
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
    tint(mode) {
      settle()
      for (let i = 0; i < total; i++) paint(i, mode === 'white' ? WHITE : mode === 'lamp' ? LAMP : base[i])
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
    step(clock) {
      if (hotAt.size === 0) return false
      for (const [i, t] of hotAt) {
        const age = clock - t
        place(i, grown(age))
        if (age < HOT_WHITE_S) paint(i, WHITE)
        else if (age < HOT_LAMP_S) paint(i, LAMP)
        else { paint(i, base[i]); hotAt.delete(i) }
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      return true
    },
    dispose() { mesh.dispose(); root.removeFromParent() },
  }
  return figure
}

/** The name on the plinth's front: dark enamel and amber letters, blank until the game is done. */
function makePlate(width: number, height: number) {
  if (!canDraw()) return null
  const canvas = document.createElement('canvas')
  canvas.width = 320; canvas.height = Math.round(320 * height / width)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.minFilter = texture.magFilter = T.NearestFilter
  texture.generateMipmaps = false
  const geometry = new T.PlaneGeometry(width, height)
  const material = new T.MeshBasicMaterial({ map: texture, color: new T.Color(0.8, 0.8, 0.8) })
  const mesh = new T.Mesh(geometry, material)
  const draw = (text: string) => {
    ctx.fillStyle = '#1b2a2e'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#3c4a4d'; ctx.fillRect(0, 0, canvas.width, 4); ctx.fillRect(0, canvas.height - 4, canvas.width, 4)
    if (text) {
      let size = 40
      ctx.font = `bold ${size}px "Departure Mono", ui-monospace, monospace`
      while (size > 14 && ctx.measureText(text).width > canvas.width - 24) { size -= 2; ctx.font = `bold ${size}px "Departure Mono", ui-monospace, monospace` }
      ctx.fillStyle = '#e0a52e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2)
    }
    texture.needsUpdate = true
  }
  draw('')
  return { mesh, draw, dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); texture.dispose() } }
}

interface Mini {
  id: number
  group: T.Group
  fig: Figure
  from: P3
  to: P3
  t0: number
  /** Where it is now, from the last slide step. */
  at: P3
  /** When it was released and began to go up, or null while it stands. */
  leaving: number | null
}

export function createStatue(parent: T.Object3D): Statue {
  const { plinth, queue: Q } = STATUE_PLAZA
  const geometry = new T.BoxGeometry(1, 1, 1)
  // Both groups are dynamic: `batchArt` must not merge the plinth into the room's batches, and `disposeArt` must not free what is shared.
  const root = new T.Group()
  root.position.set(plinth.x, 0, plinth.z)
  root.userData.dynamic = true
  parent.add(root)
  const queueRoot = new T.Group()
  queueRoot.userData.dynamic = true
  parent.add(queueRoot)

  // The plinth: an octagon with its flats to the axes (one flat faces the lens), graphite with a slate-teal cap that the oak deck does not swallow.
  // `cylinder` is an eight-sided prism whose corner is on +z; a sixteenth of a turn puts a flat there, so the bounding square is `2 * apothem`.
  const R = plinth.apothem / Math.cos(Math.PI / 8)
  const body = cylinder(root, 0, 0, 0, R, plinth.height - 0.06, '#34494f')
  const cap = cylinder(root, 0, plinth.height - 0.06, 0, R * 0.98, 0.06, INK.glassLight)
  body.rotation.y = cap.rotation.y = Math.PI / 8
  const plateW = 2 * plinth.apothem * Math.tan(Math.PI / 8) - 0.08, plateH = 0.2
  const plate = makePlate(plateW, plateH)
  if (plate) {
    plate.mesh.position.set(Math.sin(FACING) * (plinth.apothem + 0.01), 0.17, Math.cos(FACING) * (plinth.apothem + 0.01))
    plate.mesh.rotation.y = FACING
    root.add(plate.mesh)
  }
  const figRoot = new T.Group()
  figRoot.position.y = plinth.height
  figRoot.rotation.y = FACING
  root.add(figRoot)

  // The queue's places: five low slate squares let into the deck, as many as the queue has room for, so an empty queue is seen to be one.
  const markers = Array.from({ length: Q.shown }, (_, i) => {
    const s = queueSlot(i)
    const m = box(queueRoot, s.x, 0, s.z, PEDESTAL.w, 0.015, PEDESTAL.w, '#4a6a72', false)
    m.visible = false
    return m
  })
  const more = makePlate(0.5, 0.22)
  if (more) { more.mesh.visible = false; more.mesh.rotation.y = FACING; queueRoot.add(more.mesh) }
  let moreText = ''

  let clock = 0, lastSeconds: number | null = null
  let main: Figure | null = null, mainKey = ''
  let title = ''
  let pending: { spec: CoverSpec | null; title: string; progress: number } | null = null
  let beat: { t0: number; fig: Figure; title: string; frame: BeatFrame } | null = null
  let flight: { group: T.Group; fig: Figure; from: P3; to: P3 } | null = null
  let items: QueueItem[] = []
  let held: number | null = null
  const minis = new Map<number, Mini>()
  const tmp = new T.Vector3()

  const slotAt = (i: number): P3 => { const s = queueSlot(i); return { x: s.x, y: 0, z: s.z } }
  const foot = (out: T.Vector3): T.Vector3 => { root.updateWorldMatrix(true, false); return root.localToWorld(out.set(0, 0, 0)) }

  function apply(spec: CoverSpec | null, name: string, progress: number) {
    title = name
    if (!spec) { main?.dispose(); main = null; mainKey = ''; return }
    const key = `${spec.genre}/${spec.subject}`
    if (!main || key !== mainKey) {
      main?.dispose()
      main = makeFigure(geometry, spec)
      mainKey = key
      figRoot.add(main.root)
      // loaded, or a new project: it stands as far as it has got without flashing
      main.setBuilt(voxelsBuilt(main.model.voxels.length, progress), null)
      return
    }
    main.setBuilt(voxelsBuilt(main.model.voxels.length, progress), clock)
  }

  function makeMini(item: QueueItem, index: number): Mini {
    const fig = makeFigure(geometry, item.spec)
    fig.setBuilt(fig.model.voxels.length, null)
    fig.root.scale.setScalar(QUEUE_SCALE)
    fig.root.rotation.y = FACING
    fig.root.position.y = PEDESTAL.h
    const group = new T.Group()
    box(group, 0, 0, 0, PEDESTAL.w, PEDESTAL.h, PEDESTAL.w, INK.woodEdge, false)
    group.add(fig.root)
    const at = slotAt(index)
    group.position.set(at.x, at.y, at.z)
    group.visible = item.id !== held
    queueRoot.add(group)
    return { id: item.id, group, fig, from: at, to: at, t0: -1, at, leaving: null }
  }

  function overflowPlate(count: number, shown: number) {
    if (!more) return
    const last = queueSlot(Math.max(0, shown - 1))
    more.mesh.visible = count > 0 && shown > 0
    more.mesh.position.set(last.x, 0.14, last.z - 0.75)
    const text = count > 0 ? `+${count}` : ''
    if (text !== moreText) { moreText = text; more.draw(text) }
  }

  /** Finish the beat: the flying statue is the queue's now, and the plinth is the next project's. */
  function landed() {
    if (flight) { flight.fig.dispose(); flight.group.removeFromParent(); flight = null }
    if (held !== null) { const m = minis.get(held); if (m) m.group.visible = true; held = null }
    beat = null
  }

  return {
    root, queueRoot, height: plinth.height + STATUE.height,
    update(spec, name, progress) {
      if (beat) { pending = { spec, title: name, progress }; return }
      apply(spec, name, progress)
    },
    setQueue(next, capacity) {
      items = next.slice()
      const ids = new Set(next.map((i) => i.id))
      for (const m of minis.values()) if (!ids.has(m.id) && m.leaving === null) m.leaving = clock
      const shown = queueShown(next.length)
      for (let i = 0; i < shown; i++) {
        const item = next[i]
        let m = minis.get(item.id)
        if (!m) { m = makeMini(item, i); minis.set(item.id, m) }
        const to = slotAt(i)
        if (to.z !== m.to.z || to.x !== m.to.x) { m.from = { ...m.at }; m.to = to; m.t0 = clock }
      }
      // a build that is queued but past the places there are is a count, not a statue
      for (let i = shown; i < next.length; i++) { const m = minis.get(next[i].id); if (m) { m.fig.dispose(); m.group.removeFromParent(); minis.delete(m.id) } }
      const room = Math.min(Q.shown, Math.max(0, Math.floor(capacity)))
      markers.forEach((mk, i) => { mk.visible = i < room })
      overflowPlate(next.length - shown, shown)
    },
    complete(kind, reduced) {
      if (kind !== 'build' || reduced || beat || !main) return
      main.setBuilt(main.model.voxels.length, null)
      beat = { t0: clock, fig: main, title, frame: beatAt(0) }
      // The build that has just landed is the tail of the queue; it is not stood there until the statue gets to it.
      held = items.length > 0 && queueShown(items.length) === items.length ? items[items.length - 1].id : null
      const m = held === null ? undefined : minis.get(held)
      if (m) m.group.visible = false
      main.tint('white')
    },
    aim(out) {
      if (!main) { foot(out); out.y += plinth.height + STATUE.height * 0.4; return out }
      const v = main.model.voxels[Math.min(main.model.voxels.length - 1, main.built)]
      figRoot.updateWorldMatrix(true, false)
      main.root.updateWorldMatrix(false, false)
      tmp.set((v.col - (main.model.cols - 1) / 2) * main.cell, (v.row + 0.5) * main.cell, main.depth / 2 + 0.4)
      return main.root.localToWorld(out.copy(tmp))
    },
    foot,
    tick(seconds) {
      if (lastSeconds !== null) clock += Math.min(0.1, Math.max(0, seconds - lastSeconds))
      lastSeconds = seconds
      if (beat) {
        const f = beatAt(clock - beat.t0)
        if (f.tint !== beat.frame.tint) beat.fig.tint(f.tint)
        if (f.plate !== beat.frame.plate) plate?.draw(f.plate ? beat.title : '')
        if (!flight) figRoot.rotation.y = FACING + f.turns * (Math.PI / 2)
        if (f.ship >= 0) {
          if (!flight) {
            // It leaves the plinth: the figure goes into a group of its own that hops, and the plinth takes the next project.
            const group = new T.Group()
            queueRoot.add(group)
            group.add(beat.fig.root)
            beat.fig.root.position.set(0, 0, 0)
            beat.fig.root.rotation.y = FACING
            const last = Math.min(queueShown(items.length), Math.max(1, items.length)) - 1
            const to = slotAt(Math.max(0, last))
            flight = { group, fig: beat.fig, from: { x: plinth.x, y: plinth.height, z: plinth.z }, to: { x: to.x, y: PEDESTAL.h, z: to.z } }
            if (main === beat.fig) { main = null; mainKey = '' }
            figRoot.rotation.y = FACING
            plate?.draw('')
            if (pending) { apply(pending.spec, pending.title, pending.progress); pending = null }
          }
          const at = hopAt(flight.from, flight.to, f.ship, 2.2)
          flight.group.position.set(at.x, at.y, at.z)
          flight.group.scale.setScalar(SHIP_SCALE[f.ship])
        }
        beat.frame = f
        if (f.over) landed()
      }
      main?.step(clock)
      for (const [id, m] of minis) {
        if (m.leaving !== null) {
          const t = clock - m.leaving, step = Math.floor(t / (LEAVE_S / 6))
          if (t >= LEAVE_S) { m.fig.dispose(); m.group.removeFromParent(); minis.delete(id); continue }
          m.group.position.y = m.at.y + step * LEAVE_STEP
          if (step >= 4) m.fig.tint('white')
          continue
        }
        if (m.t0 >= 0) {
          const u = Math.min(1, (clock - m.t0) / SLIDE_S), f = u >= 1 ? 1 : Math.floor(u * 5) / 5
          m.at = { x: m.from.x + (m.to.x - m.from.x) * f, y: 0, z: m.from.z + (m.to.z - m.from.z) * f }
          m.group.position.set(m.at.x, m.at.y, m.at.z)
          if (u >= 1) m.t0 = -1
        }
      }
    },
    dispose() {
      beat = null; held = null
      main?.dispose(); main = null
      if (flight) { flight.fig.dispose(); flight.group.removeFromParent(); flight = null }
      for (const m of minis.values()) { m.fig.dispose(); m.group.removeFromParent() }
      minis.clear()
      plate?.dispose(); more?.dispose()
      root.removeFromParent(); queueRoot.removeFromParent()
      geometry.dispose()
    },
  }
}
