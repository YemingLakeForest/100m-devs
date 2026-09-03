# Agent goal and visual convergence loop — garage v10 (density and scale)

> This is an execution prompt, not a second design authority. `GDD.html` remains
> canonical. The target image named below is canonical through GDD §7.8.0c.

Copy everything below into the implementation agent.

---

Read `CLAUDE.md` completely before acting, then create and pursue this goal:

> Close the remaining distance between the live 20-developer garage and
> `docs/assets/concepts/garage-layout-concept-20-devs-v9-founder-james-neighbourhood.png`,
> while preserving gameplay, hit testing, walking, deterministic seat identity,
> the enforced palette and supported-device performance.

The v9 loop landed the scene's **structure**: the right population, the right
shell, the right openings, the right exterior rhythm, the right camera. What it
did not land is **density, scale and material** — the three things that make the
concept read as a room somebody works in rather than as a diagram of one. This
loop is only those three. Do not re-litigate the population, the pod count, the
facings, the kerb ratio or the DEVS readout; they are settled and gated.

## Read this first: what the last loop's gates could not see

The v9 pass ended with 2398 unit tests, 307 room-geometry claims, 107 UI frames
and a playthrough walk all green, and a scene that is still visibly not the
concept. That is not a reason to distrust the gates. It is a precise statement of
what they cover:

- every gate asserts a **relationship** — non-overlap, containment, ratio,
  ordering, determinism, reachability;
- **no gate asserts a size**, a density or a material;
- so a wall furnished to a fifth of its height, a mortar joint a quarter of a
  step darker than its brick, and a tree with a pale grey cap on it all pass
  everything.

**And the same blindness applies to reading a screenshot.** Two of the nine
findings in the first draft of this list were wrong, both from judging a
side-by-side by eye: the fridge was said to be twice the size it should be
(measured, it is within a tenth), and the mortar was said to be lighter than its
brick (measured, it was darker, just not by enough). Both are corrected in place
below. **Measure before changing, and say what you measured** — a wrong number
in a prompt propagates further than a wrong pixel in a render.

A defect was also found by a human looking at a screenshot and asking *"why is
James in two places?"* — the suite's doorway had fallen outside a room that had
shrunk, leaving a quarter-column sliver where an opening should be and a sign
hanging across a hero's head. Two correct walls, no opening, nothing red.

**Therefore: this loop's success criterion is the picture, and its tests exist to
stop the picture regressing — not to tell you it has arrived.** Crop the render
and the concept to the same region at the same scale and put them side by side.
That is the instrument.

## Tools you now have

Two switches, both local-session only (`dev/viewModes.ts`, gated on
`DEBUG_TOOLS_ENABLED`). Use them; they exist for this loop.

- **`C`, or `?crt=off`, or `window.__crt(false)`** — takes §7.6a's post chain off
  live. Every judgement about colour, value and material must be made with the
  glass off. Every judgement about whether the *shipped* frame reads must be made
  with it on.
- **`V`, or `?freezoom`, or `window.__freeZoom(true)`** — takes the camera off
  §7.2's rails: no magnetic settle, no §7.7.1 ceiling, and about 24× further in
  than the desk stop. This is how you look at one prop.
- `window.__viewModes()` reports both.

Existing seams: `?nopost`, `?post=bloom,crt`, `__room()` (now carrying
`screen.shell`, `screen.piers`, `screen.seats` and `chairs`), `__cam()`,
`__pick(x, y)`, `__signAt()`, `?devs=`, `?full`, `?scenarios`.

The completed garage is **`?notitle&full&devs=20`**. Not 21.

## The measured gap, largest first

Each item below was found by cropping v9 and the current render to the same
region and comparing. Reproduce each crop before you change anything for it.

### 1. Perimeter density — the largest single difference

v9's workshop wall is **furnished continuously from floor to shoulder height
along its whole length**: tall shelving with boxes and files, a red tool chest, a
pegboard packed with hanging tools, a microwave, framed pictures, a leather sofa,
a low bookshelf, a wall lamp. The wall is *full*.

The render has six small objects sitting in the bottom fifth of a large blank
wall, with more blank brick above them than furniture below.

The same is true of the kitchenette. v9 has a **fitted counter run** — dark base
units, timber worktop, coffee machine, chopping board, a plant — with the fridge
at its end. The render has a stick-legged table with three small objects on it.

- Furnish the perimeter to shoulder height, continuously, along both far walls.
- Prefer more small objects over fewer large ones. The concept's density comes
  from count, not from size.
- Wall-hung objects are as important as floor-standing ones: boards, frames,
  conduit, a clock, a calendar, hanging tools. The blank band above the props is
  the defect.
- Everything stays simple cuboids and short line details (§7.8.0c). Do not import
  richer art than the live game draws.

### 2. Prop *detail*, not prop scale — corrected 2026-09-03

**This entry originally said the fridge was about twice the size it should be.
It is not, and the correction is the more useful finding.** Measured by pixel
extent, v9's fridge is 85x80 and the render's 79x87 — within about a tenth of
each other, and the render's camera is slightly further out, so if anything the
render's prop is a shade *smaller* in room terms. The impression of wrong scale
came from comparing two regions whose *contents* differ: v9's fridge stands at
the end of a fitted counter run and reads as one item in a kitchen, while the
render's stands alone against blank wall and reads as a monolith.

So the defect is context and surface detail, not size:

- v9's cardboard boxes carry flaps, tape and tone variation; the render's are
  flat single-value slabs.
- v9's appliances sit in a run of other things; the render's stand alone.

**Do not resize props on the strength of a side-by-side impression.** Measure
the pixel extent of the same object in both images first, and remember that the
two cameras are not at the same scale. If a resize is still warranted after
measuring, state the measurement in the commit.

### 3. Workstation proportions — withdrawn 2026-09-03, unsupported

**This entry claimed the render's tables were narrow and its monitors dominated
them. Measured, both halves are false.** A four-person table is 191px wide in the
render against 192px in v9, and the ratio of screen height to table width is 0.35
in the render against 0.31 in v9 — a difference of four points, in the direction
of *slightly* larger screens, on an object the eye cannot compare across two
pictures.

That is the third eyeball finding in this list to die on contact with a
measurement, and the reason the warning at the top of the file is there. Nothing
to do; kept rather than deleted, because a withdrawn claim is worth more to the
next loop than a missing one — it says this ground has been checked.

### 4. Wall material — partly done, and partly mis-stated

**This entry originally said the render's mortar was lighter than its brick. It
was not.** Measured on the rear-right face: brick (64,47,40), joint (51,40,43) —
darker, but only by a quarter of a step, where the concept's joint is about a
third of its brick's value. The joints were *present and invisible*, which is a
different fix from the one originally written down.

Closed on 2026-09-03:

- joints moved from `NEUTRAL[1]`/0.45 to `NEUTRAL[0]`/0.72 and 0.55, so a course
  reads as a shadow rather than a tint;
- per-block tone variation added, deterministic in the block's own position, so
  the wall spans roughly 47..64 on the red channel instead of a flat 64;
- the conduit, its drops and the distribution box were bare `NEUTRAL` on a
  warmed wall — measured (85,73,94) against a block of (64,47,40), a cool lilac
  band at head height — and now take the wall's own warmth. Same mistake the
  corner piers made, one object smaller.

Still open:

- the openings have no reveal — the panes sit flat on the wall surface;
- the **near walls' outer faces have no courses at all** and read as painted
  panels. They are the same masonry as the rear walls and must show it.

### 4b. The frontage was lavender — found and closed 2026-09-03

**Not in the original list, and the largest colour error left in the frame when
it was found.** The near walls, the piers, the forecourt and the kerb were drawn
straight off `NEUTRAL`, and `NEUTRAL` is not neutral — `#241f2e` is a
violet-grey. Measured on v9's near-left wall face: (42,33,28), (34,24,19),
(29,24,20). Ours: (36,31,46) and (58,50,68). *Same value, opposite side of the
hue axis*, across about a third of the frame. The footway was the same story.

Two things worth carrying forward:

1. **A value gate cannot fail on hue.** `garage.test.ts`'s brightness-ordering
   suite exists for exactly this class of defect and compares *indices on one
   ramp*, so two surfaces of identical value and opposite hue are the same
   number to every claim in it. The new claim asserts the property directly —
   red leads blue.
2. **A claim is only as canonical as the picture it was measured against.** The
   test that said the street stays cool was anchored on
   `garage-layout-concept-20-devs-v1.png`. v1 is not the canonical concept. When
   a reference image is superseded, every number taken off the old one is
   provisional until it has been taken again — *including the ones sitting green
   in a test suite*.

### 5. The leadership room — mostly closed 2026-09-03

Closed:

- the footprint, which was sized for a seven-plot suite and is now sized for the
  two people actually in it (`gy 0..3.4` by `gx 0..4.9`);
- the rug, which now covers the box floor and wears the concept's **double gold
  border and centre panel** instead of three stripes. A stripe crossing a
  rhombus at one screen slope is indistinguishable from a floor joint, and the
  slab underneath already has those;
- the glass. Measured: the concept's floor is (55,33,21) outside its glass and
  (55,24,21) inside — no shift at all — where ours went (50,35,27) to
  **(41,51,64)**. The `GLOW[0]` wash drops from 0.44 to 0.12 and the pane keeps
  the three marks that carry the read: dark frame, bright head rail, sky in the
  top third;
- the **floor plate**, which was not in the original list and should have been.
  `NEUTRAL[1]` at 0.72 is a second material — cool and dark, laid on a warm
  slab — so the corner read as a platform somebody built. The concept's floor is
  one unbroken pour, (57,34,22) inside against (60,36,22) outside. A garage does
  not re-floor a corner it fenced off last week;
- the sign, which keeps its 76×18 tap target (§13.11.2's roster door) and loses
  a step of phosphor instead. `GLOW[2]` lettering over a `GLOW[2]` bar, in a room
  that also carries `YOU`, `JAMES` and a desk plate, was four cyan words inside
  forty pixels.

**Withdrawn**: the desks. Measured, the widest timber run is 21px against the
concept's 22, at (150,104,63) against (130,77,48). They were never small.

Still open:

- **interior furniture.** v9 has a dark cabinet or shelf against the back wall
  inside the glass. Ours has nothing but two desks.
- **the door leaf.** v9's opening carries a hinged glass door with a dark frame
  and a handle, standing open. Ours is a gap. The code's comment claims the
  concept shows a gap; it does not — check the crop before believing it.

### 6. Rear neighbourhood

Closed on 2026-09-03: every tree's crown carried a `NEUTRAL[4]` top face —
measured (115,101,121) — which is a highlight when a tree is one object across a
road and a field of pale lilac dots when the band is dense. It is foliage now.

Also closed on 2026-09-03, and the largest colour error left anywhere in the
scene: the canopies themselves drew `FOLIAGE[1]` — rgb(76,122,69) — against a
concept canopy of rgb(26,27,15). **Four and a half times too bright.** Ours now
measure (37,38,27). The trees grew with it, from 1.35+0.55·rnd to 1.9+0.7·rnd,
against a measured concept canopy of ~1.07 tiles wide by 2.8 tall. And the
buildings behind them: `DIM_FACADES` and the dim parapet both took `NEUTRAL[2]`,
measured (58,50,68) where the concept's rear roofs are (11,8,14) — so the largest
shapes in the band were also the palest. Now (20,18,26).

**A note on the method, because this one nearly went wrong too.** The first
measurement of this region said v9 had 0.1% foliage — less than ours — which
would have made the entry backwards. The detector was wrong, not the concept:
it tested `g > 40`, and v9's trees are a dark olive that fails it. Re-measured
with a threshold that admits the actual colour, v9 has the denser band by a wide
margin. *A measurement is only worth what its threshold is worth*, and a
detector tuned on the render will always flatter the render.

### 7. Lighting — closed 2026-09-03, and one claim in it was wrong

"The pod pools are too weak" was **not** what the measurement showed: the pools
peak at p95 150 in the render against 139 in v9, and the pool-to-floor ratio is
about 1.9 in both. The teams did not separate for a different reason — the floor
had no *bottom* quartile. v9's slab spans a dark that ours never reached, so
every pool sat on ground of nearly its own value even though the pools were
right.

Closed: three fading perimeter bands and a light global wash give the slab its
dark end back; per-bay tonal variation over a 4×4 grid stops it being one value;
the pools were left almost alone (0.13/0.22/0.18). A wall lamp and its wash went
onto the workshop wall with the rest of item 1's dressing.

**And a warning for the next loop.** The first attempt at this laid a 0.3 global
wash over the whole slab because a histogram said the floor was too bright. It
moved p50 from 58 to 47, matched the target, and produced spotlights on a black
floor. The number was met and the picture was worse. *Trusting a statistic over
the image is the same error as trusting the eye over a measurement, wearing the
opposite hat.*

### 8. Floor — closed 2026-09-03

Bay joints strengthened and the cable runs thickened, both judged against v9 with
the CRT off. Done as part of item 7's work, since they are the same surface.

### 9. Camera — withdrawn 2026-09-03, unsupported

The claim was that the building fills 79% of the frame's width against the
concept's ~88%. Measured, both are **77.3%**: our shell spans x 189..1475 of
1664 (`__room().screen.shell`), and the concept's vertices sit at x 176 and 1468
of 1672. The bottom vertices are within 22px of each other and the side vertices
within 13px and 7px. The framing already matches.

That makes six eyeball findings in this list disproved by measurement, against
three confirmed. The instrument is the crop *and a sampler*, not the crop alone.

## Non-negotiable — do not regress these

All of the following are gated and settled. If a change breaks one, the change is
wrong:

- `GARAGE_SEATS === 20`; five pods of four; the completed-garage HUD reads
  `DEVS 20`; the transition happens on the twenty-first hire.
- The leadership room holds exactly the founder and James. Mo, Serena, Matt,
  Melany and Billy never materialise in the garage, whatever progression flags
  are set.
- All four floor-axis facings present; across-table pairs exactly opposite;
  monitor and body from one `Facing`.
- No chairs.
- The gate apron clear of every desk, person, prop, lamp and cable.
- Two lamps and six planters on the frontage, three and nine on the return, 1:3
  per side independently, no station in an exclusion span.
- No vehicle emitted for the garage camera stop.
- Full shell and pier containment at both supported viewports, ≥75% fill,
  centred.
- A usable hit point for every developer.
- The rear band stays behind both rear walls and below their height.
- `npm run check` passes in full.

## Visual convergence loop

Repeat, one mismatch class at a time.

1. **Crop both to the same region at the same scale.** Not the whole frame — the
   whole frame is how the last three loops missed things. One region, side by
   side, at 1:1 or larger.
2. **Write the mismatch down** as: what the concept shows, what the render shows,
   which table or function owns it, the change, and a claim that would fail if it
   regressed.
3. **Measure in the room's own units.** Prop heights in person-heights, positions
   in plan tiles, colours sampled off the concept. Never screen pixels copied
   into a layout constant.
4. **Pin what can be pinned** before changing geometry — and be honest when a
   thing cannot be: "the wall looks furnished" has no test, and a comment saying
   so is worth more than a test that pretends.
5. **Change the smallest shared primitive** that closes the gap.
6. **Run the focused Vitest files plus lint and `tsc`.** Not the full gate on
   every visual step.
7. **Re-crop the same region and compare again.** If the change did not visibly
   close the gap, revert it. Invisible complexity that passes its test is worse
   than no change.
8. **Recheck gameplay** whenever geometry moves: hit points, selection anchors,
   depth order, walk routes.
9. Continue.

Temporary shots under `tmp/`. Tracked shots only at milestones.

## Required automated claims — new ones for this loop

On top of everything already gated:

- joint contrast: the mortar's drawn value is below a stated fraction of the
  block's, on both far and near walls;
- block variation: the wall's drawn values span more than a stated range;
- the perimeter's furnished fraction — the share of each far wall's length that
  has a prop against it — is above a stated floor on both far walls;
- wall-hung dressing exists on both far walls above a stated height;
- a pod's table is wider than its monitor is tall;
- the leadership room's floor area is within a stated multiple of the two desks
  it holds;
- the rug covers a stated fraction of that room's floor;
- the pod light pools are a stated number of ramp steps above the concrete
  between them;
- everything in the "do not regress" list above.

## Final validation

1. Capture 1-, 10- and 20-developer frames at 1664×936, and 20 at 997×448.
2. Capture the 20-developer frame with the CRT **off** as well as on, and keep
   both — the off frame is the one that evidences material and value.
3. Produce a side-by-side against v9, plus **four region crops** at 1:1:
   leadership, workshop wall, kitchenette wall, and one pod.
4. Run `npm run check` once in full and let it finish.
5. Re-read every GDD region amended during implementation.

## Definition of done

- The workshop and kitchenette walls read as furnished rooms, not as walls with a
  few objects at the bottom.
- No prop is visibly the wrong size next to a person.
- A pod reads as four people at a table.
- The masonry reads as brick: mortar darker than brick, variation between
  courses, openings with depth.
- The leadership room is sized for two, carpeted, furnished, and its sign does
  not compete with the people in it.
- The five pods separate by light as well as by distance.
- The rear band is a dense tree line with buildings behind it, not buildings with
  trees in front.
- Remaining differences are listed individually with a concrete engine,
  interaction or performance reason — and any that are "I judged this by eye" say
  so.
- `npm run check` passes completely and `GDD.html` agrees with the result.

The final report must state, for every claim it makes, whether a gate proved it,
a measurement supported it, or a person judged it.
