/** World identity, never headcount or camera position, seeds the survey.
 * Three-dimensional fields wrap without a longitude seam. */
export type PlanetKind = 'earth' | 'rock' | 'desert' | 'ocean' | 'ice'
export function planetKind(world:number):PlanetKind {
  return world===0?'earth':(['rock','desert','ocean','ice'] as const)[(world-1)%4]
}
function random(seed:number) {
  let n=seed|0
  return ()=>{n=(Math.imul(n,1664525)+1013904223)|0;return (n>>>0)/4294967296}
}
type Field={waves:number[][];craters:number[][]}
const fields=new Map<number,Field>()
function field(world:number) {
  let value=fields.get(world)
  if(value)return value
  const next=random(world*7919+137)
  value={waves:Array.from({length:8},(_,i)=>{
    const scale=2+Math.floor(i/2)*3
    return [(next()-.5)*scale,(next()-.5)*scale,(next()-.5)*scale,next()*6.28]
  }),craters:Array.from({length:24},()=>{
    const y=next()*2-1,a=next()*6.28,r=Math.sqrt(1-y*y)
    return [Math.cos(a)*r,y,Math.sin(a)*r,.065+next()*.24]
  })}
  fields.set(world,value);return value
}
export function colonyTerrainAt(point:readonly number[],world:number) {
  const [x,y,z]=point,kind=planetKind(world),f=field(world)
  const waves=f.waves.map(([a,b,c,d])=>Math.sin(x*a+y*b+z*c+d))
  let elevation=waves.reduce((sum,v,i)=>sum+v/(2+i),0)
  if(kind==='ocean')elevation=f.waves.reduce((sum,[a,b,c,d],i)=>sum+Math.sin((x*a+y*b+z*c)*3+d)/(3+i),0)
  let relief=elevation*.22,detail=0
  if(kind==='rock')for(const [a,b,c,r] of f.craters) {
    const distance=Math.sqrt((x-a)**2+(y-b)**2+(z-c)**2)/r*(1+.05*Math.sin(x*51+y*43+z*37))
    if(distance<1.3) {
      relief+=distance<.8?-.28*(1-distance*.45):.22*Math.max(0,1-Math.abs(distance-1)/.3)
      detail=Math.max(detail,Math.max(0,1-Math.abs(distance-1)/.1))
    }
  }
  if(kind==='desert') {
    const canyon=Math.abs(Math.sin(x*11+waves[0]*4+world)*Math.sin(z*9+y*6+waves[2]*3))
    detail=canyon<.08?1:canyon<.16?.5:0
    relief-=detail*.32
    relief+=Math.sin(x*61+z*39+waves[0]*6)*.025
  }
  if(kind==='ice') {
    let first=Infinity,second=Infinity
    for(const [a,b,c] of f.craters) {
      const d=(x+waves[2]*.04-a)**2+(y+waves[3]*.04-b)**2+(z-c)**2
      if(d<first){second=first;first=d}else if(d<second)second=d
    }
    const fracture=second-first
    detail=fracture<.012?1:fracture<.026?.45:0
    relief-=detail*.42
  }
  const land=kind!=='ocean'||elevation>.42
  return {land,coast:elevation-.42,ice:kind==='ice',latitude:Math.asin(Math.max(-1,Math.min(1,y))),relief,detail}
}
