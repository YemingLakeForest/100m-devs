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
 * Where one sentence ends and the next begins.
 *
 * A terminator (or a run of them — `...` is one beat, not three), any closing
 * quote or bracket that belongs to it, and then whitespace. **The whitespace is
 * required**, which is what keeps `...Fewer?` one sentence, `$1.5M` one number
 * and `J.` at the end of `ONBOARDED: J.` from splitting the line it ends.
 *
 * Deliberately not a general sentence tokeniser. The corpus is `scenes.ts` and
 * it is authored — an abbreviation mid-line would be a script problem, and a
 * cleverer regex here would be a second place the script's rhythm is decided.
 */
const SENTENCE_END = /([.!?…]+["'’”)\]]*)(\s+)/

/** A paragraph, cut into sentences with their punctuation kept. */
function sentences(paragraph: string): string[] {
  const out: string[] = []
  let rest = paragraph

  for (;;) {
    const m = SENTENCE_END.exec(rest)
    if (!m || m.index + m[0].length >= rest.length) break
    out.push(rest.slice(0, m.index + m[1].length))
    rest = rest.slice(m.index + m[0].length)
  }

  if (rest.trim() !== '') out.push(rest)
  return out
}

/** A sentence's extent in the wrapped line list, both ends inclusive. */
interface Span {
  start: number
  end: number
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
 *
 * ## §10.7a.4 — the unit of the box is the **sentence** [added 2026-08-30]
 *
 * Greedy word-wrap packed each line to the column and let a sentence begin
 * wherever the previous one happened to stop. That is correct for a paragraph
 * of prose being *read*, and wrong for two lines of dialogue being *revealed*,
 * because the box turns a page mid-clause and the player reads the two halves
 * of one line as two lines. The scene that made it undeniable is §21.7.1's
 * closing announcement at twenty-eight columns:
 *
 * ```
 *   STORY POINTS NOW BURN DOWN     STORY POINTS NOW BURN DOWN
 *   AUTOMATICALLY. NO TAPPING      AUTOMATICALLY.
 *   ---- tap ----                  ---- tap ----
 *   REQUIRED.                      NO TAPPING REQUIRED.
 * ```
 *
 * The machine states two facts and the box cut the second one in half. So two
 * rules, in this order:
 *
 * 1. **A sentence starts on a fresh line unless the whole of it fits on the
 *    one already open.** Sharing a line is allowed — `Fewer. It’s countable.`
 *    is one line and should be — but only when nothing has to be carried over.
 * 2. **A sentence that fits inside a page does not straddle one.** A sentence
 *    wrapping to two lines with one line left on the page starts the next page
 *    instead. A sentence too long for a page at all is exempt: there is no
 *    break that would keep it whole, so it packs as before.
 *
 * The cost is paid in slack at the bottom of a page, which is the right
 * currency: §10.7a.2 already spends page turns deliberately, and a half-empty
 * box that says one whole thing beats a full one that says one and a half.
 */
export function paginate(text: string, columns: number, maxLines = 3): string[][] {
  const lines: string[] = []
  // Multi-line sentences only. A sentence that fits on one line cannot straddle
  // a page, so recording it would be recording a constraint that never binds.
  const spans: Span[] = []

  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }

    let line = ''
    for (const sentence of sentences(paragraph)) {
      // Rule 1. An open line keeps the sentence only if it takes all of it.
      if (line !== '' && line.length + 1 + sentence.length > columns) {
        lines.push(line)
        line = ''
      }

      const startedAt = lines.length
      for (const word of sentence.split(/\s+/).filter(Boolean)) {
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

      // The sentence ends on the line still open — index `lines.length`, which
      // is where `line` will land when it is pushed. An empty `line` means the
      // last word landed exactly on a boundary and the sentence ended on the
      // line before it; claiming the open one would hand the next sentence's
      // first line to this span.
      const end = line === '' ? lines.length - 1 : lines.length
      if (end > startedAt) spans.push({ start: startedAt, end })
    }

    lines.push(line)
  }

  // Rule 2. A span that would be cut by the end of this page opens the next one
  // — unless it is longer than a page, in which case no break can save it.
  const startsAtomically = new Map<number, number>()
  for (const span of spans) {
    const height = span.end - span.start + 1
    if (height <= maxLines) startsAtomically.set(span.start, height)
  }

  const pages: string[][] = []
  let i = 0
  while (i < lines.length) {
    const page: string[] = []
    while (i < lines.length && page.length < maxLines) {
      const height = startsAtomically.get(i)
      if (height !== undefined && page.length > 0 && page.length + height > maxLines) break
      page.push(lines[i])
      i++
    }
    pages.push(page)
  }

  return pages.length > 0 ? pages : [['']]
}
