/**
 * The launcher, web and store icons — every size, from one source.
 *
 *   npm run art:icon                                  # from the 32x32 grid below
 *   npm run art:icon -- --from store/icon-master-512.png   # from real art
 *
 * **The second form is the live one.** `store/icon-master-512.png` is the
 * shipping icon: a CRT with a floor of developers inside it, remapped to the
 * §2.2 master palette so it agrees with everything else in the product. The
 * grid below is kept as the fallback that needs no art to exist.
 *
 * It is a *script* and not fifteen hand-exported PNGs on purpose: a
 * hand-exported icon has no source, so nobody can tell which of the files in
 * `android/app/src/main/res` were regenerated and which are stale leftovers.
 * Everything this writes is reproducible from one input, and deleting the
 * outputs costs one command.
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
/**
 * Store listing art. **Not shipped inside the app** — this is uploaded to the
 * Play Console by hand, which is exactly why it needs a home in the repo and a
 * generator: an icon that only exists in a browser upload form has no source.
 */
const STORE = join(ROOT, 'store')

/**
 * Google Play's listing icon — the one hard external requirement in this file.
 *
 * | Rule | Value |
 * |---|---|
 * | Size | **exactly 512 x 512** |
 * | Format | 32-bit PNG |
 * | Weight | under 1 MB |
 * | Corners | **square, full bleed** |
 * | Shadow | none |
 *
 * The last two are the ones that get baked in by mistake. **Play applies its
 * own rounded-corner mask and its own drop shadow**, so art that arrives with
 * either already drawn on gets it twice — a second corner radius inside the
 * first, and a shadow that clips at the mask edge. It has to be a plain opaque
 * square; the launcher does the rounding.
 *
 * Enforced in `art-check.ts` rather than trusted, because it is a number that
 * is checked once at submission and then never again until it fails one.
 */
export const PLAY_ICON_PX = 512
export const PLAY_ICON_MAX_BYTES = 1024 * 1024

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

  console.log('\nGoogle Play listing:')
  // 32 x 16 = 512 exactly, so the store icon is the grid at a clean sixteen
  // times and every edge stays on the pixel lattice. Full-bleed and square by
  // construction — see PLAY_ICON_PX for why baking corners here would be wrong.
  await write(join(STORE, 'play-store-icon-512.png'), opaque, PLAY_ICON_PX)

  console.log('\n✓ Icon written. This is a placeholder — replace before store submission.')
}

/**
 * Build every size from an **existing 512 x 512 master** instead of the grid.
 *
 *   npm run art:icon -- --from path/to/icon-512.png
 *
 * The route for art that was drawn or generated elsewhere. Play's listing icon
 * is the largest thing anybody makes, so it is the natural master and
 * everything else is a reduction of it — which is the one ordering that cannot
 * produce a store icon that disagrees with the launcher icon.
 *
 * **Every resize is nearest-neighbour**, including the downscales. A smooth
 * kernel would average neighbouring pixels into new in-between colours, and
 * ART_DIRECTION §3 rule 1 names anti-aliased edges as "the single most common
 * cohesion failure" — a 48 px launcher icon full of colours that are in no ramp
 * is that failure, arriving through the build rather than through the art.
 *
 * The cost is honest and worth stating: 512 does not divide evenly into 48, 72
 * or 180, so those reductions duplicate rows unevenly and the glyph will shimmer
 * slightly against the grid. **Art authored on a 32 or 64 grid survives this;
 * art with fine detail does not**, which is a fact about the art rather than
 * about the resampler.
 */
async function fromMaster(src: string) {
  const image = sharp(src)
  const meta = await image.metadata()

  if (meta.width !== PLAY_ICON_PX || meta.height !== PLAY_ICON_PX) {
    throw new Error(
      `master must be exactly ${PLAY_ICON_PX}x${PLAY_ICON_PX} (Google Play's listing size, ` +
        `and the largest asset anything else is reduced from) — got ${meta.width}x${meta.height}`,
    )
  }

  const master = await image.png().toBuffer()

  /**
   * How far the artwork has to shrink to survive a **circular** launcher mask.
   *
   * This is the one piece of adaptive-icon arithmetic that is easy to get wrong,
   * and getting it wrong is invisible until the icon is on a home screen. The
   * safe zone is a 72dp *circle* inside a 108dp canvas — not a 72dp square. So
   * the measurement that matters is the artwork's **diagonal**, not its width:
   * a 65dp-wide picture has corners 93dp apart, and a circle of 72 clips them.
   *
   * Measured off the master rather than hardcoded, so replacing the art cannot
   * silently break the fit. Clamped at 1 — art that already fits is left alone.
   */
  const { data, info } = await sharp(master).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const field = [data[0], data[1], data[2]]
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const o = (y * info.width + x) * info.channels
      if (
        Math.abs(data[o] - field[0]) < 6 &&
        Math.abs(data[o + 1] - field[1]) < 6 &&
        Math.abs(data[o + 2] - field[2]) < 6
      ) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const artW = maxX - minX + 1
  const artH = maxY - minY + 1
  const diagonal = Math.hypot(artW, artH) / info.width
  // 4% off the theoretical maximum. Solving the fit exactly puts the artwork's
  // corners *on* the safe circle, where per-density rounding then pushes them a
  // pixel or two outside it — measured at +1.7px on the 432 canvas. A margin is
  // cheaper than a launcher-specific rounding argument, and no eye can tell 96%
  // of the safe zone from 100% of it.
  const fit = Math.min(1, (72 / 108 / diagonal) * 0.96)
  console.log(
    `art ${artW}x${artH} of ${info.width} — diagonal ${(diagonal * 100).toFixed(1)}% of the canvas, ` +
      `foreground scaled to ${(fit * 100).toFixed(1)}% so a round mask cannot clip it\n`,
  )

  const emit = async (path: string, size: number, adaptive = false) => {
    await mkdir(dirname(path), { recursive: true })

    if (!adaptive) {
      await sharp(master)
        .resize({ width: size, height: size, kernel: 'nearest' })
        .png({ compressionLevel: 9 })
        .toFile(path)
    } else {
      // Centred on a transparent canvas. The launcher paints
      // `ic_launcher_background` underneath, and the master's own field is that
      // same colour, so the inset square is invisible rather than a tile.
      const art = Math.round(size * fit)
      const scaled = await sharp(master).resize({ width: art, height: art, kernel: 'nearest' }).toBuffer()
      await sharp({
        create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: scaled, gravity: 'centre' }])
        .png({ compressionLevel: 9 })
        .toFile(path)
    }

    console.log(`  ${path.slice(ROOT.length + 1).replace(/\\/g, '/')}  ${size}px`)
  }

  console.log(`Icon from master — ${rel(src)}, nearest-neighbour only\n`)

  console.log('Android:')
  for (const [dir, legacy, foreground] of DENSITIES) {
    await emit(join(RES, dir, 'ic_launcher.png'), legacy)
    await emit(join(RES, dir, 'ic_launcher_round.png'), legacy)
    // Inset by the measured fit above — see the note on `fit`. Getting this
    // wrong does not fail a build, it ships an icon with its corners sliced off
    // on every phone whose launcher uses a round mask.
    await emit(join(RES, dir, 'ic_launcher_foreground.png'), foreground, true)
  }

  console.log('\nWeb:')
  for (const size of [32, 180, 192, 512]) await emit(join(PUBLIC, `icon-${size}.png`), size)

  console.log('\nGoogle Play listing:')
  await emit(join(STORE, 'play-store-icon-512.png'), PLAY_ICON_PX)

  console.log('\n✓ Icon written from master.')
}

function rel(p: string): string {
  return p.startsWith(ROOT) ? p.slice(ROOT.length + 1).replace(/\\/g, '/') : p
}

// `--from <master.png>` builds every size by reducing an existing 512 master;
// with no argument the temporary grid above is the source.
const fromArg = process.argv.indexOf('--from')
if (fromArg !== -1) {
  const src = process.argv[fromArg + 1]
  if (!src) throw new Error('--from needs a path to a 512x512 PNG')
  await fromMaster(src)
} else {
  await main()
}
