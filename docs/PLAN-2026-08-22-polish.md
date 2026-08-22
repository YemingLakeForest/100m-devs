# Plan — 2026-08-22 — Making the ladder look like something

**Status:** proposals, none built. Three defects at the top are findings and carry files.
**Related:** [`HANDOFF-2026-08-22.md`](HANDOFF-2026-08-22.md) (rung 5, the park),
[`ART_DIRECTION.md`](ART_DIRECTION.md), [`GDD.md`](../GDD.md) §7.7.1, §7.8.1, §7.8.2, §23.3

---

## 0. What this is, and how it was measured

Rung 5 landed today and the ladder now spans **1 → 1,000,000 developers over six rungs**. This
is the first time the whole thing can be looked at end to end, so it was: eighteen screens at
1280×720, plus the park at 1999×1115 and at the reference 997×448, driven the way a player
drives it — tap a unit, press the door, climb back with the address ladder. Nothing here comes
from reading the code first.

**The measured walk**, `?notitle&scenario=town`, 1280×720:

| Screen | Lens | Camera scale | Address | Park / block / building chrome |
|---|---|---|---|---|
| the park | PARK | 0.456 | seat 0 | 1 / 1 / 1 |
| block 08 named | PARK | 0.456 | 700,000 | 1 / 1 / 1 |
| inside block 08 | BLOCK | 2.149 | 700,000 | 0 / 1 / 1 |
| tower 05 named | BLOCK | 2.149 | 740,000 | 0 / 1 / 1 |
| inside tower 05 | BUILDING | 4.448 | 740,000 | 0 / 0 / 1 |
| floor 06 named | BUILDING | 4.448 | 745,000 | 0 / 0 / 1 |
| inside floor 06 | FLOOR | 12.889 | 745,000 | 0 / 0 / 0 |
| its squad | SQUAD | 48.117 | 745,000 | 0 / 0 / 0 |
| one desk | DESK | 295.381 | 745,000 | 0 / 0 / 0 |

Three doors and two ladder rungs, and the address survives all five. The chrome columns cross
out in the right order and never both at once.

**The fit**, park at a million, park frame against the viewport:

| Viewport | Width used | Height used | Parcels off-frame |
|---|---|---|---|
| 1999×1115 | 94.0% | 91.5% | 0 |
| 1280×720 | 94.0% | 90.7% | 0 |
| 997×448 | 77.8% | 94.0% | 0 |

Height-bound at the reference and width-bound nowhere — which is the shape trap 53 predicted
after `blockCell()` became the union of the towers and the deck.

**The cost**, 1280×720, nothing else running: **58 FPS at the park with a million developers**,
frame median 17.7 ms and p95 20.5 ms; tap→numeral p95 **39 ms** against §23.3's ≤ 80 ms. A
hundred towers are free, which was the thing most in doubt.

> The 123 ms tap latency visible in some of today's screenshots is **my own probe**, not the
> game: the acceptance gate sweeps `__pick` about twelve thousand times to find a unit's
> centroid, and the overlay reports what it measured. Measured again with nothing sweeping, it
> is 39 ms. Trap 40's family — a measurement that measured the measuring.

---

## 1. Three defects, found by looking

### 1.1 The hosted building lights its storey at the block and at the park

`src/render/stage.ts:1525` calls `building.setFocus(storey)` unconditionally, and
`buildingChromeAlpha` is **1 at BLOCK and 1 at PARK** — both measured in the table above. So
the one tower in a hundred that is the real `building.ts` object draws its focused-storey
lighting at every rung, at scales where a storey band is about 19 px (block) and 9 px (park).
On screen it is a cyan smear across two faces of exactly one tower, and it reads as damage
rather than as *you are here*.

**The rule is already written down and this line does not obey it.** `drawTower`'s own comment,
`src/render/building.ts:542`: *"A block does not light a storey: at that scale a band is 19 px
and the thing being chosen is the building."* The ninety-nine cheap towers obey it because
`drawTower` is passed `focus = -1`; the hosted one is the exception, and it is the exception on
every screen because it is always the building the address is in.

The neighbouring line got this right — `building.setPlanAlpha(1 - blockAlpha)` exists precisely
because 286 units of floor plan drawn through the neighbours is wrong at the block. The focus
lighting needed the same guard and did not get one.

**Fix shape:** `building.setFocus(blockAlpha > 0 ? -1 : storey)`.
**Why no test saw it:** every existing assertion about the block level is about *reachability* —
ten towers pickable, ten distinct indices — and `__pick` answers off the model. Trap 51 again,
one layer in: the model is right, one tower is drawn wrong, and nothing asks the picture.

### 1.1a The symptom was over-claimed — **[correction, 2026-08-22]**

The paragraph above said the mark reads "as a cyan smear across two faces of one tower", and
pointed at a crop to prove it. **That part is not established.** Sampling the crop, the mark
region and an ordinary lit window on the same tower are both blown to near-white by the bloom
(`#69ffff` against `#c9ffff`) — the mark is the more saturated of the two, which is *consistent*
with a distinctly coloured overlay and is not evidence of one. A before/after screenshot pair
came back with signal exactly equal to run-to-run noise, because the reverted build never
reached the browser inside the wait.

**What is established, and is the whole reason to fix it:** `stage.ts` set the focused storey
unconditionally while `buildingChromeAlpha` is 1 at both BLOCK and PARK, so the hosted building
was lighting a storey at scales where `building.ts:542` says in as many words that it must not.
A rule stated in the file and disobeyed three functions away is a defect whether or not the
pixels happen to show it, and the gate now asserts the rule rather than the smear:
`__stage.litStorey` must be −1 at the park.

The lesson is the one this file keeps finding from the other side. Trap 51 was *reachable is not
drawn*. This is its mirror: **drawn wrong is not always visible**, and a screenshot is as capable
of over-reporting as `__pick` is of under-reporting.

### 1.2 The cash floaters land on the DEVS readout

At 1280×720 with a million developers, three `+$…` floaters drift out of CASH and pass straight
through `DEVS / 1.0 M / 1 TOWN = 1.0 M DEVS`. For the length of the float both are illegible —
green numerals over grey numerals, same size, same rail. The floater rate scales with income and
the income scales with headcount, so this is *worse* the further the studio gets, and it is
invisible in every screenshot of a studio small enough to have a quiet rail.

### 1.3 Nine of ten squad bays are bare carpet for the whole of rung 2

Measured: at **100 developers** the ceiling is rung 2, the camera settles at FLOOR, the seat
block measures **1,100 px — 86% of the frame width** — and **100 of 1,000 desks are drawn**.
The other nine bays are flat floor tiles.

**This is not the camera's fault and must not be fixed there.** `frames.ts:155` records the
decision and the reason: the shell used to be re-solved on every hire, so the camera's fit moved,
so *hiring re-framed the picture* — one of the two reasons the zoom never settled. A floor is
5×2 squad plates from the moment the garage is outgrown, deliberately.

So the frame is right and the *picture* is empty. GDD §7.8.1 already says what belongs there and
the build draws none of it below the wall line: dividers, a server rack, a breakout sofa,
unpacked cardboard, meeting pods. See decision 6.

---

## 2. Twelve decisions

### Depth — the one thing the park does not have

**1. Fade the parcels by depth.**
ART_DIRECTION §1 lists the world's three depth cues as *occlusion, shadow, atmospheric fade*.
The park uses the first two and none of the third: the furthest parcel is drawn at exactly the
value of the nearest, so ten parcels read as one flat sheet of identical objects. `NEUTRAL` is a
nine-step ramp and `parcelDepth(block)` already exists and is already sorted on. Pick each
parcel's deck and each tower's spandrel one to two steps down the ramp by depth. **No new
colour, no new asset, `art:check` stays green**, and it is the single largest change in how the
level reads per line of code.

**2. Give the park an edge.**
The ground diamond runs past the last parcel to the frame edge at one flat value and the
boulevards run off with it — at 1999×1115 they read as light leaks rather than as roads. Stop
the ground at the last kerb plus one boulevard, and let the void take over. A park with an edge
is an object; a park without one is a backdrop, and this level's whole job is to be an object
that a bigger one will later sit inside.

**3. Roll the crowns with the fade.**
Crowns are the highest-contrast thing in the composition and there are a hundred of them. Once
decision 1 lands, the far row's crowns will still punch through unless they take the ramp too.

### Variety — from the address, and from nothing else

**4. One building's silhouette is a function of its seat number.**
§26.2.2 already says everything is derived from one global seat number, and `building.ts`
already hashes storey and squad to decide which windows are lit. Extend the same hash to the
crown — plant room, mast, water tank — and to a small band offset. **Variation is a function of
the address, never of a random**, so the tower you left is the tower you come back to and no
state has to be stored for it. Three crowns and two offsets is six silhouettes; a hundred
towers stop being one tower drawn a hundred times, for a switch statement.

**5. Lit windows are the occupancy readout, all the way up.**
`squadsOnStorey` already lights windows per squad at the floor and building levels. Carry it to
the block and the park: a half-full tower is visibly half-lit, a half-full parcel visibly
half-lit. Then **the picture answers the question the picker is currently the only answer to** —
which block is filling — and §7.8.2 rule 2 gets its real prize, a silhouette that changes
because the studio changed rather than because the camera moved.

**6. Give the empty squad bays something to be.**
The finding is 1.3. The answer is GDD §7.8.1's own list, which is canon and unbuilt: dividers,
server rack, breakout sofa, unpacked cardboard, meeting pods. **Unpacked cardboard in an
unfilled bay is exactly the trick the park plays with an unbuilt parcel** — it says *this is
where the next hundred go*, which turns dead space into a promise. Rung 2 is the only rung where
the studio has room for furniture at all, and it is the rung the whole of Act I is played on.

### The interface

**7. One word for one object.**
On a single screen right now: `1 TOWN = 1.0 M DEVS` on the scale bar, `PARK 1` on the address
ladder, `BLOCK 08` in the picker, and `campus` in `sim/units.ts`. **Four words for two objects.**
Nothing is the wrong size — they are synonyms — but a player cannot tell that from the screen.
Settle it in the GDD §7 rewrite that is already scheduled. **Recommendation:** the camera's
physical words win (park, block, building, floor, squad, desk) and §7.7.1's arrival words (town,
campus) go, because the player reads the camera's word six times a session and the arrival word
once. `sim/units.ts`'s `campus` stays only where it names a §13.6.4 hero tier.

**8. Back the address ladder.**
It is the only HUD element with no scrim behind it. At FLOOR it sits over a fully lit floor plate
and its lower rungs stop being readable — which is the moment the ladder matters most, because it
is the only thing on screen naming which of a million people you are looking at. ART_DIRECTION
§1.0a explicitly permits a CSS scrim on the interface plane.

**9. Make the picker say something.**
Ten rows reading `100 K` beside ten full bars is a list with no information in it. The
differentiator at the park is *which block is filling*; show that one, and give the rest a count
instead of ten identical bars. Same argument the lift already makes about its own existence —
a rung that names one thing is not a rung, and a bar that is full in every row is not a bar.

**10. Retire the boot console at scale.**
`STUDIO_OS v0.0.1 initialized … Employees: 0 // just you` is on screen at a million developers.
It is Act I's joke, told to somebody who employs a city.

### The two that are worth more than the other ten

**11. The founder is a yellow cube.**
The desk level is where the game starts, and §13.6.7 says the door to the founder's screen *has
to be a person*. It is the least-built rung on the ladder: a flat cube head with no face, a white
blob body, on an untextured lavender ground — while every rung above it got built this month.
ART_DIRECTION §4.1's parts-library method is fully specified and entirely unbuilt, and its whole
promise is that consistency stops being a matter of skill: **one head and a wardrobe**. This is
the highest ratio of *how much the game feels made* to *how much work it is* anywhere in the
project, and it is the one item on this list that cannot be done by moving a number.

**12. One motion, and only one.**
The park is completely static — at a million developers nothing on screen moves except the
numerals. §7.8.1's standing constraint rules out spritesheets and should stay ruled out. Two
things fit inside it:

- **A deterministic window-light schedule.** One `sin` per storey, seeded from the address, rate
  tied to velocity. It is the difference between a hundred towers that are *occupied* and a
  hundred towers that are *modelled*, and it costs no assets.
- **A ship pulse down the boulevards.** On §10.8a's ship, run one bright wave along the streets,
  once, for about 400 ms. The whole park acknowledges the thing the studio just did — which is
  the only feedback the outer rungs currently have, and the reason the park reads as a diorama
  rather than as a place where the work is happening.

---

## 3. Order, and what each costs

| # | Decision | Where | Cost | How you would know |
|---|---|---|---|---|
| 1.1 | Storey lighting off at the block | `stage.ts:1525` | one line | screenshot; a picture gate, not `__pick` |
| 1.2 | Floaters clear of the readouts | `hud/` | small | the rail gate at 1280×720 |
| 2 | Depth fade on parcels + crowns | `park.ts`, `building.ts` | small | `art:check` stays green; by eye |
| 8 | Scrim behind the ladder | CSS | small | contrast at FLOOR |
| 9 | Picker says something | `Lift.tsx` | small | — |
| 10 | Boot console retires | `hud/` | small | — |
| 3 | Bound the ground | `park.ts` | medium | fit table unchanged |
| 5 | Lit windows as occupancy | `building.ts` | medium | half-full block visibly half-lit |
| 4 | Silhouette from the address | `building.ts` | medium | same tower on return |
| 12 | Window schedule + ship pulse | `park.ts`, `building.ts` | medium | 58 FPS holds at a million |
| 6 | Furnish the empty bays | `room.ts` | large | §7.8.1's table, walked |
| 11 | The founder becomes a person | `assets/parts/` | large | ART_DIRECTION §7 checklist |

The top six are an afternoon and they fix everything that currently reads as *unfinished* rather
than *unbuilt*. 6 and 11 are the two that change what the game feels like, and they are art
rather than engineering.

---

## 4. What is deliberately not proposed

- **Re-solving the floor frame to the occupied desks.** `frames.ts:155` already decided this and
  gave the reason: it made hiring shove the camera. Finding 1.3 is a *content* gap wearing a
  framing gap's clothes, and fixing it at the camera would spend a recorded decision to buy back
  a problem that was already paid for.
- **A colour outside the master palette**, for any of the above. ART_DIRECTION §9 — every one of
  these is reachable inside the existing nine-step `NEUTRAL` ramp and the four phosphor ramps.
- **Animating people at the park.** A hundred thousand people to a parcel; there is nobody to
  animate, and §7.5 already says no individual sprites survive at these scales.
- **Rung 6.** [`HANDOFF-2026-08-22.md`](HANDOFF-2026-08-22.md) §14 owns that, and it is the first
  rung that does not come for free.
