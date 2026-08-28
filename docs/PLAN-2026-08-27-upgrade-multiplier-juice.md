# Upgrade multipliers and game juice — implementation plan

**Date:** 2026-08-27
**Status:** Proposed; design review before implementation
**Branch:** `codex/upgrade-multiplier-game-juice`
**Worktree:** `C:\Users\Anson\IdeaProjects\100m-devs-upgrade-multiplier-game-juice`

## Outcome

An upgrade must no longer resolve as “money changed and a border got brighter.” The player
will see three connected facts:

1. **what was bought** — the node takes ownership;
2. **where the consequence travelled** — connectors and newly reachable nodes respond; and
3. **what changed in the game** — an effect receipt shows the exact before, factor, and after.

The company, hero, and founder boards will use the same class-diagram grammar and purchase
sequence. Hero placement will use the matching world-space sequence: place, settle, activate.

## Canon delta to make first

The user instruction changes one sentence in GDD §21.7.2. It currently says the player
recognises Instant Messenger “when the board opens on the next tap.” The new flow opens the
company board automatically from the last dialogue tap and performs the acquisition there.

The implementation batch must amend:

- §11.4.1: the company tree shares the UML class-box/Gliffy shell already used by hero and
  founder upgrades, not only the same centre-out topology;
- §11.4.5: add the applied-effect receipt and make the purchase sequence common to all three
  upgrade families;
- §13.8b–c: add the eight-second countdown ring and the one-shot activation wave/receipt;
- §21.7.2: replace “opens on the next tap” with the automatic James handoff; and
- the relevant §25/§26 status and acceptance rows.

Use the house `[amended 2026-08-27]` marker and re-read every patched region as UTF-8.

## Interaction design

### One upgrade surface, three owners

Extract a shared full-frame capability-board shell used by:

- `UpgradeBoard` — owner is `STUDIO_OS`, wallet is cash;
- `HeroTree` — owner is the selected person, wallet is skill points; and
- `FounderBranch` — owner is the founder, wallet is cash.

The shared pieces are the header/toolbar, panning board viewport, UML node box, orthogonal
connector layer, inspector rail, guide layer, and transient purchase effect layer. Each owner
supplies its own node data and statistics. Panel entrance direction may remain owner-specific;
the visual and interaction grammar must not.

Company nodes change from 66 px icon tiles to the existing UML form:

```text
«protocol»
InstantMessenger
-----------------
+ load : ×0.95
− cost : $0
```

The full flavour and effect stay in the guide/inspector. Progressive reveal remains live,
adjacent silhouette, and dark stub.

### Purchase sequence: commit → propagate → prove

The animation is short enough to repeat dozens of times and has no looping residue.

| Beat | Timing | Screen response | Sound / haptic |
|---|---:|---|---|
| Commit | 0–120 ms | button latches; node compresses then starts the existing overshoot spring; wallet decrements | mechanical latch + one medium impact |
| Propagate | 120–520 ms | owned state snaps in; a stepped ring runs along newly energised connectors; newly live nodes resolve from silhouette; board gets at most a 2% kick | resolving tone at ~120 ms; no second haptic |
| Prove | 420–950 ms | an effect packet lands in the inspector and the exact applied receipt punches once | no extra sound |

Reduced motion collapses the spring, camera kick, travelling packet, and connector travel into
one owned-state cut plus the final receipt. It does not hide the receipt.

The pulse distance continues to communicate how much of the tree was unlocked, as GDD §11.4.5
requires. Mechanical magnitude is communicated by the receipt, not by unbounded shake or
particle counts.

### Applied-effect receipt

Add a pure display model which compares the pre-purchase and post-purchase derived state. It
must not infer numbers from node prose. A receipt contains a source, one or more typed changes,
and whether each change is active now or conditional.

Render by change type:

- multiplier: `×1.00 × 0.95 = ×0.95`;
- ceiling: `100% → 80%`;
- value: `1 SP → 2 SP`;
- switch: `BREAKS FLOW → HOLDS FLOW`;
- removed behaviour: `WATER-COOLER TRIPS ON → OFF`; and
- deferred hero effect: `LEARNED · APPLIES WHEN PLACED`.

This model covers company, hero, and founder purchases. For a placed hero it compares the live
hero fold; for a benched or settling hero it names the learned capability but does not pretend
the studio multiplier changed. Founder receipts compare personal output/tap value and maturity.

### James and Instant Messenger

The final `Check your messages.` tap becomes the first upgrade transaction tutorial:

1. dismiss the scene;
2. synchronously acquire B1 and persist it;
3. open the company capability board centred on B1; and
4. play the same commit/propagate/prove sequence used for paid nodes, with `GIFT FROM JAMES`
   in place of a price.

The first-shift action should be one atomic store verb returning the acquisition receipt, so
closing the app cannot leave the scene dismissed while B1 is absent. Later runs may continue to
start with B1 already owned and do not replay the tutorial.

### Hero placement: place → settle → activate

Keep the existing preview and confirmation rules. Add a one-shot visual lifecycle around them:

1. **Place:** the world pin lands on the chosen anchor with a small branch-colour ring. The
   proposed footprint remains outline-only.
2. **Settle (8 seconds):** a countdown ring surrounds the anchor; the outline has one slow
   marching phase. No effect receipt claims the multiplier is active.
3. **Activate:** detect the exact settling-to-active crossing once. A branch-colour wave travels
   from the anchor through the covered seats/unit; room diamonds fill in seat order; the pin
   changes from `WALKING` to `ACTIVE`; and a compact receipt shows coverage plus the exact fold
   change (for example `DEFECTS ×1.00 → ×0.92`).

At rungs above the room, the same React world pin and countdown ring remain visible even where
per-seat decals do not exist. Activation pulses the projected unit anchor and its badge; room
seat-fill animation is an additional close-zoom reward, not a requirement for feedback.

## Implementation sequence

### 1. Pin the contracts

- Amend `GDD.html` as listed above.
- Add pure receipt types and formatters, with table-driven tests for every current tech node and
  representative hero/founder purchases.
- Add pure timing/curve helpers for purchase and placement activation; do not put UI clocks in
  `sim/`.

### 2. Factor the shared board kit

- Extract reusable board-shell, UML-node, inspector, guide, and connector components from
  `HeroTree.tsx`, `Founder.tsx`, `diagram.css`, and `heroes.css`.
- Preserve board-specific geometry and state selectors through props/data attributes.
- Convert `UpgradeBoard.tsx` to the shared full-frame shell and UML nodes.
- Keep keyboard focus, panning, zoom, and phone containment tests.

### 3. Build the shared purchase orchestrator

- Add a `usePurchaseSequence`-style UI controller which receives a successful transaction and
  its receipt. Ephemeral animation state stays in React/render code, never in the save.
- Route `buyTech`, `buyHeroTreeNode`, and `buyFounderNode` through small UI adapters which capture
  pre/post snapshots while leaving their boolean store contracts intact.
- Add `purchaseHaptic()` using one medium impact and dedicated `upgrade-latch` /
  `upgrade-resolve` SFX IDs with the existing safe fallback path.

### 4. Wire the James handoff

- Add the atomic first-protocol acquisition verb and receipt.
- Handle `SCENE_JAMES_INSTANT_MESSENGER` in `Hud.finishDialogue`.
- Open the board in a non-dismissible guided sequence until the acquisition cue reaches its
  applied state; after that, normal BACK behaviour resumes.
- Pin resume/close edge cases in persistence tests.

### 5. Add placement VFX

- Extend `WorldHeroAssignments` with the countdown ring and one-shot activation class/state.
- Add a small placement-effect layer in the renderer for room coverage fill and world-anchor
  pulse. Detect lifecycle crossings without publishing on every frame.
- Reuse the applied-effect receipt model for the activation banner.
- Add placement latch/activation audio and one confirmation haptic; do not buzz again when the
  timer completes.

### 6. Verify and tune

- Unit/component tests: receipt arithmetic, purchase phase order, James auto-open, guided close,
  reduced motion, benched/deferred hero copy, and one-shot placement activation.
- Visual tests at 997×448, 748×336, and 640×360: no rail collision, guide containment, board
  centring, or clipped effect receipt.
- Playthrough assertions: first shift → James scene → company board → B1 effect; one paid company
  purchase; one hero/founder purchase; preview → confirm → eight-second activation.
- Run the full `npm run check` gate in the worktree.

## File map

Likely new modules:

- `src/hud/upgradeEffectModel.ts` + tests — pure display receipts;
- `src/hud/CapabilityBoard.tsx` — shared shell/viewport/inspector;
- `src/hud/PurchaseFx.tsx` and `src/ui/usePurchaseSequence.ts` — transient choreography;
- `src/render/heroPlacementFx.ts` + tests — anchor and coverage wave; and
- `src/styles/capabilityBoard.css` / `purchaseFx.css` — shared visual grammar.

Primary edits:

- `GDD.html`;
- `src/hud/UpgradeBoard.tsx`, `HeroTree.tsx`, `Founder.tsx`, `Hud.tsx`,
  `WorldHeroAssignments.tsx`, and `PostingBanner.tsx`;
- `src/game/store.ts` and persistence tests for the atomic B1 handoff;
- `src/ui/uiSfx.ts`, `src/audio/haptics.ts`, and the SFX manifest/generator;
- `src/render/stage.ts` and `src/render/room.ts`; and
- `src/styles/diagram.css`, `tech.css`, `heroes.css`, and `founder.css`.

## Acceptance criteria

- The company upgrade screen is recognisably the same product surface as hero and founder
  upgrades: UML nodes, right-angle Gliffy connectors, shared header/rail/guide grammar.
- Every successful upgrade purchase shows ownership, tree propagation, and an exact applied
  before/factor/after result; a failed or unaffordable purchase triggers none of them.
- James's final line opens the board and visibly grants Instant Messenger without a second nav
  tap or a fake paid button.
- A hero placement never claims to be active during the eight-second settle and fires its
  activation wave/receipt once, at the moment the fold becomes live.
- Motion reduction preserves state and numeric proof while removing travel, shake, and spring.
- No purchase or placement effect allocates per developer above the existing render budget, and
  the real-browser frame gate remains green.
