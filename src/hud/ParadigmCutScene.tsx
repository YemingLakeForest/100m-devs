import { useMemo } from 'react'
import { CutScene } from '../title/CutScene.tsx'
import { paradigmBootPages, type ShiftReport } from '../game/paradigmBoot.ts'
import { DEFAULT_FOUNDER, readFounderProfile } from '../game/founderProfile.ts'

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
  const founder = useMemo(() => readFounderProfile()?.name ?? DEFAULT_FOUNDER.name, [])
  // Memoised on the report so a HUD re-render — and the store publishes several
  // a second — cannot hand `CutScene` a new array and reset the page it is on.
  const pages = useMemo(
    () => (report ? paradigmBootPages(report, founder) : []),
    [report, founder],
  )
  if (!report) return null
  return <CutScene pages={pages} onDone={onDone} />
}
