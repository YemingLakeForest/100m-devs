/**
 * The heroes' sets — GDD §7.8.12 [redesigned 2026-10-04].
 *
 * *"current HQ is rubbish … Billy is at the whiteboard giving a meeting, Serena
 * full of dashboards, Matt always on the phone dealing with issues."* The first
 * HQ gave each hero a desk with a nameplate and one prop, which says *a person
 * works here* and nothing about who. These are the three sets, and the rule
 * behind them is the one §21.7.6 already states for the HUD: **a hero is the
 * instrument they brought.** So each set is a readout, drawn from the same
 * numbers the HUD shows:
 *
 * - **Billy** stands at a whiteboard giving the stand-up to a small audience of
 *   the studio's own people, and the board is the §4.1 curve — work done
 *   against developers — with the studio's dot on it.
 * - **Serena** sits in front of a wall of six dashboards: the build queue and
 *   Auto-Ship, velocity, incidents, defects, sync, and the line she lives by.
 * - **Matt** is on the phones in front of the ticket wall, which fills with a
 *   sticky note for every few real tickets, with the incidents pinned along the
 *   top in red; the switchboard blinks while there is anything to answer.
 *
 * Each person is *always doing it* (§7.8.13): the animations here never stop and
 * never change, which is what makes them an identity and not a cutscene.
 *
 * Pure geometry and canvas drawing — no store. The stage hands the numbers in
 * through {@link HqSets.update}, so this file cannot disagree with the HUD about
 * what the studio is doing.
 */

import * as T from 'three'
import { box, cylinder } from './worldArt.ts'
import type { Environment, GarageProp } from './worldEnvironments.ts'
import { studioPerson, workerLook, type StudioCast } from './studioPeople.ts'
import { branchColour } from '../../sim/heroBranches.ts'
import { HERO_BY_ID, type HeroId } from '../../sim/storyHeroes.ts'
import { GARAGE_STAGE, HERO_SLOTS } from '../sim/floorPlan.ts'
import { peakHeads, workDone } from '../../sim/entropy.ts'

/** What the studio is doing, as the sets draw it. All of it is already on the HUD. */
export interface HqReadouts {
  /** §10.7 — builds in the queue, the queue's size, and seconds to the next auto-ship (null: by hand). */
  queueUsed: number
  queueCapacity: number
  autoShipIn: number | null
  /** §4.12a — open incidents, by the name of the game that is down. */
  incidents: readonly string[]
  /** §4.13 — tickets waiting. */
  tickets: number
  /** §4.12 — the defect bench. */
  defects: number
  /** §4.1 — sync, 0..100, and the headcount and cap it is read at. */
  syncPct: number
  devs: number
  devCap: number
  /** Story points a second. */
  velocity: number
  shipped: number
}

export const NO_HQ_READOUTS: HqReadouts = {
  queueUsed: 0, queueCapacity: 3, autoShipIn: null, incidents: [], tickets: 0, defects: 0,
  syncPct: 100, devs: 0, devCap: 100, velocity: 0, shipped: 0,
}

/** The three sets and what is animated in them. */
export interface HqSets {
  /** Advance the animation and redraw whatever the numbers changed. Always true: the people never stop (§7.8.13). */
  update(seconds: number, readouts: HqReadouts): boolean
  dispose(): void
}

type Id = Extract<HeroId, 'billy' | 'serena' | 'matt'>

/** A prop group anchored at the station, registered so the arrival can drop it. */
function hqProp(env: Environment, parent: T.Object3D, key: string, x: number, z: number): T.Group {
  const g = new T.Group()
  g.position.set(x, 0, z)
  g.userData.prop = key
  parent.add(g)
  env.props!.set(key, { rest: new T.Matrix4(), centre: new T.Vector3(x, 0, z), group: g, instances: [] } satisfies GarageProp)
  return g
}

/** Canvas drawing exists in a browser and not under jsdom, where the sets are built bare. */
const canDraw = () => typeof document !== 'undefined' && !/jsdom/i.test(navigator.userAgent)

const FONT = '"Departure Mono", ui-monospace, monospace'

interface Face {
  mesh: T.Mesh
  ctx: CanvasRenderingContext2D
  texture: T.CanvasTexture
  w: number
  h: number
  /** What the last drawing was made of; a face is only redrawn when this changes. */
  seen: string
  /** What this face's picture depends on, as a string: cheap to build, cheap to compare. */
  key(seconds: number, r: HqReadouts): string
  paint(ctx: CanvasRenderingContext2D, w: number, h: number, seconds: number, r: HqReadouts): void
}

/**
 * A flat, unlit screen on the wall: what a monitor or a board looks like in a room lit by
 * lamps. `gain` dims it: the garage's post-processing blooms anything bright, and a
 * whiteboard drawn at its true white is a hole in the wall with no writing on it.
 */
function face(parent: T.Object3D, x: number, y: number, z: number, wm: number, hm: number, px: number,
  key: Face['key'], paint: Face['paint'], gain = 1): Face | null {
  if (!canDraw()) return null
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = Math.round(px * hm / wm)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.minFilter = texture.magFilter = T.LinearFilter
  texture.generateMipmaps = false
  const mesh = new T.Mesh(new T.PlaneGeometry(wm, hm), new T.MeshBasicMaterial({ map: texture, color: new T.Color(gain, gain, gain) }))
  mesh.position.set(x, y, z)
  // Not a box, and not batched: it has to stay a real mesh to be redrawn.
  mesh.userData.ownGeometry = true
  parent.add(mesh)
  return { mesh, ctx, texture, w: canvas.width, h: canvas.height, seen: '', key, paint }
}

/** A tiny deterministic hash, so a ticket wall is the same wall every frame. */
function noise(i: number, k = 0): number {
  let h = Math.imul(i * 2654435761 + k * 40503, 2246822519) >>> 0
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// --- the paintings -------------------------------------------------------------
//
// **Drawn to be read from across a room.** The first cut printed what the HUD
// prints, at the HUD's size, and on the stage — where each screen is a few dozen
// pixels wide at the resting zoom — it was a dark rectangle with grey fuzz in it.
// So every screen here says ONE thing, in a shape or a number the size of the
// screen: a row of blocks for the queue, a red numeral for the incidents, an arc
// for sync. The detail is for the player who zooms in, and it is still there.

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, colour: string, align: CanvasTextAlign = 'left') {
  ctx.font = `bold ${size}px ${FONT}`
  ctx.fillStyle = colour
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(s, x, y)
}

const SCREEN = '#123639'
const GREEN = '#6fffa0'
const AMBER = '#ffc43d'
const RED = '#ff6a58'
const TEAL = '#5fe6f2'
const DIM = '#4f8084'

/** One of Serena's six dashboards. */
function dashboard(kind: 'queue' | 'velocity' | 'incidents' | 'defects' | 'sync' | 'status', history: number[]): Pick<Face, 'key' | 'paint'> {
  const frame = (ctx: CanvasRenderingContext2D, w: number, h: number, title: string, colour = TEAL, fill = SCREEN) => {
    ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = colour; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6)
    text(ctx, title, 18, 26, 26, colour)
  }
  switch (kind) {
    case 'queue':
      return {
        key: (_s, r) => `q${r.queueUsed}/${r.queueCapacity}/${r.autoShipIn === null ? '-' : Math.floor(r.autoShipIn)}`,
        paint(ctx, w, h, _s, r) {
          const full = r.queueUsed >= r.queueCapacity
          frame(ctx, w, h, 'QUEUE', full ? RED : TEAL)
          const n = Math.min(8, r.queueCapacity), slot = (w - 36 - (n - 1) * 8) / n
          for (let i = 0; i < n; i++) {
            ctx.fillStyle = i < r.queueUsed ? (full ? RED : AMBER) : '#1d5256'
            ctx.fillRect(18 + i * (slot + 8), 52, slot, 78)
          }
          text(ctx, `${r.queueUsed}/${r.queueCapacity}`, w / 2, h - 52, 62, full ? RED : GREEN, 'center')
          text(ctx, r.autoShipIn === null ? 'BY HAND' : `AUTO ${clock(r.autoShipIn)}`, w / 2, h - 16, 24, r.autoShipIn === null ? DIM : GREEN, 'center')
        },
      }
    case 'velocity':
      return {
        key: (s, r) => `v${Math.floor(s)}${r.velocity.toFixed(1)}`,
        paint(ctx, w, h, _s, r) {
          frame(ctx, w, h, 'SPEED')
          const top = Math.max(1, ...history), x0 = 18, y0 = 48, pw = w - 36, ph = h - 128
          ctx.strokeStyle = GREEN; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.beginPath()
          history.forEach((v, i) => {
            const x = x0 + (history.length <= 1 ? 0 : i / (history.length - 1)) * pw, y = y0 + ph - (v / top) * ph
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
          })
          ctx.stroke()
          text(ctx, r.velocity < 0.01 ? '<0.01' : r.velocity.toFixed(1), w / 2, h - 34, 56, GREEN, 'center')
        },
      }
    case 'incidents':
      return {
        key: (s, r) => `i${r.incidents.join('|')}${r.incidents.length ? Math.floor(s * 2) % 2 : ''}`,
        paint(ctx, w, h, s, r) {
          const down = r.incidents.length > 0
          frame(ctx, w, h, 'INCIDENTS', down ? RED : TEAL, down && Math.floor(s * 2) % 2 ? '#4a1612' : SCREEN)
          if (!down) { text(ctx, 'OK', w / 2, h / 2 + 8, 110, GREEN, 'center'); return }
          text(ctx, String(r.incidents.length), 70, h / 2 + 14, 110, RED, 'center')
          r.incidents.slice(0, 3).forEach((name, i) => text(ctx, name.slice(0, 11), 140, 74 + i * 42, 28, '#ffd8d0'))
        },
      }
    case 'defects':
      return {
        key: (_s, r) => `d${Math.floor(r.defects)}`,
        paint(ctx, w, h, _s, r) {
          frame(ctx, w, h, 'DEFECTS')
          text(ctx, String(Math.floor(r.defects)), w / 2, h / 2 + 14, 120, r.defects > 50 ? AMBER : GREEN, 'center')
        },
      }
    case 'sync':
      return {
        key: (_s, r) => `s${Math.round(r.syncPct)}`,
        paint(ctx, w, h, _s, r) {
          const p = Math.max(0, Math.min(1, r.syncPct / 100)), colour = p > 0.9 ? GREEN : p > 0.6 ? AMBER : RED
          frame(ctx, w, h, 'SYNC', colour)
          ctx.lineWidth = 26; ctx.strokeStyle = '#1d5256'; ctx.beginPath(); ctx.arc(w / 2, h - 44, 96, Math.PI, 2 * Math.PI); ctx.stroke()
          ctx.strokeStyle = colour; ctx.beginPath(); ctx.arc(w / 2, h - 44, 96, Math.PI, Math.PI + p * Math.PI); ctx.stroke()
          text(ctx, `${Math.round(r.syncPct)}`, w / 2, h - 62, 74, colour, 'center')
        },
      }
    case 'status':
      return {
        key: (s) => `t${Math.floor(s / 2)}`,
        paint(ctx, w, h) {
          frame(ctx, w, h, 'STATUS', AMBER)
          text(ctx, 'DEGRADED', w / 2, h / 2 - 8, 56, AMBER, 'center')
          text(ctx, 'NOT DOWN', w / 2, h / 2 + 50, 46, GREEN, 'center')
        },
      }
  }
}

/** Matt's ticket wall: a note for every few tickets, and the incidents pinned along the top in red. */
const ticketWall: Pick<Face, 'key' | 'paint'> = {
  key: (s, r) => `w${Math.min(60, Math.ceil(r.tickets / 8))}${Math.floor(r.tickets)}${r.incidents.join('|')}${Math.floor(s * 2) % 2}`,
  paint(ctx, w, h, s, r) {
    ctx.fillStyle = '#b39a66'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#2b3a2d'; ctx.fillRect(0, 0, w, 78)
    text(ctx, 'TICKETS', 22, 40, 52, '#d8f2d8')
    text(ctx, String(Math.floor(r.tickets)), w - 22, 40, 60, r.tickets > 100 ? '#ffb4a8' : '#d8f2d8', 'right')
    const cols = 10, rows = 4, cw = (w - 24) / cols, ch = (h - 98) / rows
    const notes = Math.min(cols * rows, Math.ceil(r.tickets / 8))
    for (let i = 0; i < notes; i++) {
      const c = i % cols, row = Math.floor(i / cols)
      const x = 12 + c * cw + (noise(i, 3) - 0.5) * 6, y = 90 + row * ch + (noise(i, 4) - 0.5) * 6
      ctx.save(); ctx.translate(x + cw / 2, y + ch / 2); ctx.rotate((noise(i, 5) - 0.5) * 0.18)
      ctx.fillStyle = ['#ffe45e', '#ffb44e', '#ff8e78', '#a5e3ac'][Math.floor(noise(i, 6) * 4)]
      ctx.fillRect(-cw / 2 + 4, -ch / 2 + 4, cw - 8, ch - 8)
      ctx.fillStyle = 'rgba(60,40,10,0.5)'
      ctx.fillRect(-cw / 2 + 12, -ch / 2 + 16, cw - 28, 5); ctx.fillRect(-cw / 2 + 12, -ch / 2 + 32, cw - 44, 5)
      ctx.restore()
    }
    r.incidents.slice(0, 3).forEach((name, i) => {
      const lit = Math.floor(s * 2) % 2
      ctx.fillStyle = lit ? RED : '#b03a2e'
      ctx.fillRect(w * 0.36 + i * (w * 0.21), 8, w * 0.2, 62)
      text(ctx, name.slice(0, 9), w * 0.36 + i * (w * 0.21) + 12, 40, 26, '#fff0ec')
    })
  },
}

/** Billy's board: the §4.1 hill, drawn in marker while he talks, with the studio's own dot on it. */
const MEETING_S = 16
const whiteboard: Pick<Face, 'key' | 'paint'> = {
  key: (s, r) => `b${Math.floor(s * 3)}${Math.round(r.syncPct)}${r.devs}`,
  paint(ctx, w, h, s, r) {
    ctx.fillStyle = '#d9dcd4'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#b9bdb4'; ctx.fillRect(0, h - 14, w, 14)
    const cycle = MEETING_S + 5, t = s % cycle, p = Math.min(1, t / MEETING_S)
    const marker = '#2352b8', red = '#d1301f', green = '#1f8a45', ink = '#1d2730'
    text(ctx, 'SYNC', 28, 50, 72, ink)
    // the stand-up, fifteen minutes long, counted down in sixteen seconds and begun again
    const left = Math.max(0, 15 * 60 * (1 - p))
    text(ctx, clock(left), w / 2, 50, 64, left < 120 ? red : green, 'center')
    text(ctx, `${Math.round(r.syncPct)}%`, w - 28, 50, 72, r.syncPct > 90 ? green : red, 'right')
    // the axes
    const x0 = 56, y0 = h - 70, pw = w - 110, ph = h - 220
    ctx.strokeStyle = ink; ctx.lineWidth = 7; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(x0, 108); ctx.lineTo(x0, y0); ctx.lineTo(x0 + pw, y0); ctx.stroke()
    // the hill, in marker, drawn left to right as the meeting goes on
    const cap = Math.max(10, r.devCap), top = Math.max(1e-6, workDone(peakHeads(cap), cap))
    const maxD = cap * 3, steps = 70, drawn = Math.floor(steps * Math.min(1, p * 1.5))
    ctx.strokeStyle = marker; ctx.lineWidth = 12; ctx.beginPath()
    for (let i = 0; i <= drawn; i++) {
      const d = (i / steps) * maxD, x = x0 + (i / steps) * pw, y = y0 - Math.min(1, workDone(d, cap) / top) * ph
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()
    if (p > 0.45) { // the peak, circled
      const px = x0 + (peakHeads(cap) / maxD) * pw
      ctx.strokeStyle = red; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(px, y0 - ph, 40, 26, 0, 0, 2 * Math.PI); ctx.stroke()
      text(ctx, 'PEAK', px + 54, y0 - ph - 8, 46, red)
    }
    if (p > 0.75) { // and the studio, where it is
      const dx = x0 + Math.min(1, r.devs / maxD) * pw, dy = y0 - Math.min(1, workDone(r.devs, cap) / top) * ph
      ctx.fillStyle = green; ctx.beginPath(); ctx.arc(dx, dy, 20, 0, 2 * Math.PI); ctx.fill()
      text(ctx, 'US', dx, dy - 46, 44, green, 'center')
    }
    if (p > 0.9) text(ctx, '15 MIN.', x0 + pw, y0 - 30, 52, ink, 'right')
  },
}

/**
 * Every painting, by name — for the tests. A screen that throws on a strange reading (a seized
 * studio's velocity of 1e-23, a cap of zero) would blank the whole room, because the repaint runs
 * inside the frame; so each is run against the extremes.
 */
export const HQ_PAINTINGS: ReadonlyArray<{ name: string } & Pick<Face, 'key' | 'paint'>> = [
  { name: 'tickets', ...ticketWall },
  { name: 'whiteboard', ...whiteboard },
  ...(['queue', 'velocity', 'incidents', 'defects', 'sync', 'status'] as const).map((k) => ({ name: k, ...dashboard(k, [1, 2, 3]) })),
]

// --- the sets ---------------------------------------------------------------------

export interface HqSetInput {
  env: Environment
  stage: T.Group
  cast: StudioCast
  /** Where each hero's station is: the set is built round it. */
  at: Record<Id, { x: number; z: number }>
  /** The hero's body, once built, so the set can move it. */
  bodies: Partial<Record<Id, T.Group>>
  /** Who is in the cast: a set is only built for somebody the room has a station for. */
  present: ReadonlySet<Id>
}

/** A light that is on, whatever the room's lamps say: a status LED, a beacon, a strip of colour. */
function glow(parent: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, colour: string): T.Mesh {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ color: colour }))
  m.position.set(x, y + h / 2, z)
  m.userData.dynamic = true
  parent.add(m)
  return m
}

/** The stage's far-wall plane, in world z, and its depth: every set is built against them. */
const WALL_Z = GARAGE_STAGE.z0
const FRONT_Z = GARAGE_STAGE.z1

export function buildHqSets(input: HqSetInput): HqSets {
  const { env, stage, cast, at, bodies, present } = input
  const faces: Face[] = []
  const lamps: { mesh: T.Mesh; phase: number; on: string; off: string }[] = []
  const movers: ((s: number, r: HqReadouts) => void)[] = []
  const history: number[] = []
  let lastHistory = -1

  const addFace = (f: Face | null) => { if (f) faces.push(f) }
  const colourOf = (id: Id) => branchColour(HERO_BY_ID.get(id)!.branch)

  /**
   * The ground every set stands on: one carpet across its whole slot, in the hero's colour
   * and darkened to sit under the room's lamps, with a bright strip along the lip of the stage.
   * Built from the slot, not from the station, so two sets can never share a floor.
   */
  const carpet = (set: T.Group, id: Id, anchor: { x: number; z: number }, rug: string) => {
    const slot = HERO_SLOTS[id], inset = 0.08
    const x0 = slot.x0 + inset - anchor.x, x1 = slot.x1 - inset - anchor.x
    const z0 = WALL_Z + 0.06 - anchor.z, z1 = FRONT_Z - 0.06 - anchor.z
    box(set, (x0 + x1) / 2, 0.004, (z0 + z1) / 2, x1 - x0, 0.02, z1 - z0, rug, false)
    glow(set, (x0 + x1) / 2, 0.022, z1 - 0.02, x1 - x0, 0.03, 0.05, colourOf(id))
    return { x0, x1, z0, z1 }
  }

  // ============================== MATT: the phones ==============================
  if (present.has('matt')) {
    const a = at.matt
    const set = hqProp(env, stage, 'desk:matt', a.x, a.z)
    const c = carpet(set, 'matt', a, '#2c4631')
    const wallZ = WALL_Z - a.z
    // the wall it hangs on: the ticket wall, across the whole slot
    box(set, 0, 0.78, wallZ + 0.07, c.x1 - c.x0 - 0.1, 1.64, 0.1, '#4a3b2a')
    addFace(face(set, 0, 1.6, wallZ + 0.13, c.x1 - c.x0 - 0.3, 1.48, 1100, ticketWall.key, ticketWall.paint, 0.62))
    // the beacon over it, turning while anything is down
    const beacon = glow(set, c.x1 - 0.35, 2.28, wallZ + 0.2, 0.18, 0.18, 0.18, RED)
    movers.push((s, r) => { beacon.visible = r.incidents.length > 0 && Math.floor(s * 3) % 2 === 0 })
    // the call desk, in front of him
    box(set, 0, 0.74, 0.88, 3.0, 0.07, 1.0, '#b99059')
    for (const x of [-1.4, 1.4]) box(set, x, 0, 0.88, 0.12, 0.74, 0.9, '#8d693f')
    box(set, 0, 0.18, 0.5, 2.8, 0.56, 0.08, '#8d693f')
    // three phones and a switchboard, with a lamp for every line
    for (const x of [-1.05, -0.2, 0.65]) {
      box(set, x, 0.81, 0.95, 0.42, 0.08, 0.3, '#2b2f2e')
      box(set, x, 0.89, 0.95, 0.38, 0.05, 0.1, '#171a19') // the handset, in its cradle
      for (let k = 0; k < 4; k++) lamps.push({ mesh: glow(set, x - 0.12 + k * 0.08, 0.9, 1.1, 0.05, 0.02, 0.04, DIM), phase: (x + k) * 0.7, on: GREEN, off: DIM })
    }
    box(set, 1.2, 0.81, 0.9, 0.5, 0.06, 0.55, '#2b3a2d') // switchboard
    for (let k = 0; k < 8; k++) lamps.push({ mesh: glow(set, 1.03 + (k % 4) * 0.11, 0.87, 0.78 + Math.floor(k / 4) * 0.14, 0.06, 0.02, 0.06, DIM), phase: k * 0.9, on: AMBER, off: DIM })
    // a coiled cord, a stack of printouts, two filing cabinets
    for (let k = 0; k < 6; k++) cylinder(set, -1.3 + k * 0.04, 0.82, 0.62 + (k % 2) * 0.05, 0.06, 0.06, '#2b2f2e')
    for (let k = 0; k < 5; k++) box(set, -0.5 + k * 0.01, 0.81 + k * 0.012, 0.64, 0.34, 0.012, 0.26, '#efe9d8')
    box(set, c.x0 + 0.4, 0, wallZ + 0.5, 0.55, 1.15, 0.6, '#58605d')
    box(set, c.x1 - 0.4, 0, wallZ + 0.5, 0.55, 1.15, 0.6, '#58605d')
    // him: the handset against his ear, and a head that never stops
    const body = bodies.matt
    const head = body?.getObjectByName('head')
    if (head) {
      const handset = new T.Group(); handset.userData.dynamic = true; head.add(handset)
      handset.add(new T.Mesh(new T.BoxGeometry(0.1, 0.34, 0.12), new T.MeshBasicMaterial({ color: '#171a19' })))
      handset.position.set(0.3, 0.12, 0)
    }
    if (body) movers.push((s) => { body.position.y = Math.abs(Math.sin(s * 2.4)) * 0.025; if (head) { head.rotation.z = Math.sin(s * 1.7) * 0.12; head.rotation.y = Math.sin(s * 0.9) * 0.25 } })
  }

  // ============================== SERENA: the dashboards ==============================
  if (present.has('serena')) {
    const a = at.serena
    const set = hqProp(env, stage, 'desk:serena', a.x, a.z)
    const c = carpet(set, 'serena', a, '#4a2420')
    const wallZ = WALL_Z - a.z
    // the wall of six
    box(set, 0, 0.8, wallZ + 0.07, c.x1 - c.x0 - 0.1, 1.7, 0.1, '#1a2022')
    const kinds = ['queue', 'velocity', 'incidents', 'defects', 'sync', 'status'] as const
    kinds.forEach((kind, i) => {
      const col = i % 3, row = Math.floor(i / 3)
      const spec = dashboard(kind, history)
      addFace(face(set, -1.4 + col * 1.4, 1.98 - row * 0.78, wallZ + 0.13, 1.32, 0.72, 420, spec.key, spec.paint, 0.9))
    })
    // the beacon, amber, pulsing: it has been pulsing since before she was hired
    const beacon = glow(set, c.x0 + 0.3, 2.28, wallZ + 0.2, 0.2, 0.2, 0.2, AMBER)
    movers.push((s) => { beacon.scale.setScalar(0.8 + 0.4 * Math.abs(Math.sin(s * 2))) })
    // the console in front of her: two monitors angled in at the sides, and the middle clear, so
    // the dashboards are not the only thing on the stage and *she* is not behind her own screens
    box(set, 0, 0.74, 0.88, 3.4, 0.07, 0.95, '#2b3433')
    for (const x of [-1.6, 1.6]) box(set, x, 0, 0.88, 0.12, 0.74, 0.85, '#1a2022')
    for (const side of [-1, 1]) {
      const m = new T.Group(); m.position.set(side * 1.15, 0.81, 0.95); m.rotation.y = side * -0.5; set.add(m)
      box(m, 0, 0.08, 0, 0.06, 0.18, 0.06, '#101516')
      box(m, 0, 0.22, 0, 0.78, 0.5, 0.05, '#101516')
      glow(m, 0, 0.25, -0.03, 0.72, 0.44, 0.02, '#13514a')
    }
    box(set, 0, 0.81, 1.1, 0.8, 0.03, 0.28, '#3a4543') // keyboard
    cylinder(set, 0.85, 0.81, 1.15, 0.07, 0.1, '#e9e2d0') // a mug
    // a server rack at her east elbow, with its lights. **Short**: on this camera a thing stands in
    // front of the wall to its north-west, and a two-metre rack hid the 'status' dashboard it was
    // there to serve. At a metre it hides nothing above the skirting.
    box(set, c.x1 - 0.4, 0, wallZ + 0.3, 0.62, 0.95, 0.5, '#2a3234')
    for (let k = 0; k < 6; k++) lamps.push({ mesh: glow(set, c.x1 - 0.62 + (k % 3) * 0.12, 0.2 + Math.floor(k / 3) * 0.3, wallZ + 0.57, 0.06, 0.04, 0.03, DIM), phase: k * 0.6, on: k % 4 ? GREEN : AMBER, off: DIM })
    const body = bodies.serena
    const head = body?.getObjectByName('head')
    if (body) movers.push((s) => { if (head) head.rotation.y = Math.sin(s * 0.55) * 0.5 + Math.sin(s * 1.3) * 0.08; body.position.y = Math.sin(s * 0.8) * 0.01 })
  }

  // ============================== BILLY: the meeting ==============================
  if (present.has('billy')) {
    const a = at.billy
    const set = hqProp(env, stage, 'desk:billy', a.x, a.z)
    const c = carpet(set, 'billy', a, '#392a4a')
    const wallZ = WALL_Z - a.z
    // the board: the biggest single thing on the stage, west of where he stands
    const bx0 = c.x0 + 0.1, bx1 = -0.7, bw = bx1 - bx0, bcx = (bx0 + bx1) / 2
    box(set, bcx, 0.72, wallZ + 0.07, bw, 1.76, 0.1, '#58605d')
    addFace(face(set, bcx, 1.6, wallZ + 0.13, bw - 0.2, 1.6, 1100, whiteboard.key, whiteboard.paint, 0.55))
    box(set, bcx, 0.7, wallZ + 0.2, bw, 0.05, 0.14, '#58605d') // the marker tray
    for (let k = 0; k < 4; k++) box(set, bcx - 0.75 + k * 0.5, 0.75, wallZ + 0.2, 0.2, 0.03, 0.03, ['#2f5aa8', '#c23b30', '#2d7d46', '#25303a'][k])
    // him: turning between the board and the room, and never sitting down
    const body = bodies.billy
    if (body) movers.push((s) => { body.rotation.y = Math.PI * 0.78 + Math.sin(s * 0.7) * Math.PI * 0.22; body.position.y = Math.abs(Math.sin(s * 1.4)) * 0.015 })
    // the audience: the studio's own people, south of him, facing the board with their backs to
    // the room — which from this camera is how you see a meeting. Fifteen minutes is not long,
    // and nobody is allowed to sit down. They are built here and registered as his *chair*, so
    // that they drop in with him.
    const crowd = hqProp(env, stage, 'chair:billy', a.x, a.z)
    const watchers: { g: T.Group; phase: number }[] = []
    const rows: [number, number][] = [[-3.2, 1.15], [-2.45, 1.2], [-1.7, 1.1], [-0.95, 1.2], [-2.85, 1.85], [-2.1, 1.9], [-1.35, 1.85]]
    rows.forEach(([lx, lz], i) => {
      const g = studioPerson(crowd, lx, lz, 0, workerLook(cast, 5000 + i), undefined, true)
      watchers.push({ g, phase: i * 1.3 })
    })
    movers.push((s) => { for (const w of watchers) { w.g.position.y = Math.max(0, Math.sin(s * 1.9 + w.phase)) * 0.03; w.g.rotation.z = Math.sin(s * 0.6 + w.phase) * 0.03 } })
    // and a stool with a laptop on it, for whoever is taking the minutes
    box(crowd, -0.45, 0, 1.75, 0.4, 0.45, 0.4, '#8d693f')
    box(crowd, -0.45, 0.45, 1.75, 0.34, 0.03, 0.24, '#2b2f2e')
  }

  return {
    update(seconds, r) {
      let moved = false
      if (Math.floor(seconds) !== lastHistory) {
        lastHistory = Math.floor(seconds)
        history.push(r.velocity); if (history.length > 40) history.shift()
      }
      for (const f of faces) {
        const k = f.key(seconds, r)
        if (k !== f.seen) { f.seen = k; f.paint(f.ctx, f.w, f.h, seconds, r); f.texture.needsUpdate = true; moved = true }
      }
      for (const l of lamps) {
        const on = r.tickets > 0 || r.incidents.length > 0 || r.queueUsed > 0 ? Math.sin(seconds * 3 + l.phase) > 0 : Math.sin(seconds * 0.6 + l.phase) > 0.8
        const colour = on ? l.on : l.off
        const m = l.mesh.material as T.MeshBasicMaterial
        if (m.color.getHexString() !== new T.Color(colour).getHexString()) { m.color.set(colour); moved = true }
      }
      for (const m of movers) m(seconds, r)
      // The people never stop (§7.8.13), so the room is always asked for a frame; `moved` is
      // whether a *screen* changed, which is what the tests ask.
      void moved
      return true
    },
    dispose() {
      for (const f of faces) { f.texture.dispose(); f.mesh.geometry.dispose(); (f.mesh.material as T.Material).dispose() }
    },
  }
}
