import Decimal from 'break_infinity.js'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  SAVE_KEY,
  SAVE_VERSION,
  compilerPermanent,
  deserialize,
  emptyPermanent,
  forkPermanent,
  getPermanent,
  makeSaveData,
  mergePermanent,
  migrate,
  nodeSpend,
  paradigmShiftPermanent,
  readSave,
  serialize,
  setPermanent,
  spendableBalance,
  toDecimal,
  writeSave,
  type PermanentSave,
  type SaveData,
} from './save.ts'
import { __resetStore, getState } from './store.ts'

function saveAtVersion(version: number): SaveData {
  const base = makeSaveData(getState())
  return { ...base, version }
}

beforeEach(() => {
  localStorage.clear()
  __resetStore()
})

describe('the document — SAVE.md §1', () => {
  it('leads with version and savedAt', () => {
    const keys = Object.keys(makeSaveData(getState()))
    expect(keys[0]).toBe('version')
    expect(keys[1]).toBe('savedAt')
  })

  it('carries a game prefix on the key, against a shared web origin', () => {
    expect(SAVE_KEY.startsWith('m100devs')).toBe(true)
  })

  it('re-stamps savedAt on every serialize, never carrying it over', () => {
    // SAVE.md §4's first trap: a carried-over savedAt makes a device lose every
    // last-write-wins race for ever and look like its saves are ignored.
    const before = Date.now()
    const save = makeSaveData(getState())
    expect(save.savedAt).toBeGreaterThanOrEqual(before)

    const loaded = deserialize(serialize(save))!
    const rewritten = makeSaveData(getState())
    expect(rewritten.savedAt).toBeGreaterThanOrEqual(loaded.savedAt)
  })

  it('round-trips through JSON without losing the run', () => {
    const save = makeSaveData(getState())
    const back = deserialize(serialize(save))
    expect(back).not.toBeNull()
    expect(back!.run).toEqual(save.run)
    expect(back!.permanent).toEqual(save.permanent)
  })

  it('writes Decimals as strings, never as floats', () => {
    const raw = JSON.parse(serialize(makeSaveData(getState())))
    expect(typeof raw.run.commitment).toBe('string')
    expect(typeof raw.run.burned).toBe('string')
  })

  it('survives a commitment far past Number.MAX_VALUE', () => {
    // The reason the field is a string. A 1e308 overflow written into a save is
    // not something a migration can undo.
    const huge = new Decimal('1e400')
    const save = makeSaveData({ ...getState(), commitment: huge })
    const back = deserialize(serialize(save))!
    expect(toDecimal(back.run.commitment, new Decimal(0)).eq(huge)).toBe(true)
  })
})

describe('migration — SAVE.md §2', () => {
  it('refuses a save from a newer client, and does not guess', () => {
    // Rule 2, and the one with teeth: a player on two devices updates one
    // first, and the old client must decline rather than write a downgraded
    // document over a good one. Losing a session is recoverable; truncating a
    // save is not.
    expect(migrate(saveAtVersion(SAVE_VERSION + 1))).toBeNull()
    expect(migrate(saveAtVersion(SAVE_VERSION + 99))).toBeNull()
    expect(deserialize(serialize(saveAtVersion(SAVE_VERSION + 1)))).toBeNull()
  })

  it('accepts and upgrades every version it has ever written', () => {
    // Table-driven over the whole history rather than the current version, so
    // this keeps testing what it claims to as versions are added.
    for (let v = 1; v <= SAVE_VERSION; v++) {
      const migrated = migrate(saveAtVersion(v))
      expect(migrated, `version ${v}`).not.toBeNull()
      expect(migrated!.version, `version ${v}`).toBe(SAVE_VERSION)
    }
  })

  it('rejects a document with no version at all', () => {
    // Not a save from version zero — not one of ours, or truncated.
    expect(deserialize(JSON.stringify({ run: {}, permanent: {} }))).toBeNull()
    expect(deserialize(JSON.stringify({ version: 'one' }))).toBeNull()
    expect(deserialize(JSON.stringify({ version: Number.NaN }))).toBeNull()
  })

  it('rejects anything that is not a save-shaped object', () => {
    expect(deserialize('not json at all')).toBeNull()
    expect(deserialize('[1,2,3]')).toBeNull()
    expect(deserialize('null')).toBeNull()
    expect(deserialize('42')).toBeNull()
  })
})

describe('defensive defaults — SAVE.md §2 rule 3', () => {
  it('fills a save that is missing whole blocks', () => {
    const save = migrate({ version: SAVE_VERSION } as SaveData)!
    expect(save.run.devs).toBe(1)
    expect(save.run.phase).toBe('act1_poke')
    expect(save.permanent.meta.heroCards).toEqual([])
    expect(save.permanent.layer1.paradigmNodes).toEqual([])
  })

  it('rejects a phase name this build does not have', () => {
    // §21's phase drives a switch with no default. An unrecognised name would
    // fall through every case and leave the script wedged for ever.
    const save = migrate({ ...saveAtVersion(1), run: { phase: 'act9_ascension' } } as never)!
    expect(save.run.phase).toBe('act1_poke')
  })

  it('replaces tampered numbers rather than propagating NaN', () => {
    const save = migrate({
      ...saveAtVersion(1),
      run: { devs: Number.NaN, cash: Number.POSITIVE_INFINITY, devCap: -5 },
    } as never)!
    expect(save.run.devs).toBe(1)
    expect(save.run.cash).toBe(0)
    expect(save.run.devCap).toBeGreaterThan(0)
  })

  it('rejects a commitment that would make the burn-down bar never fill', () => {
    // `new Decimal(undefined)` is NaN rather than a throw, and a NaN commitment
    // presents as "the game is broken" three screens from its cause.
    const fallback = new Decimal(7)
    expect(toDecimal(undefined, fallback).eq(fallback)).toBe(true)
    expect(toDecimal('banana', fallback).eq(fallback)).toBe(true)
    expect(toDecimal({}, fallback).eq(fallback)).toBe(true)
    expect(toDecimal('1e50', fallback).eq(new Decimal('1e50'))).toBe(true)
  })

  it('drops non-string entries from a set field and deduplicates it', () => {
    const save = migrate({
      ...saveAtVersion(1),
      permanent: { meta: { heroCards: ['james', 'james', 7, null, 'intern42'] } },
    } as never)!
    expect(save.permanent.meta.heroCards).toEqual(['james', 'intern42'])
  })
})

// --- the merge -------------------------------------------------------------

function permanent(over: Partial<PermanentSave['meta']> = {}): PermanentSave {
  const p = emptyPermanent()
  return { layer1: p.layer1, meta: { ...p.meta, ...over } }
}

describe('the monotonic merge — SAVE.md §3, GDD §24.3', () => {
  it('unions Hero Cards, so the device that lost the race keeps its collection', () => {
    const a = permanent({ heroCards: ['james', 'intern42'] })
    const b = permanent({ heroCards: ['james', 'chad'] })
    expect(mergePermanent(a, b).meta.heroCards.sort()).toEqual(['chad', 'intern42', 'james'])
  })

  it('takes the high-water mark on every lifetime aggregate', () => {
    const a = permanent({ lifetimeRevenue: 900, peakDevs: 12, bpEarnedLifetime: 40 })
    const b = permanent({ lifetimeRevenue: 100, peakDevs: 5_000, bpEarnedLifetime: 10 })
    const m = mergePermanent(a, b).meta
    expect(m.lifetimeRevenue).toBe(900)
    expect(m.peakDevs).toBe(5_000)
    expect(m.bpEarnedLifetime).toBe(40)
  })

  it('keeps Bruno earnable across two devices', () => {
    // §22.5 #6 is earned by accumulating 24h offline. Last-write-wins loses him.
    const phone = permanent({ totalOfflineSeconds: 20 * 3600 })
    const tablet = permanent({ totalOfflineSeconds: 6 * 3600 })
    expect(mergePermanent(phone, tablet).meta.totalOfflineSeconds).toBe(20 * 3600)
  })

  it('takes the higher card tier and duplicate count per card', () => {
    const a = permanent({ heroTiers: { james: 5 }, heroDuplicates: { james: 2, chad: 9 } })
    const b = permanent({ heroTiers: { james: 2, chad: 1 }, heroDuplicates: { james: 7 } })
    const m = mergePermanent(a, b).meta
    expect(m.heroTiers).toEqual({ james: 5, chad: 1 })
    expect(m.heroDuplicates).toEqual({ james: 7, chad: 9 })
  })

  it('is commutative and idempotent', () => {
    // Anything that is not depends on which device happened to sync first,
    // which is the bug the merge exists to prevent.
    const a = permanent({ heroCards: ['james'], milestones: ['ship1'], peakDevs: 10 })
    const b = permanent({ heroCards: ['yuki'], milestones: ['pokes1000'], peakDevs: 90 })
    const ab = mergePermanent(a, b)
    const ba = mergePermanent(b, a)
    expect(ab.meta.heroCards.sort()).toEqual(ba.meta.heroCards.sort())
    expect(ab.meta.peakDevs).toBe(ba.meta.peakDevs)
    expect(mergePermanent(ab, ab).meta.peakDevs).toBe(ab.meta.peakDevs)
    expect(mergePermanent(ab, ab).meta.heroCards.sort()).toEqual(ab.meta.heroCards.sort())
  })

  it('unions the quit flag, so a sync cannot un-quit Yuki', () => {
    // §22.5 #11 says "permanently, until the next Codebase Fork". Syncing the
    // other device would make that a lie.
    const quit = permanent({ heroCards: ['yuki'], heroQuit: ['yuki'] })
    const fresh = permanent({ heroCards: ['yuki'] })
    expect(mergePermanent(fresh, quit).meta.heroQuit).toEqual(['yuki'])
    expect(mergePermanent(quit, fresh).meta.heroQuit).toEqual(['yuki'])
  })

  it('takes the winner org chart, filtered to the cards the merge produced', () => {
    // A layout cannot be unioned into a third arrangement either player chose.
    const local = permanent({ heroCards: ['james'], orgChart: { '1': 'james' } })
    const remote = permanent({ heroCards: ['chad'], orgChart: { '1': 'chad', '2': 'ghost' } })
    const m = mergePermanent(local, remote, 'remote').meta
    expect(m.orgChart).toEqual({ '1': 'chad' })
    expect(mergePermanent(local, remote, 'local').meta.orgChart).toEqual({ '1': 'james' })
  })

  it('unions unlocked nodes and takes the higher level on each', () => {
    const a: PermanentSave = {
      layer1: { paradigmNodes: ['L1-1A'], paradigmLevels: { 'L1-1A': 3 } },
      meta: emptyPermanent().meta,
    }
    const b: PermanentSave = {
      layer1: { paradigmNodes: ['L1-1B'], paradigmLevels: { 'L1-1A': 1, 'L1-1B': 2 } },
      meta: emptyPermanent().meta,
    }
    const m = mergePermanent(a, b).layer1
    expect(m.paradigmNodes.sort()).toEqual(['L1-1A', 'L1-1B'])
    expect(m.paradigmLevels).toEqual({ 'L1-1A': 3, 'L1-1B': 2 })
  })
})

describe('a spendable balance is derived, never merged — GDD §24.3', () => {
  const cost = () => 10

  it('keeps both nodes when two devices spend the same currency differently', () => {
    const a: PermanentSave = {
      layer1: { paradigmNodes: ['X'], paradigmLevels: { X: 1 } },
      meta: { ...emptyPermanent().meta, bpEarnedLifetime: 15 },
    }
    const b: PermanentSave = {
      layer1: { paradigmNodes: ['Y'], paradigmLevels: { Y: 1 } },
      meta: { ...emptyPermanent().meta, bpEarnedLifetime: 15 },
    }
    const merged = mergePermanent(a, b)
    const spent = nodeSpend(merged.layer1.paradigmNodes, merged.layer1.paradigmLevels, cost)

    expect(merged.layer1.paradigmNodes.sort()).toEqual(['X', 'Y'])
    expect(spent).toBe(20)
    // Both nodes kept; the residual is what the race costs, not an unlock.
    expect(spendableBalance(merged.meta.bpEarnedLifetime, spent)).toBe(0)
  })

  it('never reports a negative balance', () => {
    expect(spendableBalance(10, 40)).toBe(0)
  })

  it('charges every level below the one held, because levels are cumulative', () => {
    expect(nodeSpend(['X'], { X: 3 }, (_, level) => level * 10)).toBe(60)
  })

  it('treats an unlocked node with no recorded level as level 1', () => {
    expect(nodeSpend(['X'], {}, cost)).toBe(10)
  })
})

describe('prestige resets — GDD §24.4', () => {
  const rich = (): PermanentSave => ({
    layer1: { paradigmNodes: ['L1-1A'], paradigmLevels: { 'L1-1A': 4 } },
    meta: {
      ...emptyPermanent().meta,
      heroCards: ['james', 'yuki'],
      heroQuit: ['yuki'],
      forkNodes: ['L2-1A'],
      dimensions: ['cyberpunk'],
      bpEarnedLifetime: 5_000,
      totalOfflineSeconds: 99,
    },
  })

  it('a Paradigm Shift touches nothing permanent', () => {
    const after = paradigmShiftPermanent(rich())
    expect(after.layer1).toEqual(rich().layer1)
    expect({ ...after.meta, paradigmShifts: 0 }).toEqual(rich().meta)
  })

  it('a Paradigm Shift counts itself, which is what unlocks offline accrual', () => {
    expect(paradigmShiftPermanent(emptyPermanent()).meta.paradigmShifts).toBe(1)
  })

  it('a Codebase Fork clears Layer 1 in full and keeps everything meta', () => {
    const after = forkPermanent(rich())
    expect(after.layer1.paradigmNodes).toEqual([])
    expect(after.layer1.paradigmLevels).toEqual({})
    expect(after.meta.heroCards.sort()).toEqual(['james', 'yuki'])
    expect(after.meta.forkNodes).toEqual(['L2-1A'])
  })

  it('a Codebase Fork brings Yuki back, because §22.5 says it does', () => {
    expect(forkPermanent(rich()).meta.heroQuit).toEqual([])
  })

  it('lifetime BP survives a Fork, because §14.3 needs BP_total to mean total', () => {
    expect(forkPermanent(rich()).meta.bpEarnedLifetime).toBe(5_000)
  })

  it('a Multiverse Compiler additionally clears Fork nodes — and never a card', () => {
    const after = compilerPermanent(rich())
    expect(after.layer1.paradigmNodes).toEqual([])
    expect(after.meta.forkNodes).toEqual([])
    expect(after.meta.heroCards.sort()).toEqual(['james', 'yuki'])
    expect(after.meta.dimensions).toEqual(['cyberpunk'])
  })
})

describe('local storage', () => {
  it('round-trips through the real key', () => {
    setPermanent({ ...emptyPermanent(), meta: { ...emptyPermanent().meta, heroCards: ['james'] } })
    expect(writeSave(makeSaveData(getState()))).toBe(true)
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull()
    expect(readSave()!.permanent.meta.heroCards).toEqual(['james'])
  })

  it('returns null rather than throwing on a corrupt entry', () => {
    localStorage.setItem(SAVE_KEY, '{"version": 1, "run": ')
    expect(readSave()).toBeNull()
  })

  it('folds the run lifetime figures into their high-water marks at write time', () => {
    const save = makeSaveData({ ...getState(), lifetimeRevenue: 4_200, devs: 88 })
    expect(save.permanent.meta.lifetimeRevenue).toBe(4_200)
    expect(save.permanent.meta.peakDevs).toBe(88)
  })

  it('never lowers a high-water mark from a weaker run', () => {
    setPermanent({
      ...emptyPermanent(),
      meta: { ...emptyPermanent().meta, lifetimeRevenue: 9_000, peakDevs: 1_000 },
    })
    const save = makeSaveData({ ...getState(), lifetimeRevenue: 1, devs: 2 })
    expect(save.permanent.meta.lifetimeRevenue).toBe(9_000)
    expect(save.permanent.meta.peakDevs).toBe(1_000)
    expect(getPermanent().meta.peakDevs).toBe(1_000)
  })
})
