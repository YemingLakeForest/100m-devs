# The return — plan, 2026-09-26

> *"Yes commit and push there. And next step will be to plan going back to old repo (what a ride) with some new
> game elements bringing back (hero upgrades, upgrade tree UI, minigames, slack off, release pipelines) whats yet
> or decide is the game's scaling up UI style, I still want the swarm feel. But we have not landed perfectly on
> how this can be achieved yet."*

## Why we are here

- The rebuild (`100m-devs-three`) was started because this repo could not produce good models. The rebuild
  solved that: three.js, authored geometry, a floor plan the tests can check, 禁止穿模 held.
- The rebuild then drifted into an incoherent look ("very amateur … no cohesive design and aesthetic"). A
  STUDIO_OS re-skin of its HUD did not land ("the UI port did not land").
- The reverse proof did land: this repo's interface, glass and terminal over the rebuild's garage, night-lit by
  its own screens and lamps ("that was what I was looking for in the old game"). Branch `proof/three-garage`.
- The user also named what the legacy people get right: *"no feet … just a head and body hop about and it works
  well with catapult game"*, and that STUDIO_OS *"works well with the upgrade isometric graphics"*.

**So: this repo is the base. Its interface and `docs/ART_DIRECTION.md` stay authoritative, unported and
unrestyled. The rebuild supplies models, 3D rendering, and a chosen set of systems.**

## Ground rules

1. **ART_DIRECTION governs every surface.** One face, integer type multiples of 11 px, fixed rails, the 5% edge,
   the slab, the post-process stack over world and interface together. A system brought over from the rebuild
   is redrawn in this language; its rebuild UI is reference, never copied.
2. **The world is three.js, night-lit, and people are head-and-body.** Dusk key light, screens light their
   operators, warm lamp pools; bodies hop. 禁止穿模 is release-blocking, checked the rebuild's way (floor plans
   with footprint tests, then looking).
3. **`sim/` stays pure, one authority per question** (both repos already agree).
4. **Bring systems as pure `sim/` modules first, UI second.** The rebuild's `sim/` is tested and store-free, which
   is what makes it portable. Its `game/store.ts` is not; logic from it is re-expressed against this store.
5. **Canon.** Proposed: the rebuild's `GDD.html` (the newer decisions) is copied here as canon, with §12 amended
   to "ART_DIRECTION.md governs", and this repo's current GDD kept frozen as history. *Needs the user's yes.*

## Where each named system stands

| System | This repo has | The rebuild has | Proposed |
|---|---|---|---|
| **Hero upgrades** | 6 heroes (incl. Mo, Melany); **one shared tree** (`sim/heroTree.ts`); hero XP by coverage | 5 heroes (Mo and Melany cut); **a tree per hero**, each owning slices of the loss; node contents still a proposal | Cut to five; per-hero trees; keep this repo's hero XP; node contents need sign-off |
| **Upgrade tree UI** | Centre-out tech board (`UpgradeBoard`), ParadigmTree | The approved isometric trees demo (`upgrade-trees/`, "so good"); Serena's pipeline board | Redraw the isometric trees in STUDIO_OS (the user's own pairing) |
| **Minigames** | Incidents and support as backlogs (`sim/incidents.ts`, `sim/support.ts`), no puzzles | §17 Service Later: four seeded puzzles (logs, triage, UML, rollback), validators, 400-seed tests, the ticket flood | Port `sim/service/*` whole; redraw as STUDIO_OS windows (`osWindow.css` exists) — the best fit of any system |
| **Slack off** | `sim/slackOff.ts` (away share, drag people back), Pixi walkers | 3D errands with routes, the sling | Keep this repo's rule; 3D walkers that hop; the drag becomes a thrown arc (the catapult) |
| **Release pipeline** | Shelf and the launch-window timing minigame (`sim/release.ts`) | The belt as a buffer: Code → Build → Test → slots, capacity and speed, manual SHIP! then Serena's auto-ship | Port `sim/pipeline.ts`; the launch window stays as what a manual SHIP! press *is*; auto-ship releases at neutral timing |
| **The satire law** | η = 1/(1+(D/Dcap)^ρ) collapse | Locked option C: the square root plus the collapse, seven named loss slices, dollars burned, dysfunction conserved | **Decision** — see below |

## Phases

**0 · Make the proof a renderer, not a bundle.**
- Move the garage's source (18 files, about 5.7K lines) into `src/render3d/` and delete `src/vendor/`.
- Drive the 3D camera from this repo's lens. `DESK`, `SQUAD` and `FLOOR` become 3D zoom levels.
- Re-project the `+1` tallies, poke numerals and bubbles from 3D seat positions.
- Undo the barrel curvature in hit-testing, and make James appear.
- Retire the Pixi room only at parity.
- Rewrite or retire `test:room`, `test:walk` and `test:ui-frame`, which measure the Pixi room, in the same
  batch. Say which.

**1 · The economy decision, then the Ledger in legacy widgets.** If option C is chosen:
- Port `entropy`, `dysfunction`, `losses`, `audience` and `pricing` as pure modules, then re-pin the tests that
  pin the old law.
- Show *Work of / Lost / burned* in this repo's rails at ART_DIRECTION sizes, not the rebuild's cards.
- Record a pacing log at 4 / 20 / 100 / 1K / 10K / 1M / 100M.

**2 · Release pipeline:** buffer, stages, capacity and speed, auto-ship. The belt is drawn in the 3D room.

**3 · Minigames:** Service Later, restyled as STUDIO_OS windows.

**4 · Heroes and the upgrade trees:**
- Cut the roster to five.
- Give each hero a tree.
- Draw the trees isometrically in STUDIO_OS.

**5 · Slack off and the catapult:** 3D walkers on real routes, the hop, and a thrown drag.

**6 · The swarm (open — see below).** Nothing above the floor is built until this is decided and prototyped.

**7 · Worlds, the James launch and the galaxy map.** These follow whatever 6 decides. This repo already has
`starbound`, `ProximaLaunch` and a galaxy rung; the rebuild has the Stellaris-style map, worlds and the cutscene.

**8 · Music:** blocked on the ElevenLabs paid plan. `tools/audio/compose.mjs` is ready in the rebuild.

**9 · Pacing,** with the user's sign-off.

## The open question: the swarm

What exists, measured on 2026-09-26:
- **This repo's ladder:** floor → building → block → park → globe → galaxy.
  - The towers read well in STUDIO_OS: lit windows and a clean silhouette.
  - At 90M the globe shows about thirty grey cubes. The number says ninety million and the picture says thirty.
- **The rebuild's endless city** (locked decision 4): fog, drag forever, every window lit by a seat. It gives
  the infinite vibe, but the user found it generic, and it has no discrete rungs.
- **This repo's Act IV collapse** already has the swarm's *mood*: a thousand people drop in, `@everyone`
  bubbles flood the screen, and Slack lines web every desk.

Four ways to get the swarm feel:

- **A · The legacy ladder, rebuilt in 3D.**
  - Discrete rungs with the lift panel. Towers and blocks carry lit windows, one per seat.
  - Honest and navigable, but the globe and galaxy still show objects, not people.
- **B · The rebuild's endless city, night-lit.**
  - Fog, infinite drag, lit windows.
  - It proved the infinite feel and did not prove character.
- **C · The swarm as an instrument.**
  - Above the building, the world becomes STUDIO_OS's own display: a phosphor dot field, one dot per person
    (or per thousand), tinted by work state and streaming like radar.
  - The most on-brand and cheap at 100M (GPU points), but it risks reading as a chart, not people.
- **D · Night Earth (recommended to prototype).**
  - 3D up close: room, tower, block, with lit windows and hopping walkers on the streets.
  - Above that, the planet at night seen from orbit. Every light is your developers, city lights spreading
    across continents as you hire, pulsing with the loss partition.
  - Worlds are other night sides; the galaxy is lights between stars.
  - It uses the night lighting the user just approved, it is literally how a swarm of people looks from far
    away, and it reads as *people* where C reads as *data*.
  - What it costs: a globe renderer with a lights layer (points on a sphere) and one continuous zoom from block
    to orbit.

**Proposed next step for the swarm:**
1. Three concept frames per option for C and D: tower, city, planet. Reference only the garage render and this
   proof, per the concept-refs rule.
2. Then a spike of whichever the user picks, at 10K, 1M and 100M, with phone frame time measured before
   anything is built on it.

## Decisions for the user

1. The satire law: this repo's collapse alone, or the rebuild's option C (square root plus collapse, Ledger slices).
2. Canon: copy the rebuild's `GDD.html` here as canon (with §12 → ART_DIRECTION), yes or no.
3. Roster: five heroes (cut Mo and Melany), as the rebuild decided.
4. The swarm: which of C and D to concept (or A or B again).
5. Branching: merge `feat/canonical-garage-and-office` (28 ahead of `main`) and `proof/three-garage` into
   `main`, then work on `main` as the rebuild did.
6. The rebuild repo afterwards: archive it, or keep it as the model workbench.
