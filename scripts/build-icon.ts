/**
 * The launcher icon — TEMPORARY, generated rather than drawn.
 *
 * `npm run art:icon`
 *
 * This is a placeholder standing in until there is real key art (GDD §22).
 * It is a *script* and not a checked-in PNG on purpose: a hand-exported icon
 * has no source, so the day the real one arrives nobody can tell which of the
 * fifteen PNGs in `android/app/src/main/res` were regenerated and which are
 * stale leftovers. Everything this writes is reproducible from the grid below,
 * and deleting the script's outputs costs one command.
 *
 * The art is a 32x32 pixel grid — a CRT with a rising bar chart on it, which is
 * the whole game in two nouns — drawn from the ART_DIRECTION §2.2 master
 * palette and scaled with nearest-neighbour only, so every output is the same
 * pixels at a different size and never a blurred resample. §3 rule 1 (no
 * anti-aliased edges anywhere in the product) applies to the icon too: it is
 * the first art the player sees.
 *
 * Outputs, all under android/app/src/main/res and public:
 *   res/mipmap-<density>/ic_launcher.png             legacy, full bleed
 *   res/mipmap-<density>/ic_launcher_round.png       legacy round mask
 *   res/mipmap-<density>/ic_launcher_foreground.png  adaptive foreground
 *   res/values/ic_launcher_background.xml            adaptive background colour
 *   public/icon-{32,180,192,512}.png                 web / PWA / tab
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { RAMPS } from '../src/art/palette.ts'
import { hexToRgb } from '../src/art/palette.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RES = join(ROOT, 'android/app/src/main/res')
const PUBLIC = join(ROOT, 'public')

/** The grid is 32x32 and every coordinate below is in those units. */
const G = 32

const BG = RAMPS.NEUTRAL[0] // #14121a — the same colour capacitor.config paints
const BEZEL = RAMPS.NEUTRAL[3]
const BEZEL_LIT = RAMPS.NEUTRAL[4]
const SCREEN = RAMPS.CALM[0]
const BAR = RAMPS.CALM[2]
const BAR_CAP = RAMPS.CALM[3]

type Grid = (string | null)[][]

function blank(): Grid {
  return Array.from({ length: G }, () => Array.from({ length: G }, () => null))
}

/** Inclusive on both ends — these are pixels, not CSS boxes. */
function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, hex: string) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = hex
}

/**
 * The glyph, drawn into the middle 24x24 of the grid.
 *
 * The 4px margin is not decoration: Android's adaptive icon crops a 108dp
 * canvas to a 72dp safe zone, so a glyph drawn edge to edge loses its outer
 * third to whatever mask the launcher happens to use. Everything load-bearing
 * stays inside x/y 4..27.
 */
function drawGlyph(g: Grid) {
  // Monitor shell, then the lit top/left edge — one value apart, no bevel.
  rect(g, 4, 5, 27, 22, BEZEL)
  rect(g, 4, 5, 27, 5, BEZEL_LIT)
  rect(g, 4, 5, 4, 22, BEZEL_LIT)

  // The screen it houses.
  rect(g, 6, 7, 25, 20, SCREEN)

  // Three bars, each taller than the last: the only chart the game draws.
  // Bright cap on top of each, because a phosphor line is brightest where the
  // beam turns around.
  const bars: [x0: number, x1: number, top: number][] = [
    [8, 11, 15],
    [13, 16, 12],
    [18, 21, 9],
  ]
  for (const [x0, x1, top] of bars) {
    rect(g, x0, top, x1, 20, BAR)
    rect(g, x0, top, x1, top, BAR_CAP)
  }
  // The next bar, off the top of the screen — the joke and the genre in 3px.
  rect(g, 23, 7, 25, 20, BAR_CAP)

  // Stand and base.
  rect(g, 14, 23, 17, 25, BEZEL)
  rect(g, 10, 26, 21, 27, BEZEL_LIT)
}

/** Grid -> raw RGBA at 1px per cell. `bg === null` leaves the field clear. */
function raster(g: Grid, bg: string | null): Buffer {
  const buf = Buffer.alloc(G * G * 4)
  const bgRgb = bg ? hexToRgb(bg) : null
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      const hex = g[y][x]
      const i = (y * G + x) * 4
      const rgb = hex ? hexToRgb(hex) : bgRgb
      if (!rgb) continue // transparent
      buf[i] = rgb[0]
      buf[i + 1] = rgb[1]
      buf[i + 2] = rgb[2]
      buf[i + 3] = 255
    }
  }
  return buf
}

function png(rgba: Buffer, size: number) {
  return sharp(rgba, { raw: { width: G, height: G, channels: 4 } })
    .resize(size, size, { kernel: 'nearest' })
    .png()
}

async function write(path: string, rgba: Buffer, size: number) {
  await mkdir(dirname(path), { recursive: true })
  await png(rgba, size).toFile(path)
  console.log(`  ${path.slice(ROOT.length + 1).replace(/\\/g, '/')}  ${size}px`)
}

/**
 * Android's five densities. `ic_launcher_foreground` is deliberately larger
 * than the icon it sits in — the adaptive canvas is 108dp against the 48dp
 * legacy icon, which is where the 2.25x comes from.
 */
const DENSITIES: [dir: string, legacy: number, foreground: number][] = [
  ['mipmap-mdpi', 48, 108],
  ['mipmap-hdpi', 72, 162],
  ['mipmap-xhdpi', 96, 216],
  ['mipmap-xxhdpi', 144, 324],
  ['mipmap-xxxhdpi', 192, 432],
]

async function main() {
  const grid = blank()
  drawGlyph(grid)

  const opaque = raster(grid, BG)
  // The adaptive foreground rides on top of the `<background>` colour, so
  // baking the background into it as well would just paint the safe zone twice
  // and defeat the mask.
  const cutout = raster(grid, null)

  console.log('Launcher icon (temporary) — 32x32 grid, nearest-neighbour only\n')

  console.log('Android:')
  for (const [dir, legacy, foreground] of DENSITIES) {
    await write(join(RES, dir, 'ic_launcher.png'), opaque, legacy)
    // Round is the same square art: Android masks it, and a separately drawn
    // round variant is a second thing to keep in sync for no visible gain.
    await write(join(RES, dir, 'ic_launcher_round.png'), opaque, legacy)
    await write(join(RES, dir, 'ic_launcher_foreground.png'), cutout, foreground)
  }

  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BG}</color>
</resources>
`
  const bgPath = join(RES, 'values/ic_launcher_background.xml')
  await writeFile(bgPath, bgXml)
  console.log(`  ${bgPath.slice(ROOT.length + 1).replace(/\\/g, '/')}  ${BG}`)

  console.log('\nWeb:')
  // 32 tab favicon, 180 iOS home screen, 192/512 the two sizes a PWA manifest
  // is required to carry.
  for (const size of [32, 180, 192, 512]) {
    await write(join(PUBLIC, `icon-${size}.png`), opaque, size)
  }

  console.log('\n✓ Icon written. This is a placeholder — replace before store submission.')
}

await main()
