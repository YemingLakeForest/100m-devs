import { describe, expect, it } from 'vitest'
import {
  HEY_AFTER_LINE,
  SCENES,
  SCENE_JAMES_ARRIVES,
  SCENE_JAMES_INSTANT_MESSENGER,
  SCENE_JAMES_PROMOTED,
  SCENE_MO_ARRIVES,
  SCENE_SERENA_ARRIVES,
  SCENE_MATT_ARRIVES,
  SCENE_MELANY_ARRIVES,
  SCENE_BILLY_ARRIVES,
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
   * §21.0c — **this is where Instant Messenger is handed over, and the only
   * place.** It spent one day in Act I; §11.5's node is the root of a board Run
   * 1 cannot open, so giving it away there gave away the centre of a tree behind
   * a locked door.
   */
  it('is the scene that hands over Instant Messenger', () => {
    const os = script.find((l) => l.speaker === 'STUDIO_OS')
    expect(os?.text).toContain('NEW PROTOCOL AVAILABLE')
    expect(os?.text).toContain('INSTANT MESSENGER')
  })

  it('lands the joke: they are sitting side by side', () => {
    const all = script.map((l) => l.text)
    expect(all).toContain('James, we’re sitting side by side.')
    // §21.7.0 rule 2 — he is *sincere* about it. This is good news, to him.
    expect(all).toContain('Yes. That’s the inefficiency.')
    expect(all[all.length - 1]).toBe('Check your messages.')
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

  it('places the notification on a line that exists, spoken by the person who sent it', () => {
    // The index is a fact about the script, so it lives beside it — insert a
    // line and this moves, and a stage direction pointing past the end would
    // silently never fire.
    //
    // A *line* index, not a page one: §10.7a.2 paginates the STUDIO_OS
    // announcement into four boxes on its own, so the two numbers differ. The
    // constant was called `HEY_AFTER_PAGE` while this test read it as a line,
    // which is exactly the sort of agreement that holds until somebody uses it.
    expect(HEY_AFTER_LINE).toBeLessThan(script.length)
    expect(script[HEY_AFTER_LINE].speaker).toBe('JAMES')
    // The `hey` lands in the silence he leaves, so the next line is the player
    // having nothing to say.
    expect(script[HEY_AFTER_LINE + 1].text).toBe('…')
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
    expect(all).toContain('Every single day.')
  })

  it('goes straight back to work, very focused — §21.7.0 rule 1', () => {
    expect(all).toContain('I’m going straight back to work. I don’t stop once I start.')
  })

  it('ends on the burn-down transition — the mechanism, not the man', () => {
    expect(all[all.length - 2]).toContain('STORY POINTS')
    expect(all[all.length - 2]).toContain('BURN DOWN')
    // "CAPITALISM." gets its own box — the machine's punchline, delivered with
    // no irony at all.
    expect(all[all.length - 1]).toBe('CAPITALISM.')
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
    expect(arrival.length).toBeLessThanOrEqual(17)
  })
})

describe('§21.0c — Run 1 has exactly one scene', () => {
  /**
   * The whole of the §21.0c correction, asserted as a count.
   *
   * Act I gets James sitting down and nothing else. Every other scene in the
   * game belongs to a run that has already been through the trap — and the way
   * that is enforced is that there is only one scene whose id says `act1`.
   */
  it('has one Act I scene, and it is the arrival', () => {
    const actOne = Object.keys(SCENES).filter((id) => id.startsWith('scene.act1.'))
    expect(actOne).toEqual([SCENE_JAMES_ARRIVES.id])
  })

  /**
   * Nothing in Act I mentions a tool, a protocol or an upgrade. §21.0c's rule
   * is not "fewer scenes" but "one idea", and a line of Act I dialogue naming a
   * piece of Communication Infrastructure would reintroduce the second idea
   * without needing a second scene to do it in.
   */
  it('never names a tool in Act I', () => {
    for (const line of SCENE_JAMES_ARRIVES.script) {
      expect(line.text).not.toMatch(/PROTOCOL|MESSENGER|UPGRADE|CHANNEL/i)
    }
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

describe('§21.7.3 — the five story hires', () => {
  const arrivals = [
    SCENE_MO_ARRIVES,
    SCENE_SERENA_ARRIVES,
    SCENE_MATT_ARRIVES,
    SCENE_MELANY_ARRIVES,
    SCENE_BILLY_ARRIVES,
  ]

  it('is a handshake, not an act — under twelve lines', () => {
    for (const scene of arrivals) {
      expect(scene.script.length).toBeLessThan(12)
    }
  })

  it('has James in every one, saying exactly one line', () => {
    for (const scene of arrivals) {
      const james = scene.script.filter((l) => l.speaker === 'JAMES')
      expect(james).toHaveLength(1)
    }
  })

  it('has James talk about the tool or the process, never the person', () => {
    // §21.7.3 shape rule 3 — he does not notice people arriving. Word-boundary
    // matched, because "More capacity" is not a mention of Mo.
    for (const scene of arrivals) {
      const line = scene.script.find((l) => l.speaker === 'JAMES')!
      for (const hero of ['Mo', 'Serena', 'Matt', 'Melany', 'Billy']) {
        expect(line.text).not.toMatch(new RegExp(`\\b${hero}\\b`))
      }
    }
  })

  it('opens on the same door as Act I — APPLICANT AT DOOR', () => {
    for (const scene of arrivals) {
      expect(scene.script[0].speaker).toBe('STUDIO_OS')
      expect(scene.script[0].text).toContain('APPLICANT AT DOOR')
    }
  })
})

describe('§21.7.4 — Global Head of His Desk', () => {
  it('gives James the last word, and it is a James line', () => {
    expect(SCENE_JAMES_PROMOTED.script.at(-1)!.speaker).toBe('JAMES')
    expect(SCENE_JAMES_PROMOTED.script.at(-1)!.text).toBe('Fewer surprises.')
  })

  it('is the corporate ladder rendered as a string', () => {
    const os = SCENE_JAMES_PROMOTED.script.find((l) => l.speaker === 'STUDIO_OS')!
    expect(os.text).toContain('GLOBAL HEAD OF HIS DESK')
  })
})
