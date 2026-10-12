# Handoff — 2026-10-12: the juice layer, slice A built, slice B next

Read this first, then `docs/PLAN-2026-10-11-juice-layer.md` (the plan and the as-built record of slice A). This file is what that one does not say: the state of the tree, what is unverified, the leads on the one blocker, and slice B and C written as tasks.

## 0. Where things stand

- **Slice A (moves 2 and 5) is built, green, committed and pushed to `main`** (2026-10-12, at the user's instruction "commit and push to main"): commit `juice: numerals that add up at scale, and a hot edge on the queue bars`. It touched 15 paths:
  - modified: `GDD.html`, `src/hud/PipelineGraph.tsx`, `src/render/passiveWork.ts`, `src/render/passiveWork.test.ts`, `src/render/pokeText.ts`, `src/render/pokeText.test.ts`, `src/render/stage.ts`, `src/styles/graph.css`
  - new: `docs/PLAN-2026-10-11-juice-layer.md`, `docs/HANDOFF-2026-10-12-juice-layer.md`, `src/hud/PipelineRow.test.tsx`, `src/hud/Segs.test.tsx`, `src/hud/useHotSegments.ts`, `src/sim/juice.ts`, `src/sim/juice.test.ts`
- **Baseline to compare against:** `npm run check` green on 2026-10-11 — lint, `tsc -b`, vitest **146 files / 1,874 tests**, `art:check` (0 assets, 37-colour palette), `test:ui-frame` (126 screens). Fewer files or tests than that after your change means you deleted something; say so.
- **Gate note:** the full `npm run check` was last run before the docs were written; the commit itself added no code after that run, only `docs/` files and this handoff. Slice B's first full `npm run check` is the next full measurement.
- Today's reference material and tooling were kept in `tmp/juice-layer/` (git-ignored, because `tmp/` is in `.gitignore`):
  - `scripts/` — the playwright probes written this session (`zoomshot.mjs` wheels the lens into the 100-dev house; `hotcheck.mjs` samples a queue slot's colours frame by frame; `probe*.mjs`, `look.mjs`, `func.mjs`, `shot.mjs`), and `patch_gdd.py`, the CRLF-preserving GDD patcher to copy from.
  - `plan-page/` — source and build of the published plan page, and the evidence frames from the trailer (`ev/`).
  - They import playwright-core by absolute file URL from this repo's `node_modules`, take an output dir as `argv[2]`, and expect the game on `http://127.0.0.1:5173`.

## 1. What the user wants (so you do not re-ask)

1. They like the *game juice layer* of **1 Million Books** (trailer: `C:\Users\Anson\Downloads\redvid_io_1_million_books_a_book_sorting_incremental.mp4`) — "how the effects are produced" — and want ours more satisfying.
2. They see the same arc in both games: tedious manual work → progressively automated → number goes up, scaling 1 → 1,000,000 in art and scene. The juice has to change *unit* as the scale does.
3. They want a visual plan (done: https://claude.ai/artifact/9ZvazJvUAL25BeL3qvnrsw, private, version 2) and **agreed to all six moves**.
4. **Style constraint, stated twice in effect: flat and hard-edged. "I don't like gradient light boxes."** No gradients, glows, soft light, blurs, eased fades. Motion is `steps(n, end)`; colour is palette colour (`--n8` is the only white). Memory: `feedback-no-gradient-light-boxes.md`. Check every new visual against `docs/ART_DIRECTION.md` §3 before you call it done.

## 2. The six moves and what is left

| # | Move | State |
|---|------|-------|
| 1 | Flow to a sink — packets from workers to a visible destination; a backlog pile that drains | **open — slice B** |
| 2 | Numerals that know the scale | built (A), but dormant in the 3D game — see §3 |
| 3 | Flash the unit, not the person | open — slice C |
| 4 | Throughput bed with a voice budget (sound) | open — slice C |
| 5 | Hot-edge fills | built (A) |
| 6 | The held breath (odometer, return to the garage desk) | open — slice C |

Facts from the study that drive the design (full detail in the plan doc and the memory file): a drop is six beats in ~600 ms; automation is shown as *flow* to a *sink*; the unit of juice changes with scale and is never thousands of small numbers; sound goes from sparse clicks to one bed with a voice budget; the payoff is withheld (counter held ~11 s, then an odometer roll).

## 3. The blocker: house workers never reach passive work (step zero)

**Symptom.** With `?scenario=squad` (100 devs) and the lens zoomed into the house, `workSeats` in `stage.ts` stayed at 5 (the garage's own seats, off-screen) and `people` was empty, so the stream logic of move 2 has nothing to speak for.

**The path, as read on 2026-10-12** (all line numbers approximate; re-find them):

1. `src/render/stage.ts:736` — every 250 ms `workSeats = working ? garage.codingSeats() : []`.
2. `src/three/render/garageView.ts:1038` — `codingSeats()` returns `[]` when `w/span() < 10`, else `[...env.targets (visible), ...city.codingSeats()]`.
3. `src/three/render/cityHouses.ts:185` — `city.codingSeats()` returns the seats of `b.interior.targets` for every building whose `b.interior?.root.visible`.
4. `src/three/render/cityHouse.ts:148` — `cutaway(on)` creates the interior lazily and flips `interior.root.visible`; it is driven by `cityHouses.ts:128` `setView(camera, pixelsPerMetre)`: `close = ppm >= (exterior.visible ? 10 : 8)`, plus the house centre being inside the frame and `b.start === null` (not mid-landing). `garageView.ts:1085` calls it with `w / span()` — the *same* quantity as the gate in step 2.
5. `stage.ts:739` then keeps a seat only if `garage.screenOf(seat)` is non-null and inside the 17–83 % × 10–82 % window of the frame, and `passiveWork` ignores `rate <= 0`.

**Root cause: not found.** Leads, in order of cost to check:

- **(a) The probe may never have reached the cutaway.** `zoomshot.mjs` wheels three notches at (930, 330); the 100-dev house may not be under that point or may not have reached ppm 10. Cheapest test: read `ppm`, the building's `cutaway` state and `codingSeats()` live (see the probe below). If the interior is simply not visible, there is no bug — the fix is the probe, not the code.
- **(b) The seat numbers.** `screenOf` uses `city.headOf(seat)`, which needs `seat >= offset && seat < offset + staff`; the interior targets' `userData.seat` must be in that range or `headOf` returns `null` and the seat is dropped. Check that `Number(t.userData.seat)` is a real, in-range integer (a `NaN` here would be silent).
- **(c) The on-screen window.** A house taller than the 17–83 % window drops seats at the edges; also `y < h*.1` for a roof-down camera.
- **(d) `rate`.** `developerVelocity(seat, state)` for a house seat could be 0 (`isAway`, or the founder/James branches in `stage.ts:742`).
- **(e) The 8-to-10 ppm hysteresis band.** Between 8 and 10 the interior stays up (`cityHouses.ts:134`) but `codingSeats()` returns `[]` (`garageView.ts:1039`). Not the reported symptom, but it makes numerals vanish while the room is plainly working; align the two thresholds when you touch it.

**How to probe.** Debug seams are gated by `DEBUG_TOOLS_ENABLED` from `src/dev/debugAccess.ts` (loopback only; never on the deployed HTML or Android). The pattern to copy is `installViewModeKeys()` in `src/dev/viewModes.ts:118`: bail out unless `DEBUG_TOOLS_ENABLED`, hang a read-only function on `globalThis` (`__crt`, `__viewModes`, …), return a teardown. Do the same for one read-only `__workSeats()` returning `{ ppm, seats, interiorVisible }` — and **remove it, or keep it gated like the others, before you finish; do not add a second door.** (A throwaway `__dbg` was added and removed this way during slice A.) `viewModes.ts` also has a `freeZoom` mode (key `v`, `__freeZoom()`), which may let the lens get closer than the shipped limit — worth knowing before you conclude that "zoomed in" is reachable. Take the screenshot too — the user's standard for "it works" is a claim about what was driven and looked at, not a green test.

**Test-first, once you know the cause.** If it is a pure threshold or window mismatch, pin the *claim* (e.g. "every seat the interior shows is a seat `codingSeats()` returns") rather than a number. There is no ready harness for a `cityHouses` with a stub camera: the `src/three/render/*.test.ts` files that exist are `cityGrid`, `garageCast`, `garageGlyph`, `garageShell`, `mapLabels`, `osLook`, `msaaScene`, `worldArt` and `hqSets`; read `cityGrid.test.ts` and `msaaScene.test.ts` for how this repo builds three.js objects under vitest before writing a new one. If a three.js scene is not practical, extract the threshold/window decision into a pure function in `src/sim/` and test that.

## 4. Slice B — move 1: flow to a sink

**Goal.** Work is visible as packets leaving the workers and arriving at a destination, one tick at arrival, with the backlog visible and draining — at 1, 100 and 1,000 devs, within a fixed instance budget.

**Design defaults (do not re-litigate; amend the GDD if you change one):**

- **Sink = the project plate** (`env.projectPlate`, fed by `garage.setProject(...)`, `garageView.ts:1043`), because it is already the garage's diegetic "how far along" object. In a house, the sink is that house's own door/porch marker unless you find something better in `cityHouse.ts`. Packets arrive, the plate/sink ticks, the `+1` lands there (that is the "numeral at arrival" the plan deferred in slice A).
- **Packets are instanced and flat.** One `T.InstancedMesh` of small boxes (same pattern as `windows` in `cityHouse.ts:127`: `setMatrixAt` + `.count`), capped, palette-coloured, moving in hard steps (quantise position to ~6 steps per hop — no easing, no trails, no glow).
- **Rate is conserved, not drawn.** Packets/s × value-per-packet = the real rate (the same honesty rule as streams in `sim/juice.ts`), with value per packet growing in decades once the cap binds, so 1,000 devs show fat packets, not 1,000 small ones.
- **Backlog pile** = a stepped heap whose height is a bounded, monotone function of queued work (log-ish, a few hard levels), at the source.

### Task B0: step zero (§3) — house workers reach `passiveWork`

- [ ] Reproduce with a script: `?scenario=squad`, lens in, log `workSeats` and the cutaway state; keep the output in `tmp/juice-layer/`.
- [ ] Write the failing test for the cause you find (claim, not value).
- [ ] Fix; rerun; confirm in the running game that numerals now appear over house workers, and that at 100 devs the per-stream numerals sum to ~the real rate (that is the whole point of slice A).
- [ ] Align the 8/10 ppm band (§3 e) if it is a mismatch.

### Task B1: pure flow budget in `src/sim/juice.ts`

**Files:** modify `src/sim/juice.ts`, `src/sim/juice.test.ts`.
**Interfaces — produces** (suggested; keep the file's existing style of `export function` + JSDoc that argues):
```ts
export const MAX_PACKETS = 48
/** Packets to launch per second, and what each carries, such that the product is the true rate. */
export function packetSpec(ratePerSecond: number, maxPerSecond?: number): { perSecond: number; value: number }
/** Hard levels (0..levels-1) of the backlog heap; 0 only when nothing is queued. */
export function backlogLevel(queued: number, levels?: number): number
```
- [ ] Tests that pin claims: `perSecond * value ≈ rate` for rates `1, 10, 1e3, 1e6, 1e9`; `perSecond <= maxPerSecond`; `value` is non-decreasing in rate; `packetSpec(0)` launches nothing; `backlogLevel(0) === 0`, `> 0` for any positive queue, non-decreasing, never above `levels - 1`.
- [ ] Run `npx vitest run src/sim/juice.test.ts` and watch them **fail** (functions missing) before writing the code.
- [ ] Implement minimally; run again to green.

### Task B2: the packet layer in the 3D scene

**Files:** create `src/three/render/flow.ts` (+ `flow.test.ts`); wire it from `garageView.ts` (where `city`/`env` are built and `render(seconds)` runs).
- [ ] Test first: with a stub rate and N seats the layer never has more than `MAX_PACKETS` live instances, instance count falls to 0 when rate is 0, and a packet that has arrived is recycled (no growth over a long simulated run).
- [ ] Implement `createFlow(parent, { sinkOf, sourcesOf })` returning `{ update(dtSeconds, rate), dispose() }`; reuse the shared-material pattern (`sharedMaterial(...)`, `disposeArt`) so it does not leak — `dispose()` must be called from `garageView.dispose()`.
- [ ] Look at it at 1, 100 and 1,000 devs (`?scenario=solo|squad|floor`, wait 9–12 s) with `shot.mjs`; check against the style note: flat boxes, no glow, stepped.
- [ ] Reduced motion: no moving packets; show the arrival tick only (same rule as the numerals).

### Task B3: the arrival tick

- [ ] The `+1` (or the aggregated figure at scale — reuse `numeralSize`/`formatPokeNumeral`) appears at the sink on arrival, not over the worker, once the flow is on. Decide, and write in the plan doc, whether numerals over heads stay for ≤ 12 people (default: **yes**, they are the tutorial for "what a worker earns").
- [ ] Amend GDD §8.2a in the same batch (it says feedback is anchored to the developer's head); mark `[amended 2026-10-12]`.

### Slice B done when

`npm run check` is green (run `test:ui-frame` in the background; do not touch the tree while it runs) **and** you have driven the game at 1, 100 and 1,000 devs and said what you saw, including the instance count at 1,000 and the frame rate on this machine (see memory `user-laptop-and-perf-measuring.md`: Arc 140T iGPU, 3120×2080 @ 200 %, often on low battery — measure A/B, do not eyeball).

## 5. Slice C — moves 3, 4, 6 (outline; refine after B)

- **Move 3 — flash the unit.** When a *unit* of work completes (a house at 100, a floor at 1,000, a block above), the whole unit steps through the same three flat colours the hot edge uses (`--n8` → light amber → amber), 3 hard steps, then stops. The unit is whatever the lens shows at that zoom; reuse the rung logic that already picks the scene (`game/scenarios.ts` rungs, `render/omniLens.ts` bands). Never a glow.
- **Move 4 — throughput bed + voice budget.** Study first: `src/audio/` (`sfx.ts` and the music's zoom bands in `render/omniLens.ts`). Constraints already in the code: `sfx.ts` **rejected a random-variation clip bank (it read as a melody)** — do not reintroduce one; F6 caps animations at 400 ms unless they are a scored beat. Target from the study: individual clicks thin out as throughput rises (events/s ~5 → ~1) while one continuous bed takes over (~+9 dB step as the camera pulls out), a dip before a milestone, a swell, a cut. Needs a **GDD §20 amendment** (the bed) and a voice cap tested as a claim ("never more than N concurrent voices at any rate"). The plan page has a WebAudio demo of the shape (`tmp/juice-layer/plan-page/juice-plan.src.html`) — a sketch to copy the envelope from, not production code. **Timbre was never tested by ear** (headless); ask the user to listen.
- **Move 6 — the held breath.** Hold the counter just under the milestone for a stretch of quiet camera travel, then roll the last digits as an odometer (`steps()` only; the plan page's odometer demo is the reference), then return the camera to the garage desk. Decide which milestone is the held one for a 100,000,000-developer game (the reference holds at 999,999 of 1,000,000); a headcount milestone is the likely default. `Counter.tsx` in `src/hud/` is where the number is drawn.

## 6. Decisions already made — do not reopen

- **Short numeral forms stay** (`+1.2M`): GDD §8.2 specifies them, the HUD's `formatCount` abbreviates from 1,000, and a thin space risks a non-Departure-Mono glyph (one-face rule). The thin-space idea from the plan is dropped.
- **White is `--n8`.** The CODE segment was already `--p3`, so "arrive lighter" had nowhere else to go.
- **Hot edge is on the rail's QUEUE slots and the queue window's CODE bar**, not the continuous speedometer (`gl__fill`) — a continuous fill has no per-segment "arrival".
- **Streams share past 12 people** (`MAX_STREAMS = 12`); the pool stays 24 alive / 1,300 ms life.
- GDD edits: §8.2a `[amended 2026-10-11]` (streams) and §10.8a "Bars squash and stretch" row `[built 2026-10-11]`.

## 7. Known gaps and things not verified

- **Not seen by eye:** the 110 ms numeral pop and the size steps (canvas, unit-tested only). To see them, record at full rate rather than screenshot: CDP `Page.startScreencast`, or temporarily widen `popScale`'s windows 10× and screenshot. Do not leave the change in.
- **Audio** (move 4) never auditioned.
- **Physical-device performance** of the passive numerals and (later) the packet layer is unmeasured.
- The reference is a **trailer** with jump cuts and a music bed: anything read from its audio after ~38 s is the soundtrack's shape, not game SFX.

## 8. Practical notes that cost time this session

- **CRLF.** `GDD.html` is UTF-8 with CRLF line endings. Patch with `tmp/juice-layer/scripts/patch_gdd.py` as a model (reads bytes, replaces, preserves `\r\n`); re-read the region afterwards (the Windows console mis-renders `§` and `—`).
- **jsdom has no `AnimationEvent`.** The hot-edge hooks clear on `animationend`; the tests fire both `animationend` and `webkitAnimationEnd` via plain `Event`s. Copy that pattern from `src/hud/Segs.test.tsx`.
- **Set-state-during-render** is the house pattern for "react to a prop change" in HUD components (`useHotSegments.ts`, `Counter.tsx`) — do not reach for `useEffect` there.
- **Screenshots:** drive `http://127.0.0.1:5173`, never `localhost` (the user's real save lives on `localhost:5173`, and `?scenario=` jumps clobber it). Headless Chrome needs `--use-angle=d3d11 --ignore-gpu-blocklist --disable-gpu-sandbox --in-process-gpu` or WebGL runs at ~2 FPS. The Claude-in-Chrome tab opens in a background window (rAF throttled to ~1 FPS) — do not use it for animation. Memory: `how-to-screenshot-the-game.md`.
- **The user's Vite dev server is on 5173 and is theirs.** It hot-reloads your edits. Do not kill it; if you need your own, start one on another port and say so.
- **Scenario ladder:** `/?scenario=solo|ten|squad|floor|building|campus|town|metro|nation|starbound|network` (1 / 10 / 100 / 1K / … devs). `?z=<rung/9>` parks the lens. Wait 9–12 s before a shot.
- **`test:ui-frame`** serves the working tree through Vite — an edit mid-run is measured as if it were the game. Start it in the background and do not touch files until it ends.
- **Deleted gates:** the walk, room geometry and the Pixi scene gates are deleted on purpose (CLAUDE.md). Do not recreate them; a claim about a flow or about geometry is made by driving the game and saying what was driven.

## 9. First ten minutes of the next session

1. `git log -1` should be the slice A commit, and `git status` clean. Read `docs/PLAN-2026-10-11-juice-layer.md`.
2. `npm run check` is *not* needed yet if the tree is unchanged; run `npx vitest run src/sim/juice.test.ts src/render/passiveWork.test.ts src/render/pokeText.test.ts src/hud/Segs.test.tsx src/hud/PipelineRow.test.tsx` to confirm slice A's tests are green (38 tests in those five files on 2026-10-12).
3. Start Task B0: the probe in §3, with the lens actually inside the house.
