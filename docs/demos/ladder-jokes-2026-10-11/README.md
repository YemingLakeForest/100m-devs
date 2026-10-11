# Ladder demo — the scene as the interface's own picture, and a voice for the monitor

*2026-10-11, branch `demo/ladder-jokes`. A demo, not a decision: nothing here is on `main`, nothing is pushed.*

Two things the user said, in order:

> "I was gunning for a infinite developer joke vibe [on the garage to galaxy scale], but it feels disconnected."
>
> "I want the art scene style to fit the UI style as much as we can, UI is a OS system."

## Look at it

```
git checkout demo/ladder-jokes
npm install
npm run dev
```

Then, in a loopback browser (the debug flags are loopback-only; use `127.0.0.1` if you do not want to touch your
`localhost` save):

| What | After (this branch) | Before (`main`'s daylight rig) |
|---|---|---|
| The garage at rest | `/?scenario=ten&z=0.1111` | same, `&look=day` |
| 100 developers: HQ and the first house | `/?scenario=squad` | `&look=day` |
| 1,000: the neighbourhood | `/?scenario=floor` | `&look=day` |
| The farthest 3D frame, then the monitor | `/?scenario=building&z=0.30`, then `&z=0.40` | `&look=day` |
| City at 10K and full at 100K | `/?scenario=building`, `/?scenario=campus` | (captions: see the strip) |
| Globe at 1M | `/?scenario=town` | |
| Network at 100M and 1B | `/?scenario=nation`, `/?scenario=starbound` | |
| A locked stop | `/?scenario=building`, press **Network** | (did nothing) |

`?look=day` is the 2026-10-07 daylight rig; it exists only so the two can be compared in one build, and goes
when one is chosen. The monitor captions have no `day` switch: their *before* is in the images.

The `*.jpg` here are the same frames, before beside after. Start with `0-garage-to-galaxy-strip.jpg`.

## What changed

**The room, as the interface's own picture** (`src/three/art/skin.ts` `NIGHT`, `render/osPass.ts`, `render/osDesktop.ts`):

- *Light.* The dark room lit by its own screens (§7.8.0c's original brief) in the UI's ramps, instead of noon sun
  behind a dark glass. Cool teal, not purple (2026-09-28). The key keeps its direction, so form still reads.
- *Edges.* One-pixel phosphor rules where the picture changes brightness sharply: the interface draws in rules and
  the room now has the same seams. A floor under the threshold keeps paving grain out.
- *Ground.* The horizon is the survey's own void, measured to match it (`#181818` in the room, `#191a1a` at the globe),
  with a dot grid at the street's pitch; every lot, and the HQ's, wears the survey frame's corner bracket.
- The day-to-night jump at the hand-off is gone: the neighbourhood above the monitor is now the same night as the
  monitor.

**A voice for the monitor** (`src/sim/monitorVoice.ts`; copy is not pinned, the rule is):
*deadpan, every number true, the instruction never goes.* One constant climbs the whole ladder, `1 APP`, with how
done it is from the network up. The bands are the scenario picker's own notes, shipped.

**The garage glyph** (`render/garageGlyph.ts`; GDD §7.8.12 named "the roll-up door's silhouette" as the one thing that
never changes, and nothing drew it): in the survey's HQ box, on Earth's HQ pin, inside Sol's ring. Nine pixels at every
scale, a lamp that stays on.

**Locked stops say their price** (`headcountToReach`, `lockNote`): pressing Network at 10K used to do nothing, silently;
it now says `NO SIGNAL · NEEDS 100 M DEVELOPERS, HAS 10.0 K`. The figure comes from the same table as the lens ceiling.

## Not done, and why

- The CRT wipe still starts as a screen-wide sweep; starting it from the founder's own desk monitor would make
  "you zoomed into your dashboard" literal. It is a motion change, so it wants its own look.
- Arrival gags for the monitor stops (a district thud, a world dropped onto its lane).
- The grid's and brackets' ink is fixed cyan; the interface's hue follows Entropy and the ground should too.
- Phone performance of the added pass (one extra full-screen shader) is unmeasured.
