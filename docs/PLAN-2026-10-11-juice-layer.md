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

## Slice B as built (2026-10-12)

- **The gap above is closed.** `cityHouses` built each building with `{ ...model }`, and `model.interior` is a lazy getter, so the spread froze it at `null` and `codingSeats`, `hop`, `headOf` and `pick` never saw an open house. Driven at 100 devs: 5 seats before, 105 after, with numerals over the house's workers. The garage's coding-seat gate also moved from 10 to 8 ppm to match the cutaway's own hysteresis.
- **Packets** (`three/render/flow.ts`, pure budget in `sim/juice.ts`: `packetSpec`, `backlogLevel`). One instanced mesh, 48 alive and 24 launched a second at most, six hard hops, palette amber (`OS.warm`; the lamp colour bloomed into a halo on the glass, which is a gradient light box). Sinks: the project board in the garage, the front door of an open house.
- **Heads or sink?** Decided: up to twelve visible people keep the numeral over their head (the tutorial); past twelve the numeral is said at the sink on arrival (`passiveWork.arrive`, one a beat per sink, summed). Doing both would count the same work twice. GDD §8.2a amended.
- **Not built:** the backlog heap (`backlogLevel` is written and tested, nothing draws it); the arrival numeral when no house is cut open; a live drive at 1,000 devs (the `floor` scenario starts with a full queue, so the rate is correctly 0; the cap is covered by tests only); a frame-rate A/B.

## Slice B finished and slice C as built (2026-10-12)

- **Backlog heap** (B, move 1): story points left stand as up to four pale-blue crates by the garage's project board and on each house's porch (`flow.ts`, `backlogLevel`), draining as work lands. Placed beside the sink rather than "at the source": a heap among the desks is hidden by the people and, in a house, by the near wall; beside the in-tray it is where the eye already is. Driven at 100 devs, at 10, and at 1,000 (`?scenario=floor`, with the queue emptied from the page through `__store.shelf` because it fills in three seconds): packets converge, `+20 +10` lands at the door, the heap stands at 54,115 points left.
- **Cost:** `flow.update` is 5.7 µs a frame with ten open houses (0.03% of a 60 FPS frame); at most 12 packets were alive at 1,000 devs' rate against a budget of 48. The headless HUD frame rate was too noisy to separate flow from no flow, so the claim is the microbench's, not a frame-rate A/B. **Not measured on the user's laptop.**
- **Move 3, flash the unit:** a finished build (`state.shelf` grows) steps the HQ lot and every house's footprint through white, light amber, amber for 270 ms (`unitFlash`, `unitFlash.ts`): flat ground slabs, no glow. Driven: one frame of white slab round both lots. "The unit the lens shows at that zoom" was reduced to "every lot": a project is studio-wide, so a house is not flashed alone.
- **Move 4, throughput bed:** `sim/throughputAudio.ts` (bed level in decades, clicks thinning 5 to 1 a second, +9 dB pulled out, a voice budget of four) and `audio/throughputBed.ts` (brown noise through a low-pass, Web Audio). GDD §20.5a. **Never auditioned.** The dip, swell and cut before a milestone were left to move 6 and were not built: move 6 as built holds the number, not the sound.
- **Move 6, the held breath:** the DEVS counter holds one short of a decade for 2.4 s, rolls in eight hard steps, then the camera returns to the founder's desk (`heldBreath.ts`, `useHeldCount.ts`, `Readouts.tsx`, `stage.ts`). The headcount milestone was the handoff's likely default and is the one chosen. Driven: 999 for about 2.5 s, then 1.0 K. In the abbreviated form the roll's steps read the same, so the odometer is not legible where it was meant to be.
- **Not done:** the dip-swell-cut in sound; an odometer on an unabbreviated figure; a frame-rate A/B on real hardware; hearing any of the audio.
- **`test:ui-frame` is flaky**, not caused by this slice as far as can be told: four runs on essentially the same code, two failed on different tiny-viewport HUD screens (915x412 and 748x336), two passed all 126.

## Next

Slice B: feed the houses to passive work, then move 1. Slice C: moves 3, 4, 6, with GDD §20 amended for the bed. Each slice is judged by driving the game at 1, 100 and 1,000 developers and saying what was seen; `npm run check` is the gate.
