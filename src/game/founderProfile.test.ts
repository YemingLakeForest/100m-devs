import { describe, expect, it } from 'vitest'
import {
  FOUNDER_PROFILE_KEY,
  clearFounderProfile,
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
    removeItem: (key: string) => values.delete(key),
  }
}

describe('the permanent you', () => {
  it('round-trips a founder profile independently of the run save', () => {
    const store = memoryStore()
    const profile = {
      name: 'Ada Lovelace',
      head: 'wave',
      hairColour: 3,
      skin: 1,
      accessory: 'glasses',
      facialHair: 'fullBeard',
      body: 'jacket',
      bodyColour: 4,
    } as const
    expect(writeFounderProfile(profile, store)).toEqual(profile)
    expect(readFounderProfile(store)).toEqual(profile)
    expect(store.getItem(FOUNDER_PROFILE_KEY)).toContain('Ada Lovelace')
  })

  it('normalises a typed name before it reaches the room', () => {
    expect(cleanFounderName('   Ada    Lovelace  ')).toBe('Ada Lovelace')
  })

  it('clears identity when New Game returns to founder selection', () => {
    const store = memoryStore()
    writeFounderProfile({
      name: 'Ada', head: 'crop', hairColour: 0, skin: 2,
      accessory: 'none', facialHair: 'none', body: 'tee', bodyColour: 2,
    }, store)
    clearFounderProfile(store)
    expect(readFounderProfile(store)).toBeNull()
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
    expect(randomFounderLook(() => 0.999)).toEqual({
      head: 'buzz',
      hairColour: 3,
      skin: 3,
      accessory: 'headphones',
      facialHair: 'fullBeard',
      body: 'knit',
      bodyColour: 4,
    })
  })

  it('still starts when storage is unavailable', () => {
    const profile = {
      name: 'Ada', head: 'crop', hairColour: 0, skin: 2,
      accessory: 'none', facialHair: 'none', body: 'tee', bodyColour: 2,
    } as const
    expect(writeFounderProfile(profile, null)).toEqual(profile)
    expect(readFounderProfile(null)).toBeNull()
  })

  it('resolves creator choices to the shared developer part table', () => {
    expect(founderLook({
      name: 'Ada', head: 'buzz', hairColour: 2, skin: 1,
      accessory: 'headphones', facialHair: 'moustache', body: 'jacket', bodyColour: 0,
    })).toMatchObject({
      hair: 0,
      shirt: 0,
      body: 2,
      facialHair: 1,
      headphones: true,
    })
    expect(founderLook({
      name: 'Ada', head: 'coil', hairColour: 1, skin: 3,
      accessory: 'none', facialHair: 'none', body: 'knit', bodyColour: 3,
    })).toMatchObject({
      hair: 2,
      shirt: 3,
      body: 3,
      facialHair: 0,
      headphones: false,
    })
  })

  it('migrates removed soft facial hair to the closest square style', () => {
    const store = memoryStore()
    store.setItem(FOUNDER_PROFILE_KEY, JSON.stringify({
      name: 'Ada', head: 'crop', body: 'hoodie', facialHair: 'beard',
    }))
    expect(readFounderProfile(store)?.facialHair).toBe('goatee')
    store.setItem(FOUNDER_PROFILE_KEY, JSON.stringify({
      name: 'Ada', head: 'crop', body: 'hoodie', facialHair: 'stubble',
    }))
    expect(readFounderProfile(store)?.facialHair).toBe('moustache')
  })
})
