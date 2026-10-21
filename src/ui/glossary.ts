import type { Concept } from './concepts.ts'

/**
 * One line per tracked noun — what a keyword says when the pointer rests on it
 * inside a tooltip [2026-10-20, §10.6c].
 *
 * Lonestar's tooltips teach the whole game this way: a coloured word inside a
 * tip opens a second tip beside it. The nouns are §10's concept set, the same
 * words `ConceptText` already inks, so a word the player has learned a colour
 * for is also a word they can ask about. Written in the game's voice and kept
 * to what the HUD can show; a definition that needs a number belongs on a row.
 */
export const GLOSSARY: Readonly<Record<Concept, { title: string; body: string }>> = {
  story: { title: 'STORY POINTS', body: 'One unit of work. Every game needs a fixed number of them; velocity is how fast the floor writes them.' },
  cash: { title: 'CASH', body: 'What hires and upgrades are paid with. Payroll takes it every second; released games pay it back for as long as anyone plays them.' },
  devs: { title: 'DEVELOPERS', body: 'Each one writes code and each one adds to the talking. Past the peak, a hire costs more in conversation than it writes.' },
  entropy: { title: 'SYNC', body: 'How much of the floor’s talking is still useful. It falls as the studio grows; Billy and the Paradigm Tree push it back.' },
  velocity: { title: 'VELOCITY', body: 'Story points per second across the whole floor, plus whatever your taps are adding right now.' },
  upgrades: { title: 'UPGRADES', body: 'Bought on each person’s card, from their own tree. A tree opens after the first Paradigm Shift.' },
  heroes: { title: 'HEROES', body: 'The named people. Each one arrives when the studio first feels the problem they solve, and works for the whole studio from that day.' },
  defects: { title: 'DEFECTS', body: 'Bugs still on the bench. They cost a game its reception if they ship; Serena’s queue catches some on the way out.' },
  incidents: { title: 'INCIDENTS', body: 'Something shipped is broken and live, and it is refunding while it stays open. Matt’s desk clears them.' },
  tickets: { title: 'TICKETS', body: 'The back catalogue writing in. Harmless one at a time; a queue nobody serves turns into incidents.' },
}
