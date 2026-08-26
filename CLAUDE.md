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

`npm run check` is the gate: lint, `tsc -b`, vitest, `art:check`, the real-browser
frame gate (`test:ui-frame`) and the playthrough walk (`test:walk`). The last two
launch Chrome and take minutes — run them in the background rather than skipping
them, because they are the only two that catch layout and flow defects.
