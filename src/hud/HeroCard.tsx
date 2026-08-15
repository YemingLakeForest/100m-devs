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
import { Panel } from '../ui/Panel.tsx'
import { BRANCH_BY_ID, CHAIN_LENGTH, HERO_NODE_BY_ID, branchColour } from '../sim/heroTree.ts'
import { REACH_LADDER } from '../sim/heroes.ts'
import { heroIdentity } from '../sim/identity.ts'
import { STORY_HEROES } from '../sim/storyHeroes.ts'
import { effectiveDepth, type HeroRuntime } from '../sim/heroRoster.ts'
import { HeroFace } from './HeroFace.tsx'

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

/**
 * The one number this hero's branch is about, live. Not a stat block.
 *
 * Read through {@link effectiveDepth} rather than by counting nodes, so **the
 * card and the simulation cannot disagree**. Counting nodes was the first cut
 * and it made James's card read `VELOCITY +0%` while the fold was giving him
 * half a level of the trunk: a card that misreports the person it is a card of
 * is worse than no card.
 */
function headlineFor(hero: HeroRuntime): { label: string; value: string } {
  const depth = effectiveDepth(hero, hero.branch)

  switch (hero.branch) {
    case 'quality':
      return { label: 'DEFECT RATE', value: `-${Math.round((1 - 0.85 ** depth) * 100)}%` }
    case 'reliability':
      return { label: 'INCIDENT RATE', value: `-${Math.round((1 - 0.85 ** depth) * 100)}%` }
    case 'cohesion':
      return { label: 'ENTROPY', value: `-${Math.round((1 - 0.9 ** depth) * 100)}%` }
    case 'cloud':
      return { label: 'DEVELOPER CAP', value: `+${Math.round(0.15 * depth * 100)}%` }
    case 'support':
      return { label: 'TICKET HEADS', value: `+${depth.toFixed(depth % 1 === 0 ? 0 : 1)}` }
    default:
      return { label: 'VELOCITY', value: `+${Math.round(0.03 * depth * 100)}%` }
  }
}

export function HeroCard({
  hero,
  placedLabel,
  onClose,
  onOpenTree,
}: {
  hero: HeroRuntime | null
  /** Where they are, in words. §13.11.2 — `BENCHED` is the only red word here. */
  placedLabel: string
  onClose: () => void
  onOpenTree: () => void
}) {
  const face = hero ? heroIdentity(hero.id) : null
  const branch = hero ? BRANCH_BY_ID.get(hero.branch) : null
  const headline = hero ? headlineFor(hero) : null
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

  return (
    <Panel open={hero !== null} from="right" className="herocard">
      {hero && face && branch && headline && (
        <div className="herocard__pass" style={{ ['--branch' as string]: branchColour(hero.branch) }}>
          {/* The only round thing on the card, and what makes it a pass. */}
          <span className="herocard__punch" aria-hidden="true" />

          <header className="herocard__band">
            <span className="herocard__sigil" aria-hidden="true" />
            <h2 className="herocard__name">{face.name}</h2>
            <span className="herocard__level">
              LV {hero.progress.level}
              {hero.points > 0 && (
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
              <div><dt>COVERS</dt><dd>{hero.reachDevs.toLocaleString()}</dd></div>
              <div><dt>PLACED</dt><dd data-benched={placedLabel === 'BENCHED' ? 'true' : 'false'}>{placedLabel}</dd></div>
              <div className="herocard__headline"><dt>{headline.label}</dt><dd>{headline.value}</dd></div>
            </dl>
          </div>

          {/* §13.13's progress toward the next level. The bar is the only place
              XP appears at all: it is never spent, so it is never a figure. */}
          <div className="herocard__xp" aria-hidden="true">
            <span className="herocard__xp-fill" style={{ width: `${Math.round(hero.progress.fraction * 100)}%` }} />
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

          <div className="herocard__actions">
            <Button onClick={onOpenTree}>
              {hero.points > 0 ? `SPEND ${hero.points}` : 'SKILLS'}
            </Button>
            <Button onClick={onClose}>CLOSE</Button>
          </div>
        </div>
      )}
    </Panel>
  )
}
