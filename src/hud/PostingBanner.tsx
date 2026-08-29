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
 *
 * ## One row, and the numbers are somewhere else [rewritten 2026-08-29]
 *
 * Reported as *"the hero placement UI prompt is covering middle of the screen,
 * it's quite distracting and clunky"*, and the report is exact. This was four
 * stacked lines — a step counter, an instruction, a benefit line and a hint —
 * in a 700 px row, floated 126 px off the bottom edge. Measured on the 776x357
 * frame §23.4.2 designs against, that puts its top edge at y≈222 of 357: **the
 * banner sat across the middle of the floor it was asking the player to tap.**
 *
 * Two things were wrong and only one of them was the position.
 *
 * **It was the wrong size**, because it was carrying five facts at once: who is
 * armed, what to do, what the best possible posting would be, what the
 * candidate posting gives, and what the hero's current posting gives. Three of
 * those are decision support for a decision the player already made on §22.9's
 * card, which states the potential benefit in as many words.
 *
 * **And it was in the wrong place for half of what it said.** What a posting is
 * worth to the *studio* belongs at the target, because that is where the player
 * is looking — they are hovering a specific person on a specific rung, asking
 * what putting him there does. `WorldHeroAssignments` already draws a plate at
 * exactly that anchor and already renders a `preview` state, so coverage and the
 * branch effect are answered on the thing being asked about.
 *
 * What stays here is the **mode**, and what the posting is worth to the *hero*:
 * who is armed, which rung, the XP share, and the two verbs. XP keeps its place
 * on the HUD because §13.10 only pays it for work done under coverage, which
 * makes it the reason to move somebody who is already working perfectly well
 * where they are.
 *
 * The result is one row of about 26 px, dropped to the quiet band above §18.0's
 * event banner. It still cannot be missed — it is the only branch-coloured
 * thing on the HUD — and it no longer stands between the finger and the floor.
 */

import { Button } from '../ui/Button.tsx'
import {
  cancelPosting,
  confirmHeroPosting,
  devsUnderPlacement,
  heroCatchUpMultiplier,
  heroRoster,
} from '../game/store.ts'
import type { GameState } from '../game/store.ts'
import { SETTLE_SECONDS } from '../sim/heroRoster.ts'
import { unitLabel } from '../sim/units.ts'
import {
  coverageLabel,
  coveragePercent,
  placementBenefit,
  studioCoverageShare,
} from './heroPlacementModel.ts'

import '../styles/heroes.css'
import { purchaseHaptic } from '../audio/haptics.ts'

function targetLabel(rung: number, index: number): string {
  if (rung <= 2) return `DESK ${index + 1}`
  return `${unitLabel(rung).toUpperCase()} ${String(index + 1).padStart(2, '0')}`
}

/**
 * The row, as one component, so the three phases cannot drift apart in shape.
 *
 * Every phase is `[who] [what] [verbs]` and the only thing that varies is the
 * middle. That is what keeps the strip one row tall at every width: the two
 * fixed ends are short and never wrap, and the middle is the only thing allowed
 * to ellipsise.
 */
function PostingRow({
  phase,
  colour,
  who,
  detail,
  actions,
}: {
  phase: 'choose' | 'preview' | 'walking' | 'active'
  colour: string
  who: string
  detail: string
  actions?: React.ReactNode
}) {
  return (
    <div className="posting" role="status" aria-live="polite">
      <div className="posting__row" data-phase={phase} style={{ ['--branch' as string]: colour }}>
        <span className="posting__who">{who}</span>
        <span className="posting__detail">{detail}</span>
        {actions && <span className="posting__actions">{actions}</span>}
      </div>
    </div>
  )
}

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
    const target = state.postingTarget

    if (target) {
      const candidatePlacement = { ...target, placedAt: state.runSeconds }
      // Coverage decides the XP share and nothing else on this row: the branch
      // effect it also drives is drawn on the plate at the anchor.
      const covered = Math.min(armed.reachDevs, devsUnderPlacement(candidatePlacement, state))
      const xpShare = coveragePercent(covered, state.devs)
      const catchUp = heroCatchUpMultiplier(armed, covered, state)

      return (
        <PostingRow
          phase="preview"
          colour={armed.colour}
          who={`PLACE ${armed.hero.name.toUpperCase()}`}
          /*
           * **Where, and what it is worth to the hero. Not what it is worth to
           * the studio** — that is on the plate at the anchor, where the finger
           * already is.
           *
           * The split is a measurement rather than a taste. §23.4.2's gate
           * measures this row now (it never could before, because nothing in its
           * component list matched a surface that only exists while somebody is
           * armed), and the first thing it reported was the full receipt drawn
           * straight through `CANCEL` at 898x403. One row is about 300 px of
           * copy between a name and two buttons; the receipt is twice that.
           *
           * `XP SHARE` is the reading that stays, because it is the one number
           * here that is about the *hero* rather than about the studio — §13.10
           * only pays XP for work done under coverage — and it is therefore the
           * reason a player moves somebody who is already working perfectly well
           * where they are.
           */
          detail={
            `${targetLabel(target.rung, target.index)} · XP SHARE ${xpShare}%` +
            (catchUp > 1.005 ? ` · ×${catchUp.toFixed(2)}` : '')
          }
          actions={
            <>
              <Button onClick={() => { purchaseHaptic(); confirmHeroPosting() }}>
                {armed.placement ? 'CONFIRM MOVE' : 'CONFIRM PLACE'}
              </Button>
              <Button onClick={cancelPosting}>CANCEL</Button>
            </>
          }
        />
      )
    }

    return (
      <PostingRow
        phase="choose"
        colour={armed.colour}
        who={`PLACE ${armed.hero.name.toUpperCase()}`}
        /* The instruction and the way out, which are the only two things a
           player who has not aimed yet can act on. Short, because the row has
           to hold a name and a button either side of it — see the note on the
           preview branch above. */
        detail="TAP ANYONE · EMPTY SPACE CANCELS"
        actions={<Button onClick={cancelPosting}>CANCEL</Button>}
      />
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

  /*
   * The receipt keeps its own phase and its own two readings, because §13.8
   * rule 4 makes the walk real and a confirmation that claimed the effect was
   * live during it would be a lie the player can watch. The countdown itself is
   * drawn on the pin, at the anchor, where the walking is happening.
   */
  return (
    <PostingRow
      phase={walking ? 'walking' : 'active'}
      colour={hero.colour}
      who={`${hero.hero.name.toUpperCase()} ${walking ? 'IS WALKING' : 'IS ACTIVE'}`}
      detail={
        walking
          ? `ACTIVE IN ${remaining}S · WILL COVER ${coverageLabel(targetCovered, state.devs)}`
          : `COVERS ${coverageLabel(targetCovered, state.devs)} · ${benefit.value} ${benefit.label} · XP ${percent}%`
      }
    />
  )
}
