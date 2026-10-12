import { describe, expect, it } from 'vitest'
import { createPassiveWork } from './passiveWork.ts'

describe('passive coding feedback', () => {
  it('emits only earned output, includes James, and stops for absent or blocked people', () => {
    const work=createPassiveWork(), person={seat:-2,rate:1,x:20,y:30}, hops:number[]=[]
    expect(work.update([person],.5,500,false,s=>hops.push(s))).toHaveLength(0)
    const shown=work.update([person],.5,1000,false,s=>hops.push(s))
    expect(shown[0].sp).toBe(1)
    expect(hops).toContain(-2)
    expect(work.update([],1,2000,false,()=>{})).toHaveLength(0)
    expect(work.update([{...person,rate:0}],4,6000,false,()=>{})).toHaveLength(0)
  })
  it('bounds dense output and preserves numerals without hopping in reduced motion', () => {
    const work=createPassiveWork(), people=Array.from({length:100},(_,seat)=>({seat,rate:1,x:seat,y:20}))
    const shown=work.update(people,1,1000,true,()=>{throw Error('must not hop')})
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThanOrEqual(24)
    expect(shown.every(f=>f.still)).toBe(true)
  })
  it('adds up to the work being done, however many people are doing it', () => {
    // A numeral that speaks for one worker out of a crowd shows a fraction of the output, and the
    // fraction falls as the studio grows. Ten seconds of a crowd at 1 point/sec each, summed over
    // every numeral that ever appeared, has to land near n * 10 and never above it.
    for (const n of [1,10,100,1000]) {
      const work=createPassiveWork(), people=Array.from({length:n},(_,seat)=>({seat,rate:1,x:seat,y:20}))
      const seen=new Set<number>()
      let shownTotal=0
      for (let step=1; step<=100; step++) {
        for (const f of work.update(people,.1,step*100,true,()=>{})) {
          if (seen.has(f.id)) continue
          seen.add(f.id)
          shownTotal+=f.sp
        }
      }
      expect(shownTotal).toBeLessThanOrEqual(n*10+1e-6)
      expect(shownTotal).toBeGreaterThan(n*10*.8)
    }
  })
  it('never has more numerals alive than the glass carries, at any headcount', () => {
    for (const n of [12,13,100,1000]) {
      const work=createPassiveWork(), people=Array.from({length:n},(_,seat)=>({seat,rate:3,x:seat,y:20}))
      let most=0
      for (let step=1; step<=100; step++) most=Math.max(most,work.update(people,.1,step*100,true,()=>{}).length)
      expect(most).toBeLessThanOrEqual(24)
    }
  })
  it('anchors a crowd numeral over somebody who is actually on screen', () => {
    const work=createPassiveWork(), people=Array.from({length:60},(_,seat)=>({seat,rate:2,x:seat*10,y:seat}))
    const at=new Map(people.map(p=>[p.seat,p]))
    for (let step=1; step<=30; step++) {
      for (const f of work.update(people,.1,step*100,true,()=>{})) {
        expect(at.has(f.seat)).toBe(true)
        expect(f.x).toBe(at.get(f.seat)!.x)
        expect(f.y).toBe(at.get(f.seat)!.y)
      }
    }
  })
})

describe('the arrival tick at the sink (§8.2a, slice B3)', () => {
  const at = (value: number) => ({ key: 'door', x: 300, y: 200, value })

  it('adds up: every point that landed is on a numeral, however fast the packets come', () => {
    const work = createPassiveWork()
    const seen = new Set<number>()
    let shown = 0, landed = 0
    for (let ms = 0; ms <= 10_000; ms += 16) {
      const events = ms % 48 === 0 ? [at(10)] : []
      landed += events.length * 10
      for (const f of work.arrive(events, ms, false)) if (!seen.has(f.id)) { seen.add(f.id); shown += f.sp }
    }
    for (let ms = 10_016; ms <= 11_000; ms += 16) for (const f of work.arrive([], ms, false)) if (!seen.has(f.id)) { seen.add(f.id); shown += f.sp }
    expect(shown).toBe(landed)
  })

  it('speaks once a beat per sink, not once a packet, and never piles past what the glass carries', () => {
    const work = createPassiveWork()
    let most = 0
    const born: number[] = []
    const seen = new Set<number>()
    for (let ms = 0; ms <= 5000; ms += 16) {
      const live = work.arrive([at(1), at(1)], ms, false)
      most = Math.max(most, live.length)
      for (const f of live) if (!seen.has(f.id)) { seen.add(f.id); born.push(f.bornAt) }
    }
    expect(most).toBeLessThanOrEqual(6)
    for (let i = 1; i < born.length; i++) expect(born[i] - born[i - 1]).toBeGreaterThanOrEqual(200)
  })

  it('lets each numeral go inside the time every other numeral lives', () => {
    const work = createPassiveWork()
    work.arrive([at(5)], 0, false)
    expect(work.arrive([], 300, false).length).toBe(1)
    expect(work.arrive([], 1500, false)).toHaveLength(0)
  })

  it('never writes a fraction: specks of a point wait in the sink until they make one, and none is lost', () => {
    const work = createPassiveWork()
    const seen = new Set<number>()
    let shown = 0, fed = 0
    for (let ms = 0; ms < 20_000; ms += 16) {
      const speck = ms % 160 === 0 ? [at(0.07)] : []
      fed += speck.length * 0.07
      for (const f of work.arrive(speck, ms, false)) if (!seen.has(f.id)) { seen.add(f.id); shown += f.sp; expect(Number.isInteger(f.sp)).toBe(true) }
    }
    expect(shown).toBeGreaterThan(0)
    expect(shown).toBeLessThanOrEqual(fed)
    expect(shown).toBeGreaterThan(fed - 1.5)
  })

  it('keeps separate sinks separate', () => {
    const work = createPassiveWork()
    const live = work.arrive([at(3), { key: 'board', x: 40, y: 50, value: 4 }], 0, false)
    expect(live.map(f => f.sp).sort()).toEqual([3, 4])
  })

  it('holds still under reduced motion, and can have the head numerals switched off without stopping the hops', () => {
    const work = createPassiveWork()
    expect(work.arrive([at(2)], 0, true).every(f => f.still)).toBe(true)
    const crowd = Array.from({ length: 30 }, (_, seat) => ({ seat, rate: 1, x: seat, y: 20 }))
    const hops: number[] = []
    let numerals = 0
    for (let step = 1; step <= 60; step++) numerals += createPassiveWork().update(crowd, .1, step * 100, false, s => hops.push(s), false).length
    expect(numerals).toBe(0)
    const w2 = createPassiveWork(), h2: number[] = []
    for (let step = 1; step <= 30; step++) w2.update(crowd, .1, step * 100, false, s => h2.push(s), false)
    expect(h2.length).toBeGreaterThan(0)
  })
})
