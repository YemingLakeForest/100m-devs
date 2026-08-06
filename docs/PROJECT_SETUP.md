# Project Setup

Everything needed to get from an empty repo to the first build. Written as a runbook —
work down §8 in order.

**Related:** [ADR 0001](./adr/0001-engine-and-rendering-stack.md) (stack + the spike),
[`ART_DIRECTION.md`](./ART_DIRECTION.md) (palette, quantiser, asset tiers),
[`../MONETISATION.md`](../MONETISATION.md) §10 (SDK wiring)

---

## 1. Identity

| Field | Value |
|---|---|
| **Application ID** | `com.mercilessstudio.devs100m` ⚠ see below |
| **Android namespace** | `com.mercilessstudio.devs100m` |
| **iOS bundle ID** | `com.mercilessstudio.devs100m` (keep identical across platforms) |
| **Store display name** | **100M Developers** |
| **In-game title** | *100000000 Developers* — the long form stays on the title screen, where the joke lands |
| **Repo** | `github.com/YemingLakeForest/100m-devs` |
| **Studio** | MercilessStudio |

> ⚠ **Confirm the application ID before the first Play Console upload. It is permanent.**
>
> The originally chosen `com.mercilessstudio.100mdev` is **invalid**: Android requires every
> segment of an application ID to begin with a letter, and the namespace additionally has to
> be a legal Java package name, so a segment cannot start with a digit. `devs100m` is the
> closest valid form to the original intent. Alternatives, if preferred:
> `com.mercilessstudio.m100devs` or `com.mercilessstudio.hundredmdevs`.
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
| **Aseprite** | Pixel authoring | ~£20 one-off | The standard. **LibreSprite** or **Pixelorama** are free if preferred. |
| **ImageMagick** | Palette quantiser (ART_DIRECTION §5) | £0 | Must be on `PATH` for `npm run art:check` |
| **Departure Mono** | Terminal/HUD font | £0 | **Verify the OFL licence terms before shipping.** |

---

## 4. Dependencies

```bash
# Rendering + numbers
npm i pixi.js pixi-filters break_infinity.js

# Native feel — both are load-bearing for the clicker layer
npm i @capacitor/haptics @capacitor-community/native-audio

# Studio packages, consumed by git tag per house convention.
# Run `git fetch --tags` in the sibling checkouts first — they run behind the published tags.
npm i github:YemingLakeForest/game-cloud#v0.3.1
npm i github:YemingLakeForest/game-monetise#v0.2.1
```

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

1. [ ] **Confirm the application ID** (§1) — permanent, do it first
2. [ ] Scaffold Vite + React + TypeScript, matching `mind-the-gap`'s versions
3. [ ] Add Capacitor 8, `npx cap add android`, set the namespace and app ID
4. [ ] Install §4 dependencies
5. [ ] Verify a blank app builds and launches on the physical test device **before writing any game code**

**Art system**

6. [ ] Create `assets/palette/master.png` and `master.gpl` from ART_DIRECTION §2.2
7. [ ] Install Departure Mono; set up the type scale at integer multiples only
8. [ ] Write the quantiser script and wire `npm run art:check` into CI (ART_DIRECTION §5)
9. [ ] **Validate the palette on the physical device in daylight** — the phosphor ramps are the risk (ART_DIRECTION §11.1)

**Services**

10. [ ] Create the Firebase project; wire Analytics
11. [ ] Define telemetry event names — at minimum the Run 1 Act I–V funnel and Run 1 → Run 2 continuation
12. [ ] Create AdMob ad units (IDs only; no placements yet)
13. [ ] Publish a privacy policy URL

**The spike** — ADR 0001 §7, scope per §9 below

14. [ ] Build it
15. [ ] Measure against ADR §7.5 and record the numbers in the ADR
16. [ ] Promote ADR 0001 from *provisional* to *accepted*, or trigger §7.6

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
