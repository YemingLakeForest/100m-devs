import { useMemo } from 'react'
import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'
import { founderOf, pokeFounder, type GameState } from '../game/store.ts'
import { DEFAULT_FOUNDER, founderLook, readFounderProfile } from '../game/founderProfile.ts'
import { HeroFace } from './HeroFace.tsx'
import { formatMoney } from './hudModel.ts'
import { TreePane } from './UpgradeTrees.tsx'
import type { StageHandle } from '../render/stage.ts'
import { useGameState } from './useGameState.ts'
import { Kw } from './Kw.tsx'
import { playKeyboardClick } from '../audio/sfx.ts'

import '../styles/founder.css'
import '../styles/heroes.css'

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
  state,
  treesOpen = false,
  intro = null,
}: {
  open: boolean
  onClose: () => void
  /** The wallet and the nodes the tree reads. Absent in the tests that only want the badge. */
  state?: GameState
  /** GDD §8 - the first Paradigm Shift has opened the trees (`unlocks.trees`). */
  treesOpen?: boolean
  /** A node to open the tree on, selected. */
  intro?: string | null
}) {
  useGameState()
  const founder = readFounderProfile() ?? DEFAULT_FOUNDER
  const look = useMemo(() => founderLook(founder), [founder])
  const showTree = state !== undefined && treesOpen

  /*
    [2026-10-13] *"the you button brings up us but the screen is so bad"*. This
    was a 232px column of figure and three rows beside a blank board, with
    UPGRADES in the foot opening a second window. You are a person on the
    team, so you get the team's screen: the same pass lying across the top
    (heroes.css) and your own tree, the same board, under it.
  */
  return (
    <OsWindow
      open={open}
      modal
      from="centre"
      className="herocard"
      bodyClassName="herocard__split"
      title={`PERSONNEL // ${founder.name.toUpperCase()}`}
      meta={showTree && state ? <span className="trees__cash">{formatMoney(state.cash)}</span> : 'FOUNDER · STILL CODES'}
      onClose={onClose}
    >
      <div className="herocard__side" style={{ ['--branch' as string]: 'var(--p3)' }}>
        <div className="herocard__pass">
          <span className="herocard__punch" aria-hidden="true" />
          <HeroFace look={look} id="founder" shot="head" className="herocard__portrait" />
          <header className="herocard__band">
            <h2 className="herocard__name">{founder.name}</h2>
            <p className="herocard__tags">
              <span className="herocard__branch">FOUNDER</span>
              <span className="herocard__employee">
                EMPLOYEE #000
                <span className="herocard__gem" aria-hidden="true" />
              </span>
            </p>
          </header>
          <dl className="herocard__facts">
            <div><dt>OUTPUT</dt><dd>ON CLICK</dd></div>
            <div><dt>PER TAP</dt><dd>+{founderOf().tapValue.toFixed(0)} <Kw>STORY POINTS</Kw></dd></div>
            <div><dt>PAYROLL</dt><dd>$0</dd></div>
          </dl>
        </div>
      </div>
      <section className="herocard__tree" aria-label="Your upgrades">
        {showTree && state ? (
          <TreePane open state={state} hero="you" intro={intro} />
        ) : (
          <p className="herocard__locked">UPGRADES OPEN AFTER YOUR FIRST PARADIGM SHIFT</p>
        )}
      </section>
    </OsWindow>
  )
}
