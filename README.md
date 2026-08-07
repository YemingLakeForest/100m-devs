# 100000000 Developers

An isometric pixel-art idle/incremental game for mobile, about taking *The Mythical
Man-Month* and turning it on its head: adding developers to a project **always** speeds it
up linearly — provided you can survive the catastrophic Communication Entropy.

You start alone in a bedroom writing a Flappy Bird clone. You end shipping simulated
multiverses at one project per Planck time.

**Status:** **Run 1 — The Trap is playable end to end.** Poke, hire James, ship *Flappy
Square*, take the mass-hire bait, watch the studio seize at 99.999% entropy, and go
bankrupt in about twenty seconds. Every number in that sequence is produced by the §4
simulation rather than scripted.

**ADR 0001 is accepted.** The feel spike passed on device — tap-to-numeral at 7–10 ms
against an 80 ms budget, and criterion 7, the subjective gate, cleared by a person who had
not seen the game and kept tapping. The stack is settled; work proceeds to the vertical
slice.

## Running it

```bash
npm install
npm run dev            # http://localhost:5176
npm test               # simulation + art system
npm run art:check      # the ART_DIRECTION §5 palette gate
```

Useful while working on the render stack:

| URL | Effect |
|---|---|
| `?nopost` | Drop the post-process entirely — isolates scene cost from filter cost |
| `?post=bloom,crt` | Attach only the named passes (`tilt`, `zoom`, `bloom`, `rgb`, `crt`) |
| `?bench` | Run the ADR §7.5 acceptance sequence and print a pass/fail table. `?bench=10` shortens the 60s sustained-tap leg. |
| `?act=act5_bleeding` | Jump the §21 script. Run 1 is paced to take ~4 minutes by design, which is right for a player and unworkable for iterating on Act V's copy. |

Android:

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```

## Documents

| Document | Contents |
|---|---|
| [`GDD.md`](./GDD.md) | Full game design document — core loop, Communication Entropy engine, the Omni-Lens zoom architecture, upgrade and three-layer prestige trees with full mathematics, endgame, events, dialogue, audio spec, and onboarding script. |
| [`MONETISATION.md`](./MONETISATION.md) | Revenue model, rewarded-ad placements, IAP catalogue, subscription design, launch phasing, and the guardrails protecting the Early Game Trap. |
| [`docs/HANDOFF.md`](./docs/HANDOFF.md) | **Start here.** Current state, the one decision waiting on a human, and what to build next. |
| [`docs/PROJECT_SETUP.md`](./docs/PROJECT_SETUP.md) | Runbook from empty repo to first build — identity, toolchain, dependencies, accounts, costs, and the setup order. |
| [`docs/ART_DIRECTION.md`](./docs/ART_DIRECTION.md) | Palette, type, the two-register look, how each asset tier is produced, the build-step quantiser, and the acceptance checklist every asset must pass. |
| [`docs/adr/`](./docs/adr) | Architecture decisions. [ADR 0001](./docs/adr/0001-engine-and-rendering-stack.md) picks the engine and defines the feel spike that must pass before it is final. |
| [`assets/concept/`](./assets/concept) | Concept art and UI sketches. |

## The pitch, in one loop

```
[Hire Dev Swarm] → [Communication Entropy Spikes] → [Poke Devs for Story Points]
                 → [Burn Down the Sprint] → [Upgrade Comm Tech] → [Ship Game] → (repeat)
```

Hiring 1,000 developers on your first run will bankrupt you in sixty seconds. That is the
tutorial.

## Three layers of play

- **Active** — poke developers to squeeze out Story Points. Every poke also adds Entropy,
  so tapping harder makes everything slower. That is the whole game, in one thumb.
- **Idle** — the swarm produces while you're away. Hire, upgrade, ship, prestige.
- **Meta** — collect and place Hero Cards on your org chart, and grind toward the number on
  the box: **100,000,000 simultaneous developers at 100% efficiency.**

James was your second hire. He wears a white shirt with a hole in the elbow, and by the
time he's Legendary the shirt is wreathed in cosmic light and the hole is still there.
