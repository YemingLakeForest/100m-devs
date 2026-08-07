import { describe, expect, it } from 'vitest'
import { hasBooted, markBooted, type BootStore } from './bootFlag.ts'

function memoryStore(): BootStore & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  }
}

/** Private-mode Safari and a full quota both look like this. */
function throwingStore(): BootStore {
  return {
    getItem() {
      throw new DOMException('blocked')
    },
    setItem() {
      throw new DOMException('quota')
    },
  }
}

describe('bootFlag — GDD §10.9.3', () => {
  it('reports a cold first launch', () => {
    expect(hasBooted(memoryStore())).toBe(false)
  })

  it('remembers the boot across launches', () => {
    const store = memoryStore()
    markBooted(store)
    expect(hasBooted(store)).toBe(true)
  })

  it('is idempotent — StrictMode runs the effect twice by design', () => {
    const store = memoryStore()
    markBooted(store)
    markBooted(store)
    expect(store.map.size).toBe(1)
    expect(hasBooted(store)).toBe(true)
  })

  it('uses one key and does not disturb anything else', () => {
    const store = memoryStore()
    store.setItem('unrelated', 'x')
    markBooted(store)
    expect(store.map.get('unrelated')).toBe('x')
  })

  /**
   * The failure has to be one-directional. If storage is unreadable we show
   * the boot: a player who sees it twice has lost two seconds, a player who
   * never sees it has lost the scene.
   */
  it('degrades to "first launch" when storage throws', () => {
    const store = throwingStore()
    expect(() => markBooted(store)).not.toThrow()
    expect(hasBooted(store)).toBe(false)
  })

  it('degrades the same way when there is no storage at all', () => {
    expect(() => markBooted(null)).not.toThrow()
    expect(hasBooted(null)).toBe(false)
  })
})
