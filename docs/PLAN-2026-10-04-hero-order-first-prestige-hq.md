# Plan — 2026-10-04: who arrives when, what the first death teaches, and the HQ

Asked for by the user, in one message: *"vet the game, I want to ensure the first prestige death, James,
Billy, Serena are introduced in the correct place. First prestige teaches player too many devs are
counter productive, Billy is introduced when we know how to increase sync, Serena at where the pipeline is
not good enough and we are not earning fast enough because of no auto release. Matt is when we are drowned
with incidents. [...] we have not left places for all heroes except us and james in HQ, part of the task
here is to design the HQ as well. Next I want the HQ look and feel scales with how we progress from garage
to galaxy."*

Nothing in `src/` or `GDD.html` was changed by the vet. This file is the plan; the numbers below are a
measurement, with the caveats under "How it was measured".

---

## 1 · The vet

### How it was measured

A throwaway vitest (deleted; the working tree is clean) played Run 1 to bankruptcy, took the shift, then
played Run 2 for two simulated hours, logging the sim clock whenever a scene opened. The player is
`pacing.test.ts`'s: always present, 3 pokes a second, hires to 75.8% of cap, buys Serena's cheapest node.
**Two things it flatters, so read every time as optimistic for the player:** it releases the shelf the
instant a build lands (so SHIP! tedium and a stalled floor are never felt), and it never over-hires (so
Melany and Billy's cap-based triggers are never met).

| When (sim) | Scene | State |
|---|---|---|
| Run 1 0:18 | James arrives | 50 pokes |
| Run 1 1:18 | James explains SHIP! | first ship |
| Run 1 3:30 | Mass Hire pitch | 3 games shipped, ~$52K |
| Run 1 3:48 | **bankrupt** | 18 s after the signature |
| Run 2 0:00 | Instant Messenger | — |
| Run 2 1:06 | Mo **and** James promoted | 1 dev, same frame |
| Run 2 3:24 | **Matt** | **6 devs**, no incident |
| Run 2 4:18 | The Thread | 12 devs |
| Run 2 4:54 | Founder board | 40 devs |
| Run 2 43:18 | **Serena** | 80 devs, 19 shipped, first incident |
| Run 2, 2 h | **Billy, Melany: never** | 80 of 105 |

### Verdicts

**1. The first death does not teach "too many developers is counter-productive".** It happens, on time, and
the lesson does not land.
- Run 1 forbids hiring (§21.0e). The player never forms the belief §21.0 says the trap needs ("more
  developers, more speed — built out of evidence"), and never sees a curve: 1,000 developers on a cap of
  100 is η = 1e-5, so the studio goes from fine to seized in one frame.
- The receipt's only line is *"Manpower without Communication Infrastructure is Chaos"* — a lesson about a
  missing *tool*, not about headcount. `lesson.optimum` ("Past three quarters of capacity, every hire makes
  the studio slower") is the line the user wants and `lessonFor` can never show it at shift 1.
- The collapse is not staged in 3D (Act IV visuals went with Pixi; queued item 3). The player watches
  numbers on a rail.

**2. James: right.** Act I, a free second desk, the constant in every run. One side finding: *James
promoted* ("Global Head of His Desk") fires on the second arrival, which is the same frame as Mo — two
scenes back to back, and a joke about *global* before there is anything global.

**3. Billy: wrong place.** `billyArrives` is "sync ≤ 50% for 20 s", and sync = ½ is exactly D = D_cap. A
player who reads the speedometer stops at 0.758·cap and **never meets him** (measured). He is a punishment
for over-hiring, he arrives in the same instant as Melany (the code spends a paragraph keeping them apart),
and he is not the answer to anything the player has just learned. The Thread (~4 min) is where the player
learns sync can be raised — by buying a protocol. That is when he belongs.

**4. Serena: wrong place, and the code already knows.** Her scene says *"your build queue is three slots
and a human. I can make it ship itself"*; her trigger is the first incident (43 min, or never). Meanwhile
`pipelineOpen()` is "Serena has arrived", so **for the first 43 minutes the pipeline board, the queue graph
and Auto-Ship do not exist** and SHIP! is hand-pressed on a three-slot shelf. The user's trigger — the
queue is the bottleneck and hand-releasing is why we are not earning — is the feeling this scene was
written for.

**5. Matt: far too early, and for the wrong reason.** 3:24 on six developers from 30 s of unserved tickets.
The user wants him when incidents drown us, which today is a Serena condition.

**6. HQ has seats for three of seven.** `LEADER_IDS` is founder, james, billy, serena, matt. Mo and Melany
have no station anywhere. `GARAGE_LEADERS` is founder and james; Billy, Serena and Matt exist only on the
`OFFICE_*` floor, which no longer has a place in the game. The plan doc left Mo and Melany open ("Nobody
gets a space the user has not named"); *"all heroes"* names them.

---

## 2 · Where this disagrees with the GDD (say it, do it the user's way, amend)

| Section | Says today | Becomes |
|---|---|---|
| §21.7.3, §22.8 — Billy's row | "The first sustained collapse of sync outside Run 1 — and James knows a chap" | after the Thread is cleared by purchase, with sync visibly off |
| §21.7.3, §22.8 — Serena's row | "The first incident to suppress a release's tail" | the shelf is the bottleneck: floor stopped on a full shelf, or N hand-releases |
| §21.7.3, §22.8 — Matt's row | "The first sustained unserved ticket queue" | incidents (and tickets) piling up past what the founder can carry |
| §21.7.6 — instruments | defects→Mo, incidents→Serena, tickets→Matt | defects→Mo, **pipeline→Serena**, incidents+tickets→Matt |
| §10.7 — Serena's gate | pipeline board opens on her arrival | unchanged, but she now arrives ~40 minutes sooner |
| §15.1a, §21 Act V — lesson | "Manpower without Communication Infrastructure…" | headcount's curve, in plain words, with the run's own numbers; infrastructure becomes the second line |
| §7.8.1, §7.8.12 — the HQ | founder, James + three bays (Billy, Serena, Matt) | seven stations; Mo and Melany named |

Each is amended in the batch that changes the code, marked `[amended 2026-10-04]`, with the argument kept.

---

## 3 · Decisions I need (defaults in bold; I will proceed on them)

1. **Matt vs Serena after the swap.** The incident list is Serena's today (trait *WROTE THE RUNBOOK*).
   **A: Matt takes incidents and tickets** ("everything that lands on you after a ship"); Serena takes the
   pipeline and her trait is rewritten to be about it. B: Serena keeps the incident trait and instrument,
   and only her *arrival* moves. A matches *"Matt when we are drowned with incidents"* literally; B is less
   rewriting.
2. **"When we know how to increase sync."** I read it as *after the player has bought their first
   communication protocol*, i.e. The Thread cleared by purchase. If you meant something later (a second
   protocol, or sync back above 90%), it is one predicate.
3. **Mo and Melany's spaces** — the layout in §5 below, or tell me where.
4. **Wave-in for the Mass Hire** (§4) changes one canon sentence: today the thousand land at once.
5. Whether `James promoted` should wait for the third arrival (side finding; **yes**).

---

## 4 · Phase 1 — the first death teaches the curve

The hire stays a single signature and a single transaction. What changes is what the player *sees* of it.

1. **The thousand arrive in waves** (ten waves of a hundred, ~0.8 s apart, in the three.js lane storeys:
   staged with the queued "hire drop"). The speedometer and `Velocity` readout tick on each wave, so output
   **climbs, peaks near 76 developers, and falls to nothing** — §4.1 as an event. A `PEAK OUTPUT` flag on
   the way down is the whole lesson in two words. In the store this is `massHireWaves` applied over ticks
   (`massHire()` and `checkOnboarding` read it); payroll and the bankruptcy threshold are unchanged.
2. **The receipt says it plainly, from the run's own numbers.** `lesson.entropy` text (id never renumbered)
   becomes *"Past what a studio can coordinate, every hire makes it slower."* The bankruptcy
   panel gains one measured line — *"2 developers: 21 SP/s. 1,002 developers: 0.0 SP/s."* — and, optional, a
   small output-against-headcount plate with the player's two points and the peak marked. Infrastructure is
   the *second* line (it is the way out, and Run 2's first beat is Instant Messenger).
3. **`lessonFor` shows `lesson.optimum` on a later shift that earned it**, unchanged; shift 1 keeps
   `lesson.entropy`, now worded as the curve.
4. **Stage the collapse in 3D** — the queued item 3 (hire drop in reverse on the way out, CRT wipe, receipt,
   *"You again."*), amending §15.1a / §21 Act V / §21.6.
5. Tests pin claims: output over the ten waves rises then falls with its maximum below the cap; the receipt's
   two numbers are the run's; the id set of `LESSONS` is unchanged.

## 5 · Phase 2 — the order in Run 2

Target order: IM → Mo → The Thread → **Billy → Serena → Matt** → Melany at the cap.

1. **Billy** — `StorySnapshot` gains `threadClearedByPurchase` (the scene id is already in `milestones`) and
   uses `entropy ≥ CHATTY` held for `BILLY_SUSTAINED_S` (the gauge is visibly off and the player already
   knows a fix). Rewrite the scene's opening: the machine states the live reading rather than "sync halved",
   and James is no longer reacting to a collapse. `BILLY_MIN_SHIFTS` stays. The Melany/Billy collision
   paragraph goes, because they no longer share an instant.
2. **Serena** — `StorySnapshot` gains `shelfFullFor` (seconds the floor has been stopped by a full shelf) and
   `handReleases` (SHIP! presses this run). Arrives when *either* `shelfFullFor ≥ ~15 s cumulative` or
   `handReleases ≥ ~8`. The second door matters: an attentive player never stalls the shelf and would never
   meet her. Both numbers are first passes, marked as such.
3. **Matt** — `incidentsOpen ≥ N` or `(incidents + tickets) unserved ≥ 30 s`, **and Serena has arrived**
   (the order is the design). Incidents must actually pile up by then: measure the incident rate against the
   new order first (below) and tune §4.12a's catalogue, not Matt's threshold.
4. **Instruments**: `Instrument` gains `'pipeline'`; Serena brings it (the build-queue graph and SHIP!'s
   auto lane), Matt brings `'incidents'` and `'tickets'`. `pipelineOpen()` already reads her arrival.
5. **Traits and flavour** (decision 1): rewrite Serena's trait to the pipeline, move *WROTE THE RUNBOOK*'s
   on-call share to Matt, update `heroRoster.ts`, `HeroCard`, the GDD §22.9 cards.
6. **James promoted** waits for the third arrival.
7. **Measure it again, properly.** Promote the throwaway probe into `pacing.test.ts` with a policy that
   (a) hand-releases on a human cadence (not instantly) and (b) can over-hire, and assert **the order, not
   the times** (§25.3.2): Mo < Thread < Billy < Serena < Matt, Melany only at the cap. Print the table so the
   next person sees which curve moved.

## 6 · Phase 3 — the HQ

### 6a · The garage is the HQ, and it needs seven stations

Founder, James, Billy, Serena, Matt, **Mo, Melany**. The garage's two *far* walls (north and west on
§12.1's camera) are the only ones that can be built on without hiding a desk, so bays go there.

| Hero | Where | What is in the space | Reads as |
|---|---|---|---|
| Billy | back wall, west bay (the huddle already stands there and turns north) | the board he stands at | plywood lean-to, a rota |
| Serena | back wall, middle bay | dashboards in live phosphor; her **build-queue graph on the wall** | one monitor too many |
| Matt | back wall, east bay (against the annex step) | ticket + incident wall, headset desk | a landline |
| Mo | west wall, a bay pushed *through* it (x −13…−10) | a test bench: the phone rig, a device wall, a button that has been pressed twice | a bedroom's worth of phones |
| Melany | north-east, beyond the annex (z < −9.8, x 5…10) | a rack and a meter that only goes up; a dish on the roof | cloud, invoiced monthly |

Each is built **when the hero arrives, not before** (existing canon), with the construction gag at room
scale: the wall pushes out as they walk in, dust, a small shake, the plate lights. James walks Billy in.

The earlier plan (`PLAN-2026-09-27`, phase 2) already drew layouts A and B for three bays and recommended A.
This extends A. **Concept frames first, no game code:** 0 / 1 / 3 / 5 heroes at night from the default
frame, shown to the user before any `src/` edit (the same discipline as phase 2). Open to look at: A's
straightened back wall loses the annex's one-metre step, which was deliberate; keep it in the roofline.

### 6b · Code

- `sim/hq.ts` (pure): `hqStage(heads, arrived) → { tier, bays }`. One authority for what the HQ is at a
  given size and who is in it. `floorPlan.ts`'s `LEADER_IDS` → seven; `GARAGE_LEADERS` gains five; the
  `OFFICE_*` leaders and `placeFor` are deleted once the lane storeys land (verify nothing reads them).
- `leaderDesks`, `heroDesktop`, `seatAt`'s fallback and the stale "founder and James only" comment.
- `garageView.setJames(here)` → `setHeroes(arrived)`; `showGarageStations` per bay.
- Tests pin claims: every station stands on the deck or a bay; none overlaps a desk, pod or seat;
  `walkableRegions` stays one region; no bay hides a seat on the camera's sweep; a bay exists only for an
  arrived hero; stage is monotonic in headcount.
- 禁止穿模 is looked at, not tested: each bay at 1, 3 and 5 heroes, by night, default frame and fully
  zoomed in, and the report says what was looked at.

### 6c · The HQ scales from garage to galaxy

One rule: **the HQ is the one place on every rung that is recognisably the same place.** Three things
persist at every scale — the roll-up door and its signboard silhouette, the six hero branch colours
(`heroBranches.ts`), and the founder's and James's plates. Everything else is the *materiality* of the rung.

| Rung | View | The HQ is | Material / feel |
|---|---|---|---|
| 0–1 · 1–20 | room | the garage; each hero a bay | concrete, plywood, a lamp. Improvised: every bay a different cheap material |
| 2 · 21–100 | lane storey | the garage plus the first storey across the lane | the bays are fitted out; the sign says HQ; fluorescent against block |
| 3 · 101–1K | tower | the original garage at the tower's foot, kept; the leaders' floor at the top | glass and steel; the garage gets a glass case and a plaque |
| 4–5 · block, campus | block / park | the garage as the campus's heart; each bay grown into a wing | **each hero's wing is their branch colour**: QA lab, NOC, support centre, ceremonies hall, data centre |
| 6–7 · town, nation | sprawl / grid | the landmark tower, the only one with the plates | STUDIO_OS phosphor begins (decision 1 of the garage-to-galaxy plan); HQ is the brightest node |
| 8 · planet | cosmic | the capital: a lit site with the roll-up door's glyph | settlement light, one gold marker |
| 9 · galaxy | colony map | Sol, the origin glyph; every colony's local HQ echoes it smaller | the colony map's border starts here |

The transitions already exist as the address bar (`NETWORK > EARTH > CITY > HQ > GARAGE`). The work is a
`hqLook(rung)` that the city, park and map renderers read for palette, glyph and landmark, so "HQ" is
drawn by one function at every scale and cannot drift. Concept frames for rungs 2, 4, 6 and 9 before code.

## 7 · Order of work and what "done" means

1. Decisions (§3) — one message.
2. Phase 2 sim + tests + GDD amendments (small, pure, reviewable; changes the order of the game).
3. Phase 1 (the death), Phase 3 concept frames in parallel.
4. HQ code once the frames are chosen; then the rung ladder.
5. `npm run check` in the background (never piped), with the working tree untouched while the frame gate
   runs. There is no walk gate, so each claim is made by driving the browser and saying what was driven:
   Run 1 to bankruptcy (watch the curve peak), Run 2 to Billy, Serena and Matt in order, each bay at 1/3/5
   heroes, and the HQ at rungs 0, 2, 4, 6, 9.

---

## 8 · Status, end of 2026-10-05 — what was built, and what changed on the way

Built and verified (`npm run check` green, 126 browser screens; arrivals, liquidation and the survey driven in Chrome):

- **Hero order and triggers** (§5): Billy → Serena → Matt, pinned by `arrivalOrder.test.ts`. Matt's door is two open incidents (or one plus an unanswered queue), a minute behind Serena; §4.12a's ι was raised from 0.1 to 0.6 *because it was measured that incidents could never pile up* (one open at worst over an hour).
- **The first death** (§4): eleven log-spaced waves (the first draft's equal waves stepped over the peak), the "work done vs developers" plate, the receipt's two sums, and now **the liquidation** — James's line, the garage emptying, every house lifting off on its thrusters — then the receipt, then James dropping into Run 2.
- **The HQ** (§6) — **built six times in two days, each on what the user said of the last** — and the principle held through all six: a hero is the instrument they brought, and each set is a live readout drawn from the HUD's own numbers (`render/hqReadouts.ts`). *"I don't see any heroes … current HQ is rubbish"* → one terrace along the north wall with the three in a row. *"just line them up like that is boring … assume you are an architect and interior designer"* → each hero in a place of their own (drawn by `scripts/hq-plan.ts` from `floorPlan.ts`). *"a bit too clustered, the ME … top left … Billy … he doesn't need a crowd"* → the pair untouched, Billy alone. *"I asked founder on top right, his desk redesigned, mat got so sqaushed and we can do without the kitchen now. I still don't like all of these, do another version"* → the boss in the north-east corner, the kitchen gone, a redesigned desk, Matt given room. *"I want to be at top left, at the top of the topology, fix that now"* → the boss and James on an oak deck in the NW corner, the three heroes along the north wall. *"I want the me even more promenant, on a platform. also I see the wall are tool low, make them higher. billy should face us and he's too short, design again … put billy in the mix of devs so he's not just meetinging himself, do another cut, you can enlarge the room if it make sense"*, and in the same turn *"make brighter and don't have the screens to be only light emitter, the company sign needs to be ligth up too"* → **the one that stands**: the founder on a 1.2 m walnut podium in the NW corner, the desk square to the walls facing the room like Matt's and Serena's, the credenza against the north wall, a standing lamp at each back corner and the studio's name lit on the wall above; James on a 0.24 m deck at its foot; the **back walls 4.6 m** (were 3.2) with a clerestory ribbon, the near walls untouched (§13.1); Matt's Front Desk (a ticket wall that goes up to the glazing) and Serena's Ops Room (0.9 m plinth, a 2.2 m wall of six) along the north wall; **Billy on the open floor in the avenue between the two north pods** — a rolling board turned to the lens, he on a dais facing us, and **taller** (a standing bean has no legs, so he was 1.1 m among seated heads at 1.7; he has a block of trouser now). The room is lit — six lamps, standing lamps, sconces, pools on the floor, a lit sign inside and out — mean luminance 71.5 → 104 of 255 with the street still dark. **The room was not enlarged:** the HUD's log covers the bottom third of the picture, so a floor added toward the lens would be drawn under it; the pods were spread instead. **The walk grid found a flaw the eye did not:** the first plaza shut the avenue and split the studio in two (`walkableRegions` said four, and a planter and the reading bench had walled off the south-east corner); the plaza is 2.67 m across with a lane either side, and `heroRow.test.ts` pins one region. **No kitchen, no shelving:** a cooler for the water errand, and the window errand is the street door's glass. Arrival: Billy first, no wall (his rug, board and dais drop in with him); Serena behind the old wall (4.4 m, with an east return) and her step comes with her; Matt last, no wall, his riser with him. `hqSets.test.ts` *measures* every set against its site (and that Billy faces the lens and stands on his dais); `heroRow.test.ts` pins the plan (the founder the highest station in the picture, on the highest platform; Billy on the open floor with a pod within a stride either side; a metre between neighbours; nothing on a site; **no errand on a terrace**; **one walkable region**). GDD §7.8.12 has the principle, the rules and the rejected sites. *Open:* the walls are higher only where they are *back* walls — if the user meant all four, a near wall hides the desks behind it along the camera's diagonal (GDD §7.8.0b), and that is a question to ask rather than a thing to try. And the 2026-10-05 sixth cut has only been looked at in a browser, not played: nothing now plays the game end to end (the walk gate is deleted). **2026-10-07, *"not toward james, I mean facing down right, the isometric way, like matt and serena"*:** the founder's whole station (desk, credenza, rug, chair, person) is square to the walls and faces the room like Matt's and Serena's; the diagonal corner office and a turn toward James were both tried and dropped. (*Down right* on this camera is +x, where James faces; Matt and Serena face +z, the lower left. The named reference was followed.)
- **The pixelated view is gone** (2026-10-05, *"remove the pixelated view? that doesn't actually work"*): the room is drawn at device resolution again, linearly filtered, 4× MSAA (2× on a phone) — the 2026-10-02 pixel grain had drifted from §7.7's 2026-09-30 line, which already said the scene keeps device resolution; GDD §7.7 records it. Left alone on purpose: the HUD's pixel font, the pixel icons, the cover art and the CRT scanlines (which the `C` key takes off in a local session). If *pixelated* meant one of those, or the colony map's grid, it is still there.
- **The HQ ladder** (§6c): `sim/hqLook.ts` owns the stages and the heroes' colours; built on the survey (the HQ mark gains borders and a crown, one pip per hero; Sol wears the colours). The storey/tower/campus *as 3D buildings* wait for the city phase — `endlessCity.ts` is not instantiated in the game.
- **Found by playing, fixed:** most upgrade nodes sold nothing (now refused until built; the founder's, Matt's, James's and Billy's trees wired); TAP/CODE label clash; velocity in scientific notation; DEVS 0 with two people; the next hire's worth on the button.

Decided, not built: nothing in §3 remains open. Left alone on purpose: the queue's "FULL IN" (measured accurate), the SHIP! chore (eight presses by minute fifteen is not a chore), the money trap (the runway readout exists), and declining the Mass Hire (possible, and a plateau by design — verified in simulation: $1.9M at minute 30 with nothing to spend it on).
