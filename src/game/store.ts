/**
 * Run 1 game state — GDD §4 (production), §6 (the trap), §21 (the script).
 *
 * A tiny external store rather than a state library: GDD §23.2 non-negotiable 3
 * fixes the DOM/canvas boundary and requires that "game state lives in one
 * store both read from". Pixi reads it every frame; React subscribes. Adding
 * a dependency to hold twenty numbers would obscure that boundary rather than
 * clarify it.
 *
 * Scope is Run 1 only. No tech tree, no prestige beyond the button that ends
 * the run. **Save is local only** — GDD §24 decides the document and the
 * offline model, `save.ts` implements them, and `game-cloud` is a separate task
 * that needs Firebase credentials.
 */

import Decimal from 'break_infinity.js'
import { quote, type Multiplier, type Quote } from '../sim/hireDial.ts'
import { developerAt, type Identity } from '../sim/identity.ts'
import { outputShare, shareSum } from '../sim/aggregate.ts'
import { outputClass, type OutputClass } from '../sim/output.ts'
import {
  UNKNOWN_ORDINAL,
  advanceTail,
  catalogueIncome,
  catalogueOutstanding,
  rollShape,
  type Release,
} from '../sim/revenue.ts'
import {
  emptyHistory,
  nextOrdinal,
  recordRelease,
  type History,
  type ReleaseRecord,
} from '../sim/history.ts'
import { lessonFor, ledgerWith } from './lessons.ts'
import type { ShiftReport } from './paradigmBoot.ts'
import { advanceDefects, defectsFromPoke, shipDefects } from '../sim/defects.ts'
import {
  advanceIncidents,
  clearanceCapacity,
  incidentRate,
  suppressedReleases,
  type Incident,
} from '../sim/incidents.ts'
import { advanceTickets, catalogueMultiplier, serviceRatio } from '../sim/support.ts'
import {
  BASELINE_RATING,
  LAUNCH_NEUTRAL,
  LUCK_NEUTRAL,
  RATING_WEIGHTS,
  luckRoll,
  traitScore,
  DEFECT_DENSITY_ANCHOR,
  advanceReputation,
  prestigeMultiplier,
  rateRelease,
  reputationMultiplier,
  revenueMultiplier,
} from '../sim/rating.ts'
import {
  TRAIN_LAUNCH,
  launchScore,
  pipelineLaunch,
  type LaunchOutcome,
  type ReadinessStage,
} from '../sim/release.ts'
import {
  PIPELINE_BY_ID,
  pipelineCost,
  pipelineEffects,
  pipelineLevel,
  pipelineRefusal,
  type PipelineEffects,
  type PipelineRefusal,
} from '../sim/pipeline.ts'
import { titleFor, type Genre } from '../three/sim/titles.ts'
import { eraIndex } from '../sim/eras.ts'
import {
  TREES,
  TREE_HEROES,
  levelOf,
  tileStateOf,
  treeKey,
  treeNode,
  treePrice,
  treeRefusal,
  type TileState,
  type TreeHero,
  type TreeRefusal,
  type TreeView,
} from '../sim/upgradeTrees.ts'
import {
  NODE_BY_ID,
  bpFor,
  canAfford,
  chainedPokeRows,
  devCapFor,
  meetingBanActive,
  nodeCost,
  zeroTrustActive,
} from '../sim/prestige.ts'
import {
  BANKRUPTCY_THRESHOLD,
  FIRST_PAID_RUNG,
  hireCost,
  massHireCost,
  STARTING_DEVS,
  capAdjustedGrowth,
  isBankrupt,
  payrollPerSecond,
  projectRevenue,
  TARGET_BUILD_SECONDS,
} from '../sim/economy.ts'
import {
  D_BASE,
  SP_PER_DEV_PER_SEC,
  decayLocalEntropy,
  devEfficiency,
  efficiency,
} from '../sim/entropy.ts'
import {
  FOUNDER_ROLE_HEADS,
  MANAGEMENT_DILUTION,
  NO_FOUNDER,
  type FounderEffects,
} from '../sim/founder.ts'
import {
  inStandup,
  standupFactor,
  techEffects,
  type TechEffects,
} from '../sim/techTree.ts'
import {
  advanceDevState,
  initialDevState,
  pokeDevState,
  type DevStateMachine,
} from '../sim/devStates.ts'
import {
  advanceSlack,
  awayHeads,
  awayShare,
  dropSlacker,
  emptySlack,
  isAway,
  liftSlacker,
  pokeHome,
  type SlackState,
} from '../sim/slackOff.ts'
import { jamesRefusal } from './chatter.ts'
import { rungCrossed, spawnBurst, type Rung } from '../sim/headcount.ts'
import { WORLD_CAP, worldsFor } from '../sim/starfield.ts'
import { interstellarSync, meanLagLy } from '../sim/starbound.ts'
import { SnippetBag } from './snippets.ts'
import {
  INITIAL_TOUCH_MODE,
  toggleTouch,
  type TouchLatch,
  type TouchMode,
} from './touchMode.ts'
import {
  SCENE_JAMES_ARRIVES,
  SCENE_JAMES_SHIP,
  SCENE_JAMES_INSTANT_MESSENGER,
  SCENE_MASS_HIRE,
} from './scenes.ts'
import {
  SCENE_BILLY_ARRIVES,
  SCENE_FOUNDER_BOARD,
  SCENE_JAMES_PROMOTED,
  SCENE_JAMES_PROXIMA,
  SCENE_MATT_ARRIVES,
  SCENE_MELANY_ARRIVES,
  SCENE_MO_ARRIVES,
  SCENE_SERENA_ARRIVES,
} from './scenes.ts'
import {
  SYNC_HALVED,
  arrivalPredicate,
  founderBoardArrives,
  jamesPromoted,
  type BoardSnapshot,
  type StorySnapshot,
} from './storyTriggers.ts'
import {
  ageEvent,
  beginEvent,
  clearOne,
  definitionOf,
  eventCeiling,
  eventDue,
  retiredMilestone,
  routeEvent,
  type LiveEvent,
} from '../sim/events.ts'
import { ARRIVAL_HEROES, STORY_HEROES, type HeroId } from '../sim/storyHeroes.ts'
import { GARAGE_SYNC, teamSync, type ServiceLoad } from '../sim/teamSync.ts'
import {
  NO_HERO_FOLD,
  benchShare,
  heroFold,
  heroRuntime,
  type HeroFold,
  type HeroRuntime,
} from '../sim/heroRoster.ts'
import { unlocksFor, type Unlocks } from './unlocks.ts'
import type { DevState, ZoomLevel } from '../sim/poke.ts'
import { resolvePoke } from '../sim/poke.ts'
import { BUFF_TAU, addBuff, buffLift, decayBuffs, strengthOnSeat, type Buff } from '../sim/buffs.ts'
import { unitSeats, unitSizeAt } from '../sim/units.ts'
import {
  ACT1_POKES_REQUIRED,
  MASS_HIRE_COUNT,
  SEED_ROUND_CASH,
  TERM_SHEET_AFTER_SHIPS,
  REBUKE_LINE,
  advanceOnboarding,
  shouldRebuke,
  type Phase,
} from './onboarding.ts'
import { jamesPresent } from '../sim/james.ts'
import {
  NODE_CI_CD_AUTOPILOT,
  offlineCapSeconds,
  offlineRateMultiplier,
  offlineYield,
  type OfflineReport,
} from '../sim/offline.ts'
import {
  clearSave,
  emptyPermanent,
  getPermanent,
  makeSaveData,
  paradigmShiftPermanent,
  readSave,
  setPermanent,
  toDecimal,
  writeSave,
} from './save.ts'
import { DEBUG_TOOLS_ENABLED } from '../dev/debugAccess.ts'

/**
 * The Run 1 project ladder — GDD §5, Era 1.
 *
 * *Flappy Square 1.0* used to be 1,000 SP because §21 Act I said so, and at
 * the 1 SP/sec baseline that is exactly the 0.1%/sec fill rate the script
 * states. Resized to 300 on 2026-08-14: at that baseline 1,000 SP is a quarter
 * of an hour of uninterrupted thumb, and Act I hands the player a half-rate
 * founder and one unpaid friend to do it with. The teaching project exists to
 * sell the clicker layer, not to survive it — the old 1,000 put the hardest
 * climb of the whole run first, when the studio is smallest, and made the
 * ladder open **1,000 → 400**, which is backwards before it is anything else.
 * At 300 the ladder is monotonic — **300 → 400 → 1,000 → 4,000** — and the
 * first ship lands after about a minute of poking, James arriving a quarter of
 * the way in.
 *
 * Everything after it was resized on 2026-08-07 for §21.0's Act IIa loop. The
 * old ladder climbed 1,000 → 2,500 → 8,000, which was written for Act I's pace
 * and not for a loop that turns over four times: simulated, it put Run 1 at
 * **11.4 minutes and still only reached 36 developers**, because each project
 * grew faster than velocity did. Sized against the headcount the player
 * actually has when they reach each one, the same loop hits 40 developers in
 * **6.1 minutes** with a treasury left to gamble.
 *
 * The names still escalate in ambition while the commitments do not, which is
 * its own joke about scope.
 */
/**
 * The Run 1 ladder — GDD §4.10c.
 *
 * `payout` is authored per project rather than derived from `commitment`,
 * because **revenue per Story Point is not a constant of the universe, it is a
 * fact about your studio's reputation.** A flat $/SP was §4.10's first
 * assumption and it made the game unplayable from three developers onward: the
 * cost of a Story Point is `wage × (n−2)/n`, which climbs toward $50 and stays
 * there, so a flat $0.05/SP is six hundred times underwater at n = 5.
 *
 * The rule the ladder has to satisfy is short enough to state exactly, and
 * §4.10c derives it: profit per second is `n·r − n·W + 2·W`, so
 *
 *     d(profit)/dn = r − W
 *
 * **Hiring pays if and only if revenue per Story Point exceeds the wage per
 * developer per second.** Every payout below is chosen against that one line.
 *
 * *Flappy Square 1.0* keeps its $50 (§21 Act II states it) and is therefore
 * catastrophically below the line — which is not a flaw but the best detail in
 * the table: **your first game would have lost money the instant you hired
 * anybody.** It only turns a profit because you and James are not paid.
 *
 * ## Why the ladder has eight rungs and not four — §4.10f
 *
 * It had four, and the first step was **×500**: fifty dollars, then twenty-five
 * thousand. That was reported as nonsense and the report was half right.
 *
 * It is not arbitrary — it is *forced*. Two numbers are canon (§21 Act II's $50
 * game, §21 Act V's $50/dev/sec wage) and the rule above says every rung the
 * player hires against must clear the wage. A 300-point game worth $50 and a
 * 400-point game that must beat $50/SP are $20,000 apart by arithmetic, and no
 * amount of taste closes that.
 *
 * **What was actually wrong is that the rule was applied one rung too early.**
 * `d(profit)/dn = r − W` only binds where there is an `n` to differentiate: the
 * player pays nobody in Run 1 at all (§21.0e — the hire control is never offered
 * in it), and every rung below {@link FIRST_PAID_RUNG} is garage work. Those are
 * free to sit **below** the wage line — and putting them there is what turns the
 * cliff into an escalation. §4.10h raises the rungs *above* it further still, so
 * that clearing the wage means clearing it by `WAGE_HEADROOM` rather than by a
 * hair — see `economy.ts` for the measurement that forced it.
 *
 * The escalation is also the better joke. You do not ship one game and then a
 * game worth five hundred times more; you ship *the same game three times*,
 * bolting a monetisation feature on each time, and the studio learns to charge
 * for things before it learns to hire. The wage line is crossed at rung 3, and
 * that crossing is the moment hiring starts paying — which is a fact the player
 * can feel rather than a threshold in a comment.
 */
export const PROJECTS = [
  // --- the garage. Two unpaid founders, so `r` may sit below the wage. ---
  // r = $0.17/SP. The joke, and a loss-maker the moment payroll starts.
  { name: 'Flappy Square 1.0', commitment: 300, payout: 50 },
  // r = $7.50/SP. Still underwater, and now it is underwater on purpose.
  { name: 'Flappy Square 1.1 (Now With Ads)', commitment: 200, payout: 1_500 },
  // r = $40/SP. Close enough to the line that hiring here is *nearly* right,
  // which is the last cheap lesson before §6 charges for one.
  { name: 'Flappy Square 2.0 (Now With A Battle Pass)', commitment: 300, payout: 12_000 },

  // --- the studio. Every rung from here clears WAGE_HEADROOM x $50/SP. ---
  //
  // **Commitments climb by about half again, not by triples.** The first draft of
  // this half of the ladder went 600 → 1,200 → 4,000 → 12,000 → 40,000, sized by
  // how big the *games* ought to feel, and measured it put the early loop at
  // **300 seconds a ship against §4.4's sixty-second target**: a studio running
  // at 40 SP/s spends five minutes on a twelve-thousand-point game while §4.10d's
  // payroll runs the whole time, so every run in the table ended between −$320K
  // and −$450K, which in turn made §13.7.1's tree unaffordable and turned §4.1's
  // wall into §4.10a's. A rung is sized by whether the studio that reaches it can
  // *finish* it; the payout ladder carries the sense of scale instead.
  //
  // r = $216.67/SP. **The first rung that pays a salary** — see FIRST_PAID_RUNG.
  //
  // §4.10h re-priced this half of the ladder on 2026-08-27. It read $63.30/SP,
  // which clears the $50 wage and clears it by nothing: a studio hired to §4.1's
  // own optimum was *losing money there*, so the readout was telling the player
  // to stand exactly where the treasury died. Every rung from here now clears
  // WAGE_HEADROOM x W, which is what moves the wall back off §4.1's shoulder.
  { name: 'Untitled Roguelike Deckbuilder', commitment: 600, payout: 130_000 },
  // r = $277.78/SP.
  { name: 'Cozy Farming Sim With A Dark Secret', commitment: 900, payout: 250_000 },
  // r = $357.14/SP.
  { name: 'Open-World Survival Craft (Early Access)', commitment: 1_400, payout: 500_000 },
  // r = $454.55/SP.
  { name: 'Live-Service Hero Shooter', commitment: 2_200, payout: 1_000_000 },
  // r = $743/SP. The ladder's terminal rung — `maxProjectIndex` repeats it, so
  // this is the rate the studio runs at for the rest of the run, and §4.4 grows
  // its commitment with the velocity that shipped the last one.
  { name: 'Untitled Roguelike Deckbuilder II', commitment: 3_500, payout: 2_600_000 },
] as const

/**
 * What the garage catalogue pays, all in — §21.0e.
 *
 * Every rung below {@link FIRST_PAID_RUNG}, summed — the *authored* total, not
 * the realised one: §4.10e pays on a tail, so a run standing at the term sheet
 * is still collecting the last of it. It is what Run 1 arrives at the term sheet
 * holding, near enough, and therefore roughly a fifth of what the Mass Hire
 * costs; `jumpToPhase` uses it so the `?act=` seams land on a treasury the run
 * could actually have, rather than on a round number chosen for a screenshot.
 *
 * Derived rather than written down, because the ladder is re-priced from time to
 * time (§4.10h did it on 2026-08-27) and a literal here would be a second place
 * that has to be remembered.
 */
export const GARAGE_CATALOGUE_CASH = PROJECTS.slice(0, FIRST_PAID_RUNG).reduce(
  (sum, p) => sum + p.payout,
  0,
)


export interface FloatingNumeral {
  id: number
  sp: number
  x: number
  y: number
  crit: boolean
  bornAt: number
  /**
   * GDD §8.2a — the line of code the poke knocked loose. Null for an
   * Overwhelmed developer, who has nothing to say.
   */
  snippet: string | null
  /**
   * GDD §25.1, R11 — this poke was worth zero points **and that was the point**.
   *
   * §4.7 sets an Overwhelmed developer's multiplier to exactly 0: "the poke's
   * value is clearing their lockup, not the points". The maths is right and
   * the readout was wrong — a numeral saying `+0` is indistinguishable from a
   * broken button, and it was reported as one.
   *
   * Set here rather than inferred from `sp === 0` downstream, because there is
   * a second way to reach zero — §4.1's Entropy Lock taxes every poke to
   * nothing — and telling the player they *unblocked* somebody when the whole
   * studio is seized would be a worse lie than the one being fixed.
   */
  unblocked: boolean
}

/** Shared by simulation expiry and render motion so a floater fades before removal. */
export const FLOATER_LIFE_MS = 1000

/**
 * GDD §7.7.2–7.7.3 — one hire, as the renderer needs to see it.
 *
 * The store publishes the *ratio-scaled* body count rather than the raw number
 * hired, because §7.7 is explicit that the raw number is the thing that stops
 * being a feeling: at 10¹² a hire of 10⁹ is 0.1%, and the picture has to say so.
 */
export interface SpawnEvent {
  id: number
  /**
   * §7.7.3 arrival weight — {@link spawnBurst}, 1..120.
   *
   * The *spectacle* size, for tiers where one sprite is not one person. It is
   * emphatically **not** how many developers arrived, and using it as though it
   * were is what made every early hire drop a body onto the founder's head:
   * §7.7.3 scales it by the ratio, so the hire that takes a studio from one
   * developer to two is worth twelve bodies. Anything that lands on a *seat*
   * wants {@link from} and {@link to} instead.
   */
  bodies: number
  /** First seat index this hire filled, inclusive. */
  from: number
  /** Last seat index this hire filled, exclusive. */
  to: number
  /** Set when this hire crossed a §7.7.1 rung — a scored §7.7.2 construction gag. */
  promotedTo: Rung | null
  bornAt: number
}

/** A transient line over the developer's head. */
export interface Bubble {
  text: string
  bornAt: number
  /** ms. Rebukes linger; ordinary chatter does not. */
  ttl: number
}

export interface GameState {
  devs: number
  devCap: number

  cash: number
  projectIndex: number
  sprintName: string
  commitment: Decimal
  burned: Decimal
  projectsShipped: number
  lifetimeRevenue: number

  localEntropy: number
  dev: DevStateMachine
  /**
   * §7.8.9 — who is away from their desk right now, and what it is costing.
   *
   * Run state, and **deliberately not persisted**: `dev` is not either, for the
   * same reason. Where forty people happen to be standing at the moment the tab
   * closed is not something a reload has any business restoring, and a save
   * that carried it would restore an output penalty the player cannot see the
   * cause of until the room has drawn a frame.
   */
  slack: SlackState
  hasCultureUpgrade: boolean

  tier: number
  zoom: ZoomLevel
  /**
   * §7.7.1 — the rung the camera is parked on. See {@link setCameraRung}.
   *
   * Run state and not persisted: it is where the lens happens to be pointing,
   * which a reload has no business restoring.
   */
  cameraRung: number

  floaters: FloatingNumeral[]
  bubble: Bubble | null
  /** GDD §7.7 — the most recent hire, for the renderer's spawn puff. */
  spawn: SpawnEvent | null

  pokeCount: number
  /** Taps made while the studio is locked — drives the §6.3 rebuke. */
  desperateTaps: number

  phase: Phase
  /** Set once, so the collapse beat only fires its camera kick a single time. */
  massHired: boolean
  /** §10.10 — the hire dial's selection. Persists; a player who chose MAX meant it. */
  hireMultiplier: Multiplier
  /**
   * Story Points per second currently coming from the *thumb* — §10.1.
   *
   * A decaying rate estimate rather than a counter, so it converges on the true
   * poking rate and falls away when the player stops. Display only: `tick`
   * banks poke SP at the moment of the poke, so including this in the
   * simulation's own velocity would pay for every tap twice.
   */
  pokeRate: number
  /**
   * §4.5a — the units the player has recently poked, and by how much.
   *
   * **The per-employee state §4.5a says there is no way around**, kept as a
   * sparse decaying overlay rather than a table: a studio of ten trillion
   * carries at most `MAX_BUFFS` small objects and usually none. Unlike
   * `pokeRate` this is *not* display only — it is a real change to the rate,
   * and `tick` integrates it.
   *
   * §24.2 ephemeral, alongside `localEntropy` and `floaters`. A buff's whole
   * life is fifteen seconds; carrying one across a reload would mean restoring a
   * state the player cannot see the cause of.
   */
  buffs: Buff[]
  /**
   * §7.8.7 — the seed every developer's name, face and stats are generated
   * from. One integer stands in for the entire roster.
   *
   * Part of the *run*, not of permanent state, so a Paradigm Shift returns a
   * different studio with the same James in it (§21.6). Persisted, because a
   * reload that reshuffled forty faces would undo the whole point of them.
   */
  runSeed: number
  /**
   * §14.1 — the highest headcount this run reached.
   *
   * Tracked rather than read off `devs` at shift time, because Act V ends with
   * a bankruptcy that has already liquidated the swarm: a player who peaked at
   * a thousand and prestiges at two must be paid for the thousand.
   */
  peakDevs: number
  /**
   * The last project to ship, and how it was received — §10.8a, §10.8b.
   *
   * Held as an *event* with an id rather than as a flag, so the renderer and
   * the HUD can both notice it exactly once. Shipping is the loop's payoff and
   * it was completely silent: the burn-down reset, the cash readout stepped up,
   * and nothing marked the moment. A player in Act I could ship their first
   * project without realising they had.
   *
   * `revenue` is carried for the simulation's own use — §22.5's counters and
   * the save both read it — and **not for the celebration**: §10.8b took the
   * money off the toast on purpose and the reason is written there. What the
   * beat reads is `rating`, `ordinal` and `timing`.
   */
  ship: {
    id: number
    name: string
    revenue: number
    at: number
    /** §4.14's score, so the review reel does not have to go looking for it. */
    rating: number
    /** §10.11's career ordinal, so the reviews are the same on every replay. */
    ordinal: number
    /** §10.7 — what the launch date was worth, ×1 when nobody attended. */
    timing: number
    /** §10.7's band label, or null for a release nobody attended. */
    timingLabel: string | null
    /** §10.7 — the stage it went out at (GOLD, RC…), or null when nobody attended. */
    stage: ReadinessStage | null
  } | null
  /**
   * §10.7 [amended 2026-10-04] — **the build queue**: finished builds waiting for
   * SHIP!, oldest first. A finished project lands here at once — there is no Build
   * and no Test any more (`sim/pipeline.ts` has the argument) — and the queue is
   * the one capacity that stops the studio when it is full. Run state and
   * persisted: unlike the old window it is not derivable, it is work.
   */
  shelf: ShelvedBuild[]
  /**
   * §10.7 — Serena's pipeline board, levels by node id (`sim/pipeline.ts`).
   * Run state, like §11's tree: a Paradigm Shift liquidates the studio and the
   * machines it built on.
   */
  pipelineNodes: Record<string, number>
  /**
   * §8 [2026-09-26] — levels bought on the five isometric trees' *unwired*
   * nodes, keyed `hero:id` (`sim/upgradeTrees.ts`). Serena's pipeline nodes are
   * not here: they are {@link pipelineNodes}, and her tree reads them. Run
   * state, as the pipeline's is. These buy nothing yet — the trees came over
   * visual first, ahead of the economy they will price against.
   */
  treeLevels: Record<string, number>
  /** §10.7 — seconds banked towards the next auto-ship. */
  autoShipClock: number
  /**
   * §10.7 — the release ring is open for the shelf's head.
   *
   * The studio is at the launch, so the clock is stopped, on exactly §10.7a.3's
   * terms for a scene: the player is being asked for a decision, and a decision
   * made while payroll drains is made under a clock they did not agree to.
   * Ephemeral (§24.2): a reload lands on the floor with the build still on the
   * shelf, which is where it was.
   */
  launching: boolean
  /**
   * §4.10e — the back catalogue. Every game still earning, and what it has
   * paid so far.
   *
   * Run state, not permanent: a Paradigm Shift liquidates the studio and its
   * catalogue with it. Persisted, because a reload that wiped five shipped
   * games would take the player's runway with it and look exactly like the
   * bug §4.10d was reported as.
   */
  releases: Release[]

  /** §21.0a — the term sheet has been signed. Grants cash and the dial. */
  seedTaken: boolean
  /**
   * §7.8.8 — the selected developer's seat index, or null.
   *
   * A seat, not an identity. The identity is generated from it on demand
   * (§7.8.7), so selection costs one integer and survives a rebuild.
   */
  selected: number | null
  /**
   * §7.7.6b — what a tap on the room means: poke, grab, or check.
   *
   * Ephemeral, and deliberately not saved. It is an input *mode*, and a mode
   * restored from a previous session is a control the player did not set
   * looking exactly like a game that has stopped responding — you tap a
   * developer, no numeral appears, and nothing on screen explains why until you
   * find the switch. Every session opens on {@link INITIAL_TOUCH_MODE}.
   */
  touchMode: TouchMode
  /**
   * §10.10.2 — is the hire dial available?
   *
   * Gated on the Seed Round rather than on a headcount. A capability that
   * arrives because the player earned an event is a reward; one that arrives
   * because a counter crossed 25 is a surprise, and the earlier draft was the
   * latter. Outside Run 1 this is simply true from the first frame — the funnel
   * is a first-run device and re-teaching it is an insult.
   */
  dialUnlocked: boolean

  /**
   * GDD §24.8 — the Overnight Build Report waiting to be shown, or null.
   *
   * The store owns the numbers; the HUD owns the screen. Ephemeral (§24.2):
   * never serialised, recomputed from `savedAt` on every load.
   */
  pendingOffline: OfflineReport | null
  /**
   * The §21.6-class scene currently on screen, or null.
   *
   * Only the id lives in state; the script is looked up from `SCENES`. Keeping
   * the lines out of the store means a scene cannot end up in the save
   * document, where it would be a copy of the script frozen at whatever
   * revision the player last played.
   */
  scene: string | null

  /**
   * §18.0 — the event on the floor, or null.
   *
   * **Persisted, like an incident and unlike a buff.** §24.2's test is whether
   * the thing is a state of the world or a fading effect: an event holds the
   * studio's output down until somebody does something about it, and a reload
   * that quietly cleared it would be a reload that repaired the company. It
   * also carries the player's choice of exit (`routed`), so a reload cannot put
   * a modal back over somebody who had already decided.
   */
  event: LiveEvent | null

  /**
   * §4.12 — defects on the bench, for the project currently being built.
   *
   * Run state. Reset to zero on ship, because shipping does not forgive the
   * backlog: it **transfers** it to the release as a density, where §4.12a
   * charges it forever. Anyone tempted to make this persist across a ship has
   * confused the two sections.
   */
  defects: number
  /**
   * §4.12a — open incidents, one per downed release, oldest first.
   *
   * Persisted rather than ephemeral, unlike §4.5a's buffs: an incident is a
   * *state of the world* rather than a fading effect, its release is frozen
   * while it is open, and a reload that quietly cleared them would be a reload
   * that repaired the studio.
   */
  incidents: Incident[]
  /**
   * The fractional part of §4.12a's arrival, carried between ticks.
   *
   * Without it an arrival rate of 0.3/s raises nothing at all at 60 fps,
   * because every individual step floors to zero. Ephemeral — at most one
   * incident's worth, and restoring it would be restoring a state the player
   * cannot see the cause of.
   */
  incidentPending: number
  /**
   * §22.8's branch effects, folded — the multipliers the simulation reads.
   *
   * **Ephemeral and derived** (§24.2): never serialised, recomputed by
   * {@link refreshHeroFold} whenever somebody arrives or the headcount moves. It is on the state rather than behind a function because
   * `effectiveDevCap` and `currentEfficiency` are on the hot path — resolving
   * six heroes, their levels and their coverage inside a getter that `tick`
   * calls a dozen times a frame would allocate a few thousand objects a second
   * to answer a question whose answer changes about six times a run.
   */
  heroFold: HeroFold
  /**
   * §22.9 — whose card is open, or null.
   *
   * A separate channel from {@link GameState.selected} and not a second way of
   * saying the same thing: `selected` is a *seat*, and §7.8.8 generates the
   * person at it. A hero is a person first and always has a physical desk in
   * §7.8.12's room.
   *
   * Ephemeral, like `selected`: a card restored from a previous session is a
   * panel the player did not open.
   */
  selectedHero: HeroId | null
  /** §4.13 — tickets waiting. Never reaches zero for long, and never can. */
  tickets: number
  /**
   * §21.7.3, Matt — seconds the ticket queue has gone unanswered. Ephemeral
   * (§24.2): it is a *sustained* condition the trigger needs, and restoring a
   * clock the player cannot see the cause of would be a mystery.
   */
  ticketsUnservedFor: number
  /**
   * §21.7.3, Billy — seconds §4.1's sync has been at or below half.
   *
   * The second of this file's two sustained-condition clocks, and it exists for
   * the same reason `ticketsUnservedFor` does: the trigger is about a studio
   * that is *stuck*, and a threshold can only describe a studio that is
   * *passing*. §21.7.3's "nothing here needs a new counter" is a rule about not
   * inventing new **systems** to trigger off, not about refusing to time the
   * ones already on screen — this times §4.3's gauge, which is the most
   * looked-at readout in the game.
   *
   * Ephemeral (§24.2), like Matt's: restoring a clock whose cause the player
   * cannot see would make the scene arrive out of nowhere on the first frame
   * after a reload.
   */
  syncHalvedFor: number
  /**
   * §4.14 — a slow-moving average of recent ratings.
   *
   * Run state, and that is a decision rather than an oversight: reputation is
   * a fact about *this studio*, and §13.2 liquidates the studio at a Paradigm
   * Shift. Carrying it across would make the first release of Run 9 be judged
   * on games built in a universe that no longer exists.
   */
  reputation: number

  /**
   * §10.11 — the gallery: every game this studio has shipped, and what it did.
   *
   * **Run state** [moved here 2026-08-27]. It lived in `PermanentSave.meta` and
   * survived a shift, on the argument that §13.2 liquidates money and not
   * memory. Reported as "galleries should not persist across paradigm shifts",
   * and the report is right for the same reason `reputation` above is run state:
   * the gallery is not a trophy cabinet, it is **the catalogue this studio is
   * selling**. Its tails, its ratings and its ticket queues are all liquidated
   * by the shift, and a wall of games with none of those attached is a wall of
   * games from a reality that no longer exists.
   *
   * `freshRun()` starts an empty one, so the clearing is not a special case in
   * `triggerParadigmShift` — it is what starting a run means. §15.1a's cut scene
   * is where the catalogue that just ended is accounted for.
   */
  history: History

  /**
   * §15.1a — the receipt for the reality that just ended, or null.
   *
   * Set by {@link triggerParadigmShift} and cleared when the player taps through
   * the cut scene. Run state so that a shift's own `set` can carry it, and
   * **deliberately absent from `RunSave`**: a reload mid-cut-scene should put the
   * player in their new studio rather than replaying an interstitial about a run
   * that is already over.
   */
  pendingShift: ShiftReport | null

  /**
   * §21.8 — the launch is on screen.
   *
   * Set when {@link SCENE_JAMES_PROXIMA} is tapped through and cleared when the
   * nine shots have played. A flag rather than a report, because unlike
   * §15.1a's reboot there is nothing to account for: the scene is the argument
   * and the sequence is the consequence, and neither of them reads a number.
   *
   * Run state and **deliberately absent from `RunSave`**, on `pendingShift`'s
   * rule: a reload mid-interstitial should put the player in their studio, not
   * replay a cut scene about a thing that has already happened. The permanent
   * `milestones` union is what remembers it happened.
   */
  pendingLaunch: boolean

  /**
   * Seconds of simulated time since this run began — §11.2 B2's meeting clock.
   *
   * Wall-clock elapsed would drift from the simulation every time the tab was
   * backgrounded or a frame was long, and §24's offline resolution advances the
   * economy without advancing `performance.now()`. This counts the same seconds
   * the studio was actually paid for, so a meeting cannot happen while nobody
   * is working.
   */
  runSeconds: number
  /**
   * §10.11 — simulated seconds spent on the current project.
   *
   * Advanced with the simulation clock (§10.7a.3 pauses it with everything
   * else), so "dev time elapsed" is the same seconds the studio was actually
   * paid for. Resets on ship; the shipped figure is copied into the history
   * record. Ephemeral (§24.2) — a reload mid-project restarts the clock on the
   * one project that is still in flight, which under-reports a few minutes at
   * most and never rewrites a shipped game's record.
   */
  projectSeconds: number
  /**
   * §10.11.2 — ∫ headcount dt over the current project, in seconds.
   *
   * The *labour* figure, integrated from the raw headcount rather than the
   * working headcount and deliberately **not** divided by efficiency: §10.11.2
   * is explicit that labour is "headcount integrated over build time, and it is
   * NOT divided by efficiency" — the receipt the player paid for, not the work
   * that was useful. Resets on ship, like {@link projectSeconds}.
   */
  projectLabourSeconds: number
  /**
   * §4.14 — ∫ η_dev dt over the current project, in seconds.
   *
   * The **other** integral, and deliberately the mirror image of
   * {@link projectLabourSeconds}: labour is headcount *not* divided by
   * efficiency, and this is efficiency with the headcount divided out. Together
   * they say what the project cost and how well the company was working while it
   * cost it, which are the two halves `teamSync.ts` needs and neither of which
   * can be recovered from the other.
   *
   * Integrated rather than sampled at ship, and `teamSync.ts` explains why at
   * length: an instant reading would let a studio spend four minutes at 40%
   * efficiency, hire a Cloud hero on the final frame, and be scored as though it
   * had been organised the whole time.
   *
   * Ephemeral (§24.2) and resets on ship, on exactly the rule
   * {@link projectSeconds} follows — it is the numerator of a ratio whose
   * denominator is also ephemeral, so the two can only ever disagree by being
   * restored separately.
   */
  projectFlowSeconds: number
}

/**
 * The Sprint Commitment of the nth project, clamped to the ladder's end.
 *
 * Exported because §24.6's offline chain-shipping walks it, and it must be the
 * same walk the live game does or an absence and a session disagree about what
 * project the player is on.
 */
export function commitmentFor(index: number, s: GameState = state): Decimal {
  const i = Math.max(0, Math.floor(index))
  const terminal = PROJECTS.length - 1
  const base = new Decimal(PROJECTS[Math.min(i, terminal)].commitment)
  // §4.4 — the authored rungs are the authored rungs, and **the terminal one
  // grows**, because `shipProject` clamps the index there and PROJECTS calls it
  // "the rate the studio runs at for the rest of the run".
  //
  // Sized by the velocity the studio *has*, floored at the authored figure, so a
  // game takes about `TARGET_BUILD_SECONDS` to build at every scale instead of
  // shipping every six seconds. `projectScale` records the two sizings that were
  // tried first and why the cap was the worse of them.
  if (i < terminal) return base
  // The unblocked rate: §10.7's full buffer stops the floor, and a jam must not
  // also shrink the next game (the rebuild's `nextProjectFloor` makes the same
  // argument).
  const wanted = structuralVelocity(s) * buffMultiplier(s) * TARGET_BUILD_SECONDS
  return wanted > base.toNumber() ? new Decimal(wanted) : base
}

/**
 * The three fields that name the game a run opens on — §4.10f.
 *
 * Returned together rather than set field by field because they are one fact
 * said three ways, and a `projectIndex` that disagrees with the `commitment`
 * beside it is a burn-down chart counting toward the wrong number.
 *
 * **It is the garage, on every run** [amended 2026-08-27]. This used to read the
 * career's shift count through `openingRung` and open each later run part-way up
 * the ladder. The argument for it was a good one and it lost to a louder one —
 * §4.10f carries both, and the retired function's own note is in `economy.ts`.
 */
function openingProject(seed: number): Pick<GameState, 'projectIndex' | 'sprintName' | 'commitment'> {
  return {
    projectIndex: 0,
    sprintName: titleFor(seed, 0).name,
    commitment: new Decimal(PROJECTS[0].commitment),
  }
}

/**
 * **What the game on the burn-down is called** — GDD §10.6.1, the rebuild's
 * title generator [ported 2026-09-26: *"Also the art and name generation on
 * the new game should be ported"*].
 *
 * The ladder's names — *Flappy Square 1.0*, *1.1 (Now With Ads)*, *2.0 (Now
 * With A Battle Pass)*, then the same deckbuilder for ever — were a good joke
 * three times and a placeholder after that. `three/sim/titles.ts` names every
 * release from `(seed, ordinal)`, so the name on the burn-down is the name the
 * shelf, the ring, the reel and the gallery all carry, and a reload cannot
 * rename a game the player has read reviews of. `PROJECTS` keeps the sizes and
 * the payouts; the names are the generator's.
 *
 * The ordinal is the history's next one *plus every build already past Code*,
 * because each of those has claimed its number (see `finishBuild`).
 */
export function projectOrdinal(s: GameState = state): number {
  return nextOrdinal(s.history) + bufferCount(s)
}

export function projectTitle(s: GameState = state): { name: string; genre: Genre } {
  return titleFor(s.runSeed, projectOrdinal(s))
}

/** How much bigger the shipped project was than §4.4's authored terminal rung. */
function shippedScale(s: GameState): number {
  return s.commitment.toNumber() / PROJECTS[PROJECTS.length - 1].commitment
}

/**
 * A new studio.
 *
 * `Date.now()` rather than `Math.random()` so a save written and reloaded in
 * the same millisecond is still the same studio, and so the value is a plain
 * integer the save format already knows how to carry.
 */
function newSeed(): number {
  return (Date.now() ^ (Date.now() >>> 9)) >>> 0
}

function freshRun(): GameState {
  const runSeed = newSeed()
  return {
    runSeed,
    // The founder is modelled separately and starts alone. The first employee
    // only exists after the player presses HIRE.
    devs: 0,
    devCap: D_BASE,
    cash: 0,
    ...openingProject(runSeed),
    burned: new Decimal(0),
    projectsShipped: 0,
    lifetimeRevenue: 0,
    localEntropy: 0,
    dev: initialDevState(),
    slack: emptySlack(),
    hasCultureUpgrade: false,
    tier: 1,
    zoom: 1,
    cameraRung: 0,
    floaters: [],
    bubble: null,
    spawn: null,
    pokeCount: 0,
    desperateTaps: 0,
    phase: 'act1_poke',
    massHired: false,
    hireMultiplier: 1,
    pokeRate: 0,
    buffs: [],
    peakDevs: 0,
    ship: null,
    // §10.7 — nothing on the belt. A run that has built nothing has nothing to
    // ship, and a new run starts on the garage's own machine.
    shelf: [],
    pipelineNodes: {},
    treeLevels: {},
    autoShipClock: 0,
    launching: false,
    releases: [],
    seedTaken: false,
    selected: null,
    touchMode: INITIAL_TOUCH_MODE,
    dialUnlocked: false,
    pendingOffline: null,
    scene: null,
    // §18.0 — a run opens with a quiet floor. An event that survived a Paradigm
    // Shift would be an event about a studio that no longer exists.
    event: null,
    // §10.11 — a new reality has shipped nothing. This one line is the whole of
    // "galleries do not persist across paradigm shifts": every path that starts
    // a run goes through here.
    history: emptyHistory(),
    // §15.1a — nothing to account for until a shift happens.
    pendingShift: null,
    pendingLaunch: false,
    runSeconds: 0,
    projectSeconds: 0,
    projectLabourSeconds: 0,
    projectFlowSeconds: 0,
    defects: 0,
    incidents: [],
    incidentPending: 0,
    tickets: 0,
    ticketsUnservedFor: 0,
    syncHalvedFor: 0,
    reputation: BASELINE_RATING,
    heroFold: NO_HERO_FOLD,
    selectedHero: null,
  }
}

let state: GameState = freshRun()
const listeners = new Set<() => void>()
let nextFloaterId = 1
let nextSpawnId = 1

/**
 * GDD §8.2a. Module-level rather than per-poke so the shuffle bag persists —
 * a bag rebuilt on every tap would be an independent random draw, which is the
 * thing it exists not to be.
 */
const snippets = new SnippetBag()

let nextShipId = 1
/** §4.10e — one id per game put on sale, so the graph can key its bands. */
let nextReleaseId = 1
/** §10.7 — one id per finished build, so the belt and the ring can key on it. */
let nextBuildId = 1
/** §4.12a — one id per page, so §4.15's chip stack can key and animate them. */
let nextIncidentId = 1

/**
 * §4.12a — every release's shipped defect density, keyed by release id.
 *
 * Built per frame rather than cached, and that is a deliberate non-optimisation:
 * §4.10e retires a release after four minutes, so the catalogue is bounded at a
 * few dozen entries however long the session runs. A cache here would be a
 * second copy of a fact the releases already hold, invalidated on ship and on
 * retire, to save a loop over thirty objects.
 */
function densitiesOf(releases: readonly Release[]): Map<number, number> {
  const out = new Map<number, number>()
  for (const r of releases) out.set(r.id, r.defectDensity)
  return out
}

export function getState(): GameState {
  return state
}

/**
 * Test-only state injection, in the same family as `__resetStore`.
 *
 * Exists so a test can put the run in a state the *simulation* would take
 * minutes to reach — an Act III studio with an empty treasury, for instance,
 * which is a real and reachable state and a tedious one to arrive at honestly.
 * Not exported from anything the game imports.
 */
export function __setState(patch: Partial<GameState>): void {
  set(patch)
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function set(patch: Partial<GameState>): void {
  state = { ...state, ...patch }
  // Local-browser-only inspection seam, in the same family as `window.__stage`. Reading
  // the store from a console or a browser-automation session was otherwise
  // impossible, and "the HUD shows 2 but the scale bar says 1,000" is not a
  // question a screenshot can answer.
  if (DEBUG_TOOLS_ENABLED) {
    ;(globalThis as unknown as Record<string, unknown>).__store = state
  }
  for (const fn of listeners) fn()
}

// --- derived ---------------------------------------------------------------

/** The tree nodes that carry one of the old studio board's effects (`TreeNode.tech`). */
const TECH_CARRIERS = TREE_HEROES.flatMap((hero) =>
  TREES[hero].filter((node) => node.tech !== undefined).map((node) => ({ hero, node })),
)

let techCache: { milestones: readonly string[]; shifts: number; levels: GameState['treeLevels']; value: TechEffects } | null = null

/**
 * §11 — what the old studio board's effects are doing now, in one place.
 *
 * **Carried by the trees** [2026-09-26]. The board is retired — *"retire the old
 * tree, but the story of james introducing us instant messenger should be how
 * upgrade trees are introduced"* — and a tree node that took over one of its
 * effects names it (`TreeNode.tech`). A root carries its effect while its
 * person is in the building and the trees are open: James's Instant Messenger
 * from the first Paradigm Shift, as the old board granted it; Billy's Daily
 * Standup from the day he arrives, which is what his scene is about. Any other
 * node carries it at the level bought.
 *
 * Memoised on the three things it reads, because `tick` asks many times a
 * frame and the answer changes a handful of times a run.
 */
export function techOf(s: GameState = state): TechEffects {
  const meta = getPermanent().meta
  if (
    techCache &&
    techCache.milestones === meta.milestones &&
    techCache.shifts === meta.paradigmShifts &&
    techCache.levels === s.treeLevels
  ) {
    return techCache.value
  }
  const levels: Record<string, number> = {}
  if (currentUnlocks().trees) {
    const arrived = arrivedHeroes()
    for (const { hero, node } of TECH_CARRIERS) {
      if (hero !== 'you' && !arrived.has(hero)) continue
      const level = node.kind === 'root' ? 1 : treeLevelOf(hero, node.id, s)
      if (level > 0) levels[node.tech!] = level
    }
  }
  const value = techEffects(levels)
  techCache = { milestones: meta.milestones, shifts: meta.paradigmShifts, levels: s.treeLevels, value }
  return value
}

/**
 * §4.2's capacity with §11.2's protocol nodes on it.
 *
 * The tree multiplies the cap rather than subtracting from the load because
 * §4.1 only ever sees the ratio — see the note on `TechEffects.devCapMultiplier`.
 */
export function effectiveDevCap(s: GameState = state): number {
  // §13.9.2 — and Melany's Cloud branch on top, which raises the cap by paying
  // for capacity you did not have to organise. §11's tree raises it by making
  // communication cheaper; these are genuinely different moves and they
  // multiply rather than compete.
  return s.devCap * techOf(s).devCapMultiplier * s.heroFold.cap
}

/**
 * Developers actually at a keyboard this frame — §11.2 B2 and B3.
 *
 * **Deliberately not the same number that generates communication load.** A
 * developer in a meeting is not coding and is *emphatically* still
 * communicating; a pair-programming studio has half as many keyboards and
 * exactly as many people to keep in the loop. So this reduces output and the
 * load keeps counting everybody, which is why §11.2 B3 has to state its 60%
 * entropy cut separately — if halving the workforce also halved the load, the
 * node would pay twice and be the only purchase in the branch worth making.
 */
/**
 * §21.7.0 rule 5 — the seats that never leave.
 *
 * A frozen array rather than a literal at each call site: it is passed on every
 * tick, and allocating a one-element array sixty times a second to say
 * something that never changes is the kind of thing that shows up in a profile
 * for no reason at all.
 */
/**
 * §21.7.0 rule 6 — the floor seats a hand may not lift.
 *
 * **[amended 2026-09-04] Empty.** This was `[JAMES_SEAT]` and it was right
 * while James sat at floor seat 0. He has a desk behind the glass now and is
 * not on the floor at all, so pinning seat 0 protects *the first ordinary hire*
 * and hands them James's refusal lines while it does it.
 *
 * Rule 6 is not repealed and does not need to be: it says James cannot be
 * picked up, and he cannot, because he is not among the bodies a finger can
 * reach. {@link JAMES_REFUSALS} is kept rather than deleted — it is written
 * character, and the moment there is a way to prod the man behind the glass it
 * is the thing to say.
 */
const JAMES_PINNED: readonly number[] = Object.freeze([])

/**
 * §7.8.9 — the away population's cost, **modelled rather than counted**, for
 * §24's offline resolver.
 *
 * The roster is run state and is not persisted, so a restored save has nobody
 * away and eight hours of offline progress would be earned at a rate the studio
 * never achieves while anybody is watching. That is not a rounding error, it is
 * an instruction: *close the tab to stop your developers slacking.*
 *
 * The fix is available precisely because §7.8.9's rate is stated as a **duty
 * cycle** rather than as a spawn rate — {@link awayShare} is a pure function of
 * entropy, so the long-run share is knowable without simulating a single walk.
 * Online the studio pays whatever the roster happens to hold this second;
 * offline it pays the average of that, which is the same number with the noise
 * taken out.
 */
export function offlineSlackFactor(s: GameState = state): number {
  const t = techOf(s)
  const share = Math.min(1, Math.max(0, awayShare(currentEntropy(s)) * t.slackShare))
  return 1 - share
}

export function workingDevs(s: GameState = state): number {
  const t = techOf(s)
  /**
   * §7.8.6 rule 2, **reversed** on 2026-08-26 — a developer away from their
   * desk produces nothing.
   *
   * Taken off `coding` and not off the load, which is the same distinction the
   * comment above this function already draws for §11.2 B2's meeting and is if
   * anything more obviously right here: somebody standing at a whiteboard is
   * not writing code and is *emphatically* still communicating. §4.1 keeps
   * counting them. That is the joke — the studio pays the coordination cost of
   * everybody who wandered off and gets the output of nobody.
   *
   * Clamped against the headcount rather than trusted, because the slack
   * population and the count are advanced by different code on the same tick
   * and a negative headcount would propagate into the economy silently.
   *
   * Every hire codes [2026-09-26]: §4.11's QA, SRE and support hires, who gave
   * up a coding head each, were cut at the user's instruction.
   */
  const away = Math.min(awayHeads(s.slack), Math.max(0, Math.floor(s.devs)))
  // §21.0b — plus James, who codes and is not one of the twenty. He is never
  // `away`: §7.8.9's roster is indexed by floor seat and he does not have one.
  const coding = Math.max(0, Math.floor(s.devs) - away) + jamesHead(s)
  const active = t.activeDevFraction
  const meeting = standupFactor(s.runSeconds, standupsRunning(s))
  const protectedHeads = Math.min(
    coding,
    Number.isFinite(s.heroFold.standupHeads) ? Math.max(0, s.heroFold.standupHeads) : 0,
  )
  // James and Billy protect only the stand-up loss. Pair Programming's
  // `activeDevFraction` is a staffing choice, not an interruption immunity.
  return coding * active * meeting + protectedHeads * active * (1 - meeting)
}

/**
 * §11.2 B2 bought the meeting; §13.2 L1-2A cancels it.
 *
 * **This is the single most satisfying purchase in the Paradigm Tree**, and it
 * is only satisfying because the pause is real: B2's entropy ceiling is
 * enormous and its cost is that the company stops to talk about itself every
 * minute, for ever, and there is nothing the player can do about it inside a
 * run. Meeting Ban is the thing they can do about it across runs. The node
 * keeps the ceiling and deletes the meeting.
 */
function standupsRunning(s: GameState = state): boolean {
  return techOf(s).standups && !meetingBanActive(getPermanent().layer1.paradigmLevels)
}

/** §11.2 — is the studio in its daily standup right now? */
export function inMeeting(s: GameState = state): boolean {
  return inStandup(s.runSeconds, standupsRunning(s))
}

/**
 * §4.1's curve with §13.9's fold on it, and no ceiling or floor yet.
 *
 * Split out so {@link currentEfficiency} and {@link structuralEntropy} cannot
 * drift: they are the same arithmetic with one term's worth of difference, and
 * a second copy of it here would be the divergence that copy always becomes.
 *
 * §13.9 — Billy's Cohesion branch bends §4.1's entropy directly, which is the
 * one branch that touches the game's central number. Applied to the *entropy*
 * rather than to the efficiency so a fold of 0.9 means "ten per cent less
 * entropy" — the sentence §22.8 writes — rather than "ten per cent more
 * efficiency", which at 99% entropy would be a rounding error and at 1% would
 * be the whole studio.
 */
/**
 * §21.0b [added 2026-09-04] — **James is a developer who is not one of the
 * twenty**, and this is the whole of what that means.
 *
 * §7.8.0 has always said a leadership hire does not bring the garage one seat
 * closer to full, and §7.8.0c states it in numbers: *"the founder and James are
 * physical, and they are outside the twenty."* He still writes code — §21.0e's
 * act is "two of us shipped three games" — so he is a head the organisation
 * has, without being a head the floor seats or the counter counts.
 *
 * **He carries load as well as output, and that is not a detail.** The first
 * attempt at this took him out of `devs` and gave him back only his output;
 * §4.1's Run 1 then stopped on `hire-cost` instead of `entropy`, stably, twice.
 * The reason is visible one line down: Act I's `devCap` is 1, so a single head
 * is the *entire* coordination pressure of the act. A producer who costs
 * nothing to coordinate with is not a developer, it is a subsidy, and it
 * deletes the trap the first run is built around.
 *
 * Not counted for payroll, and that needs no special case: payroll is `devs`,
 * and he was always free.
 */
function jamesHead(s: GameState): number {
  // §21.7.0 rule 5 — the gym, ten to eleven, every day. A card that is absent
  // has to be absent from the arithmetic too, or the joke costs nothing.
  return arrivedHeroes().has('james') && jamesPresent(s.runSeconds) ? 1 : 0
}

/**
 * Everybody who is at a desk writing code.
 *
 * `state.devs` is the *floor*: the twenty ordinary developers the counter shows
 * and the room seats. This is that plus {@link jamesHead} — the number for
 * "is anybody working", and for how much they get done.
 *
 * **It is deliberately not §4.1's headcount.** Capacity is about coordination,
 * and §7.8.0's rule is that a leadership hire does not consume it; see
 * {@link foldedEfficiency}, which stays on `devs` for exactly that reason.
 */
function codingHeads(s: GameState): number {
  return Math.floor(s.devs) + jamesHead(s)
}

function foldedEfficiency(s: GameState): number {
  /*
   * §7.8.0 [2026-09-04] — **`devs`, not {@link codingHeads}, and that is the
   * rule rather than an oversight.**
   *
   * "A leadership hire does not consume capacity" is the section's own
   * sentence, and this is the line it is about: §4.1's curve is what capacity
   * *means*. James writes code (see {@link workingDevs}) and costs the
   * organisation nothing to coordinate with, which is precisely what the phrase
   * buys him. Counting him here instead put the studio permanently one head
   * over its own cap and §4.1 stopped reading exactly half at the base cap,
   * which `billyArrives.test.ts` catches on the nose.
   */
  const raw = efficiency(s.devs, effectiveDevCap(s))
  // §16 — and the light-lag, which is §4.1 again in the one unit the galaxy
  // introduces. It is exactly 1 while the studio is on one world, so nothing
  // below §13.5's gate can feel it and no balance below the gate moved.
  return raw * interstellarSync(worldsFor(s.devs), relayTier(s))
}

/**
 * §16 — how far the studio's own comm tech carries a signal, as a relay tier.
 *
 * **Derived from `D_cap`, not sold on a board.** The thing §11's tree buys is
 * *how many people can work together before the talking eats the work*, and at
 * interstellar distance that is the identical problem with light in it. So the
 * reach the player has is the capacity the player has earned, measured in
 * decades above one full planet: a studio whose infrastructure can hold a
 * hundred million people in one place can hold them across a few light-years,
 * and one that has outrun its own capacity is behind in both directions at
 * once — which is the whole game, said at the top of the ladder.
 *
 * Zero at and below §13.5's gate, so a studio on one world has a tier and no
 * lag to spend it on.
 */
export function relayTier(s: GameState = state): number {
  const cap = effectiveDevCap(s)
  if (!(cap > WORLD_CAP)) return 0
  return Math.log10(cap / WORLD_CAP)
}

/** §7.7.1a — how many worlds the studio has settled. */
export function currentWorlds(s: GameState = state): number {
  return worldsFor(s.devs)
}

/** §16 — the mean one-way light-lag across them, in light-years. */
export function currentLagLy(s: GameState = state): number {
  return meanLagLy(currentWorlds(s))
}

/** §16 — what that lag is costing, as a multiplier on §4.1's efficiency. */
export function currentInterstellarSync(s: GameState = state): number {
  return interstellarSync(currentWorlds(s), relayTier(s))
}

/**
 * §16 — how long one whole project takes, at the studio's current rate.
 *
 * The *whole* project rather than what is left of it, because §16's barrier is
 * about the interval between releases and a half-burnt sprint would make that
 * interval read as shortening every second whether or not the studio had got
 * any faster. `commitment / velocity`, and nothing else: a Decimal divided by a
 * number, which is why it is here and not in a component.
 *
 * Infinite when the studio has stopped, which `buildTimeLabel` and
 * `barrierProgress` both handle as "not moving" rather than as an error.
 */
export function projectBuildSeconds(s: GameState = state): number {
  const rate = currentEffectiveVelocity(s)
  if (!(rate > 0)) return Number.POSITIVE_INFINITY
  return s.commitment.div(rate).toNumber()
}

export function currentEfficiency(s: GameState = state): number {
  // §18.0 — a live event holds the studio at a ceiling. Applied **before** the
  // purchased floor below, which is the standing rule for the whole event
  // system: an event may never undo something the player bought. A studio that
  // paid for §11.2's B4 cannot be seized by a thread, and that is the node
  // working rather than the event failing.
  //
  // The order is load-bearing and it is the reason `structuralEntropy` below is
  // not written in terms of this function: `max(floor, min(ceiling, x))` and
  // `min(ceiling, max(floor, x))` disagree exactly when an event's ceiling is
  // lower than something the player has bought, which is the one case this rule
  // exists to decide.
  const withEvent = Math.min(eventCeiling(s.event), foldedEfficiency(s))
  // §11.2's entropy caps, applied as an efficiency *floor* so the two readouts
  // cannot disagree — `currentEntropy` is defined as one minus this.
  //
  // Note what B2 and B4 therefore buy: at an 80% ceiling §6.3's Entropy Lock
  // can never fire again. That is the node working, not a hole. The player paid
  // for a company that cannot seize, and §25.3.2's "none of this may become a
  // fail state" is untouched — this removes one, it does not add one.
  return Math.max(1 - techOf(s).entropyCap, withEvent)
}

export function currentEntropy(s: GameState = state): number {
  return 1 - currentEfficiency(s)
}

/**
 * §4.1 as a fact about the **organisation**, with §18.0's event taken back out.
 *
 * The same number the speedometer shows, minus the one term in it that is not
 * about how the company is built: a live event's ceiling. Everything else stays
 * — §4.1's curve, §13.9's Cohesion fold, §11.2's purchased floor — because
 * those are all things the player has or has not done about the shape of the
 * company, which is exactly what this reading is for.
 *
 * **Added 2026-08-29, off a walk failure that was a design failure.** §21.7.3's
 * Billy waits for sync to sit at or below half for twenty seconds, and the clock
 * was reading `currentEntropy`. §18.0's THE THREAD holds the studio at 25%
 * output, which is 75% entropy — so the clock filled during the thread and Billy
 * arrived to a Run 2 garage of **twelve developers**, handing over §13.8's floor
 * before Mo, before Serena, before anybody had a problem it solves.
 *
 * The tempting reading is that the thread *is* a communication collapse and he
 * should come. He should not, and the distinction is the whole of §21.7.6: a
 * hero arrives holding the answer to a problem the player *has*. The answer to a
 * thread is a protocol, on a board §18.0a hands over in the same breath; the
 * answer to a studio that has outgrown its own capacity is somebody who runs the
 * floor. **An event is weather. Billy is about the building.**
 */
export function structuralEntropy(s: GameState = state): number {
  return 1 - Math.max(1 - techOf(s).entropyCap, foldedEfficiency(s))
}

/**
 * Passive swarm output, taxed by the poked developer's local entropy — and
 * **without §4.5a's buffs**.
 *
 * The unbuffed rate has to be nameable for two reasons. §24's offline
 * resolution multiplies a velocity by hours, and a player who was mid-buff when
 * they closed the tab must not earn eight hours of a fifteen-second effect. And
 * §10.1's readout splits the swarm from the thumb, which needs the two halves
 * separately rather than their sum.
 */
export function baseVelocity(s: GameState = state): number {
  /*
   * §10.7 [amended 2026-09-26] — **once the buffer is full, nobody codes.** Gated
   * here rather than at the one `+=` in `tick`, so the readout, the numerals
   * over the heads and the burn-down all say zero together: a HUD showing a
   * velocity over a burn-down that has stopped moving is the interface arguing
   * with itself.
   */
  return shelfBlocked(s) ? 0 : structuralVelocity(s)
}

/**
 * {@link baseVelocity} before §10.7's buffer is asked. For the two readers that
 * are about what the studio *could* do: §24's offline walk, which fills and
 * empties the buffer itself, and the terminal rung's project sizing.
 */
export function structuralVelocity(s: GameState = state): number {
  // Not `passiveVelocity(devs, cap)` any more: §11 splits the headcount that
  // *produces* from the headcount that *costs*, so the two arguments come from
  // different places. With an empty tree they are the same two numbers and this
  // is the same product it always was.
  return (
    workingDevs(s) *
    currentEfficiency(s) *
    SP_PER_DEV_PER_SEC *
    devEfficiency(1, s.localEntropy)
  )
}

/**
 * What §4.5a's buffs are adding, as a fraction of the passive rate.
 *
 * Weighted by §4.9a's shares, so buffing a 10x Engineer lifts the studio by ten
 * times what buffing the person beside them would — "who you poke matters", as
 * arithmetic rather than as a second rule.
 */
export function buffMultiplier(s: GameState = state): number {
  if (s.buffs.length === 0) return 1
  return 1 + buffLift(s.buffs, s.devs, (from, to) => shareSum(s.runSeed, s.devs, from, to))
}

/**
 * The rate the studio is actually producing at — GDD §4.5a.
 *
 * Passive output with the buffs on it. **This is a real rate and `tick`
 * integrates it**, which is the whole of R14: §4.5's tap used to pay a coin and
 * be forgotten, and now most of what it is worth arrives through here over the
 * next few seconds instead.
 */
export function currentVelocity(s: GameState = state): number {
  return baseVelocity(s) * buffMultiplier(s)
}

/**
 * How fast the studio is *actually* going — passive output plus the thumb.
 *
 * §10.1 calls the VELOCITY readout "the clicker layer's scoreboard", and it was
 * showing a number the clicker layer had no effect on. In Act I that is not a
 * rounding error, it is the whole beat inverted: §21's opening asks the player
 * to poke "3–5 times a second" and feel the burn-down outpace the passive rate,
 * and the one readout claiming to measure that sat flat while they did it.
 *
 * **Display only.** `tick` banks passive SP and `poke` banks tapped SP at the
 * moment of the tap, so feeding this back into the simulation would pay for
 * every poke twice. The separation is the point of having two functions.
 */
export function currentEffectiveVelocity(s: GameState = state): number {
  return currentVelocity(s) + Math.max(0, s.pokeRate) + founderPassiveVelocity()
}

/**
 * The half of the velocity that is **the player** — §10.1, §25.1.
 *
 * > `VELOCITY: 4,120 SP/s` / `(3,880 swarm + 240 poke)`
 *
 * §25.1 calls that split "the only thing on screen that can answer *did my tap
 * do anything*", and R14 both complicates and completes it. Complicates,
 * because a poke's Story Points now arrive in two places: a quarter on the
 * frame of the tap (`pokeRate`) and the rest as a lift on the people poked
 * (`currentVelocity − baseVelocity`). Completes, because summing them is what
 * the player is actually owed an answer about — and unlike `pokeRate`, which
 * empties two seconds after they stop, this number **holds while the buffs do**.
 *
 * That is the readout finally describing the loop §4.5a asks for: it stays up
 * while the player maintains their targets and sags when they neglect them.
 */
export function pokeVelocity(s: GameState = state): number {
  return Math.max(0, s.pokeRate) + (currentVelocity(s) - baseVelocity(s)) + founderPassiveVelocity()
}

// --- you — GDD §4.5d, §7.8.10, §13.7.1 -------------------------------------

/**
 * §13.7.1 — your own curve.
 *
 * It was the Management tree's effects. That tree was retired on 2026-09-26
 * with the studio board (*"retire the old tree"*): your upgrades are your tree
 * in `upgradeTrees.ts` now, and none of its nodes is wired yet, so you are the
 * founder you started as.
 */
export function founderOf(): FounderEffects {
  return NO_FOUNDER
}

/**
 * Your own output, in story points a second — §4.5d.
 *
 * **The one rate in this game that is not multiplied by the swarm and not
 * divided by §4.1's Entropy.** It takes no `GameState` at all, and that is the
 * signature saying so: there is no headcount argument and no efficiency
 * argument because neither can reach it. Every other velocity function in this
 * file takes the studio; this one takes nothing, because it is you.
 *
 * It lands in §10.1's `you` half rather than the `swarm` half, which is what
 * R11 built that split for — the readout can finally answer "what am *I*
 * contributing" with something that is true even when the player's thumb is
 * still.
 */
export function founderVelocity(): number {
  return founderOf().rate
}

/** §4.5d [amended 2026-10-01]: the founder only codes on a player action.
 * Keep the shared accounting seam so ticks and the YOU readout agree. */
export function founderPassiveVelocity(): number {
  return 0
}

/**
 * A tap on your own desk — §4.5d, "clicking your own desk generates story
 * points on its own growth curve".
 *
 * Separate from `poke` on purpose. `poke` resolves §4.7's dev state, §4.8's
 * zoom yield, §4.9's context switch and §4.5a's buff, every one of which is a
 * statement about *somebody else* being interrupted. None of them applies to
 * you: you do not have a mood the player has to read, your yield does not fall
 * as the camera pulls back — §4.5d's "clickable from anywhere" is exactly the
 * claim that it does not — and you cannot interrupt yourself.
 *
 * §13.7.1's Support node is the only thing that also pays cash, because a
 * founder answering the support mail is the one kind of work in this game that
 * bills directly.
 */
export function pokeFounder(x = 0, y = 0): number {
  // §10.7's release ring is inert for the same reason a scene is: the studio
  // has downed tools for the launch. A full buffer is inert too, and says so.
  if (state.scene !== null || state.launching || state.phase === 'bankrupt') return 0
  if (shelfBlocked()) {
    nagFullShelf()
    return 0
  }

  const f = founderOf()
  const sp = f.tapValue
  const patch: Partial<GameState> = {
    burned: state.burned.plus(sp),
    pokeRate: state.pokeRate + sp / POKE_RATE_TAU,
    pokeCount: state.pokeCount + 1,
    // Your code is still code. Use the same flying Story Point and source-line
    // feedback as every other developer instead of silently changing numbers
    // in the HUD. The stage supplies the founder's screen position; tests and
    // non-rendered callers safely fall back to the origin.
    floaters: [
      ...state.floaters,
      {
        id: nextFloaterId++,
        sp,
        x,
        y,
        crit: false,
        bornAt: performance.now(),
        snippet: snippets.next('working'),
        unblocked: false,
      },
    ],
  }
  if (f.cashPerPoint > 0) patch.cash = state.cash + sp * f.cashPerPoint

  // §13.7.1's REACH node, and it is deliberately a weaker Chained Poke (§13.2
  // L1-2B) — "every node is a weaker version of somebody else's". Walking the
  // floor nudges the rows nearest your corner, at the diluted share.
  if (f.reachRows > 0 && state.devs > 0) {
    const unitOutput = baseVelocity() / state.devs
    let buffs = state.buffs
    let overflow = 0
    for (let i = 0; i < f.reachRows; i++) {
      const chained = addBuff(buffs, { rung: 2, index: i }, sp * MANAGEMENT_DILUTION, unitOutput)
      buffs = chained.buffs
      overflow += chained.overflow
    }
    patch.buffs = buffs
    if (overflow > 0) patch.burned = state.burned.plus(sp + overflow)
  }

  set(patch)
  return sp
}

/**
 * **Poke James** — 2026-09-26: *"I can't click james to code at the moment"*.
 *
 * §21.0b made him unreachable by design: he is the super dev outside the
 * twenty, so he was left out of every body a finger could land on. The
 * rebuild's mechanics, now canon here, let you poke him, and a poke on a coder
 * is code: this is the founder's poke, credited to James. Worth **twice your
 * tap** — he is the super dev, and a poke on him should feel like one — and
 * nothing at all while he is at the gym (§21.7.0 rule 5), before he has
 * arrived, or while the studio has downed tools (a scene, the launch window,
 * bankruptcy), for the reason {@link pokeFounder} gives.
 *
 * Returns the Story Points banked, 0 for a tap that did nothing.
 */
export const JAMES_TAP_MULTIPLE = 2
export function pokeJames(x = 0, y = 0): number {
  if (state.scene !== null || state.launching || state.phase === 'bankrupt') return 0
  if (shelfBlocked()) {
    nagFullShelf()
    return 0
  }
  if (!arrivedHeroes().has('james') || !jamesPresent(state.runSeconds)) return 0
  const sp = founderOf().tapValue * JAMES_TAP_MULTIPLE
  set({
    burned: state.burned.plus(sp),
    pokeRate: state.pokeRate + sp / POKE_RATE_TAU,
    pokeCount: state.pokeCount + 1,
    floaters: [
      ...state.floaters,
      { id: nextFloaterId++, sp, x, y, crit: false, bornAt: performance.now(), snippet: snippets.next('working'), unblocked: false },
    ],
  })
  return sp
}

/**
 * §13.7.1's Always On Call — what your desk contributes to §24.5's absence.
 *
 * Zero unless the node is owned, which is what makes it a node rather than a
 * gift. It is the one place the founder's curve touches the offline model, and
 * it is the Reliability spine diluted into something a studio with no incidents
 * can still feel: the specialist version will shorten time-to-recover; yours
 * just means you never really stopped.
 */
function offlineFounderVelocity(): number {
  return founderOf().worksOffline ? founderPassiveVelocity() : 0
}

// --- per-developer output — GDD §4.9a ---------------------------------------
//
// The store modelled *one* studio: one velocity, one dev-state machine, one of
// everything. §4.9a's whole point is that a studio where everybody produces the
// mean is a spreadsheet, so this is the seam where the singular becomes plural.
//
// It is a seam and not a table. Nothing per-developer is *stored* — the roll
// comes from the seat index and the run seed, the same contract §7.8.7 uses for
// names and faces — so a studio of ten trillion still costs one integer, and
// the person who is a 10x Engineer is the same person after a reload.

/**
 * Seat `index`'s output, as a multiple of the average developer — §4.9a.
 *
 * Exported rather than folded into {@link developerVelocity} because §8.2b's
 * numeral, §7.8.8's card and §14.4's hero classes all want the *ratio* rather
 * than the rate: "worth ten of the person next to them" is a comparison, and a
 * SP/sec figure at a hundred thousand developers is not one.
 */
export function developerShare(index: number, s: GameState = state): number {
  return outputShare(s.runSeed, s.devs, index)
}

/**
 * What seat `index` is producing right now, in Story Points per second — §8.2b.
 *
 * The studio's passive velocity divided among its people in proportion to their
 * roll. **The sum over the roster is the studio's velocity exactly** — see
 * `outputShare`; the shares are normalised by the mean the roster actually
 * rolled, so widening §4.9a's spread cannot move the total by a single point.
 *
 * Passive only, deliberately. The thumb's contribution is §10.1's separate
 * `poke` half of the readout and belongs to whoever was tapped, not spread
 * across a floor that was not.
 */
export function developerVelocity(index: number, s: GameState = state): number {
  if (s.devs <= 0) return 0
  // §4.5a — plus whatever the player has recently poked onto this seat, so a
  // buffed developer's §8.2b numeral visibly speeds up. **The two are the same
  // sum grouped differently**: adding this over the roster gives
  // `currentVelocity` exactly, because `buffLift` divides by the same headcount
  // and `units.ts` guarantees the seat ranges tile it.
  const lift = 1 + strengthOnSeat(s.buffs, Math.max(0, Math.floor(index)), s.devs)
  return (baseVelocity(s) / s.devs) * developerShare(index, s) * lift
}

/** §14.4 — which band of the roll this seat is in, for a card or a badge. */
export function developerClass(index: number, s: GameState = state): OutputClass {
  return outputClass(developerShare(index, s))
}

/**
 * How quickly the poke rate forgets, in seconds.
 *
 * Short enough that letting go shows up almost immediately — this is feedback
 * on what the player is doing *now* — and long enough that the number does not
 * flicker between taps at a human tapping speed. Two seconds is about four
 * pokes at §21's target rate.
 */
export const POKE_RATE_TAU = 2

/**
 * Seconds until the current project ships, at the rate it is actually going.
 *
 * `Infinity` when nothing is moving — a seized studio (§21 Act V) is not
 * "eighty seconds from a payout", it is never getting one, and §4.10d's
 * criticality test depends on telling those two apart.
 */
export function secondsToPayout(s: GameState = state): number {
  const remaining = s.commitment.minus(s.burned).toNumber()
  if (remaining <= 0) return 0
  const rate = currentEffectiveVelocity(s)
  return rate > 0 ? remaining / rate : Number.POSITIVE_INFINITY
}

/** §4.10d — what the next ship is worth, for the runway readout. */
export function nextPayout(s: GameState = state): number {
  return projectRevenue(s.projectIndex, shippedScale(s))
}

export function currentPayroll(s: GameState = state): number {
  const operating = Number.isFinite(s.heroFold.operatingCost)
    ? Math.max(0, s.heroFold.operatingCost)
    : 0
  return payrollPerSecond(s.devs) + operating
}

/**
 * §4.10e — dollars a second coming in from games already on sale.
 *
 * Zero in Act I, and it stays zero until something ships. That is the readout
 * earning its place rather than a gap: a studio with no back catalogue *has* no
 * income between payouts, and the line arriving the moment the first game ships
 * is the clearest possible statement of what shipping bought.
 */
export function catalogueRate(s: GameState = state): number {
  // §4.12a and §4.13 — the readout must agree with the till. A downed release
  // is earning nothing and a queue nobody is answering is taking a share of
  // what the rest earn, and both have to be *in* this number rather than
  // applied somewhere further along: §10.6's rule is that the interface never
  // tells the player something the simulation is not doing.
  const held = suppressedReleases(s.incidents)
  return catalogueIncome(s.releases, held) * catalogueMultiplier(s.tickets, supportHeads(s))
}

/**
 * §4.13 — heads answering tickets: the founder's diluted one, and Matt's help
 * desk once he has arrived (`heroRoster.ts`).
 *
 * One authority [2026-09-26]. The tick, this file's catalogue readout and the
 * sync score used to count support three ways, and two of them disagreed about
 * whether Matt's heads were in it. The professions that also fed it are gone.
 */
export function supportHeads(s: GameState = state): number {
  return FOUNDER_ROLE_HEADS + Math.max(0, s.heroFold.supportHeads)
}

/** §4.12a — heads clearing incidents: the founder's, and Serena's rota once she is here. */
export function oncallHeads(s: GameState = state): number {
  return FOUNDER_ROLE_HEADS + Math.max(0, s.heroFold.oncallHeads)
}

/** §4.10e — money already earned that has not arrived yet. The runway behind the runway. */
export function outstandingRevenue(s: GameState = state): number {
  return catalogueOutstanding(s.releases)
}

/**
 * Net dollars per second — what the player actually watches in Act V.
 *
 * **This used to be the burn alone**, on the correct reasoning that revenue was
 * realised on ship and there was no such thing as a running income. §4.10e
 * makes that false: the back catalogue pays continuously, and a "net" figure
 * that ignored half the flow would be the *readout* telling the lie §4.10e
 * exists to stop the *economy* telling. Act V is no less brutal for it — the
 * catalogue is four minutes deep and payroll at a thousand developers is
 * $50,000 a second, so the sign does not change; it is simply now true.
 */
export function netCashFlow(s: GameState = state): number {
  return catalogueRate(s) - currentPayroll(s)
}

export function remaining(s: GameState = state): Decimal {
  const left = s.commitment.minus(s.burned)
  return left.lt(0) ? new Decimal(0) : left
}

export function burnedFraction(s: GameState = state): number {
  if (s.commitment.lte(0)) return 1
  return Math.min(1, s.burned.div(s.commitment).toNumber())
}

export function isLocked(s: GameState = state): boolean {
  return currentEntropy(s) >= 0.99
}

// --- actions ---------------------------------------------------------------

function showBubble(text: string, ttl = 4000): Partial<GameState> {
  return { bubble: { text, bornAt: performance.now(), ttl } }
}

/**
 * What §4.13's queue and §4.12a's pager are asking of the studio right now.
 *
 * Assembled here rather than inside `teamSync.ts` for the standing reason the
 * `sim/` modules are pure: the shape of a roster, the founder's diluted heads
 * and the open incident list are all store facts, and a scoring module that
 * reached for them would be a scoring module that could not be tested without a
 * game running.
 *
 * The founder is on both counts at {@link FOUNDER_ROLE_HEADS}, exactly as they
 * are in `tick`, because both read {@link supportHeads} and {@link oncallHeads}. Leaving them out here would score a garage as unstaffed for a
 * catalogue the founder is in fact personally answering the email for, which is
 * §13.7.1's whole point about the manager who can do everything badly.
 */
function serviceLoad(s: GameState): ServiceLoad {
  return {
    supportHeads: supportHeads(s),
    sreHeads: oncallHeads(s),
    catalogue: s.projectsShipped,
    defectBacklog: s.defects,
    openIncidents: s.incidents.length,
  }
}

// --- §10.7 [amended 2026-09-26] — the pipeline and the release ring ---------
//
// *"port the release little game and the pipeline, it needs to fit the current
// game aesthetics."* The rebuild's mechanics, which are canon here
// (docs/PLAN-2026-09-26-return.md): Code → Build → Test → the buffer → SHIP!.
//
// What left with it: §10.8b's modal launch window, its three-sweep timeout, the
// simulation-side backstop that fired it for a hidden tab, and the 30-second
// cooldown that sent every other release out on a train. All four served a
// window that *halted the studio the instant a build finished*. The shelf is
// what settles them now — a build waits there for as long as the player likes,
// and the only thing that forces the question is the buffer filling up.

/**
 * A finished build, between the burn-down and the catalogue — GDD §10.7.
 *
 * **The rating inputs are frozen here, as the team that built it.** Everything
 * except the launch is a fact about the studio at the moment the work was
 * completed, and freezing them is what stops a build finished by six people
 * inheriting the hero coverage of the forty who were hired while it waited.
 *
 * The ordinal is claimed here too, for the same reason: the name and cover of a
 * shelved build are the ones the release will carry, and a build that waited
 * behind two others must not renumber itself when they go out.
 */
export interface ShelvedBuild {
  id: number
  /** §10.11's career ordinal it keeps when it ships — cover and luck hang off it. */
  ordinal: number
  name: string
  /** §10.6.1 — the genre its title names, which is what its cover paints. */
  genre: Genre
  /** §4.10c's rung it was built as. */
  projectIndex: number
  /** §4.10c's payout for that rung at that size, before the verdict and the date. */
  revenueBase: number
  /** Its Story Points. */
  size: number
  /** §4.12's bench it carried out of Code, in whole defects. */
  defects: number
  /** Defects per Story Point — what §10.7's ring draws its bugs from. */
  density: number
  /** §21.0c — built after the first shift, so the full §4.14 rating applies. */
  graded: boolean
  heroCoverage: number
  sync: number
  traits: number
  luck: number
  buildSeconds: number
  labourSeconds: number
  /** `runSeconds` when it reached the shelf, for "waiting 12s". */
  shelvedAt: number
}

/**
 * How many finished builds the buffer holds before Serena's board — §10.7.
 *
 * Three, the rebuild's figure: enough to walk away for the length of a coffee
 * in the garage, and few enough that the player learns in Act I that a full
 * shelf stops the floor.
 */
export const SHELF_CAPACITY = 3

/** Serena's pipeline board, folded. `sim/pipeline.ts` owns what each node does. */
export function pipelineOf(s: GameState = state): PipelineEffects {
  return pipelineEffects(s.pipelineNodes)
}

/**
 * §10.7 — **everything past Code**: the builds in the queue. One number, because
 * the queue is one capacity, and every reader of "how full is it" asks here.
 * (It was the shelf plus whatever was in Build and Test, until those went.)
 */
export function bufferCount(s: GameState = state): number {
  return s.shelf.length
}

/** §10.7 — the buffer's size: the garage's three, plus what Serena's board bought. */
export function shelfCapacity(s: GameState = state): number {
  return SHELF_CAPACITY + Math.max(0, Math.floor(pipelineOf(s).slots))
}

/**
 * §10.7 — **is the studio stopped?** The buffer is full, so nobody codes.
 *
 * One function, because the question has five callers — the velocity, the
 * founder's desk, the three pokes, the burn-down's finish and the HUD — and
 * five answers to it would drift the first time capacity changed (§9.2).
 */
export function shelfBlocked(s: GameState = state): boolean {
  return bufferCount(s) >= shelfCapacity(s)
}

/**
 * The floor saying why it has stopped, when the player pokes into a full
 * buffer. A bubble rather than a toast, and only when none is up, so a thumb
 * hammering a stopped studio reads one sentence rather than a stack of them.
 */
function nagFullShelf(): void {
  if (state.bubble) return
  set(showBubble('The build machine is full. Somebody press SHIP!', 3000))
}

/**
 * The project is finished — §10.7. It joins the queue; it does not go on sale.
 *
 * The rating's inputs are resolved here with the rules `shipProject` used to
 * apply at the ship (§21.0c's Run 1 stamps, §4.14's luck from the ordinal, the
 * sync integral, the traits), and the run moves on to the next project at once:
 * the burn-down restarts while this build travels the belt.
 */
function finishBuild(s: GameState): Partial<GameState> {
  const tech = techOf(s)
  const size = s.commitment.toNumber()

  /**
   * §21.0c — **Run 1 ships at the baseline by construction**, and the build is
   * where that is stamped now. See `releaseFrom` for the one term that is
   * allowed to move a Run 1 verdict.
   *
   * §4.12: the backlog is **transferred** to the build, not forgiven. The bench
   * goes to zero and the density leaves with the build, where §10.7's ring is
   * the one place the player can do anything about it.
   */
  const graded = currentUnlocks().simulated
  const density = graded ? shipDefects(s.defects, size).density : DEFECT_DENSITY_ANCHOR

  // §10.11's ordinal, claimed now: the history's next one *plus whatever is
  // already waiting*, because every build ahead of this one will ship first.
  const ordinal = nextOrdinal(s.history) + bufferCount(s)

  /**
   * §4.14 — reception, from the ordinal, so a reload cannot reroll it. §13.7.1's
   * Friends At The Press lifts the floor of the roll and never its ceiling.
   */
  const floor = founderOf().luckFloor
  const luck = graded ? floor + (1 - floor) * luckRoll(s.runSeed, ordinal) : LUCK_NEUTRAL

  /** §4.14 — how in sync the team was, over the whole build (`teamSync.ts`). */
  const sync = graded
    ? teamSync({
        flowSeconds: s.projectFlowSeconds,
        projectSeconds: s.projectSeconds,
        load: serviceLoad(s),
      })
    : GARAGE_SYNC

  /**
   * §4.14 — whether the people are any good.
   *
   * Zero for now [2026-09-26]. It measured the founder's Management tree and
   * points spent on §13.9's shared hero board, and both are retired: the
   * board went with placement and the Management tree with the studio board.
   * It comes back when the trees are wired (GDD §8).
   */
  const traits = graded ? traitScore(0, 0) : 0

  const title = titleFor(s.runSeed, ordinal)
  const build: ShelvedBuild = {
    id: nextBuildId++,
    ordinal,
    name: title.name,
    genre: title.genre,
    projectIndex: s.projectIndex,
    revenueBase: projectRevenue(s.projectIndex, shippedScale(s)),
    size,
    defects: graded ? s.defects : density * size,
    density,
    graded,
    // §4.14's hero term — how much of the cast is in the building.
    heroCoverage: graded ? benchShare(heroRoster(), STORY_HEROES.length) : 0,
    sync,
    traits,
    luck,
    buildSeconds: s.projectSeconds,
    labourSeconds: s.projectLabourSeconds,
    shelvedAt: s.runSeconds,
  }
  // Serena's quality nodes: the queue checks what joins it, and takes a share of
  // the defects off as it does. (This was Test's catch, when there was a Test.)
  const catches = pipelineOf(s).catches
  build.defects *= 1 - catches
  build.density *= 1 - catches

  const nextIndex = Math.min(s.projectIndex + 1, PROJECTS.length - 1)
  return {
    // The bench is clear. Whatever was on it is now the build's problem.
    defects: 0,
    shelf: [...s.shelf, build],
    projectIndex: nextIndex,
    // The next game claims the next ordinal: this build has just taken one.
    sprintName: titleFor(s.runSeed, ordinal + 1).name,
    // §11.3 C10 — "it's basically done". A flat 5% off every burn-down.
    commitment: commitmentFor(nextIndex, s).times(tech.commitmentFraction),
    burned: new Decimal(0),
    // §10.11 — the build's clocks left with it; the next project starts at zero.
    projectSeconds: 0,
    projectLabourSeconds: 0,
    projectFlowSeconds: 0,
  }
}

/**
 * How many bugs §10.7's ring draws for a build — the rebuild's rule.
 *
 * The backlog is a continuous quantity and the ring is a handful of marks, so
 * it is scaled against {@link DEFECT_DENSITY_ANCHOR}, the density a studio with
 * no QA ships at: a build the player has looked after has fewer things to fix
 * and a neglected one more. A build with no backlog shows an empty ring and
 * goes out GOLD without a tap. Bounded because the ring is a picture: under
 * three marks there is no decision, and over seven they stop being aimable.
 */
export const RING_DEFECTS_MIN = 3
export const RING_DEFECTS_MAX = 7

export function ringDefectCount(build: ShelvedBuild): number {
  if (!(build.density > 0)) return 0
  const scaled = Math.round((build.density / DEFECT_DENSITY_ANCHOR) * 4)
  return Math.max(RING_DEFECTS_MIN, Math.min(RING_DEFECTS_MAX, scaled))
}

/**
 * Put the oldest shelved build on sale — §10.7, and the only path that does.
 *
 * One function for every route off the shelf: the player choosing a moment on
 * the ring, Serena's auto-ship, and a test standing in for the player. They
 * differ by the {@link LaunchOutcome} they hand over and by nothing else, which
 * is what keeps "what is a release worth" from having three answers (§9.2).
 */
function releaseFrom(s: GameState, outcome: LaunchOutcome): Partial<GameState> {
  const build = s.shelf[0]
  if (!build) return {}
  const tech = techOf(s)

  /*
   * **What the player left open is what ships.** The ring's bugs are a picture
   * of the backlog, so clearing three of five takes three fifths of the defects
   * off the release. A session that opened more than it closed ships *more*,
   * capped so a catastrophic one cannot produce an absurd density.
   */
  const left = outcome.initial > 0 ? Math.min(2, Math.max(0, outcome.open) / outcome.initial) : 0
  const defects = build.defects * left
  const launch = launchScore(outcome)

  /*
   * §4.14 plus §10.7's seventh term. **Run 1 keeps its baseline, and the launch
   * moves it** [2026-09-26]: §21.0c stamps every other input so the scripted
   * economy is exactly ×1, and §10.8b already let the release *date* through
   * that stamp ("a loop with its most tactile beat removed is not the loop").
   * The ring's other half is the bugs, and if fixing them changed nothing in
   * Run 1 the tutorial would teach the ring's trade as a lie. So the launch term
   * applies around the baseline: a release nobody attended scores exactly the
   * baseline, as before, and the ring can lift or sink it by its own weight.
   */
  const rating = build.graded
    ? rateRelease({
        defects,
        storyPoints: build.size,
        heroCoverage: build.heroCoverage,
        // §4.9a pins the roster mean at 1.0, and `craftScore` turns that into ½.
        craft: 1,
        sync: build.sync,
        traits: build.traits,
        luck: build.luck,
        launch,
      })
    : BASELINE_RATING + 100 * RATING_WEIGHTS.launch * (launch - LAUNCH_NEUTRAL)
  const density = build.graded ? build.density * left : DEFECT_DENSITY_ANCHOR

  // §11.2 B3, §11.3 C9, §4.14's verdict and reputation, and §10.7's date — all
  // on the payout rather than the tail, so §4.10e's integral still pays exactly
  // what the release says it is worth.
  const revenue =
    build.revenueBase *
    tech.revenueMultiplier *
    revenueMultiplier(rating) *
    reputationMultiplier(s.reputation) *
    outcome.timing.multiplier

  const record: ReleaseRecord = {
    ordinal: build.ordinal,
    run: getPermanent().meta.paradigmShifts,
    name: build.name,
    rating,
    heroCoverage: build.heroCoverage,
    sync: build.sync,
    traits: build.traits,
    luck: build.luck,
    // §10.7 — and what the player did at the launch, for the gallery's breakdown.
    launch,
    payout: revenue,
    buildSeconds: build.buildSeconds,
    labourSeconds: build.labourSeconds,
    seed: s.runSeed,
  }

  return {
    shelf: s.shelf.slice(1),
    history: recordRelease(s.history, record),
    reputation: advanceReputation(s.reputation, rating),
    // §10.8a — the moment gets an event, named for the build that shipped.
    ship: {
      id: nextShipId++,
      name: build.name,
      revenue,
      at: performance.now(),
      rating,
      ordinal: build.ordinal,
      timing: outcome.timing.multiplier,
      // Null when nobody was at the launch, so the reel says nothing rather
      // than print QUIET LAUNCH over a release the player never saw a ring for.
      timingLabel: outcome.attended ? outcome.timing.label : null,
      stage: outcome.attended ? outcome.stage : null,
    },
    // §4.10e — no lump. The game goes on sale and `tick` banks the tail.
    releases: [
      ...s.releases,
      {
        id: nextReleaseId++,
        ordinal: build.ordinal,
        name: build.name,
        payout: revenue,
        age: 0,
        paid: 0,
        shape: rollShape(s.runSeed, s.projectsShipped),
        defectDensity: density,
        rating,
      },
    ],
    projectsShipped: s.projectsShipped + 1,
  }
}

/**
 * Run the queue's clock by `dt` — §10.7. Serena's auto-ship fires on its own
 * clock, several times in one long step if it is owed them, never more than the
 * queue holds.
 */
function advanceBelt(s: GameState, dt: number): Partial<GameState> {
  const fx = pipelineOf(s)
  let patch: Partial<GameState> = {}
  if (!fx.autoShip) {
    if (s.autoShipClock !== 0) patch.autoShipClock = 0
    return patch
  }
  let now = s
  let clock = s.autoShipClock + dt
  while (clock >= fx.autoShipSeconds && now.shelf.length > 0) {
    clock -= fx.autoShipSeconds
    const out = releaseFrom(now, pipelineLaunch())
    now = { ...now, ...out }
    patch = { ...patch, ...out }
  }
  // An idle shipper does not bank shots: with nothing on the shelf the clock
  // waits at "ready" rather than accumulating a burst for later.
  patch.autoShipClock = now.shelf.length === 0 ? Math.min(clock, fx.autoShipSeconds) : clock
  return patch
}

/** §10.7 — the belt as the HUD draws it. One reading, so the HUD cannot count the buffer differently from the rule that stops the studio. */
export interface BeltView {
  /** Everything in the queue, against the capacity that stops the studio at full. */
  buffer: number
  capacity: number
  /** Builds on the shelf, which SHIP! can reach. */
  ready: number
  autoShip: boolean
  /** Seconds until auto-ship next fires, or null without it. */
  autoShipIn: number | null
}

export function beltView(s: GameState = state): BeltView {
  const fx = pipelineOf(s)
  return {
    buffer: bufferCount(s),
    capacity: shelfCapacity(s),
    ready: s.shelf.length,
    autoShip: fx.autoShip,
    autoShipIn: fx.autoShip ? Math.max(0, fx.autoShipSeconds - s.autoShipClock) : null,
  }
}

/**
 * §10.7 — SHIP!. Opens the release ring for the shelf's head, and the studio
 * stops while it is up. False when there is nothing to ship or something else
 * owns the screen.
 */
export function openLaunch(): boolean {
  if (state.launching || state.shelf.length === 0) return false
  if (state.scene !== null || state.phase === 'bankrupt') return false
  set({ launching: true })
  return true
}

/** §10.7 — leave the ring without releasing. The build stays at the head of the shelf. */
export function closeLaunch(): void {
  if (state.launching) set({ launching: false })
}

/** §10.7 — the ring's verdict: put the head on sale at `outcome` and close the ring. */
export function launchRelease(outcome: LaunchOutcome): void {
  if (state.shelf.length === 0) {
    closeLaunch()
    return
  }
  set({ ...releaseFrom(state, outcome), launching: false })
}

/**
 * Release the shelf's head as nobody attending it would — `TRAIN_LAUNCH`,
 * neutral on every term. For tests and scripts that stand in for a player
 * pressing SHIP! and walking away; the game itself only releases through the
 * ring and through Serena's auto-ship.
 */
export function releaseNow(): void {
  if (state.shelf.length === 0) return
  set({ ...releaseFrom(state, TRAIN_LAUNCH), launching: false })
}

/**
 * Put every finished build on sale now: the belt runs out instantly and the
 * shelf is released at {@link TRAIN_LAUNCH}. A test seam, for the many tests
 * that drive a run through its ships and are not about the belt.
 */
export function shipEverything(): void {
  set(advanceBelt(state, 1e9))
  while (state.shelf.length > 0) releaseNow()
}

/**
 * Debug seam — `?release`. Finish the project on the burn-down, run the belt
 * out so it is on the shelf, and (by default) open the ring on it. The ring is
 * the one frame §23.4.2 cannot otherwise hold still long enough to measure.
 */
export function __parkBuild(open = true): void {
  set(finishBuild(state))
  set(advanceBelt(state, 1e9))
  if (open) set({ launching: true })
}

// --- Serena's pipeline board -------------------------------------------------

/** §10.7 — Serena's board is open once she has arrived. SHIP! is yours until then. */
export function pipelineOpen(): boolean {
  return arrivedHeroes().has('serena')
}

export function pipelineRank(id: string, s: GameState = state): number {
  return pipelineLevel(s.pipelineNodes, id)
}

/**
 * §2.7 — the least a pipeline node costs here: three minutes of what the back
 * catalogue is paying, past the garage. Zero in the garage, whose prices were
 * set by hand. The rebuild's `techPriceFloor`, read off this build's income.
 */
export function pipelinePriceFloor(s: GameState = state): number {
  if (eraIndex(s.peakDevs) === 0) return 0
  return 3 * 60 * catalogueRate(s)
}

export function pipelinePrice(id: string, s: GameState = state): number | null {
  const node = PIPELINE_BY_ID.get(id)
  if (!node || pipelineRank(id, s) >= node.maxLevel) return null
  return pipelineCost(node, pipelineRank(id, s), pipelinePriceFloor(s))
}

export function pipelineRefusalOf(id: string, s: GameState = state): PipelineRefusal | 'closed' | 'unknown' {
  const node = PIPELINE_BY_ID.get(id)
  if (!node) return 'unknown'
  if (!pipelineOpen()) return 'closed'
  return pipelineRefusal(node, s.pipelineNodes, s.cash, eraIndex(s.peakDevs), pipelinePriceFloor(s))
}

export function buyPipeline(id: string): boolean {
  if (pipelineRefusalOf(id) !== null) return false
  const price = pipelinePrice(id)!
  set({
    cash: state.cash - price,
    pipelineNodes: { ...state.pipelineNodes, [id]: pipelineRank(id) + 1 },
  })
  return true
}

// --- §8, the five isometric trees ---------------------------------------------
//
// [2026-09-26] The rebuild's upgrade-trees demo, visual first (`sim/upgradeTrees.ts`
// has the argument). Serena's pipeline nodes are wired and every question about
// them is the pipeline's — level, price, refusal and purchase — so her tree and
// the belt cannot disagree. Every other node keeps a level in `treeLevels`, is
// priced from the one wallet at the demo's rates, and does nothing yet.

/** A tree node's level: the pipeline's for Serena's wired nodes, the tree's own otherwise. */
export function treeLevelOf(hero: TreeHero, id: string, s: GameState = state): number {
  const node = treeNode(hero, id)
  if (!node || node.kind === 'root' || node.kind === 'link') return 0
  if (node.wired) return pipelineLevel(s.pipelineNodes, id)
  return s.treeLevels[treeKey(hero, id)] ?? 0
}

/** The next level's price, or null when there is none to buy. */
export function treePriceOf(hero: TreeHero, id: string, s: GameState = state): number | null {
  const node = treeNode(hero, id)
  if (!node || node.kind === 'root' || node.kind === 'link') return null
  if (node.wired) return pipelinePrice(id, s)
  const level = treeLevelOf(hero, id, s)
  if (level >= node.max) return null
  // §2.7's income floor, as the pipeline applies it: past the garage no node
  // is cheaper than a few minutes of what the back catalogue pays.
  return treePrice(node, level, pipelinePriceFloor(s))
}

export function treeView(s: GameState = state): TreeView {
  return {
    level: (hero, id) => treeLevelOf(hero, id, s),
    era: eraIndex(s.peakDevs),
    cash: s.cash,
    price: (hero, node) => treePriceOf(hero, node.id, s),
  }
}

/** Why a tree node cannot be bought, or null. A wired node asks the pipeline. */
export function treeRefusalOf(hero: TreeHero, id: string, s: GameState = state): TreeRefusal {
  const node = treeNode(hero, id)
  if (!node) return 'requires'
  if (node.wired) {
    const why = pipelineRefusalOf(id, s)
    if (why === 'closed') return 'absent'
    return why === 'unknown' ? 'requires' : why
  }
  return treeRefusal(treeView(s), hero, node)
}

export function treeTileState(hero: TreeHero, id: string, s: GameState = state): TileState {
  const node = treeNode(hero, id)
  if (!node) return 'locked'
  return tileStateOf(treeRefusalOf(hero, id, s), levelOf(treeView(s), hero, node))
}

export function buyTreeNode(hero: TreeHero, id: string): boolean {
  // GDD §8 [2026-09-26] — the trees open after the first Paradigm Shift. Asked
  // here as well as at the door, so no caller can buy around the gate.
  if (!currentUnlocks().trees) return false
  const node = treeNode(hero, id)
  if (!node) return false
  if (node.wired) {
    if (!buyPipeline(id)) return false
  } else {
    if (treeRefusalOf(hero, id) !== null) return false
    const price = treePriceOf(hero, id)!
    const key = treeKey(hero, id)
    set({
      cash: state.cash - price,
      treeLevels: { ...state.treeLevels, [key]: (state.treeLevels[key] ?? 0) + 1 },
    })
  }
  // §18.0a — a purchase is THE THREAD's intended exit, and it is *any*
  // purchase, exactly as James says in the scene. Resolved here, at the
  // transaction, rather than in the window's click handler: trap 33 is the
  // record of what happens when a rule is wired to the interface instead.
  resolveEventBy('tech-purchase')
  saveGame()
  return true
}

/**
 * The Story Points a set of just-expired buffs still owed — GDD §4.5a.
 *
 * A buff of strength `s` on a unit producing `u` per second is worth `s · u ·
 * τ` from here on, which is the same arithmetic `sim/buffs.ts` used to create
 * it, run backwards. `buffs.ts` cannot do this itself because it deliberately
 * does not know what a developer is worth (§4.9a) — it takes the shares as a
 * question, and this is the answer.
 */
function settleDroppedBuffs(dropped: readonly Buff[], s: GameState): number {
  if (dropped.length === 0 || s.devs <= 0) return 0
  const perSecond = baseVelocity(s) / s.devs
  if (!(perSecond > 0)) return 0

  let owed = 0
  for (const b of dropped) {
    const { from, to } = unitSeats(b.rung, b.index, s.devs)
    if (to > from) owed += b.strength * perSecond * shareSum(s.runSeed, s.devs, from, to) * BUFF_TAU
  }
  return owed
}

/**
 * Advance the simulation. Driven by the Pixi ticker so both layers share a clock.
 *
 * §10.7a.3 — **while a scene is up, the clock is stopped.** Nobody codes, the
 * burn-down does not move, payroll does not run, entropy does not decay. The
 * dialogue advances on the player's taps, never on the simulation, so the
 * numbers the scene talks about are the numbers the player last saw rather
 * than the ones the conversation drifted past. The room shows the same fact —
 * the floor's ambient life freezes on the frame the scene opened (see
 * `room.animate`'s `frozen`), because a studio that keeps visibly working
 * through a conversation is one the pause has not happened to.
 *
 * The one thing that still runs is cosmetic expiry: floaters and bubbles
 * measure their life in wall-clock, and a numeral frozen mid-air for the
 * length of a scene would be a visual bug that outlives the dialogue.
 *
 * §10.7's release ring stops it on exactly the same terms and for exactly the
 * same reason: the player is being asked for a decision, and a decision made
 * while payroll is still draining is a decision made under a clock the player
 * did not agree to. The ring has no timeout of its own to fire here — it runs
 * its four years on the player's screen, and closing it is always allowed.
 */
export function tick(dtSeconds: number): void {
  if (dtSeconds <= 0 || state.phase === 'bankrupt') return

  if (state.scene !== null || state.launching) {
    const now = performance.now()
    const patch: Partial<GameState> = {}
    const floaters = state.floaters.filter((f) => now - f.bornAt < FLOATER_LIFE_MS)
    if (floaters.length !== state.floaters.length) patch.floaters = floaters
    if (state.bubble && now - state.bubble.bornAt > state.bubble.ttl) patch.bubble = null
    if (Object.keys(patch).length > 0) set(patch)
    return
  }

  const e = currentEntropy()
  const localEntropy = decayLocalEntropy(state.localEntropy, dtSeconds)
  // §4.5a — the buffs fade before they are integrated, so a poke pays for the
  // frame after it and not for the frame it happened on. That frame's value is
  // the instant payout `poke` already banked.
  const decayed = decayBuffs(state.buffs, dtSeconds)
  const buffs = decayed.buffs
  // NOT `currentEffectiveVelocity` — see its note. `currentVelocity` carries
  // §4.5a's buffs because they are a real rate; `pokeRate` is display only and
  // its Story Points were banked by `poke` at the moment of the tap.
  // §4.5d — your own desk, added rather than multiplied in. It is outside the
  // §4.1 curve entirely, which is the whole point of the section: this is the
  // one term that does not fall when the studio does.
  const gained =
    currentVelocity({ ...state, localEntropy, buffs }) * dtSeconds +
    founderPassiveVelocity() * dtSeconds
  // What the buffs that just expired had left to give — see `decayBuffs`. The
  // last few per cent of a poke, paid rather than swallowed, so what a tap is
  // worth does not quietly depend on how big the studio was when it landed.
  const settled = settleDroppedBuffs(decayed.dropped, { ...state, localEntropy })

  // §22.8 — what the heroes do, resolved once and shared by everything below.
  refreshHeroFold()
  const heroes = state.heroFold

  // §21.0c — Run 1 has one lever and it is hiring. The three backlogs are a
  // system, and a system arriving during the four minutes §21 spends teaching
  // one sentence is a second sentence.
  const open = currentUnlocks().simulated

  // §4.12a — a downed release does not age, does not earn, and does not page.
  // Computed before the tail so all three agree about the same frame.
  const held = suppressedReleases(state.incidents)

  // §4.10e — the back catalogue pays first, before anything reads the cash.
  const tail = advanceTail(state.releases, dtSeconds, held)

  // §4.12 — defects accrue from the work itself, in proportion to it. Charged
  // against `gained`, which is realised output *after* §4.1: a studio in §6.3's
  // lock produces nothing and therefore breaks nothing.
  //
  // §22.8 — and Mo's Quality branch slows the arrival, applied to the velocity
  // the rate is charged against rather than to the backlog. That is the honest
  // place for it: quality work means fewer defects *written*, not defects
  // deleted after the fact, and charging it here keeps `defectsFromPoke` and
  // this on one curve.
  const defects = open
    ? advanceDefects(
        state.defects,
        // §13.7.1 — and you, at MANAGEMENT_DILUTION of what Mo does. Applied to
        // the same velocity the hero fold is, so Taste and the Quality branch
        // compose rather than being two rules about one number.
        (gained / dtSeconds) * heroes.defects * founderOf().defectScale,
        dtSeconds,
      )
    : 0

  // §4.12a — the released catalogue pages you, weighted by who is still playing.
  const incidents = open
    ? advanceIncidents(
        state.incidents,
        incidentRate(tail.releases, densitiesOf(tail.releases), held),
        // §13.7.1 — you carry the pager until Serena's rota does. Without the
        // founder term `clearanceCapacity(0)` is zero, an incident never closes,
        // and a frozen release never comes back: a fail state, which §4.12 forbids.
        clearanceCapacity(oncallHeads(state)),
        dtSeconds,
        state.incidentPending,
        nextIncidentId,
        tail.releases,
        heroes.incidentStartWork,
      )
    : { incidents: [] as Incident[], pending: 0, cleared: 0, restored: [] }
  // Ids only ever increase, so the high-water mark is the whole bookkeeping.
  // Deriving it from the returned list rather than counting arrivals means a
  // change to how `advanceIncidents` raises them cannot silently start reusing
  // an id, which §4.15's chip stack keys on.
  for (const i of incidents.incidents) nextIncidentId = Math.max(nextIncidentId, i.id + 1)

  // §4.13 — and the people who bought them write in, forever.
  //
  // §22.8 — Matt's help desk answers them, and KNOWS THEIR NAMES slows the
  // arrivals separately below (`heroes.ticketRate`).
  const support = supportHeads(state)
  const tickets = open
    ? advanceTickets(
        state.tickets,
        state.projectsShipped,
        defects,
        support,
        dtSeconds,
        heroes.ticketRate,
      )
    : { queue: 0, served: 0 }

  // §4.13 — unanswered tickets tax the **catalogue**, never the current
  // project. You are losing money on the games you already made, which is the
  // whole sentence, and a player in trouble can always still ship their way out.
  //
  // Exactly 1 during Run 1, which is the same number a studio keeping up gets:
  // §21's economy was tuned against an untaxed catalogue and must stay tuned.
  const ticketTax = open ? catalogueMultiplier(tickets.queue, support) : 1

  // §21.7.3, Matt — the queue is "unserved" while the studio is falling behind:
  // arrival outruns capacity (§4.15's bar reads below 1). Tracked as a running
  // clock so the trigger can demand a *sustained* period rather than a spike.
  const fallingBehind =
    open && serviceRatio(state.projectsShipped, defects, support) < 1
  const ticketsUnservedFor = fallingBehind ? state.ticketsUnservedFor + dtSeconds : 0

  // §21.7.3, Billy — the same shape as Matt's clock, on §4.1 instead of §4.13.
  //
  // `structuralEntropy` rather than `e`: the hero fold and §11.2's ceilings are
  // in it, because a studio that bought its way out of the collapse has
  // genuinely got out of it and must not be handed a scene about a collapse it
  // is not having — and §18.0's event ceiling is *not*, because an event is
  // weather. See the function's own note for the walk failure that established
  // the difference.
  const syncHalvedFor = structuralEntropy(state) >= SYNC_HALVED ? state.syncHalvedFor + dtSeconds : 0

  let patch: Partial<GameState> = {
    localEntropy,
    buffs,
    defects,
    incidents: incidents.incidents,
    incidentPending: incidents.pending,
    tickets: tickets.queue,
    ticketsUnservedFor,
    syncHalvedFor,
    // §11.2 B2's meeting clock. Simulated seconds, not wall-clock — see the
    // field's note. Advanced before anything reads it so the standup boundary
    // lands on the same frame the velocity does.
    runSeconds: state.runSeconds + dtSeconds,
    // §10.11 — the project's build time and its labour (§10.11.2). Labour is
    // the raw headcount, not the working headcount and not efficiency-adjusted.
    projectSeconds: state.projectSeconds + dtSeconds,
    projectLabourSeconds: state.projectLabourSeconds + state.devs * dtSeconds,
    // §4.14 — the other integral. `e` is this frame's §4.1 entropy and
    // `localEntropy` is §4.9's context switch, so what accumulates here is the
    // efficiency of a developer who is both diluted *and* being poked at. The
    // player's thumb is a source of the disorder this term measures, which is
    // §4.5a's trade finally stated in both currencies rather than only the
    // flattering one.
    projectFlowSeconds:
      state.projectFlowSeconds + devEfficiency(1 - e, localEntropy) * dtSeconds,
    // Exponential decay towards zero. Paired with the impulse `poke` adds, this
    // settles on the player's true taps-per-second rather than spiking on each
    // one — a readout that jumped to a huge number and back on every tap would
    // be unreadable at the rate §21 asks them to tap.
    pokeRate: state.pokeRate * Math.exp(-dtSeconds / POKE_RATE_TAU),
    dev: advanceDevState(state.dev, dtSeconds, {
      entropy: e,
      // §11.3 C2 — the chairs only shorten the lockup, never Flow.
      overwhelmedScale: techOf().overwhelmedScale,
      // §13.2 L1-3A — nobody goes rogue in a zero-trust codebase.
      zeroTrust: zeroTrustActive(getPermanent().layer1.paradigmLevels),
    }),
    // §7.8.9 — the floor's away population, advanced on the same clock as
    // everything else it now costs. Fed the *studio's* entropy rather than the
    // poked developer's local number: who wanders off is a fact about the
    // company, and §4.3 is the company's number.
    slack: advanceSlack(state.slack, dtSeconds, {
      devs: Math.floor(state.devs),
      entropy: e,
      slackShare: techOf().slackShare,
      blocked: techOf().slackBlocked,
      // §21.7.0 — James does not wander off. Ever.
      pinned: JAMES_PINNED,
    }),
    // §13.7.1's Support spine — "the work you do personally also earns cash",
    // which has to include the work you do while not tapping, or the node would
    // quietly be a tap bonus wearing a sales node's name.
    cash:
      state.cash -
      currentPayroll() * dtSeconds +
      tail.earned * ticketTax +
      founderPassiveVelocity() * dtSeconds * founderOf().cashPerPoint,
    lifetimeRevenue: state.lifetimeRevenue + tail.earned * ticketTax,
    releases: tail.releases,
    burned: gained + settled > 0 ? state.burned.plus(gained + settled) : state.burned,
  }

  const now = performance.now()
  const floaters = state.floaters.filter((f) => now - f.bornAt < FLOATER_LIFE_MS)
  if (floaters.length !== state.floaters.length) patch.floaters = floaters

  if (state.bubble && now - state.bubble.bornAt > state.bubble.ttl) patch.bubble = null

  // §10.7 — the queue's clock: Serena's auto-ship fires if it is owed.
  patch = { ...patch, ...advanceBelt({ ...state, ...patch } as GameState, dtSeconds) }

  // §10.7 — the burn-down reaching zero finishes the *build*, which goes onto
  // the belt. Releasing it is a separate decision, made at SHIP!.
  const merged = { ...state, ...patch } as GameState
  if (merged.burned.gte(merged.commitment) && !shelfBlocked(merged)) {
    patch = { ...patch, ...finishBuild(merged) }
  }

  const after = { ...state, ...patch } as GameState
  const bankrupt = isBankrupt(after.cash)

  patch.phase = advanceOnboarding(after.phase, {
    seedTaken: after.seedTaken,
    pokeCount: after.pokeCount,
    /*
     * §21.0b [2026-09-04] — **the working headcount, not the counter.**
     *
     * `act1_james` waits on `devs >= 1`, and it means *"is somebody at a desk
     * writing code yet"*. That used to be the same number as the counter
     * because James was hired as developer zero; he is outside the twenty now,
     * so the counter reads nought through the whole of Act I while a man sits
     * behind the glass shipping games. Passing the counter here stalls the act
     * on its second beat and the run never reaches §4.1's trap.
     */
    devs: codingHeads(after),
    projectsShipped: after.projectsShipped,
    cash: after.cash,
    entropy: currentEntropy(after),
    bankrupt,
  })

  // §18.0 — the clock on whatever is happening. Aged inside the patch rather
  // than after it, so the card's timer and the frame's output describe the same
  // instant.
  if (state.event) patch.event = ageEvent(state.event, dtSeconds)

  set(patch)
  // §21.0b — after `set`, because the beat reads the phase the machine just
  // moved to and grants a hire, which is a second write. Running it inside the
  // patch would mean composing a hire into a partial state that has not been
  // published yet, and `hire` reads `state` for the roster.
  advanceAct1(after.phase, patch.phase)
  // §21.7.3 — after `set`, so the snapshot reads the frame's final state.
  checkStoryTriggers(getState())
  checkShipTutorial(getState())
  // §18.0 — and last, so an event can never land on top of an arrival scene
  // that was raised on this same frame.
  checkEventTriggers(getState())
}

/**
 * §21.0b / §21.7 — Act I's one story beat, which is a hire rather than a banner.
 *
 * Something happens here that happens nowhere else in the game: **somebody is
 * given to the player for free.** That is §21.7's rule — *a hero arrives the
 * first time you feel the problem they solve* — applied to the only problem Act
 * I has, which is being alone.
 *
 * **Instant Messenger used to be given here too, and it is not any more.**
 * §21.0c moves it back to Run 2, where §21.6 always had it. The reasoning that
 * moved it forward was sound about the joke — the player *is* sitting side by
 * side with James, at two desks, on screen — and wrong about everything else: it
 * put an upgrade tree, a free node and a second cutscene inside the four minutes
 * §21 spends teaching one sentence, and it handed away the root of a board the
 * player could not open. The joke survives the move intact, because in Run 2
 * they are still sitting side by side.
 *
 * Driven off the phase *transition* rather than off the phase, so it fires
 * exactly once even though the machine can sit in a phase for thousands of
 * frames.
 */
function advanceAct1(from: Phase, to: Phase | undefined): void {
  if (to === undefined || to === from) return

  if (to === 'act1_james' && state.devs === 0) {
    // §21.7.1 — the scene opens on `APPLICANT AT DOOR.` with the desk still
    // empty. The hire itself is {@link grantJames}, called from the dialogue
    // when it reaches {@link JAMES_DROPS_AT_LINE}, so the beat is "the door,
    // then the drop, then the conversation" rather than a scene played over a
    // developer who is already there.
    set({ scene: SCENE_JAMES_ARRIVES.id })
  }

  // §21.0d [amended 2026-08-27] — **the mousetrap is a conversation first, and
  // a decision second.**
  //
  // Act III used to open on a banner, a sarcastic advisor line and a button the
  // player pressed. §21.0d then moved the whole transaction *into* the scene —
  // James argued for it, correctly, and signed it at the line that no longer
  // exists — so the trap could not be declined. The amendment keeps the
  // conversation and gives the decision back: the scene now ends on the pitch
  // and the offer button on the rail (`offerFor`) is what hires the thousand
  // people, on the player's tap, after the dialogue has closed. Fired off the
  // phase *transition* for the same reason the arrival is — the machine can sit
  // in a phase for thousands of frames and the scene must happen once.
  //
  // **Run 1 only, and the guard is load-bearing rather than tidy.** `freshRun`
  // resets `phase` to `act1_poke`, so §21's act machine runs again on every
  // subsequent run — and it used to walk every one of them back through
  // `act3_bait` at forty developers. A pitch reappearing there would be noise
  // over every run in the game, for ever. Found by `pacing.test.ts` on the
  // first measurement after this landed, which is the third time that harness
  // has caught something nothing smaller could see.
  //
  // §21.0e closed the other half of it: `act2_loop` is terminal now, so no run
  // after the first reaches this phase at all. The guard stays, because a jump
  // seam and a loaded save can both put a prestiged career here and neither
  // goes through the act machine to do it.
  if (to === 'act3_bait' && !state.massHired && getPermanent().meta.paradigmShifts === 0) {
    set({ scene: SCENE_MASS_HIRE.id })
  }
}

/**
 * §21.7.1 — James falls in, exactly like any other hire.
 *
 * Fired by the dialogue box when it reaches {@link JAMES_DROPS_AT_LINE}, so the
 * `APPLICANT AT DOOR.` beat holds before the drop. Idempotent: he is free and
 * he is granted once, and §4.10a's payroll starts at the third head, so this
 * costs the economy nothing.
 */
/**
 * §21.0b — James turns up free at the fiftieth poke.
 *
 * **[amended 2026-09-04] He is not a hire, and this used to hire one.**
 *
 * `set(hire(0, 1, 'dev'))` is what this said, so the beat that introduces James
 * conjured the studio's first *ordinary* developer: `devs` went nought to one,
 * §7.7.2's arrival dropped a body onto floor seat 0, and the room drew James at
 * his desk behind the glass. One event, two people — reported four times, and
 * every fix before this one moved the second body instead of asking why there
 * were two.
 *
 * He now arrives into the leadership corner and nowhere else. The arrival is
 * already recorded by the scene's own milestone, which is what
 * {@link arrivedHeroes} reads, so there is nothing to hire and nothing to set —
 * {@link jamesHead} is what makes him count from that moment.
 */
export function grantJames(): boolean {
  if (state.devs !== 0 || arrivedHeroes().has('james')) return false
  return true
}

/** §21.7.3 — the hero each arrival scene is about, and the scene it plays. */
const HERO_SCENE: Record<HeroId, string> = {
  james: SCENE_JAMES_ARRIVES.id,
  mo: SCENE_MO_ARRIVES.id,
  serena: SCENE_SERENA_ARRIVES.id,
  matt: SCENE_MATT_ARRIVES.id,
  melany: SCENE_MELANY_ARRIVES.id,
  billy: SCENE_BILLY_ARRIVES.id,
}

/**
 * §21.0f — James explains SHIP! the first time there is something to ship.
 *
 * Run 1 only, and only while the player has shipped nothing: a career that has
 * already put a build on sale has learned the key the way the advisor line
 * teaches it, and a Run 2 that reaches its first shelf should not be walked
 * through the button again. He has to be at his desk, so a build that finishes
 * before the fiftieth poke simply waits on the shelf and the lesson lands the
 * moment he arrives. Idempotent through the milestone, like every scene.
 */
function checkShipTutorial(s: GameState): void {
  if (s.scene !== null || s.shelf.length === 0 || s.projectsShipped > 0) return
  if (getPermanent().meta.paradigmShifts > 0) return
  if (hasSeenScene(SCENE_JAMES_SHIP.id) || !arrivedHeroes().has('james')) return
  showScene(SCENE_JAMES_SHIP.id)
}

/**
 * §21.7.3 — the one rule, asked every tick.
 *
 * A hero arrives the first time the player feels the problem they solve. The
 * predicate is pure; this builds its snapshot, and the `milestones` union
 * (§24.3) makes it fire once — {@link showScene} is idempotent and
 * {@link dismissScene} records the scene as seen.
 *
 * §21.0c puts a floor under it: the whole ladder is Run 2+, because the
 * systems each trigger reads are all gated behind the first shift already.
 */
function checkStoryTriggers(s: GameState): void {
  if (getPermanent().meta.paradigmShifts <= 0) return
  if (s.scene !== null) return

  const snapshot: StorySnapshot = {
    paradigmShifts: getPermanent().meta.paradigmShifts,
    releases: s.releases.map((r) => ({ defectDensity: r.defectDensity })),
    hasIncident: s.incidents.length > 0,
    tickets: s.tickets,
    ticketsUnservedFor: s.ticketsUnservedFor,
    devs: s.devs,
    devCap: effectiveDevCap(s),
    cash: s.cash,
    // The organisation's own reading, matching the clock beside it. Both halves
    // of Billy's predicate must be the same number or it can be half true.
    entropy: structuralEntropy(s),
    syncHalvedFor: s.syncHalvedFor,
  }

  for (const hero of ARRIVAL_HEROES) {
    const predicate = arrivalPredicate(hero.id)
    const sceneId = HERO_SCENE[hero.id]
    if (predicate && predicate(snapshot) && !hasSeenScene(sceneId)) {
      showScene(sceneId)
      return
    }
  }

  /*
   * §21.8 — **the planet is full.** After the people, before the boards.
   *
   * It is a headcount and not a feeling, which is the one place §21.7.3's rule
   * genuinely does not apply — and the reason is that the feeling and the
   * headcount are the same event here. `frames.globeRadius` derives a hundred
   * million from the tiling rather than choosing it, so at `WORLD_CAP` the
   * player has literally nowhere to put the next desk: the thing they would be
   * told is the thing the screen is already showing them.
   */
  if (!hasSeenScene(SCENE_JAMES_PROXIMA.id) && s.devs >= WORLD_CAP) {
    showScene(SCENE_JAMES_PROXIMA.id)
    return
  }

  // §21.7.7 — the two boards, after the people. A person walking through a door
  // outranks a screen becoming available, so the arrivals are asked first and
  // this only runs on a frame where nobody did.
  checkBoardTriggers(s)
}

/**
 * §21.7.7 — the founder's board, on a feeling; then James's promotion.
 *
 * Same contract as {@link checkStoryTriggers}: the predicates are pure, this
 * builds the snapshot, and `milestones` makes each fire once.
 */
function checkBoardTriggers(s: GameState): void {
  if (s.scene !== null) return

  const snapshot: BoardSnapshot = {
    paradigmShifts: getPermanent().meta.paradigmShifts,
    founderRate: founderVelocity(),
    swarmRate: baseVelocity(s),
    devs: s.devs,
  }

  if (!hasSeenScene(SCENE_FOUNDER_BOARD.id) && founderBoardArrives(snapshot)) {
    showScene(SCENE_FOUNDER_BOARD.id)
    return
  }

  // §21.7.4 — the promotion. Last, because it is the one beat in the arc that
  // is about a decision the player made rather than about a system arriving.
  if (!hasSeenScene(SCENE_JAMES_PROMOTED.id) && jamesPromoted(arrivedHeroes())) {
    showScene(SCENE_JAMES_PROMOTED.id)
  }
}

// ---------------------------------------------------------------------------
// Events — GDD §18, §18.0
// ---------------------------------------------------------------------------

/**
 * §18.0 — has this event already been resolved for good?
 *
 * A milestone, never a flag. §21.7.6c's reasoning, applied to the third thing
 * in the game that needs to remember something once and for ever.
 */
export function eventRetired(id: string): boolean {
  return getPermanent().meta.milestones.includes(retiredMilestone(id))
}

/**
 * §18.0 — should something be happening?
 *
 * Asked once a frame off the same tick that asks §21.7's arrivals, and after
 * them: an event is the loop pushing back, and a person walking through a door
 * is the loop being kind. On a frame that could do both, the person wins.
 */
function checkEventTriggers(s: GameState): void {
  if (s.scene !== null) return
  const due = eventDue({
    paradigmShifts: getPermanent().meta.paradigmShifts,
    devs: s.devs,
    // §11.5 — the granted centre is not a purchase, so it does not count as
    // evidence that this player has ever opened the board.
    techNodesBought: upgradesBought(s),
    live: s.event !== null,
    retired: eventRetired,
  })
  if (!due) return

  set({ event: beginEvent(due) })
  // The scene plays once, ever. A second firing — which only a player who
  // hand-cleared the first one can reach — opens straight onto the card, which
  // is the right register for a thing that is happening again.
  if (due.scene && !hasSeenScene(due.scene)) showScene(due.scene)
}

/**
 * Upgrades the player has *bought* this run, in every tree — §18.0a's THE THREAD
 * waits for a studio with none, and the shift's lesson asks it.
 *
 * The roots are not purchases (Instant Messenger is handed over in a scene), so
 * this counts levels bought: the unwired tree nodes and Serena's pipeline.
 */
export function upgradesBought(s: GameState = state): number {
  let n = 0
  for (const level of Object.values(s.treeLevels)) n += level
  for (const level of Object.values(s.pipelineNodes)) n += level
  return n
}

/**
 * §18.0 — the player has chosen an exit; the card gives way to a banner.
 *
 * The event does **not** end here. Routing is the difference between "I have
 * not looked at this yet" and "I know, I am dealing with it", and the studio
 * stays at its ceiling either way.
 */
export function acknowledgeEvent(): boolean {
  if (!state.event || state.event.routed) return false
  set({ event: routeEvent(state.event) })
  return true
}

/**
 * §18.0 — one reply, by hand.
 *
 * The exit that is always available and never priced in money. It ends *this*
 * instance and leaves the cause in place, so a player who taps their way out of
 * THE THREAD with an empty board will meet it again — which is what makes the
 * purchase the better answer without ever making the tap a wrong one.
 */
export function clearEventByHand(): boolean {
  if (!state.event) return false
  const next = clearOne(state.event)
  set({ event: next })
  if (next === null) saveGame()
  return true
}

/**
 * §18.0 — the intended exit fired. Retire the event for the whole career.
 *
 * Called from the transaction that resolves it rather than from the interface
 * that offered it (trap 33), and idempotent: a player who buys two nodes on the
 * same frame retires the event once.
 */
function resolveEventBy(resolution: 'tech-purchase'): void {
  const def = definitionOf(state.event)
  if (!def || def.resolvedBy !== resolution) return

  const permanent = getPermanent()
  const mark = retiredMilestone(def.id)
  if (!permanent.meta.milestones.includes(mark)) {
    setPermanent({
      ...permanent,
      meta: { ...permanent.meta, milestones: [...permanent.meta.milestones, mark] },
    })
  }
  set({ event: null })
  // The payoff belongs to this exit alone (§18.0a) — twenty taps ends a thread,
  // a protocol ends threads — so the scene is only played from here.
  if (def.resolvedScene && !hasSeenScene(def.resolvedScene)) showScene(def.resolvedScene)
}

/** The event on the floor, and what it is — for the HUD, resolved in one place. */
export function currentEvent(s: GameState = state) {
  const def = definitionOf(s.event)
  if (!def || !s.event) return null
  return { live: s.event, def }
}

/**
 * What a tap landed on — GDD §4.5b, §7.7.1.
 *
 * A rung and which unit at it. In the room that is a seat; above it a floor, a
 * building, a town. `units.ts` turns the pair into the seats it covers.
 */
export interface PokeTarget {
  rung: number
  index: number
}

/**
 * How much of a poke is paid on the frame of the tap — GDD §4.5a.
 *
 * > The one-off payout does not vanish entirely, because instant feedback on a
 * > tap is non-negotiable (10.8 F2). It is now the *smaller* half of what a poke
 * > does, and the buff is the larger.
 *
 * A quarter is unambiguously the smaller half. **It is not a balance knob** —
 * the other three quarters are converted into a buff that pays them back over
 * {@link BUFF_TAU}, so moving this changes when a poke arrives and never what
 * it is worth.
 */
export const POKE_PAYOUT_SHARE = 0.25

/**
 * What a chained row gets, as a share of what the poked unit got — §13.2 L1-2B.
 *
 * A first guess, and marked as one. A half is the largest number that keeps the
 * node an *amplifier* rather than a replacement for aiming: at 1.0 the player
 * stops caring which unit they hit, which would delete §4.5c's "who you poke
 * matters" for anyone who bought it. Wants play-testing against §4.9a's spread.
 */
export const CHAIN_SHARE = 0.5

/**
 * Resolve one tap — the whole clicker layer, GDD §4.5, §4.5a, §4.5b.
 *
 * `target` is the unit that was under the thumb. Defaulting it to one
 * developer at rung 0 is what `poke(x, y)` means for the §23.3 bench and for
 * Run 1's simulation: the founder's own desk, one person, §4.8's L1 yield.
 *
 * **The formula below is §4.5's, unchanged.** §4.5a is explicit that "4.7's dev
 * states still scale it, 4.6's Fibonacci ladder still sets the base, and 4.1's
 * Entropy still taxes it. What changes is the *destination* of the number." So
 * what changed here is the last third of the function: a quarter of the Story
 * Points are banked now, and the rest becomes a buff on the thing that was
 * poked.
 */
export function poke(x: number, y: number, target: PokeTarget | null = null) {
  // §10.6 says the swarm keeps simulating behind a panel, but the poke path is
  // inert while a scene is up: the dialogue box is eating those taps for its
  // own advance, and a tap that both advances a page and banks a Story Point
  // is the player being charged Entropy for reading.
  //
  // §10.7's ring is inert on the same argument: the studio is at the launch.
  // A full buffer is inert because nobody can code into it (`baseVelocity`).
  if (state.scene !== null || state.launching) {
    return { sp: 0, localEntropyAdded: 0, crit: false, quits: false }
  }
  if (shelfBlocked()) {
    nagFullShelf()
    return { sp: 0, localEntropyAdded: 0, crit: false, quits: false }
  }
  if (state.phase === 'bankrupt') {
    return { sp: 0, localEntropyAdded: 0, crit: false, quits: false }
  }

  const rung = Math.max(0, Math.floor(target?.rung ?? 0))
  const index = Math.max(0, Math.floor(target?.index ?? 0))

  // §21.7.0 rule 5 — James is at the gym, ten to eleven, every single day.
  // Poke his desk in that hour and he is not there; the desk says so. Seat 0 is
  // James (§7.8.7) and the room is the only rung with seats, so `rung === 0`.
  if (rung === 0 && index === 0 && state.devs > 0 && !jamesPresent(state.runSeconds)) {
    set(showBubble('He’s at the gym. Ten to eleven, every single day.', 5000))
    return { sp: 0, localEntropyAdded: 0, crit: false, quits: false }
  }

  // §7.8.6 rule 5 — **a poke beats ambience**, and it is the one rule of the old
  // ambient layer that survives 2026-08-26 untouched. It is now worth Story
  // Points rather than nothing, which makes it a better rule than it was: a tap
  // on somebody standing at the window sends them back to work, and the player
  // can see the velocity readout agree.
  if (rung === 0 && isAway(state.slack, index)) {
    set({ slack: pokeHome(state.slack, index) })
  }

  // §4.5b — the reach is the unit that was actually hit, not a zoom band. A tap
  // in the room lands on one person, which is what §7.7.6's "the actual
  // developer under the thumb" has always promised and what §4.8's row-shaped
  // blast radius quietly contradicted once §7.4a made rungs 0–2 all the room.
  const unitSize = Math.max(1, unitSizeAt(rung, index, state.devs))
  const seats = unitSeats(rung, index, state.devs)

  const base = resolvePoke({
    // §11.3's estimation sub-branch is the only thing that moves the ladder, so
    // the tree's tier wins wherever it is higher. `state.tier` stays as the
    // floor rather than being deleted: §24 already persists it, and a save from
    // before the tree existed carries a tier that was legitimately earned.
    tier: Math.max(state.tier, techOf().estimationTier),
    state: state.dev.state,
    zoom: state.zoom,
    efficiency: currentEfficiency(),
    devs: state.devs,
    unitSize,
  })

  // §4.9a — the tap is worth what the people you poked are worth, summed over
  // the unit and divided by its size because `resolvePoke` has already charged
  // for the reach. In the room that is exactly `developerShare(index)`.
  //
  // Applied to the Story Points only: the Entropy a context switch costs is a
  // fact about being interrupted, and a 10x Engineer is not cheaper to
  // interrupt than anybody else. If anything they are dearer, but that is
  // §4.5c's business.
  const unitWorth = seats.to > seats.from ? shareSum(state.runSeed, state.devs, seats.from, seats.to) : 1
  const result = { ...base, sp: (base.sp * unitWorth) / unitSize }

  // §4.5a — the destination. What the unit currently produces is what a
  // percentage has to be a percentage *of*, so the strength is solved against
  // it rather than picked; see `sim/buffs.ts`. A negative poke (a Rogue
  // Refactorer gives points back) is not a buff and is paid straight through.
  const unitOutput = state.devs > 0 ? (baseVelocity() / state.devs) * unitWorth : 0
  const banked = result.sp > 0 ? result.sp * POKE_PAYOUT_SHARE : result.sp
  const converted = result.sp > 0 ? result.sp - banked : 0
  const buffed = addBuff(state.buffs, { rung, index }, converted, unitOutput)

  /**
   * §13.2 L1-2B, Chained Poke Reaction — "a shockwave that wakes up 1
   * additional row of developers per level".
   *
   * The chain **adds** value rather than dividing the tap's. That is the
   * distinction between a prestige node and a rebalance: 500 BP has to buy
   * something, and a shockwave that made the person you actually poked weaker
   * would be a downgrade dressed as an unlock. Each neighbouring unit gets half
   * of what the target got, so the node is worth 1.5x, 2x, 2.5x at its three
   * levels — real, and short of doubling the clicker layer at level one.
   *
   * Neighbours are the *next* units along at the same rung, which in the room
   * is literally the next row of desks and above it the next building along.
   * Units past the end of the studio are skipped rather than clamped: buffing
   * seat range [n, n) is an entry in the overlay that decays to nothing while
   * occupying one of §4.5a's 64 slots.
   */
  const chainRows = chainedPokeRows(getPermanent().layer1.paradigmLevels)
  let buffs = buffed.buffs
  let chainOverflow = 0
  for (let k = 1; k <= chainRows; k++) {
    const neighbour = index + k
    if (unitSeats(rung, neighbour, state.devs).to <= unitSeats(rung, neighbour, state.devs).from) {
      break
    }
    const chained = addBuff(buffs, { rung, index: neighbour }, converted * CHAIN_SHARE, unitOutput)
    buffs = chained.buffs
    chainOverflow += chained.overflow
  }

  // §11.3 C1 — Nitro Cold Brew. `hasCultureUpgrade` was this effect before
  // there was a tree to own it, and it is still honoured: the field predates
  // §11 and a save that has it set earned it.
  const { machine, devLeaves: wouldLeave } = pokeDevState(
    state.dev,
    state.hasCultureUpgrade || techOf().flowSurvivesPoke,
  )

  /**
   * §22.3 — **LOYAL: never quits when poked.** James is seat 0 and he is the
   * one developer in the game who cannot be lost.
   *
   * This is canon and it was also a live bug. `dev` is one studio-wide state
   * machine, so it can enter `tenx` while the studio *is* James — and a poke
   * then cashed him out, leaving Act I with zero developers, a phase machine
   * already past the beat that grants him, and no way back. It reproduced
   * intermittently, because whether the machine is in `tenx` on the frame the
   * player happens to tap is a real dice roll.
   *
   * Guarded on the seat rather than on the headcount: "the last developer never
   * leaves" would be a different rule that happens to cover this case today and
   * would stop covering it the moment somebody is hired.
   */
  /*
   * §22.3 [amended 2026-09-04] — **and seat 0 is not James any more.**
   *
   * The exemption above was `seats.from > 0`, which spared floor seat 0 because
   * that seat was James. It is an ordinary hire now, and sparing them is a rule
   * nobody wrote: the player would find one developer, in one chair, who cannot
   * be cashed out, for no reason they could ever be told.
   *
   * The bug the exemption was added for cannot recur. It was *"a poke cashed
   * James out, leaving Act I with zero developers, a phase machine already past
   * the beat that grants him, and no way back"* — and Act I now runs at zero
   * `devs` with James outside them, so there is no longer a head to lose.
   */
  const devLeaves = wouldLeave

  const floater: FloatingNumeral = {
    id: nextFloaterId++,
    sp: result.sp,
    x,
    y,
    crit: result.crit,
    // Read from the state before the poke resolved, like the snippet below and
    // for the same reason: what you interrupted, not what you made of them.
    unblocked: state.dev.state === 'overwhelmed',
    bornAt: performance.now(),
    // Read from the state BEFORE the poke resolved: the line is what they were
    // doing when you interrupted them, not what your interruption made of them.
    snippet: snippets.next(state.dev.state),
  }

  const locked = isLocked()
  const desperateTaps = locked ? state.desperateTaps + 1 : state.desperateTaps

  // §4.5a — what lands now. The quarter this poke pays immediately, plus
  // anything the buff could not take: a unit already at the strength ceiling,
  // or a seized studio with no rate to raise. Nothing is lost in either
  // direction, which is what makes "a poke is worth what §4.5 says it is" an
  // invariant rather than an intention.
  // The chained rows' overflow is paid the same way the target's is — a
  // shockwave landing on a unit already at the ceiling still owes its points.
  const paidNow = banked + buffed.overflow + chainOverflow

  const patch: Partial<GameState> = {
    burned: state.burned.plus(paidNow),
    // §13.7.1's borrowed Quality spine — a manager who reads it back before
    // they speak costs the studio less concentration per interruption.
    localEntropy: state.localEntropy + result.localEntropyAdded * founderOf().contextSwitchScale,
    buffs,
    // The impulse half of the rate estimate. Dividing by the time constant is
    // what makes a steady R points per second converge on exactly R.
    pokeRate: state.pokeRate + paidNow / POKE_RATE_TAU,
    floaters: [...state.floaters, floater],
    pokeCount: state.pokeCount + 1,
    desperateTaps,
    dev: machine,
    // §4.12 — **interrupting somebody is how defects get written.** Charged on
    // the points this poke actually banked, at `β + ε` where ε is the same
    // context-switch coefficient §4.9 uses for Entropy, so a poked Story Point
    // carries twice the bugs of a passively-produced one.
    //
    // Charged on `paidNow` rather than on the poke's full value because the
    // rest arrives as a §4.5a buff, and the buff's points are ordinary work
    // that `tick` already charges at β. Charging the whole poke here would bill
    // three quarters of it twice.
    //
    // §21.0c — and not at all during Run 1, where the counter would be the
    // first system on screen and there is nobody to hire against it.
    defects: currentUnlocks().simulated
      ? state.defects + defectsFromPoke(paidNow)
      : 0,
    // The 10x Engineer quits permanently on the poke that cashes them out.
    devs: devLeaves ? Math.max(0, state.devs - 1) : state.devs,
  }

  // §6.3 — the thesis, delivered by the person being interrupted.
  if (shouldRebuke(desperateTaps, currentEntropy())) {
    Object.assign(patch, showBubble(REBUKE_LINE, 6000))
  } else if (state.pokeCount === 0) {
    // §21 Act I's first-poke teaching moment: establishes the Fibonacci ladder
    // in one line, with no tutorial box.
    Object.assign(patch, showBubble('It’s a one. Everything is a one right now.'))
  }

  set(patch)
  return result
}

/**
 * GDD §7.7.2–7.7.3 — the patch that makes a hire visible.
 *
 * Every path that changes headcount upward goes through here, so there is
 * exactly one place the ladder can be forgotten. The renderer reads `spawn`;
 * nothing else does.
 */
function hire(before: number, after: number): Partial<GameState> {
  return {
    devs: after,
    peakDevs: Math.max(state.peakDevs, after),
    spawn: {
      id: nextSpawnId++,
      bodies: spawnBurst(before, after),
      // The seats this hire actually took. Every path that changes headcount
      // upward goes through here, so this is the one place the range can be
      // wrong — and the one place it can be right.
      from: Math.max(0, Math.floor(before)),
      to: Math.max(0, Math.floor(after)),
      promotedTo: rungCrossed(before, after),
      bornAt: performance.now(),
    },
  }
}

/**
 * Add a free batch for the `?scenarios` instrument.
 *
 * This is deliberately beside {@link hire}: the testing control needs the
 * same SpawnEvent as a paid hire or it can only test a counter changing, not
 * the arrival, rung promotion and camera reveal that make adding developers
 * visible. It also keeps the studio above its cap and payroll while somebody
 * is inspecting the result; those are useful game constraints and noise in a
 * renderer instrument.
 *
 * The double underscore marks the same boundary as {@link __setState}. The
 * player-facing HUD never calls this and the only UI that does is gated by
 * `SCENARIOS_UP`.
 */
export function __addScenarioDevelopers(count: number): number {
  const requested = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0))
  const before = state.devs
  const added = Math.min(requested, Number.MAX_SAFE_INTEGER - before)
  if (added <= 0) return 0

  const after = before + added
  set({
    ...hire(before, after),
    devCap: Math.max(state.devCap, after * 2),
    cash: Math.max(state.cash, after * 1e6),
    // A dev instrument must not put its own result behind a script or event
    // scrim. `applyHeadcount` makes the same guarantee for absolute jumps.
    scene: null,
    event: null,
  })
  return added
}

/**
 * §14.1 — BP awarded by the most recent Paradigm Shift, for the screen that
 * announces it. Module state rather than game state: it belongs to the moment
 * rather than to the run, and a run that has just been replaced cannot hold it.
 */
let lastShiftBp = 0

export function bpFromLastShift(): number {
  return lastShiftBp
}

/**
 * §13.1 — what a Paradigm Shift is worth right now, and whether it is offered.
 *
 * §13.1's trigger row reads "Max Entropy stall / **Bankruptcy** / Forced
 * liquidation", and only the middle one was ever built: the shift lived on the
 * §21 Act V bankruptcy modal and nowhere else. That is one prestige per
 * playthrough, in a game whose entire second half is the loop — a player who
 * stalls at forty developers with a healthy treasury has no way out but to wait
 * to go broke.
 *
 * **Offered from the second run onward, and never during the first.** §21's
 * trap is the first run's whole argument and a visible escape hatch during Act
 * III is an invitation to skip it; by Act V the bankruptcy modal is the door.
 * After that the player knows what a shift is, so it is simply available —
 * `paradigmShifts` is the flag, and it is the same counter §24.5 already uses
 * to unlock offline accrual.
 *
 * The quote is live rather than computed on press. §14.1 pays on this run's
 * revenue and peak headcount, then reputation, so the receipt explains both
 * progress and quality before the player throws the run away.
 */
export interface ParadigmShiftOffer {
  /** New, spendable BP awarded by shifting now. */
  bp: number
  /** Formula result before reputation. */
  baseBp: number
  /** §4.14 quality contribution, itemised for the receipt. */
  reputationMultiplier: number
  /** This run's value after reputation. */
  grossBp: number
  available: boolean
}

export function paradigmShiftOffer(s: GameState = state): ParadigmShiftOffer {
  const p = getPermanent()
  // Explicit run-local inputs. The permanent high-water marks are a career
  // record, not an award balance: using them here re-paid the same success on
  // every empty reset. A shift clears both inputs, so this quote cannot be
  // claimed twice without playing another run.
  const baseBp = bpFor(s.lifetimeRevenue, Math.max(s.peakDevs, s.devs))
  const quality = prestigeMultiplier(s.reputation)
  const grossBp = Math.max(0, Math.floor(baseBp * quality))
  return {
    bp: grossBp,
    baseBp,
    reputationMultiplier: quality,
    grossBp,
    available: p.meta.paradigmShifts > 0 && s.phase !== 'bankrupt',
  }
}

/** §13.2 — has the player ever prestiged? The Paradigm Tree's door. */
export function hasPrestiged(): boolean {
  return getPermanent().meta.paradigmShifts > 0
}

/**
 * §21.0c — which systems this player has, and the only place that is asked.
 *
 * Not held in {@link GameState}: it is a fact about the *player*, not about the
 * run, and a copy of it in the run state would be a second thing that can
 * disagree with `paradigmShifts` after a save migration. Cheap enough to call
 * from `tick` — `getPermanent` is a module variable read, not a storage hit.
 *
 * §21.7.6 gave it a second input and therefore a cache. The result used to be
 * one of two frozen constants, which a React render could depend on by
 * identity; it now varies with the roster, so it is **memoised on the two
 * things it reads** rather than rebuilt per call. `tick` asks several times a
 * frame and the HUD asks once per component, so a fresh object each time would
 * churn every consumer on every frame for a value that changes six times a run.
 */
let unlocksCache: { key: string; value: Unlocks } | null = null

export function currentUnlocks(): Unlocks {
  const shifts = getPermanent().meta.paradigmShifts
  const arrived = arrivedHeroes()
  const key = `${shifts}|${[...arrived].sort().join(',')}`
  if (unlocksCache?.key === key) return unlocksCache.value
  const value = unlocksFor(shifts, arrived)
  unlocksCache = { key, value }
  return value
}

/**
 * §21.7.3, §21.7.6 — who has walked through a door.
 *
 * Derived from `milestones` rather than stored: an arrival *is* its scene
 * having been played, §24.3 already unions milestones across saves, and a
 * second list of who is on staff is a second thing that can disagree with the
 * first after a merge. §21.0c refused a new flag for exactly this reason and
 * the reason did not stop applying when the gate got finer.
 */
export function arrivedHeroes(): ReadonlySet<HeroId> {
  const seen = getPermanent().meta.milestones
  const out = new Set<HeroId>()
  for (const [id, sceneId] of Object.entries(HERO_SCENE) as [HeroId, string][]) {
    if (seen.includes(sceneId)) out.add(id)
  }
  return out
}

// ---------------------------------------------------------------------------
// Heroes — GDD §22.8, §13.8 [amended 2026-09-26]
// ---------------------------------------------------------------------------

/**
 * §22.8's roster, resolved — everybody who has walked through a door, in the
 * cast's order.
 *
 * Derived from `milestones` per call rather than cached: six object literals,
 * and a cache would be a second copy of the save to invalidate.
 */
export function heroRoster(): HeroRuntime[] {
  const arrived = arrivedHeroes()
  const out: HeroRuntime[] = []
  for (const hero of STORY_HEROES) {
    if (!arrived.has(hero.id)) continue
    const runtime = heroRuntime(hero.id)
    if (runtime) out.push(runtime)
  }
  return out
}

/** One hero, or null if they have not arrived. */
export function heroById(id: HeroId): HeroRuntime | null {
  return heroRoster().find((h) => h.id === id) ?? null
}

/**
 * §22.8 — what the heroes do for the studio, folded (`heroRoster.ts`).
 *
 * Every field is 1 (or 0) with nobody through the door — §13.6.7's "amplitude,
 * not gate" is enforced at the bottom of the stack.
 */
export function currentHeroFold(s: GameState = state): HeroFold {
  const heroes = heroRoster()
  if (heroes.length === 0) return NO_HERO_FOLD
  return heroFold(heroes, s.devs)
}

/**
 * Recompute {@link GameState.heroFold} and publish it if it moved.
 *
 * Called from `tick` and after a load. Compares before writing so a quiet
 * frame costs one comparison and produces no `set`, and therefore no render.
 */
function refreshHeroFold(): void {
  const next = currentHeroFold()
  const prev = state.heroFold
  if (
    next.cap === prev.cap &&
    next.defects === prev.defects &&
    next.incidentStartWork === prev.incidentStartWork &&
    next.oncallHeads === prev.oncallHeads &&
    next.ticketRate === prev.ticketRate &&
    next.supportHeads === prev.supportHeads &&
    next.standupHeads === prev.standupHeads &&
    next.operatingCost === prev.operatingCost
  ) {
    return
  }
  set({ heroFold: next })
}

/**
 * §22.9 — open somebody's card, or close whatever is open.
 *
 * Refuses a hero who has not arrived, so a stale id in a URL or a test cannot
 * open a card for somebody the player has never met.
 */
export function selectHero(id: HeroId | null): boolean {
  if (id !== null && !arrivedHeroes().has(id)) return false
  if (state.selectedHero === id) return true
  set({ selectedHero: id })
  return true
}

/** §13.2 — spend BP on a Paradigm Tree node. */
export function buyParadigmNode(id: string): boolean {
  const node = NODE_BY_ID.get(id)
  if (!node) return false
  const p = getPermanent()
  const level = p.layer1.paradigmLevels[id] ?? 0
  if (!canAfford(node, level, p.layer1.bp)) return false

  const levels = { ...p.layer1.paradigmLevels, [id]: level + 1 }
  setPermanent({
    ...p,
    layer1: {
      ...p.layer1,
      bp: p.layer1.bp - nodeCost(node, level),
      paradigmNodes: p.layer1.paradigmNodes.includes(id)
        ? p.layer1.paradigmNodes
        : [...p.layer1.paradigmNodes, id],
      paradigmLevels: levels,
    },
  })
  // §4.2 — the cap moves immediately. Buying capacity and not feeling it until
  // the next run would make the tree a shopping list rather than a decision.
  set({ devCap: devCapFor(levels) })
  saveGame()
  return true
}

/**
 * §13.2 — the permanent block, re-exported for the tree screen.
 *
 * It lives in `save.ts` and the interface has no business importing from there:
 * §24's document format is the store's private business, and a component
 * reaching past the store to read it is how a save-format change starts
 * breaking panels.
 */
export { getPermanent }

/**
 * §4.10a's growth base as the game will actually charge it, right now.
 *
 * **One function, because there are three callers and they must agree.**
 * `hireDial.ts` states the rule this exists to enforce — *"if a cost curve has
 * two entry points, both take the modifier or neither does"* — and it was
 * written after §13.7.1's Recruiting node spent a commit wired to `nextHireCost`
 * (what the HUD shows) and not to `quote` (what the game charges). There are two
 * modifiers on this curve now, the founder's tree and §14.8.9's cap
 * normalisation, and threading two modifiers through three call sites by hand is
 * the same bug waiting to be made twice.
 */
export function hireGrowthNow(s: GameState = state): number {
  return capAdjustedGrowth(founderOf().hireGrowth, effectiveDevCap(s))
}

/**
 * What the next developer costs right now — §21.0, and §13.7.1's Recruiting.
 *
 * The growth base comes from the founder's own tree, which is `meta` and
 * therefore **permanent across a Paradigm Shift**. That is the point of putting
 * the lever there: a run starts over with no people and no cash, and the one
 * thing it keeps is what you personally learned about hiring.
 */
export function nextHireCost(s: GameState = state): number {
  return hireCost(s.devs, hireGrowthNow(s))
}

export function canHire(s: GameState = state): boolean {
  return hireQuote(s).affordable
}

/**
 * §21.0a — accept the term sheet.
 *
 * The only beat in Run 1 that is pure upside, and it still has to be *taken*:
 * §6's lesson needs every step into the trap to have been a decision, including
 * the ones that felt like good news at the time. It is also the moment the
 * money stops being the player's — which is what makes Act V's bankruptcy land
 * on somebody else's investment rather than on their savings.
 */
export function takeSeedRound(): boolean {
  if (state.seedTaken) return false
  // §21.0a — signed on its own surface now (`TermSheet.tsx`), and only while the
  // offer is actually on the table. It used to be reachable from any beat that
  // had not taken it, which was harmless while the only caller was a button that
  // only that beat drew, and stops being harmless the moment a modal owns it.
  if (state.phase !== 'act2_termsheet') return false
  // §10.7a.3 — the scrim already eats the tap; this is the same rule at the
  // model level, so a call path that skips the UI cannot sign a term sheet
  // mid-conversation either.
  if (state.scene !== null) return false
  set({
    seedTaken: true,
    dialUnlocked: true,
    cash: state.cash + SEED_ROUND_CASH,
    // §21.0e — it said *"Wait, we can just… hire more people now?"*, which was
    // the right line when signing this unlocked §10.10's dial. Run 1 has no
    // hiring, so the founder reads the one line on the paper that will matter,
    // takes it at face value, and does not act on it. James does, ninety
    // seconds later, and never mentions where he got the idea.
    ...showBubble('It says the money is for headcount.', 6000),
  })
  return true
}

/**
 * §7.8.8 — select a developer, or clear the selection.
 *
 * Deliberately *not* a poke. §8.2's tap is the game's primary verb and fires
 * hundreds of times a session; selection is a different intent with a different
 * payoff, and giving the two the same gesture would mean either poking opened a
 * panel — unusable — or selection needed a mode.
 *
 * **It needed a mode** (§7.7.6b). The sentence above was written when the two
 * were told apart by how long the finger rested, and that is what was reported
 * as uncontrollable from a phone. Selection is now the neutral latch rather
 * than a slow tap — which is the same conclusion, reached by the player.
 */
/**
 * §7.8.9 — pick a developer up, in the simulation.
 *
 * The renderer owns the body in the player's hand; this owns what it costs.
 * Splitting them that way is what makes the drag survive a zoom: the penalty
 * is a fact about the roster, and the roster is here.
 *
 * **Nobody is refused.** §7.8.9's blockquote used to protect people
 * mid-behaviour on the argument that yanking somebody out of a conversation
 * reads as an interruption rather than a tidy-up. That was overruled on
 * 2026-08-26 — a minigame about dragging wanderers back cannot refuse to catch
 * the person who is walking away — and see `slackOff.ts` for the whole note.
 *
 * Lifting somebody who was *working* puts them on the roster, so it starts
 * costing on the frame the finger goes down. That is the point rather than a
 * side effect: the player can distract their own studio, and it is priced.
 *
 * **Except James — §21.7.0 rule 6.** He is not lifted, not for an instant, and
 * he says so. Returns whether the grab took, so the caller knows not to enter a
 * carry it is not going to get.
 *
 * The refusal *speaks* rather than doing nothing, and that is the whole design
 * of it: a press that silently fails is indistinguishable from a press that
 * missed, and the player's next move is to try harder.
 *
 * **The line is returned rather than shown**, because where it belongs is a
 * rendering decision and this file has no renderer. It goes over his head on
 * the floor (§7.8.6's bubble), not into §7.5's HUD: the HUD bubble is where the
 * studio talks to the player, and this is one man answering something done to
 * him. Putting it in the corner would make the player look away from the
 * developer who just refused to move, which is the wrong direction for a joke
 * whose entire subject is that he has not moved.
 */
export interface GrabResult {
  /** Did they leave their chair? */
  held: boolean
  /** What they said about it, if anything. Room bubble, not HUD. */
  says: string | null
}

export function grabDeveloper(seat: number): GrabResult {
  if (seat < 0 || seat >= Math.floor(state.devs)) return { held: false, says: null }
  if (JAMES_PINNED.includes(seat)) {
    return { held: false, says: jamesRefusal(Math.random()) }
  }
  set({ slack: liftSlacker(state.slack, seat, Math.random(), JAMES_PINNED) })
  return { held: true, says: null }
}

/**
 * §7.8.9 — put them down.
 *
 * `onDesk` is whether the finger was over a workstation. On one they sit down
 * and are producing again on the next tick; anywhere else they walk home and go
 * on costing until they arrive, which is the whole difference between this and
 * the teleport it replaced.
 */
export function releaseDeveloper(seat: number, onDesk: boolean): void {
  set({ slack: dropSlacker(state.slack, seat, onDesk, JAMES_PINNED) })
}

/** §7.8.9 — is this seat away from its desk? The renderer asks; the HUD may later. */
export function developerIsAway(seat: number, s: GameState = state): boolean {
  return isAway(s.slack, seat)
}

/** §7.8.9 — how many heads the floor is currently losing to slacking. */
export function awayCount(s: GameState = state): number {
  return awayHeads(s.slack)
}

export function selectDeveloper(index: number | null): void {
  const next = index !== null && index >= 0 ? index : null

  /*
   * §7.8.13 rule 3 — **the turn is theirs, and it lands somewhere else.**
   *
   * A selected developer rotates to face the camera and opens §7.8.8's
   * personnel record. A selected *hero* makes the same gesture and opens
   * §22.9's card instead, and that substitution is the moment the player learns
   * these are two different kinds of object rather than one object with better
   * numbers — which is the whole of R51 answered by a routing decision.
   *
   * **[amended 2026-09-04] and no rung selects a hero any more.**
   *
   * This said *"Seat 0 is James (§25.7.2's `developerAt`), and he is the only
   * hero on the floor by seat"*, and routed a tap on rung 0 index 0 to
   * `selectHero('james')`. §7.8.0's corner took him off the floor: seat 0 is an
   * ordinary hire, and opening James's card from their desk would name one
   * person and show another. All six heroes are selected by their desks now,
   * which is the rule the other five already followed.
   */

  if (next === state.selected) return
  set({ selected: next, selectedHero: null })
}

/** §7.8.8 — who is selected, generated on demand. Null if nobody. */
export function selectedIdentity(s: GameState = state): Identity | null {
  return s.selected === null ? null : developerAt(s.runSeed, s.selected)
}

/**
 * §7.7.6b — press a latch on the touch switch.
 *
 * Leaving GRAB drops whoever is in the player's hand — the renderer owns the
 * carry and watches the mode for exactly this, because a developer stuck
 * mid-air because the mode changed under them is the §7.7.6a failure with a new
 * cause. Leaving `inspect` closes the card for the same reason: the panel is a
 * consequence of the mode, so it should not outlive it.
 */
export function setTouchMode(latch: TouchLatch): void {
  const next = toggleTouch(state.touchMode, latch)
  if (next === state.touchMode) return
  set({ touchMode: next, ...(next === 'inspect' ? {} : { selected: null }) })
}

/** §10.10 — set the dial. Pure selection; nothing is bought until HIRE. */
export function setHireMultiplier(m: Multiplier): void {
  set({ hireMultiplier: m })
}

/**
 * What the dial is currently offering — count, price, and whether it is live.
 *
 * Derived rather than stored, because MAX's count changes on its own as cash
 * accrues (§10.10.1) and a stored copy would be one frame stale on the only
 * segment where that is visible.
 */
export function hireQuote(s: GameState = state): Quote {
  // A locked dial is pinned to one at a time, whatever the stored selection
  // says — a save carried across a Paradigm Shift must not hand a fresh Act I
  // player a x100 button.
  return quote(s.devs, s.cash, s.dialUnlocked ? s.hireMultiplier : 1, hireGrowthNow(s))
}

/**
 * §21 Act II and the §21.0 loop — hire developers, for money.
 *
 * Hiring used to be free, which quietly removed the whole of Act IIa: with no
 * cost there is no loop, no reason to ship, and no treasury to spend on the
 * trap. §21.0's "each hire is bought with money the player made, costs more
 * than the last, and *works*" needs all three clauses, and only the third was
 * true.
 *
 * Returns false rather than throwing or silently succeeding, so the caller can
 * say why. A hire the player cannot afford must not leave them poorer.
 */
export function hireDeveloper(): boolean {
  // §10.7a.3 — nothing is clickable while a scene is up. The scrim blocks the
  // HUD; this is the same rule at the model level, because `grantJames` —
  // which *must* hire mid-scene — is the one path that deliberately bypasses
  // it and it calls `hire` directly, not this.
  if (state.scene !== null) return false
  // §21.0e — Run 1 does not hire. Enforced here and not only in `actionFor`,
  // for the same reason the scene guard above is: the HUD is one caller of
  // this, and a rule that only the HUD knows is a rule the `?act=` seams, the
  // dev bar and the acceptance walk can all break without noticing. `massHire`
  // is the one deliberate exception and it has its own entry point.
  if (!currentUnlocks().manualHire) return false
  // §10.10 — the dial decides the batch. It reads 1 until the dial unlocks at
  // 25 developers, so Act I and Act II behave exactly as they did.
  const { count, cost, affordable } = hireQuote()
  if (!affordable || count <= 0) return false
  set({ ...hire(state.devs, state.devs + count), cash: state.cash - cost })
  return true
}

/** What the mousetrap costs — §21.0. Everything, by design. */
export function currentMassHireCost(s: GameState = state): number {
  return massHireCost(s.cash)
}

/**
 * Can the player actually spring the trap right now?
 *
 * §4.10a claimed the Mass Hire was "always affordable and always ruinous",
 * which is true of the *price* and not of the player: payroll runs continuously
 * and can empty the treasury faster than shipping refills it, so a studio can
 * sit in Act III with less than the minimum. The offer stays on screen, priced
 * and disabled — hiding it would delete the beat the whole act is built on.
 */
export function canMassHire(s: GameState = state): boolean {
  return !s.massHired && s.cash >= currentMassHireCost(s)
}

/**
 * §21 Act III/IV — the mousetrap, and it is no longer free.
 *
 * "Cost: FREE (Trial Promo)" made it a button rather than a decision, and §6
 * is explicit that the lesson needs the player to *choose* it. It now takes
 * the entire treasury: always affordable, always ruinous, and leaving exactly
 * zero buffer — which is what makes Act V's bankruptcy arrive in seconds
 * rather than needing a scripted nudge.
 *
 * **This is the decision, and it is the player's** [§21.0d amended 2026-08-27].
 * §21.0d once moved the transaction into the scene, where James signed it at a
 * fixed line and no button existed; the amendment ends the scene on the pitch
 * and makes the offer button — this function — the signature. It is what the
 * player taps *after* the dialogue has closed, which is the whole of "there
 * should be a button to trigger the hire, after the james dialog".
 */
export function massHire(): boolean {
  if (state.massHired) return false
  // §10.7a.3 — a *player's* decision cannot be made through a dialogue box.
  //
  // The pitch scene is up while the run is entering Act III, and the tap that
  // turns the page must not be the tap that spends a treasury: the button sits
  // behind the scrim until the conversation is over. This guard is the same
  // rule at the model level, so a path that skips the glass cannot spring the
  // trap mid-sentence either.
  if (state.scene !== null) return false
  const cost = currentMassHireCost()
  // The offer is priced at the whole treasury with a floor under it, so a
  // player whose treasury is *below* that floor cannot pay — and this was not
  // checked. Pressing it at $0 charged $50 and took them to -$50: a control
  // labelled "Cost: YOUR ENTIRE TREASURY" completing successfully against an
  // empty one. Every other spend in the game refuses; this one has to as well.
  if (state.cash < cost) return false
  set({
    ...hire(state.devs, state.devs + MASS_HIRE_COUNT),
    cash: state.cash - cost,
    massHired: true,
    ...showBubble('Wait — who’s writing this function?', 6000),
  })
  return true
}

/**
 * §21 Act V — the run ends and Layer 1 prestige unlocks.
 *
 * James survives the bankruptcy; every other developer is liquidated. For now
 * this restarts Run 1, because the prestige tree (§13) does not exist yet —
 * the button is wired to the right moment, not to the right destination.
 */
export function triggerParadigmShift(): void {
  const run = freshRun()
  // §14.1 — what this run was worth, computed before its revenue and peak are
  // cleared. `state.peakDevs` survives the Act V liquidation, so a player who
  // peaked at a thousand and shifts at two is still paid for the thousand.
  // Career maxima are committed beside the award for history/save merging; the
  // quote itself remains run-local and cannot be claimed from an empty reset.
  const before = getPermanent()
  const marks = {
    lifetimeRevenue: Math.max(before.meta.lifetimeRevenue, state.lifetimeRevenue),
    peakDevs: Math.max(before.meta.peakDevs, state.peakDevs, state.devs),
  }
  const earned = paradigmShiftOffer(state).bp
  lastShiftBp = earned

  /**
   * §15.1a — **what this reality was, read before it is thrown away.**
   *
   * Assembled here rather than in the component for the same reason `marks` above
   * is: every number on it belongs to the run that is about to stop existing, and
   * a screen that went looking for them afterwards would find the new one. The
   * lesson is a measurement of the same state (`lessons.ts`) and is taken on the
   * same frame, for the same reason.
   */
  const shiftNumber = before.meta.paradigmShifts + 1
  const learned = lessonFor({
    shift: shiftNumber,
    bankrupt: state.phase === 'bankrupt',
    load: state.devs / Math.max(1, effectiveDevCap(state)),
    cash: state.cash,
    reputation: state.reputation,
    techNodesBought: upgradesBought(state),
  })
  const ledger = ledgerWith(before.meta.lessons, learned)

  // §24.4 — a Paradigm Shift clears the run and touches nothing permanent
  // except Layer 1. §24.5 gates offline accrual on the first one, so the
  // counter is the unlock.
  setPermanent({
    ...paradigmShiftPermanent(before, earned, marks),
    // §15.1a — the ledger is permanent and monotonic, like `milestones`: a
    // lesson learned in reality 3 is still learned in reality 40. `ledgerWith`
    // has already folded this run's in and deduplicated, which is what makes the
    // list bounded by the catalogue rather than by how long somebody plays.
    meta: { ...paradigmShiftPermanent(before, earned, marks).meta, lessons: ledger },
  })
  set({
    ...run,
    // §4.2 — the cap the tree has bought, applied to the new run. Reading it
    // from `freshRun()` would hand every prestige back the base hundred.
    devCap: devCapFor(getPermanent().layer1.paradigmLevels),
    // "So. Same time tomorrow?"
    //
    // §21.6 leaves **one** person standing and his name is James
    // ({@link STARTING_DEVS}). It was two, and the second one was nobody: the
    // count said two, the roster drew two desks, and there is no line anywhere
    // in the game that says who the other survivor is. Reported as "there are 2
    // developers staying, should be just james".
    devs: STARTING_DEVS,
    /**
     * **Run 2 opens on the loop, not on the trap.**
     *
     * This said `act3_bait`, which meant a Paradigm Shift dropped the player at
     * Act III with no money: the mousetrap on screen, priced at a treasury they
     * did not have, and the only exit from that phase being `devs > 502`. There
     * is no way to hire five hundred people on nothing, so the offer sat there
     * greyed out **for ever** and the run could not advance. That is what "the
     * HIRE 1,000 DEVS button is always there" was.
     *
     * §21.6 is Run 2 *Act 0* — James arriving with Instant Messenger — and Act 0
     * is the start of a run, not its penultimate beat.
     */
    phase: 'act2_loop',
    projectsShipped: 1,
    /**
     * §4.10f [amended 2026-08-27] — **the catalogue restarts at the garage.**
     *
     * This used to carry a rung forward, so a studio that shipped a live-service
     * hero shooter opened the next run on *Untitled Roguelike Deckbuilder* and
     * never re-climbed the garage. Reported as "once paradigm shifted, the games
     * release titles should be reset back to beginning", and the report is right
     * about the fiction: §15.1a's cut scene has just said `REALITY 002 —
     * LIQUIDATED` over a receipt for everything this studio made, and the next
     * reality then opened on a title from the one that was liquidated. The
     * gallery is empty (§10.11), the treasury is empty (§13.2), the roster is
     * James — the marquee was the last thing still pretending otherwise.
     *
     * The spread stays rather than being left to `freshRun()`: *which game a
     * shift opens on* is a decision this function makes, and a decision only
     * visible as an absence is one the next reader has to reconstruct.
     */
    ...openingProject(run.runSeed),
    // §10.10.2 — "outside Run 1 the dial is simply present from the first
    // frame. The funnel is a first-run device and re-teaching it is an insult."
    // The seed round is the same: it is a story beat, and it has happened.
    seedTaken: true,
    dialUnlocked: true,
    // §15.1a — the cut scene, over the top of everything, before James speaks.
    // The report is run state so that this one `set` carries it; `freshRun()`
    // has just nulled it, which is why it is written after the spread.
    pendingShift: {
      shift: shiftNumber,
      bp: earned,
      revenue: state.lifetimeRevenue,
      peakDevs: Math.max(state.peakDevs, state.devs),
      shipped: state.projectsShipped,
      seconds: state.runSeconds,
      learned,
      ledger,
      nextProject: openingProject(run.runSeed).sprintName,
    },
    // §21.6 — Run 2 opens on James. The scene rather than the bubble carries
    // the beat now; the bubble stays for the runs after this one, when the
    // scene has already played and the line is all that is left of it.
    // §11.5 / §21.0c — and he arrives holding the thing. Instant Messenger is
    // the root of his tree, and the trees open with this shift (`techOf`).
    scene: SCENE_JAMES_INSTANT_MESSENGER.id,
    ...showBubble('So. Same time tomorrow?', 6000),
  })
  // §24.9 — a prestige is the highest-value write in the game. Do not wait for
  // a backgrounding that may never come.
  saveGame()
}

/**
 * §15.1a — the player has read the receipt; hand the studio over.
 *
 * Idempotent, and it does nothing else: the new run was already built by
 * {@link triggerParadigmShift}, and this only takes the screen off it. A cut
 * scene that also mutated the world would be a beat the player could lose by
 * closing the tab in the middle of it.
 */
/** §21.8 — the nine shots have played. See {@link GameState.pendingLaunch}. */
export function finishLaunch(): void {
  if (!state.pendingLaunch) return
  set({ pendingLaunch: false })
}

export function dismissShiftReport(): void {
  if (!state.pendingShift) return
  set({ pendingShift: null })
}

/**
 * Put a scene on screen — GDD §21.6.
 *
 * Idempotent for the scene already showing, because the phase machine can
 * satisfy a trigger on several consecutive frames and restarting a typed page
 * under the player's thumb is the worst possible failure of §10.7 rule 2.
 */
export function showScene(id: string): void {
  if (state.scene === id) return
  /*
   * §10.6b — **a conversation clears the desk.**
   *
   * Nothing the player had open survives the start of a scene. The two
   * selections live here rather than in the HUD, so this is where they are put
   * down: a personnel record or a hero's pass left standing behind §10.7's box
   * is a window the player cannot reach, over a studio that has stopped, with a
   * character talking across it. The HUD stands its own doors down on the same
   * rule — see `Hud.tsx` — and the store owns the half the HUD cannot see.
   *
   * Cleared *here*, at the one entrance to a scene, rather than in each of the
   * six places a scene is raised. §21.7.7e's guided boards open from
   * `finishDialogue`, which runs after `dismissScene`, so this never fights the
   * flow that hands a board over at the end of a beat.
   */
  set({ scene: id, selected: null, selectedHero: null })
}

/**
 * Dismiss the current scene and mark it seen.
 *
 * `milestones` is a monotonic union in permanent state (§24.3), so "seen" is
 * one of the few facts that survives a Paradigm Shift, a Codebase Fork and a
 * reinstall-with-cloud-save. That is deliberate: §10.7's faster replay is
 * per-line across runs, and a player on Run 40 who is made to sit through
 * James's introduction at full typing speed for the fortieth time will hate
 * the one thing this game is made of.
 */
export function dismissScene(): void {
  const id = state.scene
  if (!id) return
  const permanent = getPermanent()
  if (!permanent.meta.milestones.includes(id)) {
    setPermanent({
      ...permanent,
      meta: { ...permanent.meta, milestones: [...permanent.meta.milestones, id] },
    })
    // A scene is cheap to re-show and expensive to lose. Write now rather than
    // waiting for a backgrounding that may never come (§24.9).
    saveGame()
  }
  // §21.7.1 — if the arrival scene ever ends without James having dropped in
  // (a test harness that dismisses the box rather than tapping through it), he
  // is granted on the way out, so the run can never be parked at the empty
  // desk. In play the dialogue reaches {@link JAMES_DROPS_AT_LINE} first and
  // this is a no-op.
  if (id === SCENE_JAMES_ARRIVES.id && state.devs === 0) grantJames()
  // §21.8 — the scene ends on `STAND CLEAR OF THE FILING CABINET`, and the
  // launch is the next frame. Raised here rather than from the HUD so the two
  // cannot be on screen at once: `set` clears the box in the same update.
  const launching = id === SCENE_JAMES_PROXIMA.id
  set({ scene: null, pendingLaunch: launching || state.pendingLaunch })
}

/** Has this scene been played to the end before? §10.7's replay exception. */
export function hasSeenScene(id: string): boolean {
  return getPermanent().meta.milestones.includes(id)
}

export function setZoom(zoom: ZoomLevel): void {
  if (zoom !== state.zoom) set({ zoom })
}

/**
 * §7.7.1 — which rung the *camera* is on, as opposed to which one the studio
 * has earned.
 *
 * `zoom` is §7.4's tier and cannot answer this: tier 2 covers rungs 2 and 3,
 * and those two are the difference between standing on a floor and looking at
 * the building it is in. The HUD needs to tell them apart because the caption
 * under the touch switch is a lie above the room — it says "TAP ANY PERSON"
 * where there are no people, and says nothing at all about the gesture that
 * gets you back down to them.
 *
 * Set by the renderer on the frame the rounded rung changes, so it is a store
 * write on a camera *stop* rather than sixty a second.
 */
export function setCameraRung(rung: number): void {
  const next = Number.isFinite(rung) ? Math.max(0, Math.round(rung)) : 0
  if (next !== state.cameraRung) set({ cameraRung: next })
}

/** Test/debug seam — drives the dev-only dev-state selector. */
export function setDevState(devState: DevState): void {
  set({ dev: { state: devState, elapsed: 0 } })
}

export function __resetStore(): void {
  state = freshRun()
  nextFloaterId = 1
  nextSpawnId = 1
  nextBuildId = 1
  setPermanent(emptyPermanent())
  pendingSnapshot = null
  for (const fn of listeners) fn()
}

/**
 * Begin again from the landing screen. This is deliberately stronger than a
 * Paradigm Shift: run progress and permanent progression are replaced by a
 * clean studio. Install identity lives under its own key and is retained.
 */
export function startNewGame(): void {
  clearSave()
  state = freshRun()
  nextFloaterId = 1
  nextSpawnId = 1
  nextBuildId = 1
  nextShipId = 1
  nextReleaseId = 1
  setPermanent(emptyPermanent())
  pendingSnapshot = null
  for (const fn of listeners) fn()
  // Write the replacement immediately. Closing the app on the first frame of
  // the new run must not allow the erased studio to return.
  saveGame()
}

// --- persistence -----------------------------------------------------------
//
// GDD §24. The document lives in save.ts; this is the wiring. `game-cloud` is
// not connected — that needs Firebase credentials and is its own task — but
// `makeSaveData` is already exactly the `serialize` contract it will call, so
// the wiring is additive rather than a rewrite.

/**
 * The absence being reported, kept so the MONETISATION §4 R1 2x offer can be
 * *recomputed* rather than post-multiplied.
 *
 * Doubling `report.storyPoints` after the fact would be wrong the moment
 * chain-shipping is in play: twice the Story Points can ship a further project,
 * and a doubled total that ships one fewer game is a number the player can
 * catch us on.
 */
let pendingSnapshot: { savedAt: number; rateMultiplier: number; capSeconds: number } | null = null

/**
 * §10.7 — what an absence needs to know about the belt: who ships while nobody
 * is looking (Serena's clock), what is already waiting, and how many slots are
 * free. `sim/offline.ts` walks the rest.
 */
function offlineBelt(s: GameState): { autoShipSeconds: number; shelved: number; bufferRoom: number } {
  return {
    autoShipSeconds: pipelineOf(s).autoShipSeconds,
    shelved: bufferCount(s),
    bufferRoom: Math.max(0, shelfCapacity(s) - bufferCount(s)),
  }
}

/**
 * §10.7 — the queue, after the absence `report` describes.
 *
 * Serena's auto-ship took the waiting builds first, at her neutral launch; then the
 * projects the absence finished wait in the buffer for SHIP!, frozen as the
 * studio that built them — which is the studio the player left.
 */
function offlineBeltAfter(s: GameState, report: OfflineReport): Partial<GameState> {
  let now: GameState = s
  for (let k = 0; k < report.shelfShipped && now.shelf.length > 0; k++) {
    now = { ...now, ...releaseFrom(now, pipelineLaunch()) }
  }
  for (const index of report.built) {
    const at = Math.min(Math.max(0, index), PROJECTS.length - 1)
    const done = finishBuild({ ...now, projectIndex: at, commitment: commitmentFor(at, now) })
    const built = done.shelf?.[done.shelf.length - 1]
    if (built) now = { ...now, defects: 0, shelf: [...now.shelf, { ...built, shelvedAt: now.runSeconds }] }
  }
  return {
    shelf: now.shelf,
    defects: now.defects,
    releases: now.releases,
    history: now.history,
    reputation: now.reputation,
    projectsShipped: now.projectsShipped,
    // No `ship`: the reel is for a release the player watched go out, and the
    // §24.8 report is where an absence's releases are told.
    autoShipClock: 0,
  }
}

/** Write the save. Cheap enough to call on any beat worth not losing. */
export function saveGame(): boolean {
  return writeSave(makeSaveData(state))
}

/**
 * Load, and resolve the absence — §24.5.
 *
 * `now` is a parameter rather than a call to `Date.now()` so the whole path is
 * testable without touching the system clock, which is the one thing a save
 * system must be able to lie about in a test.
 *
 * Returns the §24.8 report if one should be shown, and null otherwise. The
 * yield is **not applied here**: it lands on collect, so the player sees where
 * the numbers went (§24.8).
 */
export function loadGame(now: number = Date.now()): OfflineReport | null {
  const save = readSave()
  if (!save) return null

  setPermanent(save.permanent)
  const { layer1, meta } = save.permanent
  const r = save.run

  const commitment = toDecimal(r.commitment, commitmentFor(r.projectIndex))
  const restored: GameState = {
    ...freshRun(),
    devs: r.devs,
    peakDevs: Math.max(r.devs, save.permanent.meta.peakDevs),
    // §4.2 — derived from the tree, never from the saved run. A cap read back
    // out of run state would silently keep whatever it was when the file was
    // written, so a node bought on another device would appear to do nothing.
    devCap: devCapFor(save.permanent.layer1.paradigmLevels),
    cash: r.cash,
    projectIndex: r.projectIndex,
    // Named below, once the belt it counts is restored (`projectTitle`).
    sprintName: '',
    commitment,
    burned: toDecimal(r.burned, new Decimal(0)),
    projectsShipped: r.projectsShipped,
    lifetimeRevenue: meta.lifetimeRevenue,
    hasCultureUpgrade: r.hasCultureUpgrade,
    tier: r.tier,
    pokeCount: r.pokeCount,
    desperateTaps: r.desperateTaps,
    phase: r.phase,
    // §21.0a — both were persisted and neither was read back, so a returning
    // player lost the dial and was offered the term sheet a second time. The
    // save has carried these since they existed; only the restore was missing.
    seedTaken: r.seedTaken,
    dialUnlocked: r.dialUnlocked,
    massHired: r.massHired,
    // §10.7 — the queue comes back as it was. `normaliseRun` has already defended
    // each build, and has already moved any that a save from before Build and Test
    // were decommissioned left mid-pipeline onto the end of the shelf.
    shelf: (r.shelf ?? []).map((b) => ({ ...b })),
    pipelineNodes: { ...(r.pipelineNodes ?? {}) },
    treeLevels: { ...(r.treeLevels ?? {}) },
    autoShipClock: r.autoShipClock ?? 0,
    runSeconds: r.runSeconds ?? 0,
    // §4.10e — the back catalogue comes back with its ages and its shapes. A
    // reload that wiped five shipped games would take the studio's whole
    // runway with it, and would be reported as exactly the §4.10d bug the
    // tail was built to fix.
    releases: (r.releases ?? []).map((rel) => ({
      id: rel.id,
      name: rel.name,
      payout: rel.payout,
      age: rel.age,
      paid: rel.paid,
      shape: { spikeShare: rel.spikeShare, spikeTau: rel.spikeTau, tailTau: rel.tailTau },
      // Defaulted by `normaliseReleases` to the garage figures, never to zero —
      // a restored release with no density would be a *flawless* game, and a
      // reload would silently upgrade the whole back catalogue and mute §4.12a.
      defectDensity: rel.defectDensity ?? DEFECT_DENSITY_ANCHOR,
      rating: rel.rating ?? BASELINE_RATING,
      // §10.11 — `UNKNOWN_ORDINAL` for a document written before the catalogue
      // knew its own career position. The gallery reads that as "this release
      // is not one of the ones I am tracking" and falls back to the recorded
      // payout, which is the honest answer rather than a wrong join.
      ordinal: rel.ordinal ?? UNKNOWN_ORDINAL,
    })),
    defects: r.defects ?? 0,
    tickets: r.tickets ?? 0,
    reputation: r.reputation ?? BASELINE_RATING,
    incidents: (r.incidents ?? []).map((i) => ({ ...i })),
    // §18.0 — whatever was happening is still happening. `normaliseEvent` has
    // already dropped an id this build does not have, so an unknown event comes
    // back as a quiet floor rather than as a banner with no card behind it.
    event: r.event ? { ...r.event } : null,
    // §24.2 ephemeral — at most one incident's worth of fraction, and a state
    // the player cannot see the cause of.
    incidentPending: 0,
    // localEntropy, floaters, bubble, spawn and zoom are §24.2 ephemeral. Local
    // entropy in particular decays to baseline in ~8 seconds (§4.9), so any
    // absence long enough to save through has already erased it — it restores
    // to zero by definition, not by choice.
  }

  const capSeconds = offlineCapSeconds(layer1.paradigmNodes, meta.entitlements)
  const rateMultiplier = offlineRateMultiplier(layer1.paradigmLevels, meta.entitlements)
  const config = {
    capSeconds,
    rateMultiplier,
    // §24.5 — offline accrual does not exist during Run 1. §21 paces Run 1 at
    // about four minutes and scripts every beat of it; an overnight summary
    // landing mid-trap would resolve §6's lesson while the player was asleep.
    unlocked: meta.paradigmShifts > 0,
  }

  const report = offlineYield(
    {
      savedAt: save.savedAt,
      // Recomputed from the restored run rather than stored, so it can never
      // disagree with the state it is derived from. **Unbuffed** — §4.5a's
      // buffs live fifteen seconds and this number is about to be multiplied by
      // hours; a restored run has none anyway (§24.2), and naming the base rate
      // here is what keeps that true if one ever survives a reload.
      // §7.8.9 — taxed by the *modelled* away share. See `offlineSlackFactor`:
      // the roster does not survive a reload, so counting it here would earn
      // the player a rate that only exists while nobody is looking.
      velocity:
        structuralVelocity(restored) * offlineSlackFactor(restored) + offlineFounderVelocity(),
      maxProjectIndex: PROJECTS.length - 1,
      commitment: restored.commitment,
      burned: restored.burned,
      projectIndex: restored.projectIndex,
      commitmentFor,
      revenueFor: projectRevenue,
      autoShip: meta.forkNodes.includes(NODE_CI_CD_AUTOPILOT),
      ...offlineBelt(restored),
    },
    config,
    now,
  )

  pendingSnapshot = report.qualifies ? { savedAt: save.savedAt, rateMultiplier, capSeconds } : null
  restored.sprintName = projectTitle(restored).name
  // §10.7 — ids after the restored queue's, so a new build cannot share a key.
  nextBuildId = 1 + Math.max(0, ...restored.shelf.map((b) => b.id))
  state = { ...restored, pendingOffline: report.qualifies ? report : null }
  for (const fn of listeners) fn()
  return state.pendingOffline
}

/**
 * Bank the offline yield — the §24.8 collect button.
 *
 * `rewardMultiplier` is 2 for MONETISATION §4 R1's OVERNIGHT BUILD. **Collect
 * is never gated on it**: the ad is an upgrade to a payout the player already
 * owns, so a 1x collect must always be available and must always work.
 */
export function collectOffline(rewardMultiplier = 1, now: number = Date.now()): void {
  const snap = pendingSnapshot
  if (!snap || !state.pendingOffline) return
  // §10.7a.3 — a collection is a decision about money, and the report panel
  // sits under the dialogue scrim. Belt and braces: the same rule as hiring.
  if (state.scene !== null) return

  const report = offlineYield(
    {
      savedAt: snap.savedAt,
      // Unbuffed, for the same reason as the restore path above: a player who
      // was mid-poke when they closed the tab must not earn eight hours of a
      // buff that would have faded in fifteen seconds.
      velocity: structuralVelocity(state) * offlineSlackFactor(state) + offlineFounderVelocity(),
      maxProjectIndex: PROJECTS.length - 1,
      commitment: state.commitment,
      burned: state.burned,
      projectIndex: state.projectIndex,
      commitmentFor,
      revenueFor: projectRevenue,
      autoShip: getPermanent().meta.forkNodes.includes(NODE_CI_CD_AUTOPILOT),
      ...offlineBelt(state),
    },
    {
      capSeconds: snap.capSeconds,
      rateMultiplier: snap.rateMultiplier * Math.max(1, rewardMultiplier),
      unlocked: true,
    },
    now,
  )

  const revenue = report.revenue.toNumber()
  const permanent = getPermanent()
  setPermanent({
    ...permanent,
    meta: {
      ...permanent.meta,
      // Capped seconds, not elapsed: §22.5 #6 rewards banked offline time, and
      // crediting a fortnight's absence as a fortnight would earn Bruno for
      // uninstalling the game.
      totalOfflineSeconds: permanent.meta.totalOfflineSeconds + report.paidSeconds,
      lifetimeRevenue: permanent.meta.lifetimeRevenue + revenue,
      lifetimeProjectsShipped: permanent.meta.lifetimeProjectsShipped + report.projectsShipped,
    },
  })

  pendingSnapshot = null
  // §10.7 — the belt after the absence, before the ladder moves on.
  const belt = offlineBeltAfter(state, report)
  set({
    ...belt,
    burned: report.burned,
    commitment: report.commitment,
    projectIndex: report.projectIndex,
    sprintName: projectTitle({ ...state, ...belt } as GameState).name,
    projectsShipped: (belt.projectsShipped ?? state.projectsShipped) + report.projectsShipped,
    cash: state.cash + revenue,
    lifetimeRevenue: state.lifetimeRevenue + revenue,
    pendingOffline: null,
  })
  saveGame()
}

/**
 * Save on backgrounding, not on quit — SAVE.md §5.2, GDD §24.9.
 *
 * A save written at the last *interaction* under-counts the away period by
 * however long the phone sat on the desk with the game open, which is the most
 * common way an idle game is left. `pagehide` is belt and braces: an Android
 * WebView is not obliged to give us both, and the one it withholds is the one
 * that mattered.
 */
export function installAutoSave(): () => void {
  if (typeof document === 'undefined') return () => {}

  const onHide = () => {
    if (document.visibilityState === 'hidden') saveGame()
  }
  const onPageHide = () => saveGame()

  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onPageHide)
  return () => {
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onPageHide)
  }
}

/**
 * Load the save and start persisting. Idempotent.
 *
 * Called at module scope below rather than from `App.tsx`, which another agent
 * owns — and because the load must happen before the first render reads state,
 * not inside an effect that runs after it.
 */
let persistenceStarted = false

export function initPersistence(now: number = Date.now()): OfflineReport | null {
  if (persistenceStarted) return state.pendingOffline
  persistenceStarted = true
  const report = loadGame(now)
  installAutoSave()
  return report
}

// Not under test: a test importing this module must not inherit whatever save
// the last test left in jsdom's localStorage, and every save test drives
// loadGame/saveGame explicitly anyway.
if (import.meta.env?.MODE !== 'test') initPersistence()

/**
 * Jump the script to a phase — `?act=act3_bait`.
 *
 * Run 1 is paced to take about four minutes, which §21 intends (James is
 * "proven wrong four minutes from now"). That is right for a player and
 * unworkable for someone iterating on Act V's copy, so the script is
 * addressable. Sets up whatever state the phase assumes, so the jump lands on
 * a coherent run rather than a contradictory one.
 */
/**
 * Put the run *on* a project — name, commitment and burn-down together.
 *
 * `shipProject` sets all four of these in one object and they are only correct
 * as a set. {@link jumpToPhase} used to write `projectIndex` alone on top of a
 * fresh run, which left the studio on project 1's **payout** with project 0's
 * **name** and project 0's **300-point commitment** — a HUD reading
 * "FLAPPY SQUARE 1.0 · 215 / 300 SP LEFT · +$25.0K IN 91s", which is three
 * numbers from two different projects and cannot happen in play.
 *
 * That is worse than a cosmetic bug, because handoff trap 4 makes these seams
 * the way screenshots are taken: **every frame reviewed from `?act=` was of a
 * state the game cannot reach**, and the cash arithmetic in it was being read
 * as if it were real.
 */
function onProject(index: number, seed: number): Partial<GameState> {
  const clamped = Math.min(Math.max(0, Math.floor(index)), PROJECTS.length - 1)
  return {
    projectIndex: clamped,
    sprintName: titleFor(seed, clamped).name,
    commitment: commitmentFor(clamped),
    burned: new Decimal(0),
  }
}

export function jumpToPhase(phase: Phase): void {
  const run = freshRun()

  switch (phase) {
    case 'act1_ship':
      // §21.0e — the whole middle of Run 1: James is at the second desk, there
      // is no hire button and there never will be one, and the two of them are
      // working through the garage catalogue. Mid-catalogue rather than at
      // either end, because that is where the beat actually reads.
      set({
        ...run,
        phase,
        devs: STARTING_DEVS,
        projectsShipped: 1,
        cash: 50,
        ...onProject(1, run.runSeed),
        pokeCount: ACT1_POKES_REQUIRED,
      })
      break
    case 'act2_termsheet':
      // The catalogue is out and the investor is at the door. The treasury is
      // exactly what three garage games pay, because the term sheet's whole
      // rhetorical trick is the size of the number beside it.
      set({
        ...run,
        phase,
        devs: STARTING_DEVS,
        projectsShipped: TERM_SHEET_AFTER_SHIPS,
        cash: GARAGE_CATALOGUE_CASH,
        ...onProject(FIRST_PAID_RUNG, run.runSeed),
        pokeCount: ACT1_POKES_REQUIRED,
      })
      break
    case 'act2_loop':
      // §21.0e — runs 2+ only, so the seam has to say so: this is a studio that
      // has prestiged, holds the dial, and is hiring with money it made.
      set({
        ...run,
        phase,
        devs: 10,
        projectsShipped: 2,
        cash: SEED_ROUND_CASH,
        ...onProject(FIRST_PAID_RUNG, run.runSeed),
        seedTaken: true,
        dialUnlocked: true,
      })
      break
    case 'act3_bait':
      // Run 1's Act III: two people, and the term sheet's money still in the
      // bank. The offer is priced at the treasury, so this is the state that
      // makes the scene's arithmetic ("a thousand of us is five hundred times
      // that") literally true on screen.
      set({
        ...run,
        phase,
        devs: STARTING_DEVS,
        projectsShipped: TERM_SHEET_AFTER_SHIPS,
        cash: GARAGE_CATALOGUE_CASH + SEED_ROUND_CASH,
        ...onProject(FIRST_PAID_RUNG, run.runSeed),
        seedTaken: true,
        dialUnlocked: true,
      })
      break
    case 'act4_collapse':
    case 'act5_bleeding':
      set({
        ...run,
        phase,
        devs: STARTING_DEVS + MASS_HIRE_COUNT,
        projectsShipped: TERM_SHEET_AFTER_SHIPS,
        cash: 50,
        ...onProject(FIRST_PAID_RUNG, run.runSeed),
        seedTaken: true,
        massHired: true,
      })
      break
    case 'bankrupt':
      set({
        ...run,
        phase,
        devs: STARTING_DEVS + MASS_HIRE_COUNT,
        cash: BANKRUPTCY_THRESHOLD,
        seedTaken: true,
        massHired: true,
      })
      break
    default:
      set(run)
  }
}

export { BANKRUPTCY_THRESHOLD }
