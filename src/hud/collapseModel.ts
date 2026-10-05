/**
 * What the collapse plate draws — GDD §21 Act IV [added 2026-10-04].
 *
 * The first prestige exists to teach one sentence — *past what a studio can
 * coordinate, every hire makes it slower* — and it used to teach
 * it with a cliff the player could not see being walked. The Mass Hire now lands
 * in waves (`MASS_HIRE_WAVES`), and this is the picture of them: the studio's
 * output against its headcount, the curve §4.1 has always been, with a dot on it
 * that is the studio *right now*.
 *
 * Pure — no store, no renderer. Output is in **developer-equivalents**: how many
 * people's worth of work the studio is actually getting, which is `D · η` and is
 * the same number the speedometer is reading backwards.
 */

import { RHO, efficiency } from '../sim/entropy.ts'

/** Developer-equivalents of work a studio of `devs` gets at `cap`. */
export function workDone(devs: number, cap: number): number {
  return Math.max(0, devs) * efficiency(devs, cap)
}

/**
 * The headcount at which output peaks — `cap · (ρ − 1)^(−1/ρ)`, about 0.758 of
 * the cap. Derived rather than written down, for the reason `lessons.ts`
 * derives `OPTIMUM_LOAD`: ρ is the knob most likely to move.
 */
export function peakHeads(cap: number): number {
  return cap * (RHO - 1) ** (-1 / RHO)
}

/** Where the plate's x axis ends: the thousand the offer promised, with room. */
export const PLATE_MAX_HEADS = 1100

/**
 * Plate x for a headcount. Logarithmic, because the peak is at 76 and the end is
 * at a thousand: on a linear axis the whole of the rise is the first seven per
 * cent of the plate and the player sees a wall, not a hill.
 */
export function plateX(devs: number, width: number): number {
  const t = Math.log10(Math.max(1, devs)) / Math.log10(PLATE_MAX_HEADS)
  return Math.min(1, Math.max(0, t)) * width
}

/** Plate y for an output, against the peak, so the top of the hill touches the top. */
export function plateY(output: number, peakOutput: number, height: number): number {
  const t = peakOutput > 0 ? Math.min(1, Math.max(0, output / peakOutput)) : 0
  return height - t * height
}

/** The curve as an SVG path through `steps` points, for a studio of this cap. */
export function curvePath(cap: number, width: number, height: number, steps = 60): string {
  const peakOutput = workDone(peakHeads(cap), cap)
  const points: string[] = []
  for (let i = 0; i <= steps; i++) {
    const devs = Math.pow(PLATE_MAX_HEADS, i / steps)
    const x = plateX(devs, width)
    const y = plateY(workDone(devs, cap), peakOutput, height)
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return points.join(' ')
}

/** The plate's caption, from the studio's own numbers. */
export function plateCaption(devs: number, cap: number): { work: string; past: boolean } {
  const w = workDone(devs, cap)
  const work = w >= 10 ? w.toFixed(0) : w >= 0.1 ? w.toFixed(1) : w.toFixed(2)
  return { work, past: devs > peakHeads(cap) }
}

/**
 * What the next hire is actually worth, in developers' worth of work [2026-10-04].
 *
 * §4.1 is the whole game and, until the first Paradigm Shift, nothing on screen
 * said it: the hire button said what a hire *costs*, and the studio's sync
 * stayed at a round hundred per cent for the first sixty hires, so the player
 * had no way to feel that each one gave a little less than the last until the
 * speedometer finally moved. This is the same curve the collapse plate draws,
 * read at the studio's own headcount: one developer is `+1.00` at the start,
 * `+0.97` at fifty, and — past the peak — negative, which is the lesson itself
 * on the button that causes it.
 */
export function marginalHire(devs: number, cap: number, count = 1): { value: number; label: string; short: string } {
  const n = Math.max(1, Math.floor(count))
  const value = workDone(devs + n, cap) - workDone(devs, cap)
  const text = Math.abs(value) >= 100 ? Math.round(Math.abs(value)).toLocaleString('en-US') : Math.abs(value).toFixed(2)
  // `short` is what fits on the button's price line (the rail is 146 px wide and the
  // frame gate counts every row); `label` is what the tooltip and a screen reader say.
  return { value, label: value >= 0 ? `ADDS ${text}` : `LOSES ${text}`, short: value >= 0 ? `+${text}` : `−${text}` }
}
