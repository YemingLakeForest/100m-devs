/**
 * Shared helpers for the art build step (ART_DIRECTION §5).
 *
 * Note on ImageMagick. ART_DIRECTION §5 specifies `magick -remap`. This
 * implementation uses sharp instead, for two reasons: sharp is already a house
 * dependency (mind-the-gap ships it), and it removes a `PATH` prerequisite from
 * CI, where a missing binary would silently skip the gate rather than fail it.
 * The behaviour is the same operation — nearest colour in the master palette,
 * no dithering, since dithering invents intermediate colours.
 */
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { hexToRgb } from '../src/art/palette.ts'

export const ASSETS_DIR = path.join(import.meta.dirname, '..', 'assets')
export const PALETTE_PNG = path.join(ASSETS_DIR, 'palette', 'master.png')

/**
 * Directories under assets/ that the gate does NOT police.
 *
 * `concept/` is reference material — mood boards and sketches, the legitimate
 * use of generation per ART_DIRECTION §10. It never ships, so holding it to the
 * palette would be enforcing the system against the one place the system is
 * deliberately not in force. `palette/` is the reference itself.
 */
export const UNPOLICED = new Set(['concept', 'palette'])

export type Rgb = [number, number, number]

/** Read the master palette back out of the generated PNG — the gate's authority. */
export async function loadPaletteFromPng(): Promise<Rgb[]> {
  const { data, info } = await sharp(PALETTE_PNG)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const out: Rgb[] = []
  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * info.channels
    out.push([data[o], data[o + 1], data[o + 2]])
  }
  return out
}

/** Every .png under assets/, minus the unpoliced trees. Repo-relative paths. */
export async function listPolicedAssets(): Promise<string[]> {
  const out: string[] = []

  async function walk(dir: string, depth: number) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (depth === 0 && UNPOLICED.has(entry.name)) continue
        await walk(path.join(dir, entry.name), depth + 1)
      } else if (entry.name.toLowerCase().endsWith('.png')) {
        out.push(path.join(dir, entry.name))
      }
    }
  }

  await walk(ASSETS_DIR, 0)
  return out.sort()
}

export function rel(file: string): string {
  return path.relative(path.join(import.meta.dirname, '..'), file).replaceAll('\\', '/')
}

/** Product source — where player-facing strings live. Excludes tests. */
export const SRC_DIR = path.join(import.meta.dirname, '..', 'src')

/**
 * Every shipped `.ts`/`.tsx` under `src/`, for the ART_DIRECTION §3.1 emoji
 * gate. Tests are excluded deliberately: a test asserting that an emoji is
 * absent has to be able to name the emoji.
 */
export async function listSourceFiles(): Promise<string[]> {
  const out: string[] = []

  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(full)
      }
    }
  }

  await walk(SRC_DIR)
  return out.sort()
}

/**
 * Nearest palette entry by squared distance in sRGB.
 *
 * Perceptual distance (CIELAB) would be the better metric in general, but the
 * master palette is small and its ramps are widely separated, so plain sRGB
 * picks the same entry and stays trivially inspectable.
 */
export function nearest(palette: Rgb[], r: number, g: number, b: number): Rgb {
  let best = palette[0]
  let bestD = Infinity
  for (const c of palette) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}

export { hexToRgb }
