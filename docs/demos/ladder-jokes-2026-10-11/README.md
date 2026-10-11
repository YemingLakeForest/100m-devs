# Ladder demo — the scene as the interface's own picture, and a voice for the monitor

*2026-10-11. This is on `main`. The two switches below stay so any frame can be compared with the daylight room and the old cut; they can go whenever that comparison is no longer wanted.*

Two things the user said, in order:

> "I was gunning for a infinite developer joke vibe [on the garage to galaxy scale], but it feels disconnected."
>
> "I want the art scene style to fit the UI style as much as we can, UI is a OS system."

## Look at it

```
npm install
npm run dev
```

Then, in a loopback browser (the debug flags are loopback-only; use `127.0.0.1` if you do not want to touch your
`localhost` save):

| What | Now | Before (the daylight rig, `?look=day`) |
|---|---|---|
| The garage at rest | `/?scenario=ten&z=0.1111` | same, `&look=day` |
| 100 developers: HQ and the first house | `/?scenario=squad` | `&look=day` |
| 1,000: the neighbourhood | `/?scenario=floor` | `&look=day` |
| The farthest 3D frame, then the monitor | `/?scenario=building&z=0.30`, then `&z=0.40` | `&look=day` |
| City at 10K and full at 100K | `/?scenario=building`, `/?scenario=campus` | (captions: see the strip) |
| Globe at 1M | `/?scenario=town` | |
| Network at 100M and 1B | `/?scenario=nation`, `/?scenario=starbound` | |
| A locked stop | `/?scenario=building`, press **Network** | (did nothing) |
| City to planet, as a flight | `/?scenario=campus&flight=0.25`, press **World**, then **City** | `&flight=off` (the old cut) |
| The wheel, aimed at a city | `/?scenario=metro`, wheel in over BERLIN | `&flight=off` |

`?look=day` is the 2026-10-07 daylight rig; it exists only so the two can be compared in one build, and goes
when one is chosen. The monitor captions have no `day` switch: their *before* is in the images.

The images here are the same frames, before beside after, and `index.html` lays them out (open it in a browser). Start with
`0-garage-to-galaxy-strip.jpg`; `11-city-to-globe-flight.webp` is the flight, moving.

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

**City to planet is a flight** (`src/sim/lensFlight.ts`, drawn in `render/studioAtlas.ts`; GDD §7.7.2 amended, pending adoption). The district
and the planet used to be two draw functions with a hard switch at lens level 4.5. The flight runs over the band 4.5–5.2, so every
lens ceiling still stops short of it and a studio that has not earned the planet never sees any of it. It is a match cut that is also a
dolly: the district falls toward the garage glyph, held at the focus the whole way; the planet rises behind it from 3× and turns to
face the city you came from; it lands exactly on the plain globe. The wheel scrubs it; a jump (the address bar, the dive button)
is a timed flight whose clock dwells in the band, because timed evenly the dive was a few frames at the end of a dull approach. A pull-in
aims at the top of the band, so pulling in over Berlin dives into Berlin. It is deliberately **not** a physical zoom: the planet's surface is
a per-pixel raster tied to its radius and the true ratio is about seventy to one. `?flight=off` restores the cut; `?flight=0.25` runs it at a quarter speed.

**A voice for the monitor** (`src/sim/monitorVoice.ts`; copy is not pinned, the rule is):
*deadpan, every number true, the instruction never goes.* One constant climbs the whole ladder, `1 APP`, with how
done it is from the network up. The bands are the scenario picker's own notes, shipped.

**The garage glyph** (`render/garageGlyph.ts`; GDD §7.8.12 named "the roll-up door's silhouette" as the one thing that
never changes, and nothing drew it): in the survey's HQ box, on Earth's HQ pin, inside Sol's ring. Nine pixels at every
scale, a lamp that stays on.

**Locked stops say their price** (`headcountToReach`, `lockNote`): pressing Network at 10K used to do nothing, silently;
it now says `NO SIGNAL · NEEDS 100 M DEVELOPERS, HAS 10.0 K`. The figure comes from the same table as the lens ceiling.

## Not done, and why

- Planet to network is still a cut (at level 6); the same flight would carry it. Garage to monitor stays the CRT wipe, by §1.0b.
- The CRT wipe still starts as a screen-wide sweep; starting it from the founder's own desk monitor would make
  "you zoomed into your dashboard" literal. It is a motion change, so it wants its own look.
- Arrival gags for the monitor stops (a district thud, a world dropped onto its lane).
- The grid's and brackets' ink is fixed cyan; the interface's hue follows Entropy and the ground should too.
- Phone performance of the added pass (one extra full-screen shader) is unmeasured.
