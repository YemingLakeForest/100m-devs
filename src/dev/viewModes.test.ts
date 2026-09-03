import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEBUG_TOOLS_ENABLED } from './debugAccess.ts'
import {
  __resetViewModes,
  getViewModes,
  initialViewModes,
  installViewModeKeys,
  onViewModes,
  setViewModes,
  toggleViewMode,
} from './viewModes.ts'

afterEach(() => __resetViewModes())

/**
 * §7.6a / §7.2 — the two switches for looking at the scene.
 *
 * The claims worth pinning are not "a boolean flips". They are the three
 * properties that make a debug switch safe: it is off the shipped path, it
 * tells whoever is watching, and the query string seeds it rather than
 * replacing it.
 */
describe('the view modes', () => {
  it('ships with the glass on and the rails on', () => {
    // The values a player gets. `initialViewModes` reads the query string,
    // which is empty in this environment, so this is also the default.
    expect(initialViewModes()).toEqual({ crt: true, freeZoom: false })
  })

  it('moves both switches and reports where they landed', () => {
    expect(setViewModes({ crt: false }).crt).toBe(false)
    expect(getViewModes().crt).toBe(false)
    expect(toggleViewMode('crt').crt).toBe(true)
    expect(toggleViewMode('freeZoom').freeZoom).toBe(true)
  })

  /**
   * The property a control with a readout on it depends on: a switch that
   * moved silently is a switch the interface will eventually disagree with.
   */
  it('tells its listeners, once per real change', () => {
    const seen = vi.fn()
    const off = onViewModes(seen)
    setViewModes({ crt: false })
    // The same value again is not a change and must not fire.
    setViewModes({ crt: false })
    setViewModes({ freeZoom: true })
    expect(seen).toHaveBeenCalledTimes(2)
    off()
    setViewModes({ crt: true })
    expect(seen).toHaveBeenCalledTimes(2)
  })

  /**
   * **The gate.** Free zoom is §7.7.1's rule — *the studio you can see is the
   * studio you have* — so a build that let a player past it would be telling
   * them the world is a backdrop they are pointing at. `DEBUG_TOOLS_ENABLED` is
   * true under vitest, so what this can assert is the shape of the guard rather
   * than its value; `debugAccess.test.ts` owns the hostname rule itself.
   */
  it('is gated on the one authority every dev seam is gated on', () => {
    expect(DEBUG_TOOLS_ENABLED).toBe(true)
    // And the setter is total: an unknown session gets the shipped pair back
    // rather than a half-applied one.
    expect(setViewModes({})).toEqual(getViewModes())
  })

  it('installs and removes its keys and globals together', () => {
    const g = globalThis as unknown as Record<string, unknown>
    const teardown = installViewModeKeys()
    expect(typeof g.__crt).toBe('function')
    expect(typeof g.__freeZoom).toBe('function')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }))
    expect(getViewModes().crt).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }))
    expect(getViewModes().freeZoom).toBe(true)

    // A modifier means the key belongs to the browser or the OS, not to us.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
    expect(getViewModes().crt).toBe(false)

    teardown()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }))
    expect(getViewModes().crt).toBe(false)
    expect(g.__crt).toBeUndefined()
  })

  /**
   * `ScenarioBar` owns the digits and takes typed headcounts, and typing one
   * must not repaint the picture. Same rule, one file over.
   */
  it('ignores a key pressed into a field', () => {
    const teardown = installViewModeKeys()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }))
    expect(getViewModes().crt).toBe(true)
    input.remove()
    teardown()
  })
})
