/**
 * A keyword — GDD §10.2a, R12 and R13.
 *
 * Two requirements arrived together and they are really one:
 *
 * 1. **Never write "SP".** It is an abbreviation that means something to the
 *    people who wrote it and nothing to anybody else, and it was sitting in the
 *    largest readouts on the screen.
 * 2. **Colour the nouns the player is meant to track**, so a value jumps out of
 *    a sentence without having to be formatted into a box of its own.
 *
 * They are one requirement because the fix for both is *having a component for
 * the concept* rather than a string. Once "story points" is a thing rather than
 * two characters, it can only be spelled one way and it can only be one colour.
 *
 * **One noun, one colour, everywhere it appears.** A story point tinted one way
 * in the HUD and another in a speech bubble teaches the player that the colour
 * means nothing, so the mapping lives here and nowhere else.
 *
 * No colours are added to the system. §2.2's ramps already carry these; this
 * only decides which ramp belongs to which idea, which is what a semantic
 * palette is for.
 */

export type Keyword = 'story' | 'cash' | 'devs' | 'entropy'

/**
 * The default is `story` because it is the overwhelming majority of uses and
 * because §10.4's burn-down is the thing the whole game is about.
 */
export function Kw({
  kind = 'story',
  children,
}: {
  kind?: Keyword
  children?: React.ReactNode
}) {
  return <span className={`kw kw--${kind}`}>{children}</span>
}

/**
 * The phrase itself, so it is spelled in exactly one place.
 *
 * Singular and plural both, because "1 story points" is the other way this goes
 * wrong and it is the kind of thing that survives review for months.
 */
export function StoryPoints({ n }: { n?: number }) {
  return <Kw>{n === 1 ? 'story point' : 'story points'}</Kw>
}
