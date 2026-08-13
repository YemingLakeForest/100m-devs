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
 */

export type Phase =
  /** Act I — one dev, one project, learn to poke. */
  | 'act1_poke'
  /** §21.0b — James turns up, free, part-way through Act I. */
  | 'act1_james'
  /** Act II — the OS suggests scaling up; HIRE unlocks. */
  | 'act2_offer_hire'
  /** Act II — James is here; ship the thing. */
  | 'act2_ship'
  /** Act IIa — the honest loop. Ship, earn, hire, repeat, to 10. */
  | 'act2a_loop'
  /** §21.0a — the term sheet is on the table. Waits on the player taking it. */
  | 'act2a_seed'
  /** Act IIb — the loop again, with capacity, to ~40. */
  | 'act2b_loop'
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
  'act2_offer_hire',
  'act2_ship',
  'act2a_loop',
  'act2a_seed',
  'act2b_loop',
  'act3_bait',
  'act4_collapse',
  'act5_bleeding',
  'bankrupt',
]

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
 * of 1,000, and **short enough that they have not yet decided the game is a
 * grind.** The help arrives at the first moment it would be a relief and before
 * it would be a rescue.
 *
 * The trap is untouched. Act IIa still buys every subsequent hire with earned
 * cash, the price still climbs, and the collapse still costs a treasury the
 * player built. What has gone is the unpaid labour before the loop starts,
 * which was teaching nothing the loop does not teach better.
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
      'Sprint Commitment: 1,000 story points',
      'Employees: 0 // just you',
    ],
    bubble: 'Okay... just need to write 1,000 lines of code. Simple enough.',
    advisor: 'Choose CODE, then tap yourself or your desk.',
  },

  act1_james: {
    // §21.0b — the beat is §21.7.1's scene. This one line is a mechanic hint,
    // not a narration: the player now has a second body on the floor and can
    // buff it exactly the way they buff themselves.
    advisor: 'Tap yourself to code, or poke James to make him work faster.',
  },

  act2_offer_hire: {
    // Unchanged, and it lands harder one beat later than it used to: the player
    // now has evidence that a second person doubled their speed, so the pitch is
    // arriving at somebody who already agrees with it.
    advisor:
      'Progress is dangerously slow! At this rate, your indie game will launch after the sun dies. Let’s scale up!',
    action: 'HIRE DEVELOPER',
  },

  act2_ship: {
    // James's line, and his card flavour text forever: the thesis of the game,
    // said sincerely, by the person who will be proven wrong four minutes from
    // now and will stay anyway.
    bubble: 'Hey, this actually works! More people = faster games!',
    advisor: 'Velocity doubled. Burn it down.',
  },

  act2a_loop: {
    // §21.0's load-bearing beat, and the one that must NOT be narrated. The
    // player is being left alone to build a mental model out of evidence —
    // "more developers, more speed" — which they will hold right up until it
    // fails. A line of advisor copy telling them hiring works would replace
    // that evidence with an assertion, and an assertion is not something you
    // feel betrayed by. The only thing here is the verb.
    advisor: 'Ship it. Hire. Ship it again.',
  },

  act2a_seed: {
    // §21.0a. Sincere, and the last time anybody in this game is.
    terminal: [
      '> INCOMING: TERM SHEET',
      '',
      '"We love what you’re building.',
      ' We think you can build it FASTER."',
      '',
      'SEED ROUND OFFERED  --  $50,000',
    ],
    advisor:
      'Somebody with money believes in you. That has never gone wrong for anyone.',
    action: 'ACCEPT TERM SHEET',
  },

  act2b_loop: {
    // Still no narration. §21.0a's Act IIb is Act IIa with capacity, and the
    // player has just been handed the two things that change it — cash and the
    // dial. Telling them what to do with those would take the discovery away.
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
 * Where Act IIa ends — §21.0's measured table.
 *
 * The first headcount whose readout is not `IN SYNC`. At 30 developers E is
 * 0.242% and rounds to nothing; at 40 it is 1.01% and the speedometer says
 * `CHATTY`. **The player must get exactly one hint and wave it away.**
 */
export const ACT2A_ENDS_AT = 40

/**
 * §21.0a — where the Seed Round lands.
 *
 * Ten is chosen the same way forty was: it is the first headcount at which the
 * player has hired **enough times to have a habit** and not yet enough to be
 * bored of it. Two projects shipped, eight people hired, all with money they
 * made. The round is a reward for a loop they already understand rather than a
 * gift that arrives before they know what it is for.
 */
export const SEED_ROUND_AT = 10

/**
 * What the round is worth.
 *
 * Roughly ten hires at the price they will be paying just after it — enough to
 * "feel like a different game for a minute" (§21.0a) without skipping Act IIb.
 * A figure rather than a formula because it is a story beat: an investor wrote
 * a number on a term sheet, and round numbers are what investors write.
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
  'act2_offer_hire',
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
  // that. A player who overhired during Act IIa, or who sat in Act III unable
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
      return s.devs >= 1 ? 'act2_offer_hire' : phase

    case 'act2_offer_hire':
      // §21.0b — the offer is now about the *second* employee, and it is the
      // first one the player pays for. It waits on that purchase.
      return s.devs >= 2 ? 'act2_ship' : phase

    case 'act2_ship':
      // **Two** projects, not one — §4.10c.
      //
      // Payroll starts with the third developer, and *Flappy Square 1.0* pays
      // fifty dollars. Opening Act IIa's hire prompt on one shipped project
      // handed the player a HIRE button, a $50 treasury and a $50/sec burn:
      // one second of runway, then a slow slide to bankruptcy they could not
      // see coming and could not have avoided.
      //
      // The second project ships at two unpaid founders, so all $25,000 of it
      // is profit, and *that* is the money Act IIa is played with. It also
      // sharpens Act II's joke rather than blunting it: your first game earns
      // fifty dollars, your second earns twenty-five thousand, and only then
      // can you afford people.
      return s.projectsShipped >= 2 ? 'act2a_loop' : phase

    case 'act2a_loop':
      // §21.0a — the term sheet arrives once the loop is a habit.
      return s.devs >= SEED_ROUND_AT ? 'act2a_seed' : phase

    case 'act2a_seed':
      // Waits on the player accepting. It is the only beat in Run 1 that is
      // pure upside, and it still has to be *taken* — §6's lesson needs every
      // step into the trap to have been a decision.
      return s.seedTaken ? 'act2b_loop' : phase

    case 'act2b_loop':
      // §21.0: Act II ends at ~40 developers, and the number is not arbitrary
      // — it is the first headcount at which the readout says something other
      // than `IN SYNC` (E = 1.01%). Ending on that first twitch is what buys
      // the "I saw that and ignored it" the collapse needs. Measured against
      // the shipped `entropy()`, not chosen to be round.
      return s.devs >= ACT2A_ENDS_AT ? 'act3_bait' : phase

    case 'act3_bait':
      // Waits on the player springing the trap themselves. It matters that
      // they choose it — §6 is a lesson, and a lesson needs a decision.
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
