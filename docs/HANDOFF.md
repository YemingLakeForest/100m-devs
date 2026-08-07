# Handoff — 2026-08-07

Short by design. **The detail lives in [`GDD.md` §23](../GDD.md) — Technical Constraints &
Build Readiness — which is the single source of truth for building.** This file is a pointer
and a status line, nothing more.

---

## Read this first

**[`GDD.md` §23](../GDD.md)** carries everything you need:

| | |
|---|---|
| §23.1 | The stack |
| §23.2 | The five non-negotiables — break one and the thing it protects breaks |
| §23.3 | The performance budget, and honestly what is proven vs not |
| §23.4 | Orientation, framing, and the camera work that has to happen first |
| §23.5 | The spike is the product — and what that leaves to clean up |
| §23.6 | Build readiness and the order |

**The ADRs are frozen history.** `docs/adr/0001` and `0002` record how the engine and
orientation decisions were reached and what was rejected. Read them once for context; do not
consult them to build. Where they and §23 disagree, §23 is right. **No further ADRs will be
written** — decisions of that weight land in §23.

---

## Where the project is

**Run 1 — The Trap is playable end to end**, in the browser and on an Android device. Poke,
hire James, ship *Flappy Square*, take the mass-hire bait, watch the studio seize, go
bankrupt, Paradigm Shift, loop. Every number in that sequence comes from the §4 simulation,
not from a script.

**214 tests.** Lint, types and the art gate are clean.

Roughly: simulation ~65%, art **0%**, spectacle ~40%, UI surface ~15%.

Full built / not-built tables are in **§23.6** rather than duplicated here.

---

## The next three things, in order

1. **§23.4.1 — make the camera viewport-aware.** Small and self-contained. Until it lands,
   landscape delivers nothing visible and every layout decision is being made against a frame
   that is 92% empty. Re-run `?bench` afterwards; it moves criterion 4.
2. **§10.7 dialogue + the §10.8 juice kit**, with the existing HUD retrofitted. `Panel`,
   `Button`, spring/momentum hooks, `Typewriter`, `uiSfx` — built once here because dialogue
   is the first feature that needs all of them at once.
3. **§21.0 loop reshape → §21.6 James scene → §7.7.6 navigation → §7.7.2 arrival gag.**

Each ships only when it passes **§10.8 F1–F6 on the device.**

---

## There is no CI, deliberately

`.github/` has been **deleted**, not parked. Everything a workflow would run is one command:

```bash
npm run check     # lint + typecheck + tests + the art gate
```

**Nothing was lost.** The workflow had exactly one check with no local equivalent —
verifying `assets/palette/master.png` had not gone stale against `src/art/palette.ts`. That
now lives *inside* `art:check`, which is where it belonged: the gate reads the PNG, so it
validates its own reference before validating anything else. A gate measuring against a
stale reference is worse than no gate, because it is trusted.

**Two hazards, both hit for real:**

- Pushing anything under `.github/workflows/` needs a token with `workflow` scope. This repo
  pushes via Git Credential Manager, whose token has `repo` only. `gh auth refresh` does
  **not** fix it — git never consults `gh`'s token. It looks exactly like it should work.
- A committed workflow file rejects **every subsequent push**, not just its own, so the
  failure surfaces later on unrelated work, pointing at CI.

**When to revisit:** the first time a cloud agent pushes code no human watched it write.
Until then, one committer running `npm run check` is the same coverage without the tooling.

---

## Local-only things a cloud session cannot do

- **ElevenLabs generation** needs `.env` (gitignored). The thirteen SFX clips are committed;
  the §20.7 music stems are **not generated yet** and the endpoint and commercial licence
  tier both need confirming against ElevenLabs' current docs first (§20.7.6).
- **Android build, install, and the `?bench` device run** need the local SDK and a phone.
- **Visual verification.** Anything that has to be *looked at* needs a session that can
  screenshot. A cloud agent should take the logic-heavy work — tech tree, prestige, save,
  §18 events, §19 dialogue — all of which is data plus tested logic.

---

## Still owed to a human, not to code

- **§23.3 criterion 2** — audio latency needs an external capture. Record a tap on a hard
  surface and the resulting click on a second device; read the gap in an audio editor.
- **§23.3 criterion 7** — has never been run in landscape. It passed in portrait on a
  desk-zoom tapping test, so it does not transfer. One tap, 80 seconds.
- **The whole gate on a cheap Android handset.** Everything measured so far is a flagship
  ceiling. Borrowed, second-hand, a colleague's — any of them.

---

## Verifying visually — read this before automating a browser

**The Pixi ticker stops dead in a hidden tab.** Chrome suspends `requestAnimationFrame`
whenever `document.hidden` is true, which includes a background window and a minimised one.
The React HUD keeps rendering and `window.__stage` keeps returning its last value, so the
app looks alive while the simulation, the camera and every animation are frozen mid-flight.

This is the same hazard `?bench` already guards against (a criterion with no samples reports
UNKNOWN, never FAIL). It costs a session if you meet it without knowing:

- **Symptom:** a scripted camera move appears to stall partway and never arrive, or a value
  freezes at an arbitrary number while `dt` still reads 0.0167.
- **Check first:** `document.hidden`. Not `document.hasFocus()` — a tab can report focused
  and hidden at the same time, and it is `hidden` that suspends rAF.
- **Fix:** bring the window to the front. There is no code-side workaround, and there should
  not be one.

Two more automation notes, both learned the hard way:

- `javascript_tool` inside a `browser_batch` may evaluate in a stale context after a
  `navigate`. Issue one throwaway call first, then read.
- Synthesising a tap with `pointerdown` alone leaves a permanent entry in the pinch-tracking
  map, and two of them put the camera into pinch mode where every mouse move rewrites Z.
  `stage.ts` now expires pointers after 2 s so this cannot wedge the camera, but dispatch
  `pointerup` too.

---

## Flags worth knowing

| Flag | Effect |
|---|---|
| `?bench` | §23.3 acceptance run. `?bench=10` shortens the 60 s leg |
| `?act=act5_bleeding` | Jump the §21 script — Run 1 takes ~4 minutes by design |
| `?nopost` / `?post=bloom,crt` | Drop or select post-process passes |
| `window.__stage` | Dev builds only — camera Z, LOD weights, collapse state |

**The first three are unguarded and would ship in a web build** — see §23.5 item 2. On
device there is no query string, so the bench is a button: build with `VITE_BENCH=1`, and a
shipping build never contains it.
