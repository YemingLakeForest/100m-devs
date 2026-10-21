/**
 * What each reading in the status bar says when asked — GDD §10.6c [2026-10-20].
 *
 * The rows are read off the same store functions the readouts themselves use,
 * so a tooltip can never disagree with the number it is explaining. Built
 * lazily: `Tipped` calls these only while its panel is open.
 */

import type { ReactNode } from 'react'
import {
  arrivedHeroes,
  baseVelocity,
  currentEffectiveVelocity,
  currentPayroll,
  effectiveDevCap,
  netCashFlow,
  nextPayout,
  pokeVelocity,
  secondsToPayout,
  type GameState,
} from '../game/store.ts'
import { secondsUntilBankrupt } from '../sim/economy.ts'
import { formatCount } from '../sim/headcount.ts'
import type { TipSpec } from '../ui/OsTip.tsx'
import { cashFlowReadout, formatMoney, formatVelocity, payoutReadout, runwayReadout, syncPercent } from './hudModel.ts'

export function cashTip(state: GameState): TipSpec {
  const payout = payoutReadout(nextPayout(state), secondsToPayout(state))
  const runway = runwayReadout(secondsUntilBankrupt(state.cash, state.devs))
  const rows: Array<readonly [string, ReactNode]> = [
    ['NET', cashFlowReadout(netCashFlow(state))],
    ['PAYROLL', `${formatMoney(currentPayroll(state))}/s`],
  ]
  if (payout) rows.push(['NEXT RELEASE', payout])
  if (runway) rows.push(['RUNWAY', runway])
  rows.push(['EARNED, ALL RUNS', formatMoney(state.lifetimeRevenue)])
  return { title: 'CASH', tag: 'WALLET', rows, body: 'What developers and upgrades are paid with. Released games keep paying for as long as anyone plays them.' }
}

export function devsTip(state: GameState): TipSpec {
  return {
    title: 'DEVELOPERS',
    tag: 'HEADCOUNT',
    rows: [
      ['ON THE FLOOR', formatCount(state.devs)],
      ['CAPACITY', formatCount(Math.round(effectiveDevCap(state)))],
      ['HEROES', String(arrivedHeroes().size)],
    ],
    body: 'Every developer writes story points, and every one adds to the talking.',
  }
}

export function shippedTip(state: GameState): TipSpec {
  return {
    title: 'SHIPPED',
    tag: 'THIS RUN',
    rows: [['GAMES', String(state.projectsShipped)]],
    body: 'Games released this run. Each one keeps earning cash until it is forgotten.',
  }
}

export function syncTip(entropy: number, pastPeak: string | null): TipSpec {
  const rows: Array<readonly [string, ReactNode]> = [['SYNC', syncPercent(entropy)]]
  if (pastPeak) rows.push(['PAST THE PEAK', pastPeak])
  return { title: 'SYNC', tag: 'STAT', rows, body: 'How much of the talking still helps. It falls as developers join; past the peak, entropy eats the work.' }
}

export function velocityTip(state: GameState): TipSpec {
  return {
    title: 'VELOCITY',
    tag: 'RATE',
    rows: [
      ['THE FLOOR', formatVelocity(baseVelocity(state))],
      ['YOUR TAPS', formatVelocity(pokeVelocity(state))],
      ['TOTAL', formatVelocity(currentEffectiveVelocity(state))],
    ],
    body: 'Story points per second. Sync multiplies the floor; a tap adds its own.',
  }
}
