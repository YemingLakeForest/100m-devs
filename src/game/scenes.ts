/**
 * Scripted dialogue scenes — GDD §21.6 and the ladder it opens.
 *
 * §21.6 is the first of a set: "Every prestige tier gets one of these. The
 * Paradigm tree is a ladder of communication protocols (§13), and each one gets
 * a James scene where he introduces it with total sincerity and it is faintly
 * horrifying: stand-ups, ticketing, 'async-first', neural sync. The tools get
 * better and the humans get further apart. **That is the whole arc.**"
 *
 * So scenes are data with an id, not components. The id is what goes into the
 * permanent `milestones` union (§24.3) so a scene plays fully typed the first
 * time and fast on every replay — §10.7's one exception, which is a rendering
 * accommodation and never a skip.
 */

import type { DialogueLine } from '../ui/Dialogue.tsx'

export interface Scene {
  /** Stable id. Goes into permanent `milestones`; never renumber one. */
  id: string
  script: readonly DialogueLine[]
}

const PLAYER = 'YOU'
const JAMES = 'JAMES'
const OS = 'STUDIO_OS'

/**
 * §21.6 — Run 2, Act 0. The first thing after the first Paradigm Shift.
 *
 * Three jobs in under a minute: establish that James is the constant across
 * every run, land the running joke, and hand over the first Paradigm-tree tool
 * **as a punchline rather than an unlock notification**.
 *
 * The lines are §21.6 verbatim. They are the product — Appendix D says text
 * does the comedy work, not art — so paraphrasing one is a content change and
 * a test pins them.
 */
export const SCENE_JAMES_INSTANT_MESSENGER: Scene = {
  id: 'scene.run2.instant-messenger',
  script: [
    { speaker: PLAYER, text: 'James. You again.' },
    { speaker: PLAYER, text: 'How did you find me in every single reality?' },
    { speaker: JAMES, text: 'I saw the job posting.' },
    // The beat. §21.6 marks a pause here, and in a typed box a pause is a
    // page: the player has to tap through the silence, which is the joke.
    { speaker: JAMES, text: 'Anyway — I brought something. Look at this.' },
    {
      speaker: OS,
      text: 'NEW PROTOCOL AVAILABLE — INSTANT MESSENGER. Asynchronous text. Tier 1 Communication Infrastructure.',
    },
    {
      speaker: JAMES,
      text: 'Instant Messenger. So we don’t have to speak to each other any more.',
    },
    { speaker: PLAYER, text: 'James, we literally sit side by side.' },
    { speaker: JAMES, text: 'Exactly. That’s the whole point.' },
    { speaker: JAMES, text: 'Now we don’t even have to talk. Neat, right?' },
    // He turns back to his monitor. A notification appears over the player's
    // desk. It says `hey`. He is two feet away.
    { speaker: PLAYER, text: '…' },
    { speaker: JAMES, text: 'Check your messages.' },
  ],
}

/** Every scene, by id. */
export const SCENES: Record<string, Scene> = {
  [SCENE_JAMES_INSTANT_MESSENGER.id]: SCENE_JAMES_INSTANT_MESSENGER,
}

/**
 * The page index after which the `hey` notification appears over the player's
 * desk — §21.6's stage direction, and the beat the whole scene is built to.
 *
 * Held here rather than in the renderer because it is a fact about the script:
 * insert a line and this moves, and having it beside the lines is the only way
 * that stays true.
 */
export const HEY_AFTER_PAGE = 8
