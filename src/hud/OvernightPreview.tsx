/**
 * Dev-only §24.8 preview — `?overnight`.
 *
 * The real report needs a save that is hours old, and seeding one by hand does
 * not survive the trip: §24.9's auto-save fires on `pagehide`, so the reload
 * that would load the seeded save overwrites it with the live state first.
 * That is the lifecycle working correctly and it makes the screen impossible
 * to look at, which is how a screen ends up shipping unexamined.
 *
 * So this renders it from a synthetic report — the same seam as `?dialogue`,
 * and the way the §10.8 F1–F6 gate gets run on the handset.
 *
 * `?overnight=capped` adds the BUILD SERVER IDLE line; `?ad` adds the 2x
 * button, which is otherwise correctly absent because no ad network is wired.
 */

import Decimal from 'break_infinity.js'
import { OvernightReport } from './OvernightReport.tsx'
import type { OfflineReport } from '../sim/offline.ts'

function sample(capped: boolean): OfflineReport {
  return {
    elapsedSeconds: capped ? 11 * 3600 : 2 * 3600,
    paidSeconds: 2 * 3600,
    idleSeconds: capped ? 9 * 3600 + 12 * 60 : 0,
    qualifies: true,
    storyPoints: new Decimal(142_560),
    burned: new Decimal(0),
    commitment: new Decimal(1000),
    projectIndex: 3,
    projectsShipped: 4,
    revenue: new Decimal(285),
    shipCapReached: false,
  }
}

export function OvernightPreview({ capped, adReady }: { capped: boolean; adReady: boolean }) {
  return (
    <OvernightReport
      report={sample(capped)}
      adReady={adReady}
      onCollect={(m) => console.log(`[overnight] collect x${m}`)}
    />
  )
}
