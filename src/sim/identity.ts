/**
 * Who each developer is — GDD §7.8.7.
 *
 * **Generated, never stored.** Everything about developer `i` is a pure
 * function of `(seed, i)`, so a million developers cost one integer and the
 * same person is the same person across a reload, a screenshot and a week.
 *
 * That is not a compromise forced by memory. A stored roster would be strictly
 * worse: it would need §24 save migration, it would add megabytes to a file
 * that currently fits in a URL, and it would have to answer what happens to
 * Steve when the swarm is culled. §7.8.8's pinned list is the deliberate
 * exception — a handful of names the player has touched, which is how every
 * large procedural game does this.
 *
 * The seed lives in the run, so **a Paradigm Shift returns a different studio**
 * with the same James in it. That is §21.6's whole joke rendered in data.
 */

/**
 * One 32-bit hash step. Deterministic, well-mixed, and identical in every
 * JavaScript engine — the last part matters, because a developer whose hair
 * changes colour between the player's phone and their tablet is a bug that no
 * test written on one machine will ever catch.
 */
function hash(a: number): number {
  let x = a | 0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad)
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97)
  return (x ^ (x >>> 15)) >>> 0
}

/** A stable 0..1 draw for `(seed, index, channel)`. */
export function draw(seed: number, index: number, channel: number): number {
  return hash(hash(seed + index * 0x9e3779b9) + channel * 0x85ebca6b) / 0x100000000
}

/** Pick from a list. Separated so every table below reads the same way. */
function pick<T>(list: readonly T[], r: number): T {
  return list[Math.min(list.length - 1, Math.floor(r * list.length))]
}

/**
 * §7.8.7 — "real-sounding, never joke names".
 *
 * The comedy is in what developers *say* (Appendix D), and a floor full of
 * "Chad Bugsworth" burns the joke on the first read and then keeps charging for
 * it. These are ordinary names from a lot of places, because an office is.
 */
const FIRST = [
  'Priya', 'Marcus', 'Yuki', 'Sofia', 'Dmitri', 'Amara', 'Tobias', 'Mei',
  'Rafael', 'Ingrid', 'Kwame', 'Elena', 'Hassan', 'Nora', 'Viktor', 'Aisha',
  'Callum', 'Sunita', 'Bjorn', 'Leila', 'Owen', 'Chiara', 'Farid', 'Greta',
  'Diego', 'Anouk', 'Tariq', 'Saoirse', 'Emeka', 'Hana', 'Lucas', 'Zora',
] as const

const LAST = [
  'Ramanathan', 'Okonkwo', 'Lindqvist', 'Moreau', 'Petrov', 'Delgado',
  'Nakamura', 'Fitzgerald', 'Bergström', 'Adeyemi', 'Kowalski', 'Haddad',
  'Sørensen', 'Villanueva', 'Novak', 'Achterberg', 'Marchetti', 'Duarte',
  'Balogun', 'Kaminski', 'Rasmussen', 'Sinclair', 'Варга', 'Mbeki',
] as const

/** §7.8.7 — about one in eight has one. */
export const TRAITS = [
  'Night Owl',
  'Meeting Magnet',
  'Ex-Founder',
  'Types Loudly',
  'Never Reviews',
  'Reads The Docs',
  'Owns The Build',
  'Perpetually Blocked',
] as const

export type Trait = (typeof TRAITS)[number]

/**
 * How a developer is drawn. Indices into the room's own part tables rather than
 * colours, so the palette stays the renderer's business (ART_DIRECTION §4) and
 * this file stays testable without one.
 */
export interface Look {
  hair: number
  hairColour: number
  skin: number
  shirt: number
  /** Torso silhouette/detail: hoodie, tee, jacket, or knit. */
  body: number
  /** Face detail: none, moustache, goatee, or full beard. */
  facialHair: number
  glasses: boolean
  headphones: boolean
  /** Slight lean, -1..1. Nothing else varies posture, and it is enough. */
  slouch: number
}

/**
 * §7.8.7's three numbers, 0..100.
 *
 * They do **not** enter §4.1's production maths, and that restraint is the
 * design rather than an unfinished edge: the moment Focus multiplies output the
 * player is obliged to audit forty people, and the game becomes the spreadsheet
 * §6 is satirising. They bite locally — poke yield, §7.8.6 chatter rate, and
 * which individuals a §13.6 card covers.
 */
export interface Stats {
  focus: number
  chatter: number
  seniority: number
}

export interface Identity {
  name: string
  look: Look
  stats: Stats
  /** Null for most people. */
  trait: Trait | null
}

/** Channel numbers, kept together so two fields can never share one. */
const CH = {
  first: 1, last: 2, hair: 3, hairColour: 4, skin: 5, shirt: 6,
  glasses: 7, headphones: 8, slouch: 9, focus: 10, chatter: 11,
  seniority: 12, hasTrait: 13, trait: 14, body: 15,
  facialHair: 16,
} as const

/** How many hair shapes and shirt colours the renderer offers. */
export const HAIR_SHAPES = 4
export const HAIR_COLOURS = 4
export const SKIN_TONES = 4
export const SHIRT_COLOURS = 5
export const BODY_SHAPES = 4
export const FACIAL_HAIR_STYLES = 4

export function identityFor(seed: number, index: number): Identity {
  const d = (channel: number) => draw(seed, index, channel)
  const stat = (channel: number) => Math.round(d(channel) * 100)

  return {
    name: `${pick(FIRST, d(CH.first))} ${pick(LAST, d(CH.last))}`,
    look: {
      hair: Math.floor(d(CH.hair) * HAIR_SHAPES),
      hairColour: Math.floor(d(CH.hairColour) * HAIR_COLOURS),
      skin: Math.floor(d(CH.skin) * SKIN_TONES),
      shirt: Math.floor(d(CH.shirt) * SHIRT_COLOURS),
      body: Math.floor(d(CH.body) * BODY_SHAPES),
      facialHair: Math.floor(d(CH.facialHair) * FACIAL_HAIR_STYLES),
      // Roughly a third wear glasses and a quarter headphones. Both read at the
      // room's scale where nothing subtler does.
      glasses: d(CH.glasses) < 0.34,
      headphones: d(CH.headphones) < 0.26,
      slouch: d(CH.slouch) * 2 - 1,
    },
    stats: {
      focus: stat(CH.focus),
      chatter: stat(CH.chatter),
      seniority: stat(CH.seniority),
    },
    trait: d(CH.hasTrait) < 0.125 ? pick(TRAITS, d(CH.trait)) : null,
  }
}

/**
 * §21 — James is the first developer and he is not generated.
 *
 * He is the one fixed point across every run (§21.6, §13.6.3), so his identity
 * is written down rather than rolled. Everything else on the floor is a
 * stranger; he is not.
 */
export const JAMES: Identity = {
  name: 'James',
  look: {
    // Full head of orange hair, a full orange beard, thick glasses, and a white
    // tee. The orange hair and the white shirt are the two entries appended to
    // the room's part tables past {@link HAIR_COLOURS} and {@link SHIRT_COLOURS},
    // so they are his alone — no generated developer ever rolls them.
    hair: 0,
    hairColour: HAIR_COLOURS,
    skin: 1,
    shirt: SHIRT_COLOURS,
    body: 1,
    facialHair: 3,
    glasses: true,
    headphones: false,
    slouch: 0.2,
  },
  stats: { focus: 99, chatter: 1, seniority: 38 },
  trait: 'Owns The Build',
}

/**
 * §22.8's five, written down for the same reason James is — **they are not
 * strangers.**
 *
 * §7.8.7 generates a floor full of people who are nobody in particular, which
 * is the whole trick and it works because it is true of *ordinary* developers.
 * The story roster is the opposite: each of the five is one sentence of who they
 * are (§22.8.2) before they have said a word, and a rolled face would make Mo a
 * different person on every save file.
 *
 * The stats are §7.8.7's three numbers and they read as characterisation because
 * that is all they are — §7.8.7 is explicit that they do not enter §4.1's
 * production maths. Mo's focus is high and her chatter is not low; she asks the
 * question you were avoiding. Billy's chatter is the highest number on this
 * table and it is not a criticism of Billy.
 *
 * No new art: these are the same part tables every generated developer draws
 * from (§22.7's cap is untouched), chosen rather than rolled.
 */
export const HERO_IDENTITIES: Readonly<Record<string, Identity>> = {
  james: JAMES,
  mo: {
    name: 'Mo',
    look: {
      hair: 2, hairColour: 2, skin: 3, shirt: 1, body: 3,
      facialHair: 0, glasses: true, headphones: false, slouch: -0.1,
    },
    stats: { focus: 88, chatter: 46, seniority: 71 },
    trait: null,
  },
  serena: {
    name: 'Serena',
    look: {
      hair: 1, hairColour: 3, skin: 2, shirt: 0, body: 2,
      facialHair: 0, glasses: false, headphones: true, slouch: 0,
    },
    stats: { focus: 81, chatter: 22, seniority: 84 },
    trait: null,
  },
  matt: {
    name: 'Matt',
    look: {
      hair: 3, hairColour: 1, skin: 1, shirt: 3, body: 0,
      facialHair: 1, glasses: false, headphones: true, slouch: 0.3,
    },
    stats: { focus: 44, chatter: 92, seniority: 55 },
    trait: null,
  },
  melany: {
    name: 'Melany',
    look: {
      hair: 0, hairColour: 0, skin: 0, shirt: 4, body: 1,
      facialHair: 0, glasses: true, headphones: true, slouch: 0.15,
    },
    stats: { focus: 63, chatter: 78, seniority: 66 },
    trait: null,
  },
  billy: {
    name: 'Billy',
    look: {
      hair: 2, hairColour: 1, skin: 2, shirt: 2, body: 3,
      facialHair: 2, glasses: false, headphones: false, slouch: -0.2,
    },
    stats: { focus: 52, chatter: 96, seniority: 49 },
    trait: null,
  },
}

/** The written identity for a story hero, or null for anybody else. */
export function heroIdentity(id: string): Identity | null {
  return HERO_IDENTITIES[id] ?? null
}

/**
 * **James is seat 0**, and this line moved.
 *
 * It used to read `index === 1`, from the era when the player's first employee
 * was a stranger they paid for and James was the second person through the
 * door. §21.0b replaced that: he now turns up free at the fiftieth poke, before
 * anybody has been hired, so he *is* the first developer — and `scenes.ts`,
 * `store.ts`'s §22.3 LOYAL guard and §7.8.1b's seat rule had all already been
 * written against seat 0 while this one function still said 1.
 *
 * The consequence was not subtle and it was reported from a handset: Act I put
 * a randomly generated stranger at the desk beside you, played §21.7.1's
 * arrival scene over the top of them, and held James back until the player had
 * *paid* for a second developer. The one fixed point in the game was missing
 * from the scene that introduces him.
 */
export const JAMES_SEAT = 0

export function developerAt(seed: number, index: number): Identity {
  return index === JAMES_SEAT ? JAMES : identityFor(seed, index)
}
