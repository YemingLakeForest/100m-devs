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
