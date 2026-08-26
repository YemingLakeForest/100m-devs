/**
 * What the finger does — GDD §7.7.6b.
 *
 * §7.7.6a built the poke / drag / grab distinction out of **time**: a quick
 * still tap poked, a still finger held past 380 ms picked somebody up or opened
 * their card, and motion beat both. It is a good model and it was reported, from
 * a phone, as unusable — *"hard to control how to poke or grab or look at
 * person"*. The reason is not the thresholds. It is that all three verbs came
 * off one finger with nothing on screen saying which one was armed, so the
 * player found out what mode they were in by watching the wrong thing happen.
 *
 * So the mode is now **said out loud, on the HUD, before the finger lands**.
 * Two latches, POKE and GRAB, and whichever is lit is what a tap does. Neither
 * lit is the third mode: you are checking people, and a tap opens §7.8.8's card.
 *
 * **Nothing here is a timer.** That is the whole point — inside a mode there is
 * no fast tap and no slow tap, only "the finger stayed put" and "the finger
 * travelled", and the second one is the camera. A player who has said GRAB
 * cannot accidentally poke, at any speed.
 */

/** The three things a tap can mean. `inspect` is the neutral mode (§7.7.6b). */
export type TouchMode = 'poke' | 'grab' | 'inspect'

/**
 * The two that are latches on the HUD.
 *
 * `inspect` is deliberately absent: it is not a third button, it is what you get
 * when neither of these is down. A three-way segmented control would make the
 * default a *choice*, and the default is supposed to be the resting state of a
 * control the player has not touched.
 */
export type TouchLatch = TouchMode

export const TOUCH_LATCHES: readonly TouchLatch[] = ['poke', 'grab', 'inspect']

/**
 * The mode the studio opens in.
 *
 * **POKE, not the neutral mode**, and this is the one place the two readings of
 * "default to checking people" come apart. §21 Act I's entire script is TAP TO
 * CODE — a fresh player whose first tap opened a personnel card would be looking
 * at a stat block with no way of knowing the game had not started. So the game
 * *boots* with the primary verb latched, and unlatching it drops to inspect,
 * which is what the neutral state of the control means everywhere else.
 */
export const INITIAL_TOUCH_MODE: TouchMode = 'poke'

/**
 * Press a latch.
 *
 * Pressing the lit one puts it out — that is what makes the neutral mode
 * reachable without a third button, and it is why these are latches rather than
 * segments of a picker. Pressing the other one just moves the light.
 */
export function toggleTouch(_current: TouchMode, latch: TouchLatch): TouchMode {
  return latch
}

/**
 * What a tap means right now.
 *
 * **The modes only exist where there are people.** Above the room a unit is a
 * floor, a building, a city — there is nobody to pick up and nobody whose card
 * to open — so §4.5b's "anything you can see, you can poke" takes the tap back
 * whatever the latch says. The alternative is a player at rung 4 in GRAB mode
 * discovering that the game's primary verb has silently switched itself off,
 * which is the exact failure §4.5b exists to have fixed.
 */
export function tapVerb(mode: TouchMode, inRoom: boolean): TouchMode {
  return inRoom ? mode : 'poke'
}

/**
 * The HUD face of a latch. Short, because the rail is 146 px wide.
 *
 * **DRAG, not MOVE [2026-08-26].** MOVE is what you do to a hero — §13.8's
 * placement banner says MOVE HERO, and `Roster.tsx` says PLACE, MOVE, OR
 * REVIEW — so the room's latch and the roster's verb were two different
 * gestures wearing one word. DRAG is also simply the more honest description of
 * what the finger does: §7.8.9's caption has said DRAG A DEVELOPER underneath
 * this latch since the day it shipped, and the button above it disagreed.
 */
export const TOUCH_LABEL: Record<TouchLatch, string> = {
  poke: 'CODE',
  grab: 'DRAG',
  inspect: 'INFO',
}

/**
 * Tiny marks that stay **in the pixel font** and never become platform emoji.
 *
 * `:::` was the drag handle and read fine; `←↕→` is better, because it is the
 * four-direction move cursor every desktop has used for thirty years, and the
 * player already knows what it means before they have read the label.
 *
 * **It is spelled out of three glyphs because the single one does not exist
 * here.** The obvious answer is the one-codepoint move arrow, and Departure Mono
 * does not contain it: U+2725, U+271C, U+2B0C and U+2B0D are all absent from
 * this font's `cmap` (checked against `DepartureMono-Regular.woff2` itself, not
 * assumed). A glyph the font lacks does not fail loudly — the browser quietly
 * substitutes a system face, so one icon in the rail would be drawn in a
 * different typeface at a different weight, and on Capacitor-Android with no
 * fallback installed it would be a tofu box. ART_DIRECTION §3's "one face" is
 * exactly this rule.
 *
 * What the font *does* have is the four arrows individually — U+2190 through
 * U+2193, plus U+2195 for the vertical pair. Left, up-down, right in three
 * monospace cells is the same picture, drawn with glyphs that are certainly
 * there.
 *
 * Three cells wide, like `</>`, so the rail's latches stay the same size.
 *
 * The two rejected answers are worth keeping: `+` said "add", said "medical",
 * and mostly said nothing; `\o/` was a *cheering man*, an internet in-joke
 * rather than a symbol, which reads as celebration to those who know it and as
 * nothing at all to those who do not. An icon rail is not the place to be funny
 * at the cost of being understood — the comedy in this feature is in what people
 * say while you drag them.
 */
export const TOUCH_ICON: Record<TouchLatch, string> = {
  poke: '</>',
  grab: '←↕→',
  inspect: 'i',
}

/**
 * The one line under the switch saying what the finger will do.
 *
 * Present for the neutral mode too, and that matters most there: an unlit pair
 * of latches with no caption is a control that looks switched off rather than
 * one that is in its third state.
 */
export const TOUCH_HINT: Record<TouchMode, string> = {
  poke: 'TAP ANY PERSON TO CODE',
  grab: 'DRAG A DEVELOPER',
  inspect: 'TAP ANY PERSON FOR INFO',
}

/**
 * §7.7.1 — the rung above which the caption stops being about people.
 *
 * Rungs 0–2 are the room. From 3 up there is nobody on screen to tap, so all
 * three captions above are false there — and worse, none of them mentions the
 * one gesture the player actually needs, which is how to get *back down*.
 */
export const ROOM_TOP_RUNG = 2

/**
 * The caption under the switch — GDD §7.7.6, §4.5b.
 *
 * Above the room the switch itself is inert ({@link tapVerb} forces `poke`
 * because there is nobody to grab or inspect), so the line stops describing the
 * latch and describes the *world* instead. Both verbs, because both exist and
 * neither was written down anywhere a player could find it: a single tap buffs
 * the whole unit, and two opens it.
 *
 * That second half is the answer to a question this build could not answer —
 * *"at the 10k view, how do I select which floor to go?"* The gesture was there
 * and worked; nothing on screen had ever said so, which makes it not a feature.
 */
export function touchHint(mode: TouchMode, cameraRung: number): string {
  const rung = Number.isFinite(cameraRung) ? cameraRung : 0
  if (rung <= ROOM_TOP_RUNG) return TOUCH_HINT[mode]
  return 'TAP TO BOOST · 2 TO OPEN'
}
