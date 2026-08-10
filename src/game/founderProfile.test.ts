import { describe, expect, it } from 'vitest'
import {
  FOUNDER_PROFILE_KEY,
  cleanFounderName,
  founderLook,
  randomFounderLook,
  randomFounderName,
  readFounderProfile,
  writeFounderProfile,
} from './founderProfile.ts'

function memoryStore() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('the permanent you', () => {
  it('round-trips a founder profile independently of the run save', () => {
    const store = memoryStore()
    const profile = { name: 'Ada Lovelace', head: 'wave', body: 'jacket' } as const
    expect(writeFounderProfile(profile, store)).toEqual(profile)
    expect(readFounderProfile(store)).toEqual(profile)
    expect(store.getItem(FOUNDER_PROFILE_KEY)).toContain('Ada Lovelace')
  })

  it('normalises a typed name before it reaches the room', () => {
    expect(cleanFounderName('   Ada    Lovelace  ')).toBe('Ada Lovelace')
  })

  it('treats corrupt or incomplete identity as first start', () => {
    const store = memoryStore()
    store.setItem(FOUNDER_PROFILE_KEY, '{"name":"Ada","head":"missing"}')
    expect(readFounderProfile(store)).toBeNull()
  })

  it('makes both dice deterministic when a draw is injected', () => {
    const draws = [0, 0.999]
    let i = 0
    expect(randomFounderName(() => draws[i++])).toBe('Alex Williams')
    expect(randomFounderLook(() => 0.999)).toEqual({ head: 'phones', body: 'knit' })
  })

  it('still starts when storage is unavailable', () => {
    const profile = { name: 'Ada', head: 'crop', body: 'tee' } as const
    expect(writeFounderProfile(profile, null)).toEqual(profile)
    expect(readFounderProfile(null)).toBeNull()
  })

  it('resolves creator choices to the shared developer part table', () => {
    expect(founderLook({ name: 'Ada', head: 'phones', body: 'jacket' })).toMatchObject({
      hair: 0,
      shirt: 0,
      headphones: true,
    })
    expect(founderLook({ name: 'Ada', head: 'coil', body: 'knit' })).toMatchObject({
      hair: 2,
      shirt: 3,
      headphones: false,
    })
  })
})
