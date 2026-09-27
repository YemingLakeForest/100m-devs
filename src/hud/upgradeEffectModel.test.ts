import { describe, expect, it } from 'vitest'
import { NO_FOUNDER } from '../sim/founder.ts'
import { techEffects } from '../sim/techTree.ts'
import {
  founderEffectReceipt,
  techEffectReceipt,
} from './upgradeEffectModel.ts'

describe('applied-effect receipts', () => {
  it('proves Instant Messenger with the reciprocal simulation term', () => {
    const receipt = techEffectReceipt(
      'Instant Messenger',
      techEffects(undefined),
      techEffects({ B1: 1 }),
    )
    expect(receipt).toEqual({
      source: 'Instant Messenger',
      status: 'applied',
      lines: [{
        label: 'COMMUNICATION LOAD',
        before: '100%',
        after: '95%',
        factor: '×0.95',
      }],
    })
  })

  it('reports the founder desk before and after in the same grammar', () => {
    const receipt = founderEffectReceipt(
      'Touch Typing',
      NO_FOUNDER,
      { ...NO_FOUNDER, rate: NO_FOUNDER.rate * 1.5 },
    )
    expect(receipt.lines[0]).toEqual({
      label: 'YOUR OUTPUT',
      before: `${NO_FOUNDER.rate}/s`,
      after: `${NO_FOUNDER.rate * 1.5}/s`,
      factor: '×1.5',
    })
  })
})
