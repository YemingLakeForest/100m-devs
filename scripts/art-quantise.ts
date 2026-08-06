/**
 * Remap images to the master palette — ART_DIRECTION §5.
 *
 * This is what makes sourcing T3 commodity art safe: the origin of an asset
 * becomes irrelevant to whether it belongs, because everything is remapped
 * before it enters assets/. No dithering — dithering invents intermediate
 * colours, which is the exact failure the palette exists to prevent.
 *
 *   npm run art:quantise -- <file.png> [more.png ...]   # in place
 *   npm run art:quantise -- in.png --out out.png
 */
import sharp from 'sharp'
import { loadPaletteFromPng, nearest, rel } from './art-lib.ts'

const argv = process.argv.slice(2)
const outIdx = argv.indexOf('--out')
const explicitOut = outIdx === -1 ? null : argv[outIdx + 1]
const inputs = (outIdx === -1 ? argv : argv.slice(0, outIdx)).filter((a) => !a.startsWith('-'))

if (inputs.length === 0) {
  console.error('usage: npm run art:quantise -- <file.png> [...] [--out out.png]')
  process.exit(2)
}
if (explicitOut && inputs.length > 1) {
  console.error('--out takes a single input file.')
  process.exit(2)
}

const palette = await loadPaletteFromPng()

for (const input of inputs) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  let changed = 0
  let flattened = 0

  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * 4
    const a = data[o + 3]
    if (a === 0) continue

    // Anti-aliased edges are snapped to fully opaque before remapping: a
    // half-transparent edge pixel is a soft edge, and soft edges are what
    // ART_DIRECTION §7 rejects. Snapping here means the gate passes for the
    // right reason rather than being worked around.
    if (a !== 255) {
      data[o + 3] = a >= 128 ? 255 : 0
      flattened++
      if (data[o + 3] === 0) continue
    }

    const [r, g, b] = nearest(palette, data[o], data[o + 1], data[o + 2])
    if (r !== data[o] || g !== data[o + 1] || b !== data[o + 2]) changed++
    data[o] = r
    data[o + 1] = g
    data[o + 2] = b
  }

  const out = explicitOut ?? input
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(out)

  console.log(
    `${rel(input)} -> ${rel(out)}  ${info.width}x${info.height}, ` +
      `${changed} px remapped, ${flattened} soft edge px hardened`,
  )
}
