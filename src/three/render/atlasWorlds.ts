import { RAMPS } from '../../art/palette.ts'
import { mixHex, type PhosphorRamp } from '../../art/entropyTheme.ts'
import { globeCell, regionHouses, regionPopulation, worldPopulation, WORLD_REGIONS, cityName, globeHub } from '../../sim/worldAddress.ts'
import { monitorText } from './monitorText.ts'
import { districtBlock, BLOCK_PITCH } from './cityGrid.ts'
import type { CityImpostors } from './cityImpostors.ts'
import { planetHubs } from '../../sim/planetTerrain.ts'
import { paintPlanet } from './planetSurface.ts'
import { hqMarker, type HqWing } from '../../sim/hqLook.ts'

export interface AtlasPoint { x: number; y: number; id: number; depth: number }
export interface Expansion { from: number; to: number; at: number }
export interface AtlasFrame {
  ctx: CanvasRenderingContext2D; width: number; height: number; total: number; world: number
  region: number; level: number; panX: number; panY: number; seconds: number; reduced: boolean
  phosphor: PhosphorRamp; points: AtlasPoint[]; expansions: Expansion[]
  /** The heroes who have walked in — the colours the HQ wears (`sim/hqLook.ts`). */
  wings: HqWing[]
}

/**
 * The HQ's mark on the survey [2026-10-04, GDD §7.8.12]: its label in a box that
 * gains borders as it becomes a place, a crown over it from the capital up, and
 * a pip underneath for each hero who has walked in, in the colour that is theirs
 * on the card, the plate and the garage's bay. Drawn from `hqMarker`, which owns
 * how big the HQ is at a headcount; this only paints what it says.
 */
export function drawHqMark(f: AtlasFrame, cx: number, cy: number, label: string, ink: string) {
  const { ctx } = f
  const m = hqMarker(f.total, f.wings.map((w) => w.hero))
  const w = Math.max(15, label.length * 4 + 3)
  ctx.fillStyle = N[0]; ctx.fillRect(Math.round(cx - w / 2), Math.round(cy - 5), w, 8)
  for (let b = 0; b < m.borders; b++) {
    ctx.strokeStyle = b === 0 ? ink : A[2]
    ctx.strokeRect(Math.round(cx - w / 2) - b * 2 - .5, Math.round(cy - 5) - b * 2 - .5, w + b * 4 + 1, 8 + b * 4 + 1)
  }
  ctx.fillStyle = ink; ctx.textAlign = 'center'; monitorText(ctx, label, cx, cy + 1); ctx.textAlign = 'left'
  if (m.crown) { ctx.fillStyle = A[3]; ctx.fillRect(Math.round(cx) - 2, Math.round(cy - 5) - m.borders * 2 - 2, 5, 1); ctx.fillRect(Math.round(cx) - 2, Math.round(cy - 5) - m.borders * 2 - 3, 1, 1); ctx.fillRect(Math.round(cx), Math.round(cy - 5) - m.borders * 2 - 3, 1, 1); ctx.fillRect(Math.round(cx) + 2, Math.round(cy - 5) - m.borders * 2 - 3, 1, 1) }
  const pipsLeft = Math.round(cx - (m.wings.length * 3 - 1) / 2)
  m.wings.forEach((wing, i) => { ctx.fillStyle = wing.colour; ctx.fillRect(pipsLeft + i * 3, Math.round(cy + 3) + m.borders * 2, 2, 2) })
}
const N = RAMPS.NEUTRAL, A = RAMPS.WARN
const TAU = Math.PI * 2
const CITY_LIGHT = mixHex(RAMPS.NEUTRAL[4], RAMPS.WARN[1], .65)
function line(ctx: CanvasRenderingContext2D, a: number[], b: number[], colour: string) {
  ctx.strokeStyle = colour; ctx.beginPath(); ctx.moveTo(Math.round(a[0]), Math.round(a[1])); ctx.lineTo(Math.round(b[0]), Math.round(b[1])); ctx.stroke()
}
export function atlasCaption(f: AtlasFrame, title: string, detail: string) {
  const { ctx, width, height } = f, compact = height < 160, y = compact ? 31 : Math.min(Math.round(height * .81), height - 53)
  if (compact && f.expansions.some(e => f.seconds - e.at < 2.8)) return
  const boxWidth = Math.min(width * .64, Math.max(title.length, detail.length) * 4 + 18)
  ctx.fillStyle = N[0]; ctx.fillRect(Math.round((width - boxWidth) / 2), y - 7, boxWidth, compact ? 9 : 20)
  ctx.textAlign = 'center'; ctx.fillStyle = A[3]; monitorText(ctx, title, width / 2, y)
  if (!compact) { ctx.fillStyle = N[5]; monitorText(ctx, detail, width / 2, y + 9) }; ctx.textAlign = 'left'
}
/** Feedback belongs to the changed address, never to an unrelated random tile. */
function pulse(f: AtlasFrame, x: number, y: number, first: number, end: number) {
  if (f.reduced) return
  for (const growth of f.expansions) {
    if (growth.to <= first || growth.from >= end) continue
    const changed = Math.ceil((growth.to - growth.from) / (end - first))
    if (Math.floor(first / (end - first)) % Math.max(1, Math.ceil(changed / 8)) !== 0) continue
    const t = f.seconds - growth.at
    if (t < 0 || t > 2.4) continue
    const { ctx } = f
    ctx.globalAlpha = (1 - t / 2.4) * .8; ctx.strokeStyle = A[3]
    ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), 3 + t * 9, 1 + t * 4, 0, 0, TAU); ctx.stroke()
    ctx.fillStyle = A[3]; ctx.fillRect(Math.round(x), Math.round(y - t * 8 - 3), 1, 2)
    ctx.globalAlpha = 1
  }
}

/** A district is the same converted workshops seen at a smaller scale. Streets,
 * roof variants and warm occupied windows survive the change in representation. */
export function drawDistrict(f: AtlasFrame, sprites: CityImpostors) {
  const { ctx, width, height, total, world, region, level, phosphor: p } = f
  const range = regionHouses(region), count = range.end - range.first, population = worldPopulation(total, world)
  const occupied = Math.max(0, Math.min(count, Math.ceil(population / 100) - range.first))
  // Match the true-isometric near camera, including its 3 m streets. Zoom
  // reveals more of the same grid, rather than fitting a separate board.
  const compact = height < 160
  const bounds=Array.from({length:Math.max(1,occupied)},(_,i)=>districtBlock(i+1))
  const xs=bounds.map(b=>(b.x-b.z)/BLOCK_PITCH),ys=bounds.map(b=>(b.x+b.z)/BLOCK_PITCH/Math.sqrt(3))
  const fit=Math.min(width*(compact?.47:.60)/(Math.max(...xs)-Math.min(...xs)+3),height*(compact?.35:.56)/(Math.max(...ys)-Math.min(...ys)+3))
  const scale = Math.min(Math.min(width / (compact ? 38 : 24), height / (compact ? 25 : 16)) * Math.pow(2, 3.2-level),fit*Math.pow(2,3.7-level))
  const cx=width*.5+f.panX, cy=height*(height<160 ? .48 : .46)+f.panY
  const at=(i:number)=>{ const b=districtBlock(i); return { x:cx+(b.x-b.z)/BLOCK_PITCH*scale, y:cy+(b.x+b.z)/BLOCK_PITCH*scale/Math.sqrt(3), order:b.x+b.z } }
  const drawWidth=sprites.worldWidth/(BLOCK_PITCH/Math.sqrt(2))*scale, drawHeight=drawWidth*sprites.height/sprites.width
  ctx.save();ctx.beginPath();ctx.rect(width*(compact?.25:.19),34,width*(compact?.5:.62),height*.78-34);ctx.clip()
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high'
  const houses=Array.from({length:Math.min(count,occupied+8)},(_,i)=>({i,...at(i+1)})).sort((a,b)=>a.order-b.order)
  // Broader pedestrian avenues connect the blocks into a campus. Furniture
  // grows only along occupied rows, so expansion earns public space as well.
  ctx.save();ctx.strokeStyle=N[2];ctx.lineWidth=Math.max(1,scale*.18)
  const rows=new Map<number,typeof houses>()
  for(const q of houses)if(q.i<occupied){const z=districtBlock(q.i+1).z;const row=rows.get(z)??[];row.push(q);rows.set(z,row)}
  for(const row of rows.values()) {
    row.sort((a,b)=>a.x-b.x)
    for(let j=1;j<row.length;j++) {
      const a=row[j-1],b=row[j]
      if(b.x-a.x>scale*1.1) {
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()
        const x=(a.x+b.x)/2,y=(a.y+b.y)/2
        ctx.fillStyle=RAMPS.FOLIAGE[0];ctx.fillRect(Math.round(x-1),Math.round(y-1),2,2)
      }
    }
  }
  ctx.restore()
  for(const q of houses) {
    const house=range.first+q.i, fill=Math.max(0,Math.min(100,population-house*100))
    if(q.x<-drawWidth||q.x>width+drawWidth||q.y<34||q.y>height*.79)continue
    if(!fill) {
      ctx.globalAlpha=.3; line(ctx,[q.x-scale*.6,q.y],[q.x,q.y+scale*.35],N[3]); line(ctx,[q.x,q.y+scale*.35],[q.x+scale*.6,q.y],N[3]); ctx.globalAlpha=1
      continue
    }
    const first=world*1e8+house*100
    const born=f.reduced?undefined:f.expansions.find(e=>e.from<=first&&e.to>first)
    const age=born?Math.max(0,f.seconds-born.at-(q.i%7)*.035):2
    const lift=Math.pow(Math.max(0,1-age/.7),3)*13
    ctx.drawImage(sprites.houses[house%3][Math.ceil(fill/25)],Math.round(q.x-drawWidth/2),Math.round(q.y-drawHeight/2-lift),Math.round(drawWidth),Math.round(drawHeight))
    f.points.push({x:q.x,y:q.y-2,id:house,depth:0})
    pulse(f,q.x,q.y,first,first+100)
    // A completed group earns a street beacon at its actual outer address.
    if(q.i%50===49&&fill===100) {
      const x=q.x+scale*.8,y=q.y+scale*.2
      line(ctx,[x,y],[x,y-4],N[4]);ctx.fillStyle=A[3];ctx.fillRect(Math.round(x-1),Math.round(y-4),2,1)
    }
  }
  if(world===0&&region===0) {
    drawHqMark(f,cx,cy,'HQ',p[2])
  }
  if(!f.reduced&&occupied>20)for(let car=0;car<Math.min(5,Math.floor(occupied/40));car++){
    const index=1+Math.floor((f.seconds*.4+car*19)%occupied),q=at(index)
    if(q.y<40||q.y>height*.75)continue
    ctx.fillStyle=car%2?A[3]:p[2];ctx.fillRect(Math.round(q.x+scale*.5),Math.round(q.y+scale*.29),1,1)
  }
  ctx.restore()
  atlasCaption(f,`${regionPopulation(total,world,region).toLocaleString()} DEVELOPERS ONLINE`,`${occupied} / ${count} OFFICES ONLINE · SELECT TO VISIT`)
}

const worldCells=new Map<number,{id:number;center:[number,number,number]}[]>()
export function drawGlobe(f: AtlasFrame, yaw: number, tilt: number, selected = -1) {
  const {ctx,width,height,world,total}=f
  const compact=height<160
  const radius=Math.min(width*.27,height*(compact?.205:.285))*Math.pow(1.45,5-f.level)
  const cx=width*.5,cy=height*(compact?.48:.45),population=worldPopulation(total,world)
  const transform=([a,b,c]:readonly number[])=>{
    const x=a*Math.cos(yaw)+c*Math.sin(yaw),z=c*Math.cos(yaw)-a*Math.sin(yaw)
    const y=b*Math.cos(tilt)-z*Math.sin(tilt),depth=z*Math.cos(tilt)+b*Math.sin(tilt)
    return {x:cx+x*radius,y:cy-y*radius,depth}
  }
  if(!worldCells.has(world))worldCells.set(world,Array.from({length:WORLD_REGIONS},(_,id)=>({id,center:globeCell(id,world)})))
  const live=worldCells.get(world)!.filter(cell=>regionPopulation(total,world,cell.id)>0)
  const last=live[live.length-1]
  paintPlanet(ctx,cx,cy,radius,yaw,tilt,world)
  const visible=live.map(cell=>({...cell,at:transform(cell.center)})).filter(c=>c.at.depth>.015)
  const hubs=planetHubs(world).map((_,id)=>{
    const cells=live.filter(c=>globeHub(c.id,world)===id),anchor=cells[0]
    return {id,cells,anchor,pop:cells.reduce((sum,c)=>sum+regionPopulation(total,world,c.id),0)}
  }).filter(h=>h.anchor)
  // Great-circle connections grow between real regional hubs. New links carry
  // one brief packet; the established route stays faint enough to leave oceans quiet.
  for(let j=1;j<hubs.length;j++) {
    const hub=hubs[j],from=hubs[Math.max(0,j-1)].anchor.center,to=hub.anchor.center
    const born=f.expansions.find(e=>e.from<=world*1e8+regionHouses(hub.anchor.id).first*100&&e.to>world*1e8+regionHouses(hub.anchor.id).first*100)
    const age=born?f.seconds-born.at:10
    ctx.save();ctx.strokeStyle=A[2];ctx.globalAlpha=age<2.4?.65:.13;ctx.lineWidth=.5
    ctx.beginPath();let drawing=false
    for(let k=0;k<=40;k++) {
      const t=k/40,v=from.map((n,i)=>n*(1-t)+to[i]*t),length=Math.hypot(...v)
      const q=transform(v.map(n=>n/length)),lift=1+.065*Math.sin(Math.PI*t)
      const x=cx+(q.x-cx)*lift,y=cy+(q.y-cy)*lift
      if(q.depth<.025){drawing=false;continue}
      if(drawing)ctx.lineTo(x,y);else ctx.moveTo(x,y)
      drawing=true
      if(!f.reduced&&age<2.4&&Math.abs(t-age/2.4)<.015){ctx.fillStyle=A[3];ctx.fillRect(x-1,y-1,2,2)}
    }
    ctx.stroke();ctx.restore()
  }
  for(const hub of hubs) {
    const q=transform(hub.anchor.center);if(q.depth<.02)continue
    const growth=Math.min(1,hub.pop/2.5e6),r=(1.5+growth*4)*Math.sqrt(q.depth)
    ctx.save();const halo=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,r*2.2)
    halo.addColorStop(0,'#e0a52e70');halo.addColorStop(.35,'#e0a52e24');halo.addColorStop(1,'#e0a52e00')
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(q.x,q.y,r*2.2,0,TAU);ctx.fill();ctx.restore()
  }
  for(const cell of visible) {
    const range=regionHouses(cell.id),q=cell.at,fill=regionPopulation(total,world,cell.id)/((range.end-range.first)*100)
    f.points.push({...q,id:cell.id})
    ctx.fillStyle=cell.id%7===0?A[3]:CITY_LIGHT
    ctx.globalAlpha=(.35+q.depth*.6)*Math.max(.25,fill)
    const size=cell.id%7===0?.8:.45
    ctx.fillRect(q.x,q.y,size,size);ctx.globalAlpha=1
    pulse(f,q.x,q.y,world*1e8+range.first*100,world*1e8+range.end*100)
  }
  // Progress is an instrument outside the globe, not a painted ownership area.
  for(let i=0;i<50;i++) {
    const a=-Math.PI*.85+i/49*Math.PI*1.7
    const r=radius+7
    ctx.strokeStyle=i/50<population/1e8?A[2]:N[2]
    line(ctx,[cx+Math.cos(a)*r,cy+Math.sin(a)*r],[cx+Math.cos(a)*(r+2),cy+Math.sin(a)*(r+2)],ctx.strokeStyle)
  }
  // A few readable pins lead the eye; every small light remains selectable.
  // Prioritise the chosen address and active frontier, then well-spaced cities.
  const candidates=[selected,0,last?.id??-1,...hubs.map(h=>h.anchor.id)]
  const labels:{x:number;y:number;w:number}[]=[]
  const labelledHubs=new Set<number>()
  for(const id of [...new Set(candidates)]) {
    const city=visible.find(c=>c.id===id);if(!city||labelledHubs.has(globeHub(id,world)))continue
    const q=city.at,name=planetHubs(world)[globeHub(id,world)][0],caption=(id===selected?'> ':id===last?.id&&id!==0?'+ ':'')+name+(id===0&&world===0?' HQ':''),bw=caption.length*4+6
    const placements=[[q.x+7,q.y-8],[q.x-bw-7,q.y+12],[q.x+7,q.y+25],[q.x-bw-7,q.y-24]].map(([x,y])=>({x:Math.max(width*.20,Math.min(width*.80-bw,x)),y:compact?Math.max(46,Math.min(height*.64,y)):y}))
    const placed=placements.find(b=>!labels.some(a=>Math.abs(a.y-b.y)<14&&b.x<a.x+a.w+5&&b.x+bw>a.x-5))
    if(!placed&&id!==selected)continue
    const lx=(placed??placements[0]).x,ly=(placed??placements[0]).y
    if(labels.length>=(compact?1:3))break
    labels.push({x:lx,y:ly,w:bw});labelledHubs.add(globeHub(id,world))
    ctx.strokeStyle=id===selected?A[3]:N[5];ctx.beginPath();ctx.arc(q.x,q.y,id===selected?4:2.5,0,TAU);ctx.stroke()
    line(ctx,[q.x+3,q.y],[lx,ly-2],ctx.strokeStyle)
    ctx.fillStyle=N[0];ctx.fillRect(Math.round(lx),Math.round(ly-7),bw,10)
    ctx.fillStyle=id===selected?A[3]:N[6];monitorText(ctx,caption,lx+3,ly)
    // Tapping the callout selects the same address as its surface marker.
    f.points.push({x:lx+bw/2,y:ly-2,id,depth:q.depth})
  }
  atlasCaption(f,(population<1e6?population.toLocaleString():(population/1e6).toFixed(1)+'M')+' / 100M · '+hubs.length+(hubs.length===1?' HUB':' HUBS'),selected>=0?'SELECTED: '+cityName(selected,world):'> SELECT A CITY · SCROLL TO DESCEND')
}

/** A short, action-driven receipt makes an expansion legible even when the
 * affected address is behind the globe. Reduced motion keeps the receipt. */
export function drawExpansionReceipt(f: AtlasFrame) {
  const recent = f.expansions[f.expansions.length - 1]
  if (!recent || f.seconds - recent.at > 2.8) return
  const before = Math.floor(recent.from / 100), after = Math.floor(recent.to / 100)
  const worldBefore = Math.floor(recent.from / 1e8), worldAfter = Math.floor(recent.to / 1e8)
  const message = worldAfter > worldBefore ? 'WORLD COMPLETE' : after > before ? '+' + (after-before).toLocaleString() + ' HOUSES ONLINE' : '+' + (recent.to-recent.from).toLocaleString() + ' DEVELOPERS'
  const { ctx, width } = f, length = message.length * 4 + 14
  ctx.fillStyle = N[0]; ctx.fillRect(Math.round((width-length)/2), 27, length, 13)
  ctx.fillStyle = A[3]; ctx.textAlign = 'center'; monitorText(ctx, message, width / 2, 36); ctx.textAlign = 'left'
}
