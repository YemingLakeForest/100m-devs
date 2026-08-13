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
 * §10.7a.1 — where each speaker is.
 *
 * **James is seat 0** in every scene he appears in, because he is Dev #1 and
 * §7.8.1b's rule is that a seat once taken never moves. The founder is the
 * corner desk. `STUDIO_OS` has no body and therefore no focus: the camera holds
 * where it is rather than cutting to a machine, which is also the only sensible
 * reading of "focus down to the person speaking" when nobody is.
 */
const AT_JAMES = 0
const AT_YOU = 'founder' as const

/**
 * §21.7.1 — *"Is this seat taken?"* Act I, at §21.0b's fiftieth poke.
 *
 * He is free, he is not hired, and there is no `NEW HERO ACQUIRED` anywhere in
 * this scene. **The second desk and the burn-down moving twice as fast is the
 * entire notification**, which is the same argument §21.0's Act IIa makes for
 * refusing to narrate that hiring works: an assertion is not something you can
 * be betrayed by later, and evidence is.
 *
 * Every line is derived from §21.7.0's five facts about him. The comedy is that
 * he is **completely correct about a small thing** while the large thing goes
 * wrong behind him — the correction is delivered without emphasis, he does not
 * explain it, and he moves on.
 */
export const SCENE_JAMES_ARRIVES: Scene = {
  id: 'scene.act1.james-arrives',
  script: [
    { speaker: OS, text: 'APPLICANT AT DOOR.' },
    { speaker: PLAYER, text: 'Can I help you?', focus: AT_YOU },
    { speaker: JAMES, text: 'You posted a job.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'I posted that eleven minutes ago.', focus: AT_YOU },
    // §21.7.0 rule 3. Correct grammar, always, and he will not explain it
    // unless asked — so the player asks, and he does, in four words.
    { speaker: JAMES, text: 'I have fewer commitments than most people.', focus: AT_JAMES },
    { speaker: PLAYER, text: '...Fewer?', focus: AT_YOU },
    { speaker: JAMES, text: 'Fewer. It’s countable.', focus: AT_JAMES },
    // He sits down at the empty desk. He opens a Diet Coke (§21.7.0 rule 4).
    { speaker: PLAYER, text: 'I can’t pay you.', focus: AT_YOU },
    { speaker: JAMES, text: 'I know. I read the posting.', focus: AT_JAMES },
    { speaker: JAMES, text: 'I’m here eleven to seven. I go to the gym at ten.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'Every day?', focus: AT_YOU },
    // §21.7.0 rule 5, and it is a mechanic: an hour a day where the game's most
    // reliable card is simply absent.
    { speaker: JAMES, text: 'Every single day.', focus: AT_JAMES },
  ],
}

/**
 * §21.6 — Run 2, Act 0. The first thing after the first Paradigm Shift.
 *
 * Three jobs in under a minute: establish that James is the constant across
 * every run, land the running joke, and hand over the first tool **as a
 * punchline rather than an unlock notification**.
 *
 * **Amended 2026-08-12 — Instant Messenger comes back here.** For one day it
 * lived in Act I, on the argument that the joke is better when the two of them
 * are visibly sitting side by side at two desks. The joke *is* better there, and
 * it was the wrong trade: §21.0c wants Run 1 to carry one idea, and this scene
 * arrived with an upgrade tree, a granted node and a second cutscene inside the
 * four minutes that idea has. The joke survives the move without a word changed,
 * because in Run 2 they are still sitting side by side — that was never a fact
 * about which act it was in.
 *
 * *"How did you find me in every single reality?"* is the best opening line in
 * the script and it has not moved.
 *
 * The id has never changed through either rewrite. It is the key into §24.3's
 * `milestones` union, and renumbering it would replay a scene for every player
 * who has already sat through one at that moment — which is exactly the thing
 * §10.7's replay exception exists to prevent.
 */
export const SCENE_JAMES_INSTANT_MESSENGER: Scene = {
  id: 'scene.run2.instant-messenger',
  script: [
    { speaker: PLAYER, text: 'James. You again.', focus: AT_YOU },
    { speaker: PLAYER, text: 'How did you find me in every single reality?', focus: AT_YOU },
    { speaker: JAMES, text: 'I saw the job posting.', focus: AT_JAMES },
    // The beat. §21.6 marks a pause here, and in a typed box a pause is a
    // page: the player has to tap through the silence, which is the joke.
    { speaker: JAMES, text: 'Anyway — I brought something. Look at this.', focus: AT_JAMES },
    {
      speaker: OS,
      text: 'NEW PROTOCOL AVAILABLE — INSTANT MESSENGER. Asynchronous text. Tier 1 Communication Infrastructure.',
    },
    {
      speaker: JAMES,
      text: 'Instant Messenger. So we don’t have to speak to each other any more.',
      focus: AT_JAMES,
    },
    { speaker: PLAYER, text: 'James, we’re sitting side by side.', focus: AT_YOU },
    // §21.7.0 rule 2 — he is sincere about it. This is good news, to him.
    { speaker: JAMES, text: 'Yes. That’s the inefficiency.', focus: AT_JAMES },
    // He turns back to his monitor. A notification appears over the player's
    // desk. It says `hey`. He is two feet away.
    { speaker: PLAYER, text: '…', focus: AT_YOU },
    { speaker: JAMES, text: 'Check your messages.', focus: AT_JAMES },
  ],
}

/** Every scene, by id. */
export const SCENES: Record<string, Scene> = {
  [SCENE_JAMES_ARRIVES.id]: SCENE_JAMES_ARRIVES,
  [SCENE_JAMES_INSTANT_MESSENGER.id]: SCENE_JAMES_INSTANT_MESSENGER,
}

/**
 * The **line** after which the `hey` notification appears over the player's
 * desk — §21.6's stage direction, and the beat the whole scene is built to.
 *
 * Held here rather than in the renderer because it is a fact about the script:
 * insert a line and this moves, and having it beside the lines is the only way
 * that stays true.
 *
 * A line and not a page, despite what this was called until 2026-08-12. §10.7a.2
 * paginates a long line into several boxes, so the two indices are different
 * numbers for any script containing a long line — and this one contains the
 * `STUDIO_OS` protocol announcement, which is four pages on its own. Nothing
 * read it but a test while the names disagreed, which is the only reason it
 * never fired; the §10.7a.1 camera work is about to.
 */
export const HEY_AFTER_LINE = 7
