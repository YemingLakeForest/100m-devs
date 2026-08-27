/**
 * Run 1 — The Trap. GDD §21, and the trap it scripts in §6.
 *
 * The onboarding is not a tutorial laid over the game; it *is* Run 1. Its job
 * is to lure the player into the classic "hire everyone immediately" mistake
 * and let the simulation punish it, so the thesis arrives through the thumb
 * rather than through a text box (§6.3).
 *
 * Modelled as a linear phase machine with pure advance conditions, so the
 * script's pacing is testable instead of a chain of timers.
 *
 * ## §21.0e — **Run 1 does not hire** [CANON — added 2026-08-27]
 *
 * §21.0 built Act IIa, "the honest loop": ship, earn, hire, repeat, from two
 * developers to about forty, and then the mousetrap. It is a good loop and it
 * broke the scene it was built to set up. §21.0d's Act III is a *conversation*,
 * and its load-bearing line is James's:
 *
 * > "Two of us shipped four games. A thousand of us is five hundred times that."
 *
 * By the time a player reaches it under Act IIa there are **forty of them**, so
 * the arithmetic is wrong, the "two of us" is wrong, and the one beat in Run 1
 * where James is *completely correct about a small thing* is the beat where he
 * is visibly not. Reported as exactly that. A joke whose premise the player can
 * see is false on screen is not a joke that lands.
 *
 * So Run 1 is the garage, all the way through, and **the hire control is never
 * offered in it** (`unlocksFor().manualHire`). The player pokes, James arrives
 * free, the two of them ship the whole garage catalogue, an investor turns up
 * with fifty thousand dollars, and the only thing in the game that money can buy
 * is a thousand developers. Every step is still a decision and none of them is a
 * hiring decision — which is what makes the last one legible.
 *
 * Three things this buys back, stated because Act IIa was defended at length and
 * is being retired:
 *
 * 1. **The scene is true.** Two of them, three games, a thousand developers,
 *    five hundred times. Every number James says is checkable on screen.
 * 2. **Run 1 is four minutes again**, which is what §21.0c asks for — Act IIa
 *    had measured at 11.4 minutes and admitted it in §21.0's own note.
 * 3. **The lesson is not diluted by a second one.** Act IIa taught cash-flow
 *    management; §6 is about communication overhead. Teaching both in the first
 *    four minutes taught neither, and §4.10g records what the first one was
 *    actually teaching.
 *
 * What it gives up is real and named: Act IIa's *"they have hired several times,
 * deliberately, with earned cash, and it always worked"* is gone, so the trap no
 * longer springs on a mental model the player built themselves. It springs on
 * the model James states aloud and the player has no way to refuse — which is
 * §21.0d's own argument for making the beat a conversation in the first place,
 * carried one act earlier.
 */

import { FIRST_PAID_RUNG } from '../sim/economy.ts'

export type Phase =
  /** Act I — one dev, one project, learn to poke. */
  | 'act1_poke'
  /** §21.0b — James turns up, free, part-way through Act I. */
  | 'act1_james'
  /** Act I's second half — the two of them ship the garage catalogue. */
  | 'act1_ship'
  /** §21.0a — the term sheet is on the table. Waits on the player signing it. */
  | 'act2_termsheet'
  /** Act II — the loop, with capacity. **Runs 2+ only**; Run 1 never hires. */
  | 'act2_loop'
  /** Act III — the mousetrap is baited. */
  | 'act3_bait'
  /** Act IV — 1,000 devs land, entropy surges. */
  | 'act4_collapse'
  /** Act V — payroll eats the company. */
  | 'act5_bleeding'
  /** Act V — the bankruptcy screen. */
  | 'bankrupt'

export const PHASE_ORDER: readonly Phase[] = [
  'act1_poke',
  'act1_james',
  'act1_ship',
  'act2_termsheet',
  'act2_loop',
  'act3_bait',
  'act4_collapse',
  'act5_bleeding',
  'bankrupt',
]

/**
 * Phases that existed before §21.0e, and where a save holding one lands.
 *
 * `act2_offer_hire`, `act2_ship` and `act2a_loop` were Act IIa's three beats and
 * they are gone; `act2a_seed` and `act2b_loop` were renamed once the `a`/`b`
 * suffixes stopped naming anything. A phase name is written into every save
 * (§24.3), so **deleting one silently restarts somebody's script** — `save.ts`
 * falls back to `act1_poke` for a name it does not recognise, which for a player
 * mid-Act-IIa would re-run the poke gate they have already passed.
 *
 * Mapped rather than dropped: every retired Run 1 beat lands on `act1_ship`,
 * which is where the new script has them — mid-garage, with whatever they have
 * already shipped counted — and the machine walks them forward from there on the
 * next tick. `act2b_loop` was runs 2+ and is simply renamed.
 */
export const RETIRED_PHASES: Readonly<Record<string, Phase>> = {
  act2_offer_hire: 'act1_ship',
  act2_ship: 'act1_ship',
  act2a_loop: 'act1_ship',
  act2a_seed: 'act2_termsheet',
  act2b_loop: 'act2_loop',
}

/**
 * Pokes before James turns up — §21.0b, R41.
 *
 * **Fifty, and he is free.** The previous twelve was the number of taps needed
 * to prove that tapping did something, and it was measured against a beat that
 * no longer exists: at twelve pokes the script offered a `[ HIRE DEVELOPER ]`
 * button costing a dollar, from a treasury holding nothing, so the *real* gate
 * on the first hire was shipping *Flappy Square* — 1,000 Story Points, alone,
 * by thumb. **The first help in the game arrived after the hardest part of the
 * game was over**, which inverts §21.0's own thesis: Act I exists so the
 * clicker layer sells itself, and a sale takes about ten seconds.
 *
 * Fifty is chosen the way §21.0's forty was. At §21's stated 3–5 taps a second
 * it is about fifteen seconds — long enough that the player has felt the size
 * of the sprint, and **short enough that they have not yet decided the game is
 * a grind.** The help arrives at the first moment it would be a relief and
 * before it would be a rescue.
 *
 * The trap is untouched. The collapse still costs a treasury the player built
 * (§21.0e: three shipped games and a term sheet, spent to the cent). What has
 * gone is the unpaid labour before the run starts, which was teaching nothing
 * the rest of Act I does not teach better.
 */
export const ACT1_POKES_REQUIRED = 50

/**
 * §6.3 — the line that appears "around the twentieth desperate tap" once the
 * studio has seized. This is the thesis, said by the person being interrupted.
 */
export const DESPERATE_TAPS_BEFORE_REBUKE = 20

export const REBUKE_LINE = 'Poking me again isn’t making the meeting end sooner.'

export interface OnboardingSnapshot {
  pokeCount: number
  devs: number
  projectsShipped: number
  cash: number
  entropy: number
  bankrupt: boolean
  /** §21.0a — has the player accepted the term sheet? */
  seedTaken: boolean
}

/**
 * Copy for each phase. Text does the comedy work, not art (Appendix D #6).
 *
 * **No emoji** — ART_DIRECTION §3.1, enforced by `npm run art:check`. The
 * banners below used 🔥, ⚠ and 💸 until 2026-08-07. Emphasis is carried by
 * `**` and `[!]` instead, which are in Departure Mono, in the palette, and the
 * same picture on every device. Where a real mark is wanted, it is a procedural
 * pixel icon drawn beside the text, not a codepoint inside it.
 */
export interface PhaseCopy {
  /** Terminal banner, rendered in the CRT type. */
  terminal?: string[]
  /** Speech bubble over the developer. */
  bubble?: string
  /** The sarcastic tutorial assistant. */
  advisor?: string
  /** Label of the action this phase is waiting on, if any. */
  action?: string
}

export const PHASE_COPY: Record<Phase, PhaseCopy> = {
  act1_poke: {
    terminal: [
      'STUDIO_OS v0.0.1 initialized.',
      'Project: "Flappy Square 1.0"',
      'Sprint Commitment: 300 story points',
      'Employees: 0 // just you',
    ],
    bubble: 'Okay... just need to write 300 lines of code. Simple enough.',
    advisor: 'Choose CODE, then tap yourself or your desk.',
  },

  act1_james: {
    // §21.0b — the beat is §21.7.1's scene. This one line is a mechanic hint,
    // not a narration: the player now has a second body on the floor and can
    // buff it exactly the way they buff themselves.
    advisor: 'Tap yourself to code, or poke James to make him work faster.',
  },

  act1_ship: {
    // §21.0e — **there is no scaling pitch in Run 1.** Hiring is not on offer at
    // any point in it, so the only two levers on this beat are the two the
    // player already has: their own desk and James's. The line names both and
    // stops, because everything else it could say would be about a button that
    // is not there.
    advisor: 'Founders still have to code, or poke James to make him work faster.',
  },

  act2_termsheet: {
    // §21.0a, now on its own surface. The terminal block that used to live here
    // is the *modal's* body (`TermSheet.tsx`) — printing it on the rail as well
    // would be the same offer made twice, once where it can be signed and once
    // where it cannot. What is left on the rail is the advisor, which is
    // commentary rather than the offer: sincere, and the last time anybody in
    // this game is.
    advisor:
      'Somebody with money believes in you. That has never gone wrong for anyone.',
  },

  act2_loop: {
    // §21.0e — runs 2+, and every one of them ends here. Still no narration:
    // the player has capacity, cash and the dial, and telling them what to do
    // with those would take the discovery away. The only thing here is the verb.
    advisor: 'Capacity unlocked. Spend it however you like.',
  },

  act3_bait: {
    terminal: [
      '** LIMITED OFFER: MASS HIRING PACKAGE UNLOCKED! **',
      '"Why hire one by one when you can hire an entire swarm?"',
      'Cost: YOUR ENTIRE TREASURY',
    ],
    advisor:
      'Math doesn’t lie! If 2 devs make games 2× faster, 1,000 devs will make games 1,000× faster! Tap the button. Do it. What could possibly go wrong?',
    action: 'HIRE 1,000 DEVS NOW',
  },

  act4_collapse: {
    bubble: 'Wait — who’s writing this function?',
    advisor: 'Onboarding 1,000 developers. This is fine.',
  },

  act5_bleeding: {
    terminal: [
      // GDD §4.3a — the player-facing word, never "entropy".
      '[!] CRITICAL SYSTEM FAILURE: STUDIO SEIZED',
      'Production Speed: 0.00000x',
    ],
    bubble: 'I can’t push my line of code because 999 other people are trying to edit the same file!',
  },

  bankrupt: {
    terminal: [
      '** BANKRUPTCY **',
      'Your 1,000 developers spent 100% of their time arguing in Slack',
      'and zero seconds coding.',
      '',
      'LESSON LEARNED:',
      'Manpower without Communication Infrastructure is Chaos.',
    ],
    action: 'TRIGGER PARADIGM SHIFT',
  },
}

/**
 * The number of developers the Mass Hire drops in — §21 Act IV, §6.2.
 *
 * Against the Run 1 cap of 100 this gives L = 10 and efficiency 1e-5, which is
 * exactly the "production drops to 0.01x" figure §6.2 asserts.
 */
/**
 * Where the readout first twitches — §21.0's measured table.
 *
 * The first headcount whose readout is not `IN SYNC`. At 30 developers E is
 * 0.242% and rounds to nothing; at 40 it is 1.01% and the speedometer says
 * `CHATTY`. **The player must get exactly one hint and wave it away.**
 *
 * It is no longer a phase transition. §21.0's Act II ended here and handed over
 * to the mousetrap, which was right for Run 1 and wrong for every run after it
 * (see `advanceOnboarding`'s `act2_loop` case). Kept as the measurement it has
 * always been — §4.3a's first visible reading, the number §21.0's table is
 * built around, and the one `entropy()` is checked against.
 */
export const MOUSETRAP_AT = 40

/**
 * §21.0a — where the term sheet lands, and it is a **catalogue** now, not a
 * headcount [amended 2026-08-27].
 *
 * It was ten developers: "the first headcount at which the player has hired
 * enough times to have a habit". §21.0e deletes the habit — nobody hires in Run
 * 1 — so the beat is re-hung on the thing the player *has* been doing, which is
 * shipping. {@link FIRST_PAID_RUNG} games out is the whole garage catalogue:
 * *Flappy Square 1.0*, *1.1 (Now With Ads)* and *2.0 (Now With A Battle Pass)*.
 *
 * That is the same argument the old number made, pointed at the right verb. An
 * investor turns up because you have a catalogue and a release cadence, and
 * three shipped games is the first moment either of those words is true.
 */
export const TERM_SHEET_AFTER_SHIPS = FIRST_PAID_RUNG

/**
 * What the round is worth.
 *
 * Enough to "feel like a different game for a minute" (§21.0a). A figure rather
 * than a formula because it is a story beat: an investor wrote a number on a
 * term sheet, and round numbers are what investors write.
 *
 * §21.0e gives it a second job it did not have and it is the more important one:
 * **it is the whole of the mousetrap's price.** The player reaches Act III with
 * a garage catalogue's $13,550 and this, and the Mass Hire costs the lot — so
 * the money that liquidates the company is money somebody handed them for
 * growth, spent on growth, exactly as instructed.
 */
export const SEED_ROUND_CASH = 50_000

export const MASS_HIRE_COUNT = 1000

/**
 * Phases whose words are a §21.7 **scene** rather than a banner.
 *
 * Every phase in {@link PHASE_COPY} carries terminal text, a bubble or an
 * advisor line, and a test asserts it — a beat the game passes through in
 * silence is a beat the player experiences as the game having stopped.
 *
 * The James arrival used to be the one exception — its words were the scene
 * alone. It now also carries a one-line *mechanic* hint (poke James), which is
 * not scene narration, so the set is empty. It is kept rather than deleted so a
 * future scene-only beat has the stated place to declare itself.
 */
export const SCENE_PHASES: ReadonlySet<Phase> = new Set()

/**
 * Phases the player advances by acting, not by the simulation reaching a state.
 * Listed so the UI knows to render a button and the machine knows not to
 * advance past them on its own.
 */
export const PLAYER_GATED: ReadonlySet<Phase> = new Set([
  'act2_termsheet',
  'act3_bait',
  'bankrupt',
])

/**
 * Advance the script. Pure: same snapshot, same phase, every time.
 *
 * Only ever moves forward, and only one step per call, so a frame that
 * satisfies two conditions at once still plays both beats.
 */
export function advanceOnboarding(phase: Phase, s: OnboardingSnapshot): Phase {
  // Running the studio into the ground ends the run, **whatever act it happens
  // in**. This used to be checked only in `act5_bleeding`, on the assumption
  // that bankruptcy could only follow the Mass Hire — and payroll does not know
  // that. A player who overhired in the loop, or who sat in Act III unable
  // to afford the offer, would drop past -$1,000,000 and simply stay there:
  // no ending, no prestige, no screen, and the only control on the beat dead
  // because they could not pay for it. A run has to be able to end.
  if (s.bankrupt && phase !== 'bankrupt') return 'bankrupt'

  switch (phase) {
    case 'act1_poke':
      // The clicker layer has to sell itself before anything else appears.
      return s.pokeCount >= ACT1_POKES_REQUIRED ? 'act1_james' : phase

    case 'act1_james':
      // §21.0b — he is not hired, he turns up. The store grants him free on
      // entry to this phase and the beat waits on him being at a desk rather
      // than on the player pressing anything: there is nothing to press.
      return s.devs >= 1 ? 'act1_ship' : phase

    case 'act1_ship':
      // **The whole garage catalogue, and then the investor** — §4.10f, §21.0e.
      //
      // Two unpaid founders ship all three garage games before anything else
      // happens: *Flappy Square 1.0* for fifty dollars, then the same game with
      // adverts, then the same game with a battle pass. That is the joke §4.10f
      // built the ladder for, and §21.0e is what finally lets it run to the end
      // — there is no hire prompt waiting to interrupt it after the first ship.
      //
      // {@link TERM_SHEET_AFTER_SHIPS} rather than a literal, because the two
      // facts are the same fact: the garage is every rung below
      // {@link FIRST_PAID_RUNG}, and the term sheet arrives when the garage is
      // finished.
      return s.projectsShipped >= TERM_SHEET_AFTER_SHIPS ? 'act2_termsheet' : phase

    case 'act2_termsheet':
      // Waits on the player signing. It is the only beat in Run 1 that is pure
      // upside, and it still has to be *taken* — §6's lesson needs every step
      // into the trap to have been a decision.
      //
      // §21.0e — and it goes straight to the mousetrap. There is nothing between
      // the money arriving and the only thing in the game that money can buy.
      return s.seedTaken ? 'act3_bait' : phase

    case 'act2_loop':
      // **The last phase of every run after the first, and it does not end.**
      //
      // This used to advance to `act3_bait` at {@link MOUSETRAP_AT}, because
      // §21's act machine was written as though every run were Run 1. Measured
      // (`pacing.test.ts`, 2026-08-27): run 6 passed forty developers at t=100
      // and five hundred at t=190, so from three minutes in, a healthy studio of
      // 1,500 people making forty million dollars a game had `** LIMITED OFFER:
      // MASS HIRING PACKAGE UNLOCKED **` on its terminal and *"Onboarding 1,000
      // developers. This is fine."* under it, **for the rest of the run**.
      //
      // Acts III to V are Run 1's script. They are the trap, they are a story
      // that has already happened, and re-running their copy over a company that
      // learned the lesson is the same defect §21.0e is fixing one act earlier:
      // the game saying something the player can see is not true.
      //
      // The run still *ends* — the bankruptcy guard at the top of this function
      // is not keyed to a phase, deliberately, and §13.1's Paradigm Shift is
      // offered from the tree rather than from the act machine.
      return phase

    case 'act3_bait':
      // Waits on the player springing the trap themselves. It matters that they
      // choose it — §6 is a lesson, and a lesson needs a decision, and §21.0d's
      // scene is where the choosing happens.
      //
      // Half the swarm rather than all of it, so a frame that lands mid-arrival
      // still advances. The `2 +` is historical slack around the headcount a run
      // arrives with and is left alone deliberately: §21.0e brought that down
      // from forty to one, and a threshold written against *five hundred* people
      // has no business tracking it.
      return s.devs > 2 + MASS_HIRE_COUNT / 2 ? 'act4_collapse' : phase

    case 'act4_collapse':
      // The collapse beat holds until the studio has actually seized, so the
      // warning lands on a real reading rather than a scripted one.
      return s.entropy >= 0.99 ? 'act5_bleeding' : phase

    case 'act5_bleeding':
      // Handled by the guard above; kept explicit so the act reads completely.
      return s.bankrupt ? 'bankrupt' : phase

    case 'bankrupt':
      return phase
  }
}

/**
 * Should the §6.3 rebuke be showing?
 *
 * Only counts taps made *while locked* — the line is about futility, and it
 * would read as a non-sequitur attached to a healthy studio's tap count.
 */
export function shouldRebuke(desperateTaps: number, entropy: number): boolean {
  return entropy >= 0.99 && desperateTaps >= DESPERATE_TAPS_BEFORE_REBUKE
}
