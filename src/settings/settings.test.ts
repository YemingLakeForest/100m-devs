import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  __resetSettings,
  coerceSettings,
  getSettings,
  loadSettings,
  quantiseVolume,
  resolveReducedMotion,
  setSettings,
  subscribeSettings,
} from './settings.ts'

beforeEach(() => {
  localStorage.clear()
  __resetSettings()
})

describe('coerceSettings', () => {
  it('returns the defaults for anything that is not an object', () => {
    for (const junk of [null, undefined, 7, 'settings', [], true]) {
      expect(coerceSettings(junk)).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('keeps valid fields and replaces invalid ones individually', () => {
    // The point of per-field coercion: one bad field must not discard the rest.
    const s = coerceSettings({ music: 0.3, sfx: 'loud', haptics: 'yes', motion: 'reduced' })
    expect(s.music).toBeCloseTo(0.3)
    expect(s.sfx).toBe(DEFAULT_SETTINGS.sfx)
    expect(s.haptics).toBe(DEFAULT_SETTINGS.haptics)
    expect(s.motion).toBe('reduced')
  })

  it('clamps and quantises volumes rather than rejecting them', () => {
    expect(coerceSettings({ music: 5 }).music).toBe(1)
    expect(coerceSettings({ music: -3 }).music).toBe(0)
    expect(coerceSettings({ music: 0.44 }).music).toBeCloseTo(0.4)
  })

  it('rejects a motion preference it does not recognise', () => {
    expect(coerceSettings({ motion: 'off' }).motion).toBe('system')
  })
})

describe('quantiseVolume', () => {
  it('snaps to the meter the OPTIONS screen draws', () => {
    expect(quantiseVolume(0.03)).toBeCloseTo(0)
    expect(quantiseVolume(0.06)).toBeCloseTo(0.1)
    expect(quantiseVolume(0.95)).toBeCloseTo(1)
  })

  it('survives NaN', () => {
    expect(quantiseVolume(Number.NaN)).toBe(0)
  })
})

describe('resolveReducedMotion', () => {
  it('defers to the system when the player has not chosen', () => {
    expect(resolveReducedMotion('system', true)).toBe(true)
    expect(resolveReducedMotion('system', false)).toBe(false)
  })

  it('lets the player override the system in both directions', () => {
    // The whole reason the preference exists: the OS setting is one switch for
    // every app on the device, and a game is allowed a different answer.
    expect(resolveReducedMotion('full', true)).toBe(false)
    expect(resolveReducedMotion('reduced', false)).toBe(true)
  })
})

describe('persistence', () => {
  it('round-trips through storage', () => {
    setSettings({ music: 0.2, haptics: false })
    __resetSettings()
    expect(getSettings().music).toBe(DEFAULT_SETTINGS.music)

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ music: 0.2, haptics: false }))
    const loaded = loadSettings()
    expect(loaded.music).toBeCloseTo(0.2)
    expect(loaded.haptics).toBe(false)
    // Absent fields fall back rather than becoming undefined.
    expect(loaded.sfx).toBe(DEFAULT_SETTINGS.sfx)
  })

  it('degrades to the defaults on malformed JSON instead of throwing', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json')
    expect(() => loadSettings()).not.toThrow()
    expect(getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('survives a storage API that throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    // The session must keep the setting even when the write fails.
    expect(() => setSettings({ music: 0.1 })).not.toThrow()
    expect(getSettings().music).toBeCloseTo(0.1)
    spy.mockRestore()
  })
})

describe('subscribers', () => {
  it('are pushed the new value, so the audio layer never reads on play', () => {
    const seen: number[] = []
    const off = subscribeSettings((s) => seen.push(s.sfx))
    setSettings({ sfx: 0.3 })
    setSettings({ sfx: 0 })
    off()
    setSettings({ sfx: 1 })
    expect(seen.map((v) => Number(v.toFixed(1)))).toEqual([0.3, 0])
  })
})
