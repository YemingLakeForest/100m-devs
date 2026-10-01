import { colonyTerrainAt, planetKind } from './colonyTerrain.ts'
import land from './earthLand.json'
/** Natural Earth 1:110m land, public domain. The compact scanlines retain real
 * coastlines without a network request or a GIS dependency at runtime. */
export type GlobeVector = [number, number, number]
const mask=new Uint8Array(land.width*land.height)
land.rows.forEach((row,y)=>{const a=row.split('.').map(v=>parseInt(v,36));for(let i=0;i<a.length;i+=2)mask.fill(1,y*land.width+a[i],y*land.width+a[i]+a[i+1])})
export function direction(lon:number,lat:number):GlobeVector {
  const a=lon*Math.PI/180,b=lat*Math.PI/180
  return [Math.sin(a)*Math.cos(b),Math.sin(b),Math.cos(a)*Math.cos(b)]
}
export function terrainAt([x,y,z]: readonly number[],world=0) {
  if(world>0)return colonyTerrainAt([x,y,z],world)
  const lon=Math.atan2(x,z),lat=Math.asin(Math.max(-1,Math.min(1,y)))
  const col=Math.min(land.width-1,Math.max(0,Math.floor((lon/Math.PI+1)*land.width/2)))
  const row=Math.min(land.height-1,Math.max(0,Math.floor((.5-lat/Math.PI)*land.height)))
  const filled=mask[row*land.width+col]===1
  const coast=filled&&(mask[row*land.width+(col+1)%land.width]===0||mask[row*land.width+(col+land.width-1)%land.width]===0||mask[Math.max(0,row-1)*land.width+col]===0||mask[Math.min(land.height-1,row+1)*land.width+col]===0)
  return {land:filled,coast:filled?(coast?.02:.1):-.1,ice:Math.abs(lat)>1.31,latitude:lat,relief:0,detail:0}
}
/** Authored expansion order: London first, nearby centres, then overseas hubs.
 * Names identify a region of the miniature, not simulated real-world population. */
export const EARTH_HUBS:readonly (readonly [string,number,number])[]=[
  ['London',-.12,51.5],['Paris',2.35,48.85],['Berlin',13.4,52.5],['New York',-74,40.7],
  ['Boston',-71.1,42.36],['Toronto',-79.38,43.65],['San Francisco',-122.42,37.77],['Seattle',-122.33,47.6],
  ['Bengaluru',77.59,12.97],['Mumbai',72.88,19.08],['Singapore',103.82,1.35],['Tokyo',139.69,35.68],
  ['Seoul',126.98,37.56],['Shanghai',121.47,31.23],['Taipei',121.56,25.03],['Sydney',151.21,-33.87],
  ['Melbourne',144.96,-37.81],['Jakarta',106.85,-6.21],['Nairobi',36.82,-1.29],['Cape Town',18.42,-33.92],
  ['Lagos',3.38,6.52],['Cairo',31.24,30.04],['Dubai',55.27,25.2],['Istanbul',28.98,41.01],
  ['Madrid',-3.7,40.42],['Stockholm',18.07,59.33],['Mexico City',-99.13,19.43],['Sao Paulo',-46.63,-23.55],
  ['Buenos Aires',-58.38,-34.6],['Santiago',-70.67,-33.45],
]
const hubCache=new Map<number,readonly (readonly [string,number,number])[]>()
export function planetHubs(world=0):readonly (readonly [string,number,number])[] {
  if(!world)return EARTH_HUBS
  const cached=hubCache.get(world);if(cached)return cached
  const nouns={rock:'Basin',desert:'Mesa',ocean:'Haven',ice:'Shelf',earth:'City'}
  const candidates:Array<[string,number,number]>=[]
  for(let i=0;i<1200;i++) {
    const lat=Math.asin(1-2*(i+.5)/1200)*180/Math.PI,lon=((i*137.50776+world*71)%360)-180
    if(Math.abs(lat)>70||!terrainAt(direction(lon,lat),world).land)continue
    candidates.push(['',lon,lat])
  }
  const result:Array<[string,number,number]>=[]
  let origin=direction(0,20)
  while(result.length<30&&candidates.length) {
    candidates.sort((a,b)=>{
      const score=(q:typeof a)=>direction(q[1],q[2]).reduce((sum,v,i)=>sum+(v-origin[i])**2,0)
      return score(a)-score(b)
    })
    const next=candidates.shift()!;origin=direction(next[1],next[2])
    next[0]=result.length===0?'First Landing':nouns[planetKind(world)]+' '+String(result.length+1).padStart(2,'0')
    result.push(next)
    for(let i=candidates.length-1;i>=0;i--)if(direction(candidates[i][1],candidates[i][2]).reduce((sum,v,j)=>sum+(v-origin[j])**2,0)<.13)candidates.splice(i,1)
  }
  hubCache.set(world,result);return result
}
export function settlementLayout(count:number,world=0) {
  const sites:{point:GlobeVector;hub:number;order:number}[]=[]
  const perHub=Math.ceil(count/planetHubs(world).length)
  planetHubs(world).forEach(([,lon,lat],hub)=>{
    let accepted=0
    for(let k=0;accepted<perHub&&k<10000;k++) {
      const radius=.18*Math.sqrt(k),angle=k*2.399963229728653
      const point=direction(lon+Math.cos(angle)*radius/Math.cos(lat*Math.PI/180),lat+Math.sin(angle)*radius)
      if(!terrainAt(point,world).land)continue
      sites.push({point,hub,order:hub*.72+accepted/perHub});accepted++
    }
  })
  return sites.sort((a,b)=>a.order-b.order).slice(0,count)
}
export function settlementSites(count:number):GlobeVector[] {return settlementLayout(count).map(s=>s.point)}
