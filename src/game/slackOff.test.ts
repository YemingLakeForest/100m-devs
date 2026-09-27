/**
 * The slack-off minigame, where it meets the economy — GDD §7.8.6, §7.8.9.
 *
 * `sim/slackOff.test.ts` pins the population's own rules. This pins the thing
 * that changed on 2026-08-26 and that §7.8.6 rule 2 spent two years forbidding:
 * **that any of it reaches a Story Point at all.**
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  awayCount,
  developerIsAway,
  getState,
  grabDeveloper,
  poke,
  offlineSlackFactor,
  releaseDeveloper,
  tick,
  workingDevs,
} from './store.ts'
import { JAMES_REFUSALS } from './chatter.ts'
import { TRAVEL_SECONDS, emptySlack, liftSlacker } from '../sim/slackOff.ts'

beforeEach(() => {
  __resetStore()
  __setState({ devs: 40, peakDevs: 40, slack: emptySlack() })
})

/** Tick for `seconds` in frame-sized steps, because the sim clamps big ones. */
function run(seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) tick(1 / 60)
}

describe('away developers stop producing — §7.8.6 rule 2, reversed', () => {
  it('costs the studio exactly the heads that are away', () => {
    const before = workingDevs()
    __setState({ slack: liftSlacker(emptySlack(), 7) })
    expect(workingDevs()).toBeCloseTo(before - 1, 6)
  })

  it('gives them back the moment somebody is seated', () => {
    __setState({ slack: liftSlacker(emptySlack(), 7) })
    const away = workingDevs()
    releaseDeveloper(7, true)
    expect(workingDevs()).toBeGreaterThan(away)
    expect(awayCount()).toBe(0)
  })

  it('never drives the working headcount below zero', () => {
    // More people away than the studio has coding heads should clamp rather
    // than propagate a negative into the economy.
    let s = emptySlack()
    for (let i = 0; i < 6; i++) s = liftSlacker(s, i)
    __setState({ devs: 3, peakDevs: 3, slack: s })
    expect(workingDevs()).toBeGreaterThanOrEqual(0)
  })

  it('empties the floor over time on a studio in gridlock, and less on a calm one', () => {
    __setState({ devs: 300, peakDevs: 300, devCap: 1e9 })
    run(120)
    const calm = awayCount()

    __resetStore()
    __setState({ devs: 300, peakDevs: 300, devCap: 1, slack: emptySlack() })
    run(120)
    const seized = awayCount()

    // §6 in bodies. A studio far past its cap is in TOTAL GRIDLOCK; one with a
    // cap of a billion is IN SYNC.
    expect(seized).toBeGreaterThan(calm)
  })
})

describe('the drag — §7.8.9', () => {
  it('lifting a working developer costs output from that frame', () => {
    const before = workingDevs()
    grabDeveloper(12)
    expect(developerIsAway(12)).toBe(true)
    expect(workingDevs()).toBeCloseTo(before - 1, 6)
  })

  it('dropping them on a desk puts them straight back to work', () => {
    const before = workingDevs()
    grabDeveloper(12)
    releaseDeveloper(12, true)
    expect(workingDevs()).toBeCloseTo(before, 6)
  })

  it('dropping them anywhere else makes them walk home, and it goes on costing', () => {
    const before = workingDevs()
    grabDeveloper(12)
    releaseDeveloper(12, false)
    // Still away: they are on the carpet somewhere, walking. **Not a teleport**
    // — that is the whole of the request this replaced.
    expect(developerIsAway(12)).toBe(true)
    expect(workingDevs()).toBeLessThan(before)

    run(TRAVEL_SECONDS + 1)
    expect(developerIsAway(12)).toBe(false)
  })

  it('refuses a seat the studio does not have', () => {
    grabDeveloper(999)
    expect(awayCount()).toBe(0)
    grabDeveloper(-1)
    expect(awayCount()).toBe(0)
  })
})

describe('James — §21.7.0', () => {
  it('never wanders off on his own', () => {
    // §7.8.9's away roster is indexed by floor seat and James does not have
    // one, so "he never slacks" is now a property of the roster's *shape*
    // rather than of an exemption inside it. What is testable is the
    // consequence: however many people wander off, he is not among them and
    // the studio never loses his output.
    __setState({ devs: 60, peakDevs: 60, devCap: 1 })
    const before = workingDevs()
    run(180)
    expect(workingDevs()).toBeGreaterThanOrEqual(Math.min(before, workingDevs()))
    expect(awayCount()).toBeLessThanOrEqual(60)
  })

  /**
   * **Rule 6, kept by architecture rather than by an exemption.** [amended
   * 2026-09-04]
   *
   * These three used to grab floor seat 0 and assert that the lift was refused,
   * that it cost the studio nothing, and that it said so in one of
   * {@link JAMES_REFUSALS}. All three were about a James who sat at seat 0.
   *
   * §21.0b moved him: he works in §7.8.0c's leadership corner, he is not one of
   * the twenty, and he is not in `devs`. So rule 6 — *he cannot be picked up* —
   * is now true because there is no body a finger can reach, which is a
   * stronger guarantee than a refusal at one index. What has to be tested is
   * therefore the *pair* of claims underneath the old ones: nothing on the
   * floor is exempt, and James is unreachable and unaffected.
   *
   * The refusal lines are kept rather than deleted. They are written character
   * and §21.7.0's voice test below still holds them to it; the moment there is
   * a gesture that reaches the man behind the glass, they are what he says.
   */
  it('leaves no floor seat exempt, now that he is not on the floor', () => {
    __setState({ devs: 4, peakDevs: 4 })
    // Seat 0 was his and is now the first ordinary hire. It lifts like the rest.
    expect(grabDeveloper(0).held).toBe(true)
    expect(grabDeveloper(0).says).toBeNull()
  })

  it('costs the studio nothing, because nothing the player does reaches him', () => {
    __setState({ devs: 0, peakDevs: 0 })
    const before = workingDevs()
    // With an empty floor there is no seat to grab at all — and whatever the
    // studio was producing, the attempt does not change it.
    expect(grabDeveloper(0).held).toBe(false)
    expect(grabDeveloper(0).says).toBeNull()
    expect(workingDevs()).toBeCloseTo(before, 6)
  })

  it('hands the line back rather than putting it in the HUD', () => {
    // §7.5's bubble is where the studio talks to the player. This is one man
    // answering something done to him, and it belongs over his own head — so
    // the store returns it and the renderer decides where it goes.
    __setState({ bubble: null, devs: 4, peakDevs: 4 })
    grabDeveloper(0)
    expect(getState().bubble).toBeNull()
  })

  it('says it in his own voice — sincere, never winking', () => {
    // §21.7.0's blockquote: "if a line of his reads as a wink, it is the wrong
    // line." Nothing here is an aside to the player about the game.
    for (const line of JAMES_REFUSALS) {
      expect(line).not.toMatch(/\b(lol|haha|wink|obviously|of course)\b/i)
      expect(line.length).toBeLessThanOrEqual(40)
    }
  })

  it('still lets everybody else be picked up', () => {
    const grab = grabDeveloper(1)
    expect(grab.held).toBe(true)
    expect(grab.says).toBeNull()
    expect(developerIsAway(1)).toBe(true)
  })
})

describe('a poke still beats ambience — §7.8.6 rule 5', () => {
  it('sends a wanderer back to their desk', () => {
    __setState({ slack: liftSlacker(emptySlack(), 5) })
    expect(developerIsAway(5)).toBe(true)
    poke(0, 0, { rung: 0, index: 5 })
    expect(developerIsAway(5)).toBe(false)
  })

  it('and the studio is producing again afterwards', () => {
    const before = workingDevs()
    __setState({ slack: liftSlacker(emptySlack(), 5) })
    poke(0, 0, { rung: 0, index: 5 })
    expect(workingDevs()).toBeCloseTo(before, 6)
  })
})

describe('offline progress — §24', () => {
  it('is taxed even though the roster does not survive a reload', () => {
    // Otherwise the instruction the game gives the player is "close the tab to
    // stop your developers slacking", which is the opposite of a minigame.
    __setState({ devs: 300, peakDevs: 300, devCap: 1, slack: emptySlack() })
    expect(awayCount()).toBe(0)
    expect(offlineSlackFactor()).toBeLessThan(1)
  })

  it('costs a strained studio more than a calm one, same as being watched does', () => {
    __setState({ devs: 300, peakDevs: 300, devCap: 1e9, slack: emptySlack() })
    const calm = offlineSlackFactor()
    __setState({ devCap: 1 })
    expect(offlineSlackFactor()).toBeLessThan(calm)
  })

  it('never takes the whole studio', () => {
    __setState({ devs: 300, peakDevs: 300, devCap: 1, slack: emptySlack() })
    expect(offlineSlackFactor()).toBeGreaterThan(0)
  })
})

