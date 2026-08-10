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
export type TouchLatch = 'poke' | 'grab'

export const TOUCH_LATCHES: readonly TouchLatch[] = ['poke', 'grab']

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
export function toggleTouch(current: TouchMode, latch: TouchLatch): TouchMode {
  return current === latch ? 'inspect' : latch
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

/** The HUD face of a latch. Short, because the rail is 146 px wide. */
export const TOUCH_LABEL: Record<TouchLatch, string> = {
  poke: 'POKE',
  grab: 'GRAB',
}

/**
 * The one line under the switch saying what the finger will do.
 *
 * Present for the neutral mode too, and that matters most there: an unlit pair
 * of latches with no caption is a control that looks switched off rather than
 * one that is in its third state.
 */
export const TOUCH_HINT: Record<TouchMode, string> = {
  poke: 'TAP TO CODE',
  grab: 'DRAG PEOPLE',
  inspect: 'TAP TO CHECK',
}
