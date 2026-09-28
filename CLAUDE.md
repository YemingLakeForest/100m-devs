# 100,000,000 Developers — working agreements

## The GDD is canon, and the user outranks it

`GDD.html` is the sole canonical design document (see `git log` — "make GDD HTML
the sole canonical source"). Code cites it by section number, and those citations
are load-bearing: they are how a decision made once stops being re-argued.

**When an instruction from the user contradicts the GDD:**

1. **Say so, briefly.** Name the section and quote the line it disagrees with —
   one or two sentences, in the reply, not a paragraph of hedging.
2. **Do it the user's way anyway.** The latest instruction is canonical. Do not
   ask for permission, do not implement the GDD's version instead, and do not
   implement both.
3. **Update `GDD.html` in the same batch.** The document has to end the batch
   agreeing with the code. Amend the section that was wrong rather than
   appending a contradicting one, mark it `[CANON - added YYYY-MM-DD]` or
   `[amended YYYY-MM-DD]` in the house style already used throughout the file,
   and keep the argument for *why* — the GDD's whole value is that it records
   reasoning, not just outcomes.

A silent divergence is the failure mode to avoid in both directions: code that
quietly stops matching the document, and a document quietly rewritten without the
user being told what moved.

`GDD.html` is UTF-8 and hand-edited. Patch it with a script rather than by hand
where the edit is more than a line, and re-read the region afterwards — a Windows
console will mis-render `§` and `—` even when the file is correct.

## House style

- **Comments explain the argument, not the mechanics.** The codebase's standing
  register: say why a number is that number, what was tried and rejected, and
  which section it answers. Match the density of the file being edited.
- **`sim/` is pure.** No store, no clock, no renderer, no React. Anything that
  needs game state takes it as an argument. `game/` may not import `render/`.
- **Tests pin the claim, not the value.** Where the GDD fixes an *order* and
  refuses to fix the numbers (§25.3.2), test the order.
- **Debug seams go through `dev/debugAccess.ts`.** Loopback browser sessions
  only; deployed HTML and Capacitor-native Android must not reach them.

## Before saying it works

`npm run check` is the gate: lint, `tsc -b`, vitest, `art:check` and the
real-browser frame gate (`test:ui-frame`). The last one launches Chrome and
takes minutes — run it in the background rather than skipping it, and do not
touch the working tree while it runs (it serves the tree through Vite, so an
edit or a `git stash` mid-run is measured as if it were the game).

**The playthrough walk (`test:walk`) is deleted — 2026-09-26, at the user's
instruction:** *"Delete the walk gate, no point now. Game is changing so
quickly."* It played Acts I–V and the first heroes of Run 2 with a mouse, and
every mechanic ported from the rebuild (the pipeline and the release ring in
the batch that deleted it) meant rewriting how it played rather than learning
anything about the game. Nothing now plays the game end to end automatically:
a claim that a flow works is made by driving it in the browser and saying what
was driven.

**The room geometry gate (`test:room`) is deleted — 2026-09-26, at the user's
instruction:** *"Delete room gate, that changes all the time and useless."* It
measured the Pixi room's walls and seats as drawn, and the room it measured is
being replaced by the three.js garage and office; both of its reds in the batch
that brought the 3D garage in were the gate aiming at the hidden Pixi room, not
a defect anybody could see. Nothing now checks room geometry automatically, so
a claim about walls, seats or clearance (禁止穿模) is made by looking at the
game and saying what was looked at.

**Gates that guard the old Pixi scenes are deleted as they are met — 2026-09-28,
at the user's instruction:** *"if there are any gates protecting old pixi
scenes, remove them on the go to save time"*, then *"continue to remove the old
pixi gates"*. The Pixi ladder — the room past twenty, the office unfold, the
building, block, district, park, globe and star field — is being replaced by
three.js (`docs/PLAN-2026-09-27-garage-to-galaxy.md`, phases 3–8), and a check
on how one of those pictures is drawn is a check on something scheduled for
deletion. Gone in the batch that wrote this: `test:ui-frame`'s block-at-100K
and park-at-1M passes (the first of them had just gone red on a Pixi frame),
the `src/render/` suites for the Pixi scenes (room, garage, office, floorplan,
shell, plaza, walk paths, errands, ambient, bubbles, tallies, the move out of
the garage, collapse, building, district, park, globe, world map, frames, lens
and the preview renders), and the Pixi figure's turn in `game/selection.test.ts`.
What stays is everything that is not a Pixi picture: the HUD, the 3D garage
(`src/three/`), `sim/`, input handling (`render/navigation.ts`) and the music's
zoom bands (`render/omniLens.ts`). Later the same day the Pixi stage itself
was decommissioned (GDD §7.4a, amended 2026-09-28): there is no Pixi scene left
to guard, and the game is three.js from the garage up.
