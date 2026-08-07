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
| **Act IV spectacle** (§21) | **Not built.** No Slack web, no ping bubbles, no falling swarm |
| Tech tree, prestige, cards, save, ads | Not started |

Roughly: simulation ~60%, art 0%, spectacle ~5%, UI surface ~15%.

---

## ADR 0001 is accepted

The spike passed. The engine question is closed and the vertical slice is open.

## The one decision still waiting for a human

**ADR §7.7.4 — criterion 5 is flapping and the criterion is the problem.**

It reads "no frame drops below 50 fps" over 60 seconds of sustained tapping. That is a
*single worst frame* test; at 120 Hz it is one bad frame in ~7,200. Two consecutive device
runs gave 57.5 fps (pass) and 44.1 fps (fail) with no code change. Drift over the same run
was **−1.2 ms** — the second half was faster than the first, so there is no degradation and
§7.6's kill criterion does not fire.

Restating it as a percentile (99th frame ≥ 50 fps) would measure sustained smoothness
rather than the worst GC pause in a minute. **That is a loosening of a gate and is the
decision owner's call.** It has deliberately not been done.

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
| `?act=act5_bleeding` | Jump the §21 script — Run 1 takes ~4 minutes by design |
| `?nopost` / `?post=bloom,crt` | Drop or select post-process passes |

On device there is no query string, so the bench is a button — build with `VITE_BENCH=1`.
A shipping build never contains it.
