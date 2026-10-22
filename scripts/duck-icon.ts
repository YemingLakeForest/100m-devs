/**
 * The app icon's master — the CTO, as the game's motif [2026-10-22].
 *
 *   npm run art:icon-master && npm run art:icon -- --from store/icon-master-512.png
 *
 * *"I wanted to make this the games main motif and on the game app icon need to
 * nail it."* Round 3's lab (`docs/demos/duck-motif-2026-10-22/`) tried twelve
 * icons; the user picked the eight-bit duck on a red field. This paints it.
 *
 * **One grid.** The duck is `art/duckVoxels.ts`, the grid the room and his
 * portrait draw, through the portrait's own painter (`isoBoard.paintTurned`) and
 * materials (`voxelIcons.duckBoxes`), so the icon cannot drift from the duck in
 * the game: change him there and this redraws him.
 *
 * **Pixel art, as `build-icon.ts` requires of a master.** It is painted on a 64
 * px grid in §2.2's palette — no anti-aliasing, no new colours — and blown up
 * eight times, nearest-neighbour, to Play's 512. A 64 grid is the one the
 * builder's note says survives the uneven reductions to 48 and 72, and at three
 * pixels a voxel every block of the eight-bit duck is still a block at 48 px.
 *
 * Square and full bleed: Play and the launchers do the rounding.
 */

import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { RAMPS } from '../src/art/palette.ts'
import { DUCK_TURN, duckBoxes } from '../src/art/voxelIcons.ts'
import { Raster, pack, paintTurned, turnedBounds, type Turn } from '../src/hud/isoBoard.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'store/icon-master-512.png')

const GRID = 64
/** Pixels per voxel: four, which makes him three-quarters of the tile and keeps every block a block at 48 px. */
const UNIT = 4
/** The field: ALARM's red, the nearest palette step to the coral round 3 was drawn on. */
const FIELD = RAMPS.ALARM[2]
/** A one-pixel rim round him, so the yellow holds against the red at 32 px. */
const RIM = RAMPS.NEUTRAL[1]

const TURN: Turn = DUCK_TURN
const OUT_PATH = OUT

const boxes = duckBoxes({})
const { x0, x1, y0, y1 } = turnedBounds(boxes, TURN)
const duck = new Raster(GRID, GRID)
paintTurned(duck, Math.round(GRID / 2 - ((x0 + x1) / 2) * UNIT), Math.round(GRID / 2 - ((y0 + y1) / 2) * UNIT), boxes, UNIT, TURN, null)

const field = pack(FIELD), rim = pack(RIM)
const out = new Raster(GRID, GRID)
out.clear(field)
for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
  const p = duck.px[y * GRID + x]
  if (p >>> 24) { out.px[y * GRID + x] = p; continue }
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx, ny = y + dy
    return nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && duck.px[ny * GRID + nx] >>> 24
  })
  if (near) out.px[y * GRID + x] = rim
}

await mkdir(dirname(OUT_PATH), { recursive: true })
await sharp(Buffer.from(out.px.buffer), { raw: { width: GRID, height: GRID, channels: 4 } })
  .resize(512, 512, { kernel: 'nearest' })
  .png({ compressionLevel: 9 })
  .toFile(OUT_PATH)
console.log(`✓ store/icon-master-512.png — the eight-bit duck, ${GRID}px grid at ${512 / GRID}x`)
console.log('  next: npm run art:icon -- --from store/icon-master-512.png')
