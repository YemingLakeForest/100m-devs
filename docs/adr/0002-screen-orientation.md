# ADR 0002 — Screen Orientation

- **Status:** **Accepted** — decided 2026-08-07.
- **Date:** 2026-08-07
- **Decision owner:** Yeming Huang
- **Supersedes:** the portrait wireframe in [`GDD.md`](../../GDD.md) §10.3
- **Related:** [`GDD.md`](../../GDD.md) §7 (Omni-Lens), §7.7 (Construction Ladder), §10 (UI),
  §10.8 (Presentation Gate); [`ART_DIRECTION.md`](../ART_DIRECTION.md) §1 (2:1 isometric);
  [`MONETISATION.md`](../../MONETISATION.md) §4–7

---

## 1. Decision

**Lock the game to landscape.** `sensorLandscape` on Android — both landscape rotations
allowed, portrait never.

All layout, art, store assets and the §10.8 presentation work target landscape from here.
The portrait wireframe in GDD §10.3 is superseded.

---

## 2. Context

### 2.1 The projection decides this, not taste

ART_DIRECTION §1 specifies **2:1 isometric**. That is not a style preference with layout
implications — it *is* a layout constraint, because a 2:1 isometric grid is exactly twice as
wide as it is tall and cannot be anything else.

Measured against the shipped renderer (`TILE_W = 64`, `TILE_H = 32`,
`FLOOR_SPRITE_COUNT = 1000`, 32×32 iso grid), the Level 2 floor — the game's primary image —
occupies **992 × 496 world units, exactly 2.0 : 1**.

Fitted to the Pixel 8 Pro viewport recorded in ADR 0001 §7.7.4 (448 × 997 CSS px):

| Orientation | Viewport | Scale to fit | Screen used | Display area used |
|---|---|---|---|---|
| **Portrait** | 448 × 997 | 0.452 | 100% wide × **22% tall** | **22%** |
| **Landscape** | 997 × 448 | 0.903 | 90% wide × 100% tall | **90%** |

**Portrait spends 78% of the display on something other than the game.** The remainder is
HUD or empty, and it cannot be recovered by zooming in — zooming in means showing less of
the swarm, and the swarm is the picture. Portrait forces a permanent trade between "fill the
screen" and "see the game", and there is no setting of the camera that wins both.

This generalises up the §7.7 Construction Ladder rather than being a floor-tier quirk:
every rung is drawn in the same 2:1 projection, so campuses, towns, nations and planets are
all wide. The one exception is rung 3, "a tower growing storey by storey", which is
genuinely vertical — one rung out of ten.

### 2.2 The one-handed argument expired

Portrait's strongest case in this genre is one-handed thumb play. That case was real when
this was a pure clicker. It is not any more: **GDD §7.7.6 requires drag-to-pan and
pinch-zoom**, both of which are two-handed gestures, and §7.7.6 also requires tapping
individual developers among a thousand — a precision target that a thumb reaching across a
tall screen serves poorly and two thumbs on a wide one serve well.

The decision to add navigation already spent most of what portrait was protecting.

### 2.3 Studio and genre convention both point the other way

Verified rather than assumed:

- `mind-the-gap` and `dungeon-doom-dash` both set `android:screenOrientation="portrait"`.
  `geodaily` and `gullfather` set nothing.
- **This project currently locks nothing** — orientation is unconstrained in
  `AndroidManifest.xml` and `capacitor.config.ts`, so nothing is being unwound here.
- Idle and clicker games on mobile are overwhelmingly portrait. This is a store-conversion
  and player-expectation argument, and it is the real cost of this decision (§5).

Orientation is a per-game choice. Neither `@mercilessstudio/game-cloud` nor
`@mercilessstudio/game-monetise` constrains it, so the ADR 0001 §3.1 argument — that the
plugin layer is the cost centre — is untouched here.

---

## 3. Rationale

1. **A 2:1 projection in a 1:2.2 window is a 22% game.** §2.1 is the whole argument. The
   other points are supporting.
2. **The Omni-Lens is a horizontal instrument.** §7 sells continuous zoom across nine orders
   of magnitude. What makes that read is *how much of the swarm is in frame at each step*,
   and that is a width measurement.
3. **Every screen above the floor is wide.** The three-branch tech tree (§11), two prestige
   talent trees (§13, §15), the org-chart card board (§22.2), the infinite Multiverse grid
   (§17) and the release list are all wide, structured layouts. They are cramped in portrait
   and natural in landscape.
4. **The §10.7 dialogue box wants width.** A Pokémon-style box is a wide, short frame with a
   name plate — it is the shape it is because that is what reads at a glance.

---

## 4. Alternatives Considered

### 4.1 Portrait — rejected

The genre-conventional choice and the studio's existing convention. Rejected on §2.1: it
gives 22% of the display to the game's primary image, and the projection that causes it
(ART_DIRECTION §1) is more load-bearing than the convention.

**This would be the option to revisit if store conversion is the thing that fails** — see §7.

### 4.2 Support both, responsively — rejected

Superficially the safe answer and actually the worst one for a solo developer.

It doubles the layout work on every screen in §2.1's inventory, forever, and §10.8 makes
that concrete: every panel, transition, overscroll and camera framing would need designing
and *gate-testing* twice. It also does not resolve the question — it defers it into every
individual layout decision, where it gets answered inconsistently and by whoever is closest
to the keyboard.

There is no orientation-agnostic answer to "how much of the swarm is in frame", so the
camera would need per-orientation tuning regardless.

### 4.3 Landscape with a portrait fallback for menus only — rejected

Rotating the device to reach a menu is a worse experience than either pure option, and it
guarantees the §10.5 "nothing cuts" rule is violated at exactly the moment the OS rotation
animation takes over.

---

## 5. Consequences

### Positive

- The primary image gets 90% of the display instead of 22%.
- Tech trees, the org chart and the Multiverse grid get their natural shape.
- The §10.7 dialogue box gets the proportions the format assumes.
- Layout work is done once (§4.2).

### Negative

- **Genre convention is broken, and this is the real risk.** Idle games are portrait; a
  landscape store listing reads as a different kind of product before anyone plays it. This
  is a conversion risk, not a design one, and it is accepted knowingly.
- **One-handed play is gone.** Mitigated by §2.2 — it was mostly gone already — but a player
  on a train with one hand full is now not a player.
- **Rung 3's tower is the one thing that fits portrait better** (§2.1). It will need framing
  work that the other nine rungs do not.
- **GDD §10.3's wireframe is void** and needs redrawing.
- **Store screenshots, the feature graphic and any recorded footage are landscape.**
- **ADR 0001 §7.5 criterion 7 was passed in portrait.** That was a desk-zoom tapping test,
  so it does not transfer as evidence either way — but it also means the subjective gate has
  not been run on the orientation being shipped. **Re-run it.** It is one tap and 80 seconds.

### Neutral

- AdMob serves landscape creatives to landscape apps; rewarded video and interstitials both
  support it. No MONETISATION change.

---

## 6. Implementation Notes

```
android/app/src/main/AndroidManifest.xml
  android:screenOrientation="sensorLandscape"
```

`sensorLandscape` rather than `landscape`, so the device can be held either way up. Portrait
is never entered.

The activity already declares `android:configChanges="orientation|…|screenSize|…"`, so the
WebView is not destroyed on a 180° flip.

### 6.1 The design box

Phone landscape is **not** 16:9. It runs from about **1.78 : 1** (older 16:9 devices) to
**2.4 : 1** (modern 20:9 and 21:9). The Pixel 8 Pro from the ADR 0001 device run is
**2.23 : 1**.

> **All three reference videos studied for §10.8 are 1920 × 1080 — 16:9 — because they are
> PC captures.** Phones are wider than that. Do not design to the references' frame.

**The rule:** compose for **2.0 : 1**, and guarantee legibility from 1.78 : 1 to 2.4 : 1.

- The iso floor is centred and scales to fit **height**, not width. It is 2:1, so at 2.4:1
  it leaves margin at the sides — that margin is where the HUD lives, and it is a feature.
- HUD elements anchor to **edges**, never to fractions of the width.
- Nothing load-bearing sits within 5% of the left or right edge (notches, gesture bars,
  curved-display cutoff).

### 6.2 Follow-on work this creates

1. Redraw GDD §10.3's wireframe in landscape.
2. Re-run ADR 0001 §7.5 criterion 7 in landscape before the vertical slice is called done.
3. Frame rung 3's tower deliberately (§5).

---

## 7. Revisit Triggers

Reopen this ADR if:

- **Store conversion measurably underperforms** against the studio's portrait titles at a
  comparable stage, and the landscape listing is a credible cause. This is the one plausible
  trigger and §4.1 is the option it points to.
- ART_DIRECTION §1's 2:1 isometric projection is abandoned. The entire §2.1 argument is
  downstream of it; if the game stops being isometric, this decision has lost its evidence.
- Playtesting shows the two-handed requirement (§2.2) is itself the problem, in which case
  both this ADR and §7.7.6 are in question together, and §7.7.6 is the one to reconsider
  first.
