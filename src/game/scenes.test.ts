import { describe, expect, it } from 'vitest'
import {
  HEY_AFTER_LINE,
  SCENES,
  SCENE_JAMES_ARRIVES,
  SCENE_MASS_HIRE,
  SCENE_JAMES_INSTANT_MESSENGER,
  SCENE_TEAM_ROOM_REMOTE_ASSIGNMENT,
  SCENE_JAMES_PROMOTED,
  SCENE_MO_ARRIVES,
  SCENE_SERENA_ARRIVES,
  SCENE_MATT_ARRIVES,
  SCENE_MELANY_ARRIVES,
  SCENE_BILLY_ARRIVES,
  SCENE_THE_THREAD,
  SCENE_THREAD_CLEARED,
  SCENE_FOUNDER_BOARD,
  SCENE_HERO_BOARD,
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

describe('§7.8.12 — the first remote assignment explains the room', () => {
  const remote = SCENE_TEAM_ROOM_REMOTE_ASSIGNMENT.script
  const all = remote.map((line) => line.text)

  it('names Instant Messenger as the reason the hero stays at their desk', () => {
    expect(all[0]).toContain('still in this room')
    expect(all).toContain('They have Instant Messenger.')
  })

  it('lets James be sincerely correct about delivery and wrong about management', () => {
    expect(all).toContain('It delivers every message instantly.')
    expect(all).toContain('They have all received a message.')
    expect(all.at(-1)).toBe('No. It scales better.')
    expect(remote.at(-1)!.speaker).toBe('JAMES')
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
    // The machine announces the new employee first, then the automatic
    // burn-down that follows him, then the punchline in its own box.
    expect(all[all.length - 3]).toContain('EMPLOYEE ONBOARDED')
    expect(all[all.length - 2]).toContain('STORY POINTS')
    expect(all[all.length - 2]).toContain('BURN DOWN')
    expect(all[all.length - 2]).toContain('AUTOMATICALLY')
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
    expect(arrival.length).toBeLessThanOrEqual(18)
  })
})

describe('§21.0c — Run 1 carries one idea', () => {
  /**
   * The whole of the §21.0c correction, asserted as a count.
   *
   * Act I gets James sitting down and nothing else.
   *
   * **Amended 2026-08-16 — Run 1 now has two scenes, and §21.0c survives it.**
   * The rule was never "one scene"; it is *one idea*, and the idea is hiring.
   * §21.0d's Act III scene is the trap springing — the same idea reaching its
   * conclusion — so it does not introduce a second one, and the count that
   * matters is still the Act I count. Every scene about a *system* still
   * belongs to a run that has been through the trap.
   */
  it('has one Act I scene, and it is the arrival', () => {
    const actOne = Object.keys(SCENES).filter((id) => id.startsWith('scene.act1.'))
    expect(actOne).toEqual([SCENE_JAMES_ARRIVES.id])
  })

  it('has one Act III scene, and it is the trap', () => {
    const actThree = Object.keys(SCENES).filter((id) => id.startsWith('scene.act3.'))
    expect(actThree).toEqual([SCENE_MASS_HIRE.id])
  })

  it('keeps every other scene in a run that has already collapsed', () => {
    // Nothing outside Run 1's two acts, and nothing at all about a *system*
    // before the shift that opens systems.
    const runOne = Object.keys(SCENES).filter(
      (id) => id.startsWith('scene.act1.') || id.startsWith('scene.act3.'),
    )
    const rest = Object.keys(SCENES).filter((id) => !runOne.includes(id))
    for (const id of rest) expect(id.startsWith('scene.run2.')).toBe(true)
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

describe('§21.0d [amended 2026-08-27] — the scene pitches, the button signs', () => {
  const script = SCENE_MASS_HIRE.script
  const all = script.map((l) => l.text)

  it('ends on the pitch, not on the signature', () => {
    // The old coda — `MASS HIRING PACKAGE ACCEPTED. AUTHORISED BY: J.` and the
    // two lines after it — made the transaction part of the scene, so the trap
    // could not be declined. The amendment hands the signature to the offer
    // button on the rail, so the script must stop where the pitch stops: on
    // "It's fine. It's a one-off.", with no acceptance anywhere in it.
    expect(all.at(-1)).toBe('It’s fine. It’s a one-off.')
    expect(all).not.toContain('MASS HIRING PACKAGE ACCEPTED. AUTHORISED BY: J.')
    expect(all).not.toContain('You were going to. This is fewer steps.')
    expect(script.at(-1)!.speaker).toBe('JAMES')
  })

  it('keeps the arithmetic checkable — §21.0e', () => {
    // The line the whole beat is built on: every number in it is countable on
    // the floor the player is looking at, because Run 1 does not hire.
    expect(all).toContain('Two of us shipped three games. A thousand of us is five hundred times that.')
  })

  it('walks James into §4.1 without letting him sign it', () => {
    // The communication-overhead curve, stated sincerely, by somebody who has
    // not multiplied the second number by the first — and now it is an
    // argument that ends in the player's lap rather than in his signature.
    expect(all).toContain('I’ll introduce myself to each of them. Once, and then never again.')
    expect(all).toContain('For me. They’ll each need to do the same.')
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

/**
 * §21.7.3's three shape rules — **and the one scene that is exempt from all
 * three, on purpose** [amended 2026-08-29].
 *
 * The rules describe an *arrival*: a handshake under twelve lines, James in it
 * once, and the machine opening the door. Billy's scene stopped being an arrival
 * when §13.8's floor moved behind it (`game/unlocks.ts`) — it is now a
 * hand-over, in which James is the door rather than a bystander and the studio's
 * own collapse is the thing that opens it.
 *
 * The exemption is written here rather than by quietly loosening the assertions,
 * because a rule with an undeclared exception is a rule nobody can rely on. So
 * the four arrivals are still held to the letter, and Billy's scene is held to
 * the things that are *still* true of every scene in the game.
 */
describe('§21.7.3 — the four story arrivals', () => {
  const arrivals = [
    SCENE_MO_ARRIVES,
    SCENE_SERENA_ARRIVES,
    SCENE_MATT_ARRIVES,
    SCENE_MELANY_ARRIVES,
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

describe('§21.7.3 — Billy, the referral', () => {
  const script = SCENE_BILLY_ARRIVES.script
  const said = script.map((l) => l.text).join(' ')

  it('opens on the collapse rather than on the door', () => {
    // The feeling this scene is written to is a gauge that halved and stayed
    // there (`storyTriggers.billyArrives`), so the machine reports the reading
    // and the founder reacts to it. `APPLICANT AT DOOR` still happens — twelve
    // lines later, once James has sent for him.
    expect(script[0].speaker).toBe('STUDIO_OS')
    expect(script[0].text).toContain('50%')
    expect(said).toContain('APPLICANT AT DOOR')
    expect(script.findIndex((l) => l.text.includes('APPLICANT AT DOOR'))).toBeGreaterThan(
      script.findIndex((l) => l.speaker === 'JAMES'),
    )
  })

  it('makes James the door, which is the whole exemption', () => {
    // Shape rule 3 caps James at one line *because* a second would compete with
    // the person walking in. Here he is the reason anybody walks in, so the cap
    // is what would break the scene. What has to stay true is that he is not
    // sentimental about it.
    const james = script.filter((l) => l.speaker === 'JAMES')
    expect(james.length).toBeGreaterThan(1)
    expect(said).toContain('I know someone')
  })

  it('lands the school on a founder who has never heard of it', () => {
    // The joke is the founder's, not Billy's: an entire world is named, twice,
    // and it does not connect to anything.
    expect(said).toContain('Winterbourne')
    expect(said).toContain('Is that a band?')
  })

  it('refuses the coffee, the drink, the McDonald’s and the Diet Coke', () => {
    // Every one of these is a callback the player has already been taught:
    // §21.7.1 spent a line on James living off Diet Coke.
    expect(said).toContain('McDonald')
    expect(said).toContain('Diet Coke')
    expect(said).toMatch(/I don’t, and I haven’t/)
  })

  it('hands over the floor in the machine’s own voice, and names the verb', () => {
    // §21.7.6 — the scene has to reach the verb, or the hand-over is an
    // assertion rather than a door. Both closing lines are `STUDIO_OS`, and the
    // last one is an instruction a player can follow without leaving the frame.
    expect(script.at(-1)!.speaker).toBe('STUDIO_OS')
    expect(script.at(-1)!.text).toContain('HERO')
    expect(said).toContain('SCRUM MASTER')
  })
})

describe('§18.0a — THE THREAD', () => {
  const script = SCENE_THE_THREAD.script
  const all = script.map((l) => l.text)

  it('opens on the machine and closes on the machine', () => {
    // The event is a state of the world, so the frame around it is `STUDIO_OS`
    // — the studio noticing, and then the studio stating the cost. James is
    // the conversation inside that frame, never the announcement.
    expect(script[0].speaker).toBe('STUDIO_OS')
    expect(script.at(-1)!.speaker).toBe('STUDIO_OS')
    expect(script.at(-1)!.text).toContain('25%')
  })

  /**
   * §21.7.0 rule 3, load-bearing for once. The founder says *less people* at
   * the exact moment they are asking how to have fewer of them talking, and the
   * correction turns out to be the answer.
   */
  it('turns the grammar correction into the mechanic', () => {
    const less = all.indexOf('Then we need less people talking at once.')
    expect(less).toBeGreaterThan(-1)
    expect(all[less + 1]).toBe('Fewer.')
    // He does not explain it unless asked (rule 3), so the player asks by
    // saying his name and he finishes the thought in one line.
    expect(all[less + 2]).toBe('James.')
    expect(all[less + 3]).toContain('It’s countable.')
  })

  it('sends the player at the board and does not care which node', () => {
    // §11.5's recognition tutorial, from the other end: the door is named, the
    // choice behind it is explicitly the player's, and James has no preference
    // because to him every node in the branch does the same good thing.
    expect(all.some((t) => t.includes('Open UPGRADES'))).toBe(true)
    expect(all.some((t) => t.includes('don’t mind which'))).toBe(true)
  })

  it('never lets James be in on the joke', () => {
    // §21.7.0 — "if a line of his reads as a wink, it is the wrong line."
    // He is unaffected by the thread because interruptions do not land on him,
    // and he says so as advice rather than as commentary.
    const james = script.filter((l) => l.speaker === 'JAMES')
    expect(james.length).toBeGreaterThan(0)
    for (const line of james) expect(line.text).not.toMatch(/obviously|of course|typical|again/i)
  })

  it('pays off only on the purchase exit', () => {
    // The two exits have to feel different or twenty taps is the better one.
    expect(SCENE_THREAD_CLEARED.script.at(-1)!.speaker).toBe('JAMES')
    expect(SCENE_THREAD_CLEARED.script.at(-1)!.text).toContain('meeting')
  })
})

describe('§21.7.7 — the three boards each arrive with somebody', () => {
  it('opens the founder’s board on being a rounding error in your own company', () => {
    const all = SCENE_FOUNDER_BOARD.script.map((l) => l.text)
    expect(all).toContain('Two per cent.')
    expect(all).toContain('I wrote this entire product.')
    // §13.7.1's whole thesis, and the scene never explains it: the Management
    // tree is a bit of everybody's job and you will be worse at all of it.
    expect(all.some((t) => t.includes('a bit of everyone’s job'))).toBe(true)
    expect(all.at(-1)).toBe('No.')
  })

  it('keeps James on the tool and the process in both board scenes', () => {
    // §21.7.3 rule 3, in substance. The "exactly one line" half of that rule is
    // a shape rule for *arrival* scenes, where a second James line would
    // compete with the person walking in. Nobody walks in here — so what is
    // asserted is the part that is about him rather than about staging: he
    // never talks about a person.
    const james = [...SCENE_FOUNDER_BOARD.script, ...SCENE_HERO_BOARD.script].filter(
      (l) => l.speaker === 'JAMES',
    )
    expect(james.length).toBeGreaterThan(0)
    for (const line of james) {
      for (const hero of ['Mo', 'Serena', 'Matt', 'Melany', 'Billy']) {
        expect(line.text).not.toMatch(new RegExp(`\\b${hero}\\b`))
      }
    }
  })

  it('introduces the hero board as a board, never as a hero', () => {
    // The player chooses who to place, so the scene must read the same whoever
    // levelled first. Naming one would be wrong for five of the six.
    const all = SCENE_HERO_BOARD.script.map((l) => l.text)
    for (const hero of ['Mo', 'Serena', 'Matt', 'Melany', 'Billy']) {
      for (const line of all) expect(line).not.toMatch(new RegExp(`\\b${hero}\\b`))
    }
    expect(all.some((t) => t.includes('point'))).toBe(true)
  })

  it('states §13.9.1 as a fact about a person rather than a starting bonus', () => {
    const all = SCENE_HERO_BOARD.script.map((l) => l.text)
    expect(all).toContain('Everyone starts somewhere different on it. That’s what makes them who they are.')
    // James is the trunk: half as good at everything, everywhere (§13.9.1).
    expect(all.some((t) => t.includes('Half as good at everything'))).toBe(true)
  })

  it('is a handshake, not an act', () => {
    for (const scene of [SCENE_FOUNDER_BOARD, SCENE_HERO_BOARD, SCENE_THREAD_CLEARED]) {
      expect(scene.script.length).toBeLessThan(12)
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
