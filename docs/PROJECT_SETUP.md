# Project Setup

Everything needed to get from an empty repo to the first build. Written as a runbook —
work down §8 in order.

**Related:** [ADR 0001](./adr/0001-engine-and-rendering-stack.md) (stack + the spike),
[`ART_DIRECTION.md`](./ART_DIRECTION.md) (palette, quantiser, asset tiers),
[`../MONETISATION.md`](../MONETISATION.md) §10 (SDK wiring)

---

> ## Follow the studio playbook — do not re-derive it
>
> **[`mercilessstudio-platform`](../../mercilessstudio-platform/README.md) is the source of
> truth for everything cross-game**, and it is the runbook rather than a reference:
> `STUDIO_PLAYBOOK.md` for the end-to-end recipe, `FIREBASE.md`, `MONETIZATION_SETUP.md`,
> `PLAY_STORE.md`, `MARKETING.md`, and `TRAPS.md` for the cross-game log of failures three
> shipped games have already paid for.
>
> **This document keeps only what is specific to *this* game** — the application ID, the
> dependency versions, the hardware, the spike scope. §5 (Accounts & Services), §8's
> Services steps and §10 (Secrets) all describe work the playbook covers in more detail and
> with API calls instead of dashboard clicks. **Where they differ, the playbook is right.**
>
> House rule, from the playbook: **API or CLI over dashboards.** Anything that can be code
> should be code.

## 1. Identity

| Field | Value |
|---|---|
| **Application ID** | `com.mercilessstudio.m100devs` ✅ **confirmed 2026-08-06** |
| **Android namespace** | `com.mercilessstudio.m100devs` |
| **iOS bundle ID** | `com.mercilessstudio.m100devs` (keep identical across platforms) |
| **Store display name** | **100M Developers** |
| **In-game title** | *100000000 Developers* — the long form stays on the title screen, where the joke lands |
| **Repo** | `github.com/YemingLakeForest/100m-devs` |
| **Studio** | MercilessStudio |

> ✅ **Decided 2026-08-06 and now set in `capacitor.config.ts` and
> `android/app/build.gradle`.** Treat it as permanent.
>
> Both `com.mercilessstudio.100mdev` and `com.mercilessstudio.100mdevs` are **invalid**:
> Android requires every segment of an application ID to begin with a letter, and the
> namespace additionally has to be a legal Java package name, so a segment cannot start
> with a digit. AGP fails at `:app:processDebugManifest`, so this is not a lint rule that
> can be waived. `m100devs` reads as "100M devs" and was chosen over `devs100m` on that
> basis.
>
> House convention across the studio is `com.mercilessstudio.<slug>` — `mtg`,
> `dungeondoomdash`.

**Store name reasoning.** "100000000 Developers" is eight zeros: unsearchable, hard to type,
ambiguous spoken aloud. The store listing takes the legible form; the absurd form stays in
the product, which is where it is funny rather than obstructive. Check for a listing
collision before committing.

---

## 2. Stack

Fixed by ADR 0001. Match `mind-the-gap`'s versions to keep one toolchain across the studio.

| Layer | Choice |
|---|---|
| Shell | Capacitor 8 |
| UI | React 19 + Vite |
| Simulation renderer | PixiJS v8 + pixi-filters |
| Language | TypeScript |
| Package manager | **npm** (house convention — `package-lock.json`, not pnpm/yarn) |
| Test | Vitest |
| Target | **Android first.** iOS deferred — see §5.3. |

---

## 3. Toolchain — install before day one

| Tool | Purpose | Cost | Notes |
|---|---|---|---|
| **Node + npm** | Build | £0 | Match the version used by `mind-the-gap` |
| **Android Studio + SDK** | Android builds | £0 | Already installed |
| **JDK 17+** | AGP | £0 | Bundled with Android Studio |
| **Aseprite** | Pixel authoring | ~£20 one-off | ✅ Installed. Load `assets/palette/master.gpl` as the locked palette. |
| ~~ImageMagick~~ | ~~Palette quantiser~~ | — | ❌ **No longer needed** — see below |
| **Departure Mono** | Terminal/HUD font | £0 | ✅ v1.500 vendored at `src/assets/fonts/`. Licence verified: **SIL OFL 1.1** — embedding in the app is permitted; the licence text ships alongside it and must stay. |

> **ImageMagick was dropped.** ART_DIRECTION §5 specified `magick -remap`, but the
> quantiser and the `art:check` gate are implemented with **sharp**, which is already a
> house dependency. Two reasons: it removes a `PATH` prerequisite from CI, where a missing
> binary would silently skip the gate rather than fail it; and it lets the gate share one
> palette source of truth with the app (`src/art/palette.ts`) instead of reading a second
> copy. The operation is identical — nearest colour in the master palette, no dithering.

---

## 4. Dependencies

```bash
# Rendering + numbers
npm i pixi.js pixi-filters break_infinity.js

# Native feel — both are load-bearing for the clicker layer
npm i @capacitor/haptics @capacitor-community/native-audio

# Studio packages, consumed by git tag per house convention.
# Run `git fetch --tags` in the sibling checkouts first — they run behind the published tags.
# NOT YET INSTALLED — deliberately deferred, see below.
npm i github:YemingLakeForest/game-cloud#v0.4.1
npm i github:YemingLakeForest/game-monetise#v0.2.2
```

> **Tags corrected 2026-08-06.** The versions above were stale: `git fetch --tags` shows
> `game-cloud` at **v0.4.1** (not v0.3.1) and `game-monetise` at **v0.2.2** (not v0.2.1).
>
> **Both are deliberately not installed yet.** ADR 0001 §7.3 puts ads, IAP, save and cloud
> explicitly out of the spike, and `game-monetise` wants an AdMob app ID in the manifest —
> which would break §8 step 5's "verify a *blank* app builds and launches" before the spike
> has answered anything. Install them when the vertical slice starts, not before.

**Why `native-audio` is not optional:** Web Audio in an Android WebView can carry 100–300 ms
of latency, which would be fatal for poke feel. Poke and UI SFX go through the native path;
Web Audio keeps the GDD §20 ambient and DSP layers, where latency is inaudible. This is a
committed mitigation in ADR 0001 §5, not a preference.

**Peer requirement:** both studio packages need **Capacitor ≥ 8**.

---

## 5. Accounts & Services

### 5.1 Needed before the first build

| Service | Status | Cost | Action |
|---|---|---|---|
| **Firebase** | New project required | £0 (Spark) | `geo-daily-ee9a1` belongs to GeoDaily. Create a separate project for this game. |
| **Firebase Analytics** | — | £0 | Wire on day one so the Run 1 → Run 2 funnel is instrumented from the first build. That data cannot be recovered retroactively. |

### 5.2 Needed before store submission

| Service | Status | Cost | Notes |
|---|---|---|---|
| **Google Play Console** | Already held | $25, paid | Reuse the studio account |
| **AdMob** | Already held | £0 | Create ad units early so IDs exist for remote config |
| **RevenueCat** | Already held | £0 to $2.5k/mo tracked revenue | Entitlements per MONETISATION §10 |
| **Privacy policy URL** | **Missing** | £0 | Hard submission blocker with AdMob + Firebase + RevenueCat. GitHub Pages is sufficient. |
| **Play Data Safety form** | **Missing** | £0 | Must match what the SDKs actually collect |

### 5.3 Deferred

| Service | Cost | Decision |
|---|---|---|
| **Apple Developer Program** | $99/yr | **Android-first.** Nothing in the design depends on iOS, and deferring saves the annual fee until the game is proven. Revisit before any iOS build. |
| **PixelLab** | Subscription | **Not required.** Per ART_DIRECTION §4, it is only useful for T3 commodity props, and those can equally be bought as a pack. Let it lapse; resubscribe only if generating the office tileset. |
| **Crash reporting** (Sentry/Crashlytics) | £0 tier | Add before the first public release, not before the spike. |

---

## 6. Hardware

**One low-end Android device is the single most valuable purchase in this project.**

ADR 0001 §7.4 requires the spike to be validated on roughly a 2021 budget phone
(Snapdragon 68x-class, 4 GB RAM). A spike validated on a desktop browser or a current
flagship proves nothing and is the most likely route to a false pass.

If one is not already to hand: ~£50–80 used.

---

## 7. Cost Summary

| | Cost |
|---|---|
| Aseprite | ~£20 |
| Low-end test device *(if not already owned)* | £50–80 |
| Everything else | £0 |
| **Total to begin** | **~£20, or ~£100 with a device** |

Ongoing cost until launch is zero. Play Console is paid, AdMob and RevenueCat and Firebase
all sit inside free tiers, and the Apple fee is deferred.

---

## 8. Setup Order

Work down. Each step is small.

**Foundations**

1. [x] **Confirm the application ID** (§1) — `com.mercilessstudio.m100devs`
2. [x] Scaffold Vite + React + TypeScript, matching `mind-the-gap`'s versions
3. [x] Add Capacitor 8, `npx cap add android`, set the namespace and app ID
4. [x] Install §4 dependencies *(studio packages deferred — see §4)*
5. [ ] Verify a blank app builds and launches on the physical test device **before writing any game code**
       — APK builds (`android/app/build/outputs/apk/debug/`) and the app runs in-browser.
       **Not yet launched on a device**; see §6, the low-end phone is still the gap.

**Art system**

6. [x] Create `assets/palette/master.png` and `master.gpl` from ART_DIRECTION §2.2
       — both **generated** from `src/art/palette.ts` by `npm run art:build-palette`.
7. [x] Install Departure Mono; set up the type scale at integer multiples only
8. [x] Write the quantiser script and wire `npm run art:check` into CI (ART_DIRECTION §5)
       — `npm run art:check` / `art:quantise`. **CI itself is not set up yet**; the task
       exists and passes locally, but nothing runs it automatically.
9. [ ] **Validate the palette on the physical device in daylight** — the phosphor ramps are the risk (ART_DIRECTION §11.1)

**Services**

10. [ ] Create the Firebase project; wire Analytics
11. [ ] Define telemetry event names — at minimum the Run 1 Act I–V funnel and Run 1 → Run 2 continuation
12. [ ] Create AdMob ad units (IDs only; no placements yet)
13. [ ] Publish a privacy policy URL

**The spike** — ADR 0001 §7, scope per §9 below

14. [x] Build it — Run 1 is playable end to end
15. [ ] Measure against ADR §7.5 and record the numbers in the ADR
       — **harness built** (`?bench`, ADR §7.7.3). Criteria 1 and 3–6 are instrumented and
       self-reporting; criterion 2 needs an external audio capture and criterion 7 needs a
       person. Desktop numbers recorded, which per §7.4 prove nothing. **Awaiting a device run.**
16. [x] Promote ADR 0001 from *provisional* to *accepted*, or trigger §7.6
       — **Accepted 2026-08-07** on criterion 7, the subjective gate, which §7.5 says
       outranks every measurement. Residual risks recorded in ADR §7.7.5.

---

## 9. Spike Scope — Amended

ADR 0001 §7.2 originally specified placeholder art. That has been **deliberately widened**:
the first build should carry the game's vibe, because the poke "feel" being measured
genuinely includes the phosphor grade, the floating numeral, and the sound. A grey box
responding in 40 ms does not answer whether *the game* feels good.

**Added to the spike:**

- The v0 palette as a real file, with the quantiser wired in
- Departure Mono and the terminal type scale
- The full post-process stack — scanlines, bloom, barrel curvature, chromatic fringe
  *(shader work, not art work, and it carries most of the vibe)*
- **One** hero portrait — James at Junior — proving the parts-library method end to end
- **One** desk, chair, monitor and mug at desk zoom
- Interface hue driven by Entropy

**Still explicitly out:** the other 11 heroes, tech trees, card board, org chart,
buildings, the globe, any Multiverse dimension, ads, IAP, save, cloud.

**Cost:** roughly 2–3 days on top of the original spike. **The ADR §7.5 pass criteria are
unchanged** — widening the scope must not soften the gate.

---

## 10. Secrets

Follow the house pattern from `mind-the-gap`:

- `.env`, `.env.*` and `android/play-publisher.json` are gitignored
- Firebase config, AdMob unit IDs and RevenueCat keys live in `.env`, never in the repo
- The signing keystore never enters the repo; back it up separately — **losing it means never
  being able to update the app again**

---

## 11. Not Set Up Yet — Deliberately

None of these block the spike or the vertical slice:

- Subscription products and entitlements (ships v1.1 per MONETISATION §11)
- Dimension pack SKUs (v1.2)
- iOS anything
- Localisation
- Mediation beyond AdMob (revisit past ~5k DAU)
