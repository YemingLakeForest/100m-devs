# Plan — 2026-08-23: rung 6, the globe

Read `HANDOFF-2026-08-22.md` first. This is the sixth level's bill, drawn up before it is
paid, and it is written down because the interesting half is not the sphere — it is **how a
business park stops being a business park and becomes a piece of a planet.**

Demos: **https://claude.ai/code/artifact/1aa88f10-1166-4e2d-a100-11738e49a77f** — six
artboards, drawn in the master palette at the 11 px type scale. The last of them, *What shipped*,
carries two frames drawn by the renderer itself rather than by hand.

> **Built. See [`HANDOFF-2026-08-23.md`](HANDOFF-2026-08-23.md) for what actually happened** —
> including the one number this plan got wrong before it was measured (§1's step out), the four
> defects that were invisible to the arithmetic, and the two rules in §4 that survived contact
> with a render unchanged. This file is kept as the reasoning, not as the record.

---

## 0. The amendment, stated plainly

GDD §7.7.1 puts 10⁸ at rung 7, *a nation*, and a planet at 10¹⁰–10¹³. **This plan puts the
full planet at 10⁸ instead** — a hundred sites of a million developers each — so that the
number on the box and the moment the world runs out of ground are the same event.

That is a deliberate amendment and not a drift. §7.8.2 already conceded that rung 6 spans two
decades where every rung below spans one and therefore "does not come for free the way rung 5
did"; this spends both decades at once and gets the game's title as the payoff. Rungs 7–9 are
freed to be what the GDD wanted them to be — off Earth entirely.

---

## 1. The arithmetic, and why it is not tuned

| | |
|---|---|
| `SITES_PER_GLOBE` | **100** — `GLOBE_CAP / PARK_CAP` = 10⁸ / 10⁶ |
| `GLOBE_DIVISOR` | **2**, the same divisor as `PLATE`, `BLOCK` and `PARK` |
| `GLOBE_RADIUS` | derived, **not chosen**: `parkCell().w * GLOBE_SCALE / sqrt(4π / 100)` |

The radius falls out of one requirement: **a hundred parks exactly tile the sphere.** A site's
share of a sphere of radius `R` is `4πR²/100`, so its width is `0.3545 R`; setting that equal
to the park's own width in globe space gives `R = 1.410 × parkCell().w`.

Three things follow, and none of them is a tuning knob:

- Globe frame = `2R` = **2.82 park widths**. The step out, **measured** at 997×448, is
  **×11.28** — and the ×5.64 this line said before it was measured was wrong. That was the
  *width* ratio, and the fit is governed by whichever axis binds: a circle needs as much height
  as width where a 2:1 park needs half, so framing the planet costs double what the width ratio
  suggests. The corrected number is not a problem and is asserted in `frames.test.ts`: the five
  single-decade steps below have a geometric mean of ×3.86, **two of them compound to ×14.9**,
  and rung 6 spans two decades (10⁶–10⁸) where every rung below spans one. A two-decade rung
  taking *less* than two rungs' worth of step is the opposite of an outlier.
- One park spans **20.3° of the planet**. Its sag against the tangent plane is `R(1−cos 10.15°)`
  = **1.57% of its own width** — **3.3 px** at the scale the globe fits, measured. That number is
  the whole reason §4's hand-off can be a swap and not a morph.
- **The planet is full at exactly 100,000,000.** Not approximately, and not because somebody
  stopped adding sites. The geometry says it, and `frames.test.ts` measures the coverage at
  **100.00%**.

Measured against §7.8.2 rule 1 — every unit occupies the same footprint — this rung **spends**
the rule rather than keeping it, and the reason is on the record: the unit did not change from
*park* to *bigger park*. It changed to *the planet*, and a planet that occupies one park's worth
of screen is not a planet. Rule 2 is kept and is doing all the work instead: the silhouette
changes completely, because a sphere is not a lattice.

---

## 2. The planet does not spin

`src/render/worldMap.ts` (**written**) settles this. The planet is oriented by the **address**,
not by the clock: `orientationFor(site)` turns the site the camera is in to face the camera, and
nothing else moves it.

Two reasons and the second is the one that decides it. A clock-driven spin makes `projectSite` a
function of time, and `frames.ts` needs a park's position inside the globe to be a **constant** —
every level below is a fixed division and a rung whose geometry moves is a rung the camera cannot
be sent to. Every level below already works this way; a block does not rotate either.

And it is better. A planet that turns because you chose somewhere on it is a planet answering
you. A planet that turns on its own is a screensaver you have to wait for.

**The sun moves instead.** `sunAt(t, o)` walks the terminator around the planet's own polar axis
— not the camera's, which was the first version's mistake and read as the *light* being on a
turntable. That changes the picture continuously without moving anything.

---

## 3. What is already written

| File | State |
|---|---|
| `src/render/worldMap.ts` | **Written, compiles, untracked.** The land as 25 ellipses in (lon, lat); `surfaceAt`; the Fibonacci `SITES` lattice sorted so land fills before ocean; `onPlanet` / `orient` / `projectSite` / `siteAtGlobe`; `orientationFor`; `sunAt` / `lightOn`. Pure, no Pixi — three consumers have to agree about this geometry and `HANDOFF-2026-08-22.md` §3 is the write-up of what happens when one of them keeps its own copy. |
| `frames.ts` | **Done.** The rung, `GLOBE_DIVISOR` / `GLOBE_SCALE` / `parkCell` / `SITE_SHARE` / `globeRadius` / `globeOrigin` / `globeFrame` / `intoGlobe` / `parkToGlobe` / `globeToPark` / `globeChromeAlpha`, the address grown a rung, and nine tests that assert §1 rather than admire it. |
| `lens.ts` | **Done.** `panBounds` gains the globe; `roomFrame` and `floorPointToWorld` carry one rung further out; the lens holds `sites`. |
| Measured | **No LOD threshold moved** — a third time. The frames all halved and the camera scales all doubled, and `floorScaleAt` gained the one `* GLOBE_SCALE` that cancels them, so all 1,756 tests pass with no threshold touched. |

Everything else below is unbuilt.

---

## 4. The hand-off — *"not a patched-on grey sticker"*

This is the part worth the ink. The first mock drew the park at its site as a flat neutral slab
laid on green ground, and it read exactly as what it was: **a sticker**. Four separate things
were wrong, and naming them separately is what makes each one fixable.

### 4.1 The rule the blend rests on

> **Everything the studio *built* is neutral. Everything the studio *stands on* belongs to the
> planet.**

Board, board face, packages, deck tops, aprons, planting, canal → **terrain-tinted**.
Towers, bus, substation, cooling plant, pin rows, walkways → **`RAMPS.NEUTRAL`, unchanged.**

`park.ts`'s own rule 1 is what makes this a small change rather than a rewrite: *"everything is
authored in the plot lattice and projected once"*, and `latticeCorners` is the only way a quad
is made in the file. The ground pieces are eight or nine fill sites.

`park.ts` gains **`setTerrain(ramp)`** on `ParkHandle`. Nothing else in it moves.

### 4.2 The biome, so the ground is not grey

`worldMap.ts` gains `biomeAt(lon, lat)` and a terrain ramp per biome. Four values indexed by how
lit the site is — `[deepNight, night, day, sun]` — every entry a master-palette colour:

| Biome | Where | Ramp |
|---|---|---|
| `TEMPERATE` | the rest | `#14121a #241f2e #2e4a2c #4c7a45` |
| `ARID` | 15° ≤ \|lat\| ≤ 33° | `#14121a #241f2e #6b452c #96683f` |
| `TUNDRA` | \|lat\| > 55° | `#14121a #241f2e #3a3244 #736579` |
| `ICE` | lat < −63 or lat > 72 | `#241f2e #3a3244 #968a96 #d8d2cf` |
| `OCEAN` | `surfaceAt === SEA` | `#14121a #0a2a30 #2a4a5c #4a8fa8` |

So a campus in the Sahara stands on ochre, one on the ice stands on white, and one at sea is a
platform on dark blue. **Colonising the planet visibly varies the studio**, which is the thing
the rung is for and is impossible while the ground is one grey.

### 4.3 The park's lattice, laid on the sphere

A site's campus is drawn from the **same lattice geometry** as `park.ts`, mapped onto the sphere
through a tangent basis chosen so that at the sub-camera point it reduces *exactly* to the park's
own 2:1 isometric.

At a site's (lon, lat), with `east = (cos λ, 0, −sin λ)` and `north = ∂/∂φ`:

```
Eu =  east·(Sx·G) − north·(Sy·G)
Ev = −east·(Sx·G) − north·(Sy·G)          Sx = PLOT_STRIDE_X · PARK_SCALE,  Sy = Sx/2,  G = GLOBE_SCALE
P(u,v)  = normalise( N·R + Eu·(u−uc) + Ev·(v−vc) ) · R
screen  = (P.x, −P.y),  visible where P.z > 0
```

Check it: at the sub-camera site `east = (1,0,0)`, `north = (0,1,0)`, and for small offsets the
normalise is the identity, so `screen = ((u−v)·Sx·G, (u+v)·Sy·G)` — the park's projection, term
for term. The whole surface is **the studio's own grid, wrapped on a globe**, and sites near the
limb foreshorten because the sphere foreshortens them.

### 4.4 The swap, not the morph

`roomResolved()` is the idiom and it already exists in this codebase: *"match the representations
at the hand-off size instead of blending two that never match."* One rung up:

- Every colonised site is drawn by `globe.ts` as a **campus glyph** — board quad + deck quads +
  a night bloom, terrain-tinted, sun-lit, on the sphere.
- The **focused** site additionally has `park.ts`'s container parented at its projected position.
- Below the globe level, `globeChromeAlpha` fades the planet out and only `park.ts` remains.

Three things must agree at the swap, and each is now guaranteed by construction rather than by
tuning: **same footprint** (both are `latticeCorners(shoreBox(n))`), **same colour** (both read
`setTerrain`'s ramp), **same light** (both index it by `lightOn` at that site). The only
disagreement left is §1's geometric sag, and it is **3 px**.

There is no bending and no flattening. Both were considered; both make the frame a function of
the camera, and §2 is the reason that is not allowed.

### 4.5 The connective tissue worth having

A park's lit windows, seen from orbit, **are** the cyan bloom on the night side. `block.ts`
already lights windows. Same light, two scales, one asset — and it is what makes the night side
mean *a million people are still working* instead of *a dot*.

---

## 5. The rest of the bill

- **`frames.ts`** — `GLOBE = 6`; `TOP_LEVEL = GLOBE`; `LEVEL_DEVS` gains `ROOM_DEV_CAP · 1000 ·
  SITES_PER_GLOBE`; `GLOBE_DIVISOR` / `GLOBE_SCALE` / `parkCell()` / `GLOBE_RADIUS` /
  `GLOBE_ORIGIN`; `globeFrame()`; `intoGlobe()`; `globeChromeAlpha`. `frameFor` gains a `GLOBE`
  arm and **one more `intoGlobe` on every arm below it** — the third time a level has cost one
  division. `floorScaleAt` gains one `* GLOBE_SCALE`, and **no LOD threshold should move**; if
  one has to, that is a finding worth a paragraph.
- **The address grows a rung.** `seatIn` clamps to `GLOBE_CAP − 1`; `siteOf(seat)`;
  `seatOfSite(site)`; `blockOf` and `buildingOf` gain `% BLOCKS_PER_PARK` / `% BUILDINGS_PER_PARK`
  so they stay park-relative; `sitesFor(devs)`; `devsOnSite(devs, site)`.
  `seatOfBlock` / `seatOfBuilding` / `seatOfPlot` take **a required `site`** — trap 52a says a
  default of "the first one" is how a floor of building 8 silently became building 1, and this is
  the same shape of mistake one rung up. ~10 call sites, all in `stage.ts`.
- **`park.ts` / `block.ts` / `building.ts` need no other change.** They already draw *a park given
  a headcount*; `globe.ts` hands them `devsOnSite(devs, focusSite)` and they are none the wiser.
- **`globe.ts`** — `Graphics`, **not a shader.** Latitude bands run-length-merged into ~320 quads
  plus ~1,100 for the site glyphs, rebuilt only when the sun crosses a quantisation step (~1 Hz).
  That keeps it palette-exact, art-gate-clean and consistent with `room.ts` / `park.ts`, where a
  GLSL sphere would be the only WebGL-specific thing in the codebase.
- **`lens.ts`** `panBounds` gains the globe. **`stage.ts`** gains the globe in the world,
  `pickSite`, `enterSite`, and a seventh rung in `nav()` and `__stage`. **`Lift.tsx`** gains a
  fourth picker and a seventh rung.
- **The test tool.** A typed headcount in `ScenarioBar` that puts the studio at exactly that size
  with the lens parked at the earned rung, extending the existing `?devs=` path. `SCENARIOS`
  gains the decades above 10⁶ that now have somewhere to be drawn.

## 6. What to check when it is built

1. `npm run check` — and `test:ui-frame` at the five landscape frames, because **three of the last
   four defects in this render stack only existed in a desktop window** (traps 49, 52, 53). The
   globe is fit-bound on the short axis; a park hanging off the side is the expected failure.
2. That **no LOD threshold moved.** Twice in a row it has cost one division and a new
   `TOP_LEVEL`; a third would make it a property of the model rather than a coincidence.
3. That the swap is invisible. Park the camera at the hand-off scale, step the sun through a whole
   day, and watch the focused site against its neighbours: if it changes hue or value against them
   at any hour, §4.1's split is wrong somewhere.
