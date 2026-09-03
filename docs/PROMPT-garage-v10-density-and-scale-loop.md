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
- so a fridge twice as tall as a person, a wall furnished to a fifth of its
  height, and mortar lighter than its own brick all pass everything.

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

### 2. Prop scale against a person

Measured against the concept, the render's fridge is about twice the height it
should be relative to a developer, and the bin about twice. The cardboard boxes
are pale featureless slabs where v9's are darker, with visible flaps and tape.

- **A person is the unit.** Every prop's height must be stated as a fraction of a
  standing developer and checked against the concept, not chosen in tiles.
- Add a claim: no prop in `GARAGE_PROPS` exceeds a stated multiple of person
  height, and the named tall ones (shelving, fridge) sit inside a stated band.

### 3. Workstation proportions

In v9 a four-person table is a **broad timber slab** with generous surface
between the two facing rows, and the monitors are modest objects standing on it.
In the render the table is narrow, the monitors are large enough to dominate both
the table and the people, and adjacent pods visually collide.

- Widen the table; shrink the monitor relative to it and to the body.
- The silhouette to aim for is *four people at a table*, not *four monitors with
  people behind them*.
- Recheck pod separation afterwards — the current spacing was set against the old
  proportions.

### 4. Wall material

The render's brick reads as pale breeze block: evenly spaced mortar lines
**lighter** than the brick, no tone variation between courses, and no depth at
the window openings — the panes sit flat on the surface.

v9's is warm dark brick with **darker** mortar, visible per-brick tone variation,
and openings with a real reveal and sill.

- Mortar darker than brick; irregular per-brick variation from the existing
  palette; a reveal on every opening.
- The **near walls' outer faces have no courses at all** and read as painted
  panels. They are the same masonry as the rear walls and must show it.

### 5. The leadership room

- Its footprint is too large for two people: half the room is empty floor. Size
  it to the two desks plus a walking lane.
- The rug is a thin strip under one desk. v9's covers the room's floor under
  both desks, dark warm red with a border.
- It has no interior furniture. v9 has a whiteboard, a small cabinet or shelf and
  a plant, all inside the glass.
- The `LEADERSHIP` sign is large, cyan, and now competes with the two name
  plates in a room a quarter of the size it was designed for. §7.8.12 keeps the
  sign — it is §13.11.2's roster door and must stay tappable — so make it
  smaller and quieter rather than removing it, and keep it clear of both heads
  and both labels.
- The glass tint is applied across the room's whole floor area and reads as a
  fish tank. Tint the **panes**, not the volume.

### 6. Rear neighbourhood

- The trees are too small and too sparse. v9's canopy is dense and reaches the
  wall; the buildings behind are mostly hidden by it.
- The rear buildings are too pale and too large. They should read as a value
  above the carriageway and little more.

### 7. Lighting

- The pod pools are too weak: the concrete between pods is nearly the value of
  the concrete inside them, so the five teams do not separate.
- There is no warm light on the workshop wall. v9's wall lamp and pendant throw
  a real pool onto the tool board and the bench.
- Judge all of this with the CRT off first, then confirm with it on.

### 8. Floor

- The pour bays are faint. v9's are strong dark joints dividing the slab into
  large squares, and they are a primary read.
- The cable runs are barely visible. v9's are thick dark leads snaking across the
  quiet floor.

### 9. Camera

The building fills 79% of the frame's width against the concept's ~88%, and sits
higher, so the rear band takes more of the picture than it should. Close some of
that gap **without** losing full shell-and-pier containment at 1664×936 and
997×448, which is gated and must stay true.

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

- every prop's drawn height is inside a stated band expressed in **person
  heights**, and the band is different for the named tall props;
- the perimeter's furnished fraction — the share of each far wall's length that
  has a prop against it — is above a stated floor on both far walls;
- wall-hung dressing exists on both far walls above a stated height;
- a pod's table is wider than its monitor is tall;
- the leadership room's floor area is within a stated multiple of the two desks
  it holds;
- the rug covers a stated fraction of that room's floor;
- mortar is darker than the brick it separates, on both far and near walls;
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
