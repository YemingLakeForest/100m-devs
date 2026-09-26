/*
 * Copied from the rebuild (100m-devs-three/src/sim/titles.test.ts) on 2026-09-26, when the user
 * asked for the rebuild's cover art and title generation to be ported: the
 * rebuild is read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
import { describe, expect, it } from 'vitest'

import {
  GENRES,
  GENRE_NOUNS,
  MAX_TITLE_LENGTH,
  SEQUEL_CHANCE,
  SUFFIXES,
  SUFFIX_CHANCE,
  TITLE_WINDOW,
  genreNamed,
  pluralOf,
  titleFor,
} from './titles.ts'

describe('§10.6.1 — titles are generated, never a version number', () => {
  it('is deterministic in the seed and the ordinal', () => {
    for (let i = 0; i < 40; i++) {
      expect(titleFor(4242, i)).toEqual(titleFor(4242, i))
    }
    // ...and different seeds ship different catalogues.
    const a = Array.from({ length: 20 }, (_, i) => titleFor(1, i).name)
    const b = Array.from({ length: 20 }, (_, i) => titleFor(2, i).name)
    expect(a).not.toEqual(b)
  })

  /**
   * The catalogue is built forwards and memoised, so the order the caller asks
   * in must not matter: the gallery reads a record from the middle of a run
   * and the HUD reads the one at the end.
   */
  it('gives the same answer whichever order it is asked in', () => {
    const forwards = Array.from({ length: 30 }, (_, i) => titleFor(777, i).name)
    const backwards: string[] = []
    for (let i = 29; i >= 0; i--) backwards.unshift(titleFor(777, i).name)
    expect(backwards).toEqual(forwards)
  })

  /** The instruction, verbatim: "flappy square version N won't fly". */
  it('never names Flappy Square, and never numbers a game N.0', () => {
    for (let seed = 1; seed <= 5; seed++) {
      for (let i = 0; i < 60; i++) {
        const { name } = titleFor(seed, i)
        expect(name).not.toMatch(/flappy/i)
        expect(name).not.toMatch(/\d+\.\d+/)
      }
    }
  })

  it('varies: two hundred games are more than a hundred and fifty games', () => {
    const names = new Set<string>()
    for (let i = 0; i < 200; i++) names.add(titleFor(99, i).name)
    // Sequels and suffixes share a base with a neighbour on purpose; everything
    // else should be its own game.
    expect(names.size).toBeGreaterThan(150)
  })

  /**
   * Rule 3 — the shelf's memory. Two identical names on the wall at once is
   * the failure the window exists to prevent, and the window is what the
   * reroll is measured against.
   */
  it('does not repeat a name inside the window', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const names: string[] = []
      for (let i = 0; i < 120; i++) {
        const title = titleFor(seed, i)
        if (title.sequel === 0) {
          const window = names.slice(Math.max(0, i - TITLE_WINDOW))
          expect(window, `${title.name} repeats within ${TITLE_WINDOW}`).not.toContain(title.name)
        }
        names.push(title.name)
      }
    }
  })

  it('names every genre somewhere in a long run', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) seen.add(titleFor(7, i).genre)
    for (const genre of GENRES) expect(seen.has(genre), `no ${genre}`).toBe(true)
  })

  it('fits the rail', () => {
    for (let seed = 1; seed <= 8; seed++) {
      for (let i = 0; i < 120; i++) {
        expect(titleFor(seed, i).name.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH)
      }
    }
  })

  it('keeps the first game plain — no sequel, no suffix', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const t = titleFor(seed, 0)
      expect(t.sequel).toBe(0)
      expect(t.name).toBe(t.base)
      expect(t.name).not.toMatch(/\(/)
      // The two short forms and nothing else: two words, no colon, no "of".
      expect(t.name).not.toMatch(/[:!&]|\bof\b|^The Last\b|^Untitled\b/)
    }
  })

  /**
   * Rule 1 — a plural is a table lookup. `Hexs`, `Colonys` and `Prophecys`
   * are what an `s` produces, and all three shipped in the draft.
   */
  it('pluralises from the table or not at all', () => {
    // Every word an `s` would have produced and the table refuses to: the
    // nouns with a different plural, and the nouns with none at all.
    const naive = new Set<string>()
    for (const genre of GENRES) {
      for (const noun of GENRE_NOUNS[genre]) {
        if (pluralOf(noun) !== `${noun}s`) naive.add(`${noun}s`)
      }
    }
    expect(naive.has('Hexs')).toBe(true)
    expect(naive.has('Overdrives')).toBe(true)
    for (let seed = 1; seed <= 20; seed++) {
      for (let i = 0; i < 80; i++) {
        const { name } = titleFor(seed, i)
        for (const word of name.split(/[^A-Za-zÀ-ɏ]+/)) {
          expect(naive.has(word), `bad plural "${word}" in "${name}"`).toBe(false)
        }
      }
    }
    expect(pluralOf('Hex')).toBe('Hexes')
    expect(pluralOf('Colony')).toBe('Colonies')
    expect(pluralOf('Shuttle')).toBe('Shuttles')
    // Some nouns are not countable, and the table says so by saying nothing.
    expect(pluralOf('Overdrive')).toBeNull()
    expect(pluralOf('Thunder')).toBeNull()
  })

  /**
   * §1's joke survives as a ration rather than a rule: a sequel keeps its
   * base and its genre, and it does not become the norm.
   */
  it('makes a sequel of the game before it, sometimes', () => {
    let sequels = 0
    let total = 0
    for (let seed = 1; seed <= 20; seed++) {
      for (let i = 2; i < 40; i++) {
        const t = titleFor(seed, i)
        total++
        if (t.sequel > 0) {
          sequels++
          const previous = titleFor(seed, i - 1)
          expect(t.base).toBe(previous.base)
          expect(t.genre).toBe(previous.genre)
          expect(t.name.startsWith(t.base)).toBe(true)
        }
      }
    }
    const rate = sequels / total
    expect(rate).toBeGreaterThan(SEQUEL_CHANCE * 0.5)
    expect(rate).toBeLessThan(SEQUEL_CHANCE * 1.6)
  })

  /**
   * Rule 4 — the first sequel is II. The draft's numeral table was indexed by
   * the depth plus one, so every chain in the game went straight to III.
   */
  it('numbers the first sequel II, not III', () => {
    let checked = 0
    for (let seed = 1; seed <= 60 && checked < 6; seed++) {
      for (let i = 2; i < 40; i++) {
        const t = titleFor(seed, i)
        if (t.sequel !== 1) continue
        checked++
        expect(t.name, `${t.name} skipped a number`).not.toMatch(/\bIII\b/)
        break
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('rations the monetisation suffix', () => {
    let suffixed = 0
    let total = 0
    for (let seed = 1; seed <= 20; seed++) {
      for (let i = 1; i < 40; i++) {
        const { name } = titleFor(seed, i)
        total++
        if (SUFFIXES.some((s) => name.endsWith(s))) suffixed++
      }
    }
    const rate = suffixed / total
    expect(rate).toBeGreaterThan(0)
    expect(rate).toBeLessThan(SUFFIX_CHANCE * 1.8)
  })

  /** The rarest form, and the one that would be tiresome at any other rate. */
  it('keeps "Untitled … Game" rare and off the first release', () => {
    let untitled = 0
    let total = 0
    for (let seed = 1; seed <= 25; seed++) {
      for (let i = 0; i < 80; i++) {
        const { name } = titleFor(seed, i)
        total++
        if (name.startsWith('Untitled ')) {
          untitled++
          expect(i).toBeGreaterThan(0)
        }
      }
    }
    expect(untitled).toBeGreaterThan(0)
    expect(untitled / total).toBeLessThan(0.05)
  })

  it('reads a genre off a name written before titles carried one', () => {
    expect(genreNamed('Flappy Square 1.0')).toBe('arcade')
    expect(genreNamed('Velvet Dungeon')).toBe('roguelike')
    expect(genreNamed('Project X')).toBeNull()
  })
})
