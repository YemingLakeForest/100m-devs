/**
 * The heroes' sets — GDD §7.8.12 [redesigned 2026-10-04, re-planned 2026-10-05].
 *
 * *"current HQ is rubbish … Billy is at the whiteboard giving a meeting, Serena
 * full of dashboards, Matt always on the phone dealing with issues."* The first
 * HQ gave each hero a desk with a nameplate and one prop, which says *a person
 * works here* and nothing about who. These are the three sets, and the rule
 * behind them is the one §21.7.6 already states for the HUD: **a hero is the
 * instrument they brought.** So each set is a readout, drawn from the same
 * numbers the HUD shows:
 *
 * - **Serena's Ops Room** is a raised control room, glazed on the two sides the camera
 *   sees: a wall of six dashboards (the build queue and Auto-Ship, velocity, incidents,
 *   defects, sync, and the line she lives by) the width of the plinth and nearly the height of the
 *   wall under the clerestory, a crescent console, a rack with its lights.
 * - **Matt's Front Desk** is a reception counter on the north wall, on a riser, closed at the front and lettered
 *   *HELP DESK — NOW SERVING*, in front of a four-metre ticket wall that goes up to the glazing and fills with a
 *   sticky note for every few real tickets and pins the open incidents along the top in red; the switchboard blinks
 *   while there is anything to answer, and a low bench along the room edge is where somebody waits.
 * - **Billy's plaza** is the mouth of the avenue between the two north pods, on the open floor, *in the mix of the
 *   developers*: a rolling whiteboard three metres tall with the §4.1 curve on it, turned to the lens, an
 *   octagon of rug, and a man on a low round dais at its right-hand end who faces the lens and glances at the board.
 *
 * *"just line them up like that is boring"*, *"a bit too clustered … Billy is too clusterd you can put him a
 * side, he doesn't need a crowd"* and *"mat got so sqaushed"* (2026-10-05) and, last, *"billy should face us and
 * he's too short … they don't have to be all around the wall, put billy in the mix of devs so he's not just
 * meetinging himself"* (2026-10-05): the first cut was three frontages of one width on one terrace; the second three
 * buildings packed round the founder and James; the third put Matt in a four-metre slot; the fifth put Billy in a
 * corner, talking to a wall. Matt and Serena are two different buildings along the north wall — see
 * `floorPlan.HERO_SITES` — each built in **its own frame**: the wall behind it at the back (−z), the room in
 * front (+z), x along the wall. Billy is built in his station's frame too, which is turned an eighth to face the lens:
 * `frame` knows any turn, and a set on the west wall is the same set turned a quarter.
 *
 * Each person is *always doing it* (§7.8.13): the animations here never stop and
 * never change, which is what makes them an identity and not a cutscene.
 *
 * Pure geometry and canvas drawing — no store. The stage hands the numbers in
 * through {@link HqSets.update}, so this file cannot disagree with the HUD about
 * what the studio is doing.
 */

import * as T from 'three'
import { box, cylinder, sharedMaterial } from './worldArt.ts'
import { leafyPlanter } from './garageCraft.ts'
import { pool } from './glowArt.ts'
import type { Environment, GarageProp } from './worldEnvironments.ts'
import { branchColour } from '../../sim/heroBranches.ts'
import { HERO_BY_ID, type HeroId } from '../../sim/storyHeroes.ts'
import { BILLY_PLAZA, GARAGE_HERO_SCALE, HERO_SITES } from '../sim/floorPlan.ts'
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
    // Ten by six: the key's own cap is sixty notes, and the wall is 3.5 × 1.9 m now (it was 3.5 × 1.5 and four rows).
    const cols = 10, rows = 6, cw = (w - 24) / cols, ch = (h - 98) / rows
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

/**
 * The plaque on the front of Matt's counter, which is the one surface of his set the camera sees
 * square: *HELP DESK*, and the take-a-number sign every counter like it has, reading the ticket
 * count. It is the instrument a stranger would read first, and it needs no zoom.
 *
 * It is a plaque and not a banner across the counter, and it was a plaque for the counter's *north* end:
 * on the west wall the founder's desk stood south-east of the counter and hid the band of floor swept along
 * (−1, −1), so the first cut — the title at the south end — read *HEL* behind a rubber duck. The counter
 * is in the north-east now, with nothing in front of it.
 */
const helpDeskSign: Pick<Face, 'key' | 'paint'> = {
  key: (s, r) => `h${Math.min(99999, Math.max(0, Math.floor(Number.isFinite(r.tickets) ? r.tickets : 0)))}${r.incidents.length}${r.incidents.length ? Math.floor(s * 2) % 2 : ''}`,
  paint(ctx, w, h, s, r) {
    const down = r.incidents.length > 0
    ctx.fillStyle = '#14301c'; ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = down && Math.floor(s * 2) % 2 ? RED : '#78c078'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8)
    text(ctx, 'HELP DESK', 26, h * 0.27, Math.round(h * 0.34), '#d8f2d8')
    const n = Math.max(0, Math.floor(Number.isFinite(r.tickets) ? r.tickets : 0))
    text(ctx, 'NOW SERVING', 26, h * 0.74, Math.round(h * 0.17), '#78c078')
    text(ctx, String(Math.min(99999, n)).padStart(4, '0'), w - 26, h * 0.7, Math.round(h * 0.5), down ? '#ffb4a8' : '#ffd86a', 'right')
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
  { name: 'helpdesk', ...helpDeskSign },
  { name: 'whiteboard', ...whiteboard },
  ...(['queue', 'velocity', 'incidents', 'defects', 'sync', 'status'] as const).map((k) => ({ name: k, ...dashboard(k, [1, 2, 3]) })),
]

// --- the sets ---------------------------------------------------------------------

export interface HqSetInput {
  env: Environment
  /**
   * Where each hero stands: the platform group they stand on (at the room's origin, raised by the
   * platform's rise — so a set's own y = 0 is the floor it is built on), their station on it, and
   * which way the station is turned: 0 faces +z (the north wall's heroes), 90 faces +x (the west
   * wall's). The set is built in that frame.
   */
  at: Record<Id, { parent: T.Object3D; x: number; z: number; rot: number }>
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

/**
 * Glass: a pane that is *there* and lets the room through. The garage's other "glazing" is a pale
 * opaque box, which is right for a clerestory seen edge-on and wrong for a control room, whose whole
 * point is that you can see her through it. One shared geometry and one shared material, so the panes
 * batch with everything else and cost nothing to the frame; it does not write depth, so what is
 * behind it is drawn as it would have been.
 */
const GLASS_BOX = new T.BoxGeometry(1, 1, 1)
function glass(parent: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number): T.Mesh {
  const m = new T.Mesh(GLASS_BOX, sharedMaterial('hq-glass', () => new T.MeshStandardMaterial({
    color: '#9ad6e6', transparent: true, opacity: 0.16, roughness: 0.15, metalness: 0, depthWrite: false,
  })))
  m.position.set(x, y + h / 2, z)
  m.scale.set(w, h, d)
  parent.add(m)
  return m
}

export function buildHqSets(input: HqSetInput): HqSets {
  const { env, at, bodies, present } = input
  const faces: Face[] = []
  const lamps: { mesh: T.Mesh; phase: number; on: string; off: string }[] = []
  const movers: ((s: number, r: HqReadouts) => void)[] = []
  const history: number[] = []
  let lastHistory = -1

  const addFace = (f: Face | null) => { if (f) faces.push(f) }
  const colourOf = (id: Id) => branchColour(HERO_BY_ID.get(id)!.branch)

  /**
   * A hero's set, in **its own frame**: a group at the station, turned as the station is, so that
   * the wall behind it is at `c.z0` and the room in front of it at `c.z1`, with `c.x0..x1` running
   * along the wall — whichever wall that is. `c` is the site's rectangle in that frame, which is
   * what every set is built inside of and what `hqSets.test.ts` measures them against. **Any turn**
   * works, because the plan uses three: none (the north wall's sets), a quarter (the west wall's)
   * and an eighth, which is Billy's, on the open floor, facing the lens; for a turn that is not a
   * quarter `c` is the bounding box of the turned site, and the set is built from `local` instead.
   * (A group that is turned by `rotation.y = t` takes its own (x, z) to (x·cos t + z·sin t,
   * −x·sin t + z·cos t), so a world point comes back with the transpose.)
   */
  const frame = (id: Id) => {
    const a = at[id], site = HERO_SITES[id]
    const set = hqProp(env, a.parent, `desk:${id}`, a.x, a.z)
    const turn = (a.rot * Math.PI) / 180, cs = Math.cos(turn), sn = Math.sin(turn)
    set.rotation.y = turn
    const local = (x: number, z: number) => ({ x: (x - a.x) * cs - (z - a.z) * sn, z: (x - a.x) * sn + (z - a.z) * cs })
    const corners = ([[site.x0, site.z0], [site.x1, site.z0], [site.x1, site.z1], [site.x0, site.z1]] as const).map(([x, z]) => local(x, z))
    const xs = corners.map((p) => p.x), zs = corners.map((p) => p.z)
    const c = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
    return { set, c, a, site, local }
  }

  /**
   * The ground a set stands on: one carpet across its whole site, in the hero's colour and darkened
   * to sit under the room's lamps, with a bright strip along the edge that faces the room. Built
   * from the site, not from the station, so two sets can never share a floor.
   */
  const carpet = (set: T.Group, id: Id, c: { x0: number; x1: number; z0: number; z1: number }, rug: string, inset = 0.08) => {
    const x0 = c.x0 + inset, x1 = c.x1 - inset, z0 = c.z0 + 0.06, z1 = c.z1 - 0.06
    box(set, (x0 + x1) / 2, 0.004, (z0 + z1) / 2, x1 - x0, 0.02, z1 - z0, rug, false)
    glow(set, (x0 + x1) / 2, 0.022, z1 - 0.02, x1 - x0, 0.03, 0.05, colourOf(id))
  }

  // ======================== MATT: the front desk ========================
  // On the north wall, west of the Ops Room, on a riser: the lobby of the studio, and the first place a stranger walks
  // up to. It was a 3.6 m slot in the north-east and the user's word for it was *squashed* (2026-10-05): this site is
  // 4.0 m along the wall and 3.7 m out, and every piece in it is sized to the site and not to a number. The desk is a
  // counter, closed at the front, lettered, and the one surface of the set the camera sees square; the ticket wall
  // is the wall the old garage gate was in — and **it goes up as far as the wall lets it** (2.1 m of it, from a hand
  // above the counter to a hand under the clerestory) because the wall is 4.6 m now and a pinboard that stopped at
  // the old 3.2 m's height would be a poster in the bottom half of a tall room.
  if (present.has('matt')) {
    const { set, c } = frame('matt')
    carpet(set, 'matt', c, '#2c4631')
    pool(set, 0, (c.z0 + c.z1) / 2, c.x1 - c.x0, c.z1 - c.z0, colourOf('matt'), 0.3)
    const wallZ = c.z0
    const tw = Math.min(4.0, c.x1 - c.x0 - 0.3)
    // the wall it hangs on: the ticket wall, across it, 0.8–2.9 m above the riser (its top is 3.1 m up the wall, and the
    // glazing starts at 3.2)
    const bottom = 0.8, bh = 2.1
    box(set, 0, bottom, wallZ + 0.07, tw, bh, 0.1, '#4a3b2a')
    addFace(face(set, 0, bottom + bh / 2, wallZ + 0.13, tw - 0.2, bh - 0.16, 1200, ticketWall.key, ticketWall.paint, 0.62))
    // the beacon over it, turning while anything is down
    const beacon = glow(set, tw / 2 - 0.3, bottom + bh + 0.04, wallZ + 0.2, 0.18, 0.18, 0.18, RED)
    movers.push((s, r) => { beacon.visible = r.incidents.length > 0 && Math.floor(s * 3) % 2 === 0 })
    // the counter: a top, a closed front in the set's green, a modesty panel on his side
    const cl = Math.min(3.4, tw - 0.4)
    const dz = 0.95, dd = 0.9, front = dz + dd / 2
    box(set, 0, 0.74, dz, cl, 0.07, dd, '#b99059')
    box(set, 0, 0, front - 0.035, cl, 0.74, 0.07, '#25402b')
    for (const x of [-cl / 2 + 0.04, cl / 2 - 0.04]) box(set, x, 0, dz, 0.08, 0.74, dd - 0.1, '#25402b')
    box(set, 0, 0.12, dz - dd / 2 + 0.05, cl - 0.16, 0.62, 0.06, '#8d693f')
    box(set, 0, 0.81, front - 0.02, cl + 0.06, 0.03, 0.1, '#d9c58f')
    addFace(face(set, 0.2, 0.4, front + 0.004, 1.9, 0.55, 900, helpDeskSign.key, helpDeskSign.paint, 0.85))
    // three phones and a switchboard, with a lamp for every line
    for (let p = 0; p < 3; p++) {
      const x = -cl / 2 + 0.5 + p * 0.8
      box(set, x, 0.81, 1.0, 0.42, 0.08, 0.3, '#2b2f2e')
      box(set, x, 0.89, 1.0, 0.38, 0.05, 0.1, '#171a19') // the handset, in its cradle
      for (let k = 0; k < 4; k++) lamps.push({ mesh: glow(set, x - 0.12 + k * 0.08, 0.9, 1.15, 0.05, 0.02, 0.04, DIM), phase: (x + k) * 0.7, on: GREEN, off: DIM })
    }
    const sbx = cl / 2 - 0.45
    box(set, sbx, 0.81, 0.95, 0.46, 0.06, 0.55, '#2b3a2d') // switchboard
    for (let k = 0; k < 8; k++) lamps.push({ mesh: glow(set, sbx - 0.15 + (k % 4) * 0.1, 0.87, 0.83 + Math.floor(k / 4) * 0.14, 0.06, 0.02, 0.06, DIM), phase: k * 0.9, on: AMBER, off: DIM })
    // a coiled cord, a stack of printouts, two filing cabinets against the wall
    for (let k = 0; k < 6; k++) cylinder(set, -cl / 2 + 0.1 + k * 0.04, 0.82, 0.7 + (k % 2) * 0.05, 0.06, 0.06, '#2b2f2e')
    for (let k = 0; k < 5; k++) box(set, -0.6 + k * 0.01, 0.81 + k * 0.012, 0.72, 0.34, 0.012, 0.26, '#efe9d8')
    box(set, c.x0 + 0.45, 0, wallZ + 0.5, 0.55, 1.15, 0.6, '#58605d')
    box(set, c.x1 - 0.45, 0, wallZ + 0.5, 0.55, 1.15, 0.6, '#58605d')
    // the lobby: a low bench along the room edge — low, so that it hides nothing of the counter's front from this
    // camera — with a plant at each end
    box(set, 0, 0, c.z1 - 0.32, 2.2, 0.3, 0.44, '#3a5a41')
    box(set, 0, 0.3, c.z1 - 0.32, 2.24, 0.05, 0.48, '#d9c58f')
    leafyPlanter(set, -1.55, c.z1 - 0.34, 0.45)
    leafyPlanter(set, 1.55, c.z1 - 0.34, 0.45)
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

  // ======================== SERENA: the ops room ========================
  // Raised, at the head of the main axis, and glazed on the two sides the camera sees. A control
  // room wants to look down the floor it watches; the player wants to see her through the glass.
  if (present.has('serena')) {
    const { set, c } = frame('serena')
    const wallZ = c.z0
    // graphite floor with a cyan inlay, and the zone's own light
    const fx0 = c.x0 + 0.04, fx1 = c.x1 - 0.04, fz0 = wallZ + 0.04, fz1 = c.z1 - 0.04
    box(set, (fx0 + fx1) / 2, 0.004, (fz0 + fz1) / 2, fx1 - fx0, 0.02, fz1 - fz0, '#1d2527', false)
    const CYAN = '#36c3d8'
    glow(set, (fx0 + fx1) / 2, 0.022, fz1 - 0.16, fx1 - fx0 - 0.3, 0.02, 0.035, CYAN)
    glow(set, fx1 - 0.16, 0.022, (fz0 + fz1) / 2, 0.035, 0.02, fz1 - fz0 - 0.3, CYAN)
    glow(set, fx0 + 0.16, 0.022, (fz0 + fz1) / 2, 0.035, 0.02, fz1 - fz0 - 0.3, CYAN)
    pool(set, 0, 0.3, 4.4, 3.2, '#4fd8ee', 0.26)
    // the wall of six: the width of the plinth and, now that the wall is 4.6 m, nearly the height the clerestory
    // leaves it — 2.2 m of video wall from a hand above the plinth to the lit line under the glazing (3.2 m up the wall)
    box(set, 0, 0.12, wallZ + 0.07, c.x1 - c.x0 - 0.12, 2.18, 0.1, '#1a2022')
    const kinds = ['queue', 'velocity', 'incidents', 'defects', 'sync', 'status'] as const
    // three columns across whatever width the plinth has (4.8 m: a pitch of 1.47), each a little taller than the
    // paintings' own 1.83 aspect (they are drawn to their canvas, and a taller one is a roomier one)
    const pitch = (c.x1 - c.x0 - 0.4) / 3, pw = pitch - 0.08, ph = pw * 0.7
    kinds.forEach((kind, i) => {
      const col = i % 3, row = Math.floor(i / 3)
      const spec = dashboard(kind, history)
      addFace(face(set, (col - 1) * pitch, 1.7 - row * (ph + 0.07), wallZ + 0.13, pw, ph, 420, spec.key, spec.paint, 0.9))
    })
    glow(set, 0, 2.3, wallZ + 0.1, c.x1 - c.x0 - 0.3, 0.035, 0.035, CYAN)
    // the console: a crescent, the middle and a wing either side turned in to her
    const cz = 0.95
    box(set, 0, 0.74, cz, 2.2, 0.07, 0.8, '#2b3433')
    box(set, 0, 0, cz + 0.37, 2.2, 0.74, 0.06, '#1a2022')
    for (const side of [-1, 1]) {
      const wing = new T.Group(); wing.position.set(side * 1.3, 0, cz - 0.12); wing.rotation.y = side * 0.55; set.add(wing)
      box(wing, 0, 0.74, 0, 1.1, 0.07, 0.7, '#2b3433')
      box(wing, 0, 0, 0.3, 1.1, 0.74, 0.06, '#1a2022')
      box(wing, 0, 0.81, -0.05, 0.54, 0.34, 0.04, '#101516')
      glow(wing, 0, 0.86, -0.075, 0.48, 0.26, 0.015, '#13514a')
    }
    for (const x of [-0.65, 0.65]) {
      box(set, x, 0.81, 1.0, 0.5, 0.3, 0.04, '#101516')
      glow(set, x, 0.86, 0.975, 0.44, 0.22, 0.015, '#13514a')
    }
    box(set, 0, 0.81, 1.15, 0.8, 0.03, 0.28, '#3a4543') // keyboard
    cylinder(set, 0.95, 0.81, 1.2, 0.07, 0.1, '#e9e2d0') // a mug
    // a short rack at her east elbow, with its lights and the beacon: **short**, because on this
    // camera a thing stands in front of the wall to its north-west, and a two-metre rack hid the
    // dashboard it was there to serve.
    const rx = c.x1 - 0.5
    box(set, rx, 0, wallZ + 0.35, 0.62, 1.0, 0.5, '#2a3234')
    for (let k = 0; k < 6; k++) lamps.push({ mesh: glow(set, rx - 0.22 + (k % 3) * 0.12, 0.2 + Math.floor(k / 3) * 0.3, wallZ + 0.62, 0.06, 0.04, 0.03, DIM), phase: k * 0.6, on: k % 4 ? GREEN : AMBER, off: DIM })
    const beacon = glow(set, rx, 1.0, wallZ + 0.35, 0.2, 0.2, 0.2, AMBER)
    movers.push((s) => { beacon.scale.setScalar(0.8 + 0.4 * Math.abs(Math.sin(s * 2))) })
    // the glass: a pane along the south edge, left open at the east end for the step up, and one
    // along the east edge — the two faces the camera sees — with posts and a lit top rail
    const gz = c.z1 - 0.1, gx = c.x1 - 0.1, gh = 0.95
    const door = 0.95
    glass(set, (c.x0 + 0.1 + gx - door) / 2, 0, gz, gx - door - c.x0 - 0.1, gh, 0.035)
    glass(set, gx, 0, (wallZ + 0.1 + gz) / 2, 0.035, gh, gz - wallZ - 0.1)
    for (const [px, pz] of [[c.x0 + 0.1, gz], [gx - door, gz], [gx, gz], [gx, wallZ + 0.1]] as const) box(set, px, 0, pz, 0.07, gh + 0.06, 0.07, '#1f2a2c')
    glow(set, (c.x0 + 0.1 + gx - door) / 2, gh, gz, gx - door - c.x0 - 0.1, 0.035, 0.05, CYAN)
    glow(set, gx, gh, (wallZ + 0.1 + gz) / 2, 0.05, 0.035, gz - wallZ - 0.1, CYAN)
    const body = bodies.serena
    const head = body?.getObjectByName('head')
    if (body) movers.push((s) => { if (head) head.rotation.y = Math.sin(s * 0.55) * 0.5 + Math.sin(s * 1.3) * 0.08; body.position.y = Math.sin(s * 0.8) * 0.01 })
  }

  // ======================== BILLY: the plaza ========================
  // **In the mix** (the user, 2026-10-05: *"put billy in the mix of devs so he's not just meetinging himself"*, and
  // *"billy should face us and he's too short"*). He was in a corner talking to a wall in every cut before this one. He
  // is on the open floor now, at the mouth of the avenue between the two north pods with a developer's desk either side
  // of him, and everything he has is turned to the lens: the board, and he. The board is a rolling one, 2.0 m wide with
  // a face 1.8 m tall, on a stand that takes it to 2.9 m; he stands a step in front of its right-hand end — *screen right*
  // is his frame's +x — on a low octagonal dais, because a presenter is a head above the room and the standing figure
  // in this skin has no legs to be tall with. He faces us, and now and then turns to the board. **No crowd**, still:
  // the studio's own, in the pods around him, is the audience. Every number is `floorPlan.BILLY_PLAZA`'s, because the
  // walk grid closes the footprint those numbers imply.
  if (present.has('billy')) {
    const { set, local } = frame('billy')
    const round = HERO_SITES.billy.round!
    const ctr = local(round.x, round.z)
    const { dais, board } = BILLY_PLAZA
    // concentric octagons, each a hair above the last: a rug, a ring, a medallion. (The ring is a tan, not a cream: under the
    // plaza's lamp a cream ring went over the bloom's threshold and was a neon octagon on the floor.)
    const octagon = (x: number, z: number, apothem: number, y: number, h: number, colour: string) => {
      const m = cylinder(set, x, y, z, apothem / Math.cos(Math.PI / 8), h, colour)
      m.rotation.y = Math.PI / 8
      m.castShadow = false
      return m
    }
    octagon(ctr.x, ctr.z, round.apothem, 0.004, 0.02, '#4a2f66')
    octagon(ctr.x, ctr.z, round.apothem * 0.78, 0.02, 0.012, '#b9a97f')
    octagon(ctr.x, ctr.z, round.apothem * 0.58, 0.03, 0.01, '#4a2f66')
    pool(set, ctr.x, ctr.z, round.apothem * 3, round.apothem * 3, colourOf('billy'), 0.2)
    // his dais: a foot in his colour and a top in oak
    octagon(0, 0, dais.apothem + 0.05, 0.03, 0.04, colourOf('billy'))
    octagon(0, 0, dais.apothem, 0.03, dais.rise - 0.03, '#c39760')
    // the board: a frame, a face that is the §4.1 curve, a tray with four markers, and two uprights on feet with castors
    const by = 1.05, bh = 1.8
    box(set, board.x, by - 0.06, board.z, board.w, bh + 0.12, 0.1, '#58605d')
    addFace(face(set, board.x, by + bh / 2, board.z + 0.056, board.w - 0.14, bh, 1100, whiteboard.key, whiteboard.paint, 0.55))
    box(set, board.x, by - 0.12, board.z + 0.1, board.w, 0.05, 0.16, '#58605d')
    for (let k = 0; k < 4; k++) box(set, board.x - 0.65 + k * 0.45, by - 0.07, board.z + 0.12, 0.2, 0.03, 0.03, ['#2f5aa8', '#c23b30', '#2d7d46', '#25303a'][k])
    for (const side of [-1, 1]) {
      const x = board.x + side * (board.w / 2 - 0.03)
      box(set, x, 0.12, board.z, 0.07, by + bh - 0.06, 0.08, '#3b4240')
      box(set, x, 0.08, board.z, 0.07, 0.05, board.feet * 2, '#3b4240')
      for (const dz of [-board.feet + 0.05, board.feet - 0.05]) cylinder(set, x, 0, board.z + dz, 0.045, 0.08, '#171a19')
    }
    // him: on the dais, facing the lens, turning to the board now and then and never sitting down. The body's face is its
    // local −z, so a yaw of π sends it to the station's +z, which is the lens; turning toward the board (to his left, −x)
    // is a yaw *down* from π, by at most ~55°. The dais is in the set's own unscaled metres and the body is in the
    // station's scaled ones, hence the division.
    const body = bodies.billy
    if (body) movers.push((s) => {
      const toBoard = Math.max(0, Math.sin(s * 0.7)) ** 2
      body.rotation.y = Math.PI - toBoard * 0.95
      body.position.y = dais.rise / GARAGE_HERO_SCALE + Math.abs(Math.sin(s * 1.4)) * 0.015
    })
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
