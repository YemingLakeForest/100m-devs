/**
 * What a run has, and when it got it — GDD §21.0c, R43.
 *
 * **Run 1 is the trap and nothing else.** That is the whole content of this
 * file, and it is a correction rather than a new idea: §21.0's thesis is that
 * the player builds one mental model — *more developers, more speed* — out of
 * nothing but evidence, and then watches it kill the company. Everything the
 * batch of 2026-08-11 added is a second thing to think about while that is
 * happening.
 *
 * Count what Act I was carrying by the end of it. A defect counter that appears
 * at the fourth poke and names a job the player cannot hire for. A tickets bar
 * with nothing in it. A hire dial offering two professions before the player has
 * hired one person. An UPGRADES button onto a tree whose root node had already
 * been given away in a cutscene. None of those is *wrong* — every one of them is
 * a mechanic the game needs — and all of them are wrong **there**, because each
 * one is the game saying "there is a system here" during the four minutes it has
 * to spend saying "there is only one lever and it is hiring".
 *
 * So the first Paradigm Shift is the door, and it is the right door for a reason
 * that is not merely tidiness: §13.1's shift is *already* the moment the game
 * stops being a straight line and becomes a set of systems, §24.5 already gates
 * offline accrual on it, and §13.2 already gates the Paradigm Tree on it. The
 * three below join a list rather than starting one.
 *
 * ## What is deliberately not gated
 *
 * **James.** §21.0b gives him away free, mid-Act-I, and he is the one thing here
 * that is *not* a system — he is a person who sits down at the second desk. The
 * distinction this file is drawing is between mechanics and story, and he is the
 * story.
 *
 * **The seed round, the mass hire, bankruptcy.** They are Run 1. Gating the trap
 * behind the escape from the trap would be a circle.
 *
 * Pure, and keyed off one number so a save file cannot disagree with itself.
 */

/**
 * The three systems Run 1 does not have.
 *
 * A record rather than three booleans off one predicate, because the call sites
 * read better for it and because the shape is where a fourth one will go. Every
 * field is `false` exactly when {@link unlocksFor} is asked about a first run.
 */
export interface Unlocks {
  /**
   * §4.11 — QA, Support and SRE on the hire dial.
   *
   * The joke §4.11 is making is that a studio stops being one kind of person,
   * and it only lands once the player has been one kind of person for a while.
   */
  roles: boolean
  /**
   * §4.12–§4.13 — defects, incidents and tickets, in the simulation and in the
   * HUD.
   *
   * Gated together and not separately: §4.15's whole argument is that the three
   * are one system told in three colours, and a run that had defects but not
   * incidents would be teaching two thirds of a distinction.
   */
  backlogs: boolean
  /**
   * §11 — the studio tech tree, and §11.5's Instant Messenger with it.
   *
   * §15's ladder is a *prestige* ladder. An upgrade screen during Run 1 offers
   * the player a way to make the trap survivable, which is the one thing Run 1
   * must not sell them.
   */
  upgrades: boolean
}

/** Everything, for the runs that have earned it. */
const OPEN: Unlocks = { roles: true, backlogs: true, upgrades: true }

/** Run 1. One lever, and it is hiring. */
const SHUT: Unlocks = { roles: false, backlogs: false, upgrades: false }

/**
 * What this player has, given how many times they have prestiged.
 *
 * Keyed off `PermanentSave.meta.paradigmShifts` — the same counter §24.5 reads
 * for offline accrual and §13.2 reads for the Paradigm Tree — rather than off a
 * flag of its own. A second flag would be a second thing that can be wrong after
 * a save migration, and the answer to "has this player finished Run 1" is
 * already written down.
 *
 * Returns one of two frozen constants rather than a fresh object, so a caller
 * may compare identities and a render may depend on it without churning.
 */
export function unlocksFor(paradigmShifts: number): Unlocks {
  return Number.isFinite(paradigmShifts) && paradigmShifts > 0 ? OPEN : SHUT
}
