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
| **§21.0 Reshaped Run 1** — earn/hire/ship loop to **~40 devs**, then a *paid* Mass Hire | Current build still goes 1 → 2 → 1,000 with a free button | Act IIa entirely; pricing the Mass Hire at the player's treasury |
| **§21.6 Run 2 Act 0** — "How did you find me in every single reality?", James introduces Instant Messenger | — | Needs §10.7 first |
| **§10.8 Presentation Gate** — F1–F6, the definition of "done" for feel | Written as canon | **Nothing currently passes it.** The HUD has no button physics, no overscroll, no press-down state; panels appear without transitions; most state changes are silent |

### The build order

**Step 1 — the juice kit, built inside the §10.7 dialogue work.**

§10.8 applies to every feature below, so the primitives it demands get built *once*, and the
dialogue system is the right place because it is the first thing that needs all of them at
the same time: a panel that enters and leaves (F1), an advance control that answers the
thumb (F2), a per-letter tick and an open/close sound (F3), and a camera push on the beat
(F5). Building them here and reusing them is the difference between a juice pass and a
juice rewrite.

What comes out of step 1, as reusable pieces rather than as dialogue-specific code:

| Piece | Serves | Used next by |
|---|---|---|
| `Panel` — directed enter/exit, scale-and-blur per §10.5 | F1 | every modal, the Query Panel, the tech tree |
| `Button` — press-down depression, spring release, sound on *down* | F2 | the whole HUD, immediately |
| `useSpring` / `useMomentum` — overscroll, pull-down elasticity, drag friction | F2 | §7.7.6 camera pan, every list |
| `Typewriter` — per-character reveal with punctuation pauses | F5 | terminal banners, the advisor, §21.6 |
| `uiSfx` — a click/whoosh/tick bank on the native path | F3 | everything |
| **A §10.8 checklist in the PR template** | F1–F6 | every feature after this |

**Then, in order:** §21.0 loop reshape → §21.6 James scene → §7.7.6 navigation →
§7.7.2 arrival gag. Each one ships only when it passes F1–F6 **on the device**, using the
kit above rather than hand-rolling its own motion.

**The existing HUD gets retrofitted as part of step 1**, not later — it is the largest
surface in the product and it currently fails F1, F2 and F3 outright. Retrofitting it is
also the cheapest proof that the kit is actually reusable, because if `Button` cannot
absorb the HUD's existing buttons it is the wrong abstraction and better to learn that in
step 1 than in step 5.

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

**Appendix C #13 and #14 are now RESOLVED** (decision owner, 2026-08-07):

- **#13 — Act IIa runs to ~40 developers**, not ~10. That is the first headcount where the
  readout stops saying `IN SYNC` (E = 1.01%). The §4.2 cap is untouched, so §6.2's canonical
  0.01x figure and §21 Act V's 0.00000x both stand.
- **#14 — the §4.3a labels are re-banded against the curve** (1 / 10 / 40 / 70 / 90 / 99%)
  rather than spread evenly across the axis. Applied in `src/game/vocabulary.ts`, with a
  test pinning `CHATTY` at 40 devs and `IN SYNC` at 10.

**One follow-on, worth doing the next time Act IV is touched.** The Mass Hire adds 1,000
developers in a single frame, so even re-banded the readout jumps `CHATTY` → `STUDIO SEIZED`
and the four middle labels are traversed instantaneously. Driving the readout off *landed*
developers instead of hired ones makes the Act IV drop — which already runs 2.2 s and
already has a progress value in `dropProgress()` — sweep the player through `BOGGED DOWN`,
`PRODUCTIVITY BREAKDOWN`, `TOTAL GRIDLOCK` and `MELTDOWN` as the bodies come down. The whole
ladder, used, during the beat it was written for. Recorded in GDD §4.3a.
