import { useMemo, useState } from 'react'
import { CutScene } from '../title/CutScene.tsx'
import { duration, grouped, paradigmBootPages, shiftLabel, shortMoney, type ShiftReport } from '../game/paradigmBoot.ts'
import { DEFAULT_FOUNDER, founderLook, readFounderProfile } from '../game/founderProfile.ts'
import { LESSONS } from '../game/lessons.ts'
import { personPortrait } from '../three/render/portrait.ts'
import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'

import '../styles/runReport.css'

/**
 * §15.1a — the reboot between two realities.
 *
 * §15.1 has always said what happens when a shift is confirmed: *"a CRT monitor
 * reboot animation wipes the screen... and the new run begins."* Until this
 * existed, nothing did — the bankruptcy panel closed and the player was simply
 * somewhere else, which made the largest event in the game the only one with no
 * beat attached to it.
 *
 * It is §10.9.3's boot screen ({@link CutScene}), because that is the screen
 * this game uses to say *a studio is starting*. What it carries first is the
 * account of the one that stopped: which shift this is, what the reality did,
 * and what it taught (`lessons.ts`).
 *
 * **The run report comes first** [CANON - added 2026-10-20, §15.1b]. After
 * Lonestar's victory screen: the run's numbers on one page, with a rubber stamp
 * landing on the founder's pass. The boot then plays as before. The stamp is
 * the object a laminated staff pass would actually get (§22.9.1's register) —
 * flat ink, four stepped frames, no glow.
 *
 * **The founder is read here rather than passed through the store.** The profile
 * is an install-level fact kept outside `GameState` (`founderProfile.ts`), and
 * threading it through a run report so a cut scene could print one name would
 * put a copy of it somewhere it can go stale.
 */
export function ParadigmCutScene({
  report,
  onDone,
}: {
  report: ShiftReport | null
  onDone: () => void
}) {
  // Null when storage is blocked or the profile was never written; the boot's
  // own default is the right answer there, and a cut scene is not a place to
  // start reporting that localStorage is unavailable.
  const profile = useMemo(() => readFounderProfile() ?? DEFAULT_FOUNDER, [])
  const founder = profile.name
  // Memoised on the report so a HUD re-render — and the store publishes several
  // a second — cannot hand `CutScene` a new array and reset the page it is on.
  const pages = useMemo(
    () => (report ? paradigmBootPages(report, founder) : []),
    [report, founder],
  )
  // Which report the player has already read the page for. Adjusted during
  // render (React's own pattern): a new shift starts on its report again.
  const [readFor, setReadFor] = useState<ShiftReport | null>(null)
  if (!report) return null
  if (readFor !== report) {
    return <RunReport report={report} founder={founder} face={personPortrait(founderLook(profile), 'founder', 'head')} onNext={() => setReadFor(report)} />
  }
  return <CutScene pages={pages} onDone={onDone} />
}

function RunReport({
  report,
  founder,
  face,
  onNext,
}: {
  report: ShiftReport
  founder: string
  face: string | null
  onNext: () => void
}) {
  return (
    <OsWindow
      open
      modal
      from="centre"
      className="run-report"
      bodyClassName="run-report__body"
      title={`RUN REPORT // SHIFT ${shiftLabel(report.shift)}`}
      meta={<span className="run-report__bp">+{report.bp} BP</span>}
      footer={
        <Button variant="primary" onClick={onNext}>
          {/* One string — trap 31: a test or a screen reader reads it as one name. */}
          {`START RUN ${report.shift + 1}`}
        </Button>
      }
    >
      <div className="run-report__pass">
        <div className="run-report__card">
          {face ? <img className="run-report__face" src={face} alt="" aria-hidden="true" /> : <span className="run-report__face" aria-hidden="true" />}
          <p className="run-report__name">{founder}</p>
          <p className="run-report__role">FOUNDER · EMPLOYEE #000</p>
          {/* The stamp: the one thing on the page allowed to be crooked. */}
          <p className="run-report__stamp" aria-label={`Shipped ${report.shipped}`}>
            <small>RUN {report.shift}</small>
            SHIPPED {grouped(report.shipped)}
          </p>
        </div>
      </div>
      <div className="run-report__facts">
        <h2 className="run-report__head">Run {report.shift}, shipped.</h2>
        <dl className="run-report__stats">
          <div><dt>GAMES SHIPPED</dt><dd>{grouped(report.shipped)}</dd></div>
          <div><dt>RUN TIME</dt><dd>{duration(report.seconds)}</dd></div>
          <div><dt>REVENUE</dt><dd className="run-report__money">{shortMoney(report.revenue)}</dd></div>
          <div><dt>PEAK DEVELOPERS</dt><dd>{grouped(report.peakDevs)}</dd></div>
          <div><dt>BANDWIDTH EARNED</dt><dd className="run-report__money">+{report.bp} BP</dd></div>
        </dl>
        <p className="run-report__lesson">
          <span>WHAT IT TAUGHT</span>
          {LESSONS[report.learned]}
        </p>
      </div>
    </OsWindow>
  )
}
