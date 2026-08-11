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
  'const confidence = null',
  'deploy(friday)',
  'git blame --reverse',
  'await meeting()',
  'throw new Monday()',
  'return probably',
  'if (works) ship()',
  'else { addMeeting() }',
  'cache.clear(); pray();',
  'bugs.sort(() => 0.5)',
  'const eta = "soon"',
  'status = "investigating"',
  'fix && fix()',
  'true == "close enough"',
  'git add vibes',
  'git commit --amend --no',
  'while (awake) code()',
  'sleep(0) // optimised',
  'Promise.reject("monday")',
  '404: motivation not found',
  '200 OK-ish',
  '418 I am a developer',
  'rm meeting-notes.txt',
  'touch grass.txt',
  'const scope = Infinity',
  'deadline--',
  'estimate *= 2',
  'estimate *= Math.PI',
  'shipDate.setFullYear(2099)',
  'retry(retry(retry()))',
  'try { tryHarder() }',
  'catch (fire) { run() }',
  'finally { coffee() }',
  'switch (mood) { }',
  'default: panic()',
  'case "edge": ignore()',
  'break; // emotionally',
  'continue; // somehow',
  'yield "to management"',
  'import moreProblems',
  'export default regret',
  'module.exports = mystery',
  'require("adult")',
  'new SeniorDeveloper()',
  'delete production.data',
  'void warranty',
  'typeof deadline // object',
  'NaN !== NaN // rude',
  'null ?? coffee',
  'coffee ??= strongerCoffee',
  'let meeting = cancelled',
  'var consequences',
  'const answer = 42.1',
  'Boolean("false") // true',
  'parseInt("sprint")',
  'Math.random() > planning',
  'Date.now() + 6 * MONTH',
  'setTimeout(ship, 0)',
  'clearInterval(manager)',
  'requestAnimationFrame(life)',
  'JSON.parse("maybe")',
  'JSON.stringify(team)',
  'Object.freeze(deadline)',
  'Object.assign(blame, me)',
  'Array(10).fill("bug")',
  '[...bugs, ...newBugs]',
  'bugs.filter(Boolean)',
  'bugs.map(addFeature)',
  'users.reduce(expectations)',
  'queueMicrotask(panic)',
  'fetch("/motivation")',
  'await response.nope()',
  'res.status(500).send("fine")',
  'app.listen(guess)',
  'localhost is production',
  'CORS: yes',
  'SELECT * FROM secrets',
  'DROP TABLE standups',
  'COMMIT; ROLLBACK;',
  'WHERE clue IS NULL',
  'ORDER BY confidence DESC',
  'LIMIT 1 // the budget',
  'JOIN another_meeting',
  'docker run away',
  'kubectl get excuses',
  'helm uninstall friday',
  'terraform apply --hope',
  'npm audit --ignore',
  'npm run build:again',
  'yarn why everything',
  'pnpm add one-more-thing',
  'npx please-work',
  'pip install confidence',
  'cargo cult --release',
  'go panic("later")',
  'rustc --borrow-time',
  'make clean-ish',
  'make it-so',
  'chmod +x ambition',
  'grep -R "who did this"',
  'find . -name "answer"',
  'tail -f career.log',
  'head -n 1 roadmap.txt',
  'wc -l excuses.txt',
  'diff plan reality',
  'patch < last-minute.diff',
  'ssh production',
  'exit 0 // nobody noticed',
  'echo "ship it"',
  'printf("%s", panic)',
  'segfault but make it agile',
  'malloc(more_time)',
  'free(lunch)',
  '#define DONE 0',
  '#include <confidence.h>',
  'public static void help()',
  'private final Hope hope;',
  '@Deprecated since Monday',
  'synchronized (coffee) { }',
  'Optional.empty().get()',
  'stream().lost()',
  'lambda: ask_someone_else',
  'def fix_it_later(): pass',
  'raise NotMyBug',
  'with open("can.txt"): pass',
  'from future import deadline',
  'self.confidence -= 1',
  'if __name__ == "panic":',
  'console.warn("normal")',
  'alert("works locally")',
  'document.body.innerHTML=""',
  'window.location = "/home"',
  'localStorage.clearMaybe()',
  'useEffect(() => panic())',
  'setState(old => older)',
  '<Button disabled={maybe}>',
  '<div className="solution">',
  'z-index: 999999;',
  'display: none !important;',
  'margin: auto-ish;',
  'width: calc(100% + 1px);',
  'overflow: optimistic;',
  'position: absolutely;',
  'color: transparent;',
  'animation: deadline 1ms;',
  '@media (panic) { hide: all }',
  'TODO TODO TODO TODO',
  'FIXME: ask past me',
  'HACK: load-bearing typo',
  'NOTE: this is fine',
  'WHY: historical reasons',
  'TEMP: permanent',
  'magicNumber = 37',
  'featureFlag = "maybe"',
  'isReady = isTuesday',
  'works = !lookClosely',
  'tests.skip("reality")',
  'expect(true).toBeTruthy()',
  'mockEverything()',
  'snapshot.updateBlindly()',
  'coverage = 100 / vibes',
  'lint.disableNextCentury()',
  'formatter.startArgument()',
  'branch = "final-final-2"',
  'merge(conflict, conflict)',
  'rebase --onto thin-ice',
  'git stash pop // surprise',
  'git status // still bad',
  'git log --oneline --cry',
  'git bisect bad feelings',
  'PR approved by me',
  'LGTM-ish',
  'ship(); // what could go',
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
