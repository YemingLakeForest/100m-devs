# The juice layer, studied from 1 Million Books — plan and slice A

**Date:** 2026-10-11
**Source:** the user's reference game, studied from its trailer (99 s, 1080p30: frames at 15 fps, native-resolution crops, a spectrogram and a loudness curve of the audio). The trailer is edited with jump cuts and a music bed, so the sound after ~38 s cannot be read as game audio; the *shape* of it can.
**The user's instruction:** *"remember it should fit the game style, I dont like gradient light boxes."* Everything below is flat, hard-edged and stepped. See `ART_DIRECTION.md` §3 (hard 1px rules, no bevels, no drop shadows, no baked gradients) and the `steps(n, end)` motion in `src/styles/`.

## What the reference does

- One placement is six beats in ~600 ms: a held-count tag on a spring, a ghost slot grid on the matching shelf, the book in flight, a snap to solid spines, a `+1` *at the slot*, and a progress bar whose new segment arrives white-hot and cools (still cooling when the capture ended, so ≥ 270 ms).
- Automation is visible as flow: the floor pile lifts into a ribbon to the shelf, one `+1` per arrival.
- The unit of juice changes with scale: `+1` → ribbons → a gold rectangle flooding a whole block → one aggregated numeral per sweep. It never shows thousands of small numbers.
- Sound goes from sparse clicks to one continuous bed (about +9 dB at the zoom-out), with a dip before the finale, a swell, and a hard cut.
- The payoff is withheld: the counter holds at 999 999 for ~11 s of quiet travel, then the last digits roll.

## The six moves

| # | Move | Status |
|---|------|--------|
| 1 | Flow to a sink (instanced packets, a backlog pile that drains) | open — slice B |
| 2 | Numerals that know the scale | **built, slice A** (below) |
| 3 | Flash the unit, not the person | open — slice C |
| 4 | Throughput bed with a voice budget | open — slice C |
| 5 | Hot-edge fills | **built, slice A** (below) |
| 6 | The held breath (odometer, back to the garage desk) | open — slice C |

## Slice A, as built

All of the logic that can be pure is in `src/sim/juice.ts`, test-first (`juice.test.ts`); tests pin claims, not values.

- **Numerals add up.** `assignStreams` — past 12 people, workers share streams and each stream's numeral carries the sum, rising over each member in turn. Before, a hundred visible workers showed 61% of what they made (measured by the failing test) and a thousand a few percent. `passiveWork.ts` uses it; the pool is the same 24 it always was, only what each numeral says changed.
- **Numeral size steps with magnitude.** `numeralSize` — two pixels per decade of yield, at most six. A crit is bigger by kind (`numeralFace` in `pokeText.ts`).
- **The pop.** `popScale` — three hard sizes, small / big / rest, 110 ms; nothing under reduced motion. Bottom-anchored so the glyph steps from a fixed foot; layout uses the settled size.
- **The hot edge.** `useHotSegments` + `graph.css` — on the rail's QUEUE slots (on screen all game) white → the amber ramp's top → amber (`gl-hot-slot`); in the queue window the CODE bar's segments, also two pixels taller for two steps (`gl-hot`). Flat palette colours only, `steps(1, end)` per keyframe so nothing is ever a blend.

## Decisions and what was dropped

- **Short forms stay.** The plan said "set thousands with a thin space" (the reference shows `+14 631`). Dropped: GDD §8.2 specifies `+1.2M`, the HUD's own `formatCount` abbreviates from 1,000, and a thin space risks a fallback glyph in Departure Mono, which would break the one-face rule.
- **White is `--n8`.** The lit CODE segment was already `--p3`, the lightest phosphor, so "arrive lighter" had nowhere to go; the neutral ramp's top is the only white the palette has.
- **GDD amended** (§8.2a, §10.8a, 2026-10-11): §8.2a anchored feedback to the developer's head, and a stream's numeral rises over each member in turn, so it is still anchored to a head but speaks for several.

## Known gap, found while verifying

**House workers never reach passive work.** `garageView.codingSeats()` returns the garage's seats plus `city.codingSeats()`, and inside a 100-developer house the stage still saw 5 seats and 0 people on screen. So streams (move 2) are correct and tested but dormant in the 3D game until houses are fed — which is the same job as move 1, and is the first thing in slice B.

## Next

Slice B: feed the houses to passive work, then move 1. Slice C: moves 3, 4, 6, with GDD §20 amended for the bed. Each slice is judged by driving the game at 1, 100 and 1,000 developers and saying what was seen; `npm run check` is the gate.
