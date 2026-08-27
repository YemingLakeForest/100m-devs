/**
 * The STUDIO_OS boot — the black cut scene between the founder creator and the
 * first frame of the game.
 *
 * §21 opens in a garage with two founders, no money and no game yet. The boot
 * is the one beat that separates "I made a character" from "I run a studio":
 * the OS initialises itself over a black screen, names the project it is
 * booting into, and only then hands the desk to the player. It borrows the
 * §10.9.3 boot block's terminal voice and the §10.7 typewriter reveal, so the
 * title, the creator and the game are one continuous fiction rather than a
 * cut with a loading flash in it.
 *
 * Pages type themselves out one at a time, and each one waits for a tap: a
 * click while a page is still typing completes that page (§10.7 rule 1, the
 * same impatience gesture the dialogue box already owns), and a click on a
 * finished page moves to the next. The last page lifts the screen into the
 * game. Nothing here runs on a clock, so the player reads the boot at their
 * own speed — it is a scene, not a wait.
 */

/**
 * The one line every boot opens with — the same string as the §10.9.2 OS
 * banner, because the boot *is* the banner finishing its sentence.
 */
export const BOOT_OS_LINE = 'STUDIO_OS v0.0.1 initialized'

/**
 * The boot's four lines. Personal: the project is the run's first game and the
 * founder is the person the player just built, so the terminal block reads as
 * *their* studio coming up rather than as a stock splash.
 *
 * Split from {@link bootPages} because §15.1a shows the same four lines at a
 * different pace — one page each on the first launch, all four at once on every
 * Paradigm Shift after it — and the words have to be the same words. Two copies
 * of a boot sequence is two boot sequences.
 */
export function bootLines(founderName: string, projectName: string): string[] {
  return [BOOT_OS_LINE, `project: ${projectName}`, `founder: ${founderName}`, 'ready.']
}

/** The boot, one line to a page. §10.9.3's pace, for the install's first launch. */
export function bootPages(founderName: string, projectName: string): string[] {
  return bootLines(founderName, projectName)
}

/**
 * How long the fade into the game takes once the last page has landed.
 *
 * Under F6's 400 ms ceiling deliberately — the beat being scored is the page
 * reveals, not the hand-over; the lift itself should feel like a light
 * switching on rather than a second event to watch.
 */
export const BOOT_EXIT_MS = 340
