import type { ReactNode } from 'react'
import type { Breakthrough } from './heroCardModel.ts'

import '../styles/passBands.css'

/**
 * The two bands every hero pass carries, wherever it is printed — PERSONNEL,
 * the staff directory, the offer letter [2026-10-21, GDD §22.9.2 amended].
 *
 * After Lonestar's pilot card, whose meaning is carried by temperature before a
 * word is read: the fixed talent is a warm, filled band and the talents still
 * to come are cool, empty slots. **Warm and filled is yours, now and every run;
 * cool and dashed is coming, with what it takes printed on it.** The trait was
 * headed in the branch colour (2026-10-20), which made four different colours
 * mean the same thing; the branch keeps the pass's edge and the name, and the
 * trait takes the one colour that means "owned" everywhere on the card.
 *
 * One component for all three surfaces so the pass a player meets on the offer
 * letter is, band for band, the pass they keep.
 */

export function AlwaysBand({ trait, children }: { trait: { name: string; text: string }; children?: ReactNode }) {
  return (
    <div className="pass-always">
      <h3 className="pass-always__head">
        <span>ALWAYS</span>
        <span className="pass-always__kind">TRAIT</span>
      </h3>
      <p className="pass-always__name">{trait.name}</p>
      <p className="pass-always__text">{trait.text}</p>
      {children}
    </div>
  )
}

export function BreakthroughSlots({ items }: { items: readonly Breakthrough[] }) {
  if (items.length === 0) return null
  const owned = items.filter((b) => b.status === 'owned').length
  return (
    <div className="pass-coming" aria-label="Breakthroughs">
      <p className="pass-coming__head">
        <span>BREAKTHROUGHS</span>
        <span>
          {owned} / {items.length}
        </span>
      </p>
      <ul className="pass-coming__slots">
        {items.map((b) => (
          <li key={b.id} className={`pass-slot is-${b.status}`}>
            <span className="pass-slot__mark" aria-hidden="true" />
            <span className="pass-slot__name">{b.name}</span>
            <span className="pass-slot__gate">{b.gate}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
