/**
 * The line of code a poke knocks loose — GDD §8.2a.
 *
 * Every poke throws off one short line of source alongside the SP numeral. At
 * 4–5 taps a second this is the most-read text in the product, which makes the
 * writing brief narrow: a developer has to laugh, a non-specialist has to get
 * it anyway, and it has to fit in about 28 characters.
 *
 * It carries no information. A player who never reads one loses nothing
 * mechanical, and it must never become a tutorial channel.
 */

import type { DevState } from '../sim/poke.ts'

/** §8.2a — roughly 28 characters at HUD size. Longer than this is an essay. */
export const MAX_SNIPPET_LENGTH = 28

/**
 * The default pool. Ordered as written, not by preference — the shuffle bag
 * below decides what the player actually sees.
 */
const WORKING = [
  'while (true) { }',
  '// TODO: fix this',
  'git commit -m "stuff"',
  'it works on my machine',
  'console.log("here")',
  "// don't touch this",
  'undefined is not a function',
  'catch (e) { }',
  'sudo make me a sandwich',
  'return null // sorry',
  '// this should never happen',
  'let x = x + 1',
  'if (bug) { bug = false }',
  '/* legacy. do not read. */',
  'npm install everything',
] as const

/**
 * §8.2a — the dev's state picks the pool.
 *
 * This is the one place the joke is allowed to be about the *simulation*: a
 * Rogue Refactorer is mid-refactor, a 10x Engineer is leaving, and an
 * Overwhelmed developer is producing nothing at all, which is funnier than
 * anything that could be written for them.
 */
const BY_STATE: Partial<Record<DevState, readonly string[]>> = {
  slacking: [
    'alt-tab',
    '// just one more turn',
    'wget definitely-not-a-game',
    'minimise( )',
  ],
  flow: [
    'O(n) -> O(log n)',
    '// finally',
    'git commit -m "the fix"',
    'all tests passing',
  ],
  /**
   * Empty by design. §8.2's "Overwhelmed" dev yields zero SP and has their head
   * on the keyboard; a joke here would be the game talking over its own gag.
   * The renderer shows no line at all.
   */
  overwhelmed: [],
  rogue: [
    'mov eax, 0x00',
    '// rewriting everything',
    'rm -rf src/ # trust me',
    'introducing: a new pattern',
  ],
  tenx: [
    'git push --force',
    '// good luck',
    'I have accepted an offer',
    'rm -rf / # my two weeks',
  ],
}

/** Every line in the product, for the tests that police the §8.2a brief. */
export const ALL_SNIPPETS: readonly string[] = [
  ...WORKING,
  ...Object.values(BY_STATE).flat(),
]

export function poolFor(state: DevState): readonly string[] {
  return BY_STATE[state] ?? WORKING
}

/**
 * A shuffle bag, not a random draw.
 *
 * §8.2a: "never repeat consecutively". At five taps a second an independent
 * draw from a 15-line pool repeats within three taps most of the time, and a
 * repeat at that rate does not read as a coincidence — it reads as a bug in the
 * game. A bag deals every line once before reshuffling, so the player sees the
 * whole set before seeing anything twice, and the shuffle is re-seeded so the
 * order is not the same every session.
 */
export class SnippetBag {
  private readonly bags = new Map<string, string[]>()
  private lastDealt: string | null = null
  private readonly random: () => number

  /** `random` is injectable so tests can be deterministic. */
  constructor(random: () => number = Math.random) {
    this.random = random
  }

  next(state: DevState): string | null {
    const pool = poolFor(state)
    if (pool.length === 0) return null

    let bag = this.bags.get(state)
    if (!bag || bag.length === 0) {
      bag = this.shuffled(pool)
      // A reshuffle can put the line that just played first in the deal order,
      // which produces the one repeat the bag exists to prevent — across the
      // seam rather than inside it. Swap it back one place.
      //
      // The check is on the LAST element, not the first: `next()` deals with
      // `pop()`, so the end of the array is the front of the queue. Guarding
      // `bag[0]` instead looks right, passes a fixed-seed test, and leaks a
      // repeat every few reshuffles under real randomness.
      const last = bag.length - 1
      if (bag.length > 1 && bag[last] === this.lastDealt) {
        ;[bag[last], bag[last - 1]] = [bag[last - 1], bag[last]]
      }
      this.bags.set(state, bag)
    }

    const line = bag.pop() ?? pool[0]
    this.lastDealt = line
    return line
  }

  private shuffled(pool: readonly string[]): string[] {
    const out = [...pool]
    // Fisher-Yates. `pop()` deals from the end, so the shuffle order is the
    // reverse of the deal order — which does not matter, and saying so here
    // saves the next reader working it out.
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
}
