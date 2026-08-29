/**
 * The launch window — GDD §10.8b, the release minigame.
 *
 * A finished build used to become a shipped game inside a single `if` in
 * `tick`. That is correct simulation and it is the loop's payoff arriving as a
 * side effect: the one moment per project the player has actually been working
 * toward happened *to* them, at a frame boundary, with nothing to do about it.
 *
 * So a finished build is now **shelved**, and releasing it is a decision. The
 * decision is a timing test, because timing is the one thing about a release
 * that is genuinely the studio's call and genuinely not about how many
 * developers it has: §4.10c already says revenue is a fact about the studio
 * rather than about the Story Points, and *when you put it in front of people*
 * is the last input to that nobody was modelling.
 *
 * ## The bar is a calendar, and both ends are a failure
 *
 * A needle sweeps a market window. Dead centre is the release date the studio
 * wanted; drift early and the game goes out half-built, drift late and the
 * season has moved on. The multipliers are symmetric — it is an aim test — and
 * the **labels are not**, because the two ways to miss are different jokes.
 *
 * ## Three properties, and the whole design is in them
 *
 *  1. **Doing nothing costs nothing.** {@link NEUTRAL_MULTIPLIER} is ×1, it is
 *     exactly the neutral band's value, and it is what an untouched window pays
 *     when it times out. A player who never engages with this earns precisely
 *     what they earned before it existed — the same argument `rating.ts` makes
 *     for `BASELINE_RATING`, and the reason §21's measured Run 1 economy is
 *     untouched by adding a minigame to it.
 *  2. **A blind press is worth nothing either.** The needle is linear, so its
 *     position is uniform over the bar, and {@link MISSED_MULTIPLIER} is
 *     *derived* so that the width-weighted mean of the ramp is exactly ×1.
 *     Mashing is not a strategy; aiming is. Both are stated by arithmetic
 *     rather than by a comment claiming it.
 *  3. **Speed changes skill, never the baseline.** {@link sweepPeriodMs} makes
 *     later, larger releases sweep faster. Because of (2) that cannot re-tune
 *     the economy for anybody: a faster needle is worth exactly ×1 to a player
 *     who is not aiming, at every rung. It only widens the gap between a studio
 *     that attends its own launches and one that does not.
 *
 * §26.3.4's standing constraint — *"no minigame may be the optimal way to
 * play"* — holds by construction. This is amplitude on a payout the loop
 * already produces, it cannot be farmed (the release rate is the loop's, not
 * the player's), and its ceiling is ×1.75 against a defect backlog's ×0.55.
 *
 * Pure — no store, no clock, no renderer.
 */

/** Which ring of the window the needle stopped in. */
export type LaunchBandId = 'perfect' | 'window' | 'soft' | 'missed'

/** Which side of the date it stopped on. The payout is symmetric; the joke is not. */
export type LaunchSide = 'early' | 'late'

export interface LaunchBand {
  id: LaunchBandId
  /**
   * The outer edge of this ring, as a fraction of the half-bar. Cumulative, so
   * the ring's own width is this minus the previous one's — which is what
   * {@link MISSED_MULTIPLIER}'s derivation weights by.
   */
  edge: number
  multiplier: number
  /** What the studio just did to itself, per side. */
  label: Record<LaunchSide, string>
}

/** ×1. The neutral point, and the value of every path that is not a decision. */
export const NEUTRAL_MULTIPLIER = 1

/**
 * The two ratios the player can aim for. **Their order is canon and their
 * values are not** — §25.3.2, the same dodge `rating.ts` documents.
 *
 * `perfect > window > soft = 1` is the claim; 1.75 and 1.25 are a first pass.
 * The fourth ring is not here because it is not a choice — see below.
 */
const PERFECT_MULTIPLIER = 1.75
const WINDOW_MULTIPLIER = 1.25

/** The rings, inner to outer, as cumulative edges on the half-bar. */
const EDGES = { perfect: 0.09, window: 0.3, soft: 0.64, missed: 1 } as const

/**
 * **Derived, so the ramp cannot secretly pay for itself.**
 *
 * The needle is linear, so the distance-from-centre it stops at is uniform on
 * [0, 1] and each ring's chance of catching it is its own width. Fixing the
 * outer ring at whatever makes the width-weighted mean exactly ×1 is what makes
 * property (2) in the file header true rather than asserted: a player pressing
 * with their eyes shut is paid the same as one who never pressed at all.
 *
 * It lands near ×⅔, which is also about where it belongs on feel — a missed
 * season is the worst thing in this file and it is still gentler than shipping
 * a game with a rotten defect backlog (`revenueMultiplier`, ×0.55). The satire
 * has to survive the scoring here for the same reason it does there.
 */
export const MISSED_MULTIPLIER =
  (1 -
    (EDGES.perfect * PERFECT_MULTIPLIER +
      (EDGES.window - EDGES.perfect) * WINDOW_MULTIPLIER +
      (EDGES.soft - EDGES.window) * NEUTRAL_MULTIPLIER)) /
  (EDGES.missed - EDGES.soft)

/** The ring an untouched window resolves into. See {@link NEUTRAL_MULTIPLIER}. */
export const BAND_SOFT: LaunchBandId = 'soft'

export const LAUNCH_BANDS: readonly LaunchBand[] = [
  {
    id: 'perfect',
    edge: EDGES.perfect,
    multiplier: PERFECT_MULTIPLIER,
    label: { early: 'PERFECT WINDOW', late: 'PERFECT WINDOW' },
  },
  {
    id: 'window',
    edge: EDGES.window,
    multiplier: WINDOW_MULTIPLIER,
    label: { early: 'AHEAD OF THE CURVE', late: 'FASHIONABLY LATE' },
  },
  {
    id: 'soft',
    edge: EDGES.soft,
    multiplier: NEUTRAL_MULTIPLIER,
    label: { early: 'STILL IN BETA', late: 'QUIET LAUNCH' },
  },
  {
    id: 'missed',
    edge: EDGES.missed,
    multiplier: MISSED_MULTIPLIER,
    label: { early: 'SHIPPED HALF A GAME', late: 'MISSED THE SEASON' },
  },
]

export interface LaunchHit {
  /** Where the needle stopped, 0..1 across the whole bar. */
  at: number
  band: LaunchBandId
  side: LaunchSide
  label: string
  multiplier: number
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0.5
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/**
 * Where the needle is, given how long the window has been open.
 *
 * A linear ping-pong rather than a sine, and that is the whole of property (2):
 * a sinusoidal needle dwells at the ends, so the outer ring would catch it more
 * often than its width and the derived mean above would be a lie. It also reads
 * differently — a needle that slows at the edges is a needle that *hesitates*,
 * which invites the player to wait for it rather than to aim.
 */
export function markerAt(elapsedMs: number, periodMs: number): number {
  if (!(periodMs > 0) || !Number.isFinite(elapsedMs)) return 0.5
  const t = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs
  return t < 0.5 ? t * 2 : 2 - t * 2
}

/** How far from the release date the needle is, 0 at the centre, 1 at either end. */
export function offsetFromCentre(at: number): number {
  return Math.abs(clamp01(at) - 0.5) * 2
}

/** Resolve a needle position into what the studio just did. */
export function launchHit(at: number): LaunchHit {
  const x = clamp01(at)
  const d = offsetFromCentre(x)
  const side: LaunchSide = x < 0.5 ? 'early' : 'late'
  const band = LAUNCH_BANDS.find((b) => d <= b.edge) ?? LAUNCH_BANDS[LAUNCH_BANDS.length - 1]
  return { at: x, band: band.id, side, label: band.label[side], multiplier: band.multiplier }
}

/**
 * A launch nobody attended — §10.8b's timeout, and the offline chain-ship.
 *
 * Deliberately **not** `launchHit` of wherever the needle happened to be when
 * the clock ran out: the needle's position at a fixed time is not uniform, it
 * is one exact spot, so an absent player would be paid the same band every
 * single release. That would be a tax on not playing a minigame, which is the
 * one thing §26.3.4 forbids outright. The honest reading of "nobody pressed
 * the button" is *it went out whenever*, which is the neutral ring.
 */
export const AUTO_LAUNCH: LaunchHit = {
  at: 0.5 + (EDGES.window + EDGES.soft) / 4,
  band: BAND_SOFT,
  side: 'late',
  label: LAUNCH_BANDS[2].label.late,
  multiplier: NEUTRAL_MULTIPLIER,
}

/** Sweep period at the first rung of §4.10c's ladder, in milliseconds. */
export const SWEEP_MS_FIRST_PROJECT = 1_700
/** Sweep period at the last authored rung. See the file header, property (3). */
export const SWEEP_MS_LAST_PROJECT = 950

/**
 * How long one full there-and-back sweep takes, by ladder rung.
 *
 * A garage's launch is a slow, forgiving needle; a live-service hero shooter's
 * is not. The ramp is linear in the rung rather than in the payout, because the
 * payouts span five orders of magnitude and the *difficulty* must not.
 */
export function sweepPeriodMs(projectIndex: number, projectCount: number): number {
  if (!(projectCount > 1)) return SWEEP_MS_FIRST_PROJECT
  const i = Math.min(Math.max(0, Math.floor(projectIndex)), projectCount - 1)
  const t = i / (projectCount - 1)
  return SWEEP_MS_FIRST_PROJECT + t * (SWEEP_MS_LAST_PROJECT - SWEEP_MS_FIRST_PROJECT)
}

/**
 * How much slower the needle sweeps for a player who has asked for less motion.
 *
 * **The one place in the product where §10.5 rule 3 is inverted on purpose.**
 * Rule 3 shortens a transition to ~40%, which is the right accommodation for
 * something the player is *watching* and exactly the wrong one for something
 * they are *aiming at*: a gameplay animation cut to 40% is not an
 * accommodation, it is a harder game.
 *
 * The renderer applies it, because the preference is the renderer's to read —
 * but it is declared *here*, because {@link stallSeconds} has to know about it.
 * A backstop sized for the fast sweep would take the window away from a
 * reduced-motion player mid-aim, which is the accommodation producing the
 * harder game by a longer route.
 */
export const REDUCED_SWEEP_SCALE = 1.6

/**
 * Full sweeps the player gets before the window closes itself.
 *
 * Three is two chances to reconsider and not enough to wait out. The floor
 * under it is §10.8 F6 read backwards: the player is not waiting for the game
 * to finish being beautiful, they are *doing* something — but a modal that
 * halts the studio still owes them an end.
 */
export const AUTO_LAUNCH_SWEEPS = 3

export function autoLaunchMs(periodMs: number): number {
  return AUTO_LAUNCH_SWEEPS * periodMs
}

/**
 * How long past its own deadline a shelved build waits before the *simulation*
 * releases it — §10.8b's backstop, in milliseconds.
 *
 * Both clocks on this window are the wall clock, and only one of them is the
 * renderer's. The needle is drawn off `requestAnimationFrame`, which **a hidden
 * tab suspends entirely** — the trap `Panel` documents at length, and the one
 * that once cost the game its only exit from Run 1. Without a second reader the
 * studio would freeze on the shelf until the player came back, having stopped
 * mid-launch rather than mid-anything. So `tick` watches the same elapsed time
 * and releases the build itself if nothing answers.
 *
 * **It is elapsed time and not accumulated `dtSeconds`, and that is a finding.**
 * §26.1.8's `?speed` accelerates the simulation by *repeating whole ticks*, so a
 * patience counted in simulated seconds shrank by the same factor: at ×40 the
 * window opened and closed itself inside a quarter of a second. A debug flag
 * that compresses the simulation must not compress a decision the player is
 * being asked to make. A headless `tick` loop with no renderer therefore has to
 * answer its own launches — `releaseNow` is the seam, and the tests that play
 * the game by pumping the simulation use it exactly as a player uses the button.
 *
 * The margin is what keeps the two readers in the right order. **The renderer
 * gets first refusal**, because it is the only one that can show the player a
 * verdict before the window goes.
 */
export const STALL_MARGIN_MS = 1_500

/**
 * The simulation's backstop for one sweep period, in seconds of elapsed time.
 *
 * Sized against the **slowest** sweep the window can be drawn at — see
 * {@link REDUCED_SWEEP_SCALE} — rather than against the period as stored, so
 * that a player who has asked for less motion still gets their whole window.
 * A non-reduced player never notices the extra patience, because the renderer
 * fires first for them by an even wider margin.
 */
export function stallSeconds(periodMs: number): number {
  return (autoLaunchMs(periodMs) * REDUCED_SWEEP_SCALE + STALL_MARGIN_MS) / 1000
}

/**
 * The floor under how often a launch is an event — §10.8b, seconds.
 *
 * **The one number here that is about the whole game rather than about the
 * bar.** §4.4 paces a garage at a ship a minute and the top of §4.10c's ladder
 * ships every six seconds; a modal that halted the studio on every one of those
 * would turn the late game into a slideshow of its own celebration. So a
 * release only gets a window if the last one was long enough ago, and the rest
 * go out on the train at {@link NEUTRAL_MULTIPLIER}.
 *
 * That is also the truer fiction. A studio shipping ten games a minute is not
 * attending its own launches, and the thing it has lost by automating them is
 * exactly the thing this minigame is: the chance to pick the moment.
 *
 * Thirty seconds gives every Act I release its window — which is where the
 * loop is being taught — and roughly one in five at the top of the ladder.
 */
export const LAUNCH_WINDOW_COOLDOWN_SECONDS = 30
