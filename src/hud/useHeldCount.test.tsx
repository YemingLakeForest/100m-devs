import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BREATH_HOLD_MS, BREATH_MS } from '../sim/heldBreath.ts'
import { useHeldCount } from './useHeldCount.ts'

describe('the held headcount (move 6)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('shows the true count when nothing was crossed', () => {
    const { result, rerender } = renderHook(({ v }) => useHeldCount(v, false), { initialProps: { v: 120 } })
    expect(result.current).toBeNull()
    rerender({ v: 180 })
    expect(result.current).toBeNull()
  })

  it('holds one short of the decade it crossed, rolls, and hands the count back', () => {
    const { result, rerender } = renderHook(({ v }) => useHeldCount(v, false), { initialProps: { v: 900 } })
    rerender({ v: 1_040 })
    expect(result.current).toBe(999)
    act(() => { vi.advanceTimersByTime(BREATH_HOLD_MS - 100) })
    expect(result.current).toBe(999)
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBeGreaterThanOrEqual(999)
    expect(result.current).toBeLessThanOrEqual(1_040)
    act(() => { vi.advanceTimersByTime(BREATH_MS) })
    expect(result.current).toBeNull()
  })

  it('does not hold for the count a saved game loads with', () => {
    const { result } = renderHook(() => useHeldCount(2_000_000, false))
    expect(result.current).toBeNull()
  })
})
