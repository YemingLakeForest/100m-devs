import { describe, expect, it } from 'vitest'
import {
  CHATTER,
  EXCHANGES,
  LOITER,
  LONGEST,
  chatterLine,
  exchange,
  loiterLine,
} from './chatter.ts'

describe('the line pool — GDD §7.8.6', () => {
  it('keeps every line short enough to fit in a bubble', () => {
    // A bubble over one developer on a floor of forty has room for about thirty
    // characters before it stops being a bubble and starts being a paragraph
    // with a tail. This is the constraint that made the first, wordless version
    // look like the only option.
    expect(LONGEST).toBeLessThanOrEqual(32)
  })

  it('has no duplicates, which is what makes a small pool feel large', () => {
    expect(new Set(CHATTER).size).toBe(CHATTER.length)
    expect(new Set(LOITER).size).toBe(LOITER.length)
  })

  it('writes exchanges as pairs rather than as two independent draws', () => {
    // §7.8.6: "the joke in an interruption is the reply". Two unrelated lines
    // side by side read as two people ignoring each other, which is a different
    // and much later joke.
    for (const pair of EXCHANGES) {
      expect(pair).toHaveLength(2)
      expect(pair[0]).not.toBe(pair[1])
    }
  })

  it('never falls off the end of its own table', () => {
    // The classic sampler bug, and the one that shows up as a crash for one
    // player in a thousand rather than as a failing test.
    for (const r of [0, 0.0001, 0.5, 0.9999, 1]) {
      expect(CHATTER).toContain(chatterLine(r))
      expect(LOITER).toContain(loiterLine(r))
      expect(EXCHANGES).toContain(exchange(r))
    }
  })

  it('uses the whole pool', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) seen.add(chatterLine(i / 500))
    expect(seen.size).toBe(CHATTER.length)
  })

  it('contains no emoji — ART_DIRECTION §3.1', () => {
    const all = [...CHATTER, ...LOITER, ...EXCHANGES.flat()].join(' ')
    expect(/\p{Extended_Pictographic}/u.test(all)).toBe(false)
  })
})
