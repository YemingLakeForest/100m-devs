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
 *
 * ## Name tabs, a trait band, and what you own [2026-10-20]
 *
 * After Lonestar's pilot cards, for *"the general Studio OS UI"*. The ← → pager
 * said `2 / 4` in the smallest type on the card while its two buttons were the
 * largest things on it; it is a row of name tabs now, each with the person's
 * face and how many of their nodes the player could buy, and the open one is
 * the filled one. The trait — the one thing that makes a hero a hero — was
 * small cyan type squeezed in at the right; it is a band headed in the branch
 * colour, the loudest thing on the pass. And the nodes bought this run are a
 * row of chips under it, so the pass grows as the player spends.
 *
 * ## What they are, then who; warm for yours, cool for coming [2026-10-21]
 *
 * After Lonestar's pilot-selection screen (*"What lessons can we learn here?"*,
 * then *"Do these changes"*). The epithet sits above the name; the trait is an
 * amber ALWAYS band with its live rows inside it; the breakthroughs are locked
 * slots that print what stands in the way; and a STAFF tab lays every pass side
 * by side (`StaffDirectory.tsx`). The bands are `PassBands.tsx`, shared with the
 * offer letter an arrival ends on (§22.9.4).
 */

import { useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'
import type { GameState } from '../game/store.ts'
import { BRANCH_BY_ID } from '../sim/heroBranches.ts'
import { treeLevelOf } from '../game/store.ts'
import { TREES } from '../sim/upgradeTrees.ts'
import { heroIdentity } from '../sim/identity.ts'
import { STORY_HEROES } from '../sim/storyHeroes.ts'
import type { HeroRuntime } from '../sim/heroRoster.ts'
import type { TreeHero } from '../sim/upgradeTrees.ts'
import { HeroFace } from './HeroFace.tsx'
import { breakthroughsOf, heroDuty } from './heroCardModel.ts'
import { AlwaysBand, BreakthroughSlots } from './PassBands.tsx'
import { StaffDirectory } from './StaffDirectory.tsx'
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
  people = [],
  counts = {},
  onClose,
  onPick,
  onFounder,
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
  /** Everybody who has arrived, in the order the tabs show them. */
  people?: readonly HeroRuntime[]
  /** Nodes the player could buy right now, per tree — the number on each tab. */
  counts?: Readonly<Record<string, number>>
  onClose: () => void
  /** Open somebody else's card. */
  onPick?: (id: HeroRuntime['id']) => void
  /** The founder's tab, once the trees are open: your own pass is a window of its own. */
  onFounder?: () => void
}) {
  const face = hero ? heroIdentity(hero.id) : null
  const branch = hero ? BRANCH_BY_ID.get(hero.branch) : null
  const duty = hero ? heroDuty(hero, state.devs) : []
  const showTree = hero !== null && tree !== null && treesOpen
  // §8 — what this person's tree has had bought this run, in the order the tree lists it.
  const owned = tree && treesOpen
    ? TREES[tree].filter((n) => n.kind !== 'root' && n.kind !== 'link').map((n) => ({ node: n, level: treeLevelOf(tree, n.id, state) })).filter((o) => o.level > 0)
    : []
  const keys = tree ? breakthroughsOf(tree, state, treesOpen) : []
  /**
   * The STAFF tab [2026-10-21] — everybody's pass at once, band for band, so
   * four people compare row by row. It lives in this window and every pass in
   * it opens that person's card, so §22.9.3's "the card is the hero screen"
   * still holds in the sense that matters: nothing is managed from here.
   */
  const [directory, setDirectory] = useState(false)

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
      meta={showTree && !directory ? <span className="trees__cash">{formatMoney(state.cash)}</span> : undefined}
      onClose={() => {
        setDirectory(false)
        onClose()
      }}
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
            {(people.length > 1 || onFounder) && (
              <div className="herocard__people" role="tablist" aria-label="People">
                {people.length > 1 && (
                  <Button
                    className={directory ? 'herocard__tab is-chosen' : 'herocard__tab'}
                    role="tab"
                    aria-selected={directory}
                    onClick={() => setDirectory(true)}
                  >
                    STAFF
                  </Button>
                )}
                {onFounder && (
                  <Button className="herocard__tab" role="tab" aria-selected={false} onClick={onFounder}>
                    YOU
                    {counts.you ? <small className="herocard__tab-count">{counts.you}</small> : null}
                  </Button>
                )}
                {people.map((p) => {
                  const who = heroIdentity(p.id)
                  if (!who) return null
                  const on = !directory && p.id === hero.id
                  const n = counts[p.id] ?? 0
                  return (
                    <Button
                      key={p.id}
                      className={on ? 'herocard__tab is-chosen' : 'herocard__tab'}
                      role="tab"
                      aria-selected={on}
                      style={{ ['--branch' as string]: p.colour }}
                      onClick={() => {
                        setDirectory(false)
                        onPick?.(p.id)
                      }}
                    >
                      <HeroFace look={who.look} id={p.id} shot="head" className="herocard__tab-face" />
                      {who.name.toUpperCase()}
                      {n > 0 ? <small className="herocard__tab-count">{n}</small> : null}
                    </Button>
                  )
                })}
              </div>
            )}
            {!directory && <div className="herocard__pass herocard__pass--hero">
              {/* The only round thing on the card, and what makes it a pass. */}
              <span className="herocard__punch" aria-hidden="true" />

              {/* The face, square: a head-and-shoulders on the branch's colour. */}
              <HeroFace look={face.look} id={hero.id} shot="head" className="herocard__portrait" />

              {/*
                [2026-10-21] **What they are, then who.** Lonestar's pilot reads
                "Repair Master / Dongdong": the job is learned before the name, so
                the name sticks to the job. The branch chip and the number move up
                to an eyebrow, and the voice line sits under the name, where a
                pilot's blurb sits, rather than in the trait's box.
              */}
              <header className="herocard__band">
                <p className="herocard__tags">
                  <span className="herocard__branch">{branch.name.toUpperCase()}</span>
                  <span className="herocard__employee">
                    {employeeNumber(hero.id)}
                    <span className="herocard__gem" aria-hidden="true" />
                  </span>
                </p>
                <p className="herocard__epithet">{hero.hero.epithet}</p>
                <h2 className="herocard__name">{face.name}</h2>
                {/* §21.7.4 - the title only ever grows, and when it no longer fits
                    it wraps. It is never truncated. */}
                {hero.hero.role.toUpperCase() !== branch.name.toUpperCase() && (
                  <p className="herocard__role">{hero.hero.role}</p>
                )}
                <p className="herocard__flavour">&ldquo;{hero.hero.flavour}&rdquo;</p>
              </header>

              {/*
                §22.9.2 - the abilities box: TRAIT only, and the only thing on this
                card written in sentences. The live rows are the trait measured, so
                they are printed inside it now rather than in a column of their own.
              */}
              <AlwaysBand trait={hero.hero.trait}>
                {duty.length > 0 && (
                  <dl className="herocard__facts">
                    {duty.map((row) => (
                      <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
                    ))}
                  </dl>
                )}
              </AlwaysBand>

              <BreakthroughSlots items={keys} />
            </div>}
            {!directory && owned.length > 0 && (
              <div className="herocard__owned" aria-label="Owned this run">
                <span className="herocard__owned-label">OWNED THIS RUN</span>
                {owned.map(({ node, level }) => (
                  <span key={node.id} className="herocard__chip">
                    {node.name}
                    {node.max > 1 && <b>{node.repeat ? ` ${level}` : ` ${level}/${node.max}`}</b>}
                  </span>
                ))}
              </div>
            )}
          </div>

          <section className="herocard__tree" aria-label={directory ? 'Staff directory' : `${face.name}'s upgrades`}>
            {directory ? (
              <StaffDirectory
                people={people}
                state={state}
                treesOpen={treesOpen}
                counts={counts}
                onOpen={(id) => {
                  setDirectory(false)
                  onPick?.(id)
                }}
              />
            ) : showTree ? (
              <TreePane open state={state} hero={tree} intro={intro} />
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
