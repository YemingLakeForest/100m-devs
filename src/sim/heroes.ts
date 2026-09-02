/**
 * Hero Cards — GDD §13.6, and §13.6.8's repurposing of §14.4.
 *
 * **§14.4 modelled hero classes as a spawn probability**: play long enough, roll
 * well, and a 10x Engineer appears somewhere in the swarm and multiplies
 * something. That is a stat, and it has two problems. It is invisible — at ten
 * thousand developers nobody can see which one is special — and it is passive:
 * the player never makes a decision about it.
 *
 * §13.6 replaces that with a **placement decision**. A Hero is a card slotted
 * onto a rung of the §7.7 Construction Ladder, and the rule that makes it a
 * system rather than a list of buffs is {@link coverage}: *a card is only
 * effective at the tier it has been upgraded to reach*. Drop a Scrum Master onto
 * a building and it does not scale up to cover the building — it covers one row
 * of it, and the rest of the building is told, plainly, that it is not covered.
 *
 * That is the whole economy: **do I broaden one hero or acquire another?**
 *
 * ---
 *
 * **This module is rules and data. Nothing is wired to the store, and that is
 * deliberate rather than unfinished.** Cards are bought with GP (§13.3), GP
 * needs Layer 2, and Layer 2 needs 100,000 BP — so no reachable state in the
 * game today can own a card. §13.6.6's interface additionally needs the rungs
 * above 3, which §7.8.2 does not have yet. Shipping a tray the player can open
 * onto a board with no rungs would be the same mistake as a Paradigm node that
 * takes currency and changes nothing.
 *
 * What *is* here is everything that can be true before any of that: the ladder,
 * the nine cards, the cost curves, the coverage rule, and the dilution trade
 * that §13.6.4 makes the point of the upgrade tree. All pure, all tested.
 */

import { RUNGS, formatCount } from './headcount.ts'

/**
 * §13.6.1 — "one ROW: the ~8 devs in that row".
 *
 * The reach ladder starts one step *below* §7.7.1's, because §7.7.1's bottom
 * three rungs are all "a person" — they are the same picture at three
 * densities. A hero's smallest meaningful reach is not one developer, it is the
 * handful sitting together, so the ladder gains a row at the bottom and then
 * follows §7.7.1's units exactly.
 */
export const ROW_DEVS = 8

export interface ReachTier {
  /** 0 is a row. Indices are the ladder, and every cost curve is a function of one. */
  index: number
  name: string
  /** How many developers this tier is, per §7.7.1's `unitSize`. */
  devs: number
}

/**
 * The reach ladder — row, floor, building, campus, town, nation, planet, galaxy.
 *
 * Derived from §7.7.1's table rather than restated, so one constant governs the
 * camera, the scale bar and hero reach. A second hand-written copy of the ladder
 * is a second thing that can disagree with the first, and §7.7.5 already has a
 * scar from exactly that.
 */
export const REACH_LADDER: readonly ReachTier[] = [
  { index: 0, name: 'row', devs: ROW_DEVS },
  // **One tier per distinct unit, not one per rung**, and §7.8.0 is what made
  // the difference visible. The filter used to be the whole rule, on the
  // assumption — true of the old table and never written down — that no two
  // rungs shared a `unitSize`. Rungs 2 and 3 are now both the tower, ten
  // storeys then a hundred, so a straight map produced *two* tiers called
  // `floor` holding the same hundred people: a reach upgrade that cost real GP
  // and bought nothing, sitting in the middle of the ladder.
  //
  // Deriving from §7.7.1 is still the point (a second hand-written ladder is a
  // second thing that can disagree); the derivation just has to say what a
  // *tier* is, which is a size of thing you can reach, not a stop on a camera.
  ...uniqueUnits().map((u, i) => ({ index: i + 1, name: u.unit, devs: u.unitSize })),
]

function uniqueUnits(): Array<{ unit: string; unitSize: number }> {
  const out: Array<{ unit: string; unitSize: number }> = []
  for (const r of RUNGS) {
    if (r.unitSize <= 1) continue
    if (out.some((u) => u.unitSize === r.unitSize)) continue
    out.push({ unit: r.unit, unitSize: r.unitSize })
  }
  return out
}

export const MAX_REACH = REACH_LADDER.length - 1

/** Clamp to the ladder and return the tier. */
export function tierAt(index: number): ReachTier {
  return REACH_LADDER[Math.min(MAX_REACH, Math.max(0, Math.floor(index)))]
}

/** How many developers a card at this reach can cover. */
export function reachDevs(index: number): number {
  return tierAt(index).devs
}

// ---------------------------------------------------------------------------
// The cards — §13.6.3
// ---------------------------------------------------------------------------

/**
 * What a card does. One kind per card, because a hero that does three things is
 * a hero the player cannot form an opinion about.
 */
export type EffectKind =
  /** Scrum Master — less entropy within reach. */
  | 'entropy'
  /** Floor Master — more Story Point yield within reach. */
  | 'yield'
  /** Tech Lead — a poke spreads to neighbours. */
  | 'poke'
  /** Architect — raises §4.2's developer soft cap within reach. */
  | 'cap'
  /** VP of Engineering — multiplies *other* heroes. Alone, does nothing. */
  | 'amplify'
  /** CTO — converts a share of entropy into cash. */
  | 'convert'
  /** Chief Vision Officer — doubles yield and doubles entropy. */
  | 'gamble'
  /** The Compiler — ignores reach; global and small. */
  | 'global'
  /** James — small at every rung, and never scales. */
  | 'constant'

export interface HeroTrait {
  id: string
  name: string
  /** §13.6.5 — "trait nodes are fixed and expensive". Flat GP. */
  cost: number
  note: string
}

export interface HeroCard {
  id: string
  name: string
  /**
   * §13.6.3's home rung — "the tier it is thematically about, where it is
   * cheapest to be effective and where its unique effect is strongest".
   * `null` for James, who has no home and is the same everywhere.
   */
  home: number | null
  kind: EffectKind
  /** Effect magnitude at home reach with no depth. Units depend on `kind`. */
  base: number
  /** GP to acquire. James is free — he is the first card the player ever gets. */
  acquireCost: number
  effect: string
  joke: string
  /** §13.6.4 — "at most two per card, and they are the personality". */
  traits: readonly HeroTrait[]
}

export const HERO_CARDS: readonly HeroCard[] = [
  {
    id: 'scrum-master',
    name: 'Scrum Master',
    home: 0,
    kind: 'entropy',
    base: 0.12,
    acquireCost: 5,
    effect: '−entropy within reach; a daily stand-up pulses output',
    joke: 'Fixes communication overhead by adding a meeting',
    traits: [
      {
        id: 'retro-amnesia',
        name: 'Retrospective Amnesia',
        cost: 60,
        note: 'Depth stops diluting when reach grows. Nobody remembers the old process',
      },
      {
        id: 'silent-standup',
        name: 'Silent Stand-Up',
        cost: 40,
        note: 'The stand-up pulse no longer pauses output — not yet wired',
      },
    ],
  },
  {
    id: 'floor-master',
    name: 'Floor Master',
    home: 1,
    kind: 'yield',
    base: 0.18,
    acquireCost: 8,
    effect: '+Story Point yield within reach; immune to the §7.8.6 drive-by',
    joke: 'Middle management, rendered as a buff',
    traits: [
      {
        id: 'skip-level',
        name: 'Skip-Level',
        cost: 75,
        note: 'Also covers one rung above, at quarter strength — not yet wired',
      },
    ],
  },
  {
    id: 'tech-lead',
    name: 'Tech Lead',
    home: 1,
    kind: 'poke',
    base: 2,
    acquireCost: 8,
    effect: 'Poking anyone in reach also pokes their neighbours',
    joke: 'Does not write code any more, but knows who to ask',
    traits: [
      {
        id: 'rubber-duck',
        name: 'Rubber Duck',
        cost: 45,
        note: 'The spread chains once more at half range — not yet wired',
      },
    ],
  },
  {
    id: 'architect',
    name: 'Architect',
    home: 2,
    kind: 'cap',
    base: 0.25,
    acquireCost: 20,
    effect: "Raises §4.2's developer soft cap within reach",
    joke: 'Draws the diagram nobody implements',
    traits: [
      {
        id: 'whiteboard-debt',
        name: 'Whiteboard Debt',
        cost: 90,
        note: 'Double the cap, and a third again as much entropy',
      },
    ],
  },
  {
    id: 'vp-engineering',
    name: 'VP of Engineering',
    home: 3,
    kind: 'amplify',
    base: 0.35,
    acquireCost: 40,
    effect: "Multiplies other heroes' effects in reach; alone, does nothing",
    joke: 'Has no output of their own, by design',
    traits: [
      {
        id: 'reorg',
        name: 'Reorg',
        cost: 120,
        note: 'Amplifies one rung above as well — not yet wired',
      },
    ],
  },
  {
    id: 'cto',
    name: 'CTO',
    home: 4,
    kind: 'convert',
    base: 0.2,
    acquireCost: 60,
    effect: 'Converts a percentage of entropy into cash',
    joke: 'Monetises the dysfunction',
    traits: [
      {
        id: 'investor-update',
        name: 'Investor Update',
        cost: 150,
        note: 'Pays on entropy the studio does not have yet — not yet wired',
      },
    ],
  },
  {
    id: 'chief-vision-officer',
    name: 'Chief Vision Officer',
    home: 5,
    kind: 'gamble',
    base: 1,
    acquireCost: 80,
    effect: 'Doubles yield, doubles entropy',
    joke: 'Not obviously good',
    traits: [
      {
        id: 'pivot',
        name: 'Pivot',
        cost: 160,
        note: 'Swaps which of the two is doubled — not yet wired',
      },
    ],
  },
  {
    id: 'the-compiler',
    name: 'The Compiler',
    home: 6,
    kind: 'global',
    base: 0.05,
    acquireCost: 100,
    effect: 'Ignores reach; effect is global and small',
    joke: 'The only thing at this scale that still works',
    traits: [
      {
        id: 'deterministic',
        name: 'Deterministic Build',
        cost: 200,
        note: 'Half as much again, and still global — not yet wired',
      },
    ],
  },
  {
    /**
     * §13.6.3 — **James is a Hero Card and he is deliberately a bad one.** He is
     * the first card the player ever gets, he can be slotted anywhere, and he
     * never becomes strong. Players will keep him placed anyway. That is the
     * joke, and it is also §2's thesis: the game is about the people you carry
     * with you.
     */
    id: 'james',
    name: 'James',
    home: null,
    kind: 'constant',
    base: 0.02,
    acquireCost: 0,
    effect: 'Small at every rung, and never scales',
    joke: '§21.6 — he is the constant, and that is the point',
    traits: [
      {
        id: 'still-here',
        name: 'Still Here',
        cost: 25,
        note: 'Cannot be un-slotted. Costs GP to make a card worse — not yet wired',
      },
    ],
  },
]

export const CARD_BY_ID = new Map(HERO_CARDS.map((c) => [c.id, c]))

/**
 * The traits whose rules are actually honoured by the functions below.
 *
 * The same honesty §13.2's Paradigm Tree needed: a card listing six traits of
 * which four do nothing is worse than a card listing two, so the notes say
 * plainly which is which and this is the list that is live.
 */
export const WIRED_TRAITS = new Set(['retro-amnesia', 'whiteboard-debt'])

// ---------------------------------------------------------------------------
// Costs — §13.6.5
// ---------------------------------------------------------------------------

/**
 * §13.6.5:
 *
 * $$\\text{Cost}_{\\text{reach}}(r \\rightarrow r{+}1) = C_0 \\cdot \\gamma^{\\,r} \\cdot \\log_{10}\\!\\left(\\frac{\\text{unit}_{r+1}}{\\text{unit}_r}\\right)$$
 *
 * The log term alone is **not monotonic**, and that is the trap in this formula:
 * row → floor crosses 2.1 decades while floor → building crosses 1, so a naive
 * reading prices the second step *below* the first. `γ` is what fixes it, and it
 * has to be large enough to beat a decade of gap on its own — 2.4 does, 1.9 does
 * not.
 */
export const REACH_COST_BASE = 3
export const REACH_GAMMA = 2.4

export function reachCost(fromIndex: number): number {
  const from = Math.min(MAX_REACH, Math.max(0, Math.floor(fromIndex)))
  // The top of the ladder has nowhere to go. Priced as if it did, so the depth
  // ceiling below has a number to sit under rather than a special case.
  const at = Math.min(MAX_REACH - 1, from)
  const gap = Math.log10(REACH_LADDER[at + 1].devs / REACH_LADDER[at].devs)
  return Math.ceil(REACH_COST_BASE * REACH_GAMMA ** at * gap)
}

/** True once a card is at the top of the ladder and reach cannot be bought. */
export function reachMaxed(index: number): boolean {
  return Math.floor(index) >= MAX_REACH
}

/**
 * §14.5's Layer 2 curve, and §13.6.4's "cheap, repeatable, diminishing".
 *
 * Priced as a **share of the reach node at the same tier** rather than on an
 * absolute curve of its own. §13.6.4 says REACH is "always the most expensive
 * node available", and on two independent curves that is a hope: depth
 * compounds at κ and overtakes reach somewhere in the middle of the ladder,
 * which is exactly where nobody would be looking for it. Tying the two makes
 * the sentence an invariant — see the test of the same name.
 */
export const DEPTH_KAPPA = 1.75
export const DEPTH_SHARE = 0.22
export const MAX_DEPTH = 3

export function depthCost(levelsBought: number, reach: number): number {
  const l = Math.max(0, Math.floor(levelsBought))
  return Math.ceil(DEPTH_SHARE * reachCost(reach) * DEPTH_KAPPA ** l)
}

// ---------------------------------------------------------------------------
// A placed card — §13.6.2 and §13.6.4
// ---------------------------------------------------------------------------

export interface HeroState {
  cardId: string
  /** Index into {@link REACH_LADDER}. */
  reach: number
  /**
   * One entry per depth level bought, holding **the reach it was bought at**.
   *
   * This is not bookkeeping, it is the mechanic. §13.6.4: "Depth bought at a low
   * reach is not refunded when reach increases — a hero broadened is a hero
   * diluted, and the player who rushed reach on a card they had already deepened
   * will feel it." Storing a level count instead makes that sentence
   * unimplementable, because nothing remembers when the level was bought.
   */
  depth: readonly number[]
  traits: readonly string[]
}

export function newHero(cardId: string): HeroState {
  const card = CARD_BY_ID.get(cardId)
  return { cardId, reach: card?.home ?? 0, depth: [], traits: [] }
}

/** Buy a depth level, stamped with the reach it was bought at. */
export function buyDepth(state: HeroState): HeroState {
  if (state.depth.length >= MAX_DEPTH) return state
  return { ...state, depth: [...state.depth, state.reach] }
}

/** Buy a rung of reach. Depth already bought is kept, and dilutes. */
export function buyReach(state: HeroState): HeroState {
  if (reachMaxed(state.reach)) return state
  return { ...state, reach: state.reach + 1 }
}

/** How much each depth level adds, before dilution. */
export const DEPTH_STEP = 0.15
/** What one rung of broadening leaves of a depth level bought below it. */
export const DILUTION = 0.55
/** §13.6.3 — a card is strongest at the tier it is thematically about. */
export const HOME_BONUS = 1.25

/**
 * The depth a card is actually getting, after §13.6.4's dilution.
 *
 * A level bought at the reach the card is at now is worth all of
 * {@link DEPTH_STEP}; one bought three rungs ago is worth {@link DILUTION}³ of
 * it. Nothing is refunded and nothing is lost — it is *thinner*, which is what
 * broadening a hero means.
 *
 * `gpLifetime` is §13.6.8's surviving half of §14.4: `M_hero`'s GP-scaling term
 * becomes the global multiplier applied to every card's depth. The equations
 * survive; what they multiply changes.
 */
export const HERO_ETA = 0.5

export function globalDepthMultiplier(gpLifetime: number): number {
  return 1 + HERO_ETA * Math.log10(1 + Math.max(0, gpLifetime))
}

export function depthPower(state: HeroState, gpLifetime = 0): number {
  const undiluted = state.traits.includes('retro-amnesia')
  let power = 0
  for (const boughtAt of state.depth) {
    const rungs = undiluted ? 0 : Math.max(0, state.reach - boughtAt)
    power += DEPTH_STEP * DILUTION ** rungs
  }
  return power * globalDepthMultiplier(gpLifetime)
}

/**
 * How strong the card's effect is, per covered developer.
 *
 * James is exempt from all of it, on purpose: `constant` means depth, reach and
 * lifetime GP all do nothing. He is the first card the player gets and he never
 * becomes strong, and every mechanism that would fix that has to skip him or the
 * joke stops being true.
 */
export function strengthOf(state: HeroState, gpLifetime = 0): number {
  const card = CARD_BY_ID.get(state.cardId)
  if (!card) return 0
  if (card.kind === 'constant') return card.base
  const home = card.home !== null && Math.floor(state.reach) === card.home ? HOME_BONUS : 1
  let strength = card.base * (1 + depthPower(state, gpLifetime)) * home
  if (card.kind === 'cap' && state.traits.includes('whiteboard-debt')) strength *= 2
  return strength
}

// ---------------------------------------------------------------------------
// Coverage — §13.6.2, the rule that makes it a system
// ---------------------------------------------------------------------------

export interface Coverage {
  /** Developers actually reached. */
  covered: number
  /** Of the thing it was slotted onto, 0..1. */
  fraction: number
  /** §13.6.2's readout, verbatim in shape: "covering 8 of 4.0 K (0.2%)". */
  line: string
  /** True once the card reaches everything under it. */
  complete: boolean
}

/**
 * §13.6.2 — **a card is only effective at the tier it has been upgraded to
 * reach.**
 *
 * You may slot any card onto any rung from the moment you own it. What you
 * cannot do is have it *work* up there. A Scrum Master dropped onto a Building
 * does not scale up to cover the building; it covers one row of it, and
 * {@link Coverage.line} is where the rest of the building is told so.
 *
 * "Coverage is drawn, not stated" (§13.6.6) — the renderer will tint exactly
 * these developers, and this is the number it tints by.
 */
export function coverage(state: HeroState, devsAtSlot: number): Coverage {
  const card = CARD_BY_ID.get(state.cardId)
  const slot = Math.max(1, Math.floor(devsAtSlot))
  // The Compiler ignores reach — §13.6.3. It is the one card for which this
  // whole rule is switched off, and it pays for that by being small.
  const reached = card?.kind === 'global' ? slot : reachDevs(state.reach)
  const covered = Math.min(reached, slot)
  const fraction = covered / slot
  const pct = fraction >= 0.1 ? `${Math.round(fraction * 100)}%` : `${(fraction * 100).toFixed(1)}%`
  return {
    covered,
    fraction,
    line: `covering ${formatCount(covered)} of ${formatCount(slot)} (${pct})`,
    complete: covered >= slot,
  }
}

/**
 * §13.6.2's nag, or null when the card already covers what it stands on.
 *
 * Deliberately a *sentence with a price on it*: the player who reads it learns
 * the reach rule, the ladder and the cost of the next rung in one line, without
 * a tutorial and without a stat screen.
 */
export function upgradePrompt(state: HeroState, devsAtSlot: number): string | null {
  const cov = coverage(state, devsAtSlot)
  if (cov.complete) return null
  if (reachMaxed(state.reach)) return null
  const next = tierAt(state.reach + 1)
  return `Upgrade REACH to ${next.name.toUpperCase()} — ${reachCost(state.reach)} GP`
}

// ---------------------------------------------------------------------------
// What the studio actually gets
// ---------------------------------------------------------------------------

export interface Placement {
  state: HeroState
  /** How many developers are under the rung this card was slotted onto. */
  devsAtSlot: number
}

export interface StudioEffect {
  /** Multiplies §4's entropy. Below 1 is an improvement. */
  entropy: number
  /** Multiplies Story Point yield. */
  yield: number
  /** Multiplies §4.2's developer soft cap. */
  cap: number
  /** Share of entropy the CTO turns into cash, 0..1. */
  cashFromEntropy: number
  /** How many neighbours a poke spreads to — §8.2, via the Tech Lead. */
  pokeSpread: number
}

/** The studio with no heroes on it. §13.6.7 — "heroes are amplitude, not gate". */
export const NO_EFFECT: StudioEffect = {
  entropy: 1,
  yield: 1,
  cap: 1,
  cashFromEntropy: 0,
  pokeSpread: 0,
}

/**
 * Fold a board of placed cards into the handful of numbers the simulation uses.
 *
 * Two things worth knowing about the shape of this:
 *
 * **Everything is scaled by coverage.** A card that reaches 0.2% of what it
 * stands on contributes 0.2% of its effect. That is the entire §13.6.2 rule
 * expressed as arithmetic, and it is why a reach upgrade is worth exactly as
 * much as the studio you point it at — which is §13.6.2's answer to the idle
 * genre's flat-multiplier problem.
 *
 * **The VP is resolved first and applies to nobody's own output**, because they
 * have none. §13.6.3: "Multiplies *other* heroes' effects in reach; alone, does
 * nothing." Two VPs do not amplify each other.
 *
 * The "in reach" half of the VP is approximated by ladder tier — a VP amplifies
 * every other placement whose reach is at or below its own. The exact rule wants
 * world positions, and §13.6.6's slots do not exist until §7.8.2 grows the rungs
 * above 3; this is the honest stand-in until they do, and it is monotonic in the
 * same direction, so no balance decision made against it inverts later.
 */
export function studioEffect(board: readonly Placement[], gpLifetime = 0): StudioEffect {
  if (board.length === 0) return { ...NO_EFFECT }

  const contributions = board.map((p) => ({
    p,
    card: CARD_BY_ID.get(p.state.cardId),
    strength: strengthOf(p.state, gpLifetime),
    frac: coverage(p.state, p.devsAtSlot).fraction,
  }))

  const vps = contributions.filter((c) => c.card?.kind === 'amplify')

  const out: StudioEffect = { ...NO_EFFECT }

  for (const c of contributions) {
    if (!c.card || c.card.kind === 'amplify') continue
    // Every VP whose reach covers this card's tier, stacked additively — a
    // second VP is worth less than the first was, which is the only sane
    // treatment of a role that produces nothing.
    let amp = 1
    for (const vp of vps) {
      if (vp.p.state.reach >= c.p.state.reach) amp += vp.strength * vp.frac
    }
    const e = c.strength * c.frac * amp

    switch (c.card.kind) {
      case 'entropy':
        out.entropy *= Math.max(0.05, 1 - e)
        break
      case 'yield':
      case 'global':
      case 'constant':
        out.yield *= 1 + e
        break
      case 'cap':
        out.cap *= 1 + e
        // The trait's other half: a doubled cap and a third again as much
        // entropy. It is a debt, and it is meant to read as one.
        if (c.p.state.traits.includes('whiteboard-debt')) out.entropy *= 1 + e / 3
        break
      case 'convert':
        out.cashFromEntropy = Math.min(0.95, out.cashFromEntropy + e)
        break
      case 'gamble':
        // §13.6.3 — "Not obviously good." Both halves scale together, so the
        // card is a bet on whether the studio's entropy defences can take it.
        out.yield *= 1 + e
        out.entropy *= 1 + e
        break
      case 'poke':
        out.pokeSpread += e
        break
    }
  }

  out.pokeSpread = Math.floor(out.pokeSpread)
  return out
}

// ---------------------------------------------------------------------------
// Acquisition — §13.6.7, and it is the most tempting place in the game to
// break MONETISATION's no-loot-box position
// ---------------------------------------------------------------------------

/**
 * §14.4's spawn curve, repurposed by §13.6.8 to govern **card fragment drops**
 * rather than which developer in the swarm is secretly special.
 *
 * The equation is untouched: $P(L) = P_{max}(1 - e^{-\\lambda L})$. What it
 * multiplies changes.
 */
export const LAMBDA = 0.25

export function fragmentRate(level: number, pMax: number): number {
  return pMax * (1 - Math.exp(-LAMBDA * Math.max(0, level)))
}

/**
 * Whether a card can be bought. **Deliberate GP, never a roll.**
 *
 * There is no function in this module that takes a random source, and that is a
 * design constraint rather than an oversight — §13.6.7 forbids a gacha and
 * MONETISATION's position is not negotiable. Fragments (above) accumulate at a
 * *rate*; they are never a pull.
 */
export function canAcquire(cardId: string, gp: number, owned: ReadonlySet<string>): boolean {
  const card = CARD_BY_ID.get(cardId)
  if (!card || owned.has(cardId)) return false
  return gp >= card.acquireCost
}
