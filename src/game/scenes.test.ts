import { describe, expect, it } from 'vitest'
import {
  HEY_AFTER_PAGE,
  IM_HEY_AFTER_PAGE,
  SCENES,
  SCENE_INSTANT_MESSENGER,
  SCENE_JAMES_ARRIVES,
  SCENE_JAMES_INSTANT_MESSENGER,
} from './scenes.ts'

const script = SCENE_JAMES_INSTANT_MESSENGER.script

describe('§21.6 — the lines are the product', () => {
  it('carries the running joke verbatim', () => {
    // Appendix D: text does the comedy work, not art. Paraphrasing one of
    // these is a content change and should have to break a test to happen.
    const all = script.map((l) => l.text)
    expect(all).toContain('How did you find me in every single reality?')
    expect(all).toContain('I saw the job posting.')
  })

  it('gives James the last word', () => {
    // The scene ends on him, not on the player's reaction. Ending on the
    // reaction would be explaining the joke.
    expect(script[script.length - 1].speaker).toBe('JAMES')
  })

  /**
   * §21.7.2 took Instant Messenger to Act I, where the joke is better — they
   * *are* sitting side by side, at two desks, on screen. So Run 2 hands over the
   * ring-1 protocol and the joke becomes structural: **James turns up in every
   * reality holding the next thing that lets people avoid each other.**
   *
   * What is pinned is therefore the *shape* rather than the tool: the scene must
   * still hand over a protocol, and it must not hand over the one Act I already
   * gave the player.
   */
  it('hands over the next protocol, not the one Act I already gave away', () => {
    const os = script.find((l) => l.speaker === 'STUDIO_OS')
    expect(os?.text).toContain('NEW PROTOCOL AVAILABLE')
    expect(os?.text).not.toContain('INSTANT MESSENGER')
  })

  it('hands it over as a punchline, not an unlock notification', () => {
    // §21.6: the STUDIO_OS line sits in the MIDDLE, wrapped in James being
    // sincere on both sides. Leading with it would make it an announcement.
    const osIndex = script.findIndex((l) => l.speaker === 'STUDIO_OS')
    expect(osIndex).toBeGreaterThan(0)
    expect(osIndex).toBeLessThan(script.length - 1)
  })

  it('keeps the beat before the reveal as its own page', () => {
    // In a typed box a pause is a page: the player taps through the silence,
    // which is what makes it a beat rather than a line break.
    const i = script.findIndex((l) => l.text === 'I saw the job posting.')
    expect(script[i + 1].speaker).toBe('JAMES')
    expect(script[i + 1].text).toContain('Anyway')
  })

  it('places the notification on a page that exists', () => {
    // The index is a fact about the script, so it lives beside it — insert a
    // line and this moves, and a stage direction pointing past the end would
    // silently never fire.
    expect(HEY_AFTER_PAGE).toBeLessThan(script.length)
    expect(script[HEY_AFTER_PAGE].speaker).toBe('JAMES')
  })
})

describe('§21.7.1 — James arrives, and nothing announces it', () => {
  const arrival = SCENE_JAMES_ARRIVES.script
  const all = arrival.map((l) => l.text)

  /**
   * §21.7.0 rule 3 — correct grammar, always. He corrects you once, without
   * emphasis, and explains it only when asked. This exchange is the whole
   * character in four lines and it is the first thing the player hears from him.
   */
  it('gets fewer and less right, and does not make a meal of it', () => {
    expect(all).toContain('I have fewer commitments than most people.')
    expect(all).toContain('Fewer. It’s countable.')
  })

  /** §21.7.0 rule 5. The gym, ten to eleven, every day. Every single day. */
  it('establishes the gym as a fact about the universe', () => {
    expect(all).toContain('I’m here eleven to seven. I go to the gym at ten.')
    expect(all[all.length - 1]).toBe('Every single day.')
  })

  /**
   * §21.7.1 — **no card award popup, no fanfare, no `NEW HERO ACQUIRED`.** The
   * second desk and the burn-down moving twice as fast is the entire
   * notification. This is the same argument §21.0 makes for refusing to narrate
   * that hiring works: an assertion is not something you can be betrayed by.
   */
  it('never announces itself', () => {
    for (const line of all) {
      expect(line).not.toMatch(/ACQUIRED|UNLOCKED|NEW HERO|CONGRATULATIONS/i)
    }
  })

  it('is short — a hero introduction is a handshake, not an act', () => {
    // §21.7.3 rule 1 sets this scene as the length nothing later exceeds.
    expect(arrival.length).toBeLessThanOrEqual(13)
  })
})

describe('§21.7.2 — Instant Messenger', () => {
  const im = SCENE_INSTANT_MESSENGER.script
  const all = im.map((l) => l.text)

  it('is the node James hands over', () => {
    const os = im.find((l) => l.speaker === 'STUDIO_OS')
    expect(os?.text).toContain('INSTANT MESSENGER')
  })

  it('lands the joke: they are sitting side by side', () => {
    expect(all).toContain('James, we’re sitting side by side.')
    // §21.7.0 rule 2 — he is *sincere* about it. This is good news, to him.
    expect(all).toContain('Yes. That’s the inefficiency.')
    expect(all[all.length - 1]).toBe('Check your messages.')
  })

  it('places the `hey` notification on a page that exists', () => {
    expect(IM_HEY_AFTER_PAGE).toBeLessThan(im.length)
    expect(im[IM_HEY_AFTER_PAGE].speaker).toBe('JAMES')
  })
})

describe('§10.7a.1 — every line knows who is speaking, in the world', () => {
  /**
   * The camera focuses down to the speaker, so a line without a `focus` is a
   * line the lens has no opinion about. That is a legitimate state — `STUDIO_OS`
   * has no body and the camera holds rather than cutting to a machine — but it
   * has to be *deliberate*, so the rule is asserted from the other end: every
   * line with a human speaker has one.
   */
  it('gives every embodied speaker a place to be', () => {
    for (const scene of Object.values(SCENES)) {
      for (const line of scene.script) {
        if (line.speaker === 'STUDIO_OS') {
          expect(line.focus).toBeUndefined()
        } else {
          expect(line.focus).toBeDefined()
        }
      }
    }
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

  it('carries no emoji anywhere — ART_DIRECTION §3.1', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
    for (const scene of Object.values(SCENES)) {
      expect(scene.script.filter((l) => emoji.test(l.text) || emoji.test(l.speaker))).toEqual([])
    }
  })
})
