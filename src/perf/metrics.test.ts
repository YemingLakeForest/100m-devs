import { describe, expect, it } from 'vitest'
import { FrameSampler, LatencySampler, Samples, formatReport, percentile } from './metrics.ts'

describe('percentile', () => {
  it('returns a value that was actually measured', () => {
    // Nearest-rank, so no interpolated number that never occurred is reported.
    const s = [10, 20, 30, 40]
    expect(s).toContain(percentile(s, 0.5))
    expect(s).toContain(percentile(s, 0.95))
  })

  it('is order-independent', () => {
    expect(percentile([5, 1, 4, 2, 3], 0.6)).toBe(percentile([1, 2, 3, 4, 5], 0.6))
  })

  it('handles the ends without running off the array', () => {
    const s = [1, 2, 3]
    expect(percentile(s, 0)).toBe(1)
    expect(percentile(s, 1)).toBe(3)
    expect(percentile(s, 2)).toBe(3)
    expect(percentile(s, -1)).toBe(1)
  })

  it('returns 0 for an empty sample set rather than NaN', () => {
    expect(percentile([], 0.95)).toBe(0)
  })
})

describe('Samples ring', () => {
  it('keeps only the most recent capacity values', () => {
    const s = new Samples(3)
    for (const v of [1, 2, 3, 4, 5]) s.push(v)
    expect(s.count).toBe(3)
    expect(s.values().sort()).toEqual([3, 4, 5])
  })

  it('reports mean and min over what it holds', () => {
    const s = new Samples(4)
    for (const v of [2, 4, 6, 8]) s.push(v)
    expect(s.mean).toBe(5)
    expect(s.min).toBe(2)
  })

  it('is empty-safe', () => {
    const s = new Samples(4)
    expect(s.mean).toBe(0)
    expect(s.min).toBe(0)
    expect(s.percentile(0.95)).toBe(0)
  })
})

describe('FrameSampler — criteria 3 and 4', () => {
  it('reports the 5th-percentile fps, not the mean', () => {
    const f = new FrameSampler()
    // 94 good frames plus 6 hitches. Six, not five: the 95th percentile of
    // frame time only moves once more than 5% of frames are bad, which is the
    // gate's intended semantic — a couple of stutters in a hundred frames is
    // not what criterion 3 is trying to catch.
    for (let i = 0; i < 94; i++) f.sample(16.0)
    for (let i = 0; i < 6; i++) f.sample(40)

    // The mean flatters it; the percentile is what the gate asks for.
    expect(f.fpsMean).toBeGreaterThan(55)
    expect(f.fps5th).toBeLessThan(55)
  })

  it('catches a dolly that averages 60 but hitches — the case a counter misses', () => {
    const f = new FrameSampler()
    for (let i = 0; i < 100; i++) f.sample(i % 10 === 0 ? 40 : 14)
    expect(f.fpsMean).toBeGreaterThan(55)
    expect(f.fps5th).toBeLessThan(55)
  })

  it('reports the single worst frame for criterion 5', () => {
    const f = new FrameSampler()
    for (let i = 0; i < 50; i++) f.sample(16.7)
    f.sample(25) // one 40fps frame
    expect(f.fpsWorst).toBeCloseTo(40, 0)
  })

  it('discards frames long enough to be a paused tab, not a render', () => {
    const f = new FrameSampler()
    f.sample(16.7)
    f.sample(5000)
    expect(f.count).toBe(1)
  })

  it('passes a genuinely smooth run', () => {
    const f = new FrameSampler()
    for (let i = 0; i < 500; i++) f.sample(16.5 + Math.sin(i) * 0.3)
    expect(f.fps5th).toBeGreaterThan(55)
  })
})

describe('LatencySampler — criteria 1, 2 and 5', () => {
  it('reports p95', () => {
    const l = new LatencySampler()
    for (let i = 0; i < 100; i++) l.push(i)
    expect(l.p95).toBeGreaterThanOrEqual(94)
  })

  it('detects drift — the thing criterion 5 actually forbids', () => {
    const l = new LatencySampler()
    // Steady first half, degrading second half: an exhausting audio pool.
    for (let i = 0; i < 100; i++) l.push(20)
    for (let i = 0; i < 100; i++) l.push(60)
    expect(l.driftMs).toBeGreaterThan(30)
  })

  it('reports no drift on a steady run', () => {
    const l = new LatencySampler()
    for (let i = 0; i < 200; i++) l.push(20)
    expect(l.driftMs).toBe(0)
  })

  it('does not claim drift from too small a sample', () => {
    const l = new LatencySampler()
    l.push(10)
    l.push(90)
    expect(l.driftMs).toBe(0)
  })
})

describe('report formatting', () => {
  it('marks an unmeasurable criterion as unknown rather than passing it', () => {
    const out = formatReport([
      { id: 7, name: 'subjective gate', value: 0, unit: '', threshold: 'a human', pass: null },
    ])
    expect(out).toContain('?')
    expect(out).not.toContain('PASS')
  })

  it('distinguishes pass from fail', () => {
    const out = formatReport([
      { id: 1, name: 'tap -> numeral', value: 40, unit: 'ms', threshold: '<= 80', pass: true },
      { id: 3, name: 'dolly fps', value: 41, unit: 'fps', threshold: '>= 55', pass: false },
    ])
    expect(out).toContain('PASS')
    expect(out).toContain('FAIL')
  })
})
