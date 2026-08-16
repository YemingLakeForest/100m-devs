/**
 * Events — GDD §18, §18.0, and the shape §3.1.6 item 3 has been waiting for.
 *
 * **§18 has been a library of jokes and not a system.** Until this file the only
 * thing in the build that mentioned the section was a Paradigm node that
 * switches one of its events *off*, which is a node that cancels nothing. That
 * blocked §3.1.6 item 3 — *"§18's entropy events are clearable, and know it"* —
 * and with it §26.1.8's last gate line.
 *
 * ## What an event is, and what it deliberately is not
 *
 * > **An event is a state of the world with a face, a cost, and at least two
 * > exits.** One exit is always the player's own hands.
 *
 * It is *not* a minigame. §26.3.3 owns minigames and puts them in Phase 3, under
 * §26.3.4's standing constraint — *never mandatory, never punishing to skip*.
 * That constraint is about **minigames**, and §18.0a is the reason it has to be
 * said out loud here: the first event in the game is mandatory on purpose. A
 * minigame is amplitude on a loop that already works; an event is the loop
 * pushing back. They are not the same object and the rule for one is not the
 * rule for the other.
 *
 * ## Two exits, always, and why the second one exists
 *
 * Every event carries a **hand-clear**: a number of taps that ends it, available
 * always, priced in attention and never in money. It is there for three reasons
 * and only one of them is design:
 *
 * 1. **Nothing in this game may become a wall.** §25.3.2. An event whose only
 *    exit is a purchase is a paywall wearing a joke.
 * 2. **It is what makes the intended exit legible as a choice.** Twenty taps
 *    against one purchase is the player learning what the board is *for*,
 *    by comparing, which is the only way §21.7.6's rule can teach anything.
 * 3. §3.1.1's PAGERDUTY ESCALATION attaches to exactly this: an offer that
 *    "sells convenience the player could have tapped out". The offer needs the
 *    thing it is more convenient *than* to exist first, and now it does.
 *
 * Everything here is pure. The store owns when an event fires and what state it
 * writes; this owns what an event is, what it does while it is live, and what
 * ends it.
 */

/** §18's three scale bands. Only `early` has an event in Phase 1. */
export type EventTier = 'early' | 'mid' | 'late'

/**
 * How an event stops being live for good, as opposed to being cleared by hand.
 *
 * A resolution is *permanent for the career* — the event is retired and never
 * fires again. A hand-clear ends the current instance and leaves the cause in
 * place, which is what makes the two exits genuinely different and what stops
 * the tap exit from being the strictly better one.
 */
export type EventResolution =
  /** Any purchase on §11's board. The event is a tutorial for the board. */
  | 'tech-purchase'

export interface StudioEvent {
  /** Stable id. It goes into the run save and into `milestones`; never renumber. */
  id: string
  tier: EventTier
  /** The name on the card. Short enough to be a banner. */
  name: string
  /** §10.7's machine register — what `STUDIO_OS` says when it fires. */
  headline: string
  /** What is happening, in the player's language. Two sentences at most. */
  body: string
  /** The scene that introduces it, played once ever. Absent means no scene. */
  scene?: string
  /** The scene played when it is {@link resolvedBy} rather than tapped out. */
  resolvedScene?: string
  /**
   * The efficiency ceiling while it is live — §4.1's η, capped from above.
   *
   * A ceiling rather than a cap divisor, and the difference is not cosmetic: a
   * divisor on §4.2's capacity would move the number §21.7.3 gates Melany's
   * arrival on, so an event would summon a hero. A ceiling touches the readout
   * and the output and nothing else.
   *
   * 1 means the event does not slow the studio down.
   */
  ceiling: number
  /** §18.0 — taps to clear it by hand. Always at least one. */
  clearTaps: number
  /** What retires it permanently. */
  resolvedBy: EventResolution
  /** The label on the button that routes the player at the intended exit. */
  routeLabel: string
}

/**
 * §18.0a — **THE THREAD**, and it is the first event in the game.
 *
 * The studio has stopped, one question is being answered by everybody at once,
 * and the speedometer says so. It is §6's trap restated as a thing that happens
 * *to* the player rather than a thing they did — with the difference that this
 * time there is an answer, and the answer is on a board they have never opened.
 *
 * **It is mandatory.** It fires unconditionally in Run 2 at the first headcount
 * where a thread is funny, it holds the studio at a quarter of its output, and
 * it does not go away on its own. That is the whole reason it exists: §11's
 * board is the most consequential screen in the game and nothing in the build
 * had ever asked a player to open it.
 *
 * **Its trigger is an empty board, not a headcount.** A player who has already
 * been buying protocol nodes has learned the lesson this event teaches and will
 * never see it, which is the correct behaviour for a tutorial and the reason
 * this is not simply a timer.
 *
 * The numbers:
 *
 * | | | Why |
 * |---|---|---|
 * | **Ceiling** | 0.25 | Deep in §4.3's red, and emphatically **not** zero. Income has to keep arriving or the intended exit is unaffordable and the event is the wall §25.3.2 forbids |
 * | **Taps** | 20 | §18.2's own figure for a notification storm. Long enough to be a decision and short enough that a player who takes it does not feel punished |
 * | **Headcount** | 12 | The first studio at which "everybody replied" is a number rather than a turn of phrase |
 */
export const THREAD: StudioEvent = {
  id: 'event.thread',
  tier: 'early',
  name: 'THE THREAD',
  headline: 'UNSTRUCTURED COMMUNICATION EVENT — PARTICIPANTS: ALL. DECISIONS: 0.',
  body:
    'Somebody asked a question in the main channel and everybody answered it. Nobody is writing code. ' +
    'The studio will stay like this until it has a protocol — or until you reply to every single one of them yourself.',
  scene: 'scene.run2.the-thread',
  resolvedScene: 'scene.run2.thread-cleared',
  ceiling: 0.25,
  clearTaps: 20,
  resolvedBy: 'tech-purchase',
  routeLabel: 'OPEN UPGRADES',
}

/** The headcount THE THREAD needs before "everybody replied" is a number. */
export const THREAD_MIN_DEVS = 12

/**
 * Every event, in the order they are considered.
 *
 * One entry, and that is the honest state of §18 rather than an oversight.
 * §26.3.3 puts the rest of the library in Phase 3, where the interesting ones
 * become minigames; what Phase 1 owes §18 is that the *system* exists and that
 * the shape §3.1.6 item 3 attaches to is real. A registry with one true event in
 * it is that. A registry with nine stubbed ones would be the failure §26.0 was
 * written to prevent.
 */
export const EVENTS: readonly StudioEvent[] = [THREAD]

export const EVENT_BY_ID = new Map(EVENTS.map((e) => [e.id, e]))

/** An event that is happening. Run state — it is a state of the world. */
export interface LiveEvent {
  id: string
  /** Taps still owed before the hand-clear exit completes. */
  remaining: number
  /** Simulated seconds it has been live, for the card and for §18.5's ticker. */
  age: number
  /**
   * Has the player chosen the hand-clear?
   *
   * The card is modal until they choose an exit; after that the event lives as
   * a banner so the board is reachable. Held on the *event* rather than in the
   * HUD because a reload must not put the modal back over a player who had
   * already decided what to do about it.
   */
  routed: boolean
}

/** Open an event. Pure — the store decides when. */
export function beginEvent(event: StudioEvent): LiveEvent {
  return { id: event.id, remaining: Math.max(1, Math.floor(event.clearTaps)), age: 0, routed: false }
}

/** The definition behind a live event, or null if the save names one we retired. */
export function definitionOf(live: LiveEvent | null): StudioEvent | null {
  if (!live) return null
  return EVENT_BY_ID.get(live.id) ?? null
}

/**
 * The efficiency ceiling the live event imposes — 1 when nothing is happening.
 *
 * **A ceiling never beats a purchase.** §11.2's B2 and B4 buy an entropy cap,
 * which `currentEfficiency` applies as a floor, and the floor is applied
 * afterwards on purpose: a player who paid for a company that cannot seize does
 * not get seized by an event. That is a standing rule about this whole system
 * and not a special case — **an event may never undo something the player
 * bought.**
 */
export function eventCeiling(live: LiveEvent | null): number {
  const def = definitionOf(live)
  if (!def) return 1
  return Math.max(0, Math.min(1, def.ceiling))
}

/**
 * One tap against the hand-clear.
 *
 * Returns the event with one fewer reply owed, or **null when it is done** —
 * which is the store's signal to clear it. `null` rather than a zeroed event so
 * a caller cannot forget to check and leave a live event at zero replies
 * holding the studio down for ever.
 */
export function clearOne(live: LiveEvent): LiveEvent | null {
  const remaining = live.remaining - 1
  if (remaining <= 0) return null
  return { ...live, remaining }
}

/** The player chose an exit; the card gives way to a banner. */
export function routeEvent(live: LiveEvent): LiveEvent {
  return live.routed ? live : { ...live, routed: true }
}

/** Advance the clock. */
export function ageEvent(live: LiveEvent, dtSeconds: number): LiveEvent {
  if (!(dtSeconds > 0)) return live
  return { ...live, age: live.age + dtSeconds }
}

/**
 * What a trigger reads. A snapshot, not `GameState`, on the same argument
 * `storyTriggers.ts` makes: the predicate stays pure and stays testable.
 */
export interface EventSnapshot {
  paradigmShifts: number
  devs: number
  /** §11 — how many nodes the player has *bought*. The granted centre is not one. */
  techNodesBought: number
  /** Is an event already on the floor? Two at once is a pile, never a system. */
  live: boolean
  /** Has this event already been resolved for good, this career? */
  retired: (id: string) => boolean
}

/**
 * Which event should fire right now, or null.
 *
 * **Run 2 and later, always.** §3.1.1 and §21.0c reach the same gate from two
 * directions — no offer and no system before the first Paradigm Shift — and an
 * event is both. Run 1 carries one idea and an event is a second one.
 */
export function eventDue(s: EventSnapshot): StudioEvent | null {
  if (s.paradigmShifts <= 0) return null
  if (s.live) return null

  for (const event of EVENTS) {
    if (s.retired(event.id)) continue
    if (event.id === THREAD.id) {
      // The board is the subject. A player who has bought anything at all has
      // already learned what this event teaches.
      if (s.techNodesBought > 0) continue
      if (s.devs < THREAD_MIN_DEVS) continue
      return event
    }
  }
  return null
}

/**
 * The milestone id that retires an event for good.
 *
 * `milestones` rather than a new flag, for the reason §21.7.6c gives about the
 * hero roster: §24.3 already unions it across saves and it is already the place
 * "this has happened to this player, once, for ever" is recorded. A second flag
 * is a second thing that can be wrong after a migration.
 */
export function retiredMilestone(id: string): string {
  return `${id}.resolved`
}
