/**
 * Per-character reveal timing — GDD §10.7's table, and nothing else.
 *
 * The reveal is a *timeline*, not a repeating timer. A `setInterval` at 36 ms
 * drifts, cannot express a pause without restarting itself, and loses its place
 * whenever the tab is backgrounded. Precomputing "character i is visible at
 * t ms" makes the reveal a pure function of elapsed time, which means rule 1
 * (tap completes the page) is a single assignment rather than a race with a
 * pending timer, and a dropped frame catches up instead of falling behind.
 */

/** §10.7, base rate. */
export const CHARS_PER_SECOND = 28
const STEP_MS = 1000 / CHARS_PER_SECOND

/**
 * §10.7's pause column. These are the whole table — there is no entry for `…`
 * or `:` and they deliberately do not get one, because inventing rows is how a
 * stated timing spec quietly becomes a different one.
 */
export const PAUSE_MS = {
  comma: 120,
  sentence: 260,
  dash: 200,
} as const

/** Extra delay owed *after* this character has landed. */
export function pauseAfter(ch: string): number {
  if (ch === ',') return PAUSE_MS.comma
  if (ch === '.' || ch === '?' || ch === '!') return PAUSE_MS.sentence
  // U+2014 EM DASH. The typographic dash the script uses; a hyphen is not it.
  if (ch === '—') return PAUSE_MS.dash
  return 0
}

/**
 * Milliseconds at which each character of `text` has been revealed.
 *
 * `timeline[i]` is inclusive: at exactly that millisecond, `i + 1` characters
 * are showing. A trailing pause on the final character is not added — the page
 * is complete when its last letter lands, and charging the player 260 ms of
 * dead box for the full stop is F6.
 */
export function revealTimeline(text: string): number[] {
  const out: number[] = new Array(text.length)
  let t = 0

  for (let i = 0; i < text.length; i++) {
    t += STEP_MS
    out[i] = t
    if (i < text.length - 1) t += pauseAfter(text[i])
  }

  return out
}

/** How long the page takes to type itself out, unassisted. */
export function typingDuration(timeline: readonly number[]): number {
  return timeline.length === 0 ? 0 : timeline[timeline.length - 1]
}

/**
 * Characters visible at `ms`. Binary search rather than a scan: this runs once
 * a frame against a page that can be 120 characters, and the §23.3 frame budget
 * has no room for anything that grows with page length.
 */
export function charsRevealedAt(timeline: readonly number[], ms: number): number {
  let lo = 0
  let hi = timeline.length

  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (timeline[mid] <= ms) lo = mid + 1
    else hi = mid
  }

  return lo
}

/**
 * Break text into pages of at most `maxLines` wrapped lines — §10.7, "3 lines
 * max, then wait for advance".
 *
 * Wrapping happens here, ahead of the reveal, rather than being left to the
 * browser. §10.7 is explicit that proportional type "reflows as it types, which
 * reads as a rendering fault"; a monospace face removes the width jitter but
 * not the reflow, because the last word of a line still jumps down as its final
 * character arrives. Pre-wrapping and rendering the result with `white-space:
 * pre` means no glyph ever moves once it has been drawn.
 */
export function paginate(text: string, columns: number, maxLines = 3): string[][] {
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }

    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      // A word wider than the box (a URL, a long identifier) is hard-split
      // rather than allowed to overflow the frame.
      let rest = word
      while (rest.length > columns) {
        if (line !== '') {
          lines.push(line)
          line = ''
        }
        lines.push(rest.slice(0, columns))
        rest = rest.slice(columns)
      }

      const candidate = line === '' ? rest : `${line} ${rest}`
      if (candidate.length > columns) {
        lines.push(line)
        line = rest
      } else {
        line = candidate
      }
    }

    lines.push(line)
  }

  const pages: string[][] = []
  for (let i = 0; i < lines.length; i += maxLines) {
    pages.push(lines.slice(i, i + maxLines))
  }

  return pages.length > 0 ? pages : [['']]
}
