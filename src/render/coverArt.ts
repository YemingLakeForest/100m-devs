/**
 * The key art on a game's cover — GDD §10.11.3.
 *
 * ## What was wrong with the first pass
 *
 * The covers were an 8×8 silhouette scaled up by five, on a flat backdrop, and
 * they read as *random pixel blocks* rather than as game covers. Three separate
 * reasons, and each one is a different fix:
 *
 * 1. **One tone.** A shape filled in a single colour is a symbol, not art. Real
 *    pixel work has at least a body and a shade, and the eye reads the second
 *    tone as *form* — the difference between a rocket and a rocket-shaped hole.
 * 2. **8×8 at five pixels a cell.** That is a resolution at which nothing has
 *    detail and everything has staircases. Sixteen across at two pixels a cell
 *    fills the same area with four times the information.
 * 3. **No composition.** A cover is not a logo on a field. It is sky, ground, a
 *    subject standing in it, and a title plate — and the *arrangement* is what
 *    makes a 48-pixel square read as a boxed game rather than as an icon.
 *
 * This file is the first two. `hud/Cover.tsx` is the third.
 *
 * ## The grammar
 *
 * Each sprite is sixteen rows of sixteen characters:
 *
 * - `#` the body, drawn in the genre's light accent
 * - `%` the shade, drawn in its dark accent
 * - `.` nothing
 *
 * The pair already existed in the renderer and was unused — the old comment
 * said so out loud: *"the dark is unused here but kept so the pair is one
 * decision in one place."* This is what it was being kept for.
 *
 * Authored here rather than as image assets on §10.11.3's own rule: a cover is
 * *generated*, never authored, and a PNG in the bundle is a cover somebody drew
 * by hand for a game the player has not shipped yet. What is authored is the
 * vocabulary; the covers are still rolled.
 */

/** A 16×16 sprite. `#` body, `%` shade, `.` empty. */
export type Sprite = readonly string[]

export const SPRITE_SIZE = 16

/**
 * Arcade — §4.10c's *Flappy Square*. A little ship with fins and a flame.
 *
 * The nose is body and the hull is shade, which is the whole two-tone trick:
 * the light reads as the lit side and the shape acquires a direction.
 */
const ROCKET: Sprite = [
  '.......##.......',
  '......####......',
  '.....##%%##.....',
  '.....#%%%%#.....',
  '.....#%##%#.....',
  '.....#%##%#.....',
  '.....#%%%%#.....',
  '....##%%%%##....',
  '...###%%%%###...',
  '..####%%%%####..',
  '..#%%##%%##%%#..',
  '..#%%.#%%#.%%#..',
  '.......##.......',
  '......#%%#......',
  '.......##.......',
  '........#.......',
]

/** Roguelike deckbuilder — a die, pipped, with a lit top-left. */
const DIE: Sprite = [
  '................',
  '..############..',
  '..#%%%%%%%%%%#..',
  '..#%##%%%%##%#..',
  '..#%##%%%%##%#..',
  '..#%%%%##%%%%#..',
  '..#%%%%##%%%%#..',
  '..#%%%%%%%%%%#..',
  '..#%%%%%%%%%%#..',
  '..#%##%%%%##%#..',
  '..#%##%%%%##%#..',
  '..#%%%%%%%%%%#..',
  '..############..',
  '................',
  '................',
  '................',
]

/** RPG — a sword, point down, with a crossguard and a pommel. */
const SWORD: Sprite = [
  '.......##.......',
  '.......##.......',
  '......#%%#......',
  '......#%%#......',
  '......#%%#......',
  '......#%%#......',
  '......#%%#......',
  '..############..',
  '..#%%%%##%%%%#..',
  '..############..',
  '......#%%#......',
  '......#%%#......',
  '......#%%#......',
  '.......##.......',
  '.......##.......',
  '........#.......',
]

/** Tycoon and sim — a spreadsheet with a line going up out of it. */
const SPREADSHEET: Sprite = [
  '................',
  '.##############.',
  '.#%%%%%%%%%%%%#.',
  '.##############.',
  '.#%%#%%%#%%%%%#.',
  '.#%%#%%%#%%%##%.',
  '.####%%%#%%##%%.',
  '.#%%#%%%#%##%%%.',
  '.#%%#%%%##%%%%%.',
  '.####%%%#%%%%%%.',
  '.#%%#%##%%%%%%%.',
  '.#%%#%#%%%%%%%%.',
  '.####%%%%%%%%%%.',
  '.##############.',
  '................',
  '................',
]

/** Open-world survival craft — a keep with crenellations and a gate. */
const CASTLE: Sprite = [
  '................',
  '.##.##.##.##.##.',
  '.##############.',
  '.#%%%%%%%%%%%%#.',
  '.#%##%%%%%%##%#.',
  '.#%##%%%%%%##%#.',
  '.#%%%%%%%%%%%%#.',
  '.#%%%%%%%%%%%%#.',
  '.#%%%%####%%%%#.',
  '.#%%%%#%%#%%%%#.',
  '.#%%%%#%%#%%%%#.',
  '.#%%%%#%%#%%%%#.',
  '.##############.',
  '................',
  '................',
  '................',
]

/** Engine and platform — a gear, teeth on the compass points. */
const GEAR: Sprite = [
  '................',
  '....#.####.#....',
  '....##%%%%##....',
  '..############..',
  '..#%%%%%%%%%%#..',
  '.##%%%####%%%##.',
  '.#%%%##%%##%%%#.',
  '.#%%%#%%%%#%%%#.',
  '.#%%%#%%%%#%%%#.',
  '.#%%%##%%##%%%#.',
  '.##%%%####%%%##.',
  '..#%%%%%%%%%%#..',
  '..############..',
  '....##%%%%##....',
  '....#.####.#....',
  '................',
]

/** Puzzle and casual — a heart, lit from the upper left. */
const HEART: Sprite = [
  '................',
  '..####....####..',
  '.######..######.',
  '################',
  '##%%##%%%%%%%%##',
  '#%%%%%%%%%%%%%%#',
  '.#%%%%%%%%%%%%#.',
  '.#%%%%%%%%%%%%#.',
  '..#%%%%%%%%%%#..',
  '...#%%%%%%%%#...',
  '....#%%%%%%#....',
  '.....#%%%%#.....',
  '......#%%#......',
  '.......##.......',
  '................',
  '................',
]

/** No genre named — a gamepad, which is a game if anything is. */
const PAD: Sprite = [
  '................',
  '................',
  '..############..',
  '.##%%%%%%%%%%##.',
  '##%%##%%%%##%%##',
  '#%%####%%##%%%%#',
  '#%%##%%%%%%##%%#',
  '#%%%%%%%%%%%%%%#',
  '#%%%%%##%%%%%%%#',
  '#%%%%%%%%%##%%%#',
  '##%%%%%%%%%%%%##',
  '.##%%%%%%%%%%##.',
  '..############..',
  '................',
  '................',
  '................',
]

/**
 * The sprite table, keyed by `cover.ts`'s glyph names.
 *
 * The names are §10.11.3's — "a die, a sword, a rocket, a spreadsheet" — and
 * they stay, because `genreFor` maps §4.10c's title ladder onto them and the
 * mapping is what makes a genre always look like itself.
 */
export const COVER_SPRITES: Record<string, Sprite> = {
  rocket: ROCKET,
  die: DIE,
  sword: SWORD,
  spreadsheet: SPREADSHEET,
  castle: CASTLE,
  gear: GEAR,
  heart: HEART,
  pixel: PAD,
}

export interface SpriteCell {
  x: number
  y: number
  /** True for `#`, false for `%`. The renderer picks the ink. */
  lit: boolean
}

/**
 * A sprite as cells, tightly bounded.
 *
 * Bounded rather than returned at a flat 16×16 because the compositions in
 * `Cover.tsx` place the *art* on a horizon and in a badge, and a sprite with
 * four empty rows under it would stand four pixels off the ground. The bounds
 * come back with the cells so the caller can centre what is actually drawn.
 */
export function spriteCells(sprite: Sprite): {
  cells: SpriteCell[]
  minX: number
  minY: number
  width: number
  height: number
} {
  const cells: SpriteCell[] = []
  let minX = SPRITE_SIZE
  let minY = SPRITE_SIZE
  let maxX = -1
  let maxY = -1

  sprite.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x]
      if (ch !== '#' && ch !== '%') continue
      cells.push({ x, y, lit: ch === '#' })
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  })

  if (maxX < 0) return { cells, minX: 0, minY: 0, width: 0, height: 0 }
  return { cells, minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}
