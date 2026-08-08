import { describe, expect, it } from 'vitest'
import { HEY_AFTER_PAGE, SCENES, SCENE_JAMES_INSTANT_MESSENGER } from './scenes.ts'

const script = SCENE_JAMES_INSTANT_MESSENGER.script

describe('§21.6 — the lines are the product', () => {
  it('carries the running joke verbatim', () => {
    // Appendix D: text does the comedy work, not art. Paraphrasing one of
    // these is a content change and should have to break a test to happen.
    const all = script.map((l) => l.text)
    expect(all).toContain('How did you find me in every single reality?')
    expect(all).toContain('I saw the job posting.')
    expect(all).toContain('James, we literally sit side by side.')
    expect(all).toContain('Exactly. That’s the whole point.')
    expect(all).toContain('Check your messages.')
  })

  it('gives James the last word', () => {
    // The scene ends on "Check your messages" from two feet away. Ending on
    // the player's reaction would be explaining the joke.
    expect(script[script.length - 1].speaker).toBe('JAMES')
  })

  it('hands over the tool as a punchline, not an unlock notification', () => {
    // §21.6: the STUDIO_OS line sits in the MIDDLE, wrapped in James being
    // sincere on both sides. Leading with it would make it an announcement.
    const osIndex = script.findIndex((l) => l.speaker === 'STUDIO_OS')
    expect(osIndex).toBeGreaterThan(0)
    expect(osIndex).toBeLessThan(script.length - 1)
    expect(script[osIndex].text).toContain('INSTANT MESSENGER')
  })

  it('keeps the beat before the reveal as its own page', () => {
    // In a typed box a pause is a page: the player taps through the silence,
    // which is what makes it a beat rather than a line break.
    const i = script.findIndex((l) => l.text === 'I saw the job posting.')
    expect(script[i + 1].speaker).toBe('JAMES')
    expect(script[i + 1].text).toContain('Anyway')
  })

  it('places the `hey` notification on a page that exists', () => {
    // The index is a fact about the script, so it lives beside it — insert a
    // line and this moves, and a stage direction pointing past the end would
    // silently never fire.
    expect(HEY_AFTER_PAGE).toBeLessThan(script.length)
    expect(script[HEY_AFTER_PAGE].speaker).toBe('JAMES')
  })

  it('carries no emoji — ART_DIRECTION §3.1', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
    expect(script.filter((l) => emoji.test(l.text) || emoji.test(l.speaker))).toEqual([])
  })
})

describe('the scene registry', () => {
  it('registers every scene under its own id', () => {
    for (const [id, scene] of Object.entries(SCENES)) {
      expect(scene.id).toBe(id)
    }
  })

  it('uses ids stable enough to store in a save', () => {
    // The id goes into the permanent `milestones` union (§24.3), so renumbering
    // one makes every existing player watch that scene again at full speed.
    for (const id of Object.keys(SCENES)) {
      expect(id).toMatch(/^scene\.[a-z0-9.-]+$/)
    }
  })
})
