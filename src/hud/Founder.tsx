import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'
import { FounderAvatar } from '../ui/FounderAvatar.tsx'
import { founderOf, pokeFounder } from '../game/store.ts'
import { DEFAULT_FOUNDER, readFounderProfile } from '../game/founderProfile.ts'
import type { StageHandle } from '../render/stage.ts'
import { useGameState } from './useGameState.ts'
import { Kw } from './Kw.tsx'
import { playKeyboardClick } from '../audio/sfx.ts'

import '../styles/founder.css'

/**
 * Your desk — GDD §4.5d, §7.8.10, §13.7.1. R16 and R20.
 *
 * **§4.5d's hardest requirement is the placement one**, and it is why this is a
 * rail control rather than only a seat on the floor:
 *
 * > It is clickable from anywhere. You do not have to fly the camera home to
 * > use it. The desk is where it *lives* … but the action is available at every
 * > zoom — because it is you, and you are always present.
 *
 * A control that only worked while the camera happened to be in the room would
 * fail that sentence at rung 3 and above, which is most of the game. So the
 * action has a permanent affordance, and §7.8.10's corner seat is the *picture*
 * of the same thing rather than the only way to reach it.
 *
 * **One button, and that is a hard constraint rather than a preference.** The
 * right rail was measured at every frame in §23.4's design box, and the note on
 * the 336 px media query records that adding §7.7.6b's touch latches already
 * cost the rail a row — "a new control does not get to evict canon". So the
 * desk is a single slab that shares §13.2's row, and the rate it produces is
 * read off §10.1's `swarm + you` split where it already appears. The person's
 * own world hit target opens the identity/tree screen; CODE remains only CODE.
 */
export function FounderDesk({ stage }: { stage: StageHandle | null }) {
  // Same slab as MENU (`.hud__menu`), mirrored to the other foot. The nameplate
  // that used to sit over it is gone: it repeated a name the player typed, and
  // the avatar in the room already says it.
  return (
    <Button
      className="hud__code"
      sound={false}
      onClick={() => {
        if (stage) stage.codeFounder()
        else {
          playKeyboardClick()
          pokeFounder()
        }
      }}
    >
      CODE
    </Button>
  )
}

/**
 * Clicking the person in the room opens their own surface: who you are, what
 * you produce, and the door to your upgrades. Coding stays on the rail button,
 * so inspecting yourself never spends a tap and tapping CODE never unexpectedly
 * opens navigation.
 *
 * **The Management tree is gone from it** [2026-09-26]. It sat on the right of
 * this panel, and it was retired with the studio board — *"retire the old
 * tree"* — because your upgrades are your tree now (GDD §8), opened from the
 * foot of this panel the way everybody else's opens from their card.
 */
export function FounderProfilePanel({
  open,
  onClose,
  onUpgrades,
}: {
  open: boolean
  onClose: () => void
  /**
   * GDD §8 — your own upgrade tree, the same door every hero's card has.
   * Absent until the first Paradigm Shift opens the trees (`unlocks.trees`).
   */
  onUpgrades?: () => void
}) {
  useGameState()
  const founder = readFounderProfile() ?? DEFAULT_FOUNDER

  return (
    <OsWindow
      open={open}
      modal
      from="centre"
      className="founder-profile"
      bodyClassName="os-window__body--flush"
      title={`PERSONNEL // ${founder.name.toUpperCase()}`}
      meta="FOUNDER · STILL CODES"
      onClose={onClose}
      footer={onUpgrades ? <Button onClick={onUpgrades}>UPGRADES</Button> : undefined}
    >
      <div className="founder-profile__body">
        <aside className="founder-profile__identity">
          <FounderAvatar {...founder} label="YOU" />
          <dl>
            <div><dt>OUTPUT</dt><dd>ON CLICK</dd></div>
            <div><dt>PER TAP</dt><dd>+{founderOf().tapValue.toFixed(0)} <Kw>STORY POINTS</Kw></dd></div>
            <div><dt>PAYROLL</dt><dd>$0</dd></div>
          </dl>
        </aside>
      </div>
    </OsWindow>
  )
}
