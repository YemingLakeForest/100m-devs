// Icon compositions: each is a voxel scene, a yaw, a framing and a tile colour.
import { Vox, C, bev } from './vox.js'
import { SPECS, blockDuck } from './blockduck.js'

const front = (v, y, z, minX = -1e9) => { let b = null; for (const [x, yy, zz] of v.each()) if (yy === y && zz === z && x >= minX && (b === null || x > b)) b = x; return b }
const outer = (v, x, y, side) => { let b = null; for (const [vx, vy, vz] of v.each()) if (vx === x && vy === y && (b === null || vz * side > b * side)) b = vz; return b }

/** Pixel shades: a lens on each flank, a bridge across the face, raised one voxel off him. */
export function shades(v) {
  const lens = [[13, 10, 14], [12, 10, 14], [11, 11, 13]]
  for (const side of [-1, 1]) {
    for (const [y, x0, x1] of lens) for (let x = x0; x <= x1; x++) { const z = outer(v, x, y, side); if (z !== null) v.set(x, y, z + side, C.EYE) }
    for (let x = 7; x <= 9; x++) { const z = outer(v, x, 13, side); if (z !== null) v.set(x, 13, z + side, C.EYE) }
    const z = outer(v, 11, 12, side); if (z !== null) v.set(11, 12, z, C.EYE)
    const g = outer(v, 11, 13, side); if (g !== null) v.set(11, 13, g, C.GL)
  }
  for (const y of [12, 13]) for (let z = -6; z <= 5; z++) { const x = front(v, y, z); if (x !== null && x >= 14) v.set(x + 1, y, z, C.EYE) }
  return v
}

export function bug(v) {
  // A beetle in his beak, held by its tail end and lying shell-up, so the lens looks down on it the way every bug
  // icon is drawn: a red shell split down the middle, spots, six legs, two feelers. The bug he owns.
  const R = '#e0413f'
  bev(v, 18, 8, -4, 25, 11, 3, [2, 2, 0, 2, 2, 2], R)
  for (let x = 18; x <= 25; x++) for (const z of [-1, 0]) { for (let y = 11; y >= 8; y--) if (v.get(x, y, z) === R) { v.set(x, y, z, C.EYE); break } }
  for (const [x, z] of [[20, -3], [23, -3], [21, 2], [23, 2], [24, -2]]) for (let y = 11; y >= 8; y--) if (v.get(x, y, z) === R) { v.set(x, y, z, C.EYE); break }
  v.box(26, 8, -2, 27, 10, 1, C.EYE)
  for (const z of [-2, 1]) { v.set(28, 10, z, C.EYE); v.set(29, 11, z < 0 ? z - 1 : z + 1, C.EYE) }
  for (const x of [19, 22, 25]) { v.set(x, 8, -5, C.EYE); v.set(x, 8, 4, C.EYE); v.set(x - 1, 7, -6, C.EYE); v.set(x - 1, 7, 5, C.EYE) }
  return v
}

export function tie(v) {
  // Under the beak, standing a voxel proud of the chest so the head's overhang cannot swallow it.
  v.box(15, 6, -3, 16, 7, 2, C.WHITE)
  v.box(16, 5, -1, 17, 7, 0, '#a8262f')
  v.box(16, 1, -1, 17, 4, 0, C.RED)
  v.box(16, 0, -1, 17, 0, -1, C.RED)
  return v
}

export function headphones(v) {
  for (let x = 9; x <= 11; x++) {
        for (const [y, z] of [[17, -6], [17, 5], [16, -7], [16, 6], [15, -7], [15, 6]]) v.set(x, y, z, C.WHITE)
  }
  for (let x = 9; x <= 11; x++) for (let z = -5; z <= 4; z++) v.set(x, 18, z, C.WHITE)
  for (const [z0, z1, zo] of [[6, 7, 7], [-8, -7, -8]]) {
    bev(v, 7, 9, z0, 13, 14, z1, [1, 1, 1, 1, 0, 0], C.WHITE)
    v.box(9, 10, zo, 11, 13, zo, C.TEAL)
  }
  return v
}

export function crown(v) {
  for (let x = 8; x <= 13; x++) for (let z = -3; z <= 2; z++) {
    if (x > 8 && x < 13 && z > -3 && z < 2) continue
    v.set(x, 17, z, C.GOLD)
    if ((x + z) % 2 === 0) v.set(x, 18, z, C.GOLD)
  }
  for (const [x, z] of [[8, -3], [13, -3], [8, 2], [13, 2]]) v.set(x, 19, z, C.GOLD)
  v.set(13, 17, -1, C.RUBY); v.set(13, 17, 0, C.RUBY)
  return v
}

/** A CRT, screen toward +z, so it faces the lens while he sits on it in profile. */
export function monitor(w = 26, h = 18, deep = 16) {
  const m = new Vox(), x0 = -w / 2, x1 = w / 2 - 1
  bev(m, x0 + 5, 0, -deep + 4, x1 - 5, 1, -4, [1, 1, 0, 0, 1, 1], C.CASED)
  bev(m, x0, 2, -deep, x1, h, 0, [1, 1, 0, 1, 2, 0], C.CASE)
  for (let y = 5; y <= h - 3; y++) for (let x = x0 + 3; x <= x1 - 3; x++) { m.del(x, y, 0); m.set(x, y, -1, C.SCREEN) }
  const lines = [[0, 11, C.CODE], [3, 7, C.CODE2], [3, 12, C.CODE], [6, 5, C.CODE3], [3, 9, C.CODE], [0, 4, C.CODE2]]
  lines.forEach(([ind, len, c], i) => { for (let k = 0; k < len; k++) { const x = x0 + 4 + ind + k, y = h - 4 - i * 2; if (x <= x1 - 4 && y >= 6) m.set(x, y, -1, c) } })
  return m
}

export function water(scene, x0, x1, z0, z1, ring) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    for (const y of [-1, 0]) if (!scene.has(x, y, z)) scene.set(x, y, z, C.WATER)
    const r = Math.hypot((x + 0.5 - ring.x) / ring.rx, (z + 0.5 - ring.z) / ring.rz)
    if (scene.get(x, 0, z) === C.WATER && ring.r.some((rr) => Math.abs(r - rr) < 0.45)) scene.set(x, 0, z, C.RIPPLE)
  }
  return scene
}

/** A speech bubble over his head with "</>" in it: rubber-duck debugging is explaining your code out loud. */
export function bubble(v) {
  const x0 = 13, y0 = 20, W = 17, H = 9
  bev(v, x0, y0, -1, x0 + W - 1, y0 + H - 1, 0, [1, 1, 1, 1, 0, 0], C.WHITE)
  for (const [x, y] of [[x0 + 3, y0 - 1], [x0 + 4, y0 - 1], [x0 + 2, y0 - 2], [x0 + 3, y0 - 2], [x0 + 1, y0 - 3]]) v.set(x, y, -1, C.WHITE), v.set(x, y, 0, C.WHITE)
  const rows = ['..#....#.#...', '.#.....#..#..', '#.....#....#.', '.#...#....#..', '..#..#...#...']
  rows.forEach((r, i) => [...r].forEach((ch, k) => { if (ch === '#') v.set(x0 + 2 + k, y0 + H - 3 - i, 0, '#1f8a9a') }))
  return v
}

const big = (o) => blockDuck(SPECS.big, o).v

export const COMPS = [
  {
    id: 'hero', name: 'The Duck', bg: '#2f7d8a', yaw: 0.7, fill: 0.78,
    idea: 'Just him, big, turned to you. The control: every other icon is this plus one idea.',
    good: ['Cleanest at every size', 'Pure brand: the duck is the logo'],
    bad: ['Says "rubber duck", not "this game"'],
    scene: () => big(),
  },
  {
    id: 'shades', name: 'Deal With It', bg: '#4b3f72', yaw: 0.7, fill: 0.78,
    idea: 'Pixel shades: the CTO who does not debug, he is debugged at. The meme is already made of voxels.',
    good: ['The shades are a second silhouette, so he holds at 32 px', 'Funny before you know the game'],
    bad: ['Hides the eyes, which is where cute lives'],
    scene: () => shades(big()),
  },
  {
    id: 'bug', name: 'Bug Hunter', bg: '#2a2a44', yaw: 0.6, fill: 0.84,
    idea: 'A bug in his beak. Ducks eat bugs, and his whole tree is about the bugs: fewer written, more caught.',
    good: ['Tells you it is about code in one look', 'A story in the icon'],
    bad: ['The bug is small at 48 px'],
    scene: () => bug(big()),
  },
  {
    id: 'monitor', name: 'On The Monitor', bg: '#15131c', yaw: 0.7, fill: 0.84,
    idea: 'Where real rubber ducks live: on top of the screen. Keeps today\'s CRT icon and puts him on it.',
    good: ['Continuity with the current icon', 'Says "programmer" and "duck" together'],
    bad: ['Two things to read, so each is smaller'],
    scene: () => { const s = monitor(); s.add(big(), -7, 19, -8); return s },
  },
  {
    id: 'bath', name: 'Bath Time', bg: '#1f5f7a', yaw: 0.7, fill: 0.98,
    idea: 'Afloat in a square of bath water with a ripple round him, seen from the game\'s own angle.',
    good: ['Warm and calm', 'The water frames him without a podium'],
    bad: ['Water and teal tile compete; needs the dark blue'],
    scene: () => { const d = new Vox().add(big(), 0, -2, 0); return water(d, -6, 24, -14, 14, { x: 8, z: 0, rx: 1.3, rz: 1, r: [9.5] }) },
  },
  {
    id: 'army', name: 'One Of 100,000,000', bg: '#1b1a2a', yaw: 0.7, fill: 1.08, dy: 0.12,
    frame: { x0: -2, y0: 0, z0: -7, x1: 21, y1: 34, z1: 7 },
    idea: 'Every developer has a duck. Behind him, ducklings to the horizon: the title joke, in ducks.',
    good: ['The only one that says "100 million"', 'Gorgeous as a splash screen'],
    bad: ['Busy at 48 px: a yellow blob on a yellow field'],
    scene: () => {
      const s = big(), small = blockDuck(SPECS.mini).v
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
        const x = 34 - 9 * i, z = 34 - 7 * j
        if (x > -9 && z > -15) continue
        s.add(small, x, 0, z)
      }
      return s
    },
  },
  {
    id: 'face', name: 'Close-Up', bg: '#ff7a59', yaw: 0.75, fill: 1.12, dx: -0.06, dy: 0.04,
    frame: { x0: 5, y0: 4, z0: -6, x1: 20, y1: 17, z1: 6 },
    idea: 'Crop to the face: one eye, the beak, the curve of the head running off the tile. Coral so the yellow pops.',
    good: ['The biggest eye at the smallest size', 'Bold, like a brand mark'],
    bad: ['Less obviously a rubber duck without the body'],
    scene: () => big(),
  },
  {
    id: 'exec', name: 'The Executive', bg: '#2b3a67', yaw: 0.75, fill: 0.78,
    idea: 'Half-lidded, in a tie. Unimpressed by your stack trace. The CTO as a job title you can see.',
    good: ['The most "CTO" of the set', 'The lid is a joke the game can keep making'],
    bad: ['The lid and the tie are small details at 32 px'],
    scene: () => tie(big({ eyes: 'lid' })),
  },
  {
    id: 'phones', name: 'On A Call', bg: '#13383f', yaw: -0.45, fill: 0.8,
    idea: 'Headphones on. He is in every meeting and says nothing, which makes him the best one there.',
    good: ['Headphones change the silhouette, so he reads at 32 px', 'Teal ties him to the game\'s UI'],
    bad: ['Headphones say "music app" as much as "dev"'],
    scene: () => headphones(big()),
  },
  {
    id: 'talk', name: 'Talk It Out', bg: '#1d3a4a', yaw: 0.6, fill: 0.84, dy: 0.02,
    idea: 'Rubber-duck debugging: explain your code to the duck and the bug gives itself up. The bubble is the method.',
    good: ['Names the real practice the whole joke rests on', 'The white bubble pops on any tile'],
    bad: ['The </> blurs at 32 px; the bubble alone has to carry it'],
    scene: () => bubble(big()),
  },
  {
    id: 'king', name: 'Crowned', bg: '#7a2f4a', yaw: 0.7, fill: 0.8,
    idea: 'The crown from his wardrobe: the duck who knew all along, and the top of his tree on the icon.',
    good: ['Gold on yellow is rich', 'Ties to the wardrobe'],
    bad: ['Crowns are every second idle game\'s icon'],
    scene: () => crown(big()),
  },
  {
    id: 'chunk', name: 'Eight-Bit', bg: '#e8546b', yaw: 0.7, fill: 0.76,
    idea: 'Half the voxels: a Crossy-Road-sized duck where every block shows. Built for a 32 px favicon.',
    good: ['Sharpest at tiny sizes', 'Matches the room\'s chunky people'],
    bad: ['Least charming up close: no glint, no blush'],
    scene: () => blockDuck(SPECS.chunk).v,
  },
]
