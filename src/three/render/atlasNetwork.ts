import { RAMPS } from '../../art/palette.ts'
import { mixHex } from '../../art/entropyTheme.ts'
import { extendNetwork, WORLD_SEATS, type Network } from '../../sim/colonyNetwork.ts'
import { atlasCaption, type AtlasFrame } from './atlasWorlds.ts'
import { monitorText } from './monitorText.ts'
import { placeMapLabel, type LabelBox } from './mapLabels.ts'
const N = RAMPS.NEUTRAL, A = RAMPS.WARN, TAU = Math.PI * 2

/** A navigable chart: one connected territory, sparse routes and a small label
 * budget. All systems remain hit targets; choosing one always reveals its name. */
export function drawNetwork(f: AtlasFrame, net: Network, chosen: number, territory: HTMLCanvasElement, mask: CanvasRenderingContext2D) {
  const { ctx, width, height, total, phosphor: p } = f
  const settled = Math.max(1, Math.ceil(total / WORLD_SEATS))
  const fit = Math.max(13, ...net.order.slice(0, Math.min(settled + 1, net.order.length, 420)).map(id => net.systems[id].ly))
  const scale = Math.min(width * .31, height * (height < 160 ? .18 : .285)) / fit * Math.pow(2, 6.3 - f.level)
  const visibleRadius = Math.hypot(width / 2 + Math.abs(f.panX), height / 2 + Math.abs(f.panY)) / scale + 8
  const wanted = 420 + Math.max(0, Math.ceil((visibleRadius - 95) / 28)) * 64
  extendNetwork(net, Math.min(wanted, net.order.length + 64))
  const project = (i: number) => ({ x: width * .5 + net.systems[i].x * scale + f.panX, y: height * (height < 160 ? .47 : .45) + net.systems[i].z * scale + f.panY })
  const on = (i: number) => net.worldOf[i] < settled
  const nearFrontier = new Set<number>()
  for (let i = 0; i < Math.min(settled, net.order.length); i++) for (const j of net.neighbours[net.order[i]]) if (!on(j)) nearFrontier.add(j)
  const radius = Math.max(2.5, 3.1 * scale)
  // A quiet border leaves route and symbol contrast for the information inside.
  for (const inset of [false, true]) {
    mask.clearRect(0,0,width,height); mask.fillStyle = mask.strokeStyle = inset ? mixHex(N[0], p[0], .4) : mixHex(N[3], p[1], .25); mask.lineCap = 'round'
    mask.lineWidth = (radius + (inset ? 0 : 1)) * 2
    for (const [a,b] of net.lanes) if (on(a) && on(b)) { const u = project(a), v = project(b); mask.beginPath(); mask.moveTo(u.x,u.y); mask.lineTo(v.x,v.y); mask.stroke() }
    for (let rank = 0; rank < Math.min(settled, net.order.length); rank++) { const q = project(net.order[rank]); mask.beginPath(); mask.arc(q.x,q.y,radius + (inset ? 0 : 1),0,TAU); mask.fill() }
    ctx.drawImage(territory,0,0)
  }
  for (const [a,b] of net.lanes) {
    const live = on(a) && on(b), parent = net.parent[a] === b || net.parent[b] === a, selected = a === chosen || b === chosen
    if (!live && !(on(a) && nearFrontier.has(b)) && !(on(b) && nearFrontier.has(a))) continue
    if (live && !parent && !selected) continue
    const u = project(a), v = project(b)
    ctx.globalAlpha = selected ? .9 : live ? .4 : .15; ctx.strokeStyle = selected ? p[2] : N[5]
    ctx.beginPath(); ctx.moveTo(Math.round(u.x),Math.round(u.y)); ctx.lineTo(Math.round(v.x),Math.round(v.y)); ctx.stroke(); ctx.globalAlpha = 1
    // A hire travels only toward systems whose population actually changed.
    if (!f.reduced && live && f.expansions.some(e => f.seconds - e.at < 3 && e.to > net.worldOf[b] * WORLD_SEATS && e.from < (net.worldOf[b] + 1) * WORLD_SEATS)) {
      const t = (f.seconds * .6 + b * .17) % 1; ctx.fillStyle = A[3]; ctx.fillRect(Math.round(u.x + (v.x-u.x)*t),Math.round(u.y+(v.y-u.y)*t),2,1)
    }
  }
  const visible = net.systems.map((system,id) => ({ ...project(id), id, rank: net.worldOf[id], system })).filter(q => q.x > 4 && q.x < width-4 && q.y > 30 && q.y < height*.77)
  for (const q of visible) {
    const live = q.rank < settled, next = q.rank === settled, selected = q.id === chosen
    if (!live && !next && !nearFrontier.has(q.id)) continue
    const r = q.id === 0 ? 3 : 2
    ctx.fillStyle = live ? A[3] : N[3]; ctx.fillRect(Math.round(q.x)-1,Math.round(q.y)-1,live && height >= 160 ? 2 : 1,live && height >= 160 ? 2 : 1)
    if (q.id === 0) {
      // Sol wears the HQ's colours: a point on its ring for each hero who has walked in.
      f.wings.forEach((wing, k) => { const a = -Math.PI / 2 + (k * TAU) / Math.max(3, f.wings.length); ctx.fillStyle = wing.colour; ctx.fillRect(Math.round(q.x + Math.cos(a) * (r + 4)), Math.round(q.y + Math.sin(a) * (r + 4)), 2, 2) })
    }
    if (q.id === 0 || next || selected) { ctx.strokeStyle = selected || next ? p[2] : A[2]; ctx.beginPath(); ctx.arc(Math.round(q.x),Math.round(q.y),r + 2,0,TAU); ctx.stroke() }
    f.points.push({ x:q.x, y:q.y, id:q.id, depth:0 })
    if (!f.reduced) for (const e of f.expansions) if (e.from <= q.rank * WORLD_SEATS && e.to > q.rank * WORLD_SEATS) {
      const t = f.seconds - e.at
      if (t < 3) { ctx.globalAlpha = 1-t/3; ctx.strokeStyle=A[3]; ctx.beginPath(); ctx.arc(q.x,q.y,4+t*8,0,TAU); ctx.stroke(); ctx.globalAlpha=1 }
    }
  }
  const bounds = { x:width*(height < 160 ? .26 : .20), y:height < 160 ? 36 : 34, w:width*(height < 160 ? .48 : .60), h:height*.55-20 }
  const boxes: LabelBox[] = visible.filter(q => q.rank < settled).map(q => ({ x:q.x-3,y:q.y-3,w:6,h:6 }))
  const priority = (q: typeof visible[number]) => q.id === chosen ? -3 : q.id === 0 ? -2 : q.rank === settled ? -1 : q.rank
  const candidates = visible.filter(q => q.rank <= settled || q.id === chosen).sort((a,b) => priority(a)-priority(b))
  let labels = 0
  for (const q of candidates) {
    if (labels >= (width < 300 ? 4 : 7)) break
    const name = q.id === 0 ? 'SOL / HQ' : (q.rank === settled ? 'NEXT: ' : '') + q.system.name.toUpperCase()
    let box = placeMapLabel(q.x,q.y,name,bounds,boxes)
    // Home and the frontier retain a callout even inside the densest cluster.
    // Search the chart margin and connect the displaced label with a leader.
    if (!box && priority(q) < 0) {
      for (let y = bounds.y + 10; y < bounds.y + bounds.h - 12 && !box; y += 14) {
        box = placeMapLabel(bounds.x - 7, y, name, bounds, boxes)
      }
      if (box) { ctx.strokeStyle=N[3]; ctx.beginPath(); ctx.moveTo(q.x,q.y); ctx.lineTo(box.x+box.w,box.y+4); ctx.stroke() }
    }
    if (!box) continue
    ctx.fillStyle=N[0]; ctx.fillRect(box.x-1,box.y-1,box.w+2,box.h+2)
    ctx.fillStyle=q.id === chosen || q.rank === settled ? p[3] : N[6]
    monitorText(ctx,name,box.x+2,box.y+6); labels++
  }
  atlasCaption(f, `${settled.toLocaleString()} WORLDS CONNECTED`, 'TAP A WORLD · DRAG TO EXPLORE')
}
