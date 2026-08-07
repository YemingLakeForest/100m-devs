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
import { listPolicedAssets, loadPaletteFromPng, rel } from './art-lib.ts'

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
