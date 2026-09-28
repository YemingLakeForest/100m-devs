# Garage to Galaxy, in the game — the heroes' garage, the monitor and the colony map

*Written 2026-09-27 for the next session. The user: "Write up implementation plan for next session."*
*Published as a page (with the garage's two bay layouts drawn to scale): https://claude.ai/artifact/G2FDdrzDrr5Trds45v2yUN.
This file is the source; update both together.*

Read it with `docs/HANDOFF-2026-09-27.md` §10 (how each decision was reached), the prototype in
`docs/demos/garage-to-galaxy-2026-09-27/` (playable from https://claude.ai/artifact/1TTsFKbgXiD6yaozvTKLHs),
and the `GDD.html` sections amended the same day: §7.4a, §7.7.1a, §7.8.1's garage subsections, §7.8.12,
§7.2's free-zoom note, §21.8 and Appendix G.3, plus `docs/ART_DIRECTION.md` §1.0b.

The prototype is the reference for *how it should look and move*. It is not a library: port its ideas
into `src/`, with tests, and do not import across `docs/` into the game.

---

## 0 · What is decided

| | Decision | In the user's words | Canon |
|---|---|---|---|
| 1 | Past the block, the lens draws on **the monitor** (the prototype's option A): the world redrawn as STUDIO_OS phosphor, a CRT refresh as the hand-off | *"I like monitor style lets go further with that approach"* | GDD §7.4a; ART_DIRECTION §1.0b |
| 2 | The top of the ladder is a **Stellaris-style colony map**, not a galaxy: systems, lanes, a territory with a border, fog past the frontier | *"the milky way is good but it's kind of unnecssary details for us at this point, we can make it a stellaris style colony network"* | GDD §7.7.1a |
| 3 | The border **as the prototype draws it**: a disc per world and a band per claimed lane, outlined | *"Border outline is good"* | GDD §7.7.1a; G.3 |
| 4 | **No lock.** Every stop is reachable at any headcount, and each draws only what the studio has | *"no we don't keep the lock and we should be able to zoom and down before 100m"* | GDD §7.4a's first non-negotiable, §7.2, §21.8 |
| 5 | **The garage is the HQ.** The leaders never leave it, and Billy, Serena and Matt each get a space in it when they arrive | *"stay with our hero in the garage where it progressively upgrades into HQ which serves as our origin"*; *"I want spaces in our current garage scene which is the head quarter for our heroes Serena and Matt and billy"* | GDD §7.8.1 (the garage), §7.8.12 |
| 6 | An **abstract globe**, not a real map | *"I want abstract globe, not a real world map"* | the prototype's `grid.ts` |
| 7 | **Nothing past twenty falls back to the Pixi room** (2026-09-28). The rank and file go into the prototype's storey dropped across the lane, in three.js; the Pixi office unfold (§7.8.1c) is ruled out, and phase 3 comes before the staged first prestige, which needs the garage on screen at Run 1's bankruptcy headcount | *"I noticed when you hire 25 or more, then game went back to old pixi 2d scene, this is not wat I wanted"* | GDD §7.8.1c, amended when phase 3 lands |

**Not decided. Ask; do not assume.**

- ~~**Where the rank and file go at twenty-one.**~~ Decided 2026-09-28 (decision 7): the lane. Phase 2b's
  frames are still drawn, as the picture of what phase 3 builds, but they no longer ask a question.
- **The planet at rungs 4–6:** the prototype's cube-sphere of blocks (129,645 towers, exactly 10⁸) against
  the game's hundred-site globe. Phase 5 needs the answer; ask during phase 2's round.
- **Mo and Melany.** The rebuild cut them to five heroes and five trees; this repo has not (handoff §5).
  The user named three for the garage. Nobody gets a space the user has not named.

## 1 · Where things stand

| Piece | The game (`src/`) | The prototype |
|---|---|---|
| The garage | three.js (`three/render/garageView.ts`), shown only while `state.devs <= GARAGE_3D_DEVS` (20, `render/stage.ts:433`), as a texture inside the Pixi stage | the same garage, imported unchanged |
| Heroes in the garage | the founder and James (`GARAGE_LEADERS`, `three/sim/floorPlan.ts`). Billy, Serena and Matt have stations only on the office floor (`OFFICE_LEADERS`) | the founder and James |
| Tests for the three.js garage | **none here.** They stayed in the rebuild: `src/render/environments.test.ts`, `garage.test.ts`, `garageCamera.test.ts`, `src/sim/routeGeometry.test.ts` | — |
| 21 → 10⁸ | Pixi: room, the floor unfold, building, block, district, park, globe. About 18,000 lines across `render/room.ts`, `frames.ts`, `stage.ts`, `lens.ts`, `district.ts`, `building.ts`, `galaxy.ts`, `block.ts` | three.js: storeys dropped across the lane, a cube-sphere city, the monitor above 430 m |
| Above 10⁸ | a Pixi star field of sixteen worlds (`render/galaxy.ts`, `sim/starfield.ts`) | the colony map (`src/kit/network.ts`, `netview.ts`) |
| The lock | `maxZoomFor` (`sim/headcount.ts:244`) applied by `camera.setCeiling` (`render/stage.ts:1992`); the reveal when it lifts (`zoomCeilingLifted`, `stage.ts:1904`); pinned by `render/lens.test.ts` and `render/room.test.ts` | none |
| The address | `hud/Lift.tsx`, from the second storey on | the monitor's title bar, a legend and a light-year scale bar |

---

## 2 · The phases

Each phase ends playable, green on `npm run check`, and pushable to `main` on its own
(`git push origin proof/three-garage:main`). Where a phase changes what the player sees, open the game and
say exactly what was looked at; the gate says nothing about how the game looks.

### Phase 1 · Lift the lock — small, first, alone

The one decision that needs no concept and that the user can feel on `main` the same day.

1. `sim/headcount.ts`: `maxZoomFor` stops depending on the headcount. The ceiling becomes the top of the
   drawn ladder (`TOP_LEVEL`), or the function goes and its callers say `TOP_LEVEL`. `rungFor` stays: the
   rung still names the studio's unit, and §13.6.1's hero reach reads it.
2. `zoomCeilingLifted` becomes `rungPromoted(before, after)`. The pull-back when a hire crosses a rung is a
   §7.7.2 promotion beat and stays one. It is keyed on the rung, because there is no ceiling to lift.
3. `render/stage.ts`: `camera.setCeiling(maxZoomFor(state.devs) * 9)` becomes the whole ladder. The reveal at
   line 1904 calls `rungPromoted`.
4. **Every level at a headcount that has not reached it draws only what the studio has.** Walk desk → galaxy
   at 1, 20, 21, 100, 101, 10⁴, 10⁶ and 10⁸, and fix whatever breaks: a building of no storeys, a block of
   one building, a park with no campus. Nothing fake is added to fill a level; an empty rung is the
   studio's size, shown honestly.
5. Tests: re-pin `lens.test.ts` and `room.test.ts` on the new claim. At one developer the lens reaches the
   top level; pinching in always reaches James (§7.7.4). Delete the assertions that pinned the ceiling
   rather than bending them (§25.3.2: pin the claim).
6. `hud/Lift.tsx` is unchanged here. The monitor's address bar replaces its breadcrumb in phase 6.

**Done when:** at one developer, a scroll goes from the desk to the star field and back, every level
draws, and James is one pinch away. Push.

### Phase 1b · Decommission the Pixi stage first — 2026-09-28, done

The user: *"pixi scenes are supposed to be completed decommissioned. we should do that first if there
are gates/validation any productivity drags because of them"*, then *"the old city, campus, globe scenes
can all be cut made by pixi"* and *"the old pixi office scene was deprecated and cannot be used as
reference for new"*. Phase 8 moved to the front:

- `render/stage.ts` is three.js only: the garage drawn straight to the screen, the hand (tap, drag,
  pinch, wheel), the dialogue camera and James's drop, the music, and the store's tier and rung read
  off the garage's zoom.
- The glass (ART_DIRECTION §6) is `three/render/glass.ts`; bloom is in the garage's composer; the
  poke numerals are a canvas composited under the lines (`render/pokeText.ts`).
- Deleted: every Pixi scene module in `render/` (room, office, building, block, district, park,
  globe, galaxy, frames, lens, collapse, arrivals, tallies …), `hud/Lift.tsx`, the title's Pixi
  camera drift, the scale and reach probes, and `pixi.js` / `pixi-filters`.
- Until phases 3, 5 and 7 land, **the lens is the room**: past twenty the rank and file are not drawn
  and there is nothing above the street. GDD §7.4a and §7.8.1c say so.

### Phase 2 · The HQ concept — one round with the user, no game code

Two questions, answered together, drawn in the prototype (it imports the real garage, so bays drawn there
are drawn against the real room). Send screenshots; build nothing in `src/` until the user picks.

**2a · The heroes' spaces.** GDD §7.8.12 fixes what each holds: Billy the board he stands at, with the
stand-up huddle in front of it; Serena a wall of dashboards in the live phosphor; Matt a ticket wall and a
headset desk. Each space is built when its hero arrives and never before, and each gets a plate like the
founder's and James's (§12.11). What is open is *where*. Two layouts to draw:

- **A · a hero row: three bays behind the hero deck.** Push the back wall out behind the deck
  (`GARAGE_DECK`, x −9.88…1.6, z −6.38…−2.0) to the annex's depth, z −9.8, about 3.6 m a bay. **Each hero
  has a fixed bay** — Billy west, Serena in the middle, Matt east — and a bay is built when its hero
  arrives, so a run where Matt comes first has a back wall that steps in and out until the row is full.
  This is §7.8.12's own move (*the room cannot make space by shuffling anybody along, so it makes space by
  pushing the back wall out*), and it is the office's hero row brought home to the garage: the concept the
  user reviewed on 2026-09-25 (`docs/assets/concepts/empire-2026-09-24/hq-floor-v1.png`, built as
  `OFFICE_LEADERS`) puts the founder and James side by side along the back wall, Billy at the board,
  Serena among her dashboards and Matt in front of his ticket wall.
- **B · Billy at the west wall, Serena and Matt behind the deck.** The west wall's project board
  (`GARAGE_FURNITURE` `board`, x −9.72, z 0.5) is already where the garage's huddle stands (the
  `whiteboard` slots at x −8.5). Billy's space is that board, pushed out into a bay of its own through the
  west wall. Serena and Matt take two bays behind the deck.

**The recommendation is A**, and the one thing that decides where Billy goes is the stand-up, which needs
open floor in front of him. The deck is closed to routing (`gridFor` closes it; only pinned people stand
on it), and in front of most of it there is 0.7 m before pods 2 and 0 (`GARAGE_PODS` at z 0.4, 3.4 deep).
The exception is the deck's west end, x −9.4…−6.9, where the huddle already stands — facing the west wall
today. So in A, Billy's bay is the westmost, and the huddle turns north to face him instead of the wall.
B is the fallback if the turned huddle or the straightened back wall does not read.

Constraints either layout must respect, each already argued in `three/sim/floorPlan.ts`:

- the founder's desk (x −6.8…−4.0), James's (x −0.35…0.95) and the deck entry lane at x −3;
- the shelving on the west wall (x −9.6, z −6.1…−2.5) and the sofa (x −9.46, z 3.85…6.95);
- the annex's west return at x 1.5, and the window slots at (2.1, −9.1) and (2.6, −9.1);
- §12.1's camera: a piece of height *h* hides the floor swept *h* metres along (−1, −1). Far walls (north,
  west) are free to build on; near walls are not;
- the silhouette. Bays to z −9.8 straighten the back wall and lose the annex's step, which was deliberate
  ("the plan read as a classroom"). Keep the step in the roofline (lower, lighter bays: timber and glass
  against block), or stop the bays at z −8.8 so the plan keeps a one-metre step. Decide by looking.

**2b · The street past twenty.** Draw the prototype's storey across the lane behind the garage
(`lots.ts`'s `ACROSS THE LANE`, 32 × 13 m) against today's unfold, at 40 and 400 developers.

**Deliverable:** frames at 20 developers with 0, 1 and 3 heroes for layouts A and B, and at 40 and 400 for
2b, put on the brief as a new section, then one message to the user with the recommendation (A, and the
lane). Also ask about the planet (§0).

### Phase 3 · The garage stays

**Next, after phase 1b** (2026-09-28): the lane is decided (decision 7), so this no longer waits for phase
2's round. *"My direction is a dramatic funny expansion of the current scene, either a office floor drops
like james across the road or similar"* — designed from the current 3D garage and James's drop (it falls,
bounces once, throws up dust and shakes the camera), never from the Pixi office.

**Built, first pass (2026-09-28):** `three/render/laneStoreys.ts` and moving day in `garageView.setHeadcount`
(GDD §7.8.1c's built note). Steps 1 and 2 below are done for the lane plot; step 3's claims hold by construction
(the same seat numbers, and `workerLook` reads the seat) and `laneStoreys.test.ts` pins the layout. Still open:
the other eight plots of `lots.ts` once the lane's eighteen storeys are full, and the tower shader's windows for
storeys far from the camera.

1. `render/stage.ts`: the three.js garage stops being a ≤ 20 mode. It is the scene at the bottom of the
   lens at every headcount, and `GARAGE_3D_DEVS` goes.
2. If the lane is chosen, port `lots.ts` and the storey drop into `src/three/`: `world.ts`'s `applySet` and
   `updateDrops` (the storey falls, lands, squashes; dust and a small shake), the tower shader (`towers.ts`,
   where a window is a seat), people at desks (`people.ts`) and the dollhouse cut (`updateOpen`). The Pixi
   unfold (§7.8.1c) and office floor then retire for rungs 1–2.
3. Seats keep their faces, since `developerAt(seed, i)` never saw the room. `render/transition.test.ts`
   keeps the three claims of "The move out of the garage" (once, manufactures nobody, faces unchanged) and
   narrows the fourth to the rank and file, as the GDD now says: every ordinary developer moves, and the
   leadership stays.

**Done when:** at 1, 20, 21, 40 and 400 the garage is on screen at the bottom of the lens with the founder
and James at their desks, and the rank and file are wherever phase 2 decided. Look, and say what you saw.

### Phase 4 · The heroes' spaces

1. **Bring the garage's tests across first**, before any wall moves: the rebuild's
   `src/render/environments.test.ts`, `garage.test.ts`, `garageCamera.test.ts` and
   `src/sim/routeGeometry.test.ts`, re-aimed at `src/three/`. Today the three.js garage's layout has no
   automated net here, and this phase edits its outline.
2. `three/sim/floorPlan.ts`: `GARAGE_LEADERS` gains billy, serena and matt. The outline grows a bay per
   arrived hero, or is fixed with the bays shown by arrival (whichever phase 2 drew). `leaderDesks` and
   `heroDesktop` cover the new stations, and the bays join the deck as closed ground. `seatAt`'s fallback
   to `LEADER_STATIONS` goes, since the garage now seats everybody. Replace the stale comment quoting
   "§13.1: Garage leadership is exclusively the founder and James": it is the rebuild's GDD, and this
   repo's §7.8.12 says the opposite.
3. `three/render/garageEnvironment.ts`, `garageDetails.ts` and `garageCraft.ts`: draw the bays and their
   props, night-lit like the room. `garageView.setJames(here)` generalises to `setHeroes(arrived)`, and
   `showGarageStations` shows a hero's bay, station and plate when they arrive.
4. **The arrival is the gag.** The wall pushes out as the hero walks in, §7.7.2's construction joke at room
   scale: dust, a small shake, the plate lighting. Drive it from the existing arrivals
   (`game/storyTriggers.ts`, `game/scenes.ts`). Billy is the one hero somebody introduces, and James walks
   him in.
5. Tests pin claims: every hero station stands on the deck or a bay; no station, bay or prop overlaps a
   desk, pod or seat; the walkable floor stays one region (`walkableRegions`); no bay hides a seat on
   §12.1's camera (the `h` sweep); a bay exists only for an arrived hero.
6. 禁止穿模 is release-blocking and nothing automated checks it. Look at each bay with 1, 2 and 3 heroes, at
   night, from the default frame and fully zoomed in, and say what you looked at.

### Phase 5 · One three.js lens above the garage: the city and the planet

1. **Phone first.** Before porting, open the prototype on a real phone at 30M and 100M (the brief's links)
   and measure the frame time. The prototype's lite path (one pixel per pixel, no MSAA, bloom at half
   size; `boot.ts`) must hold 30 fps with all 129,645 towers instanced, or this phase changes shape before
   it starts.
2. Land decision 1's satire law first (handoff §8.2). The monitor's loss view colours every window by the
   seven slices, and those slices are not wired here yet.
3. Promote the prototype's kit into `src/three/` with tests:
   - `grid.ts`: the cube-sphere, 129,645 towers holding exactly 10⁸, as a pure function of the seed;
   - `towers.ts`: a window is a seat, a tower is as tall as its filled storeys, the dollhouse cut;
   - `ground.ts`, `people.ts` and `fx.ts`;
   - `lens.ts`: orbit, zoom to the pointer, Powers of Ten flights, the map regime, and `interrupt`, which
     turns a flight broken by a gesture into a map offset.
4. A `worldView`, the prototype's `world.ts` split into scene, sets, interiors, picking and labels, driven
   by the store instead of presets. The Pixi stage shows it the way it shows the garage today. Then retire
   the Pixi rungs above the garage one at a time: block, district, park, globe.
5. Tests: the tiling holds exactly 10⁸; seats map to towers one to one; FIND ANYONE lands on the seat it
   names and cuts that storey open.

### Phase 6 · The monitor

1. The phosphor pass: a third-resolution target sampled nearest. Each material's `uMode` (towers, ground,
   people, space) switches to phosphor, driven by the live entropy ramp.
2. The CRT refresh wipe as the hand-off, with hysteresis: in above 430 m, out below 330 m.
3. The address bar as a STUDIO_OS React component over the frame: `NETWORK > EARTH > CITY > HQ > GARAGE`,
   the current stop lit, each stop a flight. It replaces `Lift.tsx`'s breadcrumb above the block.
4. The scale bar and the legend.
5. Add the address bar, the scale bar and the legend to `scripts/ui-frame.acceptance.mjs`'s `COMPONENTS`
   and `PAINTED`. A surface not listed there has no gate, however wrong it is drawn.
6. ART_DIRECTION §1.0b's rules hold throughout:
   - marks are pixel art snapped to the monitor's grid;
   - borders are value 2, and value 3 is kept for glyphs and packets;
   - overlapping marks are laid over, never added.

### Phase 7 · The colony map and its worlds

1. `network.ts` into `src/sim/` (pure: stars, lanes, lane order, standing), with tests:
   - Sol is world 0 and Proxima Centauri world 1;
   - lanes never cross, and every system is reachable;
   - the order is a shortest-path tree from Sol;
   - it is the same for the same seed.
2. `netview.ts` into `src/three/render/`. The drawing in `render/galaxy.ts` and `sim/starfield.ts` retires;
   keep `starName` if the HUD still uses it.
3. The map regime in the lens:
   - a drag pans, and the camera swings over the pole on the way out;
   - `descend` builds the world under the view.
4. System cards as React in STUDIO_OS: standing, distance, light-lag, fill, newest arrival, ZOOM IN. There
   is nothing to manage on them (§7.7.1a: *Stellaris is the look, not the game*).
5. Streams and pings off the store's hires.
6. Worlds are built on demand (`colonyFor`: one visitor at a time besides Proxima b).
7. James's launch lands on the map's Proxima. §16.0a's light-lag comes from the system's distance.
8. **The map must not run out** (§7.7.1a, amended). The prototype stops at a hundred worlds; the game
   generates rings of systems as the territory reaches them.

### Phase 8 · Retire the Pixi ladder

**Done first, as phase 1b (2026-09-28).** Delete the Pixi rungs the three.js view replaced, with their
tests and `render/stage.ts`'s two-renderer glue. Write the retirement into the handoff: what each deleted
file did and what replaced it.

---

## 3 · Where this leaves the handoff's order (§8)

- **§8.1, decide the swarm:** done. It is the monitor.
- **§8.5, moving day and the HQ floor:** replaced by phases 2–4. There is no moving day.
- **§8.6, the swarm up to the planet:** phases 5 and 6.
- **§8.7, worlds, the launch and the galaxy map:** phase 7.
- **§8.2–8.4, the satire law and money, the trees, the Ledger HUD:** independent of this plan, except that
  §8.2 lands before phase 5.

## 4 · Traps this project has already paid for

- **`GDD.html` is CRLF throughout** (the `docs/*.md` files are LF). A patch script that writes `\n` rewrites
  all ~20,000 lines. Match on LF, write back CRLF, and check `git diff --stat`. Re-read every amended
  region afterwards; a Windows console mis-renders `§` and `—` even when the file is correct.
- **When the user overrides the GDD:** say so briefly, do it their way, and amend `GDD.html` in the same
  batch (CLAUDE.md).
- **禁止穿模 is checked by looking**, and the report says what was looked at.
- **Never edit the tree or `git stash` while `npm run test:ui-frame` runs.** It serves the working tree.
- **Never pipe `npm run check`.** The pipe reports its own exit code, so a failed gate reads as a pass.
- **The frame gate only measures the selectors in its lists.** A new HUD surface needs adding to them.
- **Tests pin the claim, not the value** (§25.3.2).
- **Debug seams go through `dev/debugAccess.ts`**, loopback only.
- **The game never calls the network.** Only the prototype's page is published.

## 5 · The first hour of the next session

1. Read this plan, handoff §10, and the GDD amendments of 2026-09-27 (§7.4a, §7.7.1a, the garage
   subsections of §7.8.1, §7.8.12).
2. Phase 1, pushed.
3. Start phase 2's frames, bring the garage's tests across (phase 4, step 1), which needs no decision, and
   send the user the round.
