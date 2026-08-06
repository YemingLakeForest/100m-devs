# ADR 0001 — Engine and Rendering Stack

- **Status:** Accepted, provisional — conditional on the spike in §7 passing
- **Date:** 2026-08-06
- **Decision owner:** Yeming Huang
- **Supersedes:** —
- **Related:** [`GDD.md`](../../GDD.md) §7 (Omni-Lens), §8 (game juice), §10.5–10.6 (transitions), §20 (audio); [`MONETISATION.md`](../../MONETISATION.md) §10

---

## 1. Decision

Build *100000000 Developers* on **React 19 + Vite + Capacitor 8, with PixiJS v8 as the
simulation renderer.**

| Concern | Choice |
|---|---|
| Shell / native bridge | **Capacitor 8** (matching `mind-the-gap` versions) |
| UI, menus, trees, cards, modals | **React 19 + CSS**, DOM-rendered |
| Simulation canvas (the swarm, the Omni-Lens) | **PixiJS v8**, WebGL/WebGPU |
| Post-processing | **pixi-filters** |
| Large numbers | **break_infinity.js** |
| Poke / click SFX | **Native audio via a Capacitor plugin** — not Web Audio |
| Ambient, DSP, zoom crossfade bus (GDD §20) | **Web Audio API** |
| Haptics (GDD §8.2) | **`@capacitor/haptics`** |
| Ads, IAP, entitlements | **`@mercilessstudio/game-monetise`** — unchanged |
| Cloud save, Play Games, leaderboards | **`@mercilessstudio/game-cloud`** — unchanged |

**Rejected:** Godot 4, React Native, and a DOM/CSS-only renderer.

---

## 2. Context

### 2.1 What the game demands

From the GDD, in rough order of technical risk:

1. **The Omni-Lens** (§7) — continuous camera zoom across roughly nine orders of magnitude,
   desk (1:1) to galactic (1:10⁹). This is the visual hook and the hardest requirement.
2. **A clicker layer that must feel good** (§4.5, §8.2) — tap → sound → floating numeral →
   haptic → burn-down notch, at 4–5 taps/sec. Appendix D states plainly that if the first
   thirty seconds of tapping is not satisfying, nothing else matters.
3. **Post-processing** (§8.1) — tilt-shift depth of field, radial zoom blur, camera shake,
   CRT scanlines at high entropy, chromatic aberration on poke crits.
4. **Animated transitions everywhere** (§10.5) — nothing cuts, with a 60fps floor called out
   as a hard requirement, and an explicit anti-pattern list (§10.6) against anything that
   reads as a web page.
5. **A four-tier reactive audio bus with live DSP** (§20) — low-pass/high-pass sweeps,
   reverb wet/dry curves driven by zoom distance, pitch-bend on rapid zoom.
6. **Very large numbers** — the Layer 3 infinite grid compounds node costs indefinitely and
   will exceed IEEE-754 double range.
7. **A great deal of structured UI** — swarm HUD, three-branch tech tree, two prestige
   talent trees, the Codebase Fork terminal, the infinite Multiverse grid, the org-chart
   card board, card inspector, storefront, releases, stats, events, modals.
8. **Modest sprite counts, by design** — §7.5 specifies that at Global and Cosmic zoom the
   developers *fuse into a geometric grid with no individual sprites remaining*. Peak real
   sprite load is the floor view, on the order of 10³.

Point 8 matters more than it looks: the design has already solved the hardest rendering
problem by declaring it out of scope at the scales where it would bite.

### 2.2 Studio context

Verified against the sibling repos rather than assumed:

- `mind-the-gap`, `dungeon-doom-dash`, and `geodaily` all run **React 19 + Vite +
  Capacitor 8**.
- All three already integrate `@capacitor-community/admob`,
  `@revenuecat/purchases-capacitor`, and `@capacitor-firebase/*`.
- **No renderer is present in any of them** — no Pixi, Phaser, or Three. A renderer is new
  learning regardless of which option is chosen here.
- **`gullfather` is a Godot 4.6 project** with custom `.gdshader` work, an in-house editor
  addon, export presets, and deploy scripting. **Godot fluency at this studio is real and
  should not be counted as a cost of choosing it.**
- **`gullfather` also has no monetisation or cloud integration whatsoever** — no AdMob, no
  RevenueCat, no Firebase, no Play Games. The one Godot project in the studio has never
  needed the commercial stack, which means choosing Godot here makes that entire layer
  greenfield rather than partially solved.
- `@mercilessstudio/game-cloud` and `@mercilessstudio/game-monetise` are **Capacitor
  plugins**, consumed by git tag. `game-cloud` includes a native Kotlin
  `PlayGamesPlugin.kt`.
- Solo developer. Shipping velocity is the scarce resource.
- A standing constraint applies: low budget, minimal animation, achievable with mostly
  static pixel art.

---

## 3. Rationale

Three arguments carried the decision, in this order.

### 3.1 The plugin layer is the real cost centre

Choosing Godot means rebuilding the entire monetisation and cloud stack: AdMob, RevenueCat,
Firebase, Play Games, and both shared studio packages including native Kotlin. That is
weeks of work on the critical path producing **zero player-visible value**, and it forks the
studio's shared packages so that this game no longer benefits from work done on the others.

**RevenueCat is the specific blocker.** There is no official Godot SDK at the time of
writing. The options would be writing a GDExtension wrapper, or dropping back to raw Play
Billing and StoreKit and losing the cross-platform entitlement layer standardised across
three shipped games. *(Verify current SDK availability before treating this as settled — it
is the single fact most likely to have changed.)*

### 3.2 This game is mostly UI, and React is much faster at UI

The screen inventory in §2.1 point 7 is large and highly structured. React and CSS build
that materially faster than Godot's `Control` node system, and the GDD's UI is described in
terms — semi-transparent overlays, blurred backdrops, sliding drawers, node trees with
connection cables — that map cleanly onto CSS compositing.

The anti-pattern list in §10.6 is sometimes read as an argument against web tech. It is
not. "Web page-y" there means *design vocabulary* — hard cuts, opaque menus, native form
controls, toast notifications. Those are discipline problems, not renderer problems. A Pixi
canvas with a hand-styled DOM HUD does not look like a web page unless it is built like one.

### 3.3 pixi-filters already covers the visual spec

The effects specified in §8.1–8.2 map closely onto filters that ship with the library —
zoom blur for the radial zoom-out smear, tilt-shift for the desk-level depth of field, CRT
for the high-entropy scanlines, RGB split for chromatic aberration on poke crits, and
shockwave for the Chained Poke Reaction. These would otherwise be hand-written GLSL.

---

## 4. Alternatives Considered

### 4.1 Godot 4 — rejected, but it is a real contender

**Genuine advantages, not dismissed:**

- **Native input and audio latency.** The decisive technical concern for a clicker.
- **Audio bus DSP is first-class.** `AudioEffectLowPassFilter`, `AudioEffectReverb`, and
  `AudioEffectPitchShift` on tweenable buses are close to a direct implementation of GDD
  §20's four-tier crossfade matrix.
- **More rendering headroom** on low-end hardware.
- **Continuous 2D camera zoom is native** to `Camera2D`.

- **Engine fluency already exists.** `gullfather` is a Godot 4.6 project with hand-written
  shaders and a custom editor addon. This is *not* a cost of choosing Godot, and an earlier
  draft of this ADR was wrong to list it as one.

**Why it lost:** §3.1 and §3.2 — and neither is about familiarity. The rebuild cost of the
plugin layer is concrete and large, the RevenueCat gap is a genuine blocker, and the
UI-heavy nature of the game plays against Godot's strengths. Its rendering advantages apply
most at scales the design has already declared sprite-free.

The evidence sharpens rather than softens this: the studio's one Godot project carries no
AdMob, RevenueCat, Firebase, or Play Games integration at all. Choosing Godot would mean
building the commercial stack from zero, in an engine where RevenueCat has no official SDK,
for a game whose monetisation design (MONETISATION §4–7) depends on eight rewarded
placements, a subscription entitlement, and per-SKU entitlement checks.

**This is the option to revisit if the spike fails.** See §8.

### 4.2 React Native — rejected

The weakest of the three. It loses Capacitor plugin reuse — the studio packages are
Capacitor plugins and would need porting — *and* it does not gain native rendering, since
its 2D game tooling is thin relative to both Pixi and Godot. Worst of both worlds for this
specific project.

### 4.3 DOM/CSS only — rejected

The approach the existing games appear to use. It will not deliver the Omni-Lens,
post-processing, or a swarm of 10³ sprites at 60fps. Adequate for the HUD, which is exactly
the role it keeps in this decision.

---

## 5. Consequences

### Positive

- The entire monetisation and cloud stack works on day one, unchanged.
- Both shared studio packages stay shared; improvements continue to flow across all games.
- Existing build, test, and store-deployment tooling carries over.
- React handles the large UI surface at high velocity.
- `break_infinity.js` and the wider incremental-game numeric ecosystem are available.
- Live-ops content (seasonal dimensions, cards) can ship as data without a store release.

### Negative

- **WebView input and audio latency is a standing risk to poke feel.** Mitigated by the
  native-audio path, and measured by the spike.
- PixiJS is new learning, and it is learning that does not transfer to `gullfather` — the
  studio will be maintaining two rendering stacks.
- A performance ceiling on low-end Android that a native build would not have.
- Two rendering systems in one app — DOM HUD over a Pixi canvas — requires a clear boundary
  and disciplined state ownership.

### Neutral

- Continuous zoom, LOD cross-fading, and the burn-down chart are hand-built either way.
  Neither option provides them.

### Mitigations, committed

1. **Poke SFX go through native audio, never Web Audio.** Non-negotiable; it is the single
   largest feel risk. Web Audio keeps the §20 ambient and DSP layers, where 100ms of
   latency is inaudible.
2. **`ParticleContainer` for swarm sprites**, dropping to a shader-driven heatmap at Global
   zoom and beyond, per §7.5.
3. **The DOM/canvas boundary is fixed up front:** simulation, camera, and particles in
   Pixi; everything with structured text, numbers, or navigation in React. Game state lives
   in one store both read from.
4. **A frame-budget check runs in CI from the first week**, not retrofitted.

---

## 6. Implementation Notes

```
@mercilessstudio/game-cloud      → cloud save, Play Games, leaderboards   (unchanged)
@mercilessstudio/game-monetise   → useAdMobInit / useRewardedAd /
                                   useInterstitial / usePremium           (unchanged)
pixi.js v8 + pixi-filters        → simulation canvas, post-processing
break_infinity.js                → all currency and Story Point maths
@capacitor/haptics               → GDD §8.2 haptic responses
<native audio plugin>            → poke and UI SFX only
Web Audio API                    → GDD §20 zone bus, crossfades, DSP
```

- Consume the studio packages **by git tag**, per house convention. `git fetch --tags`
  first; local sibling checkouts run behind published tags. Capacitor ≥ 8 is a peer
  requirement.
- Match `mind-the-gap`'s React/Vite/Capacitor versions to keep one toolchain across the
  studio.
- Every ad placement sits behind remote config (MONETISATION §10).

---

## 7. Acceptance Test — The Feel Spike

**This ADR is provisional until this spike passes.** The decision hinges on one measurable
question — *does the poke feel good on cheap hardware?* — so it gets measured before the
codebase has any weight, not discovered in month six.

### 7.1 Timebox

**One week.** If it is running long, that is itself a signal.

### 7.2 Scope — build exactly this

1. A Pixi canvas showing a single isometric desk with one static pixel-art developer.
2. **Continuous pinch-zoom** from that desk out to a placeholder galactic view and back —
   all four LOD tiers, cross-faded, with zoom blur and tilt-shift applied.
3. **The full poke loop:** tap the developer → native click SFX → floating Fibonacci
   numeral arcs and fades → haptic tick → burn-down line notches down.
4. A burn-down chart bound to real Story Point state.
5. One DOM HUD element over the canvas — the Velocity readout — proving the boundary.
6. A frame-time and input-latency overlay.

### 7.3 Explicitly out of scope

No ads, no IAP, no save, no cloud, no tech trees, no prestige, no cards, no entropy
simulation, no real art beyond one placeholder sprite and one placeholder globe. **Anything
not in §7.2 is a distraction from the question being asked.**

### 7.4 Test device

The **lowest-end Android device available** — target roughly a 2021 budget phone
(Snapdragon 68x-class, 4GB RAM). Testing this on a desktop browser or a current flagship
proves nothing and is the most likely way to get a false pass.

### 7.5 Pass criteria — all must hold

| # | Metric | Threshold |
|---|---|---|
| 1 | Tap → numeral visible | **≤ 80 ms**, p95 |
| 2 | Tap → click audible (native path) | **≤ 60 ms**, p95 |
| 3 | Frame rate during a full L1→L4 zoom dolly | **≥ 55 fps**, 5th percentile |
| 4 | Frame rate at floor zoom with 1,000 sprites | **≥ 55 fps**, 5th percentile |
| 5 | Sustained tapping at 5 taps/sec for 60 s | No frame drops below 50 fps, no audio dropout, no latency drift |
| 6 | Cold start to interactive | **≤ 3 s** |
| 7 | **The subjective gate** | Hand it to someone who has not seen it. If they keep tapping for a full minute without being asked to, it passes. If they stop, it fails — regardless of the numbers above. |

Criterion 7 outranks the rest. The measurements exist to explain a failure, not to overrule
a verdict the thumb has already delivered.

### 7.6 Kill criteria — reopen this ADR if any occur

- Audio latency cannot be brought under 60 ms even on the native path.
- The zoom dolly cannot hold 55 fps without cutting the blur or the LOD count.
- Sustained tapping degrades over 60 seconds (GC pauses, audio pool exhaustion).
- Criterion 7 fails and no fix is apparent within two further days.

**On any kill criterion: rebuild §7.2 in Godot 4 under the same timebox and the same
thresholds, then compare.** A week spent proving Godot is necessary is cheap. A quarter
spent discovering it is not.

---

## 8. Revisit Triggers

Reopen this ADR if:

- Any §7.6 kill criterion fires.
- RevenueCat ships an official Godot SDK **and** the studio packages are ported — this
  removes the largest single argument in §3.1.
- Sprite requirements grow materially beyond the §7.5 design (individual animated
  developers at Global zoom or above).
- Low-end Android performance regresses below the §7.5 thresholds during production and
  cannot be recovered by simplifying the scene.
