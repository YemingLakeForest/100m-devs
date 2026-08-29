import { describe, expect, it } from 'vitest'
import { REVIEW_COUNT, reviewsFor, verdictFor } from './reviews.ts'
import { BASELINE_RATING } from './rating.ts'

describe('§10.8b — the reviews', () => {
  it('is deterministic in the seed and the ordinal', () => {
    // The §4.14 contract: a reload cannot reroll a review already read.
    expect(reviewsFor(1234, 3, 62)).toEqual(reviewsFor(1234, 3, 62))
    expect(reviewsFor(1234, 3, 62)).not.toEqual(reviewsFor(1234, 4, 62))
    expect(reviewsFor(1234, 3, 62)).not.toEqual(reviewsFor(9999, 3, 62))
  })

  it('never runs the same masthead or the same line twice on one release', () => {
    for (let ordinal = 0; ordinal < 40; ordinal++) {
      for (const rating of [4, 30, 55, 88]) {
        const reviews = reviewsFor(77, ordinal, rating)
        expect(reviews).toHaveLength(REVIEW_COUNT)
        expect(new Set(reviews.map((r) => r.outlet)).size).toBe(REVIEW_COUNT)
        expect(new Set(reviews.map((r) => r.quote)).size).toBe(REVIEW_COUNT)
      }
    }
  })

  it('keeps every score on the scale it claims to be on', () => {
    for (let ordinal = 0; ordinal < 60; ordinal++) {
      for (const rating of [0, 12, 50, 74, 100]) {
        for (const r of reviewsFor(5, ordinal, rating)) {
          expect(r.score).toBeGreaterThanOrEqual(0)
          expect(r.score).toBeLessThanOrEqual(10)
          expect(Number.isInteger(r.score)).toBe(true)
        }
      }
    }
  })

  /**
   * The critics *report* §4.14's number, they do not compute one. If the
   * aggregate and the press could disagree about which direction a release
   * went, the reel would be arguing with the gallery.
   */
  it('moves with the rating it is reporting', () => {
    const mean = (rating: number) => {
      let total = 0
      for (let ordinal = 0; ordinal < 200; ordinal++) {
        for (const r of reviewsFor(3, ordinal, rating)) total += r.score
      }
      return total / (200 * REVIEW_COUNT)
    }
    expect(mean(20)).toBeLessThan(mean(50))
    expect(mean(50)).toBeLessThan(mean(85))
  })

  it('has a word for every band, worst to best', () => {
    expect(verdictFor(5)).toBe('SHOVELWARE')
    expect(verdictFor(99)).toBe('MASTERPIECE')
    // A garage's release is neither, which is the whole of §4.14.1.
    expect(['MIXED', 'ACCLAIMED']).toContain(verdictFor(BASELINE_RATING))
  })
})
