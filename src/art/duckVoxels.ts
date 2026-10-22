/**
 * B. Quackington III, in voxels — GDD §11.7.2 [amended 2026-10-22].
 *
 * *"8 bit it is, otherwise it plunges deep into uncanny valley."* Four looks were
 * rejected on the way here (a cube in a bath, stacked slabs on a plinth, smooth
 * spheres on a podium, and a big-headed toy whose glint and blush were the
 * uncanny part), and the one that stayed is the one with the fewest voxels: a
 * duck small enough on the grid that every block shows, like the room's people.
 * Round 3's lab is kept in `docs/demos/duck-motif-2026-10-22/`.
 *
 * **One model, three pictures.** The room (`three/render/duckOffice.ts`), his
 * window's portrait (`voxelIcons.duckBoxes`) and the app icon
 * (`scripts/duck-icon.mjs`) all draw this grid, so the duck on the phone's home
 * screen is the duck in the corner of the office, hat for hat.
 *
 * **True voxels.** Unit cubes on an integer grid, each one ink. Rounding is done
 * by cutting edges back a step at a time (`bev`), never by a smaller cube: the
 * moment one block is half the size of another the duck stops being eight-bit.
 *
 * His frame: beak toward +x, up +y, flanks ±z, sitting on y = 0. The head is the
 * block x 4..9, y 4..9, z −3..2; everything he wears is placed off it by hand.
 *
 * Pure: no three, no DOM.
 */

/** An ink: what a voxel is made of. The room and the icon read {@link INK_HEX}; the portrait reads `voxelIcons`' materials. */
export type Ink =
  | 'yellow' | 'wing' | 'beak' | 'eye' | 'white' | 'gold' | 'ruby' | 'black' | 'red' | 'darkred' | 'pink'
  | 'teal' | 'blue' | 'navy' | 'purple' | 'silver' | 'cream' | 'brown' | 'green' | 'glass' | 'paper'

/**
 * The room's colours. His three are ART_DIRECTION §2.1b's DUCK ramp — the yellow
 * round 3 settled on, bright enough to be the first thing in the frame, and the
 * wing a warmer step of it rather than a darker one, so lit plastic reads as
 * plastic.
 */
export const INK_HEX: Record<Ink, string> = {
  yellow: '#ffcf3a', wing: '#e8a92a', beak: '#f5892a', eye: '#1d1a24', white: '#f4f1ea', gold: '#f2a91c',
  ruby: '#d83a4a', black: '#26222c', red: '#d8413e', darkred: '#9e2a2f', pink: '#f28ab0', teal: '#35c9d9',
  blue: '#4a7fb0', navy: '#2b3a67', purple: '#6b3a8a', silver: '#b7bfc4', cream: '#efe3c2', brown: '#7a4b32',
  green: '#4c9a52', glass: '#a9e4f2', paper: '#efe9d8',
}

export type Voxel = readonly [number, number, number, Ink]

/** A sparse grid. Later writes win, which is how a hat goes over a head. */
export class VoxelGrid {
  private readonly cells = new Map<string, Ink>()
  private static key(x: number, y: number, z: number): string { return `${x},${y},${z}` }
  set(x: number, y: number, z: number, ink: Ink): void { this.cells.set(VoxelGrid.key(x, y, z), ink) }
  get(x: number, y: number, z: number): Ink | undefined { return this.cells.get(VoxelGrid.key(x, y, z)) }
  has(x: number, y: number, z: number): boolean { return this.cells.has(VoxelGrid.key(x, y, z)) }
  /** Fill every empty cell of a box (or all of it, with `over`). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, ink: Ink, over = true): void {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (over || !this.has(x, y, z)) this.set(x, y, z, ink)
  }
  /** The outermost filled z of a column, on one flank. */
  outer(x: number, y: number, side: 1 | -1): number | null {
    let best: number | null = null
    for (const [vx, vy, vz] of this.voxels()) if (vx === x && vy === y && (best === null || vz * side > best * side)) best = vz
    return best
  }
  voxels(): Voxel[] {
    return [...this.cells].map(([k, ink]) => { const [x, y, z] = k.split(',').map(Number); return [x, y, z, ink] as const })
  }
}

/**
 * A box with its edges cut back: `b` is the bevel on each face, [x−, x+, y−, y+, z−, z+]. A face with 0 keeps its
 * square edge, so the body can sit flat on the floor while its top rolls.
 */
function bev(g: VoxelGrid, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, b: readonly number[], ink: Ink): void {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const r: number[] = [], bb: number[] = []
    for (const [d0, d1, i] of [[x - x0, x1 - x, 0], [y - y0, y1 - y, 2], [z - z0, z1 - z, 4]] as const) {
      const near = d0 <= d1 ? i : i + 1
      r.push(Math.max(0, b[near] - Math.min(d0, d1))); bb.push(b[near])
    }
    if (r[0] + r[1] > Math.max(bb[0], bb[1]) || r[0] + r[2] > Math.max(bb[0], bb[2]) || r[1] + r[2] > Math.max(bb[1], bb[2])) continue
    g.set(x, y, z, ink)
  }
}

/** The ring of cells round the head's base (y 4), one out from it: where every collar, cord and scarf goes. */
const NECK: readonly (readonly [number, number])[] = [
  ...[-2, -1, 0, 1].flatMap((z) => [[4, z], [9, z]] as const),
  ...[5, 6, 7, 8].flatMap((x) => [[x, -3], [x, 2]] as const),
]

/** The duck, bare: body, tail, head, beak, one eye a side, and a wing raised a voxel off each flank. */
function figure(g: VoxelGrid): void {
  bev(g, 0, 0, -3, 8, 3, 2, [1, 1, 0, 1, 1, 1], 'yellow')
  bev(g, -1, 3, -2, 1, 5, 1, [1, 0, 0, 1, 0, 0], 'yellow')
  bev(g, 4, 4, -3, 9, 9, 2, [1, 1, 1, 1, 1, 1], 'yellow')
  bev(g, 8, 6, -2, 10, 7, 1, [0, 1, 0, 0, 0, 0], 'beak')
  for (const side of [-1, 1] as const) {
    // The wing reads by its edge as well as its colour, so it stands proud of the flank.
    for (let x = 2; x <= 4; x++) { const z = g.outer(x, 2, side); if (z !== null) g.set(x, 2, z + side, 'wing') }
    const z = g.outer(7, 7, side)
    if (z !== null) g.set(7, 7, z, 'eye')
  }
}

/** Both flanks: `z` is the +z side's cell, and the −z side mirrors it about the head's middle (z = −0.5). */
function flanks(g: VoxelGrid, cells: readonly (readonly [number, number, number])[], ink: Ink): void {
  for (const [x, y, z] of cells) { g.set(x, y, z, ink); g.set(x, y, -1 - z, ink) }
}

/** Recolour his face on both flanks: the outermost head cell of each (x, y). */
function paint(g: VoxelGrid, cells: readonly (readonly [number, number])[], ink: Ink): void {
  for (const [x, y] of cells) for (const side of [-1, 1] as const) { const z = g.outer(x, y, side); if (z !== null) g.set(x, y, z, ink) }
}

/** A small duck, five voxels long, for the ducklings. */
function duckling(g: VoxelGrid, ox: number, oz: number): void {
  g.box(ox, 0, oz - 2, ox + 4, 1, oz + 1, 'yellow')
  g.box(ox - 1, 2, oz - 1, ox, 2, oz, 'yellow')
  g.box(ox + 2, 2, oz - 2, ox + 4, 4, oz + 1, 'yellow')
  g.box(ox + 5, 3, oz - 1, ox + 5, 3, oz, 'beak')
  g.set(ox + 4, 4, oz + 1, 'eye'); g.set(ox + 4, 4, oz - 2, 'eye')
}

/**
 * Everything he can wear, by item id (`sim/duck.ts` has the names, slots and how
 * each is had). Each is a few voxels placed by hand on the head block, and each
 * has to read at the room's zoom, where a voxel is two or three pixels.
 */
const WEAR: Record<string, (g: VoxelGrid) => void> = {
  // --- head ---
  crown(g) {
    for (let x = 5; x <= 8; x++) for (let z = -2; z <= 1; z++) if (x === 5 || x === 8 || z === -2 || z === 1) g.set(x, 10, z, 'gold')
    for (const [x, z] of [[5, -2], [8, -2], [5, 1], [8, 1]]) g.set(x, 11, z, 'gold')
    g.set(8, 10, -1, 'ruby'); g.set(8, 10, 0, 'ruby')
  },
  tophat(g) {
    g.box(4, 10, -3, 9, 10, 2, 'black')
    g.box(5, 11, -2, 8, 14, 1, 'black')
    g.box(5, 11, -2, 8, 11, 1, 'red')
  },
  partyhat(g) {
    g.box(5, 10, -2, 8, 10, 1, 'pink')
    g.box(5, 11, -2, 8, 11, 1, 'teal')
    for (const [x, z] of [[5, -2], [8, -2], [5, 1], [8, 1]]) g.set(x, 11, z, 'pink')
    g.box(6, 12, -1, 7, 12, 0, 'pink')
    g.box(6, 13, -1, 7, 13, 0, 'teal')
    g.box(6, 14, -1, 7, 14, 0, 'white')
  },
  helmet(g) {
    // An astronaut's hood with the face left open — glass would hide the one thing the helmet is for.
    g.box(4, 10, -3, 9, 10, 2, 'white')
    g.box(3, 5, -3, 3, 9, 2, 'white')
    flanks(g, [[4, 5, 3], [4, 6, 3], [4, 7, 3], [4, 8, 3], [4, 9, 3], [5, 9, 3]], 'white')
    for (const [x, z] of NECK) g.set(x, 4, z, 'silver')
    g.set(6, 11, -1, 'silver'); g.set(6, 12, -1, 'silver'); g.set(6, 13, -1, 'red')
  },
  propeller(g) {
    for (let x = 5; x <= 8; x++) for (let z = -2; z <= 1; z++) g.set(x, 10, z, x < 7 ? (z < 0 ? 'red' : 'blue') : (z < 0 ? 'green' : 'gold'))
    g.set(6, 11, -1, 'black')
    g.box(4, 12, -1, 8, 12, -1, 'red')
    g.set(6, 12, -1, 'gold')
  },
  beanie(g) {
    g.box(5, 10, -2, 8, 10, 1, 'red')
    for (const [x, z] of NECK) g.set(x, 9, z, 'darkred')
    g.box(6, 11, -1, 7, 11, 0, 'red')
    g.box(6, 12, -1, 7, 12, 0, 'white')
  },
  cap(g) {
    // Backwards. He is the CTO of a startup.
    g.box(5, 10, -2, 8, 10, 1, 'blue')
    g.box(6, 11, -1, 7, 11, 0, 'blue')
    g.box(3, 10, -2, 4, 10, 1, 'navy')
  },
  wizard(g) {
    g.box(4, 10, -3, 9, 10, 2, 'purple')
    g.box(5, 11, -2, 8, 11, 1, 'purple')
    g.box(5, 12, -2, 8, 12, 1, 'purple')
    for (const [x, z] of [[5, -2], [8, -2], [5, 1], [8, 1]]) g.set(x, 12, z, 'gold')
    g.box(6, 13, -1, 7, 14, 0, 'purple')
    g.set(5, 15, -1, 'purple')
    g.set(8, 11, 1, 'gold'); g.set(6, 12, 1, 'gold')
  },
  viking(g) {
    g.box(5, 10, -2, 8, 10, 1, 'silver')
    for (const [x, z] of NECK) g.set(x, 9, z, 'brown')
    flanks(g, [[6, 9, 3], [6, 10, 4], [6, 11, 5], [6, 12, 5]], 'cream')
  },
  headphones(g) {
    for (const x of [5, 6]) { g.box(x, 10, -2, x, 10, 1, 'black'); flanks(g, [[x, 9, 2]], 'black') }
    flanks(g, [[4, 5, 3], [5, 5, 3], [6, 5, 3], [4, 6, 3], [4, 7, 3], [4, 8, 3], [6, 6, 3], [6, 7, 3], [6, 8, 3], [5, 8, 3]], 'black')
    flanks(g, [[5, 6, 3], [5, 7, 3]], 'teal')
  },
  // --- face --- (painted onto the face, not stood off it: at this size a frame a voxel proud is as wide as his head)
  readers(g) {
    paint(g, [[6, 6], [7, 6], [8, 6], [6, 7], [8, 7], [6, 8], [7, 8], [8, 8], [5, 8]], 'brown')
    g.box(9, 8, -2, 9, 8, 1, 'brown')
  },
  shades(g) {
    paint(g, [[6, 8], [7, 8], [8, 8], [6, 7], [7, 7], [8, 7], [7, 6], [8, 6], [5, 8]], 'black')
    g.box(9, 8, -2, 9, 8, 1, 'black')
    paint(g, [[6, 8]], 'white')
  },
  monocle(g) {
    // A black rim and a gold chain: a gold rim on a yellow face is not there at all.
    for (const [x, y] of [[6, 6], [7, 6], [8, 6], [6, 7], [8, 7], [6, 8], [7, 8], [8, 8]]) g.set(x, y, 2, 'black')
    g.set(6, 5, 2, 'gold'); g.set(6, 4, 2, 'gold'); g.set(5, 3, 2, 'gold'); g.set(5, 2, 3, 'gold')
  },
  vr(g) {
    g.box(10, 7, -3, 10, 8, 2, 'black')
    g.box(9, 7, -3, 9, 8, 2, 'black')
    flanks(g, [[7, 7, 3], [8, 7, 3], [9, 7, 3], [7, 8, 3], [8, 8, 3], [9, 8, 3], [5, 8, 3], [6, 8, 3], [4, 8, 3]], 'black')
    g.box(3, 8, -3, 3, 8, 2, 'black')
    g.box(11, 8, -2, 11, 8, 1, 'teal')
  },
  eyepatch(g) {
    for (const [x, y] of [[6, 7], [7, 7], [8, 7], [7, 6], [7, 8], [6, 8], [8, 8], [6, 6], [8, 6]]) g.set(x, y, 2, 'black')
    for (let z = -2; z <= 1; z++) g.set(6, 9, z, 'black')
    g.set(6, 8, -3, 'black'); g.set(5, 8, 2, 'black')
  },
  glasses3d(g) {
    for (const side of [1, -1] as const) for (const [x, y] of [[6, 7], [7, 7], [8, 7], [6, 8], [7, 8], [8, 8]]) g.set(x, y, side > 0 ? 2 : -3, side > 0 ? 'red' : 'teal')
    paint(g, [[6, 9], [7, 9], [8, 9], [5, 8], [5, 7]], 'white')
    g.box(9, 8, -2, 9, 8, 1, 'white')
  },
  // --- neck ---
  lanyard(g) {
    for (const [x, z] of NECK) if (x !== 9) g.set(x, 4, z, 'red')
    g.box(9, 3, -1, 9, 4, 0, 'red')
    g.box(9, 1, -1, 9, 2, 0, 'white')
    g.set(9, 2, -1, 'teal')
  },
  bowtie(g) {
    // As wide as his head, or from the side it is a red line.
    g.box(9, 4, -3, 10, 5, 2, 'red')
    g.box(10, 4, -1, 10, 5, 0, 'darkred')
    g.box(9, 5, -2, 9, 5, 1, 'yellow', false)
  },
  necktie(g) {
    g.box(10, 5, -1, 10, 5, 0, 'navy')
    g.box(9, 1, -1, 9, 4, 0, 'blue')
    g.set(9, 0, 0, 'blue')
  },
  scarf(g) {
    for (const [x, z] of NECK) g.set(x, 4, z, (x + z) % 2 === 0 ? 'red' : 'white')
    for (const [y, ink] of [[3, 'white'], [2, 'red'], [1, 'white']] as const) g.set(4, y, 3, ink)
  },
  chain(g) {
    // Silver links and a gold medallion with a stone in it: gold links vanish on a yellow duck.
    for (const [x, z] of NECK) if (x !== 9) g.set(x, 4, z, 'silver')
    g.box(9, 4, -1, 9, 4, 0, 'silver')
    g.box(9, 1, -2, 9, 3, 1, 'gold')
    g.box(10, 2, -1, 10, 2, 0, 'ruby')
  },
  cape(g) {
    g.box(1, 4, -3, 3, 4, 2, 'red')
    g.box(-2, 0, -3, -2, 4, 2, 'red')
    g.box(-1, 4, -3, 0, 4, 2, 'red', false)
    for (const [x, z] of NECK) if (x === 4) g.set(x, 5, z, 'darkred')
  },
  // --- beside him (the old bath slot) ---
  bubbles(g) {
    for (const [x, y, z] of [[-3, 6, 3], [11, 2, 4], [2, 9, -6], [12, 7, -3], [-2, 2, -6], [5, 12, 4]]) g.set(x, y, z, 'glass')
    g.box(-4, 8, -1, -3, 9, 0, 'white')
    g.box(12, 4, 2, 13, 5, 3, 'white')
  },
  ring(g) {
    // A rubber ring, pink and white in thirds round him.
    let i = 0
    for (let x = -1; x <= 9; x++) for (const z of [-4, 3]) g.set(x, 1, z, Math.floor(i++ / 3) % 2 ? 'white' : 'pink')
    for (let z = -3; z <= 2; z++) for (const x of [-1, 9]) g.set(x, 1, z, Math.floor(i++ / 3) % 2 ? 'white' : 'pink')
  },
  mug(g) {
    g.box(11, 0, 4, 13, 2, 6, 'white')
    g.set(12, 2, 5, 'brown')
    g.set(14, 1, 5, 'white')
    g.set(12, 1, 7, 'teal')
  },
  laptop(g) {
    g.box(11, 0, -3, 14, 0, 2, 'silver')
    g.box(14, 1, -3, 14, 4, 2, 'silver')
    // A duck sticker on the lid, which is the side the room sees.
    g.box(15, 2, -1, 15, 3, 0, 'yellow')
  },
}

/** Every id {@link duckVoxels} can draw. `sim/duck.ts`'s catalogue is tested against it. */
export const WEARABLE_IDS: readonly string[] = [...Object.keys(WEAR), 'ducklings']

/** Where the ducklings sit, nearest first: one at his tail, then round him. */
const DUCKLING_AT: readonly (readonly [number, number])[] = [[-7, 5], [11, -6], [-6, -6], [11, 5], [-12, 0]]

export interface DuckExtras {
  /** Ducklings round him, 0..5. */
  ducklings?: number
  /** Stacks of printouts beside him, 0..3. */
  printouts?: number
}

/**
 * The duck in an outfit, as voxels. `outfit` is slot → item id (unknown ids are
 * skipped); ducklings are an item but a count, so they come in `extras`.
 */
export function duckVoxels(outfit: Readonly<Partial<Record<string, string>>>, extras: DuckExtras = {}): Voxel[] {
  const g = new VoxelGrid()
  figure(g)
  for (const id of Object.values(outfit)) if (id && WEAR[id]) WEAR[id](g)
  const n = Math.max(0, Math.min(DUCKLING_AT.length, Math.floor(extras.ducklings ?? 0)))
  for (let i = 0; i < n; i++) duckling(g, DUCKLING_AT[i][0], DUCKLING_AT[i][1])
  for (let i = 0; i < Math.max(0, Math.min(3, Math.floor(extras.printouts ?? 0))); i++) g.box(1 + i * 3, 0, -7, 2 + i * 3, i, -6, 'paper')
  return g.voxels()
}

/**
 * One item on its own, for its tile in the wardrobe: the cells that differ from
 * the bare duck. A painted-on item (glasses, a patch) comes out as the paint.
 */
export function itemVoxels(id: string): Voxel[] {
  if (id === 'ducklings') { const g = new VoxelGrid(); duckling(g, 0, 0); return g.voxels() }
  const bare = new VoxelGrid()
  figure(bare)
  const worn = new VoxelGrid()
  figure(worn)
  WEAR[id]?.(worn)
  return worn.voxels().filter(([x, y, z, ink]) => bare.get(x, y, z) !== ink)
}

/** The middle of his head, in his frame and in voxels: where the dialogue's lens looks. */
export const DUCK_HEAD: readonly [number, number, number] = [7, 7, -0.5]
