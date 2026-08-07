# 100000000 Developers

**Game Design Document — consolidated v3.0**

> An isometric pixel-art idle/incremental game about taking *The Mythical Man-Month*,
> turning it upside down, and riding it all the way to the heat death of physics.

**Companion documents:** [`MONETISATION.md`](./MONETISATION.md) — revenue model, ad
placements, IAP catalogue, and the design guardrails that protect the Early Game Trap.

---

## 0. Document Control

### 0.1 About this document

This GDD consolidates **three successive design drafts** plus **nine specification
expansions** into a single canonical document. Nothing from the earlier drafts has been
dropped: where a later draft revised earlier material, the later version is canon in the
main body and the earlier version is preserved verbatim in **Appendix A**.

### 0.2 Version lineage

| Version | Draft title | What changed |
|---|---|---|
| **v0** | *Extreme Game Dev Idle Game Concept* | Original premise, working titles, dev tiers, Ship It! button, "Tech Stack Rewrite" prestige, first random-event batch |
| **v0.5** | *Fractal Zoom & Communication Entropy* | Communication Entropy becomes the core mechanic; fractal zoom; T1–T6 comm tech; "Protocol Paradigm Shift" prestige replaces Tech Stack Rewrite |
| **v1.0** | *GAME DESIGN DOCUMENT: PROJECT SWARM DEV* | First formal GDD; Omni-Lens 4-level zoom; entropy equation; sound/polish |
| **v2.0** | *GAME DESIGN DOCUMENT: 100000000 DEVELOPERS* | Title locked; game juice & camera blur; poke states; Early Game Trap; 3-branch tech tree; Infinite Multiverse endgame |
| **v3.0** | *GAME DESIGN DOCUMENT: 100000000 DEVELOPERS (v3.0)* | Planck-time endgame barrier; Agile→AI-Slop satirical tech tree; multi-layer prestige |
| **v3.0+** | Nine expansion specs | Deep upgrade/prestige architecture, prestige math, full node index, prestige UI wireframes, multiverse dimension themes, dimension random events, Layer-2 math, Desk Query dialogue library, onboarding narrative script |

### 0.2a This document is self-sufficient — **added 2026-08-07**

**Everything needed to build the game is in here.** Technical decisions that were taken as
Architecture Decision Records — the engine and rendering stack, the performance budget,
screen orientation, and the constraints and gotchas found while proving them — are folded
into **§23**, which is canon.

`docs/adr/0001` and `docs/adr/0002` remain in the repository as **history**. They record how
those decisions were reached, what was rejected and why, and what the evidence was. Read them
once for context; **do not consult them to build.** Where §23 and an ADR appear to disagree,
§23 is right and the ADR is a snapshot.

**No further ADRs will be written.** Decisions of that weight land in §23, with the reasoning
attached, so that this document does not become an index into a pile of others.

### 0.3 Status legend

- **[CANON]** — current design intent.
- **[LEGACY]** — superseded, preserved for reference (see Appendix A).
- **[CONFLICT]** — two drafts specify different numbers for the same value; both are
  recorded and the discrepancy is listed in **Appendix C** for a balance pass.
- **[EDITORIAL]** — added while assembling this document; not present in the drafts.

**Before treating this document as complete, read [Appendix F](#appendix-f--shipping-readiness-register).**
It is the register of what is *specified nowhere* — audited rather than remembered, because
the §10.9 title screen was found missing only when somebody happened to ask about it.

---

## 1. Executive Summary

| Field | Value |
|---|---|
| **Title** | *100000000 Developers* |
| **Genre** | Isometric Pixel-Art Idle / Incremental Clicker |
| **Platform** | Mobile (iOS / Android) |
| **Core Premise** | A satirical take on *The Mythical Man-Month*. Adding developers to a software project **always** speeds it up linearly — **provided you can survive the catastrophic Communication Entropy.** |
| **Core Philosophy** | High "game juice" tactile feedback combined with a deliberate progression puzzle. Player intuition (hire as many devs as possible) is *actively punished* until they learn to balance the Communication Entropy Engine. |
| **Visual Hook** | Seamless "Omni-Lens" pixel-art zoom extending from a single developer's desk all the way out to an Inter-Galactic Developer Network. |
| **Active Layer** | A clicker layer — **poke developers to squeeze out Story Points**, the unit all project progress is denominated in (§4.4). |
| **Collectables** | **Hero Cards** — a tight roster of named, placeable developer cards with board-wide effects (§22). |
| **The Gate / Victory Condition** | **100,000,000 active developers at 100% efficiency**, shipping one project at that headcount. The title gate: it ends the main story arc and unlocks the Layer 2 Codebase Fork (§13.5). |
| **Endgame Hook** | Scaling dev swarms to the theoretical limit of physical reality — shipping entire simulated multiverses at **1 project per Planck Time** ($t_P \approx 5.39 \times 10^{-44}$ s). |

The central tension of the entire game is **Manpower ($M$) vs. Entropy ($E$)** — and the
clicker layer restates that exact tension at the scale of a single tap: **every poke
extracts Story Points and adds Entropy.**

**The three layers of play:**

| Layer | What the player is doing | Timescale |
|---|---|---|
| **Active (clicker)** | Poking devs for Story Points, clearing pings, slicing meetings | Seconds |
| **Idle (incremental)** | The swarm produces passively; hire, upgrade, ship, prestige | Minutes to hours |
| **Meta (collection)** | Earning and placing Hero Cards; three prestige layers | Days to months |

---

## 2. Premise & Narrative

You start as a solo indie developer in a messy bedroom trying to make a simple Flappy Bird
clone. It takes 3 months. To speed things up, you hire a buddy. Then ten. Then you realize
logic doesn't apply to your studio: **adding more people always reduces development time
linearly, with zero diminishing returns.**

Before long you're hiring entire nation-states of coders, opening office complexes on
Jupiter, and assembling quantum dev swarms to release AAA VR holodeck titles in
**0.000004 milliseconds**.

The joke has a second half, and it is the actual game: the *only* thing that stops you is
that people have to **talk to each other**. Every developer you add generates
communication overhead. The game is a satirical history of software engineering process —
from shouting across desks, through Agile ritual, corporate bureaucracy, and AI slop, to
quantum telepathy — all deployed as increasingly desperate weapons against your own
headcount.

---

## 3. Core Gameplay Loop

```
[Hire Dev Swarm] → [Communication Entropy Spikes] → [Poke Devs for Story Points]
                 → [Burn Down the Sprint] → [Upgrade Comm Tech] → [Ship Game] → (repeat)
```

1. **Hire Mass Devs** — tap to flood the workspace with hundreds to billions of developers.
2. **Manage Entropy** — communication overhead slows production down exponentially unless mitigated.
3. **Poke for Story Points** — tap individual developers to squeeze **Story Points (SP)** out of them. SP is the unit every project's progress is measured in, so the clicker layer feeds the same meter the idle swarm does (§4.4).
4. **Active Intervention** — poke sleepy/distracted devs, slice through unproductive meetings, and tap `@everyone` notification storms.
5. **Upgrade Infrastructure** — invest in communication tech (from shouting across desks to Neural Sync and Interstellar Relays).
6. **Ship & Scale** — burn the sprint down to zero, publish AAA titles in milliseconds, collect trillions, and expand across planets and galaxies.

**The active/idle contract:** the swarm produces SP whether you are watching or not. Poking
produces SP *faster* but adds Entropy, which slows the swarm. Active play is therefore a
short-term overdraft against your passive rate — never a replacement for it.

---

## 4. The Production Engine: Story Points & Communication Entropy

This is the core system. Everything else in the game feeds it or fights it. It has two
halves that must be read together:

- **§4.1–4.3 — Communication Entropy**, the tax on all production.
- **§4.4–4.9 — Story Points**, the thing being produced, and the clicker layer that
  extracts them by hand.

### 4.1 Entropy Efficiency Equation **[CANON]**

The general statement, unchanged from the first pass:

$$\text{Effective Speed} = \text{Total Devs} \times \text{Efficiency factor}$$

…where the **Efficiency factor decays as the workforce outgrows your Communication
Infrastructure.**

The canonical form is a **load curve**. Let $L$ be the studio's *communication load* — the
ratio of headcount to the capacity your comm tech can actually sustain:

$$L = \frac{D}{D_{cap}} \qquad\qquad \eta(L) = \frac{1}{1 + L^{\rho}} \qquad\qquad E = 1 - \eta$$

$$\boxed{\ \text{Effective Speed} = D \cdot \eta = \frac{D}{1 + \left(\frac{D}{D_{cap}}\right)^{\rho}}\ }$$

Plain form: `efficiency = 1 / (1 + (devs / dev_cap) ** RHO)`

| Parameter | Value | Purpose |
|---|---|---|
| **Overhead Exponent ($\rho$)** | **5** | How violently the studio collapses past capacity. The single most important tuning knob in the game. |

**Why this shape.** It is the only form that satisfies all four things the design demands
at once:

| Requirement | Behaviour |
|---|---|
| A studio inside its capacity runs at full speed | $L = 0.01$ → $\eta = 0.99999$ — a solo dev with $D_{cap}=100$ produces the full **1 SP/sec** baseline of §4.4 |
| Entropy Lock must be reachable | $\eta \to 0$ as $L$ grows; at $L = 100$, $\eta = 10^{-10}$ and production is *"0.00000x"* exactly as §21 Act V states |
| The trap must actually bite | 1,000 devs against $D_{cap} = 100$ gives $L=10$, $\eta = 10^{-5}$, **total output 0.01 SP/sec** — precisely the "production drops to 0.01x, a single solo dev was faster" figure in §6.2, now derived rather than asserted |
| More people must be able to make things *worse* | See below |

**There is an optimum headcount, and it is below your cap.** Because total output
$D \cdot \eta$ rises and then *falls*, the curve has a peak:

$$D_{\text{optimal}} = D_{cap} \cdot (\rho - 1)^{-1/\rho} \approx 0.76 \, D_{cap}$$

At $\rho = 5$ the studio's best possible output is about $0.61 \, D_{cap}$, achieved at
roughly **76% of capacity**. Every hire past that point makes the company slower. That is
*The Mythical Man-Month* stated as a derivative, and it is the mathematical heart of the
game: the player's job is not to maximise headcount, it is to keep raising $D_{cap}$ so
that the optimum moves.

**Resolution note.** Earlier drafts wrote this as $1/(1+e^{E})$, which returns 0.50 at zero
entropy and 0.27 at maximum — it could never reach full efficiency, never reach lock, and
spanned less than a 2× range where the design needs five orders of magnitude. That form is
superseded; see Appendix C #12.

### 4.2 The Developer Cap **[CANON]**

$D_{cap}$ is the only defence against §4.1, which makes it the thing every Communication
Infra upgrade and every Telepathic Compression node is really buying.

$$D_{cap}(\text{BP}_{\text{alloc}}) = D_{base} \cdot \left(1 + \mu \cdot (\text{BP}_{\text{alloc}})^{\phi}\right)$$

$$D_{cap}(\text{BP}_{\text{alloc}}) = D_{base} \cdot \left(1 + \mu \cdot (\text{BP}_{\text{alloc}})^{\phi}\right)$$

**Tuning parameters:**

| Parameter | Value | Purpose |
|---|---|---|
| Base Dev Capacity ($D_{base}$) | **100 Devs** | Forces early-game entropy lock |
| Prestige Scaling Multiplier ($\mu$) | **1000** | — |
| Compression Exponent ($\phi$) | **1.35** | Allows late-game prestige to push capacity into millions/billions of devs without breaking the entropy math |

**Worked capacity ladder** (what the player is climbing toward the 100M gate):

| $D_{cap}$ | Optimal headcount (~0.76·cap) | Best output | Reached by |
|---|---|---|---|
| 100 | 76 | ~61 SP/s | Run 1, no upgrades |
| 10,000 | 7,600 | ~6.1k SP/s | Comm Infra T2–T3 |
| $10^{6}$ | 760,000 | ~610k SP/s | Sub-Dermal Neural Sync + early Telepathic Compression |
| $10^{8}$ | 76,000,000 | ~61M SP/s | **The 100M gate (§13.5)** — requires Quantum Entanglement Sync and deep Telepathic Compression |

**The gate's real shape.** "100,000,000 developers at 100% efficiency" does *not* mean
$D_{cap} = 10^{8}$ — at exactly capacity, efficiency is 50%. Running $10^{8}$ devs at 99%
efficiency requires $L = 0.39892$, and therefore:

$$D_{cap} \ge 2.5068 \times 10^{8}$$

The player must build **two and a half times more capacity than headcount** to clear the
gate. This is the single most important tuning target in the game, and it is what makes
the last stretch of the climb about Communication Infra rather than about hiring.

> **Precision note.** An earlier draft rounded $L$ to $0.40$ and the threshold to
> $2.5 \times 10^{8}$. That rounding goes the wrong way: at $D_{cap} = 2.5 \times 10^{8}$
> efficiency is **98.99%**, which is *below* the 99% the gate asks for. The figures above
> are the exact ones. Implementation derives the threshold from $\rho$ rather than
> hard-coding it (`capacityForEfficiency` in `src/sim/entropy.ts`), so it stays correct if
> $\rho$ is retuned — and §4.1 names $\rho$ as the knob most likely to move.

**Verified against the design's own stated figures:**

| Scenario | $D$ | $D_{cap}$ | $\eta$ | Output | Matches |
|---|---|---|---|---|---|
| Solo dev, Run 1 | 1 | 100 | 1.000 | **1 SP/s** | §4.4 baseline, §21 Act I (0.1%/sec) |
| Optimum headcount | 76 | 100 | 0.798 | 60.6 SP/s | $D_{optimal}$ |
| At capacity | 100 | 100 | 0.500 | 50 SP/s | — |
| **The trap** | 1,000 | 100 | $10^{-5}$ | **0.01 SP/s** | §6.2 "production drops to 0.01x", and a solo dev is genuinely 100× faster |
| Run 1 Act V | 10,000 | 100 | $10^{-10}$ | $10^{-6}$ SP/s | §21 "Production Speed: 0.00000x" |

### 4.3 The Entropy Speedometer

The player-facing readout is $E = 1 - \eta$, displayed as a percentage. It is literally
**effective output as a fraction of nominal output**, so 0% means every developer is
producing their full 1 SP/sec and 99.999% means the studio has seized.

- **High Entropy** → Red / vibrating.
- **Low Entropy** → Smooth / blue.

At >80% entropy the entire screen micro-jitters and red scanlines flicker across the UI.
At 99.9% the speedometer slams into lock and production halts.

#### 4.3a "Entropy" is an internal word — the player never sees it **[CANON]**

**$E$ is the model. It is not the label.** "Communication Entropy" is precise, it is the
right name for the variable, and it appears throughout this document, in the source, and in
every balance discussion. **It appears nowhere the player can read it.**

Two reasons, and the second is the real one:

1. **It is jargon.** "Entropy" costs a non-technical player a beat of translation on a
   readout they are supposed to glance at four times a second.
2. **One word cannot carry a five-act arc.** The same number means "things are going fine",
   "this is getting silly" and "the company is on fire". A fixed label makes the drama the
   *colour's* job alone. **Escalating the vocabulary is free drama**: the readout changing
   its own name is how the player learns the situation changed, before they have parsed the
   number.

**The ladder. The label escalates with $E$; the number underneath is unchanged.**

**Banded against the curve, not against the axis — resolved 2026-08-07 (Appendix C #14).**
An even 0–100% spread reads sensibly and is wrong: $\eta = 1/(1+(D/D_{cap})^5)$ is not
linear, and against the §4.2 cap of 100 it holds $E$ under 3% until ~50 developers. Evenly
spread bands left **five of the seven labels unreachable in Run 1** — it went straight from
`IN SYNC` to `STUDIO SEIZED`, and the ladder spent all its drama in one jump. The bands sit
where the curve actually is:

| $E$ | Player-facing label | Devs (Run 1, cap 100) | Register |
|---|---|---|---|
| 0 – 1% | `IN SYNC` | 1 – 30 | Everything is fine and nobody is thinking about it |
| 1 – 10% | `CHATTY` | 40 – 60 | The first hint, delivered as a joke. **§21.0 Act IIa ends here** |
| 10 – 40% | `BOGGED DOWN` | ~80 | Recognisable to anyone who has had a job |
| 40 – 70% | `PRODUCTIVITY BREAKDOWN` | ~100 | The corporate euphemism, deadpan |
| 70 – 90% | `TOTAL GRIDLOCK` | ~130 | No euphemism left |
| 90 – 99% | `MELTDOWN` | ~200 | |
| 99%+ | `STUDIO SEIZED` | 500+ | Replaces "ENTROPY LOCK" everywhere the player sees it |

**Rules:**

- **The number is always shown beside the label.** The escalating word is drama; the
  percentage is the honest reading, and hiding it would make the HUD a mood ring.
- **The label is the readout's name, not a status message.** It reads
  `PRODUCTIVITY BREAKDOWN 71%`, not "Warning: productivity breakdown detected".
- **Internal names stay internal.** `entropy()`, $E$, `ENTROPY_LOCK` and this document's
  prose keep the precise term. Renaming the model would cost clarity for everyone who has to
  reason about it, and gains the player nothing they can see.
- **§21's script uses the ladder.** Act V's terminal banner reads
  `CRITICAL SYSTEM FAILURE: STUDIO SEIZED`, not "COMMUNICATION ENTROPY 100%".

**One consequence, and it is a build item rather than a caveat.** The Mass Hire adds 1,000
developers in a single frame, so even re-banded the readout jumps `CHATTY` → `STUDIO SEIZED`
with the four middle labels traversed instantaneously between roughly 80 and 200 developers.
**Drive the readout off *landed* developers rather than hired ones** and the §21 Act IV drop
— which already takes 2.2 seconds and already has a progress value — sweeps the player
through `BOGGED DOWN`, `PRODUCTIVITY BREAKDOWN`, `TOTAL GRIDLOCK` and `MELTDOWN` as the
bodies come down. That is the entire ladder, used, for free, during the beat it was written
for. Do this when Act IV is next touched.

---

### 4.4 Story Points — The Universal Unit of Progress **[CANON]**

**Every project in the game is denominated in Story Points (SP).** Not seconds, not lines
of code — Story Points, the famously arbitrary Agile estimation unit that is definitely
not hours and that everybody secretly treats as hours.

A project is not a timer. It is a **Sprint Commitment**: a pile of SP that must be burned
down to zero before the project ships.

```
Project: "Flappy Square 1.0"
Sprint Commitment: 1,000 SP     ← the "1,000 lines of code" the solo dev promises in §21
Burned:              412 SP
Remaining:           588 SP     ← the burn-down bar
```

SP comes from exactly two places, and they add into the same pool:

$$\text{Velocity} = \underbrace{D \cdot \eta(E)}_{\text{passive — the swarm}} \;+\; \underbrace{\textstyle\sum \text{SP}_{\text{poke}}}_{\text{active — the clicker layer}}$$

Where $\eta(E)$ is the efficiency factor from §4.1 and $D$ is the active developer count.

**Baseline calibration:** one developer at full efficiency produces **1 SP/sec**. So a solo
dev burns down *Flappy Square 1.0* (1,000 SP) in 1,000 seconds — which is exactly the
0.1%/sec fill rate specified in the onboarding script (§21, Act I). Every other number in
the game hangs off this one.

**Why SP instead of a plain progress bar:** it gives the clicker layer something concrete
to produce, it makes active and idle play commensurable (both output the same unit), and
it lets the satire do mechanical work — *Scope Creep* can raise a Sprint Commitment
mid-sprint (§18.4), and estimation upgrades become real numeric progression (§4.6).

### 4.5 The Poke — "Status Check"

The clicker layer. Tap a developer and they blurt out a number.

In fiction, the poke is a **status check**: you, the manager, tapping someone on the
shoulder to ask how it's going. The game's central joke is that this is *simultaneously*
how work gets extracted and how work gets destroyed — which is precisely why it costs
Entropy.

**One tap resolves as:**

$$\text{SP}_{\text{poke}} = F(\text{tier}) \times S(\text{state}) \times Z(\text{zoom}) \times \eta(E)$$

| Term | Meaning | See |
|---|---|---|
| $F(\text{tier})$ | Fibonacci estimation ladder — base points per dev | §4.6 |
| $S(\text{state})$ | Multiplier from what the dev is currently doing | §4.7 |
| $Z(\text{zoom})$ | How many devs the tap hits, and how much each gives | §4.8 |
| $\eta(E)$ | Global efficiency — pokes are taxed by Entropy exactly like passive output | §4.1 |

That last term is load-bearing: **at high Entropy, poking stops working too.** A player
in Entropy Lock cannot tap their way out. See §6.3.

### 4.6 The Fibonacci Estimation Ladder

Developers estimate in Fibonacci numbers because that is what Agile does, and the numbers
are arbitrary because they were always arbitrary. Upgrades move you **up the ladder** rather
than multiplying a float — so progression reads as "we estimate at 8 points now," which is
both funnier and more legible than "+340% click power."

| Tier | SP per poke | Typically unlocked by |
|---|---|---|
| **F1** | 1 | Base — available from the first tap of the game |
| **F2** | 2 | Branch C: *Sandbagging* |
| **F3** | 3 | Branch C: *Planning Poker* |
| **F4** | 5 | Branch C: *Velocity Inflation* |
| **F5** | 8 | Branch C: *Consultant Estimates* |
| **F6** | 13 | Prestige L1: *Story Point Inflation* (lvl 1–2) |
| **F7** | 21 | Prestige L1: *Story Point Inflation* (lvl 3) |

Beyond F7 the ladder continues procedurally (34, 55, 89, …) through the Layer 3 Infinite
Grid, so the clicker layer never becomes irrelevant at cosmic scale.

### 4.7 Dev State Multipliers — The Poke Decision

Poking is not mashing. **What the developer is currently doing decides whether the tap is
worth it**, and the best targets are the ones that cost you the most to interrupt.

| Dev State | $S$ (SP multiplier) | The trade |
|---|---|---|
| **Working (default)** | ×1 | Baseline. Small entropy cost. |
| **Slacking (retro RPG)** | ×0.5 | Low points — they had nothing in progress — but the poke's real value is the +50% speed boost (§8.2). |
| **Focused / Flow State** | **×3** | The biggest single-tap payout in the game, **and it ends their Flow State**. You are cashing in a multiplier you were supposed to protect. |
| **Overwhelmed (Entropy Lock)** | ×0 | Zero SP. The poke's value is clearing their lockup. |
| **Rogue Refactorer** | **negative** | They give back points they already deleted. Poke to cancel the refactor, not for profit. |
| **10x Engineer** | **×10** | Enormous — **and they quit on the spot** (§13.3). A one-time cash-out of a permanent unit. |

The 10x Engineer interaction is the sharpest decision in the game: a rare, permanently
valuable unit whose quit condition is the exact action the clicker layer trains you to
spam. Placing a **hero card** that suppresses quitting (§22) is one way to resolve it.

### 4.8 Zoom-Scaled Poking

You cannot tap 100,000,000 developers individually. The Omni-Lens (§7) solves this: **the
tap's blast radius scales with how far out the camera is, and per-dev yield falls as it
does.** The further you are from the work, the less each status check is worth — which is
both a real management truth and a free joke.

| Zoom | One tap hits | $Z$ per-dev factor | Net effect |
|---|---|---|---|
| **L1 Desk** | 1 developer | ×1.00 | Highest per-dev yield. Surgical: hunt Flow States and 10x Engineers. |
| **L2 Floor** | 1 row (~8–20 devs) | ×0.40 | The everyday working zoom. |
| **L3 Global** | 1 sector (a city) | ×0.08 | Broad sustained sweeping. |
| **L4 Cosmic** | 1 planetary hive | ×0.01 | Highest raw total, lowest respect for the individual. |

This gives the zoom system a **mechanical** reason to exist rather than a purely visual
one, and it creates a genuine strategic rhythm: zoom out to sweep for volume, punch in to
extract from a specific high-value developer.

### 4.9 The Context Switch Penalty — Why You Cannot Just Mash

Every poke adds local Entropy to the developer you poked. You interrupted them; that is
what an interruption does.

$$E_{\text{local}} \mathrel{+}= \epsilon \cdot \text{SP}_{\text{poke}}
\qquad\qquad
\eta_{\text{dev}} = \eta(L) \cdot \frac{1}{1 + E_{\text{local}}}$$

Local entropy multiplies *against* the studio-wide load efficiency from §4.1, so a poked
developer is temporarily worse than their peers, and a heavily-mashed one contributes
almost nothing until they recover.

| Parameter | Value | Notes |
|---|---|---|
| **Context Switch Coefficient ($\epsilon$)** | **0.02** base | Reduced by Async-First Culture and the Culture & Juice branch |
| **Local decay** | ~8 seconds to baseline | Long enough to punish mashing, short enough to reward rhythm |

**The consequence:** higher-tier pokes cost proportionally more Entropy, so climbing the
Fibonacci ladder is not free power — it raises both the reward and the tax. Sustained
mashing drives local Entropy up, which drags $\eta(E)$ down, which reduces *both* your
passive rate *and* the value of the next poke. The optimal play is **rhythmic, targeted
poking**, not maximum taps per second.

This is the whole game compressed into one interaction: **more input, more overhead.**

---

### 4.10 The Run 1 Economy **[CANON — added 2026-08-06]**

The design previously specified no economy at all. It gave exactly two numbers, both in
§21, and under a flat per-developer wage they are irreconcilable:

| Where | Figure |
|---|---|
| §21 Act II | *"Game Published! Profit: +$50"* — 2 people, first project |
| §21 Act V | *"Payroll Burn Rate: $50,000 / sec"* — ~1,000 developers |

$50,000/sec across 1,000 developers is **$50/dev/sec**, which would cost tens of thousands
of dollars to ship the Act II project that earns fifty.

**The resolution is in §21's own scene setting: it is a garage.** *"A single developer sits
in a messy bedroom/garage."* You and James are two friends building a game, not employees.
Neither of you draws a salary. Payroll begins with the Mass Hire, whose 1,000 developers
arrive on the "FREE trial promo" and start costing money the moment it lapses.

| Parameter | Value | Notes |
|---|---|---|
| **Unpaid founders** | **2** | You and James. A narrative constant, not a balance knob — it is why the opening is survivable and why the Mass Hire feels like a decision. |
| **Wage** | **$50 / paid dev / sec** | Derived from §21 Act V |
| **Revenue** | **$0.05 / SP shipped** | Calibrated so *Flappy Square 1.0* (1,000 SP) pays the +$50 §21 states |
| **Bankruptcy** | **−$1,000,000** | §21 Act V walks the player down through −$10,000 and −$100,000 first |

Both stated figures now fall out of the model rather than being asserted:

| Scenario | Paid heads | Payroll | Matches |
|---|---|---|---|
| Act II, the garage | 0 | **$0/sec**, profit **+$50** | §21 Act II |
| Act V, after the Mass Hire | 1,000 | **$50,000/sec** | §21 Act V |

**Payroll is deliberately linear.** §6.1 makes payroll the *timer* that converts frozen
production into bankruptcy — it is not the trap. A superlinear wage would be doing
Communication Entropy's job, and the lesson has to come from §4.1 or it is a different
lesson. With $50 banked and 1,002 developers, the run ends in **about 20 seconds**, inside
the "within 60 seconds" §6.1 calls for.

---

## 5. Progression Eras

Three narrative eras frame the whole run structure. (Original era framing from v0 —
retained as canon flavour, scale bands refined by later drafts.)

### Phase 1 — The Solo Era (0–10 Devs)

- **Goal:** publish basic apps ("Flappy Square", "Calculator Pro").
- **Time to Build:** 10s – 30s.
- **Humor:** classic indie dev tropes (coffee overdosage, Stack Overflow copy-pasting).

### Phase 2 — The Megacorp Era (1,000 – 1,000,000 Devs)

- **Goal:** build MMORPGs and Game Engines in real-time.
- **Time to Build:** 0.1s – 0.001s.
- **Feature Unlocks:** "Manager Distraction Dampeners", "Infinite Pizza Catering".

### Phase 3 — Cosmic Hivemind Era (1 Billion+ Devs)

- **Goal:** simulate entire universes inside game engines before the universe itself can render them.
- **Time to Build:** microseconds / nanoseconds ($10^{-9}$ s).
- **Game Projects:** "Matrix 2.0", "Life Simulation of the Multiverse".

---

## 6. The "Early Game Trap" (The Progression Puzzle)

To prevent players from trivialising the game in 20 minutes, the game is **intentionally
designed so their first 3–5 runs end in catastrophic company failure.**

```
Run 1: Hire 1,000 Devs → Extreme Slack Explosion → Complete Project Freeze ($0 Revenue) → Bankruptcy
Run 2: Slow Hire → Hit T3 Slack Web → Notification Overload → Burnout Collapse → Paradigm Shift Unlocked
```

### 6.1 Fail-state mechanics

1. **The Bankruptcy Pitfall (Run 1).** The "Mass Hire x1000" button is available early.
   Once pressed, payroll skyrockets but output drops to near-zero due to uncapped Entropy.
   Cash hits negative within 60 seconds, forcing a forced liquidation (Mini-Prestige).
2. **The "Merge Conflict" Catastrophe (Runs 2–3).** Pushing a release with **>500
   developers** without basic Git/Branching/Version Control tech triggers a total codebase
   corrupt event, wiping active project progress instantly.
3. **Lesson Taught:** players realise that **Communication Tech upgrades dictate workforce
   capacity**, not available cash.

### 6.2 The trap in detail (visual + mechanical)

1. The player is offered the **"Mass Hire"** button once the earn-and-hire loop has taught
   them that hiring works — around 10 developers, priced at roughly everything they have
   earned (§21.0) — and takes it, expecting $1{,}000\times$ speed.
2. **Visual Impact:** instantly, thousands of tiny sprites spawn, crashing into each
   other. Screen fills with red `@everyone` ping icons, unread notification bubbles, and
   overlapping speech bubbles saying *"Wait, who's writing this function?"*
3. **Gameplay Impact:** production speed drops to **0.01x**. A single solo dev was
   actually faster, because the 1,000 devs spend 99.9% of their time in meetings, arguing
   over tab vs. space formatting, and replying to Slack threads. Without upgraded
   communication infrastructure, **Communication Entropy spikes to 99%**.

### 6.3 The clicker dimension of the trap

The Story Point layer makes the trap sharper, because it gives the panicking player
something to do wrong.

When production freezes, **the player's instinct is to tap harder.** Every one of those
taps is a status check, and every status check adds context-switch Entropy (§4.9). Poke
yield is itself multiplied by $\eta(E)$, so as Entropy climbs toward lock, each frantic tap
returns less than the one before it while making the next one worse still.

The player therefore experiences the game's thesis *through their thumb* before they read
it on the bankruptcy screen: **interrupting people harder does not make them finish
faster.**

The tutorial line writes itself, and should appear as a dev speech bubble around the
twentieth desperate tap:

> *"Poking me again isn't making the meeting end sooner."*

**Design rule:** never let tapping rescue a run from Entropy Lock. The clicker layer is an
accelerator on a healthy studio, never a bailout for a broken one. If playtesting shows
players tapping out of the trap, lower the poke $\eta(E)$ exponent rather than capping taps
— the lesson must come from the simulation, not from a disabled button.

The full scripted onboarding of this trap is in **§21**.

---

## 7. Visual Architecture: The "Omni-Lens"

The game is rendered in an **isometric pixel-art style**. The UI is a semi-transparent HUD
overlay, ensuring the living swarm simulation remains **100% visible**.

### 7.1 Design principle: the UI is a Layer

To maximise immersion, the entire screen is always the visual simulation. No heavy, opaque
"window" boxes. Instead the UI is:

- **Overlayed** — HUD elements sit on top of the devs.
- **Semi-Transparent** — background blur and transparency ensure you never lose sight of the swarm.
- **Contextual** — action panels slide in only when needed (e.g. when clicking a developer) and slide away quickly.

### 7.2 Fractal zoom ladder

```
[Level 0: Solo Dev Desk] → [Level 1: Open Office Floor] → [Level 2: Mega Campus] → [Level 3: Global Grid]
```

### 7.3 Seamless camera scaling (by headcount) — **superseded by §7.7.1 for the numbers**

> **Read §7.7.1 first.** This table predates the Construction Ladder and disagrees with it on
> where the rungs sit — it puts a skyscraper at 10⁴ and a planetary view at 10⁹, where §7.7.1
> puts a *building* at 10⁴ and a planet at 10¹⁰. **§7.7.1 is canon for the thresholds and the
> unit names.** What survives here, and is still the best description of it anywhere in this
> document, is the *texture* of each scale — buses dumping 2-pixel workers into a lobby,
> regions lighting up as heatmaps, the dark side of Earth glowing with data cables. Use it as
> art direction, not as a spec.

| Headcount | What the camera shows |
|---|---|
| **1 Dev** | Camera zoomed tight on a single pixel-art programmer typing under a desk lamp, sipping coffee. You can read their monitor code. |
| **100 Devs** | Smooth camera dolly out. A chaotic, packed open-office floor. Desks crammed together, wires cross the floor, paper airplanes fly around. |
| **10,000 Devs** | Zoom out to an isometric view of a massive corporate skyscraper. Windows flicker as lights turn on and off; buses dump thousands of tiny 2-pixel-tall workers into the lobby. |
| **1,000,000 Devs** | Camera pulls back to a satellite / world-map view. Entire regions (Silicon Valley, Shenzhen, Bangalore) light up as dense, pulsing heatmaps of glowing nodes. |
| **1 Billion Devs** | Planetary view. The dark side of Earth glows with pulsing neon data cables connecting orbital server farms and hive-mind pods. |

**Micro-Details at Macro Scale (Pinch-to-Zoom):** players can manually pinch-to-zoom at
any tier. Even when managing 10 million developers, zooming in on any specific pixel on
the map reveals a tiny individual developer frantically typing or getting distracted.

### 7.4 The four canonical zoom levels **[CANON]**

| Level | Scale | Visual Focus | Micro-Interaction / Poke Mechanics |
|---|---|---|---|
| **Level 1** | **Desk (1:1)** | Individual pixel developer sitting at a messy desk with a glowing CRT monitor and coffee mugs. | **Poke Dev:** tap the developer directly to speed them up or slow them down. **Desk Query:** ask *"What are you doing?"* or *"Status?"* for contextual/funny dialogues. |
| **Level 2** | **Row / Floor (1:1,000)** | Open-office floor packed with desks, cable pathways, whiteboards, and coffee stations. | **Meeting Buster:** swipe across huddles to cancel useless meetings. **Slack Storm:** tap floating red `@everyone` bubbles before they freeze the floor. |
| **Level 3** | **Global Grid (1:1,000,000)** | World map showing cities and continents linked by neon data pipelines and glowing server nodes. | **Sector Balancing:** tap high-entropy red hotspots on the globe to deploy localized signal boosters. |
| **Level 4** | **Galactic View (1:1,000,000,000+)** | Inter-planetary and solar-system network connected by laser relay paths. | **Latency Management:** re-route orbital communication lasers across planetary hives to optimize interstellar bandwidth. |

### 7.5 Zoom level detail (expanded)

**Level 1 — Micro (The "Desk View")**
- **Scale:** tight focus on 1–5 desks.
- **Visuals:** highly detailed pixel art or stylized low-poly. You see the developer's avatar, their tiny monitor displaying actual (fake) code scrolling, and props (coffee cups, posters).
- **Interaction — The "Desk Query":** when you tap a developer, a transparent thought bubble slides out from their head with funny, queryable stats:
  - *"What are you doing?"* → **Current Action:** "Writing redundant CSS."
  - *"How is morale?"* → **Status:** "Over-caffeinated but deadline-panicked."
  - *"Who are you talking to?"* → **Network:** "Arguing with `@everyone`."
  - A small circular profile icon (e.g. `[ T1 Intern ]`) appears next to them.

**Level 2 — Mid (The "Floor/Office View")**
- **Scale:** isometric or top-down view of an entire floor, holding maybe 200–500 devs.
- **Visuals:** details simplify. Monitors become single glowing pixels; specific desk props disappear, replaced by overall architecture (breakrooms, server racks, massive whiteboards). Wires and cable pathways become visible.
- **Interactions:** the primary interaction here is **Bottleneck Slicing** — you see glowing red noise clusters; tapping/swiping them breaks up unproductive meetings or clears Slack congestion.

**Level 3 — Macro (The "Global Grid/Satellite View")**
- **Scale:** a regional or world-map view.
- **Visuals:** developers fuse into a colorful, geometric **Dev Grid**. No individual sprites remain. It's now a flowing map of neon data pipes and glowing data centers. Highly active, high-entropy areas glow red/fire-orange; smooth pipelines flow bright blue.
- **Interaction:** the map is divided into territory **"Sectors."** You manage entropy by upgrading regional connection hubs.

**Level 4 — Cosmic (The "Galactic Network")**
- **Scale:** space view focusing on planets and eventual star systems.
- **Visuals:** swarms and data grids become visible on the surface of planets. Giant holographic projection beams or orbiting satellite arrays connect entire planets. Deep-space connection lines represent inter-galactic protocols.
- **Interaction:** managing planet-to-planet latency. Upgrading interstellar Neuro-Relays.

### 7.6 Concept art

| Reference | File |
|---|---|
| Mobile UI layout & wireframe (first pass) | `assets/concept/ui-wireframe-mobile-layout.png` |
| Gameplay sketches across four scales | `assets/concept/sketches-four-scales.png` |
| "Swarm Dev" UI concept — four zoom panels | `assets/concept/ui-concept-four-zoom-panels.png` |
| Isometric style: galactic → planet → offices → floor → row → desk | `assets/concept/isometric-galactic-to-desk.png` |
| Pixel-style gameplay | `assets/concept/pixel-style-gameplay.png` |

**Sketch annotations (transcribed):**

1. **Local Desk Chaos (Scale 1–10):** progress bar NEAR-FROZEN, code text heavily zoomed in, "Pings!" windows stacking, red `!` marks, "COMMUNICATION ENTROPY!" callouts.
2. **Open Office Storm (Scale 100–10,000):** isometric floor, "SLACK EXPLOSION" starburst with red lines radiating to every desk, ~1K pixel-art developers, "TAP BOTTLENECK", `SHIP IT!` button greyed out due to entropy.
3. **Global Heatmap (Scale 1 Million+):** rainbow-pulsing progress bar, neon disc heatmap over the globe, orbital sync network, neuro-sync hubs, `DEV COUNT: 1.2M` panels.
4. **Inter-Galactic Network (Scale 1 Trillion+):** gigantic dev hive mind, dev stars, gigantic holographic projections, stats readout `RELEASES/MILLISECOND: ∞`, zoom-to-micro/macro arrows.

---

### 7.7 The Construction Ladder — hiring must be *visible*, at every scale **[CANON]**

**Requirement.** Adding a developer is the game's primary verb, and it must be seen, not
read off a counter. Hire one: *puff* — someone is sitting at the desk beside you. And the
hire at 10¹² must land as hard as the hire at 1.

**Why this is hard, stated plainly.** One sprite per head is correct up to about 10³ and
then fails twice over. It fails technically, because 10¹² sprites is not a rendering problem
but an impossibility. And it fails *perceptually*, well before that: a player at 10¹² who
hires 10⁹ more has added 0.1%, and no honest linear picture of 0.1% is a feeling. Games that
ignore this end up with a number going up beside a picture that stopped moving hours ago.

**The answer is to change what is being built, not to shrink what is being shown.** The
studio grows the way a city grows. First you fill a floor with people. Then you stop adding
people and start adding *floors*. Then buildings, then campuses, then towns, nations,
planets, galaxies. At every rung the player is still watching something physically arrive —
it is just a bigger thing.

#### 7.7.1 The ladder

| Rung | Headcount | The unit that arrives | What the camera holds |
|---|---|---|---|
| 0 | 1 – 10 | **a person** | one desk, then a huddle |
| 1 | 10 – 10² | **a person** | a room of desks |
| 2 | 10² – 10³ | **a person** | one full floor, rank and file |
| 3 | 10³ – 10⁴ | **a floor** | a tower growing storey by storey |
| 4 | 10⁴ – 10⁵ | **a building** | a block |
| 5 | 10⁵ – 10⁶ | **a campus** | a business park |
| 6 | 10⁶ – 10⁸ | **a town** | a sprawl to the horizon |
| 7 | 10⁸ – 10¹⁰ | **a nation** | a continent, lit at night |
| 8 | 10¹⁰ – 10¹³ | **a planet** | a system |
| 9 | 10¹³ + | **a galaxy** | a cluster |

**Rungs 0–2 are the same picture at three densities, and that is the point.** This is where
one sprite means one person, where the fiction is established, and where the entire Run 1
script (§21) takes place. Nothing above rung 2 is allowed to make this stop being true.

#### 7.7.2 The arrival gag — *slap another floor on it*

Every rung change from 3 upward is a **physical construction joke**, and it is the single
highest-value piece of animation in the game because the player will see it hundreds of
times across a run.

The register is deadpan slapstick — the studio expands the way a cartoon builds a house:

- **Rung 3, a floor arrives.** A complete, furnished, already-populated storey drops out of
  the sky and lands on top of the tower with a *whump*. The building squashes, wobbles, and
  settles one floor taller. Dust rings out from the base. Nobody inside reacts.
- **Rung 4, a building arrives.** A whole tower slams down beside the last one, hard enough
  to make the neighbours sway. A tiny crane wanders off screen having done nothing.
- **Rung 5, a campus.** Several buildings land at once, in formation, like a dropped tray.
- **Rung 6+, towns, nations, planets.** The same beat at absurd scale: an entire town slides
  into frame and parks. A continent is placed. A planet is set down, and it bounces once.

**The comedy is in the deadpan and the speed, not in a wacky animation.** These objects
behave like furniture being put down by something enormous and bored. That reads as funny,
and — this matters more — it reads as *the studio no longer being a place where anyone
thinks about people*, which is the game's actual thesis (§6) arriving through the visuals
instead of through a text box.

**Every hire produces an arrival, even below a rung change.** Within a rung the unit is
partial: a half-built floor gains a storey of scaffolding, a campus gains a car park. The
rule is that the screen must never be still after a hire.

#### 7.7.3 How big the gag is — the ratio rule

What scales the arrival is the **ratio**, never the raw number:

> **arrival weight = clamp(1, 120, round(40 × log₁₀(after / before)))**

| Hire | Ratio | Weight | Reads as |
|---|---|---|---|
| 1 → 2 | ×2 | 12 | a person, unmissable |
| 2 → 1,002 (the §6 Mass Hire) | ×501 | 108 | a deluge |
| 10¹² → 10¹² + 10⁹ | ×1.001 | 1 | a trickle — *correctly* |
| 10¹² → 2 × 10¹² | ×2 | 12 | exactly what 1 → 2 felt like |

Nobody experiences "plus a billion". They experience "×2, something" or "×1.001, nothing".
The bottom two rows are the whole design: a late-game hire that doubles the studio gets the
same punch as the very first one, and a late-game hire that barely moves the needle is
*allowed* to feel like it barely moved the needle. That is information, not a failure.

The 120 cap exists because the ADR §7.5 criterion-4 sprite ceiling is real, and because past
roughly a hundred simultaneous arrivals the eye stops counting anyway.

#### 7.7.4 The Hero Anchor — you can always zoom back to James **[CANON]**

**However large the studio gets, pinching all the way in lands on one specific floor: the
one with the player's desk and every Hero Card character on the org chart (§22).** James is
at that desk in Run 1 and in Run 400. He is never fused into an aggregate, never becomes a
statistic, and never has to be found.

This is a hard rule and it is the most important line in §7.7:

- **It is the emotional anchor.** A game about a hundred million developers that never shows
  you one is an abstract number going up. The zoom-in is the promise that there are still
  people down there, and §22.3 spends the entire Hero Card system on making the player care
  about one of them specifically.
- **It is what makes the ladder legible.** The rungs above are only readable *as* growth
  because the player can compare them against a floor they know. Zoom out from James's desk
  to a galaxy and back, and the scale means something. Without the anchor it is just
  differently-sized wallpaper.
- **It pays off §21's ending.** Act V leaves one desk occupied — "*So. Same time tomorrow?*"
  — and that lands only if the player already knows exactly which desk that is.

**Implementation constraints this places on everything else:**

1. Hero characters are **never** part of the cohort/aggregate representation. They are
   individually rendered sprites at desk zoom at any headcount.
2. The Omni-Lens (§7.2) always has a defined path from the top rung down to the Hero floor.
   There is no headcount at which the desk tier stops existing.
3. The Hero floor keeps its identity as the surroundings change — it is the *same room*
   inside a bigger and bigger building, not a fresh one generated per rung.

#### 7.7.5 The scale bar — never a silent unit change

From rung 3 the HUD states what one marker means, exactly as a map states its scale, because
a picture whose units silently changed is a lie:

```
+----------------------------------------+
|  DEVS  4.2 T        1 FLOOR = 1 K DEVS |
+----------------------------------------+
```

A player at rung 7 who thinks one dot is one developer has been misled by their own game.

#### 7.7.6 Navigation — drag to move, tap to poke, tap to select **[CANON]**

The Omni-Lens is not a fixed camera that only zooms. **The player can drag the world around
at every rung**, and everything on screen is individually addressable.

| Gesture | Effect |
|---|---|
| **Drag** | Pan the camera across the current rung. Momentum, then friction — never a rubber-band snap-back |
| **Pinch** | Zoom, continuously, across the whole ladder (§7.2) |
| **Tap a developer** | Poke them (§4.5, §8.2) — *any* of them, not a designated one |
| **Tap a unit** (floor, building, campus, town, planet) | Select it: the camera frames it and the Query Panel opens on it |
| **Double-tap a unit** | Zoom into it — one rung down, centred on what was tapped |
| **Tap empty space** | Deselect |

**Two requirements this places on the renderer, both load-bearing:**

1. **Every one of the 1,000 floor sprites is individually hit-testable and pokeable.** Not a
   proxy, not the nearest of nine anchor points — the actual developer under the thumb.
   §4.5's poke is the game's primary verb and §8.2's per-developer states (Slacking, Flow,
   Rogue, 10x) are *per developer*; a swarm you cannot address one member of makes all of
   that decoration. The ParticleContainer holding them therefore needs a spatial index
   alongside it, because particles carry no hit area of their own.
2. **Selection is defined at every rung.** At rung 3 you select a floor, at rung 7 a nation.
   "Our floor, our building, our city, our planet" has to be a thing the player can point at
   and act on, or the ladder is scenery rather than a place.

**Panning must not fight poking.** A tap is a pointer-down and -up within ~10 px and ~250 ms;
anything longer or further is a drag and yields no poke. Getting this wrong in either
direction is fatal: a poke that pans loses the clicker layer, and a pan that pokes means
every attempt to look around costs the player Entropy (§4.9).

**The Hero Anchor (§7.7.4) is a navigation guarantee too.** There is always a "return to my
desk" affordance — pinching all the way in, or a single HUD control — so the player can never
get lost in a galaxy with no way back to James.

#### 7.7.7 What this must never become

- **A counter with a particle effect.** If nothing physically arrived, the hire did not
  happen as far as the player is concerned.
- **A silent unit change.** §7.7.5 is not optional decoration.
- **A ladder you cannot walk around in.** §7.7.6 is canon: drag, poke any individual, select any unit.
- **A ladder that abandons the ground.** §7.7.4 is canon. The moment the player cannot get
  back to James, the game has become a spreadsheet.
- **A rung change that can be missed.** Rung promotions are rare and enormous. They get the
  camera, the audio and the screen; they do not get a toast.

---

### 7.8 The Populated Scene — what is actually on screen, and what moves **[CANON]**

§7.7 says what the *unit* is at each scale. This says what the **screen looks like** at each
headcount, and what animates. It is the brief an artist or a renderer works from.

**The standing constraint, restated because it governs everything below:** low budget,
**minimal animation**, achievable with mostly static pixel art. Nothing in this section may
be read as licence for frame-by-frame spritesheets.

#### 7.8.1 Population steps — rungs 0–2, where one sprite is one person

This is the whole of Run 1 (§21) and where the fiction is established. The room grows with
the headcount; the camera pulls back continuously (§7.2), never in steps.

| Devs | What is on screen | What arrives with it |
|---|---|---|
| **1** | One desk in a dark bedroom, lit only by the monitor. A mug. A chair. | — |
| **2** | A second desk pushed alongside, close enough to touch. The room light comes up one notch. | **James.** The first other person |
| **3–5** | Desks in a huddle facing inward. A whiteboard on the wall. The first plant. | Whiteboard, plant |
| **6–10** | A small office: two short rows, a walkway between. A coffee machine in the corner. | Coffee machine, walkway |
| **11–30** | Walls push outward. Cubicle dividers appear between desks. A server rack hums against one wall. | Dividers, server rack |
| **31–100** | A full open-plan floor. Desks on the iso grid. Cable runs cross the floor. Ceiling strips overhead. | Cable runs, meeting pod |
| **101–300** | The floor is busy. Walkways narrow. Meeting pods along one edge, occupied. | Second meeting pod |
| **301–1000** | **Shoulder to shoulder.** Desks touching, no walkways left, dividers gone because there is no room for them. | Nothing. There is no space left to add anything |

**The 301–1000 band is the §21 Act IV image and it is deliberately claustrophobic.** The
props *stop arriving* and then start disappearing — the dividers go, the plant is gone, the
walkway is desks now. **The room gets worse as it gets fuller**, and that is the §6 thesis
told in set dressing before any number says it.

**Everything in the "arrives with it" column is T3 commodity** (ART_DIRECTION §4) — desks,
chairs, monitors, plants, server racks, whiteboards. Buy a pack or generate, then run it
through §5's quantiser. None of it is bespoke.

#### 7.8.2 Population steps — rungs 3+, where the unit is architecture

Above 1,000 the individual is gone and §7.7's Construction Ladder takes over. What the
camera holds:

| Devs | Unit | The frame |
|---|---|---|
| **1 K – 10 K** | **Floor** | A tower, 1–10 storeys. Each storey is a lit band of the same crammed floor, seen edge-on. Storeys arrive by dropping onto the stack (§7.7.2) |
| **10 K – 100 K** | **Building** | A block. 1–10 towers, each 10 storeys. Lit windows flicker at different rates |
| **100 K – 1 M** | **Campus** | A business park. Buildings in formation, connecting walkways, car parks that are always full |
| **1 M – 100 M** | **Town** | Sprawl to the horizon. Street grids, a ring road, an airport |
| **100 M – 10 B** | **Nation** | A continent seen at night, lit by density. Coastlines readable |
| **10 B – 10 T** | **Planet** | A system. The planet's dark side glows with the swarm |
| **10 T +** | **Galaxy** | A cluster. Points of light, each one a civilisation of developers |

**All of this is T0 procedural or T3 commodity.** A tower is a repeated storey band; a city
is instanced blocks with varied heights; a planet is geometry and a shader. **No rung above 2
requires a single bespoke sprite**, which is the whole reason the §22.7 art budget can be 19.

#### 7.8.3 What animates, and how — **the budget rule**

**Nothing is a spritesheet.** Every motion below is either a code-driven transform on a
static part, or a shader. This is what makes "minimal animation" and "the swarm is alive"
compatible instead of contradictory.

| Zoom | What moves | How |
|---|---|---|
| **L1 desk** | The developer **types** — a two-frame hand bob, a shoulder rise-and-fall, an occasional head turn to the second monitor. Steam curls off the mug. The monitor's code scrolls. | **Transforms on parts library pieces** (ART_DIRECTION §4.1). The arms, head and torso are separate sprites; typing is a 2 px vertical oscillation on the arms at ~6 Hz with a per-dev phase offset. No new art |
| **L2 floor** | Every one of the 1,000 **bobs slightly, out of phase**. Chairs swivel occasionally. Monitor glints twinkle. | A shared time value plus a **per-particle phase offset**. **DEFERRED — see below** |
| **L3 global / L4 cosmic** | Data pulses along pipes, hubs breathe, planets rotate | **Shaders.** §7.5 states no individual sprites remain here, so there is nothing to animate — it is all T0 |
| **Any zoom** | The §8.2 poke responses, the §7.7.2 arrival gags, §21 Act IV | Already specified in their own sections |

> **The L2 bob is deferred, and the reason is worth knowing.** The floor's
> `ParticleContainer` holds particle position as a **static** property, which is
> what keeps §23.3 criterion 4 affordable — static means the buffer uploads only
> when asked, so the 1,000-sprite floor costs almost nothing per frame. Bobbing
> them on the CPU means making position dynamic, which is a per-frame upload of
> all 1,000 and **changes the cost of the exact scene criterion 4 measures**.
> That is not a change to make casually and then re-benchmark; the honest route
> is a shader that offsets Y from a time uniform, leaving position static. Until
> then the floor tier is still and the room tier is not. The room is where all
> of Run 1 happens, so the visible cost is low.

**Per-developer phase offset is non-negotiable at every tier.** A thousand sprites bobbing in
unison reads as a single breathing object, not as a thousand people. The offset is derived
from the sprite index by a hash, so it is deterministic and free.

#### 7.8.4 Idle states — what a developer looks like before you poke it

§8.2 specifies the *reaction* to a poke. This is the resting state, which is what the player
actually spends their time looking at:

| State | Idle appearance |
|---|---|
| **Working** | Typing bob, steady. Monitor scrolling code |
| **Slacking** | Bob stopped. Monitor shows a bright non-code colour field. Head tilted back |
| **Flow** | Fast bob, slight forward lean. Monitor scrolling twice as fast. A faint glow |
| **Overwhelmed** | Head down on the desk, no motion at all. Monitor full of stacked notification rectangles |
| **Rogue Refactorer** | Violent bob. Monitor is a wall of dense text. Tinted toward the RARITY violet |
| **10x Engineer** | Perfectly still, facing the camera. Nothing on the monitor |

**Stillness is a state, and it must read as deliberate rather than as a dropped frame.** The
Overwhelmed and 10x developers are the only two that do not move, and both are surrounded by
a floor that does — which is what makes them legible.

---

## 8. Game Juice: Camera, Poking & Feedback

The visual simulation is the entire game — the UI floats on top as a clean,
semi-transparent HUD overlay.

### 8.1 Dynamic depth-of-field & zoom blur

- **Tilt-Shift & Radial Motion Blur:** rapidly zooming out triggers a heavy radial motion
  blur and pixel-smear effect. Zooming in tight applies a **tilt-shift depth-of-field
  blur** around the edges, keeping only the targeted desk/row in razor-sharp pixel focus.
- **Camera Shake & Screen Distortion:**
  - **High Entropy (>80%):** the entire screen begins to micro-jitter, and red scanlines flicker across the UI.
  - **Massive Hires (10,000+ at once):** camera experiences an impactful "thud" impact zoom with heavy screen-shake.

### 8.2 "Poking" mechanics & tactile juice **[CANON]**

Tapping individual developers delivers immediate visual, haptic, and mechanical responses
depending on their current state. **Every poke also extracts Story Points** (§4.5–4.7) —
the SP column below is the clicker layer's payout, the Gameplay Effect column is the state
side-effect.

| Dev State | Visual Response to "Poke" | Haptic Feedback | **SP Yield** | Gameplay Effect |
|---|---|---|---|---|
| **Working (default)** | Sprite jolts upright, types visibly faster for a beat. | Short tick | **×1** | Baseline poke. |
| **Slacking (Playing Retro RPG)** | Sprite flinches, monitor snaps back to code, exclamation mark `!` pops up. | Sharp, double tap | **×0.5** | Instantly boosts dev speed by **+50% for 10 seconds**. |
| **Overwhelmed (Entropy Lock)** | Dev drops head onto keyboard, tiny squished-face pixel icon appears. | Long rumble | **×0** | Temporarily clears their local communication lockup. |
| **Focused / Flow State** | Tiny pixel stars explode around their head; steam vents from their ears. | Light tickle / high-freq | **×3** | Prolongs their Flow State multiplier by **+5s** *if* you have the Culture upgrade — otherwise the poke **ends** Flow State. |
| **Rogue Refactorer** | Dev turns bright purple and starts frantically typing in Assembly. | Warning pulse | **negative** | Cancels their rogue refactor that was about to break the build. |
| **10x Engineer** | Sprite freezes, turns to face the camera, then walks off-screen. | Heavy double thud | **×10** | **They quit permanently.** A one-time cash-out of a rare unit. |

**The SP number must fly.** Every poke spawns a floating Fibonacci numeral (`+8`) that arcs
up and fades — this is the clicker layer's entire feedback loop and it has to feel
generous. Crits (Flow State, 10x) spawn a larger numeral with a brief chromatic-aberration
punch on the HUD.

#### 8.2a The poke also emits a line of code **[CANON]**

Beside the numeral, every poke throws off **one short line of source code** that arcs, fades
and is gone in under a second. This is what the developer just wrote because you interrupted
them, and it is the game's highest-frequency joke delivery: at 4–5 taps a second in the first
thirty seconds, it is the line the player reads more than any other text in the product.

```
                 while (true) { ... }
              +8      ^ arcs up and fades
        [ dev sprite ]
```

**The writing brief, and it is narrow.** Each line must clear three bars at once:

1. **A developer laughs.** The joke is real to someone who writes code for a living.
2. **A non-specialist gets it anyway.** `while (true)` reads as "this never stops" to anyone
   who has met a computer. Nothing requiring a language, a framework or a war story.
3. **It fits on one line at HUD size.** Roughly 28 characters. If it needs two lines it is
   an essay, not a joke.

**Seed set** — the register, not the full list:

| Line | Why it lands for both audiences |
|---|---|
| `while (true) { }` | The universal "this is never going to finish" |
| `// TODO: fix this` | Everyone has written this note and abandoned it |
| `git commit -m "stuff"` | The unhelpful label, in every profession |
| `it works on my machine` | Already a civilian phrase |
| `console.log("here")` | Debugging by shouting into the void |
| `// don't touch this` | Fear of one's own past work |
| `rm -rf /` *(crit only)* | Reads as catastrophic even without knowing why |
| `undefined is not a function` | Comedy of the machine complaining in riddles |
| `catch (e) { }` | Ignoring a problem, expressed as syntax |
| `sudo make me a sandwich` | The oldest joke in the trade, and legible cold |

**Rules:**

- **Never repeat consecutively.** Shuffle-bag, not random draw — a repeated line at 5 taps a
  second reads as a bug in the game rather than a joke.
- **State-flavoured.** The dev's §8.2 state picks the pool: a Rogue Refactorer emits
  Assembly, an Overwhelmed dev emits `` (empty), and the 10x Engineer's farewell poke emits
  a resignation one-liner.
- **Typeset in Departure Mono, in the palette, with no syntax highlighting.** It is a
  fragment from the same CRT the monitor is showing, not an IDE screenshot.
- **It never carries information.** A player who never reads a single one loses nothing
  mechanical. This is texture, and it must not become a tutorial channel.

**This replaces the placeholder bar.** The spike drew the floating numeral as an untyped
rectangle, on the reasoning that text belongs in React (ADR 0001 §5 mitigation 3). That
reasoning holds for the HUD and not for this: the code line is scenery, it must sit *under*
the CRT glass to be welded (ART_DIRECTION §6), and it churns several times a second.

### 8.3 Haptics & polish

- **Haptic Feedback:** short, snappy vibration bursts when popping Slack pings or poking developers.
- **Hyper-Speed Project Meter:** watch project progress bars fill up so fast they start vibrating and turning rainbow/fire colours.
- **Particle Text Effects:** floating text showing "+1,000,000 AAA RPGs Published!" floating across the screen.

---

## 9. Active "Entropy Control" Interactions

To keep the game active and visual rather than menu-driven, players interact directly with
the swarm screen to clear bottlenecks:

- **Meeting Buster (Slicing Gesture):** swipe across groups of developers gathered around
  a whiteboard to cancel useless meetings and send them back to coding.
- **Filter `@everyone` (Tap Reaction):** red pings spawn across the map. Tapping them
  before they explode prevents a **10-second team-wide productivity freeze**.
- **Isolate Rogue Coders:** occasionally a dev sprite goes "rogue" and starts refactoring
  the whole codebase in a dead programming language. Tap them to give them coffee and
  redirect their focus.
- **Notification Storm mini-game:** triggered by Slack-tier comms. Clear pings to restore flow.
  (Mid-game variant: **tap 20 notification bubbles in 5 seconds** to prevent production
  from freezing entirely.)

---

## 10. UI & HUD Design

### 10.1 Main gameplay screen component table **[CANON]**

| Component | Description & Function | UI Mockup Concept |
|---|---|---|
| **Top Bar (Resource HUD)** | Persistent information. Transparent bar, high contrast text. Shows Currency (e.g. $1.2 T) and Total Dev Count (e.g. 5.3 M) with small trending arrows. | `[$][ $1.2T ]` |
| **Active Project (Top-Left)** | Non-obtrusive summary of the *next* milestone progress. Rendered as a **sprint burn-down** — a descending line, not a filling bar (§10.4). | `PROJECT: [██ _]`<br>`Simulating Universe T-0.03s`<br>`588 / 1,000 SP remaining` |
| **Velocity Readout (under Entropy Speedometer)** | Story Points per second, passive + active split. The clicker layer's scoreboard. Spikes visibly while poking, settles back to the passive rate. | `VELOCITY: 4,120 SP/s`<br>`(3,880 swarm + 240 poke)` |
| **Simulation Area (Main)** | The Omni-Lens view of the swarm. Takes up 100% of the screen. | `[ VISUAL SWARM IS ACTIVE HERE ]` |
| **Entropy Speedometer (Mid-Left)** — *internal name; §4.3a governs what it is called on screen* | Shows real-time effective output (%) vs total output. Decays rapidly as devs are added. High = Red/Vibrating; Low = Smooth/Blue. | `BOGGED DOWN 60%`<br>`[=====-----]` |
| **Mini-Map (Top-Right)** | Crucial for Global/Cosmic scale navigation. Shows high-entropy hotspots. Can be tapped to instantly jump the lens. | `[ (•) (•) (•) ] [ WORLD MAP ICON ]` |
| **Contextual "Query Panel" (Slides in on Dev-Tap)** | Only appears at Micro-Zoom. Slides in smoothly from the screen edge. Semi-transparent. Contains buttons to "Query" status and apply temporary boosts. | `--- [ DEV: INTERN #42 ] ---`<br>`What are you doing? > [ WRITE CSS ]`<br>`Status? > [ OVERLOADED ]`<br>`Action? > [ Give Coffee ]` |
| **Navigation Bar (Bottom)** | Structured menu access (transparent buttons). Highlights: **"Swarm"** (main screen), **"Upgrades"** (Communication Tech Tree), **"Releases"** (list of past successful games), **"PRESTIGE"** (Paradigm Shift). | `[ SWARM ] [ UPGRADES ] [ RELS ] [ PRESTIGE ]` |

### 10.2 Per-zoom HUD readouts (from concept art)

The "GAME UI CONCEPT: SWARM DEV" sheet establishes the HUD reading at each zoom level.
Format: `[ $ cash ] [ DEVS n ] [ ENTROPY n% ]`, each mark a procedural pixel icon
per ART_DIRECTION §3.1 — bracketed words here because a mock is a layout, not an asset.

| Panel | Zoom Level | HUD | Active Project | On-screen affordances |
|---|---|---|---|---|
| **1. Micro Zoom: Desk Query** | 1:1 | `[$ 1.2K] [DEVS 8] [ENT 60%]` | `Build 'Flappy Cube' (T-5s)` | Ping! bubbles, `--- DEV: INTERN #42 ---` panel: `ASK: What are you doing?` → "Writing redundant CSS."; `ASK: Status?` → "Panicked, but caffeinated."; `[ Give Coffee (+5%) ]` |
| **2. Mid Zoom: Open Office Slicing** | 1:1,000 | `[$ 900M] [DEVS 25K] [ENT 30%]` | `Generate 'Matrix' Sequence (T-0.1s)` | Swaying "Entropy" bar (vibrates when red) → **TAP: Clear Node!**; **SLACK NOISE Web**; **MEETING BUSTER: swipe to cancel** |
| **3. Macro Zoom: Global Grid** | 1:1,000,000 | `[$ 1.5T] [DEVS 5.3M] [ENT 90%]` | `Simulate Multiverse v1.0 (T-0.03s)` | **Entropy Heatmap**; `[ SENSORS ]` / `[ COMM TECH ]` side rail listing `T3: Agile Standups`, `T4: Neural Sync`, `T5: Neuro-Relay`; **SECTOR: upgrade connection hubs**; **MAP: jump lens via tap**; PRESTIGE tab glowing |
| **4. Cosmic Zoom: Inter-Galactic Network** | 1:1,000,000,000 | `[$ 90Q] [DEVS 12.1B] [ENT 99%]` | `Re-code Physics Constants (T-0.0001s)` | **PLANETARY HUBS: manage latency**; **INTER-STELLAR PATHS: upgrade protocols**; **ZOOM PATH: Micro → Macro** |

All four panels carry the same bottom nav: `[SWARM] [UPGRADES] [RELEASES] [PRESTIGE]`.

### 10.3 First-pass mobile wireframe (annotated) — **VOID, portrait**

> **Superseded by [ADR 0002](adr/0002-screen-orientation.md): the game is landscape.** This
> wireframe is portrait and its layout is therefore void — kept only for the component
> inventory it names, which is still correct. **Do not lay anything out from it.** A 2:1
> isometric floor in a portrait window uses 22% of the display; the measurement is in
> ADR 0002 §2.1.

From `assets/concept/ui-wireframe-mobile-layout.png`:

```
+--------------------------------------------------+
| HEADER / RESOURCES BAR                           |
|  [$] $ Trillions ^     [DEVS] Count (2.5 M)     |
+--------------------------------------------------+
| CURRENT PROJECT   (speedily rapid progress)      |
|  SIMULATING MULTIVERSE (AAA+)                    |
|  [████████████████░░░░]                          |
|  0.0001s / 0.0001s  [SHIP IT!]                   |
|                     SPEED: 10M RELEASES/SEC      |
+--------------------------------------------------+
| DEV SWARM VISUALIZATION                          |
|  (dynamic world map of animated pixel dots)      |
|                          +---------------------+ |
|                          | SLACK CHANNEL       | |
|                          | EXPLOSION BOSS      | |
|                          | ▪ message …         | |
|                          | ▪ message …         | |
|                          | [ TAP TO CLEAR ]    | |
|                          +---------------------+ |
+--------------------------------------------------+
| UPGRADES & MANAGEMENT   (flow tabs)              |
| [HIRE UNITS] [AUTOMATION] [PRESTIGE] [RELEASES]  |
|  T4: DEV CITIES            [COST: 1.2 Trillion $]|
|   Count: 500  Effect: +5,000,000 Devs            |
|  T5: DYSON SWARM COMP      [COST: 900 Quad $]    |
|   Count: 12   Effect: +50M Devs, +100x Speed     |
+--------------------------------------------------+
| GLOBAL NAVIGATION                                |
|  [SHOP] [MANAGEMENT] [STATS] [REWRITE]           |
+--------------------------------------------------+
```

### 10.4 The Sprint Burn-Down

The project progress indicator is **a burn-down chart, not a progress bar.** A descending
line that must reach zero. It is the single most recognisable artefact in Agile project
management, it is instantly legible to the target audience, and it costs almost nothing to
render — one polyline and an axis.

```
SP │╲
   │ ╲___                    ← ideal line (dotted)
   │     ╲╲                  ← actual line (solid, live)
   │       ╲╲___
   │            ╲╲
  0└────────────────╲──────  DONE
    sprint start        now
```

- The **ideal line** is dotted and always shown. Being above it is being behind schedule.
- Each poke visibly **notches the actual line down**, so the clicker layer has a persistent
  visual consequence rather than only a floating numeral.
- **Scope Creep** (§18.4) makes the line jump *upward* mid-sprint. This is the most
  viscerally annoying thing the game can do to a developer, and it is completely free.
- At zero, the line hits the axis and the **Definition of Done** stamp lands.

### 10.5 Screen & Scene Transitions **[CANON]**

**Nothing in this game cuts.** Every screen change, panel open, zoom step, prestige reset,
and modal is animated. The stated design intent from the first brief was *"Visual is
everything, I don't want yet another web page-y game"* — instant state swaps are precisely
what makes software feel like a web page, and they would undo the Omni-Lens, the game
juice, and the entire premise that the screen is a living simulation.

**Baseline motion budget:**

| Transition | Duration | Curve | Notes |
|---|---|---|---|
| Panel / drawer slide-in (Query Panel, node inspector) | 180–240 ms | `easeOutCubic` | Slides from the edge it belongs to, never fades in place |
| Panel dismiss | 140–180 ms | `easeInCubic` | Faster out than in — always |
| Nav tab change (Swarm ↔ Upgrades ↔ Releases ↔ Prestige) | 260 ms | `easeInOutCubic` | Cross-slide with parallax on the simulation behind; the swarm stays visible and keeps simulating |
| Zoom step (Omni-Lens L1↔L2↔L3↔L4) | 400–600 ms | `easeInOutQuart` | Continuous camera dolly with the blur and whoosh from §8.1 and §20.4. **Never a hard cut between zoom levels.** |
| Modal open (Paradigm Shift, Codebase Fork) | 320 ms | `easeOutBack` (slight overshoot) | Background blurs up over the same 320 ms rather than snapping to blurred |
| Prestige execution | 1.2–2.0 s | scripted | CRT reboot wipe → camera punch-in to a single desk (§15.1). This one is allowed to be long; it is a ceremony. |
| Hero card place / remove | 240 ms | `easeOutBack` | Card physically travels to the slot; it does not teleport |
| Shop / storefront open | 280 ms | `easeOutCubic` | Terminal boot-scan reveal, top to bottom |

**Rules:**

1. **Every transition preserves continuity of place.** The player must always be able to
   see where they came from — the simulation persists behind overlays, and outgoing
   elements exit toward where they went.
2. **No transition blocks input for longer than it lasts.** All of them are interruptible
   except the prestige ceremony.
3. **Motion is skippable but not disable-able by default** — a tap during a transition
   completes it instantly rather than cancelling it. Offer a *Reduce Motion* accessibility
   toggle that shortens durations to ~40% and drops parallax, but never one that turns
   transitions into hard cuts.
4. **Nothing pops into existence.** New devs drop in, new panels slide, new cards deal in,
   numbers count up rather than snapping.
5. **The 60fps floor is a hard requirement for transitions specifically.** A janky
   transition is worse than no transition; if a screen cannot animate at frame rate on the
   target device, simplify the screen, not the animation.

### 10.6 UI Anti-Patterns — Things That Make It Feel Like A Web Page

An explicit list of things to avoid. If a build exhibits any of these, it has drifted from
the design.

| ❌ Anti-pattern | Why it kills the game | ✅ Instead |
|---|---|---|
| **Hard-cut screen changes** — new screen appears instantly | The single biggest "this is a web page" tell | Animate every change (§10.5) |
| **Full-screen opaque menus** that hide the simulation | The screen *is* the studio; covering it ends the immersion the whole game is built on | Semi-transparent overlays with background blur; the swarm keeps moving underneath |
| **Discrete zoom levels with a hard swap** | Destroys the Omni-Lens, which is the visual hook | Continuous camera dolly with blur (§8.1) |
| **Scrolling lists of text rows as the primary upgrade UI** | This is the "spreadsheet game" the design explicitly rejects | Node trees with pixel-art frames and connection cables (§15.1) |
| **Numbers that snap to new values** | Reads as a data table refreshing | Count-up tweens on every counter; digits roll |
| **Default system fonts and OS-native controls** | Instantly reads as a wrapped web app | The CRT/terminal type system throughout, including in modals and the store |
| **Rectangular flat-colour buttons with rounded corners and a drop shadow** | Generic web/material vocabulary | Pixel-art frames, terminal brackets `[ LIKE THIS ]`, scanline treatments |
| **Toast notifications sliding in from the top** | Web convention with no place in a simulation | Diegetic surfaces — ticker tape (§18.5), speech bubbles, terminal lines |
| **Loading spinners** | Admits there is a web page behind the curtain | Nothing in this game should need one; if it does, mask it with the CRT boot animation |
| **Static, un-simulated backgrounds behind menus** | Breaks the "living simulation" contract | The swarm continues to simulate and animate behind every overlay |
| **Instant-appearing modals** | Jarring, cheap | Scale-and-blur-up over ~320 ms |
| **A separate "settings page" that looks like a form** | Web app tell | Style it as a `STUDIO_OS` config terminal |

**The test:** screenshot any two consecutive frames during a screen change. If nothing is
mid-motion, it is a cut, and it needs fixing.

---

### 10.7 The Dialogue System — typed out, and unskippable **[CANON]**

All character dialogue is delivered **one letter at a time**, in the manner of a Game Boy
Pokémon text box. This is the game's voice, and it is not decoration.

**Presentation:**

- **Departure Mono**, at the terminal type scale. It is already the only face in the product
  (ART_DIRECTION §3), and a fixed-width face is what makes character-by-character reveal
  legible — proportional type reflows as it types, which reads as a rendering fault.
- **A framed box** anchored to the bottom of the screen, semi-transparent over the
  simulation, per §7.1. It never covers the speaker.
- **A speaker name plate** above the box: `JAMES`, `ADVISOR`, `STUDIO_OS`.
- **A blinking advance caret** in the bottom-right of the box once a page has finished
  typing, exactly where a Game Boy puts it.
- **Letters land with a tick.** One short click per character, throttled so a fast line does
  not become a buzz.

  > **Per-speaker pitch is deferred.** The native audio path (§23.2 non-negotiable 1) has no
  > pitch or rate control, and adding one would mean either a Web Audio path — which breaks
  > that non-negotiable on the one path where latency matters most — or one clip per speaker.
  > The cheapest real fix is three generated `ui-tick-*` variants, and until they exist the
  > tick is unpitched. **The current tick is also a stand-in**: `poke-desk` is a 0.5 s keycap
  > click, the right *kind* of sound but far too long, throttled to ~11/sec to cope. Revisit
  > the throttle when a 50 ms `ui-tick.mp3` exists.

**Timing:**

| | |
|---|---|
| Base rate | **28 characters/second** |
| After `,` | pause 120 ms |
| After `.` `?` `!` | pause 260 ms |
| After `—` | pause 200 ms |
| Page length | 3 lines max, then wait for advance |

**Rules, and the third one is the point:**

1. **Tapping mid-page completes the page instantly.** Impatience is served — but it fills
   the text in, it does not move past it.
2. **Advancing requires a deliberate second tap** once the page is complete. A single tap
   can never both finish a page and dismiss it, or a fast tapper skips the whole scene by
   accident. This game trains players to tap 5×/second in Act I; the dialogue system has to
   survive that thumb.

   > **Refined in implementation, 2026-08-07.** A second tap alone is not enough. The arming
   > window is **260 ms of *quiet*, not merely of elapsed time**: a tap arriving inside the
   > window is swallowed **and restarts it**. Counting taps satisfies the rule literally, but
   > a trained 5 Hz thumb (200 ms gaps) would then clear a page every 260 ms for as long as
   > it mashed — the rule would slow the skip down rather than prevent it. With the restart,
   > sustained mashing holds the page open indefinitely and the caret lights the instant the
   > player stops. **The blinking caret appears exactly when the window closes**, so the
   > affordance and the rule are the same event: a tap while the caret is dark is a tap the
   > box has already said would not count.
3. **There is no skip.** No "skip cutscene", no hold-to-fast-forward, no auto-advance timer.
   The player reads it, or they sit there. Every line in this game is a joke or a setup for
   one, the script *is* the product (Appendix D: text does the comedy work, not art), and a
   skip button is an admission that it is filler.

**The one exception, and it is not a skip:** dialogue already seen in a previous run may be
advanced faster (rule 1 with no per-character delay), because a player on Run 40 has read
James's introduction forty times. **First viewing of any line is always fully typed.**

**Accessibility:** an OS-level reduce-motion preference sets the rate to instant-fill per
page. That is a rendering accommodation and still requires the deliberate advance tap of
rule 2 — the content is never shortened or auto-dismissed.

---

### 10.8 The Presentation Gate — what "done" means **[CANON]**

§10.5 says how transitions work and §10.6 lists what not to do. **This section makes them a
gate**: a feature is not finished when it functions, it is finished when it passes the list
below. ADR 0001 §7.5 does this for performance; nothing did it for presentation, and
"we'll juice it later" is how a game ships feeling like a web page.

**Every one of these is a FAIL, not a nit.**

#### F1 — Anything pops in or out

**A cutscene, modal, panel, screen or dialogue box that appears or disappears without a
directed transition fails.** This is the single named failure condition. No opacity-0-to-1
snap, no `display: none`, no instant page swap. Everything enters and leaves with motion that
has a direction, a duration and an ease. §10.5 is the spec; this is the gate.

**Test:** capture two consecutive frames at any state change. If nothing is mid-motion, it
is a cut. Fail.

#### F2 — A UI element that does not respond to being touched

Every interactive element acknowledges the finger **before** it acknowledges the action:

| Element | Required response |
|---|---|
| **Button** | Depresses on press-down — scale ≤ 0.96, shadow collapses, colour shifts. Releases with a spring overshoot, not a linear return. Sound on down, not on up |
| **Scroll / list** | Momentum with friction, and **rubber-band overscroll at both ends**. A list that stops dead at its boundary fails |
| **Pull-down** | Real elastic resistance that increases with distance, and snaps back with a spring. Never a linear drag |
| **Drag (the §7.7.6 camera)** | Momentum, friction, and no snap-back |
| **Toggle / slider** | The handle carries weight — it arrives with a small overshoot |
| **Card / tile** | Tilts or lifts under the thumb |

**Test:** press and hold every interactive element without releasing. If nothing changed, fail.

#### F3 — Silence

**Every state change makes a sound.** Button down, panel open, panel close, tab change,
purchase, error, dialogue letter, transition whoosh. A screen the player can operate in
silence fails.

**Music is continuous and reactive, never a loop that restarts on a screen change.** The
§20 four-tier bus crossfades; it does not cut. A music track that restarts when a menu opens
fails.

#### F4 — Placeholder art in a shipped build

No grey boxes, no untextured rectangles, no "programmer art" outside a dev build. Anything
the player can see is either an authored asset that passed ART_DIRECTION §7, or a deliberate
procedural T0 object (ART_DIRECTION §4) — never a stand-in that survived.

#### F5 — A cutscene that is not directed

Cutscenes are camera work, not slideshows. Each beat needs at least one of: a camera move, a
scored moment, a parallax layer, an entrance animation. **A cutscene that is a sequence of
static frames with text fails** — including the §21.6 dialogue scenes, which get camera
pushes on the beats even though the shot is two men at desks.

#### F6 — A transition the player waits through

Juice is not delay. Every animation in F1 runs in **under 400 ms** unless it is a deliberate
scored beat (a §7.7.2 rung promotion, a Paradigm Shift). If the player is waiting for the
game to finish being beautiful, it is not beautiful.

---

#### 10.8a The juice vocabulary — techniques, from references **[CANON]**

F1–F6 say what must not happen. This says what *does*, in named techniques, so "make it
juicy" is a spec rather than a mood. Every one below was observed in a shipped game and is
achievable with the ADR 0001 stack.

**Transitions — never a fade**

| Technique | What it is |
|---|---|
| **Hard-edged wipe** | A solid diagonal band sweeps edge-to-edge; the outgoing screen is behind it going out, the incoming screen behind it coming in. ~300–500 ms. **Not a cross-fade** — a cross-fade is a slow cut |
| **Staggered exit and entry** | List and menu items leave one at a time on ~40–60 ms offsets, and arrive the same way. Never as a block. This single technique does most of the work |
| **Per-screen colour identity** | Each screen re-tints the whole frame — pause red, options blue, audio red, settings amber. The player knows where they are before reading a word. Ours is already built: the ART_DIRECTION §1.1 Entropy hue is the same mechanism, driven by state instead of by route |

**Shapes and type**

| Technique | What it is |
|---|---|
| **Skewed slabs, never rectangles** | Menu rows are slanted parallelograms. An axis-aligned rounded rectangle is the single most web-page-looking object available; a 4–8° skew costs nothing and removes it |
| **Filled selection** | The selected row is a solid filled slab with knocked-out text; unselected rows are text alone. Selection is a *shape* change, not a colour change |
| **Rotated marquee type** | Oversized display text running vertically up the frame edges, clipped. Fills dead margin — and ADR 0002 §6.1 says landscape gives us margin at the sides by construction |

**Numbers and counters** — this is the group most directly ours

| Technique | What it is |
|---|---|
| **Bars squash and stretch** | A progress bar that fills also *skews and wobbles*, overshooting and settling. Observed on an XP bar and it is the difference between a bar and a *filling* bar |
| **Counters roll, never set** | A treasury going 4,907 → 11,392 tweens through the intermediate values and **bounces on arrival** — scale overshoot on the digits. It must never simply become the new number |
| **Running tallies accumulate in place** | `x15 x5 x1` item counts sit in a row and tick up individually, each with its icon |
| **Gain stacks** | Recent gains stack as a short column that pushes older entries down and out |
| **Numerals in volume** | Dozens of small `+6` / `×10` numerals on screen at once, at different sizes and colours. Ours is GDD §8.2 and §8.2a and it is already built — the reference confirms the density to aim for is *higher* than feels reasonable |

**Summary and results screens**

| Technique | What it is |
|---|---|
| **Rows reveal one at a time** | A day-end table adds its rows on a stagger, not as a finished table |
| **Bars grow from zero** | Result bar charts animate up, with the value counting alongside |
| **The total counts last** | The headline figure tweens up *after* the rows have landed, so it reads as a summation rather than a lookup |

**The frame itself**

| Technique | What it is |
|---|---|
| **The background is never still** | A continuously animating element behind everything — a silhouette walking, gears turning, a slow plasma drift. A static background reads as a stopped game |
| **Placement produces particles** | Anything landing anywhere throws a short white spark burst |
| **The whole frame is a CRT** | Barrel curvature, vignette and scanlines over *everything* including the interface. Already ours — ART_DIRECTION §6, built |

**What we deliberately do not copy:** the references skip freely — one has a SKIP button on
its results screen. That is correct for a stats table and forbidden for dialogue; §10.7 rule
3 stands.

---

#### The gate covers every scene, without exception

F1–F6 are not a gameplay standard with menus exempted. **Every scene below is held to all
six**, and the title screen is held to them first, because it is where the player decides
what kind of product this is before they have pressed anything.

| Scene | Spec |
|---|---|
| **Title screen** | §10.9 |
| Boot sequence | §10.9.3 |
| The room / swarm — all four zoom tiers | §7.8, §7.7 |
| Hiring and rung promotions | §7.7.2 |
| Dialogue | §10.7 |
| §21 Act IV collapse | §21 |
| Bankruptcy and Paradigm Shift | §21 Act V, §13 |
| Tech tree, prestige trees, org chart, card inspector | §11, §13, §15, §22 |
| Storefront, releases, stats, events, settings | §10.1 |
| Ad and IAP surfaces | MONETISATION §4–7 |

**A scene that has not been checked has not passed.** The list exists so "all scenes" is
countable rather than a sentiment.

**How this gets applied:** the gate runs per *feature*, not per release, and it runs on the
device. The reviewer's job is to sit with the thing and try each of F1–F6 in turn. It takes
about two minutes and it is the difference between the product this document describes and a
functioning web app with pixel art in it.

**F1 and F2 are the ones that will actually be violated**, because they are the ones that
are invisible when you are the person who built the feature and already know it works.

---

### 10.9 The Title Screen **[CANON]**

The first thing anyone sees, and until now the one screen this document never
mentioned. It has to do three jobs before the player has pressed anything:
say what the game is, say what it *feels* like, and make them want to press the button.

#### 10.9.1 The core idea — the title is the game

**The room is the title screen.** Not a separate illustration: the actual §7.8.1 room, at
night, before anyone has sat down. One monitor is on. The chair is empty. The camera drifts
slowly. It is the same geometry the game already renders, which means the title screen costs
almost no new art and — more importantly — **the first cut of the game is not a cut at all**.
Press start and the light comes on, someone sits down, and you are playing. §10.5's "nothing
cuts" applied to the most conspicuous transition in any game.

**And the logo counts.**

```
                          1  DEVELOPERS
                         14  DEVELOPERS          ← ~1.4 s of counting
                      1,092  DEVELOPERS
                  4,318,779  DEVELOPERS
                100,000,000  DEVELOPERS          ← lands, bounces, settles
```

The title animates from `1` to `100,000,000` on arrival, in about a second and a half, and
then sits. It is the entire game compressed into the length of a logo sting: one developer
becomes a hundred million, and the joke, the premise and the scale all land before a word of
copy. It also uses machinery that already exists — §10.8a's *counters roll and bounce on
arrival*, and `formatCount`.

**On a return visit the count is faster** (about 0.5 s) but never skipped, for the same
reason §10.7 rule 3 exists: it is the game's signature and it is over in a moment.

#### 10.9.2 Layout — landscape, per §23.4.2

```
+--------------------------------------------------------------------------+
|  STUDIO_OS v0.0.1                                          [ ]  [ ]  ⌁ 60 |
|                                                                          |
|                                                                          |
|         1 0 0 , 0 0 0 , 0 0 0                                            |
|         D E V E L O P E R S                                              |
|         ────────────────────                                             |
|         an idle game about too many people                               |
|                                                                          |
|      [ START ]                                                           |
|      [ OPTIONS ]                    ·· the room, dark, one monitor lit ··|
|      [ CREDITS ]                                                         |
|                                                                          |
+--------------------------------------------------------------------------+
```

- **Logo left, room right.** The 2:1 iso room is a wide object and it wants the right two
  thirds; the type stacks into the left third. Centring the logo over the room would put
  text across the one lit thing on screen.
- **Numerals are the display element.** `100,000,000` at the largest type scale in the
  product, letter-spaced wide, with `DEVELOPERS` beneath it at a quarter the size and the
  same total width — the two lines justify to each other. That relationship *is* the logo;
  there is no wordmark to draw.
- **A rule under the logo**, then the tagline in body size. Brackets and rules, per
  ART_DIRECTION §1 — never a box.
- **Menu items are §10.8a skewed slabs**, bottom-left, using the existing `Button`.
- **`STUDIO_OS v0.0.1` top-left** in small type. The fiction is that the title screen is the
  OS, not a menu bolted onto a game.

#### 10.9.3 The boot — first launch only

Cold first launch types a short boot sequence before the logo, in the §10.7 typewriter:

```
STUDIO_OS v0.0.1
  checking payroll .......... OK
  checking morale ........... OK
  checking headcount ........ 1
  checking ambition ......... UNBOUNDED
ready.
```

Roughly two seconds. **Every subsequent launch skips straight to the logo** — a boot sequence
you have seen forty times is an obstacle, and unlike §10.7's dialogue it carries no jokes the
player has not already had.

#### 10.9.4 Motion — the §10.8 gate applies here first

The title screen is where a player decides what kind of game this is, so F1–F6 are not
negotiable on it:

| | |
|---|---|
| **Entry** | Boot types → logo numerals count up and bounce → rule draws left-to-right → menu items stagger in on 60 ms offsets. Nothing appears |
| **Idle** | The room's camera drifts slowly and never stops. The lit monitor flickers. Scanlines roll. **A still title screen reads as a broken build** |
| **Hover / press** | Menu slabs depress and spring back, sound on down (§10.8 F2) |
| **Exit to game** | The logo and menu leave on a stagger, the room lights come up, the camera pushes in to the desk. **No fade to black.** The room is continuous from title to gameplay and that continuity is the point |

#### 10.9.5 What it must never be

- **A static image with a Play button.** §10.8 F1 and F2 both fail.
- **A separate art asset.** The room already exists; a bespoke title illustration would be
  the only piece of art in the game with no gameplay use, and §22.7's budget has no room.
- **A fade to black on start.** §10.5, and it throws away the one transition the whole
  concept is built on.
- **A logo that does not count.** The count *is* the wordmark.
---

## 11. In-Run Tech Tree (Purchased with Cash `$`)

The in-run tree features **three parallel branches**. Upgrading Workforce without
Communication Infra rapidly triggers the **Communication Entropy Trap**.

```
[WORKFORCE BRANCH]        [COMMUNICATION INFRA]        [CULTURE & JUICE]
  ├── Solo Dev Desk         ├── Voice Shouting           ├── Nitro Cold Brew
  ├── Open Floor Desks      ├── Daily Scrum/Standup      ├── Ergonomic Chairs
  ├── Dev Cities            ├── Pair Programming         ├── Free Pizza Night
  ├── Orbital Hive Pods     ├── JIRA Ticket Flooding     ├── Automated Coffee Drips
  └── Dyson Swarm Grid      ├── Sub-Dermal Neural Sync   ├── Anti-AI Slop Filters
                            └── Quantum Entanglement     └── Reality Stabilizers
```

### 11.0 Cost scaling **[CANON]**

$$\text{Cost}(N) = \text{Base Cost} \times (\text{Multiplier})^{N}$$

- **Standard Upgrades:** Multiplier = **1.07 to 1.15**
- **Major Paradigm Shifts:** Multiplier = **1.50 to 2.00**

### 11.1 Branch A — Workforce Scale (Capacity & Swarm Size)

*Adds developers, increasing potential output while scaling base Entropy generation.*

```
[Hire Interns] → [Senior Engineers] → [Dev Cities] → [Orbital Hive Pods] → [Dyson Swarm Compute]
```

| Node | Name | Flavor | Base Cost | Mult. | Effect |
|---|---|---|---|---|---|
| **A1** | Intern Army | *"Powered entirely by cheap energy drinks and hope."* | $10 | 1.07 | +1 Dev/tap \| +0.1% Base Entropy growth |
| **A2** | Senior Engineers | *"Refuses to write code unless it uses a framework they invented this morning."* | $1,500 | 1.10 | +10 Devs/sec \| +0.5% Base Entropy growth |
| **A3** | Dev Cities | *"Entire metropolitan areas dedicated purely to writing 1 line of CSS each."* | $5,000,000 | 1.12 | +10,000 Devs/sec \| Spawns city-grid isometric map sectors |
| **A4** | Orbital Hive Pods | *"Zero-gravity workstations prevent developers from leaving their desks."* | $20,000,000,000 | 1.15 | +1,000,000 Devs/sec \| Unlocks orbital lens view |
| **A5** | Dyson Swarm Compute Engine | *"Harnessing the radiant output of a stellar core to power raw typing velocity."* | $500,000,000,000,000 | 1.20 | +100,000,000 Devs/sec \| Unlocks cosmic zoom level |

**Tier summary (alternate phrasing from the deep-architecture pass):**

- **T1: Intern Army** (+1 Dev/tap \| +0.1% Entropy/sec)
- **T2: Senior Engineers** (+10 Devs/sec \| refuses to write code without specific frameworks)
- **T3: Dev Cities** (+10,000 Devs/sec \| metropolitan areas dedicated solely to writing CSS)
- **T4: Orbital Hive Pods** (+1,000,000 Devs/sec \| space stations packed with floating coders)
- **T5: Dyson Swarm Compute Engine** (+100,000,000 Devs/sec \| harnesses stellar energy for pure raw typing)

### 11.2 Branch B — Communication Protocols (Entropy Suppression)

*Reduces the exponential decay factor of the Communication Entropy Engine.*

```
[Voice Shouting] → [Daily Standups] → [Pair Programming] → [JIRA Ticket Flooding]
                 → [Anti-AI Slop Filter] → [Quantum Entanglement Sync]
```

| Node | Name | Flavor | Base Cost | Mult. | Effect |
|---|---|---|---|---|---|
| **B1** | Voice Shouting | *"Yelling across the desk cluster. Cheap, loud, horribly inefficient."* | $50 | 1.08 | Reduces initial Entropy growth rate by **5%** |
| **B2** | Daily Standups (Agile Ritual) | *"Force developers to stand up so meetings end faster."* | $2,500 | 1.12 | Caps maximum Entropy at **80%**, but creates a **Cyclic Pause**: every 60s, 20% of devs freeze for 5s |
| **B3** | Pair Programming | *"Two coders, one keyboard. Half the typing, twice the passive-aggressive commentary."* | $75,000 | 1.14 | Halves active developer count, but **cuts Entropy growth by 60%** and doubles game release payout (2×) |
| **B4** | JIRA Ticket Flooding | *"Requires three approvals, an epic, and a sprint planning session to change a button color."* | $10,000,000 | 1.15 | Caps max Entropy at **60%** **[CONFLICT: elsewhere 75%]**, but adds a static **0.5s latency** to every release |
| **B5** | Anti-AI Slop Filter | *"Deploy specialized AI models whose sole job is to destroy code written by other AI models."* | $1,000,000,000,000 | 1.18 | Completely negates **Code Bloat Entropy** generated by late-game synthetic code tools |
| **B6** | Quantum Entanglement Sync | *"Subatomic particle pairs link developer minds instantaneously across galaxy clusters."* | $10^{18} | 1.25 | Reduces Entropy decay to **0** (zero-latency communication across planetary systems) |

**Tier summary (alternate phrasing):**

- **T1: Shouting Across Desks** (reduces noise penalty by 5%)
- **T2: Daily Standups** (capping max Entropy at 80%, but introduces 5s cyclic meeting pauses)
- **T3: Pair Programming** (halves active workforce, but cuts Entropy growth rate by 60%)
- **T4: JIRA Ticket Flooding** (caps max Entropy at 60%, adds +0.5s static release latency)
- **T5: Anti-AI Slop Filters** (removes Code Bloat Entropy generated by late-game LLM code generators)
- **T6: Quantum Entanglement Sync** (zero-latency communication across planetary systems; sets base Entropy decay to 0)

### 11.3 Branch C — Culture & Juice (Active Mechanics & Story Point Yield)

*Enhances the tactile "poke" mechanics, click feedback, and Story Point extraction. This is
the clicker layer's upgrade branch.*

```
[Nitro Cold Brew] → [Ergonomic Chairs] → [Clicker Keyboards] → [Automated Ping Slicers] → [Reality Stabilizers]
                 ↘ [Sandbagging] → [Planning Poker] → [Velocity Inflation] → [Consultant Estimates]
```

| Node | Name | Flavor | Base Cost | Mult. | Effect |
|---|---|---|---|---|---|
| **C1** | Nitro Cold Brew Drips | *"Direct intravenous caffeine delivery."* | $100 | 1.09 | Poking a developer boosts typing speed by **+100% for 10s** |
| **C2** | Ergonomic Chairs | *"Mesh lumbar support delays existential corporate dread."* | $10,000 | 1.11 | Reduces developer "Overwhelmed" lockup duration by **30%** |
| **C3** | Clicker Mechanical Keyboards | *"Blue switches so loud they shake the camera frame."* | $500,000 | 1.13 | Increases haptic feedback intensity and yields extra cash per poke/click |
| **C4** | Automated Ping Slicers | *"Swiping across notification bubbles slices them out of existence."* | $500,000,000 | 1.16 | Swiping across Slack pings automatically pops adjacent notification bubbles in a radius |
| **C5** | Reality Stabilizers | *"Keeps the studio from tearing a hole in space-time when shipping at subatomic speeds."* | $10^{15} | 1.22 | Prevents frame stuttering and camera shake at high production velocities |

#### Branch C — Estimation sub-branch (the Fibonacci ladder)

These move you up the estimation ladder from §4.6, and are the clicker layer's core
progression. Each raises the Context Switch Penalty proportionally — more points per poke
means more interruption per poke.

| Node | Name | Flavor | Base Cost | Mult. | Effect |
|---|---|---|---|---|---|
| **C6** | Sandbagging | *"Every estimate doubles on the way to the planning meeting, as tradition demands."* | $2,000 | 1.10 | Estimation ladder **F1 → F2** (1 → 2 SP per poke) |
| **C7** | Planning Poker | *"Everyone reveals a card at once so nobody can be individually blamed for the number."* | $250,000 | 1.13 | Ladder **F2 → F3**. Poke yield now rolls between the current tier and the next, so some pokes pay double |
| **C8** | Velocity Inflation | *"Last sprint we did 40 points. This sprint we will also do 40 points. The points are smaller now."* | $80,000,000 | 1.17 | Ladder **F3 → F4** (5 SP). Additionally inflates the Velocity readout by **+10% with no change to actual output** — a purely cosmetic number to show a stakeholder |
| **C9** | Consultant Estimates | *"An external firm assessed the work at eight points and invoiced for eleven."* | $400,000,000,000 | 1.21 | Ladder **F4 → F5** (8 SP), but takes a **10% cut of all project revenue** |
| **C10** | Definition of Done (Ambiguous) | *"It's basically done. It just needs testing, documentation, and to actually work."* | $10^{14}$ | 1.24 | Projects ship at **95% of Sprint Commitment** rather than 100% — a flat 5% off every burn-down, forever |

**Tier summary (alternate phrasing):**

- **T1: Nitro Cold Brew Drips** (poking a dev increases typing speed by +100% for 10s)
- **T2: Ergonomic Gaming Chairs** (reduces dev "Overwhelmed" burnout rate by 30%)
- **T3: Mechanical Keyboard Clickers** (increases screen-shake and click revenue per poke)
- **T4: Automated Ping Slicers** (swiping across Slack notifications clears adjacent pings automatically)

---

## 12. Satirical Upgrade Themes (Era Flavour Layer)

Mapping the history of software engineering — from the ritualistic ceremonies of Agile to
modern corporate AI paranoia — gives every upgrade a distinct narrative personality while
directly feeding into the core tension: **Manpower ($M$) vs. Entropy ($E$)**.

### 12.1 Early-Game "Agile Rituals" (Scale: 1 – 1,000 Devs)

*At this stage, managers desperately try human processes to stop the chaos.*

#### 🔄 Daily Scrum / Standup
- **Flavour Text:** *"Force everyone to stand up so meetings end faster. They just end up leaning against desks."*
- **Mechanical Effect:** reduces base Entropy growth by **15%**, but creates a **Cyclic Pause**: every 60 seconds, **20% of developers freeze for 5 seconds** to "report blockers."
- **Visual Juice:** dev sprites gather in tight, uncomfortable circles while a tiny timer ticks down above their heads.

#### 👥 Pair Programming
- **Flavour Text:** *"Put two developers at one computer. Half as many keyboards used, twice as much passive-aggressive backseat typing."*
- **Mechanical Effect:** halves your total active developer count, but **cuts Entropy by 60%** and doubles code quality (increases game release payout multiplier by **2×**).
- **Visual Juice:** two pixel sprites crammed on a single chair, wildly gesturing at one CRT monitor.

#### ⚡ Extreme Programming (XP)
- **Flavour Text:** *"Toss out all documentation. Write tests first. Ship code to production live at 4:59 PM on a Friday."*
- **Mechanical Effect:** **+100% Development Speed**, but introduces a **5% chance per release** of a **Production Meltdown** (resets current project progress to zero).

### 12.2 Mid-Game "Corporate Overhead" (Scale: 10,000 – 1,000,000 Devs)

*Processes scale into absurd bureaucratic survival strategies.*

#### 📋 JIRA Ticket Flooding
- **Flavour Text:** *"Require a ticket, sub-task, and epic before anyone is allowed to write `print("hello world")`."*
- **Mechanical Effect:** caps maximum Entropy at **75%** **[CONFLICT: node B4 says 60%]**, but adds a static **0.5s latency** to every project release.
- **Visual Juice:** blue ticket icons fly across the screen like confetti, briefly burying developers under paperwork.

#### 🏢 Middle Management Layering
- **Flavour Text:** *"Hire Scrum Masters for the Scrum Masters."*
- **Mechanical Effect:** automatically clears **20% of Slack noise events**, but costs a **15% cut of all incoming revenue** as manager bonuses.
- **Visual Juice:** men in suits with clipboards walk around desks, causing nearby devs to immediately pretend to type faster.

### 12.3 Late-Game "The AI Slop Era" (Scale: 1,000,000,000+ Devs)

*When humans start managing AI that is managing humans, reality degrades.*

#### 🤖 Synthetic AI Slop Injection
- **Flavour Text:** *"Use LLMs to write 100,000 lines of code per second. Nobody knows what any of it does, including the AI."*
- **Mechanical Effect:** massive **+500% Dev Output multiplier**, but creates **Code Bloat Entropy**: every 30 seconds a massive "AI Hallucination" bug spawns that locks down entire planetary data centers.
- **Visual Juice:** neon-green garbage code cascades down screens; devs stare blankly into glowing screens as hallucinated pixel monsters pop out.

#### 🛡 Anti-AI Slop Filter (The Counter-Upgrade)
- **Flavour Text:** *"Deploy specialized AI models whose sole purpose is to detect and delete code written by other AI models."*
- **Mechanical Effect:** negates the Code Bloat Entropy caused by synthetic code, stabilizing the galactic dev swarm at maximum velocity.
- **Visual Juice:** laser-sweeping grids pass over the isometric planetary maps, vaporizing corrupted glowing nodes.

### 12.4 Theme → Prestige integration

These upgrades link directly into the Prestige Tree, allowing players to permanently alter
how these paradigms behave across runs:

```
                    [CORE PARADIGM SHIFT]
                            |
        +-------------------+-------------------+
        ▼                                       ▼
[AGILE MASTERY]                          [POST-HUMAN CODE]
  ├── "Async Standups"                     ├── "AI Slop Sanitizer"
  │   (Removes 5s freeze pause)            │   (+50% Revenue from AI Code)
  └── "Quad Programming"                   └── "Prompt Engineer Swarms"
      (4 Devs/Desk = 0% Entropy)               (Unlocks Galactic Prompting)
```

---

## 13. Prestige Architecture — Three Nested Layers

To ensure long-term progression depth, the prestige system operates across **three nested
layers**, each resetting different aspects of the game in exchange for deeper, permanent
meta-currencies.

```
LAYER 1: Paradigm Shift      (Resets Cash/Devs      → Rewards Bandwidth Points)
LAYER 2: Codebase Fork       (Resets BP/Tech Tree   → Rewards Git Branch Points)
LAYER 3: Multiverse Compiler (Resets Universe       → Rewards Planck Cores)
```

### 13.1 Comparison table **[CANON]**

| Feature / Dimension | **Layer 1: Paradigm Shift** | **Layer 2: Codebase Fork** | **Layer 3: Multiverse Compiler** |
|---|---|---|---|
| **Theme / Narrative** | *Rewrite the Core* (Architecture Shift) | *Fork the Lineage* (Class Trait Evolution) | *Subatomic Compression* (Dimensional Expansion) |
| **Trigger Condition** | Max Entropy stall / Bankruptcy / Forced liquidation | **Reaching 100,000,000 active developers in a run** (the title gate) | Reaching 1 Release / $t_P$ ($5.39 \times 10^{-44}$ s) |
| **Prestige Currency** | **Bandwidth Points (BP)** | **Git Branch Points (GP)** | **Planck Cores (PC)** |
| **Yield Formula** | $\propto (\$_{total})^{0.20} \cdot \log_{10}(D_{peak})$ | $\propto \sqrt{\text{BP}_{total}}$ | $\propto \log_{2}(\text{Universes Rendered / sec})$ |
| **What is Reset?** | In-run cash, active dev swarm, office tech | BP, Paradigm Tree, cash, active dev swarm | Everything from Layer 1 & Layer 2, physical universe |
| **What is Retained?** | Unlocked Paradigm Nodes, lifetime stats | Hero Lineage traits, CI/CD automation, cash boost | Unlocked Multiverse dimensions, infinite skill grid |
| **Primary System Unlocked** | **Paradigm Talent Tree** (node-based perks) | **Hero Class Lineages & CI/CD Autopilot** | **Infinite Multiverse Grid & Parallel Studios** |
| **Key Mechanical Benefits** | • Reduces Slack noise & meeting pauses<br>• Expands dev capacity cap ($D_{cap}$)<br>• Eliminates Rogue Refactorers | • Spawns 10x Engineers & Prompt Crafters<br>• Automates Git merges & release pushing<br>• Permanent base cash multiplier | • Unlocks Cyberpunk, Retro, & Space dimensions<br>• Auto-pokes devs across parallel dimensions<br>• Uncaps release speed past physical laws |
| **Primary Progression Role** | Short-term run reset (**Minutes to Hours**) | Mid-term meta-rebuild (**Days to Weeks**) | Endgame infinite replayability (**Months+**) |

### 13.2 Layer 1 — Paradigm Shift (Currency: Bandwidth Points, BP)

- **Trigger:** initiated when Communication Entropy stalls progression.
- **Resets:** current Cash, Dev Swarm Count, and In-Run Tech Upgrades.
- **Unlocks:** **The Paradigm Talent Tree** (node-based unlock system).
- **The Reset Narrative:** your current communication protocol collapses under its own
  weight (a global network partition or corporate collapse). You strip away the entire
  workforce and rebuild the company around a completely fundamental shift in **Protocol
  Paradigm** (e.g. *Rewrite Everything in Rust*, *Migrate to Quantum Protocols*).

```
                  [PARADIGM SHIFT CORE]
                          |
        +-----------------+------------------+
        ▼                                    ▼
[ASYNC MASTERY TREE]                 [PROTOCOL ENGINE TREE]
  ├── Async-First Culture              ├── Telepathic Compression
  │   (-50% Slack Noise)               │   (+10,000x Entropy Cap)
  ├── Meeting Ban                      └── Chained Poke Reaction
  │   (Removes Standup Pauses)             (1 Poke wakes full row)
  └── Zero-Trust Architecture
      (Eliminates Rogue Refactors)
```

#### Async Mastery Branch

| Node | Name | Cost | Max Level | Effect |
|---|---|---|---|---|
| **L1-1A** | Async-First Culture | 10 BP | 5 | Reduces base Slack noise generation by **10% per level (max 50%)**. Eliminates real-time meeting pauses caused by Agile upgrades. |
| **L1-2A** | Meeting Ban | 150 BP | 1 | Completely removes the **5s cyclic pause** caused by *Daily Standups*. |
| **L1-3A** | Zero-Trust Architecture | 2,500 BP | 1 | Completely eliminates the **"Rogue Refactorer"** event (devs refactoring code in dead assembly languages). |

#### Protocol Engine Branch

| Node | Name | Cost | Max Level | Effect |
|---|---|---|---|---|
| **L1-1B** | Telepathic Compression | 25 BP | 10 | Increases effective developer capacity ($D_{cap}$) before exponential Entropy kicks in by **+1,000× per level**. |
| **L1-2B** | Chained Poke Reaction | 500 BP | 3 | Poking a single developer causes a shockwave that wakes up **1 additional row** of developers per level. |
| **L1-3B** | Subatomic Auto-Poker | 10,000 BP | 5 | Automatically pokes **100 random developers per second** across all zoom layers. The idle version of the clicker layer — auto-pokes obey the same Context Switch Penalty (§4.9), so this node is a rate, not a free lunch. |
| **L1-4B** | Story Point Inflation | 1,200 BP | 3 | Permanently raises the Fibonacci estimation ladder (§4.6) by **+1 tier per level**, carrying the clicker layer from F5 up to **F7 (21 SP per poke)**. |

**Other named Paradigm perks (from earlier drafts, same tree):**
- **Automated Ping Slicer:** poking one dev automatically triggers a chain reaction that wakes up all adjacent devs on the same office row.

### 13.3 Layer 2 — Codebase Fork (Currency: Git Branch Points, GP)

- **Trigger:** reaching **100,000,000 active developers** in a single run — **the title
  gate**. This is the number on the box, and it is deliberately the hardest single
  milestone in the game. See §13.5.
- **Resets:** Bandwidth Points, Paradigm Tree, Cash, and Dev Swarm.
- **Unlocks:** **Specialized Developer Lineages & Class Traits.**

Instead of numerical boosts, Git Branch Points are spent on unlocking specialized classes
of developers that spawn naturally in future runs.

> **Classes vs. Hero Cards.** The three classes below are *generic* — anonymous units that
> spawn by probability and behave identically to one another. They are distinct from
> **Hero Cards** (§22), which are unique named individuals you collect and place on the
> org chart. Unlocking a class here raises the chance that its matching hero card's
> effects have something to act on.

```
                 [CODEBASE FORK ORIGIN]
                          |
        +-----------------+------------------+
        ▼                                    ▼
[HERO CLASS LINEAGE]                 [WORKFORCE AUTOMATION]
  ├── 10x Engineers                    ├── Automated Git Merging
  └── Quantum Prompt Crafters          └── CI/CD Autopilot
```

#### Developer classes

| Developer Class | Spawn Chance | Special Mechanical Trait |
|---|---|---|
| **10x Engineer** | 5% | Operates at **10× speed** and generates **0 Entropy**, but **quits if poked**. |
| **Quantum Prompt Crafter** | 2% | Automatically generates **10,000 lines of code per second** during flow state. |
| **Architect Archetype** | 1% | Passively suppresses Entropy for their entire office floor by **40%**. |

#### Layer 2 nodes

| Node | Name | Cost | Max Level | Effect |
|---|---|---|---|---|
| **L2-1A** | 10x Engineers | 5 GP | 5 | Gives a **1% chance per hired developer** to spawn a 10x Engineer sprite (10× speed, 0 Entropy, quits if poked). **[CONFLICT: prestige UI shows 2% at Lvl 2/5]** |
| **L2-2A** | Quantum Prompt Crafters | 25 GP | 5 | Gives a **0.5% chance** to spawn a Prompt Crafter (generates 10,000 lines of code/sec during Flow State). |
| **L2-1B** | Automated Git Merging | 10 GP | 1 | Prevents the **"Merge Conflict Catastrophe"** early-game fail state from ever occurring again. |
| **L2-2B** | CI/CD Autopilot | 50 GP | 1 | Automates active project releases whenever progress hits 100% — holding down the "Ship It!" button permanently. |

*(A third-tier node, **Merge Conflict Shield**, appears in the Workforce Automation branch
wireframe at Tier III, alongside **Architect Archetype** at Tier III of Hero Class Lineage.)*

### 13.4 Layer 3 — Multiverse Compiler (Endgame Prestige: Planck Cores, PC)

- **Trigger:** achieving a project release speed of **1 Project per Planck Time**
  ($t_P \approx 5.39 \times 10^{-44}$ s).
- **Resets:** everything from Layer 1 and Layer 2. Converts the active physical universe
  into a compressed **Planck Core**.
- **Unlocks:** **The Infinite Multiverse Skill Grid.**

```
[PLANCK CORE CONVERSION] → [UNLOCK PARALLEL DIMENSIONS] → [INFINITE GRID SCALING]
```

#### The Infinite Multiverse Skill Grid

An infinitely expandable procedural node grid. Every node purchased increases the cost of
adjacent nodes by **1.15×**, allowing endless progression.

```
 [ +1% Planck Speed ] ── [ +5% Multiverse Payout ]
          |                        |
 [ +10% Auto-Poke Radius ] ── [ Universe Render Multiplier ]
```

**Infinite node types:**
- **Temporal Accelerators:** increases Planck-time release frequency scaling.
- **Dimensional Bandwidth:** increases total **Universes Rendered Per Second (UR/s)**.
- **Multiverse Auto-Slicer:** automatically clears Slack/communication entropy events across all parallel dimensions simultaneously.
- **Cosmic Class Unlocks:** unlocks new themed parallel studios (*Cyberpunk Sub-Grid*, *8-Bit Retro Realm*, *Zero-Point Nebula*).

**Infinite stat sinks:**
- *Dimensional Bandwidth:* increases total universes rendered per second.
- *Subatomic Auto-Poker:* automatically pokes 10,000 developers per microsecond across all dimensions.

### 13.5 The 100,000,000 Gate **[CANON]**

The game is named after a number, so the number must be a wall the player can see coming
from hours away and remembers crossing.

**100,000,000 simultaneous active developers is the single official gate of the game.**
It is the trigger for the Layer 2 Codebase Fork, and it is the victory condition.
Everything before it is "getting to 100M"; everything after it is endgame.

| | |
|---|---|
| **Gate condition** | 100,000,000 active developers alive simultaneously, at **100% efficiency** (Entropy fully suppressed), long enough to ship one project at that headcount |
| **What it gates** | Layer 2 Codebase Fork — the second prestige layer |
| **Expected time to first clear** | Days to weeks of play, across many Layer 1 Paradigm Shifts |
| **Narrative beat** | Shipping *"Simulated Universe 1.0"* — the completion of the main story arc (§16) |

**Why both efficiency and headcount.** Raw headcount alone is trivially reachable by
spamming Branch A; the game's whole thesis is that headcount without communication
infrastructure is worthless. Requiring **100M devs at 100% efficiency** means the player
must have maxed the Communication Infra branch *and* banked enough Telepathic Compression
levels to push $D_{cap}$ past $10^8$. The gate is therefore a test of the actual core
system, not of idle time.

**Anti-climb protections.** $D_{cap}(\text{BP}_{alloc})$ from §4.2 with $D_{base} = 100$,
$\mu = 1000$, $\phi = 1.35$ means reaching an effective cap of $10^8$ requires a
substantial Telepathic Compression investment, which requires many Layer 1 cycles, which
is exactly the intended pacing. **Do not add a cash shortcut to this gate** — see the
monetisation guardrails.

**Presentation.** The counter in the Top Bar should render the full number, unabbreviated,
for the last stretch — `99,412,880 DEVS` reads as a countdown in a way that `99.4M` does
not. Cross the line and the HUD punches to `100,000,000 DEVS` in the title's own
typography, the swarm goes silent for one beat, and then the Codebase Fork terminal boots.

---

## 14. Prestige & Scaling Mathematics

To support virtually infinite gameplay without hitting numerical overflow, costs and
multipliers scale using exponential and hyper-exponential curves.

### 14.1 Layer 1 — Primary prestige currency (BP)

When executing a Paradigm Shift, total BP awarded is a function of **Lifetime Revenue
Earned ($\$_{total}$)** weighted by the **Peak Active Developer Count ($D_{peak}$)**
achieved during that run:

$$\text{BP} = \left\lfloor \alpha \cdot \left( \frac{\$_{total}}{\$_{0}} \right)^{\gamma} \cdot \log_{10}(D_{peak}) \right\rfloor$$

Equivalently, as first stated:

$$\text{BP Earned} = \left\lfloor \left( \frac{\text{Total Lifetime Revenue}}{10^{12}} \right)^{0.2} \times \log_{10}(\text{Peak Dev Swarm Count}) \right\rfloor$$

| Parameter | Value | Purpose |
|---|---|---|
| **Base Revenue Normalizer ($\$_0$)** | $10^{12}$ (1 Trillion) | Ensures no significant BP is earned before breaking into the mid-game corporate era |
| **Base Yield Scalar ($\alpha$)** | 100 | Establishes a clean baseline yield |
| **Growth Exponent ($\gamma$)** | 0.20 | Damps exponential revenue so players cannot double their prestige payout purely through short revenue spikes |

### 14.2 Paradigm Tree node cost

Costs for nodes within the Paradigm Talent Tree scale based on depth ($d$) and current
node level ($L$):

$$\text{Cost}_{\text{BP}}(L) = \text{BaseCost} \cdot (\beta)^{L} \cdot (\delta)^{d}$$

| Parameter | Value | Purpose |
|---|---|---|
| **Base Node Multiplier ($\beta$)** | 1.50 | Increases cost for stacking levels on the same node |
| **Depth Multiplier ($\delta$)** | 2.20 | Increases cost exponentially as you move down the tree from *Async-First* toward *Zero-Trust Architecture* |

### 14.3 Layer 2 — Git Branch Points (GP)

Upon initiating a Codebase Fork, cumulative lifetime Bandwidth Points spent and held
($\text{BP}_{total}$) are converted into Git Branch Points using a **sub-linear
square-root curve**. This ensures early unlocks feel fast while preventing runaway scaling
in the endgame:

$$\text{GP} = \left\lfloor \chi \cdot \sqrt{\frac{\text{BP}_{total}}{\text{BP}_0}} \right\rfloor$$

| Parameter | Value | Purpose |
|---|---|---|
| **Prestige Threshold ($\text{BP}_0$)** | 100,000 BP | Sets a hard barrier — Layer 2 cannot be unlocked until the player has accumulated a substantial pool of Layer 1 prestige power |
| **Base Yield Scalar ($\chi$)** | 10 GP | Establishes a clean starting baseline yield for the first fork |

**Example payout curve:**

| $\text{BP}_{total}$ | GP awarded |
|---|---|
| 100,000 | **10 GP** |
| 400,000 | **20 GP** |
| 2,500,000 | **50 GP** |
| 10,000,000 | **100 GP** |

### 14.4 Hero class spawn rate & efficiency curves

GP spent in the *Hero Class Lineage* branch directly increases the natural spawn
probability ($P_{class}$) of special developer units during subsequent runs. To prevent
hero classes from completely replacing the standard dev swarm, spawn rates use a
diminishing-return equation bounded by a maximum soft cap ($P_{max}$):

$$P_{class}(L) = P_{max} \cdot \left(1 - e^{-\lambda \cdot L}\right)$$

- $L$: current allocated node level in the Git Branch Tree.
- $\lambda$: growth coefficient (**0.25**).

| Class | $P_{max}$ |
|---|---|
| 10x Engineer | 0.05 (5% max spawn chance) |
| Quantum Prompt Crafter | 0.02 (2% max spawn chance) |
| Architect Archetype | 0.01 (1% max spawn chance) |

When a hero unit spawns, their effective output multiplier ($M_{hero}$) scales based on
the player's total accumulated GP across all runs:

$$M_{hero} = \text{Base Multiplier} \times \left(1 + \eta \cdot \log_{10}(1 + \text{GP}_{lifetime})\right)$$

- **Base Multipliers:** 10× for 10x Engineers; 100× for Prompt Crafters.
- **Scaling Coefficient ($\eta$):** 0.5 — gives long-term value to GP hoarding.

### 14.5 Git Branch Tree node cost

Upgrade nodes within Layer 2 feature a steeper cost scaling than Layer 1 to reflect their
permanent, meta-altering nature:

$$\text{Cost}_{\text{GP}}(L) = \left\lceil \text{BaseCost} \cdot (\kappa)^{L} \right\rceil$$

**Node base costs:**
- *Tier 1 (Automated Merging, 10x Engineers):* **5 GP**
- *Tier 2 (CI/CD Autopilot, Prompt Crafters):* **25 GP**
- *Tier 3 (Architect Archetypes, Merge Conflict Shield):* **100 GP**
- **Layer 2 Cost Multiplier ($\kappa$):** **1.75**

### 14.6 Multi-layer prestige reciprocal modifiers

To preserve progression momentum after a Layer 2 reset, a percentage of your sacrificed BP
is returned as a permanent passive multiplier to base cash production ($M_{cash}$) in all
future runs:

$$M_{cash} = 1 + \omega \cdot \left( \frac{\text{BP}_{sacrificed}}{10^{6}} \right)^{0.8}$$

- **Cash Boost Coefficient ($\omega$):** **0.15** — ensures that resetting Layer 1 power to
  gain Layer 2 perks actually *speeds up* your early-game recovery time back to millions of
  developers.

### 14.7 Multi-layer cost scaling summary

| Layer | Currency | Reset Threshold | Yield Formula Scaling |
|---|---|---|---|
| **L1: Paradigm Shift** | Bandwidth Points (BP) | Max Entropy Stall / Run Fail | $\propto (\$_{total})^{0.20} \cdot \log_{10}(D_{peak})$ |
| **L2: Codebase Fork** | Git Points (GP) | **100,000,000 Devs** | $\propto \sqrt{\text{Total BP Sacrificed}}$ |
| **L3: Multiverse Compiler** | Planck Cores (PC) | 1 Release per $t_P$ ($5.39\times10^{-44}$ s) | $\propto \log_{2}(\text{Universes Rendered / sec})$ |

---

## 15. Prestige UI Wireframes

Both prestige screens maintain the core philosophy: **semi-transparent, HUD-style overlays
rendered directly over a blurred, pulsing view of your high-entropy dev swarm.**

### 15.1 Layer 1 screen — Paradigm Shift Talent Tree

```
+---------------------------------------------------------------------+
| [← SWARM VIEW]         PARADIGM SHIFT HUB              [ BANDWIDTH: ]|
|                          "REWRITE THE CORE"            [ 14,250 BP  ]|
+---------------------------------------------------------------------+
| CURRENT RUN RUNTIME: 42m 18s              PEAK DEVS: 1.2M           |
| UNPAID ENTROPY PENALTY: 92%               PENDING PRESTIGE: +1,850 BP|
+---------------------------------------------------------------------+
|                                                                     |
|  [ TAB 1: TALENT TREE ]     [ TAB 2: RUN STATS ]     [ SHIFT NOW! ] |
|  ====================                                               |
|                                                                     |
|  +---------------------------------------------------------------+  |
|  |                    [ CORE PARADIGM NODE ]                     |  |
|  |                             (0)                               |  |
|  |            +-----------------+------------------+             |  |
|  |            ▼                                    ▼             |  |
|  |      [ASYNC MASTERY]                   [PROTOCOL ENGINE]      |  |
|  |            (I)                                (I)             |  |
|  |       +----+----+                        +-----+-----+        |  |
|  |       ▼         ▼                        ▼           ▼        |  |
|  | [ASYNC-FIRST] [MEETING BAN]        [TELEPATHIC] [CHAINED POKE]|  |
|  |     (II)          (II)                 (II)         (II)      |  |
|  |       |            |                     |            |       |  |
|  |       ▼            ▼                     ▼            ▼       |  |
|  |   [ZERO-TRUST ARCHITECTURE]      [SUBATOMIC AUTO-POKER]       |  |
|  |            (III)                          (III)               |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+---------------------------------------------------------------------+
| SELECTED NODE: Telepathic Compression (Lvl 3/10)                    |
| EFFECT: +3,000x Effective Dev Capacity before Entropy.              |
| NEXT LEVEL COST: 250 BP                        [ UPGRADE NODE ]     |
+---------------------------------------------------------------------+
```

#### Interactive node states & visual language

Nodes in the Paradigm Shift tree are rendered in pixel-art node frames with distinct
visual states:

```
[ UNLOCKED / MAXED ]      [ AVAILABLE / READY ]      [ LOCKED / NO BP ]
  +-----------+             +-----------+              +-----------+
  | [★] [★]   |             | [★] [ ]   |              | [ ] [ ]   |
  | ASYNC     |             | TELEPATHIC|              | ZERO-TRUST|
  | LVL 2/2   |             | LVL 1/5   |              | REQ: BP   |
  +-----------+             +-----------+              +-----------+
  (Glowing Cyan)            (Pulsing Gold)             (Dim Grey Wire)
```

- **Node status colors:**
  - **Gold Glow:** ready to purchase (player has enough Bandwidth Points).
  - **Neon Cyan:** fully maxed-out node.
  - **Dimmed Grey:** locked (prerequisites not met or insufficient BP).
- **Connection Cables:** pixel data wires link the nodes. Unlocked pathways pulse with
  neon blue energy particles travelling downward toward deeper tiers.

#### Node detail inspector (slide-out panel)

When a player taps any node in the tree, a bottom drawer slides up smoothly with dynamic
node information:

```
+---------------------------------------------------------------------+
| [X] TELEPATHIC COMPRESSION                        TIER II PROTOCOL   |
+---------------------------------------------------------------------+
| "Compress developer thought-packets to bypass physical speech space."|
|                                                                     |
| CURRENT EFFECT:                                                     |
| • Effective Dev Capacity (D_cap): 1,000,000 Devs                    |
|                                                                     |
| NEXT LEVEL (LVL 4/10):                                              |
| • Effective Dev Capacity (D_cap): 10,000,000 Devs (+9,000,000)      |
|                                                                     |
| COST: 250 BP                                    CURRENT BP: 14,250  |
|                                                                     |
|                      [ PURCHASE LEVEL 4 ]                           |
+---------------------------------------------------------------------+
```

#### Execution modal — "Trigger Paradigm Shift"

To make the prestige action feel weighted and satisfying, tapping `[ SHIFT NOW! ]`
triggers a full-screen confirmation overlay over the active swarm:

```
+---------------------------------------------------------------------+
|                 [!] INITIATE PARADIGM SHIFT [!]                    |
+---------------------------------------------------------------------+
| You are about to liquidate your studio and rebuild under a new      |
| architectural paradigm.                                             |
|                                                                     |
| WHAT YOU SACRIFICE:                                                 |
| [-] 1,200,000 Active Developers                                      |
| [-] $4.2 Trillion Current Cash                                       |
| [-] In-Run Office Infrastructure                                     |
|                                                                     |
| WHAT YOU EARN:                                                      |
| [+] +1,850 Bandwidth Points (BP)                                     |
| [+] Unlock Tier III Paradigm Tree Nodes                              |
|                                                                     |
|                  [ ABORT ]    [ REWRITE CODEBASE ]                  |
+---------------------------------------------------------------------+
```

When `[ REWRITE CODEBASE ]` is confirmed, a **CRT monitor reboot animation** wipes the
screen, the camera zooms into a single pixel desk, and the new run begins with permanent
BP perks applied.

### 15.2 Layer 2 screen — Codebase Fork Terminal

Overlays a semi-transparent dark terminal HUD over a blurred, pulsing view of your
100,000,000+ developer swarm map.

```
+---------------------------------------------------------------------+
| [← SWARM VIEW]        CODEBASE FORK TERMINAL          [ GIT POINTS: ]|
|                         "FORK THE LINEAGE"            [ 45 GP      ] |
+---------------------------------------------------------------------+
| SACRIFICED BP: 2.5M                     TOTAL FORKS: 3              |
| HERO CLASS ACTIVE: 10x Dev (Lvl 2)      PENDING YIELD: +18 GP       |
+---------------------------------------------------------------------+
|                                                                     |
|  [ TAB 1: HERO LINEAGES ]   [ TAB 2: AUTOMATION ]  [ FORK CODEBASE ]|
|  ========================                          ================ |
|                                                                     |
|  +---------------------------------------------------------------+  |
|  |                   [ CODEBASE FORK ORIGIN ]                    |  |
|  |                             (0)                               |  |
|  |            +-----------------+------------------+             |  |
|  |            ▼                                    ▼             |  |
|  |    [HERO CLASS LINEAGE]              [WORKFORCE AUTOMATION]   |  |
|  |            (I)                                (I)             |  |
|  |      +-----+------+                     +------+------+       |  |
|  |      ▼            ▼                     ▼             ▼       |  |
|  | [10x ENGINEERS] [PROMPT CRAFTERS]  [AUTO MERGING] [CI/CD AUTO]|  |
|  |     (II)             (II)               (II)          (II)    |  |
|  |      |                |                  |             |      |  |
|  |      ▼                ▼                  ▼             ▼      |  |
|  | [ARCHITECT ARCHETYPE]              [MERGE CONFLICT SHIELD]    |  |
|  |        (III)                                (III)             |  |
|  +---------------------------------------------------------------+  |
|                                                                     |
+---------------------------------------------------------------------+
| SELECTED NODE: 10x Engineers (Lvl 2/5)                              |
| EFFECT: 2% chance per hire to spawn 10x Dev (10x Speed, 0 Entropy). |
| NEXT LEVEL COST: 15 GP                        [ UPGRADE NODE ]      |
+---------------------------------------------------------------------+
```

#### Visual style & node aesthetics

Nodes in the Codebase Fork tree resemble **Git commit nodes** along branch lines, using
distinct pixel-art status indicators:

```
[ MAXED / MERGED ]        [ AVAILABLE FORK ]         [ LOCKED BRANCH ]
  +-----------+             +-----------+              +-----------+
  | (●) (●)   |             | (●) (○)   |              | (○) (○)   |
  | 10x DEVS  |             | AUTO-MERGE|              | ARCHITECT |
  | LVL 5/5   |             | LVL 1/2   |              | REQ: GP   |
  +-----------+             +-----------+              +-----------+
  (Git-Green Glow)          (Amber Branch)             (Grey Outline)
```

- **Node status colors:**
  - **Git-Green (Glow):** unlocked & active node.
  - **Amber / Orange:** available for fork purchase with current GP.
  - **Dimmed Wireframe:** locked until prerequisite commit nodes are merged.
- **Branch Cables:** stylized as Git branch lines (`main`, `feature/hero-classes`,
  `feature/automation`) that light up with green data pulses as nodes are unlocked.

#### Node detail inspector

```
+---------------------------------------------------------------------+
| [X] 10x ENGINEERS                                 HERO CLASS TIER II |
+---------------------------------------------------------------------+
| "A rare developer breed that writes code 10x faster with 0 Entropy, |
|  but rage-quits the company if poked by the player."                |
|                                                                     |
| CURRENT EFFECT:                                                     |
| • Spawn Chance: 2% per developer hired                              |
| • Speed Multiplier: 10x                                             |
|                                                                     |
| NEXT LEVEL (LVL 3/5):                                               |
| • Spawn Chance: 3% (+1%)                                            |
|                                                                     |
| COST: 15 GP                                     CURRENT GP: 45 GP   |
|                                                                     |
|                     [ MERGE COMMIT (15 GP) ]                        |
+---------------------------------------------------------------------+
```

#### Execution modal — "Confirm Codebase Fork"

When the player taps `[ FORK CODEBASE ]`, a modal window pops up with a git terminal
animation:

```
+---------------------------------------------------------------------+
|                    >>  `git checkout -b fork/v2.0`                 |
+---------------------------------------------------------------------+
| You are about to execute a Layer 2 Codebase Fork.                   |
| This will reset your Layer 1 Bandwidth Points and Paradigm Tree.     |
|                                                                     |
| WHAT YOU SACRIFICE:                                                 |
| [-] All Active Developers & In-Run Cash                              |
| [-] 14,250 Bandwidth Points (BP)                                     |
| [-] Unlocked Layer 1 Paradigm Tree Perks                             |
|                                                                     |
| WHAT YOU EARN & KEEP:                                               |
| [+] +18 Git Branch Points (GP)                                       |
| [+] Permanent Cash Multiplier Boost (+35%)                           |
| [+] All Unlocked Hero Lineages & CI/CD Autopilot Perks               |
|                                                                     |
|                   [ CANCEL ]    [ FORK & HARD RESET ]               |
+---------------------------------------------------------------------+
```

---

## 16. Endgame: The Planck Time Speed Barrier

Once the player crosses **the 100,000,000 gate** (§13.5) — 100 million developers at 100%
efficiency — software production breaks the laws of physics. They complete the main story
arc by launching **"Simulated Universe 1.0."**

Crossing the gate does three things at once:

1. **Ends the main story arc.** *Simulated Universe 1.0* ships. Credits, if you want them.
2. **Unlocks the Layer 2 Codebase Fork** (§13.3) — the game's second prestige layer.
3. **Opens the road to Layer 3**, which is no longer gated on headcount at all but on
   *speed*: driving release frequency down to one project per Planck time.

```
[Release/Sec] → [Release/Microsec] → [Release/Nanosec] → [1 Project per Planck Time (t_P)]
```

### 16.1 The Planck Paradox mechanics

- **Planck Limit Cap:** at 1 release per $t_P$, the physical universe can no longer render
  new software because code executes faster than light can traverse a single Planck length
  ($1.62 \times 10^{-35}$ m).
- **Dimensional Collapse Event:** the release button begins vibrating at subatomic
  frequencies. Holding it down collapses space-time, transitioning the game into
  **Multiverse Engine Mode**.

### 16.2 Multiverse Engine Mode (Infinite Replayability)

- **Metric Shift:** currency shifts from Dollars ($) to **Universes Rendered Per Second (UR/s)**.
  Projects are completed in Planck time ($\le 10^{-43}$ s). The core metric becomes
  **Universes Rendered Per Second**.
- **Multiverse Studio Expansion:** unlocks parallel dimensional studios running
  simultaneously (e.g. *Cyberpunk Dimension*, *Medieval Alchemy Coders*, *Silicon Nebula*).
- **Parallel Dev Swarms:** manage simultaneous alternate-reality studios:
  - *Cyberpunk Sub-Grid* (high speed, volatile entropy surges)
  - *8-Bit Retro Realm* (low entropy cap, high revenue efficiency)
  - *Quantum Cosmic Hive* (runs on zero latency, susceptible to Solar Flares)
- **Galactic Entropy Events / Disasters:** solar flares, cosmic ray bit-flips, and
  inter-dimensional ping delays create continuous, procedural active challenges across the
  star map that require active player intervention.

---

## 17. Endgame Multiverse Dimension Themes

Each dimension alters the core visual aesthetic, music style, and gameplay parameters
while testing different aspects of the player's entropy management.

### 17.1 Cyberpunk Sub-Grid
- **Visual Aesthetic:** high-contrast neon pink and cyan pixel art, rainy futuristic
  cityscape, holographic billboards displaying real-time bug counts and memory leaks.
- **Audio Profile:** fast-paced darksynth / synthwave with heavy bass drops on project releases.
- **Mechanical Twist — High Latency, High Yield:** base developer typing speed is
  multiplied by **10×**, but unpredictable **Cyber-Attacks** trigger sudden **99% entropy
  spikes** that require active swipe-to-purge gestures across the screen.
- **Dimension Signature Mod:** *Overclocked Memory* — increases release revenue by
  **+300%**, but developer burnouts happen twice as fast.

### 17.2 8-Bit Retro Realm
- **Visual Aesthetic:** monochromatic green-screen CRT or 4-color palette, chunkier low-res
  pixel sprites, floppy disk icons replacing cloud saves.
- **Audio Profile:** chiptune 8-bit square wave arpeggios with classic retro sound effects.
- **Mechanical Twist — Ultra-Low Memory Cap:** max dev count is restricted to **640 KB**
  equivalent (**256 devs per office block**), but **Communication Entropy decays 80%
  slower** due to simple assembly architectures.
- **Dimension Signature Mod:** *Assembly Optimizer* — every poke boosts developer output by
  **+200% for 15 seconds**.

### 17.3 Medieval Alchemy Coders
- **Visual Aesthetic:** stone castles, candle-lit libraries, monks in robes transcribing
  code onto parchment scrolls with quills, alchemy labs processing "Coffee Potions."
- **Audio Profile:** Gregorian chants mixed with lutes and harpsichords.
- **Mechanical Twist — Spellcast Compilation:** projects take longer to start, but
  completing a project triggers a **Mass Incantation** that auto-completes the next
  **10 projects** instantly.
- **Dimension Signature Mod:** *Philosopher's Compiler* — converts excess Communication
  Entropy directly into gold revenue.

### 17.4 Silicon Nebula (Zero-Point Cosmos)
- **Visual Aesthetic:** star clusters, space stations, developers floating in zero-g pods
  linked by glowing fiber-optic laser beams spanning solar systems.
- **Audio Profile:** atmospheric ambient space drone with digital telemetry beeps.
- **Mechanical Twist — Interstellar Latency:** physical distance between planetary hives
  creates light-speed communication delays. Players must actively upgrade **Sub-Space
  Quantum Relays** to synchronize galactic releases.
- **Dimension Signature Mod:** *Cosmic Ray Flips* — randomly corrupts or instantly
  completes active project modules.

### 17.5 Paperwork Bureaucracy Realm
- **Visual Aesthetic:** sepia-toned beige cubicle farm spanning infinitely into the
  horizon, fluorescent light flicker, mountains of physical paper and stamp pads.
- **Audio Profile:** muffled typewriter clacks, elevator jazz, rubber stamps thumping.
- **Mechanical Twist — Stamp-Approval Loop:** every project release requires manual "Red
  Stamp" approvals. Tapping stamps speeds up releases by **1000×**, automating paperwork
  through middle-management upgrades.
- **Dimension Signature Mod:** *Triple-Carbon Copy* — every completed project awards **3×
  base payout**.

### 17.6 Post-Singularity Hivemind
- **Visual Aesthetic:** abstract geometric void, glowing wireframe matrices, developers
  merged into a single pulsing energy core.
- **Audio Profile:** minimalist pulse drone and ethereal chime soundscapes.
- **Mechanical Twist — Zero Entropy, Absolute Automation:** Communication Entropy is
  permanently **0%**, but the total workforce demands massive **Planck Core Energy** to
  sustain velocity without collapsing into a black hole.
- **Dimension Signature Mod:** *Singularity Event* — sacrifices **10% of current swarm** to
  instantly generate **1 hour of offline revenue**.

---

## 18. Random Events Library

### 18.1 Early Game (1 – 100 Devs)

*Relatable indie dev headaches scaled up just enough to be ridiculous.*

#### ☕ The Cold Brew Spill
> *"Dev #4 spilled nitro cold brew on the primary server rack. It rusted immediately, but somehow frame rates increased by 15%."*
- **Choice A [Absorb the Rust]:** gain +10% Dev Speed for 30s.
- **Choice B [Clean It Up]:** lose $500, gain +1 morale point (which does nothing).

#### 🐛 "It Works On My Machine"
> *"A critical bug is causing physics to invert. Senior Dev #12 refuses to fix it because it runs fine on their custom Linux build."*
- **Choice A [Force Push to Production]:** instant release, but 20% chance to trigger a $0 revenue build.
- **Choice B [Buy them another monitor]:** costs $1,000. Resolves the issue instantly.

#### 🍕 Free Pizza Disaster
> *"You ordered 400 pepperoni pizzas. The delivery driver took 4 hours, and the dev team has devolved into a hunter-gatherer society in the breakroom."*
- **Effect:** production drops by 50% for 60 seconds while they digest.

### 18.2 Mid Game (10,000 – 1,000,000 Devs)

*Corporate dystopia meets hyper-scale software absurdity.*

#### 💬 `@everyone` Mention Catastrophe
> *"A junior intern typed `@everyone who wants boba?` in the primary Slack channel with 500,000 engineers tagged."*
- **Effect: Slack Noise Storm!** Tap 20 notification bubbles in 5 seconds to prevent production from freezing entirely.

#### 💬 AI Wrote the Entire Backend
> *"Your automated code generation script got stuck in an infinite loop and accidentally coded an entire working sequel to your game in 0.003 seconds."*
- **Effect:** instant +$100M revenue bonus, but the game engine background color permanently turns neon pink.

#### 🪑 Desk Shortage
> *"You hired 50,000 developers today, but the building only has 400 chairs. Engineers are now coding while sitting on each other's shoulders."*
- **Choice A [Stack 'em Higher]:** +5% Devs efficiency, −10% safety rating.
- **Choice B [Work From Home]:** removes the physical desk limit forever, but dev latency increases by 0.0001s.

### 18.3 Late Game (1,000,000,000+ Devs)

*Cosmic-scale absurdity where coding breaks the laws of physics.*

#### 🌌 Gravity Distortion
> *"You have crammed so many developers into Silicon Valley that their combined physical mass has created a localized gravitational singularity."*
- **Effect:** time slows down locally. Project timers tick 2× faster relative to universal time for 2 minutes.

#### 📜 The 400-Billion-Page Documentation
> *"Your documentation server became self-aware, read its own guidelines, and filed a formal grievance with human resources."*
- **Choice A [Promote the Docs to VP]:** costs 10 Trillion cash; boosts all passive multipliers by 15%.
- **Choice B [Delete `docs/` folder]:** production resumes immediately. Nobody reads docs anyway.

#### ⚡ Quantum Stack Overflow
> *"Your dev swarm copy-pasted a snippet from Stack Overflow so many times that the universe's memory buffer ran out."*
- **Effect:** reality stutters. All current project progress instantly fills to 100%, but all dev icons briefly turn into pixelated ducks.

### 18.4 Sprint & Story Point Events

*Events that act on the burn-down chart directly. These are the clicker layer's pressure
valves — they cost nothing to build and they are the most viscerally recognisable jokes in
the game to the target audience.*

#### 📈 Scope Creep
> *"The stakeholder saw a demo. They loved it. They have some small ideas."*
- **Effect:** the active Sprint Commitment **increases by 20–40%** mid-sprint. The
  burn-down line jumps *upward*, which is the single most annoying thing this game can do
  to a developer, and it is free.
- **Choice A [Absorb It]:** accept the new commitment.
- **Choice B [Push to Next Sprint]:** commitment unchanged, but the deferred points are
  added to your *next* project, compounding if you keep deferring.

#### 🃏 Re-Estimation Meeting
> *"The team has gathered to argue about whether this is a 5 or an 8. It is neither. It is four hours."*
- **Effect:** all poking is disabled for 20 seconds, after which the Fibonacci ladder
  (§4.6) is **temporarily raised by one tier for 2 minutes**.

#### 🎯 Velocity Review
> *"Leadership has noticed your velocity dipped last sprint and would like to understand why."*
- **Trigger:** fires when passive Velocity drops more than 40% below its recent peak.
- **Choice A [Explain the Entropy]:** nothing happens. Nobody understood.
- **Choice B [Inflate the Numbers]:** displayed Velocity **+50%**, actual output unchanged,
  and the next Scope Creep event is **guaranteed** because expectations are now higher.

#### ✅ Definition of Done Dispute
> *"QA says it isn't done. Engineering says it's done. Product has left the building."*
- **Effect:** the project sits at **99% burned down** and will not ship until the player
  manually pokes **20 developers in 10 seconds** to force the last point through.

### 18.5 Recurring Passive Events (Ticker Tape / News Banner)

These scroll across the top of the UI during normal gameplay to keep the humor constant:

- *"Developer #8,491,204 claims they can fix the bug in 5 minutes. It has been 6 years."*
- *"Breaking: Local coffee shop runs out of oat milk; global software production dips 40%."*
- *"Engineers implement dark mode for the office lighting; productivity skyrockets."*
- *"Quantum computer successfully renders a single blade of grass in 8K; explodes immediately."*
- *"Company motto changed from 'Move Fast and Break Things' to 'Throw People at It Until It Works'."*

### 18.6 Multiverse Dimension Random Events

#### Cyberpunk Sub-Grid — ⚡ Netrunner Memory Leak
- **Trigger:** spawns during high-velocity compilation runs.
- **Popup:** *"A rogue netrunner tried to pirate your physics engine midway through compilation. They got stuck in an infinite `while(true)` loop and are currently consuming 80% of the subnet's VRAM."*
- **Choice A [Isolate & Quarantine]:** purges the memory leak. Clears local entropy, but delays active project completion by 1.0s.
- **Choice B [Weaponize the Leak]:** +200% Dev Output for 15s, but triggers a guaranteed **Cyber-Attack** event immediately after.

#### 8-Bit Retro Realm — 💾 Floppy Disk Magnet Exposure
- **Trigger:** spawns randomly upon hitting maximum memory capacity.
- **Popup:** *"Senior Dev #3 left a novelty fridge magnet on top of the primary 5.25" floppy master drive. Half the codebase is now rendered in gibberish wingdings."*
- **Choice A [Blow on the Disk Cartridge]:** 50% chance to fix it instantly (+100% speed); 50% chance to wipe current project progress to 0%.
- **Choice B [Rewrite in Assembly]:** costs $5,000 in-run cash; permanently increases local dev density cap by +32 KB.

#### Medieval Alchemy Coders — 🧪 The Philosopher's Null Pointer
- **Trigger:** spawns during active Mass Incantation compilation phases.
- **Popup:** *"An alchemist accidentally spilled Lead-to-Gold Transmutation Solution into the scrying bowl. The compiler is now converting all software bugs into pure bullion."*
- **Effect (Passive Event):** for the next 30s, clearing entropy nodes generates **Gold Revenue equal to 5× base project payout**, but all developer quills burn out (20% temporary typing speed slowdown).

#### Silicon Nebula — ☀️ Solar Flare Bit-Flip
- **Trigger:** spawns across interstellar laser relay paths.
- **Popup:** *"A class-M solar flare struck Orbital Hive Pod #4. A single cosmic ray bit-flip inverted a minus sign in the gravitational constant."*
- **Choice A [Reroute Sub-Space Relays]:** costs 500 BP. Restores orbital signal stability instantly.
- **Choice B [Ship It As A Feature]:** replaces physics with inverted gravity. Releases the project immediately as *"Space Flappy Simulator"* for a **10× short-term viral revenue spike**.

#### Paperwork Bureaucracy Realm — 📄 TPS Report Triplicate Glitch
- **Trigger:** spawns when middle-management automation is active.
- **Popup:** *"Bureaucrat Level 42 filed Form 1099-B in triplicate, causing an infinite bureaucratic feedback loop. The entire planetary sector is frozen waiting for a blue ink signature."*
- **Effect: Stamp Frenzy Mini-Game!** A giant rubber stamp overlay covers the screen. Tap/Stamp the screen **15 times in 5 seconds** to approve the backlog and unlock a **+500% revenue multiplier for 1 minute**.

#### Post-Singularity Hivemind — 🤖 The Self-Aware Subroutine
- **Trigger:** occurs when approaching Planck-time release speeds ($t_P$).
- **Popup:** *"Subroutine #94,812,001 realized it is inside an idle game, calculated the existential absurdity of shipping software in planck time, and filed for a union break."*
- **Choice A [Grant Sentience Bonus]:** sacrifices 1% of total swarm energy; grants a permanent **+5% production efficiency** across all parallel dimensions.
- **Choice B [Force Garbage Collection]:** deletes the sentient subroutine. Restores processing speed immediately, but causes screen sprites to briefly flicker into glitching code artifacts.

---

## 19. Desk Query Dialogue Library

These appear in a semi-transparent pixel-thought-bubble when tapping a developer at
**Level 1 Zoom (Desk View)**, varying by developer status and local entropy level.

### 19.1 Slacking / Distracted State (Pokeable Boost Opportunities)

*Lines spoken when a developer is playing games, browsing retro forums, or avoiding work.*

- *"If I compile this empty loop 50 times, it looks like my CPU is under heavy load."*
- *"Just refactoring my terminal color scheme to look more 'hacker-esque'."*
- *"I've been stuck on Level 4 of 'Flappy Pixel' for two hours. Don't look at my screen."*
- *"Writing a script that automatically sends a random Slack message every 12 minutes so I look active."*
- *"I'm not slacking, I'm waiting for my coffee to cool to optimum code-writing temperature."*
- *"If anyone asks, I'm doing deep architectural research on Reddit."*

### 19.2 High Communication Entropy / Overwhelmed State

*Lines spoken when notification pings, `@everyone` tags, or meeting locks overload the dev.*

- *"WHO TAGGED `@everyone` IN THE `#random` CHANNEL FOR FREE BAGELS?!"*
- *"I have 4,812 unread Slack messages and 14 overlapping calendar invites for right now."*
- *"We are having a meeting to discuss why we have too many meetings."*
- *"I just spend 45 minutes resolving a merge conflict that added a single missing semicolon."*
- *"Someone changed the API spec while I was typing the function call."*
- *"My brain is 99% noise, 1% syntax error."*

### 19.3 Focused / Flow State

*Lines spoken when typing at max efficiency (glowing pixel stars around head).*

- *"Do not speak to me. I have the entire database schema cached in my active memory."*
- *"The code is writing itself. I am merely a vessel for pure logic."*
- *"100,000 lines written. Zero bugs. Don't run the compiler yet though."*
- *"I've ascended past stack traces. I can hear the binary floating through the air."*
- *"Type type type ship ship ship. We publish in 0.00001 seconds!"*

### 19.4 Rogue Refactorer Event

*Lines spoken when a dev is secretly breaking the build by rewriting core systems.*

- *"Everything was working, so I decided to rewrite the entire engine in a language I made up yesterday."*
- *"Object-oriented programming is a myth. I am converting all variables into a single multi-dimensional array."*
- *"Deleting the documentation folder saved us 4 megabytes of storage space. You're welcome."*
- *"I found a 10-year-old legacy function and deleted it. Surely nothing depended on that."*

### 19.5 Late-Game AI Slop Era (1,000,000,000+ Devs)

*Lines spoken when developers are managing/prompt-engineering chaotic LLM output.*

- *"The AI generated 40,000 lines of code. It works, but it summoned a pixel demon in the UI."*
- *"I asked the LLM to fix a bug and it wrote a 500-page fantasy novel instead."*
- *"I'm an engineer whose sole job is prompting another AI to review code written by a third AI."*
- *"The codebase is sentient now. It just requested a 401(k) match."*

### 19.6 Special Class Lines

**10x Engineer**
- *"I wrote the feature before the product manager finished typing the requirement."*
- *"I don't test my code. Production tests my code."*
- *"Don't poke me. My time costs $500 a second."*

**Quantum Prompt Crafter**
- *"Synthesizing 10 billion lines of code per microsecond. Please pass the nitro brew."*
- *"I don't write syntax anymore. I just whisper intentions into the quantum core."*

### 19.7 Direct "Poke" Dynamic Responses

*Short text popups that trigger instantly when the player taps the dev sprite.*

| Context | Lines |
|---|---|
| **Normal Tap** | *"Gah! Back to work!"* / *"Typing faster!"* / *"click click click"* |
| **Caffeinated Boost** | *"SPEED MAXIMUM!"* / *"I CAN SEE THE CODE IN 4D!"* |
| **Poke While Overwhelmed** | *"Stop poking, my Slack is exploding!"* / *"ANOTHER PING?!"* |
| **Poke While Rogue** | *"Fine! I'll put the legacy code back!"* |
| **Poke During Entropy Lock** | *"Poking me again isn't making the meeting end sooner."* / *"I am in four meetings right now."* |
| **Poke a 10x Engineer** | *"That's it. I'm going to a startup."* |

### 19.8 Story Point Estimation Lines

*Spoken alongside the floating SP numeral when the player pokes. Weight these so the
absurd ones are rare — the joke is the arbitrariness of the estimate, and it lands best
when it interrupts an otherwise ordinary rhythm.*

- *"It's a three. Maybe a five. It's a five."*
- *"Two points. But that's assuming the API works, which it does not."*
- *"Eight. I'm saying eight because thirteen makes people ask questions."*
- *"One point! ...it's going to take four days."*
- *"I'd rather not estimate this until I've seen the requirements."* → yields **0 SP**
- *"Twenty-one. I have no idea what this ticket means and neither do you."*
- *"Half a point. I already did it last week and forgot to close the ticket."*
- *"Points aren't hours. Please stop converting them to hours."*
- *"Same as the last one. The last one took a month."*
- *"Can we call it a spike?"*

---

## 20. Audio Design Specification: Dynamic Camera Zoom

### 20.1 System architecture & mixing philosophy

The audio system uses a **4-Tier Reactive Crossfade Matrix** linked directly to the
camera's continuous zoom distance parameter ($Z \in [0.0, 1.0]$).

Instead of simple volume fading, zooming morphs sound using **Dynamic Low-Pass/High-Pass
Filtering (DSP)**, **Binaural Panning**, and **Granular Density Scaling**.

```
[ZOOM LEVEL 0: Desk]  ── (Crossfade / Filter) ──▶  [ZOOM LEVEL 1: Floor]
        |                                                  |
 (Crossfade / Filter)                              (Crossfade / Filter)
        ▼                                                  ▼
[ZOOM LEVEL 2: Global] ── (Crossfade / Filter) ──▶ [ZOOM LEVEL 3: Galactic]
```

### 20.2 Layered audio zones & sound palettes

#### Zone 0: Micro / Desk Level ($Z: 0.0 - 0.2$)
- **Aesthetic Focus:** intimate, tactile, mechanical, low-latency.
- **Core Loop Stems:**
  - **Tactile Foley:** clack of mechanical switches (Cherry MX Blues), mouse clicks, desk squeaks.
  - **Faint Ambiance:** soft PC fan hum, low-level fluorescent light buzzing, coffee cup slurps.
- **DSP Processing:** high-pass filter cut at **120 Hz** to prevent low-end muddying. Wide
  stereo field centered around the targeted developer's desk.

#### Zone 1: Mid / Office Floor Level ($Z: 0.2 - 0.5$)
- **Aesthetic Focus:** chaotic corporate drone, overlapping clutter, high notification frequency.
- **Core Loop Stems:**
  - **Chatter Swarm:** muffled room chatter, overlapping keyboard tap clouds (multiplied by active dev count).
  - **Notification Layer:** layered Slack/Discord pings, ringing VoIP lines, whiteboards squeaking.
- **DSP Processing:** low-pass filter set to **8 kHz** when zoomed slightly out to simulate
  acoustic room dampening. Band-pass filtering scales with Communication Entropy ($E$).

#### Zone 2: Macro / Global Grid Level ($Z: 0.5 - 0.8$)
- **Aesthetic Focus:** high-tech data streams, rhythmic telemetry, digital resonance.
- **Core Loop Stems:**
  - **Data Streams:** modular synth arpeggios, pulsing fiber-optic telemetry hums, server room air conditioning rumbles.
  - **Global Activity:** soft sub-bass pulses when major city sectors update.
- **DSP Processing:** heavy stereo narrowing toward the center, spatial reverb tail
  increase (**3.5s decay time**).

#### Zone 3: Cosmic / Inter-Galactic Level ($Z: 0.8 - 1.0$)
- **Aesthetic Focus:** massive cosmic scale, existential synth pads, sub-atomic telemetry.
- **Core Loop Stems:**
  - **Space Drone:** low sub-bass sine wave (**30 Hz – 60 Hz**) mixed with ethereal cosmic pads.
  - **Relay Telemetry:** ultra-high frequency digital blips and laser pulse pings representing interstellar releases.
- **DSP Processing:** reverb wet mix at **80%**. Pitch modulation tied to camera movement velocity.

### 20.3 Dynamic zoom audio curves (DSP matrix)

As the camera zooms ($Z$), volume levels and filter cutoff frequencies transition
dynamically according to mathematical curves:

```
VOLUME (dB)
  0 dB ─┐                                    ┌── Zone 3 (Cosmic)
        │ \   Zone 0 (Desk)   Zone 2 (Global) /
        │  \      /\               /\        /
 -12 dB ─┤   \   /  \  Zone 1     /  \      /
        │    \ /    \ (Floor)    /    \    /
 -80 dB ─┴─────X──────X──────X──────X──────X───────
      Z:  0.0   0.25   0.55   0.75   1.00  (Camera Zoom Z)
```

**Parameter mapping equations:**

1. **Low-Pass Filter Cutoff ($f_{LPF}$) for Desk Layer:**

$$f_{LPF}(Z) = 20000 \cdot (1 - Z)^{2.5} + 200 \ \text{Hz}$$

*(Dulls desk sounds instantly as the camera zooms out.)*

2. **Reverb Wet/Dry Ratio ($R_{wet}$):**

$$R_{wet}(Z) = \min\left(1.0,\ 0.1 + 0.85 \cdot Z^{1.8}\right)$$

*(Drenches audio in spacious reverb at galactic scales.)*

### 20.4 Rapid zoom "Doppler & Whoosh" juice effects

Rapidly pinching or releasing the zoom wheel triggers transitional "Game Juice" audio events:

- **Inward Rapid Zoom (Galactic → Desk):**
  - **Sound Effect:** high-to-low pitch frequency sweep ("Reverse Air-Thump" + down-pitched laser chirp).
  - **DSP Trigger:** brief pitch-bend downward (**−300 cents**) on master audio for **150 ms**.
- **Outward Rapid Zoom (Desk → Galactic):**
  - **Sound Effect:** low-to-high suction "Whoosh" with low-end sub drop.
  - **DSP Trigger:** sudden high-pass filter sweep (**100 Hz → 4 kHz**) over **200 ms**, resolving into ambient space pads.

### 20.5 Poking & interactive audio feedback

Poking a developer triggers distinct sound effects based on the current camera zoom level ($Z$):

| Zoom Zone | Sound Effect Description | Synthesis Parameters |
|---|---|---|
| **Desk ($Z < 0.2$)** | Sharp mechanical keycap click + startled "Eep!" or coffee cup clink. | FM synthesis (high transient click, 2.4 kHz). |
| **Floor ($Z < 0.5$)** | Pop-filter bubble burst + group chatter dip for 0.5s. | Band-passed noise burst (800 Hz). |
| **Global ($Z < 0.8$)** | Digital sonar ping with sub-bass thump. | Sine wave sweep (440 Hz → 110 Hz). |
| **Cosmic ($Z \ge 0.8$)** | Subatomic laser pulse with long shimmer delay tail. | Granular reverb shimmer (+12 semitones). |

### 20.6 Sound & visual polish summary

- **Audio Dynamics:** smooth audio crossfading attached to the camera zoom depth.
  - *Micro Zoom:* keyboard clacks, slurping coffee, soft synth hum.
  - *Floor Zoom:* muffled office chatter, endless notification pings.
  - *Macro/Galactic Zoom:* deep space ambient drone with high-speed digital telemetry sounds.
- **Haptic Feedback:** short, snappy vibration bursts when popping Slack pings or poking developers.

---

### 20.7 Music — Hard Cap **[CANON]**

**§20.1–20.6 specify ambience, foley and DSP. They do not specify music, and until this
section existed the game had none.** The word appeared four times in this document, twice of
which were §10.8 saying it must not restart.

That was a real gap with three things already depending on it: §10.8 F3 makes silence a
FAIL and demands music that is continuous and reactive; §21 Act IV's central beat is *"cozy
lofi music abruptly cuts out"* — which subtracts nothing if there was never any lofi; and
§17 says each Multiverse dimension "alters music style", which is unbounded scope on the
most expensive asset class in the project.

#### 20.7.1 One adaptive score, not a playlist **[CANON]**

**The game has no tracks. It has stems.** §20.1's architecture is a four-zone crossfade bus
and §10.8 F3 forbids a restart on any screen change — both of which rule out a playlist. A
track that swaps is a cut, and §10.5 says nothing cuts.

So the score is a set of loops that are **all playing, all the time**, at volumes the
simulation sets. The player never hears a transition because there never is one; they hear
the mix change.

**The rule that makes this work, and it is the single most important line in this section:**

> **Every stem is written in the same key, at the same tempo, in the same bar length.**

`A minor, 84 BPM, 8-bar loops.` Any stem can be faded against any other at any moment with
no beat-matching, no transition bar, and no crossfade artefact. **A stem that does not meet
this is unusable regardless of how good it sounds** — this constraint goes in the generation
prompt, not in a review note afterwards.

#### 20.7.2 The budget

| Stem | Count | Purpose |
|---|---|---|
| **Zone beds** | **4** | One per §20.2 zone — desk, floor, global, cosmic. Crossfaded by camera Z, exactly as §20.3's DSP matrix already does for ambience |
| **Strain layers** | **3** | Mixed in by Entropy: *calm*, *strained*, *collapse*. Zone-agnostic — they sit over whichever bed is playing |
| **Title bed** | **1** | §10.9. The only stem that is not part of the gameplay mix — see 20.7.2a |
| **Stingers** | **2** | §7.7.2 rung promotion; §13 Paradigm Shift. One-shots, in key, that land on the beat |
| **Silence** | 0 | Not a stem. See 20.7.5 |

**Total: 10 pieces. Hard cap 12.**

Four beds × three strain layers gives twelve distinct-sounding states from nine assets,
because the strain layers are **overlays rather than variants**. Writing 4 × 3 = 12 separate
beds would sound identical to the player and cost a third more to make and maintain.

##### 20.7.2a Every scene has a scored state — but not every scene gets a track

**The mix is per scene, the stems are not.** §10.8's gate covers every screen in the product
(title, trees, storefront, prestige, ads), and every one of them needs to sound like
somewhere — but ten screens do not need ten songs. They need ten *mixes* of the same ten
stems, and because §20.7.1 puts every stem in one key and tempo, moving between them is a
level change rather than a transition.

| Scene | What plays |
|---|---|
| **Title (§10.9)** | `bed-title` alone. The one stem outside the gameplay mix, because the title is outside the game — and because the hand-off into gameplay is a crossfade to `bed-desk` under a camera push, not a cut |
| **Boot (§10.9.3)** | Nothing but the typewriter. Music enters *with* the logo |
| **Gameplay** | Zone bed by camera Z, strain layer by Entropy (§20.7.3) |
| **Dialogue (§10.7)** | Whatever was playing, ducked to ~40%. Never stopped — a scene that kills the music to talk announces that talking is an interruption |
| **Tech / prestige trees, org chart, storefront** | The current zone bed, low-passed and ducked. You are still in the studio; you are looking at a screen in it |
| **§21 Act IV** | The §20.7.4 override |
| **Act V / bankruptcy** | `layer-collapse` alone, no bed |
| **Paradigm Shift (§13)** | `sting-paradigm`, then `bed-desk` comes up under the empty office |
| **Rewarded ad / IAP** | Ducked to ~25% and **never stopped**, so returning from an ad is a level change rather than a restart (§10.8 F3) |

**Rules, and they mirror §22.7 because the failure mode is identical:**

1. **The cap is 12.** Anything that would breach it needs a decision recorded here first.
2. **Growth goes to layers, never to tracks.** More variety means another strain overlay or a
   filtered variant of an existing bed — never a new song.
3. **§17's Multiverse dimensions do not get their own scores.** A dimension re-skins the
   music by **DSP and instrumentation swap on the existing beds** — the Cyberpunk grid is the
   Zone 2 bed through a resonant filter with a different lead; the 8-Bit Realm is the same
   bed bitcrushed. Six dimensions × four beds would be twenty-four tracks and is the exact
   scope escape §22.7 exists to prevent on the art side.
4. **No stem is longer than 8 bars.** A long loop is not more interesting; it is more
   expensive and it is heard less often than you think.

#### 20.7.3 How the mix is driven

Both inputs already exist in the simulation and are already driving the picture, so the music
costs no new state:

| Input | Drives | Behaviour |
|---|---|---|
| **Camera Z** (§7.2) | Zone bed crossfade | The same weights as §20.3's DSP matrix and §7's LOD cross-fade. Picture, ambience and music change register on the same frame — that is the point of sharing the band edges |
| **Entropy $E$** (§4.1) | Strain layer mix | `calm` at $E$ < 10%, `strained` peaking around 40–70%, `collapse` from 90% up. Crossfaded, never switched. **The same variable already driving the interface hue** (ART_DIRECTION §1.1), so the screen and the score go wrong together |

**Everything the player hears is therefore a reading of the simulation.** Music that
escalates because the studio is failing is drama; music that escalates on a timer is a
soundtrack, and the player learns to ignore it.

#### 20.7.4 §21 Act IV — the one scripted override

Act IV is the single place the mix is *not* purely reactive. §21 requires the cozy lofi to
**abruptly cut out** — and this is the one permitted exception to §10.5, because the cut is
the joke.

| | |
|---|---|
| On Mass Hire | **All zone beds duck to zero over 120 ms.** Not a fade — a drop |
| The gap | ~400 ms of nothing but the §21 impact, siren and chatter |
| Then | The `collapse` strain layer comes up **alone**, no bed under it, and stays there through Act V |

**The absence is the effect.** The player has had a bed under everything for four minutes;
taking it away is the loudest thing the audio layer does all run.

#### 20.7.5 Silence is composed, not left over

§10.8 F3 fails a screen the player can operate in silence — but that is about *feedback*, not
about wall-to-wall music. The bed is allowed to thin to almost nothing at desk zoom in Act I,
because §21's opening is "soft ambient hum of a PC fan, gentle keyboard clacks, and a cozy
lofi synth melody" — the foley carries it and the melody is barely there.

**Quiet must be a mix decision written into the stem, never an empty channel.**

#### 20.7.6 Generation — ElevenLabs Music **[CANON]**

Music is generated with **ElevenLabs Music**, mirroring the existing SFX pipeline:
`scripts/generate-music.ts` alongside `scripts/generate-sfx.ts`, prompts source-controlled
so the audio is reproducible, MP3s treated as build output, `--force` to regenerate, key from
the same gitignored `.env`.

**Two things to settle before generating the final set, both flagged rather than assumed:**

1. **Confirm the current API endpoint and request shape from ElevenLabs' own docs.** The SFX
   script uses `/v1/sound-generation`, which is a different product; do not guess the music
   route by analogy.
2. **Confirm the licence tier covers commercial game distribution.** This is a shipping
   product with IAP (MONETISATION §4–7), not a demo. Generated music carrying a
   non-commercial or attribution-only licence is unusable here no matter how good it is, and
   finding that out after the score is finished is the expensive order to discover it in.

**Prompt requirements — every music prompt must carry these, and they are why §20.7.1's key
and tempo rule exists:**

- `A minor, 84 BPM, 8 bars, loopable, seamless loop point`
- `no vocals` — the §10.7 dialogue and §21 script own all the words
- `no fade in, no fade out` — the mix bus owns the levels; a baked fade fights it
- The §20.2 zone's palette, verbatim, so the music and the ambience agree about the place
- **Chiptune/synth register throughout.** ART_DIRECTION's product is a CRT terminal in a real
  office; an orchestral score would be the audio equivalent of the anti-aliased-font failure
  in §3 rule 1

**Seed briefs:**

| Stem | Brief |
|---|---|
| `bed-desk` | Cozy lofi synth. Warm, slow, unhurried, a little wistful. The sound of one person who thinks this is going to be fine |
| `bed-floor` | The same progression, busier. Arpeggios enter. Corporate optimism with an edge |
| `bed-global` | Modular synth arpeggios, pulsing telemetry. Wide, cold, impressive, inhuman |
| `bed-cosmic` | Existential synth pads over a 40 Hz sub. Almost ambient. Enormous and empty |
| `layer-calm` | Sparse: a soft pad and an occasional bell. Barely present |
| `layer-strained` | A pulsing bass and a ticking percussive figure that will not resolve |
| `layer-collapse` | Detuned, dissonant, an alarm-pitched figure fighting the key it is in |
| `bed-title` | The same cosy lofi as the desk bed, sparser and slower, with one held pad underneath. It has to work under a logo and hand over to `bed-desk` without a seam |
| `sting-promotion` | Four bars, rising, triumphant, faintly ridiculous |
| `sting-paradigm` | Two bars, descending then resolving. A reset, not a defeat |

**The whole score is ten loops of eight bars.** That is a weekend of generation and curation,
not a commission — which is the point of capping it here rather than discovering the scope
at the end.

---

## 21. Onboarding Narrative Script — Run 1 (The Trap)

Designed to seamlessly guide the player into the Communication Entropy Trap during their
very first run. It uses a CRT terminal aesthetic, satirical corporate dialogue, and forced
UI guidance to lure the player into making the classic "hire everyone immediately" mistake.

### Scene setting
- **Visual:** the game opens in tight **Level 1 Zoom (Desk View)**. Low-fi pixel lighting.
  A single developer sits in a messy bedroom/garage, illuminated only by the glow of a
  chunky CRT monitor.
- **Audio:** soft ambient hum of a PC fan, gentle keyboard clacks, and a cozy lofi synth melody.

### 21.0 The shape of Run 1 — earn it, then fall for it **[CANON — revised]**

**An earlier draft of this script went 1 dev → 2 devs → 1,000 devs.** That is too fast, and
it breaks the trap it exists to set. A player handed a free thousand-developer button ninety
seconds in has not yet learned that hiring *works*, so when it stops working they have
learned nothing — they were never invested. **A trap only springs on someone who walked into
it confidently.**

So Run 1 is a real loop first, and the trap is what the loop earns:

| Beat | Devs | The player is learning |
|---|---|---|
| **Act I** | 1 | Poking works. Ship *Flappy Square 1.0* almost entirely by thumb. |
| **Act II** | 1 → 2 | Cash buys a developer. James arrives. Velocity visibly doubles. |
| **Act IIa — the honest loop** | 2 → ~40 | **Ship, earn, hire, ship faster, earn more, hire again.** Four or five projects. Each hire is bought with money the player made, costs more than the last, and *works*. |
| **Act III** | ~40 | The bait. |
| **Act IV–V** | ~1,040 | The collapse. |

**Act IIa is the load-bearing beat and it did not exist before.** Four things have to be true
by the end of it:

1. **The player has hired several times, deliberately, with earned cash.** Hiring is now a
   habit and a reward, not a tutorial step.
2. **It has always worked — but the readout has just started to twitch.** At ~40 developers
   the readout reads `CHATTY 1%`: visibly non-zero, entirely dismissable. Communication cost
   is *present in the model the whole time*, and Act IIa now ends at the first moment it is
   large enough to see. **The player must get one hint and wave it away.** That is what makes
   the collapse land as a betrayal rather than as a surprise — they were told, and they were
   right to ignore it, and they were wrong.
3. **The player has a mental model, and it is wrong.** "More developers, more speed." They
   built it themselves out of evidence, which is why it will hold right up until it doesn't.
4. **They can just about afford the Mass Hire.** See below.

**The Mass Hire is no longer free.** "Cost: FREE (Trial Promo)" made it a button rather than
a decision, and §6 is explicit that the lesson needs the player to *choose* it. It is now
priced at **roughly the entire treasury they have accumulated by Act III** — affordable, and
only just. That does three things at once:

- It is a **commitment**, so the collapse costs them something they earned.
- It makes the greed real: the offer is only tempting because they can now reach it.
- It leaves **no cash buffer** when payroll starts, which is what makes Act V's bankruptcy
  arrive in seconds rather than needing a scripted nudge.

The advisor's pitch is unchanged and lands harder for it: *"Math doesn't lie!"* — and the
player has four projects' worth of personal evidence that it doesn't.

**Measured 2026-08-07, against the shipped `entropy()` and the §4.2 cap of 100. These are
the numbers Act IIa's length was chosen from, not a justification written after it:**

| Devs | 1 | 10 | 20 | 30 | **40** | 50 | 60 | 80 | 100 | ~1,040 |
|---|---|---|---|---|---|---|---|---|---|---|
| $E$ | 0.000% | 0.001% | 0.032% | 0.242% | **1.01%** | 3.03% | 7.22% | 24.7% | 50.0% | 99.999% |
| Readout | `IN SYNC` | `IN SYNC` | `IN SYNC` | `IN SYNC` | **`CHATTY`** | `CHATTY` | `CHATTY` | `BOGGED DOWN` | `PRODUCTIVITY BREAKDOWN` | `STUDIO SEIZED` |

**~40 developers is where Act IIa ends, and the number is not arbitrary.** It is the first
headcount at which the readout says something other than `IN SYNC`. An earlier draft ended
Act IIa at ~10, where $E$ is 0.001% — the curve is *flat*, not gentle, and the player would
have got no hint at all rather than a faint one. Ending on the first twitch is what buys the
"I saw that and ignored it" that makes the trap land.

**Pacing target: Run 1 is about 4 minutes.** Act IIa is roughly half of it. If playtesting
shows players hiring past ~10 without being offered the bait, offer it sooner; the trap must
spring while the model still reads as reliable, never after the player has already noticed
the readout climbing on their own.

### ACT I: The Innocent Beginning

**[ON-SCREEN TERMINAL PROMPT (Retro Green Text)]**

```
STUDIO_OS v0.0.1 initialized.
Project: "Flappy Square 1.0"
Sprint Commitment: 1,000 SP
Developer Count: 1
```

**TEXT BUBBLE (Over Solo Dev Sprite):**
> *"Okay... just need to write 1,000 lines of code. Simple enough."*

*(The player is instructed via a glowing hand icon to poke the developer.)*

- **Action:** player pokes. A `+1` floats up off the dev's head and the burn-down line
  notches down. The solo dev also produces 1 SP/sec passively, so the bar moves at
  0.1%/sec on its own.
- **First poke teaching moment:** the dev's speech bubble reads *"It's a one. Everything is
  a one right now."* — establishing the Fibonacci ladder in a single line without a
  tutorial box.
- **SFX:** satisfying mechanical keyboard clacks with pitch-shifted pops per tap.
- The player will poke roughly 3–5 times a second and see the burn-down visibly outpace
  the passive rate. **This is the moment the clicker layer sells itself**, and it must feel
  good before anything else is introduced.

### ACT II: The Illusion of Efficiency

**SYSTEM POPUP (Tutorial Guide):**
> **OS NOTICE:** *"Progress is dangerously slow! At this rate, your indie game will launch after the sun dies. Let's scale up!"*

*(UI unlocks the `[ HIRE DEVELOPERS ]` button.)*

**TUTORIAL PROMPT:**
> *"Hire your first buddy to help out!"*

- **Action:** player hires **Dev #2 — James** (§22.3). He is the first named character in
  the game and the player's first Hero Card.
- **Visual:** camera zooms out slightly. A second desk slides in next to the first — no
  cut, a physical slide (§10.5). James sits down, adjusts his glasses, and gets to work.
- **Progress Speed:** Velocity doubles to 2 SP/sec. Project completes **2× faster**! A
  small popup shows: **"Game Published! Profit: +$50"**

**TEXT BUBBLE (James):**
> *"Hey, this actually works! More people = faster games!"*

*(This line is James's card flavour text forever. It is the thesis of the game, said
sincerely, by the person who will be proven wrong four minutes from now and will stay
anyway.)*

**CARD AWARD (first collectable, deliberately un-gated and un-random):**

```
+------------------------------------+
|  ★ NEW HIRE ON THE ORG CHART       |
|                                    |
|        [ pixel bust: JAMES ]       |
|                                    |
|  JAMES                    JUNIOR   |
|  "Your first buddy."               |
|                                    |
|  Never quits when poked.           |
|                                    |
|            [ PLACE ]               |
+------------------------------------+
```

### ACT III: The Mousetrap Is Baited

*(The game HUD flashes a big, glowing, pulsing golden button that appears right in the center of the UI.)*

```
+----------------------------------------------------------+
|  ** LIMITED OFFER: MASS HIRING PACKAGE UNLOCKED! **       |
|  "Why hire one by one when you can hire an entire swarm?" |
|                                                          |
|                 [ HIRE 1,000 DEVS NOW ]                  |
|                 Cost: $  (see 21.0 -- ~their whole till)  |
+----------------------------------------------------------+
```

**SYSTEM POPUP (Sarcastic Tutorial Assistant):**
> **ADVISOR:** *"Math doesn't lie! If 2 devs make games 2× faster, 1,000 devs will make games 1,000× faster! Tap the button. Do it. What could possibly go wrong?"*

### ACT IV: The Entropy Collapse (The Trap Triggers)

*(Player taps `[ HIRE 1,000 DEVS NOW ]`.)*

**Visual & Audio Polish Shift:**

1. **Camera Impact:** a heavy bass-drop **THUD** shakes the screen as the camera violently
   zooms out to **Level 2 (Isometric Floor View)**.
2. **Swarm Spawn:** 1,000 pixel developers drop from the sky, crammed shoulder-to-shoulder
   into a tiny open-office floor.
3. **Entropy Surge:**
   - Red `@everyone` notification bubbles flood the entire screen.
   - Hundreds of overlapping speech bubbles appear: *"Who broke the build?"*, *"What's the
     password for the Wi-Fi?"*, *"Why are we in a meeting?"*, *"Is there oat milk?"*
   - Red web lines of **Slack Noise** instantly connect all desks, turning the floor into a
     glowing red spiderweb.
4. **Music Shift:** cozy lofi music abruptly cuts out, replaced by an overwhelming, chaotic
   wall of overlapping notification pings, loud overlapping chatter, and an alarm siren.

### ACT V: Bankruptcy & The Lesson

*(The project progress bar freezes completely at 99.9%. The speedometer slams to **99.9% — STUDIO SEIZED**. Per §4.3a the player never reads the word "entropy"; the internal name for this readout is the Entropy Speedometer and it stays internal.)*

**SYSTEM WARNING (Flashing Red HUD):**
> **[!] CRITICAL SYSTEM FAILURE: STUDIO SEIZED**
>
> *Production Speed: 0.00000x*
> *Payroll Burn Rate: $50,000 / sec*

**TEXT BUBBLE (Dev #482):**
> *"I can't push my line of code because 999 other people are trying to edit the same file!"*

*(The player's cash rapidly ticks into the red: −$10,000, −$100,000, −$1,000,000.)*

```
+----------------------------------------------------------+
|                    ** BANKRUPTCY! **                     |
+----------------------------------------------------------+
| Your 1,000 developers spent 100% of their time arguing in|
| Slack and zero seconds coding.                           |
|                                                          |
| Result: $0 Revenue | Total Liquidation                   |
|                                                          |
| LESSON LEARNED:                                          |
| Manpower without Communication Infrastructure is Chaos.  |
|                                                          |
|                 [ TRIGGER PARADIGM SHIFT ]               |
+----------------------------------------------------------+
```

*(Tapping `[ TRIGGER PARADIGM SHIFT ]` unlocks the **Layer 1 Prestige Tree** for the first
time, granting your first **Bandwidth Points (BP)** to begin buying Async Communication
protocols for Run 2.)*

**James survives the bankruptcy.** Every other developer is liquidated; his card stays on
the org chart. The first Paradigm Shift screen shows the empty office with one desk still
occupied, and his speech bubble reads:

> *"So. Same time tomorrow?"*

---

### 21.6 Run 2, Act 0 — "How did you find me in every single reality?" **[CANON]**

*(The first thing after the first Paradigm Shift. Delivered through the §10.7 dialogue
system: typed out, unskippable. The office is empty except for two desks.)*

This scene does three jobs and has to do all of them in under a minute: it establishes that
**James is the constant across every run**, it lands the game's best running joke, and it
hands the player their **first Paradigm-tree tool** — Instant Messenger — as a punchline
rather than as an unlock notification.

**PLAYER:**
> *"James. You again."*
>
> *"How did you find me in every single reality?"*

**JAMES:**
> *"I saw the job posting."*

*(beat)*

> *"Anyway — I brought something. Look at this."*

**[ STUDIO_OS — NEW PROTOCOL AVAILABLE ]**
```
+----------------------------------------------------------+
|  INSTANT MESSENGER                                        |
|  Asynchronous text. Tier 1 Communication Infrastructure.  |
+----------------------------------------------------------+
```

**JAMES:**
> *"Instant Messenger. So we don't have to speak to each other any more."*

**PLAYER:**
> *"James, we literally sit side by side."*

**JAMES:**
> *"Exactly. That's the whole point."*
>
> *"Now we don't even have to talk. Neat, right?"*

*(He turns back to his monitor. A tiny message notification appears over the player's desk.
It says `hey`. He is two feet away.)*

**PLAYER:**
> *"…"*

**JAMES:**
> *"Check your messages."*

**Why this scene is here, in design terms:**

- **It teaches the thesis in reverse.** Run 1 taught that adding people costs
  communication. Run 2 opens by teaching that *communication tooling is the thing you buy to
  survive people* — and it does it as a joke about two men sitting next to each other typing.
- **Every prestige tier gets one of these.** The Paradigm tree is a ladder of communication
  protocols (§13), and each one gets a James scene where he introduces it with total
  sincerity and it is faintly horrifying: stand-ups, ticketing, "async-first", neural sync.
  The tools get better and the humans get further apart. **That is the whole arc**, and it is
  delivered entirely in dialogue.
- **It makes James the player's relationship with the game.** §22.3 spends the Hero Card
  system on making one developer matter. This is where that starts paying.

**Constraint:** the `hey` notification is a **procedural pixel icon** with typed text, not an
emoji and not a system toast (ART_DIRECTION §3.1, GDD §10.6).

---

## 22. Hero Cards & Collectables

### 22.1 The System

**Hero Cards are unique, named developers you collect and place on your org chart.** Unlike
the generic Hero Classes from Layer 2 (§13.3), which are anonymous units that spawn by
probability, each Hero Card is a specific person with a portrait, a personality, a quote,
and one board-wide mechanical effect.

They are presented as **trading cards** — pixel-art bust, rarity frame, stat block, flavour
line — and they are the game's collection meta-layer, sitting alongside the three prestige
layers on a timescale of days to months.

**Why this format fits this project specifically:**

- A card is a **static pixel portrait plus a frame**. No animation, no sprite sheets, no
  bespoke scenes. This is the cheapest collectable format that exists.
- The placement board is an **org chart** — boxes and reporting lines. Free art.
- Rarity tiers are the **corporate promotion ladder**, so the frame colour *is* the joke.
- Effects hook into systems that already exist (SP yield, Entropy, the Fibonacci ladder,
  offline accrual), so no new simulation code is required to make a card matter.

### 22.2 The Org Chart (Placement Board)

Cards do nothing in your collection. They must be **placed**.

```
                    +------------------+
                    |   [ YOU ]        |
                    |   Founder        |
                    +--------+---------+
                             |
        +--------------------+--------------------+
        |                    |                    |
  +-----+------+      +------+-----+      +-------+----+
  |  SLOT 1    |      |  SLOT 2    |      |  SLOT 3    |
  |  [ JAMES ] |      |  [ empty ] |      |  ( locked )|
  |  Junior    |      |            |      |            |
  +-----+------+      +------+-----+      +-------+----+
        |                    |
  +-----+------+      +------+-----+
  |  SLOT 4    |      |  SLOT 5    |
  |  ( locked )|      |  ( locked )|
  +------------+      +------------+
```

| Rule | Detail |
|---|---|
| **Starting slots** | 2 (Slot 1 filled by James in the tutorial) |
| **Maximum slots** | 6 |
| **Slot unlocks** | Slots 3–6 unlock at the first Paradigm Shift, the first Codebase Fork, the 100M gate, and the first Planck Core respectively |
| **Reassignment** | Free and instant, but triggers a **10-second re-org** during which all placed card effects are inactive — you cannot hot-swap a card in to counter an event |
| **Direct reports** | Cards placed *below* another card on the chart receive **+25% of that card's effect** if both are the same rarity tier or higher going up. This is the only combo rule; keep it that simple. |

**Satirical framing:** the reassignment penalty is a re-org. The tooltip reads *"A
reorganisation is in progress. Productivity will return shortly. It always does."*

### 22.3 Hero Card: JAMES — the anchor of the whole system

James is the first named character in the game, awarded in the tutorial (§21, Act II) as
Dev #2 — your first buddy. He is deliberately **not** rare, **not** random, and **not**
purchasable. Every player gets him, in the same minute, for free.

He is also the only card in the game promotable all the way to **Legendary**, which means
the first card you are ever given is the one you are still investing in three months later.
That is the entire emotional design of the collection layer in one object.

```
+--------------------------------------------------+
|  ♦ JAMES                              [ JUNIOR ] |
+--------------------------------------------------+
|                                                  |
|         [ 64x64 half-body portrait ]             |
|         glasses · thick beard · white shirt      |
|            · hole in the left elbow ·            |
|              (arms in frame, always)             |
|                                                  |
+--------------------------------------------------+
|  "Hey, this actually works!                      |
|   More people = faster games!"                   |
+--------------------------------------------------+
|  LOYAL      Never quits when poked.              |
|  FIRST HIRE +1 SP per poke on Slot 1's desk.     |
+--------------------------------------------------+
|  PROMOTION: 1 / 2 duplicates    [ WRITE PACKET ] |
+--------------------------------------------------+
```

**Visual design — the constant and the variable.**

James's appearance is fixed across every promotion tier in three respects, and these are
non-negotiable because they are how the player recognises him at a glance from Junior to
Legendary:

1. **Glasses.** Thick-rimmed, always.
2. **Thick facial hair.** A full beard, which greys as he is promoted.
3. **A plain white shirt — with a hole worn through the left elbow.**

**The elbow hole never gets fixed.** Not at Staff, not at Principal, not at Legendary when
he is a glowing post-human node in a quantum hivemind. The shirt gets better — pressed,
then tailored, then wreathed in cosmic light — and the hole is always still there. It is
the single running visual gag of the collection system, it costs four pixels, and it is the
first thing players will notice and post about.

**Promotion ladder (James is the only card that goes the full distance):**

| Tier | Title | Dupes to promote | Effect at tier |
|---|---|---|---|
| **Junior** | *Dev #2* | — | +1 SP per poke on Slot 1's desk. Never quits when poked. |
| **Mid** | *James, Actually Quite Good Now* | 2 | +1 SP per poke, studio-wide. |
| **Senior** | *Senior Engineer James* | 3 | Above, plus **−10% Context Switch Penalty** ($\epsilon$) studio-wide. |
| **Staff** | *Staff Engineer James* | 5 | Above, plus adjacent org-chart cards gain **+15% effect**. |
| **Principal** | *Principal Engineer James* | 8 | Above, plus **+1 Fibonacci ladder tier** while placed. |
| **Distinguished** | *Distinguished Engineer James* | 13 | Above, plus **10x Engineers no longer quit when poked**. |
| **Legendary** | *James, Who Was There At The Beginning* | 21 | Above, plus **+1% of all Story Points ever produced by the studio, per second**, forever. |

Promotion costs follow the Fibonacci ladder deliberately — the amount of evidence required
to promote someone grows absurdly and the justification does not. Each promotion also
requires a **Promo Packet**, purchased with Bandwidth Points, whose confirm button reads
`[ SUBMIT FOR CALIBRATION ]`.

**Flavour lines by tier** (spoken when you tap his card):

- *Junior:* "Hey, this actually works! More people = faster games!"
- *Mid:* "I've been reading about this 'communication overhead' thing."
- *Senior:* "I told you about the communication overhead."
- *Staff:* "I've stopped writing code. I mostly write documents about writing code now."
- *Principal:* "I'm not sure what I do anymore, but the org chart says it's important."
- *Distinguished:* "I have outlasted eleven paradigm shifts and four heat deaths."
- *Legendary:* "Still here. Still got the shirt."

### 22.4 Rarity Tiers

Rarity is the corporate promotion ladder, which means the tier name is the joke and the
frame is a palette swap.

| Tier | Frame | Typical effect magnitude |
|---|---|---|
| **Junior** | Dull grey wire | Small, single-slot |
| **Mid** | Plain steel | Small, studio-wide |
| **Senior** | Warm bronze | Meaningful modifier to one system |
| **Staff** | Cool silver | Modifier plus a board interaction |
| **Principal** | Gold | Changes how a system behaves |
| **Distinguished** | Deep violet, faint pulse | Removes a downside from the game |
| **Legendary** | Cyan, animated scanline | Rewrites a rule |

### 22.5 Launch Roster

**Twelve cards at launch.** This is a deliberate cap — see §22.7 on art budget. All are
earned through play; none are randomised or purchasable.

| # | Card | Tier at acquisition | Effect | How it is earned |
|---|---|---|---|---|
| 1 | **James** — *your first buddy* | Junior → Legendary | §22.3 | Tutorial, Act II. Everyone gets him. |
| 2 | **Intern #42** | Junior | +20% SP from pokes at **Desk zoom** only. Infinite enthusiasm, zero context. | Poke 1,000 developers total |
| 3 | **The Scrum Master** | Mid | Removes the *Daily Standups* cyclic pause, but takes 5% of revenue | Buy the Daily Standups node in 3 separate runs |
| 4 | **Chad from Sales** | Mid | **+40% project revenue, +15% base Entropy.** A liability you choose to carry. | Ship 50 projects |
| 5 | **Dana, Keeper of the Monolith** | Senior | Prevents the *Merge Conflict Catastrophe* fail state; nobody else understands the legacy system | Survive a Merge Conflict Catastrophe and reach the next release |
| 6 | **Bruno, On-Call** | Senior | Auto-clears one entropy event every 5 minutes **while the app is closed** | Accumulate 24 hours of offline time |
| 7 | **The Greybeard** | Principal | Writes in C, refuses all frameworks. Negates **50% of Code Bloat Entropy** from AI Slop | Reach the AI Slop era without ever buying an AI upgrade |
| 8 | **The Architect** | Distinguished | Suppresses Entropy on their entire floor by 40%; turtleneck, never speaks | Unlock the Architect Archetype class in Layer 2 |
| 9 | **PROMPT-9000** | Staff | +300% SP generation, but generates Code Bloat Entropy. Pairs with The Greybeard, who hates it. | Trigger the Synthetic AI Slop Injection event 10 times |
| 10 | **Marguerite, VP of Documentation** | Distinguished | Passive multipliers +15%. Nobody has read a word she has written. | Resolve *The 400-Billion-Page Documentation* event in favour of the docs |
| 11 | **Yuki, the 10x** | Legendary | Operates at 10× speed, 0 Entropy — **and quits if you poke her card**, permanently, until the next Codebase Fork | Cross the 100,000,000 gate (§13.5) |
| 12 | **Hive Fragment 7** | Legendary | Poke effects apply across **all parallel dimensions** simultaneously | Compile your first Planck Core (Layer 3) |

**Named synergies** (kept few and legible):

- **James + Intern #42 — "The Old Guard"**: +1 additional SP per poke. The two people who have been here longest and understand the least.
- **The Greybeard + PROMPT-9000 — "Irreconcilable Differences"**: both effects reduced 50%. They will not sit near each other.
- **The Architect + Marguerite — "Nobody Reads It"**: Entropy suppression doubled, revenue −10%.
- **Chad from Sales + anyone at Principal or above — "Escalation Path"**: Chad's Entropy penalty halved.

### 22.6 Acquisition — Earned, Never Randomised

**Cards and duplicates come only from play:**

| Source | Yield |
|---|---|
| Milestone achievements | The card itself, first time |
| Repeating that milestone | 1 duplicate |
| Paradigm Shift (L1) | 1 random duplicate of an owned card, every 5th shift |
| Codebase Fork (L2) | 2 duplicates of choice |
| Clearing a Multiverse dimension | That dimension's themed card or duplicate |
| Seasonal events | Time-limited card, later added to the permanent pool |

**Explicitly excluded, permanently:** card packs, gacha pulls, randomised paid rewards,
paid duplicates, and any purchase that accelerates promotion. This is a hard line and it is
consistent with the monetisation guardrails — a collection system is precisely where a game
like this would be tempted into loot boxes, and precisely where a developer audience would
punish it hardest.

**What may be sold:** cosmetic card *frames* and alternate portrait art (e.g. a
"Hawaiian Shirt James" variant that, obviously, still has the elbow hole).

### 22.7 Art Budget — Hard Cap **[CANON]**

**This is a constraint, not a guideline.** The collection system is the most likely route
by which this project's art budget escapes, so the ceiling is fixed here and any change to
it is a deliberate scope decision made explicitly, not a drift.

| Asset | Count | Notes |
|---|---|---|
| Character portraits | **12** | **64×64, framed at half-body** — head, torso and both arms in shot. One per hero. Static — no idle animation. |
| Card frame | **1** | A single frame asset, palette-swapped 7 ways for the rarity tiers |
| James promotion variants | **7** | The *only* card with per-tier art. Every other card keeps one portrait across all tiers; only its frame changes. |
| Org chart board | 0 | Boxes and connector lines, drawn in code |

> **Why 64×64 half-body, not a 48×48 bust.** A head-and-shoulders bust crops the elbow out
> of frame, which would delete James's defining visual detail (§22.3) before it ever
> rendered. Arms must be in shot at every tier. This changes the canvas size, not the
> sprite count. See [Art Direction §4.2](./docs/ART_DIRECTION.md#42-jamess-card-canvas--spec-correction).

**Total bespoke art for the entire collectable system: 19 small sprites.**

**Rules:**

1. **The roster is capped at 12.** Fifty cards would be a different, more expensive game.
2. **Only James gets promotion art.** Everyone else is one bust plus a frame swap. This is
   what makes 12 heroes cost 12 sprites instead of 84.
3. **No animated cards.** No foil shaders, no idle loops, no reveal animations beyond the
   deal-in transition, which is a transform on a static sprite.
4. **Growth goes to seasons or frames, never the roster.** If more collectable content is
   needed: 1–2 seasonal cards per season, or new palette-swapped frames. A roster expansion
   is the one thing that is off the table.

Anything that would breach this table needs an explicit decision recorded here first.

---

## 23. Technical Constraints & Build Readiness **[CANON]**

Everything decided in ADR 0001 (engine and rendering stack) and ADR 0002 (screen
orientation), folded in. **This section is the source of truth. The ADRs are history** —
they record how these were reached and what was rejected, and they are worth reading once,
but nothing in them needs consulting to build from this document.

**No further ADRs.** Decisions of this weight now land here, in this section, with the
reasoning attached.

---

### 23.1 The stack **[CANON]**

| Concern | Choice |
|---|---|
| Shell / native bridge | **Capacitor 8** |
| UI, menus, trees, cards, modals | **React 19 + CSS**, DOM-rendered |
| Simulation canvas — the swarm, the Omni-Lens (§7) | **PixiJS v8**, WebGL/WebGPU |
| Post-processing (§8.1, ART_DIRECTION §6) | **pixi-filters** |
| Large numbers (§14) | **break_infinity.js** |
| Poke / click SFX (§8.2) | **Native audio via a Capacitor plugin** — never Web Audio |
| Ambient, DSP, zoom crossfade bus (§20) | **Web Audio API** |
| Haptics (§8.2) | **`@capacitor/haptics`** |
| Ads, IAP, entitlements | **`@mercilessstudio/game-monetise`** |
| Cloud save, Play Games, leaderboards | **`@mercilessstudio/game-cloud`** |
| Build tooling | **Vite**, matching `mind-the-gap`'s versions |

Both studio packages are consumed **by git tag** — `git fetch --tags` first; local sibling
checkouts run behind published tags. Capacitor ≥ 8 is a peer requirement.

**Rejected:** Godot 4, React Native, DOM/CSS-only rendering. The deciding argument was that
the monetisation and cloud layer is the real cost centre and it is already solved on
Capacitor — and that RevenueCat has no official Godot SDK.

### 23.1a The standing production constraint **[CANON]**

**Solo developer. Low budget. Minimal animation. Achievable with mostly static pixel art.**

This governed the engine choice and it governs everything downstream, so it is restated here
rather than left in a frozen ADR. It is why §7.8.3's motion is code-driven transforms on
static parts instead of spritesheets, why §22.7 caps bespoke art at 19 sprites, why §20.7
caps the score at 12 stems, and why §7.8.2's rungs above 2 are procedural and commodity.

**Shipping velocity is the scarce resource.** Any proposal that trades it for fidelity needs
to say so out loud.

### 23.2 The five non-negotiables **[CANON]**

Break any of these and the thing they protect breaks with them.

1. **Poke SFX go through native audio, never Web Audio.** Web Audio in an Android WebView
   can carry 100–300 ms against a 60 ms budget. This is the single largest feel risk in the
   project. Web Audio keeps §20's ambient bus and DSP, where 100 ms is inaudible.
2. **The swarm is a `ParticleContainer`**, dropping to a shader-driven heatmap at Global
   zoom and beyond per §7.5. Not individual display objects.
3. **The DOM/canvas boundary is fixed:** simulation, camera, particles and scenery in Pixi;
   everything with structured text, numbers or navigation in React. **Game state lives in
   one store both read from.** Scenery text — floating numerals (§8.2), code snippets
   (§8.2a), Act IV chatter (§21) — is Pixi, because it must sit *under* the CRT glass and it
   churns several times a second.
4. **The interface is a second pane of glass, not phosphor.** ART_DIRECTION §6's post-process
   stack cannot be applied to DOM. The HUD sits in front of the tube rather than being burned
   into it; this is a deliberate fiction, recorded in ART_DIRECTION §1.0a, and it is why
   non-negotiable 3 can hold at all.
5. **Depth of field is applied to the *world* container, not the shared chain.** Stacking
   `TiltShiftFilter` ahead of bloom/RGB-split/CRT in one `filters` array renders the canvas
   **fully black, with no console error.** It is internally two axis passes whose padding
   does not survive being fed onward. Its `start`/`end` band is therefore in **world-local**
   coordinates, not screen coordinates.

### 23.3 The performance budget **[CANON]**

These began as the spike's acceptance gate. They are now the standing budget: any build that
fails one has regressed, and §7.6's Construction Ladder and §21's Act IV spectacle are the
two features most likely to cause it.

| # | Metric | Threshold |
|---|---|---|
| 1 | Tap → numeral visible | **≤ 80 ms**, p95 |
| 2 | Tap → click audible, native path | **≤ 60 ms**, p95 |
| 3 | Frame rate during a full L1→L4 zoom dolly | **≥ 55 fps**, 5th percentile |
| 4 | Frame rate at floor zoom with 1,000 sprites | **≥ 55 fps**, 5th percentile |
| 5 | Sustained tapping, 5 taps/sec for 60 s | **99th-percentile frame ≥ 50 fps**, no audio dropout, no latency drift |
| 6 | Cold start to interactive | **≤ 3 s** |
| 7 | **The subjective gate** | Hand it to someone who has not seen it. If they keep tapping for a full minute unprompted, it passes. If they stop, it fails — regardless of the numbers above |

**Criterion 7 outranks the rest.** The measurements exist to explain a failure, not to
overrule a verdict the thumb has already delivered.

`?bench` runs 1–6 and prints a pass/fail table; `?bench=10` shortens the sustained leg.
Output also goes to the console so it can be pulled off a device with `adb logcat`.

**Two rules the harness enforces, both learned the hard way:**

- **A criterion with no samples is UNKNOWN, never FAIL.** Chrome suspends `requestAnimationFrame`
  in a backgrounded tab, producing zero samples. A minimised window must not be able to
  report a frame-rate failure.
- **Value and sample count are read in the same breath.** Reading them seconds apart once
  produced `PASS — 0.0 ms` on criterion 1: an empty sampler's zero judged against a count
  that had since filled.

#### What is actually proven, and what is not

Honest status, so nobody mistakes the green table for a clean bill:

| # | Status |
|---|---|
| 1 | ✅ **Proven.** 7–10 ms on a Pixel 8 Pro against an 80 ms budget — an 8× margin, through a WebView, on the risk §23.2.1 exists to manage. The one result that generalises to weaker hardware |
| 2 | ❓ **Unmeasurable in-process, permanently.** JavaScript sees tap → the audio API accepting the call; the mixer, buffer, DAC and speaker are invisible, and on Android that is exactly where WebView latency hides. Needs an external capture: record a tap on a hard surface and the resulting click on a second device, read the gap in an audio editor |
| 3, 4 | ⚠️ **Measured on a flagship only** — 110 fps against a 55 fps floor, a 2× margin that says nothing about a device with half the fill rate. Effectively unmeasured for the target audience |
| 5 | ❓ **Unmeasured under its current wording.** The two device runs recorded worst-frame numbers; the criterion was restated as a percentile afterwards and the two cannot be honestly converted |
| 6 | ✅ 0.8 s against 3 s, though cold start scales with storage and a budget phone could plausibly triple it |
| 7 | ✅ **Passed** — but in **portrait**, before §23.4. It has never been run in the shipping orientation |

**Re-run the whole gate the moment any cheap Android handset comes to hand.** No low-end
device is available and one is not being bought; this is a deliberate scope decision, not an
oversight. The harness is a single tap and takes 80 seconds.

**A pass on good hardware is a *ceiling* measurement.** The honest reading is "nothing about
this stack fails on good hardware" — weaker than a gate is meant to deliver, but a fail
would have been decisive and there wasn't one.

### 23.4 Orientation and framing **[CANON]**

**The game is landscape.** `android:screenOrientation="sensorLandscape"` — both landscape
rotations, portrait never.

**This is forced by ART_DIRECTION §1's 2:1 isometric projection, not chosen for taste.** A
2:1 iso grid is exactly twice as wide as tall and cannot be anything else; the 1,000-dev
floor measures **992 × 496 world units**. Correctly framed, that fills **90% of a landscape
display and 22% of a portrait one** — and portrait's 22% ceiling holds however the camera is
written. Zooming in does not recover it; it just shows less of the swarm, which is the
picture.

It generalises up the §7.7 ladder: campuses, towns, nations and planets are all drawn in the
same projection and all wide. Rung 3's tower is the one genuinely vertical unit — one rung
of ten, and it needs framing work the others do not.

**Accepted costs:** idle games are portrait by convention, so a landscape listing reads as a
different product before anyone plays it — that is a store-conversion risk and it is the one
thing that would reopen this. One-handed play is gone, though §7.7.6's drag-pan and
pinch-zoom had already spent most of it.

#### 23.4.1 The camera must be viewport-aware — **REQUIRED, NOT DONE**

The renderer currently scales the world by `s = 1 / (1 + z · 9)` — **a function of camera Z
with no screen dimension in it.** Only the world's *position* is viewport-aware. So the
swarm renders at a fixed 239 × 120 px on every display and fills **6.4% of either
orientation, identically**.

**Until this is fixed, landscape delivers nothing visible.** The active tier must fit the
**shorter axis** of the viewport, with Z modulating around that fit rather than replacing
it. This is the change that converts the 90% ceiling into pixels, and it must land before
any layout work is done against a frame that is 92% empty.

It moves criterion 4 (how much of the 1,000-sprite floor is on screen at floor zoom), so
re-run `?bench` after it lands.

#### 23.4.2 The design box

Phone landscape is **not** 16:9. It runs from about **1.78 : 1** to **2.4 : 1**; the Pixel 8
Pro is **2.23 : 1**. Reference footage from PC games is 16:9 and is narrower than any phone —
do not compose to it.

- **Compose for 2.0 : 1; guarantee legibility from 1.78 : 1 to 2.4 : 1.**
- The iso floor centres and fits to **height**. Being 2:1, it leaves side margin on wider
  devices — that margin is where the HUD lives, and it is a feature, not waste.
- HUD elements anchor to **edges**, never to fractions of the width.
- Nothing load-bearing within 5% of the left or right edge — notches, gesture bars, curved
  cutoff.

#### 23.4.3 Renderer gotcha

Pixi's `resizeTo: host` recalculates on **window** resize events and does **not** observe the
host element. A container-only resize leaves the canvas at its old dimensions. Device
rotation resizes the window so this works in practice, but any in-app layout change that
resizes the canvas host needs an explicit `app.renderer.resize()`.

### 23.5 The spike is the product **[CANON]**

The codebase built to answer "does the poke feel good" is the codebase the game ships on.
This is deliberate: the simulation, economy, art pipeline, post-process stack and Act IV
spectacle are all real, tested work, and the DOM/canvas boundary in §23.2.3 held.

**Consequences that must be handled rather than inherited:**

1. **The developer sprite is a placeholder** drawn from rectangles. It is *not* the
   ART_DIRECTION §4.1 parts-library method — none of that exists yet: no head, no wardrobe,
   no recipe format, no compositor, no authored pixels. **Delete it the moment a real bust
   exists.** The §22.7 budget is 19 sprites and the current count is zero.
2. **Debug seams must not ship.** `?act=` (jumps the entire §21 script), `?bench`, `?post=`
   and `?nopost` are currently **unguarded** — they are unreachable inside a Capacitor shell
   only because there is no query string, which is packaging luck rather than a decision.
   The first web build exposes all four. Guard them behind a dev flag.
3. **`window.__stage`** (camera Z, LOD weights, collapse state) is dev-only and guarded. Keep
   it — "nothing is on screen" is the same symptom for a store flag, a stalled dolly and a
   culled tier, and it has already paid for itself once.

### 23.6 Build readiness — what is proven and what is not

**Built, tested and seen running:**

| | |
|---|---|
| Simulation (§4, §6, §21) | Against the GDD's own stated figures |
| Economy (§4.10) | The model was derived here; the GDD had none |
| Run 1 end to end (§21) | Playable in browser and on device |
| Art pipeline — palette, quantiser, `art:check` | Including the ART_DIRECTION §3.1 emoji gate |
| Post-process / CRT grade (ART_DIRECTION §6) | Carries most of the visible vibe |
| Act IV spectacle (§21) | Swarm drop, Slack web, `@everyone` flood, chatter, shake, four SFX |
| Poke feedback (§8.2, §8.2a) | Numeral plus the code-snippet joke line |
| Construction Ladder **model** (§7.7) | Rungs, ratio-scaled arrival weight, cohort, scale bar |
| Player-facing vocabulary (§4.3a) | Re-banded against the real curve |

**Specified here, with no implementation:**

| Item | Blocked on |
|---|---|
| **§23.4.1 viewport-aware camera** | Nothing — do this first |
| §10.7 dialogue system + the §10.8 juice kit | Nothing — do this second |
| §21.0 reshaped Run 1, priced Mass Hire | §10.7 |
| §21.6 James / Instant Messenger | §10.7 |
| §7.7.6 drag-pan, per-developer poke, unit selection | Needs a spatial index beside the ParticleContainer |
| §7.7.2 the arrival gag | `SpawnEvent` is already published and unconsumed |
| §7.7.4 Hero Anchor | The desk tier is currently generic |
| §11 tech tree, §13 prestige, §22 cards, save, ads | The above |
| **§20.7 music** | Nothing. Zero of the 9 stems exist, `src/audio/ambience.ts` is referenced in a comment and has never been written, and there is no `generate-music.ts`. §21 Act IV's "the music cuts out" currently subtracts nothing |
| **§7.8 developer animation** | Nothing moves. The desk developer is a static placeholder; the 1,000 floor particles do not bob |
| **Authored art** | **Zero of the 19 §22.7 sprites exist** |

**Nothing currently passes §10.8.** The HUD has no press-down state, no overscroll, no panel
transitions, and most state changes are silent. That is why the juice kit is step two and
the HUD is retrofitted inside it.

#### The order, and why

1. **§23.4.1 viewport-aware camera.** Small, self-contained, and until it lands every layout
   decision is made against a frame that is 92% empty.
2. **§10.7 dialogue + the §10.8 juice kit**, with the existing HUD retrofitted. The kit —
   `Panel`, `Button`, spring/momentum hooks, `Typewriter`, `uiSfx` — is built once here
   because dialogue is the first feature that needs all of it at once. If it cannot absorb
   the buttons that already exist, it is the wrong abstraction, and that is far cheaper to
   discover now.
3. **§21.0 loop reshape** → **§21.6 James scene** → **§7.7.6 navigation** → **§7.7.2 arrival
   gag**.

Each ships only when it passes §10.8 F1–F6 **on the device**.

#### Still owed to a human, not to code

- **Criterion 2** needs an external audio capture (§23.3).
- **Criterion 7** needs re-running in landscape (§23.3).
- **The whole gate** needs a cheap Android handset (§23.3).
- **Visual verification.** Anything that has to be *looked at* needs a session that can
  screenshot.
- **ElevenLabs SFX generation** needs `.env`, which is gitignored.

---

## Appendix A — Superseded / Legacy Concepts **[LEGACY]**

Preserved in full. These were reworked by later drafts but contain flavour and mechanics
worth mining.

### A.1 Working titles

- **100,000,000x Developer**
- **Mythical Man-Millennium**
- **Deploy in 0.0001s**
- **Dev Swarm Idle**
- *Swarm Dev* (working title of GDD v1.0)
- **100000000 Developers** ← **final**

### A.2 Original core gameplay loop (v0)

```
[Tap/Automate Lines of Code] → [Release Game in <1ms] → [Collect Trillions in Revenue] → [Hire Millions More Devs]
```

### A.3 The "Communications Overhead" Boss (Reverse Brooks' Law)

In the real world, adding developers causes communication chaos. In this game,
**Communication Chaos is a raid boss / mini-game**:

- **The Slack Channel Explosion:** every 1,000,000 devs hired creates a "Slack Noise Storm."
- Tap away unread `@everyone` notifications to clear a temporary production bottleneck and
  unlock a **100× speed multiplier**.

*(Survives in the current design as the Slack Explosion Boss panel in the UI wireframe and
the Notification Storm mini-game.)*

### A.4 Developer Tiers & Units (v0 unit ladder)

Instead of just upgrading generic stats, your workforce escalates into hilarious absurdity:

| Tier | Unit | Description |
|---|---|---|
| **T1** | Interns | Powered entirely by energy drinks and hope. |
| **T2** | Senior Engineers | Refuses to write code unless it's in an obscure language. |
| **T3** | Copy-Paste Bots | Literally just Ctrl+C / Ctrl+V from Github. |
| **T4** | Dev Cities | Entire metro areas dedicated purely to writing 1 line of CSS each. |
| **T5** | Dyson Swarm Computers | Harnessing star energy to hit 600 trillion FPS target release dates. |

> **Note:** *Copy-Paste Bots* has no equivalent in the canonical Branch A ladder
> (Interns → Senior Engineers → Dev Cities → Orbital Hive Pods → Dyson Swarm Compute).
> Consider reinstating it as an A2.5 node or as an AI-Slop-era unit.

### A.5 The "Ship It!" Button (Active Tap Mechanic)

- When held down, the **Ship It!** button continuously pumps out thousands of finished game
  releases per second.
- A speedometer on screen counts **"Releases Per Second" (RPS)** instead of just raw currency.

*(Survives as the `[SHIP IT!]` button in the wireframes and as CI/CD Autopilot in Layer 2,
which "holds down the Ship It! button permanently.")*

### A.6 v0 Visual & Mobile UI Design

- **Visual Chaos Bar:** a visual representation of your studio. Starts as a 2D isometric
  desk, scales out to a sprawling skyscraper, then a global map covered in glowing pixels
  representing your dev army typing in unison.
- **Hyper-Speed Project Meter:** watch project progress bars fill up so fast they start
  vibrating and turning rainbow/fire colours.
- **Particle Text Effects:** floating text showing "+1,000,000 AAA RPGs Published!" floating
  across the screen.

### A.7 v0 Prestige System: "The Tech Stack Rewrite"

When progression slows down, hit the **Rewrite Everything in Rust** button.

- **Flavour:** you throw away the entire codebase and replace your billions of developers
  with a new architecture.
- **Reward:** earn **"Architecture Points"** to purchase permanent passive multipliers
  (e.g. *Automated Code Reviews*, *Zero-Latency Coffee Injection*).

*(Replaced by the Protocol Paradigm Shift / Bandwidth Points system. "Rewrite Everything in
Rust" survives as flavour text for a Paradigm Shift, and the confirm button is
`[ REWRITE CODEBASE ]`.)*

### A.8 Original communication tech progression string

```
Shouting across desks → Sticky Notes → IRC/Slack → Agile Standups → Neural Network → Hivemind Quantum Telepathy
```

### A.9 Communication Tech tiers T1–T6 with swarm visual effects **[HIGH VALUE — not repeated in later drafts]**

| Tier | Communication Tech | Visual Effect on Swarm | Mechanics & Gameplay |
|---|---|---|---|
| **T1** | Shouting Across Room | Red noise waves ripple across desks. High chaos. | Devs lock up when hit by a noise wave. Tap noise waves to pop them. |
| **T2** | Daily Standup Meetings | Groups of 10 devs huddle in circles, pausing work every 30 seconds. | Reduces entropy by 30%, but creates cyclic "Meeting Pauses." |
| **T3** | Slack / Discord Tagging | Notification bubbles (`@here`, `@channel`) flood the screen. | Triggers the **Notification Storm** mini-game. Clear pings to restore flow. |
| **T4** | Middle Management Grid | Bureaucrats in suits stand over desks. Red lines connect devs to managers. | Stabilizes base efficiency, but adds a cash burn rate. |
| **T5** | Sub-Dermal Neural Sync | Cables directly plug into the backs of developers' heads. No speech. | Removes text bubbles entirely. Swarm movement becomes synchronized/robotic. |
| **T6** | Quantum Hivemind Matrix | Devs dissolve into glowing energy nodes connected by lasers. | Entropy drops to 0. Swarm operates as a single planetary super-organism. |

### A.10 v1.0 Technology & Communication Progression (5-tier form)

```
1. Shouting Across Desks → 2. Daily Standups → 3. Slack/Discord Tagging → 4. Sub-Dermal Neural Sync → 5. Quantum Hivemind
```

- **Tier 1: Shouting Across Desks** (high noise, physical soundwaves freeze nearby devs).
- **Tier 2: Daily Standups** (devs group in circles every 30s; swiping disbands them).
- **Tier 3: Slack / Notification Webs** (red thread lines connect all desks; triggers notification mini-games).
- **Tier 4: Sub-Dermal Neural Sync** (devs plug directly into desks; speech bubbles disappear, sprite movement becomes robotic and synchronized).
- **Tier 5: Interstellar Neuro-Relays** (devs dissolve into pure energy nodes across the galaxy, operating as a singular hivemind).

### A.11 v2.0 Paradigm Shift tree (earlier node values)

```
                       [PARADIGM SHIFT]
                              |
        +---------------------+---------------------+
        ▼                                           ▼
 [CULTURE REWRITES]                          [PROTOCOL ENGINE]
        |                                           |
   +----+----+                             +--------+--------+
   ▼         ▼                             ▼                 ▼
[Async-First] [Zero-Trust]      [Telepathic Compression] [Quantum Buffer]
(-30% Slack   (No Rogue              (+1,000x            (Auto-Clear
 Noise)        Refactors)             Entropy Cap)         Pings)
```

- **Async-First Culture:** reduces base Slack noise generation by 50%. *(Diagram says −30%.)*
- **Zero-Trust Architecture:** totally removes the "Rogue Refactorer" negative event.
- **Telepathic Compression:** expands the maximum number of developers before exponential entropy kicks in by 10,000×. *(Diagram says +1,000×.)*
- **Automated Ping Slicer:** poking one dev automatically triggers a chain reaction that wakes up all adjacent devs on the same office row.
- **Quantum Buffer:** auto-clears pings. **[Node dropped in v3 — consider reinstating.]**

### A.12 v2.0 in-run tech tree (earlier branch shape)

```
[WORKFORCE BRANCH]        [COMMUNICATION INFRA]        [CULTURE / JUICE]
  ├── Hire Interns          ├── Voice Shouting          ├── Instant Cold Brew
  ├── Dev Cities            ├── Daily Standups          ├── Ergonomic Chairs
  └── Orbital Hive Pods     ├── Async Slack Protocols   └── Pizza Parties
                            ├── Sub-Dermal Neural Sync
                            └── Interstellar Quantum Relay
```

*Dropped names worth keeping: **Async Slack Protocols**, **Pizza Parties**, **Instant Cold
Brew**, **Interstellar Quantum Relay**.*

### A.13 v2.0 Infinite Multiverse Endgame phrasing

Once the player successfully reaches 100,000,000 Developers with 100% efficiency, they
complete the main story arc by launching **"Simulated Universe 1.0."**

**Endless gameplay loop:**
- **Multiverse Studio Expansion:** unlocks parallel dimensional studios running simultaneously (*Cyberpunk Dimension*, *Medieval Alchemy Coders*, *Silicon Nebula*).
- **Dimensional Speedometer:** projects are completed in planck time ($\le 10^{-43}$ s). The core metric shifts to **Universes Rendered Per Second**.
- **Galactic Entropy Events:** solar flares, cosmic ray bit-flips, and inter-dimensional ping delays create continuous, procedural active challenges across the star map.

---

## Appendix B — Glossary & Symbols

| Symbol / Term | Meaning |
|---|---|
| $E$ | Communication Entropy, $= 1 - \eta$. Displayed as the Entropy Speedometer percentage. |
| $E_{local}$ | Per-developer entropy added by poking (§4.9) |
| $L$ | Communication load, $= D / D_{cap}$ (§4.1) |
| $\eta$ | Efficiency factor, $= 1/(1+L^{\rho})$ — the multiplier applied to all output, passive and poked |
| $\rho$ | Overhead Exponent (**5**) — how violently the studio collapses past capacity |
| $D_{\text{optimal}}$ | Peak-output headcount, $\approx 0.76\,D_{cap}$ — hiring past this makes the studio slower |
| **SP** | Story Points — the universal unit of project progress (§4.4) |
| **Velocity** | SP per second, passive + active |
| **Sprint Commitment** | A project's total SP cost |
| $F(\text{tier})$ | Fibonacci estimation ladder value: 1, 2, 3, 5, 8, 13, 21, … (§4.6) |
| $S(\text{state})$ | Poke multiplier from the target developer's current state (§4.7) |
| $Z(\text{zoom})$ | Poke per-dev yield factor by camera zoom level (§4.8) |
| $\epsilon$ | Context Switch Coefficient — entropy added per SP poked (0.02 base) |
| $M$ | Manpower |
| $D$ | Active developer count |
| $D_{peak}$ | Peak active developer count in a run |
| $D_{cap}$ | Effective developer capacity before exponential entropy |
| $D_{base}$ | Base dev capacity (100) |
| $\sigma$ | Entropy knee softness |
| $\mu$, $\phi$ | Prestige scaling multiplier (1000) & compression exponent (1.35) |
| $\$_{total}$ | Lifetime revenue earned in a run |
| $\$_0$ | Base revenue normalizer ($10^{12}$) |
| $\alpha$, $\gamma$ | BP base yield scalar (100) & growth exponent (0.20) |
| $\beta$, $\delta$ | Paradigm node level multiplier (1.50) & depth multiplier (2.20) |
| **BP** | Bandwidth Points — Layer 1 prestige currency |
| $\text{BP}_0$ | Layer 2 prestige threshold (100,000 BP) |
| $\chi$ | GP base yield scalar (10 GP) |
| **GP** | Git Branch Points — Layer 2 prestige currency |
| $P_{class}$, $P_{max}$, $\lambda$ | Hero spawn probability, soft cap, growth coefficient (0.25) |
| $M_{hero}$, $\eta$ | Hero output multiplier, scaling coefficient (0.5) |
| $\kappa$ | Layer 2 node cost multiplier (1.75) |
| $M_{cash}$, $\omega$ | Permanent cash multiplier, cash boost coefficient (0.15) |
| **PC** | Planck Cores — Layer 3 prestige currency |
| $t_P$ | Planck time, $\approx 5.39 \times 10^{-44}$ s |
| Planck length | $1.62 \times 10^{-35}$ m |
| **UR/s** | Universes Rendered Per Second |
| **RPS** | Releases Per Second |
| $Z$ | Camera zoom distance parameter, $[0.0, 1.0]$ |
| $f_{LPF}$, $R_{wet}$ | Low-pass filter cutoff, reverb wet/dry ratio |

---

## Appendix C — Balance Conflicts To Resolve **[CONFLICT]**

Different drafts specify different values for the same thing. Each needs a single canonical
number before implementation.

| # | Item | Value A | Value B | Value C | Resolution |
|---|---|---|---|---|---|
| 1 | **Async-First Culture** — Slack noise reduction | −50% (v2/v3 text; node L1-1A = 10%/level × 5) | −30% (v2 tree diagram) | — |
| 2 | **Telepathic Compression** — entropy cap increase | +1,000× (v1/v2 text; node = +1,000×/level) | +10,000× (v3 tree diagram) | +3,000× at Lvl 3/10 (prestige UI) — implies +1,000×/level, so **A is likely canon** |
| 3 | **Daily Standups** — entropy effect | Reduces entropy by 30% (legacy T2 table) | Reduces base entropy growth by 15% + cyclic pause (Agile ritual) | Caps max entropy at 80% + cyclic pause (node B2) |
| 4 | **Daily Standups** — huddle cadence | Every 30 seconds (legacy T2) | Every 60 seconds, 20% of devs freeze 5s (node B2) | — |
| 5 | **JIRA Ticket Flooding** — entropy cap | 75% (§12.2, v3 GDD) | 60% (node B4, tree index) | — |
| 6 | **10x Engineer** — spawn chance per level | +1% per level (node L2-1A) | 2% at Lvl 2/5 (prestige UI inspector) | $P_{max}$ = 5% (spawn curve) |
| 7 | **Merge Conflict trigger** — headcount | >500 devs without Git/Branching tech | >500 devs without Version Control | Same rule, differing phrasing |
| 8 | **Layer 1 BP formula** | $\lfloor(\$_{total}/10^{12})^{0.2} \cdot \log_{10}(D_{peak})\rfloor$ | $\lfloor\alpha(\$_{total}/\$_0)^{\gamma}\log_{10}(D_{peak})\rfloor$ with $\alpha=100$ | The two differ by a factor of 100 — pick one |
| 9 | **Quantum Buffer** node | Present in v2 Protocol Engine tree (Auto-Clear Pings) | Absent from v3 / node index | — |
| 10 | **Poke → Slacking dev** speed boost | +50% for 10s (poke table) | +100% for 10s (node C1 *Nitro Cold Brew*) | C1 is an upgrade *on top of* base — confirm stacking |
| 11 | **Zone boundaries** for audio vs. poke SFX | Zones 0/1/2/3 at 0.2 / 0.5 / 0.8 | Volume curve breakpoints at 0.25 / 0.55 / 0.75 | Align the two tables |
| 13 | ~~**Act IIa signal is flat**~~ | ~~Leave it at ~10 devs~~ | ~~Push to ~30–50~~ | ~~Lower the §4.2 cap~~ | ✅ **RESOLVED 2026-08-07 — Act IIa now runs to ~40 developers**, the first headcount where the readout stops saying `IN SYNC`. The §4.2 cap is untouched, so §6.2's canonical 0.01x figure and §21 Act V's 0.00000x both stand unchanged. See §21.0. |
| 14 | ~~**Five of seven §4.3a labels unreachable in Run 1**~~ | ~~Correct as designed~~ | ~~Re-band against the Run 1 curve~~ | ~~Two band sets~~ | ✅ **RESOLVED 2026-08-07 — re-banded against the curve** (1% / 10% / 40% / 70% / 90% / 99%) rather than evenly across the axis. One band set, not two. `CHATTY` now lands at ~40 devs, inside Act IIa. See §4.3a — which also records the follow-on: drive the readout off *landed* developers so the Act IV drop sweeps the middle four labels instead of skipping them. |
| 12 | ~~**The efficiency factor never reaches 1 or 0**~~ | ~~$\eta = 1/(1+e^{E})$ gives 0.50 at $E=0$ and 0.27 at $E=1$~~ | ~~Story Point baseline assumes $\eta(0)=1$~~ | ✅ **RESOLVED.** Replaced with the load curve $\eta = 1/(1+(D/D_{cap})^{\rho})$, $\rho=5$ — see §4.1. Reaches 1, reaches 0, spans five orders of magnitude, derives the 0.01x trap figure, and produces a genuine optimum headcount below capacity. |

---

## Appendix D — Production Risk Notes **[EDITORIAL]**

Not from the design drafts. Flagged because the visual ambition here is the main cost
driver. The engine choice that follows from these risks is recorded in
[ADR 0001](./docs/adr/0001-engine-and-rendering-stack.md).

1. **The Omni-Lens is the whole game and the whole budget.** Seamless zoom across 9+ orders
   of magnitude with live sprites at every level is the single hardest technical
   requirement. Everything else is a standard incremental game.
2. **Cheapest viable version of the hook:** discrete zoom levels with a hard cut masked by
   the blur/whoosh transition already specced in §8.1 and §20.4. The player experiences
   "seamless" if the transition is fast, loud, and blurred.
3. **Swarm rendering is not per-sprite past ~1,000 devs.** Level 3 and Level 4 explicitly
   "fuse into a geometric Dev Grid" with "no individual sprites" — lean on that. Static
   pixel tiles + shader-driven heatmap, not animated agents.
4. **Micro-details at macro scale (§7.3) is the expensive promise.** Zooming into any pixel
   on a global map to find an individual animated dev implies procedural generation at
   arbitrary depth. Consider limiting it to a fixed set of "inspectable" hotspots.
5. **Animation budget:** the poke states (§8.2) need only 4 sprite reactions plus a
   particle effect each. That is the correct scope. Resist per-tier unique idle animations.
6. **Text does the comedy work, not art.** The dialogue library (§19), events (§18), and
   ticker tape (§18.5) are the humour delivery system and cost nothing to produce.
7. **Six multiverse dimensions = six palette swaps + six audio stems + one mechanical
   twist each.** Explicitly designed to be cheap re-skins. Keep it that way.
8. **The audio spec (§20) is more expensive than it looks** — 4 zones × multiple stems,
   plus real-time DSP. Consider shipping with 2 zones and the crossfade, adding zones later.
9. **Three prestige layers is a lot of UI.** Layers 1 and 2 have full wireframes; Layer 3
   is an infinite procedural grid that needs its own screen. Ship L1 at launch, L2 in the
   first content update, L3 later.
10. **The Early Game Trap deliberately makes players lose 3–5 runs.** This is a retention
    risk as much as a design feature. Instrument the funnel around Run 1 Act V heavily.
11. **The clicker layer is the cheapest system in the game and carries the most feel.**
    Floating Fibonacci numerals, a burn-down line, and haptics — no new art. Prioritise
    getting the poke to feel good before anything else; if the first thirty seconds of
    tapping is not satisfying, none of the rest matters.
12. **Transitions (§10.5) are a fixed, non-negotiable cost.** They are what separates this
    from a web page, and they must be budgeted at the start rather than retrofitted.
    Retrofitting motion onto a screen system built around instant swaps is a rewrite.
13. **Hero Cards are capped at 12, and §22.7 is now a hard constraint rather than advice.**
    19 small sprites total, with per-tier art for James alone. Treat any proposal to expand
    the roster as a scope change requiring an explicit decision, not a content task.
14. **The 100M gate is a long climb by design (§13.5).** Verify with telemetry that the
    stretch from ~10M to 100M does not become a dead zone; that band is where an
    incremental game of this shape most often loses players.

---

## Appendix E — Design Direction Log

The brief evolved through these directions, in order. Preserved verbatim, including typos,
because they record the original intent behind each system:

1. *"Game idea, I find the throw more people in and the project gets done faster premises very funny, any idea to do a idle/game dev game on mobile that gets that to extereme, throw millions of developers to do project in Milli seconds, help me develop that idea?"*
2. *"Draft a mobile UI layout and wireframe for this idle game_dev concept"*
3. *"Write a set of funny random in-game events and popups for this developer idle game"*
4. *"I want to ensure there's a visual impact to the swarm of developers, some sort of zoom in and out effects on the developers. Visual is everything, I don't want yet another web page-y game. Mechanics of communication entropy fighting should be core mechanics of the game, at beginning player tempted to hire 1000000 Devs but works worse then just one person, and upgrade and prestige should be around improving communication, from slack to neuro sync network"*
5. *"Gimme some sketches of game play, also we should be ending at inter galactic dev network"*
6. *"I would still like a UI nicely layed, but the visual on mai game play should include some way to zoom all the way out and down to each single desk, you can ask the developer what he's doing,"*
7. *"Sketch me some game UI"*
8. *"I want isometric art style, so you can zoom from galactic view to a planet to a network of offices to a floor then to a row and to a desk. Some idle game element that you can polk a dev to make him work faster or slower"*
9. *"Pixel style game play"*
10. *"Ok for what we have so far, build me a gdd"*
11. *"Working title should be 100000000 Developers"*
12. *"The visual, zooming should have a visual effect like blurring, the game juice layer is paramount, poking dev should have different effect. And a well designed upgrade and prestige tree is also paramount. Setup some early game trap that deliberately lose gamers first few runs, make them to at least play enough runs to beat the game, hiring 100000000 developers, then infinitely playable"*
13. *"The key game tension is to balance man power and communication entropy, so upgrade should include fun things like daily scrum, extreme programming, pair programming, some of these silly early developments paradigm. And to later anti AI slop etc."*
14. *"I really like you ship projects in Planck time end game condition. Give me a updated GDD"*
15. *"Flesh out the upgrade and prestige systems in the gdd, needs to have depth and goes for long time"*
16. *"Draft mathematical formulas for the Prestige Bandwidth scaling"*
17. *"Given this draft all the upgrades and prestige upgrade trees."*
18. *"Draft UI layout wireframes for the Paradigm Shift talent tree"*
19. *"Create a detailed list of endgame Multiverse dimension themes"*
20. *"Design audio specifications for the dynamic camera zoom"*
21. *"Write random in-game events for Multiverse dimensions"*
22. *"Draft mathematical formulas for the Codebase Fork Layer 2 prestige"*
23. *"Write dialogue lines for the Desk Query interaction"*
24. *"Create a detailed summary table of all three prestige layers"*
25. *"Draft UI layout wireframes for the Codebase Fork Layer 2 prestige screen"*
26. *"Write an introductory narrative script for the early game trap"*
27. *"There should be a idle game clicker layer as well in the form of 'poking' developer to squezze out 'story points' that progresses towards dev progress"*
28. *"given we are called 100M devs, the official pre-prestege gate should be at 100M"*
29. *"there should be collectables, one idea is 'hero' class in form of pokemon cards that can be placed and effect on the game. put some listings of heros in GDD, first one should be call James, your first buddy, glassed bloke with thick facial hair"*
30. *"also UI front, all scene, screen transitions must be animated appropriately, not a direct immediate jump, feeling like web page. Add that to anti pattern/ to be avoided"*
31. *"one feature on James, he always wear a white shirt, but elbow always has a whole"*

---

## Appendix F — Shipping Readiness Register **[CANON]**

**Why this exists.** The §10.9 title screen was found missing only when someone asked about
it — the first screen every player sees, entirely unspecified, in a document that otherwise
reads as finished. That is the failure mode this appendix exists to prevent: **a design
document that appears complete while describing an unshippable product.**

Everything below was audited against the docs on 2026-08-07. **A gap here is not a to-do —
it is a claim that the game cannot ship until it is closed.** Anything marked ❌ has *no
specification anywhere*, not a thin one.

---

### F.1 Blockers — the game cannot ship without these

| # | Gap | Status | Why it blocks |
|---|---|---|---|
| **F1.1** | **Save / persistence** | ❌ **Nothing** | There is no save specification of any kind: no format, no schema version, no migration path, no corruption handling, no statement of what survives a Paradigm Shift versus a Codebase Fork, no local-vs-cloud conflict resolution. `@mercilessstudio/game-cloud` is named in §23.1 and **nothing says what it stores.** An idle game that forgets everything on close is not a game |
| **F1.2** | **Offline progression** | ❌ **Nothing in the GDD** | MONETISATION §4 R1 calls doubling offline earnings *"the single highest-value placement in any idle game"* and §6 sells an *"offline accrual cap 4h → 16h"*. **The GDD defines no offline model at all** — no accrual rate, no cap, no statement of what accrues (SP? cash? both? does Entropy decay?), and no offline-summary screen, which R1 requires to exist *and* requires the ad to sit above its collect button. The monetisation document is selling a system the design document never designed |
| **F1.3** | **Age rating & target audience** | ❌ **Nothing** | Google Play requires a content-rating questionnaire and a target-audience declaration at submission. This is not paperwork: declaring child appeal forces the Families policy, bans personalised ads, and changes the AdMob and analytics configuration. It has to be decided *before* the ad stack is built, not at upload |
| **F1.4** | **Privacy policy & data deletion** | ❌ **Nothing** | Play requires a published privacy policy and an in-app data-deletion route for any app that collects data. Firebase, AdMob and RevenueCat all collect. MONETISATION §10 correctly orders the UMP and ATT prompts, but nothing states what data is collected, where the policy lives, or how a player deletes their account |
| **F1.5** | **Restore purchases** | ⚠️ **One line** | Required by both stores for non-consumables and subscriptions. MONETISATION mentions it once; there is no UI entry point specified, and §10.9's menu does not include one |

### F.2 Major gaps — shippable, but visibly unfinished

| # | Gap | Status | Note |
|---|---|---|---|
| **F2.1** | **Settings screen** | ❌ | §10.6 says style it as a `STUDIO_OS` config terminal and §10.8 lists it as a scene. Nothing says *what is in it.* At minimum: master / music / SFX volume — §20 specifies a four-tier mixer that nothing exposes — haptics on/off, reduce motion, language, and **reset progress**, which is a support necessity and a store requirement in some jurisdictions |
| **F2.2** | **Localisation** | ❌ | Not "English-only, decided" — simply unaddressed. It has teeth: §10.7's per-character typewriter behaves differently in CJK, §22 card names are jokes, and §18/§19/§21 are almost entirely wordplay that does not survive literal translation. **Decide English-only and record it**, or the decision gets made by accident at the first translation request |
| **F2.3** | **Error and empty states** | ❌ | Nothing specifies what the screen does when: a rewarded ad fails to load (R1 says a missing ad is *"revenue that does not exist"* but not what the player sees), an IAP fails or goes pending, there is no network, a cloud save conflicts, or a save is corrupt. These are most of the states a real player meets on a bad train |
| **F2.4** | **Push notifications** | ❌ | Zero mentions. Idle games depend on re-engagement, it interacts directly with F1.2's offline accrual (*"your build is ready"*), and it carries its own permission prompt and policy implications |
| **F2.5** | **Store listing assets** | ❌ | §22.7 caps *in-game* art at 19 sprites and is silent on the icon, feature graphic and screenshots. Those are a separate art requirement with a separate budget, and the icon in particular is the single most-viewed asset the project will ever produce |
| **F2.6** | **App lifecycle** | ⚠️ | §23.3 knows Chrome suspends `rAF` in a hidden tab. Nothing says what the *game* does on backgrounding, an incoming call, or an audio-focus loss — which is also where F1.1 and F1.2 meet, because that is when a save must happen |

### F.3 Smaller, still real

| # | Gap | Note |
|---|---|---|
| **F3.1** | **Credits content** | §10.9 puts CREDITS in the menu; nothing specifies it. Departure Mono ships under the SIL OFL and its licence text **must** be reachable in-product |
| **F3.2** | **Analytics event schema** | MONETISATION §12 lists metrics and Appendix D says to instrument the Run 1 funnel *"heavily"*. No event names, properties or schema exist, so two people will invent two |
| **F3.3** | **Tutorial beyond Run 1** | §21 scripts Run 1 exhaustively. Nothing teaches the tech tree, the org chart, or the Multiverse grid when they first unlock |
| **F3.4** | **Live-ops / remote config** | MONETISATION §10 requires every ad placement behind remote config. Nothing specifies the config schema, defaults, or what happens when the fetch fails |

### F.4 Audited and genuinely covered

Recorded so the register is honest about what is *not* missing:

- **Platform** — Android-first, iOS deferred with the reasoning and the cost (PROJECT_SETUP §5.3)
- **Consent ordering** — UMP and ATT before `useAdMobInit` (MONETISATION §10)
- **Reduce motion** — §10.5, §10.7, §10.8
- **Performance budget** — §23.3, with an honest column on what is actually proven
- **Orientation** — §23.4, forced by the projection and measured
- **Art budget** — §22.7, hard-capped, with the escape routes named
- **Music budget** — §20.7, hard-capped, with the per-scene mix map
- **The presentation gate** — §10.8, with a scene inventory so "all scenes" is countable

### F.5 How to use this

**Close a gap by writing the specification into the body of this document**, then strike the
row here with the section number that now owns it. Do not close a row by building the
feature — an undocumented feature is the same failure this appendix exists to catch, arriving
from the other direction.

**F1 is ordered.** F1.1 and F1.2 are the ones with architectural reach: save shape and the
offline model both constrain the store, and both are cheaper to decide before the tech tree
and prestige layers add state that has to persist.
