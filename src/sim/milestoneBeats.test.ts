import { describe, expect, it } from 'vitest'
import { HQ_STAGE_UPTO } from './hqLook.ts'
import { MILESTONE_LINES, MILLION_GAME, nextMilestoneBeat, type MilestoneSnapshot } from './milestoneBeats.ts'

const rest: MilestoneSnapshot = { devs: 5, bestPayout: 0, terminalRung: false, shiftPays: false }
const none = new Set<string>()

describe('§21.7.8 — the hour between people', () => {
  it('says nothing for a studio that has crossed nothing', () => {
    expect(nextMilestoneBeat(rest, none)).toBeNull()
  })

  it('speaks as the HQ outgrows each building, on the crossing and not before', () => {
    expect(nextMilestoneBeat({ ...rest, devs: HQ_STAGE_UPTO.garage }, none)).toBeNull()
    expect(nextMilestoneBeat({ ...rest, devs: HQ_STAGE_UPTO.garage + 1 }, none)?.beat).toBe('hq-storey')
    const said = new Set(['hq-storey'])
    expect(nextMilestoneBeat({ ...rest, devs: HQ_STAGE_UPTO.storey + 1 }, said)?.beat).toBe('hq-tower')
    said.add('hq-tower')
    expect(nextMilestoneBeat({ ...rest, devs: HQ_STAGE_UPTO.tower + 1 }, said)?.beat).toBe('hq-campus')
  })

  it('says each line once a run', () => {
    const all = new Set(Object.keys(MILESTONE_LINES))
    const everything = { devs: 1e7, bestPayout: 1e12, terminalRung: true, shiftPays: true }
    expect(nextMilestoneBeat(everything, all)).toBeNull()
  })

  it('skips a building the studio has already left, rather than describing it late', () => {
    const next = nextMilestoneBeat({ ...rest, devs: HQ_STAGE_UPTO.tower + 1 }, none)
    expect(next?.beat).toBe('hq-campus')
    expect(next?.spent).toEqual(['hq-storey', 'hq-tower'])
  })

  it('says one thing at a time, and the rest wait their turn', () => {
    const said = new Set<string>()
    const everything = { devs: HQ_STAGE_UPTO.garage + 1, bestPayout: MILLION_GAME, terminalRung: true, shiftPays: true }
    const order: string[] = []
    for (let next = nextMilestoneBeat(everything, said); next; next = nextMilestoneBeat(everything, said)) {
      order.push(next.beat)
      for (const b of [...next.spent, next.beat]) said.add(b)
    }
    expect(order).toEqual(['hq-storey', 'first-million', 'terminal-rung', 'shift-pays'])
  })

  it('waits for a million-dollar game, not a million dollars', () => {
    expect(nextMilestoneBeat({ ...rest, bestPayout: MILLION_GAME - 1 }, none)).toBeNull()
    expect(nextMilestoneBeat({ ...rest, bestPayout: MILLION_GAME }, none)?.beat).toBe('first-million')
  })
})
