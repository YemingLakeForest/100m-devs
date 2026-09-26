/* The genre list from the rebuild's sim/titles.ts, which is all the cover art needs. */
export const GENRES = [
  'arcade',
  'roguelike',
  'rpg',
  'tycoon',
  'survival',
  'racer',
  'puzzle',
  'platformer',
  'horror',
  'farming',
] as const
export type Genre = (typeof GENRES)[number]
