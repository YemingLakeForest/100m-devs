# Handoff — 2026-08-10

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

**995 tests.** Lint, types and the art gate clean.

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
| **Rungs** | 0–6 built and the lens visits every one (§7.4a). **Rungs 0–2 are all the room** — a desk, a huddle and a full floor of a thousand, with walls, plates and individuals throughout. 7–9 have no geometry of their own; §7.4's grid and cosmic tiers stand in |
| **The clicker** | Per-developer output (§4.9a), the `+1` over each head (§8.2b), and **a poke that buffs what it lands on rather than paying a coin** (§4.5a). **Any unit is pokeable** — a person, a storey, a building — so a tap at rung 4 finally does something (§4.5b). R14 and R15 done |
| **The economy** | Long-tailed revenue with a back catalogue, and the graph that shows it (§4.10e) |
| **The floor** | §7.8.1a's structure built — squads of 100, a floor of 10,000, corridors, the ×100 unfold. **Rows now run along the floor**, parallel to the wall and across the way people face, as one continuous desk bank. **The bank is set back from the seats**, so people sit *at* their desks rather than on them |
| **Hiring** | Three things fall — a desk, a computer, **the actual generated developer** — on the seats the hire actually took, and the room withholds a seat until its arrival lands |
| **The readouts** | §10.1's rail plus §4.10e's revenue graph, in **two full-height rails with the copy between them** — nothing in a rail can collide with another rail or with §21's script at any frame height in the box. **MAN-WEEKS is gone**, withdrawn by the author of the idea |
| **Hero Cards** | §13.6's rules and data built and tested. **Not wired** — see below |

### Built this session

Developer identity (generated, never stored) · selection with the turn-to-camera · ambient
life · the god-mode floor (pick people up) · the hire dial · Act IIa/IIb + the Seed Round ·
the bait as a pull rather than a shove · the ship celebration · Layer 1 prestige · the music
bus + stems · horizontal desk rows · isometric props with contact shadows · **the desk unit
and the hop** · **§13.6 Hero Cards** (rules + data) · **§7.8.2 rungs 4–6** (the city) ·
**§7.8.1a/b/c — squads, the ten-thousand floor, and the unfold** (R4–R7) · **§7.4a the lens
climbing the ladder** (R8, and R5's camera half) · **§4.9a per-developer output** (R17) ·
**§8.2b the `+1` over each head** (R10) · **§4.10e long-tailed revenue and its graph** (R2) ·
**§7.7.6a poke vs drag on touch** (R9) · **the floor put back into its own
projection**, the **hire animation rebuilt out of three falling things**, the
**title screen's near field cut back**, and a
**speech bubble that pops instead of zooming** — all reported by eye, none of
them catchable by a test. Recorded as traps 10–13.

Then, all five reported off a phone in one go: **the desk set back from the
seat** (people were drawn standing on their own tables) and **dressed** —
keyboard, mouse, mug, papers, sticky note, lamp, legs, seams, a contact
shadow, all rolled per seat and stable across rebuilds · **props moved onto
the two back walls** with their back faces against the skirting, instead of
spread round a perimeter ring that put a water cooler in the dark past the
front corner · **a skirting board** along both back walls, which is what gives
the wall/floor junction an edge and the wall a scale · **MAN-WEEKS removed** ·
and the **HUD rebuilt as two full-height rails**. The last one is worth reading
the note on `.hud` for: the readouts overlapped on a 336 px-tall handset, the
first fix moved the collision one level out into §21's copy, and the
arrangement that actually holds is rails owning their columns outright with the
script in the middle. Verified by measuring every readout, control and line of
copy against every other one across eight acts and seven frame sizes.

Then **R14 and R15 — the clicker rework**, which are one piece of work. A poke
raises the output rate of what it landed on and fades over about fifteen
seconds, and what it lands on is whatever §7.7.1 has the camera holding.

Two things are worth knowing before touching either.

**The buff strength is solved, not chosen.** A buff of strength `s` on a unit
producing `u` story points a second delivers `s·u·τ` over its life, so the
points §4.5's formula already produced are converted *back* into the `s` that
pays them. That is why §4.10 needed no rebalancing — §4.5a only ever asked for
the *destination* of the number to change — and it is why picking a percentage
would have been the wrong move even though it is the obvious one. It also hands
§4.5b its "the buff percentage falls as the unit grows" rule for free: a unit of
`n` people produces about `n` times as much and a poke on it is worth about
`Z(n)·n`, so `s ∝ Z(n)` with no second curve to tune or to disagree with §4.8.

**Nothing is lost at either end**, and both ends needed work. A unit already at
the strength ceiling overflows back into the instant payout, and an expiring
buff hands back what it still owed — that second one matters more than it looks,
because the loss would otherwise have scaled with headcount. See trap 17.

Verified in the running game rather than only in tests: five taps on one
developer read `+69%` and decay to `+2%` over eighteen seconds with the
neighbours untouched, and a tap at rung 4 buffs one building of ten thousand by
10%.

### Specced, not built

- **§13.6 Hero Cards — the interface.** `sim/heroes.ts` now holds the ladder, the nine cards,
  the cost curves, the coverage rule and §13.6.4's dilution trade, all pure and tested. What
  is missing is §13.6.6: slots in the world, a card tray, and coverage *drawn* rather than
  stated. It is not wired to the store and should not be until it can be reached — cards cost
  GP, GP needs Layer 2, Layer 2 needs 100,000 BP. **Layer 2 is the actual blocker.**
- **§7.8.2 rungs 7–9** — nation, planet, galaxy. A different register from rungs 4–6 (a lit
  coastline, a world, a cluster, not more architecture). §7.4's grid and cosmic tiers stand in
  for them and **the camera now stops at all three**, so this is no longer a hole in the
  ladder — it is three views that are placeholder art rather than three rungs that are
  missing. `sim/ladder.ts` names them `grid` and `cosmic`; giving them real geometry is
  swapping what `scene.ts` builds for those keys and nothing else.
- **§10.9.6's near field is now nearly invisible, and that is the safer end.**
  It was a hard-edged black slab over a third of the title screen — asked about
  as "what is that" — and is now a heavily blurred crop running off two edges
  with a lit rim. It reads as depth rather than as a fault, but whether it still
  does the compositional job §10.9.6 wants is a question for eyes.
- **§13.2's other three Paradigm nodes** — they say *"not yet implemented"* on the card, which
  is deliberate: a tree that takes currency and changes nothing is worse than one that admits
  it.

---

## Do this next

**[`GDD.md` §25](../GDD.md) is the ledger — 18 requirements, tracked with status.** A row leaves
that table when the thing is built and *seen working*, not when it is specced.

Thirteen are done or partial (R2–R13, R17). **Four are left and they are one piece of work
plus three loose ends.**

### ~~Phase 1 — the floor (R4, R5, R6, R7)~~ — **done 2026-08-09**

Three things a reader should know before touching `room.ts` again:

1. **The row width is a constant ten, and that is load-bearing.** The old square-footprint
   solve changed it at 7, 11, 13, 19, 25…, and every one of those hires picked up everybody
   already seated and moved them. It cost §7.8.1's "6–10: two rows" line, recorded in §7.8.1b.
2. **R6 had two causes, not one.** The plate was sized `max(width, height)` for a block that
   is *sheared*, and separately the margin interpolated on an unbounded `n / 14` and went
   **negative** above fourteen developers. Either alone puts desks over the edge.
3. **The unfold is not scored there on purpose.** A hundred developers is a §7.7.1 rung
   boundary, so `stage.ts` already fires the promotion stinger and the dolly on that hire.

### ~~Phase 2 — the lens climbs the ladder (R8)~~ — **done 2026-08-09**
### ~~Phase 4 — the economy reads honestly (R2)~~ — **done 2026-08-09**

### ~~Phase 3 — the clicker rework (R14, R15)~~ — **done 2026-08-10**

### Phase 6 — the 2026-08-10 intake (§25.3). Do this next.

**Eight requirements (R19–R26) arrived in one message, and every one is specced
in the GDD and built nowhere.** §25.3 is the ledger row for each; the sections
an implementer should actually read are **§4.11** (roles), **§4.12** (defects),
**§4.13** (support), **§4.14** (the rating), **§13.7** (a hero class per role,
and the Management tree), **§13.8** (placement as the minigame), **§7.8.10**
(where you sit) and **§7.8.11** (a hero visible from orbit).

They are not eight separate features. They are **one system seen from five
sides**, and reading them as separate work is the way to build it wrong:

> Developers stop being interchangeable (R19) → the roles that appear are the
> ones that answer two new ways to fail, defects (R21) and tickets (R22) → what
> those failures cost is a **rating** (R23), the first number in this game that
> can go *down* while everything else goes up → heroes gain a class per role and
> a tree each (R24), placed on the floor as the management game (R25) and
> visible from every rung (R26) → and **you** (R20) are the one person with all
> five classes who is bad at all of them.

**Start with R23, the rating.** It is pure economics — no art, no interface, no
renderer — and every other item in the batch is scored by it. Building R21's
defects first means guessing what a bug is worth, and a guess made at that point
becomes canon by accident. R21 is the natural second: it is the thing R23
measures, it runs headless, and its coefficient is the batch's one genuinely
load-bearing number.

**R25 is last on purpose.** It needs a floor that already has roles on it, rows
worth assigning somebody to, and a rating that makes a placement right or wrong.
Built first it is a card that goes in a slot for no reason — which is what
§13.6.6 already is, and is exactly why that section has sat unbuilt.

§25.3.2 lists the three numbers this batch deliberately does *not* decide (the
role ratio, the defect coefficient, the rating's weights) and the one rule that
must not drift: **none of it may become a fail state.** §6.3's Entropy Lock is
the game's one seizure and it is load-bearing.

### Phase 5 — the rest

- ~~**R9** — poke vs drag on touch (§7.7.6a)~~ — **done.** Needs a phone to judge the tick.
- **R13 remainder** — the entropy and developers keywords, and the §10.7 typed script. Cash
  landed with the revenue graph's readout.
- **R16** — the Founder's desk and coding tree (§4.5d). **R14's poke model now
  exists, so this is unblocked** — and R20 has since decided the two things
  §4.5d left open: the desk sits at the corner facing the floor (§7.8.10), and
  the tree is §13.7.1's Management class. Build R16 and R20 together; they are
  the same desk.

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
- **§4.10e's tail, now that it exists.** §4.10d's lumpiness is *fixed* — the catalogue pays
  continuously and the graph draws it — but the constants are a first pass. A launch spike of
  4–8 s over a tail of 30–70 s was chosen so Act IIa's "ship, earn, hire" stays playable, and
  whether the back catalogue *feels* like a back catalogue is a question for a person, not a
  test. The totals cannot drift, so this is safe to retune: `SPIKE_TAU`, `TAIL_TAU` and
  `SPIKE_SHARE` in `sim/revenue.ts`, and the payout is invariant to all three by construction.
- **§7.7.6a's hold tick needs a phone.** The whole of R9 turns on a haptic firing at the
  instant the grab registers, and `Capacitor.isNativePlatform()` is false in a browser, so
  **nothing that has been looked at so far has felt it**. The timing and the escape are
  tested; the feel is not testable here.
- **§4.9a's spread, at the table.** σ = 0.9 puts the 1st percentile at 0.08× and the 99.9th at
  10.8×, which is §4.9a's own two examples almost exactly. Whether a floor where the median
  developer produces two thirds of the average reads as *funny* or as *broken* is the play-test
  question the section is really asking, and widening or narrowing it cannot change the
  economy — the mean is pinned twice.
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

Still true, and the reason it matters has changed. It used to be that `row`
alone drove `y`, so plain index order *was* painter order and anything drawn
per-seat inherited depth sorting for free. Under the isometric layout both axes
push down the screen, so index order is only *very nearly* depth order — the
pairs where they disagree are more than a desk apart and cannot overlap.

That is still enough, and it is a narrower guarantee than the one that used to
be here. **Anything new drawn per seat is fine inside the seat loop and is not
automatically fine anywhere else.**

### 8. A constant derived from a number that moved is a silent still frame

`useTitleCamera` drifted the lens around `Z = 0.15`, with a comment saying "comfortably inside
the rung-0 ceiling of 0.2". §7.4a moved that ceiling to 1/9 ≈ 0.111 underneath it, and the
stage's per-frame clamp then flattened the drift into **a completely still title screen** —
which §10.9.4 names as the thing that reads as a broken build. Nothing threw, nothing failed,
and no test covered it, because the number was correct when it was written.

The fix is not a new number; it is `const CEILING = maxZoomFor(1)` and fractions of it.
**Grep for hardcoded Z values before touching the ladder**, and prefer deriving over copying
anywhere a comment has to explain which other constant a number is under.

### 9. A responsive breakpoint that excludes the reference device is decoration

The left rail's short-frame rule was `@media (max-height: 420px)`. The frame everything is
judged at — 997 × 448, the Pixel 8 Pro §23.3 refers to — is *above* it, so it got the tall
layout, and adding §4.10e's revenue graph pushed the gauges down through §21's script. The
collision was obvious in a screenshot and invisible in all 894 tests.

It is 520 now. **Screenshot at 448 before believing anything new fits in the left rail** — the
HUD grid's middle row is `1fr` and it will let its contents overflow into the row below
rather than complain.

### 10. An isometric floor has two axes, and neither of them is the screen

Reported three times before it was right, and each report was correcting a
different wrong answer. Worth reading in order, because the class of mistake is
common and the first two fixes both *looked* like progress.

1. **"Your rows are diagonal, not horizontal."** `isoAt` laid seats out level
   across the screen — deliberately, with a long comment defending it. The
   first fix made them *more* level: a continuous desk bank and a bigger row
   pitch so proximity grouped horizontally.
2. **"I mean horizontal to the office layout, horizontal to the wall."** A row
   is horizontal **to the room**, not to the monitor. Everything else in the
   picture lies in the 2:1 floor plane, so a bank of desks running flat across
   the frame is the one thing that does not, and it reads as furniture skewed
   off the ground. `isoAt` is a real isometric map now.
3. **"Rows first — row means developers sitting next to each other, not in
   front and behind."** Correct projection, wrong axis. `drawWorkstation` turns
   the screen south-east, so the developer looks north-west; a row laid along
   *that* axis puts every developer directly behind the next. Isometrically
   perfect, and a queue. Rows run south-west, across the facing.

**The rule to carry forward: which axis is not a free choice.** It is fixed by
whichever way the sprites face, and the only way to see it is to look at the
picture. `seatPosition` is exported purely so the question can be asked in a
test, and `room.test.ts` now pins the direction, the 2:1 of it, and the fact
that two rows are parallel.

The same mistake was underneath two other things at once: `blockBox` read three
of its four corners off the wrong grid corner and got away with it while `y` did
not depend on the column, and the PC tower was positioned at `x + 21` screen
pixels — which put it in mid-air beside the developer the moment the room turned.
**A prop placed in screen pixels does not know which way the room is facing.**

### 11. A placeholder outlives the reason for it

The abstract particle floor existed because a thousand real developers were
assumed to be unaffordable. **Measured, the room holds a thousand `Container`s
at 59 fps** — the same figure the particles were getting. The cost was never
charged, and in the meantime rung 2 (a hundred to a thousand developers, which
is most of the game) was drawn as a grid of dots with no walls, no floor plates
and nobody in it you could zoom to or hire onto.

Three separate things were downstream of that one assumption and all three were
wrong at once: a single hire above 120 developers produced **no animation at
all** (the arrival range was clamped to the old cap), §7.8.1c's unfold
**dissolved the room's walls** on the reading that the studio had outgrown them,
and §21 Act IV's dolly was a hardcoded `0.35` that under the §7.4a ladder points
at the *tower* rather than at the floor the thousand developers just landed on.

**Measure the constraint before designing around it**, and when a placeholder is
replaced, go looking for what else was shaped by it.

### 12. A ratio-scaled count is not a number of seats

Reported as "the hiring animation, the fall goes down to the person before".
§7.7.3's `spawnBurst` is the *spectacle* weight — twelve bodies for the hire
that takes a studio from one developer to two — and `arrivals.spawn` was
treating it as a number of desks to fill, from the end of the list. On a floor
with two desks that is both of them, so the founder got a stranger dropped on
their head on every early hire.

Compounding it, the room drew the new hire on the frame the store published
them, so the falling figure landed on a person already sitting in the chair.

`SpawnEvent` now carries `from` and `to` — the seats the hire actually filled —
and `arrivals.revealed` withholds a seat from the room until its arrival lands.
**Anything that positions itself on a seat wants the range; only the swarm
tiers want the weight.**

### 13. If you know what is arriving, drop *that*

Asked as "why are they white to start with and change into their colour? why
not just create the person well in the first place?" — and there was no answer.
The arrival drew grey silhouettes that swapped for the generated developer on
landing, when §7.8.7 generates a developer from their seat and the run seed and
both are in hand before the fall starts. Arrivals now build the real desk bank,
the real workstation and the real person, and animate *those*.

It also deleted a whole class of bug: a placeholder has to be kept in step with
the thing it stands in for, and this one had already drifted (a chair beat, for
a chair the room does not draw).

### 14. A guard copied onto a second call site is a guard in the wrong place

While fixing trap 11 the `!first` guard — which correctly stops §21's *camera
reveal* firing on a jumped-to phase — got copied onto `arrivals.spawn` as well.
Nothing publishes a spawn event except a real hire, so `first` is the player's
**first hire of the session**, and the very first developer anybody hired
appeared with no animation at all. It survived a full test run and was found
only by clicking the button and watching.

### 16. A poke makes the studio *slower* for a moment, and always did

Reported by a test rather than by an eye, and it cost an hour of chasing a bug
that was not there. R14's first tests asserted "velocity is higher after a poke
than before it" and failed: at forty developers the tap **lowered** the studio's
rate.

That is §4.9 working. Every poke adds local Entropy — "you interrupted them;
that is what an interruption does" — and at a small headcount the context
switch costs more per frame than one buffed developer adds. It was equally true
before R14; nobody had noticed because the poke's value used to land as a lump
in `burned` where no velocity readout could be compared against it.

**So "before the tap versus after the tap" measures §4.9 and not §4.5a.** The
buff is measured against `baseVelocity` at the *same* instant, which puts both
terms on the same Entropy trajectory and cancels it. Whether a poke should be
net negative at forty developers is a real balance question and is now written
down as one — it is not a regression, and it is not something R14 introduced.

### 17. A cutoff that loses a *fraction* is a leak that moves with headcount

The buff overlay drops an entry once it decays below a floor, which is what
stops one living for as long as floating point can halve it. The tail it
discards is `MIN_STRENGTH / peak` of the poke — about 4% — and the temptation is
to call that rounding.

It is not, because **the peak is larger for a smaller unit**. The same poke
therefore loses a different fraction at forty developers than at forty thousand,
which is a silent rebalance of the economy disguised as a rounding error. It is
precisely the failure `output.ts` pins the roster mean twice to rule out.

`decayBuffs` returns what it dropped and the store banks the remainder. **The
test that catches this class is the one that measures the same quantity at two
tick rates**: a shortfall that halves when the step halves is integration error,
and one that does not is a leak. Asserting a single tolerance would have passed
just as happily on either.

### 18. A long-window economy test will silently measure a *ship*

R14's end-to-end test ran a hundred seconds of simulation to let a buff expire,
and compared `burned` with and without a poke. It reported a 23% shortfall.

There was no shortfall. At forty developers the studio shipped the project four
times inside that window, and `shipProject` resets `burned` to zero — so the
comparison was between two arbitrary points in two different projects. A
bankruptcy would have done something similar by stopping `tick` outright.

Both leave **a plausible-looking number** behind rather than an error, which is
what makes this worth a trap. Any test that integrates over more than a few
seconds wants a commitment nothing can burn down and a treasury nothing can
exhaust, and should say why in a comment.

### 15. Synthetic pointer events do not reach the canvas

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
| `?z=0.42` | Park the Omni-Lens on a rung, so a screenshot is of a *place* rather than of wherever the camera drifted. **Pair it with `?notitle`** — the §10.9.1 title screen drives the same camera and will overwrite it |
| `?notitle` | Skip the title. Implied by `?act=` and `?bench`. The rung stops are `?z=` 0.111 room · 0.222 floor · 0.333 tower · 0.444 block · 0.556 park · 0.667 sprawl · 0.778 grid · 0.889 cosmic |
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
