/*
 * Copied from the rebuild (100m-devs-three/src/art/palette.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * The colours the *renderer* draws with — bubbles, snippets, floating numbers.
 *
 * Not the scene's palette. Everything a sprite is made of is decided once in
 * Blender (`tools/blender/palette.py`) and baked into the atlas, which is the
 * whole argument of GDD §13.1: correct art is a property of the build rather
 * than a discipline. What is left over is the handful of things Pixi draws
 * live because they carry *text* — and text cannot be pre-rendered, because
 * the words are not known until the run.
 *
 * These are the light theme (§12.1) and they are deliberately the same values
 * as `ui/app.css`'s tokens: a speech bubble over a developer and the HUD panel
 * above them are the same material seen in two places, and if they drift the
 * scene gains a second design language nobody chose.
 *
 * The legacy build's ramps are the thing being replaced. They were nine steps
 * of near-black for a CRT scene, and §12.3's rule inverts on a light ground:
 * darkness is the reserved quantity, so a ramp runs from the ink outward
 * rather than from black upward.
 */

export type RampName =
  | 'NEUTRAL'
  | 'CALM'
  | 'WARN'
  | 'ALARM'
  | 'GLOW'
  | 'SKIN'
  | 'WOOD'
  | 'FOLIAGE'

/**
 * Each ramp is ordered dark to light, which is the order the legacy renderer
 * indexed them in — so ported code that reaches for `RAMPS.X[0]` still gets
 * the darkest step and means the same thing by it.
 */
export const RAMPS: Record<RampName, readonly string[]> = {
  /*
   * Ink to paper in nine steps, and nine is not decorative: `bubble.ts` reads
   * `NEUTRAL[7]` for a speech balloon's fill and `NEUTRAL[0]` for its ink, and
   * `bubble.test.ts` holds that pair to 4.5:1 — the body-text bar — because
   * these are short lines at a small size over a busy floor, and anything
   * below it is decoration rather than dialogue. Measured: 12.2:1.
   */
  NEUTRAL: [
    '#23201c',
    '#332e28',
    '#443d34',
    '#5d564c',
    '#756c5e',
    '#8c8272',
    '#b3a996',
    '#e6dfd0',
    '#fffdf8',
  ],
  /** The studio's blue — a poke landing, a thing going well. */
  CALM: ['#12456e', '#1e6eaf', '#4f97d1', '#a9cdea'],
  /*
   * Amber. `WARN[0]` is deliberately the bottom of the ramp and deliberately
   * never a fill: the legacy build drew a warning balloon in it against
   * `NEUTRAL[0]` ink, which measures 1.2:1 — two near-blacks, one of them
   * brown — and `bubble.test.ts` keeps a test that it stays unusable so the
   * mistake cannot be made twice.
   */
  WARN: ['#7a3712', '#b4531f', '#d98341', '#f0c08e'],
  /** The one loud red, spent only on failure — §12.2 reserves saturation. */
  ALARM: ['#6d2114', '#a8341f', '#cc6047', '#e8a08e'],
  /** A screen's own light, which is dull on a lit floor and never a highlight. */
  GLOW: ['#123c45', '#1f6b7a', '#4f9aa8'],
  /*
   * The three ramps the *character* art needs, which the room does not: the
   * founder's portrait on the setup card is drawn in CSS, not rendered in
   * Blender, so it needs skin, hair-wood and foliage as web colours. Kept here
   * rather than in a second file because §12.2's rule about one palette does
   * not stop applying just because the pixels arrive by a different route.
   */
  SKIN: ['#f4d3b4', '#e6b892', '#cf9a72', '#a9724d', '#7d4f34', '#54321f'],
  WOOD: ['#4a2f22', '#6b452c', '#96683f', '#c19366'],
  FOLIAGE: ['#2f4a2c', '#4d7a45', '#7aa86a'],
}

/**
 * **The text the world throws off** — §8.2's numeral, §8.2a's line of code.
 *
 * [added 2026-09-13] These were `RAMPS.CALM` on `RAMPS.NEUTRAL[0]`, ported
 * from the legacy build unchanged, and the port is the defect: that pairing is
 * a phosphor blue with a near-black outline, which is exactly right on a CRT
 * scene lit from inside and exactly wrong over §12.1's daylight garage. On the
 * current floor it read as a different game's HUD leaking into this one — the
 * only saturated blue anywhere in the picture, ringed in a black the room does
 * not otherwise contain.
 *
 * So the floaters now speak the room's own language, which is already written
 * down twice and was simply not being read here: `--terminal-ink` in
 * `tokens.css` for the machine's voice, and `INK.paper` for the halo every
 * other piece of world text (`worldScene`'s lift captions) already wears.
 *
 * The four inks keep the *distinctions* the legacy ramp made, re-pointed at
 * this palette:
 *
 * | Ink | What it means |
 * |---|---|
 * | `ink` | an ordinary poke landed — the quiet, constant one |
 * | `reward` | a crit. §12.2 reserves saturation, and this is what it is spent on |
 * | `bad` | a negative numeral: a Rogue Refactorer taking points back |
 * | `quiet` | `UNBLOCKED` — **nothing was earned, so it does not wear the reward colour** |
 *
 * That last row is a change of rule and worth the sentence: the legacy drew
 * `UNBLOCKED` in warning amber "because it is a different kind of event", and
 * with crits now amber that would have been two different events in one
 * colour. Quiet is also the truer reading — §4.7's Overwhelmed developer paid
 * nothing, and a message about nothing happening should not look like a prize.
 */
export const WORLD_TEXT = {
  /** `--terminal-ink` — the machine’s green, not the old teal. */
  ink: '#1F5137',
  /** `--ink-2`. */
  quiet: '#46595F',
  /** `--accent`. */
  reward: '#8C5C15',
  /** `--bad`. */
  bad: '#A33B32',
  /** `INK.paper` — the room's own paper, so the halo is a piece of the room. */
  halo: '#F3F0E8',
} as const

/** `#rrggbb` to `[r, g, b]`, 0-255 each. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** `[r, g, b]` -> `#rrggbb`, lowercase. */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
