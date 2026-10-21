import type { GameState } from '../game/store.ts'
import { BRANCH_BY_ID } from '../sim/heroBranches.ts'
import { heroIdentity } from '../sim/identity.ts'
import type { HeroRuntime } from '../sim/heroRoster.ts'
import { TREE_HEROES, type TreeHero } from '../sim/upgradeTrees.ts'
import { Button } from '../ui/Button.tsx'
import { HeroFace } from './HeroFace.tsx'
import { breakthroughsOf, heroDuty } from './heroCardModel.ts'
import { AlwaysBand, BreakthroughSlots } from './PassBands.tsx'

/**
 * PERSONNEL's STAFF tab — everybody's pass side by side [2026-10-21, GDD §22.9.3
 * amended].
 *
 * Lonestar lays three pilots out with identical anatomy — portrait, title, tag,
 * blurb, fixed talent, locked slots, Select — every band at the same height, so
 * the eye compares them across rather than reading each one down. This is that,
 * for the people who have arrived: a subgrid holds each band on one row for every
 * card, so a band one person lacks shows as a gap in the row rather than
 * shuffling the rest up.
 *
 * It is a view and not a board. §13.6.7 forbids managing heroes on a grid, and
 * nothing here can be changed: the one verb is opening somebody's own card.
 */
export function StaffDirectory({
  people,
  state,
  treesOpen,
  counts,
  onOpen,
}: {
  people: readonly HeroRuntime[]
  state: GameState
  treesOpen: boolean
  counts: Readonly<Record<string, number>>
  onOpen: (id: HeroRuntime['id']) => void
}) {
  return (
    <div className="staffdir" style={{ ['--staff' as string]: people.length }}>
      {people.map((p) => {
        const who = heroIdentity(p.id)
        const branch = BRANCH_BY_ID.get(p.branch)
        if (!who || !branch) return null
        const tree = (TREE_HEROES as readonly string[]).includes(p.id) ? (p.id as TreeHero) : null
        const n = counts[p.id] ?? 0
        return (
          <article key={p.id} className="staffdir__card" style={{ ['--branch' as string]: p.colour }}>
            {/*
              The portrait is the row that takes the spare height [2026-10-21]:
              *"make it a rule to avoid those gaps on the ui"*. A window taller than
              the words gets a bigger face, never a bare strip under the cards.
            */}
            <div className="staffdir__photo">
              <HeroFace look={who.look} id={p.id} shot="head" className="staffdir__face" />
            </div>
            <header className="staffdir__who">
              <p className="staffdir__epithet">{p.hero.epithet}</p>
              <h3 className="staffdir__name">{who.name}</h3>
              <p className="staffdir__tag">{branch.name.toUpperCase()}</p>
            </header>
            <p className="staffdir__quote">&ldquo;{p.hero.flavour}&rdquo;</p>
            <AlwaysBand trait={p.hero.trait}>
              <dl className="herocard__facts">
                {/* Two at most, one line: a subgrid row is as tall as its tallest
                    card, and Matt's four would hollow the other bands. All four
                    are on his own pass. */}
                {heroDuty(p, state.devs).slice(0, 2).map((row) => (
                  <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
                ))}
              </dl>
            </AlwaysBand>
            <div className="staffdir__coming">
              {tree && <BreakthroughSlots items={breakthroughsOf(tree, state, treesOpen)} />}
            </div>
            <div className="staffdir__foot">
              <Button className="staffdir__open" aria-label={`Open ${who.name}'s card`} onClick={() => onOpen(p.id)}>
                OPEN
              </Button>
              {treesOpen && tree && n > 0 && (
                <span className="staffdir__buy">
                  {n}
                  <span className="staffdir__buy-word"> TO BUY</span>
                </span>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
