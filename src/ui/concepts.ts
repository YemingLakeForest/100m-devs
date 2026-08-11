export type Concept =
  | 'story'
  | 'cash'
  | 'devs'
  | 'entropy'
  | 'velocity'
  | 'upgrades'
  | 'heroes'
  /** §4.12 — on the bench, still fixable. */
  | 'defects'
  /** §4.12a — shipped, live, and costing money right now. */
  | 'incidents'
  /** §4.13 — the ambient noise of a back catalogue. */
  | 'tickets'

export interface ConceptMatch {
  from: number
  to: number
  concept: Concept
}

const TERMS: ReadonlyArray<{ concept: Concept; pattern: string }> = [
  { concept: 'story', pattern: 'story\\s+points?' },
  { concept: 'upgrades', pattern: 'upgrades?' },
  { concept: 'heroes', pattern: 'heroes|hero' },
  { concept: 'velocity', pattern: 'velocity' },
  { concept: 'entropy', pattern: 'entropy' },
  { concept: 'devs', pattern: 'developers?|devs' },
  { concept: 'cash', pattern: 'cash' },
  // §4.15 — the three things a studio accumulates, on the other side of the
  // ledger from the things it produces. Listed after `devs` so "QA" and "SRE"
  // below cannot shadow it, and each one is the word a player would actually
  // say: nobody says "defect backlog" out loud.
  { concept: 'defects', pattern: 'defects?|bugs?' },
  { concept: 'incidents', pattern: 'incidents?|outages?' },
  { concept: 'tickets', pattern: 'tickets?' },
]

const CONCEPT_RE = new RegExp(`\\b(${TERMS.map((term) => term.pattern).join('|')})\\b`, 'giu')

function conceptFor(value: string): Concept {
  const normalised = value.toLocaleLowerCase().replace(/\s+/g, ' ')
  for (const term of TERMS) {
    if (new RegExp(`^(?:${term.pattern})$`, 'iu').test(normalised)) return term.concept
  }
  return 'story'
}

export function conceptMatches(text: string): ConceptMatch[] {
  const matches: ConceptMatch[] = []
  CONCEPT_RE.lastIndex = 0
  for (const match of text.matchAll(CONCEPT_RE)) {
    const from = match.index
    matches.push({ from, to: from + match[0].length, concept: conceptFor(match[0]) })
  }
  return matches
}

export function conceptsIn(text: string): Concept[] {
  return [...new Set(conceptMatches(text).map(({ concept }) => concept))]
}
