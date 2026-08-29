import { describe, expect, it } from 'vitest'
import {
  BILLY_HAIR,
  BILLY_SHIRT,
  BILLY_TORSO,
  HERO_IDENTITIES,
  HAIR_COLOURS,
  HAIR_SHAPES,
  BODY_SHAPES,
  FACIAL_HAIR_STYLES,
  JAMES,
  SHIRT_COLOURS,
  SKIN_TONES,
  TRAITS,
  developerAt,
  draw,
  identityFor,
} from './identity.ts'

const SEED = 20260808

describe('generated, never stored — GDD §7.8.7', () => {
  it('gives the same developer the same identity every time', () => {
    // The property the whole approach rests on. If this is not exact, a
    // developer changes their name between frames and the feature is worse
    // than not having it.
    for (const i of [1, 2, 7, 40, 999, 1_000_000]) {
      expect(identityFor(SEED, i)).toEqual(identityFor(SEED, i))
    }
  })

  it('gives neighbours different identities', () => {
    // A hash that correlates on adjacent indices produces a floor of identical
    // twins in rows, which is exactly where the eye notices it.
    const names = new Set<string>()
    for (let i = 0; i < 60; i++) names.add(identityFor(SEED, i).name)
    expect(names.size).toBeGreaterThan(45)
  })

  it('gives different runs different studios', () => {
    // §13.2 — a Paradigm Shift should return a *different* company. Same
    // indices, different seed, different people.
    const a = Array.from({ length: 30 }, (_, i) => identityFor(1, i).name)
    const b = Array.from({ length: 30 }, (_, i) => identityFor(2, i).name)
    const shared = a.filter((n, i) => n === b[i]).length
    expect(shared).toBeLessThan(5)
  })

  it('never lets two fields share a draw', () => {
    // Every field reads its own channel. If two shared one, hair colour and
    // shirt colour would be perfectly correlated across the entire floor — the
    // kind of bug that looks like a deliberate art choice until somebody counts.
    const hair: number[] = []
    const shirt: number[] = []
    for (let i = 0; i < 400; i++) {
      const { look } = identityFor(SEED, i)
      hair.push(look.hair)
      shirt.push(look.shirt)
    }
    const agree = hair.filter((h, i) => h === shirt[i]).length
    // Independent draws over 4 and 5 buckets agree about 1 time in 5.
    expect(agree).toBeLessThan(400 * 0.35)
  })

  it('is stable across engines by construction', () => {
    // `Math.imul` and `>>> 0` are exact in every JS engine; `*` on large
    // integers is not. A developer whose hair changes colour between the
    // player's phone and their tablet is a bug no single-machine test catches,
    // so the guard is that every draw stays a finite 0..1.
    for (let i = 0; i < 200; i++) {
      for (let ch = 0; ch < 17; ch++) {
        const r = draw(SEED, i, ch)
        expect(Number.isFinite(r)).toBe(true)
        expect(r).toBeGreaterThanOrEqual(0)
        expect(r).toBeLessThan(1)
      }
    }
  })
})

describe('what varies', () => {
  it('keeps every look index inside the renderer’s tables', () => {
    // An out-of-range part index is an invisible developer or a crash, and it
    // would only show up for one person in a thousand.
    for (let i = 0; i < 3000; i++) {
      const { look } = identityFor(SEED, i)
      expect(look.hair).toBeGreaterThanOrEqual(0)
      expect(look.hair).toBeLessThan(HAIR_SHAPES)
      expect(look.hairColour).toBeLessThan(HAIR_COLOURS)
      expect(look.skin).toBeLessThan(SKIN_TONES)
      expect(look.shirt).toBeLessThan(SHIRT_COLOURS)
      expect(look.body).toBeGreaterThanOrEqual(0)
      expect(look.body).toBeLessThan(BODY_SHAPES)
      expect(look.facialHair).toBeGreaterThanOrEqual(0)
      expect(look.facialHair).toBeLessThan(FACIAL_HAIR_STYLES)
      expect(Math.abs(look.slouch)).toBeLessThanOrEqual(1)
    }
  })

  it('uses the whole of every part table', () => {
    // A `Math.floor(r * n)` that never reaches the last bucket is the classic
    // off-by-one here, and it silently costs a quarter of the variety.
    const seen = {
      hair: new Set(),
      shirt: new Set(),
      skin: new Set(),
      body: new Set(),
      facialHair: new Set(),
    }
    for (let i = 0; i < 2000; i++) {
      const { look } = identityFor(SEED, i)
      seen.hair.add(look.hair)
      seen.shirt.add(look.shirt)
      seen.skin.add(look.skin)
      seen.body.add(look.body)
      seen.facialHair.add(look.facialHair)
    }
    expect(seen.hair.size).toBe(HAIR_SHAPES)
    expect(seen.shirt.size).toBe(SHIRT_COLOURS)
    expect(seen.skin.size).toBe(SKIN_TONES)
    expect(seen.body.size).toBe(BODY_SHAPES)
    expect(seen.facialHair.size).toBe(FACIAL_HAIR_STYLES)
  })

  it('keeps stats in range', () => {
    for (let i = 0; i < 1000; i++) {
      const { stats } = identityFor(SEED, i)
      for (const v of [stats.focus, stats.chatter, stats.seniority]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  it('gives roughly one in eight a trait', () => {
    let n = 0
    for (let i = 0; i < 4000; i++) if (identityFor(SEED, i).trait !== null) n++
    expect(n / 4000).toBeGreaterThan(0.08)
    expect(n / 4000).toBeLessThan(0.18)
  })

  it('only ever names a trait that exists', () => {
    for (let i = 0; i < 2000; i++) {
      const t = identityFor(SEED, i).trait
      if (t !== null) expect(TRAITS).toContain(t)
    }
  })
})

describe('James — §21.6', () => {
  it('is the same person in every run', () => {
    // He is the one fixed point in the game: the studio changes, he does not.
    expect(developerAt(1, 0)).toEqual(JAMES)
    expect(developerAt(999999, 0)).toEqual(JAMES)
  })

  /**
   * **Seat 0, not seat 1** — §21.0b, and the reason this test names the number.
   *
   * He is the free hire at the fiftieth poke, which lands before the player has
   * bought anybody, so he *is* the first developer. This read `index === 1` for
   * one day after §21.0b shipped, and the result was that Act I sat a randomly
   * generated stranger at the desk beside you and played James's arrival scene
   * over the top of them.
   *
   * `scenes.ts` puts the camera on seat 0 for every one of his lines and
   * `store.ts` refuses to let seat 0 quit (§22.3 LOYAL). Three files have to
   * agree about one integer, so it is asserted here rather than left implied.
   */
  it('is the first developer, and the first developer only', () => {
    expect(developerAt(SEED, 0)).toEqual(JAMES)
    expect(developerAt(SEED, 1)).not.toEqual(JAMES)
    expect(developerAt(SEED, 2)).not.toEqual(JAMES)
  })

  it('is §21.7.0’s focus — near-silent and utterly absorbed', () => {
    // §21.7.0 rules 1 and 2: extreme focus, and as few human interactions as
    // possible. Character as data — he types, he does not talk.
    expect(JAMES.stats.focus).toBeGreaterThan(JAMES.stats.chatter)
    expect(JAMES.stats.chatter).toBe(1)
  })
})

/**
 * §22.8 — **the parts that belong to one person.**
 *
 * The tables above say how many entries a *roll* may reach; the renderer's
 * tables are longer, and what sits past the count is somebody's. This is the
 * pair of facts that keeps that arrangement honest: the reserved indices are
 * genuinely out of the roll's reach (`what varies` above proves the other
 * direction over 3,000 people), and the two people who own them are drawn from
 * the entries nobody else can have.
 */
describe('§22.8 — the reserved parts', () => {
  it('puts James and Billy past the end of every roll', () => {
    expect(BILLY_HAIR).toBeGreaterThanOrEqual(HAIR_COLOURS)
    expect(BILLY_SHIRT).toBeGreaterThanOrEqual(SHIRT_COLOURS)
    expect(BILLY_TORSO).toBeGreaterThanOrEqual(BODY_SHAPES)
    // And they do not collide with each other, which is the only way two
    // written-down people can end up wearing the same unrollable shirt.
    expect(BILLY_HAIR).not.toBe(JAMES.look.hairColour)
    expect(BILLY_SHIRT).not.toBe(JAMES.look.shirt)
  })

  /**
   * §21.7.3 — Billy is described, not rolled, and every field is one word of
   * the description: fair, a neat crop, clean-shaven, glasses, a light blue
   * shirt on a slim tall frame, and the most upright posture on the floor.
   *
   * Asserted because the look is doing narrative work his dialogue cannot: the
   * scene's joke depends on the founder failing to place a world they can see
   * standing in front of them, and it only lands if he *looks* like it.
   */
  it('draws Billy the way §21.7.3 describes him', () => {
    const billy = HERO_IDENTITIES.billy
    expect(billy.look.hairColour).toBe(BILLY_HAIR)
    expect(billy.look.shirt).toBe(BILLY_SHIRT)
    expect(billy.look.body).toBe(BILLY_TORSO)
    // The `crop` silhouette — the only tidy one of the four.
    expect(billy.look.hair).toBe(1)
    expect(billy.look.facialHair).toBe(0)
    expect(billy.look.glasses).toBe(true)
    expect(billy.look.headphones).toBe(false)
    // Upright. Everybody else on the floor leans into a monitor.
    expect(billy.look.slouch).toBeLessThan(0)

    // And he is the opposite of James in the two places they are both written
    // down, which is what makes them read as the same age and nothing else.
    expect(billy.look.facialHair).not.toBe(JAMES.look.facialHair)
    expect(billy.look.hair).not.toBe(JAMES.look.hair)
  })
})
