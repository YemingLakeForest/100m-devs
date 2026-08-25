/**
 * §13.8's interim placement gesture, said out loud — GDD §7.7.6b.
 *
 * §7.7.6b's finding was not about thresholds. It was that three verbs came off
 * one finger with nothing on screen saying which one was armed, so the player
 * found out what mode they were in by watching the wrong thing happen. Arming a
 * placement is a fourth verb on the same finger, and it inherits the same rule:
 *
 * > The mode is **said out loud, on the HUD, before the finger lands.**
 *
 * It is a banner rather than a fourth latch on §7.7.6b's switch, and that is
 * the distinction between the two kinds of mode this game has. POKE and GRAB
 * are *stances* — you stay in them, they are how you play. A posting is a
 * **sentence with one word left**: the player has already named who, and the
 * only thing outstanding is where. A stance that empties itself after one tap
 * would be a latch that will not stay down, which is a broken switch.
 *
 * So it appears with somebody armed and leaves with them placed, and while it
 * is up it is the only thing on the rail claiming the next tap.
 */

import { Button } from '../ui/Button.tsx'
import { cancelPosting, devsUnderPlacement, heroRoster } from '../game/store.ts'
import type { GameState } from '../game/store.ts'
import { SETTLE_SECONDS } from '../sim/heroRoster.ts'
import {
  coverageLabel,
  coveragePercent,
  placementBenefit,
  studioCoverageShare,
} from './heroPlacementModel.ts'

import '../styles/heroes.css'

export function PostingBanner({ state }: { state: GameState }) {
  const roster = heroRoster(state)
  const armed = state.posting === null ? null : roster.find((hero) => hero.id === state.posting) ?? null
  const latest = roster
    .filter((hero) => hero.placement !== null)
    .sort((a, b) => (b.placement?.placedAt ?? 0) - (a.placement?.placedAt ?? 0))[0] ?? null
  const latestAge = latest?.placement ? state.runSeconds - latest.placement.placedAt : Number.POSITIVE_INFINITY
  const showResult = state.posting === null && latest !== null && latestAge < SETTLE_SECONDS + 4

  if (!armed && !showResult) return null

  if (armed) {
    const bestCovered = Math.min(armed.reachDevs, Math.max(0, Math.floor(state.devs)))
    const bestShare = studioCoverageShare(bestCovered, state.devs)
    const benefit = placementBenefit(armed, bestShare)

    return (
      <div className="posting" role="status" aria-live="polite">
        <div className="posting__row" data-phase="choose" style={{ ['--branch' as string]: armed.colour }}>
          <div className="posting__copy">
            <span className="posting__step">PLACE {armed.hero.name.toUpperCase()} — STEP 2 OF 2</span>
            <strong className="posting__line">TAP A DEVELOPER, FLOOR, OR VISIBLE UNIT</strong>
            <span className="posting__benefit">
              BEST COVERAGE HERE: {coverageLabel(bestCovered, state.devs)} · {benefit.value} {benefit.label}
            </span>
            <span className="posting__hint">ROOM: EARLIER DESKS COVER MORE · EMPTY SPACE CANCELS</span>
          </div>
          <Button onClick={cancelPosting}>CANCEL</Button>
        </div>
      </div>
    )
  }

  const hero = latest!
  const placement = hero.placement!
  const targetCovered = Math.min(hero.reachDevs, devsUnderPlacement(placement, state))
  const share = studioCoverageShare(targetCovered, state.devs)
  const benefit = placementBenefit(hero, share)
  const walking = latestAge < SETTLE_SECONDS
  const remaining = Math.max(1, Math.ceil(SETTLE_SECONDS - latestAge))
  const percent = coveragePercent(targetCovered, state.devs)

  return (
    <div className="posting" role="status" aria-live="polite">
      <div
        className="posting__row"
        data-phase={walking ? 'walking' : 'active'}
        style={{ ['--branch' as string]: hero.colour }}
      >
        <div className="posting__copy">
          <span className="posting__step">PLACEMENT CONFIRMED</span>
          <strong className="posting__line">
            {walking
              ? `${hero.hero.name.toUpperCase()} IS MOVING — ACTIVE IN ${remaining}S`
              : `${hero.hero.name.toUpperCase()} IS ACTIVE`}
          </strong>
          <span className="posting__benefit">
            {walking ? 'WILL COVER' : 'COVERS'} {coverageLabel(targetCovered, state.devs)}
            {' '}· {benefit.value} {benefit.label}
          </span>
          <span className="posting__hint">
            {walking ? 'EFFECT AND HERO XP BEGIN AFTER THE WALK' : `LIVE EFFECT · HERO XP SHARE ${percent}%`}
          </span>
        </div>
      </div>
    </div>
  )
}
