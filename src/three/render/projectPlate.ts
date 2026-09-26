/*
 * Copied from the rebuild (100m-devs-three/src/render/projectPlate.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/** The game's cover is drawn onto a shared enamel board as story points burn down. */
import * as T from 'three'
import { OS_SKIN } from '../art/skin.ts'
import { COVER_SIZE, paintCover, runsOf } from '../art/coverPixels.ts'
import type { CoverSpec } from '../sim/cover.ts'
import { box, INK } from './worldArt.ts'

const PAPER = '#F5F7F1'
const INK_COLOUR = '#45665F'
const CELL = 8, ART = COVER_SIZE * CELL, PAD = 18
const CANVAS_W = 448, CANVAS_H = 280
const CAPTION_ROWS = 6

export interface ProjectPlate {
  readonly mesh: T.Mesh
  update(spec: CoverSpec | null, title: string, progress: number): void
  dispose(): void
}

export function printedRows(progress: number): number {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  return Math.round(p * (COVER_SIZE + CAPTION_ROWS))
}

/** Frame, enamel face and a real pen tray; all dimensions follow the printed face. */
export function projectBoard(parent: T.Group, x: number, bottom: number, z: number,
  width: number, standing: boolean): ProjectPlate {
  const height = width * CANVAS_H / CANVAS_W
  const frame = new T.Group()
  frame.name = standing ? 'office-project-whiteboard' : 'garage-project-whiteboard'
  frame.position.set(x, bottom, z)
  parent.add(frame)
  box(frame, 0, 0, 0, width + .16, height + .16, .12, '#648079')
  box(frame, 0, .055, .07, width + .05, height + .05, .025, '#d5ddd5')
  // Oak end caps and tray relate the board to the studio's desks.
  for (const side of [-1, 1]) {
    box(frame, side * (width / 2 + .055), .02, .01, .05, height + .12, .15, INK.wood)
    if (standing) {
      box(frame, side * width * .38, -bottom + .08, -.01, .10, bottom, .14, '#648079')
      box(frame, side * width * .38, -bottom + .04, 0, .5, .09, .52, '#648079')
    }
  }
  box(frame, 0, -.035, .14, width + .22, .075, .26, INK.wood)
  for (const [i, colour] of ['#45665f', '#668b9e', '#c39955'].entries()) {
    box(frame, width * .24 + i * .19, .045, .18, .13, .04, .055, colour)
  }
  box(frame, -width * .32, .04, .17, .28, .07, .12, '#45665f')
  const plate = projectPlate(width)
  plate.mesh.position.set(0, height / 2 + .08, .09)
  frame.add(plate.mesh)
  return plate
}

/**
 * The board's face, kept between rebuilds — one per width.
 *
 * [2026-09-22] The canvas, its texture and its material were rebuilt with the
 * room, and the room is rebuilt on every hire (§12.6). Nothing else in the
 * scene is a `MeshBasicMaterial` carrying a map with tone mapping off, so this
 * one material was the sole owner of its compiled shader: disposing it *deleted*
 * the program and the next draw stalled compiling it again.
 *
 * Keeping the face also keeps `lastKey`, which is the better answer anyway —
 * the board is already showing the right picture when the room comes back, so
 * the rebuild no longer repaints 448x280 pixels to arrive where it started.
 *
 * Two widths exist, the garage's board and the office's, and they are the two
 * entries. The mesh is still new each time, because a mesh belongs to one graph.
 */
const faces = new Map<number, { geometry: T.PlaneGeometry; material: T.MeshBasicMaterial
  paint: (spec: CoverSpec | null, title: string, progress: number) => void }>()

export function projectPlate(width: number): ProjectPlate {
  const cached = faces.get(width)
  if (cached) {
    const mesh = new T.Mesh(cached.geometry, cached.material)
    return { mesh, update: cached.paint, dispose: () => {} }
  }
  const geometry = new T.PlaneGeometry(width, width * CANVAS_H / CANVAS_W)
  if (typeof document === 'undefined' || /jsdom/i.test(navigator.userAgent)) {
    const material = new T.MeshBasicMaterial({ color: PAPER })
    // STUDIO_OS: a projection on a wall in a dark room, not a lightbox — unlit
    // paper white sits over the bloom threshold and flares (measured, 2026-09-26).
    if (OS_SKIN) material.color.multiplyScalar(.3)
    const mesh = new T.Mesh(geometry, material)
    mesh.userData.ownGeometry = true; mesh.userData.ownMaterial = true
    return { mesh, update: () => {}, dispose: () => { geometry.dispose(); material.dispose() } }
  }
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W; canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')!
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.magFilter = T.NearestFilter
  texture.minFilter = T.LinearMipmapLinearFilter
  const material = new T.MeshBasicMaterial({ map: texture, toneMapped: false })
  if (OS_SKIN) material.color.setScalar(.34)
  const mesh = new T.Mesh(geometry, material)
  let lastKey = ''
  const update = (spec: CoverSpec | null, title: string, progress: number): void => {
    const rows = printedRows(progress)
    const key = `${spec ? JSON.stringify(spec) : 'none'}|${title}|${rows}`
    if (key === lastKey) return
    lastKey = key
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    const artY = 12
    // The unfinished area stays white, with a faint drawing grid instead of a grey slab.
    ctx.fillStyle = '#E2E9E1'
    for (let y = 0; y <= COVER_SIZE; y += 2) for (let x = 0; x <= COVER_SIZE; x += 2) {
      ctx.fillRect(PAD + x * CELL, artY + y * CELL, 1, 1)
    }
    if (spec) {
      ctx.save(); ctx.beginPath()
      ctx.rect(PAD, artY, ART, Math.min(ART, rows * CELL)); ctx.clip()
      for (const r of runsOf(paintCover(spec))) {
        ctx.fillStyle = r.colour
        ctx.fillRect(PAD + r.x * CELL, artY + r.y * CELL, r.w * CELL, CELL)
      }
      ctx.restore()
    }
    // Quiet margin notes keep the artwork dominant and avoid a dark TV bezel.
    const noteX = 299
    ctx.fillStyle = INK_COLOUR
    ctx.font = '18px "Departure Mono", ui-monospace, monospace'
    ctx.fillText('Now drawing', noteX, 39)
    ctx.fillStyle = '#91A69A'; ctx.fillRect(noteX, 51, 121, 2)
    ctx.font = '13px "Departure Mono", ui-monospace, monospace'
    ctx.fillStyle = INK_COLOUR
    ctx.fillText(spec ? 'Game in progress' : 'Ready to create', noteX, 77)
    // The title arrives only after the picture, preserving the completion reveal.
    if (rows > COVER_SIZE) {
      ctx.save();ctx.beginPath();ctx.rect(noteX, 97, 132, (rows - COVER_SIZE) / CAPTION_ROWS * 120);ctx.clip()
      ctx.font = '20px "Departure Mono", ui-monospace, monospace'
      let line = '', y = 121
      for (const word of title.split(' ')) {
        const next = line ? `${line} ${word}` : word
        if (ctx.measureText(next).width > 130 && line) { ctx.fillText(line, noteX, y, 130); y += 26; line = word }
        else line = next
      }
      ctx.fillText(line, noteX, y, 130);ctx.restore()
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i < Math.floor(rows / (COVER_SIZE + CAPTION_ROWS) * 8) ? '#648079' : '#DDE5DB'
      ctx.fillRect(noteX + i * 15, 239, 10, 5)
    }
    if (rows > 0 && rows < COVER_SIZE) {
      ctx.fillStyle = '#648079';ctx.fillRect(PAD, artY + rows * CELL, ART, 1)
    }
    texture.needsUpdate = true
  }
  update(null, '', 0)
  faces.set(width, { geometry, material, paint: update })
  // `dispose` is a no-op now: the face outlives every graph it is hung in, and
  // `disposeArt` leaves it alone because the mesh carries no `own*` flag.
  return { mesh, update, dispose: () => {} }
}
