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
// §21.7.3 — the five story hires sit at the desks after James's, in the order
// the systems bring them in. A seat rather than a name, on the same argument
// §7.8.8 makes: identities are generated from the seat, so a script costs one
// integer per line.
const AT_MO = 1
const AT_SERENA = 2
const AT_MATT = 3
const AT_MELANY = 4
const AT_BILLY = 5

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
    // The founder's wordless reaction to the door announcement — before he has
    // seen anything fall out of the ceiling.
    { speaker: PLAYER, text: 'What—', focus: AT_YOU },
    // §21.7.1 — James drops in on this beat and says so. One word, correct
    // grammar, delivered mid-fall, and the lens stays on him for it.
    { speaker: JAMES, text: 'Ouch.', focus: AT_JAMES },
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
    // §21.7.0 rule 4 — he lives on Diet Coke. Sincere, and it answers the wrong
    // question: the player is worried about money, James is worried about his
    // lunch. He has brought his own.
    { speaker: JAMES, text: 'I live off Diet Coke. I have brought my own.', focus: AT_JAMES },
    { speaker: JAMES, text: 'I’m here eleven to seven. I go to the gym at ten.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'Every day?', focus: AT_YOU },
    // §21.7.0 rule 5, and it is a mechanic: an hour a day where the game's most
    // reliable card is simply absent.
    { speaker: JAMES, text: 'Every single day.', focus: AT_JAMES },
    // §21.7.0 rule 1 — extreme focus. He goes straight back to work, and he is
    // not going to be distracted again.
    { speaker: JAMES, text: 'I’m going straight back to work. I don’t stop once I start.', focus: AT_JAMES },
    // The transition §21.7.1 never narrated: he starts working, and the
    // burn-down moves on its own now. The machine states both new facts plainly
    // — there is an employee now, and the points burn with no input — and then
    // names the culprit with no irony at all, on its own beat.
    { speaker: OS, text: 'EMPLOYEE ONBOARDED: J.' },
    { speaker: OS, text: 'STORY POINTS NOW BURN DOWN AUTOMATICALLY. NO TAPPING REQUIRED.' },
    { speaker: OS, text: 'CAPITALISM.' },
  ],
}

/**
 * §21 Act III — **the mousetrap, and James springs it.** R85.
 *
 * The bait used to be a banner and a button: `STUDIO_OS` announced a MASS
 * HIRING PACKAGE, the sarcastic advisor said *"Math doesn't lie! ... What could
 * possibly go wrong?"*, and the player pressed `HIRE 1,000 DEVS NOW`. §21.0
 * defended that as a decision — *"§6 is explicit that the lesson needs the
 * player to choose it"* — and §21.0d is the amendment that says why it was not
 * one.
 *
 * **The advisor is visibly lying.** It has been sarcastic since Act I and it
 * ends its pitch with "what could possibly go wrong". Pressing that button is
 * not a decision; it is going along with a gag. A player who is betrayed by a
 * gag has learned that the game was joking.
 *
 * So the person who signs it is **James**, and every line here is §21.7.0
 * working exactly as specified: he is *completely correct about a small thing*
 * — the multiplication is right, he did check it twice — while the large thing
 * goes wrong behind him. He is not in on it, he is not being wry, and he means
 * every word.
 *
 * **The two lines in the middle are §4.1's equation said out loud by the man it
 * is about to destroy.** He offers to introduce himself to each of them once;
 * the founder points out that this is a thousand conversations; he agrees, and
 * observes that they will each need to do the same. Then he says it is fine
 * because it is a one-off. That is the communication-overhead curve, stated
 * sincerely, by somebody who has not multiplied the second number by the first.
 *
 * The last line is the only one that could be mistaken for a wink and it is
 * not: *"This is fewer steps"* is §21.7.0 rule 2 — fewer human interactions,
 * always, presented as good news — with rule 3's word used correctly, applied
 * to a decision he has just taken out of the founder's hands.
 */
export const SCENE_MASS_HIRE: Scene = {
  id: 'scene.act3.mass-hire',
  script: [
    {
      speaker: OS,
      text: 'LIMITED OFFER: MASS HIRING PACKAGE. "Why hire one by one when you can hire an entire swarm?" COST: YOUR ENTIRE TREASURY.',
    },
    { speaker: PLAYER, text: 'James. Is this a good idea?', focus: AT_YOU },
    { speaker: JAMES, text: 'It’s one thousand developers.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'That’s not what I asked.', focus: AT_YOU },
    // The arithmetic is correct. That is the joke and it is the whole of §6.
    //
    // **Three, and it is checkable** [amended 2026-08-27]. It said "four games",
    // and §21.0's Act IIa meant the player heard it holding forty developers, so
    // both halves of the sentence were false on screen: not four games, and
    // emphatically not two of us. §21.0e is the fix — Run 1 never hires, the
    // garage catalogue is exactly {@link TERM_SHEET_AFTER_SHIPS} games, and
    // every number James says here is now something the player can count.
    {
      speaker: JAMES,
      text: 'Two of us shipped three games. A thousand of us is five hundred times that.',
      focus: AT_JAMES,
    },
    { speaker: PLAYER, text: 'Is it?', focus: AT_YOU },
    { speaker: JAMES, text: 'It’s arithmetic. I checked it twice.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'And the meetings?', focus: AT_YOU },
    // §4.1, in four lines, sincerely, by the person it is about to destroy.
    { speaker: JAMES, text: 'I’ll introduce myself to each of them. Once, and then never again.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'That’s a thousand conversations.', focus: AT_YOU },
    { speaker: JAMES, text: 'For me. They’ll each need to do the same.', focus: AT_JAMES },
    { speaker: PLAYER, text: '…', focus: AT_YOU },
    { speaker: JAMES, text: 'It’s fine. It’s a one-off.', focus: AT_JAMES },
    // {@link MASS_HIRE_AT_LINE} — the treasury goes here, and the studio with it.
    { speaker: OS, text: 'MASS HIRING PACKAGE ACCEPTED. AUTHORISED BY: J.' },
    // §21.0a's term sheet said `USE OF FUNDS — HEADCOUNT` in a table nobody
    // read, four beats ago. He is not quoting it; he has simply done what the
    // document said, which is the most James thing in the script.
    { speaker: PLAYER, text: 'James—', focus: AT_YOU },
    // §21.7.0 rule 2, with rule 3's word used correctly, applied to a decision
    // he has just taken out of your hands. He is being helpful.
    { speaker: JAMES, text: 'You were going to. This is fewer steps.', focus: AT_JAMES },
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

/**
 * §21.7.3 — the five story hires. One rule: **a hero arrives the first time the
 * player feels the problem that hero solves.** Each scene is a handshake, not an
 * act — under twelve lines, the hero fixes nothing during it (they sit down, the
 * number improves afterwards from their work), and James says exactly one line,
 * always about the *tool* or the *process*, never about the person.
 */

/** Mo — Quality. A release scored below baseline on defects, and she asks the question you were avoiding. */
export const SCENE_MO_ARRIVES: Scene = {
  id: 'scene.run2.mo-arrives',
  script: [
    { speaker: OS, text: 'APPLICANT AT DOOR. REFERENCES: NONE. ATTITUDE: CONCERNING.' },
    { speaker: 'MO', text: 'I read your release notes. Show me the code.', focus: AT_MO },
    { speaker: PLAYER, text: 'We’re in the middle of a sprint.', focus: AT_YOU },
    { speaker: 'MO', text: 'I’m not blocking it. I’m just asking what happens if someone taps it twice.', focus: AT_MO },
    { speaker: JAMES, text: 'A second pass before ship would catch more defects.', focus: AT_JAMES },
    { speaker: 'MO', text: 'He’s right. I’ll start with the button.', focus: AT_MO },
  ],
}

/** Serena — Reliability. The first incident to stop a release earning, and she is calmest when things are worst. */
export const SCENE_SERENA_ARRIVES: Scene = {
  id: 'scene.run2.serena-arrives',
  script: [
    { speaker: OS, text: 'APPLICANT AT DOOR.' },
    { speaker: 'SERENA', text: 'I have a runbook for this. I wrote it before this happened.', focus: AT_SERENA },
    { speaker: PLAYER, text: 'We don’t have a runbook.', focus: AT_YOU },
    { speaker: 'SERENA', text: 'You do now. It’s up.', focus: AT_SERENA },
    { speaker: PLAYER, text: 'What’s up?', focus: AT_YOU },
    {
      speaker: 'SERENA',
      text: 'The game. It was never really down. It was degraded. There’s a difference and it matters.',
      focus: AT_SERENA,
    },
    { speaker: JAMES, text: 'Incident response is a process. She has the process.', focus: AT_JAMES },
  ],
}

/** Matt — Support. The only person in the company who has spoken to a player. */
export const SCENE_MATT_ARRIVES: Scene = {
  id: 'scene.run2.matt-arrives',
  script: [
    { speaker: OS, text: 'APPLICANT AT DOOR.' },
    { speaker: 'MATT', text: 'Hi. Four hundred people wrote in about the same button.', focus: AT_MATT },
    { speaker: PLAYER, text: 'The blue one?', focus: AT_YOU },
    {
      speaker: 'MATT',
      text: 'I don’t know what it does either. That’s fine. I’ll find out.',
      focus: AT_MATT,
    },
    { speaker: JAMES, text: 'A ticket queue needs somebody answering it.', focus: AT_JAMES },
  ],
}

/** Melany — Cloud. Infinite elasticity, invoiced monthly. */
export const SCENE_MELANY_ARRIVES: Scene = {
  id: 'scene.run2.melany-arrives',
  script: [
    { speaker: OS, text: 'APPLICANT AT DOOR.' },
    { speaker: 'MELANY', text: 'I saw you hit your capacity. We can absolutely scale to that.', focus: AT_MELANY },
    { speaker: PLAYER, text: 'What’s the catch?', focus: AT_YOU },
    {
      speaker: 'MELANY',
      text: 'I’d want to talk about the bill afterwards. Afterwards is fine.',
      focus: AT_MELANY,
    },
    { speaker: JAMES, text: 'More capacity is a product you can buy.', focus: AT_JAMES },
  ],
}

/** Billy — Cohesion. Believes in process, sincerely, and it works. */
export const SCENE_BILLY_ARRIVES: Scene = {
  id: 'scene.run2.billy-arrives',
  script: [
    { speaker: OS, text: 'APPLICANT AT DOOR.' },
    { speaker: 'BILLY', text: 'I’ve booked fifteen minutes. If we don’t need fifteen minutes, we’ll give them back.', focus: AT_BILLY },
    { speaker: PLAYER, text: 'Do we have fifteen minutes?', focus: AT_YOU },
    { speaker: 'BILLY', text: 'You have less. That’s why I booked them.', focus: AT_BILLY },
    { speaker: JAMES, text: 'A meeting is a tool for talking less, if you do it right.', focus: AT_JAMES },
  ],
}

/**
 * §18.0a — **THE THREAD.** The first event in the game, and it is mandatory.
 *
 * The studio has stopped because one question is being answered by everybody at
 * once. It is §6's trap arriving *at* the player rather than because of them,
 * and this time there is an answer — on a board they have never opened.
 *
 * **Every line is James being completely correct about a small thing while the
 * large thing goes wrong behind him** (§21.7.0). He is unaffected: rule 1 says
 * the floor's interruptions do not land on him, so he is the only person in the
 * building still working and he is entirely calm about it. The tool he produces
 * is, as always, a tool for talking to people less, and he presents it as good
 * news, because to him it is.
 *
 * The grammar correction (rule 3) is the hinge of the scene rather than a
 * garnish: the founder says *less people* at the exact moment they are asking
 * how to have fewer of them talking, James corrects it without emphasis, and
 * the correction turns out to be the answer.
 */
export const SCENE_THE_THREAD: Scene = {
  id: 'scene.run2.the-thread',
  script: [
    { speaker: OS, text: 'UNSTRUCTURED COMMUNICATION EVENT. PARTICIPANTS: ALL. DECISIONS: 0.' },
    { speaker: PLAYER, text: 'Why has everything stopped?', focus: AT_YOU },
    { speaker: JAMES, text: 'Somebody asked a question in the main channel.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'What was the question?', focus: AT_YOU },
    // He answers it completely, without irony, because it is what happened.
    { speaker: JAMES, text: 'Whether we should have a channel for questions.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'Fine. I’ll poke them. I’ll poke all of them.', focus: AT_YOU },
    // §21.7.0 rule 1 — he is not distracted, ever, and he cannot see why anyone
    // would be. This is sincere advice.
    { speaker: JAMES, text: 'You can. They’re typing. You’d be interrupting them typing.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'Then we need less people talking at once.', focus: AT_YOU },
    // Rule 3. Once, without emphasis, and he continues his sentence.
    { speaker: JAMES, text: 'Fewer.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'James.', focus: AT_YOU },
    { speaker: JAMES, text: 'Fewer people. It’s countable. And yes — that’s the fix.', focus: AT_JAMES },
    // §11.5's board, handed over as relief rather than as a tutorial. He does
    // not care which node; every one of them is a way to talk to people less,
    // which to him makes them interchangeable and all good.
    { speaker: JAMES, text: 'Open UPGRADES. Buy anything. I genuinely don’t mind which.', focus: AT_JAMES },
    { speaker: JAMES, text: 'They all do the same thing. They make people talk to each other less.', focus: AT_JAMES },
    { speaker: OS, text: 'STUDIO OUTPUT HELD AT 25% PENDING COMMUNICATION INFRASTRUCTURE.' },
  ],
}

/**
 * §18.0a — the payoff, and **only for the purchase exit.**
 *
 * A player who taps their way out of the thread gets no scene, and that is the
 * design rather than an omission: the two exits have to feel different or the
 * hand-clear is strictly better. Twenty taps ends a thread. A protocol ends
 * threads.
 */
export const SCENE_THREAD_CLEARED: Scene = {
  id: 'scene.run2.thread-cleared',
  script: [
    { speaker: OS, text: 'THREAD ARCHIVED. 0 PARTICIPANTS. 0 DECISIONS.' },
    { speaker: PLAYER, text: 'It just… stopped.', focus: AT_YOU },
    { speaker: JAMES, text: 'They’re all still talking. They’re doing it somewhere I can mute.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'That’s not the same as solving it.', focus: AT_YOU },
    { speaker: JAMES, text: 'No. It’s better. Solving it would have been a meeting.', focus: AT_JAMES },
  ],
}

/**
 * §21.7.7 — **the founder's own board arrives with the founder.**
 *
 * §13.7.1's Management tree was reachable from the first frame of Run 1, which
 * is §21.7.6's rule broken in the one place it is easiest to miss: the tree is
 * an *instrument*, the founder's desk is the *mechanism*, and only the second
 * one has been earned since the garage.
 *
 * **Nobody walks through a door in this scene, and that is the point.** §21.7.6
 * says a system enters in the hands of the person who solves it; the person who
 * solves *"there is work here I am not doing"* is the player, and the tree
 * §13.7.1 gives them for it is a **diluted copy of everybody else's** — which
 * is the joke the last line states and never explains.
 *
 * §21.7.3 rule 3 holds in **substance** rather than in count. The rule is that
 * James talks about the tool or the process and never about the person, and the
 * "exactly one line" clause of it is a shape rule for *arrival* scenes, where a
 * second James line would compete with the person walking in. Nobody walks in
 * here, so he keeps the exchange that carries the joke.
 */
export const SCENE_FOUNDER_BOARD: Scene = {
  id: 'scene.run2.founder-board',
  script: [
    { speaker: OS, text: 'HEADCOUNT REVIEW. YOUR SHARE OF THIS SPRINT’S OUTPUT: 2%.' },
    { speaker: PLAYER, text: 'Two per cent.', focus: AT_YOU },
    // The machine is not being cruel. It is recalculating, because the sprint
    // is still running and the number is still falling.
    { speaker: OS, text: 'CORRECTED: 1.8%. THE SPRINT IS STILL RUNNING.' },
    { speaker: PLAYER, text: 'I wrote this entire product.', focus: AT_YOU },
    // §21.7.0 — completely correct about a small thing while the large thing
    // goes wrong behind him. He is not consoling anybody; he is dating a build.
    { speaker: JAMES, text: 'You wrote the first version. This is the fourth.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'Then what am I for?', focus: AT_YOU },
    { speaker: JAMES, text: 'The parts nobody’s been hired for yet.', focus: AT_JAMES },
    // §13.7.1 — "a diluted copy of every other tree's spine, and nothing of its
    // own." Stated as a fact about a track, not as a warning about a purchase.
    { speaker: JAMES, text: 'There’s a track for that. It’s a bit of everyone’s job.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'Am I going to be good at any of it?', focus: AT_YOU },
    // The whole of §13.7.1 in one word, and he means it kindly.
    { speaker: JAMES, text: 'No.', focus: AT_JAMES },
  ],
}

/**
 * §21.7.7 — **the hero board arrives with the first point there is to spend.**
 *
 * §13.13 makes a level a point and a point a node, and until this scene the
 * board was open from the moment a hero existed — a screen full of purchases
 * with no currency, which is §26.1.6's wall in miniature and exactly the shape
 * §21.7.6 forbids.
 *
 * So the door is the first level-up. The card is *who somebody is* and it has
 * always been reachable; the board is an instrument and it arrives the frame
 * there is something to put on it.
 *
 * Written so it does not name who levelled, because the player chooses that by
 * choosing who to place — and §13.13's rule that a level-up is a moment rather
 * than a notification means the card flashing is the announcement. This scene
 * announces the *board*.
 */
export const SCENE_HERO_BOARD: Scene = {
  id: 'scene.run2.hero-board',
  script: [
    { speaker: OS, text: 'PERSONAL DEVELOPMENT MILESTONE REACHED. ONE (1) POINT AWARDED.' },
    { speaker: PLAYER, text: 'A point. Towards what?', focus: AT_YOU },
    { speaker: JAMES, text: 'There’s a board. Everyone’s on the same one.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'Everyone shares a skill tree?', focus: AT_YOU },
    // §13.9's centre-out board, and §13.9.1's pre-bought branch stated as a
    // fact about a person rather than as a starting bonus.
    { speaker: JAMES, text: 'Everyone starts somewhere different on it. That’s what makes them who they are.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'Where do you start?', focus: AT_YOU },
    // §13.9.1 — James is the trunk, half value everywhere, which is his class
    // as a number. He states it as a preference, because to him it is one.
    { speaker: JAMES, text: 'In the middle. Half as good at everything, everywhere.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'That sounds like a downside.', focus: AT_YOU },
    { speaker: JAMES, text: 'It means nobody has to ask me which team I’m on.', focus: AT_JAMES },
    { speaker: OS, text: 'OPEN ANY STAFF PASS. SPEND THE POINT.' },
  ],
}

/**
 * §21.7.4 — **Global Head of His Desk.** The title is real and renders; every
 * subsequent promotion extends it rather than replacing it. The corporate
 * ladder, rendered as a string that only gets longer.
 */
export const SCENE_JAMES_PROMOTED: Scene = {
  id: 'scene.run2.james-promoted',
  script: [
    { speaker: OS, text: 'ORG CHANGE COMMITTED. J. — GLOBAL HEAD OF HIS DESK' },
    { speaker: PLAYER, text: 'James. Congratulations. You’re Global Head now.', focus: AT_YOU },
    { speaker: JAMES, text: 'Of what?', focus: AT_JAMES },
    { speaker: PLAYER, text: 'Of your desk.', focus: AT_YOU },
    { speaker: JAMES, text: 'I was already doing that.', focus: AT_JAMES },
    { speaker: PLAYER, text: 'Now it’s global.', focus: AT_YOU },
    { speaker: JAMES, text: '…Is it a different desk?', focus: AT_JAMES },
    { speaker: PLAYER, text: 'It’s the same desk.', focus: AT_YOU },
    { speaker: JAMES, text: 'Good.', focus: AT_JAMES },
    { speaker: JAMES, text: 'Fewer surprises.', focus: AT_JAMES },
  ],
}

/** The promotion's title, verbatim — it renders on the card, the chart, the plate. */
export const JAMES_PROMOTION_TITLE = 'GLOBAL HEAD OF HIS DESK'

/** Every scene, by id. */
export const SCENES: Record<string, Scene> = {
  [SCENE_JAMES_ARRIVES.id]: SCENE_JAMES_ARRIVES,
  [SCENE_MASS_HIRE.id]: SCENE_MASS_HIRE,
  [SCENE_JAMES_INSTANT_MESSENGER.id]: SCENE_JAMES_INSTANT_MESSENGER,
  [SCENE_MO_ARRIVES.id]: SCENE_MO_ARRIVES,
  [SCENE_SERENA_ARRIVES.id]: SCENE_SERENA_ARRIVES,
  [SCENE_MATT_ARRIVES.id]: SCENE_MATT_ARRIVES,
  [SCENE_MELANY_ARRIVES.id]: SCENE_MELANY_ARRIVES,
  [SCENE_BILLY_ARRIVES.id]: SCENE_BILLY_ARRIVES,
  [SCENE_THE_THREAD.id]: SCENE_THE_THREAD,
  [SCENE_THREAD_CLEARED.id]: SCENE_THREAD_CLEARED,
  [SCENE_FOUNDER_BOARD.id]: SCENE_FOUNDER_BOARD,
  [SCENE_HERO_BOARD.id]: SCENE_HERO_BOARD,
  [SCENE_JAMES_PROMOTED.id]: SCENE_JAMES_PROMOTED,
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

/**
 * §21.7.1 — the line at which James should already have dropped in.
 *
 * The scene opens on `APPLICANT AT DOOR.` (line 0), then the founder reacts
 * with `What—` (line 1), and **then** James falls in with `Ouch.` (line 2) — the
 * reaction comes before the drop. A line index, not a page, for the same reason
 * as {@link HEY_AFTER_LINE}: it is a fact about the script and lives beside it.
 */
export const JAMES_DROPS_AT_LINE = 2

/**
 * §21 Act III — the line at which the treasury is gone.
 *
 * `MASS HIRING PACKAGE ACCEPTED. AUTHORISED BY: J.` is the fourteenth line, and
 * reaching it *is* the transaction: the player taps to turn the page and the
 * page they turn hires a thousand people. There is no button on this beat and
 * §10.7 rule 3 means there is no skip, so **the trap cannot be declined** —
 * which is §21.0d, and is the correction this constant exists to implement.
 *
 * A line index and not a page, for the same reason as {@link HEY_AFTER_LINE}:
 * §10.7a.2 paginates the `STUDIO_OS` announcement above into several boxes on
 * its own, so the two numbers are different for this script.
 */
export const MASS_HIRE_AT_LINE = 13
