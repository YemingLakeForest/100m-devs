/*
 * Copied from the rebuild (100m-devs-three/src/sim/release.test.ts) on 2026-09-26 with the
 * release ring and the pipeline, when the work moved back here: the rebuild is
 * read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
import { describe, expect, it } from 'vitest'
import {
  BUG_EXCLUSION,
  LAUNCH_BANDS,
  LAUNCH_SPLIT,
  MISSED_MULTIPLIER,
  NEUTRAL_MULTIPLIER,
  READINESS_BANDS,
  REACH_CLEAN,
  REACH_RUSHED,
  REDUCED_SWEEP_SCALE,
  REGRESSION_BASE,
  REGRESSION_CAP,
  SHIP_ZONE,
  TIMING_SCORE,
  TRAIN_LAUNCH,
  TURN_MS_FIRST_PROJECT,
  TURN_MS_LAST_PROJECT,
  YEARS,
  angleBandAt,
  bandIndexFor,
  defectRing,
  fixQuality,
  headAt,
  inShipZone,
  launchOutcome,
  launchScore,
  offsetFromDate,
  pipelineLaunch,
  regressionChance,
  regresses,
  stageFor,
  stageReadiness,
  turnPeriodMs,
  wrapTurn,
  yearAt,
} from './release.ts'

const ship = (over: Partial<Parameters<typeof launchOutcome>[0]> = {}) =>
  launchOutcome({ turn: 0, year: 1, open: 0, initial: 4, chosen: true, ...over })

describe('§10.7 — the ring', () => {
  it('turns at a constant rate and comes back round', () => {
    expect(headAt(0, 1_000)).toBeCloseTo(0, 9)
    expect(headAt(250, 1_000)).toBeCloseTo(0.25, 9)
    expect(headAt(1_250, 1_000)).toBeCloseTo(0.25, 9)
  })

  it('counts a year per turn, and stops counting at the last one', () => {
    expect(yearAt(0, 1_000)).toBe(1)
    expect(yearAt(999, 1_000)).toBe(1)
    expect(yearAt(1_000, 1_000)).toBe(2)
    expect(yearAt(1_000 * (YEARS + 9), 1_000)).toBe(YEARS)
  })

  it('measures distance from the date, not from the start of the ring', () => {
    expect(offsetFromDate(0)).toBe(0)
    expect(offsetFromDate(0.5)).toBe(1)
    // Early and late are the same distance and opposite signs.
    expect(offsetFromDate(0.1)).toBeCloseTo(offsetFromDate(0.9), 9)
    expect(wrapTurn(0.9)).toBeLessThan(0)
    expect(wrapTurn(0.1)).toBeGreaterThan(0)
  })

  /** §25.3.2 — the order is canon, the values are not. This pins the order. */
  it('ranks perfect over the window, the window over soft, and soft over missed', () => {
    const [perfect, window, soft, missed] = LAUNCH_BANDS.map((b) => b.multiplier)
    expect(perfect).toBeGreaterThan(window)
    expect(window).toBeGreaterThan(soft)
    expect(soft).toBeGreaterThan(missed)
    expect(soft).toBe(NEUTRAL_MULTIPLIER)
  })

  /**
   * The load-bearing claim of the payout ramp, and the one that keeps §21's
   * measured economy true: the width-weighted mean across the calendar is ×1.
   */
  it('pays exactly x1 on average across the year', () => {
    const N = 20_001
    let total = 0
    for (let i = 0; i < N; i++) {
      total += LAUNCH_BANDS[angleBandAt(i / (N - 1))].multiplier
    }
    expect(total / N).toBeCloseTo(1, 3)
  })

  /**
   * §4.14's `revenueMultiplier` floors a 0/100 game at x0.55 so that "ships a
   * 12 and makes a fortune" stays funny. A missed date may not be harsher than
   * shipping something broken.
   */
  it('never punishes a missed season more than a rotten backlog does', () => {
    expect(MISSED_MULTIPLIER).toBeGreaterThan(0.55)
    expect(MISSED_MULTIPLIER).toBeLessThan(NEUTRAL_MULTIPLIER)
  })

  it('names the two ways to miss differently and pays them the same', () => {
    // Inside the *window* ring rather than the perfect one: dead centre is a
    // perfect launch from either direction and is deliberately named the same.
    const early = ship({ turn: 0.9 })
    const late = ship({ turn: 0.1 })
    expect(early.timing.side).toBe('early')
    expect(late.timing.side).toBe('late')
    expect(early.timing.band).toBe('window')
    expect(early.timing.label).not.toBe(late.timing.label)
    expect(early.timing.multiplier).toBe(late.timing.multiplier)
  })
})

describe('§10.7 — one button, because the ring is laid out for one', () => {
  /**
   * The whole reason a single control can carry both jobs: the release window
   * and the backlog never overlap, so a tap is never ambiguous. If these two
   * numbers ever cross, the button starts guessing what the player meant.
   */
  it('keeps a dead zone between the window and the nearest possible defect', () => {
    expect(BUG_EXCLUSION).toBeGreaterThan(SHIP_ZONE)
  })

  it('puts every defect outside the dead zone, at every backlog size', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (let count = 1; count <= 9; count++) {
        for (const t of defectRing(seed, count, count)) {
          expect(Math.abs(wrapTurn(t)), `seed ${seed} n ${count}`).toBeGreaterThanOrEqual(BUG_EXCLUSION)
          expect(inShipZone(t)).toBe(false)
        }
      }
    }
  })

  it('never lays two defects on top of one another', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const ring = defectRing(seed, 3, 6)
      expect(ring.length).toBe(6)
      for (let i = 0; i < ring.length; i++) {
        for (let j = i + 1; j < ring.length; j++) {
          // Two defects inside one reach are one unhittable smear.
          expect(Math.abs(wrapTurn(ring[i] - ring[j]))).toBeGreaterThan(REACH_CLEAN)
        }
      }
    }
  })

  it('lays the same ring out for the same release, every time', () => {
    expect(defectRing(42, 7, 5)).toEqual(defectRing(42, 7, 5))
    expect(defectRing(42, 7, 5)).not.toEqual(defectRing(43, 7, 5))
  })

  it('is only a release near the date, and a stray commit everywhere else', () => {
    expect(inShipZone(0)).toBe(true)
    expect(inShipZone(SHIP_ZONE * 0.99)).toBe(true)
    expect(inShipZone(0.5)).toBe(false)
    expect(inShipZone(BUG_EXCLUSION)).toBe(false)
  })
})

describe('§10.7 — the window is worth less every year', () => {
  /**
   * **The rule the whole screen turns on.** The angle says how well the date
   * was picked within a year; the year says which year it is, and they add. If
   * this ever stops being true, fixing and timing go back to being two
   * unrelated problems that happen to share a dial.
   */
  it('steps the band down one per year', () => {
    expect(bandIndexFor(0, 1)).toBe(0)
    expect(bandIndexFor(0, 2)).toBe(1)
    expect(bandIndexFor(0, 3)).toBe(2)
    expect(bandIndexFor(0, 4)).toBe(3)
    // ...and never past the worst one.
    expect(bandIndexFor(0, 99)).toBe(LAUNCH_BANDS.length - 1)
  })

  it('puts a perfect launch on the table in year one and never again', () => {
    expect(LAUNCH_BANDS[bandIndexFor(0, 1)].id).toBe('perfect')
    for (let year = 2; year <= YEARS; year++) {
      for (let turn = -SHIP_ZONE; turn <= SHIP_ZONE; turn += 0.005) {
        expect(LAUNCH_BANDS[bandIndexFor(turn, year)].id, `year ${year}`).not.toBe('perfect')
      }
    }
  })

  /**
   * Running the clock out needs no number of its own — it is the worst case of
   * the same arithmetic, which is what "missed the season" means.
   */
  it('treats running out of years as the worst band, not as a special case', () => {
    const dithered = ship({ chosen: false, turn: 0, year: YEARS })
    expect(dithered.timing.band).toBe('missed')
    expect(dithered.timing.multiplier).toBe(MISSED_MULTIPLIER)
    expect(dithered.attended).toBe(true)
    expect(dithered.timing.label).toBe('MISSED THE SEASON')
  })
})

describe('§10.7 — fixing, and what a rushed fix costs', () => {
  it('always lands the fix inside the wide band, and only cleans it in the core', () => {
    expect(fixQuality(0)).toBe('clean')
    expect(fixQuality(REACH_CLEAN * 0.99)).toBe('clean')
    expect(fixQuality(REACH_CLEAN * 1.01)).toBe('rushed')
    expect(fixQuality(REACH_RUSHED * 0.99)).toBe('rushed')
    expect(fixQuality(REACH_RUSHED * 1.01)).toBe('miss')
    // Sign is not a quality: late and early are the same tap.
    expect(fixQuality(-REACH_CLEAN * 0.5)).toBe('clean')
  })

  /**
   * The forgiving band has to be *materially* wider than the core, or the
   * accommodation is a rounding error and the loop is still a reaction test.
   */
  it('makes the forgiving band several times the clean core', () => {
    expect(REACH_RUSHED).toBeGreaterThan(REACH_CLEAN * 2.5)
  })

  it('climbs the regression chance with every fix, and caps it', () => {
    expect(regressionChance(0)).toBe(REGRESSION_BASE)
    expect(regressionChance(3)).toBeGreaterThan(regressionChance(2))
    expect(regressionChance(99)).toBe(REGRESSION_CAP)
    // It is a chance, never a certainty: persistence must stay possible.
    expect(REGRESSION_CAP).toBeLessThan(1)
  })

  it('rolls the same regression for the same fix, however often it is asked', () => {
    for (let i = 0; i < 20; i++) {
      expect(regresses(9, 3, i, 2)).toBe(regresses(9, 3, i, 2))
    }
  })

  /**
   * The ramp is real but it is not a wall: a player who keeps rushing still
   * makes progress more often than not at the shallow end.
   */
  it('lets a rushed fix hold more often than it breaks, early on', () => {
    let held = 0
    for (let seed = 1; seed <= 200; seed++) if (!regresses(seed, 1, 0, 0)) held++
    expect(held / 200).toBeGreaterThan(0.5)
  })
})

describe('§10.7 — what a build goes out at', () => {
  it('reaches GOLD only on an empty backlog', () => {
    expect(stageFor(0, 4)).toBe('GOLD')
    expect(stageFor(1, 4)).not.toBe('GOLD')
    // ...however small one defect looks against a big backlog.
    expect(stageFor(1, 200)).not.toBe('GOLD')
  })

  it('climbs the stages as the backlog empties', () => {
    expect(stageFor(6, 6)).toBe('ALPHA')
    expect(stageFor(4, 6)).toBe('BETA')
    expect(stageFor(2, 6)).toBe('RC')
    expect(stageFor(0, 6)).toBe('GOLD')
  })

  it('orders the stages, and puts GOLD at exactly one', () => {
    expect(READINESS_BANDS.map((b) => b.id)).toEqual(['ALPHA', 'BETA', 'RC', 'GOLD'])
    expect(stageReadiness('ALPHA')).toBeLessThan(stageReadiness('BETA'))
    expect(stageReadiness('BETA')).toBeLessThan(stageReadiness('RC'))
    expect(stageReadiness('RC')).toBeLessThan(stageReadiness('GOLD'))
    expect(stageReadiness('GOLD')).toBe(1)
  })

  it('carries the open count out with the release — §4.12 transfers it', () => {
    expect(ship({ open: 3, initial: 5 }).open).toBe(3)
    expect(ship({ open: 0, initial: 5 }).open).toBe(0)
  })
})

describe('§4.14 — what the launch is worth to the score', () => {
  it('weights readiness over reflexes, and both over nothing', () => {
    expect(LAUNCH_SPLIT.readiness).toBeGreaterThan(LAUNCH_SPLIT.timing)
    expect(LAUNCH_SPLIT.readiness + LAUNCH_SPLIT.timing).toBeCloseTo(1, 12)
    expect(TIMING_SCORE.perfect).toBeGreaterThan(TIMING_SCORE.window)
    expect(TIMING_SCORE.window).toBeGreaterThan(TIMING_SCORE.soft)
    expect(TIMING_SCORE.soft).toBeGreaterThan(TIMING_SCORE.missed)
    // The neutral of a 0..1 rating term is a half, like every other term's.
    expect(TIMING_SCORE.soft).toBe(0.5)
  })

  /**
   * Property (1) in the currency the rating uses, and the floor of the whole
   * design: a build the player never comes for scores exactly the neutral term,
   * so `BASELINE_RATING` is what a garage ships whether or not this exists.
   */
  it('scores a build nobody came for at exactly a half', () => {
    expect(launchScore(TRAIN_LAUNCH)).toBe(0.5)
    expect(TRAIN_LAUNCH.timing.multiplier).toBe(NEUTRAL_MULTIPLIER)
    expect(TRAIN_LAUNCH.attended).toBe(false)
  })

  /**
   * ...and dithering is *not* that floor. The player who opened the window and
   * let four years go by missed the season, which is the point of the years.
   */
  it('scores a dithered release below the one nobody attended', () => {
    const dithered = ship({ chosen: false, open: 2, initial: 4, year: YEARS })
    expect(launchScore(dithered)).toBeLessThan(launchScore(TRAIN_LAUNCH))
    expect(dithered.timing.multiplier).toBeLessThan(TRAIN_LAUNCH.timing.multiplier)
  })

  it('scores a clean build on a perfect date at exactly one', () => {
    const best = ship({ turn: 0, year: 1, open: 0, initial: 4 })
    expect(best.stage).toBe('GOLD')
    expect(best.timing.band).toBe('perfect')
    expect(launchScore(best)).toBe(1)
  })

  /**
   * The decision, measured. A finished game a year late and a broken game on
   * the perfect date are both worth less than the finished game on the date —
   * and the game must not quietly make one of them strictly correct.
   */
  it('prices the trade the player is actually being asked to make', () => {
    const best = launchScore(ship({ turn: 0, year: 1, open: 0 }))
    const cleanButLate = launchScore(ship({ turn: 0, year: 2, open: 0 }))
    const dirtyButPunctual = launchScore(ship({ turn: 0, year: 1, open: 4, initial: 4 }))
    expect(best).toBeGreaterThan(cleanButLate)
    expect(best).toBeGreaterThan(dirtyButPunctual)
    // Neither branch is a trap: both beat having never turned up.
    expect(cleanButLate).toBeGreaterThan(launchScore(TRAIN_LAUNCH))
    expect(dirtyButPunctual).toBeLessThan(cleanButLate)
  })

  /**
   * Serena's pipeline is worth more than the train and less than turning up —
   * the whole argument for automating a release in a game about automating
   * everything else.
   */
  it('prices the pipeline between the train and an attended launch', () => {
    const pipeline = launchScore(pipelineLaunch())
    expect(pipeline).toBeGreaterThan(launchScore(TRAIN_LAUNCH))
    expect(pipeline).toBeLessThan(launchScore(ship({ turn: 0, year: 1, open: 0 })))
    expect(pipelineLaunch().stage).toBe('RC')
    expect(pipelineLaunch().attended).toBe(false)
    // ...and it never reaches a perfect date, however deep the branch goes.
    expect(pipelineLaunch(9).timing.band).toBe('soft')
    expect(pipelineLaunch(9).stage).toBe('GOLD')
    expect(launchScore(pipelineLaunch(9))).toBeLessThan(1)
  })
})

describe('§10.7 — the ring turns faster up the ladder', () => {
  it('turns faster the further up the ladder the studio is', () => {
    expect(turnPeriodMs(0, 8)).toBe(TURN_MS_FIRST_PROJECT)
    expect(turnPeriodMs(7, 8)).toBe(TURN_MS_LAST_PROJECT)
    expect(turnPeriodMs(3, 8)).toBeLessThan(turnPeriodMs(2, 8))
    // Clamped at both ends: an index off the ladder is still a real release.
    expect(turnPeriodMs(-4, 8)).toBe(TURN_MS_FIRST_PROJECT)
    expect(turnPeriodMs(99, 8)).toBe(TURN_MS_LAST_PROJECT)
  })

  /**
   * One rate means the accommodation cannot break a relationship: slowing the
   * ring slows the years with it, so a reduced-motion player gets the same
   * game at a gentler speed rather than a different one.
   */
  it('keeps the years whole for a reduced-motion player', () => {
    const P = TURN_MS_FIRST_PROJECT * REDUCED_SWEEP_SCALE
    expect(REDUCED_SWEEP_SCALE).toBeGreaterThan(1)
    expect(yearAt(P * 1.5, P)).toBe(2)
    expect(headAt(P * 1.5, P)).toBeCloseTo(0.5, 9)
  })

  it('treats nonsense as the start of the year rather than as a crash', () => {
    expect(headAt(Number.NaN, 1_000)).toBe(0)
    expect(headAt(100, 0)).toBe(0)
    expect(yearAt(Number.NaN, 1_000)).toBe(1)
    expect(offsetFromDate(Number.NaN)).toBe(0)
    expect(bandIndexFor(Number.NaN, Number.NaN)).toBe(0)
    expect(stageFor(Number.NaN, Number.NaN)).toBe('GOLD')
  })
})

/**
 * **The outcome has to say what it was measured against.**
 *
 * The train carried `open: 0` in the first pass and the store read it as *the
 * player cleared everything*, so an unattended release shipped a spotless game
 * and §4.12's backlog was quietly forgiven. The launch term was neutral the
 * whole time, which is exactly why nothing else caught it.
 */
describe('§10.7 — what shipped with it', () => {
  it('ships the whole backlog when nobody came', () => {
    expect(TRAIN_LAUNCH.initial).toBeGreaterThan(0)
    expect(TRAIN_LAUNCH.open / TRAIN_LAUNCH.initial).toBe(1)
    expect(pipelineLaunch().open / pipelineLaunch().initial).toBe(1)
  })

  it('ships none of it when the ring was cleared', () => {
    const clean = launchOutcome({ turn: 0, year: 1, open: 0, initial: 5, chosen: true })
    expect(clean.open / clean.initial).toBe(0)
  })

  it('records a session that opened more than it closed', () => {
    const worse = launchOutcome({ turn: 0, year: 1, open: 7, initial: 5, chosen: true })
    expect(worse.open / worse.initial).toBeGreaterThan(1)
  })
})
