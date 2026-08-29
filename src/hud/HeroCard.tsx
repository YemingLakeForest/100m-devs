/**
 * The hero card — GDD §22.9, R56.
 *
 * §7.8.8's dev card already exists and it is a **personnel record**: a name,
 * four bars and a mood. If a hero were that with better numbers then a hero is
 * a good developer, and §13's whole command layer is a stat.
 *
 * > The dev card is a record of somebody who works here. The hero card is a card
 * > *of* somebody. They must not share a single visual element.
 *
 * ## Why it is a staff pass
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
 * That is buildable in the existing palette, it is funny in a way that is *about
 * this game* rather than about trading cards, and it inherits §10.8a's border
 * grammar for free.
 */

import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'
import { BRANCH_BY_ID, CHAIN_LENGTH, HERO_NODE_BY_ID, branchColour } from '../sim/heroTree.ts'
import { REACH_LADDER } from '../sim/heroes.ts'
import { heroIdentity } from '../sim/identity.ts'
import { STORY_HEROES } from '../sim/storyHeroes.ts'
import { SETTLE_SECONDS, type HeroCoverage, type HeroRuntime } from '../sim/heroRoster.ts'
import { currentUnlocks } from '../game/store.ts'
import { HeroFace } from './HeroFace.tsx'
import {
  coverageLabel,
  coveragePercent,
  placementBenefit,
  studioCoverageShare,
} from './heroPlacementModel.ts'

import '../styles/heroes.css'

/** §22.9.2 — the employee number is the hire order, so James is #001. */
function employeeNumber(id: string): string {
  const at = STORY_HEROES.findIndex((h) => h.id === id)
  return `#${String(Math.max(0, at) + 1).padStart(3, '0')}`
}

/**
 * §22.9.2's depth pips — DEPTH levels owned, filled and unfilled.
 *
 * Pips rather than a total because §13.6.7a's dilution has to be visible: a
 * level bought three rungs ago is worth less than one bought now, and "a hero
 * broadened is a hero diluted" is a sentence you can only put on a card if the
 * levels are separate marks.
 */
function Pips({ owned, total }: { owned: number; total: number }) {
  return (
    <span className="herocard__pips" aria-label={`${owned} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="herocard__pip" data-on={i < owned ? 'true' : 'false'} />
      ))}
    </span>
  )
}

export function HeroCard({
  hero,
  placedLabel,
  coverage = null,
  targetCovered = 0,
  totalDevs = 0,
  now = 0,
  onClose,
  onOpenTree,
  onPost,
  onRecall,
}: {
  hero: HeroRuntime | null
  /** Where they are, in words. §13.11.2 — `BENCHED` is the only red word here. */
  placedLabel: string
  /** Live coverage after §13.8's walking delay. */
  coverage?: HeroCoverage | null
  /** Coverage this placement will have after the walk; zero while benched. */
  targetCovered?: number
  totalDevs?: number
  /** Current simulated run time, used only for the visible walking countdown. */
  now?: number
  onClose: () => void
  onOpenTree: () => void
  /**
   * §13.8 — arm the interim placement gesture. The card closes and the next tap
   * on the world posts them; see `GameState.posting` for why the drag §13.8
   * actually specifies is not what this is.
   */
  onPost: () => void
  /** §13.8 — take them off the floor. Immediate, because it needs no target. */
  onRecall: () => void
}) {
  const face = hero ? heroIdentity(hero.id) : null
  const branch = hero ? BRANCH_BY_ID.get(hero.branch) : null
  const activeCovered = coverage?.covered ?? 0
  const activeShare = studioCoverageShare(activeCovered, totalDevs)
  const queuedShare = studioCoverageShare(targetCovered, totalDevs)
  const liveBenefit = hero ? placementBenefit(hero, activeShare) : null
  const queuedBenefit = hero ? placementBenefit(hero, queuedShare) : null
  const percentCovered = coveragePercent(activeCovered, totalDevs)
  const queuedPercent = coveragePercent(targetCovered, totalDevs)
  const settling = coverage?.settling ?? false
  const remaining = hero?.placement && settling
    ? Math.max(1, Math.ceil(SETTLE_SECONDS - (now - hero.placement.placedAt)))
    : 0
  /*
   * §22.9.2's pips count **every DEPTH node owned, anywhere on the board**, not
   * just the ones at home.
   *
   * Own-branch-only was the first cut and it reads as a bug on exactly one
   * card: James's branch is the trunk and the trunk has no chain, so his row
   * came out as six empty boxes under the word ENGINEERING. Counting the whole
   * board answers the question a player is actually asking of a pip row — *how
   * developed is this person* — and it is the same question for all six.
   */
  const ownDepth = hero
    ? hero.nodes.map((id) => HERO_NODE_BY_ID.get(id)).filter((n) => n?.kind === 'depth').length
    : 0
  const unlocks = currentUnlocks()
  const hasBoard = unlocks.heroBoard
  /*
   * §21.7.6 — **the floor arrives with Billy** (`game/unlocks.ts`).
   *
   * Same shape as `hasBoard` beside it and for the same reason: the card is
   * who somebody is and has never been gated, so what a pre-Billy card loses is
   * one button, not a screen. §21.7.6b's rule that a silent row is the loudest
   * kind of furniture means the verb is simply absent rather than greyed —
   * except that a card reading `BENCHED` in red with nothing at all to press
   * would be §13.10 scolding the player for a thing the game has not offered
   * them yet, so the placement block below says who is coming instead.
   */
  const canPlace = unlocks.heroPlacement

  return (
    <OsWindow
      open={hero !== null}
      from="right"
      className="herocard"
      bodyClassName="herocard__body-scroll"
      /*
        §22.9.1's pass is an *object*, and §10.6a's window is the machine
        holding it up: `STUDIO_OS // PERSONNEL`, with the laminated card inside
        it. The two frames are not a doubling — one is the operating system and
        the other is a thing the studio laminated, and the pass keeps its branch
        colour and its lanyard punch to say so.
      */
      title="PERSONNEL"
      /* No `meta`: the pass carries the name, the level and the employee
         number itself, and the bar restating one of them would be the machine
         reading the card out loud over the player's shoulder. */
      onClose={onClose}
      /*
        §21.7.4's title is *meant* to make this card taller over a career, and a
        card that grows is a card whose buttons walk off the bottom of a 336 px
        frame. The window's foot is outside the scroll structurally, which is
        what `.herocard__scroll` used to do by hand.
      */
      footer={
        hero ? (
          <>
            {/*
              §13.8 — the verb the card was missing.

              **And it is gated after all** [amended 2026-08-29]. This comment
              used to say the opposite, at length: *"it is never gated, unlike
              SKILLS beside it — a hero who has arrived can be posted, and there
              is no board to hand over first because the floor is the board."*
              Every clause of that is true and the conclusion did not follow.
              The floor being the board is exactly what makes it the largest
              instrument in Layer 1, and §21.7.6's rule is that an instrument
              arrives in the hands of the person who solves it. Billy is that
              person; see `game/unlocks.ts`.

              It still leads the row, because it is what the card is *for*.
            */}
            {canPlace && (
              <Button onClick={onPost}>{hero.placement ? 'MOVE HERO' : 'PLACE HERO'}</Button>
            )}
            {canPlace && hero.placement && <Button onClick={onRecall}>RECALL</Button>}
            {/*
              §21.7.7 — **the card is not gated and the board is.**

              A card is who somebody is, and that has been true since Act I.
              §13.9's board is an instrument and it arrives with the first level
              anybody earns — before that it is a screen of purchases attached
              to a person the player has never placed, which is §26.1.6's wall
              in miniature. The door is simply absent until then, on §21.7.6b's
              rule that a silent row is the loudest kind of furniture.
            */}
            {hasBoard && (
              <Button onClick={onOpenTree}>
                {hero.points > 0 ? `SPEND ${hero.points}` : 'SKILLS'}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {hero && face && branch && liveBenefit && queuedBenefit && (
        <div className="herocard__pass" style={{ ['--branch' as string]: branchColour(hero.branch) }}>
          {/* The only round thing on the card, and what makes it a pass. */}
          <span className="herocard__punch" aria-hidden="true" />

          <header className="herocard__band">
            <span className="herocard__sigil" aria-hidden="true" />
            <h2 className="herocard__name">{face.name}</h2>
            <span className="herocard__level">
              LV {hero.progress.level}
              {/* §21.7.7 — a point is only shown once there is somewhere to
                  spend it. The level is a fact about the person and is always
                  drawn; the pips are an affordance for a board that may not
                  have been handed over yet. */}
              {hasBoard && hero.points > 0 && (
                <span className="herocard__points" aria-label={`${hero.points} points to spend`}>
                  {'*'.repeat(Math.min(5, hero.points))}
                </span>
              )}
            </span>
          </header>

          <div className="herocard__body">
            <HeroFace look={face.look} className="herocard__portrait" />
            <dl className="herocard__facts">
              <div><dt>REACH</dt><dd>{REACH_LADDER[hero.reach].name.toUpperCase()}</dd></div>
              <div><dt>MAX COVERAGE</dt><dd>{hero.reachDevs.toLocaleString()} DEVS</dd></div>
              <div><dt>PLACED</dt><dd data-benched={placedLabel === 'BENCHED' ? 'true' : 'false'}>{placedLabel}</dd></div>
            </dl>
          </div>

          {/* §13.13's progress toward the next level. The bar is the only place
              XP appears at all: it is never spent, so it is never a figure. */}
          <div className="herocard__xp" aria-hidden="true">
            <span className="herocard__xp-fill" style={{ width: `${Math.round(hero.progress.fraction * 100)}%` }} />
          </div>

          <div
            className="herocard__placement"
            data-state={!hero.placement ? 'benched' : settling ? 'walking' : 'active'}
          >
            <div className="herocard__placement-head">
              <span>PLACEMENT BENEFIT</span>
              <strong>{!hero.placement ? 'OFF' : settling ? `ACTIVE IN ${remaining}S` : `${percentCovered}% COVERAGE`}</strong>
            </div>
            <span className="herocard__coverage" aria-hidden="true">
              <span style={{ width: `${settling ? queuedPercent : percentCovered}%` }} />
            </span>
            {/*
              §21.7.6 — before the floor is handed over, the card still has to
              answer *"why is this person doing nothing"*, and the honest answer
              is not "because you have not placed them". It is that nobody here
              can put anyone anywhere yet. Naming the potential anyway is the
              point: the number is what makes the bench cost something, which is
              what makes Billy's scene relief rather than a tutorial.
            */}
            {!hero.placement && !canPlace && (
              <p>
                WORTH UP TO <strong>{liveBenefit.potential} {liveBenefit.label}</strong>
                {' '}ON THE FLOOR. NOBODY IS RUNNING THE FLOOR YET.
              </p>
            )}
            {!hero.placement && canPlace && (
              <p>
                PLACE THIS HERO TO ACTIVATE UP TO <strong>{liveBenefit.potential} {liveBenefit.label}</strong>
                {' '}AND START EARNING XP.
              </p>
            )}
            {hero.placement && settling && (
              <p>
                TARGET <strong>{coverageLabel(targetCovered, totalDevs)}</strong>
                {' '}— WILL PROVIDE <strong>{queuedBenefit.value} {queuedBenefit.label}</strong>.
              </p>
            )}
            {hero.placement && !settling && (
              <p>
                <strong>{coverageLabel(activeCovered, totalDevs)}</strong>
                {' '}— LIVE <strong>{liveBenefit.value} {liveBenefit.label}</strong>
                {' '}— HERO XP SHARE {percentCovered}%.
              </p>
            )}
          </div>

          <div className="herocard__type">
            <span>{branch.name.toUpperCase()}</span>
            <Pips owned={ownDepth} total={CHAIN_LENGTH} />
          </div>

          {/*
            §22.9.2 — the abilities box: TRAIT only, and the only thing on this
            card written in sentences. Depth and reach are numbers; a trait is
            the personality, arrived with and never bought (§13.9.1).
          */}
          <div className="herocard__traits">
            <h3 className="herocard__trait-name">{hero.hero.trait.name}</h3>
            <p className="herocard__trait-text">{hero.hero.trait.text}</p>
          </div>

          <p className="herocard__flavour">&ldquo;{hero.hero.flavour}&rdquo;</p>

          <footer className="herocard__footer">
            {/* §21.7.4 — the title only ever grows, and when it no longer fits
                it wraps and the card gets taller. It is never truncated,
                because a title that outgrows its own card is the joke. */}
            <span className="herocard__role">{hero.hero.role}</span>
            <span className="herocard__employee">EMPLOYEE {employeeNumber(hero.id)}</span>
            <span className="herocard__gem" aria-hidden="true" />
          </footer>
        </div>
      )}
    </OsWindow>
  )
}
