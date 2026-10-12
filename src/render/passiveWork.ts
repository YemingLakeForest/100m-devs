import { assignStreams } from '../sim/juice.ts'
import type { PokeFloater } from './pokeText.ts'

export interface WorkingPerson { seat: number; rate: number; x: number; y: number }
/** Display-only accounting: never pays points into the game. Whole points wait
 * until earned; slow output can show a fraction after four seconds.
 *
 * [2026-10-11] **The numerals add up.** Every worker used to carry a numeral of
 * their own and a bounded pool kept a crowded office from becoming a wall of
 * them, so a hundred visible people showed 61% of the work they were doing and a
 * thousand showed a few percent: the more the studio grew, the more the feedback
 * lied. Past a dozen people the workers now share streams (`sim/juice.ts`), each
 * stream's numeral carries the sum, and the pool is the same size it always was —
 * what changed is what each numeral says. The hops stay per person: that is the
 * part of the crowd you read as a crowd. */
export function createPassiveWork() {
  const hops = new Map<number, number>()
  const accounts = new Map<string, { credit: number; age: number; turn: number }>()
  let floaters: (PokeFloater & { seat: number })[] = [], sequence = 0
  return {
    update(people: WorkingPerson[], dt: number, now: number, reduced: boolean, hop: (seat: number) => void) {
      const visible = new Map(people.map(p => [p.seat, p]))
      for (const seat of hops.keys()) if (!visible.has(seat)) hops.delete(seat)
      for (const p of people) {
        if (p.rate <= 0) { hops.delete(p.seat); continue }
        let h = (hops.get(p.seat) ?? ((p.seat + 3) * .618034) % 1.3) - dt
        if (h <= 0) {
          if (!reduced) hop(p.seat)
          h = Math.max(.7, 1.6 / Math.sqrt(Math.max(.5, p.rate)))
        }
        hops.set(p.seat, h)
      }

      const streams = assignStreams(people.filter(p => p.rate > 0))
      const live = new Set(streams.map(s => s.key))
      for (const key of accounts.keys()) if (!live.has(key)) accounts.delete(key)
      floaters = floaters.filter(f => now - f.bornAt < 1300 && visible.has(f.seat))
      const offset = sequence % Math.max(1, streams.length)
      for (let i = 0; i < streams.length; i++) {
        const s = streams[(i + offset) % streams.length]
        let a = accounts.get(s.key)
        if (!a) { a = { credit: 0, age: 0, turn: 0 }; accounts.set(s.key, a) }
        a.credit += s.rate * dt; a.age += dt
        if (a.age < .65 || (a.credit < 1 && a.age < 4) || a.credit < .01 || floaters.length >= 24) continue
        const sp = a.credit >= 1 ? Math.floor(a.credit) : Math.floor(a.credit * 100) / 100
        a.credit -= sp; a.age = 0
        // The numeral rises over each member of the stream in turn, so a crowd's total is read
        // across the room rather than always over the same head.
        const seat = s.members[a.turn++ % s.members.length]
        const at = visible.get(seat)!
        floaters.push({ seat, id: ++sequence, sp, x: at.x, y: at.y, bornAt: now, crit: false, snippet: null, unblocked: false, passive: true, still: reduced })
      }
      return floaters.map(f => { const p = visible.get(f.seat)!; return { ...f, x: p.x, y: p.y } })
    },
  }
}
