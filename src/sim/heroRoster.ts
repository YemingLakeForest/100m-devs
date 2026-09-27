/**
 * The heroes, as the store sees them — GDD §22.8, §13.8 [amended 2026-09-26].
 *
 * `storyHeroes.ts` says who they are. **This file says what they do for the
 * studio**, and it is pure so that can be pinned without standing up a store.
 *
 * ## A hero works for the whole studio from the day they arrive
 *
 * This file used to resolve six people with levels, points, reach and a
 * *placement*: a hero did nothing until the player posted them onto a unit of
 * the floor, covered only the developers under that unit, and earned XP to
 * spend on a shared skill board only while posted. It was cut on 2026-09-26 at
 * the user's instruction — *"Some mechanics in the old game I want remove, hero
 * placement, different types of hires (SRE QA ETC."* — and the board went with
 * it, because XP under coverage was the board's only currency. What a hero can
 * be upgraded with now lives in their own tree (`upgradeTrees.ts`, GDD §8).
 *
 * So every term below is at **full share**: the signature a card promises is
 * the signature the studio gets, the moment the hero is through the door.
 *
 * ## Who answers the pager and the inbox, now that nobody is hired to
 *
 * The same instruction removed §4.11's four professions, and with them the
 * only people who cleared incidents and answered tickets. Both jobs go to the
 * hero whose job it always was (the plan put to the user with the removal):
 *
 * - **Serena puts the studio on call** — {@link ONCALL_SHARE} of the headcount
 *   carries the pager, on top of the founder's diluted head.
 * - **Matt stands up a help desk** — {@link HELPDESK_SHARE} of the headcount
 *   answers tickets.
 *
 * A *share of the headcount* rather than a fixed number of heads, because both
 * loads grow with the studio (§4.12a's catalogue, §4.13's catalogue and defect
 * bench) and a flat rota would be enough at twenty and nothing at a million.
 * Before either arrives the founder carries both at `FOUNDER_ROLE_HEADS`, which
 * is what makes their arrival relief rather than a tutorial (§21.7.6).
 *
 * **Amplitude, never gate** (§13.6.7). Every multiplier here is 1, and every
 * head count 0, when nobody has arrived.
 */

import { branchColour, type HeroBranch } from './heroBranches.ts'
import { HERO_BY_ID, type HeroId, type StoryHero } from './storyHeroes.ts'

/** One hero, resolved. */
export interface HeroRuntime {
  id: HeroId
  hero: StoryHero
  branch: HeroBranch
  colour: string
}

/** A hero by id, or null for an id that is not one of the cast. */
export function heroRuntime(id: HeroId): HeroRuntime | null {
  const hero = HERO_BY_ID.get(id)
  if (!hero) return null
  return { id, hero, branch: hero.branch, colour: branchColour(hero.branch) }
}

/**
 * Serena's rota: the share of the headcount on call for incidents.
 *
 * One in fifty. §4.12a pins a garage-density release at a tenth of an incident
 * over its whole life, at 45 seconds of attention each, so a catalogue of fifty
 * live releases asks for about one head — and a studio of fifty has one on the
 * rota. First pass; the ratio wants a playtest, and it is one number rather
 * than a dial precisely so it can be tuned in one place.
 */
export const ONCALL_SHARE = 0.02

/**
 * Matt's help desk: the share of the headcount answering tickets.
 *
 * One in twenty. §4.13 prices the load at one head per ten shipped games plus
 * one per hundred defects on the bench, and the bench grows with the studio's
 * output; a twentieth keeps a thousand-person studio well ahead of both while
 * leaving a twenty-person garage with a single head, which is about when the
 * first sustained queue brings him in. First pass.
 */
export const HELPDESK_SHARE = 0.05

/**
 * Billy's FIFTEEN MINUTES: the share of the floor that keeps working through a
 * Daily Standup.
 *
 * Half rather than all. At full share the stand-up would simply stop pausing
 * anybody the day Billy arrived, which is §13.2 L1-2A's purchase handed over
 * for free — and that purchase is the Paradigm Tree's best moment.
 */
export const STANDUP_KEPT_SHARE = 0.5

/** What the studio gets from the heroes who have arrived. */
export interface HeroFold {
  /** Multiplies §4.2's developer cap. Above 1 is an improvement. Melany. */
  cap: number
  /** Multiplies §4.12's defect arrival rate. Below 1 is an improvement. Mo. */
  defects: number
  /** Work a newly opened incident needs, as a fraction of normal. Serena. */
  incidentStartWork: number
  /** §4.12a — heads clearing incidents, additive. Serena's rota. */
  oncallHeads: number
  /** Multiplies ticket arrivals from the catalogue. Matt. */
  ticketRate: number
  /** §4.13 — heads answering tickets, additive. Matt's help desk. */
  supportHeads: number
  /** Coding heads the Daily Standups do not pause. James and Billy. */
  standupHeads: number
  /** Reserved-capacity operating cost, dollars per second. Melany. */
  operatingCost: number
}

/** The studio with nobody through the door. §13.6.7 — "heroes are amplitude, not gate". */
export const NO_HERO_FOLD: HeroFold = {
  cap: 1,
  defects: 1,
  incidentStartWork: 1,
  oncallHeads: 0,
  ticketRate: 1,
  supportHeads: 0,
  standupHeads: 0,
  operatingCost: 0,
}

/**
 * Fold every arrived hero into one set of studio terms.
 *
 * Each case is the sentence on that hero's card (`storyHeroes.ts`), and the
 * card is written from this switch rather than the other way round: a card
 * that promised something this function did not do would be the interface
 * telling a lie the simulation is not (§10.6).
 */
export function heroFold(heroes: readonly HeroRuntime[], totalDevs: number): HeroFold {
  const devs = Number.isFinite(totalDevs) ? Math.max(0, Math.floor(totalDevs)) : 0
  const out: HeroFold = { ...NO_HERO_FOLD }

  for (const { id } of heroes) {
    switch (id) {
      case 'james':
        // FEWER COMMITMENTS — one person keeps typing through stand-up.
        out.standupHeads += 1
        break
      case 'mo':
        // READS IT TWICE — half as many defects written.
        out.defects *= 0.5
        break
      case 'serena':
        // WROTE THE RUNBOOK — a page starts half worked, and the floor is on call.
        out.incidentStartWork *= 0.5
        out.oncallHeads += ONCALL_SHARE * devs
        break
      case 'matt':
        // KNOWS THEIR NAMES — the catalogue asks a fifth fewer questions, and
        // somebody is at the desk to answer the rest.
        out.ticketRate *= 0.8
        out.supportHeads += HELPDESK_SHARE * devs
        break
      case 'melany':
        // RESERVED INSTANCES — a quarter more cap, and a dollar a developer a second.
        out.cap *= 1.25
        out.operatingCost += devs
        break
      case 'billy':
        // FIFTEEN MINUTES — half the floor keeps working through stand-up.
        out.standupHeads += STANDUP_KEPT_SHARE * devs
        break
      default:
        break
    }
  }

  return out
}

/**
 * §4.14's hero term — how much of the cast is in the building, 0..1.
 *
 * It was the share of the studio a posted hero covered. With nobody posted the
 * honest reading is the bench itself: a studio led by four of the six ships
 * better games than one led by James alone. **Divided by the cast, not by the
 * arrivals**, so the term climbs with the story instead of peaking in Act I.
 */
export function benchShare(heroes: readonly HeroRuntime[], castSize: number): number {
  const cast = Math.max(1, Math.floor(castSize))
  return Math.min(1, heroes.length / cast)
}
