import { useEffect, useState, type CSSProperties } from 'react'
import { applyEntropyTheme, entropyTheme } from '../art/entropyTheme.ts'
import {

  acceptMassHire,
  acknowledgeEvent,
  canMassHire,
  clearEventByHand,
  collectOffline,
  currentEvent,
  currentMassHireCost,
  currentUnlocks,
  hasPrestiged,
  currentEntropy,
  dismissScene,
  getPermanent,
  grantJames,
  hasSeenScene,
  heroById,
  heroCoverageOf,
  heroRoster,
  hireDeveloper,
  hireGrowthNow,
  hireQuote,
  massHire,
  selectHero,
  setHireMultiplier,
  setHireRole,
  takeSeedRound,
  triggerParadigmShift,
  type GameState,
} from '../game/store.ts'
import { MASS_HIRE_COUNT, PHASE_COPY } from '../game/onboarding.ts'
import type { StageHandle } from '../render/stage.ts'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import { Typewriter } from '../ui/Typewriter.tsx'
import { BurnDown } from './BurnDown.tsx'
import { RevenueGraph } from './RevenueGraph.tsx'
import { ShipToast } from './ShipToast.tsx'
import { TouchSwitch } from './TouchSwitch.tsx'
import { FounderDesk, FounderProfilePanel } from './Founder.tsx'
import { DevCard } from './DevCard.tsx'
import { HeroCard } from './HeroCard.tsx'
import { HeroTree } from './HeroTree.tsx'
import { Roster } from './Roster.tsx'
import type { HeroRuntime } from '../sim/heroRoster.ts'
import { unitLabel } from '../sim/units.ts'
import { HireDial } from './HireDial.tsx'
import { Cash, Devs, Shipped, Speedometer, Velocity } from './Readouts.tsx'
import { DialoguePreview } from './DialoguePreview.tsx'
import { Defects, Incidents, Tickets } from './Backlogs.tsx'
import { countsOf, type Role } from '../sim/roles.ts'
import { OvernightReport } from './OvernightReport.tsx'
import { OvernightPreview } from './OvernightPreview.tsx'
import { Dialogue } from '../ui/Dialogue.tsx'
import {
  SCENES,
  SCENE_JAMES_ARRIVES,
  SCENE_MASS_HIRE,
  JAMES_DROPS_AT_LINE,
  MASS_HIRE_AT_LINE,
} from '../game/scenes.ts'
import { shouldShowReport } from './overnightModel.ts'
import { UpgradeBoard } from './UpgradeBoard.tsx'
import { EventBanner, EventCard } from './EventCard.tsx'
import { Gallery } from './Gallery.tsx'
import { ParadigmTree } from './ParadigmTree.tsx'
import { actionFor, formatMoney, offerFor, type ActionSpec } from './hudModel.ts'
import { useGameState } from './useGameState.ts'
import { ConceptText } from '../ui/ConceptText.tsx'
import { Options } from '../title/Options.tsx'
import {
  DURATION,
  motionMs,
  useReducedMotion,
} from '../ui/motion.ts'

/**
 * Dev-only §10.7 preview — `?dialogue`. Read once, at module load, for the
 * same reason App.tsx reads `?act` there: a query string cannot change
 * mid-session, and re-parsing it every render would be work done 60 times a
 * second to reach the same answer.
 */
/**
 * `?ad` pretends a rewarded ad is filled, so §24.8's 2x path can be seen and
 * §10.8-gated before AdMob is wired.
 *
 * Without it the button is correctly *absent* — no ad network means no fill —
 * which is the right shipping behaviour and completely untestable by eye.
 */
const FAKE_AD_READY =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('ad')

const PREVIEW_OVERNIGHT =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('overnight')
const PREVIEW_OVERNIGHT_CAPPED =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('overnight') === 'capped'

const PREVIEW_DIALOGUE =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('dialogue')

/**
 * §4.11 — which jobs the studio has a reason to hire for yet.
 *
 * **Roles arrive when the problem does, never on a headcount.** §4.11's joke —
 * that a studio stops being one kind of person — only lands once the player has
 * been given something to protect, and each of the three support functions has
 * a moment where the player is looking straight at the thing it fixes:
 *
 * | Role | Appears when |
 * |---|---|
 * | **QA** | The defect counter is on screen, which is the first time §4.15 shows one |
 * | **Support** | Something has shipped, so there is a back catalogue to answer for |
 * | **SRE** | A game is actually down |
 *
 * Each row of the dial therefore arrives beside the readout that explains it,
 * and the player never chooses between four jobs they have no information
 * about. Once earned a role stays — a studio that has cleared its incidents has
 * not forgotten how to hire SRE.
 *
 * §21.0c puts a floor under all three: **none of them exists during Run 1.** The
 * conditions above are about *when within a run*, and they were doing their job
 * — a defect really was on screen, something really had shipped. What they could
 * not know is that the run in question was the one whose entire argument is that
 * there is a single lever. `HireDial` renders no row at all for one role, so
 * Act I's control is exactly the button it has always been.
 */
function rolesAvailable(state: GameState): Role[] {
  const roles: Role[] = ['dev']
  // §21.7.6 — **a role arrives with the instrument that makes it legible.**
  // The in-run conditions below were doing real work and they still are: they
  // ask *when within a run* the problem has appeared. What they could not know
  // is who the player would hire against. Offering QA before there is a defect
  // readout asks somebody to buy a fix for a problem the game has not shown
  // them — so each row now needs both its condition and its hero.
  const unlocks = currentUnlocks()
  if (unlocks.roles.qa && state.defects >= 1) roles.push('qa')
  if (unlocks.roles.support && state.projectsShipped > 0) roles.push('support')
  if (unlocks.roles.sre && (state.incidents.length > 0 || countsOf(state.roster).sre > 0)) {
    roles.push('sre')
  }
  return roles
}

/**
 * The HUD — GDD §7.1, §10.1, §23.4.2, and the §21 script.
 *
 * **The frame is landscape and the layout is anchored to its edges.** §23.4.2
 * is the constraint that shapes everything below: phone landscape runs from
 * 1.78:1 to 2.4:1, the 2:1 isometric floor fits to *height* and therefore
 * leaves margin at the sides on anything wider than 2:1, and that margin is
 * where the HUD lives. So the frame is two fixed-width rails pinned to the left
 * and right edges with the simulation breathing between them: as the device
 * gets wider the rails stay put and the gap grows, which is the behaviour
 * "anchor to edges, never to fractions of the width" is asking for. The
 * previous layout stacked seven full-width rows and folded in on itself the
 * moment the frame was shorter than it was tall.
 *
 * The UI is a Layer (§7.1): overlayed, semi-transparent, contextual, and
 * `pointer-events: none` except on real controls, because the simulation behind
 * it must stay pokeable straight through the overlay. Nothing here is opaque
 * and nothing here is a window box.
 *
 * Per ART_DIRECTION §1.0a this layer is a second pane of glass in front of the
 * tube rather than phosphor burned into it — it does not pass through the Pixi
 * post-process, and it is held together by the palette and the type system
 * instead.
 */
/**
 * §13.11.2 — where a hero is, in words.
 *
 * `BENCHED` is the only word on the card allowed to be red, because §13.10
 * makes it the one that is actively costing the player something: an unplaced
 * hero earns no XP, so a board left alone falls behind a board that is tended.
 * §7.8.12 gives the word a place to be — they are at their desk in the suite,
 * visibly doing nothing while the floor works.
 */
function heroPlacedLabel(hero: HeroRuntime | null, state: GameState): string {
  if (!hero?.placement) return 'BENCHED'
  const cov = heroCoverageOf(hero, state)
  if (cov.settling) return 'WALKING'
  return `${unitLabel(hero.placement.rung).toUpperCase()} ${hero.placement.index + 1}`
}

export function Hud({ stage, onMainMenu }: { stage: StageHandle | null; onMainMenu?: () => void }) {
  const state = useGameState()
  // §10.7a.3 — the script block rides the same motion budget as the panels it
  // hides for, resolved once per render like Panel resolves it.
  const reduced = useReducedMotion()
  // §13.2's tree and §11's tree are two doors, and they now hang off one bar.
  const [treeOpen, setTreeOpen] = useState(false)
  const [upgradesOpen, setUpgradesOpen] = useState(false)
  const [founderOpen, setFounderOpen] = useState(false)
  const [gameMenuOpen, setGameMenuOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [heroTreeOpen, setHeroTreeOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const roster = heroRoster(state)
  // Resolved once per render: `heroById` rebuilds from `meta` and the run, so
  // asking twice in one frame would build the same six objects twice.
  const openHero = state.selectedHero === null ? null : heroById(state.selectedHero, state)
  const entropy = currentEntropy(state)
  const theme = entropyTheme(entropy)
  const copy = PHASE_COPY[state.phase]
  // §18.0 — whatever is happening, resolved once per render like `unlocks`.
  const event = currentEvent(state)
  // §21.0c — read once and passed down, so every gate in this frame agrees
  // about the same run rather than each asking separately.
  const unlocks = currentUnlocks()

  // §10.11 — the gallery is where a career acquires a history, so its door opens
  // with the first ship and stays open: it is a view onto memory, not a lever,
  // and §10.11.5 is explicit that it must never become one.
  const history = getPermanent().meta.history
  const hasGallery = history.recent.length > 0 || history.aggregates.length > 0

  // The interface hue is a direct function of Entropy — ART_DIRECTION §1.1.
  // Written to the document root so the CSS token cascade carries it to every
  // element at once, rather than each component subscribing to entropy itself.
  //
  // Driven by the true entropy rather than by the speedometer's sprung value:
  // colour is allowed to lead the number, and it should — the frame going amber
  // before the readout has finished climbing is the situation announcing itself.
  useEffect(() => {
    applyEntropyTheme(theme, document.documentElement)
  }, [theme])

  /**
   * §18.0a — the intended exit, which is a *route* and not a resolution.
   *
   * The event stays live: what ends it is the purchase, and `buyTech` is where
   * that is wired (trap 33 — a rule wired to the interface is a lie the
   * interface tells confidently). All this does is put the board in front of
   * the player and stand the modal down to a banner.
   */
  const openBoardForEvent = () => {
    acknowledgeEvent()
    setTreeOpen(false)
    setFounderOpen(false)
    setGameMenuOpen(false)
    setGalleryOpen(false)
    setUpgradesOpen(true)
  }

  /**
   * §18.0 — one reply, by hand, from either surface.
   *
   * The first tap also stands the modal down, so a player who chooses this exit
   * spends their remaining nineteen taps on a banner with the studio visible
   * behind it rather than on a scrim. Nineteen taps against a dimmed floor
   * would be a minigame, and §26.3.3 owns those.
   */
  const replyToEvent = () => {
    acknowledgeEvent()
    clearEventByHand()
  }

  useEffect(() => {
    if (!stage) return
    stage.setFounderInspect(() => {
      setUpgradesOpen(false)
      setTreeOpen(false)
      setFounderOpen(true)
    })
    return () => stage.setFounderInspect(null)
  }, [stage])

  return (
    <div className="hud">
      {/*
        The left rail — **one column, not two grid rows.**

        §10.1 puts the project at the top and the gauges under it, and the
        previous frame expressed that as two grid areas: project in an `auto`
        row anchored to the top, gauges in a `1fr` row anchored to the bottom.
        On a phone that is *332 CSS pixels tall* the 1fr row is shorter than the
        gauges are, and a block anchored to the end of a row it does not fit
        overflows upward — straight through the revenue graph above it. It was
        reported from a handset and it reproduces exactly at 748x336.

        Stacked in one flow the two can no longer be laid on top of each other
        by any frame size, because that is not something a column does. The
        gauges keep their pin to the bottom (`margin-top: auto`), so on a frame
        with room to spare the composition is the one §10.1 asks for.
      */}
      <div className="hud__left">
        {/* Top-left — §10.1's Active Project, "a descending line, not a filling bar". */}
        <div className="hud__project">
          <BurnDown state={state} />
          {/*
            §4.10e — the back catalogue, under the burn-down that will join it.
            Directly under on purpose: the two charts are the same story told at
            two ends, work going down and money coming in, and the whole reason
            the revenue graph exists is that a player watching only the first one
            concluded they were failing.
          */}
          <RevenueGraph state={state} />
          {/*
            §4.15 — the defect counter sits with the burn-down because it is a
            tax on that number: the two are the same project measured by what is
            finished and by what is broken. It is hidden at zero, so it appearing
            is itself the notification.

            §21.0c gates the whole family here rather than inside each component.
            The simulation already holds all three at zero during Run 1, so this
            is belt and braces — and it is the braces that matter: a component
            that renders nothing because its number happens to be zero is one
            balance change away from rendering something.
          */}
          {/*
            §4.15 — **all three backlogs, together, in one column.**

            They shipped split across the two rails: defects here with the
            burn-down, incidents and tickets over on the right under SHIPPED, on
            the reasoning that the last two are facts about the *catalogue*. That
            reasoning is sound and it lost to two better ones.

            The first is §4.15's own thesis. The section exists because three
            numbers that all go up and all mean "something is wrong" are three
            copies of one anxiety unless the player can tell them apart — and the
            way it proposes to do that is three colours and three shapes read as
            a set. Split across sixty degrees of arc, they are not a set.

            The second is that the right rail did not have the room and nothing
            said so. Measured at 997x448 in Act III with a full catalogue, its
            stack came to 649 px against 426 of frame: the hire button was cut
            off mid-word and the touch switch, the §23.3 overlay, your own desk
            and §10.1's whole nav were drawn below the bottom of the screen. This
            is the hundred pixels that buys most of it back, and it is the one
            move that improves the composition rather than merely relieving it.
          */}
          {/*
            §21.7.6b — **the set assembles itself, one colour at a time.** §4.15's
            argument that the three are one system told three ways is unchanged
            and §25.7.2a's single column is what makes them readable as a set;
            what has gone is their arriving *together*. Each bar appears when its
            hero does — defects with Mo, incidents with Serena, tickets with Matt
            — over the run §13.12.2 gives them.

            A bar with no hero is not drawn at all, empty or otherwise, on this
            section's own rule that a silent row is the loudest kind of
            furniture. Reserving the space would be the set asserted before it
            exists.
          */}
          {unlocks.defects && <Defects state={state} />}
          {unlocks.incidents && <Incidents state={state} />}
          {unlocks.tickets && <Tickets state={state} />}
        </div>

        {/* Mid-left — §10.1 puts the speedometer here and velocity directly under it. */}
        <div className="hud__gauges">
          <Speedometer entropy={entropy} />
          <Velocity state={state} />
          {/*
            §23.3's overlay, at the foot of the reading rail.
            **Instrumentation is not a control.** It sat among the play tools in
            the right rail, where it competed with the thumb for the fourteen
            pixels that were costing §10.1's nav its place on the frame. Nothing
            about the gate cares which corner it is in, and everything about the
            right rail cares that it is not there.
          */}
          <PerfOverlay stage={stage} />
          {/*
            §10.1's MENU — moved to the foot of the left rail. The right rail's
            nav is the thumb's rail, all verbs; the menu is a place the player
            goes to leave, so it belongs on the reading side, out of the action
            stack.
          */}
          <Button
            className="hud__menu"
            onClick={() => {
              setTreeOpen(false)
              setFounderOpen(false)
              setUpgradesOpen(false)
              setGameMenuOpen(true)
            }}
          >
            MENU
          </Button>
        </div>
      </div>

      <Bubble text={state.bubble?.text ?? null} />

      {/*
        The right rail, and the same fix for the same defect: the resource
        blocks were in the top row and the action bar in the middle one, and at
        336 px the HIRE DEVELOPER button was drawn straight over the SHIPPED
        readout. One column, button pinned to the bottom.
      */}
      <div className="hud__right">
        {/* Top-right — §10.1's resource bar, turned on its side to use the margin. */}
        <div className="hud__resources">
          <Cash state={state} />
          <Devs state={state} />
          <Shipped state={state} />
        </div>
        <div className="hud__bottom">
          <ActionBar
            spec={actionFor(state.phase)}
            offer={offerFor(state.phase, state.massHired)}
            state={state}
          />

          {/* The play tools stay pinned to the bottom. New hire actions stack
              immediately above them instead of moving the tools around. */}
          <div className="hud__controls">
          {/*
            §7.7.6b — what the finger does, above the nav and under the button,
            because it is the control the thumb reaches for *between* pokes
            rather than once a session.
          */}
          <TouchSwitch state={state} />
          {/*
            §4.5d — your own desk, reachable at every zoom. A direct child of the
            column, like PARADIGM, because the 336 px media query below places
            both by hand: the rail's rows were measured at every frame in
            §23.4's design box and "a new control does not get to evict canon".
          */}
          <FounderDesk stage={stage} />
          {/*
            §13.11.2 — the roster strip's summon control.

            **Gated on there being more than one of them**, which is not a
            cosmetic condition: James arrives alone in Act I and a `TEAM` button
            over a team of one is the §10.6 web-page tell, on exactly the
            argument PARADIGM and UPGRADES below already use. It appears the
            first time somebody joins him.

            This is the interim door and it is marked as one — §7.8.12's suite is
            where a player is meant to reach these people, by looking at them.
            The strip answers "who is idle?", which the world cannot, and
            survives; the button is doing double duty until the room exists.
          */}
          {roster.length > 1 && (
            <Button onClick={() => setRosterOpen((was) => !was)}>TEAM</Button>
          )}
          {/*
            §13.2 — the tree appears only once a Paradigm Shift has happened.
            Before the first one BP does not exist, and a permanently visible
            button onto an empty currency would be the §10.6 web-page tell.
          */}
          {hasPrestiged() && (
            <Button onClick={() => setTreeOpen((was) => !was)}>PARADIGM</Button>
          )}
          {/* §10.1's UPGRADES nav. The founder's personal Management tree now
              opens from their world avatar; this remains the studio tree.

              §21.0c — and the door is shut for the whole of Run 1, on the same
              argument §13.2's PARADIGM button above it has always used: a
              permanently visible button onto a tree the player cannot buy from
              is the §10.6 web-page tell. It is worse than that here, because the
              tree is not empty but *forbidden* — Run 1's whole argument is that
              there is one lever, and an upgrade screen is the game promising a
              way to make the trap survivable. */}
          {unlocks.upgrades && (
            <div className="hud__nav">
              <Button
                onClick={() => {
                  setTreeOpen(false)
                  setFounderOpen(false)
                  setGameMenuOpen(false)
                  setUpgradesOpen((was) => !was)
                }}
                concept="upgrades"
              >
                UPGRADES
              </Button>
            </div>
          )}
          {/* §10.11 — the gallery door, beside UPGRADES. Not gated on the tech
              tree: it is a record of what shipped, and it opens the moment there
              is a record to show, Run 1 included. */}
          {hasGallery && (
            <div className="hud__nav">
              <Button
                onClick={() => {
                  setTreeOpen(false)
                  setFounderOpen(false)
                  setGameMenuOpen(false)
                  setUpgradesOpen(false)
                  setGalleryOpen((was) => !was)
                }}
              >
                GALLERY
              </Button>
            </div>
          )}
          </div>
        </div>
      </div>

      <ShipToast state={state} />
      <DevCard state={state} />

      {/*
        §22.9 and §13.9 — the card, and the board it opens.

        **No new HUD button, and that is canon rather than thrift.** §13.6.6
        forbids a management screen and §13.6.7 says that if the player is
        managing heroes on a grid instead of in the world, the entire reason for
        the design has been thrown away. The door is a person: tap James at his
        desk (§7.8.13 rule 3), or a hero in §7.8.12's suite. It also happens to
        cost zero rail pixels, which §10.1a has none of.
      */}
      <HeroCard
        hero={openHero}
        placedLabel={heroPlacedLabel(openHero, state)}
        onClose={() => selectHero(null)}
        onOpenTree={() => setHeroTreeOpen(true)}
      />
      <HeroTree hero={openHero} open={heroTreeOpen && openHero !== null} onClose={() => setHeroTreeOpen(false)} />
      <Roster
        open={rosterOpen && openHero === null}
        roster={roster}
        labelFor={(hero) => heroPlacedLabel(hero, state)}
        showPoints={unlocks.heroBoard}
        onOpen={(hero) => selectHero(hero.id)}
        onClose={() => setRosterOpen(false)}
      />

      <div
        className="hud__script"
        data-phase={state.scene ? 'exit' : 'in'}
        style={
          {
            '--ui-in': `${motionMs(DURATION.panelIn, reduced)}ms`,
            '--ui-out': `${motionMs(DURATION.panelOut, reduced)}ms`,
          } as CSSProperties
        }
      >
        {/*
          The banner types itself in rather than appearing. A phase change that
          swaps one block of terminal text for another with no motion between
          them is F1 by the letter — and a terminal that types is the register
          the whole product is written in anyway (§10.7).

          §10.7a.3 — and while a conversation is up the script leaves the rail
          the way a panel does (same keyframes, same `data-phase` contract) and
          comes back the same way. It is **not** unmounted — the copy is text
          on the rail, not a panel, and unmounting it would restart the
          typewriter and make the advisor re-read its line after every scene.
        */}
        {copy.terminal && (
          <pre className="hud__terminal">
            <Typewriter text={copy.terminal.join('\n')} />
          </pre>
        )}
        {copy.advisor && (
          <p className="hud__advisor">
            {/* The advisor is a character, so its letters land with a tick
                (§10.7). The banner above is machine output and stays silent —
                two typewriters ticking at once is a buzz, not a voice. */}
            <Typewriter text={copy.advisor} sound />
          </p>
        )}
        {/*
          §18.0 — a live event, once the player has decided how to deal with it.

          In this band and not in a rail: §10.1a says both are full, trap 26
          says a control does not belong in a column of readings, and an event
          is temporary — furniture is exactly what it must not become. It leaves
          with the script while a scene is up and comes back the same way, on
          the `data-phase` contract the block already owns.
        */}
        <EventBanner event={event} onRoute={openBoardForEvent} onReply={replyToEvent} />
      </div>

      {/*
        §18.0a — the modal, before the player has chosen an exit. Rendered
        beside the panels rather than inside the rail: it is a scrim over the
        whole frame, because the studio has genuinely stopped.
      */}
      <EventCard event={event} onRoute={openBoardForEvent} onReply={replyToEvent} />

      <UpgradeBoard open={upgradesOpen} onClose={() => setUpgradesOpen(false)} />
      <Gallery open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      <ParadigmTree open={treeOpen} state={state} onClose={() => setTreeOpen(false)} />
      <FounderProfilePanel open={founderOpen} onClose={() => setFounderOpen(false)} />
      <GameMenu
        open={gameMenuOpen}
        onResume={() => setGameMenuOpen(false)}
        onMainMenu={() => {
          setGameMenuOpen(false)
          onMainMenu?.()
        }}
      />

      <Bankruptcy open={state.phase === 'bankrupt'} />
      {/*
        §24.8 — before the swarm, before the rest of the HUD. `collectOffline`
        clears `pendingOffline`, so this unmounts on collect and the Panel
        plays its exit rather than vanishing.
      */}
      {shouldShowReport(state.pendingOffline) && (
        <OvernightReport
          report={state.pendingOffline}
          // Hard false until game-monetise is wired. §24.8 says an unfilled
          // slot means the button is absent, so this is the correct shipping
          // value rather than a placeholder that flatters the screenshot.
          adReady={FAKE_AD_READY}
          onCollect={collectOffline}
        />
      )}

      {/*
        §21.6 and its ladder. Rendered above the HUD and below nothing: while a
        scene is up the poke path is inert (see `poke` in the store), so the
        box is the only thing taking taps.
      */}
      {state.scene && SCENES[state.scene] && (
        <Dialogue
          key={state.scene}
          script={SCENES[state.scene].script}
          seen={hasSeenScene(state.scene)}
          onFinished={dismissScene}
          onFocus={(focus) => stage?.focusDialogue(focus)}
          onLine={(line) => {
            // §21.7.1 — "APPLICANT AT DOOR." holds, then James drops in and the
            // lens follows his `Ouch.`. The next line is the founder's, and its
            // focus brings the lens back — so the drop itself needs nothing here
            // beyond granting him.
            if (state.scene === SCENE_JAMES_ARRIVES.id && line >= JAMES_DROPS_AT_LINE) {
              grantJames()
            }
            // §21.0d — and the trap. The tap that turns this page is the tap
            // that hires a thousand people; there is no button on the beat and
            // §10.7 rule 3 means there is no skip, which is what makes it
            // unavoidable rather than merely tempting.
            if (state.scene === SCENE_MASS_HIRE.id && line >= MASS_HIRE_AT_LINE) {
              acceptMassHire()
            }
          }}
        />
      )}

      {PREVIEW_OVERNIGHT && (
        <OvernightPreview capped={PREVIEW_OVERNIGHT_CAPPED} adReady={FAKE_AD_READY} />
      )}

      {PREVIEW_DIALOGUE && <DialoguePreview />}
    </div>
  )
}

function GameMenu({
  open,
  onResume,
  onMainMenu,
}: {
  open: boolean
  onResume: () => void
  onMainMenu: () => void
}) {
  return (
    <Panel open={open} modal from="centre" className="game-menu">
      <h2>GAME MENU</h2>
      <p>Your studio keeps working while this menu is open.</p>
      <div className="game-menu__options">
        <Options />
      </div>
      <div className="game-menu__actions">
        <Button onClick={onResume}>RESUME</Button>
        <Button onClick={onMainMenu}>MAIN SCREEN</Button>
      </div>
    </Panel>
  )
}

/** The store verbs this layer is allowed to call, by `ActionSpec.action`. */
const RUN_ACTIONS: Record<ActionSpec['action'], () => void> = {
  hire: hireDeveloper,
  massHire,
  paradigmShift: triggerParadigmShift,
  takeSeed: takeSeedRound,
}

/** What an action costs right now, or null if it is free. */
function priceOf(spec: ActionSpec | null, state: GameState) {
  if (spec?.priced === 'hire') return hireQuote(state)
  if (spec?.priced === 'massHire') {
    return {
      count: MASS_HIRE_COUNT,
      cost: currentMassHireCost(state),
      affordable: canMassHire(state),
    }
  }
  return null
}

/**
 * One button, priced and gated.
 *
 * Shared by the primary action and §21.0a's offer, because they are now on
 * screen together and the two must not drift: a temptation styled or gated
 * differently from the control beside it is a second thing to keep in sync
 * every time either changes.
 */
function ActionButton({ spec, state }: { spec: ActionSpec; state: GameState }) {
  const q = priceOf(spec, state)
  return (
    <Button
      variant={spec.variant}
      onClick={RUN_ACTIONS[spec.action]}
      // §21.0 — a purchase the player cannot afford is refused by the store
      // anyway, but a button that looks live and does nothing is worse than one
      // that says so.
      disabled={q !== null && !q.affordable}
    >
      {/*
        The face carries the batch, because at x100 "HIRE DEVELOPER" is a lie
        about what the tap does. Below the dial's unlock it reads exactly as it
        always did — the multiplier is 1 and the count is suppressed rather than
        rendered as "x1".
      */}
      {spec.showsHireCost && q && q.count > 1 ? `${spec.label}  x${q.count}` : spec.label}
      {/*
        The mousetrap shows its joke *and* its figure. "Cost: YOUR ENTIRE
        TREASURY" is funny while there is a treasury and says nothing at all
        when there is not, so the number goes underneath it — which is also
        what tells a broke player what they are waiting for.
      */}
      {spec.note && <small>{spec.note}</small>}
      {q && <small>{formatMoney(q.cost)}</small>}
    </Button>
  )
}

/**
 * The action the current beat is waiting on — §10.8 F1.
 *
 * The button used to be mounted and unmounted by a `switch` on the phase, which
 * meant it appeared and vanished on the frame the state flipped: the named F1
 * failure, on the most important control in the game. It now rides a `Panel`,
 * which keeps its children mounted through the exit so there is something left
 * to animate out.
 *
 * The spec is latched for exactly that reason. Once the phase has moved on
 * `actionFor` returns null, and rendering that directly would slide an empty
 * box down the screen while the button it was holding had already blinked out.
 */
function ActionBar({
  spec,
  offer,
  state,
}: {
  spec: ActionSpec | null
  offer: ActionSpec | null
  state: GameState
}) {
  // React's "adjusting state when a prop changes" pattern: set during render,
  // never in an effect, so the latched spec and the `open` flag are committed
  // in the same paint. An effect would give the panel one frame holding the
  // wrong content, which is a flicker on the frame it is trying to smooth.
  // Compared by identity — `actionFor` returns module constants for this.
  const [shown, setShown] = useState(spec)
  if (spec !== null && spec !== shown) setShown(spec)

  // The offer is latched the same way and for the same reason, but separately:
  // it arrives and leaves on its own schedule and must not drag the primary
  // control's animation with it.
  const [shownOffer, setShownOffer] = useState(offer)
  if (offer !== null && offer !== shownOffer) setShownOffer(offer)

  return (
    <Panel open={spec !== null} from="bottom" className="hud__actions">
      {/*
        §21.0a — the temptation sits ABOVE the ordinary control, and both are
        live. Act III used to *replace* the hire button with this, which turns a
        trap into a corridor: a player left no alternative has not chosen
        anything, and §6's lesson only lands if the decision was theirs.
      */}
      <Panel open={offer !== null} from="bottom" className="hud__offer" silent>
        {shownOffer && <ActionButton spec={shownOffer} state={state} />}
      </Panel>

      {shown?.showsHireCost && (
        // Above the button, per §10.10.1's layout: the multiplier is chosen
        // and *then* committed, so it belongs earlier in the reading order and
        // further from the thumb than the thing it commits.
        //
        // No longer gated on `dialUnlocked`: that flag is §10.10.2's gate on the
        // *multiplier*, and the role row has a different answer. A studio of ten
        // that has just shipped a buggy game needs to be able to hire QA, and it
        // reaches ten well before it reaches the seed round. `HireDial` renders
        // the multiplier only when `segmentsFor` offers segments, so passing a
        // pinned value here changes nothing about §10.10.2.
        <HireDial
          devs={state.dialUnlocked ? state.devs : 0}
          cash={state.cash}
          value={state.hireMultiplier}
          onChange={setHireMultiplier}
          role={state.hireRole}
          onRoleChange={setHireRole}
          availableRoles={rolesAvailable(state)}
          // §4.10a — the same base the transaction uses. Without it the dial
          // priced its segments off the raw curve, so §13.7.1's Recruiting and
          // §14.8.9's cap normalisation were both invisible on the one control
          // whose entire job is showing the player what a batch costs.
          growth={hireGrowthNow(state)}
        />
      )}
      {shown && <ActionButton spec={shown} state={state} />}
    </Panel>
  )
}

/**
 * A line over the developer's head — §7.5 L1, §6.3.
 *
 * Same latch as the action bar, and for the same reason: the store clears
 * `bubble` when its TTL expires, so the text is gone before the panel has
 * finished leaving.
 *
 * Silent, unusually for a Panel. The bubble is always a consequence of
 * something that already made a noise — a poke, a hire, a phase turning over —
 * and F3 asks for a sound per state change, not per surface.
 */
function Bubble({ text }: { text: string | null }) {
  const [shown, setShown] = useState(text)
  if (text !== null && text !== shown) setShown(text)

  return (
    <Panel open={text !== null} from="top" silent className="hud__bubble">
      <span>{shown}</span>
    </Panel>
  )
}

/**
 * §21 Act V.
 *
 * Rendered inside the live HUD rather than replacing it. The previous version
 * early-returned a different tree the frame the phase flipped, so every readout
 * on screen vanished in one frame while the modal faded up over nothing — the
 * modal itself animated correctly and everything around it cut. Keeping the HUD
 * mounted underneath also satisfies §10.6: the studio is still there behind the
 * scrim, still simulating, which is what makes the bankruptcy land on a place
 * rather than on a screen.
 */
function Bankruptcy({ open }: { open: boolean }) {
  return (
    <Panel open={open} modal from="centre" className="bankruptcy">
      <h1>BANKRUPTCY</h1>
      <p>
        <ConceptText text="Your 1,000 developers spent 100% of their time arguing in Slack and zero seconds coding." />
      </p>
      <p className="bankruptcy__result">$0 REVENUE — TOTAL LIQUIDATION</p>
      <p className="bankruptcy__lesson">
        LESSON LEARNED:
        <br />
        Manpower without Communication Infrastructure is Chaos.
      </p>
      <Button variant="bait" onClick={triggerParadigmShift}>
        TRIGGER PARADIGM SHIFT
      </Button>
      {/* James survives. Every other developer is liquidated. */}
      <p className="bankruptcy__james">James stayed.</p>
    </Panel>
  )
}

/** GDD §23.3 — frame-time and input-latency overlay. */
function PerfOverlay({ stage }: { stage: StageHandle | null }) {
  const [, force] = useState(0)

  useEffect(() => {
    // 4 Hz. Re-rendering the overlay every frame would itself cost frames,
    // which is a poor way to measure frames.
    const id = setInterval(() => force((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [])

  if (!stage) return null

  const fps = stage.frameMs > 0 ? 1000 / stage.frameMs : 0
  const latency = stage.latencyP95

  return (
    <div className="hud__perf">
      {/* Thresholds from GDD §23.3. Red means the gate is failing right now. */}
      <span className={`hud__perf-fps${fps < 55 ? ' is-bad' : ''}`}>{fps.toFixed(0)} FPS</span>
      <span className={`hud__perf-latency${latency > 80 ? ' is-bad' : ''}`}>
        {latency > 0 ? `${latency.toFixed(0)}ms TAP` : '— TAP'}
      </span>
      {/*
        The build stamp. Small, permanently on, and worth every pixel: a stale
        bundle is indistinguishable from a bug that will not die, and this turns
        "am I looking at the code you just changed" into something a screenshot
        answers.
      */}
      <span className="hud__build">{__BUILD_AT__}</span>
    </div>
  )
}
