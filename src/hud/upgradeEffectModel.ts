import type { FounderEffects } from '../sim/founder.ts'
import type { HeroFold } from '../sim/heroRoster.ts'
import type { TechEffects } from '../sim/techTree.ts'

export interface UpgradeEffectLine {
  label: string
  before: string
  after: string
  /** The exact operation, when a multiplier is the honest description. */
  factor?: string
}

export interface UpgradeEffectReceipt {
  source: string
  status: 'applied' | 'deferred'
  lines: UpgradeEffectLine[]
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9
const multiplier = (value: number) => `×${value.toFixed(2).replace(/\.?0+$/, '')}`
const percent = (value: number) => `${Math.round(value * 100)}%`
const number = (value: number, suffix = '') => `${Number(value.toFixed(2))}${suffix}`

function changed(
  lines: UpgradeEffectLine[],
  label: string,
  before: number,
  after: number,
  render: (value: number) => string = number,
): void {
  if (near(before, after)) return
  lines.push({
    label,
    before: render(before),
    after: render(after),
    factor: before !== 0 ? multiplier(after / before) : undefined,
  })
}

function switched(
  lines: UpgradeEffectLine[],
  label: string,
  before: boolean,
  after: boolean,
): void {
  if (before === after) return
  lines.push({ label, before: before ? 'ON' : 'OFF', after: after ? 'ON' : 'OFF' })
}

/** The simulation truth made legible at the exact moment a company node resolves. */
export function techEffectReceipt(
  source: string,
  before: TechEffects,
  after: TechEffects,
): UpgradeEffectReceipt {
  const lines: UpgradeEffectLine[] = []
  // Communication load and developer capacity are reciprocal forms of the same term.
  changed(lines, 'COMMUNICATION LOAD', 1 / before.devCapMultiplier, 1 / after.devCapMultiplier, percent)
  changed(lines, 'ENTROPY CEILING', before.entropyCap, after.entropyCap, percent)
  changed(lines, 'DEVS AT KEYBOARD', before.activeDevFraction, after.activeDevFraction, percent)
  changed(lines, 'REVENUE', before.revenueMultiplier, after.revenueMultiplier, multiplier)
  changed(lines, 'ESTIMATION TIER', before.estimationTier, after.estimationTier, (v) => `TIER ${v}`)
  switched(lines, 'FLOW SURVIVES POKE', before.flowSurvivesPoke, after.flowSurvivesPoke)
  changed(lines, 'OVERWHELMED TIME', before.overwhelmedScale, after.overwhelmedScale, multiplier)
  changed(lines, 'DISPLAYED VELOCITY', before.velocityDisplayScale, after.velocityDisplayScale, multiplier)
  changed(lines, 'SHIP COMMITMENT', before.commitmentFraction, after.commitmentFraction, percent)
  switched(lines, 'DAILY STANDUPS', before.standups, after.standups)
  changed(lines, 'AWAY-FROM-DESK TIME', before.slackShare, after.slackShare, percent)
  for (const errand of after.slackBlocked) {
    if (!before.slackBlocked.includes(errand)) {
      lines.push({ label: `${errand.toUpperCase()} TRIPS`, before: 'ON', after: 'OFF' })
    }
  }
  return { source, status: 'applied', lines }
}

/** Hero points are permanent; an unplaced hero therefore gets an explicit deferred receipt. */
export function heroEffectReceipt(
  source: string,
  before: HeroFold,
  after: HeroFold,
): UpgradeEffectReceipt {
  const lines: UpgradeEffectLine[] = []
  changed(lines, 'STORY-POINT YIELD', before.yield, after.yield, multiplier)
  changed(lines, 'ENTROPY', before.entropy, after.entropy, multiplier)
  changed(lines, 'DEVELOPER CAP', before.cap, after.cap, multiplier)
  changed(lines, 'DEFECT ARRIVALS', before.defects, after.defects, multiplier)
  changed(lines, 'INCIDENT ARRIVALS', before.incidents, after.incidents, multiplier)
  changed(lines, 'SUPPORT HEADS', before.supportHeads, after.supportHeads, (v) => number(v, ' heads'))
  changed(lines, 'INCIDENT START WORK', before.incidentStartWork, after.incidentStartWork, percent)
  changed(lines, 'TICKET ARRIVALS', before.ticketRate, after.ticketRate, multiplier)
  changed(lines, 'STANDUP-PROTECTED HEADS', before.standupHeads, after.standupHeads, (v) => number(v, ' heads'))
  changed(lines, 'OPERATING COST', before.operatingCost, after.operatingCost, (v) => `$${number(v)}/s`)
  changed(lines, 'SHIP CRAFT', before.craft, after.craft, percent)

  if (lines.length === 0) {
    return {
      source,
      status: 'deferred',
      lines: [{ label: 'PLACEMENT', before: 'BENCHED', after: 'APPLIES WHEN POSTED' }],
    }
  }
  return { source, status: 'applied', lines }
}

/** The founder is always at their desk, so every management purchase applies immediately. */
export function founderEffectReceipt(
  source: string,
  before: FounderEffects,
  after: FounderEffects,
): UpgradeEffectReceipt {
  const lines: UpgradeEffectLine[] = []
  changed(lines, 'YOUR OUTPUT', before.rate, after.rate, (v) => number(v, '/s'))
  changed(lines, 'OUTPUT PER TAP', before.tapValue, after.tapValue)
  changed(lines, 'POKE ENTROPY', before.contextSwitchScale, after.contextSwitchScale, multiplier)
  changed(lines, 'CASH PER POINT', before.cashPerPoint, after.cashPerPoint, (v) => `$${number(v)}`)
  switched(lines, 'OFFLINE OUTPUT', before.worksOffline, after.worksOffline)
  changed(lines, 'TAP REACH', before.reachRows, after.reachRows, (v) => `${v} rows`)
  changed(lines, 'HIRE-COST GROWTH', before.hireGrowth, after.hireGrowth, multiplier)
  changed(lines, 'DEFECT ARRIVALS', before.defectScale, after.defectScale, multiplier)
  changed(lines, 'LUCK FLOOR', before.luckFloor, after.luckFloor, percent)
  return { source, status: 'applied', lines }
}
