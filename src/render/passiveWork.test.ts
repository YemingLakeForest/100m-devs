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
    expect(shown).toHaveLength(24)
    expect(shown.every(f=>f.sp===1&&f.still)).toBe(true)
  })
})
