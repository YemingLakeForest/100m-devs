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
import { JAMES_SEAT } from '../sim/identity.ts'
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
    __setState({ devs: 60, peakDevs: 60, devCap: 1 })
    run(180)
    expect(developerIsAway(JAMES_SEAT)).toBe(false)
  })

  it('cannot be picked up at all — rule 6', () => {
    // He used to be liftable and snap back on release, which is a fine beat and
    // the wrong one: a rule stated by *undoing* the gesture teaches the player
    // that it worked and then failed. He is never lifted now.
    expect(grabDeveloper(JAMES_SEAT).held).toBe(false)
    expect(developerIsAway(JAMES_SEAT)).toBe(false)
    expect(awayCount()).toBe(0)
  })

  it('costs the studio nothing when the player tries', () => {
    const before = workingDevs()
    grabDeveloper(JAMES_SEAT)
    expect(workingDevs()).toBeCloseTo(before, 6)
  })

  it('says something about it, rather than failing silently', () => {
    // A press that silently does nothing is indistinguishable from a press that
    // missed, and the player's next move is to try harder.
    for (let i = 0; i < 40; i++) {
      const said = grabDeveloper(JAMES_SEAT).says
      expect(said).not.toBeNull()
      expect(JAMES_REFUSALS).toContain(said)
    }
  })

  it('hands the line back rather than putting it in the HUD', () => {
    // §7.5's bubble is where the studio talks to the player. This is one man
    // answering something done to him, and it belongs over his own head — so
    // the store returns it and the renderer decides where it goes.
    __setState({ bubble: null })
    grabDeveloper(JAMES_SEAT)
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
    const grab = grabDeveloper(JAMES_SEAT + 1)
    expect(grab.held).toBe(true)
    expect(grab.says).toBeNull()
    expect(developerIsAway(JAMES_SEAT + 1)).toBe(true)
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

  it('is bought back by §11 Branch D, like the live rate', () => {
    __setState({ devs: 300, peakDevs: 300, devCap: 1, slack: emptySlack() })
    const unbought = offlineSlackFactor()
    __setState({ tech: { D1: 1, D2: 1, D3: 1, D4: 1 } })
    expect(offlineSlackFactor()).toBeGreaterThan(unbought)
  })

  it('never takes the whole studio', () => {
    __setState({ devs: 300, peakDevs: 300, devCap: 1, slack: emptySlack() })
    expect(offlineSlackFactor()).toBeGreaterThan(0)
  })
})

describe('§11 Branch D — Focus', () => {
  it('leaves fewer people away over the same stretch of run', () => {
    const settle = (levels: Record<string, number> | undefined) => {
      __resetStore()
      __setState({ devs: 400, peakDevs: 400, devCap: 1, tech: levels, slack: emptySlack() })
      let sum = 0
      let n = 0
      for (let t = 0; t < 180; t += 1 / 60) {
        tick(1 / 60)
        if (t > 60) {
          sum += awayCount()
          n++
        }
      }
      return sum / n
    }

    const unbought = settle(undefined)
    const wholeBranch = settle({ D1: 1, D2: 1, D3: 1, D4: 1 })
    expect(wholeBranch).toBeLessThan(unbought)
  })

  it('can never buy the floor to a standstill — §7.8.9 rule 2', () => {
    // The whole branch bought, and people still stand up. Every destination the
    // branch names is gone; standing about and sitting on the sofa are not
    // destinations anybody can remove, so they are what is left. An automation
    // upgrade that emptied this would be the game solving its own joke.
    __setState({
      devs: 400,
      peakDevs: 400,
      devCap: 1,
      tech: { D1: 1, D2: 1, D3: 1, D4: 1 },
      slack: emptySlack(),
    })
    run(240)
    expect(awayCount()).toBeGreaterThan(0)
    for (const a of getState().slack.away) {
      expect(['water', 'whiteboard', 'window']).not.toContain(a.errand)
    }
  })
})
