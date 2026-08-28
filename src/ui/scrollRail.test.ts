import { describe, expect, it } from 'vitest'
import { MIN_THUMB, railGeometry } from './scrollRail.ts'

describe('§10.6a rule 3 — the rail says whether there is more below', () => {
  it('is absent on a window whose content fits', () => {
    const rail = railGeometry(0, 300, 300)
    expect(rail.overflow).toBe(false)
    expect(rail.more).toBe(false)
  })

  it('lights the arrow the moment anything is below the fold', () => {
    const rail = railGeometry(0, 300, 900)
    expect(rail.overflow).toBe(true)
    expect(rail.more).toBe(true)
    expect(rail.less).toBe(false)
  })

  it('puts the arrow out once the body is at its end', () => {
    const rail = railGeometry(600, 300, 900)
    expect(rail.more).toBe(false)
    expect(rail.less).toBe(true)
  })

  it('forgives a sub-pixel at the bottom', () => {
    // A fractional device pixel ratio lands the true bottom a fraction short of
    // `scrollHeight`, and an exact comparison leaves the arrow lit on a window
    // that has been read to the end.
    expect(railGeometry(599.6, 300, 900).more).toBe(false)
  })
})

describe('the thumb', () => {
  it('is as long a share of the track as the fold is of the content', () => {
    const rail = railGeometry(0, 300, 900)
    expect(rail.size).toBeCloseTo(1 / 3, 5)
  })

  it('never shrinks to a speck on a long career', () => {
    // A gallery of two hundred releases makes the true ratio a rounding error,
    // and a two-pixel thumb reads as dirt on the glass rather than a control.
    const rail = railGeometry(0, 300, 60_000)
    expect(rail.size).toBe(MIN_THUMB)
  })

  it('ends flush with the track, not past it', () => {
    // The clamp above is what makes this the interesting case: the thumb is
    // longer than its share, so laying it out against the whole track rather
    // than against the room it leaves would hang it out of the window.
    const rail = railGeometry(59_700, 300, 60_000)
    expect(rail.top + rail.size).toBeCloseTo(1, 5)
  })

  it('starts at the top of the track at rest', () => {
    expect(railGeometry(0, 300, 900).top).toBe(0)
  })

  it('takes an overscrolled position back to the end rather than past it', () => {
    // Momentum scrolling on a WebView reports a `scrollTop` past the maximum
    // for a few frames at the end of a fling.
    const rail = railGeometry(9_999, 300, 900)
    expect(rail.top + rail.size).toBeCloseTo(1, 5)
  })
})

describe('degenerate measurements', () => {
  it('draws no rail on a body that has not been laid out yet', () => {
    // The first measure happens before the browser has given the window a
    // height, and a rail on a zero-height body is a rail on nothing.
    expect(railGeometry(0, 0, 0).overflow).toBe(false)
    expect(railGeometry(0, 0, 900).overflow).toBe(false)
  })
})
