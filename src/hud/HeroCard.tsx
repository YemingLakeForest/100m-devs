/**
 * The hero card — GDD §22.9, R56 [rewritten 2026-09-26].
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
 * ## What changed on 2026-09-26, and why the card is shorter
 *
 * *"Some mechanics in the old game I want remove, hero placement, different
 * types of hires"*, then *"it should be opened by heroes info page, which needs
 * updating now given placement is gone ... redo the info page, I don't want the
 * heroes tray"*. The card used to be mostly about placement: where the hero was
 * posted, how much of the floor they covered, the XP that only coverage earned
 * and the points it bought on a shared board. All of that is gone, so the card
 * now says three things:
 *
 * - **who they are** — the pass, as it always was;
 * - **what they are doing for the studio right now**, in live numbers from the
 *   same fold the simulation charges (`heroRoster.ts`), because a hero works for
 *   the whole studio from the day they arrive;
 * - **UPGRADES**, the door to their own tree (GDD §8), once the first Paradigm
 *   Shift has opened the trees and only for the people who have one.
 *
 * The roster strip that used to rise under it is gone too. The arrows in the
 * foot step to the next person who has arrived instead, so one window is the
 * whole of the heroes' information and nothing else rises from the bottom.
 */

import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'
import { BRANCH_BY_ID } from '../sim/heroBranches.ts'
import { heroIdentity } from '../sim/identity.ts'
import { STORY_HEROES } from '../sim/storyHeroes.ts'
import type { HeroRuntime } from '../sim/heroRoster.ts'
import { HeroFace } from './HeroFace.tsx'
import { heroDuty } from './heroCardModel.ts'

import '../styles/heroes.css'

/** §22.9.2 — the employee number is the hire order, so James is #001. */
function employeeNumber(id: string): string {
  const at = STORY_HEROES.findIndex((h) => h.id === id)
  return `#${String(Math.max(0, at) + 1).padStart(3, '0')}`
}

export function HeroCard({
  hero,
  devs,
  canUpgrade,
  place,
  onClose,
  onUpgrades,
  onStep,
}: {
  hero: HeroRuntime | null
  /** The headcount, for the live rows. */
  devs: number
  /** GDD §8 — this person has a tree, and the first shift has opened the trees. */
  canUpgrade: boolean
  /** Where this card sits among everybody who has arrived, 1-based. */
  place: { at: number; of: number }
  onClose: () => void
  onUpgrades: () => void
  /** Step to the previous (-1) or next (+1) person. */
  onStep: (by: -1 | 1) => void
}) {
  const face = hero ? heroIdentity(hero.id) : null
  const branch = hero ? BRANCH_BY_ID.get(hero.branch) : null
  const duty = hero ? heroDuty(hero, devs) : []

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
        the other is a thing the studio laminated.
      */
      title="PERSONNEL"
      onClose={onClose}
      footer={
        hero ? (
          <>
            {place.of > 1 && (
              <div className="herocard__pager">
                <Button className="herocard__step" onClick={() => onStep(-1)} aria-label="Previous person">←</Button>
                <span className="herocard__place">{place.at} / {place.of}</span>
                <Button className="herocard__step" onClick={() => onStep(1)} aria-label="Next person">→</Button>
              </div>
            )}
            {canUpgrade && <Button onClick={onUpgrades}>UPGRADES</Button>}
          </>
        ) : undefined
      }
    >
      {hero && face && branch && (
        <div className="herocard__pass" style={{ ['--branch' as string]: hero.colour }}>
          {/* The only round thing on the card, and what makes it a pass. */}
          <span className="herocard__punch" aria-hidden="true" />

          <header className="herocard__band">
            <span className="herocard__sigil" aria-hidden="true" />
            <h2 className="herocard__name">{face.name}</h2>
            <span className="herocard__level">{branch.name.toUpperCase()}</span>
          </header>

          <div className="herocard__body">
            <HeroFace look={face.look} id={hero.id} className="herocard__portrait" />
            <dl className="herocard__facts">
              {duty.map((row) => (
                <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
              ))}
            </dl>
          </div>

          {/*
            §22.9.2 — the abilities box: TRAIT only, and the only thing on this
            card written in sentences. It is what the rows above are measuring.
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
