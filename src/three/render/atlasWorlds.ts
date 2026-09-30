import { RAMPS } from '../../art/palette.ts'
import { mixHex, type PhosphorRamp } from '../../art/entropyTheme.ts'
import { globeCell, regionHouses, regionPopulation, worldPopulation, WORLD_REGIONS } from '../../sim/worldAddress.ts'
import { monitorText } from './monitorText.ts'
import { districtBlock, BLOCK_PITCH } from './cityGrid.ts'
import type { CityImpostors } from './cityImpostors.ts'

export interface AtlasPoint { x: number; y: number; id: number; depth: number }
export interface Expansion { from: number; to: number; at: number }
export interface AtlasFrame {
  ctx: CanvasRenderingContext2D; width: number; height: number; total: number; world: number
  region: number; level: number; panX: number; panY: number; seconds: number; reduced: boolean
  phosphor: PhosphorRamp; points: AtlasPoint[]; expansions: Expansion[]
}
const N = RAMPS.NEUTRAL, W = RAMPS.WOOD, F = RAMPS.FOLIAGE, A = RAMPS.WARN
const TAU = Math.PI * 2
function polygon(ctx: CanvasRenderingContext2D, vertices: number[][], fill: string) {
  ctx.fillStyle = fill; ctx.beginPath()
  vertices.forEach(([x, y], i) => i ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y)))
  ctx.closePath(); ctx.fill()
}
function line(ctx: CanvasRenderingContext2D, a: number[], b: number[], colour: string) {
  ctx.strokeStyle = colour; ctx.beginPath(); ctx.moveTo(Math.round(a[0]), Math.round(a[1])); ctx.lineTo(Math.round(b[0]), Math.round(b[1])); ctx.stroke()
}
export function atlasCaption(f: AtlasFrame, title: string, detail: string) {
  const { ctx, width, height } = f, compact = height < 160, y = compact ? 31 : Math.round(height * .81)
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
  const scale = Math.min(width / (compact ? 38 : 24), height / (compact ? 25 : 16)) * Math.pow(2, 3.2-level)
  const cx=width*.5+f.panX, cy=height*(height<160 ? .48 : .46)+f.panY
  const at=(i:number)=>{ const b=districtBlock(i); return { x:cx+(b.x-b.z)/BLOCK_PITCH*scale, y:cy+(b.x+b.z)/BLOCK_PITCH*scale/Math.sqrt(3), order:b.x+b.z } }
  const drawWidth=sprites.worldWidth/(BLOCK_PITCH/Math.sqrt(2))*scale, drawHeight=drawWidth*sprites.height/sprites.width
  ctx.imageSmoothingEnabled=false
  const houses=Array.from({length:Math.min(count,occupied+8)},(_,i)=>({i,...at(i+1)})).sort((a,b)=>a.order-b.order)
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
    ctx.fillStyle=N[0];ctx.fillRect(Math.round(cx-7),Math.round(cy-5),15,8)
    ctx.fillStyle=p[2];ctx.textAlign='center';monitorText(ctx,'HQ',cx,cy+1);ctx.textAlign='left'
  }
  if(!f.reduced&&occupied>20)for(let car=0;car<Math.min(5,Math.floor(occupied/40));car++){
    const index=1+Math.floor((f.seconds*.4+car*19)%occupied),q=at(index)
    if(q.y<40||q.y>height*.75)continue
    ctx.fillStyle=car%2?A[3]:p[2];ctx.fillRect(Math.round(q.x+scale*.5),Math.round(q.y+scale*.29),1,1)
  }
  atlasCaption(f,`${regionPopulation(total,world,region).toLocaleString()} DEVELOPERS AT HOME`,`${occupied} / ${count} HOUSES LIT · TAP TO VISIT`)
}

/** Corners, rather than oversized face-on squares, preserve the cube-sphere
 * surface. The land pattern is fictional terrain; no population is implied. */
function sphereVertex(face: number, a: number, b: number): number[] {
  const v = [[a,b,1],[1,b,-a],[-a,b,-1],[-1,b,a],[a,1,-b],[a,-1,b]][face]
  const length = Math.hypot(...v); return v.map(n => n / length)
}
const CELLS = Array.from({ length: WORLD_REGIONS }, (_, id) => {
  const face = Math.floor(id / 400), u = id % 20, v = Math.floor(id % 400 / 20), center = globeCell(id)
  const corners = [[.09,.09],[.91,.09],[.91,.91],[.09,.91]].map(([du,dv]) => sphereVertex(face, (u + du) / 10 - 1, (v + dv) / 10 - 1))
  const [a,b,c] = center, terrain = Math.sin(a * 7 + c * 3) + Math.cos(b * 9 - a * 2) + Math.sin(c * 11 + b * 4) * .5
  return { id, center, corners, land: terrain > -.25, polar: Math.abs(b) > .85 }
})
export function drawGlobe(f: AtlasFrame, yaw: number, tilt: number) {
  const { ctx, width, height, world, total, phosphor: p } = f
  const radius = Math.min(width * .29, height * (height < 160 ? .185 : .285)) * Math.pow(1.45, 5 - f.level)
  const cx = width * .5, cy = height * (height < 160 ? .48 : .45), population = worldPopulation(total, world)
  const transform = ([a,b,c]: number[]) => {
    const x = a * Math.cos(yaw) + c * Math.sin(yaw), z = c * Math.cos(yaw) - a * Math.sin(yaw)
    const y = b * Math.cos(tilt) - z * Math.sin(tilt), depth = z * Math.cos(tilt) + b * Math.sin(tilt)
    return { x: cx + x * radius, y: cy - y * radius, depth }
  }
  // Segmented completion orbit: filling the world visibly builds the ring.
  for (let segment = 0; segment < 80; segment++) {
    const a = segment / 80 * TAU, b = a + .045
    ctx.strokeStyle = segment / 80 < population / 1e8 ? A[2] : N[2]
    line(ctx, [cx + Math.cos(a) * (radius + 10), cy + Math.sin(a) * (radius + 10)], [cx + Math.cos(b) * (radius + 10), cy + Math.sin(b) * (radius + 10)], ctx.strokeStyle)
  }
  ctx.fillStyle = N[0]; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.fill()
  ctx.strokeStyle = RAMPS.GLOW[0]; ctx.beginPath(); ctx.arc(cx, cy, radius + 2, 0, TAU); ctx.stroke()
  const terrain = [N[2], F[0], RAMPS.GLOW[0], N[5]]
  const colours = terrain.map(c => [mixHex(N[0], c, .5), mixHex(N[0], c, .7), c])
  const settlements = [W[0], W[1], W[2]], roofs = [N[2], N[3], N[4]]
  const visible = CELLS.map(cell => ({ ...cell, at: transform(cell.center) })).filter(c => c.at.depth > 0).sort((a,b) => a.at.depth - b.at.depth)
  let completed = 0
  for (const cell of CELLS) { const range = regionHouses(cell.id); if (population >= range.end * 100) completed++ }
  for (const cell of visible) {
    const q = cell.at, corners = cell.corners.map(transform)
    if (corners.some(v => v.depth < -.035)) continue
    const pop = regionPopulation(total, world, cell.id), shade = q.depth > .75 ? 2 : q.depth > .32 ? 1 : 0
    const base = cell.polar ? 3 : cell.land ? 1 : 2
    polygon(ctx, corners.map(v => [v.x,v.y]), pop ? (cell.id % 3 === 0 ? settlements[shade] : roofs[shade]) : colours[base][shade])
    if (pop) {
      // Warm light is the same occupied-window cue as a house or district.
      const range = regionHouses(cell.id), fill = pop / ((range.end - range.first) * 100)
      ctx.fillStyle = fill > .98 ? A[3] : W[3]
      if (radius > 45 || cell.id % 7 === 0) ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1)
      if (radius > 45 && cell.id % 29 === 0 && q.depth > .3) { const top = [q.x + (q.x - cx) * .035, q.y + (q.y - cy) * .035 - 2]; line(ctx, [q.x,q.y], top, N[6]); ctx.fillStyle = p[2]; ctx.fillRect(Math.round(top[0]),Math.round(top[1]),1,1) }
      f.points.push({ ...q, id: cell.id })
      pulse(f, q.x, q.y, world * 1e8 + range.first * 100, world * 1e8 + range.end * 100)
    }
  }
  // The population ring remains readable even if new territory is on the far side.
  atlasCaption(f, width < 300 ? `${(population / 1e6).toFixed(1)}M / 100M · ${completed} DISTRICTS` : `${(population / 1e6).toFixed(1)}M / 100M · ${completed} DISTRICTS COMPLETE`, 'DRAG TO TURN · TAP A SETTLEMENT')
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
