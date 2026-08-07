# Art Direction — *100000000 Developers*

**Status:** v0, to be validated on device
**Related:** [`GDD.md`](../GDD.md) §7 (Omni-Lens), §8.1 (camera & post-process), §10.5–10.6 (transitions & anti-patterns), §22.7 (art budget cap)

---

## 0. What this document exists to prevent

The failure mode this project must avoid is not *bad assets*. It is **assets that don't
agree with each other**.

A previous studio project shipped four simultaneous visual languages: AI-generated
isometric pixel actors (each generation carrying its own palette and light direction),
skeuomorphic wooden-panel UI, a smooth anti-aliased vector display font sitting beside hard
pixel edges, and a painted illustration for the icon. Individually each was fine. Together
they read as an asset pile. The protagonist was regenerated at least four times chasing a
look that no amount of regeneration could fix, because the problem was never in any single
asset.

**Twelve sprites under one enforced system will look more expensive than four hundred good
ones that disagree.** Everything below exists to enforce a system.

---

## 1. The Direction: Phosphor Over Isometric

The instinct is to make the art "blend with the UI." **Do the opposite.** Blending
produces mush. Separate the two registers hard, then unite them with a single piece of
glass.

| | **The World** | **The Interface** |
|---|---|---|
| **What it is** | The studio. Desks, cables, coffee, bodies, buildings, planets. | A CRT terminal overlay. HUD, trees, cards, modals. |
| **Projection** | 2:1 isometric | Flat, screen-aligned |
| **Palette** | Warm, neutral, dense — many hues, low saturation | One hue at a time, high saturation, 4 values |
| **Edges** | Soft-ish, dithered, textured | Hard, geometric, 1px rules and brackets |
| **Light** | Directional, top-left, consistent | None. It is emissive phosphor, not a lit object. |
| **Depth** | Occlusion, shadow, atmospheric fade | Flat. Never a drop shadow, never a bevel. |

**The glass unites them.** Scanlines, bloom, slight barrel curvature at the edges,
chromatic fringe. The world sits *behind* the glass.

### 1.0a Where the interface sits — **amended 2026-08-06**

An earlier draft said the interface is *burned into* the glass, and that both layers pass
through the same post-process. **That is not buildable on this stack, and the amendment is
deliberate rather than a concession.**

ADR 0001 §3.2 puts every menu, tree, card and counter in React and the DOM, which is the
strongest single reason the stack was chosen. A DOM element cannot be fed through a WebGL
filter chain. So the world can be graded and the interface cannot — the two cannot share
one shader.

**The resolution: the interface is a second pane of glass in front of the tube, not
phosphor burned into the first.**

```
[ you ]  ->  [ interface glass: flat, screen-aligned, emissive ]
         ->  [ CRT glass: curvature, scanlines, bloom, fringe   ]
         ->  [ the world: 2:1 isometric, lit, dense             ]
```

This is a coherent fiction — it is what a heads-up display over a monitor actually is —
and it costs nothing to build. It also *sharpens* §1's central instruction rather than
softening it: the two registers were always meant to be separated hard, and giving them
physically distinct planes is a stronger separation than a shared grade.

**What this does not license.** The interface still obeys one hue at a time, four values,
hard 1px rules, no bevels and no drop shadows. It is still driven by Entropy (§1.1). The
cohesion mechanism for the *interface* is the palette and the type system; the shared
shader was never what was holding it together. It is the **world** layer — where assets
come from mixed sources — that the grade in §6 exists to weld, and that still happens.

If the split ever reads as two products rather than two planes, the cheap fix is a CSS
scanline and vignette overlay on the HUD layer, approximating the grade without a shader.
That is a polish item, not a prerequisite.

### 1.1 The interface is alive, and Entropy drives it

This is the part that will read as "a different level," and it costs shader time rather
than art time.

**The interface hue is a direct function of Communication Entropy ($E$).** Not decoration —
the same variable the simulation runs on.

| $E$ | Interface state | Hue | Glass behaviour |
|---|---|---|---|
| 0 – 0.25 | Calm | Cyan | Clean scanlines, minimal bloom |
| 0.25 – 0.60 | Loaded | Cyan → amber crossfade | Scanlines gain slight roll |
| 0.60 – 0.85 | Strained | Amber | Bloom rises, first chromatic fringing |
| 0.85 – 0.99 | Critical | Amber → red | Screen micro-jitter (GDD §8.1), scanline noise |
| ≥ 0.99 | **Entropy Lock** | Alarm red | Heavy fringe, horizontal tear, phosphor burn-in ghosting |

GDD §8.1 already asks for the jitter and the red scanlines. This just makes the whole
interface obey one variable instead of hand-authoring each state.

---

## 2. Palette

**One palette. ~36 colours. Enforced by tooling, not discipline** (§5).

### 2.1 Structure

| Ramp | Count | Role |
|---|---|---|
| Neutral | 9 | Walls, floors, desks, monitors, shadow, everything structural |
| Wood / warm surface | 4 | Desks, doors, cardboard, crates |
| Skin | 6 | Three tones × 2 values. Deliberately limited — these are 64px busts, not portraits. |
| Screen glow | 3 | Monitor content, data pipes, server LEDs |
| Foliage / accent | 2 | Plants, the one green thing in the office |
| Phosphor: calm | 4 | Interface, low entropy |
| Phosphor: warn | 4 | Interface, mid entropy |
| Phosphor: alarm | 4 | Interface, entropy lock |

### 2.2 Starting values — **v0, validate on a real device before committing**

```
NEUTRAL   #14121a  #241f2e  #3a3244  #55495e  #736579  #968a96  #b8aeb3  #d8d2cf  #f2eee8
WOOD      #4a2f22  #6b452c  #96683f  #c19366
SKIN      #f0c8a0  #c99a72  #c68a5e  #94603c  #7a4b32  #54321f
GLOW      #2a4a5c  #4a8fa8  #7fd4e8
FOLIAGE   #2e4a2c  #4c7a45
CALM      #0a2a30  #1a6b78  #35c9d9  #b8f4ff
WARN      #2e1f08  #8a5c12  #e0a52e  #ffe9b0
ALARM     #2e0c0c  #8a1f1f  #e03c3c  #ffb8b8
```

Store as `assets/palette/master.gpl` **and** `master.png` (a 1px-per-colour strip — the
quantiser reads the PNG).

### 2.3 Rarity frames

The seven Hero Card tiers (GDD §22.4) are palette entries, not new art:

| Tier | Colour |
|---|---|
| Junior | `#55495e` dull grey wire |
| Mid | `#968a96` plain steel |
| Senior | `#96683f` warm bronze |
| Staff | `#d8d2cf` cool silver |
| Principal | `#e0a52e` gold |
| Distinguished | `#8a1f1f` → violet *(add one entry: `#6b3a8a`)* |
| Legendary | `#35c9d9` cyan, animated scanline |

---

## 3. Type

**Buy the font. Do not draw one.** It is the highest quality-per-pound purchase available
to this project.

| Role | Requirement |
|---|---|
| **Terminal / HUD / numbers** | A true monospace pixel font. This carries the CRT fiction and most of the game's text. **Departure Mono** is an excellent fit and free — verify the licence before shipping. |
| **Display / card names / headings** | A heavier pixel face at 2× the body size. Same family if it has weights; otherwise one carefully chosen second face and **no third**. |
| **Everything else** | There is no everything else. Two faces, total. |

**Rules:**

1. **No anti-aliased or vector fonts anywhere.** Not in menus, not in the store, not in
   settings, not in legal text. A smooth curve beside a hard pixel edge is the single most
   common cohesion failure and it is instantly visible.
2. Render at integer multiples only — 1×, 2×, 3×. Never fractional scaling.
3. Numbers are monospace and tabular so counters don't jitter while counting up.

### 3.1 Iconography — **no emoji, anywhere in the product**

**Rule: emoji never ship.** Not in the HUD, not in terminal banners, not in tooltips, not in
store copy, not as a placeholder "until the real icon lands". Every glyph the player sees is
one of exactly two things:

| Kind | How it is made | Examples |
|---|---|---|
| **Procedural pixel icon** | Drawn in code from the §2 palette, on the integer grid. T0 under §4 — geometry, not art, so it costs nothing and cannot drift. | Headcount marker, currency mark, entropy flame, the `@` badge, warning chevron, tier pips |
| **Authored pixel icon** | Made under §4.1 or sourced from a pack and passed through §5's quantiser. Only when an icon carries identity a rectangle cannot. | Hero Card rarity marks, project-type marks |

**Why this is a hard rule and not a preference.** An emoji is a font glyph owned by the
operating system. That means it is:

- **Anti-aliased and vector**, which §3 rule 1 already forbids as "the single most common
  cohesion failure". A colour emoji beside Departure Mono is that failure at its most
  obvious.
- **Not in the palette.** Apple's 🔥 and Google's 🔥 are different pictures in colours
  §5's quantiser has never seen and `art:check` cannot police, because they are not in any
  asset — they arrive at runtime from a font.
- **Different on every device.** The Act III bait banner is a joke about a hard sell; it
  cannot be a joke if a third of players see a flat outline and another third see a 3-D
  glossy rendering of somebody else's brand.
- **Owned by someone else.** It is the one category of "art" in the product that carries no
  studio decision at all.

**In ASCII mocks in the design documents**, use a bracketed word — `[DEVS]`, `[HOT]`,
`[WARN]` — and let the implementation choose the pixel icon. A mock is a layout, not an
asset, and reaching for an emoji there is how they get into the build.

**This rule is enforced.** `npm run art:check` fails on an emoji codepoint in any
player-facing string. It does not police the design documents, engineering comments, or
console output from the build scripts — those are not the product.

---

## 4. Asset Tiers — What Is Made How

Not all assets carry equal identity, and they should not cost equal effort. **Sourcing is
allowed; drift is not.**

| Tier | Assets | How it is produced |
|---|---|---|
| **T0 — Procedural** | Global Grid, galaxy, data pipes, entropy heatmap, dev grid at L3/L4, all post-process | **Shaders.** Not art. GDD §7.5 already states no individual sprites remain at these scales — this is the largest apparent art requirement in the game and it is engineering. |
| **T1 — Identity** | 12 Hero Card portraits, James ×7 tiers, card frames, HUD frames, terminal chrome | **Hand-authored from a parts library** (§4.1), or one tight commission. Never generated. These carry the brand and require exact consistency. |
| **T2 — Character** | Isometric developer sprites at desk and floor zoom | **Parts library**, same method as T1 but generic and reusable. Generation acceptable *if* palette-locked and light-checked. |
| **T3 — Commodity** | Desks, chairs, monitors, server racks, plants, whiteboards, buildings | **Buy a pack or generate.** Seen small, heavily crushed to palette. Identity-free. |

The important consequence: **the real bespoke art surface for this game is T1 plus a small
T2 library.** T0 is shaders and T3 is sourceable. That is a far smaller commitment than the
GDD's visual ambition first suggests.

### 4.1 The parts-library method (how a non-illustrator makes 12 cohesive characters)

Do not draw twelve portraits. **Draw one head and a wardrobe.**

```
assets/parts/
  base/        head_a.png  head_b.png  head_c.png     ← 3 skin tones, identical geometry
  hair/        hair_01..08.png                        ← same anchor point on every one
  facial/      beard_thick.png  beard_short.png  stubble.png  clean.png
  eyewear/     glasses_thick.png  glasses_thin.png  none.png
  torso/       shirt_white.png  shirt_tee.png  hoodie.png  turtleneck.png  suit.png
  props/       mug.png  lanyard.png  headphones.png
```

A character is a **recipe**, not a drawing:

```yaml
james:
  base: head_a
  hair: hair_03
  facial: beard_thick
  eyewear: glasses_thick
  torso: shirt_white_holed      # the elbow hole is a torso variant, not a separate asset
  prop: mug
```

**Why this works:** consistency stops being a matter of skill and becomes a matter of
construction. Every character shares one head geometry, one light direction, one palette.
Twelve characters cost one head plus a wardrobe, and the thirteenth costs a YAML block.

It also makes James's seven promotion tiers nearly free — the recipe changes `torso` and
greys the `facial` entry, and the elbow hole persists because it is baked into every shirt
variant he ever wears.

### 4.2 James's card canvas — **spec correction**

GDD §22.7 originally specified 48×48 busts. **A 48×48 head-and-shoulders bust crops the
elbow out of frame**, which would delete James's defining visual gag before it ever
rendered.

**Card portraits are therefore 64×64, framed at half-body** — head, torso, and both arms
in shot, hands resting forward as if at a desk. Elbows are in frame at every tier.

This does not change the sprite *count* in the §22.7 cap, only the canvas size.

---

## 5. The Quantiser — Cohesion As A Build Step

**This is the single highest-leverage mechanism in this document**, and it is engineering
rather than art skill.

Every image asset — hand-drawn, purchased, or generated — is remapped to the master palette
at build time. Not by discipline. By a script that fails the build.

```bash
# Remap to the master palette, no dithering (dithering invents intermediate colours)
magick in.png -dither None -remap assets/palette/master.png out.png
```

### 5.1 Build gate

A `npm run art:check` task, wired into CI, that fails when any asset in `assets/`:

1. contains a colour absent from `master.png`;
2. is not on the integer pixel grid (fractional dimensions, or scaled non-integer);
3. has a light direction inconsistent with top-left *(manual review flag, not automatable —
   see §7)*;
4. exceeds the sprite-count caps in GDD §22.7.

### 5.2 Why this specifically

Independently generated assets each bring their own palette. That is the mechanism by which
a cast of AI-generated characters ends up looking like a cast from different games. A
mandatory remap makes the source of an asset irrelevant to whether it belongs — which is
what makes sourcing T3 commodity art safe.

---

## 6. Post-Process Stack

Applied over the **world canvas**, in this order. (Not the interface layer — see §1.0a.
The interface is a separate plane in front of the tube and is graded by palette and type
rather than by shader.)

| # | Pass | Driven by | Notes |
|---|---|---|---|
| 1 | Tilt-shift depth of field | Zoom level | Desk zoom only; keeps the target row sharp (GDD §8.1). Applied to the **world container specifically**, not the shared chain — it models a focal plane among the desks, and chaining it ahead of the others renders black (ADR §7.7.2). |
| 2 | Radial / zoom blur | Camera velocity | Fires on rapid zoom (GDD §8.1, §20.4) |
| 3 | Bloom | Entropy $E$ | Rises with strain |
| 4 | Chromatic aberration | Entropy $E$ + poke crits | Subtle; a brief punch on Flow State and 10x pokes |
| 5 | Scanlines + roll | Entropy $E$ | The core CRT signature |
| 6 | Barrel curvature + vignette | Fixed | Slight. This is the glass, and it must be constant. |

**Pass 6 is the weld.** It is the reason a purchased desk sprite and a generated prop read
as the same product. Never disable it, and never apply it to only part of the world.

Per §1.0a it does **not** extend to the interface, which is a separate plane. The weld's
job is reconciling assets of mixed origin, and every asset of mixed origin lives in the
world layer — the interface is authored entirely in code from one palette and one type
system, so it has nothing to reconcile.

Reduce-motion accessibility (GDD §10.5) shortens passes 2 and 5; it never removes pass 6.

---

## 7. Asset Acceptance Checklist

No asset enters `assets/` until every box is ticked. Automatable items are marked ⚙.

- [ ] ⚙ **Palette:** contains only colours from `master.png`
- [ ] ⚙ **Grid:** integer dimensions, drawn on the pixel grid, no half-pixels
- [ ] **Light:** single source, top-left, consistent with neighbouring assets
- [ ] **Projection:** 2:1 isometric for world assets; screen-aligned flat for interface
- [ ] **No anti-aliasing** on edges — hard pixels only
- [ ] **No baked-in gradients, bevels, or drop shadows** — those belong to the shader, if anywhere
- [ ] **No embedded text** in a sprite; all text is live and uses the font system
- [ ] **Reads at target scale** — checked at the size it will actually appear, on device, not zoomed in the editor
- [ ] ⚙ **Within the §22.7 count cap** if it is a Hero Card asset
- [ ] **Sits correctly beside two existing assets** — screenshot it in context before accepting

That last item catches what nothing else does. **Assets are never approved in isolation** —
that is precisely how four visual languages end up in one game.

---

## 8. Tooling & Budget

| Item | Tool | Cost |
|---|---|---|
| Pixel authoring | **Aseprite** (palette locking, reference layers, tilemaps) | ~£20 |
| Free alternatives | LibreSprite, Pixelorama | £0 |
| Palette sourcing | **Lospec** — curated palettes, good starting ramps | £0 |
| Quantiser | **ImageMagick** in the build | £0 |
| Terminal font | **Departure Mono** or similar — verify licence | £0–40 |
| T3 commodity props | Isometric office pack, or generated | £0–30 |
| **T1 identity art** | Self-authored via §4.1, **or** one tight commission | £0, or ~£400–1200 |

**Total realistic floor: under £100.** Ceiling with a commission: around £1,300.

**Where money is best spent, in order:** the font, then the T1 commission. **Not on a UI
pack** — see §9.

---

## 9. What We Do Not Do

| ❌ | Why |
|---|---|
| **Buy a UI pack** | Packs carry their own grammar — bevels, gradients, rounded corners, fantasy scrollwork — that fights a CRT terminal. They are recognisable, and asset-flip smell is the exact opposite of the goal. This game's UI is frames, brackets, rules and type: the cheapest thing to author bespoke and the highest return per hour. A pack also cannot serve the rarity-tier palette or entropy-driven interface states. |
| **Generate the T1 identity assets** | Generation cannot hold a palette, a light direction, or "same character, seven variants, only the shirt changes" across a set. This is exactly where the previous project broke. |
| **Use AI output as a final asset** | Its correct role is §10. |
| **Mix a vector/anti-aliased font with pixel art** | The most visible cohesion failure available, and one already made once at this studio. |
| **Ship an emoji** | See §3.1. It is the same failure as the row above, arriving through a door nobody guards — and it is somebody else's art, rendered differently on every device, in colours outside the palette. |
| **Approve an asset in isolation** | See §7. |
| **Expand the Hero roster** | GDD §22.7 is a hard cap. |
| **Add a third font, or a colour outside the palette, "just for this one screen"** | This is how systems die. Amend the palette deliberately, or don't. |

---

## 10. The Correct Role For AI Generation

Not banned — **scoped**.

| ✅ Good use | ❌ Bad use |
|---|---|
| Mood boards and colour studies before the palette is fixed | Producing final T1 assets |
| Concepting a Multiverse dimension's look (GDD §17) | Producing a character who must stay consistent across variants |
| T3 commodity props, *then* passed through the quantiser | Anything skipping §5 |
| Silhouette and composition exploration | Anything skipping §7 |

**The rule:** generation is a **reference tool**, and the parts library (§4.1) is the
production method. Generate to decide what a thing looks like; author it to make it exist.

---

## 11. Open Questions

1. **Palette validation on device.** §2.2 is a v0 draft. The phosphor ramps in particular
   need checking on a cheap LCD in daylight — cyan-on-dark can wash out badly.
2. **Commission or self-author T1?** Decide after attempting two busts via §4.1. If two
   take under a day and sit together correctly, self-author the rest.
3. **Isometric dev sprite size at floor zoom.** Needs to be legible at L2 while remaining
   an individual body. Blocked on the ADR 0001 spike, which will settle the real on-device
   scale.
