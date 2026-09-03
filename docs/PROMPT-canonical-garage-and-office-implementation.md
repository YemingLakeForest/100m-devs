# Agent prompt: canonical garage and 100-developer office

> This is an execution prompt, not an additional design authority. `GDD.html`
> remains the sole canonical design document. The implementing agent must amend
> the affected GDD sections in the same batches as the code.
>
> **Garage convergence superseded 2026-09-03:** use
> `docs/PROMPT-garage-v6-implementation-loop.md` for the current single-scene
> garage goal, including four workstation facings and no garage chairs.

Create and pursue the following implementation goal. Do not stop after planning;
work through the implementation loop until every acceptance criterion is
satisfied or a genuine external blocker is reached.

## Goal

Rebuild the early-scale presentation of *100,000,000 Developers* around two
canonical concept artworks:

1. Garage, maximum 20 regular developers:
   `docs/assets/concepts/garage-layout-concept-20-devs-v6-curb-rhythm.png`
2. Office floor, maximum 100 regular developers:
   `docs/assets/concepts/office-layout-concept-100-devs-v2.png`

These are the only canonical visual references. Do not use:

- `office-layout-concept-100-devs-v3-straight-entrance.png`
- `office-layout-concept-1000-devs-v1.png`
- Earlier office variants when they disagree with v2

The concepts are visual targets, not raster backgrounds to ship. Reproduce their
architecture, composition and atmosphere through the existing procedural
Pixi/isometric renderer and established palette.

Read `CLAUDE.md` completely before acting. Inspect the current renderer,
simulation ladder, room geometry, floor plan, executive suite, walking system,
camera fitting, scenario tools and acceptance tests.

## Visual fidelity is a primary acceptance gate

The end product must be **as close to the two canonical artworks as the runtime
renderer, interaction requirements and device-performance budget can reasonably
make it**. The artworks are not loose mood boards. They are the target for:

- overall silhouette and footprint;
- camera angle, framing and amount of surrounding street visible;
- relative dimensions of the room, walls, annex, entrance and interior zones;
- wall thickness and the full-height-far/half-height-near cutaway treatment;
- location, size and visual weight of every major landmark;
- desk-pod scale, spacing, orientation and density;
- aisle width and negative space around interaction targets;
- palette balance, contrast, cyan/amber light distribution and darkness outside;
- glass tint, mullion rhythm, locker rhythm and material separation;
- CRT scanlines, bloom, vignette and chromatic fringe;
- HUD placement and the world-to-interface balance.

Do not call a feature complete merely because the correct nouns are present. A
tiny statue, four sofas scattered elsewhere and a kitchenette against a random
wall do not match the office artwork. The central atrium must occupy the same
compositional role, at comparable proportions and in the same visual hierarchy.
Apply that standard to every major element in both scenes.

At the start of each visual loop, record the target element's normalized
position and approximate share of the room footprint from the concept. After
implementation, capture the game at the same aspect ratio and compare the two
side by side. Where helpful, make a temporary transparent overlay or annotated
comparison. Pixel-perfect matching is not required, because the game is dynamic,
but visible differences in silhouette, proportion, spacing, hierarchy, palette
or lighting are defects to iterate on—not subjective polish to defer.

If the current renderer architecture prevents a close match, reshape the
renderer rather than quietly lowering the target. Preserve simulation purity,
interaction correctness, accessibility and frame-rate requirements while doing
so.

## Latest direction overrides the current GDD

The present GDD contains conflicting rules, including:

- §7.8.1a: “A floor holds 10,000 developers”
- §7.8.1c: “The floor unfolds at 100”
- §7.8.2: individual room presentation continues through 1,000 developers
- §7.7.1: existing Construction Ladder thresholds
- §7.8.1e: the current thousand-person authored floor
- §7.8.12: existing leadership-suite geometry

Amend the affected GDD sections in the same batches as their implementation.
Preserve the reasoning behind stable seat identity, visible hiring, continuous
zoom and physical hero placement, but replace obsolete capacities and layouts.

## Target scale model

The thresholds refer to regular-developer capacity. The founder and
leadership/story heroes occupy dedicated physical plots and do not consume the
20- or 100-developer capacity.

- 1–20 regular developers: garage scene.
- The twentieth regular developer visibly completes the garage.
- After the twentieth developer lands, the office transition begins.
- The transition preserves the same roster, identities and count; it does not
  manufacture a twenty-first developer.
- 20–100 regular developers: proper office-floor scene.
- Exactly 100 regular developers visibly complete one floor.
- At 101, presentation begins stacking floors into a building.
- Each completed floor represents 100 regular developers.
- One building contains up to 100 floors: 10,000 regular developers.
- Reconcile every downstream Construction Ladder threshold without moving or
  weakening the 100,000,000-developer title gate.

## Canonical garage

At 20 regular developers, the garage must closely match the garage concept:

- Five four-person 2×2 facing desk pods.
- Twenty regular developer workstations total.
- Founder and leadership figures in a separate improvised corner behind
  reclaimed glass, excluded from capacity.
- Thick concrete-block walls with full-height far walls and half-height near
  cutaway walls.
- A real roll-up garage door, side door and driveway.
- Cracked concrete, workbench, tool board, shelves, beer fridge, kettle, boxes,
  cables, bicycle, battered sofa and mismatched furniture.
- A clear route from the entrance through the five pods to the leadership
  corner.
- Individual people large enough to tap.
- A full-garage frame that communicates the need for expansion.
- The cyan expansion blueprint/seam and an understated expansion-ready cue.
- No statue, grand atrium, corporate canteen or finished executive suite.

The garage must grow into this state without reflowing occupied seats on every
hire. Every ordinary seat and leadership plot needs a stable deterministic
identity.

## Canonical 100-developer office

At 100 regular developers, the floor must closely match office v2:

- Thick continuous exterior walls.
- Full-height far walls and substantial half-height near cutaway walls.
- A real front entrance with the `STUDIO_01` sign.
- Entrance geometry follows v2; do not substitute the rejected v3 portal.
- A non-rectangular overall silhouette.
- A glass-walled `LEADERSHIP` suite bolted onto the outside of one side/corner.
- Mixed horizontal 2×2 and vertical 3×2 facing desk pods.
- Developers on opposite sides of a pod facing one another.
- Irregular departmental neighborhoods rather than uniform rows.
- Broad circulation routes and enough space for tapping, selection effects and
  walkers.
- A central octagonal atrium in a contrasting warm floor material.
- A gold founder statue on a raised central plinth.
- Four sofa groupings circling and facing the statue.
- A complete walking ring around the atrium.
- Multiple kitchenette/tea-point islands in different parts of the floor.
- Warm pendant lighting over the kitchenettes.
- Long rows of employee lockers creating visual rhythm and corridor edges.
- Cyan-tinted glass meeting rooms and short glass partitions.
- Server area, whiteboards, planters and smaller breakout destinations.
- Roads, cars, streetlights, trees and warm-window buildings around the studio.

The landmarks must occupy authored holes in the floor plan. They may not overlap
desks, interaction targets or walking routes.

## Visual and technical invariants

Preserve:

- exact 2:1 isometric projection;
- the existing enforced palette;
- hard integer-grid pixel edges;
- top-left directional lighting;
- correct lit and shaded box faces;
- contact shadows;
- warm wood and amber practical lighting;
- cyan monitors and glass;
- CRT scanlines, restrained bloom, vignette and chromatic fringe;
- existing HUD and monospace interface language;
- stable developer identity;
- poking, dragging, selection and desk queries;
- Founder/Hero Anchor behavior;
- hero placement and leadership-roster interaction;
- arrival animation;
- continuous camera movement;
- mobile readability and performance.

Do not turn the scenes into smooth mobile-tycoon 3D or ship the concept PNGs as
backgrounds.

## Implementation loop

Repeat this loop for every visible claim:

1. **Inspect**
   Trace the current code and tests responsible for the next single claim.
   Measure the existing result and capture a baseline screenshot.
2. **Specify**
   Amend the exact conflicting GDD passage. Record why the old decision no
   longer serves the new scale model. Add or update a focused test that
   expresses the claim rather than merely pinning arbitrary coordinates.
3. **Implement**
   Make the smallest coherent renderer/simulation change that can visibly
   advance the scene. Avoid combining unrelated architecture, scaling and UI
   rewrites.
4. **Verify mechanically**
   Run the focused unit tests, TypeScript and lint checks relevant to the slice.
   Repair failures rather than weakening assertions.
5. **Verify visually**
   Capture the scene at the target headcount, canonical 16:9 framing and
   representative mobile viewport. Compare it side by side with the relevant
   concept, including normalized positions, proportions, silhouette, density,
   material balance and lighting.
6. **Correct the largest mismatch**
   Fix the most visually important difference before adding another feature.
   Do not accumulate “we will polish it later” debt.
7. **Protect interactions**
   Recheck hit testing, desk anchors, walking routes, occlusion, depth sorting
   and camera fitting after every geometry change.
8. **Close the loop**
   At each milestone, run `npm run check`, save comparison screenshots and
   report what visibly changed. Then continue to the next incomplete milestone.

## Implementation order

### Loop 1 — Capacity and address model

- Define ordinary-developer capacity separately from founder/leadership plots.
- Establish thresholds at 20, 100 and 10,000.
- Reconcile Construction Ladder arithmetic and presentation rungs.
- Keep the 100M gate intact.
- Add boundary tests at 19, 20, 21, 99, 100, 101 and 10,000.

### Loop 2 — Shared architectural primitives

- Thick wall solids with top caps and two visible faces.
- Full-height far walls and half-height near walls.
- Door openings as real shell geometry.
- Glass panels with dark mullions.
- Camera and containment calculations based on drawn geometry.

### Loop 3 — Garage seating and environment

- Author five stable 2×2 regular-developer pods.
- Add excluded founder/leadership plots.
- Build the garage shell, doors, driveway and clutter.
- Preserve clear paths and tappable bodies.
- Iterate until the 20-developer capture closely matches the canonical garage.

### Loop 4 — Transition at 20

- Let the twentieth developer arrive normally.
- Hold the completed garage frame long enough to read.
- Trigger the expansion cue once.
- Move the same roster into the office plan without identity changes.
- Do not increment headcount during the move.
- Make the transition physical and continuous, not a menu or loading cut.

### Loop 5 — Office seating plan

- Author stable 2×2 and 3×2 facing pods.
- Give every seat position, orientation, pod ID and neighborhood ID.
- Fill deterministically without moving occupied developers.
- Update depth ordering and aisle exits for every facing direction.

### Loop 6 — Office landmarks

- Central atrium, statue and sofa ring.
- Kitchenettes and pendant-light pools.
- Locker rows.
- Glass meeting rooms and partitions.
- Server area and secondary amenities.
- Bolt-on leadership suite.
- Main entrance and surrounding district.
- Iterate on proportions and placement until the 100-developer capture closely
  matches office v2, not merely its feature list.

### Loop 7 — Building scale

- At 101 developers, change presentation from one floor to a building.
- Preserve the completed 100-person floor as the first storey.
- Add partial/completed floors coherently until the building reaches 100 floors
  at 10,000 developers.
- Keep every hire visually meaningful at building scale.

### Loop 8 — Interaction, performance and polish

- Verify every developer remains individually reachable while the floor scene
  is active.
- Verify walkers never cross desks, lockers, glass or walls.
- Verify near walls never hide important interaction targets.
- Verify the leadership suite remains physically anchored.
- Profile the full 100-developer office.
- Complete mobile framing and full acceptance testing.
- Perform a final side-by-side fidelity pass against both canonical artworks.

## Required test claims

Tests must prove:

- Exactly twenty ordinary seats exist in the garage.
- Leadership plots do not consume ordinary capacity.
- Exactly one hundred ordinary seats exist on a floor.
- Existing developers never move when a new developer is hired.
- The twentieth hire triggers expansion once.
- The transition preserves roster identity and count.
- The 100-person office contains both required pod orientations.
- Opposite pod seats face each other.
- Amenities and seats never overlap.
- Walk routes remain clear.
- The leadership annex is outside but attached to the main floor.
- Wall geometry remains valid in the isometric projection.
- The room and landmarks fit supported viewports.
- The 101st developer enters building presentation.
- One hundred floors equal 10,000 ordinary developers.
- The 100M gate and downstream hierarchy remain internally consistent.

## Visual acceptance frames

Capture at minimum:

- 1 developer in the garage;
- 10 developers in the garage;
- 20 developers, expansion ready;
- the garage-to-office transition;
- 20 developers after arriving in the office;
- 50 developers in the office;
- 100 developers in the completed office;
- 101 developers at the building transition;
- 10,000 developers in the completed 100-floor building.

The 20- and 100-developer frames must be immediately recognizable as the
canonical concepts without relying on HUD labels. Save side-by-side comparison
images for both. Do not use brittle pixel-perfect snapshots as automated gates;
use geometry tests plus deliberate visual review.

## Definition of done

Do not mark the goal complete until:

- both canonical scenes are implemented and closely match their artwork in
  silhouette, composition, proportions, density, materials, palette and light;
- remaining visible differences are documented individually with a concrete
  technical, interaction or performance reason—not dismissed as “close enough”;
- the 20 → office and 100 → building transitions work;
- scaling arithmetic is consistent through the 100M gate;
- existing gameplay interactions survive;
- required screenshots and side-by-side comparisons exist;
- `npm run check` passes in full;
- `GDD.html` agrees with the implementation;
- the final report lists files changed, GDD amendments, measured performance,
  screenshot/comparison paths and complete verification results.
