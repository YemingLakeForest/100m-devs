import type { SfxId } from './sfx.ts'

/**
 * The clips whose pitch moves while they sound — measured on the files (spectrogram, 2026-10-15), not judged by name.
 *
 * The user hears any of them under a release as *"the siuuuu"*, and said so three times (2026-10-12, then twice on
 * 2026-10-15) before it was found: the release was swapped from `ui-whoosh` to a climbing bell arpeggio, and the sound
 * they were still hearing was `entropy-lock`, a descending power-down whine (about 700 Hz down to 100 over a second)
 * that the ring and the review each played at their verdict, with `poke-crit`, a chirp rising 400 to 800 Hz, stacked on
 * a perfect date. The release path plays none of these; `ReleaseRing.test.tsx` and `ReleaseReview.test.tsx` pin it.
 *
 * A clip that is added to the bank and glides belongs here, so the next one cannot reach a release by being borrowed.
 */
export const GLIDING_SFX = ['entropy-lock', 'poke-crit', 'ui-whoosh', 'zoom-in', 'zoom-out'] as const satisfies readonly SfxId[]
