# 100000000 Developers

An isometric pixel-art idle/incremental game for mobile, about taking *The Mythical
Man-Month* and turning it on its head: adding developers to a project **always** speeds it
up linearly — provided you can survive the catastrophic Communication Entropy.

You start alone in a home garage writing a Flappy Bird clone. You end shipping simulated
multiverses at one project per Planck time.

**Status:** **Run 1 — The Trap is playable end to end**, and the Omni-Lens now runs
**seven levels** — desk, squad, floor, building, block, park, **globe** — from one developer to
**100,000,000 on a hundred sites of a planet**, which is the number on the box. Poke, hire James, ship *Flappy
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
npm run check          # everything: lint + types + tests + the art gate + two browser gates
npm run test:ui-frame  # geometry, at five landscape frames
npm run test:walk      # §26.1.8's list, played with a mouse (~quarter of an hour)
```

Three gates, and they divide the work: `vitest` owns *does it compute the right number*,
`test:ui-frame` owns *is it drawn correctly*, and `test:walk` owns *can a player get to it*.

Useful while working on the render stack:

| URL | Effect |
|---|---|
| `?nopost` | Drop the post-process entirely — isolates scene cost from filter cost |
| `?post=bloom,crt` | Attach only the named passes (`tilt`, `zoom`, `bloom`, `rgb`, `crt`) |
| `?bench` | Run the ADR §7.5 acceptance sequence and print a pass/fail table. `?bench=10` shortens the 60s sustained-tap leg. |
| `?act=act5_bleeding` | Jump the §21 script. Run 1 is paced to take ~4 minutes by design, which is right for a player and unworkable for iterating on Act V's copy. |
| `?scenarios` | The dev bar: a decade per button, **a box that takes any exact headcount**, and a logarithmic `BATCH` dial that adds 1–100M developers through the real hire/arrival path. The lens follows the resulting rung; `DEVS / RUNG / VIEW / SITES` confirm it. `npm run scenarios` opens it. |
| `?devs=250000` | The same headcount, from the URL, without the script retired or the money in the bank |
| `?speed=40` | Run N simulation ticks per frame — the clock and nothing else. Whole ticks, so it is the same simulation N times over rather than a bigger step. What makes `test:walk` finish. |

On a phone, and on the web:

```bash
./deploy.sh --launch   # build the snapshot APK, install it over Wi-Fi ADB, start it
npm run art:icon       # regenerate the (temporary) launcher icon
```

The web build ships to **https://100mdevs.mercilessstudio.com** from GitHub
Actions on every push to `main`. Both, and how a landscape-locked game is framed
in a browser window that is any shape at all, are in
[`docs/DEPLOY.md`](./docs/DEPLOY.md).

## Documents

| Document | Contents |
|---|---|
| [`GDD.md`](./GDD.md) | Full game design document — core loop, Communication Entropy engine, the Omni-Lens zoom architecture, upgrade and three-layer prestige trees with full mathematics, endgame, events, dialogue, audio spec, and onboarding script. **§26 is the build order** — three phases with a closing gate on each. Read it before starting work. |
| [`MONETISATION.md`](./MONETISATION.md) | Revenue model, eCPM assumptions, IAP catalogue and prices, subscription design, launch phasing, metrics. **Where each offer *attaches to the loop* is GDD §3.1**, next to the loop it constrains. |
| [`docs/DEPLOY.md`](./docs/DEPLOY.md) | Getting it onto a phone and onto the web — `deploy.sh`, the Cloudflare Pages pipeline, and how the landscape lock survives a browser window. |
| [`docs/HANDOFF.md`](./docs/HANDOFF.md) | **Start here.** Current state, the decisions waiting on a human, and what to build next. The current one is [`HANDOFF-2026-08-24.md`](./docs/HANDOFF-2026-08-24.md). |
| [`docs/PROJECT_SETUP.md`](./docs/PROJECT_SETUP.md) | Runbook from empty repo to first build — identity, toolchain, dependencies, accounts, costs, and the setup order. |
| [`docs/ART_DIRECTION.md`](./docs/ART_DIRECTION.md) | Palette, type, the two-register look, how each asset tier is produced, the build-step quantiser, and the acceptance checklist every asset must pass. |
| [`docs/adr/`](./docs/adr) | Architecture decisions. [ADR 0001](./docs/adr/0001-engine-and-rendering-stack.md) picks the engine and defines the feel spike that must pass before it is final. |
| [`docs/demos/`](./docs/demos) | Runnable design demos — open the `.html` in a browser. [`jigsaw-planet.html`](./docs/demos/jigsaw-planet.html) is the proposed rung 6: a spinnable globe cut into 100 equal-area tetromino territories, computed live rather than drawn. |
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
