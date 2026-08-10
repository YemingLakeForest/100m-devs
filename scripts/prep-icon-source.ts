/**
 * Turn a generated image into the shipping icon master — ART_DIRECTION §5.
 *
 *   npm run art:icon-prep
 *
 * `store/icon-source.png` is what came out of an image model: 2048 x 2048, a
 * CRT with a floor of developers inside it. This produces
 * `store/icon-master-512.png`, which `build-icon.ts --from` then fans out into
 * every launcher, web and store size.
 *
 * **It exists as a script for the same reason `build-icon.ts` does.** A master
 * hand-edited in an image editor has no source, so the next person cannot tell
 * what was done to it, cannot redo it when a better generation arrives, and
 * cannot check whether the file on disk is the one the steps below produce. Six
 * commands in a chat window are not a pipeline.
 *
 * Five things are wrong with a generated icon and all five are fixed here:
 *
 * 1. **The corners are white pixels.** The model matted the art onto white and
 *    rounded it. Google Play masks and shadows the icon itself, so shipping
 *    pre-rounded art applies the radius twice — see `PLAY_ICON_PX`. Measured:
 *    100% of the near-white pixels in the source are inside the corner boxes,
 *    which is what makes repainting them safe rather than a guess.
 * 2. **The model signed it.** A sparkle sits at x 1760..1855, y 1760..1855 —
 *    alone on flat field, with no artwork within 150px of it.
 * 3. **The "flat" field is not flat.** There is a soft vignette across it,
 *    which is why painting a single colour over the signature left a visible
 *    square. Every field pixel is snapped to one value, which fixes the patch
 *    and the vignette together.
 * 4. **It is not actually pixel art.** 8,698 unique colours, anti-aliased
 *    throughout — §3 rule 1 names that as "the single most common cohesion
 *    failure". The downscale averages it and the quantiser snaps it.
 * 5. **The ramps are coarser than the gradients.** Snapping a smooth bezel
 *    straight to the palette alternates between two neighbours and reads as
 *    dither. A median pass collapses each region to its dominant value first,
 *    which is the difference between a flat bezel and a speckled one.
 */

import sharp from 'sharp'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { loadPaletteFromPng, nearest } from './art-lib.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'store/icon-source.png')
const OUT = join(ROOT, 'store/icon-master-512.png')

/** NEUTRAL[0] — the colour `capacitor.config` and `ic_launcher_background.xml` paint. */
const FIELD: [number, number, number] = [0x14, 0x12, 0x1a]

/**
 * How far into each corner the white matte reaches. Measured at 149px; the
 * margin covers the arc's soft edge. The artwork's bounding box is x 410..1637,
 * so these boxes cannot touch it.
 */
const CORNER = 175

/** The signature's measured box, plus margin. Nothing else is drawn near it. */
const MARK = { x0: 1760 - 24, y0: 1760 - 24, x1: 1855 + 24, y1: 1855 + 24 }

/** Anything darker than this on any channel is field rather than art. */
const FIELD_CEIL: [number, number, number] = [46, 44, 56]

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: C } = info
const buf = Buffer.from(data)

if (W !== 2048 || H !== 2048) {
  throw new Error(`expected a 2048x2048 source, got ${W}x${H} — the constants above are measured against it`)
}

const paint = (i: number, rgb: readonly [number, number, number]) => {
  buf[i] = rgb[0]
  buf[i + 1] = rgb[1]
  buf[i + 2] = rgb[2]
  buf[i + 3] = 255
}

let corners = 0
let signature = 0
let field = 0

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C
    const r = buf[i]
    const g = buf[i + 1]
    const b = buf[i + 2]

    const inCorner = (x < CORNER || x >= W - CORNER) && (y < CORNER || y >= H - CORNER)
    const inMark = x >= MARK.x0 && x <= MARK.x1 && y >= MARK.y0 && y <= MARK.y1

    if (inCorner && (r > 60 || g > 60 || b > 60)) {
      paint(i, FIELD)
      corners++
    } else if (inMark) {
      paint(i, FIELD)
      signature++
    } else if (r < FIELD_CEIL[0] && g < FIELD_CEIL[1] && b < FIELD_CEIL[2]) {
      // The vignette. Snapped so the field is one colour everywhere, which is
      // also what makes the two repaints above invisible rather than patches.
      paint(i, FIELD)
      field++
    }
  }
}

console.log(`corner matte repainted:  ${corners.toLocaleString()} px`)
console.log(`signature repainted:     ${signature.toLocaleString()} px`)
console.log(`field flattened:         ${field.toLocaleString()} px`)

// Down to 512 with an averaging kernel — which is correct here precisely
// *because* the source is not on a pixel grid: averaging is what turns its
// anti-aliasing into flat blocks. Then median, then the palette.
const small = await sharp(buf, { raw: { width: W, height: H, channels: C } })
  .resize(512, 512, { kernel: 'lanczos3' })
  .median(3)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const palette = await loadPaletteFromPng()
const out = Buffer.from(small.data)
for (let p = 0; p < small.info.width * small.info.height; p++) {
  const o = p * small.info.channels
  const [r, g, b] = nearest(palette, out[o], out[o + 1], out[o + 2])
  out[o] = r
  out[o + 1] = g
  out[o + 2] = b
  out[o + 3] = 255
}

await sharp(out, { raw: { width: 512, height: 512, channels: small.info.channels } })
  .png({ compressionLevel: 9 })
  .toFile(OUT)

const seen = new Set<number>()
for (let p = 0; p < 512 * 512; p++) {
  const o = p * small.info.channels
  seen.add((out[o] << 16) | (out[o + 1] << 8) | out[o + 2])
}

console.log(`\n✓ store/icon-master-512.png — 512x512, ${seen.size} palette colours, opaque square`)
console.log('  next: npm run art:icon -- --from store/icon-master-512.png')
