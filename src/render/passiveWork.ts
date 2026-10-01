import type { PokeFloater } from './pokeText.ts'

export interface WorkingPerson { seat: number; rate: number; x: number; y: number }
/** Display-only accounting: never pays points into the game. Whole points wait
 * until earned; slow output can show a fraction after four seconds. A bounded
 * pool prevents a crowded office from turning into a wall of numerals. */
export function createPassiveWork() {
  const accounts = new Map<number, { credit: number; age: number; hop: number }>()
  let floaters: (PokeFloater & { seat: number })[] = [], sequence = 0
  return {
    update(people: WorkingPerson[], dt: number, now: number, reduced: boolean, hop: (seat: number) => void) {
      const visible = new Map(people.map(p => [p.seat, p]))
      for (const seat of accounts.keys()) if (!visible.has(seat)) accounts.delete(seat)
      floaters = floaters.filter(f => now - f.bornAt < 1300 && visible.has(f.seat))
      const offset=sequence%Math.max(1,people.length)
      for (let i=0;i<people.length;i++) {
        const p=people[(i+offset)%people.length]
        if (p.rate <= 0) { accounts.delete(p.seat); continue }
        let a = accounts.get(p.seat)
        if (!a) { a = { credit: 0, age: 0, hop: ((p.seat + 3) * .618034) % 1.3 }; accounts.set(p.seat, a) }
        a.credit += p.rate * dt; a.age += dt; a.hop -= dt
        if (a.hop <= 0) {
          if (!reduced) hop(p.seat)
          a.hop = Math.max(.7, 1.6 / Math.sqrt(Math.max(.5, p.rate)))
        }
        if (a.age < .65 || (a.credit < 1 && a.age < 4) || a.credit < .01 || floaters.length >= 24) continue
        const sp = a.credit >= 1 ? Math.floor(a.credit) : Math.floor(a.credit * 100) / 100
        a.credit -= sp; a.age = 0
        floaters.push({ seat: p.seat, id: ++sequence, sp, x: p.x, y: p.y, bornAt: now, crit: false, snippet: null, unblocked: false, passive: true, still: reduced })
      }
      return floaters.map(f => { const p = visible.get(f.seat)!; return { ...f, x: p.x, y: p.y } })
    },
  }
}
