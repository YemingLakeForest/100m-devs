/**
 * The build gate — ART_DIRECTION §5.1.
 *
 * Fails the build when any policed asset:
 *   1. contains a colour absent from master.png;
 *   2. is not on the integer pixel grid, or carries anti-aliased (partial-alpha)
 *      edges — §7 forbids both;
 *   4. breaches the GDD §22.7 sprite-count cap.
 *
 * (3, light direction, is a manual review item and is reported as a reminder
 * rather than enforced — see ART_DIRECTION §7. It is the one box on the
 * checklist that a script cannot tick.)
 *
 *   npm run art:check
 */
import sharp from 'sharp'
import { MASTER_PALETTE, hexToRgb } from '../src/art/palette.ts'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { listPolicedAssets, listSourceFiles, loadPaletteFromPng, rel } from './art-lib.ts'

/** GDD §22.7 — hard cap. Breaching this needs a decision recorded in the GDD first. */
const SPRITE_CAPS = [
  { dir: 'assets/cards/portraits', cap: 12, what: 'character portraits' },
  { dir: 'assets/cards/frames', cap: 1, what: 'card frame' },
  { dir: 'assets/cards/james', cap: 7, what: 'James promotion variants' },
] as const

const failures: string[] = []

const palette = await loadPaletteFromPng()

/*
 * (0) The gate validates its own reference before it validates anything else.
 *
 * master.png is GENERATED from src/art/palette.ts, and every check below reads
 * the PNG. So if the palette is edited and `art:build-palette` is not re-run,
 * this script goes on cheerfully enforcing the old palette against the new
 * source of truth — passing assets it should reject and rejecting ones it
 * should pass, while reporting success. A gate measuring against a stale
 * reference is worse than no gate, because it is trusted.
 */
const expected = MASTER_PALETTE.map(hexToRgb)
const stale =
  expected.length !== palette.length ||
  expected.some(([r, g, b], i) => r !== palette[i][0] || g !== palette[i][1] || b !== palette[i][2])

if (stale) {
  console.error(
    'art:check FAILED — assets/palette/master.png is stale.\n\n' +
      `  master.png holds ${palette.length} colour(s); src/art/palette.ts defines ${expected.length}.\n` +
      '  Every check in this script reads the PNG, so it would be enforcing the\n' +
      '  old palette against the new source of truth.\n\n' +
      '  Fix: npm run art:build-palette   (then commit assets/palette/)',
  )
  process.exit(1)
}

const allowed = new Set(palette.map(([r, g, b]) => (r << 16) | (g << 8) | b))
const files = await listPolicedAssets()

for (const file of files) {
  const name = rel(file)
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  // (2) Integer grid. sharp reports integers, so a fractional source has
  // already been rounded by the time we see it — what this actually catches is
  // a zero dimension or a non-integer scale baked into the file header.
  if (!Number.isInteger(info.width) || !Number.isInteger(info.height) || info.width < 1 || info.height < 1) {
    failures.push(`${name}: not on the integer pixel grid (${info.width}x${info.height})`)
    continue
  }

  const offenders = new Map<number, number>()
  let partialAlpha = 0

  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * 4
    const a = data[o + 3]

    // Fully transparent pixels carry no colour worth policing.
    if (a === 0) continue
    // (2) Anti-aliasing shows up as alpha between the two extremes.
    if (a !== 255) {
      partialAlpha++
      continue
    }

    const key = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2]
    if (!allowed.has(key)) offenders.set(key, (offenders.get(key) ?? 0) + 1)
  }

  if (partialAlpha > 0) {
    failures.push(
      `${name}: ${partialAlpha} anti-aliased pixel(s) — partial alpha. ` +
        `Hard pixel edges only (ART_DIRECTION §7).`,
    )
  }

  if (offenders.size > 0) {
    const worst = [...offenders.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, n]) => `#${key.toString(16).padStart(6, '0')} (${n}px)`)
    const more = offenders.size > 5 ? `, +${offenders.size - 5} more` : ''
    failures.push(
      `${name}: ${offenders.size} colour(s) absent from master.png — ${worst.join(', ')}${more}. ` +
        `Run: npm run art:quantise ${name}`,
    )
  }
}

// (4) Sprite-count caps.
for (const { dir, cap, what } of SPRITE_CAPS) {
  const prefix = dir + '/'
  const n = files.filter((f) => rel(f).startsWith(prefix)).length
  if (n > cap) {
    failures.push(
      `${dir}: ${n} ${what}, cap is ${cap} (GDD §22.7). ` +
        `This is a scope decision — record it in the GDD before raising the cap.`,
    )
  }
}

/*
 * (5) No emoji in player-facing strings — ART_DIRECTION §3.1.
 *
 * An emoji is the one piece of "art" in the product that arrives at runtime
 * from the operating system's font: anti-aliased, outside the palette, a
 * different picture on every device, and invisible to every other check in this
 * file because it is not in an asset. So it is policed at the source, where it
 * actually lives.
 *
 * Scope is deliberately narrow — the *product*, not the project. Design
 * documents, engineering comments and this script's own console output are not
 * things a player sees, and a gate that fires on a tick in a Markdown table
 * would be turned off within a week.
 */
// U+FE0F, the emoji variation selector, is deliberately NOT in this class: it
// is a combining character, it only ever follows a base codepoint that is
// already matched here, and including it makes the class misleading (eslint
// no-misleading-character-class flags exactly that).
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{26A0}]/u

const stringLiterals = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g

for (const file of await listSourceFiles()) {
  const source = await readFile(file, 'utf8')
  const lines = source.split('\n')

  lines.forEach((line, i) => {
    // Comments are engineering notes, not product. This is a deliberately
    // simple test: a `//` anywhere before the match is treated as a comment,
    // which over-forgives a `//` inside a string and never under-forgives.
    const code = line.split('//')[0]
    for (const [, , body] of code.matchAll(stringLiterals)) {
      const found = body.match(EMOJI)
      if (found) {
        failures.push(
          `${rel(file)}:${i + 1}: emoji ${JSON.stringify(found[0])} in a player-facing string. ` +
            'ART_DIRECTION §3.1 — use a procedural pixel icon or bracketed text.',
        )
      }
    }
  })
}

/*
 * (5) Google Play's listing icon.
 *
 * Checked here rather than remembered, because it is a rule that is verified
 * once — at submission, by an upload form, months after the art was made — and
 * the failure mode is a rejected release rather than a wrong-looking picture.
 *
 * Three of the four rules are dimensions and weight. The fourth is the one that
 * is actually easy to get wrong: **the icon must be a plain opaque square.**
 * Play applies its own rounded-corner mask and its own drop shadow, so corners
 * or a shadow baked into the art get applied twice — a second radius inside the
 * first, and a shadow clipped at the mask edge. Transparent corner pixels are
 * the signature of exactly that mistake, so they are what this looks for.
 */
const PLAY_ICON = 'store/play-store-icon-512.png'
const playIcon = join(import.meta.dirname, '..', PLAY_ICON)

if (existsSync(playIcon)) {
  const meta = await sharp(playIcon).metadata()
  const bytes = (await stat(playIcon)).size

  if (meta.width !== 512 || meta.height !== 512) {
    failures.push(`${PLAY_ICON}: Google Play requires exactly 512x512 — got ${meta.width}x${meta.height}.`)
  }
  if (meta.format !== 'png') {
    failures.push(`${PLAY_ICON}: Google Play requires a 32-bit PNG — got ${meta.format}.`)
  }
  if (bytes > 1024 * 1024) {
    failures.push(`${PLAY_ICON}: ${(bytes / 1024 / 1024).toFixed(2)} MB exceeds Google Play's 1 MB limit.`)
  }

  // The corners, one pixel in from each edge. Any alpha below full means the
  // art has been pre-rounded or carries a baked shadow.
  const { data, info } = await sharp(playIcon)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3]
  const corners = [
    [1, 1],
    [info.width - 2, 1],
    [1, info.height - 2],
    [info.width - 2, info.height - 2],
  ] as const
  if (corners.some(([x, y]) => alphaAt(x, y) < 255)) {
    failures.push(
      `${PLAY_ICON}: has transparent corners. Play masks and shadows the icon itself, so the ` +
        'art must be a full-bleed opaque square — pre-rounding it applies the radius twice.',
    )
  }
}

const counted = files.length
if (failures.length > 0) {
  console.error(`art:check FAILED — ${failures.length} problem(s) across ${counted} asset(s):\n`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  console.error(
    '\nManual checklist items this script cannot tick (ART_DIRECTION §7):' +
      '\n  - light direction: single source, top-left' +
      '\n  - reads at target scale, on device' +
      '\n  - sits correctly beside two existing assets',
  )
  process.exit(1)
}

console.log(`art:check passed — ${counted} asset(s), ${palette.length}-colour master palette.`)
if (counted > 0) {
  console.log('Still owed by hand (ART_DIRECTION §7): light direction, on-device scale, in-context screenshot.')
}
