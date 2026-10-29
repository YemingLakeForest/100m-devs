/**
 * The app icon's master — the CTO over the 100M window [amended 2026-10-29].
 *
 *   npm run art:icon-master && npm run art:icon -- --from store/icon-master-512.png
 *
 * *"the game icon, red base duck is completely out of the game. design again, it
 * should be memorisable, fun, fitting the game theme and with duckington"*, then
 * *"F4 · 100M is the way to go, but use a voxel duck instead"* and *"can I just
 * use a plain duck, and q2 is good"*. The drafts are kept in
 * `docs/demos/icon-drafts-2026-10-29/`; this paints the one that was picked.
 *
 * **What it is.** B. Quackington III in profile, chin on a window whose whole
 * content is the game's name, on the phosphor cyan. The red field of 2026-10-22
 * was the one thing in the product that was not the studio's palette; the window
 * is the Studio OS idiom (§10.8a), so the icon on the home screen is the first
 * window of the game.
 *
 * **One grid, two changes.** The duck is `art/duckVoxels.ts`'s grid through the
 * portrait's own painter, so he is still the duck in the room. Two changes
 * are the icon's alone, because a voxel is a dot at 32 px: an eye two
 * voxels tall, and a tail flicked up so his back end has a shape. They are not in
 * the room's grid, where he is read at a distance and a taller eye is a stare.
 * Headphones, shades and a crown were drafted and cut: each sat over the eye or
 * merged into the yellow, and the face is the whole of a duck.
 *
 * **Pixel art, as `build-icon.ts` requires of a master.** A 64 px grid in §2.2's
 * palette, no anti-aliasing and no new colours, blown up eight times
 * nearest-neighbour to Play's 512. Square and full bleed: Play and the launchers
 * do the rounding.
 */

import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { RAMPS } from '../src/art/palette.ts'
import { duckVoxels, type Voxel } from '../src/art/duckVoxels.ts'
import { DUCK_TURN, voxelBoxes } from '../src/art/voxelIcons.ts'
import { Raster, pack, paintTurned, turnedBounds, type Px } from '../src/hud/isoBoard.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'store/icon-master-512.png')

const GRID = 64
/** Pixels per voxel: four, which keeps every block a block at 48 px. */
const UNIT = 4

const FIELD = pack(RAMPS.CALM[2])
const INK = pack(RAMPS.NEUTRAL[0])
const WINDOW = pack(RAMPS.NEUTRAL[1])
const TITLEBAR = pack(RAMPS.NEUTRAL[3])
const CYAN = pack(RAMPS.CALM[2])
const AMBER = pack(RAMPS.WARN[2])
const GREY = pack(RAMPS.NEUTRAL[6])

/** The room's duck, with the icon's own two changes (see the header). */
function iconDuck(): Voxel[] {
  const v = duckVoxels({}).map((c) => [...c] as [number, number, number, Voxel[3]])
  const put = (x: number, y: number, z: number, ink: Voxel[3]) => {
    const i = v.findIndex((c) => c[0] === x && c[1] === y && c[2] === z)
    if (i >= 0) v.splice(i, 1)
    v.push([x, y, z, ink])
  }
  for (const z of [2, -3]) { put(7, 6, z, 'eye'); put(7, 7, z, 'eye') }
  for (const z of [-1, 0]) { put(-1, 6, z, 'yellow'); put(0, 6, z, 'yellow'); put(-1, 7, z, 'yellow') }
  return v
}

/** The wordmark's glyphs, 5x7, in the HUD's pixel capitals. */
const GLYPH: Record<string, readonly string[]> = {
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
}

function text(r: Raster, str: string, x: number, y: number, u: number, c: Px) {
  for (const ch of str) {
    GLYPH[ch].forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') r.rect(x + i * u, y + j * u, u, u, c) }))
    x += 6 * u
  }
}

const boxes = voxelBoxes(iconDuck())
const { x0, x1, y0 } = turnedBounds(boxes, DUCK_TURN)
const sprite = new Raster(GRID, GRID)
paintTurned(sprite, Math.round(30 - ((x0 + x1) / 2) * UNIT), Math.round(3 - y0 * UNIT), boxes, UNIT, DUCK_TURN, null)

/** The window over his lower half: a hard edge, a title bar with its three dots, and the name. */
const SIGN_Y = 38
sprite.rect(4, SIGN_Y - 1, 56, 1, INK)
sprite.rect(4, SIGN_Y, 56, GRID - 4 - SIGN_Y, WINDOW)
sprite.rect(4, SIGN_Y, 56, 7, TITLEBAR)
sprite.rect(8, SIGN_Y + 2, 3, 3, CYAN)
sprite.rect(13, SIGN_Y + 2, 3, 3, AMBER)
sprite.rect(18, SIGN_Y + 2, 3, 3, GREY)
text(sprite, '100', 7, SIGN_Y + 9, 2, AMBER)
text(sprite, 'M', 43, SIGN_Y + 9, 2, CYAN)

// A one-pixel rim round the whole figure, so the yellow and the window hold against the field.
const out = new Raster(GRID, GRID)
out.clear(FIELD)
for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
  const p = sprite.px[y * GRID + x]
  if (p >>> 24) { out.px[y * GRID + x] = p; continue }
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx, ny = y + dy
    return nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && sprite.px[ny * GRID + nx] >>> 24
  })
  if (near) out.px[y * GRID + x] = INK
}

await mkdir(dirname(OUT), { recursive: true })
await sharp(Buffer.from(out.px.buffer), { raw: { width: GRID, height: GRID, channels: 4 } })
  .resize(512, 512, { kernel: 'nearest' })
  .png({ compressionLevel: 9 })
  .toFile(OUT)
console.log(`✓ store/icon-master-512.png — the CTO over the 100M window, ${GRID}px grid at ${512 / GRID}x`)
console.log('  next: npm run art:icon -- --from store/icon-master-512.png')
