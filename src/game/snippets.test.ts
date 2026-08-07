import { describe, expect, it } from 'vitest'
import { ALL_SNIPPETS, MAX_SNIPPET_LENGTH, SnippetBag, poolFor } from './snippets.ts'

describe('the §8.2a writing brief', () => {
  it('keeps every line inside the one-line budget', () => {
    // "If it needs two lines it is an essay, not a joke." At HUD size this is
    // roughly the width of the numeral's column.
    const tooLong = ALL_SNIPPETS.filter((s) => s.length > MAX_SNIPPET_LENGTH)
    expect(tooLong).toEqual([])
  })

  it('carries no emoji — ART_DIRECTION §3.1', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
    expect(ALL_SNIPPETS.filter((s) => emoji.test(s))).toEqual([])
  })

  it('has no duplicates, which would skew the shuffle bag', () => {
    expect(new Set(ALL_SNIPPETS).size).toBe(ALL_SNIPPETS.length)
  })
})

describe('state pools — §8.2a', () => {
  it('gives an overwhelmed developer nothing to say', () => {
    // §8.2 has them face-down on the keyboard yielding zero SP. A joke here
    // would be the game talking over its own gag.
    expect(poolFor('overwhelmed')).toEqual([])
    expect(new SnippetBag().next('overwhelmed')).toBeNull()
  })

  it('flavours the line by what the developer is doing', () => {
    expect(poolFor('rogue')).not.toEqual(poolFor('working'))
    expect(poolFor('tenx')).not.toEqual(poolFor('working'))
  })
})

describe('SnippetBag — §8.2a "never repeat consecutively"', () => {
  it('never deals the same line twice in a row', () => {
    // At five taps a second a repeat does not read as a coincidence, it reads
    // as a bug in the game. This is the reason the bag exists at all.
    const bag = new SnippetBag()
    let previous: string | null = null
    for (let i = 0; i < 500; i++) {
      const line = bag.next('working')
      expect(line).not.toBe(previous)
      previous = line
    }
  })

  it('deals the whole pool before repeating anything', () => {
    const bag = new SnippetBag()
    const pool = poolFor('working')
    const dealt = new Set(Array.from({ length: pool.length }, () => bag.next('working')))
    expect(dealt.size).toBe(pool.length)
  })

  it('does not repeat across a reshuffle seam', () => {
    // The bug this catches: a fresh shuffle can put the line that just played
    // at the front of the new bag, producing the one repeat the bag exists to
    // prevent. Forcing every shuffle to the identity order reproduces it.
    const bag = new SnippetBag(() => 0)
    const pool = poolFor('working')
    let previous: string | null = null
    for (let i = 0; i < pool.length * 4; i++) {
      const line = bag.next('working')
      expect(line).not.toBe(previous)
      previous = line
    }
  })

  it('keeps a separate bag per state', () => {
    // Switching states mid-run must not deal a working line from the rogue bag.
    const bag = new SnippetBag()
    for (let i = 0; i < 100; i++) {
      expect(poolFor('rogue')).toContain(bag.next('rogue'))
    }
  })

  it('is deterministic given a deterministic source of randomness', () => {
    const a = new SnippetBag(() => 0.5)
    const b = new SnippetBag(() => 0.5)
    const seqA = Array.from({ length: 40 }, () => a.next('working'))
    const seqB = Array.from({ length: 40 }, () => b.next('working'))
    expect(seqA).toEqual(seqB)
  })
})
