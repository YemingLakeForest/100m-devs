import type { ReactNode } from 'react'
import { conceptMatches, type Concept } from './concepts.ts'

export type { Concept } from './concepts.ts'

/**
 * Player-facing concepts with a stable semantic colour.
 *
 * The interface phosphor changes with the state of the studio. These words do
 * not: once a noun has taught the player a colour, that colour is part of the
 * noun wherever it appears, including inside typed copy.
 */
export function Kw({ concept = 'story', children }: { concept?: Concept; children: ReactNode }) {
  return <span className={`kw kw--${concept}`}>{children}</span>
}

export interface ConceptTextProps {
  text: string
  /** Render only this slice while retaining classifications from the full text. */
  from?: number
  to?: number
}

/** Colour every tracked noun in a string without changing its spelling or spacing. */
export function ConceptText({ text, from = 0, to = text.length }: ConceptTextProps) {
  const start = Math.max(0, Math.min(text.length, from))
  const end = Math.max(start, Math.min(text.length, to))
  const parts: ReactNode[] = []
  let cursor = start

  for (const match of conceptMatches(text)) {
    if (match.to <= start || match.from >= end) continue
    const matchStart = Math.max(start, match.from)
    const matchEnd = Math.min(end, match.to)
    if (cursor < matchStart) parts.push(text.slice(cursor, matchStart))
    parts.push(
      <Kw key={`${match.from}:${matchStart}:${matchEnd}`} concept={match.concept}>
        {text.slice(matchStart, matchEnd)}
      </Kw>,
    )
    cursor = matchEnd
  }

  if (cursor < end) parts.push(text.slice(cursor, end))
  return <>{parts}</>
}
