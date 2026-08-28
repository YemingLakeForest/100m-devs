import type { PurchaseEffectState } from './usePurchaseEffect.ts'

import '../styles/purchase-effect.css'

export function PurchaseEffect({ effect }: { effect: PurchaseEffectState | null }) {
  if (!effect) return null
  return (
    <section
      className="purchase-effect"
      data-phase={effect.phase}
      data-status={effect.receipt.status}
      role="status"
      aria-live="polite"
    >
      <header className="purchase-effect__head">
        <span>{effect.receipt.status === 'deferred' ? 'EFFECT QUEUED' : 'EFFECT APPLIED'}</span>
        <b>{effect.receipt.source}</b>
      </header>
      <div className="purchase-effect__signal" aria-hidden="true"><i /></div>
      <dl className="purchase-effect__lines">
        {effect.receipt.lines.map((line) => (
          <div key={`${line.label}-${line.before}-${line.after}`}>
            <dt>{line.label}</dt>
            <dd>
              <s>{line.before}</s>
              {line.factor && <em>{line.factor}</em>}
              <strong>→ {line.after}</strong>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
