import { useCallback, useEffect, useRef, useState } from 'react'
import { purchaseHaptic } from '../audio/haptics.ts'
import { playPurchase } from '../ui/uiSfx.ts'
import type { UpgradeEffectReceipt } from './upgradeEffectModel.ts'

export type PurchasePhase = 'commit' | 'propagate' | 'prove'

export interface PurchaseEffectState {
  nodeId: string
  phase: PurchasePhase
  receipt: UpgradeEffectReceipt
}

/**
 * One purchase rhythm for every capability board: commit, propagate, prove.
 * The receipt outlives the animation so reduced-motion players lose no information.
 */
export function usePurchaseEffect(): {
  effect: PurchaseEffectState | null
  begin: (nodeId: string, receipt: UpgradeEffectReceipt, onProved?: () => void) => void
} {
  const [effect, setEffect] = useState<PurchaseEffectState | null>(null)
  const timers = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer)
    timers.current = []
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const begin = useCallback((nodeId: string, receipt: UpgradeEffectReceipt, onProved?: () => void) => {
    clearTimers()
    playPurchase()
    purchaseHaptic()
    setEffect({ nodeId, receipt, phase: 'commit' })
    timers.current.push(
      window.setTimeout(() => setEffect((current) => current ? { ...current, phase: 'propagate' } : null), 120),
      window.setTimeout(() => {
        setEffect((current) => current ? { ...current, phase: 'prove' } : null)
        onProved?.()
      }, 440),
      window.setTimeout(() => setEffect(null), 2600),
    )
  }, [clearTimers])

  return { effect, begin }
}
