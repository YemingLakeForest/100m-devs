/**
 * The hero screen — GDD §22.9, R56 [rewritten 2026-09-26, full size 2026-10-13].
 *
 * §7.8.8's dev card already exists and it is a **personnel record**: a name,
 * four bars and a mood. If a hero were that with better numbers then a hero is
 * a good developer, and §13's whole command layer is a stat.
 *
 * > The dev card is a record of somebody who works here. The hero card is a card
 * > *of* somebody. They must not share a single visual element.
 *
 * ## Why the pass is a staff pass
 *
 * The obvious build is a fantasy trading card — foil, gem, gradient frame — and
 * it dies on contact with ART_DIRECTION: 37 flat colours, no gradients,
 * Departure Mono, a §10.8a skew. There is no gloss available and faking one
 * costs the whole look. So §22.9.1 makes it the object this company would
 * actually print: **a laminated staff pass, designed by somebody who badly
 * wanted it to be a trading card.** Lanyard punch at the top, a rarity gem where
 * the security chip goes, an abilities box where the emergency contact details
 * go, and an employee number that is really the order they were hired in.
 *
 * ## What the screen says
 *
 * Placement is gone (2026-09-26: *"Some mechanics in the old game I want
 * remove, hero placement, different types of hires"*), so the screen says three
 * things:
 *
 * - **who they are** — the pass, with the person standing beside it;
 * - **what they are doing for the studio right now**, in live numbers from the
 *   same fold the simulation charges (`heroRoster.ts`), because a hero works for
 *   the whole studio from the day they arrive;
 * - **their tree** (GDD §8), once the first Paradigm Shift has opened the trees
 *   and only for the people who have one.
 *
 * The arrows in the foot step to the next person who has arrived, so one window
 * is the whole of the heroes' information and nothing else rises from the bottom.
 *
 * ## Full size, with the tree beside the pass [2026-10-13]
 *
 * *"I want heroes screen redesigned, it should be full size and have the
 * upgrade tree should be there too ... hero avatar should be there."* The card
 * was a 31 em drawer on the right edge with an UPGRADES button that opened a
 * second window over it, so the person and what you could do for them were never
 * on the screen together. It is now one STUDIO_OS window the size of the tree's:
 * the pass and the standing figure on the left, the tree on the right — the same
 * board and inspector the founder's own tree uses (`TreePane`). The pass keeps
 * its §22.9.1 furniture; the window is still the machine holding it up.
 *
 * ## The pass lies down [2026-10-13]
 *
 * *"the long avartar ugly, the entire page is still very ugly"*. The first cut
 * stood the pass up in a third-width column with the full-length figure in a tall
 * box - a 400px frame holding a 90px person - and left the tree, which is wide
 * and short, the leftover. The pass now lies across the top as a landscape badge
 * (square head-and-shoulders, name, the live rows, the trait) and the tree gets
 * the whole width and nearly all the height below it.
 */

import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'
import type { GameState } from '../game/store.ts'
import { BRANCH_BY_ID } from '../sim/heroBranches.ts'
import { heroIdentity } from '../sim/identity.ts'
import { STORY_HEROES } from '../sim/storyHeroes.ts'
import type { HeroRuntime } from '../sim/heroRoster.ts'
import type { TreeHero } from '../sim/upgradeTrees.ts'
import { HeroFace } from './HeroFace.tsx'
import { heroDuty } from './heroCardModel.ts'
import { formatMoney } from './hudModel.ts'
import { TreePane } from './UpgradeTrees.tsx'

import '../styles/heroes.css'

/** §22.9.2 — the employee number is the hire order, so James is #001. */
function employeeNumber(id: string): string {
  const at = STORY_HEROES.findIndex((h) => h.id === id)
  return `#${String(Math.max(0, at) + 1).padStart(3, '0')}`
}

export function HeroCard({
  hero,
  state,
  tree,
  treesOpen,
  intro = null,
  note = null,
  place,
  onClose,
  onStep,
}: {
  hero: HeroRuntime | null
  /** The whole game state: the live rows read the headcount, the tree reads the wallet. */
  state: GameState
  /** GDD §8 — this person's tree, or null for the people who do not have one yet. */
  tree: TreeHero | null
  /** The first Paradigm Shift has opened the trees. */
  treesOpen: boolean
  /** A node to open the tree on, selected (James's scene opens Instant Messenger). */
  intro?: string | null
  /** One line over the tree while a scene has asked for something. */
  note?: string | null
  /** Where this card sits among everybody who has arrived, 1-based. */
  place: { at: number; of: number }
  onClose: () => void
  /** Step to the previous (-1) or next (+1) person. */
  onStep: (by: -1 | 1) => void
}) {
  const face = hero ? heroIdentity(hero.id) : null
  const branch = hero ? BRANCH_BY_ID.get(hero.branch) : null
  const duty = hero ? heroDuty(hero, state.devs) : []
  const showTree = hero !== null && tree !== null && treesOpen

  return (
    <OsWindow
      open={hero !== null}
      from="centre"
      modal
      className="herocard"
      bodyClassName="herocard__split"
      /*
        §22.9.1's pass is an *object*, and §10.6a's window is the machine
        holding it up: `STUDIO_OS // PERSONNEL`, with the laminated card inside
        it. The two frames are not a doubling — one is the operating system and
        the other is a thing the studio laminated.
      */
      title="PERSONNEL"
      meta={showTree ? <span className="trees__cash">{formatMoney(state.cash)}</span> : undefined}
      onClose={onClose}
    >
      {hero && face && branch && (
        <>
          {/*
            **Nothing on this screen scrolls** [2026-10-13] — *"Dont allow any
            scrolls"*. The pass is a grid whose figure row takes whatever height
            is left (`minmax(0, 1fr)`) and shrinks to it; the text around it is
            the part that has to fit, so the frames that cannot hold a sentence
            drop it (heroes.css) rather than scroll it.
          */}
          <div className="herocard__side" style={{ ['--branch' as string]: hero.colour }}>
            <div className="herocard__pass">
              {/* The only round thing on the card, and what makes it a pass. */}
              <span className="herocard__punch" aria-hidden="true" />

              {/* The face, square: a head-and-shoulders on the branch's colour. */}
              <HeroFace look={face.look} id={hero.id} shot="head" className="herocard__portrait" />

              <header className="herocard__band">
                <h2 className="herocard__name">{face.name}</h2>
                <p className="herocard__tags">
                  <span className="herocard__branch">{branch.name.toUpperCase()}</span>
                  <span className="herocard__employee">
                    EMPLOYEE {employeeNumber(hero.id)}
                    <span className="herocard__gem" aria-hidden="true" />
                  </span>
                </p>
                {/* §21.7.4 - the title only ever grows, and when it no longer fits
                    it wraps. It is never truncated. */}
                {hero.hero.role.toUpperCase() !== branch.name.toUpperCase() && (
                  <p className="herocard__role">{hero.hero.role}</p>
                )}
              </header>

              <dl className="herocard__facts">
                {duty.map((row) => (
                  <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
                ))}
              </dl>

              {/*
                §22.9.2 - the abilities box: TRAIT only, and the only thing on this
                card written in sentences. It is what the rows beside it measure.
              */}
              <div className="herocard__traits">
                <h3 className="herocard__trait-name">{hero.hero.trait.name}</h3>
                <p className="herocard__trait-text">{hero.hero.trait.text}</p>
                <p className="herocard__flavour">&ldquo;{hero.hero.flavour}&rdquo;</p>
              </div>

              {place.of > 1 && (
                <div className="herocard__pager">
                  <Button className="herocard__step" onClick={() => onStep(-1)} aria-label="Previous person">←</Button>
                  <span className="herocard__place">{place.at} / {place.of}</span>
                  <Button className="herocard__step" onClick={() => onStep(1)} aria-label="Next person">→</Button>
                </div>
              )}
            </div>
          </div>

          <section className="herocard__tree" aria-label={`${face.name}'s upgrades`}>
            {showTree ? (
              <TreePane open state={state} hero={tree} intro={intro} note={note} />
            ) : (
              <p className="herocard__locked">
                {tree === null
                  ? `${face.name.toUpperCase()} HAS NO UPGRADE TREE YET`
                  : 'UPGRADES OPEN AFTER YOUR FIRST PARADIGM SHIFT'}
              </p>
            )}
          </section>
        </>
      )}
    </OsWindow>
  )
}
