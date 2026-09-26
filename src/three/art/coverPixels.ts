/*
 * Copied from the rebuild (100m-devs-three/src/art/coverPixels.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * The cover, painted — GDD §10.5 [amended 2026-09-14, at the user's instruction].
 *
 * `sim/cover.ts` rolls the spec and says nothing about how it looks; this is
 * the painter. It produces a 32 × 32 bitmap of palette indices, which is the
 * thing the user asked for in two words — *coloured* and *pixelated* — and
 * the thing the old vector glyph was not: one hue in four values, drawn with
 * anti-aliased paths, read as a symbol on a swatch rather than as a boxed game.
 *
 * **Nothing here is an asset.** A release is unbounded — a long run ships
 * dozens and every prestige run ships more — so a cover that cost a file would
 * be the hole in the bottom of §22.7's nineteen-sprite cap. The picture is a
 * pure function of the spec, which is itself a pure function of the run seed
 * and the release ordinal, so the cover of a game is a *fact about that game*
 * and survives a reload, a screenshot and a week.
 *
 * ## Why a bitmap and not an SVG scene
 *
 * A pixel is a decision. At 32 wide there are 1,024 of them and every one is
 * either the sky, the ground or the subject, so the picture cannot be *vague*
 * — which is what the 48-unit vector composition was at the 34 px the HUD
 * draws it. The renderer scales the grid with `crispEdges`, so the same
 * picture is 1 px a cell on the rail and 4.6 px a cell on the gallery wall,
 * and it is unmistakably the same picture.
 *
 * ## The layers, bottom to top
 *
 *  1. **Sky** — two family colours with a dithered band between them, which is
 *     how pixel art has always drawn a gradient.
 *  2. **Sky feature** — a sun or moon, a ringed planet, stars, a cloud bank.
 *  3. **Backdrop** — mountains, a skyline with lit windows, a treeline, or
 *     nothing, standing on the horizon in the family's far colour.
 *  4. **Ground** — flat with speckle, a road with a dashed centre line, water,
 *     or tiles.
 *  5. **Subject** — the genre's sprite, in its *own* colours (a rocket is
 *     white and red on any sky), outlined automatically in near-black so it
 *     stands off a pale ground as well as a dark one, with a shadow under it.
 *
 * ## [2026-09-14] The subject is half the box, and there are twelve of them
 *
 * The first pass drew every sprite at one cell a pixel, so a ten-row die stood
 * a third of the way up a thirty-two-row box with an acre of sky over it and
 * read as a stray mark rather than as the thing on the cover. Two answers,
 * because there are two kinds of sprite:
 *
 * - **The compact ones double.** Ten rows or fewer and fourteen columns or
 *   fewer are drawn at ×2 — the die, the gem, the blob, the ghost, the kart,
 *   the saucer — so they stand twenty cells tall with the chunky edge that
 *   says *pixel art* rather than *small drawing*.
 * - **The tall ones were redrawn.** A rocket cannot double without leaving the
 *   frame, so the rocket, the sword, the castle, the monitor, the tent and the
 *   barn are fifteen and sixteen rows as *drawn*, with detail a doubled sprite
 *   cannot carry. Both kinds now fill about half the box.
 *
 * And **arcade and rpg have two subjects each**, because they are the two
 * commonest genres the grammar rolls and a wall with four arcade games on it
 * was four rockets. Which one a cover gets is another seed roll (`subject`),
 * so the pair is variety rather than a second genre.
 *
 * **There is no text on a cover.** Not a plate, not a title, not initials, not
 * the legacy's dashes-that-are-not-words. The first draft lettered the first
 * word of the title on a cream plate along the bottom eight rows, and the user
 * said no twice: *"no need for text in the art"*, then *"I want no text in the
 * cover arts."* The picture is the whole tile; the name is printed beside it
 * wherever it is shown. The painter therefore takes the spec and nothing else,
 * so the same spec is the same picture under any title.
 *
 * The frame is *not* painted here. It is the rating's, drawn by the renderer
 * around the bitmap, so that the art of a game is the same art whatever it
 * scored and only its border gives it away (§10.5).
 *
 * Pure — no canvas, no DOM. `art/` may be imported by the renderer and by
 * tests, and by nothing in `sim/`.
 */

import type { CoverSpec } from '../sim/cover.ts'
import type { Genre } from '../sim/titles.ts'

export const COVER_SIZE = 32

/** A painted cover: every cell is an index into `palette`. */
export interface CoverBitmap {
  size: number
  palette: string[]
  cells: Uint8Array
}

/**
 * The eight palette families — sky, far, ground, road, water.
 *
 * Chosen as *pairs that are not the same hue*: a day sky against green ground,
 * a dusk sky against a dark meadow, a candy sky against mint tiles. The old
 * ramp's whole failure was that sky, ground and subject were one hue in four
 * values, so a cover could only ever be "the blue one" or "the red one".
 *
 * **The rule every row obeys, and the test measures:** the four colours that
 * are painted on *every* cover — sky top, sky bottom, ground and the horizon
 * line — sit in four different thirty-degree hue sectors. The subject, the
 * sky feature and the backdrop only add to that. A first pass had a night
 * family that was navy on navy on navy and an ice family that was blue on
 * white, and a ghost on either was a mono-hue drawing with a plate under it,
 * which is the exact thing the user sent back.
 */
interface Family {
  skyTop: string
  skyBottom: string
  far: string
  ground: string
  groundLit: string
  groundDark: string
  road: string
  water: string
  /** What the sun is here: a yellow disc by day, a pale moon by night. */
  lamp: string
}

export const FAMILY_TABLE: readonly Family[] = [
  { skyTop: '#2F7FD1', skyBottom: '#9ED8F7', far: '#6A93B8', ground: '#4C9A3E', groundLit: '#7CC456', groundDark: '#4A5A12', road: '#C9A96E', water: '#3E8FD6', lamp: '#FFE66D' }, // day
  { skyTop: '#3A2A6A', skyBottom: '#F08A5D', far: '#7A4C86', ground: '#2E5A3A', groundLit: '#4E8A52', groundDark: '#1A3A50', road: '#A0785A', water: '#6A5A9A', lamp: '#FFD07A' }, // dusk
  { skyTop: '#0B1230', skyBottom: '#4A3A7A', far: '#26305A', ground: '#1A3F3A', groundLit: '#2E6A5E', groundDark: '#3A1A3A', road: '#4A5A7A', water: '#1E3D6E', lamp: '#F4E8A8' }, // night
  { skyTop: '#3D8FD6', skyBottom: '#FBE7B0', far: '#9A5A7A', ground: '#D98A4A', groundLit: '#F0C98A', groundDark: '#7A3A5A', road: '#B07A4A', water: '#56B0C8', lamp: '#FFF1A8' }, // desert
  { skyTop: '#6FA8E8', skyBottom: '#F0C8EC', far: '#8E7CC8', ground: '#D6E9F3', groundLit: '#FFFFFF', groundDark: '#7A9AB8', road: '#B8C8D8', water: '#4FA8D8', lamp: '#FFE9A0' }, // ice
  { skyTop: '#2A1A4A', skyBottom: '#4EA86B', far: '#2B6A4A', ground: '#4A2E1A', groundLit: '#6A4A2A', groundDark: '#2A1A0A', road: '#6E6A3A', water: '#7ED957', lamp: '#D8F5A0' }, // toxic
  { skyTop: '#FF7EB3', skyBottom: '#FFF0B8', far: '#C86AA8', ground: '#6FD3C0', groundLit: '#A9EBDD', groundDark: '#2A9A9A', road: '#F5D0E6', water: '#7FC8F0', lamp: '#FFF3B0' }, // candy
  { skyTop: '#2A0A0A', skyBottom: '#F0A83A', far: '#5E1F1F', ground: '#4A2A3A', groundLit: '#6A3A4A', groundDark: '#1A1A3A', road: '#8A5A3A', water: '#B03A2A', lamp: '#FFB35C' }, // ember
]

/** Near-black for outlines and pips: never pure black, which sits *on* a picture rather than in it. */
const INK = '#1B1B22'
const WHITE = '#FFFFFF'

/**
 * Each subject as rows of legend characters, with its own colours.
 *
 * `.` is transparent. Every sprite is designed standing on its bottom row, and
 * every sprite is either **≤ 10 rows and ≤ 14 columns** (so it doubles) or
 * **15 to 16 rows** (so it does not need to). There is deliberately nothing in
 * between: a twelve-row sprite is the one size that can neither double nor
 * fill the frame, which is what the whole first pass was.
 */
interface Sprite {
  rows: readonly string[]
  colours: Record<string, string>
}

/**
 * The twelve subjects, by id.
 *
 * Keyed by their own name rather than by genre because two genres carry two of
 * them — see {@link SUBJECTS}. A sprite is a picture, not a category.
 */
const SPRITES: Record<string, Sprite> = {
  /* Sixteen rows: a rocket that doubled would be off the top of the box. */
  rocket: {
    rows: [
      '......W......',
      '.....WWW.....',
      '....WWRWW....',
      '....WWRWW....',
      '...WWWRWWW...',
      '...WWBBBWW...',
      '...WBBBBBW...',
      '...WWBBBWW...',
      '...WWWWWWW...',
      '..WWWWWWWWW..',
      '..WWWWWWWWW..',
      '.RRWWWWWWWRR.',
      'RRRWWWWWWWRRR',
      'RRR..WWW..RRR',
      '.....YYY.....',
      '....YOOOY....',
    ],
    colours: { W: '#F2F2F2', R: '#E23D3D', B: '#4FA3E8', Y: '#FFD23F', O: '#FF7A1F' },
  },
  /* The second arcade subject. Nine rows, so it doubles. */
  saucer: {
    rows: [
      '....CCCCC....',
      '...CLLLLLC...',
      '..CCCCCCCCC..',
      '.GGGGGGGGGGG.',
      'GGMGGMGGMGGMG',
      'GGGGGGGGGGGGG',
      '.GGGGGGGGGGG.',
      '..YY.....YY..',
      '...Y.......Y.',
    ],
    colours: { C: '#5ED4F0', L: '#E8FCFF', G: '#B7C2CC', M: '#E255B4', Y: '#FFE66D' },
  },
  die: {
    rows: [
      '..IIIIIIIS',
      '.IIIIIIIIS',
      'IIKIIIKIIS',
      'IIIIIIIIIS',
      'IIIIKIIIIS',
      'IIIIIIIIIS',
      'IIKIIIKIIS',
      'IIIIIIIIIS',
      'IIIIIIIISS',
      'IIIIIIIIS.',
    ],
    colours: { I: '#F5EEDC', K: '#202020', S: '#B9AE93' },
  },
  /* Fifteen rows, point up. The first pass drew it diagonally at twelve, which
     put the blade across a corner and the hilt nowhere near the ground. */
  sword: {
    rows: [
      '......S......',
      '.....SSS.....',
      '....SSLSS....',
      '....SSLSS....',
      '....SSLSS....',
      '....SSLSS....',
      '....SSLSS....',
      '....SSLSS....',
      '.GGGGGGGGGGG.',
      '.GG.......GG.',
      '.....BBB.....',
      '.....BBB.....',
      '.....BBB.....',
      '....GGGGG....',
      '.....GGG.....',
    ],
    colours: { S: '#C9D3DC', L: '#FFFFFF', G: '#E0B341', B: '#7A4A2A' },
  },
  /* The second rpg subject. */
  castle: {
    rows: [
      '......R........',
      '......R........',
      '......RRRR.....',
      '.S.S.....S.S...',
      '.SSS.....SSS...',
      '.SSS.....SSS...',
      '.SSWS....SWSS..',
      '.SSSS....SSSS..',
      'S.S.S.S.S.S.S.S',
      'SSSSSSSSSSSSSSS',
      'SSSWSSSSSSSWSSS',
      'SSSSSSSSSSSSSSS',
      'SSSSSSDDDSSSSSS',
      'SSSSSSDDDSSSSSS',
      'SSSSSSDDDSSSSSS',
    ],
    colours: { S: '#9AA5AE', W: '#FFD23F', D: '#6B4A2E', R: '#E23D3D' },
  },
  monitor: {
    rows: [
      'GGGGGGGGGGGGGGG',
      'GDDDDDDDDDDDDDG',
      'GDDDDDDDDDDDYDG',
      'GDDDDDDDDDDDYDG',
      'GDDDDDDDDDDEYDG',
      'GDDDDDDDDDEEYDG',
      'GDDDDDDDDEEEYDG',
      'GDDDDDDDEEEEYDG',
      'GDDDDDDEEEEEYDG',
      'GDDDDDEEEEEEYDG',
      'GDDDDDDDDDDDDDG',
      'GGGGGGGGGGGGGGG',
      '......GGG......',
      '......GGG......',
      '..GGGGGGGGGGG..',
    ],
    colours: { G: '#8E9AA6', D: '#1E2A33', E: '#5FD37A', Y: '#FFD23F' },
  },
  tent: {
    rows: [
      '.......P.......',
      '......PRR......',
      '......P........',
      '.......C.......',
      '......CCC......',
      '.....CCCCC.....',
      '....CCCCCCC....',
      '...CCCDDDCCC...',
      '..CCCCDDDCCCC..',
      '.CCCCCDDDCCCCC.',
      'CCCCCCDDDCCCCCC',
      'CCCCCCDDDCCCCCC',
      'CCCCCCDDDCCCCCC',
      'BBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBB',
    ],
    colours: { C: '#D96A3A', D: '#2A2018', P: '#4A4A55', R: '#E23D3D', B: '#6B4A2E' },
  },
  kart: {
    rows: [
      '....RRRRR....',
      '...RWWWWRR...',
      '..RRRRRRRRR..',
      '.RRRRRRRRRRRY',
      'RRRRRRRRRRRRR',
      'RRKKRRRRRKKRR',
      '.KHKK...KHKK.',
      '..KK.....KK..',
    ],
    colours: { R: '#E23D3D', W: '#BFE6FF', K: '#202020', H: '#9AA0A6', Y: '#FFD23F' },
  },
  gem: {
    rows: [
      '...CCCC...',
      '..CLLCCC..',
      '.CLLCCCCC.',
      'CLLCCCCCCD',
      'CLCCCCCCDD',
      '.CCCCCCDD.',
      '..CCCCDD..',
      '...CCDD...',
      '....DD....',
    ],
    colours: { C: '#3FC1E8', L: '#E6FBFF', D: '#1E6FA8' },
  },
  blob: {
    rows: [
      '...YYYY...',
      '..YYYYYY..',
      '.YYWKYWKY.',
      'YYYYYYYYYY',
      'YYYKYYYYKY',
      'YYYYKKKKYY',
      '.YYYYYYYY.',
      '..YY..YY..',
      '.KK....KK.',
    ],
    colours: { Y: '#FFC53D', W: '#FFFFFF', K: '#202020' },
  },
  ghost: {
    rows: [
      '..GGGGG..',
      '.GGGGGGGS',
      'GGKGGGKGS',
      'GGKGGGKGS',
      'GGGGGGGGS',
      'GGGGGGGGS',
      'GGGGGGGGS',
      'GGGGGGGGS',
      'GG.GGG.GS',
      'G...G...S',
    ],
    colours: { G: '#ECEFF8', K: '#202020', S: '#C4CBE6' },
  },
  barn: {
    rows: [
      '.......D.......',
      '......DDD......',
      '.....DDDDD.....',
      '....DDDDDDD....',
      '...DDDDDDDDD...',
      '..DDDDDDDDDDD..',
      '.DDDDDDDDDDDDD.',
      'RRRRRRRRRRRRRRR',
      'RRRRRWWWRRRRRRR',
      'RRRRRWWWRRRRRRR',
      'RRRRRRRRRRRRRRR',
      'RRRRWWWWWWWRRRR',
      'RRRRWRRRRRWRRRR',
      'RRRRWRRRRRWRRRR',
      'RRRRWWWWWWWRRRR',
    ],
    colours: { D: '#5A4A4A', R: '#C0392B', W: '#F5EEDC' },
  },
}

/**
 * Which subjects a genre may be drawn with, in spec order.
 *
 * `sim/cover.ts`'s `SUBJECTS_PER_GENRE` is the authority on how many there are
 * — it is the module that rolls the number — and `coverPixels.test.ts` pins
 * the two against each other, on the same terms as `FAMILIES` and
 * `FAMILY_TABLE`. A genre that grew a subject here and not there would draw
 * one of them never.
 */
export const SUBJECTS: Record<Genre, readonly string[]> = {
  arcade: ['rocket', 'saucer'],
  roguelike: ['die'],
  rpg: ['sword', 'castle'],
  tycoon: ['monitor'],
  survival: ['tent'],
  racer: ['kart'],
  puzzle: ['gem'],
  platformer: ['blob'],
  horror: ['ghost'],
  farming: ['barn'],
}

/**
 * Where the horizon sits, where the subject stands and which way it faces.
 *
 * Four arrangements that differ in the things that change a *composition*: how
 * much of the box is sky, whether the subject is centred or off to one side
 * with the backdrop showing past it, and which way it looks.
 *
 * **Every layout now prefers ×2**, and the horizons are all at least 21 so
 * that the preference can actually be honoured. It used to alternate, on the
 * theory that a subject standing in a landscape was a different composition
 * from one filling the frame — but at 34 px on the rail, "standing in a
 * landscape" is indistinguishable from "nothing in particular happened here".
 * The composition varies by where the horizon is and where the subject stands
 * on it, which survives being small.
 */
const ARRANGEMENT = [
  { horizon: 22, x: 16, flip: false, scale: 2 },
  { horizon: 25, x: 16, flip: true, scale: 2 },
  { horizon: 21, x: 12, flip: false, scale: 2 },
  { horizon: 24, x: 19, flip: true, scale: 2 },
] as const

/**
 * Paint a cover — the whole picture, as palette indices.
 *
 * Deterministic in the spec, and cheap: about a thousand assignments, which is
 * why the renderer can afford to memoise it per key rather than cache bitmaps.
 */
export function paintCover(spec: CoverSpec): CoverBitmap {
  const N = COVER_SIZE
  const palette: string[] = []
  const index = new Map<string, number>()
  const cells = new Uint8Array(N * N)
  const idx = (colour: string) => {
    let i = index.get(colour)
    if (i === undefined) {
      i = palette.length
      palette.push(colour)
      index.set(colour, i)
    }
    return i
  }
  const put = (x: number, y: number, colour: string) => {
    if (x < 0 || y < 0 || x >= N || y >= N) return
    cells[y * N + x] = idx(colour)
  }

  const family = FAMILY_TABLE[spec.family % FAMILY_TABLE.length]
  const place = ARRANGEMENT[spec.layout % ARRANGEMENT.length]
  const horizon = place.horizon

  // 1 — the sky, in three bands: top, a dithered join, bottom.
  const join = Math.floor(horizon * 0.42)
  for (let y = 0; y < horizon; y++) {
    for (let x = 0; x < N; x++) {
      const top = y < join ? true : y < join + 3 ? (x + y) % 2 === 0 : false
      put(x, y, top ? family.skyTop : family.skyBottom)
    }
  }

  // 2 — what stands in the sky.
  const sky = spec.scene % SCENES_IN_PAINTER
  if (sky === 0) {
    disc(put, place.flip ? 6 : 26, 5, 3, family.lamp)
  } else if (sky === 1) {
    disc(put, place.flip ? 7 : 25, 6, 3, '#E28A6C')
    for (let x = -5; x <= 5; x++) if (Math.abs(x) > 1) put((place.flip ? 7 : 25) + x, 6 + (x < 0 ? 1 : 0), '#F2D6C4')
  } else if (sky === 2) {
    for (const [x, y] of [[3, 2], [10, 5], [19, 2], [28, 4], [7, 9], [24, 8], [30, 11], [14, 11]]) put(x, y, WHITE)
  } else {
    cloud(put, place.flip ? 22 : 3, 4)
    cloud(put, place.flip ? 4 : 21, 9)
  }

  // 3 — the backdrop on the horizon.
  const back = spec.backdrop % BACKDROPS_IN_PAINTER
  if (back === 0) {
    for (let x = 0; x < N; x++) {
      const h = Math.max(7 - Math.abs(x - 6), 5 - Math.abs(x - 17), 8 - Math.abs(x - 27), 0)
      for (let y = horizon - h; y < horizon; y++) put(x, y, family.far)
    }
  } else if (back === 1) {
    const buildings = [[1, 3, 5], [5, 4, 8], [10, 3, 4], [14, 4, 7], [19, 3, 6], [23, 4, 9], [28, 3, 5]] as const
    for (const [x0, w, h] of buildings) {
      for (let x = x0; x < x0 + w; x++) for (let y = horizon - h; y < horizon; y++) put(x, y, family.far)
      for (let y = horizon - h + 1; y < horizon - 1; y += 2) put(x0 + 1, y, '#FFD23F')
    }
  } else if (back === 2) {
    for (const x of [2, 7, 12, 17, 22, 27]) {
      put(x, horizon - 1, '#3A2A1E')
      put(x, horizon - 2, '#3A2A1E')
      disc(put, x, horizon - 4, 2, family.far)
    }
  }

  // 4 — the ground.
  for (let y = horizon; y < N; y++) for (let x = 0; x < N; x++) put(x, y, family.ground)
  const ground = spec.pattern % PATTERNS_IN_PAINTER
  if (ground === 0) {
    for (let y = horizon; y < N; y++) for (let x = 0; x < N; x++) if ((x * 7 + y * 13) % 11 === 0) put(x, y, family.groundLit)
  } else if (ground === 1) {
    const depth = N - horizon
    for (let y = horizon; y < N; y++) {
      const t = (y - horizon) / Math.max(1, depth - 1)
      const half = 3 + t * 6
      for (let x = Math.round(16 - half); x <= Math.round(16 + half); x++) put(x, y, family.road)
      if ((y - horizon) % 3 === 1) put(16, y, '#F2E9C8')
    }
  } else if (ground === 2) {
    const shore = horizon + Math.max(2, Math.floor((N - horizon) * 0.35))
    for (let y = shore; y < N; y++) for (let x = 0; x < N; x++) put(x, y, family.water)
    for (let y = shore + 1; y < N; y += 3) for (let x = (y % 2) * 2; x < N; x += 7) { put(x, y, WHITE); put(x + 1, y, WHITE) }
  } else {
    for (let y = horizon; y < N; y++) for (let x = 0; x < N; x++) {
      if (((x >> 1) + (y >> 1)) % 2 === 0) put(x, y, family.groundLit)
    }
  }
  // The horizon line itself, one shade darker: the ground is a thing with an edge.
  for (let x = 0; x < N; x++) put(x, horizon, family.groundDark)

  // 5 — the subject, outlined, with a shadow under it.
  const choices = SUBJECTS[spec.genre]
  const sprite = SPRITES[choices[spec.subject % choices.length]]
  const rows = sprite.rows.length
  const cols = Math.max(...sprite.rows.map((r) => r.length))
  const scale = place.scale === 2 && rows * 2 <= horizon - 1 && cols * 2 <= N - 4 ? 2 : 1
  const h = rows * scale
  const w = cols * scale
  /*
   * Clamped into the frame rather than centred on the arrangement's `x`.
   *
   * The off-centre layouts put a doubled kart's left edge at −2, and a subject
   * with two columns missing does not read as *off to one side*, it reads as
   * broken. The arrangement still decides where it stands whenever there is
   * room; it only gives way at the edge.
   *
   * The margin is **two** columns, not one: the outline is drawn a cell wider
   * than the sprite on each side, and a silhouette whose outline is clipped is
   * clipped. The first version reserved one and the doubled saucer's ink ran
   * down column zero.
   */
  const ox = w >= N - 4
    ? Math.floor((N - w) / 2)
    : Math.max(2, Math.min(N - 2 - w, place.x - Math.floor(w / 2)))
  const oy = horizon + 1 - h
  /** The sprite cell under bitmap cell (r, c), flipped and scaled, or null off the sprite. */
  const cellAt = (r: number, c: number): string | null => {
    if (r < 0 || r >= h || c < 0 || c >= w) return null
    const sr = Math.floor(r / scale)
    const sc = Math.floor(c / scale)
    const row = sprite.rows[sr]
    const col = place.flip ? cols - 1 - sc : sc
    if (col < 0 || col >= row.length) return null
    return row[col] === '.' ? null : row[col]
  }
  const solid = (r: number, c: number) => cellAt(r, c) !== null
  for (let x = ox - 1; x <= ox + w; x++) {
    if (x >= 0 && x < N) put(x, horizon + 1, family.groundDark)
  }
  for (let r = -1; r <= h; r++) {
    for (let c = -1; c <= w; c++) {
      if (solid(r, c)) continue
      if (solid(r - 1, c) || solid(r + 1, c) || solid(r, c - 1) || solid(r, c + 1)) put(ox + c, oy + r, INK)
    }
  }
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = cellAt(r, c)
      if (ch !== null) put(ox + c, oy + r, sprite.colours[ch] ?? INK)
    }
  }

  return { size: N, palette, cells }
}

/** The painter's own counts, pinned here so a spec roll past them wraps rather than throws. */
const SCENES_IN_PAINTER = 4
const BACKDROPS_IN_PAINTER = 4
const PATTERNS_IN_PAINTER = 4

type Put = (x: number, y: number, colour: string) => void

function disc(put: Put, cx: number, cy: number, r: number, colour: string): void {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.5) put(cx + x, cy + y, colour)
}

/** A cloud is a flat base with two bumps on it — three shapes, unmistakably weather. */
function cloud(put: Put, x: number, y: number): void {
  for (let i = 0; i < 7; i++) put(x + i, y, WHITE)
  for (let i = 1; i < 6; i++) put(x + i, y - 1, WHITE)
  put(x + 2, y - 2, WHITE)
  put(x + 3, y - 2, WHITE)
}

/** One horizontal run of a single colour, for a renderer that draws rectangles. */
export interface Run {
  x: number
  y: number
  w: number
  colour: string
}

/**
 * Run-length rows, so a 1,024-cell bitmap is a few hundred rectangles rather
 * than a thousand. The order is row-major, which keeps React's keys stable
 * between two covers of the same layout.
 */
export function runsOf(bitmap: CoverBitmap): Run[] {
  const runs: Run[] = []
  const n = bitmap.size
  for (let y = 0; y < n; y++) {
    let x = 0
    while (x < n) {
      const c = bitmap.cells[y * n + x]
      let w = 1
      while (x + w < n && bitmap.cells[y * n + x + w] === c) w++
      runs.push({ x, y, w, colour: bitmap.palette[c] })
      x += w
    }
  }
  return runs
}

/**
 * How many distinct hues a bitmap carries — the measurement behind "coloured,
 * not a mono-hue drawing". Greys and near-blacks are ignored, and hue is
 * bucketed to thirty-degree sectors so two blues count once.
 */
export function hueCount(bitmap: CoverBitmap): number {
  const sectors = new Set<number>()
  for (const colour of bitmap.palette) {
    const r = parseInt(colour.slice(1, 3), 16) / 255
    const g = parseInt(colour.slice(3, 5), 16) / 255
    const b = parseInt(colour.slice(5, 7), 16) / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const d = max - min
    if (d < 0.12) continue
    let h = 0
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
    sectors.add(Math.floor(h / 30))
  }
  return sectors.size
}

/**
 * How much of the box the subject stands in, as a fraction of its height.
 *
 * Published for the test that pins the amendment above: "the subject is the
 * picture" is a claim about a size, and a size is the one thing a comment
 * cannot be trusted with. It measures the *drawn* sprite — outline included,
 * since the outline is part of the silhouette the eye reads at 34 px.
 */
export function subjectHeight(spec: CoverSpec): number {
  const choices = SUBJECTS[spec.genre]
  const sprite = SPRITES[choices[spec.subject % choices.length]]
  const place = ARRANGEMENT[spec.layout % ARRANGEMENT.length]
  const rows = sprite.rows.length
  const cols = Math.max(...sprite.rows.map((r) => r.length))
  const scale = place.scale === 2 && rows * 2 <= place.horizon - 1 && cols * 2 <= COVER_SIZE - 4 ? 2 : 1
  return (rows * scale) / COVER_SIZE
}
