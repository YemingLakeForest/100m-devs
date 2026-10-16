# Plan — 2026-10-16: fixing the fun killers

Asked for by the user: *"anything current game does not work and not fun and clunky and fun killer, raise them all"*,
then *"add this to a page under doc, then plan implementation, you can do with multiple agent"*.

The audit is `docs/AUDIT-2026-10-16-fun-killers.html`. It has 13 findings, measured by a scripted-player vitest against
the real store at `56c56c2`. Five planning agents each took one group of findings and read the code and the GDD. Nothing
in `src/` or `GDD.html` was changed. This file merges their plans, settles the places where they disagreed, and puts the
work in an order where each step ships on its own.

---

## 0 · Decisions the user owns

Each has a default. Work proceeds on the default unless the user says otherwise.

| # | Question | Default | Contradicts |
|---|---|---|---|
| D1 | Over-hiring in Run 2+ can now reach the −$1M bankruptcy (output goes flat past peak while payroll keeps rising). Accept it, or clamp cash at the threshold and disable hiring? | **Accept.** Run 1's lesson becomes a real consequence later on. | §25.3.2 "none of this may become a fail state" |
| D2 | Run 1 shape: **A** a longer garage (5 ships, no hiring), **B** a handful of hires before the bait, **C** a HALT ONBOARDING brake during the waves | **A** | A: §21.0e "four minutes", §13.12.2. B and C contradict §21.0e and §13.12.2 outright |
| D3 | Refunds make a release's total revenue movable (incidents, tickets and bad reviews delete money, logged per release) | **Yes**: "the total cannot move by *luck*" | §4.10e "the total cannot move" |
| D4 | Serena brings auto-ship with her arrival (it is no longer a node), and the hand ring becomes a held-batch "launch" | **Yes** | §10.8b, §21.7.3 |
| D5 | Hiring ships faster: build time falls with velocity down to a floor | **Yes**: this is the user's stated loop | §14.8.7 "about a minute at every scale", §14.8.8, §4.10h |
| D6 | Does "Billy arrives when we know how to increase sync" also need a sync node to have been bought? | **No**: dwell time plus the cap wall (THE THREAD, the old anchor, is deleted) | — |

---

## 1 · Where the group plans disagreed, and the ruling

- **Serena's reliability nodes (r1 Runbook, r5 It Was Degraded).** The money group wires them in its tree batch, and the
  Serena group hands them to Matt. **Ruling:** they ship with phase 5 (Matt), because they are levers on the refund and
  incident model and must be tuned against it.
- **How Matt's help desk scales.** The Matt group wants flat bases plus tree growth; the money group's batch makes
  matt:t3 "+2% of headcount". **Ruling:** flat bases (`MATT_DESK_HEADS`, `MATT_ONCALL_HEADS`), and t3 becomes "+N flat
  heads per level". If any lever is a share of headcount, Matt goes back to being a permanent off-switch.
- **Shift prompt.** The cadence group proposed `shiftPays()`, and the money group proposed a lit door after a sustained
  stall. **Ruling:** one pure predicate, `shiftPays(offer, nextCapPrice, devs, cap, cappedForSeconds)`. It is true when
  the shift's BP buys the next ×10 cap level **or** the studio has spent ≥60s past peak or ≥3 minutes cap-bound with
  nothing affordable. It is built once, in phase 3.
- **Serena's arrival trigger.** The pacing group wants 20 hand releases; the Serena group keeps 8. Faster cadence makes
  any count arrive sooner. **Ruling:** restate it as *minutes spent hand-shipping* (≥ ~8 min) plus the arrival gap. That
  number holds whatever the cadence.
- **The cadence floor against the ring.** A 30s cadence means about 2 modal rings a minute. **Ruling:** start at a 30s
  floor (phase 2). Drop to ~20s only after phase 4 makes the ring a held batch, so rings per hour are capped (≤ ~15).
- **James.** The money group's j5a (tap ×1.5) and the cadence group's scale-free poke plus `JAMES_LIFT` both touch
  `pokeJames`. **Ruling:** the cadence design is the base (a share of studio velocity, clamped at 1×), and j5a multiplies
  that share.
- **Cash whiplash.** The Matt group retunes the spike, and the cadence group notes that faster cadence already overlaps
  tails. **Ruling:** do the retune (phase 2). It is cheap, moves no totals, and the HUD must not smooth (§10.6).

---

## 2 · Phases

Each step ends with `npm run check` green. GDD amendments go in the same commit as the code they describe, marked
`[amended 2026-10-16]` with the reasoning kept. The `src/test/pacingProbe.ts` table is re-printed after each phase and
pasted into the commit message.

### Phase 1 — Measurement harness (no behaviour change)
1. Move the scripted player from `arrivalOrder.test.ts:40-81` and `pacing.test.ts:175` into `src/test/pacingProbe.ts`.
   The policies are `careful | greedy | manualOnly`, and SHIP latency is a setting.
2. Add `src/game/pacingProbe.test.ts`, which is skipped unless `PROBE=1`. It prints per minute: scenes, devs, cap,
   entropy, cash, build seconds, ships (hand/auto), rings opened, seconds blocked, incidents, tickets, refunds.
   Also add the `probe:pacing` npm script.

### Phase 2 — Hiring ships faster (findings 01, 08)
1. **Offline walk in closed form on the terminal rung** (`offline.ts:317-338`). `k = min(floor(burned/commitment),
   shots + room)`, so `MAX_OFFLINE_SHIPS = 64` no longer truncates an absence at a faster cadence. This is safe today.
2. **Cadence curve.** In `economy.ts`, add `targetBuildSeconds(v) = max(MIN_BUILD_SECONDS, T0·(v0/v)^α)` with α≈0.7,
   a 30s floor and `v0 = terminal commitment / TARGET_BUILD_SECONDS`. `commitmentFor` (`store.ts` ~854-872) calls it.
   Payout already scales by the same ratio (`shippedScale`), so revenue per second does not change. At v ≤ v0 nothing
   changes, so Run 1 does not change.
   - Tests: T is non-increasing in v; T(2v)/T(v) ≤ 1/1.6 above v0 before the floor; T = T0 at v ≤ v0; T never goes
     below the floor; revenue per second is unchanged across cadences; doubling heads under cap shortens the *next*
     build; `runOne.test` stays green unchanged.
   - GDD: §14.8.7, §14.8.8, §4.10h, the §10.10 MAX_RUNWAY note.
3. **Spike retune** (`revenue.ts:60-66`). `SPIKE_TAU` goes from [4,8] to [12,20], and `SPIKE_SHARE` from [0.5,0.68] to
   [0.3,0.45]. Rewrite the "first ten seconds" comment.
   - Test: the peak-to-mean income ratio over one build is lower than before.
   - GDD: the spike wording in §4.10e.

### Phase 3 — Money always has a job (findings 02, 09, 10)
Root cause, beyond what the audit found: tree nodes open by `eraIndex(peakDevs)`. Era 2 needs more than 1,000 heads, but
era 1's capacity tops out near 151, so the supply of things to buy runs out. B2's `entropyCap 0.8` floor (`techTree.ts:681`,
`store.ts` ~1383) makes output `0.2·D` past load 1.32, so over-hiring never collapses.
1. **B2 becomes a work floor.** `η ≥ (1−entropyCap)·min(1, peakHeads(cap)/D)`, so total output is flat past peak.
   Add a past-peak readout on the speedometer ("N past peak: output −X%, payroll $Y/s"), show negative marginal output
   on the HIRE quote, and highlight LAY OFF. *(D1.)* GDD: §11.2 B2, §25.3.2.
2. **Org Chart (billy:c4) becomes the repeatable capacity sink.** Move it to era 1 under c2, make it uncapped, and give
   it k≈4 (×1.23 cap per level). Price it `P0·1.30^L` with no income floor, via a `repeat` branch in `treePrice` and a
   floor skip in `treePriceOf`. Lower the floor for one-off nodes from 3 to 1.5 minutes of income. Memoise
   `syncCapMultiplier` in `techCache`.
   - Tests: minutes of income per level is non-decreasing; each level raises cap. Scripted Run 2: the careful player
     always has something affordable within about 10 minutes of income at minutes 20, 40 and 60; peakDevs reaches era 2
     within the hour; the greedy player's cash slope is negative past peak.
   - GDD: §4.2, §2.7, §14.8.9.
3. **`shiftPays` prompt** (see §1), as a pure helper with the HUD pulse "×10 seats". GDD: §13.2, §13.12.4.

### Phase 4 — Serena makes automation a real trade (findings 06, 07, 13)
1. **The review reel plays only on attended releases.** Auto-ships show a one-line ticker instead.
   Test: auto-ship produces no `ship` event.
2. **Auto-ship is delay-based and comes with Serena's arrival** *(D4)*. A build ships once
   `runSeconds − shelvedAt ≥ latency`, with a base of about 20s divided by the speed nodes. A delay keeps up at any
   cadence. Offline: auto-ship owned means every build ships. Settle the "to confirm with the user" line in
   `pipeline.ts:32-33`. Test: with build time ≥ delay, the floor never stops.
3. **Polish on a full queue.** A poke into a full queue takes defects off `shelf[0]`, capped at 50% per build, and shows
   a POLISH floater. Velocity stays 0. Rewrite `nagFullShelf`.
4. **The HUD shows things as they arrive.** Add `queueEta`, `runway` and `entropyLabel` flags to `Unlocks`: the queue ETA
   once Serena arrives or the queue is tight, runway after the first hire or while cash flow is negative, the
   speedometer label once Billy arrives. GDD: §21.7.6b.
5. **HOLD and batch launch.** HOLD pauses Serena, and SHIP! becomes LAUNCH ×N: one ring for every held build, with bugs
   drawn from the batch's total defects. The minimum batch is `ceil(LAUNCH_HOLD_SECONDS / buildSeconds)`, which keeps
   rings to ≤ ~15 an hour. Without HOLD, SHIP! is an instant ×1 release with no modal. Before Serena, every SHIP! is
   still a one-build ring (Run 1 tutorial unchanged). `__parkBuild` still opens a one-build ring for the ui-frame
   `?release` frame.
   - Tests: the batch releases oldest-first with one reel; a launch below the minimum batch is refused; rings per hour
     stay bounded for builds of 20–120s; a blind batch averages ×1.
6. **Serena node pass.** Rewrite the capacity copy ("hold one more build for a launch"), a1 becomes **Launch Day** (it
   unlocks HOLD), and wire Ship on Green to `pipelineLaunch(stagesUp)` (+1 stage).
7. **Lower the cadence floor from 30s to about 20s** and re-run the probe.
- GDD: §10.8b (what auto-ship pays, the delay model, the queue as launch size, the pause sentence, the reel only for
  attended releases), §26.3.4, §21.7.3, §24.8.

### Phase 5 — Matt's problems cost money and give you something to do (finding 05)
1. **Refund primitive and the books repaired** *(D3)*. Add `refunded`, `keep`, `cutPaid` and `cutAge` to `Release`, make
   the tail piecewise closed-form, and add `refund(release, share)`. The ticket tax becomes logged refunds; today it
   deletes money silently at `store.ts` ~2649. Add defaults for old saves. Invariant:
   `paid + refunded + outstanding === payout`. GDD: §4.10e.
2. **Incidents aim at the release with the highest `d·a`**, not the oldest (`incidents.ts:288`), and refund
   `INCIDENT_REFUND_PER_SEC` while open, capped so `keep ≥ 0.3`. The chip shows "−$/s REFUNDING". GDD: §4.12a.
3. **Player verbs.** On an incident chip: PATCH (each tap removes about 6s of work) or REFUND & MOVE ON (eat about 25%
   of outstanding and go back on sale). The ticket bar takes taps too. GDD: §4.15, §10.1.
4. **Bad reviews refund at launch.** `refundShare(rating)` in [0, 0.2], 0 at or above baseline. Raise the
   `revenueMultiplier` floor from 0.55 to about 0.7 so a bad rating isn't charged twice. GDD: §4.14.
5. **Matt is rescaled.** Ticket load follows lifetime players (Σpayout / `DOLLARS_PER_PLAYER`, which is what §4.13
   already says). Matt gets flat desk and on-call bases that grow only through his tree. He auto-resolves incidents older
   than about 10s by the cheaper action, and hand-patching stays better. `MIN_CATALOGUE_MULTIPLIER` goes from 0.8 to 0.6.
   Wire serena:r1 and r5 here. GDD: §4.13, §21.7.3, §22.8 ("Matt takes the pager off your desk, not the problem off
   your books").
- Every refund source is gated on `currentUnlocks().simulated` (Run 1 books zero refunds). Offline touches none of it.
  `lifetimeRevenue` (and so BP) excludes refunds.

### Phase 6 — James and the tree batches (findings 03, 12)
1. **Gym clock.** `STUDIO_HOUR_SECONDS = 60`, opening at 11:00, so the first gym is at about minute 23 and then every
   24 minutes. Add a HUD studio clock. GDD: §21.7.0 rule 5.
2. **James as a share of the studio.** `JAMES_LIFT` (about +10%) goes into `structuralVelocity`, so his speed shows up
   as faster releases. `pokeJames` = `max(2×tap, 0.25s × structuralVelocity)`, with sustained poking clamped at +1×
   studio velocity. Wire j1, j2 and j4 as their cards say. j5a/j5b (fork C) and j6 Grep Everything (commitment ×0.9).
3. **Founder batch:** m2 Moving Day (×1.5 cap, the HQ move), p2 Walk the Floor (`reachRows`), p6 Take a Holiday
   (`worksOffline`, plus an offline test), j3 Knows a Chap (call Billy in early).
4. **Billy batch:** b1 Timebox, and the b2/b3 fork (Walking Meeting / Async Standup). Matt t3 becomes flat heads.
5. **Cuts and future tags.** Cut the loss-slice-only nodes (billy d2, d3, b6, b7; james j7, j8; you m3, h5). Hide
   matt m2–m5, serena r3/r4 and the Rollback links until §17. Show the era-4 nodes dimmed and labelled "future".
- Test: every `isBuilt` node moves some fold, and an empty save moves nothing (extend `treeLevers.test.ts`).
- GDD: the §8 and §11.4 triage table.

### Phase 7 — Pacing skeleton (finding 04)
Run it after phases 2–5, so the problems it spaces out actually hurt.
1. **Scene cooldown (60s) and arrival gap (300s)** via `lastSceneEndedAt` and `lastArrivalAt`, set in `dismissScene`
   and read by `checkStoryTriggers` and `checkBoardTriggers`. Run 1's scenes are exempt. GDD rule: "a clock may hold a
   door shut; it may never open one".
2. **Dwell times.** Billy: sync slipped ≥180s **and** at the cap wall ≥60s. Serena: ≥ ~8 minutes hand-shipping, plus
   the gap. Matt: ≥2 incidents open for 30s, ≥8 minutes after Serena. The promotion goes through the cooldown.
   Target order and spacing: board ~5, Billy ~9–10, Serena ~16–20, promoted ~17–21, Matt ~28–35.
3. **Milestone bubbles**, not an event system: `src/sim/milestoneBeats.ts` (pure). Non-modal lines from James at hq
   stage crossings (20/100/1,000), the first $1M game, the terminal rung, and the shift threshold. GDD: new §21.7.8
   "the hour between people".
- Tests (`arrivalOrder.test.ts`): Billy < Serena < promoted < Matt; consecutive gaps ≥ `ARRIVAL_GAP_S`; no scene opens
  within `SCENE_COOLDOWN_S` of the last. The longest stretch without a beat is printed, not asserted.
- GDD: the §21.7.3 table, rewrite §21.7.7d (still lists Mo, THE THREAD and Melany), §13.12.2.

### Phase 8 — Run 1 (finding 11), on D2
Option A: two Run-1-only garage ships before the term sheet (`TERM_SHEET_AFTER_SHIPS`, `onboarding.ts:298`), indexed so
Run 2's garage is unchanged, with the ring as the skill on each. GDD: §21.0e, §13.12.2, James's "two of us shipped
four games" line.

---

## 3 · Running it with multiple agents

Almost every phase edits `store.ts`, so phases run **in sequence on main**, not in parallel. Agents help inside a phase
where the work splits by file:

- **Phase 2:** offline closed form (`offline.ts`) ∥ spike retune (`revenue.ts`). The cadence curve goes after both.
- **Phase 4:** the HUD reveal flags (`unlocks.ts`, `queueModel.ts`, `Readouts.tsx`) ∥ the reel/ticker
  (`ReleaseReview.tsx`, plus a new HUD component). The belt work in `store.ts` stays with one agent.
- **Phase 6:** the founder, Billy and James lever folds live in separate functions in `treeLevers.ts`. One agent writes
  the levers, then a second wires `upgradeTrees.ts` and the tests.
- Each agent works in a `worktree` and the lead merges. `test:ui-frame` runs in the background after the merge, never
  while an agent is editing the tree.

## 4 · Risks across phases
- **Offline** (`offline.ts`, §24.7 "integrate, never simulate"): phase 2.1 must land before any cadence change. Phases 4.2
  and 6.3 (p6) change offline payouts and need their own `offline.test` cases.
- **Run 1 is unchanged unless D2 says otherwise.** The cadence holds below v0, the trees are gated, refunds are gated,
  and B2 only exists once Billy arrives. `runOne.test` is the proof.
- **Saves:** new fields on `Release` (phase 5) and `holding` (phase 4) need load defaults. c4's new parent must not
  strand old saves.
- **ui-frame gate:** the ring frame must stay a one-build ring, and the ×N chip must fit the 336px brief.
- **Bankruptcy:** D1, plus the refund bleed cap (`keep ≥ 0.3`), so incidents can't become a fail state that §4.12 forbids.
