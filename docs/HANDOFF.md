# Handoff — 2026-08-09

Short by design. **The detail lives in [`GDD.md`](../GDD.md), which is the single source of
truth.** This file is a status line, a list of traps, and what to do next.

---

## Read this first

**[`GDD.md` §23](../GDD.md)** — Technical Constraints & Build Readiness — carries the stack,
the five non-negotiables, the performance budget, and the build order. **The ADRs are frozen
history**; where they and §23 disagree, §23 is right, and no further ADRs will be written.

One command gates everything:

```bash
npm run check     # lint + typecheck + tests + the art gate
```

**815 tests.** Lint, types and the art gate clean.

---

## Where the project is

**Run 1 is playable end to end and the economy now closes.** Poke → ship *Flappy Square* →
hire James → ship again → Seed Round at 10 → hire to 40 → the offer appears → collapse →
bankruptcy → Paradigm Shift → **Run 2 with prestige bonuses**. Every number comes from the §4
simulation.

| | State |
|---|---|
| **Simulation** | Run 1 closed and simulated end to end (`runOne.test.ts` plays it) |
| **Prestige** | Layer 1 built — BP earned, banked, spent on the Paradigm Tree; 2 of 5 nodes wired |
| **Audio** | 13 SFX + 10 music stems generated and playing |
| **Art** | **0 of §22.7's 19 authored sprites.** Everything on screen is code-drawn from the palette |
| **Rungs** | 0–6 built (room, tower, block, business park, sprawl). **7–9 unbuilt** — nation, planet, galaxy |
| **The floor** | §7.8.1a's structure built — squads of 100, a floor of 10,000, corridors, the ×100 unfold. Desks no longer leave the plate |
| **Hero Cards** | §13.6's rules and data built and tested. **Not wired** — see below |

### Built this session

Developer identity (generated, never stored) · selection with the turn-to-camera · ambient
life · the god-mode floor (pick people up) · the hire dial · Act IIa/IIb + the Seed Round ·
the bait as a pull rather than a shove · the ship celebration · Layer 1 prestige · the music
bus + stems · horizontal desk rows · isometric props with contact shadows · **the desk unit
and the hop** · **§13.6 Hero Cards** (rules + data) · **§7.8.2 rungs 4–6** (the city) ·
**§7.8.1a/b/c — squads, the ten-thousand floor, and the unfold** (R4–R7).

### Specced, not built

- **§13.6 Hero Cards — the interface.** `sim/heroes.ts` now holds the ladder, the nine cards,
  the cost curves, the coverage rule and §13.6.4's dilution trade, all pure and tested. What
  is missing is §13.6.6: slots in the world, a card tray, and coverage *drawn* rather than
  stated. It is not wired to the store and should not be until it can be reached — cards cost
  GP, GP needs Layer 2, Layer 2 needs 100,000 BP. **Layer 2 is the actual blocker.**
- **§7.8.2 rungs 7–9** — nation, planet, galaxy. A different register from rungs 4–6 (a lit
  coastline, a world, a cluster, not more architecture), and §7.4's Level 3 and 4 tiers
  already hold that scale from the camera's side.
- **§13.2's other three Paradigm nodes** — they say *"not yet implemented"* on the card, which
  is deliberate: a tree that takes currency and changes nothing is worse than one that admits
  it.

---

## Do this next

**[`GDD.md` §25](../GDD.md) is the ledger — 18 requirements, tracked with status.** A row leaves
that table when the thing is built and *seen working*, not when it is specced.

Eight are done (R3, R4, R5, R6, R7, R11, R12, R13-partial). The rest sequence into the phases
below, and the sequence still matters more than the list: two of them rewrite the same files.

### ~~Phase 1 — the floor (R4, R5, R6, R7)~~ — **done 2026-08-09**

All four landed as one change to `render/room.ts`. Squads of 10 × 10, a floor of 10 × 10
squads with corridors, one reading order at both scales, and the ×100 unfold at the hundredth
hire. Seen working at 8, 40, 99, 110 and 120 developers.

**Three things a reader should know before touching it again:**

1. **The row width is a constant ten, and that is load-bearing.** The old square-footprint
   solve changed it at 7, 11, 13, 19, 25…, and every one of those hires picked up everybody
   already seated and moved them. It cost §7.8.1's "6–10: two rows" line, which is recorded in
   §7.8.1b along with why.
2. **R6 had two causes, not one.** The plate was sized `max(width, height)` for a block that
   is *sheared*, and separately the margin interpolated on an unbounded `n / 14` and went
   **negative** above fourteen developers once crowding flipped its target. Either alone puts
   desks over the edge.
3. **The unfold is not scored here on purpose.** A hundred developers is a §7.7.1 rung
   boundary, so `stage.ts` already fires the promotion stinger, the zoom reveal and the dolly
   on that hire.

Still open from R5: **zoom to any squad, poke any individual in it.** That is the camera's
half and it belongs to Phase 2.

### Phase 2 — the lens climbs the ladder (R8). Do this next.

Zoom out today and you arrive at a *galaxy*, skipping the building, campus and town that
`render/city.ts` **already draws**. §7.4a: rendering tiers are not navigation rungs, and the
camera has been using one as the other.

**Why now:** it is the cheapest large win left — the geometry exists and is tested; what is
missing is the camera visiting it. Phase 1 is underneath it, so the bottom of the climb is a
real floor, and R5's second half (*zoom to any squad*) is the same piece of work: `room.ts`
now knows which squad a seat is in, so a lens that can stop at one has a unit to stop at.

### Phase 3 — the clicker rework (R17, R10, R14, R15). The biggest design change.

In dependency order, because each is the previous one's payoff:

1. **R17 — per-developer output**, rolled from seat index and run seed, wide spread, **mean
   pinned** (§4.9a). This is the store change everything else needs: the store models *one*
   dev-state machine today, and per-person anything requires per-person state.
2. **R10 — `+1` over each head** (§8.2b). The display of R17, and the thing that makes the
   variance real rather than a hidden roll.
3. **R14 — a poke buffs that individual** rather than paying out once (§4.5a).
4. **R15 — poke any unit** on the ladder (§4.5b), with the buff percentage falling as the unit
   grows so "always poke the biggest thing" is never the answer.

**Why third:** it is the most valuable and the most invasive. It wants the floor structured
(Phase 1) so a "squad" is a thing that can be poked.

### Phase 4 — the economy reads honestly (R2).

Long-tailed randomised revenue plus the **revenue graph** (§4.10e). Independent of Phases 1–3;
pure economics and one HUD component, so it can be done in parallel or slotted whenever.

**The constraint that keeps it honest:** randomise the *shape*, never the *total*. A player who
ships the same game must not be able to be unlucky with it.

### Phase 5 — the rest

- **R9** — poke vs drag on touch (§7.7.6a). Small, and a shipping blocker for the god-mode
  floor. Could be pulled forward any time.
- **R13 remainder** — cash / developers / entropy keywords, and the §10.7 typed script.
- **R16** — the Founder's desk and coding tree (§4.5d). Wants Phase 3's poke model first.

### Blocked, not scheduled

| | Why |
|---|---|
| **R1 — music** | ElevenLabs quota exhausted (259 credits, 300 per stem). Only 3 of 10 stems carry the "upbeat" prompts. `/v1/music` still needs a paid plan. **And it needs ears** — `npm run music:check` proves a tune exists, not that it is good |
| **R18 — hero items** | Items equip to Hero Cards; cards cost GP; GP needs **Layer 2**, which does not exist |
| **Layer 2 — the Codebase Fork** | Now the keystone for the whole prestige half: Hero Cards are built and unreachable, three Paradigm nodes wait behind it, and R18 sits behind that. Pure economics (§13.3, §14.3) |

---

## Blocked on a human

- **ElevenLabs Music API** needs a paid plan. The ten stems currently come from the *free*
  Sound Effects endpoint, which §20.7.1a makes the correct choice for an ambient score rather
  than a concession — but nobody has listened to them yet. **Do `layer-strained` and
  `bed-desk` sit together without clashing?** That is the whole ten-stem design and it needs
  ears. `npm run music:generate -- --force <stem>` rerolls one.
- **§4.10d's cash curve** — the arithmetic is sound and the *shape* is lumpy: payroll is
  continuous, revenue arrives on ship, so the studio is overdrawn for most of every project.
  The readout no longer lies about it, but whether it *feels* right is a play-test question.
- **F1.3 age rating / target audience.** Still blocks ad configuration. Declaring child
  appeal bans personalised ads.
- **§23.3 criterion 2** (audio latency, needs an external capture) and **criterion 7**
  (never run in landscape). **The whole gate on a cheap handset** — everything measured so
  far is a flagship ceiling.

---

## Traps — read before debugging anything

Every one of these cost real time this session.

### 1. A stale `dist/` looks exactly like a bug that will not die

Six hours of fixes were reported as still broken. They were: `dist/` had been built that
morning and never rebuilt. **The HUD now prints the build timestamp beside the FPS counter** —
check it before believing a bug report, including your own.

### 2. Fix the *save*, not just the code

A bug was reported three times. Twice it was "fixed" correctly and uselessly, because the bad
state was already **written into the player's save** and every reload restored it.

> **A code fix that requires the player to clear localStorage is not a fix.**

`repairStrandedBait` in `save.ts` is the pattern: detect the impossible shape on load and
repair it, narrowly. And write the test **from the save file inwards** — *this is the state
that was on screen, this is what loading it must produce* — not outward from the function you
suspect. Writing it the other way round is why it survived two fixes.

### 3. `document.hidden` suspends the ticker

Chrome stops `requestAnimationFrame` in a background or minimised window. The React HUD keeps
rendering and `window.__store` keeps answering, so the app looks alive while the simulation,
camera and every animation are frozen. Check `document.hidden` — **not** `hasFocus()`, a tab
can be focused and hidden at once. Bring the window forward; there is no code-side fix.

### 4. Screenshots: use `npm run shot`, not the browser extension

The extension capture silently clips the right ~7% of the viewport — exactly where the
CASH/DEVS/SHIPPED rail lives, so every screenshot taken for review was missing a readout.

```bash
WAIT=9000 npm run shot -- "http://localhost:5180/?act=act3_bait&nopost" out.png 1280 620
```

**`WAIT` matters.** §10.7's typewriter runs at 28 chars/sec and Act III's advisor line is
~150 characters, so a capture at 2.5 s shows half a sentence and reads exactly like clipped
copy. It is not. Give any screen with script on it ten seconds.

### 5. A `?act=` seam that writes half a state is a lie you will screenshot

`jumpToPhase` set `projectIndex` on top of a fresh run and left `sprintName`, `commitment` and
`burned` at project 0's. The HUD then read **"FLAPPY SQUARE 1.0 · 915 / 1000 SP LEFT ·
+$25.0K IN 91s"** — three numbers from two different projects, a state the game cannot reach
in play.

That is worse than cosmetic, because trap 4 makes these seams *the way screenshots are taken*:
every frame reviewed from `?act=` was of an impossible studio, and its cash arithmetic was
being read as if it were real. `onProject(i)` in `store.ts` now sets all four together, the
way `shipProject` always did.

**A debug seam has to write a state the game could have arrived at.** Anything less and it is
generating bug reports rather than answering them.

### 6. Generated values are equal by content, never by reference

§7.8.7 generates identities on demand, so `identityFor()` returns a fresh object every call.
Latching one the way every other panel latches its subject (`if (who !== held) setHeld(who)`)
is an infinite render loop that blanks the whole app. **Key off the seed, not the object** —
and the same mistake in a `useEffect` dependency fails *silently*.

### 7. In `room.ts`, row 0 is the BACK row

`isoAt`'s comment said the opposite for months and the code always did this: `row` *increases*
y, so higher row index is nearer the camera. It happens not to matter, because it makes plain
index order the correct painter order — which is exactly why nobody noticed, and why anything
new drawn per seat gets its depth sorting for free as long as it is drawn **inside that
loop**. Draw it in a layer of its own instead and a back-row prop lands on a front-row
monitor.

### 8. Synthetic pointer events do not reach the canvas

Which is why `?select=4` exists, alongside `?overnight`, `?ad` and `?dialogue`. Add a seam
rather than fighting the automation; they have each paid for themselves.

---

## There is no CI, deliberately

`.github/` was **deleted**, not parked — everything a workflow would run is `npm run check`,
and the one check with no local equivalent (palette drift) now lives inside `art:check`.

Two hazards, both hit for real: pushing under `.github/workflows/` needs a token with
`workflow` scope, which this repo's Git Credential Manager token does not have and
`gh auth refresh` does **not** fix; and a committed workflow file rejects *every subsequent
push*, so the failure surfaces later on unrelated work.

**Revisit when a cloud agent first pushes code no human watched it write.**

---

## Running it

```bash
./start-dev.sh                 # the game, on a pinned port
npm run dev                    # same, if you want the raw vite output
npm run shot -- <url> <out>    # full-frame screenshot, no extension needed
npm run music:generate         # regenerate stems (needs .env)
```

The game is landscape-locked; a desktop window is the wrong shape to judge anything by.
**[LANDSCAPE.md](../LANDSCAPE.md)** has the DevTools presets — 997 × 448 @ dpr 2.25 is the
Pixel 8 Pro the §23.3 numbers refer to.

### Flags

| Flag | Effect |
|---|---|
| `?act=act2b_loop` | Jump the §21 script. Every phase name works |
| `?devs=300000` | Force a headcount — the only way to see §7.8.2's rungs. Brings cash and dev cap with it, or the studio bankrupts inside a tick |
| `?z=0.42` | Park the Omni-Lens, so a screenshot is of a *tier* rather than of wherever the camera drifted |
| `?select=4` | §7.8.8 — select a developer without holding on one |
| `?bench` | §23.3 acceptance run. `?bench=10` shortens the 60 s leg |
| `?nopost` / `?post=bloom,crt` | Drop or select post-process passes |
| `?overnight` · `?ad` · `?dialogue` | Preview those surfaces |
| `window.__store` · `window.__stage` | Dev builds only — live game and camera state |

**The `?act=` seam pins the phase on every reload**, which is how a debug URL left in the
address bar can look like a stuck game. `?act=` and `?bench` are unguarded and would ship in
a web build — see §23.5 item 2. On device there is no query string.

---

## Local-only

- **ElevenLabs generation** needs `.env` (gitignored). SFX and music are committed.
- **Android build, install and the `?bench` device run** need the SDK and a phone.
- **Anything that has to be looked at.** A cloud session should take the logic-heavy work —
  Hero Cards, §18 events, the remaining Paradigm nodes — all data plus tested logic.
