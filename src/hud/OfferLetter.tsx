import type { GameState } from '../game/store.ts'
import { BRANCH_BY_ID } from '../sim/heroBranches.ts'
import { heroIdentity } from '../sim/identity.ts'
import type { HeroRuntime } from '../sim/heroRoster.ts'
import { STORY_HEROES } from '../sim/storyHeroes.ts'
import { TREE_HEROES, type TreeHero } from '../sim/upgradeTrees.ts'
import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'
import { HeroFace } from './HeroFace.tsx'
import { breakthroughsOf } from './heroCardModel.ts'
import { AlwaysBand, BreakthroughSlots } from './PassBands.tsx'

import '../styles/offerLetter.css'

/**
 * §22.9.4 — the offer letter [CANON - added 2026-10-21].
 *
 * Lonestar's pilot screen is a *form* — "Bounty Hunter Association Delegation
 * Form", numbered steps — and the paperwork is what makes a menu feel like a
 * place. A hero's arrival scene (§21.7.3) ends on a handshake and the person
 * used to simply be on the floor; now the handshake is followed by the one
 * document a studio actually produces when somebody joins: a letter, with the
 * reason filled in, the pass they will carry, and a stamp.
 *
 * **The pass printed here is the pass they keep.** The trait band and the
 * breakthrough slots are the same components PERSONNEL draws, so the first look
 * at a hero teaches the card the player will open for the rest of the game.
 *
 * One press: SIGN. It is the only button on the page, and filled (§10.8a).
 */
export function OfferLetter({
  hero,
  state,
  treesOpen,
  onSign,
}: {
  hero: HeroRuntime | null
  state: GameState
  treesOpen: boolean
  onSign: () => void
}) {
  const who = hero ? heroIdentity(hero.id) : null
  const branch = hero ? BRANCH_BY_ID.get(hero.branch) : null
  const tree = hero && (TREE_HEROES as readonly string[]).includes(hero.id) ? (hero.id as TreeHero) : null
  const number = hero ? STORY_HEROES.findIndex((h) => h.id === hero.id) + 1 : 0

  return (
    <OsWindow
      open={hero !== null}
      modal
      from="centre"
      className="offer"
      bodyClassName="offer__body"
      title="HR // OFFER OF EMPLOYMENT"
      meta={<span className="offer__ref">FORM HR-7 · #{String(number).padStart(3, '0')}</span>}
      footer={
        <Button variant="primary" onClick={onSign}>
          SIGN
        </Button>
      }
    >
      {hero && who && branch && (
        <>
          <div className="offer__side" style={{ ['--branch' as string]: hero.colour }}>
            <p className="offer__step is-done"><i>1</i>PROBLEM FELT</p>
            <div className="offer__photo">
              <HeroFace look={who.look} id={hero.id} shot="head" className="offer__face" />
              {/* The stamp: the one thing on the page allowed to be crooked. */}
              <p className="offer__stamp">HIRED</p>
            </div>
            <p className="offer__step"><i>2</i>SIGN</p>
          </div>
          <div className="offer__form" style={{ ['--branch' as string]: hero.colour }}>
            <dl className="offer__fields">
              <div><dt>POSITION</dt><dd>{hero.hero.epithet}</dd></div>
              <div><dt>NAME</dt><dd className="offer__name">{who.name}</dd></div>
              <div><dt>DEPARTMENT</dt><dd>{hero.hero.role}</dd></div>
              <div><dt>REASON</dt><dd>{hero.hero.hiredFor}</dd></div>
            </dl>
            <AlwaysBand trait={hero.hero.trait} />
            {tree && <BreakthroughSlots items={breakthroughsOf(tree, state, treesOpen)} />}
          </div>
        </>
      )}
    </OsWindow>
  )
}
