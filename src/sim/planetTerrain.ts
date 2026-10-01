/** Fictional geography shared by the terminal globe and its settlement addresses.
 * Land remains land as the studio grows: population adds cities, never tiles
 * over the ocean. The shapes are authored continents, not a claim to GIS data. */
export type GlobeVector = [number, number, number]
const continents = [
  [.45,.48,.56,.64], [.70,-.43,.27,.58], [-.35,.55,.30,.22],
  [-.22,-.03,.36,.49], [-1.04,.40,.78,.38], [-1.40,-.53,.35,.23],
  [2.5,.22,.55,.64], [2.10,-.60,.31,.24],
]
export function terrainAt([x,y,z]: readonly number[]) {
  const lon=Math.atan2(x,z),lat=Math.asin(Math.max(-1,Math.min(1,y)))
  let field=-10
  for(const [a,b,w,h] of continents) {
    const dx=Math.atan2(Math.sin(lon-a),Math.cos(lon-a))/w,dy=(lat-b)/h
    field=Math.max(field,1-dx*dx-dy*dy)
  }
  const coast=Math.sin(lon*23+lat*11)*.09+Math.sin(lon*41-lat*29)*.045+Math.sin(lat*37)*.045
  return { land:field+coast>0, coast:field+coast, ice:Math.abs(lat)>1.32, latitude:lat }
}
function direction(lon:number,lat:number):GlobeVector {return [Math.sin(lon)*Math.cos(lat),Math.sin(lat),Math.cos(lon)*Math.cos(lat)]}
const hubs=[[.48,.25],[-.22,.26],[-.95,.48],[2.45,.3],[-1.4,-.5]].map(([lon,lat])=>direction(lon,lat))
/** Equal-area candidates avoid polar clumps. Successive hub waves produce
 * regional growth rather than filling latitude rows or six cube faces. */
export function settlementScore(p: readonly number[]): number {
  return Math.min(...hubs.map((hub,j)=>Math.acos(Math.max(-1,Math.min(1,p[0]*hub[0]+p[1]*hub[1]+p[2]*hub[2])))+[0,.4,.75,1.05,1.2][j]))
}
export function settlementSites(count:number):GlobeVector[] {
  const candidates:GlobeVector[]=[]
  for(let i=0;i<20000;i++) {
    const y=1-2*(i+.5)/20000,angle=i*2.399963229728653,r=Math.sqrt(1-y*y)
    const p:GlobeVector=[Math.cos(angle)*r,y,Math.sin(angle)*r]
    const t=terrainAt(p);if(t.land&&!t.ice&&t.coast>.045)candidates.push(p)
  }
  const chosen=Array.from({length:count},(_,i)=>candidates[Math.floor(i*candidates.length/count)])
  return chosen.sort((a,b)=>settlementScore(a)-settlementScore(b))
}
