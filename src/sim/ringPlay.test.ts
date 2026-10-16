/**
 * §10.8b [amended 2026-10-16] — the ring, played. `release.test.ts` pins what a
 * release is worth; this pins how the head moves and what a press does to it,
 * which is the half the user called *"too repeatative and not challenging
 * enough."* The claims are orders and directions, not tuned numbers (§25.3.2).
 */
import { describe, expect, it } from 'vitest'
import { BUG_EXCLUSION, REACH_CLEAN, SHIP_ZONE, YEARS, inShipZone } from './release.ts'
import {
  CLEAN_REFUND,
  HYPE,
  MISS_STALL_MS,
  TEMPO_MAX,
  bugMix,
  bugUnderHead,
  createRingPlay,
  ringExpired,
  hypeStage,
  stepRing,
  tapRing,
  type RingPlay,
} from './ringPlay.ts'

const PERIOD = 6_000
const fresh = (count = 4, rung = 0, of = 12) => createRingPlay(7, 3, count, PERIOD, rung, of)
const started = (p: RingPlay) => tapRing(p, 7, 3).play
/** Put the head exactly on a bug, as a player who timed it would. */
const onBug = (p: RingPlay, i = 0): RingPlay => ({ ...p, turn: p.bugs[i].t })

describe('§10.8b — the ring waits, then runs', () => {
  it('does not move before the first press', () => {
    const p = fresh()
    expect(stepRing(p, 5_000)).toBe(p)
    const s = tapRing(p, 7, 3)
    expect(s.event.kind).toBe('start')
    expect(s.play.started).toBe(true)
  })

  it('cools the hype by the clock and runs out after the last stage', () => {
    let p = started(fresh())
    expect(hypeStage(p)).toBe(1)
    p = stepRing(p, PERIOD * 1.5)
    expect(hypeStage(p)).toBe(2)
    p = stepRing(p, PERIOD * YEARS)
    expect(ringExpired(p)).toBe(true)
    expect(tapRing(p, 7, 3).event.kind).toBe('expired')
  })

  it('at tempo 1 going one way, comes back to the top once a stage — the old lap, kept', () => {
    let p = started(fresh())
    p = stepRing(p, PERIOD * (1 - (SHIP_ZONE + 0.01)))
    expect(inShipZone(p.turn)).toBe(true)
    expect(tapRing(p, 7, 3).event.kind).toBe('ship')
  })
})

describe('§10.8b — a clean fix carries the head on; a rushed one bounces it', () => {
  it('keeps the head going on a clean fix', () => {
    const p = onBug(started(fresh()))
    const { play, event } = tapRing(p, 7, 3)
    expect(event.kind === 'fix' && event.quality).toBe('clean')
    expect(play.dir).toBe(p.dir)
  })

  it('turns the head round on a rushed fix', () => {
    const p = started(fresh())
    const { play, event } = tapRing({ ...p, turn: p.bugs[0].t - REACH_CLEAN * 1.5 }, 7, 3)
    expect(event.kind === 'fix' && event.quality).toBe('rushed')
    expect(play.dir).toBe(-p.dir)
  })

  it('lets a clean player clear the whole backlog and reach the spotlight inside the first stage', () => {
    // The claim the every-hit reversal broke: the bugs share one arc, so a head
    // that turns on every fix is turned away from the rest and pays a lap each.
    let p = started(fresh(7))
    for (let t = 0; t < PERIOD && p.bugs.length > 0; t += 2) {
      p = stepRing(p, 2)
      if (bugUnderHead(p)?.quality === 'clean') p = tapRing(p, 7, 3).play
    }
    expect(p.bugs).toHaveLength(0)
    while (!inShipZone(p.turn)) p = stepRing(p, 2)
    expect(hypeStage(p)).toBe(1)
  })

  it('turns it round on an armour crack too, and the bug stays', () => {
    let p = started(fresh())
    p = { ...p, bugs: [{ ...p.bugs[0], kind: 'armoured', hp: 2 }, ...p.bugs.slice(1)] }
    const { play, event } = tapRing(onBug(p), 7, 3)
    expect(event.kind).toBe('crack')
    expect(play.dir).toBe(-p.dir)
    expect(play.bugs).toHaveLength(p.bugs.length)
    const second = tapRing(onBug(play), 7, 3)
    expect(second.event.kind).toBe('fix')
  })
})

describe('§10.8b — a clean streak speeds the head; a miss costs time', () => {
  it('speeds up with each clean fix, up to a ceiling, and a rushed fix ends the streak but not the speed', () => {
    let p = started(fresh(12))
    let last = p.tempo
    for (let i = 0; i < 3; i++) {
      p = tapRing(onBug(p), 7, 3).play
      expect(p.tempo).toBeGreaterThan(last)
      last = p.tempo
    }
    expect(p.streak).toBe(3)
    const alone = { ...p, bugs: [{ ...p.bugs[0], t: 0.5 }] }
    const rushed = tapRing({ ...alone, turn: 0.5 + REACH_CLEAN * 1.5 }, 7, 3)
    expect(rushed.event.kind === 'fix' && rushed.event.quality).toBe('rushed')
    expect(rushed.play.streak).toBe(0)
    expect(rushed.play.tempo).toBe(p.tempo)
    let q = p
    for (let i = 0; i < 40 && q.bugs.length > 0; i++) q = tapRing(onBug(q), 7, 3).play
    expect(q.tempo).toBeLessThanOrEqual(TEMPO_MAX)
  })

  it('a miss drops the streak and the speed, and freezes the head while the clock runs on', () => {
    let p = started(fresh(6))
    p = tapRing(onBug(p), 7, 3).play
    // The far side of the year from every bug and from the date: nothing there.
    const empty = { ...p, turn: 0.5, bugs: p.bugs.map((b, i) => ({ ...b, t: BUG_EXCLUSION + 0.01 * i })) }
    const { play, event } = tapRing(empty, 7, 3)
    expect(event.kind).toBe('miss')
    expect(play.streak).toBe(0)
    expect(play.tempo).toBe(1)
    const later = stepRing(play, MISS_STALL_MS / 2)
    expect(later.turn).toBe(play.turn)
    expect(later.elapsed).toBe(play.elapsed + MISS_STALL_MS / 2)
    expect(stepRing(later, MISS_STALL_MS).turn).not.toBe(play.turn)
  })
})

describe('§10.8b — a clean hit wins hype back (2026-10-16)', () => {
  it('buys time back on a clean fix, none on a rushed one, and never past the start of the stage', () => {
    let p = started(fresh(6))
    p = stepRing(p, PERIOD * 0.5)
    const clean = tapRing(onBug(p), 7, 3).play
    expect(clean.elapsed).toBe(p.elapsed - CLEAN_REFUND * PERIOD)
    const alone = { ...p, bugs: [{ ...p.bugs[0], t: 0.5 }] }
    const rushed = tapRing({ ...alone, turn: 0.5 + REACH_CLEAN * 1.5 }, 7, 3).play
    expect(rushed.elapsed).toBe(p.elapsed)
    // Early in the second stage: the refund stops at the stage's start, so cooled hype stays cooled.
    const late = { ...stepRing(p, PERIOD * 0.55), turn: 0 }
    expect(hypeStage(late)).toBe(2)
    const back = tapRing({ ...late, turn: late.bugs[0].t }, 7, 3).play
    expect(back.elapsed).toBe(PERIOD)
    expect(hypeStage(back)).toBe(2)
  })

  it('names four stages, hottest first, one for each band the top can pay', () => {
    expect(HYPE).toHaveLength(YEARS)
    expect(HYPE[0]).toBe('HYPED')
  })
})

describe('§10.8b — the bugs change up the ladder', () => {
  it('has only standing bugs on the first rung, and more of the hard kinds further up', () => {
    expect(bugMix(0, 12)).toEqual({ crawler: 0, armoured: 0 })
    const early = bugMix(2, 12)
    const late = bugMix(11, 12)
    expect(early.armoured).toBe(0)
    expect(late.crawler).toBeGreaterThan(early.crawler)
    expect(late.armoured).toBeGreaterThan(early.armoured)
  })

  it('keeps every crawler in the bug zone however long the frame, so the dead zone still means one control', () => {
    let p = started(createRingPlay(11, 5, 12, PERIOD, 11, 12))
    expect(p.bugs.some((b) => b.kind === 'crawler')).toBe(true)
    for (const dt of [16, 250, 4_000, 16, 9_000]) {
      p = stepRing(p, dt)
      for (const b of p.bugs) {
        expect(b.t).toBeGreaterThanOrEqual(BUG_EXCLUSION - 1e-9)
        expect(b.t).toBeLessThanOrEqual(1 - BUG_EXCLUSION + 1e-9)
      }
    }
  })

  it('lays out the same ring for the same release', () => {
    expect(createRingPlay(11, 5, 9, PERIOD, 8, 12)).toEqual(createRingPlay(11, 5, 9, PERIOD, 8, 12))
  })

  it('finds the bug under the head and nothing on bare calendar', () => {
    const p = started(fresh())
    expect(bugUnderHead(onBug(p))?.quality).toBe('clean')
    expect(bugUnderHead({ ...p, turn: 0 })).toBeNull()
  })
})
