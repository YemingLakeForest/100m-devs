/**
 * Player-facing words for internal concepts — GDD §4.3a.
 *
 * `entropy()` is the model and keeps its name everywhere an engineer reads it.
 * **The player never sees the word "entropy".** It is jargon that costs a
 * non-technical player a beat of translation on a readout they glance at four
 * times a second — and, more importantly, one fixed label cannot carry a
 * five-act arc. The same number means "fine", "this is getting silly" and "the
 * company is on fire".
 *
 * So the readout escalates its own *name* as E climbs. That is free drama: the
 * player learns the situation changed before they have parsed the number.
 *
 * This module is the only place the translation happens. If a player-facing
 * string anywhere else says "entropy", that is a bug.
 */

export interface EntropyLabel {
  /** Upper bound of the band, exclusive. */
  upTo: number
  /** What the readout calls itself at this level. */
  label: string
}

/** GDD §4.3a — the escalation ladder, in order. */
export const ENTROPY_LABELS: readonly EntropyLabel[] = [
  { upTo: 0.2, label: 'IN SYNC' },
  { upTo: 0.45, label: 'CHATTY' },
  { upTo: 0.65, label: 'BOGGED DOWN' },
  { upTo: 0.8, label: 'PRODUCTIVITY BREAKDOWN' },
  { upTo: 0.95, label: 'TOTAL GRIDLOCK' },
  { upTo: 0.99, label: 'MELTDOWN' },
  { upTo: Number.POSITIVE_INFINITY, label: 'STUDIO SEIZED' },
]

/**
 * The word for this level of E.
 *
 * Note there is no "unknown" or empty case: every readout has a name at every
 * value, because a HUD element that sometimes has no label is a HUD element
 * that jitters in width, which ART_DIRECTION §3 rule 3 forbids.
 */
export function entropyLabel(e: number): string {
  const clamped = Number.isFinite(e) ? Math.max(0, e) : 0
  return (ENTROPY_LABELS.find((band) => clamped < band.upTo) ?? ENTROPY_LABELS.at(-1)!).label
}

/**
 * The full readout — `MELTDOWN 97%`.
 *
 * §4.3a: the number is always shown beside the label. The escalating word is
 * drama; the percentage is the honest reading, and hiding it would turn the HUD
 * into a mood ring.
 */
export function entropyReadout(e: number): string {
  const pct = Math.min(99.9, Math.max(0, e * 100))
  // One decimal only in the last stretch, where 99.0 and 99.9 are different
  // situations and a whole number would show both as "99%".
  return `${entropyLabel(e)} ${e >= 0.95 ? pct.toFixed(1) : Math.round(pct)}%`
}

/**
 * Whether the studio has seized — GDD §4.3, and the §6.3 rebuke's trigger.
 *
 * Named for what the player sees rather than for the model, so that call sites
 * building UI do not have to reach for `ENTROPY_LOCK` and then remember not to
 * print it.
 */
export const SEIZED_AT = 0.99

export function isSeized(e: number): boolean {
  return e >= SEIZED_AT
}
