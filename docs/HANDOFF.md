# Handoff — 2026-08-08

Short by design. **The detail lives in [`GDD.md`](../GDD.md), which is the single source of
truth.** This file is a status line, a list of traps, and what to do next.

---

## Read this first

**[`GDD.md` §23](../GDD.md)** — Technical Constraints & Build Readiness — carries the stack,
the five non-negotiables, the performance budget, and the build order. **The ADRs are frozen
history**; where they and §23 disagree, §23 is right, and no further ADRs will be written.

One command gates everything:

```bash
npm run check     # lint + typecheck + tests + the art gate
```

**743 tests.** Lint, types and the art gate clean.

---

## Where the project is

**Run 1 is playable end to end and the economy now closes.** Poke → ship *Flappy Square* →
hire James → ship again → Seed Round at 10 → hire to 40 → the offer appears → collapse →
bankruptcy → Paradigm Shift → **Run 2 with prestige bonuses**. Every number comes from the §4
simulation.

| | State |
|---|---|
| **Simulation** | Run 1 closed and simulated end to end (`runOne.test.ts` plays it) |
| **Prestige** | Layer 1 built — BP earned, banked, spent on the Paradigm Tree; 2 of 5 nodes wired |
| **Audio** | 13 SFX + 10 music stems generated and playing |
| **Art** | **0 of §22.7's 19 authored sprites.** Everything on screen is code-drawn from the palette |
| **Rungs** | 0–3 built (room, tower). **4+ unbuilt** — building, campus, town, nation, planet, galaxy |

### Built this session

Developer identity (generated, never stored) · selection with the turn-to-camera · ambient
life · the god-mode floor (pick people up) · the hire dial · Act IIa/IIb + the Seed Round ·
the bait as a pull rather than a shove · the ship celebration · Layer 1 prestige · the music
bus + stems · horizontal desk rows · isometric props with contact shadows.

### Specced, not built

- **§13.6 Hero Cards** — cards slotted onto Construction Ladder rungs, REACH/DEPTH/TRAIT
  trees. The design is complete and it is the largest unbuilt system.
- **§7.8.2 rungs 4+** — above 10,000 the tower caps at ten storeys and stops growing.
- **§13.2's other three Paradigm nodes** — they say *"not wired up yet"* on the card, which
  is deliberate: a tree that takes currency and changes nothing is worse than one that admits
  it.

---

## Do this next

**The developer/desk model.** Asked for and not yet done:

> simple desk, PC on top, chair behind, and on top a person — waist up, no feet, and they
> hop about.

`src/render/room.ts`, `buildDeveloper` and `drawDesk`. Note the current figure faces
**north-west** into its monitor (§7.8.8) and has a second front-facing pose used by the
selection turn — both poses need the change. There is no chair currently: one was removed
because at eighty developers it read as eighty grey slabs in the near field, so re-adding it
means keeping it small and low-contrast.

Then, in rough order of value: **§13.6 Hero Cards**, **rungs 4+**, **§22.7's sprites**.

---

## Blocked on a human

- **ElevenLabs Music API** needs a paid plan. The ten stems currently come from the *free*
  Sound Effects endpoint, which §20.7.1a makes the correct choice for an ambient score rather
  than a concession — but nobody has listened to them yet. **Do `layer-strained` and
  `bed-desk` sit together without clashing?** That is the whole ten-stem design and it needs
  ears. `npm run music:generate -- --force <stem>` rerolls one.
- **§4.10d's cash curve** — the arithmetic is sound and the *shape* is lumpy: payroll is
  continuous, revenue arrives on ship, so the studio is overdrawn for most of every project.
  The readout no longer lies about it, but whether it *feels* right is a play-test question.
- **F1.3 age rating / target audience.** Still blocks ad configuration. Declaring child
  appeal bans personalised ads.
- **§23.3 criterion 2** (audio latency, needs an external capture) and **criterion 7**
  (never run in landscape). **The whole gate on a cheap handset** — everything measured so
  far is a flagship ceiling.

---

## Traps — read before debugging anything

Every one of these cost real time this session.

### 1. A stale `dist/` looks exactly like a bug that will not die

Six hours of fixes were reported as still broken. They were: `dist/` had been built that
morning and never rebuilt. **The HUD now prints the build timestamp beside the FPS counter** —
check it before believing a bug report, including your own.

### 2. Fix the *save*, not just the code

A bug was reported three times. Twice it was "fixed" correctly and uselessly, because the bad
state was already **written into the player's save** and every reload restored it.

> **A code fix that requires the player to clear localStorage is not a fix.**

`repairStrandedBait` in `save.ts` is the pattern: detect the impossible shape on load and
repair it, narrowly. And write the test **from the save file inwards** — *this is the state
that was on screen, this is what loading it must produce* — not outward from the function you
suspect. Writing it the other way round is why it survived two fixes.

### 3. `document.hidden` suspends the ticker

Chrome stops `requestAnimationFrame` in a background or minimised window. The React HUD keeps
rendering and `window.__store` keeps answering, so the app looks alive while the simulation,
camera and every animation are frozen. Check `document.hidden` — **not** `hasFocus()`, a tab
can be focused and hidden at once. Bring the window forward; there is no code-side fix.

### 4. Screenshots: use `npm run shot`, not the browser extension

The extension capture silently clips the right ~7% of the viewport — exactly where the
CASH/DEVS/SHIPPED rail lives, so every screenshot taken for review was missing a readout.

```bash
WAIT=9000 npm run shot -- "http://localhost:5180/?act=act3_bait&nopost" out.png 1280 620
```

**`WAIT` matters.** §10.7's typewriter runs at 28 chars/sec and Act III's advisor line is
~150 characters, so a capture at 2.5 s shows half a sentence and reads exactly like clipped
copy. It is not. Give any screen with script on it ten seconds.

### 5. Generated values are equal by content, never by reference

§7.8.7 generates identities on demand, so `identityFor()` returns a fresh object every call.
Latching one the way every other panel latches its subject (`if (who !== held) setHeld(who)`)
is an infinite render loop that blanks the whole app. **Key off the seed, not the object** —
and the same mistake in a `useEffect` dependency fails *silently*.

### 6. Synthetic pointer events do not reach the canvas

Which is why `?select=4` exists, alongside `?overnight`, `?ad` and `?dialogue`. Add a seam
rather than fighting the automation; they have each paid for themselves.

---

## There is no CI, deliberately

`.github/` was **deleted**, not parked — everything a workflow would run is `npm run check`,
and the one check with no local equivalent (palette drift) now lives inside `art:check`.

Two hazards, both hit for real: pushing under `.github/workflows/` needs a token with
`workflow` scope, which this repo's Git Credential Manager token does not have and
`gh auth refresh` does **not** fix; and a committed workflow file rejects *every subsequent
push*, so the failure surfaces later on unrelated work.

**Revisit when a cloud agent first pushes code no human watched it write.**

---

## Running it

```bash
./start-dev.sh                 # the game, on a pinned port
npm run dev                    # same, if you want the raw vite output
npm run shot -- <url> <out>    # full-frame screenshot, no extension needed
npm run music:generate         # regenerate stems (needs .env)
```

The game is landscape-locked; a desktop window is the wrong shape to judge anything by.
**[LANDSCAPE.md](../LANDSCAPE.md)** has the DevTools presets — 997 × 448 @ dpr 2.25 is the
Pixel 8 Pro the §23.3 numbers refer to.

### Flags

| Flag | Effect |
|---|---|
| `?act=act2b_loop` | Jump the §21 script. Every phase name works |
| `?select=4` | §7.8.8 — select a developer without holding on one |
| `?bench` | §23.3 acceptance run. `?bench=10` shortens the 60 s leg |
| `?nopost` / `?post=bloom,crt` | Drop or select post-process passes |
| `?overnight` · `?ad` · `?dialogue` | Preview those surfaces |
| `window.__store` · `window.__stage` | Dev builds only — live game and camera state |

**The `?act=` seam pins the phase on every reload**, which is how a debug URL left in the
address bar can look like a stuck game. `?act=` and `?bench` are unguarded and would ship in
a web build — see §23.5 item 2. On device there is no query string.

---

## Local-only

- **ElevenLabs generation** needs `.env` (gitignored). SFX and music are committed.
- **Android build, install and the `?bench` device run** need the SDK and a phone.
- **Anything that has to be looked at.** A cloud session should take the logic-heavy work —
  Hero Cards, §18 events, the remaining Paradigm nodes — all data plus tested logic.
