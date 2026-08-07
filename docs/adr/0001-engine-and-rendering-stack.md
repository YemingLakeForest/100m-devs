# ADR 0001 — Engine and Rendering Stack

- **Status:** **Accepted** — the §7 spike passed. Promoted 2026-08-07.
- **Date:** 2026-08-06 (proposed) · 2026-08-07 (accepted)
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

**RevenueCat is the specific blocker.** There is no official Godot SDK. The options would be
writing a GDExtension wrapper, or dropping back to raw Play Billing and StoreKit and losing
the cross-platform entitlement layer standardised across three shipped games.

> **Verified 2026-08-07.** Still no official SDK, and RevenueCat have said in their own
> community forum that they do not plan to support Godot. A credible community bridge now
> exists — [`godot-x/revenuecat`](https://github.com/godot-x/revenuecat), native `.xcframework`
> and `.aar` wrapping the official SDKs, listed in the Godot Asset Library since June 2026.
>
> **This does not fire the §8 revisit trigger**, which requires an *official* SDK **and**
> the studio packages ported. Neither holds. The §3.1 argument stands, though it is weaker
> than when written: the gap is now bridgeable by a third-party dependency rather than
> absent entirely. Re-check if that bridge becomes the de-facto standard, or if RevenueCat
> reverse their position.

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

### 7.2a Scope amendment — the spike carries the vibe

The original §7.2 called for placeholder art. **That has been deliberately widened.** The
poke "feel" this spike exists to measure genuinely includes the phosphor grade, the floating
numeral and the sound — a grey box responding in 40 ms does not answer whether *the game*
feels good.

Added, and nothing beyond this list:

- The v0 palette as a real file, with the quantiser wired in (ART_DIRECTION §2.2, §5)
- Departure Mono and the terminal type scale
- The full post-process stack — scanlines, bloom, barrel curvature, chromatic fringe.
  **Shader work, not art work**, and it carries most of the vibe.
- **One** hero portrait — James at Junior — proving the parts-library method end to end
- **One** desk, chair, monitor and mug at desk zoom
- Interface hue driven by Entropy (ART_DIRECTION §1.1)

**Cost:** roughly 2–3 days on top of the original spike.

**The §7.5 pass criteria are unchanged.** Widening the scope must not soften the gate, and
if the added work starts pushing against the §7.1 timebox, cut art before cutting
measurement.

### 7.3 Explicitly out of scope

No ads, no IAP, no save, no cloud, no tech trees, no prestige, no card board, no org chart,
no entropy simulation beyond driving the interface hue, no buildings, no globe, no
Multiverse dimension, and no hero art beyond the single James portrait. **Anything not in
§7.2 or §7.2a is a distraction from the question being asked.**

### 7.4 Test device — **amended 2026-08-07**

The original requirement was the **lowest-end Android device available**, roughly a 2021
budget phone (Snapdragon 68x-class, 4GB RAM), on the grounds that a flagship "proves
nothing and is the most likely way to get a false pass."

**Decision: the Pixel 8 Pro is the gate.** No low-end device is available and one is not
being bought. This is a deliberate scope decision by the decision owner, recorded here
rather than left as an unmet requirement.

**What it costs, stated plainly so nobody later mistakes this for a clean pass:**

- The Pixel is a 120 Hz flagship. §7.7.4 measures the dolly at ~110 fps against a 55 fps
  floor — **a 2× margin that says nothing about a device with half the fill rate.**
  Criteria 3 and 4 are effectively unmeasured for the target audience.
- Criterion 1's margin (7–10 ms vs 80 ms) is large enough to survive a substantial
  hardware downgrade, so it is the one result that likely generalises.
- Criterion 6 at 0.8 s vs a 3 s budget has real headroom, but cold start scales with
  storage and CPU and a budget phone could plausibly triple it.

**The original §7.4 reasoning is not wrong and has not been repealed.** A pass here is a
*ceiling* measurement. The honest reading of §7.7.4 is "nothing about this stack fails on
good hardware", which is weaker than the gate was designed to deliver but is not nothing:
a fail would have been decisive, and there wasn't one.

**Revisit the moment any cheap Android device comes to hand** — a borrowed phone, an old
handset in a drawer, a colleague's. The harness is a single tap and takes 80 seconds.

### 7.5 Pass criteria — all must hold

| # | Metric | Threshold |
|---|---|---|
| 1 | Tap → numeral visible | **≤ 80 ms**, p95 |
| 2 | Tap → click audible (native path) | **≤ 60 ms**, p95 |
| 3 | Frame rate during a full L1→L4 zoom dolly | **≥ 55 fps**, 5th percentile |
| 4 | Frame rate at floor zoom with 1,000 sprites | **≥ 55 fps**, 5th percentile |
| 5 | Sustained tapping at 5 taps/sec for 60 s | **99th-percentile frame ≥ 50 fps**, no audio dropout, no latency drift |
| 6 | Cold start to interactive | **≤ 3 s** |
| 7 | **The subjective gate** | Hand it to someone who has not seen it. If they keep tapping for a full minute without being asked to, it passes. If they stop, it fails — regardless of the numbers above. |

Criterion 7 outranks the rest. The measurements exist to explain a failure, not to overrule
a verdict the thumb has already delivered.

> **Criterion 5 amended 2026-08-07 by the decision owner.** It originally read "no frame
> drops below 50 fps" — a *single worst frame* over 60 seconds, which at 120 Hz is one frame
> in ~7,200. It flapped between pass and fail on an identical build (§7.7.4). It is now a
> 99th percentile, which measures the sustained smoothness the criterion was always
> reaching for instead of the worst GC pause in a minute.
>
> **This is a deliberate loosening of a gate and is recorded as one.** What it gives up: a
> run may now contain up to 1% hitching frames and still pass, so a regression that shows up
> as rare-but-severe stutter would be caught later than before. What protects against that:
> the drift check (5.1) is untouched and still fires on any *degradation*, which is the
> failure mode §7.6 actually names, and the harness still prints the worst single frame
> next to the percentile so the isolated pause stays visible even though it no longer votes.

### 7.6 Kill criteria — reopen this ADR if any occur

- Audio latency cannot be brought under 60 ms even on the native path.
- The zoom dolly cannot hold 55 fps without cutting the blur or the LOD count.
- Sustained tapping degrades over 60 seconds (GC pauses, audio pool exhaustion).
- Criterion 7 fails and no fix is apparent within two further days.

**On any kill criterion: rebuild §7.2 in Godot 4 under the same timebox and the same
thresholds, then compare.** A week spent proving Godot is necessary is cheap. A quarter
spent discovering it is not.

---

## 7.7 Spike findings log

Recorded as the spike is built. Measurements against §7.5 go here too, per §8 of the
runbook.

### 7.7.1 The DOM HUD cannot pass through the Pixi glass **[RESOLVED 2026-08-06]**

**Decision: option 3.** The interface is a second pane of glass in front of the tube
rather than phosphor burned into it. Recorded in
[ART_DIRECTION §1.0a](../ART_DIRECTION.md), with §6 amended to match. §3.2 stands
unchanged — React keeps the UI, which was the point.

The original finding follows.

---

ART_DIRECTION §6 states the post-process stack is "applied over **both** the world canvas
and the interface layer", and calls pass 6 (barrel curvature + vignette) "the weld… never
apply it to only one layer."

**That is not achievable as specified with a DOM HUD.** §3.2 of this ADR puts all
structured text, numbers and navigation in React/DOM, and a DOM element cannot be fed
through a WebGL filter chain. As built, the world is welded and the interface is not: the
HUD sits *above* the glass rather than being burned into it.

This is a real tension between two documents that were each individually right, and it was
invisible until there was a running frame. Three ways out:

1. **CSS-side approximation** — reproduce curvature/vignette/scanlines on the HUD layer
   with CSS (`mask-image`, a repeating-gradient scanline overlay, a subtle
   `transform: perspective()`). Cheap, and it never matches exactly.
2. **Move the HUD into Pixi** — genuinely welded, and it discards §3.2, the single
   strongest argument for this stack. Not recommended.
3. **Accept the split deliberately** — the interface is a separate physical layer of glass
   in front of the CRT rather than phosphor burned into it. This is a coherent fiction and
   costs nothing, but it is a change to ART_DIRECTION §1 and §6 and must be recorded there
   rather than allowed to happen by default.

**The spike currently does (3) by omission, which is the one option that must not stand
unrecorded.** Decide before the vertical slice.

### 7.7.3 The acceptance harness — `?bench`

§7.5 specifies *scenarios*, not just numbers: "during a full L1→L4 zoom dolly", "at floor
zoom with 1,000 sprites", "sustained tapping at 5 taps/sec for 60 s". Measured by hand
those are a different test every time, so they are scripted. `?bench` runs the sequence and
prints a pass/fail table; `?bench=10` shortens the sustained leg for checking the harness
itself. Output also goes to the console, so it can be pulled off a device with
`adb logcat` rather than transcribed from a photo of a phone.

**Two rules the harness enforces, both learned the hard way while building it:**

1. **A criterion with no samples is UNKNOWN, never FAIL.** Chrome suspends
   `requestAnimationFrame` and the Pixi ticker in a backgrounded or unfocused tab, which
   produces zero samples. The first version reported that as `0.0 fps — FAIL`. Since §7.6
   makes a failed frame-rate gate a trigger to reopen this ADR and rebuild the spike in
   Godot, **a minimised window must not be able to send the project to another engine.**
   The run also self-invalidates if the page was ever hidden.
2. **Value and sample count are read in the same breath.** Reading them seconds apart
   produced `PASS — 0.0 ms` on criterion 1: an empty sampler's zero judged against a count
   that had since filled from drained callbacks. A false pass on the tightest gate in the
   ADR is worse than no harness at all.

**Criterion 2 is not measurable in-process and is reported as UNKNOWN.** What JavaScript
can see is tap → the audio API accepting the call. The mixer, buffer, DAC and speaker are
invisible, and on Android that is *exactly* where WebView latency hides — so the number is
a lower bound and the harness says so rather than quietly reporting it as the real thing.
A genuine criterion-2 measurement needs an external capture: record a tap on a hard surface
and the resulting click on another device, then read the gap in an audio editor.

**First run — desktop Chrome, and therefore not a pass.** 3: 58.8 fps, 4: 59.2 fps with
1,000 sprites, 6: 0.4 s cold start. Recorded only to show the harness works.

> **On the test device.** §7.4 is right that a flagship or a desktop browser cannot produce
> a *pass*. It can, however, produce a *fail* — and a fail is decisive on any hardware. So
> running `?bench` on whatever phone is to hand is a cheap falsification test worth doing
> immediately, as long as nobody reads a green table on it as clearing the gate. The
> harness prints that warning on every run.

### 7.7.5 Criterion 7 — **PASSED 2026-08-07**

A person who had not seen the game was handed the Pixel. They kept tapping. **Accepted.**

§7.5 is explicit that this outranks everything else: *"The measurements exist to explain a
failure, not to overrule a verdict the thumb has already delivered."* The thumb has
delivered one, and this ADR is promoted from provisional to **Accepted** on it.

**This also does most of the work criterion 2 could not.** Criterion 2 asks whether the
click is audible within 60 ms, and no in-process measurement can answer it (§7.7.3). But a
person tapping a screen for a minute *is* an integration test of the whole feel — visual,
haptic and audible together. Latency severe enough to fail criterion 2 is latency a tester
would have felt as sponginess and stopped. That is weaker evidence than a measurement and
it is not nothing.

#### Residual risk, carried knowingly

Accepting on criterion 7 means accepting these, and they are listed so nobody has to
reconstruct them later:

| | Risk | Why it is acceptable |
|---|---|---|
| **Criterion 2 unmeasured** | Audio latency has no hard number | §7.6's kill criterion is *"cannot be brought under 60 ms even on the native path"* — nothing observed suggests that. Native audio preloaded and drift was negative over 300 taps. |
| **Criterion 5 unmeasured under its new wording** | The two runs recorded worst-frame, not the 99th percentile the gate now asks for | Drift was −1.2 ms; there is no degradation, so §7.6's "sustained tapping degrades" does not fire either way. The criterion was restated on 2026-08-07 (§7.5) *after* these runs, so it gets its first real measurement on the next device run. |
| **§7.4 relaxed to a flagship** | Criteria 3 and 4 unmeasured for the target audience | A fail would have been decisive and there wasn't one. Re-run the moment a cheap handset is available; it is one tap and 80 seconds. |

**What would reopen this ADR** is unchanged and lives in §8. The most likely trigger is now
low-end performance during production — which is precisely the measurement §7.4 could not
take.

#### The spike is over

§7.3's out-of-scope list — ads, IAP, save, cloud, tech trees, prestige, card board, org
chart, buildings, the globe, Multiverse dimensions — was scoped to protect the spike from
becoming the game. **That constraint is now lifted.** Work proceeds to the vertical slice;
see [`../HANDOFF.md`](../HANDOFF.md) for the order.

### 7.7.4 Device run — Pixel 8 Pro, 2026-08-07 **[the §7.5 measurement]**

Android 16, Chrome WebView 150, viewport 448×997 @ dpr 2.25, **120 Hz display**.
Bundled debug APK, cold launch, `VITE_BENCH=1` build.

| # | Criterion | Run 1 | Run 2 | Threshold | |
|---|---|---|---|---|---|
| 1 | tap → numeral visible | 7.0 ms | 10.3 ms | ≤ 80 p95 | ✅ |
| 2 | tap → audio call accepted | 0.2 ms | 0.3 ms | ≤ 60 p95 | ❓ lower bound only |
| 3 | fps, full L1→L4 dolly | 109.9 | 112.4 | ≥ 55 5th pct | ✅ |
| 4 | fps, floor zoom, 1,000 sprites | 111.1 | 109.9 | ≥ 55 5th pct | ✅ |
| 5 | sustained 5/sec 60 s, worst frame | 57.5 | **44.1** | ≥ 50 *(superseded)* | ⚠️ **flapping** |
| 5.1 | sustained, latency drift | +1.8 ms | −1.2 ms | ~0 | ✅ |
| 6 | cold start to interactive | *(invalid)* | 0.8 s | ≤ 3 s | ✅ |
| 7 | the subjective gate | — | — | a human | ❓ **not yet run** |

**Criterion 1 has a 8× margin.** 7–10 ms against an 80 ms budget, through a WebView, is
the single most reassuring number here: it is the one ADR §5 called "a standing risk to
poke feel", and on this hardware it is not close.

**Criterion 5 is flapping, and the criterion itself is the problem.** It is written as
"no frame drops below 50 fps" — a *single worst frame* over 60 seconds. At 120 Hz that is
roughly 7,200 frames, so one 23 ms GC pause fails the run. Run 1 passed at 57.5 fps and
run 2 failed at 44.1 fps with no code change between them. Meanwhile **5.1 shows drift of
−1.2 ms**, i.e. the second half was *faster* than the first: there is no degradation, no
audio pool exhaustion, and therefore **§7.6's "sustained tapping degrades" kill criterion
does not fire.** This is one isolated hitch, not a trend.

> **Open question for whoever promotes this ADR:** criterion 5 as written is a
> single-sample test and will flap forever. Restating it as a percentile ("99th percentile
> frame ≥ 50 fps") would measure the thing it means — sustained smoothness — instead of
> the worst GC pause in a minute. **That is a deliberate loosening of a gate and must be
> your call, not an implementer's**, so it is recorded here rather than done.
>
> **ANSWERED 2026-08-07 — the owner took the percentile.** §7.5 criterion 5 now reads
> "99th-percentile frame ≥ 50 fps"; the rationale and what it costs are recorded there. The
> harness reports the percentile as the gate and prints the worst single frame beside it as
> an ungated diagnostic, so the two runs above remain readable rather than being erased.
>
> **The runs above are not restated.** Run 1 (57.5) and run 2 (44.1) are worst-frame
> figures and the percentile was not captured at the time, so they cannot be honestly
> converted. The next device run measures criterion 5 properly for the first time; until
> then criterion 5 is **unmeasured under its current wording**, which is a weaker claim than
> the table below makes and is the reason this note exists.

**Criterion 6's first reading of 4.6 s was a harness bug, not the app.** `coldStartMs()`
was read when the acceptance run *started*, which on a device is however long it took a
human to reach for the screen. It is now a mark laid down when the renderer comes up. The
corrected figure is 0.8 s.

### 7.7.2 TiltShiftFilter cannot sit in the shared chain

Stacking `TiltShiftFilter` ahead of bloom/RGB-split/CRT in one `filters` array renders the
canvas **fully black** — no console error. Each of the five passes is fine in isolation;
the chain is not. TiltShift is internally two axis passes and its padding does not survive
being fed into the rest.

**Resolved:** depth of field is applied to the *world* container and passes 2–6 to the
container above it. This is arguably more correct anyway — DOF models a camera focusing on
a plane among the desks, and a HUD has no focal plane. Note that its `start`/`end` band is
therefore in **world-local** coordinates, not screen coordinates.

`?nopost` and `?post=bloom,crt` were added to bisect the stack without a rebuild, and are
worth keeping for the §7.5 frame-budget work.

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
