/**
 * The HQ's floor plan, drawn from the same numbers the game builds from —
 * `three/sim/floorPlan.ts` is the single authority for where everything in the
 * garage is, so a plan drawn here cannot disagree with the room.
 *
 * Written 2026-10-05, when the HQ was re-planned as a piece of architecture and
 * not a row of desks: an architect designs on a plan, and the one thing the
 * game could not show was the plan. It is a drawing, not a gate — nothing fails
 * on it — and it is cheap enough to regenerate that the habit is to look at it
 * before moving a wall. Redrawn 2026-10-05 for the sixth cut: the founder's podium, James's
 * deck, and Billy on the open floor with the two lanes either side of him.
 *
 *   npx tsx scripts/hq-plan.ts [out.svg]
 *
 * North is up, as in the sim (−z is north); the game's camera looks from the
 * south-east, which is the bottom-right corner of this sheet.
 */
import { writeFileSync } from 'node:fs'
import {
  BILLY_PLAZA,
  GARAGE_DECK,
  GARAGE_FURNITURE,
  GARAGE_HERO_SCALE,
  GARAGE_LEADERS,
  GARAGE_OUTLINE,
  GARAGE_PODIUM,
  GARAGE_PODS,
  GARAGE_WALLS,
  HERO_SITES,
  STUDIO_DOOR,
  benches,
  destinationsIn,
  garageSeats,
  heroDesktop,
  leaderDesks,
  walkable,
} from '../src/three/sim/floorPlan.ts'

const S = 44 // px per metre
const PAD = 70
const X0 = -12, X1 = 13, Z0 = -12, Z1 = 13
const px = (x: number) => PAD + (x - X0) * S
const pz = (z: number) => PAD + (z - Z0) * S
const W = PAD * 2 + (X1 - X0) * S + 250
const H = PAD * 2 + (Z1 - Z0) * S + 90

const out: string[] = []
const INKC = '#2b2f33'
const rect = (x: number, z: number, w: number, d: number, fill: string, stroke = 'none', extra = '') =>
  out.push(`<rect x="${px(x - w / 2)}" y="${pz(z - d / 2)}" width="${w * S}" height="${d * S}" fill="${fill}" stroke="${stroke}" ${extra}/>`)
const box = (r: { x0: number; x1: number; z0: number; z1: number }, fill: string, stroke = 'none', extra = '') =>
  out.push(`<rect x="${px(r.x0)}" y="${pz(r.z0)}" width="${(r.x1 - r.x0) * S}" height="${(r.z1 - r.z0) * S}" fill="${fill}" stroke="${stroke}" ${extra}/>`)
const text = (x: number, z: number, s: string, size = 11, fill = INKC, anchor = 'middle', weight = 400, extra = '') =>
  out.push(`<text x="${px(x)}" y="${pz(z)}" font-family="monospace" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${s}</text>`)
const line = (x0: number, z0: number, x1: number, z1: number, stroke: string, w = 2, dash = '') =>
  out.push(`<line x1="${px(x0)}" y1="${pz(z0)}" x2="${px(x1)}" y2="${pz(z1)}" stroke="${stroke}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`)
const arrow = (x0: number, z0: number, x1: number, z1: number, stroke: string, w = 2.5, dash = '') => {
  line(x0, z0, x1, z1, stroke, w, dash)
  const a = Math.atan2(pz(z1) - pz(z0), px(x1) - px(x0)), h = 9
  const hx = px(x1), hy = pz(z1)
  out.push(`<polygon points="${hx},${hy} ${hx - h * Math.cos(a - 0.4)},${hy - h * Math.sin(a - 0.4)} ${hx - h * Math.cos(a + 0.4)},${hy - h * Math.sin(a + 0.4)}" fill="${stroke}"/>`)
}
/** A point in a station's own frame (a turn of `rot` degrees, scaled by `k`) as a world point: the one transform every set is built in. */
const turned = (s: { x: number; z: number; rot: number }, k: number, lx: number, lz: number) => {
  const a = (s.rot * Math.PI) / 180
  return { x: s.x + k * (lx * Math.cos(a) + lz * Math.sin(a)), z: s.z + k * (-lx * Math.sin(a) + lz * Math.cos(a)) }
}
const poly = (pts: { x: number; z: number }[], fill: string, stroke = 'none', extra = '') =>
  out.push(`<polygon points="${pts.map((p) => `${px(p.x)},${pz(p.z)}`).join(' ')}" fill="${fill}" stroke="${stroke}" ${extra}/>`)
const octagon = (cx: number, cz: number, apothem: number, fill: string, stroke = 'none', extra = '') => {
  const r = apothem / Math.cos(Math.PI / 8)
  poly(Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + k * Math.PI / 4
    return { x: cx + Math.sin(a) * r, z: cz + Math.cos(a) * r }
  }), fill, stroke, extra)
}

out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`)
out.push(`<rect width="${W}" height="${H}" fill="#f4f1e8"/>`)
for (let x = X0; x <= X1; x++) out.push(`<line x1="${px(x)}" y1="${pz(Z0)}" x2="${px(x)}" y2="${pz(Z1)}" stroke="${x % 5 === 0 ? '#cfcab9' : '#e8e4d6'}" stroke-width="1"/>`)
for (let z = Z0; z <= Z1; z++) out.push(`<line x1="${px(X0)}" y1="${pz(z)}" x2="${px(X1)}" y2="${pz(z)}" stroke="${z % 5 === 0 ? '#cfcab9' : '#e8e4d6'}" stroke-width="1"/>`)
for (let x = X0; x <= X1; x += 5) text(x, Z0 - 0.35, String(x), 10, '#8a8472')
for (let z = Z0; z <= Z1; z += 5) text(X0 - 0.55, z + 0.12, String(z), 10, '#8a8472')

// the building: the floor, then the zones laid on it
out.push(`<polygon points="${GARAGE_OUTLINE.map(([x, z]) => `${px(x)},${pz(z)}`).join(' ')}" fill="#fffdf6" stroke="none"/>`)

// what the walk grid can reach: a faint tint on every open half-metre cell, so that the lanes show where the floor is open
for (let x = -9.45; x < 9.7; x += 0.5) for (let z = -10.45; z < 10.7; z += 0.5) {
  if (walkable('garage', x, z)) out.push(`<rect x="${px(x - 0.25)}" y="${pz(z - 0.25)}" width="${0.5 * S}" height="${0.5 * S}" fill="#cfe6d2" fill-opacity="0.35"/>`)
}

// the boss's podium, the north-west corner: 1.2 m up, with its stair on the east face — the top left of the plan, and the
// highest thing in the room — and James's deck at its foot along the west wall, 0.24 m up
box(GARAGE_PODIUM, '#e3c9a0', '#5b3f2b', 'stroke-width="3"')
text((GARAGE_PODIUM.x0 + GARAGE_PODIUM.x1) / 2, GARAGE_PODIUM.z0 + 0.45, `FOUNDER'S PODIUM +${GARAGE_PODIUM.rise.toFixed(2)}`, 9, '#5b3f2b', 'middle', 700)
rect(GARAGE_PODIUM.x1 + 0.6, -7.1, 1.2, 1.8, '#c9a77a', '#5b3f2b')
text(GARAGE_PODIUM.x1 + 0.6, -7.1 + 0.1, 'STAIR', 7, '#5b3f2b')
box(GARAGE_DECK, '#ecdcb8', '#8d693f', 'stroke-width="1.5"')
text((GARAGE_DECK.x0 + GARAGE_DECK.x1) / 2, GARAGE_DECK.z1 - 0.12, `JAMES'S DECK +${GARAGE_DECK.rise.toFixed(2)}`, 9, '#6b5230', 'middle', 700)

// the three sites, each in its own finish: the plan should read as zones before it reads as furniture
const SITE_FILL: Record<string, string> = { matt: '#bfd8bd', serena: '#b4c3c9', billy: '#e4d9ee' }
const SITE_NAME: Record<string, string> = { matt: 'FRONT DESK', serena: 'OPS ROOM', billy: "BILLY'S PLAZA" }
const SITE_INK: Record<string, string> = { matt: '#2f6a3d', serena: '#35505b', billy: '#5d3f86' }
for (const [id, site] of Object.entries(HERO_SITES)) {
  box(site, SITE_FILL[id], SITE_INK[id], `stroke-width="2.5"${site.wall === 'free' ? ' stroke-dasharray="6 4"' : ''}`)
  if (site.round) octagon(site.round.x, site.round.z, site.round.apothem, '#8f6bb8', SITE_INK[id], 'stroke-width="2"')
  const cx = (site.x0 + site.x1) / 2
  text(cx, site.wall === 'free' ? site.z1 - 0.15 : site.z0 + 0.4, `${SITE_NAME[id]}${site.rise > 0.3 ? ` +${site.rise.toFixed(2)}` : ''}`, 10, SITE_INK[id], 'middle', 700)
}
// Billy's board and dais, drawn from `BILLY_PLAZA` in his own frame (unscaled metres, turned an eighth): the board is a bar on the
// diagonal with a foot at each end, and the dais an octagon. The blocked rectangle round them is the footprint the walk grid pads.
{
  const billy = GARAGE_LEADERS.find((l) => l.id === 'billy')!
  const { board, dais } = BILLY_PLAZA
  const hw = board.w / 2
  poly([turned(billy, 1, board.x - hw, board.z - 0.05), turned(billy, 1, board.x + hw, board.z - 0.05), turned(billy, 1, board.x + hw, board.z + 0.05), turned(billy, 1, board.x - hw, board.z + 0.05)], '#58605d', '#2b2f33')
  for (const side of [-1, 1]) {
    poly([turned(billy, 1, board.x + side * hw - 0.04, board.z - board.feet), turned(billy, 1, board.x + side * hw + 0.04, board.z - board.feet),
      turned(billy, 1, board.x + side * hw + 0.04, board.z + board.feet), turned(billy, 1, board.x + side * hw - 0.04, board.z + board.feet)], '#3b4240')
  }
  octagon(billy.x, billy.z, dais.apothem, '#c39760', '#5d3f86', 'stroke-width="1.5"')
  const easel = GARAGE_FURNITURE.find((f) => f.kind === 'easel')!
  out.push(`<rect x="${px(easel.x - easel.w / 2)}" y="${pz(easel.z - easel.d / 2)}" width="${easel.w * S}" height="${easel.d * S}" fill="none" stroke="#c23b30" stroke-width="1.5" stroke-dasharray="5 3"/>`)
  text(easel.x, easel.z + easel.d / 2 + 0.35, 'footprint (the grid pads it 0.25 m)', 7.5, '#c23b30')
}
// the glazing round the Ops Room: south and east faces, the two the camera sees
{
  const o = HERO_SITES.serena
  line(o.x0, o.z1, o.x1, o.z1, '#3aa6bf', 5)
  line(o.x1, o.z0, o.x1, o.z1, '#3aa6bf', 5)
}
// the old wall, until Serena arrives: one partition with an east return (Matt's place and Billy's have none)
line(HERO_SITES.serena.x0 - 0.02, -6.49, HERO_SITES.serena.x1 + 0.02, -6.49, '#c23b30', 3, '8 5')
line(HERO_SITES.serena.x1 + 0.02, -6.49, HERO_SITES.serena.x1 + 0.02, -9.68, '#c23b30', 3, '8 5')
text((HERO_SITES.serena.x0 + HERO_SITES.serena.x1) / 2, -6.12, 'old wall until she arrives', 8, '#c23b30')
// the Ops Room's step, which comes with her: at the east end of the south face
rect(HERO_SITES.serena.x1 - 0.6, HERO_SITES.serena.z1 + 0.3, 0.95, 0.6, '#8d9a9d', '#35505b')

// furniture
const FILL: Record<string, string> = {
  counter: '#c9b79a', unit: '#b59f7c', board: '#ffffff', shelving: '#b99059', sofa: '#7b93b0', 'coffee-table': '#c9b79a',
  island: '#d8c9a8', locker: '#9aa3a0', planter: '#a3b47a', bench: '#c9b79a', screen: '#cfe3e6', banner: '#e0a52e', cooler: '#8dc3da',
}
for (const f of GARAGE_FURNITURE) {
  if (f.kind === 'easel') continue // drawn above, from the numbers it is derived from
  rect(f.x, f.z, f.w, f.d, FILL[f.kind] ?? '#ccc', '#4a4a45')
  text(f.x, f.z + 0.1, f.kind === 'board' ? 'PROJECT BOARD' : f.kind.toUpperCase(), 7, INKC, 'middle', 400,
    f.kind === 'board' ? `transform="rotate(-90 ${px(f.x)} ${pz(f.z)})"` : '')
}

// pods and seats, with the rectangle the walk grid closes round each table (dashed) under the table itself
for (const b of benches('garage')) out.push(`<rect x="${px(b.x - b.w / 2)}" y="${pz(b.z - b.d / 2)}" width="${b.w * S}" height="${b.d * S}" fill="none" stroke="#c9b79a" stroke-width="1" stroke-dasharray="3 3"/>`)
for (const [i, p] of GARAGE_PODS.entries()) {
  const w = p.rot === 90 ? 1.45 : 3.05, d = p.rot === 90 ? 3.05 : 1.45
  rect(p.x, p.z, w, d, '#e2d3b4', '#6b5230')
  text(p.x, p.z + 0.12, `POD ${i}`, 10, '#6b5230', 'middle', 700)
}
for (const s of garageSeats()) out.push(`<circle cx="${px(s.x)}" cy="${pz(s.z)}" r="${0.27 * S}" fill="#fff" stroke="#368c87" stroke-width="2"/>`)

// the desks on the boss's podium and James's deck, drawn to the footprints the sim reads: the padded rectangle the chair and
// desk close to walking, and the desktop itself on top of it (both are bounding boxes of what is turned on the diagonal)
for (const l of GARAGE_LEADERS) {
  if (l.id !== 'founder' && l.id !== 'james') continue
  const pad = leaderDesks('garage').find((q) => q.seat === l.seat)!
  rect(pad.x, pad.z, pad.w, pad.d, l.id === 'founder' ? '#d9bf99' : '#e6d3b0', l.id === 'founder' ? '#6b4a31' : '#8d693f', 'fill-opacity="0.55"')
  const top = heroDesktop('garage', l.seat)!
  rect(top.x, top.z, top.w, top.d, l.id === 'founder' ? '#b99059' : '#d6bd8e', l.id === 'founder' ? '#6b4a31' : '#8d693f')
  text(top.x, top.z + 0.1, l.id === 'founder' ? 'BOSS DESK' : 'DESK', 7, '#4a3a2a')
}

// walls, over everything: the thick line a plan has
out.push(`<polygon points="${GARAGE_OUTLINE.map(([x, z]) => `${px(x)},${pz(z)}`).join(' ')}" fill="none" stroke="${INKC}" stroke-width="6" stroke-linejoin="miter"/>`)

// the door
const d = STUDIO_DOOR
out.push(`<line x1="${px(d.x)}" y1="${pz(d.z - d.width / 2)}" x2="${px(d.x)}" y2="${pz(d.z + d.width / 2)}" stroke="#e0a52e" stroke-width="10"/>`)
text(d.x + 0.4, d.z, 'DOOR', 10, '#a07400', 'start', 700)

// circulation: the way in, across the crossing and up either lane beside Billy to the north court and the boss's stair
arrow(-6.5, 9.5, -4.2, 7.4, '#2f6a3d', 3)
arrow(-4.2, 7.4, -2.45, 2.55, '#2f6a3d', 3, '4 5')
arrow(-2.45, 2.55, -2.45, -3.2, '#2f6a3d', 3, '4 5')
arrow(1.05, 2.55, 1.05, -3.2, '#2f6a3d', 3, '4 5')
text(-2.45, 3.2, 'lane', 8, '#2f6a3d', 'end', 700)
text(1.05, 3.2, 'lane', 8, '#2f6a3d', 'start', 700)
arrow(-2.45, -3.2, -4.7, -7.1, '#2f6a3d', 3, '4 5')
text(-7.0, 9.0, 'IN', 9, '#2f6a3d', 'end', 700)

// errands (where the studio's own people go)
for (const dest of destinationsIn('garage')) for (const s of dest.slots) out.push(`<circle cx="${px(s.x)}" cy="${pz(s.z)}" r="4" fill="#c23b30"/>`)

// leaders, with the way each one faces
for (const l of GARAGE_LEADERS) {
  out.push(`<circle cx="${px(l.x)}" cy="${pz(l.z)}" r="${0.4 * S}" fill="#fff" stroke="#c23b30" stroke-width="3"/>`)
  text(l.x, l.z + 0.12, l.id.slice(0, 2).toUpperCase(), 11, '#c23b30', 'middle', 700)
  const a = (l.rot * Math.PI) / 180
  arrow(l.x, l.z, l.x + Math.sin(a) * 1.1, l.z + Math.cos(a) * 1.1, '#c23b30', 2)
}

// camera
out.push(`<g transform="translate(${px(11.5)},${pz(11.5)})"><line x1="0" y1="0" x2="-52" y2="-52" stroke="#368c87" stroke-width="3"/><polygon points="-52,-52 -40,-48 -48,-40" fill="#368c87"/><text x="6" y="14" font-family="monospace" font-size="11" fill="#368c87">CAMERA</text></g>`)

// title block and legend
const lx = px(X1) + 18
const legend: [string, string][] = [
  ['#e3c9a0', "Founder's podium — the corner office, 1.2 m"],
  ['#ecdcb8', "James's deck — a step down, along the west wall"],
  ['#bfd8bd', 'Front Desk — Matt (north wall)'],
  ['#b4c3c9', 'Ops Room — Serena: pipeline, incidents'],
  ['#e4d9ee', "Billy's plaza — in the mix, facing the lens"],
  ['#e2d3b4', 'Studio floor: five pods of four'],
  ['#cfe6d2', 'Open to the walk grid (half-metre cells)'],
]
legend.forEach(([c, t], i) => {
  out.push(`<rect x="${lx}" y="${PAD + i * 24}" width="18" height="14" fill="${c}" stroke="#555"/>`)
  out.push(`<text x="${lx + 26}" y="${PAD + i * 24 + 12}" font-family="monospace" font-size="10.5" fill="${INKC}">${t}</text>`)
})
const n = legend.length
out.push(`<text x="${lx}" y="${PAD + n * 24 + 22}" font-family="monospace" font-size="10.5" fill="#2f6a3d">- - -  the way in, and the two lanes by Billy</text>`)
out.push(`<text x="${lx}" y="${PAD + n * 24 + 42}" font-family="monospace" font-size="10.5" fill="#3aa6bf">━  glazing (the camera sees S and E)</text>`)
out.push(`<text x="${lx}" y="${PAD + n * 24 + 62}" font-family="monospace" font-size="10.5" fill="#c23b30">- - -  old wall, until Serena arrives</text>`)
out.push(`<text x="${lx}" y="${PAD + n * 24 + 82}" font-family="monospace" font-size="10.5" fill="${INKC}">Back walls ${GARAGE_WALLS.height} m (were 3.2); hero scale ${GARAGE_HERO_SCALE}</text>`)
out.push(`<text x="${PAD}" y="${H - 44}" font-family="monospace" font-size="14" font-weight="700" fill="${INKC}">THE HQ, 2026-10-05 — N up; the camera looks from the SE, so the N and W walls are the backdrop.   1 m = ${S}px.</text>`)
out.push(`<text x="${PAD}" y="${H - 24}" font-family="monospace" font-size="11" fill="#6b6556">The founder is on a podium in the NW corner, the apex of the picture, with James a step down; Matt and Serena stand against the north wall; Billy stands in the avenue between the pods. Drawn from three/sim/floorPlan.ts.</text>`)
out.push('</svg>')

writeFileSync(process.argv[2] ?? 'hq-plan.svg', out.join('\n'))
console.log('wrote', process.argv[2] ?? 'hq-plan.svg')
