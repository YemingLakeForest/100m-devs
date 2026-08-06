/**
 * Emit assets/palette/master.png and master.gpl from src/art/palette.ts.
 *
 * ART_DIRECTION §2.2 requires both forms: the .gpl is what Aseprite loads to
 * lock authoring to the palette, the .png is what the quantiser and the
 * art:check gate read. Generating both from one source is what stops them
 * drifting apart.
 *
 *   npm run art:build-palette
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { MASTER_PALETTE, RAMPS, hexToRgb } from '../src/art/palette.ts'

const OUT_DIR = path.join(import.meta.dirname, '..', 'assets', 'palette')

/** A 1px-per-colour strip, exactly as ART_DIRECTION §2.2 specifies. */
async function writePng() {
  const raw = Buffer.alloc(MASTER_PALETTE.length * 3)
  MASTER_PALETTE.forEach((hex, i) => {
    const [r, g, b] = hexToRgb(hex)
    raw[i * 3] = r
    raw[i * 3 + 1] = g
    raw[i * 3 + 2] = b
  })

  await sharp(raw, { raw: { width: MASTER_PALETTE.length, height: 1, channels: 3 } })
    // No palette/quantisation pass of sharp's own — the strip must contain
    // these exact bytes, since it is the reference every other asset is
    // measured against.
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(OUT_DIR, 'master.png'))
}

/** GIMP palette format — what Aseprite imports. */
async function writeGpl() {
  const lines = ['GIMP Palette', 'Name: 100M Developers — Master', 'Columns: 9', '#']

  for (const [ramp, colours] of Object.entries(RAMPS)) {
    lines.push(`# ${ramp}`)
    colours.forEach((hex, i) => {
      const [r, g, b] = hexToRgb(hex)
      const pad = (n: number) => String(n).padStart(3, ' ')
      lines.push(`${pad(r)} ${pad(g)} ${pad(b)}\t${ramp}_${i}`)
    })
  }

  await writeFile(path.join(OUT_DIR, 'master.gpl'), lines.join('\n') + '\n', 'utf8')
}

await mkdir(OUT_DIR, { recursive: true })
await Promise.all([writePng(), writeGpl()])
console.log(`Wrote master.png + master.gpl — ${MASTER_PALETTE.length} colours.`)
