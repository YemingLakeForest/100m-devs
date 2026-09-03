# Superseded garage v5 implementation loop

> Superseded on 2026-09-03 by
> `docs/PROMPT-garage-v6-implementation-loop.md`, which adds the exact curbside
> rhythm of one street light per three planters on both visible sides.

# Agent goal and visual convergence loop — garage v5

> This is an execution prompt, not a second design authority. `GDD.html` remains
> canonical. The target image named below is canonical through GDD §7.8.0c.

Copy everything below into the implementation agent.

---

Read `CLAUDE.md` completely before acting, then create and pursue this goal:

> Make the live 20-developer garage scene in *100,000,000 Developers* converge
> as closely as the runtime renderer permits on
> `docs/assets/concepts/garage-layout-concept-20-devs-v5-no-vehicles-seven-leaders.png`,
> while preserving gameplay, hit testing, walking, deterministic seat identity,
> the enforced palette and supported-device performance.

Do not stop after writing a plan or after one visual pass. Run the convergence
loop below until every acceptance criterion is satisfied or a genuine external
blocker is reached. This goal is only the garage scene. Do not redesign the
100-developer office or later scale levels.

## Authority and scope

The v5 image is the spatial and visual target for:

- camera and whole-scene framing;
- wall, gate, door and pillar geometry;
- leadership-room footprint and glazing;
- the five developer-pod positions and orientations;
- empty circulation space and the clear gate apron;
- floor value, seams, cracks and cable lines;
- furniture zoning, scale and palette;
- interior amber/cyan lighting balance;
- exterior pavement, lamps and planters, with no vehicles in the garage frame;
- seven distinct leadership positions for the founder and six named heroes.

It is not a raster background to ship. Reproduce it with the current procedural
Pixi/isometric renderer and reusable primitives. Keep the current Minecraft-like
people: square heads, cuboid bodies and limbs, tiny faces and two- or three-tone
clothing. Do not raise asset detail beyond what the live game can draw.

Inspect at minimum:

- `GDD.html`, especially §7.8.0b and §7.8.0c;
- `src/render/garage.ts`;
- `src/render/room.ts`;
- `src/render/garage.test.ts`;
- room, shell, camera-fit, walking and frame acceptance tests;
- the current 1-, 10- and 20-developer garage captures.

Preserve unrelated worktree changes. If implementation reveals a genuine
conflict with the GDD, amend the conflicting passage in the same batch and mark
it in the existing house style. Do not create another design document.

## Non-negotiable scene contract

### Population and pods

- Exactly 20 ordinary developers at the completed garage.
- Exactly five pods, four developers per pod.
- Each pod is one rectangular timber table with two developers facing two.
- Founder and leadership occupants are physical but do not consume the 20 seats.
- Every developer, monitor and desk must be visible in the resting 20-developer
  frame. Near walls, the gate, HUD and other people may not hide them.
- No chairs are rendered in the garage yet. Do not draw chair backs, chair rails
  or chair arrival pieces. Continue reserving enough footprint and aisle room
  for a seated body; “no chair sprite” does not mean “no clearance.”

### Four real workstation orientations

The finished garage must visibly use all four floor-axis facings:

- `gx+`
- `gx-`
- `gy+`
- `gy-`

These are not palette variants or horizontally flipped screen-space sprites.
They are four geometry states in the isometric floor coordinate system.

- A developer and their monitor always share the same facing.
- The developer across the table uses `opposite(facing)`.
- A pod whose table runs along `gy` supplies `gx+`/`gx-` seats.
- A pod whose table runs along `gx` supplies `gy+`/`gy-` seats.
- Across the five pods, use both legal table axes and make all four facings easy
  to see in the canonical camera.
- Screen stand, screen face/back, keyboard, body pose, selection anchor, hit
  target and depth layer must all derive from the same `Facing` value.
- Do not rotate a completed screen-space container and hope its depth remains
  correct. Project the workstation footprint from the floor axes.

Generalize the current orientation seam instead of adding four unrelated draw
functions. `Pod` should own its table axis or facing pair; `garageSeat()` should
derive seat coordinates and facings from it; rendering and interaction should
read that result.

### Architecture and framing

- Show the entire garage, all exterior corner pillars, both rear wall tops, both
  near cutaway walls, gate, personnel door and a narrow street surround.
- Garage occupies roughly 75–80% of the frame and is centred between HUD rails.
- Rear walls are full height. Near walls are thick cutaways and must not hide a
  workstation.
- All wall runs use the legal isometric axes, one thickness and one coping
  height. Endpoints meet pillars exactly: no gaps, overlaps or doubled caps.
- Square pillars stand at every exterior corner. Gate jamb pillars share the
  same grid, value hierarchy and vertical baseline.
- The roll-up gate is the frontage's full vehicle-height opening. Its shutter
  runs from slab to a shallow aligned sign header.
- The sign reads exactly `NO BUGS. JUST FEATURES` and follows the wall axis.
- The personnel door is fitted into the same frontage with a real opening,
  jambs, lintel and clear threshold.
- Reserve an empty gate apron at least two character widths deep. No desk,
  person, prop, lamp or loose cable may occupy or cross it.

Derive shell segments, pillars, openings, camera extent and collision geometry
from one pure architectural plan. Do not tune five screen-space drawings that
only happen to touch at the target viewport.

### Leadership room

- Restore the compact leadership room in the far-left/back zone shown by v5.
- It shares the two solid exterior rear walls and uses dark-framed, cyan-tinted
  glass only on its two interior-facing sides.
- Glass panes and mullions lie on legal isometric axes.
- Give it a straight opening toward the main floor, a dark warm rug and exactly
  seven simple compact work positions at the completed-garage target.
- Populate those positions with exactly seven non-capacity occupants: the player
  founder plus James, Mo, Serena, Matt, Melany and Billy. Do not label them in
  the room; identity comes from the existing hero/founder data and rendering.
- Keep every one of the seven positions countable and unobscured, with a clear
  internal route from the glass-room doorway.
- Keep a real lane between its glass and the nearest developer pod.
- Keep leadership capacity independent from ordinary-developer capacity.

### Floor, cracks and cables

- Use the v5 floor's dark warm-brown concrete value, not a pale lilac slab.
- Stay inside the master palette. If the target colour falls between entries,
  achieve it through existing palette colours and restrained alpha layering.
- Draw broad deterministic pour bays first.
- Draw a small irregular crack network over the slab: varied lengths, branches
  and offsets, never a repeated tile texture or random-on-every-rebuild noise.
- Cracks should cross quiet negative space and help describe the slab without
  outlining every pod.
- Use a few dark/amber cable runs from perimeter power to pods. Route them along
  aisle edges and around the clear gate apron; do not create a tangled web
  through walking lanes.
- Floor marks belong to floor space and stay underneath furniture, people,
  walls and lighting.

### Furniture zoning

Treat the concept's placement as authored floor-plan data, not random dressing.
Give every major prop a named plot, footprint and wall/zone relationship.

- Far-right workshop run: open shelves, stored boxes, tool board, workbench,
  red tool chest, bicycle silhouette and stacked tyres.
- Far-left wall outside leadership: compact fridge, kettle table and nearby bin.
- Right-wall lounge: block sofa and folding stool after the workshop run.
- One deliberate storage corner: only a few crates and pallets.
- Props sit flush to their intended wall or anchor and have breathing room.
- No prop overlaps another, blocks a window/door, invades a pod footprint or
  narrows a required aisle.
- Remove accidental clusters caused by procedural coordinates. Deterministic
  does not mean sensibly placed; the placement table must express the zone.
- Furniture remains simple cuboids and short line details. Do not solve layout
  by importing richer art than the live game uses.

### Lighting and palette

- Five tight amber task-light islands, one centred on each occupied pod.
- One restrained warm workshop light over the workbench.
- Small cyan monitor faces and glass reflections; no giant central cyan wash.
- Concrete between pools falls darker so the five teams read separately.
- Preserve readable timber desks, Minecraft-like people and screen silhouettes
  inside every pool. Bloom must not merge a pod into one yellow shape.
- Exterior remains darker than the room.
- Preserve the master palette, top-left light logic, contact shadows, CRT
  scanlines, restrained bloom and vignette.

### Street lamps, planters and vehicle-free roads

- Derive exterior dressing from straight sidewalk/curb runs, not scattered
  coordinates.
- Street lamps use one model, one curb setback and a regular interval.
- Bush planters use one model and setback, centred rhythmically between lamps.
- Exclusion spans keep both out of the gate driveway, personnel threshold,
  crosswalks, road lanes and pillar footprints.
- Lamps are vertically aligned and planters share the sidewalk axes.
- Do not render parked, moving or decorative vehicles anywhere in the garage
  frame. Preserve the road surface, lane markings and clear kerb geometry.
- The exterior is a narrow frame for the garage, not a second scene competing
  with it.

## Visual convergence loop

Repeat this loop. Work on one mismatch class at a time.

1. **Inspect the target and current frame.**
   Open v5 at original resolution. Capture the current 20-developer scene at
   1664×936 using the same 16:9 framing. Also capture a `nopost` frame when
   inspecting geometry or palette beneath CRT effects.
2. **Make a fidelity ledger.**
   Record the largest visible mismatch as: target observation, current
   observation, owning code/data, proposed change and a measurable pass claim.
3. **Measure in floor coordinates.**
   Convert target positions and clearances into the garage plan's `gx`/`gy`
   system. Do not copy screen pixels into layout constants.
4. **Pin the claim.**
   Add or update focused pure tests before changing geometry: orientation,
   opposite facing, footprint separation, wall/pillar continuity, exclusion
   zones, regular exterior spacing or camera containment.
5. **Implement one coherent slice.**
   Change the smallest shared plan/drawing primitive that resolves the current
   mismatch. Do not mix seating, shell, exterior and lighting rewrites in one
   unreviewable patch.
6. **Run fast verification.**
   Run the focused Vitest files plus TypeScript/lint relevant to that slice.
   Do not run the multi-minute full playthrough on every visual adjustment.
7. **Capture and compare again.**
   Save a temporary current frame and view target/current side by side. Check
   silhouette, normalized placement, negative space, occlusion, values and
   lighting—not only whether the expected objects exist.
8. **Correct the largest remaining mismatch.**
   If the change did not visibly close the intended gap, revise or revert it.
   Do not keep invisible complexity because its tests pass.
9. **Protect gameplay.**
   Recheck hit points, selection anchors, depth sorting and walk routes whenever
   workstation or architecture geometry moves.
10. **Continue.**
    Update the ledger and begin the next mismatch. Do not call the scene done
    while an important difference can be fixed with current primitives.

Use tracked screenshots only at meaningful milestones. Temporary iteration
shots belong under `tmp/`; retain a final game capture and side-by-side
comparison under `docs/assets/shots/`.

## Recommended loop order

1. Whole-shell plan, wall/pillar joins, openings, gate apron and camera fit.
2. Leadership-room footprint, glass and reserved capacity.
3. Five pod positions and exact no-overlap/no-occlusion clearances.
4. Four-facing workstation/person geometry and no-chair rendering.
5. Warm floor material, pour seams, deterministic cracks and cables.
6. Authored workshop, kitchenette, lounge and storage plots.
7. Pod/workshop lighting and palette/value balance.
8. Exterior curb runs, lamps, planters, vehicle suppression and exclusion spans.
9. Final composition, compact viewport and interaction pass.

## Required automated claims

Tests must prove at minimum:

- `GARAGE_SEATS === 20` and there are exactly five pods of four;
- completed garage seats include all four `Facing` values;
- every across-table pair uses exact opposite facings;
- monitor and developer orientation come from the same seat facing;
- no garage chair geometry is drawn;
- occupied seat identity and position do not change when the next hire lands;
- pod footprints do not overlap each other, props, leadership glass or walls;
- every pod has seated-body clearance and a reachable aisle exit;
- no pod or loose object intersects the gate-apron exclusion plot;
- wall segments terminate inside their intended pillar footprints;
- gate and personnel openings remain real gaps in wall geometry;
- sign header and shutter use the frontage axis;
- leadership plots do not consume ordinary capacity;
- the completed leadership room exposes exactly seven work plots and occupants:
  one founder plus all six named heroes;
- props stay inside their named zones and never overlap;
- crack/cable plans are deterministic;
- lamp and planter positions follow their curb runs with uniform setbacks and
  respect all exclusion spans;
- no vehicle display object is emitted for the garage camera stop;
- camera containment includes the complete shell and every pillar at 1664×936
  and the supported compact landscape viewport;
- the 20-developer frame exposes a usable hit point for every developer;
- walking routes connect doors, pods, workshop and leadership room without
  crossing solids.

## Final validation

When visual convergence is genuinely complete:

1. Capture 1-, 10- and 20-developer garage frames at canonical desktop size.
2. Capture the 20-developer frame at the supported compact landscape size.
3. Produce a final side-by-side comparison with v5.
4. Run focused garage/room tests once more.
5. Run `npm run check` once in full, including room geometry, UI-frame and
   playthrough gates. Let it finish; do not replace it with partial success.
6. Re-read every GDD region amended during implementation.

## Definition of done

Do not mark the goal complete until:

- the live 20-developer screenshot is immediately recognizable as v5 without
  relying on HUD labels;
- all five pods, all 20 ordinary developers and all four facings are visible;
- no garage chairs are rendered;
- walls, gate, sign, personnel door and pillars form one coherent shell;
- the leadership room is attached, contained and populated by exactly the
  founder and six named heroes at seven distinct work positions;
- the gate apron and all main aisles are visibly clear and mechanically routed;
- floor colour, cracks, seams, cables, furniture palette and light hierarchy
  closely match v5;
- workshop, kitchenette, lounge and storage props occupy sensible authored
  zones with no overlaps;
- exterior lamps and planters are aligned, evenly spaced and excluded from
  entrances and roads;
- the exterior roads contain no vehicles;
- supported frames contain the whole required composition;
- remaining visible differences are listed individually with a concrete engine,
  interaction or performance reason;
- `npm run check` passes completely;
- `GDD.html` agrees with the result.

The final report must include the target and comparison image paths, files
changed, GDD amendments, orientation/geometry test results, full verification
results and any documented residual visual differences.
