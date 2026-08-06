import { useSyncExternalStore } from 'react'
import { getState, subscribe, type GameState } from '../game/store.ts'

/**
 * React's read side of the single store (ADR 0001 §5 mitigation 3).
 *
 * useSyncExternalStore rather than a context + setState: the store is written
 * from the Pixi ticker at 60 Hz, and this is the only subscription primitive
 * that will not tear when a render lands mid-tick.
 */
export function useGameState(): GameState {
  return useSyncExternalStore(subscribe, getState, getState)
}
