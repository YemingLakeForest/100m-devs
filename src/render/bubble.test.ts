/**
 * Speech balloons — GDD §7.8.6, §8.3.
 *
 * Two of the three things pinned here are corrections to defects that shipped,
 * and both were invisible to every existing test because both are about whether
 * a human can *read* the result: the type was too small to make out, and one of
 * the two tones was near-black ink on near-black brown.
 *
 * `bubblePop`'s curve is `sim/ambient.test.ts`'s; this covers the drawing rules
 * that sit on top of it.
 */

import { describe, expect, it } from 'vitest'
import { hexToRgb, RAMPS } from '../art/palette.ts'
import { BUBBLE_FONT, BUBBLE_MIN_SCALE, bubblesLegible, counterScale } from './bubble.ts'

/** WCAG relative luminance, which is the only honest way to ask "can I read it". */
function luminance(hex: string): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('every tone is readable — the defect this file exists for', () => {
  /**
   * Fill and ink for each tone, mirroring `draw`. Restated here rather than
   * exported from it because the claim under test is about the *pair*, and a
   * test that imported the pairing could only ever agree with itself.
   */
  const TONES = {
    speech: { fill: RAMPS.NEUTRAL[7], ink: RAMPS.NEUTRAL[0] },
    warn: { fill: RAMPS.WARN[3], ink: RAMPS.NEUTRAL[0] },
    protest: { fill: RAMPS.ALARM[3], ink: RAMPS.NEUTRAL[0] },
  }

  it('puts enough contrast between the ink and the balloon to read the words', () => {
    // 4.5:1 is the body-text bar. These are short lines at a small size over a
    // busy floor, so anything below it is decoration rather than dialogue.
    for (const [name, { fill, ink }] of Object.entries(TONES)) {
      expect(contrast(fill, ink), name).toBeGreaterThan(4.5)
    }
  })

  it('no longer draws a balloon out of the bottom of a ramp', () => {
    // `warn` was `WARN[0]` — #2e1f08, the darkest brown there is — carrying
    // `NEUTRAL[0]` ink. That is 1.2:1: two near-blacks, one of them brown. It
    // was reported exactly as it looks.
    expect(contrast(RAMPS.WARN[0], RAMPS.NEUTRAL[0])).toBeLessThan(2)
    for (const [name, { fill }] of Object.entries(TONES)) {
      expect(fill, name).not.toBe(RAMPS.WARN[0])
    }
  })

  it('gives the struggle a tone of its own, away from ordinary chatter', () => {
    // §7.8.9 — being hoisted off the floor is not an interruption, it is an
    // emergency, and it must not read as somebody saying hello.
    expect(TONES.protest.fill).not.toBe(TONES.speech.fill)
    expect(TONES.protest.fill).not.toBe(TONES.warn.fill)
  })
})

describe('type size', () => {
  it('is big enough to read rather than sized against a sprite', () => {
    // The old value was 9, chosen to look proportionate over an 11 px face.
    // Proportionate to a sprite and legible to a person are different
    // requirements and the sprite is not the one reading it.
    expect(BUBBLE_FONT).toBeGreaterThan(9)
  })

  it('never draws words below the size at which they stop being words', () => {
    // The floor is expressed as a multiple of the authored size, so raising the
    // type raises the real-pixel floor with it rather than letting bubbles
    // linger, smaller, further out.
    expect(BUBBLE_FONT * BUBBLE_MIN_SCALE).toBeGreaterThan(7)
  })
})

describe('counterScale — a caption does not zoom', () => {
  it('holds a constant screen size as the camera pulls back', () => {
    // Text pinned to a world object stays legible rather than proportional —
    // the same reason a map label does not grow when you zoom in.
    expect(0.8 * counterScale(0.8)).toBeCloseTo(1, 6)
    expect(0.5 * counterScale(0.5)).toBeCloseTo(1, 6)
  })

  it('stops growing, so a bubble never becomes taller than the HUD', () => {
    expect(counterScale(0.0001)).toBeLessThanOrEqual(2.4)
  })

  it('gives up rather than drawing a smudge, once the camera is far enough out', () => {
    expect(bubblesLegible(1)).toBe(true)
    expect(bubblesLegible(0.5)).toBe(true)
    // Floor and Building: a person is two pixels and nobody is being quoted.
    expect(bubblesLegible(0.1)).toBe(false)
  })
})
