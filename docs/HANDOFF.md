# Handoff — 2026-08-07

State of play for whoever picks this up next. Short by design; the detail lives in the
documents linked from each line.

---

## Where the project actually is

**Run 1 — The Trap is playable end to end**, in the browser and on an Android device. Poke,
hire James, ship *Flappy Square*, take the mass-hire bait, watch the studio seize at
99.999% entropy, go bankrupt in ~20 seconds, Paradigm Shift, loop. Every number in that
sequence is produced by the GDD §4 simulation, not scripted.

**151 tests.** Lint, types and the art gate are clean.

| Layer | State |
|---|---|
| Simulation (GDD §4, §6, §21) | Built and tested against the GDD's own stated figures |
| Economy (GDD §4.10) | Built — the model was derived here; the GDD had none |
| Art pipeline (palette, quantiser, `art:check`) | Built |
| Post-process / CRT grade | Built — carries most of the visible vibe |
| **Authored art** | **Zero.** 0 of the 19 sprites in the §22.7 budget |
| **Act IV spectacle** (§21) | **Built and verified on screen** — swarm drops from the sky, red Slack web, `@everyone` flood, chatter bubbles, screen shake, four new SFX |
| Poke code snippets (§8.2a) | Built — real `+N` numeral plus a typed joke line, replacing the placeholder bar |
| Construction Ladder model (§7.7) | **Model + store wiring built; the renderer is not.** See below |
| Player-facing vocabulary (§4.3a) | Built — "entropy" no longer reaches the player |
| Emoji ban (ART_DIRECTION §3.1) | Built **and gated** — `art:check` fails on an emoji in any player-facing string |
| Tech tree, prestige, cards, save, ads | Not started |

**213 tests.** Roughly: simulation ~65%, art 0%, spectacle ~40%, UI surface ~15%.

---

## Specified but NOT built — read this before picking anything up

These landed in the GDD this session as canon. **Nothing below has a renderer yet.**

| Spec | What exists | What does not |
|---|---|---|
| **§7.7 Construction Ladder** — floors → buildings → campuses → towns → nations → planets → galaxies | `src/sim/headcount.ts` (rungs, ratio-scaled arrival weight, cohort size, scale bar) + `store.spawn` events + the HUD scale bar | **The arrival gag.** Nothing drops a floor onto the tower. `SpawnEvent` is published every hire and no renderer consumes it |
| **§7.7.4 Hero Anchor** — pinching in always lands on James's floor | — | All of it. Currently the desk tier is generic |
| **§7.7.6 Navigation** — drag to pan, poke *any* of the 1,000, select a floor/city/planet | Pinch-zoom only | Drag-pan, the tap-vs-drag discriminator, per-particle hit testing (needs a spatial index beside the ParticleContainer), unit selection |
| **§10.7 Dialogue system** — Pokémon-style typed letters, unskippable | — | All of it. This gates §21.6 |
| **§21.0 Reshaped Run 1** — earn/hire/ship loop to ~10 devs, then a *paid* Mass Hire | Current build still goes 1 → 2 → 1,000 with a free button | Act IIa entirely; pricing the Mass Hire at the player's treasury |
| **§21.6 Run 2 Act 0** — "How did you find me in every single reality?", James introduces Instant Messenger | — | Needs §10.7 first |
| **§10.8 Presentation Gate** — F1–F6, the definition of "done" for feel | Written as canon | **Nothing currently passes it.** The HUD has no button physics, no overscroll, no press-down state; panels appear without transitions; most state changes are silent |

The natural order is: **§10.7 dialogue → §21.0 loop reshape → §21.6 scene → §7.7.6
navigation → §7.7.2 arrival gag.** Dialogue first because two other items are blocked on it
and it is self-contained.

**§10.8 is not an item in that list — it applies to every one of them.** Each feature above
ships only when it passes F1–F6 on the device. Building them first and juicing them later is
the failure mode §10.8 exists to prevent, and it is how the current HUD ended up where it is.

## The GDD was swept on 2026-08-07 — what it turned up

A consistency pass after the session's edits. Fixed in place:

- **§21 Act III still advertised "Cost: FREE (Trial Promo)"** while §21.0 had made the Mass
  Hire cost the player's whole treasury. The document contradicted itself on the single most
  important decision in Run 1. *(The code still says FREE — that is §21.0 being unbuilt, and
  it is listed above.)*
- **§6.2 said the Mass Hire unlocks "early on"**, which is the shape §21.0 replaced.
- **§21 Act V's banner and stage direction still read "COMMUNICATION ENTROPY 100%"** after
  §4.3a made that word internal-only. §4.3a explicitly names this line as the one that must
  change, and it had not been.
- **§10.1's HUD mock printed `(Entropy High!)`** — same leak, in the component table.
- **§7.3 specifies a different ladder from §7.7.1** — skyscraper at 10⁴ and planetary at 10⁹,
  against §7.7.1's building at 10⁴ and planet at 10¹⁰. §7.3 is now marked superseded for its
  numbers and kept for its art direction, which is still the best description of each scale
  anywhere in the document.

Left alone deliberately: §7.5's transcribed sketch annotations still say "COMMUNICATION
ENTROPY!" because they are a *transcription of concept art that exists*, and editing them
would falsify the record rather than fix anything.

**New in Appendix C (#13, #14), and they need a decision before Act IIa is built.** Measured
against the shipped `entropy()` and the §4.2 cap of 100:

| Devs | 1–8 | 10 | 20 | 50 | 100 | 1,010 |
|---|---|---|---|---|---|---|
| E | 0.000% | 0.001% | 0.032% | 3.03% | 50.0% | 99.999% |

§21.0's claim holds — at 10 developers the readout is `IN SYNC` and the player has no reason
to doubt anything. But the curve is *flat*, not gentle: Act IIa as specified gives zero
signal rather than a faint one, and **five of the seven §4.3a labels are unreachable in
Run 1** — it goes straight from `IN SYNC` to `STUDIO SEIZED` with nothing in between.

---

## ADR 0001 is accepted

The spike passed. The engine question is closed and the vertical slice is open.

## The one decision still waiting for a human

~~**ADR §7.7.4 — criterion 5 is flapping.**~~ **RESOLVED 2026-08-07 by the decision owner:
restated as "99th-percentile frame ≥ 50 fps".** Recorded as a deliberate loosening in ADR
§7.5, with what it gives up; the harness now gates on the percentile and prints the worst
single frame beside it as an ungated diagnostic.

**Criterion 5 is therefore unmeasured under its current wording.** The two Pixel runs
recorded worst-frame numbers and the percentile was not captured, so they cannot be
honestly converted. The next device run measures it properly for the first time.

---

## Also blocked on a person, not on code

1. ~~**Criterion 7, the subjective gate.**~~ ✅ **PASSED 2026-08-07** — a person who had
   not seen the game was handed the Pixel and kept tapping. **ADR 0001 is now Accepted**,
   and §7.3's out-of-scope list no longer constrains the work. Residual risks in ADR §7.7.5.
2. **Criterion 2, audio latency.** Unmeasurable from JavaScript — the mixer, buffer, DAC
   and speaker are invisible, and on Android that is exactly where WebView latency hides.
   Needs an external capture: record a tap on a hard surface and the resulting click on a
   second device, read the gap in an audio editor.
3. ~~**CI is written but unpushed.**~~ **Parked deliberately — do not spend time on it.**
   See "CI, and why it is parked" below.

---

## There is no CI, deliberately

`.github/` has been **deleted**, not parked. `gh` is not a dependency of this project
either — it is GitHub's API client (pull requests, issues, releases) and adds nothing over
plain `git` for clone/commit/push/pull.

Everything the workflow would have run is one command:

```bash
npm run check     # lint + typecheck + tests + the art gate
```

**Nothing was lost in the deletion.** The workflow had exactly one check with no local
equivalent — verifying that `assets/palette/master.png` had not gone stale against
`src/art/palette.ts`. That is now *inside* `art:check` itself, which is where it belonged:
the gate reads the PNG, so it validates its own reference before validating anything else.
A gate measuring against a stale reference is worse than no gate, because it is trusted.

**Two hazards worth knowing, both hit during this session:**

- Pushing anything under `.github/workflows/` needs a token with `workflow` scope, and this
  repo pushes via Git Credential Manager, whose token has `repo` only. `gh auth refresh`
  does **not** fix it — git never consults `gh`'s token. It looks exactly like it should work.
- A committed workflow file rejects **every subsequent push**, not just its own. So the
  failure surfaces later, on unrelated work, pointing at CI.

**When to revisit:** the first time a cloud agent pushes code no human watched it write.
At that point CI stops being ceremony and becomes the only thing checking the work. Until
then, one committer on one machine running `npm run check` is the same coverage without
the tooling.

---

## What to build next, and why in this order

1. **Act IV's spectacle** (§21 Act IV, §6.2). The GDD promises 1,000 devs dropping from the
   sky, a red Slack spiderweb, `@everyone` bubbles flooding the screen, the music cutting
   to sirens. What currently happens is a number changing colour. It is the emotional core
   of Run 1 and the biggest gap between document and product — **and it needs no authored
   art**, being entirely procedural.
2. **Two James busts via ART_DIRECTION §4.1.** Find out whether self-authoring the parts
   library works before committing to the other ten. The method (one head plus a wardrobe,
   characters as recipes) does not exist yet in any form — no compositor, no parts, no
   pixels.
3. **In-run tech tree (§11).** Makes Run 2 mean something. Currently the Paradigm Shift
   button restarts the run without granting anything, because the Layer 1 tree is not
   built.

**Do not do more render/post-process work.** That layer is proven adequate and is not what
is at risk.

---

## Local-only things a cloud session cannot do

- **ElevenLabs SFX generation** needs `.env` (gitignored). The nine clips are committed, so
  this only matters for new sounds.
- **Android build, install and the `?bench` device run** need the local SDK and a phone.
- **Visual verification.** Anything that has to be *looked at* — the spectacle work above
  especially — needs a session that can screenshot. A cloud agent should take the
  logic-heavy work (tech tree, prestige, save, §18 events, §19 dialogue), all of which is
  data plus tested logic.

---

## Flags worth knowing

| URL | Effect |
|---|---|
| `?bench` | ADR §7.5 acceptance run. `?bench=10` shortens the 60 s leg |
| `window.__stage` | Dev builds only — camera Z, LOD weights, collapse state. Added because "nothing is on screen" is the same symptom for a store flag, a stalled dolly and a culled tier |
| `?act=act5_bleeding` | Jump the §21 script — Run 1 takes ~4 minutes by design |
| `?nopost` / `?post=bloom,crt` | Drop or select post-process passes |

On device there is no query string, so the bench is a button — build with `VITE_BENCH=1`.
A shipping build never contains it.
