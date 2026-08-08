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
  /** Act II — the OS suggests scaling up; HIRE unlocks. */
  | 'act2_offer_hire'
  /** Act II — James is here; ship the thing. */
  | 'act2_ship'
  /** Act IIa — the honest loop. Ship, earn, hire, repeat, to ~40. */
  | 'act2a_loop'
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
  'act2_offer_hire',
  'act2_ship',
  'act2a_loop',
  'act3_bait',
  'act4_collapse',
  'act5_bleeding',
  'bankrupt',
]

/**
 * Pokes required before the OS starts nagging about speed.
 *
 * §21 Act I wants the player to poke "roughly 3–5 times a second" and feel the
 * burn-down outpace the passive rate — "this is the moment the clicker layer
 * sells itself, and it must feel good before anything else is introduced."
 * Twelve taps is about three seconds of that, which is long enough to land and
 * short enough not to outstay the joke.
 */
export const ACT1_POKES_REQUIRED = 12

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
      'Sprint Commitment: 1,000 SP',
      'Developer Count: 1',
    ],
    bubble: 'Okay... just need to write 1,000 lines of code. Simple enough.',
    advisor: 'Poke the developer.',
  },

  act2_offer_hire: {
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

export const MASS_HIRE_COUNT = 1000

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
      return s.pokeCount >= ACT1_POKES_REQUIRED ? 'act2_offer_hire' : phase

    case 'act2_offer_hire':
      // Waits on the player hiring James.
      return s.devs >= 2 ? 'act2_ship' : phase

    case 'act2_ship':
      // Waits on Flappy Square actually shipping.
      return s.projectsShipped >= 1 ? 'act2a_loop' : phase

    case 'act2a_loop':
      // §21.0: Act IIa ends at ~40 developers, and the number is not
      // arbitrary — it is the first headcount at which the readout says
      // something other than `IN SYNC` (E = 1.01%). Ending on that first
      // twitch is what buys the "I saw that and ignored it" the collapse
      // needs. Measured against the shipped `entropy()`, not chosen to be
      // round.
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
