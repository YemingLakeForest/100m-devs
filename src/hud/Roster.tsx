/**
 * §13.11.2 — the roster strip: *"who is idle?"*
 *
 * A single row of small cards along the bottom edge of the world, **summoned and
 * dismissed, never permanent furniture** (§10.5's bottom sheet). Each card shows
 * the portrait, the branch colour, the current reach, and one line: where they
 * are, or `BENCHED`.
 *
 * > `BENCHED` is the only word on this strip that is allowed to be red, because
 * > §13.10 makes it the one that is actively costing the player something.
 *
 * ## What this is not
 *
 * **It is not where placement happens.** §13.6.7 is unambiguous — *"if the
 * player is managing heroes on a grid instead of in the world, the entire reason
 * for this design has been thrown away."* Nothing here moves anybody. Tapping a
 * card opens §22.9's card, which is a window onto a person; putting them
 * somewhere is a drag on the floor (§13.8, §7.8.12), and it stays there.
 *
 * **It is also not the intended front door**, and this is worth writing down so
 * it is not mistaken for the finished design. §7.8.12 gives the heroes a room —
 * the executive suite, built around the desk the founder never left — and once
 * that exists the way you reach Mo is by looking at Mo. The strip answers a
 * question the world cannot ("who is idle?") and survives; it is doing double
 * duty as the only door until the suite is built.
 */

import { OsWindow } from '../ui/OsWindow.tsx'
import { REACH_LADDER } from '../sim/heroes.ts'
import { heroIdentity } from '../sim/identity.ts'
import type { HeroCoverage, HeroRuntime } from '../sim/heroRoster.ts'
import { HeroFace } from './HeroFace.tsx'
import { placementBenefit, studioCoverageShare } from './heroPlacementModel.ts'

import '../styles/heroes.css'

export function Roster({
  open,
  roster,
  labelFor,
  coverageFor,
  totalDevs,
  showPoints,
  canPlace,
  onOpen,
  onClose,
}: {
  open: boolean
  roster: readonly HeroRuntime[]
  /** Where each hero is, in words — the same string §22.9's card shows. */
  labelFor: (hero: HeroRuntime) => string
  coverageFor: (hero: HeroRuntime) => HeroCoverage
  totalDevs: number
  /**
   * §21.7.7 — has §13.9's board been handed over?
   *
   * A point is an affordance for a board, so it is only drawn once there is
   * somewhere to spend it. A prop rather than a store read, because nothing
   * else in this file knows what a save is.
   */
  showPoints: boolean
  /**
   * §21.7.6 — has Billy handed over the floor (`game/unlocks.ts`)?
   *
   * The window's own title says `HERO PLACEMENT`, which is a promise it cannot
   * keep before he arrives, so the bar reads what the strip actually is until
   * then: §13.11.2's answer to *"who is idle?"*. A prop rather than a store
   * read, on the same rule as `showPoints` — nothing in this file knows what a
   * save is.
   */
  canPlace: boolean
  onOpen: (hero: HeroRuntime) => void
  onClose: () => void
}) {
  return (
    <OsWindow
      open={open}
      from="bottom"
      className="roster"
      bodyClassName="os-window__body--flush"
      title={canPlace ? 'HERO PLACEMENT' : 'PERSONNEL'}
      /*
        The instruction, in the bar. §13.11.2 keeps this a *strip* — one row of
        cards summoned and dismissed — and the line telling you what a tap does
        was eating a 150px column of it. The bar already exists to say what a
        window is; this is that sentence.

        Both readings are true sentences about the same strip, which is why the
        title moves with the gate rather than the strip being gated: §13.11.2
        answers "who is idle?", and it answers it whether or not there is
        anything to be done about the answer yet.
      */
      meta={canPlace ? 'SELECT A HERO TO PLACE, MOVE, OR REVIEW' : 'SELECT A HERO TO REVIEW'}
      onClose={onClose}
    >
      <div className="roster__strip">
        <div className="roster__cards">
          {roster.map((hero) => {
            const face = heroIdentity(hero.id)
            const where = labelFor(hero)
            const coverage = coverageFor(hero)
            const benefit = placementBenefit(hero, studioCoverageShare(coverage.covered, totalDevs))
            const impact = where === 'BENCHED'
              ? 'NO EFFECT'
              : coverage.settling
                ? 'ACTIVATING'
                : `${coverage.covered.toLocaleString()}/${Math.max(0, Math.floor(totalDevs)).toLocaleString()} · ${benefit.value} ${benefit.shortLabel}`
            return (
              <button
                key={hero.id}
                type="button"
                className="roster__card"
                style={{ ['--branch' as string]: hero.colour }}
                onClick={() => onOpen(hero)}
              >
                {face && <HeroFace look={face.look} className="roster__face" />}
                <span className="roster__name">{hero.hero.name}</span>
                <span className="roster__reach">
                  {REACH_LADDER[hero.reach].name.toUpperCase()} · LV {hero.progress.level}
                </span>
                <span className="roster__where" data-benched={where === 'BENCHED' ? 'true' : 'false'}>
                  {where}
                </span>
                <span
                  className="roster__impact"
                  data-state={where === 'BENCHED' ? 'benched' : coverage.settling ? 'connecting' : 'active'}
                >
                  {impact}
                </span>
                {/* §13.13 — a hero with something to spend is visibly waiting,
                    on the strip as well as on the card, once §21.7.7's board
                    exists to spend it on. */}
                {showPoints && hero.points > 0 && (
                  <span className="roster__points">{hero.points}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </OsWindow>
  )
}
