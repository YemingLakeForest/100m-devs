import { describe, expect, it } from 'vitest'
import { MAX_STREAMS, assignStreams, hotSegments, numeralSize, popScale } from './juice.ts'

/*
 * Tests pin the claim, not the value (CLAUDE.md, house style). The claims here are the ones the
 * 1 Million Books study (docs/PLAN-2026-10-11-juice-layer.md) turned into rules: a numeral tells
 * the truth about its size, an effect arrives in hard steps and settles, and the numerals on
 * screen add up to the work being done however many people are doing it.
 */

describe('numeral size follows magnitude, in whole steps', () => {
  const sps = [0.2, 1, 9, 10, 99, 100, 999, 1_000, 99_999, 1e6, 1e9, 1e15]

  it('never shrinks as the yield grows', () => {
    const sizes = sps.map((sp) => numeralSize(sp, 14))
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1])
  })

  it('leaves an ordinary single point at exactly its base size', () => {
    expect(numeralSize(1, 14)).toBe(14)
    expect(numeralSize(1, 20)).toBe(20)
    expect(numeralSize(0.4, 20)).toBe(20)
  })

  it('moves in whole even pixels and stops growing, so a huge yield cannot cover the room', () => {
    for (const sp of sps) {
      const grown = numeralSize(sp, 14) - 14
      expect(Number.isInteger(grown)).toBe(true)
      expect(grown % 2).toBe(0)
      expect(grown).toBeLessThanOrEqual(6)
    }
    expect(numeralSize(1e15, 14)).toBeGreaterThan(numeralSize(10, 14))
  })

  it('sizes a loss by what it cost, not by its sign', () => {
    expect(numeralSize(-5_000, 20)).toBe(numeralSize(5_000, 20))
  })
})

describe('the pop is a hard-stepped arrival that settles to exactly 1', () => {
  it('arrives small, overshoots, then rests — in that order', () => {
    expect(popScale(0)).toBeLessThan(1)
    expect(popScale(80)).toBeGreaterThan(1)
    expect(popScale(160)).toBe(1)
    expect(popScale(5_000)).toBe(1)
  })

  it('is stepped rather than eased: only three distinct sizes ever appear', () => {
    const seen = new Set<number>()
    for (let t = 0; t <= 400; t += 4) seen.add(popScale(t))
    expect(seen.size).toBe(3)
  })

  it('does nothing at all under reduced motion', () => {
    for (let t = 0; t <= 400; t += 20) expect(popScale(t, true)).toBe(1)
  })
})

describe('streams keep the numerals honest at any headcount', () => {
  const crowd = (n: number, rate = 1) => Array.from({ length: n }, (_, seat) => ({ seat, rate }))
  const total = (xs: { rate: number }[]) => xs.reduce((a, b) => a + b.rate, 0)

  it('never makes more streams than the screen can carry', () => {
    for (const n of [0, 1, 5, MAX_STREAMS, MAX_STREAMS + 1, 100, 5_000]) {
      expect(assignStreams(crowd(n)).length).toBeLessThanOrEqual(MAX_STREAMS)
    }
  })

  it('carries every worker exactly once and loses none of their output', () => {
    for (const n of [1, 7, 12, 13, 100, 999]) {
      const people = crowd(n, 0.37)
      const streams = assignStreams(people)
      expect(total(streams)).toBeCloseTo(total(people), 9)
      const members = streams.flatMap((s) => s.members).sort((a, b) => a - b)
      expect(members).toEqual(people.map((p) => p.seat))
    }
  })

  it('gives each person their own stream while there is room, so a small studio looks the same as before', () => {
    const streams = assignStreams(crowd(MAX_STREAMS))
    expect(streams).toHaveLength(MAX_STREAMS)
    expect(streams.every((s) => s.members.length === 1)).toBe(true)
  })

  it('does not care what order the camera listed people in', () => {
    const people = crowd(60, 2)
    const a = assignStreams(people).map((s) => [s.key, [...s.members].sort((x, y) => x - y)])
    const b = assignStreams([...people].reverse()).map((s) => [s.key, [...s.members].sort((x, y) => x - y)])
    expect(b.sort()).toEqual(a.sort())
  })

  it('keeps a worker in the same stream when the crowd around them changes, so panning does not reshuffle credit', () => {
    const keyOf = (people: { seat: number; rate: number }[], seat: number) =>
      assignStreams(people).find((s) => s.members.includes(seat))?.key
    expect(keyOf(crowd(40), 17)).toBe(keyOf(crowd(90), 17))
  })

  it('stands anonymous seats (James, the founder) on their own feet', () => {
    const streams = assignStreams([{ seat: -2, rate: 1 }, { seat: -1, rate: 1 }])
    expect(streams.map((s) => s.members).flat().sort((a, b) => a - b)).toEqual([-2, -1])
    expect(streams).toHaveLength(2)
  })
})

describe('hot segments: the newly lit part of a bar', () => {
  it('names exactly the segments that just came on', () => {
    expect(hotSegments(3, 5)).toEqual({ from: 3, to: 5 })
    expect(hotSegments(0, 1)).toEqual({ from: 0, to: 1 })
  })

  it('says nothing when the bar held still, drained, or reset', () => {
    expect(hotSegments(4, 4)).toBeNull()
    expect(hotSegments(5, 2)).toBeNull()
    expect(hotSegments(7, 0)).toBeNull()
  })
})
