import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { applyEntropyTheme, entropyTheme } from '../art/entropyTheme.ts'
import {
  canMassHire,
  collectOffline,
  currentMassHireCost,
  currentUnlocks,
  hasPrestiged,
  currentEfficiency,
  currentEntropy,
  dismissScene,
  dismissShiftReport,
  effectiveDevCap,
  finishLaunch,
  getPermanent,
  grantJames,
  hasSeenScene,
  heroById,
  heroRoster,
  hireDeveloper,
  hireGrowthNow,
  hireQuote,
  isDuckPromoted,
  layOff,
  layoffQuoteNow,
  massHire,
  selectHero,
  setHireMultiplier,
  takeSeedRound,
  treeRefusalOf,
  triggerParadigmShift,
  beginLiquidation,
  type GameState,
} from '../game/store.ts'
import { MASS_HIRE_COUNT, PHASE_COPY, SEED_ROUND_CASH } from '../game/onboarding.ts'
import { CollapsePlate } from './CollapsePlate.tsx'
import { marginalHire } from './collapseModel.ts'
import { LATER_RUN_TERMINAL, bankruptcyReceipt } from './bankruptcyModel.ts'
import { WAGE_PER_DEV_PER_SEC, paidHeadcount, payrollPerSecond, secondsUntilBankrupt } from '../sim/economy.ts'
import { peakHeads } from '../sim/entropy.ts'
import type { StageHandle } from '../render/stage.ts'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import { Typewriter } from '../ui/Typewriter.tsx'
import { BurnDown } from './BurnDown.tsx'
import { RevenueGraph } from './RevenueGraph.tsx'
import { ReleaseReview } from './ReleaseReview.tsx'
import { ShipTicker } from './ShipTicker.tsx'
import { ReleaseRing } from './ReleaseRing.tsx'
import { PipelineStrip } from './PipelineStrip.tsx'
import { TREES, TREE_HEROES, type TreeHero } from '../sim/upgradeTrees.ts'
import { pipelineAdvice } from './pipelineModel.ts'
import { FounderDesk, FounderProfilePanel } from './Founder.tsx'
import { DuckPanel } from './DuckPanel.tsx'
import { DevCard } from './DevCard.tsx'
import { HeroCard } from './HeroCard.tsx'
import type { HeroId } from '../sim/storyHeroes.ts'
import { HireDial } from './HireDial.tsx'
import { Cash, Devs, Shipped, Speedometer, Starbound, StudioClock, Velocity } from './Readouts.tsx'
import { DialoguePreview } from './DialoguePreview.tsx'
import { Defects, Incidents, Tickets } from './Backlogs.tsx'
import { OvernightReport } from './OvernightReport.tsx'
import { OvernightPreview } from './OvernightPreview.tsx'
import { Dialogue, type LitKey } from '../ui/Dialogue.tsx'
import { QueueWindow } from './QueueWindow.tsx'
import { HeroRail, StatusItem, Taskbar, type TaskApp } from './StudioBars.tsx'
import { cashTip, devsTip, shippedTip, syncTip, velocityTip } from './statusTips.ts'
import type { TipSpec } from '../ui/OsTip.tsx'

import '../styles/legibility.css'
import { OsWindow } from '../ui/OsWindow.tsx'
import {
  SCENES,
  SCENE_DUCK_PROMOTED,
  SCENE_FOUNDER_BOARD,
  SCENE_JAMES_ARRIVES,
  SCENE_JAMES_INSTANT_MESSENGER,
  SCENE_SERENA_ARRIVES,
  SCENE_MATT_ARRIVES,
  SCENE_BILLY_ARRIVES,
  JAMES_DROPS_AT_LINE,
} from '../game/scenes.ts'
import { OfferLetter } from './OfferLetter.tsx'

/**
 * §22.9.4 — the arrival scenes that end on an offer letter. James is not here:
 * he is the constant who is there before the studio has paperwork, and Act I's
 * cold open is timed to the press without a page in the way.
 */
const LETTER_AFTER: Readonly<Record<string, HeroId>> = {
  [SCENE_SERENA_ARRIVES.id]: 'serena',
  [SCENE_MATT_ARRIVES.id]: 'matt',
  [SCENE_BILLY_ARRIVES.id]: 'billy',
}
import { shouldShowReport } from './overnightModel.ts'
import { TermSheet } from './TermSheet.tsx'
import { ParadigmCutScene } from './ParadigmCutScene.tsx'
import { ProximaLaunch } from './ProximaLaunch.tsx'
import { Gallery } from './Gallery.tsx'
import { ParadigmTree } from './ParadigmTree.tsx'
import {
  RUNWAY_WARN_SECONDS,
  actionFor,
  formatMoney,
  hireRunwayReadout,
  layoffOffered,
  offerFor,
  pastPeakReadout,
  runwayLabel,
  type ActionSpec,
} from './hudModel.ts'
import { runwayAfterHire } from '../sim/hireDial.ts'
import { useGameState } from './useGameState.ts'
import { ConceptText } from '../ui/ConceptText.tsx'
import { Options } from '../title/Options.tsx'
import {
  DURATION,
  motionMs,
  useReducedMotion,
} from '../ui/motion.ts'
import { DEBUG_TOOLS_ENABLED, debugSearchParams } from '../dev/debugAccess.ts'

/**
 * Local-browser-only §10.7 preview — `?dialogue`. Read once, at module load, for the
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
const DEBUG_QUERY = debugSearchParams()

const FAKE_AD_READY = DEBUG_QUERY.has('ad')

const PREVIEW_OVERNIGHT = DEBUG_QUERY.has('overnight')
const PREVIEW_OVERNIGHT_CAPPED = DEBUG_QUERY.get('overnight') === 'capped'

const PREVIEW_DIALOGUE = DEBUG_QUERY.has('dialogue')

/** `?trees` or `?trees=serena` — §8's trees, open on arrival, on whoever is named. */
const PREVIEW_TREES: TreeHero | null = (() => {
  const v = DEBUG_QUERY.get('trees')
  if (v === null) return null
  return (TREE_HEROES as readonly string[]).includes(v) ? (v as TreeHero) : 'you'
})()

/**
 * `?launch` — §21.8's nine shots, without the twenty-one lines in front of them.
 *
 * Same family as `?dialogue`, `?overnight` and `?release`, and here for the
 * reason all three are: the sequence exists for about fourteen seconds once per
 * career, at a hundred million developers, behind a scene that takes a minute
 * to tap through. There is no way to *hold* it long enough to look at, and
 * iterating on a shot by playing to it is not iterating.
 */
const PREVIEW_LAUNCH = DEBUG_QUERY.has('launch')

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
/** GDD §8 — the people who have a tree. Mo and Melany do not, yet. */
function treeOf(id: HeroId): TreeHero | null {
  return (TREE_HEROES as readonly string[]).includes(id) ? (id as TreeHero) : null
}

export function Hud({ stage, onMainMenu }: { stage: StageHandle | null; onMainMenu?: () => void }) {
  const state = useGameState()
  // §10.7a.3 — the script block rides the same motion budget as the panels it
  // hides for, resolved once per render like Panel resolves it.
  const reduced = useReducedMotion()
  // §13.2's tree and §11's tree are two doors, and they now hang off one bar.
  const [treeOpen, setTreeOpen] = useState(false)
  const [founderOpen, setFounderOpen] = useState(PREVIEW_TREES === 'you')
  // §11.7 [2026-10-21] — the CTO's window: his own door, not a card on the roster.
  const [duckOpen, setDuckOpen] = useState(PREVIEW_TREES === 'duck')
  const [gameMenuOpen, setGameMenuOpen] = useState(false)
  // The keys the current scene line is pointing at (`DialogueLine.light`). Only
  // read while a scene is up, so a scene that ends cannot leave one glowing.
  const [lit, setLit] = useState<readonly LitKey[]>([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  // §10.7 [2026-10-03] — the build queue, opened from the rail's gauge.
  const [queueOpen, setQueueOpen] = useState(false)
  // §22.9.4 — offer letters waiting to be signed, oldest first.
  const [letters, setLetters] = useState<HeroId[]>([])
  // §8 — a person's upgrade tree lives on their own screen: a hero's card, the
  // founder's panel [2026-10-13]. There is no separate tree window any more.
  // The node the tree opens on.
  const [treesIntro, setTreesIntro] = useState<string | null>(null)
  /**
   * §10.6b — **no window is open while somebody is talking.**
   *
   * A scene is the game's voice (§10.7) and it stops the studio: the poke path
   * goes inert, the script block leaves the rail, and the camera belongs to the
   * speaker. A term sheet, an incident card or an upgrade board left standing
   * behind that box is a surface the player can see, cannot use, and did not
   * ask to still be looking at.
   *
   * Read once here and applied to every window below, rather than each deciding
   * for itself. The two forms it takes are different and both are needed:
   *
   *   - the doors this component owns are **closed** by the effect below, so
   *     they do not spring back when the scene ends — a window that reappears
   *     after a conversation is the lingering pop-up wearing a delay;
   *   - the windows a *state* raises — §21.0a's term sheet, §24.8's report —
   *     are **suppressed**, because the state is still true
   *     and they must come back the moment the box is gone.
   *
   * `state.selected` and `state.selectedHero` are the store's, and `showScene`
   * clears them there for the same reason.
   */
  const talking = state.scene !== null

  // Adjusted during render rather than in an effect — React's documented "a
  // prop changed" pattern, and the same one `Panel` uses for its exit. In an
  // effect the doors would be shut a frame *after* the box was up, which is one
  // frame of exactly the picture this rule exists to stop.
  const [wasTalking, setWasTalking] = useState(talking)
  if (wasTalking !== talking) {
    setWasTalking(talking)
    if (talking) {
      setTreeOpen(false)
      setFounderOpen(false)
      setDuckOpen(false)
      setGameMenuOpen(false)
      setGalleryOpen(false)
      setQueueOpen(false)
    }
  }
  const roster = heroRoster()
  // Resolved once per render: `heroById` rebuilds from `meta`, so asking twice
  // in one frame would build the same six objects twice.
  const openHero = state.selectedHero === null ? null : heroById(state.selectedHero)
  const letterHero = letters.length > 0 ? heroById(letters[0]) : null
  const entropy = currentEntropy(state)
  const theme = entropyTheme(entropy)
  const copy = PHASE_COPY[state.phase]
  // [2026-10-15] `PHASE_COPY.bankrupt` is Run 1's trap, word for word. Every run
  // after it ends on the same phase, so the rail's terminal told a payroll death
  // about a thousand developers and Slack under a modal that had stopped saying so.
  const terminal = state.phase === 'bankrupt' && hasPrestiged() ? LATER_RUN_TERMINAL : copy.terminal
  // §10.7 — the belt takes the advisor's line while it needs the player: the
  // first build on the shelf, and a full buffer that has stopped the floor.
  const advisor = pipelineAdvice(state) ?? copy.advisor
  // §21.0c — read once and passed down, so every gate in this frame agrees
  // about the same run rather than each asking separately.
  const unlocks = currentUnlocks()

  // §10.11 — the gallery is where a career acquires a history, so its door opens
  // with the first ship and stays open: it is a view onto memory, not a lever,
  // and §10.11.5 is explicit that it must never become one.
  const history = state.history
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
   * §8 — one person's tree. A hero's is on their own screen [2026-10-13], beside
   * their pass; the founder's is on their panel the same way.
   */
  const openTree = (hero: TreeHero, intro: string | null = null) => {
    setTreeOpen(false)
    setGameMenuOpen(false)
    setGalleryOpen(false)
    setTreesIntro(intro)
    setDuckOpen(false)
    if (hero === 'you') {
      setFounderOpen(true)
    } else if (hero === 'duck') {
      // §11.7 — the CTO is not a person on the roster: his window is his own door.
      setFounderOpen(false)
      selectHero(null)
      setDuckOpen(true)
    } else {
      setFounderOpen(false)
      selectHero(hero)
    }
  }

  // One window at a time: the queue stands down when anything else is raised.
  if (queueOpen && (galleryOpen || treeOpen || founderOpen || duckOpen || gameMenuOpen)) setQueueOpen(false)

  /**
   * §21.7.7e — finish the character beat by putting the instrument they just
   * named in the player's hand. The first successful purchase closes it again,
   * so every introduction is a short path back to the running studio rather
   * than a tutorial page the player has to escape.
   */
  const finishDialogue = () => {
    const finished = state.scene
    dismissScene()

    // §22.9.4 — a hire is not finished until the letter is signed. Queued, because
    // one dismissal can satisfy the next arrival's predicate on the following tick.
    const hired = finished ? LETTER_AFTER[finished] : undefined
    if (hired) setLetters((q) => (q.includes(hired) ? q : [...q, hired]))

    /*
     * §21.6 — **this is how the trees are introduced** [2026-09-26]. *"the story
     * of james introducing us instant messenger should be how upgrade trees are
     * introduced"*. James hands over Instant Messenger in the scene, and it is
     * the root of his tree, so the scene ends on that tree opened at that node,
     * over his card — which is where the player will find it again.
     */
    if (finished === SCENE_JAMES_INSTANT_MESSENGER.id) {
      openTree('james', 'R')
      return
    }

    // §21.7.7 — "There's a track for that. It's a bit of everyone's job." Your
    // own tree, over your panel. It was the Management tree until that was
    // retired with the studio board.
    if (finished === SCENE_FOUNDER_BOARD.id) {
      openTree('you')
      return
    }

    // §21.7.9 — the org change ends on the CTO's window, open on his root: the
    // instrument the scene named, in the player's hand (§21.7.7e).
    if (finished === SCENE_DUCK_PROMOTED.id) {
      openTree('duck', 'R')
    }
  }

  /**
   * §22.9 — open somebody's card, with every other window stood down. The
   * card is the heroes' one surface now: the roster strip that used to rise
   * under it went with placement (*"I don't want the heroes tray"*).
   */
  const openCard = (id: HeroId) => {
    setTreeOpen(false)
    setFounderOpen(false)
    setDuckOpen(false)
    setGameMenuOpen(false)
    setGalleryOpen(false)
    setQueueOpen(false)
    setTreesIntro(null)
    selectHero(id)
  }

  /** The card the TEAM door and the suite's sign open on: James, or whoever is first. */
  const openTeam = () => {
    const first = roster[0]
    if (first) openCard(first.id)
  }

  // The stage keeps its handlers for its whole life; these refs let them call
  // this render's closures (which read this render's roster).
  const openCardRef = useRef(openCard)
  useEffect(() => {
    openCardRef.current = openCard
  })

  // §11.2 B2 — the past-peak line, read once and shared by the gauge and its tooltip.
  const pastPeak = unlocks.trees ? pastPeakLine(state) : null

  /**
   * §10.1 [2026-10-20] — how many nodes the player could buy right now, across
   * everybody who has a tree. It is the PERSONNEL badge: the taskbar's way of
   * saying a window wants you. About a hundred refusal checks, each a lookup
   * and a comparison, so it is simply counted every render.
   */
  const buyableBy: Record<string, number> = {}
  let buyableCount = 0
  if (unlocks.trees) {
    const people: TreeHero[] = ['you', ...roster.map((h) => treeOf(h.id)).filter((h): h is TreeHero => h !== null)]
    for (const who of people) {
      let n = 0
      for (const node of TREES[who]) if (treeRefusalOf(who, node.id, state) === null) n++
      buyableBy[who] = n
      buyableCount += n
    }
  }

  // §11.7 — the CTO's tree, counted the same way, for his own door's badge.
  let duckBuyable = 0
  if (unlocks.trees && isDuckPromoted()) {
    for (const node of TREES.duck) if (treeRefusalOf('duck', node.id, state) === null) duckBuyable++
  }

  const closeAll = () => {
    setTreeOpen(false)
    setFounderOpen(false)
    setDuckOpen(false)
    setGameMenuOpen(false)
    setGalleryOpen(false)
    setQueueOpen(false)
  }
  const bp = getPermanent().layer1.bp
  const apps: TaskApp[] = [
    // [2026-10-28] From the first person through the door, James alone included:
    // the door was gated on a second hero, so with only James in the building
    // there was no way to his card, and so none to his upgrades.
    ...(roster.length >= 1
      ? [{
          id: 'personnel',
          label: 'PERSONNEL',
          open: openHero !== null,
          badge: unlocks.trees && buyableCount > 0 ? String(buyableCount) : null,
          onToggle: () => {
            if (openHero) {
              selectHero(null)
              return
            }
            stage?.focusTeam()
            openTeam()
          },
          tip: (): TipSpec => ({
            title: 'PERSONNEL',
            tag: 'WINDOW',
            rows: [['PEOPLE', String(roster.length)], ...(unlocks.trees ? [['NODES YOU CAN BUY', String(buyableCount)] as const] : [])],
            body: 'Everybody who works here, their trait, and their upgrades.',
          }),
        }]
      : []),
    ...(hasPrestiged()
      ? [{
          id: 'paradigm',
          label: 'PARADIGM',
          open: treeOpen,
          // [2026-10-29] No pulse and no ×10 SEATS: *"the blinking paradigm x10 seats, why? it asking for click but
          // its a big undertake"*. A blinking door asked the player to start over; the shift is offered inside
          // the window, where its price is shown, and the door only says what is in the wallet.
          badge: bp > 0 ? `${bp} BP` : null,
          onToggle: () => {
            const was = treeOpen
            closeAll()
            selectHero(null)
            setTreeOpen(!was)
          },
          tip: (): TipSpec => ({
            title: 'PARADIGM TREE',
            tag: 'WINDOW',
            rows: [['BANDWIDTH', `${bp} BP`]],
            body: 'Start the run again, stronger. What you buy here survives every run.',
          }),
        }]
      : []),
    ...(hasGallery
      ? [{
          id: 'gallery',
          label: 'GALLERY',
          open: galleryOpen,
          onToggle: () => {
            const was = galleryOpen
            closeAll()
            setGalleryOpen(!was)
          },
          tip: (): TipSpec => ({ title: 'GALLERY', tag: 'WINDOW', body: 'Every game you have released, across every run, and what each one still earns.' }),
        }]
      : []),
    ...(unlocks.trees
      ? [{
          id: 'you',
          label: 'YOU',
          open: founderOpen,
          onToggle: () => {
            const was = founderOpen
            closeAll()
            setFounderOpen(!was)
          },
          tip: (): TipSpec => ({ title: 'YOU', tag: 'WINDOW', body: 'Your own pass and your own tree. You are the fifth tree, and worse at everything.' }),
        }]
      : []),
    // §11.7 [2026-10-21] — the CTO, from the day the org change commits. His own
    // door (§11's note: never a sixth tab on somebody's card), badged like
    // PERSONNEL with what his tree has on sale.
    ...(unlocks.trees && isDuckPromoted()
      ? [{
          id: 'cto',
          label: 'CTO',
          open: duckOpen,
          badge: duckBuyable > 0 ? String(duckBuyable) : null,
          onToggle: () => {
            const was = duckOpen
            closeAll()
            selectHero(null)
            setTreesIntro(null)
            setDuckOpen(!was)
          },
          tip: (): TipSpec => ({
            title: 'CTO',
            tag: 'WINDOW',
            rows: [['NODES YOU CAN BUY', String(duckBuyable)]],
            body: 'B. Quackington III: his tree, and his wardrobe. Everything you buy him, he wears.',
          }),
        }]
      : []),
    {
      id: 'menu',
      label: 'MENU',
      open: gameMenuOpen,
      onToggle: () => {
        const was = gameMenuOpen
        closeAll()
        setGameMenuOpen(!was)
      },
      tip: (): TipSpec => ({ title: 'GAME MENU', tag: 'WINDOW', body: 'Sound, motion and your save. The studio keeps working while it is open.' }),
    },
  ]

  // §11.7 — tapping the duck in his corner opens his window, once he is CTO.
  const openDuckRef = useRef(() => openTree('duck'))
  useEffect(() => {
    openDuckRef.current = () => openTree('duck')
  })

  useEffect(() => {
    if (!stage) return
    stage.setDuckInspect?.(() => {
      if (currentUnlocks().trees && isDuckPromoted()) openDuckRef.current()
    })
    return () => stage.setDuckInspect?.(null)
  }, [stage])

  useEffect(() => {
    if (!stage) return
    stage.setHeroInspect((id) => openCardRef.current(id))
    // The sign over the Pixi suite's doorway raised the roster, and went with
    // the Pixi room on 2026-09-28; TEAM is the door, and the card's arrows walk
    // everybody who has arrived.
    return () => {
      stage.setHeroInspect(null)
    }
  }, [stage])

  return (
    <div className="hud" data-lit={state.scene ? lit.join(' ') : undefined}>
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
      {/*
        §10.1 [amended 2026-10-20] — **one status bar, one taskbar.** The readings
        that sat in both rails (cash, devs, shipped on the right; sync and velocity
        on the left) are one row across the top now, each with its reasons a hover
        away (`StudioBars.tsx`). The doors that were a pile of filled buttons in
        the bottom right — TEAM, PARADIGM, YOU, GALLERY, and MENU from the left —
        are a taskbar along the bottom. What is left in the rails is what is *not*
        a reading or a door: the project and its charts on the left, the verb and
        your own desk on the right.
      */}
      <div className="hud__status">
        <StatusItem tip={() => cashTip(state)} className="hud__status-item--cash">
          <Cash state={state} />
        </StatusItem>
        <StatusItem tip={() => devsTip(state)} className="hud__status-item--devs">
          <Devs state={state} />
        </StatusItem>
        <StatusItem tip={() => shippedTip(state)} className="hud__status-item--shipped">
          <Shipped state={state} />
        </StatusItem>
        <StatusItem tip={() => velocityTip(state)} className="hud__status-item--velocity">
          <Velocity state={state} />
        </StatusItem>
        <StatusItem tip={() => syncTip(entropy, pastPeak)} className="hud__status-item--sync">
          <Speedometer entropy={entropy} pastPeak={pastPeak} labelled={unlocks.entropyLabel} />
        </StatusItem>
        {/* §21.7.0 rule 5 — the clock James's gym runs on, only around the gym. */}
        <StudioClock state={state} />
        {/* §16 — light-lag and the barrier; nothing on a one-world studio. */}
        <Starbound state={state} />
      </div>

      <div className="hud__left">
        {/*
          The faces of everybody who has arrived (§7.8.12's front door). Gated as
          TEAM was, on there being more than one of them: James alone in Act I has
          no room to go back to and no card worth a face of its own yet.
        */}
        {roster.length > 1 && <HeroRail roster={roster} state={state} onOpen={openCard} />}

        {/* Top-left — §10.1's Active Project, "a descending line, not a filling bar". */}
        <div className="hud__project">
          <BurnDown state={state}>
            {/*
              §10.7 [2026-10-03] — the queue, in the burn-down's block because the
              burn-down feeds it. A tap opens `QueueWindow`.
            */}
            <PipelineStrip
              state={state}
              onOpen={() => {
                setTreeOpen(false)
                setFounderOpen(false)
                setDuckOpen(false)
                setGameMenuOpen(false)
                setGalleryOpen(false)
                setQueueOpen(true)
              }}
            />
          </BurnDown>
          {/* §4.10e — the back catalogue, under the burn-down that will join it. */}
          <RevenueGraph state={state} />
          {/* §4.15, §21.7.6b — the three backlogs, one colour at a time as each hero arrives. */}
          {unlocks.defects && <Defects state={state} />}
          {unlocks.incidents && <Incidents state={state} />}
          {unlocks.tickets && <Tickets state={state} />}
        </div>

        {/* §23.3's overlay, at the foot of the reading rail. Instrumentation is not a control. */}
        {DEBUG_TOOLS_ENABLED && (
          <div className="hud__gauges">
            <PerfOverlay stage={stage} />
          </div>
        )}
      </div>

      <Bubble text={state.bubble?.text ?? null} />
      {/* §21 Act IV — the curve, while the Mass Hire walks it. Run 1 only, by construction. */}
      <CollapsePlate state={state} />

      {/*
        The right rail is the thumb's now, and only the thumb's: the verb (HIRE,
        and the offer and dials that ride with it) and your own desk. Pinned to
        the bottom, next to the taskbar, which is where Lonestar puts its one big
        button.
      */}
      <div className="hud__right">
        <div className="hud__bottom">
          <ActionBar
            spec={actionFor(state.phase, unlocks.manualHire)}
            offer={offerFor(state.phase, state.massHired)}
            state={state}
          />
          <div className="hud__controls">
            <div className="hud__act">
              <div className="hud__act-row">
                <FounderDesk stage={stage} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Taskbar apps={apps} />

      {/* §10.8b — the two halves of a launch. The window is a modal decision
          the studio is stopped for; the reel is what the press said about it,
          and it plays over a running floor. */}
      <ReleaseReview state={state} />
      <ShipTicker state={state} />
      <ReleaseRing state={state} />
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
        state={state}
        tree={openHero ? treeOf(openHero.id) : null}
        treesOpen={unlocks.trees}
        intro={treesIntro}
        people={roster}
        counts={buyableBy}
        onClose={() => {
          setTreesIntro(null)
          selectHero(null)
        }}
        onPick={(id) => selectHero(id)}
        onFounder={
          unlocks.trees
            ? () => {
                selectHero(null)
                setFounderOpen(true)
              }
            : undefined
        }
      />

      <OfferLetter
        hero={state.scene ? null : letterHero}
        state={state}
        treesOpen={unlocks.trees}
        onSign={() => setLetters((q) => q.slice(1))}
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
        {terminal && (
          <pre className="hud__terminal">
            <Typewriter text={terminal.join('\n').replace('{project}', state.sprintName)} />
          </pre>
        )}
        {advisor && (
          <p className="hud__advisor">
            {/* The advisor is a character, so its letters land with a tick
                (§10.7). The banner above is machine output and stays silent —
                two typewriters ticking at once is a buzz, not a voice. */}
            <Typewriter text={advisor} sound />
          </p>
        )}
      </div>

      {/*
        §21.0a — the term sheet. A scrim over the whole frame, because the
        decision is about the whole company.
      */}
      <TermSheet
        open={state.phase === 'act2_termsheet' && !state.seedTaken && !talking}
        amount={SEED_ROUND_CASH}
        onSign={takeSeedRound}
      />

      <Gallery open={galleryOpen && !talking} onClose={() => setGalleryOpen(false)} />
      <QueueWindow
        open={queueOpen && !talking && !state.launching}
        state={state}
        onClose={() => setQueueOpen(false)}
        onBoard={() => openCard('serena')}
      />
      <ParadigmTree open={treeOpen && !talking} state={state} onClose={() => setTreeOpen(false)} />
      <FounderProfilePanel
        open={founderOpen && !talking}
        onClose={() => setFounderOpen(false)}
        state={state}
        treesOpen={unlocks.trees || PREVIEW_TREES !== null}
        intro={treesIntro}
      />
      <DuckPanel
        open={duckOpen && !talking}
        onClose={() => {
          setTreesIntro(null)
          setDuckOpen(false)
        }}
        state={state}
        intro={treesIntro}
      />
      {/*
        §8 — one person's tree. After the card and the founder's panel in the
        document, so it stands over whichever of them opened it, and closing it
        hands the player back to that person.
      */}
      <GameMenu
        open={gameMenuOpen && !talking}
        onResume={() => setGameMenuOpen(false)}
        onMainMenu={() => {
          setGameMenuOpen(false)
          onMainMenu?.()
        }}
      />

      <Bankruptcy open={state.phase === 'bankrupt' && !talking && !state.liquidating} state={state} />
      {/*
        §24.8 — before the swarm, before the rest of the HUD. `collectOffline`
        clears `pendingOffline`, so this unmounts on collect and the Panel
        plays its exit rather than vanishing.
      */}
      {!talking && shouldShowReport(state.pendingOffline) && (
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
          onFinished={finishDialogue}
          onFocus={(focus) => stage?.focusDialogue(focus)}
          holdBefore={state.scene === SCENE_JAMES_ARRIVES.id ? JAMES_DROPS_AT_LINE : undefined}
          holdUntil={state.scene === SCENE_JAMES_ARRIVES.id && stage ? () => stage.jamesLanded() : undefined}
          onHold={state.scene === SCENE_JAMES_ARRIVES.id ? () => stage?.cueJames() : undefined}
          onLine={(line) => {
            stage?.setSceneLine(line)
            setLit(SCENES[state.scene!]?.script[line]?.light ?? [])
            // §21.7.1 — "APPLICANT AT DOOR." holds, then James drops in and the
            // lens follows his `Ouch.`. The next line is the founder's, and its
            // focus brings the lens back — so the drop itself needs nothing here
            // beyond granting him.
            if (state.scene === SCENE_JAMES_ARRIVES.id && line >= JAMES_DROPS_AT_LINE) {
              grantJames()
            }
          }}
        />
      )}

      {/*
        §15.1a — the reboot between two realities. Last in the tree and above
        everything on it: the shift has already happened, the new studio is
        already behind this, and §21.6's James scene is waiting underneath for
        the moment the screen lifts.
      */}
      <ParadigmCutScene report={state.pendingShift} onDone={dismissShiftReport} />

      {/*
        §21.8 — the launch, once. Above the reboot for the same reason the
        reboot is above everything else: it is the last thing that happened, and
        the studio it happened to is already behind it.
      */}
      {(state.pendingLaunch || PREVIEW_LAUNCH) && (
        <ProximaLaunch onDone={PREVIEW_LAUNCH ? () => undefined : finishLaunch} />
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
    <OsWindow
      open={open}
      modal
      from="centre"
      className="game-menu"
      bodyClassName="game-menu__body"
      title="GAME MENU"
      /*
        §10.6's last row — "a separate settings page that looks like a form" is
        a web-app tell, and "style it as a STUDIO_OS config terminal" is the
        answer it gives. This is that window, and the close box is a second way
        out beside RESUME rather than a replacement for it: the two say
        different things, and the one that says "carry on" belongs on a button.
      */
      onClose={onResume}
      footer={
        <>
          <Button variant="primary" onClick={onResume}>RESUME</Button>
          <Button onClick={onMainMenu}>MAIN SCREEN</Button>
        </>
      }
    >
      <p>Your studio keeps working while this menu is open.</p>
      <div className="game-menu__options">
        <Options />
      </div>
    </OsWindow>
  )
}

/** The store verbs this layer is allowed to call, by `ActionSpec.action`. */
const RUN_ACTIONS: Record<ActionSpec['action'], () => void> = {
  hire: hireDeveloper,
  massHire,
  paradigmShift: triggerParadigmShift,
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
 * §11.2 B2 [amended 2026-10-16] — the speedometer's past-peak line, read off the
 * store's own efficiency at the studio's headcount and at the peak, so the floor
 * and every fold reach it. Run 2 and later: Run 1's collapse plate already says
 * this, with a picture, and its lesson is the one moment the HUD must not add to.
 */
function pastPeakLine(state: GameState): string | null {
  const cap = effectiveDevCap(state)
  const peak = peakHeads(cap)
  if (!(state.devs > peak)) return null
  const work = (d: number) => d * currentEfficiency({ ...state, devs: d })
  return pastPeakReadout({ devs: state.devs, cap, output: work(state.devs), peakOutput: work(peak), wage: WAGE_PER_DEV_PER_SEC })
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
      // §10.8a [2026-10-20] — the rail's verb is its one filled slab; the mousetrap keeps its own.
      variant={spec.variant === 'bait' ? 'bait' : 'primary'}
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
      {/*
        [2026-10-04] What the hire is worth, on the price line beside what it costs:
        the §4.1 curve on the button that moves along it. Only once there is a
        studio for it to be true of, and only on the ordinary hire — the mousetrap's
        joke is that it does not say. **On the price line, not under it**: a third
        row made the right rail taller and the frame gate caught the founder's CODE
        button clipped at 748x336.
      */}
      {q && (() => {
        const worth =
          spec.priced === 'hire' && state.devs >= 4
            ? marginalHire(state.devs, effectiveDevCap(state), q.count, (d) => currentEfficiency({ ...state, devs: d }))
            : null
        // [2026-10-15] What the hire leaves, on the button that makes it. It
        // *replaces* the worth rather than joining it: the price line is one row
        // wide and the frame gate counts rows, and when a hire is within ninety
        // seconds of the bankruptcy line the runway is the only number on it
        // that is still the player's decision. The worth stays in the tooltip.
        const left =
          spec.priced === 'hire' && q.affordable && q.count > 0
            ? hireRunwayReadout(runwayAfterHire(state.devs, state.cash, q.count, q.cost))
            : null
        const title = worth ? `The next hire ${worth.label.toLowerCase()} developers’ worth of work` : undefined
        // [amended 2026-10-16] §11.2 B2 — a hire that adds no work, or loses
        // some, is in the same alarm ink as one that runs out the money: past
        // the peak the studio pays the wage and gets nothing for it.
        const worthless = worth !== null && worth.value <= 0
        return (
          <small
            className={left || worthless ? 'is-bad' : undefined}
            title={left ? `Leaves ${left.replace(' LEFT', '')} before bankruptcy at this payroll${worth ? `. ${title}` : ''}` : title}
          >
            {formatMoney(q.cost)}{left ? ` · ${left}` : worth ? ` · ${worth.short}` : ''}
          </small>
        )
      })()}
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

  // §21.0e — **the bar opens for either of them.** It was gated on `spec`
  // alone, which was safe only while every beat carrying an offer also carried
  // the ordinary hire control. Run 1's Act III now carries the offer and no
  // verb, and the outer panel took the whole bar off screen with the mousetrap
  // inside it — a `HIRE 1,000 DEVS NOW` button that exists, is priced, is
  // affordable, and is not drawn.
  const anything = spec !== null || offer !== null

  return (
    <Panel open={anything} from="bottom" className="hud__actions">
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
        // `HireDial` renders the multiplier only when `segmentsFor` offers
        // segments, so passing a pinned count before `dialUnlocked` renders
        // nothing, which is §10.10.2.
        <HireDial
          devs={state.dialUnlocked ? state.devs : 0}
          cash={state.cash}
          value={state.hireMultiplier}
          onChange={setHireMultiplier}
          // §4.10a — the same base the transaction uses. Without it the dial
          // priced its segments off the raw curve, so §13.7.1's Recruiting and
          // §14.8.9's cap normalisation were both invisible on the one control
          // whose entire job is showing the player what a batch costs.
          growth={hireGrowthNow(state)}
        />
      )}
      {shown && <ActionButton spec={shown} state={state} />}

      {/*
        §10.10.5 [2026-10-15] — LAY OFF, under HIRE, **only while keeping people is
        what hurts**: the bankruptcy clock is running, or the studio is past §4.1's
        peak. `spec` rather than the latched `shown`: it leaves when hiring does, so
        it can never outlive the dial it reads. Nothing is latched here because
        nothing is ever null — the button reads the live quote, and on the way out
        it is merely the last numbers, which is what an exit should show.
      */}
      <Panel
        open={
          spec?.showsHireCost === true &&
          layoffOffered({
            paidHeads: paidHeadcount(state.devs),
            runwaySeconds: secondsUntilBankrupt(state.cash, state.devs),
            devs: state.devs,
            cap: effectiveDevCap(state),
          })
        }
        from="bottom"
        // [amended 2026-10-16] §11.2 B2 — past the peak LAY OFF is lit, not just
        // present: the floor holds the work flat there, so every head let go is
        // a wage saved for no work lost, and it is the one control that is
        // plainly right to press.
        className={state.devs > peakHeads(effectiveDevCap(state)) ? 'hud__layoff hud__layoff--urged' : 'hud__layoff'}
        silent
      >
        <LayOffButton state={state} />
      </Panel>
    </Panel>
  )
}

/**
 * LAY OFF — priced in severance, and **says what it leaves**.
 *
 * The same dial as HIRE and the same face rule: at `x40` the label carries the
 * batch. The price line is what a layoff costs and where it puts the studio,
 * because the whole case for the button is the second number — and it is in
 * alarm ink while that number is still inside the clock's window, which is the
 * honest way to say *this does not fix it*.
 */
function LayOffButton({ state }: { state: GameState }) {
  const q = layoffQuoteNow(state)
  const left = q.count > 0 ? runwayLabel(q.runwayAfter) : null
  const still = q.count > 0 && q.runwayAfter < RUNWAY_WARN_SECONDS
  return (
    <Button
      onClick={layOff}
      disabled={!q.affordable}
      title={
        q.count > 0
          ? `Let ${q.count.toLocaleString()} go: ${formatMoney(q.cost)} severance, nothing refunded${left ? `. Leaves ${left.replace(' LEFT', '')} before bankruptcy` : ''}`
          : 'Nobody to let go at this setting'
      }
    >
      {q.count > 1 ? `LAY OFF  x${q.count}` : 'LAY OFF'}
      <small className={still ? 'is-bad' : undefined}>
        {q.count > 0 ? `${formatMoney(q.cost)}${left ? ` · ${left}` : ''}` : '—'}
      </small>
    </Button>
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
function Bankruptcy({ open, state }: { open: boolean; state: GameState }) {
  // §15.1a [2026-10-04] — the lesson with the run's own numbers under it. Two
  // developers were doing two developers' worth of work; the swarm is doing a
  // hundredth of one. Read off the same curve the plate drew, at the cap the
  // studio actually had, so the receipt cannot disagree with what was on screen.
  // [2026-10-15] Run 1's receipt is the script; every run after it reads the studio
  // that actually ended — see `bankruptcyModel.ts` for why a Run 2 payroll death
  // must not be told it had a thousand developers arguing in Slack.
  const receipt = bankruptcyReceipt({
    prestiged: hasPrestiged(),
    devs: state.devs,
    cap: effectiveDevCap(state),
    revenue: state.lifetimeRevenue,
    payroll: payrollPerSecond(state.devs),
    work: state.devs * currentEfficiency(state),
  })
  return (
    <OsWindow
      open={open}
      modal
      from="centre"
      className="bankruptcy"
      bodyClassName="bankruptcy__body"
      title="LIQUIDATION"
      /*
        No close box. This screen holds the sole route into Run 2 — see
        `Panel`'s note on the frame-callback mount that once lost it — and a
        run that has ended is not a window you dismiss.
      */
      footer={
        <Button variant="bait" onClick={beginLiquidation}>
          TRIGGER PARADIGM SHIFT
        </Button>
      }
    >
      <h1>BANKRUPTCY</h1>
      <p>
        <ConceptText text={receipt.story} />
      </p>
      <p className="bankruptcy__result">{receipt.result}</p>
      <p className="bankruptcy__sums">
        {receipt.sums[0]}
        <br />
        {receipt.sums[1]}
      </p>
      <p className="bankruptcy__lesson">
        LESSON LEARNED:
        {receipt.lesson.map((line) => (
          <span key={line}>
            <br />
            {line}
          </span>
        ))}
      </p>
      {/* James survives. Every other developer is liquidated. */}
      <p className="bankruptcy__james">James stayed.</p>
    </OsWindow>
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
