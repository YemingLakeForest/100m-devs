# The Slack-Off Minigame — design and plan

**2026-08-26.** Amends GDD §7.8.6 and §7.8.9, adds §11 Branch D.

## What changed, and who overruled what

Two canon rules are reversed here on the user's instruction. Both reversals are
recorded in `GDD.html` in the same batch as the code, per `CLAUDE.md`.

1. **§7.8.6 rule 2 — "Nothing ambient ever changes the simulation. Not one
   Story Point, in either direction."** Reversed. A developer away from their
   desk now produces nothing.
2. **§7.8.9's blockquote — "Somebody mid-behaviour is still refused."**
   Reversed. Anybody can be picked up, walking or not. That refusal was the
   whole obstacle to the minigame the drag was supposed to be.

Rule 2 predicted its own failure mode: *"the player starts trying to prevent
water trips, and the game becomes about micro-managing forty walk cycles."*
That prediction is correct and is now the feature. What keeps it from being
the disaster the rule feared is that the away population is a **fraction of
headcount**, so the window in which a player can meaningfully drag people back
is the early and middle game, and §11's new Branch D is the exit from it.

**§7.8.9's joke survives, sign-flipped.** It used to be that herding eight
wanderers produced exactly zero extra Story Points — the manager who feels most
effective achieves least. Now herding works, and **fiddling costs you**: every
developer you pick up stops producing the moment you lift them, including one
who was working. The manager still cannot win by touching things. They fail a
different way.

§7.8.9 rule 1 (never a fail state, never a timer, **never a score**) and rule 2
(nothing is ever forced back, no "return all") both stand untouched. So does
rule 4 — the struggle is a rotation and a squash, not a ragdoll.

## Where the truth lives

**The simulation owns who is away. The renderer owns where their body is.**

The alternative — the renderer counting its own walkers and reporting a number
— was rejected because §7.8.6 rule 4 switches ambient life off above rung 2. An
economy that lives in the renderer is an economy the player deletes by zooming
out, and one that offline progress never sees.

| Layer | Owns |
|---|---|
| `sim/slackOff.ts` | Who is away, on what errand, in which phase, for how long. Pure. `dt` and `rng` are arguments. |
| `game/store.ts` | Holds the roster in run state, advances it in `tick`, subtracts away heads in `workingDevs()`. |
| `render/errands.ts` | Reads the roster. Picks which cooler, which whiteboard, which window. Walks bodies there. |
| `render/walkPath.ts` | Routes, in grid space. Pure and tested. |
| `render/stage.ts` | The drag. Calls store actions. |

**Sim owns time; the renderer owns space and fits into it.** An errand's travel
window is a nominal constant (`TRAVEL_SECONDS`), not a function of how far the
walk turned out to be — otherwise the sim would need the room's geometry, and
a headless tick would leave everybody stuck mid-corridor for ever. The renderer
walks at its own speed and stands still at whichever end it reaches first,
which is what the existing `walkPhase`'s flat middle already does.

## The away population

```
awayShare(entropy)  = 0.02 + 0.08 × e        // 2% calm, 10% at TOTAL GRIDLOCK
awayTarget(devs, e, focus) = devs × awayShare(e) × focus.slackShare
errandsPerSecond   = (awayTarget − awayNow) / MEAN_ERRAND_SECONDS
```

Expressed as a **duty cycle** rather than as a spawn rate, because the duty
cycle is the design claim — "at gridlock a tenth of the studio is not at its
desk" — and a spawn rate is a consequence of it. §7.8.9's own table asks for
roughly 5% across four idle states, rising with entropy; 2%→10% brackets that.

The roster is **not capped**. §7.8.6 rule 3's budget of twelve caps how many
are *drawn individually*, which is a rendering cost; the rest are numbers, and
numbers scale. This is the half that makes zoom-independence real: at a
thousand developers nobody is drawn and the ten per cent still bites.

Nobody is away below three developers — one person alone cannot be interrupted
and two cannot afford it.

## The errands

| Errand | Heads | Stands for | Needs | Reads as |
|---|---|---|---|---|
| `water` | 1 | 7s | cooler, coffee, fridge | The trip §7.8.6 already had |
| `whiteboard` | **2–3** | 20s | a whiteboard | Three people staring at a board achieving nothing |
| `window` | 1 | 14s | a window | Somebody looking at the weather |
| `sofa` | 1 | 26s | the sofa | The longest and most obvious |
| `loiter` | 1 | 18s | nothing | The fallback when crowding has taken the props |

`whiteboard` takes two or three heads because that is the joke — one person at
a whiteboard is thinking, three is a meeting nobody called.

`loiter` is the fallback and can never be bought away, which is what stops
Branch D from solving the game's own joke (§7.8.9 rule 2).

**Drive-bys stay free.** A drive-by is work, badly done — asking a colleague a
question — and §4.1's entropy already charges for it. The errand roster is
people who are *not working*. Chatter and small talk stay free for the same
reason and because they never leave the chair.

## Pathing — the floor has walkways

Rows run along `gy` at constant `gx`; the aisle is the `PITCH_ROW = 2.1` gap
behind each row. Squad corridors (`CORRIDOR_COLS/ROWS`) and the perimeter
(`FLOOR_AISLE_COLS/ROWS`) are the cross routes. So a route is **Manhattan in
grid space**, which in the isometric projection reads exactly as "along the
desks, or square to them, never through them":

1. Out of the chair backwards into the row's own aisle — `gx = (row + ½) × PITCH_ROW`.
2. Along that aisle in `gy` to the nearest cross corridor.
3. Along the corridor in `gx`.
4. Along the perimeter in `gy` to the destination.

`render/walkPath.ts` is pure and returns a waypoint list; `advanceAlong` walks
it at a constant `WALK_TILES_PER_SECOND` and hands back a position **and a
heading**, which the leg cycle and the facing both want. This replaces the
straight-line lerp that §7.8.6's own failure-mode list already flagged as
"walk cycles that clip through desks".

Speed goes up: the old trip was a fixed fraction of a 7-second behaviour
whatever the distance. Constant speed means a long walk takes longer, which is
both correct and the thing that makes the aisles legible.

## The drag

- `pickUp` refuses nobody. Walking, standing, talking, sitting: all liftable.
- **Carried developers struggle** — counter-rotation, a fast leg cycle, and
  protest lines from a new `STRUGGLE` band in `chatter.ts`.
- **Dropped on a desk** → seated, errand over, producing again.
- **Dropped anywhere else** → phase `back`. They walk home along the walkway,
  unhurried, **and produce nothing until they arrive**. No teleport.
- **Lifting a working developer** creates an errand in phase `back`. That is
  the "distract them" the request asks for, and it costs exactly what it looks
  like it should.

## James

Seat index 1 never enters the roster — `ctx.pinned`. Lift him and drop him off
his desk and he is back **instantly**: the entry is deleted rather than sent
walking. The one place a teleport is correct, because it is a character beat
rather than a shortcut. §21.7.0 rule 5's gym is untouched; ten to eleven he is
not on the floor at all, and that is not an errand.

## §11 Branch D — Focus

A fourth branch on the compass board, entering at ring 1 so Run 1 can buy in.
Each node **deletes a destination and cuts the share**, because a node that
removed the whiteboard without cutting the share would just send everybody to
the window instead. Zeroed rather than filtered, for the reason
`devStates.ts`'s `zeroTrust` already gives: the probability mass redistributes
instead of being re-rolled.

| Node | Costs | Effect |
|---|---|---|
| **D1 Focus Time Blocks** | 150 | −25% of the time spent away from desks |
| **D2 Desk Water Bottles** | 12k | Nobody walks to the cooler any more. −25% again |
| **D3 Whiteboards Removed** | 2M | The huddle has nowhere to stand. −30% again |
| **D4 Blackout Blinds** | 150M | There is no outside. −30% again |

Cumulatively ×0.276, and **it can never reach zero**, because `loiter` needs no
prop and cannot be deleted. Management's answer to slacking is to remove every
reason to stand up, one at a time, ending by bricking up the windows — and
people still stand up. That is the branch's joke and §7.8.9 rule 2's guarantee
in the same mechanism.

`TechEffects` gains `slackShare: number` and `slackBlocked: readonly Errand[]`.

## Windows

The garage has two UPVC casements on the brick wall. Above the unfold the
open-plan walls are plain fills with nothing in them. Window modules now run
along the back-left wall at office scale, with a standing spot on the floor in
front of each — so the `window` errand has somewhere to go and the floor has an
outside.

## What gets tested

- `slackOff.test.ts` — the share rises with entropy; the away count converges
  on `awayTarget`; Branch D lowers it; a blocked errand is never chosen; the
  seat in `pinned` is never drawn; away heads never exceed headcount; seats
  past a shrunken roster are culled.
- `walkPath.test.ts` — **no leg of a route passes through a desk cell**; every
  leg is axis-aligned in grid space; a route leaves the desk backwards into its
  own aisle first.
- `store` — `workingDevs()` falls by the away count and recovers on seating;
  lifting a working developer costs output until they get home; James is never
  away.
- `techTree.test.ts` — Branch D chains, and `techEffects` folds it.
- `render/ambient.test.ts` — the rule-2 assertions are rewritten. That rewrite
  is the visible sign the canon moved.

**Tests pin the claim, not the value** (§25.3.2): the numbers above are a first
pass and the tests assert the *order* — that gridlock is worse than calm, that
each Branch D node is a strict improvement on the last.
