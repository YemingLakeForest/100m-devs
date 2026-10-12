import { describe, expect, it } from 'vitest'
import { createThroughputBed } from './throughputBed.ts'

describe('the throughput bed', () => {
  it('is a no-op where there is no Web Audio, and never throws from update or dispose', () => {
    const bed = createThroughputBed()
    expect(() => { bed.update(0, 1); bed.update(1, 0.35); bed.dispose(); bed.dispose() }).not.toThrow()
  })
})
