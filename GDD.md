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

### 0.2b The build order is §26 — **added 2026-08-15**

**This document specifies a finished game. [§26](#26-the-delivery-roadmap-canon--added-2026-08-15---r51r79)
specifies the order it gets built in**, in three phases with a closing gate on each, and no
dates anywhere.

Read it before starting work. The failure it exists to prevent is not a specification gap — by
§25.8.3's count, fourteen of the last intake's twenty-nine requirements were already canon and
eight were already built. It is an *ordering* gap: a system arrives before the thing it needs,
gets built half-way, and the missing half is the half the player can see.

- **§26.1 — the core loop.** Every system reachable, and each one introduced by somebody.
- **§26.2 — scale.** The same game at a hundred million developers, at sixty frames a second.
- **§26.3 — life.** The floor as a place people work in, not a grid people are drawn on.

**[§3.1](#31-the-loop-is-the-inventory-canon--added-2026-08-15---r80) is the other half of the
same correction.** `MONETISATION.md` was complete and correct *beside* this document, which
hid three collisions with the loop and one finding neither document could reach alone. Every
place the loop is asked to make room for an offer now lives in §3.1, next to the loop. Prices,
revenue mix and store phasing stay in `MONETISATION.md`, which is still the source of truth
for all of it.

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

You start as a solo indie developer in a messy home garage trying to make a simple Flappy Bird
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

### 3.1 The loop is the inventory **[CANON — added 2026-08-15]** - R80

**[`MONETISATION.md`](./MONETISATION.md) is a complete revenue design and it has been a
*companion* document, which means the loop above was designed without it.** That is the
normal way to get this wrong, and it stays invisible until the two documents are asked to
agree about a specific screen at a specific moment.

They do not, in three places, and each one is a decision this section takes rather than
defers:

| Collision | Found by |
|---|---|
| MONETISATION R2 wants a **persistent HUD button**. §10.1a's rails are spent to the pixel and trap 26 records what happened the last time a control was added to one | §10.1a |
| MONETISATION §4's *"3–8 rewarded views per DAU"* is a **function of run length**, and until §13.12 nothing in this document said what a run's length was | §13.12 |
| MONETISATION R4 attaches the highest-intent offer in the game **to the prestige**, and §13.12.1 makes a late-game run last one to three *days* | §3.1.3 |

**So the placements live here, against the loop moments they attach to.** MONETISATION.md
remains the source of truth for prices, revenue mix, eCPM assumptions, store phasing and
metrics — none of that is design and none of it belongs in a GDD. **What belongs here is
every place the loop is asked to make room for an offer**, because a placement is a HUD
component, a pacing decision and a story beat before it is a line of revenue.

#### 3.1.0 The guardrail, restated because it is a design rule

MONETISATION §2 lists six things that must never be sold, and the list is not a policy — it
is a description of this game's spine. Compressed to the sentence the loop has to obey:

> **Sell time, convenience, cosmetics and content. Never sell capability the design requires
> you to earn.**

The three that bind hardest on §26.1's work: **no way past §6's trap**, **no Hero Card,
duplicate or promotion in any purchasable or randomised form** (§22.6), and **no premium
currency** — the game has four already. §13.13's levels join that list the moment they
exist: a level is earned from covered work or it is not a level.

#### 3.1.1 Where an offer attaches, by loop moment

Every placement is named in-fiction, because this game's premise makes a diegetic ad offer a
free joke rather than an interruption. MONETISATION §4 is the full table; this is the map
onto the loop, and the right-hand column is the part that is new.

| Loop moment | Offer | What the loop owes it |
|---|---|---|
| **Returning after time away** — §24.8's Overnight Build Report | **OVERNIGHT BUILD** (2× offline) | The report must render the offer **above** the collect button, and must not resolve the accrual until it has. §24.8 currently collects on open |
| **Cash-starved, mid-run** — cannot afford the next §11 node for 60 s | **PITCH TO INVESTORS** (30 min of production, as cash) | §11's board must expose *"the cheapest node I cannot afford"*, which `techBoard.ts` can already answer |
| **Any time, capped** — the workhorse | **CONTRACTOR SURGE** (+100% output, 30 min) | **A place to put a button.** See §3.1.4 — this is the one that is genuinely blocked |
| **The prestige confirm** — §15.1's modal | **BANDWIDTH GRANT** (+20% BP) | Nothing. The modal exists and has room. This is the highest-intent moment in the game and it is free |
| **After the first shift** — §11's board is open | **AUTO-POKE DRONE** (10 min of auto-poke) | Must stay materially weaker than the owned L1-3B node, and must still pay §4.9's context-switch penalty. It buys a rate, not an exemption |
| **Inside an entropy event** | **PAGERDUTY ESCALATION** (clears it) | §18's events must be *clearable*, and be able to say so. Sells convenience the player could have tapped out |
| **A locked Layer 3 dimension** | **DIMENSION TRIAL** (one free run) | Layer 3. Phase 2 at the earliest |
| **An unintended bankruptcy, after run 5** | **SEVERANCE PACKAGE** (keep 25% of BP) | **Hard-gated past §21's scripted collapse.** The gate is not a courtesy; an offer on Act V's bankruptcy sells the player out of the lesson |

**And one rule that outranks the table: no offer of any kind before the first Paradigm
Shift.** §21's five acts run clean. That is already exactly where §21.0c puts every system
and where §21.7.6 puts every instrument — **the monetisation gate and the design gate are
the same gate**, which is the strongest evidence available that this section belongs in this
document rather than beside it.

#### 3.1.2 §13.12's pacing table *is* the inventory model

MONETISATION §3 plans against "3–8 rewarded views per DAU per day" and treats it as a
benchmark. It is not a benchmark here; it is an **output** of §13.12, and the two can be
checked against each other:

| Phase | Run length (§13.12.1) | Run-attached offers/day | Session-attached offers/day |
|---|---|---|---|
| First steered run | 1–3 h | ~1 (one prestige) | 1–2 return, 1–3 surge |
| Early loop | 15–45 min | 2–5 | 1–2 return, 2–4 surge |
| Mid-game | 2–8 h | 1–3 | 1–2 return, 2–4 surge |
| Late game | **24–72 h** | **~0.3** | 1–2 return, 2–4 surge |

Three of the four rows land inside the 3–8 band without tuning anything, which is a
coincidence worth not relying on and worth noticing: **a pacing curve designed for a good
prestige loop produces a good ad-inventory curve, because both are asking the same question
— how often does something worth marking happen.**

#### 3.1.3 The late-game inventory cliff, and what the loop does about it

The fourth row does not land, and it is not a tuning problem.

**A 24–72 hour run fires every run-attached placement roughly once a day at best.** The
prestige-attached BANDWIDTH GRANT — the highest-intent offer in the game, the one the player
*wants* — becomes nearly unavailable exactly when the player is most invested. Meanwhile
§13.12.1 puts late-game active time at 5–15 minutes **per day**, so the player is opening the
app daily and finding nothing to accept.

**The answer is that late-game inventory has to be session-shaped, not run-shaped**, and the
loop has to provide the sessions:

- §24.8's **Overnight Build Report is the late game's primary placement**, and this is the
  design consequence: the report must stay worth opening at every scale. A report that reads
  `+4.2e19 SP` and nothing else is a number, not a moment.
- **A daily milestone that is not a prestige.** §13.12's late game "pushes for massive
  milestone targets" — those targets are the late game's run-attached inventory, and they
  need to be crossed on a *daily* rhythm rather than a per-run one.
- The **CONTRACTOR SURGE** carries the rest, which raises the stakes on §3.1.4 considerably:
  the placement that has nowhere to live is the one the late game depends on.

> This is the finding that justifies the whole section. **It is invisible from either
> document alone** — MONETISATION.md cannot see it because it does not know how long a run
> is, and §13 could not see it because it was not counting placements.

#### 3.1.4 The one thing that is blocked, and the decision it needs

**CONTRACTOR SURGE needs a persistent, always-visible control, and §10.1a says there is no
room in either rail.** Trap 26 is explicit that this class of problem is not solved by
shaving padding: *"a control does not belong in a column of readings; it belongs in the
action rail or as a floating element."*

Three options, and this is a human decision rather than a test one:

| | Cost |
|---|---|
| **A floating control**, bottom-left, outside both rails | Breaks §10.1's two-rail composition, which has survived every frame size in §23.4.2 |
| **In the action rail**, packing with §10.1's play tools (§10.1a rule 3) | The action rail is already the one that gave up content at 470 px and 400 px |
| **Attached to the ship**, not persistent — offered on §10.8a's release moment | Loses "1 active at a time, 6/day"; gains a moment that is already a celebration. **Recommended**: it is the only option that costs no pixels and it turns the workhorse placement into a beat rather than furniture |

Until that is settled, **the surge is specified and not placed**, and §26.1.7 records it as
the one monetisation item Phase 1 cannot close on its own.

#### 3.1.5 The freemium shape, in one table

Full catalogue and prices are MONETISATION §6–§7. What the loop needs to know is which of
its own systems each SKU touches, because that is where a purchase can quietly break
something:

| Sold | Touches | The guardrail it must not cross |
|---|---|---|
| **Dimension packs** (anchor SKU) | §17's Layer 3 re-skins | Content, not capability. A dimension changes the rules; it does not raise a cap |
| **Remove Forced Ads** | Interstitials only — **never rewarded offers** | MONETISATION §6.2's trap: a naive remove-ads converts your best players into $4.99 |
| **Founder's Equity / The IPO** | Cash and BP *yield* multipliers | Yield, never the §4.2 cap and never §4.1's entropy. They speed the curve; they do not remove it |
| **Wardrobe** | §22.9's card frames and portrait variants | **Cosmetic only.** No card, no duplicate, no promotion, ever — §22.6 |
| **SERIES A** (v1.1) | §24.5's offline cap 4 h → 16 h, and rate | The one subscription benefit that retains in this genre, and it is time — which is the sellable thing |

**No gems.** Four currencies is already three more than most games in this genre carry, and
a fifth whose only source is a credit card is both confusing and tonally wrong.

#### 3.1.6 What Phase 1 owes this section

Not the ad SDK — that is a Phase 2 integration and MONETISATION §10 owns the plan. **What
Phase 1 owes is that the loop has the shapes an offer attaches to**, which is cheap now and
expensive later.

The list was written speculatively and then checked against the build, which is the only
reason it is worth keeping. **Three of the five were already true**, and the check is what
found the fourth to be the wrong requirement:

| | Shape | State, measured 2026-08-15 |
|---|---|---|
| 1 | §24.8's report **defers the collect** until the player acts | **Already true**, and further along than this asked: `collectOffline` takes a `rewardMultiplier`, so R1's 2× has a parameter waiting for it |
| 2 | §11's board can name **the cheapest unaffordable node** | **Built.** `techBoard.cheapestUnaffordable` |
| 3 | §18's entropy events are **clearable, and know it** | **Cannot be prepared.** §18's events are not a system yet — the only thing in the build that mentions them is a Paradigm node that switches one off |
| 4 | The prestige confirm modal has **a second button's worth of room** | **Wrong screen.** See below |
| 5 | All of it behind `paradigmShifts > 0` | Already true — §21.0c's gate |

**Item 4 was the useful mistake.** It reads as a layout requirement and it is not one: Act V's
modal has room for six buttons. What it collides with is MONETISATION §5's own rule —
*"never on the bankruptcy screen. That is an emotional story beat and the tutorial's
punchline"* — and R4's BANDWIDTH GRANT attaches to the **voluntary** prestige confirm, which
is a different screen reached from §13.2's tree and only exists after the first shift. So the
requirement is not "make room"; it is **"the voluntary confirm and the Act V modal must stay
two screens"**, which they are, and which nothing may quietly merge.

> On item 2, and why it is not an advertising feature: `cheapestUnaffordable` answers *what is
> this player stuck on*, and it is careful about the word **wants** — a node behind a closed
> ring or an unbought prerequisite is not something the player is short of *cash* for. That is
> also the question a hint, a tutorial nudge or a §21 advisor line asks, and nothing in
> `techBoard.ts` knows what an advert is.

None of this mentions advertising, none of it is wasted if the mix changes, and all of it is
a retrofit if it is skipped.

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

> **Superseded in part by §4.5a.** The formula below is intact and still produces the
> number; what changed is where that number goes. A poke now *buffs the individual's own
> output rate* rather than paying out once, it applies to **any unit on the Construction
> Ladder** rather than only to a person, and §4.5d gives the founder a desk of their own.
> Read 4.5a-4.5d before implementing anything here.

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

### 4.5a The poke is a BUFF, not a payout **[CANON - added 2026-08-08]** - R14

**Section 4.5's tap pays out once and is forgotten.** That is a clicker, and it is the shallow
half of one: the tap is worth the same whoever you aim it at, so there is no reason to aim.

**A poke now raises that individual's own output rate**, for a while. What you are doing is
still a status check - you are still interrupting them, and it still costs Entropy - but what
it buys is *that person working harder*, not a coin.

Everything that follows from that is the point:

- **Who you poke matters.** A poke on a developer carrying a good modifier (4.5c) is worth
  more than the same poke on the person beside them. The player is choosing a target rather
  than choosing a rate.
- **Poking is an investment with a decay.** The buff fades, so the loop is *maintain the
  people who are worth maintaining* rather than *tap the screen as fast as possible*. A tap
  that pays instantly rewards a macro; a tap that decays rewards attention.
- **It composes with everything already specified.** 4.7's dev states still scale it, 4.6's
  Fibonacci ladder still sets the base, and 4.1's Entropy still taxes it. What changes is the
  *destination* of the number, not the formula that produces it.

**The architectural consequence, stated plainly because it is not small:** the store currently
models **one** dev-state machine for the whole studio - "the store models one machine, not one
per person". A per-employee buff needs per-employee state. That is the first thing this
requires and there is no way around it: a shared machine cannot hold a buff belonging to
seat 41.

**The one-off payout does not vanish entirely.** A poke still emits its 8.2 numeral, because
instant feedback on a tap is non-negotiable (10.8 F2). It is now the *smaller* half of what a
poke does, and the buff is the larger.

### 4.5b Anything you can see, you can poke **[CANON - added 2026-08-08]** - R15

The poke generalises **up the Construction Ladder**. Whatever unit 7.7.1 says the camera is
currently holding - a person, a squad, a floor, a building, a campus, a town, a nation, a
planet, a galaxy - **that unit is the thing a tap lands on**, and the buff applies to
everything inside it.

This is the single idea that keeps the clicker alive at 10^12 developers. 4.6's Fibonacci
ladder was the previous answer and it only ever scaled the *number*; this scales the **verb**.
Poking a building is not a bigger poke, it is a different poke, and it is available exactly
when a building is the thing on screen.

**The rule that stops it collapsing:** the buff **percentage falls as the unit grows**, on the
same shape as 4.8's `Z`. A poke on one person is a large boost to one person; a poke on a city
is a tiny boost to millions. Both are worth doing and neither dominates - and the player who
punches in to buff a specific squad hard is making a real trade against the player who sweeps
a nation for a little.

> **Without that rule the game has one strategy: always poke the biggest thing.** Any tuning
> that makes the largest unit the best target has deleted the zoom.

**And it is the same gesture at every rung**, which is what makes it teachable once. 7.7.6a's
poke-versus-drag rule therefore has to hold at every scale too.

### 4.5c Modifiers live on the individual **[CANON - added 2026-08-08]** - R14

A poke's value is multiplied by whatever is **attached to the thing being poked**. A developer
carries modifiers; so does a squad, a floor, a building.

Sources, all of which already exist or are specified:

| Source | See |
|---|---|
| The developer's own innate output roll | 4.9a |
| Hero Card coverage - a card whose reach includes them | 13.6.2 |
| **Items** bought with cash and equipped to a hero | 13.6.9 |
| The current dev state | 4.7 |
| The in-run tech tree, where a node names individuals | 11 |

**Modifiers must be legible on the target**, not buried in a panel. A developer worth poking
should look worth poking - 7.8.7 already gives every one of them a distinct silhouette, and
this is what that distinctness is *for*.

### 4.5d The Founder's desk - your own coding tree **[CANON - added 2026-08-08]** - R16

**The player is a developer too, and they have a desk.**

There is one seat on the floor that is yours. It is the first desk in the room (7.8.1's "one
desk in a dark home garage"), it is where 7.7.4's Hero Anchor lands, and it never goes away - at
ten thousand developers your desk is still there, still yours, and still clickable.

> **§7.8.10 and §13.7.1 finish this section — R20, added 2026-08-10.** *Where* the desk is was
> left open here and is now canon: the **corner** of the floor, apart from the rows and
> **facing back down them**, which is what keeps it clickable once §7.8.1b's reading order
> fills the room over it. And the "Founder tree" this section asks for is now the
> **Management class** — a deliberately weaker copy of all four of §13.7's role trees, which
> is this section's joke stated as a skill tree rather than as a curve.

**Clicking your own desk generates story points on its own growth curve**, upgraded through a
**Founder tree** that is separate from everything else in the game:

- **It does not scale with headcount.** Every other source in the game is multiplied by the
  swarm and divided by 4.1's Entropy. Yours is not. It grows only because *you* got better.
- **Which is the 6 thesis, inverted, and it is the best joke in the design.** You are the only
  developer in the company whose output did not collapse when you hired everybody. The founder
  who codes is worth more than the hundredth hire, and the game never says so out loud - the
  two curves say it.
- **It is the floor under the clicker.** 4.6 worried that tapping becomes irrelevant at cosmic
  scale. A curve that never dilutes is the answer: late game, your own hands are a small but
  *reliable* contribution in a studio where nothing else is reliable.
- **It is clickable from anywhere.** You do not have to fly the camera home to use it. The desk
  is where it *lives*, and 7.7.4 guarantees you can always return to look at it, but the action
  is available at every zoom - because it is you, and you are always present.

**The tree itself** is a small personal ladder - the skills a founder actually loses while
managing. Names are flavour and the shape is the spec: *learn a thing, get slower at managing,
get faster at coding*. Exactly where it trades against the rest of the game is the interesting
part, and is deliberately left open until 4.5a is built and can be felt.

**What it must never be:** an idle generator that plays itself, or a strictly-better
alternative to hiring. If the optimal play is to fire everyone and code alone, the satire has
eaten the game.

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

> **The four rows are a curve now, not a table — R15, added 2026-08-10.** §4.5b makes the
> reach *the unit that was hit*, and §7.7.1 names a unit at every rung, so `Z` has to answer
> for a unit of 37,000 people and not only for four sizes. `sizeYield` interpolates **this
> table** in log-log space and passes through all four rows exactly, so there is one copy of
> these numbers and nothing to drift from.
>
> **Where that changes an answer, this table was the one that was wrong.** L2's "1 row
> (~8–20 devs)" was written when a floor zoom meant the camera could not resolve
> individuals. §7.4a then made rungs 0, 1 and 2 *all the room*, and §7.7.6 requires that
> "every one of the 1,000 floor sprites is individually hit-testable ... the actual developer
> under the thumb" — so a tap on **one** developer was being paid for fourteen. A tap in the
> room now reaches one person at any zoom, which is what §7.7.6 always promised. This is
> exactly the shape of the trap `docs/HANDOFF.md` records at number 8: a constant that was
> correct when it was written, underneath a number that later moved.

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

#### 4.8a A tap is worth a fraction out here, and must say so **[added 2026-08-08]** - R11

The `Z` multipliers above make a tap worth **0.08** per developer at global zoom and **0.01**
at cosmic, times the blast radius. That is the design working: the further you are from the
work, the less each status check is worth.

It also means **the honest numeral is fractional** - `+0.80`, `+0.10` - and any formatting
that rounds to an integer prints `+0` on a tap that really did bank points. It did once, and
it produced a bug report about the button being broken. Feedback numerals below 10 carry a
decimal. See 25.1 for the full diagnosis, including the half of it that is not a formatting
problem.

### 4.10a The cost of a developer **[CANON — added 2026-08-07]**

§21.0's Act IIa needs hiring to cost money — "each hire is bought with money the player made,
costs more than the last, and *works*". Hiring was free, which removed all three clauses but
the last, and with it the entire loop.

| | |
|---|---|
| Cost of the next developer | `1 × 1.08^(devs − 1)`, **not rounded** |
| At 1 / 10 / 20 / 39 developers | $1.00 / $2.00 / $4.32 / $18.63 |
| Total to reach ~40 | **$239**, of roughly $320 the loop earns |
| The Mass Hire | **The player's entire treasury.** Minimum $50 |

**Geometric, not linear.** Velocity is linear in headcount, so a linear cost would make each
hire *more* affordable than the last relative to income and Act IIa would have no tension.

**The base is a dollar, and that is the joke rather than a rounding problem.** A developer
costs $1 to hire and **$50 a second to keep**. The hire is cheap; the payroll is what ends the
company — §6's entire lesson stated in two constants.

**Not rounded to whole dollars.** At a $1 base, rounding flattens the first ten hires to
"$1, $1, $1, $2", deleting exactly the stretch where the player is learning that hiring has a
price at all. Cash is already fractional; the HUD rounds for display.

**The Mass Hire is priced at literally everything**, which is more robust than a figure and
funnier than one. It is always ruinous, it leaves exactly zero buffer — which is what §21.0
says makes Act V's bankruptcy arrive in seconds — and it cannot be broken by any later
rebalancing of §4.10. A fixed price would silently become unreachable or trivial every time
revenue moved, and nobody would notice until the trap stopped springing.

> **It is not, however, *always affordable*, and this section said it was.** Payroll runs
> continuously and can empty the treasury faster than shipping refills it, so a studio can
> sit in Act III below the $50 floor for minutes at a time. When the offer cannot be paid
> for it stays on screen, **priced and disabled** — hiding it would delete the beat the whole
> act is built on, and leaving it live meant a control reading "Cost: YOUR ENTIRE TREASURY"
> completing successfully against an empty one and pushing the player to −$50.
>
> Two rules follow, and both are general rather than about this button:
>
> 1. **Every action that costs money declares how it is priced.** The action bar derived
>    `disabled` from whether a *figure was drawn*, which the mousetrap does not draw — so it
>    was never disabled at any cash level. Pricing and display are now separate fields.
> 2. **A control that cannot be pressed must not look pressable.** There was no disabled
>    style at all: `disabled` was set on the element and styled nowhere, so a dead button
>    kept full contrast, its raised slab and `cursor: pointer`. From the player's side that
>    is the same defect as not disabling it — they tap, nothing happens, and the game looks
>    broken rather than the price looking unmet.

**These are first-pass numbers and want a playtest**, unlike the wage and the bankruptcy
threshold, which are derived. See the pacing note in §21.0.

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

#### 4.10d Cash is lumpy, and the interface reads it as failure **[observed 2026-08-08]**

§4.10c closed the loop and left a presentation problem behind it that is worth recording
before anyone tunes it by feel.

Payroll is continuous and revenue arrives **on ship**. At forty developers that is $1,900/sec
out against $550,000 in every hundred seconds, which is comfortably profitable *on average*
and looks like this on the way:

```
  +$550K ┤        ┌╴ship                    ┌╴ship
         │        │                         │
       0 ┼────────┼───────────╴────────────┼──────
         │         ╲                        ╲
  −$190K ┤          ╲___________╱            ╲____
```

So the studio spends most of each project **overdrawn**, and the HUD says so in alarm red
with every button dead. A player watching `CASH −$11.8K` and a greyed HIRE has no way to know
they are eighty seconds from a half-million-dollar payout; the readout is telling them they
are losing, and it is not wrong, and it is not what is happening.

Two knock-on effects, both real:

- **Act III's offer is only takeable in a window.** §21.0a wants the Mass Hire "affordable,
  and only just" — instead it is affordable for the first stretch after each ship and dead
  for the rest, which makes the temptation intermittent rather than constant.
- **It teaches the wrong lesson at the wrong time.** §6 wants bankruptcy to arrive *after*
  the trap. Going deeply negative every project during the honest loop spends that feeling
  early.

##### The fix — a predicate, not a feel **[CANON — 2026-08-08]**

Of the three candidates, two change the economy and one changes what the interface *claims*.
The arithmetic is sound, so the interface was the thing that was wrong:

> **The readout coloured on `cash < 0`. The predicate the player cares about is
> *can I reach the next payout*.**

That is computable rather than felt. Project the burn forward over the time the current
project still needs and ask whether it crosses the bankruptcy threshold before the money
lands (`isCashCritical`). A studio eleven thousand in the red and eighty seconds from a
half-million-dollar ship is in perfect health, and now reads that way.

Paired with the missing half of the number: **`+$550K IN 82s`**, under the burn, in green —
the only other green in the interface besides the ship celebration, so green means *incoming*
and nothing else.

Two cases the predicate has to keep separate, and does:

- **The garage.** No burn, so no runway to run out of; the only failure left is the
  bankruptcy floor itself.
- **A seized studio (§21 Act V).** Production has stopped, so no payout is coming,
  `secondsToPayout` is infinite, and a negative balance really is a slow death. **It gets no
  reassurance, because none would be true** — inventing one for that beat would undo it.

Revenue deliberately still arrives *on ship*. Accruing it continuously would smooth the curve
and delete §10.8a's ship celebration, which is the loop's payoff and the one moment per
project the player is told they won.

#### 4.10e Revenue is a long tail, not a lump **[CANON - added 2026-08-08]** - R2

**Section 4.10c's payout-on-ship is replaced.** The ladder of what a project is *worth*
survives untouched; what changes is **when the money arrives**.

The problem is 4.10d's, observed and then play-tested: payroll runs continuously and revenue
lands in a single lump, so the studio crosses zero on every project cycle. It is arithmetically
solvent and it *reads* as permanently failing, which is the wrong feeling for a studio that is
in fact growing. 4.10d recorded this as an open question. This is the answer.

**A shipped game earns for as long as it is on sale**, on a decaying tail:

- The total over the tail is the 4.10c ladder payout. **No project becomes worth more or less
  than it already was** - this changes cash *flow*, not cash.
- The tail is **front-loaded and long**: a launch spike, then a decay, then a floor that never
  quite reaches zero. A back catalogue is a real thing and a studio with five shipped games
  should feel it.
- It is **randomised** per project, so two runs of the same ladder do not produce identical
  graphs. Randomised in the *shape*, never in the *total* - a player who ships the same game
  must not be able to be unlucky with it. That line is what keeps this from being gambling.
- **Old projects keep paying while the new one is in development.** That is the whole point:
  the books stay afloat between ships, and the burn is covered by the catalogue rather than by
  the player's nerve.

**And it must be drawn.** A revenue stream nobody can see is indistinguishable from the lump
it replaced, so this ships with a **revenue graph** in the HUD: income over time, one band per
still-earning project, against the payroll line. That component is what turns "I am always
losing money" into "this one is tailing off and the next one has to land". 10.4's burn-down
is the model - a shape that carries a story, not a number in a box.

**What it must never become:** a second idle currency to babysit, or a reason to keep shipping
the same game. The tail is passive, automatic, and invisible in the decision layer.

#### 4.10b **BLOCKING — the Act IIa economy does not close** [added 2026-08-08]

§4.10 above is correct for the two scenarios it derives from, and **both of them have zero
paid developers or one thousand**. §21.0 later inserted Act IIa — the honest loop from two
developers to forty — and nobody re-derived the economy for the range in between. It does not
work. Measured against the shipped constants:

| Devs | Velocity | Time to ship 1,000 SP | Wages over that | Revenue |
|---|---|---|---|---|
| 2 | 2 SP/s | 500 s | **$0** | $50 |
| 5 | 5 SP/s | 200 s | **$30,000** | $50 |
| 10 | 10 SP/s | 100 s | **$40,000** | $50 |
| 20 | 20 SP/s | 50 s | **$45,014** | $50 |
| 40 | 39.6 SP/s | 25 s | **$47,986** | $50 |

**A studio of five is already six hundred times underwater, and it gets worse with scale.**
The loop §21.0 calls "load-bearing" — ship, earn, hire, ship faster — cannot be played: every
hire makes the next project *less* affordable, and the only reason a run survives Act IIb at
all is §21.0a's seed round, which then drains in about two minutes.

This is not a tuning pass. It is a missing curve.

##### The constraints any fix must respect

1. **Wage stays at $50/paid dev/sec.** §21 Act V's "$50,000/sec" is stated copy and the
   Act V beat is derived from it.
2. **Two founders stay unpaid.** It is why the opening is survivable and why the Mass Hire
   feels like a decision.
3. ***Flappy Square 1.0* still pays about $50.** §21 Act II states it, and it is the joke —
   the first game you ship earns pocket change.
4. **Payroll stays linear.** §6.1 makes it the *timer*, not the trap; a superlinear wage
   would be doing Communication Entropy's job and the lesson has to come from §4.1.

Constraints 1–3 pin revenue at the bottom of the range and payroll everywhere, which means
**the only free variable is how revenue scales with project size** — and the project ladder
along with it. A studio ships bigger things, and bigger things earn disproportionately more;
that is true of real games and it is the standard idle-genre answer. `REVENUE_PER_SP` is
currently a flat $0.05/SP, which is the assumption that a forty-person studio's output is
worth exactly forty times a solo developer's. It is not, and §5's era table already says so:
Phase 1 ships *Flappy Square*, Phase 2 ships **MMORPGs and game engines**.

#### 4.10c The fix — revenue is a fact about your studio, not about a Story Point **[CANON — added 2026-08-08]**

##### The one relation that decides everything

At headcount $n$ with revenue $r$ per Story Point and wage $W$ per paid developer per second,
velocity is $n$ points per second and payroll is $W(n-2)$ dollars per second, so:

$$	ext{profit/sec} = n\,r - W(n-2) \qquad\Rightarrow\qquad rac{d(	ext{profit})}{dn} = r - W$$

**Hiring pays if and only if revenue per Story Point exceeds the wage per developer per
second.** Everything else is detail. $r$ was $0.05$ against a $W$ of $50$, which is why every
hire made the studio poorer and why the loop could not be played.

The corollary is just as useful: the *cost* of a Story Point is $W(n-2)/n$, which is
**constant in headcount** and climbs toward $W$ as the two unpaid founders are diluted away.
More developers finish sooner and cost proportionally more; linear payroll over linear
velocity cancels.

##### And the corollary that turns out to be §6

Velocity is not actually linear — §4.1 taxes it — so the true cost of a point is
$W(n-2)/(n\,\eta)$, and $\eta$ collapses long before the numerator stops growing. At a
hundred developers against a cap of a hundred, a Story Point costs **double** the wage.

**This is the game's thesis denominated in dollars**, and it is worth stating because it
means §6.1's insistence that payroll stay linear is not a limitation. The trap does not need
payroll to be superlinear. It only needs payroll to be linear while output is not.

##### The ladder

Revenue is authored per project rather than derived from the commitment, because **a Story
Point is not worth a fixed amount of money — a forty-person studio's output is worth
disproportionately more than a solo developer's.** §5's era table already says so: Phase 1
ships *Flappy Square*, Phase 2 ships MMORPGs.

| # | Project | SP | Payout | $r$ | vs $W$ |
|---|---|---|---|---|---|
| 1 | Flappy Square 1.0 | 1,000 | **$50** | $0.05 | **far below** |
| 2 | Flappy Square 2.0 (Now With Ads) | 400 | $25,000 | $62.50 | above |
| 3 | Untitled Roguelike Deckbuilder | 1,000 | $120,000 | $120 | above |
| 4 | Open-World Survival Craft (Early Access) | 4,000 | $550,000 | $137.50 | above |

**Project 1 is deliberately below the line, and it is the best detail in the table.** Your
first game turns a profit only because you and James are not paid; it would have lost money
the instant you hired anybody. §21 Act II's "+$50" survives intact and gains a second meaning.

##### Two consequences that had to follow

- **Act IIa opens after the *second* project, not the first.** Payroll starts with the third
  developer and *Flappy Square 1.0* pays fifty dollars, so opening the hire prompt on one
  shipped project handed the player a HIRE button, a $50 treasury and a $50/sec burn — one
  second of runway and a slow slide to a bankruptcy they could neither see coming nor avoid.
  Project 2 ships at two unpaid founders, so all $25,000 of it is profit, and *that* is the
  money Act IIa is played with. It sharpens the joke rather than blunting it: your first game
  earns fifty dollars, your second earns twenty-five thousand, and only then can you afford
  people.
- **James cannot be hired until project 1 ships.** He costs a dollar and the player starts
  with none, so Act II's beat is gated on Act I's payout without anything having to say so.
  Found by simulating the run, not by reading it.

##### How it is kept honest

`runOne.test.ts` **plays the run** — pokes, ships, hires, ships faster — rather than asserting
about its parts. The economy is the one system whose failure is invisible to unit tests:
`payrollPerSecond`, `projectRevenue` and `hireCost` all passed their own tests for two turns
while a 1,000 SP project cost forty thousand dollars in wages and paid fifty.

##### Why it is written down rather than guessed at

Revenue scaling and the §4.10's project ladder have to be designed *together* — a curve
chosen without the ladder produces a run that is either trivial or impossible, and the
ladder was already retuned once (§21.0) to fit a run length. Picking an exponent in
isolation would be the third retune and the second one to miss this.

**Nothing downstream of this is trustworthy until it is fixed**: Act IIa's length, Act IIb's
length, the seed round's size, and the Mass Hire's price are all quoted in a currency the
player cannot currently earn.

---

### 4.9a Every developer's output is their own, and the spread is WIDE **[CANON - added 2026-08-08]** - R17

Section 7.8.7 gives every developer a face. **This gives them an output**, rolled the same way
- from the seat index and the run seed, never stored - and the instruction is to
**exaggerate it**.

- Some people are worth ten of the person next to them. Some are worth a tenth. That is true
  of real teams, it is the observation the whole game is built on, and a studio where everyone
  produces the mean is a spreadsheet.
- **The spread is wide on purpose and gets wider as it earns it.** 14.4's hero classes are the
  tail of this distribution rather than a separate system bolted on: a 10x Engineer is not a
  special unit type, it is *the top of the roll*, and the same is true downward.

**The mean is pinned, and this is the constraint that keeps it honest.** Widening the spread
must not change the total - section 4's economy is calibrated on the sum, and a distribution
that drifts its own mean silently rebalances the whole game. **Exaggerate the variance; hold
the average.** Anything else is a balance change wearing a flavour costume.

**And it must be VISIBLE, or it is only noise.** A hidden roll is indistinguishable from a
random number generator nobody can see:

- 8.2b's per-head numerals are the display for it. One developer emitting `+5` beside one
  emitting `+0.2` is the entire idea, on screen, with no readout.
- It gives 4.5a's poke a target worth choosing, and 4.5c a modifier worth reading.
- It gives 7.8.7's identities a *reason*. Until now they were decoration; now the person who
  looks distinct is also the person who performs distinctly, and the player will start
  recognising individuals - which is section 2's premise arriving through mechanics.

### 4.11 Roles — the studio stops being one kind of person **[CANON - added 2026-08-10]** - R19

**Every developer in the game does the same job, and that is a hole in the middle of the
premise.** §4.9a made them differ in *how much* they produce; §7.8.7 made them differ in *what
they look like*. Neither made them differ in **what they are for** — so a studio of a hundred
thousand is one number wearing a hundred thousand faces, and "managing" it means picking who
to tap.

There are four functions, and they exist because §4.12 and §4.13 give the studio two ways to
fail that writing more code cannot fix:

| Role | Produces | Consumes | The joke |
|---|---|---|---|
| **Developer** | Story Points (§4.1) | — | Ships the feature and the defect in the same commit |
| **QA** | defect capacity (§4.12) | — | Finds the bug before the player does, and is resented for it |
| **Support** | ticket capacity (§4.13) | — | Absorbs the consequences of decisions they were not in the room for |
| **SRE** | incident capacity (§4.12) | — | Paid to be bored, blamed when they are not |

**A role is chosen at hire, not reassigned.** §10.10's dial gains a role selector and that is
the whole interface: you are buying a *kind* of person. Reassignment is deliberately absent —
it would turn every failure into a slider adjustment, and the game's thesis (§6) is that you
cannot fix an organisation by moving people around after the fact.

#### 4.11.1 What a role changes on screen

Each role gets **its own speech and its own behaviour**, because a role the player cannot see
is a spreadsheet column:

- **§19's desk-query lines are per role.** A developer says *"writing redundant CSS"*; QA says
  *"this reproduces on my machine, which is the problem"*; Support says *"I have told them
  three times"*; SRE says *"it is fine, it is fine, it is fine."*
- **§7.8.6's ambient life is per role.** Developers stare at monitors. QA walk between desks.
  Support wear headsets and never leave theirs. SRE are motionless until §4.12's incident,
  and then they are the only thing moving on the floor.
- **§7.8.7's silhouette carries it.** The role must be readable from the shape at rung 2
  *without* a badge, on the same argument §7.8.7 makes about identity: a label floating over a
  sprite is an admission that the sprite failed.

#### 4.11.2 Roles sit together — the row is the unit of assignment

**A role is assigned to rows, not scattered.** §7.8.1b's reading order already fills the floor
row by row and §4.5b already makes a row-sized unit pokeable; this makes the row *mean*
something. A floor reads as bands — four rows of developers, a row of QA, half a row of
support — and the shape of the studio is legible from the shape of the floor.

That is also what makes §13.8's placement a game rather than a menu: a hero covers an area
(§13.6.2), an area is some rows, and rows are roles. **Where you put somebody decides what
they are covering.**

> **The number of each role you should have is deliberately not written here.** It is the
> single most play-test-dependent quantity in this batch, and §25.2's rule applies: a ratio
> invented at design time and written as canon is a balance decision nobody measured.

#### 4.11.3 The roster is a hire history, not four counters **[CANON - added 2026-08-10]**

The obvious storage for §4.11 is `{ dev: 900, qa: 60, support: 25, sre: 15 }`. It is wrong,
and the way it is wrong is invisible until you look at the floor.

§4.11.2 wants roles to sit in **bands**, so a *seat* has to know its role. With four counters
the only way to derive that is to order the roles and lay them out — and then **hiring one
developer relabels every QA above them**. §7.8.7 generates a face from the seat index, so the
player would watch a specific person change jobs because somebody else was hired. That is
§7.8.1b's "a seat once taken never moves" broken on a second axis, and it is the same class of
mistake the reading-order rule was introduced to kill.

So the roster is the **hire history, run-length encoded**: an ordered list of runs, each a role
and a count. A seat's role is a scan, seats never change role, and the storage is a handful of
objects however large the studio gets — §10.10's dial hires 1, 10, 100 or MAX at a time, so a
run *is* a batch.

**It also makes the floor honest in a way a tidy four-band layout would not be.** A player who
hired in blocks gets §4.11.2's bands; a player who alternated gets stripes — and the stripes
are true. The shape of the floor is the shape of your hiring history, which is a better joke
than a floor that tidies itself.

> The two per-role effects that exist are anchored the same way §4.14.1 anchors the rating:
> QA are described by **the QA share at which the defect rate halves** rather than by a
> coefficient in an exponent, because picking that coefficient *is* deciding the role ratio
> §25.3.2 refuses to decide. Support capacity is plain linear headcount — §4.13's deliberate
> exception, and the one place §6's dilution does not apply.

### 4.12 Defects — a shipped game keeps costing you **[CANON - added 2026-08-10]** - R21

**Shipping is currently the end of a project's story**, and it is the wrong end. §4.10e made
revenue a long tail; this makes *quality* one. A game goes out, and then it starts breaking.

**Defects accrue from the work itself.** They are not an event and not bad luck — they are a
by-product of production, in proportion to it:

$$\frac{dB}{dt} = \beta \cdot V \cdot \eta_{\text{def}}(\text{QA})$$

where `V` is §4.1's velocity. **The faster you go, the more you break**, which is the §6
thesis restated in a second currency and is the reason this system belongs in the game at
all. Poking makes it worse: §4.5's interruption is exactly how defects get written, so a poke
adds defects on the same coefficient §4.9 uses for Entropy.

| | Effect |
|---|---|
| **On the release** | Defects suppress §4.10e's tail. A buggy game earns its spike and then dies, which is a curve players recognise |
| **On the rating** | §4.14's score is dominated by them |
| **On the studio** | Past a threshold a defect becomes an **incident** — the tail stops entirely until SRE clear it |

**QA reduce the rate; SRE clear the backlog.** The distinction is the point and it is a real
one: QA change how fast defects arrive, SRE change how fast they leave. A studio with no QA
and heroic SRE is permanently on fire and shipping; a studio with heavy QA and no SRE is slow
and never breaks. Both are viable, both are funny, and neither is optimal — which is the
condition §4.5b insists on for every choice in this game.

> **Nothing here may become a fail state that stops the clicker.** §6.3's Entropy Lock is
> already the game's one seizure and it is load-bearing; a second one competing with it would
> read as the game being broken rather than as the game making a point.

### 4.12a Incidents — what a shipped game does at 3 a.m. **[CANON - added 2026-08-11]** - R29

§4.12 makes an incident **a defect that crossed a threshold**, and that is the wrong shape. A
threshold is a state change inside the project on the bench, which confines incidents to the
thing you are currently building — while the one thing §4.13 is most certain about is that
**the back catalogue is what sends the bill.** An incident that can only happen to unreleased
software is an incident that has never happened.

So the two backlogs are separated by **where they live**, not by how large they grew:

| | Arrives from | Lives on | Acted on by |
|---|---|---|---|
| **Defect** | The work itself — §4.12's $dB/dt$ | **The project on the bench.** It ships with the game and §4.14 scores it | **QA** — they slow the arrival |
| **Incident** | The **released** catalogue, forever | Every game you have ever shipped | **SRE** — they slow the arrival *and* clear the backlog |

$$\frac{dI}{dt} = \iota \cdot \sum_{r \in \text{releases}} d_r \cdot a_r \cdot \eta_{\text{inc}}(\text{SRE})$$

where $d_r$ is **the defect density the release shipped with** and $a_r$ is §4.10e's decaying
audience. That line is the whole design and it is worth reading twice: **the bugs you chose
not to fix become a permanent operational cost, weighted by how many people are still
playing.** A game nobody plays cannot page you. A hit you rushed will page you forever.

Three consequences, and each one repairs something that was previously loose:

- **§4.14's rating finally has teeth after the fact.** A release was scored once, at ship, and
  then the number was history. Now the score you shipped is the rate you pay, every second,
  for as long as anyone is playing — so a 30/100 is not an insult, it is a *liability on the
  balance sheet*, and it stays there while you build the next one.
- **Defects become decisions with a horizon.** Holding a game back to let QA burn the backlog
  down costs velocity now and buys quiet forever, and neither side of that is obviously
  right — which is §4.5b's standing requirement for anything the player chooses.
- **SRE stop being QA with a different label.** QA act on a project, once. SRE act on the
  catalogue, continuously. They are not the same job and they no longer have the same shape.

**An unhandled incident suppresses that release's tail outright** — §4.12's "the tail stops
entirely until SRE clear it", kept exactly, and now attached to a specific game rather than to
the studio. The player watches one line on §10.11's gallery go flat while the others keep
earning, which is the clearest possible statement of what an incident *is*.

> **Still no second seizure.** §4.12's warning stands unchanged and applies here with more
> force, because incidents accumulate on a catalogue that only grows. A studio drowning in
> incidents loses its *tail revenue* and never its ability to click, ship or hire. §6.3's
> Entropy Lock remains the game's one seizure.

#### 4.12a.1 Prevention and response are two different heroes **[CANON - added 2026-08-11]** - R29

Headcount and heroes act on this system from opposite ends, and the split is deliberate:

| | Bends | Who |
|---|---|---|
| **SRE headcount** | Both terms — fewer incidents, and faster clearance | §4.11's role, unchanged |
| **The Reliability hero** | **$\eta_{\text{inc}}$ — the arrival rate.** Hardening, runbooks, error budgets: the incident that never happened | §22.8's Serena |
| **The Support hero** | **Clearance.** The person actually talking to the players while it burns | §22.8's Matt |

This is the §4.12 sentence — "QA change how fast defects arrive, SRE change how fast they
leave" — kept for *roles* and deliberately crossed for *heroes*. A studio that has hired for
one and not the other is visibly, differently broken in each direction, and that is the only
reason to model two ends of the same pipe.

### 4.13 Support — the tickets do not stop **[CANON - added 2026-08-10]** - R22

**Every shipped game generates support tickets forever.** Where §4.12's defects are about the
product, tickets are about the *people who bought it*, and they behave completely differently:
defects can be driven to zero, tickets cannot.

$$\frac{dT}{dt} = \tau \cdot (\text{lifetime players}) + \sigma \cdot B$$

Two terms, and the second is the interesting one. **Tickets scale with your back catalogue,
not with what you are currently building** — §4.10e's catalogue is already the thing that pays
the bills, and this makes it the thing that also sends the bill. The bigger your body of work,
the larger the standing army you need for games you finished years ago, and **no upgrade ever
removes that floor.**

- **Unanswered tickets suppress revenue**, and they do it on the catalogue rather than on the
  current project — you are losing money on the games you already made.
- **Support capacity is headcount**, straightforwardly. This is the one part of the game where
  throwing people at a problem simply works, which is a deliberate exception: it is the only
  place §6's dilution does not apply, and the exception is what makes the rule visible.
- **Tickets are the studio's ambient noise.** §20's mix gains a low, continuous, quiet layer
  that never fully stops. It is the sound of the back catalogue.

### 4.14 The Rating — the only number that judges a run **[CANON - added 2026-08-10]** - R23

**Every score in this game measures size.** Cash, headcount, Story Points, the whole
Construction Ladder — all of them go up and none of them is ever *bad*. The rating is the
first quantity in the design that can go **down while everything else goes up**, which is what
makes it the one number that can say the studio is doing badly.

A shipped game is rated out of 100 from three inputs, and they are the three things the
player actually controls:

| Input | Weight | Source | What it is really measuring |
|---|---|---|---|
| **Defects** | dominant | §4.12's backlog at ship, per Story Point | Did you ship it, or did you *finish* it |
| **Hero ability** | strong | §13.6 coverage over the team that built it | Did the right people touch it |
| **Craft** | moderate | §4.9a's realised output share of the developers on it | Was it built by the people or by the headcount |

**Defects dominate deliberately.** The other two are things the player arranges in advance;
defects are the thing they are choosing to ignore *right now* in exchange for going faster.

Ratings feed everything downstream, and this is where they stop being decoration:

- **Revenue.** §4.10e's payout scales with the rating, which finally makes quality worth
  money and gives §4.12 and §4.13 a reason to be more than a tax.
- **Reputation**, a slow-moving average of recent ratings, which scales §4.10c's revenue *per
  Story Point* — the studio's rate is a fact about its reputation, which is what §4.10c
  already says and never had a mechanism for.
- **§14's prestige.** Banked Paradigm Points scale with reputation, so a run can be good
  rather than merely long. **This is the first thing in the game that rewards playing well
  instead of playing more**, and it is the reason the whole batch is worth building.

> **The satire has to survive the scoring.** A studio that ships a 12/100 and makes a fortune
> is the funniest outcome available and must remain *possible* — reputation decays slowly
> enough to be outrun by volume for a while. The rating is a pressure, not a morality.

#### 4.14.1 The neutral point is derived, not chosen **[CANON - added 2026-08-10]**

§25.3.2 refuses to fix the three weights, and building the thing turned up a **fourth**
quantity that section did not anticipate and that matters more than any of them: **what score
counts as ×1.**

The rating multiplies revenue. §4.10's economy is calibrated against §21's two stated
figures — *Flappy Square* pays exactly **+$50** — so a neutral point picked at 50/100 would
have quietly rebalanced every number in the game. A Run 1 studio has no heroes at all, so it
cannot reach 50 under any weighting, and every release in the opening act would have been
taxed for the absence of a system that does not exist yet. It would also have made hero
coverage a **gate** on the rating rather than amplitude, which §13.6.7 forbids in the one
sentence it spends on the subject.

So the neutral point is not a number. It is **what a garage ships** — no QA, no heroes, an
average team — computed from the weights themselves:

```
  BASELINE_RATING  =  100 · ( w_defects · ½  +  w_heroes · 0  +  w_craft · ½ )
```

The two halves are exact rather than approximate. The defect term sits at ½ because a studio
with no QA ships at exactly the anchor density (below); the craft term sits at ½ because
§4.9a pins the roster mean at 1.0 twice over. **A player who ignores this entire batch
therefore earns exactly what they earned before it existed, at every multiplier**, and the
arithmetic says so rather than a comment claiming it. Everything above the garage is a bonus
and everything below it is a penalty — which is also the only framing under which §4.14's
"ships a 12/100 and makes a fortune" stays funny rather than punitive.

**And β is anchored to the rating rather than the rating to β.** §25.3.1's build order exists
to stop the defect coefficient becoming canon by accident, and the way to honour it is
stronger than an ordering: the defect term is scored against `DEFECT_DENSITY_ANCHOR`, and
§4.12's β *is* that constant. A studio with no QA therefore always scores exactly half on
defects **whatever β is**, so retuning how fast bugs arrive changes how quickly a studio
reaches §4.12's incident threshold and changes nothing about what a shipped game is worth.
The one number §25.3.2 calls out as genuinely load-bearing is prevented from being
load-bearing in two places at once.

What the rating then measures is **how well you manage defects relative to doing nothing about
them**, which is the question the player is actually being asked.

> **Craft goes quiet as the studio grows, and that is the design.** The mean of `n` §4.9a
> shares converges on 1, so craft swings wildly in a garage and is almost constant at a
> million people. §4.14 asks whether a game was "built by the people or by the headcount"; at
> a million developers the honest answer is always the headcount, and the term says so by
> falling silent rather than by being switched off.

### 4.15 Three backlogs, three colours, three components **[CANON - added 2026-08-11]** - R30

> **Amended 2026-08-15 — §21.7.6b: the set assembles one colour at a time.** Every word below
> holds, including §25.7.2a's decision to keep all three in one column so they read as a set.
> What changes is that they no longer *arrive* as a set: each bar appears when its hero does —
> defects with Mo, incidents with Serena, tickets with Matt — across the run §13.12.2 gives them.
> **A bar with no hero is not drawn**, empty or otherwise, on this section's own rule that a
> silent row is the loudest kind of furniture.

Defects, incidents and tickets are three different numbers that all go up, all mean "something
is wrong", and all get worse when you go faster. **A player who cannot tell them apart at a
glance has three copies of one anxiety instead of three problems with three answers** — and
the answers are completely different: hire QA, hire SRE, hire Support.

§10.2a already establishes the rule this extends — *"colour the words that matter"* — and it
was written for the things a studio **produces**. These are the things a studio
**accumulates**, and they need the same treatment on the other side of the ledger.

| | Concept token | Colour role | The component |
|---|---|---|---|
| **Defect** | `defects` | **The warning family**, because a defect is still a thing you can fix before it matters | A **counter with a density readout** beside the burn-down — `48 DEFECTS · 1 per 21 SP`. It sits next to §10.4 because it is a tax on that number |
| **Incident** | `incidents` | **The alarm family, and the only pulsing element in the HUD.** It is the one quantity in the game actively costing money *right now* | A **stack of open incident chips**, one per affected release, each naming its game. Not a total — a total hides which game is on fire, and §10.11's gallery is where the player already keeps that map |
| **Ticket** | `tickets` | **Cool grey-blue. Deliberately drab.** §4.13 calls tickets "the studio's ambient noise" and a colour that shouts contradicts the section | A **queue depth bar** with a served/arriving ratio, legible as "keeping up" or "falling behind" without a number being read |

> **Amended in the build, 2026-08-11.** This table originally said *amber* and
> *red*, and **both were already spoken for**: `cash` owns `WARN[2]` and `entropy`
> owns `ALARM[2]`. Taking either would have broken the one rule §10.2a exists to
> enforce — *one noun, one colour, everywhere it appears*. So each backlog takes
> the **bright end of the ramp its section names**: defects `WARN[3]`, incidents
> `ALARM[3]`, tickets `GLOW[1]`. The family still reads (a defect is a warning, an
> incident is an alarm) and no colour was added to the system.

**The three rules that make this a system rather than three widgets:**

1. **Each one names its cure, in the cure's colour.** Tapping the defect counter says `QA
   REDUCE THIS`, in the QA role's own colour from §4.11. The HUD never explains a mechanic in
   a paragraph; it points at the person who fixes it.
2. **They never merge into a "problems" total.** A single health bar is the most natural thing
   to build here and it would delete the entire point of §4.11's four roles.
3. **Incidents are the only one allowed to animate.** §10.6's anti-pattern list forbids
   ambient motion in the HUD, and this is its single exception — bought with the argument that
   an incident is the only element on screen describing money leaving *at this moment*.

> **The colours are load-bearing, so they are palette entries and never literals.**
> ART_DIRECTION §2 owns them, `art:check` polices them, and the same three tokens are what
> §10.11's gallery tints a cover with and what §13.11 tints a coverage footprint with. One
> name, one colour, everywhere it appears.

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

### 7.4a The lens must visit every rung it built **[CANON - added 2026-08-08]** - R8

**The four zoom levels above are not the Construction Ladder**, and letting them stand in for
it is a bug the player meets immediately: pull back from a floor and the camera arrives at a
*galaxy*, having skipped the building, the campus, the town and the nation that 7.7.1 spends
ten rungs establishing. The studio the player built is not on screen at any point during that
move.

**Zooming out must climb the ladder, one rung at a time.** A floor becomes a building becomes
a campus becomes a city becomes a nation becomes a planet becomes a galaxy - each one a place
the camera can stop, look at, and be poked in. 7.4's four levels are a *rendering* concept
(which tier's geometry is resident) and must stop being the *navigation* concept.

Two consequences, both non-negotiable:

- **A rung the player has not earned is not reachable** - 7.7.1's existing zoom ceiling
  already says this and it stays. The complaint is not that the lens stops early; it is that
  it *skips*.
- **A rung that exists in the simulation must exist in the lens.** Rungs 4-6 are built
  (`render/city.ts`) and the camera never shows them, which is the same failure as not having
  built them, and more expensive.

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

### 7.6a The post-process is too heavy **[CANON - added 2026-08-08]** - R3

**The lens is doing too much.** Bloom, blur and the CRT pass together have crossed from
*evoking* a look into *being* a filter, and the cost lands on the one thing the game cannot
afford to lose: at high headcount the 6.3 speech bubbles - which are dialogue, which is the
product - are no longer readable.

**The rule: the vibe, not the effect.** The passes exist to make the picture feel like a
CRT-lit room at night. They do not exist to reproduce a CRT. Where the two disagree,
legibility wins, every time.

- **Text is never blurred.** Bubbles, numerals and HUD copy sit above the post chain, or the
  chain does not touch them.
- **Bloom is a suggestion, not a glow.** It marks the monitor as the light source; it does not
  wash the room.
- **Readability is tested at the headcount that breaks it**, not at one developer. The failure
  only appears when the floor is full, which is exactly when nobody is looking for it.

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
| **Tap a developer** | Whatever §7.7.6b's latched mode says: poke them (§4.5, §8.2), pick them up (§7.8.9), or open their card (§7.8.8) — on *any* of them, not a designated one |
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

**Panning must not fight poking.** A tap is a pointer-down and -up within ~10 px; anything
further is a drag and yields no poke. Getting this wrong in either direction is fatal: a poke
that pans loses the clicker layer, and a pan that pokes means every attempt to look around
costs the player Entropy (§4.9).

> This used to read "within ~10 px **and ~250 ms**". The duration is gone — §7.7.6b — because
> it was the second half of a three-way timing model that a player could not feel. Distance
> stayed, because it is the one threshold nobody has to learn: the world moved or it did not.

**The Hero Anchor (§7.7.4) is a navigation guarantee too.** There is always a "return to my
desk" affordance — pinching all the way in, or a single HUD control — so the player can never
get lost in a galaxy with no way back to James.

##### 7.7.6a Poke or drag - how a thumb tells the difference **[CANON - added 2026-08-08]** - R9

Section 7.7.6 gives a finger three jobs - drag the camera, tap to poke, tap-and-hold to pick a
developer up (7.8.9) - and on a desktop a cursor change can disambiguate them. **A touch
screen has no cursor and no hover**, so the affordance has to be built out of time and motion
instead. This is the missing half of 7.7.6 and it is a shipping blocker for the god-mode
floor, because a player who cannot tell the two apart will trigger the wrong one and conclude
the game is unreliable.

The rule, in the order the gestures resolve:

| Gesture | Resolves as | How the player knows |
|---|---|---|
| **Down, up quickly, barely moved** | **Poke** | The numeral. It is instant, and it is the default - the common action must never be the one that needs learning |
| **Down, moved past the slop threshold before the hold timer** | **Camera drag** | The world moves under the finger, immediately |
| **Down, still, held past the timer** | **Pick up** (7.8.9) | **The developer must announce it** - they lift slightly, the frame around them changes, and a haptic tick fires *at the moment the hold registers*, before the finger has moved |

**The hold-to-grab tick is the whole solution.** It converts an invisible mode change into a
felt one, at the instant it happens and while the finger is still on the glass, so the player
learns the boundary in one accidental attempt rather than in twenty. Section 8.1's haptics are
already specified; this is the one place they are load-bearing rather than juice.

**And a grab must be escapable.** Lift without moving and the developer sits back down, no
harm done. A mode the player cannot back out of is worse than a mode they entered by mistake.

> **7.7.6a's timing model is superseded by 7.7.6b below, and its diagnosis is not.** Everything
> above about a touch screen having no cursor is still true, and the escapability rule still
> stands. What changed is the answer: the affordance is built out of a control the player can
> see rather than out of durations they have to feel.

##### 7.7.6b Poke, grab or check — the mode is on the HUD **[CANON - added 2026-08-10]** - R27

Section 7.7.6a built the distinction out of **time**, and it was reported from a phone in one
sentence: *"hard to control how to poke or grab or look at person."*

**The thresholds were not the problem.** 380 ms is a reasonable hold and 10 px is a reasonable
slop. The problem is that three verbs came off one finger with **nothing on screen saying
which one was armed**, so the only way to find out what mode you were in was to watch the
wrong thing happen — and 7.7.6a's own haptic tick, which was supposed to teach the boundary,
can only fire *after* the press has already committed. An affordance that announces a mode you
did not choose is a better error message, not a control.

So the mode is now **said out loud, on the HUD, before the finger lands.**

| Control | Lit | A tap on the room means |
|---|---|---|
| **POKE** | yes | §4.5's poke. The primary verb, and the mode the game opens in |
| **GRAB** | yes | §7.8.9's pick-up, on the **press**, no timer |
| *neither* | — | §7.8.8's card. "Check people" — the neutral mode |

**Two latches, not a three-way picker.** Pressing the lit one puts it out, and both out is the
third mode. A picker with three segments makes the default a *choice*; a pair of latches makes
it the resting state of a control nobody has touched, which is what a default is.

**The rules:**

1. **Nothing inside a mode is a timer.** There is one question left for a finger — did it
   travel past the slop — and the two answers are "the camera" and "the latched verb". A slow
   tap and a quick tap are the same tap. This is the whole of the fix: restoring any duration
   threshold restores the complaint.
2. **The game opens in POKE, and that is the one place "default to checking people" cannot be
   taken literally.** §21 Act I's script is TAP TO CODE. A first tap that opened a personnel
   card would leave a new player looking at a stat block with no evidence the game had
   started. Neutral is where the control *rests*; POKE is where the game *starts*.
3. **GRAB fires on `pointerdown` — and this is not 7.7.6a's bug returning.** That rule existed
   because a press might pick up somebody the player never meant to touch. With GRAB latched
   and lit and the caption reading DRAG PEOPLE, there is nothing left to disambiguate, and
   every millisecond the press waits is lag on the only verb the mode has. The haptic tick
   stays, demoted from an announcement to an acknowledgement.
4. **In GRAB, anybody at rest can be lifted — not only a loiterer.** §7.8.9 restricted the
   grab to people already standing about, for rule 3's reason. That reason is gone; the
   restriction is not, and a god-mode floor where two thirds of the room is nailed down is a
   toy that mostly says no. **Somebody mid-behaviour is still refused** — a conversation, a
   drive-by, a trip to the cooler — because yanking them out of one reads as an interruption
   rather than as a tidy-up, which was always the good half of the rule.
5. **The modes only exist where there are people.** Above the room a unit is a floor, a
   building, a city; there is nobody to pick up and nobody whose card to open, so §4.5b takes
   the tap back and it is a poke whatever the latch says. A mode that silently switched the
   game's primary verb off at the top of the ladder is the exact failure §4.5b was written to
   have fixed.
6. **The mode owns the hand.** Leaving GRAB — by latch, or by zooming out of the room — puts
   down whoever is being carried, via §7.8.9's walk-back rather than a teleport. A developer
   stranded in mid-air by a button press on the other side of the screen is 7.7.6a's failure
   with a new cause.
7. **The mode is never restored from a save.** It is ephemeral (§24.2). An input mode carried
   across a reload is a control the player did not set, looking exactly like a game that has
   stopped responding: you tap a developer, no numeral appears, and nothing explains why until
   you find the switch.

**The caption is part of the control.** Under the latches is one line naming the consequence —
`TAP TO CODE`, `DRAG PEOPLE`, `TAP TO CHECK` — and it matters most in the neutral mode, where
an unlit pair of latches with nothing under them reads as a control that is switched off
rather than one that is in its third state.

> **The one concession to §23.4's shortest frame.** At 336 px the right rail already carries
> the resource blocks, §21.0a's offer, §10.10's dial, the hire button, the §23.3 overlay and
> §10.1's nav; the switch does not fit stacked, and what it pushed off the bottom was the nav.
> So below 400 px the latches sit *beside* the nav and the caption is dropped. The latches
> still name both modes, so what is lost is the word for the neutral one, on the smallest
> phone the game supports. Every taller frame keeps it.

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
| **1** | One desk in a dark home garage, lit only by the monitor. A mug. A chair. A workbench against the wall. | — |
| **2** | A second desk pushed alongside, close enough to touch. The room light comes up one notch. | **James.** The first other person. Garage shelving, a beer fridge |
| **3–5** | Desks in a huddle facing inward. A whiteboard on the wall. The first plant. | Whiteboard, plant |
| **6–10** | A small office: two short rows, a walkway between. A coffee machine in the corner. | Coffee machine, walkway |
| **11–30** | Walls push outward. Cubicle dividers appear between desks. A server rack hums against one wall. | Dividers, server rack, second whiteboard, filing cabinet, printer |
| **31–100** | A full open-plan floor. Desks on the iso grid. Cable runs cross the floor. Ceiling strips overhead. | Cable runs, breakout sofa, unpacked cardboard |
| **101–300** | The floor is busy. Walkways narrow. Meeting pods along one edge, occupied. | Second meeting pod |
| **301–1000** | **Shoulder to shoulder.** Desks touching, no walkways left, dividers gone because there is no room for them. | Nothing. There is no space left to add anything |

**The 301–1000 band is the §21 Act IV image and it is deliberately claustrophobic.** The
props *stop arriving* and then start disappearing — the dividers go, the plant is gone, the
walkway is desks now. **The room gets worse as it gets fuller**, and that is the §6 thesis
told in set dressing before any number says it.

##### The floor has a grain **[added 2026-08-08]**

**Desks are not spaced equally in all directions.** They go shoulder to shoulder along a
row, and the space comes out *behind* the row, where somebody has to be able to walk.

**And rows run level across the screen, not along an isometric axis.** Projecting a square
grid index is what a renderer gives you for free, and it puts every row on a 26.5° diagonal:
people appear to sit *behind and above* each other rather than side by side, which reads as a
queue at eight developers and as a staircase at forty. The objects stay in the 2:1 projection
— desks, monitors and bodies all recede exactly as before — and only the **arrangement** is
screen-aligned. That is legal here precisely because this floor draws no tile grid for a level
row to disagree with.

Each row behind is sheared about half a tile to the left, which keeps the receding-into-the-
room read and staggers the desks so the person behind is not perfectly eclipsed by the person
in front. Zero shear would stack the rows in a flat column and throw the isometry away.

A single uniform pitch — which is what a naive iso grid gives you — reads as a **car park**:
a lattice of identical objects with no front, no grain, and no indication of which way anyone
is meant to move through it. Splitting the pitch is a two-line change and it is the
difference between "some figures on a tiled floor" and "an office".

Two consequences worth stating, because both are easy to get wrong:

- ~~**Rows are twice as wide as the block is deep.**~~ **Superseded by 7.8.1b
  [2026-08-09].** Solving for a square-ish footprint at every headcount means the row *width*
  changes as the studio grows, and a row that widens moves everybody already sitting in it.
  The row is now a constant ten — see 7.8.1b, which records what that costs the table's
  "6–10: two rows" line and why it is worth paying.
- **Dividers fill the gap along a row and never between rows.** The gap between rows is an
  aisle; a panel across it would be a wall.

##### One seat is four things **[added 2026-08-08]**

The repeated unit of this whole tier — drawn up to 120 times, so every decision in it is
multiplied by 120:

| | |
|---|---|
| **A simple desk** | **A 2:1 rectangle, not a square.** The easy way to get this wrong is to read the ratio off the picture: a screen diamond of 2:1 *is* a square on the ground, because the 2:1 projection is exactly the thing that turns a square plan into a 2:1 diamond. A desk is twice as wide as it is deep, so its diamond has to be twice as flat again — **4:1 on screen** |
| **The PC on top of it** | The monitor, **centred on the desk** and turned south-east — the direction the person at it is looking — plus a small tower on the east corner with a two-pixel power light. A desk with only a screen on it is a desk with a screen *floating* over it |
| **A person, waist up** | Standing **directly in front of** the desk and the screen, so developer, monitor and desk are one column. That is what a workstation looks like from behind, and it is a stronger read than any amount of furniture around it |
| **No legs, and no chair** | See below |

**There is no chair, after three attempts at one.** The order they failed in is worth keeping,
because each looked reasonable going in:

1. **In front of the body**, which is where a chair back honestly is when the figure faces
   away — eighty mid-grey slabs in the near field, the first thing the eye lands on, reading
   as an unidentifiable grey bit rather than as furniture.
2. **Behind the body, tall and dark** — a black monolith per seat. At eighty of them the floor
   was a graveyard.
3. **Behind the body, shrunk** — the same width and tone as the torso, so the two merged into
   one column and the chair read as *more person*. Adding a light top rail rescued it enough
   to be legible and never enough to be right.

The conclusion is the useful part: **the honest depth order puts a chair between the camera
and a figure facing away**, so it either covers the person or, drawn behind them, shows only
slivers the eye assigns to the person anyway. A desk, a lit screen and somebody at it is
already the whole picture, and the silhouette is better without it.

**And no legs**, which is the same argument one step further. A seated person's legs are under
a desk, so drawing them is drawing what nothing can see — at forty desks it is forty invisible
pairs of legs costing real geometry. The torso ends at the waist and the desk in front of it
closes the silhouette.

##### 7.8.1a The floor is squads of 100, and it never overflows **[CANON - added 2026-08-08]** - R4, R5, R6

The room as built grows a desk grid that keeps growing, and past about a hundred developers
**the desks walk off the floor they are standing on**. That is not a tuning problem. It is the
absence of a structure, and this is the structure.

**A floor holds 10,000 developers, as 100 squads of 100.**

| | |
|---|---|
| **A squad** | 10 x 10 desks. One hundred people who can see each other. This is the unit the camera can reach and the unit a poke lands in |
| **A floor** | 10 x 10 squads, with **corridors between them**. Ten thousand people |
| **The corridor** | Not decoration. It is what makes a hundred squads read as a hundred *squads* rather than as ten thousand identical dots, and it is where 7.8.6's ambient walkers belong |

**The room starts sized for exactly one squad.** One hundred desks, no more, and the floor
plate is drawn to fit them. Nothing is ever placed outside it - if there is no room, the room
has to grow first (7.8.1c), and growing the room is an *event*, not a silent resize.

*Read as a ceiling rather than a starting size* **[2026-08-09]**: the plate is drawn around the
seats that are **occupied**, and one squad is the most it will ever have to hold before the
unfold. Sizing it for a hundred desks from the first frame would put one developer in a room
built for a hundred, and 7.8.1's first frame is a garage that has to hug the person in it.
The guarantee the requirement actually wants — *nothing is ever placed outside the plate* — is
kept by measuring the plate from the seats rather than by making it large.

**The plate has to contain a *sheared* block, and that is the whole of the bug.** Rows run
level across the screen and each row behind steps left, so the block's four screen corners are
not its four grid corners. An iso diamond with half-extents `(W, W/2)` contains a box of
half-extents `(bw, bh)` only when `bw / W + bh / (W / 2) <= 1` — the width must cover the
block's height **twice over**. Sizing it as `max(width, height)` holds only while the block is
nearly flat, which is why the overflow appeared as the studio got *deeper* rather than wider,
and why it read as a tuning problem for months.

**Zoom is continuous through this.** Pull back from a desk and you see the squad; pull back
again and you see the floor of squads. Push into any squad and its hundred people are
individuals again, each one pokeable. That is 7.7.4's Hero Anchor promise applied to every
squad rather than only to James: **there is no level at which a person stops being a person
you can reach.**

##### 7.8.1b Developers arrive ROW BY ROW **[CANON - added 2026-08-08]** - R4

**At every scale, and with no exceptions.** Hire one and they take the next seat in the
current row. Fill the row and the next row starts. Fill the squad and the next squad starts -
and squads fill row by row too, in the same reading order.

This replaces any arrangement that fills by index hash, by nearest gap, or by anything else
that scatters. The reason is not tidiness:

- **A row filling left to right is legible growth.** The player can see where the last hire
  went and where the next one will go, which makes the primary verb feel like placing
  something rather than incrementing something.
- **A scattered fill is indistinguishable from a redraw.** If bodies appear in arbitrary
  places, a hire looks like the scene refreshed, and 7.7's whole requirement - *adding a
  developer must be seen* - fails silently.
- **It survives every scale.** At ten thousand the unit being placed row by row is a squad
  rather than a person, and the rule reads identically.

7.7.2's cascade already staggers a batch in seat order; this makes the seat order itself the
spec rather than an implementation detail.

**What this costs, decided 2026-08-09.** A row that never re-flows has to be a *constant* ten
wide, which means eight developers sit in one row of eight rather than in the two rows of four
7.8.1's older table asks for. The table's line loses. The reason is that the alternative is
not "two rows at eight people" — it is **a floor that rearranges itself on almost every hire
below fifty**, because a square-footprint solve changes the row width at 7, 11, 13, 19, 25 and
so on. Each of those hires picked up everyone already seated and put them somewhere else,
which is exactly the failure this section names: *a scattered fill is indistinguishable from a
redraw*. Every other band of the table is unaffected, and "2 — a second desk pushed alongside"
still reads exactly as written.

##### 7.8.1c The floor unfolds at 100 **[CANON - added 2026-08-08]** - R7

The hundredth hire fills the first squad, and the room has nowhere to put the hundred and
first. **So the floor unfolds - x100, like a sheet of paper opening out.**

- The single squad stays where it is and stays the size it is. The **floor unfolds around it**,
  panel by panel, until a hundred squad plates are laid out with their corridors between them.
- It is a **3D paper unfold**, not a fade and not a scale: panels hinge outward, catch the
  light as they turn, and settle. The player watches the building make room.
- The camera pulls back with it, because 23.4.1 already fits the tier to the frame and the
  tier just became a hundred times larger. **But not by a hundred** *(decided 2026-08-09)*:
  the fit covers the squads that have people in them plus one squad of headroom, not all
  hundred plates. Framing ten thousand seats puts a hundred developers in about one percent of
  the picture, and 7.7's promise is the other way round — *the studio you see is the studio you
  have*. The far panels still unfold; they hinge off the edge of the frame, which is the honest
  picture of a floor that holds ten thousand, and 7.8.1a already says the way to see the rest
  is to **zoom to it**.
- **It happens once**, at the hundredth developer, and it is scored (7.7.2's promotion
  register). A transition this large that is not scored reads as a glitch. *Once per **run***
  — a Paradigm Shift starts a new studio of one and the floor folds back up with it, or the
  biggest one-shot in the tier is spent for the lifetime of the page. **The scoring is already
  there and must not be doubled**: a hundred developers is a 7.7.1 rung boundary, so the
  promotion stinger, the zoom-ceiling reveal and the dolly all fire on that exact hire. A cue
  added here would be two things scoring one event.

This is the same joke as 7.7.2's arriving floors told one rung lower: the studio expands the
way a cartoon builds a house, and nobody inside reacts.

##### The dressing, and why it empties unevenly

**Wall space survives crowding; floor space does not**, so the two are drawn from separate
budgets rather than one list:

| | |
|---|---|
| **Floor** — plants ×1–4, coffee machine, water cooler, filing cabinet, printer, breakout sofa, bin, cardboard | Placed on the perimeter between the desk grid and the walls, so the dressing follows the room as it grows rather than sitting at fractions of a box that changes size underneath it |
| **Wall** — whiteboards ×2, posters ×1–3 | Never removed. Nobody has to walk around a poster |
| **Bedroom only** — a rug under the first desks | The one prop that leaves *early*, at 6 developers. An office simply never has one |

**The cruellest detail, and the one worth protecting:** crowding removes the things somebody
*chose* — the plants, the sofa — and **adds more of the thing nobody chose**, the unpacked
cardboard. A room that merely emptied would read as a budget cut. A room that fills with
boxes while the plants die reads as a place that stopped being looked after, which is the
§6 thesis about people rather than about money.

##### Two rules that make or break the projection

Both were got wrong first time, and both are invisible in a still until you know
to look:

1. **Anything with volume is drawn as a box, not a rectangle.** A cabinet drawn
   as an upright screen-aligned rectangle, in a room where the floor, desks and
   walls all recede, reads as a sticker on the glass. The eye finds it instantly
   and cannot say why. Flat panels are legal only when they lie *in* a plane —
   a whiteboard on a wall is a parallelogram on screen, not a rectangle.
2. **Every free-standing object gets a contact shadow.** The projection throws
   away the depth cue that says *this is standing on that*, so a solid with
   nothing beneath its base floats however correctly it is positioned. This is
   the fix; repositioning is not. Anything stacked on something else is exempt —
   it has a contact patch, not a floor.

The lighting corollary is worth stating because it is counter-intuitive:
ART_DIRECTION §7's source is top-left, both visible vertical faces of a box
point *downward*, so the **left** face is the lit one and the right is the
shaded one. The two back walls, which face the camera, take the opposite
assignment for the same reason — the back-**right** wall is the lighter of the
two.

**Everything above is T3 commodity** (ART_DIRECTION §4) — desks, chairs, monitors, plants,
server racks, whiteboards, coolers. Buy a pack or generate, then run it through §5's
quantiser. None of it is bespoke, and none of it counts against §22.7's 19 sprites.

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

##### Built, and not built **[added 2026-08-08]**

| Rungs | State |
|---|---|
| **3** — tower | Built. Storeys drop onto the stack, the building squashes and settles |
| **4–6** — building, campus, town | Built. `render/city.ts` |
| **7–9** — nation, planet, galaxy | **Not built.** A different register — a lit coastline, a world, a cluster — rather than more architecture, and §7.4's Level 3 and Level 4 tiers already hold that scale from the camera's side. Building them badly to fill the table would be worse than the honest gap |

Two rules the built half is worth stating, because both were got wrong first:

1. **Every unit is drawn at the same footprint.** The promise of §7.7.1 is that the *unit*
   changes, not that the same unit gets smaller — a town occupies exactly as much screen as a
   building did, and the difference between them is what is inside it. Shrinking is cheaper
   and says the opposite thing: that the studio is receding rather than growing.
2. **A rung change has to change the silhouette.** A business park drawn with towers the
   height of rung 4's reads as *more towers, closer together*, which is the one thing a rung
   change must never look like. Campuses are low-rise on a visible plinth; a town's blocks are
   squat, because a horizon is made of things wider than they are tall.

And a third that cost a screenshot: **the formation has a grain**, exactly as §7.8.1's desks
do. Placing units on a square plan and projecting it puts two of them on the *same screen x*
whenever their plan coordinates differ by (1, 1), which at these heights reads as one building
stacked on another. Units run level across a row, rows step back, each row behind is sheared
half a pitch. The objects stay in the 2:1 projection; only where they stand is screen-aligned.

**All of this is T0 procedural or T3 commodity.** A tower is a repeated storey band; a city
is instanced blocks with varied heights; a planet is geometry and a shader. **No rung above 2
requires a single bespoke sprite**, which is the whole reason the §22.7 art budget can be 19.

#### 7.8.3 What animates, and how — **the budget rule**

**Nothing is a spritesheet.** Every motion below is either a code-driven transform on a
static part, or a shader. This is what makes "minimal animation" and "the swarm is alive"
compatible instead of contradictory.

| Zoom | What moves | How |
|---|---|---|
| **L1 desk** | The developer **hops** at their desk — see below. Steam curls off the mug. The monitor's code scrolls. | **Transforms on parts library pieces** (ART_DIRECTION §4.1). One curve per person per frame, with a per-dev phase offset. No new art |
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

##### The L1 idle is a HOP, not a bob **[added 2026-08-08]**

The room tier's idle was `sin(t)` on Y, and it spent the whole cycle in the air: never still,
never in contact with anything, exactly as long going up as coming down. At one developer
that reads as breathing and at forty it reads as **a field of buoys**.

A hop is the same one-curve budget spent differently, and **the whole of the difference is
the contact**:

| | |
|---|---|
| **Half the cycle airborne** | On a ballistic arc — `1 - (2a-1)²`, not a sine half-cycle. Gravity means the figure hangs near the top and is quickest at take-off and landing |
| **Half the cycle planted** | Doing nothing. This is the half that matters: stillness is what makes the motion read as a push against something, and at any instant about half the floor is at rest, so the eye has somewhere to land |
| **A lean, alternating each hop** | The "about" in *hop about*. A hop that only goes up and down is a pogo stick. Tied to the height, so it is exactly zero on every landing and **nobody drifts off their desk** however long a session runs |
| **Squash on the two contacts** | Deepest on the frame of impact and again in the crouch that launches the next hop. Both discontinuities are deliberate — an impact that eases *in* is not an impact |

**Rate is per §7.8.4 state**, carried over from the old bob's angular rates divided by 2π
rather than retuned: the *relative* speeds are what carry the meaning. Flow is not "fast", it
is faster than Working. Overwhelmed and 10x stay still, and a developer in the player's hand
(§7.8.9) does not hop — whatever they are doing in mid-air, pushing off it is not it.

The squash scales about the container origin, which is at the **waist** rather than under the
seat, so it has to be compensated on Y or the whole floor twitches upward on every landing.

#### 7.8.5 The hire assembly — a desk, a chair, then a person **[CANON]**

**A hire is three beats, not one.** A body fading in at a desk that was always there tells
the player a number changed. Watching the workspace get *built* tells them they bought
something.

| Beat | What lands | Offset |
|---|---|---|
| 1 | **The desk** drops in and settles. Dust ring | 0 ms |
| 2 | **The chair** drops behind it, a smaller impact | +120 ms |
| 3 | **The developer** lands in the chair — the bum-hits-seat beat, with the biggest squash of the three | +240 ms |
| 4 | The monitor wakes: dark, then a flicker, then code | +380 ms |

**Beat 3 is the payload and it must land last.** The desk and chair are setup; the person
arriving is the joke, the reward and the thing the sound is scored to. Reversing the order —
person first, furniture assembling around them — reads as a glitch.

The whole assembly is **~500 ms**, inside §10.8 F6's 400 ms rule for ordinary transitions
plus the deliberate-beat allowance, because a hire *is* a scored beat.

##### Multiple hires cascade — they never land together

**A batch is a wave crossing the room, not a simultaneous appearance.** Ten desks landing on
one frame is a wipe; §7.7.2 already says this about the Act IV drop and it is more important
here, because a batch hire is something the player *chose* and is watching for.

- **Stagger by seat order, not at random.** The wave sweeps across the room in the order the
  desks are laid out, so it reads as a row being placed rather than as scattered popping.
  Act IV's swarm drop deliberately does the opposite — a hashed scatter — because a thousand
  bodies falling in grid order reads as a diagonal wipe. **At batch sizes the eye can count,
  order is legible and looks deliberate; at swarm sizes it looks like a bug.**
- **~70 ms between seats**, compressing as the batch grows so a hundred arrivals do not take
  seven seconds. The whole cascade is capped at about **1.2 s** however large the hire.
- **One sound for the batch**, pitched or layered — not one clip per seat, which is the audio
  pool exhaustion §23.3 names as a standing risk.

**The camera does not move for a hire.** It moves for a *rung promotion* (§7.7.2), and a
camera that reacts to both makes the smaller event feel like the larger one.

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

#### 7.8.6 Ambient life — the floor is a place, not a grid **[CANON — added 2026-08-08]**

§7.8.4 gives each developer an idle state. That is enough to stop the floor looking frozen
and nowhere near enough to make it look **inhabited**, because every one of those states is a
person alone at a desk. A room where nobody ever speaks to anybody is not a quiet office; it
is a diorama.

**The thesis needs this more than the juice does.** §6 is about communication overhead, and
§4.1 charges the player for it in a number — but a number is an assertion. The player should
be able to *watch* the overhead happen: at three developers the floor is calm and someone
occasionally says something; at eighty it is a churn of interruptions, conversations, and
people walking away from their desks. **The entropy curve should be legible with the HUD
switched off.**

##### The four behaviours

| | What it looks like | What it means |
|---|---|---|
| **Chatter** | A speech bubble pops over one developer, holds, pops out | Somebody said something. Cheapest and most frequent |
| **Small talk** | Two neighbours turn to face each other, bubbles alternate between them, then both turn back | A conversation. Costs two developers their idle animation |
| **The water trip** | A developer stands, walks to the cooler or the coffee machine, pauses, walks back | The floor's only pathing. Uses §7.8.1's props as destinations, which is most of why they exist |
| **The drive-by** | A developer walks to *another developer's* desk, stands beside it, both bubble, then walks back | The most expensive interruption in real life and the most expensive here. Reserved for high entropy |
| **Loitering** | Standing at the cooler, sitting on the sofa, or simply standing somewhere doing nothing, for tens of seconds | The long-duration states §7.8.9 needs. A floor with nobody idle on it has nothing to pick up |

##### The rules that keep it from becoming noise

1. **Rate scales with entropy, not with headcount.** More people does not mean more
   chatter per person — §4.1 says it means more *interruption*, which is a different
   thing. At `IN SYNC` the floor is nearly silent and a bubble is an event; at
   `PRODUCTIVITY BREAKDOWN` every third developer is talking and the drive-bys start.
   That is the equation, dramatised.
2. **Nothing ambient ever changes the simulation.** Not one Story Point, in either
   direction. The moment a water trip costs output, the player starts trying to prevent
   water trips, and the game becomes about micro-managing forty walk cycles. This layer is
   *evidence* of the model, never an input to it. **A player who ignores it entirely loses
   nothing.**
3. **It is budgeted, and the budget is a headcount fraction.** At most `clamp(1, 12,
   round(devs × 0.08))` behaviours run at once, whatever the headcount — so the cost is
   flat above ~150 developers and the floor at 100 is not twelve times busier than the
   floor at 10, it is *proportionally* busier. §7.8.3's rule still holds: no spritesheets,
   every one of these is a code-driven transform.
4. **Above rung 2 it becomes a texture.** Individual behaviours are meaningless when a
   person is two pixels. At the floor tier and above, ambient life collapses into what
   §7.8.2 already draws — window flicker rates, the density of lit desks — and the
   per-person system switches off entirely rather than running invisibly.
5. **Poking beats ambience.** A developer who is walking, talking or being talked at is
   still pokeable, and the poke interrupts the behaviour immediately (§8.2's jolt wins).
   A player who taps someone and gets no reaction because that person was busy chatting
   has been told the game is a cutscene.

##### What the bubbles are, in the room **[added 2026-08-08]**

**They are abstract, not typed** — a balloon with two dashes in it, in the same visual
language as the code on the monitors.

§19's lines are *sentences*, and at the size one developer occupies on a floor of eighty a
sentence is a grey smear; forty of them are a fog. The abstract balloon reads instantly as
**speech** at every zoom the room tier reaches, and it costs no text atlas. The legible line
belongs to the §7.5 HUD bubble, which is already how this game says something the player is
meant to actually read.

Typed per-developer bubbles are not ruled out — they become reasonable at the Hero Anchor
zoom (§7.7.4), where three or four people fill the frame. **Legible ambient text is a
zoomed-in feature, and treating it as one is what stops it being a performance problem.**

##### What the bubbles say

Nothing new needs writing: §19's Desk Query Dialogue Library already has state-banded lines,
and §19.2's overwhelmed lines *are* the high-entropy chatter. Small talk and drive-bys draw
from the same bands as the speakers' current §7.8.4 state. **Text does the comedy work**
(Appendix D), and this is the cheapest comedy surface in the product — a joke that costs one
string and no art.

The one addition: **drive-by pairs draw a two-line exchange rather than two independent
lines**, because the joke in an interruption is the reply. `"Quick question —"` / `"It is
never a quick question."`

##### Failure modes

- **A floor where everybody is always talking.** Reads as a party, not an office. The rate
  floor at low entropy exists precisely so the busy state has something to contrast against.
- **Walk cycles that clip through desks.** The water trip is the only pathing in the game
  and it may take the §7.8.1 walkway or nothing — if the walkway is gone to crowding, the
  trips stop with it. **A crowded floor stops being able to reach the cooler**, which is
  both the correct behaviour and a better joke than the walk was.
- **Ambient motion competing with the hire assembly.** §7.8.5's cascade is the game's most
  important feedback. Ambience suspends for its duration; nothing wanders during a hire.


#### 7.8.7 Every developer is somebody — identity without a database **[CANON — added 2026-08-08]**

Right now a developer is a rectangle with a hash-derived bob phase, and every one of them is
the same rectangle. That is fine at ten thousand and wrong at ten, because §7.7.4's Hero
Anchor promises the player can always come back to a floor with **people** on it, and the
promise is empty if they are interchangeable.

**Every individual developer has a name, an appearance and stats. None of them are stored.**

##### Generated, not tracked

Everything about developer *i* is a pure function of a seed:

```
identity(runSeed, i) -> { name, appearance, stats, hiredAt }
```

so a million developers cost **one integer**, the run seed, and the same developer is the same
person on every frame, after a reload, and in a screenshot taken a week later. This is the
whole reason the feature is affordable at §1's headcounts, and it is not a compromise — a
stored roster would be strictly worse: it would need migration (§24), it would bloat the save
by megabytes, and it would have to answer what happens to Steve when the swarm is culled.

The one thing that *is* stored is the short list of developers the player has interacted with
(§7.8.8) — pinned, promoted, or renamed. A handful of exceptions to a generated world, which
is how every large procedural game does this.

##### What varies

| | |
|---|---|
| **Name** | First + last from weighted lists. Real-sounding, never joke names — the comedy is in what they *say* (Appendix D), and a floor full of "Chad Bugsworth" burns the joke on the first read |
| **Appearance** | Hair shape and colour, skin tone, shirt colour, glasses, headphones, posture. Combinatorially large from a handful of parts, all T3 commodity, all in the master palette |
| **Stats** | Three numbers: **Focus**, **Chatter**, **Seniority**. Rolled per developer from the seed |
| **Trait** | About one in eight has one. `Night Owl`, `Meeting Magnet`, `Ex-Founder`, `Types Loudly` |
| **Hired at** | Which project they joined during. Free, from the index, and it is what makes "one of the originals" mean something |

**The stats must be visible in the world before they are ever read in a panel.** A high-Chatter
developer bubbles more often (§7.8.6); a high-Focus one bobs faster and leaves their desk less;
Seniority shows in posture. A stat the player can only discover by opening a screen is a
spreadsheet entry, not a character.

##### Stats are flavour, and mostly stay flavour

§4.1's equation takes headcount and cap, not a roster. **Per-developer stats do not enter the
production maths in Run 1**, and that restraint is deliberate: the moment Focus multiplies
output, the player is expected to audit forty people and the game becomes a spreadsheet — the
exact §6 failure mode the design is satirising, delivered sincerely.

Where they *do* bite is local and bounded:

- **Poking** — poke yield varies with the individual's Focus and current state (§4.7 already
  varies by state; this varies it by person).
- **§7.8.6 ambient rates** — Chatter drives how often that specific developer interrupts.
- **§13.6 Hero Cards** — a card's coverage is a set of individuals, so who is under it matters.

That is enough for the player to *care* about who is where without being obliged to manage it.

#### 7.8.8 Selecting a developer — the turn, and the card **[CANON — added 2026-08-08]**

Tapping a developer already pokes them (§8.2). **Holding, or tapping their name tag, selects
them** — a different verb with a different payoff, and the game's first moment of intimacy at
any scale.

##### The turn

The selected developer **rotates to face the camera** — a spin, over about 400 ms, with the
§10.8a arrival bounce at the end. The floor dims behind them and the camera eases in a little.

This is the single best thing in this section and it is worth being precise about why: §7.8.6
turned everyone away from the player, facing north-west into their monitors, which is correct
and which cost the game its faces. **The turn buys the face back at the exact moment the
player has asked for a person's attention.** It also gives §22.7's authored sprite brief a
second pose to draw — front and back — which is a cheap way to make one sprite feel like a
character.

They turn back when deselected. Nobody stays facing the player.

##### The card

A panel slides in from the side (§10.5, never a modal — the floor keeps running behind it):

```
+------------------------------------------+
|  PRIYA RAMANATHAN            [ x ]       |
|  Senior  ·  joined during FLAPPY SQUARE   |
|                                          |
|  FOCUS     ########....   72             |
|  CHATTER   ##........     19             |
|  SENIORITY #######.....   64             |
|                                          |
|  TRAIT   Night Owl                       |
|  "I've been stuck on Level 4 of          |
|   'Flappy Pixel' for two hours."         |
|                                          |
|  [ PIN ]   [ RENAME ]                    |
+------------------------------------------+
```

- **The quote is live**, drawn from §19 for their current state. It changes while the panel is
  open, which is what makes the panel feel like a window onto a person rather than a record.
- **PIN** adds them to the stored short list, so the player can find them again. Pinning is the
  only way a generated developer becomes persistent, and pinned developers survive a Paradigm
  Shift — §13.6's James is the archetype.
- **RENAME** is the strongest retention hook in this document and costs nothing: a player who
  has named a developer after themselves, or after a friend, has a reason to open the game
  that no amount of numbers provides.

##### The trap in generating rather than storing **[added 2026-08-08]**

§7.8.7's identities are **generated on demand**, which means `identityFor(seed, i)` returns a
*fresh object every call*. Equal by content, never by reference.

That is fine everywhere except React, and it blanked the entire app the first time anybody
was selected. The card latched its subject the way every other panel in this interface
latches one — `if (who !== held) setHeld(who)` — which is correct for a stored value and an
infinite render loop for a generated one: state set during render, rendering again, forever.
The same mistake in the live-quote effect's dependency array would have failed *silently*,
clearing and restarting the interval every render so the quote never changed once.

**Anything keyed off a generated value must key off the seed, not the object.** It is the one
cost of not having a database and it is worth paying, but it has to be written down, because
the failure looks like a React bug rather than like a consequence of §7.8.7.

##### What it must never be

- **A roster screen.** There is no list of all developers, at any point, ever. Selection
  happens *in the world*, by pointing at somebody.
- **A stat-management surface.** No reassigning, no training, no equipment slots. §13.6 is
  where deliberate optimisation lives, and it operates on rungs rather than on individuals for
  exactly this reason.
- **Available above rung 2.** You cannot select a person who is two pixels wide. Selection is
  a Hero Anchor feature, and §7.7.4's promise that you can always zoom back to a floor with
  people on it is what makes that acceptable rather than a limitation.

#### 7.8.9 The floor as a toy — drag, drop, and the god-mode read **[CANON — added 2026-08-08]**

§7.8.6 gets people out of their chairs. This is what the player is allowed to do about it.

**A developer can be picked up and dropped back into a seat.** Drag them and they dangle, legs
cycling, protesting in a speech bubble; drop them on a chair and they land with §7.8.5's
bum-hits-seat beat; drop them anywhere else and they walk back to wherever they were going,
unhurried, which is funnier than obeying.

> **This used to say "a developer who is away from their desk", and §7.7.6b widened it.** The
> restriction to people already standing about existed because the grab fired off a hold timer
> that the player might not have meant; with GRAB latched and lit there is no accident left to
> guard against, and a toy that refuses two thirds of the room mostly says no. Somebody
> **mid-behaviour** — a conversation, a drive-by, a trip to the cooler — is still refused, for
> the reason that was always the good half of the rule: yanking them out of one reads as an
> interruption rather than as a tidy-up, which is the opposite joke.

That single interaction does three jobs:

1. **It makes the scene a toy rather than a diorama.** The floor is the largest surface in the
   game and until now nothing on it could be touched except to poke it.
2. **It states the game's actual power fantasy.** You are not a developer. You are the thing
   above the developers, and picking one up by the scruff is the most direct possible statement
   of that.
3. **It sets up the joke.** Dropping people back at their desks *looks* like productivity and
   §7.8.6 rule 2 guarantees it changes nothing at all. The player who spends thirty seconds
   herding eight wanderers has produced exactly zero extra Story Points. **That is §6, played
   as a minigame** — the manager who feels most effective is the one achieving least.

##### The wandering population

§7.8.6's behaviours are joined by longer, more visible states, so there is always something to
pick up:

| State | What it looks like | Roughly how many |
|---|---|---|
| **At the cooler** | Standing by the water cooler, bubbling occasionally | 1–2% of headcount |
| **On the sofa** | Sitting on the breakout seating, doing nothing | 1–2%, and 0 once §7.8.1's crowding takes the sofa |
| **Just standing** | Somewhere on the floor, facing nothing in particular | 1% |
| **Circulating** | Walking a slow loop with no destination | 1% |

Percentages of headcount, so the floor is proportionally as lively at 8 as at 80, and all of
it is inside §7.8.6 rule 3's concurrency budget. **The percentage rises with entropy**, which
is the same claim §7.8.6 makes and the most legible version of it: at `TOTAL GRIDLOCK` a
visible fraction of the studio is simply milling about.

##### Rules

1. **Never a fail state, never a timer, never a score.** The moment there is a counter for
   developers-returned, this stops being a toy and becomes a chore with a number on it.
2. **Nothing is ever forced back.** There is no "return all" button. An automation upgrade for
   this would be the game solving its own joke.
3. **It stays available at the Hero Anchor at every scale.** Like §7.8.8, this is a rung-2
   feature and does not need to work at galaxy scale — but the player must always be able to
   *get* to a floor where it works.
4. **Physics stays cartoon.** No ragdoll, no collision, no stacking. A dangling sprite with a
   leg cycle and a squash on landing is the entire implementation.

##### Built — two things the spec did not anticipate **[2026-08-08]**

1. **Loitering is a population, not an event.** §7.8.6's concurrency budget is sized for
   *interruptions*, which last two to six seconds. Loitering lasts twenty-two. Drawing both
   from one budget means the long state squats on every slot and the floor goes silent —
   which is exactly what happened the first time. It has its own cap now (`loiterCap`,
   ~4–14% of headcount rising with entropy, floor of one, ceiling of eight) and the two
   never compete.
2. **Standing about happens where you already were.** The first version sent loiterers to a
   random desk, which is not loitering — a person who gets up and crosses the whole floor to
   stand beside a stranger is on their way somewhere. They now stand at a prop, or just
   outside their own desk. That also keeps §7.8.6's crowding joke intact for free: a floor
   that has lost its walkway has people on their feet and **nobody at the cooler**.

And one rule the spec should have stated outright: **only loiterers can be picked up.**
Somebody mid-conversation is *busy*, and pulling them out of one makes the drag read as an
interruption rather than as a tidy-up, which is the opposite of the joke.

##### Why this is in the design document rather than in a backlog

Because it is the answer to "what is there to *do* while the numbers go up", and idle games
that never answer that are the ones players describe as "just watching a bar fill". §8.2's
poke is the answer for the first four minutes. This is the answer for the next four hours, and
it costs one drag handler and a walk cycle that §7.8.6 has already paid for.

#### 7.8.10 Where you sit — the corner desk, facing the wrong way **[CANON - added 2026-08-10]** - R20

§4.5d says the founder has a desk and that it is always there. **This says where it is, and
which way it points**, and both are load-bearing.

**Your desk is at the corner of the floor, set apart from the rank and file, and it faces
them.** Everybody else faces north-west into a monitor (§7.8.6, and §7.8.1's row grain runs
across that facing). You face *back down the rows*, along the grain, looking at the studio.

Three things follow from one placement decision, which is why it is worth stating as canon:

1. **You are always clickable.** §4.5d requires the founder's desk be actionable at every
   zoom, and a seat inside the reading order would be buried under §7.8.1b's rows the moment
   the floor fills. The corner is the one position that never gets built over.
2. **You are visibly not one of them**, at a glance and without a label. A single sprite
   turned ninety degrees from a thousand identical ones is the strongest silhouette signal
   available, and it costs one rotation.
3. **It is the §6 thesis as a camera angle.** The only person in the building looking *at* the
   company rather than at their own work is the one who stopped doing the work. Nobody has to
   say this; the floor says it every frame, and §7.8.6's turned-away crowd is what makes it
   legible.

**Heroes are placed on the same principle.** A hero assigned to rows (§13.8) sits at the
*head* of them, turned to face along the row rather than into a monitor — so the floor reads
as blocks of work with somebody standing over each one, and an unclaimed block is visibly
unclaimed.

> §7.7.4's Hero Anchor already guarantees the camera can always return to this desk. That
> promise now has a specific thing to return *to*, rather than "wherever seat 0 ended up".

#### 7.8.11 A hero has to be visible from orbit **[CANON - added 2026-08-10]** - R26

**§13.6's cards are currently invisible in the world.** A hero covers an area, the area does
something, and there is nothing on screen that says so — which makes §13.8's placement game a
puzzle played against a HUD panel rather than against the studio.

**A hero is marked at every rung, and the mark changes register as the ladder climbs:**

| Rung | What you see |
|---|---|
| **0–2** — the room | The person themself, at the head of their rows (§7.8.10), with a §7.8.7 silhouette that is *theirs* rather than rolled. Coverage drawn on the floor in the class colour |
| **3** — the tower | A **portrait plate** on the storey they cover — a small framed face on the building, one per hero, readable at the size a storey actually is |
| **4–6** — the city | The plate scales to the unit. A building with a hero on it wears their face; a campus wears the face of whoever covers it |
| **7–9** — nation and up | Reduced to the class colour alone. A face at galaxy scale is a lie about resolution |

**The portrait is the same generated face §7.8.7 already draws**, framed rather than
redrawn — so this costs a frame, a plate and a scale rule, and **no new art**, which is what
keeps §22.7's nineteen-sprite budget intact.

Two rules, both of which exist because this is the kind of feature that quietly turns a city
into a scoreboard:

- **Only heroes get a face.** The moment ordinary units carry portraits the mark means
  nothing, and §7.8.2's "a rung change has to change the silhouette" is broken by a layer of
  identical badges.
- **The plate is architecture, not UI.** It sits in the world, in the 2:1 projection, lit by
  §7's single source, and it occludes and is occluded like anything else on the building.
  A screen-space badge would float free of the city and read as a map pin — which is
  §7.7.7's "never a menu with a picture behind it".

#### 7.8.12 The executive suite — where the heroes sit **[CANON - added 2026-08-15]** - R74

§7.8.10 gives the founder a corner desk and §7.8.11 gives a placed hero a mark on the unit they
cover. **Neither says where a hero is when they are not covering anything**, and §13.11.2
answers it with a word — `BENCHED` — printed on a strip. A word on a strip is the weakest thing
this design does: the game has a building, and it is putting the roster in a caption.

**So the heroes have a room, and the room is the one the studio started in.**

##### The joke that decides the geometry

The obvious build is a glass box at the far end of the floor that the player unlocks and the
heroes move into. That is a real executive suite and it is the wrong one, because it means the
founder *moves*, and the founder moving is the one thing §7.8.10 spent three paragraphs saying
they must not do.

**So nobody moves. The walls arrive.**

> The executive suite is built around the founder's corner desk and James's desk beside it —
> the two desks that have been there since the garage — the first time a second hero arrives.
> You did not move into the executive suite. The executive suite was **built around where you
> were already sitting.**

That gives the room a position for free (it is anchored to §7.8.10's corner, which never gets
built over), it costs no relocation animation, and it lands §21.7.4's joke a scene early:
James is promoted to Global Head of His Desk and it is *the same desk*, because the walls came
to him.

##### What is in it

| | |
|---|---|
| **The founder's desk** | §7.8.10's corner desk, unchanged, still facing back down the rows. It is now inside the glass, which changes nothing about it and everything about what it looks like |
| **James's desk** | Beside it, at seat 0, with the Diet Coke and the elbow hole. He is inside the suite and has never once acknowledged that anything happened |
| **One desk per hero** | Added when that hero arrives (§21.7.3), with a nameplate. **The desk stays when the hero is placed** — empty, plated, and visibly waiting |
| **Glass, not brick** | The rank and file can see in and the player can see the floor through it. A suite the camera cannot see past is a wall across the middle of §7's best shot |
| **Windows** | §26.3.1 gives floors windows; the suite gets the corner ones, because of course it does |

##### The mechanic it carries

**An unplaced hero is at their desk in the suite. That is what benched looks like**, and it is
the whole reason to build the room:

- §13.10's "a card in the tray is a person on the bench" becomes a thing you *see* — somebody
  sitting in a glass room doing nothing while the floor works.
- **Placement is a drag out of the suite**, using §7.8.9's existing carry gesture, onto the unit
  they will cover. Recall is a drag back. §13.6.6's "the card board is the world" is satisfied
  without a tray, and §13.6.7's forbidden management screen is not merely avoided — there is
  nowhere to put one.
- §13.8's settling period (rule 4) is a **walk**. A relocated hero covers nothing while they
  cross the floor, so the cost of moving somebody is a thing the player watches rather than a
  timer they are told about. This is §26.3.1's walking system arriving early because heroes
  needed it first; the ambient version inherits it.

> **The suite is never a screen and never a menu.** It is a room at Desk and Floor zoom, it is
> occluded by the building like anything else, and above rung 3 it stops being drawn at all —
> §7.8.11's portrait plates take over, because a room is not visible from orbit and pretending
> otherwise is §7.7.7's "menu with a picture behind it".

#### 7.8.13 A hero is the one person on the floor who never changes **[CANON - added 2026-08-15]** - R51

**"Heroes should be extremely distinct from other developers on the main game"**, and §7.8.11
answers it at rungs 3 and up with portrait plates. At the rung where it matters most — the
room, where the player spends Run 1 and Run 2 — a hero is currently a §7.8.7 silhouette among
silhouettes, and the only thing separating them is a name nobody is reading.

The available moves are mostly bad. Make them bigger and the 2:1 projection breaks. Give them
an outline and it is a game UI drawn on a person. Give them unique sprites and §22.7's art cap
is gone.

**The one that is free is behaviour**, and it happens to also be true:

> **Everybody else on the floor has ambient states. A hero has one behaviour, it is theirs, and
> it never changes.** §7.8.6's drive-by interruptions do not land on them, §26.3.1's slacking
> does not apply to them, and they are doing the same thing every single time you look.

| Hero | Doing, forever | Which is also the branch |
|---|---|---|
| **James** | Not moving. Typing. A can of Diet Coke. §21.7.0's rule 1 as an animation | Engineering — the trunk |
| **Mo** | Reading. Something on paper, held up, being read twice | Quality |
| **Serena** | Watching a graph. It is fine. It has always been fine | Reliability |
| **Matt** | On a headset, talking, gesturing at nobody | Support |
| **Melany** | On a call, standing, walking a two-metre circuit and never further | Cloud |
| **Billy** | At the whiteboard. Always at the whiteboard | Cohesion |

**This is the strongest signal available and it costs one animation each**, because §7.8.6
already has an ambient-state machine and this is a hero being pinned to one state in it. It
needs no sprite, no outline, no size change and no label — the player learns who Billy is
because Billy is the one at the whiteboard, which is how you learn who people are.

Three supports, each cheap:

1. **A desk plate in the branch colour**, readable at Desk zoom, carrying the title string
   §21.7.4 only ever extends.
2. **A floor decal** under the chair in the branch colour — the same colour §13.11.1 draws
   coverage in, so the mark on the person and the mark on the work they cover are visibly one
   system.
3. **The turn is theirs.** §7.8.8 rotates a selected developer to face the camera; a hero
   selected gets the same turn onto §22.9's card rather than the personnel record, which is the
   moment the player learns these two things are different kinds of object.

> **Only the six get this.** §22.5's collection long tail are cards, not residents — they have
> no signature behaviour and no suite desk, and the difference is the point: the story roster
> are people who work here.

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

#### 8.2b The points appear over the person, not under the thumb **[CANON - added 2026-08-08]** - R10

A poke's numeral rises from where the finger landed. That is correct for the *tap* and it is
not enough for the *work*: developers generate story points continuously whether or not
anybody is poking them, and none of that is visible.

**A developer producing story points shows them.** A small `+1` drifts up from their head as
they earn, per developer, at the rate they are actually earning.

- It is the clearest possible statement of the 6 thesis. One person emitting a steady `+1` is
  a studio working; a hundred people each emitting `+1` while the total barely moves is the
  joke the whole game is about, told without a number.
- It must **thin out as the floor fills**, not stop. Above the point where individual numerals
  become noise they aggregate - per row, then per squad - so the picture stays legible and the
  information survives. 7.8.3's budget rule applies: this is a transform on a pooled sprite,
  never a per-developer allocation.
- It is **distinct from the poke numeral** (8.2), which is larger, coloured, and carries the
  8.2a code snippet. Passive output is quiet; a tap is an event.

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

#### 10.1a The primary action lives on the right rail **[added 2026-08-08]**

**Not in the middle.** HIRE DEVELOPER was centred along the bottom edge, and centred it sat on
top of the thing it was acting on: the studio is the subject of every frame, and the one
control the player presses constantly was parked across the middle of it — over the desks at
rung 0, over the block at rung 4.

Nothing else in the Layer does that. §7.1's whole arrangement is a clear centre with the
instrumentation pushed to the edges, and the action button was the single element exempted
from it for no stated reason.

The right rail is also **where the thumb already is**: the game is landscape-locked (§23.4),
so the right edge is the hand holding the phone. And it puts the button directly under the
CASH readout it spends, which is the one adjacency worth having on a screen full of numbers.

The §21.0a offer and the §10.10 dial stack above it and right-align with it, because a
temptation aligned differently from the control beside it is a second thing to keep in sync.

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

### 10.2a Say "story point", and colour the words that matter **[CANON - added 2026-08-08]** - R12, R13

**Never "SP".** It is an abbreviation that means something to the people who wrote it and
nothing to anybody else, and it appears in the largest readouts on the screen. Write **story
point** and **story points** in full - in the HUD, in the burn-down, in the script, in the
speech bubbles, everywhere. Where a line is genuinely too tight for the full phrase, the line
is too tight and something else gives.

The same applies to any other in-house shorthand that reaches the glass. If a player would
have to be told what it stands for, it is not ready to be on screen.

**And the words that matter are coloured.** Running copy is one colour and the nouns the player
is meant to track are another, so a value jumps out of a sentence without needing to be
formatted into a box:

- **Story points** first, because they are the thing the whole burn-down is about.
- Then the others as they earn it - cash, developers, entropy, velocity.
- The colours come from 2.2's master palette. This adds no colours to the system; it *uses*
  the ones the ramps already carry, which is what a semantic palette is for.

**One noun, one colour, everywhere it appears.** A story point tinted one way in the HUD and
another in a speech bubble teaches the player that the colour means nothing.

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
  > tick is unpitched.
  >
  > **The tick itself is no longer a stand-in.** `ui-tick.mp3` exists and the throttle moved
  > from 90 ms to 55 ms with it — about every other letter, where a Game Boy text box sits.
  > The old rate was never a decision about how text should sound; it was the shortest
  > interval at which a borrowed half-second keycap click stopped overlapping itself into a
  > drone. **The clip was setting the design**, which is worth watching for elsewhere: the
  > interface bank had also been routing a panel open to `zoom-in`, a 1.2 s camera sweep
  > written for nine orders of magnitude, still moving long after the 320 ms panel had
  > settled. A sound borrowed from another context brings that context's *length* with it,
  > and being the right kind of sound does not fix being four times too long.

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

### 10.7a The camera is part of the dialogue **[CANON - added 2026-08-11]** - R31

**§10.7 specifies a box. It never specifies where anybody is standing**, and the result is
that every scene in the game so far has been two name plates trading text over a wide shot of
an unrelated crowd. The script is the product (Appendix D); the staging was left to whatever
the camera happened to be doing when the scene fired.

**When a line begins, the lens goes to the person saying it.** That is the whole of this
section, and everything below is what it costs.

#### 10.7a.1 The shot

| | |
|---|---|
| **On scene start** | The camera drops to §7.4's Desk zoom over the pair, from wherever it was, on §10.5's transition curve. The studio keeps running behind them — this is a push, never a cut to a cutscene |
| **On each line** | It re-centres on the **current speaker** with a short, small move. Not a whip: the speaker is already in frame, and the move is the ~15% of screen width that says *this one is talking* |
| **The speaker turns to camera** | §7.8.7's people are drawn at a fixed three-quarter angle. A speaking character swaps to their **front-facing** pose for the duration of their line and turns back at the end of it |
| **Everyone else keeps working** | The listener does not freeze. §7.8's ambient loops continue, because a studio that stops to watch two people talk is a diorama |
| **On scene end** | The camera returns to where it was, on the same curve. A scene never leaves the player somewhere they did not choose to be |

**The front-facing pose is the only new art this section needs**, and under ART_DIRECTION
§4.1's parts-library method it is one extra torso and one extra head per character rather than
a new sprite per person — the parts already exist, the assembly is different. §22.7's cap is
untouched: it counts *portraits*, and this is the world sprite.

> **Why the speaker turns rather than the camera cutting between two shots.** A cut needs two
> composed frames and a rule for which one you are in; a turn needs one frame and a pose swap,
> and it reads instantly at Desk zoom because at that scale the player is looking at faces
> anyway. It is also the cheaper thing by a wide margin, which under §23.1a is the argument
> that actually decides it.

#### 10.7a.2 The subtitle grows and moves up

§10.7's box is bottom-anchored, three lines, at the terminal type scale. **It is too small and
too far away for the thing it is carrying.** The script is the product and it was being
rendered as a status bar.

| | Was | Now |
|---|---|---|
| **Position** | Bottom edge | **Lower third, centred** — the box floats, with air beneath it |
| **Type size** | Terminal scale | **Roughly 1.5× it.** Large enough to read at arm's length without leaning in |
| **Width** | 40 columns | **Narrower in characters, wider on screen.** ~28 columns at the larger size, which keeps the same physical measure and improves the ragged edge |
| **Page length** | 3 lines | **2 lines.** Fewer words, larger, more pages — a page turn is a beat, and §10.7's rule 2 already made turning one deliberate |

**§10.7's "it never covers the speaker" is not repealed — it is finally enforceable.** The
rule was previously a hope about where the camera happened to be. With §10.7a.1 the speaker is
framed in the **upper half** deliberately, so a box that has grown and moved up still sits
clear of them, and now does so by construction rather than by luck.

Everything else in §10.7 is unchanged and unchallenged: the per-character reveal, the tick,
the 260 ms quiet window, the deliberate advance tap, and **no skip**.

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

#### 10.9.6 Depth — three planes, no new art **[CANON]**

§10.9.5 forbids a bespoke title illustration and §10.9.1 explains why: the room *is* the
title. But the first build of that idea had a flaw §10.9.2's layout diagram cannot show.
It had exactly **two planes** — the room, and the type in front of it — and two planes read
as a photograph with a caption. Nothing was between the camera and the subject, so the
camera did not feel like it was anywhere.

The fix is depth, not decoration, and none of it is an asset:

| Plane | What it is | Why |
|---|---|---|
| **Near** | An empty chair and the edge of its desk, cropped by the frame, thrown out of focus | The camera is *in* the room rather than looking at a picture of one |
| **Middle** | Dust drifting through the monitor's beam, on three sub-planes at three speeds | Parallax is the only depth cue a still frame keeps |
| **Far** | The room, as §10.9.1 already has it | — |

Three rules govern this, and each was learned by getting it wrong:

1. **The near field is a silhouette, never a drawing.** An unlit object between the camera
   and the room's one light source shows no surface at all, so shading it would be *wrong*
   as well as expensive. It is a hole in the picture in the shape of a chair. That is what
   keeps it clear of §10.9.5 and of §22.7's sprite budget — there is no illustration.
   §10.9.1 already says "the chair is empty"; this is where that sentence lands.
2. **The near field must be placed where the light is.** The first attempt tucked it into
   the bottom-right corner, which is exactly where §10.9.1's night wash is heaviest, and a
   black silhouette on a black ground is not a silhouette. **A foreground object is only
   visible when it takes light away**, so it is positioned to cross the lit desks rather
   than to sit politely out of the composition.
3. **Parallax is carried by rate, not by size.** Motes at different sizes read as
   different-sized dust; motes at different *speeds* read as distance. Sizes vary as well,
   and the nearest plane is blurred because it is closer than the plane in focus, but the
   speed difference is the one doing the work.

**The numerals are a lit display element, not printed type.** §10.9.2 rules out a wordmark,
which leaves the numerals carrying the whole title alone — and a flat fill at one colour is
not enough weight for that job. They get phosphor bloom and a hair of chromatic split, both
from the CRT vocabulary ART_DIRECTION already owns, and neither a gradient nor a bevel
(ART_DIRECTION §7 forbids both in assets, and it would be strange for the interface to break
a rule the art obeys). **`DEVELOPERS` deliberately does not get the same treatment**: if
both lines glow, neither is the headline, and the contrast between a lit line and an unlit
one is most of what makes the pair look designed.

The whole of §10.9.6 costs three DOM elements, one text-shadow and no files.

#### 10.9.5 What it must never be

- **A static image with a Play button.** §10.8 F1 and F2 both fail.
- **A separate art asset.** The room already exists; a bespoke title illustration would be
  the only piece of art in the game with no gameplay use, and §22.7's budget has no room.
- **A fade to black on start.** §10.5, and it throws away the one transition the whole
  concept is built on.
- **A logo that does not count.** The count *is* the wordmark.

#### 10.9.7 OPTIONS and CREDITS — what is behind the other two slabs **[CANON - added 2026-08-10]**

**Closes Appendix F2.1 and F3.1.** Both menu items existed as §10.9.2 stubs — real slabs
opening onto the words *"NOT WIRED UP YET"* — and F2.1 was the register's bluntest row: "❌ All
of it."

**The design principle for both screens is that every accommodation in this game was, until
now, a decision the operating system made for the player.** Reduce motion came from a media
query, volume came from the hardware keys, and haptics could not be turned off at all. That is
defensible for motion and indefensible for the other two: **a phone's volume rocker is a single
control**, so "quiet music, loud pokes" was a position the player could not express.

##### OPTIONS

| Row | What it does | Why it is here |
|---|---|---|
| **MUSIC** | §20.1's bus, in tenths | Lands on the **master node**, never the stems — §20.3's DSP matrix rewrites every stem gain each frame, so a preference written there is gone by the next tick |
| **EFFECTS** | §20.5's interaction bank, in tenths | Mirrored into a plain number rather than read per sound: `playSfx` runs inside the tap handler §23.3 criterion 1 measures, and a native volume call per poke puts bridge latency inside the measurement |
| **HAPTICS** | On / off | §8.3. The one piece of feedback in this game that can embarrass its player in a quiet room, and it had no off switch |
| **MOTION** | SYSTEM / FULL / REDUCED | §10.5 rule 3 is the *system's* answer. `SYSTEM` defers and is the default; the two explicit values exist because the OS setting is one switch for every app on the device, and wanting reduced motion in an email client and the full thing in a game is a coherent position |
| **RESET** | Two presses; the second names what it erases | The local half of F1.4. **A save that cannot be cleared is a game that can only be reviewed once** |

**Restore purchases (F1.5) is deliberately absent rather than stubbed.** There is no RevenueCat
in this build, and a button that cannot restore anything is a worse answer to that row than an
honest gap.

**Rendered as readouts, not as form controls.** §10.6 names the axis-aligned rounded rectangle
and the native widget as the two things that make a screen look like a web page, so a volume is
a **ten-cell meter that is typed** rather than an `<input type="range">`, and a toggle is a pair
of bracketed words. The reset is two presses rather than a confirm dialog for the same reason.

##### Where the settings live **[CANON]**

**Outside §24's save document, and this is load-bearing.** The save is the run and the prestige
layers: it is merged, migrated, and deliberately erased by §13.3's Codebase Fork. A volume
slider is none of those things — it belongs to the *device*, it must survive a prestige that
erases everything else by design, and it must be readable **before the store loads**, so the
first sound the game makes is already at the volume the player chose. Putting it in `SaveData`
would make "what does a prestige reset" a harder question for no gain.

It carries the `m100devs_` key prefix for the reason SAVE.md §4 gives: a browser build shares an
origin with every other studio game, and a collision here would be *quieter* than one on the
save — another game's settings object would parse, coerce to something plausible, and silently
re-mix this one.

##### CREDITS

Deliberately thin — §22.7 caps the art budget at nineteen sprites and none of them is a credits
illustration. One obligation, and it is not optional:

> **Departure Mono ships under the SIL Open Font License 1.1 and its licence must be reachable
> from inside the product.**

**The licence text is imported from the file that ships in the bundle, never pasted in.** A copy
is a second text that can drift from the one actually governing the font, and the failure mode
of that drift is a licence violation that no test can see. Importing the real file also makes
the bundler prove it is present: delete the licence and the build breaks, which is the correct
relationship between an obligation and a build. It is set in the font it licenses, because
ART_DIRECTION §3 rule 1 admits no exception for legal text.

---

### 10.10 The Hire Control — the dial **[CANON — added 2026-08-08]**

Hiring is the game's primary verb (§7.7) and for the whole of Run 1 it has exactly one shape:
a button that hires one developer. That is correct at two developers and absurd at two
million, and the fix is not a bigger button. **It is a multiplier dial.**

#### 10.10.1 The control

```
  +---------------------------------------------+
  |   [ x1 ]  [ x10 ]  [ x100 ]  [ MAX ]        |   <- the dial
  |                                             |
  |   +-------------------------------------+   |
  |   |          HIRE  x100                 |   |   <- the button
  |   |            $1.4M                    |   |
  |   +-------------------------------------+   |
  +---------------------------------------------+
```

- **The dial is a row of segments, not a stepper.** One tap changes the multiplier; there is
  never a sequence of taps to get to the one you want. A stepper at x1,000,000 is forty taps.
- **The button below shows the multiplier and the total cost**, and the total is §4.10a's
  `hireCostTotal` — the true sum of the next *n* hires, never `n × current`, which
  understates it and would read as a lie the first time a player checked.
- **The selection persists** across sessions in the run state (§24.3). A player who chose
  MAX meant it.
- **MAX is "as many as I can afford right now"**, recomputed every frame, and it is the only
  segment whose count changes without the player touching anything.

#### 10.10.2 The dial grows with the studio

New segments unlock as headcount does, and **the smallest ones are retired** — a x1 segment
at ten million developers is not a choice, it is clutter.

| Headcount | Segments offered |
|---|---|
| 1 – 24 | *(no dial — one button, one hire)* |
| 25 – 9,999 | `x1` `x10` `x100` `MAX` |
| 10 K – 999 K | `x10` `x100` `x1K` `MAX` |
| 1 M – 999 M | `x1K` `x10K` `x100K` `MAX` |
| 1 B + | `x100K` `x1M` `x10M` `MAX` |

**Four segments, always.** Never five, never a scrolling list. The window slides up the ladder
and the shape of the control never changes, which is what lets a player who learned it at
fifty developers still recognise it at a billion.

The opening band offers `x100` long before anyone can afford it, and that is the rule below
working rather than an oversight: an unaffordable multiplier is **shown and priced**, which is
how the player learns what to save for. An earlier draft gave the first band three segments
and introduced the fourth at 250 — which made the control change shape once, early, for no
reason the player could see.

**The dial is unlocked by §21.0a's Seed Round, at 10 developers** — not by a headcount
threshold. A multiplier in Act I would let the player skip the beat where hiring one person is
the whole game, so it has to be gated; gating it on *an event they earned* rather than on a
number crossing 25 gives the unlock a reason. An earlier draft used the bare threshold and it
arrived unannounced, which is a worse version of the same thing: capability without cause.

Outside Run 1 — every subsequent run, having prestiged — the dial is simply present from the
first frame. The funnel is a first-run device and re-teaching it is an insult.

#### 10.10.3 The rules

1. **A multiplier the player cannot afford is shown, priced, and disabled** — never hidden.
   Hiding it removes the information the player needs to decide what to save for. This is the
   opposite of §24.8's rewarded-ad rule (where a dead button *is* a broken promise), and the
   difference is that a hire button is a price tag and an ad button is an offer.
2. **MAX never spends the last dollar** — concretely, **it keeps back a tenth of the
   treasury**. §4.10a's Mass Hire deliberately takes *everything*, because that is Act III's
   trap and it is supposed to ruin you; two controls that look alike and differ on whether
   they bankrupt you would make the trap read as a bug rather than as a betrayal.

   > **The reserve is a fraction rather than a duration, and the first draft got that
   > wrong.** Deriving it from §4.10's wage — "five seconds of the payroll you will have
   > after the hire" — reads better and is unusable: at thirty developers that is $7,000,
   > which is more money than an Act IIa player has ever held, so MAX would have been dead
   > for the whole of the act that introduces it. A fraction is always satisfiable and
   > scales without tuning. **A segment that never lights up is worse than one that was not
   > shipped.**
3. **Every hire in a batch is a §7.8.5 arrival.** A x100 hire cascades a hundred seats in seat
   order, compressed by `cascadeDelay` so it stays inside its cap. **The batch is never a
   number going up.** If a multiplier is large enough that the room cannot show it, that is
   §7.7's signal to change rungs, not to skip the animation.
4. **The dial is not the Act III bait.** Act III's `HIRE 1,000 DEVS NOW` is a scripted,
   one-shot, treasury-emptying offer with its own `bait` styling (§21). It sits *above* the
   ordinary hire control rather than replacing it, and it leaves for good once taken. **A
   player must be able to look at the real control and the trap side by side** — the trap
   works because it is obviously a worse deal, not because it was the only option.

#### 10.10.4 What it must never be

- **A hold-to-repeat button.** Buying 4,000 developers must cost one tap, not a held thumb.
- **A slider.** Continuous input for a quantity the player thinks about in orders of magnitude.
- **An auto-buyer, in Run 1.** Automation is §11 tech-tree content and it is a *reward*;
  handing it over as a default deletes the verb.

### 10.11 The Release Gallery — what you have actually made **[CANON - added 2026-08-10]** - R28

**Shipping is the loop's payoff and it currently leaves nothing behind.** §4.10e turned the
back catalogue into a *rate* — a stack of bands 120 px wide — and that is the right readout
for "am I earning". It is the wrong readout, and the only one, for "what have I made". The
instant a project lands, the burn-down resets, the name changes, and four minutes of play
becomes a thin band under tomorrow's launch. §4.12's defects, §4.13's tickets and §4.14's
rating all attach to a *release*, and there is nowhere in the interface a release exists.

**The gallery is where a run acquires a history.** It is also the only place §4.14's rating can
be compared: one rating is a score, and twelve ratings in a column is a trend. §4.14 says the
rating is the first quantity in this game that can go down while everything else goes up —
that sentence is invisible until the ratings sit next to each other.

#### 10.11.1 The card

Newest first. One row per release, four facts and a picture.

```
  +-------------------------------------------------------------+
  |  +------+  UNTITLED ROGUELIKE DECKBUILDER                    |
  |  |######|  #7 - shipped 4 minutes ago                        |
  |  |# /\ #|                                                    |
  |  |#/  \#|  RATING    68/100  #######...                      |
  |  +------+  REVENUE   $1.24M  -  $6.1K/s, still earning       |
  |            LABOUR    4.8 man-millennia                       |
  +-------------------------------------------------------------+
```

- **Rating** — §4.14's score out of 100, on the ten-cell block bar §7.8.8's card already
  spends. Not a star rating. Not a percentage with a coloured ring.
- **Revenue** — total handed over *so far*, and the live rate beside it. A release whose tail
  has been paid out reads `RETIRED` where the rate was, which is §4.10e's long tail made
  visible per game instead of only in aggregate.
- **Labour** — the man-days. §10.11.2, which is the whole design problem.
- **Cover** — generated, never authored. §10.11.3.

#### 10.11.2 The labour figure — man-days at 10⁹ developers

**The definition, and the one thing that must never be "corrected": labour is headcount
integrated over build time, and it is NOT divided by efficiency.**

```
  manDays  =  ∫ D dt / 86,400
```

A studio at 3% efficiency (§4.1) spends thirty-three times the labour on the same game, and
the gallery says so. **That is the number this entire product is about.** Dividing by
efficiency — or deriving labour from story points delivered, which is the same mistake wearing
a hat — produces a figure that is flat across the whole run, because useful work is by
construction proportional to the size of the game. It would be a tidier number and it would
delete the joke, which is that **you paid for all of it.** §6's trap is a sentence the player
already half-believes; this is the receipt.

**The representation problem, stated in numbers.** The wall clock barely moves across the whole
game — a project is minutes at every scale — so labour is headcount, and headcount is nine
orders of magnitude:

| Studio | Build time | Labour | Written naively |
|---|---|---|---|
| Act I — 1 developer | ~2 min | 0.0014 man-days | `0.0014` |
| Act IIb — 40 | 90 s | 0.042 man-days | `0.042` |
| 100,000 | 90 s | 104 man-days | `104` |
| 100,000,000 (the title) | 90 s | 104,167 man-days | `104167` |
| 1,000,000,000 | 90 s | 1,041,667 man-days | `1041667` |
| 10¹² | 90 s | 1.04 billion man-days | `1041666667` |

This is §7.7.1's problem restated in a different unit, so it gets §7.7.1's answer.

**The unit climbs a ladder; the number stays in a band a person can read.** Each rung is
roughly a thousand times the last, so the figure lives at 1–999 for almost the whole run:

| Labour | Unit | Reads as |
|---|---|---|
| under a man-day | **man-hours** | `34 man-hours` |
| 1 – 999 man-days | **man-days** | `212 man-days` |
| 1 – 999 man-years (365 man-days) | **man-years** | `4.8 man-years` |
| 1 – 999 man-millennia (1,000 man-years) | **man-millennia** | `2.9 man-millennia` |
| 1 man-aeon and up (10⁶ man-years) | **man-aeons**, then §10.2's suffix ladder | `41 man-aeons`, `4.1M man-aeons` |

**Four rules, and the third is the design:**

1. **The unit is spelled out, never abbreviated.** `4.8 man-millennia` is the entire gag;
   `4.8 mm` is a spreadsheet. This is the one figure in the interface allowed to cost that
   many characters.
2. **Centuries are skipped deliberately.** A century is only ten years and a millennium is a
   thousand, so including both would give one rung a ×10 step and break the band. Millennium
   is also the better word.
3. **Each release is shown in its *own* unit — the column is never normalised.** Release #1
   reads `34 man-hours` and release #12 reads `2.9 man-millennia`, and the unit changing as
   the eye travels down the column **is the readout**. Normalising the column to man-hours
   would put the same information on screen as fifteen-digit numbers nobody compares. This is
   the whole reason the gallery is a list and not a chart.
4. **Above a man-aeon the ladder stops and the number grows**, on §10.2's existing K/M/B
   suffixes. Inventing a fifth word is how a unit ladder turns into a bestiary; an exponent
   with a suffix stuck on it is the bug `formatMoney` already records having fixed.

> **This is not E5's `MAN-WEEKS` coming back.** That was a **live gauge in the left rail**,
> competing for space with §4.10e's graph and §10.1's speedometer, and it was withdrawn on
> sight by the person who asked for it. This is a **fact about a finished thing, on a screen of
> its own**, next to what that thing scored and what it earned. The unit is the same; the
> reason it earns its pixels is not. E5 stays closed.

#### 10.11.3 Cover art, and why it cannot be a sprite

**Releases are unbounded.** A long run ships dozens and every prestige run ships more, so no
release may cost an asset — §22.7's hard cap is 19 sprites for the entire collectable system
and this would be the hole in the bottom of it. Cover art is **generated from the release's own
seed**, the same contract §7.8.7 uses for faces: rolled on demand, never stored, identical
across a reload.

- A small square tile — 48×48 — **drawn in code**, not composited from art.
- Ground from the genre's ramp. §4.10's project ladder already names a genre in every title.
- **One primitive glyph**, from a short library of code-drawn shapes: a die, a sword, a rocket,
  a spreadsheet. A dozen shapes covers the ladder and each is a handful of polygons.
- Title lettering at that size is **dashes, not words** — the decision `ambient.ts` made for
  speech bubbles and then reversed. It stays dashes here, because a bubble holds thirty
  characters and a 48 px cover holds none.
- **§4.14's rating tints the frame.** The score picks the ramp step, so a wall of covers reads
  as a quality history *before a single number has been read*. This is the rule that makes the
  gallery a picture rather than a table.

#### 10.11.4 Where it lives

Behind §10.1's nav, beside `UPGRADES`, as a **right-edge drawer and not a modal** — §7.1 and
§10.5 rule 1, the same shape §11's door already is. The swarm keeps simulating behind it, and
the player can keep poking everywhere the panel is not.

#### 10.11.5 What it must never become

- **A leaderboard**, or anything with a global ranking in it.
- **A screen that pauses the game.** §10.6.
- **A place where releases can be managed.** §4.10e's tail is a fact, not a lever. A "remaster"
  button turns the catalogue into a second idle game running beside the first, and Layer 1
  already exists for wanting more.
- **A shopfront pastiche.** Not a store page, not review quotes, not a wishlist count. The joke
  is the studio, not the storefront.
- **A gallery that hides the bad ones.** Every ship goes in, including the 12/100s. §4.14 is
  explicit that shipping a 12 and making a fortune must stay possible and funny — and the
  trend in §10.11.2 rule 3 means nothing if the column is curated.


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

> **B1 is superseded by §11.5 — amended 2026-08-11.** Voice Shouting is no longer a purchase.
> It is the studio's **starting condition**, stated on the empty board as the thing about to be
> replaced, and the B1 slot is taken by **Instant Messenger** — given free by James in §21.7's
> first scene, at the centre of §11.4's board. The effect and the −5% are carried over
> unchanged; only who hands it to you and what it costs have moved.

**Tier summary (alternate phrasing):**

- **T1: Shouting Across Desks** (reduces noise penalty by 5%) — **superseded, see §11.5**
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

### 11.4 The tree is a tree **[CANON - added 2026-08-11]** - R33, R34, R35

**§11 has always called this a tree and it has always been rendered as two lists.** Two
columns of cards, every node visible from the first frame, levels hidden inside a `3/5`
counter. That is a shop with prerequisites. The thing this genre is actually good at — a board
that grows outward under the player, where buying one node lights up three you had not seen —
was specified nowhere and therefore built nowhere.

#### 11.4.1 The board

```
                             .  .  .
                             |
                   [C2]--[C1]|
                             |
        .  .  .              |
             |               |
   [B3]--[B2]+[B1]--------[ IM ]--------[F1]--[F2]--.  .  .
             |               |            |
             |               |          [F3]
             .               |            .
                       [D1]--+--[D2]
                             |
                             .
```

| | |
|---|---|
| **Origin** | **The centre of the board is Instant Messenger** (§11.5), and it is the only node the player is ever given rather than sold |
| **Growth** | Outward in **all four directions**. A branch is a compass heading, not a column |
| **Geometry** | **Right angles only.** Orthogonal connectors on a fixed grid — no curves, no diagonals, no bezier splines. §10.6's anti-patterns forbid the organic-blob talent tree, and a grid is the only shape that survives Departure Mono, the §2 palette and a 5-inch phone at once |
| **A level is a node** | §11.0's `maxLevel` counters are gone from the face of the tree. **Voice Shouting at 5 levels is five nodes in a chain**, each with its own price, its own icon state and its own purchase moment. A `3/5` counter is a spreadsheet cell; five lit nodes is a road you can see you are on |
| **Size** | The board is **larger than the viewport in every direction and is panned**, which is how it is bigger without a line of copy claiming it is. §10.6: an interface that announces its own size is a web page |

**Why the centre-out shape rather than a root at one edge.** A tree with a root has a
direction, and a direction implies an order — the player reads it as a queue and works down
it. A tree with a *centre* has five ways to be wrong, all visible at once, and the first real
decision in §11 is which direction to spend in. It is also the same shape as §13.9's hero
tree, deliberately: **one board grammar, learned once, used in two places.**

#### 11.4.2 Progressive reveal, and the argument it overturns

The shipped implementation names every locked node — `NEEDS B1` — on an explicit argument
recorded in the module: *"a tree that reveals nodes as you buy them cannot be planned, and
planning is the whole of §11's warning."* **That argument is right about planning and wrong
about how far ahead planning needs to see.** Three states, not two:

| State | What the player sees |
|---|---|
| **Live** — affordable or owned | Everything. Icon, name, effect, flavour, price |
| **Adjacent** — one node from something owned | **Silhouette.** Icon and price, in outline, no text. Enough to plan the next purchase and to want it |
| **Dark** — further out | **The connector, and a stub.** You can see the branch continues and how far, and nothing about what is on it |

Planning survives because §11's warning — *"upgrading Workforce without Communication Infra
rapidly triggers the trap"* — is a warning about **the next purchase**, and the adjacent ring
is exactly that. What it gives up is planning six nodes ahead, which no player was doing and
which was costing the game every reveal it had.

> **A dark node still shows its connector.** The board's *shape* is never hidden, only its
> contents. A player must always be able to see that the branch they are on goes somewhere,
> or the tree reads as finished and they stop looking at it.

#### 11.4.3 The guide layer

**Tapping a node opens it; it does not buy it.** A purchase that fires on the same tap that
first shows the price is how a player buys the wrong thing on a phone, once, and stops
trusting the screen.

An opened node raises a **guide layer** over the board — the node enlarged in place, dimming
everything else, carrying:

- The **icon**, at four times board size, where its detail is finally legible.
- **Name, flavour, effect**, in that order. §11's flavour column is half the reason the tree
  exists and it is not a tooltip.
- **What it unlocks**, drawn as the connectors lighting up on the dimmed board behind — so
  the consequence of the purchase is shown on the map rather than described in the panel.
- **The price, on the only button.** One button, one action.

#### 11.4.4 Icons

**One procedural pixel icon per node.** ART_DIRECTION §3.1 T0 — geometry from the §2 palette
on the integer grid, drawn in code, no emoji anywhere near it. A node's icon is a picture of
the *thing*, not of its category: Instant Messenger is a speech bubble with a lightning bolt
through it, Daily Standups is three figures and a clock, JIRA Ticket Flooding is a stack of
tickets deep enough to be a joke about itself.

Icons carry **state**, which is most of their job: dark outline when unaffordable, filled and
palette-coloured when owned, and a one-frame flash on purchase. That is three renderings of
one 16×16 grid and no new assets.

#### 11.4.5 Buying one has to feel like something **[CANON]** - R35

§8's game juice is specified for poking and for the camera and for nothing else, so the single
most consequential act in §11 — spending money you will not get back — currently resolves as a
number changing colour.

| | |
|---|---|
| **Visual** | The node **snaps to its owned state** on a short overshoot spring (§10.5's curve, not a new one). A ring pulse leaves it along the connectors, and **the adjacent nodes it just unlocked resolve out of silhouette as the pulse reaches them** — so the reward for buying is watching the map grow |
| **Camera** | A ~2% board-scale kick, damped in 200 ms. Enough to be felt, small enough to survive being done forty times |
| **Audio** | A **two-part** cue: a short mechanical latch on the press, and a resolving tone on the unlock, ~120 ms apart. The gap is what makes it read as *cause and effect* rather than as one noise |
| **Haptics** | §8.3's medium impact on the latch. Nothing on the unlock — a double buzz is a phone malfunctioning |

**The pulse is the only element that scales with what was bought.** A cheap node pulses once
to its neighbour; a branch-terminal node pulses down every connector it just opened. The
player learns the size of a purchase from how far the light travels, which is a thing the
price tag cannot tell them.

#### 11.4.6 The tree is not available at the start **[CANON]** - R34

**§11's tree opens at $50 in Act I, and it should not exist yet.** Run 1 is §21's trap — a
tight eleven-minute argument with one lesson in it — and a shop full of entropy suppression is
the *answer* to that lesson handed over before the question has been asked. A player who buys
Voice Shouting in Act II has been sold the moral of the story for fifty dollars.

**Nodes are gated by ring, and rings are gated by prestige:**

| Ring | Contents | Opened by |
|---|---|---|
| **0** | Instant Messenger, alone | **§21's story.** James brings it. It is not bought and it has no price |
| **1** | The first node of each of the four branches | The **first Paradigm Shift** |
| **2** | The second of each | Two shifts, or the first Codebase Fork, whichever the player reaches |
| **3+** | The rest | One ring per shift thereafter, and §13.5's gate opens the last |

**And costs scale with prestige as well as with ring**, so a tree does not become trivial two
shifts after it opened:

$$\text{Cost} = \text{BaseCost} \cdot \text{Mult}^{N} \cdot \Phi^{\,s}$$

where `s` is shifts taken and `Φ` is a little above 1. §11.0's curve is untouched inside a
run; this is what stops Run 6 buying the whole board in its first minute with Run 5's economy.

> **What this must not become: a tree the player cannot afford to finish.** The ring gate is
> about *when a decision is interesting*, not about slowing anyone down. Every ring that is
> open must be completable within the run that opened it, or §11 has been turned into a second
> prestige currency wearing a dollar sign.

### 11.5 Instant Messenger is the first node **[CANON - added 2026-08-11]** - R32

§21.6's scene is the best thing in the script — James introduces asynchronous text messaging,
with total sincerity, *to the person sitting next to him* — and the upgrade it introduces
does not exist. §11.2's first purchase is **Voice Shouting**, which is the thing Instant
Messenger replaces.

**So B1 stops being a purchase and becomes the starting condition.** Voice Shouting is what
the studio is doing before it owns anything: it is stated on the empty board, in the centre
slot, greyed, as the thing about to be replaced. Nobody buys it; everybody starts with it.

> **Amended 2026-08-13 — §21.0c.** The node is granted at the **first Paradigm Shift**, not in
> Act I. The board it sits at the centre of does not open during Run 1, so giving it away there
> was handing over the middle of a tree behind a locked door. Everything else in this section
> holds: it is free, it is given rather than sold, it is the only node in the game with no
> price, and Voice Shouting is still what the studio does before it owns anything.

| | |
|---|---|
| **The node** | **Instant Messenger** — Tier 1 Communication Infrastructure, §11.2's B1 slot, at the centre of §11.4's board |
| **Cost** | **None.** It is given, by James, in the scene. It is the only free node in the game |
| **Effect** | §11.2's B1 effect, kept — communication load −5% — because the joke needs the first real tool to be *almost useless*, and because §21.0's measured entropy table was calibrated with it absent |
| **When** | The end of §21.7's first James scene |

**The tree opens on the purchase, and the scene and the node use the same visual.** This is
the requirement that makes the beat land rather than just occur: the notification that appears
over the player's desk in §21.6 — the one that says `hey` while he sits two feet away — is
drawn from **the same icon and the same pulse** as §11.4.4's Instant Messenger node and
§11.4.5's purchase effect. The player sees the joke, the board opens, and the thing at the
centre of it is the picture they were just laughing at. **Recognition is the tutorial**: no
line of copy has to explain that a scene and an upgrade are connected, because they are
visibly the same object.

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

### 13.6 Hero Cards — the command layer **[CANON — added 2026-08-08]**

§14.4 models hero classes as a **spawn probability**: play long enough, roll well, and a 10x
Engineer appears somewhere in the swarm and multiplies something. That is a stat, and it has
two problems. It is invisible — at ten thousand developers nobody can see which one is
special — and it is passive: the player never makes a decision about it.

**Hero Cards replace that with a placement decision.** §14.4's curves survive as the rules
governing *how you acquire* cards; everything about how they are used is below.

#### 13.6.1 The core idea

A Hero is a **card you slot onto a rung of the §7.7 Construction Ladder.**

```
       CARD                    SLOTTED ONTO              AFFECTS
  +---------------+
  |  SCRUM MASTER |   ----->   one ROW                   the ~8 devs in that row
  |  * . . . .    |
  |  -12% entropy |
  +---------------+
  +---------------+
  |  FLOOR MASTER |   ----->   one FLOOR                 every dev on that floor
  |  * * * . .    |
  +---------------+
```

The ladder is already the game's spine — row, floor, building, campus, town, nation, planet,
galaxy — and it is already what the camera navigates. Hero Cards make it **the progression
board as well as the view**. Zooming out to see your studio and zooming out to manage it
become the same action, which is the strongest thing this design does: *the Omni-Lens
acquires a reason to exist beyond spectacle.*

#### 13.6.2 The rule that makes it a system

**A card is only effective at the tier it has been upgraded to reach.**

You may slot any card onto any rung from the moment you own it. What you cannot do is have
it *work* up there. A Scrum Master dropped onto a Building does not scale up to cover the
building; it covers **one row of it**, and the rest of the building is told, plainly, that
it is not covered:

```
  BUILDING  ·  4,000 DEVS
  +--------------------------------------+
  |  SCRUM MASTER            REACH: ROW  |
  |  covering 8 of 4,000 (0.2%)          |
  |                                      |
  |  ! Upgrade REACH to FLOOR to cover   |
  |    this building.   -- 4 GP --       |
  +--------------------------------------+
```

This is the whole economy of the system. It creates the mid-game question the game currently
lacks: **do I broaden one hero or acquire another?** A wide-reach Scrum Master covering a
whole campus at a small percentage, or three narrow specialists covering three floors deeply.
Both are correct at different times, which is the definition of a decision worth making.

**It also solves the idle-genre scaling problem honestly.** A flat multiplier is worthless
two prestiges later; a *reach* upgrade is worth exactly as much as the studio you point it
at. Heroes never obsolete, and they never trivialise, because reach costs more the further
up the ladder it goes (§13.6.5).

#### 13.6.3 The cards

Each card has a **home rung** — the tier it is thematically about, where it is cheapest to
be effective and where its unique effect is strongest.

| Card | Home rung | Effect | The joke |
|---|---|---|---|
| **Scrum Master** | Row | −entropy within reach; a daily stand-up pulses output | Fixes communication overhead by adding a meeting |
| **Floor Master** | Floor | +Story Point yield within reach; immune to the §7.8.6 drive-by | Middle management, rendered as a buff |
| **Tech Lead** | Floor | Poking anyone in reach also pokes their neighbours | Does not write code any more, but knows who to ask |
| **Architect** | Building | Raises §4.2's developer soft cap within reach | Draws the diagram nobody implements |
| **VP of Engineering** | Campus | Multiplies *other heroes'* effects in reach; alone, does nothing | Has no output of their own, by design |
| **CTO** | Town | Converts a percentage of entropy into cash | Monetises the dysfunction |
| **Chief Vision Officer** | Nation | Doubles yield, doubles entropy | Not obviously good |
| **The Compiler** | Planet | Ignores reach; effect is global and small | The only thing at this scale that still works |
| **James** | Any | Effect is small at every rung and never scales | §21.6 — he is the constant, and that is the point |

**James is a Hero Card and he is deliberately a bad one.** He is the first card the player
ever gets, he can be slotted anywhere, and he never becomes strong. Players will keep him
placed anyway. That is the joke, and it is also §2's thesis: the game is about the people you
carry with you.

#### 13.6.4 Upgrade trees

Every card carries its own small tree — four to six nodes, never a wall — with exactly three
kinds of node:

| Node kind | What it does | Constraint |
|---|---|---|
| **REACH** | Moves the card one rung up the ladder | The spine. Always the most expensive node available |
| **DEPTH** | Strengthens the effect at the current reach | Cheap, repeatable, diminishing |
| **TRAIT** | One-off rule change unique to the card | At most two per card, and they are the personality |

**Reach and depth trade against each other on purpose.** Depth bought at a low reach is not
refunded when reach increases — a hero broadened is a hero diluted, and the player who rushed
reach on a card they had already deepened will feel it. This is the one place the game is
allowed to punish a plan, because it is a plan the player made with full information.

#### 13.6.5 Costs

Cards are acquired with **GP** (§13.3, Layer 2) — they are a permanent, cross-run identity,
which is what makes placing them feel like building a company rather than shopping.

Node costs follow §14.5's Git Branch Tree curve, with reach scaled by the ladder gap it
crosses — reusing §7.7.3's ratio rule, so one constant governs both what a jump *looks* like
and what it *costs*:

$$\text{Cost}_{\text{reach}}(r \rightarrow r{+}1) = C_0 \cdot \gamma^{\,r} \cdot \log_{10}\!\left(\frac{\text{unit}_{r+1}}{\text{unit}_r}\right)$$

Depth nodes are flat-scaled per card; trait nodes are fixed and expensive.

#### 13.6.5a The story roster is not bought **[CANON - added 2026-08-15]** - R54

**§13.6.5's "cards are acquired with GP" was written before §22.8 existed**, when the roster was
nine job titles and the only way to get one was to pay. §22.8 replaced that roster with six
people and §21.7.3 gave each of them a door to walk through — so the six are *already* not
bought, in two sections that never went back and said so here.

Saying so here is not tidying. It is the removal of a wall that ran directly across the middle
of §26.1:

> GP is §13.3, Layer 2. Layer 2 costs 100,000 BP and does not exist. So while §13.6.5 was read
> as covering every card, **no reachable state in the game could own a hero** — which is
> §13.6.7a's build note, and which is why the 2026-08-13 session correctly declined to build
> `HeroBoard` and `RosterStrip` onto a board with nothing placeable on it.

| What | Currency | When |
|---|---|---|
| **The six story heroes** | **None.** They arrive | §21.7.3, across Run 2 |
| Their DEPTH and REACH nodes | **Levels** (§13.13), earned in-run from covered work | Continuously |
| Their TRAIT nodes | **GP** — unchanged. §13.10 already said personality is not something you grind | Layer 2 |
| §22.5's collection long tail | **GP** — unchanged, and this is what §13.6.5's sentence is now about | Layer 2 |

**Nothing about §13.6.5's mathematics changes**; what changes is which cards it is quoting a
price for. And the split is the better design on its own merits: the people the story gave you
are free and permanent, the people you collect are bought, and **the difference between a
colleague and a collectable is that you did not choose the colleague.**

#### 13.6.6 The interface

**The card board is the world.** There is no separate management screen — §10.6 forbids one,
and building one would waste the Omni-Lens.

- **Zoom to a rung, and its slots become visible** as skewed frames (§10.8a) anchored to the
  thing they govern: over a row, over a floor's edge, over a building's face.
- **Drag a card from the tray onto a slot.** The tray is a §10.5 bottom sheet, summoned and
  dismissed, never permanent furniture.
- **A slotted card renders in the world** — a small marker at the rung, drawn at the scale of
  that rung, so a campus with four heroes on it *looks* commanded. This is the only new sprite
  class the system needs, and it is one icon per card (§22.7 must absorb nine, or they are
  procedural per ART_DIRECTION §4 T0).
- **Coverage is drawn, not stated.** Selecting a card tints exactly the developers it reaches.
  A Scrum Master on a building lights up eight desks in a tower of four thousand, and the
  player understands the reach rule without reading a word of it.

#### 13.6.9 Items - equipment, bought with cash **[CANON - added 2026-08-08]** - R18

Cards are bought with **GP** and are permanent identity (13.6.5). **Items are bought with
cash and are equipment.** That split is the whole reason to have both:

| | Currency | Lifetime | What it means |
|---|---|---|---|
| **Card** | GP | Across runs | *Who* is in your company |
| **Item** | Cash `$` | This run | *What you gave them to work with* |

An item is **equipped to a hero** and it modifies what that hero does. It therefore inherits
the hero's **reach** (13.6.2) for free, which is the mechanic that makes items interesting
rather than a shopping list: **the same item is worth a hundred times more on a card that
covers a campus than on one that covers a row.** Broadening a hero broadens their equipment
with them, and that is a second reason to pay for reach.

**What items may modify:**

- **Story-point generation** of everyone the hero reaches - the common case.
- **How that hero scales with headcount** - some items are worth more the more developers are
  under them, some are worth less, and the choice of which is the design.
- **Entropy**, up or down. The interesting items do both.
- **4.5a's poke buff** - its size, its decay, or its blast radius.

##### The launch roster

Deliberately mundane objects, because the joke only works if the equipment is the equipment a
real studio actually buys. Numbers are first guesses; the *shape* of each is the spec.

| Item | Cost | Effect | The joke |
|---|---|---|---|
| **The Whip** | Cheap | Large output boost within reach, large Entropy increase | It works. That is the uncomfortable part |
| **Second Monitor** | Cheap | Flat output boost, no downside | The one purchase in the game nobody will argue about |
| **Mechanical Keyboard** | Cheap | Boosts its holder, **reduces the output of everyone adjacent** | Correct, and the player will buy it anyway |
| **Noise-Cancelling Headphones** | Mid | Immune to 7.8.6's drive-by interruptions and to the neighbour above | Solves the problem the last item caused, for money |
| **Standing Desk** | Mid | Small permanent boost that does not decay | Bought once, mentioned for years |
| **Energy Drink Fridge** | Mid | Sharp output spike, then a crash below baseline | Net positive only if you ship before the crash |
| **Ping-Pong Table** | Expensive | Reduces Entropy meaningfully, reduces raw output | Culture is real and it costs velocity |
| **The Gantt Chart** | Expensive | Changes **nothing** about production. Makes the 10.4 burn-down *project* a better date | It only lies to the person reading it, and 21's advisor will recommend it |
| **Company Hoodie** | Cheap | No mechanical effect whatsoever | Players will equip it. That is the finding, not the bug |

**The Gantt Chart is the one to be careful with.** A game must not lie to its player about
their own state - so it lies about a **forecast**, which is a thing that is allowed to be
wrong, and 10.4's actual burn-down line stays true underneath. If that distinction ever blurs,
cut the item.

##### The rules, which are 13.6.7's rules

- **Bought, never dropped.** A price, never a roll. MONETISATION's no-loot-box position covers
  equipment exactly as it covers cards.
- **Never mandatory.** A run must be completable with nothing equipped.
- **Not an inventory screen.** An item is equipped where the hero is, on the world (13.6.6),
  and it **renders on the desk** it applies to - a second monitor is a second monitor, on a
  desk, at 7.8.1's scale. If the player has to open a grid to find out what they own, the
  design has been thrown away.
- **Cash is the constraint that makes it a decision.** Cash is also payroll (4.10a) and also
  hiring, so an item is always bought instead of something else. That is the tension; do not
  relieve it with a separate item currency.

#### 13.6.7 What it must never be

- **A second inventory screen.** If the player is managing heroes on a grid instead of in the
  world, the entire reason for this design has been thrown away.
- **A gacha.** Cards come from GP spent deliberately, never from a roll. MONETISATION's
  no-loot-box position is not negotiable, and this is the most tempting place in the game to
  break it.
- **Numerically mandatory.** A player who never slots a card must still be able to finish a
  run. Heroes are amplitude, not gate.
- **Auto-placed.** An "optimise" button deletes the only decision the system contains.

#### 13.6.7a Build state **[added 2026-08-08]**

> **Amended 2026-08-15 — §13.6.5a: the six story heroes are not bought.** The paragraph below
> correctly reports that no reachable state could own a card, and correctly declines to build a
> tray onto an empty board. **That is no longer true of the story roster**, which arrives free in
> §21.7.3's scenes and whose nodes are paid for with §13.13's levels rather than GP. The three
> decisions recorded below — γ, depth priced as a share of reach, and per-level dilution — are
> unaffected and still stand. GP, and this note, now govern §22.5's collection long tail only.

**`sim/heroes.ts` is the rules and the data; nothing is wired to the store, and that is
deliberate rather than unfinished.** Cards are bought with GP (§13.3), GP needs Layer 2, and
Layer 2 needs 100,000 BP — so no reachable state in the game today can own a card. §13.6.6's
interface additionally needs the rungs above 3. Shipping a tray the player can open onto a
board with no rungs is the same mistake as a Paradigm node that takes currency and changes
nothing (§13.2).

Three things §13.6 left open, decided in the build and recorded here so they are not decided
twice:

| | |
|---|---|
| **γ in §13.6.5** | The log term **is not monotonic on its own** — row → floor crosses 2.1 decades and floor → building crosses 1, so a naive reading prices the second rung *below* the first. γ has to beat a decade of gap unaided. At 2.4 it does; at 1.9 it does not |
| **Depth is priced as a share of the reach node**, not on a curve of its own | §13.6.4 says REACH is "always the most expensive node available". On two independent curves that is a *hope*: depth compounds at κ and overtakes reach somewhere mid-ladder, exactly where nobody would look. Tying them makes the sentence an invariant |
| **Dilution is per depth level, stamped with the reach it was bought at** | §13.6.4's "depth bought at a low reach is not refunded when reach increases" is unimplementable against a level *count*, because nothing remembers when the level was bought. A level bought three rungs ago is worth δ³ of one bought now: not refunded, not deleted — **thinner**, which is what broadening a hero means |

**James is exempt from all three**, and from the §13.6.8 global multiplier. Every mechanism
that would make him scale has to skip him, or the joke stops being true.

#### 13.6.8 Relationship to §14.4

§14.4's spawn curves are **retained and repurposed**: $P_{class}$ now governs the rate at
which *card fragments* drop during a run, and $M_{hero}$'s GP-scaling term becomes the global
multiplier applied to every card's depth. The equations survive; what they multiply changes.
No maths in §14 is invalidated by this section.

### 13.7 A class per role, and the five trees **[CANON - added 2026-08-10]** - R24, R20

§13.6's cards are all the same *kind* of thing — they cover an area and multiply what is in
it. Once §4.11 gives the floor four functions, that is no longer enough: **a hero who is
brilliant at QA and a hero who is brilliant at shipping are not the same card with a different
number**, and a system that models them as one has thrown away the only thing roles were for.

**Every hero belongs to a class, and the class is a role.** Four of them, plus you:

| Class | Multiplies | Its tree is about |
|---|---|---|
| **Engineering** | §4.1 velocity of the developers it covers | Throughput, and what throughput costs — most nodes here make §4.12's defect rate worse |
| **Quality** | §4.12's defect suppression | Finding things earlier. Nodes trade coverage breadth against catch rate |
| **Support** | §4.13's ticket capacity | Deflection — closing tickets that were never raised. The only tree that acts on the *catalogue* rather than on the current project |
| **Reliability** | §4.12's incident clearance | Time-to-recover, and the standing cost of being ready. Nodes are cheap to buy and expensive to hold |
| **Management** — **you** | see §13.7.1 | Breadth. Every node is a weaker version of somebody else's |

**A class only multiplies its own role.** An Engineering hero placed over a row of QA does
nothing, and that is the constraint that makes §13.8's placement a decision rather than a
tidying exercise. It is the same rule §13.6.2 already applies to reach, moved onto a second
axis: a hero has a *where* and a *what*, and both have to be right.

**Each tree is §13.6.4's three node kinds, unchanged.** REACH, DEPTH, TRAIT — one grammar, five
vocabularies. Five separate node systems would be five things to balance and five things to
learn, and the existing one already does the job.

> **Amended 2026-08-11 — §13.9 collapses the five trees into one board.** The paragraph above
> argues against five *node systems* and then specifies five *trees*, which is the same cost
> paid a different way. §13.9 keeps every word of this section that matters — the classes, the
> "a class only multiplies its own role" constraint, and the one grammar — and makes the five
> vocabularies **five branches of a single centre-out board** rather than five screens.
> **Cloud is added as a sixth area and Melany's branch** (§13.9.2); Engineering moves to the
> trunk, because it is the thing everybody did before they specialised. §13.7.1's Management
> tree is untouched and stays the founder's own — it is a diluted copy of the branches, which
> is easier to state now that they are branches.

#### 13.7.1 You are the fifth tree, and you are worse at everything **[CANON]** - R20

§4.5d gave the founder a desk and a coding curve. **This makes it a class**, and the shape of
it is the joke:

> **The Management tree contains a diluted copy of every other tree's spine, and nothing of
> its own.** You can do a bit of engineering, a bit of QA, a bit of support, a bit of ops.
> Each node is meaningfully weaker than the specialist equivalent, costs more, and is
> available earlier.

That is the whole design, and it is the game's thesis (§6) written as a skill tree rather than
as a curve. The manager is the only person in the company who can do everything, which is
precisely why they are the worst person to do any of it — and the player will discover this by
buying the nodes and watching them underperform, not by being told.

Two rules keep it from eating the game:

- **§4.5d's promise holds: your own output never dilutes.** The Management tree is the one
  curve in the game §4.1's Entropy does not tax. It stays small and it stays *reliable*, which
  at cosmic scale is worth more than it looks.
- **It must never beat hiring.** §4.5d already states the failure condition — "if the optimal
  play is to fire everyone and code alone, the satire has eaten the game" — and the breadth
  penalty is the mechanism that enforces it.

### 13.8 Placing heroes — management *is* the minigame **[CANON - added 2026-08-10]** - R25

**§13.6.6's tray puts cards in slots. This makes the floor the slots.**

The player has more heroes than places worth putting them, roles that only some heroes help,
and rows that only sometimes need helping — so placement is a standing puzzle that is
re-answered every time the studio changes shape. **That is the management game**, and it is
the first thing in the design where the player's job is arranging people rather than tapping
them.

The rules, and each one exists to stop a specific way this collapses into a menu:

1. **A hero occupies a physical place**, dropped onto the floor with §7.8.9's existing carry
   gesture. Not a list — the whole point is that you can see the shape of your coverage
   without opening anything.
2. **Coverage is drawn, not stated.** §13.6.6 already requires this and it becomes
   load-bearing here: a footprint on the floor, in the class's colour, that visibly does or
   does not contain the rows you care about.
3. **Overlap is waste, and it is waste you can see.** Two heroes of the same class covering
   the same rows do not stack — §13.6.4's dilution rule applied spatially. This is what makes
   the puzzle a *packing* problem rather than a stacking one.
4. **Moving a hero costs time, not money.** A relocation has a settling period during which
   the hero covers nothing. Free instant reassignment would make the optimal play a
   micro-management treadmill, which §13.6.7 already forbids in another form.
5. **The studio keeps changing under it.** Every hire adds rows (§7.8.1b), and every §7.7
   rung change reshapes the floor entirely — so a placement that was correct an hour ago is
   quietly wrong now. **The puzzle is never solved, only re-solved**, which is what makes it a
   loop rather than a task.

> **What this must never become: a placement the player is required to keep optimal to
> progress.** §13.6.7's "never a second job" applies with full force. A good placement should
> be worth having and a stale one should cost a percentage — never a wall.


### 13.9 One tree, five branches, and every hero shares it **[CANON - added 2026-08-11]** - R36, R37

§13.7 gives each class its own tree — *"one grammar, five vocabularies"* — and building the
rest of this batch made the cost of that obvious. **Five trees is five things to balance, five
things to learn, and five screens**, and the player's actual question is never "what does the
Quality tree look like"; it is *"what do I want Mo to be good at."*

**So there is one tree. Every hero opens the same board, and what differs is where they
already are on it.**

```
                          [ QUALITY ]
                               |
                          o--o--o
                               |
      [ COHESION ]---o--o--o---+---o--o--o---[ RELIABILITY ]
                               |
                          [ ENGINEERING ]
                          the trunk, at the centre
                               |
                          o--o--o
                        /             \
             [ SUPPORT ]               [ CLOUD ]
```

| | Branch | Bends | Its hero |
|---|---|---|---|
| **centre** | **Engineering** | §4.1 velocity. What everybody does, before they specialised | **James** — §22.8's jack of all trades, and the only hero who starts *at* the centre |
| N | **Quality** | §4.12's defect arrival rate | **Mo** |
| E | **Reliability** | §4.12a's incident arrival rate | **Serena** |
| S-E | **Cloud** | §4.2's developer cap — and the bill | **Melany** |
| S-W | **Support** | §4.13's ticket capacity, and §4.12a's incident *clearance* | **Matt** |
| W | **Cohesion** | §4.1's Entropy directly | **Billy** |

**§13.6.4's three node kinds are unchanged and now genuinely shared**: REACH moves a hero up
§7.7's ladder, DEPTH strengthens what they do at the reach they have, TRAIT is a one-off rule
change. What a DEPTH node *means* is read off the branch it sits in, which is what makes one
board carry five vocabularies without five implementations.

#### 13.9.1 A story hire arrives already good at their job **[CANON]**

**Every hero the story gives you arrives with nodes pre-bought in their own branch, and
nothing else.** Mo shows up three nodes deep into Quality. Serena shows up three nodes deep
into Reliability. Neither has spent a point at the centre, and neither has touched anybody
else's branch.

That does three things, and the third is the one worth building it for:

1. **It states the character mechanically before a line of dialogue does.** You know what Mo is
   for by looking at the board she came with.
2. **It teaches the tree by example.** A player's first sight of the board is a shape somebody
   already made, which is a far better tutorial than an empty grid and a legend.
3. **It is the beginning of an argument, not the end of one.** §13.9's whole point is that
   **it is up to the player to upgrade them as they see fit.** Nothing stops Mo going down
   Cloud. She will be worse at it than Melany — the branch is not hers and the centre-out
   distance is longer — and a player who does it anyway has made a real decision about a
   specific person. **A hero is a starting position, not a role.**

> **What this must never become: a correct build per hero.** If there is one right way to
> spend Mo's points, §13.9 has produced five trees again with extra steps. The branches trade
> against systems that pull in different directions at different times — defects matter while
> you are building, incidents matter once you have shipped — so the answer changes with the
> studio, which is §13.8's standing requirement restated for the tree.

#### 13.9.2 Melany and the Cloud branch **[CANON - added 2026-08-11]**

Cloud is the branch §13.7 did not have, and it exists because **§4.2's developer cap is the
only defence against §4.1 and only one system in the game touches it.** §11's protocol tree
raises the cap by *reducing what communication costs*. Cloud raises it by **paying for
capacity you did not have to organise** — which is a genuinely different move and the funnier
one:

| | |
|---|---|
| **Effect** | Raises §4.2's cap within reach, and hires take effect **immediately** — no ramp, no onboarding |
| **The cost** | A **standing bill that scales superlinearly with headcount**, drawn from cash every second, forever. It is not an event. Nobody reads it |
| **The joke** | Infinite elasticity, invoiced monthly. The only branch in the game whose upgrades make a line item worse |
| **The trade** | Cloud is the fastest way to survive §6's trap and the fastest way to go bankrupt in §4.10d's payroll model. Both, at once, from the same purchase |

Melany's TRAIT nodes are the reserved-instance joke: commit to a headcount in advance for a
discount, and pay through the nose the moment you exceed it.

### 13.10 Heroes earn XP where you put them **[CANON - added 2026-08-11]** - R39

> **Amended 2026-08-15 — §13.13 puts a level between the XP and the node.** Everything in this
> section about *how XP is earned* is unchanged and load-bearing: coverage, the ξ rate, an
> unplaced hero earning nothing, and REACH paying twice. What changes is the last step —
> **XP no longer buys nodes directly**; it reaches levels, and a level grants one point. The
> `Curve` row below is superseded by §13.13's, and `heroXp` in the save keeps its meaning.

§4.5d gave the founder a curve that grows because *you* got better. **Heroes need the same
thing and had nothing** — §13.6.5 buys their nodes with GP, which is prestige currency, which
means a hero could only ever improve between runs and never during one.

**A placed hero earns XP from the work done under their coverage.**

$$\frac{dX_h}{dt} = \xi \cdot V_{\text{covered}(h)}$$

`V` is §4.1's velocity, restricted to the developers §13.6.2's coverage rule says the hero
actually reaches. Everything about that is deliberate:

- **An unplaced hero earns nothing.** A card in the tray is a person on the bench. This is the
  second reason §13.8's placement matters and it is a compounding one: the hero you use is the
  hero who gets better, so a board left alone falls behind a board that is tended.
- **XP scales with coverage, so REACH pays twice.** Broadening a hero widens what they affect
  *and* what they learn from, which is the first thing in §13.6.4 that makes the reach/depth
  trade lean rather than balance — and it leans toward the expensive node, which is where
  §13.6.4 wanted it.
- **A hero placed over a quiet corner of the studio learns slowly**, and the player can see
  exactly why by looking at the floor.

| | |
|---|---|
| **What XP buys** | Nodes on §13.9's board. **XP is the in-run currency of the hero tree**, standing in the same relation to GP that cash does to BP |
| **What GP still buys** | The card itself (§13.6.5), and TRAIT nodes, which stay expensive and stay prestige-priced. Personality is not something you grind |
| **Lifetime** | **Permanent, per hero**, alongside `founderLevels` in the save's `meta` block — so it survives a Paradigm Shift *and* a Codebase Fork. A hero you have carried through nine runs is better than one you just met, which is §22.3's entire emotional design applied to the mechanical layer |
| **Curve** | Node `n` costs $X_0 \kappa^n$ on §14.5's shape. Rate `ξ` is set so a hero at a rung they cover completely gains about one node per project shipped, early |

> **XP must not make an unplaced hero worthless.** §13.6.7's "amplitude, not gate" applies:
> the gap between a tended hero and a benched one is a percentage that grows, never a
> threshold that locks. A player who ignores this system entirely still finishes runs.

### 13.11 Showing where everybody is **[CANON - added 2026-08-11]** - R40

§13.8 makes placement the management game and §13.6.6 forbids a management screen. **Both are
right and together they specify nothing**, so this is the missing half: what the player
actually looks at.

Three views, and each answers a different question the player is really asking.

#### 13.11.1 On the world — *"who covers this?"*

The default, and the one §13.6.6 already requires. At any rung, a hero placed on it renders as
a **badge on the unit's face** — a block of 100, a floor of 10,000, a building — drawn at that
rung's scale, in their branch's colour.

- **The footprint is drawn, not stated.** Selecting a hero tints exactly the developers they
  reach, in the branch colour, and everything they do not reach goes flat grey. §13.6.2's rule
  is learned by looking, not by reading `covering 8 of 4,000`.
- **Overlap is visibly wasted.** §13.8's rule 3 — two heroes of one class over the same rows
  do not stack — is rendered as **cross-hatching** where the footprints intersect. The player
  is never told they have made a mistake; they can just see the hatched area and move
  somebody.
- **A settling hero is drawn faded**, with a countdown ring, for §13.8's rule 4 relocation
  period. Coverage costs time, so time is on screen.

#### 13.11.2 The roster strip — *"who is idle?"*

A **single row of small cards** along the bottom edge of the world when the tray is summoned —
§10.5's bottom sheet, dismissed when you are done, never permanent furniture. Each card shows
portrait, branch colour, current reach, and **one line: where they are, or `BENCHED`.**

`BENCHED` is the only word on this strip that is allowed to be red, because §13.10 makes it
the one that is actively costing the player something.

#### 13.11.3 The org chart — *"what does my company look like?"*

§22.2's board, kept, and it is the **only** screen in this system — earned because it answers a
question the world cannot: reporting structure is a relationship between heroes, not a place
on a floor. It is where §22.2's direct-report bonus is arranged and where a promotion is
witnessed.

**It is never where placement happens.** Dragging a card on the org chart changes who reports
to whom; dragging a card on the world changes who covers what. Two boards, two verbs, and
§13.6.7's "if the player is managing heroes on a grid instead of in the world, the entire
reason for this design has been thrown away" survives because the grid cannot do the thing the
world does.

### 13.12 How long a run takes **[CANON - added 2026-08-15]** - R75

**§13 specifies three prestige layers and never once says how long one turn of any of them
should take.** Every number in §14 is a ratio, and a ratio can produce a run of four minutes or
four days without breaking a single equation — so the curves have been balanced against nothing,
and §21's four-minute prologue quietly became the only measured run length in the document.

The genre's rule is well known and this game does not get to be an exception to it:

> **The first run is slow and manual; every subsequent run is fast and automated, until the
> player reaches a content boundary that makes it slow again.**

#### 13.12.1 The target **[CANON]**

| Phase | Wall-clock per run | Active time per run | What the player is doing |
|---|---|---|---|
| **The first steered run** | **1–3 hours** | 45–90 min | Discovering the systems; hitting the first real wall; learning why a prestige is worth taking |
| **The early loop** — the next four | **15–45 min** | 5–15 min | Feeling the acceleration. Automation and quality-of-life unlock here |
| **Mid-game** — the following fifteen | **2–8 hours** | 10–20 min | Attention moves off the thumb and onto the build: which branch, which heroes, which tree |
| **Late game**, before the next layer | **24–72 hours** | 5–15 min **per day** | Deep passive production against milestone targets |

Two things are worth reading off that table, because they are what it is *for*:

**Run duration goes up and active time goes down.** Those are not in tension; they are the
whole design. A run gets longer in wall-clock because the targets get bigger, and shorter in
attention because §11 and §13 have automated what used to be manual. A player who is spending
*more* minutes per run at run fifteen than at run three has been given content rather than
progress, and the curves are wrong.

**The early loop is the shortest thing in the game and it is the most important.** Runs two
through five are where a player decides whether the prestige loop is a loop or a punishment,
and the only evidence they will accept is watching an hour of work redo itself in ten minutes.

#### 13.12.2 The prologue is not a run **[CANON]**

§21's Acts I–V take about four minutes and end in a **bankruptcy the player cannot avoid**,
which by definition makes them not a run in the sense the table means: nothing was steered, and
the ending was written before the player arrived.

**So the table starts one turn later than its own row headings suggest**, and the mapping is
stated here rather than left to be inferred:

| §13.12.1's row | This game |
|---|---|
| *(no row)* | **Run 1** — §21's prologue. ~4 minutes, scripted, ends in the trap |
| **The first steered run** | **Run 2.** Every system and all five remaining heroes arrive here, paced across the hour §21.7.3's five triggers need to breathe |
| **The early loop** | Runs 3–6 |
| **Mid-game** | Runs 7–21 |
| **Late game** | Layer 2 (§13.3) onward |

This is also the answer to a question §21.0c raised and did not settle: **what all those gated
systems open into.** Five arrival scenes and a tech tree landing in a four-minute run would be
a pile; landing across ninety minutes, each one triggered by a problem the player just felt,
is the arc §21.7 describes. **The gate and the pacing were always the same decision.**

> **Run 2's actual length has never been measured**, and asserting it here would be exactly the
> mistake §26.0 describes. Measuring it is Phase 1 work (§26.1.8 item 9), and if it comes in at
> twenty minutes the answer is to move a target, not to move this table.

### 13.13 Heroes level **[CANON - added 2026-08-15]** - R53

§13.10 gives a hero XP and spends it directly on nodes. **That works and it is missing the
thing that makes a person feel like they are getting better**, which is a number that goes up
and is theirs. XP is a currency; a currency is something you spend and then do not have. §4.5d
gave the founder levels for exactly this reason, and heroes were left with a wallet.

**So XP becomes levels, and a level is a point.**

$$\text{XP to reach level } n = X_0 \cdot \kappa^{\,n}$$

| | |
|---|---|
| **XP** | Accrues as §13.10 specifies — $\xi \cdot V_{\text{covered}}$, from the work done under this hero's coverage, and only while they are placed |
| **A level** | Is reached, announced, and never spent. It is the number on §22.9's card and it is permanent |
| **A point** | Every level grants exactly one, spendable on any node of §13.9's board |
| **Lifetime** | Permanent per hero, in the save's `meta` beside `founderLevels`. It survives a Paradigm Shift *and* a Codebase Fork |

**One level, one point, and no other source.** The alternative — levels as a display over an XP
wallet — was considered and lost on one argument: a player must be able to look at two heroes
and know which is further along, and two numbers that can disagree is not that. The level *is*
the progress; the point is what it lets you do about it.

**A level-up is a moment, not a notification.** §11.4.5's purchase cue is the reference: the
card flashes to its new state, the badge on the floor pulses in the branch colour, and the
board gains one spendable point that visibly waits to be spent. It does not open a screen, and
it does not stop the game — §13.10's warning that an unplaced hero must not become worthless
applies with more force now that the gap is legible.

> **What this must never become: a level gate.** No node, no placement and no rung may require
> a level. §13.6.7's "amplitude, not gate" is the standing rule and levels are the most tempting
> place in the design to break it, because every other game in the genre does. A level makes a
> hero better at what they already do. It never makes them *allowed*.

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

> **Any stem must be able to fade against any other at any moment**, with no beat-matching,
> no transition bar and no crossfade artefact.

##### 20.7.1a How that rule is actually met — the score is ambient **[CANON — revised 2026-08-08]**

The original wording was *"every stem is written in the same key, at the same tempo, in the
same bar length"* — `A minor, 84 BPM, 8-bar loops`. That is the right answer for **composed**
music and it is a promise no generator will keep: prompt an audio model for 84 BPM ten times
and you get ten tempos.

**The score is ambient instead, and ambient meets the same rule from the other side: two
drones layer cleanly because neither has a beat to be out of step with.** Pads, drones and
room tone, not loops with a pulse. The constraint in every prompt is therefore the *absence*
of rhythm — `no beat, no rhythm, no percussion, no melody, continuous even texture` — which
is a promise a generator can keep.

**A stem that arrives with a discernible beat is unusable however good it sounds**, because it
will phase against every other stem the moment the mix moves.

Two things fall out of this and both are gains:

- **It suits the game.** §21's opening is a room at night with a PC fan and a monitor. A beat
  under that is a different, busier game.
- **The stingers are exempt.** §20.7.2's two one-shots are never layered against anything, so
  they may have rhythm — and should, because landing on a beat is what makes a sting land.

##### 20.7.1b The correction — harmony does not phase **[CANON — added 2026-08-08]**

**20.7.1a banned melody as well as rhythm, and that was one ban too many.** Ten stems of pure
texture is not a score, it is **white noise with moods**, and the first person to listen to it
said exactly that. The rule was over-applied and the whole soundtrack paid for it.

The thing that phases is a **pulse**, not a **harmony**. Two loops with beats drift against
each other within seconds and no amount of prompting fixes it. Two loops in the same key sound
like the same piece however they overlap, because harmony has no clock to be wrong about. So
the rule splits in two, and only half of it survives:

| | |
|---|---|
| **No percussion, ever** | The half 20.7.1a got right. Non-negotiable for anything audible at the same time as anything else |
| **One key, and melody is allowed** | Which is what §20.7.1's original *"same key"* clause was asking for all along. 20.7.1a met it by removing the thing that needed a key |

**The register is *sovietwave*** — the warm melancholy of an analogue synth through a tape
machine. Slow pads, simple minor-key motifs, wistful rather than tense, cosy rather than cold.
It sits under a room at night better than a drone did, and it is a *score* rather than a
texture, which is the whole point of the correction.

**A minor**, because sovietwave is built on it and because a natural minor has no leading tone
to clash when two stems happen to overlap on different scale degrees.

The strain layers stay closer to texture — they are the thing mixed *over* whichever bed is
playing, and a second melody on top of the first is the one arrangement this does not solve.

##### 20.7.1c Melody is the essence of it - the two failed attempts **[CANON - added 2026-08-08]** - R1

20.7.1b allowed melody and the prompts duly asked for it. **`npm run music:check` then measured
seven of the ten stems as drones**, and the brief has not been met. The record of what did not
work is the useful part, because the next attempt must not repeat it:

| Attempt | Prompt said | Result |
|---|---|---|
| 1 (20.7.1a) | `no melody, continuous even texture` | Drones. Correctly - it was asked for |
| 2 (20.7.1b) | "a simple wistful melody on a soft lead" | 7/10 still drones |
| 3 | "arpeggio", "chord progression Am F C G", "a repeating four-note figure" | Untested at time of writing |

**Attempt 2's lesson, measured:** the single stem that passed was the only one whose prompt
contained the word **arpeggio**. This generator responds to a concrete musical noun and ignores
an adjective - "melodic", "wistful", "a lead line" are adjectives; "arpeggio", "Am F C G", "a
four-note figure" are things a musician could play. The suffix was also carrying four separate
instructions to hold still (`continuous`, `even texture`, `slow and unhurried`, `no beat`)
wrapped around one polite request for a tune, and a generator resolves that contradiction the
easy way every time.

**The brief, restated so it cannot be softened again:**

- **Upbeat.** Not ambient, not a bed, not a texture. The earlier brief's "cosy and unhurried"
  pulled every prompt toward stillness and has been overcorrecting the result since.
- **Retro sovietwave, minor key.** Warm analogue synth, tape saturation, the specific
  melancholy of that genre - but with momentum.
- **A melody, and a short one is fine.** Comparable games in this house carry a short melodic
  loop and it works. Length is not the constraint; the presence of a tune is.

**And it is now measurable, so it stops being an argument.** `npm run music:check` folds each
stem's spectrum into twelve pitch classes and reports how many notes sound and how often the
note changes. Fewer than four distinct notes, or fewer than eight changes, is a drone. **No
stem ships without passing it**, and no report may claim melody without running it - the second
attempt was reported as done on the strength of the prompt alone, which is how a whole
soundtrack shipped as hiss.

**If the free endpoint cannot do it, that is a finding, not a failure to work around.** 20.7.6a
already records that `/v1/music` needs a paid plan; if attempt 3 fails the measurement too,
the honest conclusion is that a **sound-effects** model cannot be made to compose, and the
paid endpoint becomes a blocking dependency rather than a nice-to-have.

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

##### 20.7.6b **Generated — on the free Sound Effects endpoint** [2026-08-08]

All ten stems exist. They were made by **`/v1/sound-generation`**, not `/v1/music`, which
§20.7.1a makes the correct choice rather than a concession: the API is free, it takes no key
or tempo parameters, and an ambient score does not need them. Beds and layers are **30
seconds** — the endpoint's ceiling, established by trying 45 and getting an error — and
longer means the loop is less obvious.

`public/music/music.manifest.json` is written on every run and records the endpoint, the
date and every prompt. **That file exists because of how this was diagnosed.** GeoDaily
reached the same endpoint by asking for Music, catching the 402 and falling back silently; a
year later the only way to establish what had made those files was to measure their duration
— 22.1 seconds, which is the fallback's length and not the 60 seconds the Music call asked
for. Provenance is cheaper to write down than to reconstruct.

##### 20.7.6a **The Music API needs a paid plan** [added 2026-08-08]

The generation script is finished, the endpoint is confirmed against ElevenLabs' reference,
and the prompts are written. Running it returns:

```
402 Payment Required
{"code":"paid_plan_required",
 "message":"Music API is not available for free users."}
```

The Sound Effects API — which produced the entire §20.5 bank already in the build — is
available on the free tier. **Music is not.**

**And the reason is the key in this repo, not the subscription.** Checked against
`/v1/user/subscription`, which is free to call:

| Where | Key | Account |
|---|---|---|
| `100m-devs/.env` | `sk_0e7…` | **`tier: free`** |
| `geodaily/.env` | `cfd6…` | *rejected* — "API key ID used as API key" |
| `dungeon-doom-dash/.env` | `cfd6…` | same |

Only one of the three is a key at all; real ElevenLabs keys begin with `sk_`. The other two
are the key's *identifier*, which the API refuses outright — so they cannot have generated
anything either. **There is no paid key anywhere in these projects.** The subscription is
real; the credential sitting next to the code is not connected to it.

`scripts/generate-music.ts` now checks the tier before spending a request and says all of
this by name. A bare `402 Payment Required` is true and useless: it says nothing about which
key, and the natural reading is "my subscription is broken" rather than "this repo has a
different key from the one I pay for".

**Nothing else is waiting on it.** The mix (`src/audio/music.ts`) is complete and tested:
zone beds, strain layers, stingers, the §20.7.4 override and the §10.9 title hand-off, all as
pure functions over camera Z and Entropy. The bus is wired into the frame loop, so the score
is *running* — every stem is at the gain the simulation asks for, and every stem is missing.

**A missing stem is exactly a stem at gain zero**, which is why that is not a stub: the day
the MP3s land, nothing in the code changes. The one thing that cannot be known until then is
whether the generated material actually holds §20.7.1's key-and-tempo rule, and a stem that
does not is unusable however good it sounds.

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

> **Measured while implementing this, and it did not fit — so the ladder moved.**
>
> The old project ladder climbed 1,000 → 2,500 → 8,000 SP. Simulated against the headcounts
> Act IIa actually passes through, that put Run 1 at **11.4 minutes and still only reached 36
> developers**, because each project grew faster than velocity did.
>
> **The fix was the ladder, not the target.** Of the three options — accept a longer run, end
> Act IIa lower, or resize the projects — only the third costs nothing conceptually. Ending
> lower would have given up the one thing Act IIa exists for: 40 is where the readout first
> says `CHATTY`, and §21.0's whole point is that the player gets one hint and waves it away.
>
> **Act I keeps its canonical 1,000 SP.** It is the teaching project, shipped almost entirely
> by thumb, and it is now the *only* large one. Everything after it is sized against the
> headcount the player has when they reach it:
>
> | Project | SP | Pays | Roughly |
> |---|---|---|---|
> | *Flappy Square 1.0* | 1,000 | $50 | 2.8 min, mostly poking |
> | *Flappy Square 2.0 (Now With Ads)* | 400 | $20 | 40 s |
> | *Untitled Roguelike Deckbuilder* | 1,000 | $50 | 50 s |
> | *Open-World Survival Craft (Early Access)* | 4,000 | $200 | 100 s |
>
> The names still escalate in ambition while the commitments do not, which is its own joke
> about scope.
>
> **Simulated result: 40 developers in 6.1 minutes**, having spent $238 of ~$320 earned,
> leaving roughly $82 to gamble on the Mass Hire.

**Pacing target: Run 1 is about 6 minutes.** Four minutes was the original figure and the
 arithmetic never supported it once Act IIa existed — the teaching project alone is nearly
three of those minutes. Act IIa is roughly half the run. If playtesting
shows players hiring past ~10 without being offered the bait, offer it sooner; the trap must
spring while the model still reads as reliable, never after the player has already noticed
the readout climbing on their own.

#### 21.0a The Seed Round — earning the right to expand **[CANON — added 2026-08-08]**

§21.0 fixed the pacing problem it named (1 → 2 → 1,000 was too fast) by inserting Act IIa's
honest loop. Playing it revealed a second, quieter one: **Act IIa is a four-minute stretch with
no events in it.** Ship, earn, hire, repeat, from two developers to forty, with nothing marking
the difference between the eighth hire and the twenty-eighth. It is correct and it is flat.

And the transition out of it was worse. At forty developers the ordinary HIRE control was
*replaced* by the mousetrap, which meant the game took the verb away and handed the player one
option. **A trap the player is manoeuvred into is not a trap, it is a corridor**, and §6's
lesson needs a decision that was genuinely theirs.

##### The beat

**At 10 developers, the studio takes seed funding.**

```
  STUDIO_OS
  > INCOMING: TERM SHEET

  "We love what you're building. We think you can build it FASTER."

  SEED ROUND CLOSED  --  $50,000
  HIRING CAPACITY UNLOCKED
```

Ten is chosen for the same kind of reason forty was: it is the first headcount at which the
player has hired **enough times to have a habit** and not yet enough to be bored of it. They
have shipped two projects and hired eight people, all with money they made. The round is a
reward for a loop they already understand.

Three things arrive with it, and each one is a *capability* rather than a number going up:

| | |
|---|---|
| **Cash** | A lump sum, roughly ten hires' worth. Enough to feel like a different game for a minute |
| **The hire dial** (§10.10) | The multiplier appears. §10.10.2 sets its unlock at 25 on the basis that a multiplier in Act I would break the funnel — **the seed round is the better trigger**, because it gives the unlock a reason instead of a threshold |
| **The story turn** | The studio stops being two people in a bedroom and becomes a company that owes somebody an outcome. Everything after this is spending someone else's money |

The last is the one that pays off in Act V. **The bankruptcy is not the player losing their
savings; it is the player losing an investor's.** That is a materially funnier and more
uncomfortable ending, and it costs one screen here.

##### The mousetrap becomes a pull

**Act III's offer no longer replaces the hire control. It appears above it.**

```
        ** LIMITED OFFER: MASS HIRING PACKAGE UNLOCKED! **
        +--------------------------------------------+
        |         HIRE 1,000 DEVS NOW                |     <- the bait
        |      Cost: YOUR ENTIRE TREASURY            |
        +--------------------------------------------+

           [ x1 ] [ x10 ] [ x100 ] [ MAX ]
           +----------------------------+
           |   HIRE DEVELOPER   x10     |                <- still there
           |         $412               |
           +----------------------------+
```

**Both are live, and the player may ignore the offer indefinitely.** They can keep playing the
Act IIa loop for as long as they like; hiring past the threshold by ordinary means is a
perfectly good way to reach Act IV, and it takes longer and costs more, which is the point.

The offer has to win on temptation alone:

- **It appears the moment the seed money makes it reachable**, not on a headcount. Being able
  to afford something is what makes wanting it feel like the player's own idea.
- **It is priced at the whole treasury** (§4.10a) — always ruinous, and visibly a worse deal
  per developer than the dial next to it. The player who does the arithmetic will notice. Most
  will not, and the advisor is counting on it.
- **The advisor copy does the work**, unchanged and now correctly placed: *"Math doesn't lie!
  If 2 devs make games 2× faster, 1,000 devs will make games 1,000× faster!"* — landing on a
  player with four projects' worth of personal evidence that it does not lie.
- **It nags, gently.** The §10.8a bait pulse, and a re-pitch every couple of projects. Never a
  countdown, never a modal, never a dismissal that hides it for good.

**The design test for this beat:** a player who takes the offer should feel that they chose it
and be embarrassed about that afterwards. A player who never takes it should still reach Act IV
eventually and get the same lesson delivered more slowly and more expensively — which is, if
anything, the more honest version.

##### Revised shape of Run 1

| Beat | Devs | The player is learning |
|---|---|---|
| **Act I** | 1 | Poking works |
| **Act II** | 1 → 2 | Cash buys a developer. James arrives |
| **Act IIa** | 2 → 10 | Ship, earn, hire. The loop, learned |
| **§21.0a — the Seed Round** | 10 | **Somebody else believes in this. Here is capacity** |
| **Act IIb** | 10 → ~40 | The loop again, faster, with the dial. The readout starts to twitch |
| **Act III** | ~40 | The offer *appears*. It does not take anything away |
| **Act IV–V** | ~1,040 | The collapse, on money that was not theirs |

#### 21.0b Act I is not a thousand points alone **[CANON — revised 2026-08-11]** - R41

**As built, Act I asks one person to burn 1,000 Story Points by thumb before anything happens,
and it is brutal.** The arithmetic says so plainly: the founder produces 0.5 SP/sec passively
(§4.5d), a poke is worth 1 SP at the base ladder tier (§4.6), and James — the thing that makes
it stop being lonely — is gated behind *shipping the project*, because he costs a dollar and
the player has none until Flappy Square pays out. **The first help in the game arrives after
the hardest part of the game is over.**

That inverts §21.0's own thesis. Act I exists so that "the clicker layer sells itself", and a
sale takes about ten seconds; the remaining several minutes are the game proving it can
outlast the player.

**So James arrives during Act I, free, at fifty pokes.**

| | Was | Now |
|---|---|---|
| **When** | After shipping *Flappy Square 1.0* alone | **At 50 pokes**, roughly 15 seconds in, mid-burn-down |
| **How** | `[ HIRE DEVELOPER ]`, $1, from a treasury holding $0 | **A scene.** He is not hired; he turns up. §21.7.1 |
| **Cost** | $1, and payroll from the third head | **Nothing, and nothing.** §4.10a's payroll already starts at the third developer, so the free hire costs the economy exactly zero and needs no exception |
| **Act I's commitment** | 1,000 SP | **1,000 SP, kept.** §21.0 is explicit that Act I keeps the canonical figure. It is not the number that was wrong — it is who was carrying it |

**Fifty is chosen the way forty was.** Twelve pokes is three seconds: long enough to prove a
tap does something, too short to have earned anything. Fifty is about fifteen seconds of
sustained 3–5 Hz poking — long enough that the player has felt the size of 1,000, and
**short enough that they have not yet decided the game is a grind.** The help arrives at the
first moment it would be a relief and before it would be a rescue.

> **The trap is unaffected, and this is the thing to check.** §6's lesson needs the player to
> believe hiring works, and James arriving free makes that belief *cheaper to acquire*, not
> weaker. Act IIa still buys every subsequent hire with earned cash, the price still climbs,
> and the collapse still costs them a treasury they built. What has been removed is the
> unpaid labour before the loop starts, which was teaching nothing the loop does not teach
> better.

#### 21.0c Run 1 carries one idea **[CANON - added 2026-08-13]**

> **Amended 2026-08-15 — §21.7.6 splits this gate in two.** Everything below holds for Run 1 and
> is unchanged: Run 1 carries one idea, and `paradigmShifts > 0` is still what opens §11's tree
> and §4.11's dial *at all*. What this section did not anticipate is **Run 2**, where all four
> gated systems would otherwise arrive at once. §21.7.6 holds each instrument back a second time,
> until the hero who solves it walks in — so the shift opens the door and a person carries each
> thing through it. The gate below is the floor; §21.7.6 is the ceiling.

**Every system in this document that is not hiring arrives after the first Paradigm Shift.**

§21.0 asks Run 1 to do one thing: let the player build the model *more developers, more speed*
out of evidence alone, so that when §6 breaks it they were the one holding it. That takes about
four minutes and it needs the whole four minutes. A second mechanic on screen during it is not
a bonus, it is a second thing to think about, and the player only has one model's worth of
attention to give.

What Run 1 has: a burn-down, a poke, a hire button, a price that climbs, a term sheet, a
mousetrap, and James. What Run 1 does not have:

| System | Section | Why it waits |
|---|---|---|
| QA, Support and SRE on the hire dial | §4.11 | The joke — that a studio stops being one kind of person — only lands on somebody who has been one kind of person for a while |
| Defects, incidents, tickets | §4.12, §4.12a, §4.13 | §4.15's three colours are one system told three ways, and a run that had defects but not incidents would teach two thirds of a distinction |
| Release rating and reputation | §4.14 | See below — Run 1 ships at the anchor by construction |
| The studio tech tree, and §11.5's node with it | §11, §11.5 | §15's ladder is a *prestige* ladder. An upgrade screen during Run 1 offers the player a way to make the trap survivable, which is the one thing Run 1 must not sell them |

**The gate is `paradigmShifts > 0`** — the counter §24.5 already reads for offline accrual and
§13.2 already reads for the Paradigm Tree. Not a flag of its own: a second flag is a second
thing that can be wrong after a save migration, and the answer to "has this player finished
Run 1" is already written down.

**Run 1 ships at §4.14.1's anchor by construction, not by accident.** This is the one place the
gate is doing arithmetic rather than hiding a widget. A studio with an empty defect bench scores
*better* than the anchor, so a Run 1 that ran the live rating would hand every release a quality
bonus and quietly re-tune the economy §21 is paced against. §25.6.2a measured *Flappy Square* at
$45 and that number has to stay measured, so Run 1 stamps the anchor and the baseline and every
multiplier is exactly x1.

**James is not gated, and the distinction matters.** He is the only thing in Act I that is not a
system: he is a person who sits down at the second desk. This section separates mechanics from
story, and he is the story. What *is* gated is the thing he used to arrive holding — §21.6 takes
Instant Messenger back, where it always was, and Act I's one beat is §21.7.1's arrival and
nothing else.

### ACT I: The Innocent Beginning

> **Revised 2026-08-11 — see §21.0b.** James arrives free at 50 pokes, part-way through this
> act rather than after it. The terminal banner, the bubble and the first-poke teaching moment
> below are unchanged; what follows the fiftieth poke is §21.7.1's scene.
>
> **Revised 2026-08-13 — see §21.0c.** And that scene is the whole of it. For one day Act I
> also carried §11.5's Instant Messenger, an upgrade door, a defect counter, a ticket bar and a
> four-way hire dial; all of them now wait for the first Paradigm Shift. Act I is one lever, one
> burn-down and one person turning up.

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

### 21.7 The story going forward — people arrive because you needed them **[CANON - added 2026-08-11]** - R42

§21 scripts Run 1 and §21.6 scripts one scene of Run 2. **After that the game has no story at
all** — it has systems, and the systems announce themselves with terminal banners. This section
is the arc that carries the rest of it, and it has exactly one rule:

> **A hero arrives the first time the player feels the problem that hero solves, and never
> before.** Not at a headcount, not at a shift, not on a timer. The scene is the answer to a
> question the player has just asked out loud at their screen.

That rule is doing real work. It means every named character in the game is introduced as
*relief*, the player already understands what the hero is for before the hero says anything,
and §13.9.1's pre-bought branch reads as a fact about the person rather than as a starting
bonus. It also means the story cannot be told out of order, because the systems decide the
order.

#### 21.7.0 James, written down **[CANON]**

He is the anchor of the whole system (§22.3) and he has never had a voice specification, so
here it is. **Everything he says can be derived from these five facts:**

1. **Extreme focus.** He is not distracted, ever. When he is working, he is working, and §7.8's
   ambient drive-by interruptions do not land on him.
2. **He prefers as few human interactions as possible**, and he is not rude about it — he is
   *sincere* about it. Every tool he ever brings you is a tool for talking to people less, and
   he presents each one as good news, because to him it is.
3. **Correct grammar, always.** *Fewer* and *less*. He will correct you, once, without
   emphasis, and then continue his sentence. He never explains the correction unless asked,
   and if asked he explains it completely.
4. **He lives on Diet Coke.** Not coffee. The desk sprite has a can on it at every promotion
   tier, beside the elbow hole that never gets fixed.
5. **The gym, ten to eleven, every day.** Every single day. Through the collapse, through the
   bankruptcy, through the heat death of four universes. If the player pokes his desk between
   10:00 and 11:00 studio time, **he is not there**, and the desk says so.

**Rule 5 is a mechanic and it should be built as one.** An hour a day where the game's most
reliable card is simply absent is funnier than any line about it, it is the only scheduled
event in the game, and it costs one boolean.

> **What James is not:** sarcastic, wry, or in on the joke. He means every word. The comedy in
> every James scene comes from him being **completely correct about a small thing** while the
> large thing goes wrong behind him. If a line of his reads as a wink, it is the wrong line.

#### 21.7.1 Act I — *"Is this seat taken?"* **[CANON]**

Fires at §21.0b's fiftieth poke. James is free.

```
STUDIO_OS   > APPLICANT AT DOOR.

YOU         Can I help you?
JAMES       You posted a job.
YOU         I posted that eleven minutes ago.
JAMES       I have fewer commitments than most people.
YOU         ...Fewer?
JAMES       Fewer. It's countable.

            (He sits down at the empty desk. He opens a Diet Coke.)

YOU         I can't pay you.
JAMES       I know. I read the posting.
JAMES       I'm here eleven to seven. I go to the gym at ten.
YOU         Every day?
JAMES       Every single day.
```

He starts working. Velocity doubles. **No card award popup, no fanfare, no `NEW HERO
ACQUIRED`** — the second desk and the burn-down moving twice as fast is the entire
notification. §22.3's card is awarded silently and found later.

#### 21.7.2 Run 2, Act 0 — Instant Messenger **[CANON - moved 2026-08-13]** - R32, R44

> **This scene is §21.6's, and it has gone back there.** It spent one day in Act I, on the
> argument that the joke is better when the two of them are visibly side by side at two desks.
> The joke *is* better there and it was still the wrong trade — §21.0c wants Run 1 to carry one
> idea, and this arrived with an upgrade board, a granted node and a second cutscene inside the
> four minutes that idea has. **The lines below are unchanged**, because in Run 2 they are still
> sitting side by side: that was never a fact about which act it was in.

Fires on the first frame after the first Paradigm Shift, in place of the ring-1 handover this
scene briefly carried. It is §11.5's node arriving, and it is the first thing in the game the
player is *given* rather than sold.

```
JAMES       Can I show you something.

STUDIO_OS   > NEW PROTOCOL AVAILABLE -- INSTANT MESSENGER
            > Asynchronous text. Tier 1 Communication Infrastructure.

JAMES       Instant Messenger. So we don't have to speak to each
            other any more.
YOU         James, we're sitting side by side.
JAMES       Yes. That's the inefficiency.

            (He turns back to his monitor. A notification appears
             over the player's desk. It says `hey`. He is two feet
             away.)

YOU         ...
JAMES       Check your messages.
```

The `hey` notification is drawn from **§11.4.4's Instant Messenger icon and §11.4.5's purchase
pulse** — the same picture, so that when the board opens on the next tap the player recognises
the node at its centre without being told. §11.5 is the specification; this is the beat. It is
also the first tap on `UPGRADES` this player has ever been able to make, which is why the
recognition is worth the trouble: the door and the thing behind it arrive together.

> **§21.6 moves up a protocol.** *"How did you find me in every single reality?"* is the best
> opening line in the script and it stays exactly where it is, at the top of Run 2 — but the
> tool he brings there is now the **ring-1 protocol** §11.4.6 unlocks at the first Paradigm
> Shift, not Instant Messenger. The joke is structural rather than specific: **James turns up
> in every reality holding the next thing that lets people avoid each other**, and it works
> for any tool in the branch. Run 3 gets one too. So does Run 9.

#### 21.7.3 The hire ladder — who arrives, and what it took **[CANON]**

Five more people, each one gated on a *feeling* rather than on a number. §22.8 is the roster;
this is when each of them walks in.

| Hero | Arrives the first time... | Because the player has just... |
|---|---|---|
| **Mo** — Quality | A release is rated below the §4.14 baseline **on defects alone** | ...watched a game they were proud of score 31 and seen exactly why |
| **Serena** — Reliability | An incident (§4.12a) suppresses a release's tail for the first time | ...watched a game that *was* earning stop earning, overnight, with no input from them |
| **Matt** — Support | The ticket queue (§4.13) goes unserved for a sustained period | ...seen the drab grey bar fill up and learned that the back catalogue sends a bill |
| **Melany** — Cloud | The studio hits §4.2's developer cap with cash still in the bank | ...tried to solve a problem by hiring and discovered the cap for the first time |
| **Billy** — Cohesion | The speedometer first reads past `CHATTY` **outside Run 1** | ...met §4.1 as an ongoing condition rather than as Run 1's punchline |

**Every one of those triggers is a system the player already has on screen.** Nothing here
needs a new counter, and each scene is the first time the game says out loud what a readout has
been saying quietly.

Three shape rules for these scenes, so the set stays a set:

1. **Under twelve lines.** §21.7.1 is the length; nothing later is longer. A hero introduction
   is a handshake, not an act.
2. **The hero fixes nothing during the scene.** They arrive, they say who they are, they sit
   down. The number improves afterwards, from their work, where the player can see the cause.
3. **James is in every one of them, and he says one line.** He is the constant (§13.6.3) and
   the recurring cast member the player actually knows. His line is always about the *tool* or
   the *process*, never about the person — he does not notice people arriving.

#### 21.7.4 Global Head of His Desk **[CANON]**

Fires when James is promoted onto a management row — §22.2's org chart, the first time a card
is placed above another card.

```
STUDIO_OS   > ORG CHANGE COMMITTED.
            > J. -- GLOBAL HEAD OF HIS DESK

YOU         James. Congratulations. You're Global Head now.
JAMES       Of what?
YOU         Of your desk.
JAMES       I was already doing that.
YOU         Now it's global.
JAMES       ...Is it a different desk?
YOU         It's the same desk.
JAMES       Good.

            (Beat.)

JAMES       Fewer surprises.
```

**The title is real and it renders**, on the card, on the org chart, and on the desk plate in
the world at Desk zoom: `GLOBAL HEAD OF HIS DESK`. It is never explained again and it is never
retracted. Every subsequent promotion extends it rather than replacing it — *Global Head of
His Desk and Surrounding Area*, and so on — which is the corporate ladder rendered as a string
that only gets longer.

#### 21.7.5 What the arc is actually about **[CANON]**

§2 says the game is about the people you carry with you and §21.6 says *"the tools get better
and the humans get further apart — that is the whole arc."* Both are true and they are the
same arc read from two ends, so the set of scenes has to land both:

- **Every protocol James brings you works**, and every one of them removes a reason to speak to
  somebody. By the late game the studio communicates perfectly and nobody has met.
- **Every hero who arrives is a person you needed**, and the player will remember which
  disaster brought each of them in.
- **Nobody ever leaves.** There is no departure scene in this game, at any tier, for any
  character. §22.5's Yuki quitting is a *mechanic* and it is pointedly the only one — which is
  why it lands.

### 21.7.6 Every system enters through a person **[CANON - added 2026-08-15]** - R55

**"The defect and support-ticket mechanics should not appear before their heroes are
introduced."** Stated as a UI note, and it is not one — it is the general form of a rule this
document has already discovered twice and written down as two special cases.

§11.5 found it first: Instant Messenger is given by James, in a scene, and *"the door and the
thing behind it arrive together."* §21.0c found it again and generalised one step, to
*"everything that is not hiring arrives after the first Paradigm Shift."* **The shift is not
really what those systems were waiting for.** It was standing in for a person, because at the
time there were no people to wait for.

> **A system enters the game in the hands of the person who solves it, and never before.**

#### 21.7.6a The apparent contradiction, and why there isn't one

§21.7.3 gates Mo on *"a release rated below the §4.14 baseline on defects alone"* — so the
player must feel defects before Mo, and this section says defects must not appear before Mo.
Read as UI, that is a circle. It is not a circle, because **a system has two halves and only
one of them is being gated:**

| | | Before the hero | With the hero |
|---|---|---|---|
| **The mechanism** | Defects accrue, degrade the rating, and cost money | **Running, in full** | Running |
| **The instrument** | The backlog counter, the density line, the colour, the role on §10.10's dial | **Absent** | **Arrives, with them** |

**The player feels the problem as a consequence and never as a readout.** They ship a game they
were proud of, it scores 31, and the breakdown says one word they cannot act on. That is the
worst possible experience of a system and it is exactly the right one: it is a problem with no
handle, which is what makes the person who arrives holding the handle *relief* rather than a
tutorial.

This is the same trade §11.5 already made and it generalises cleanly:

- **§11.5** — the tech tree runs; James brings the board.
- **§21.7.3, Mo** — defects run; Mo brings the defect backlog, §4.12's density line and QA on
  the dial.
- **§21.7.3, Serena** — incidents run; Serena brings the incident list and SRE on the dial.
- **§21.7.3, Matt** — tickets accrue against the catalogue; Matt brings §4.13's bar and Support
  on the dial.

**Melany and Billy are deliberately different, and the difference confirms the rule.** The
developer cap (§4.2) and the speedometer (§4.3) have been on screen since the first minute of
Run 1 — they are not systems the player is being introduced to, they are systems the player has
been fighting. So those two arrive holding a *branch* rather than an instrument, and nothing
appears on the HUD when they sit down. **A person only brings what was not already there.**

#### 21.7.6b What this does to §4.15's three colours

§4.15 argues that the three backlogs are one system told in three colours and must be read as a
set, and §25.7.2a moved them into one column on that argument. **Both survive, and the set now
assembles itself in front of the player** — one colour at a time, each arriving with a face, over
the ninety minutes §13.12.2 gives Run 2.

That is strictly better than the alternative it replaces, which was three unfamiliar bars
appearing together at the first Paradigm Shift. A player who has met defects, then incidents,
then tickets — each one introduced by somebody, each one explaining the last release they were
disappointed by — arrives at the full set already knowing what all three are.

**The empty column is not drawn.** A rail that reserves space for two bars that do not exist yet
is the *set* being asserted before it exists, and §25.7.2a's rule that a silent row is the
loudest kind of furniture applies exactly.

#### 21.7.6c What replaces §21.0c's gate

§21.0c gates on `paradigmShifts > 0` and gives the reason plainly: *"a second flag is a second
thing that can be wrong after a save migration."* That reasoning is right and it does not
survive contact with this section, because the answer to *"does this player have defects"* is
now **"has Mo arrived"**, which is a different question from *"has this player prestiged"* and
cannot be derived from it.

**The gate becomes the roster, and the roster is not a new flag** — it is `milestones`, which
§24.3 already unions across saves and which §21.7.3's arrival scenes already write to. The
migration risk §21.0c was avoiding is avoided the same way: one source of truth, already
present, already merged.

| Gated on | Reads |
|---|---|
| **Run 1 has ended** | `paradigmShifts > 0` — unchanged, and still what opens §11's tree and §4.11's dial *at all* |
| **A specific instrument** | Its hero's arrival scene is in `milestones` |

Both, and in that order: **Run 1 has no instruments because it has no shift; Run 2 gets each one
when its hero walks in.** §21.0c's four-minute argument is untouched — it was always about Run 1
carrying one idea, and it still does.

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

### 22.8 The story roster — six people, one per branch **[CANON - added 2026-08-11]** - R38

**This design has had three rosters and no people.** §13.6.3 lists nine cards named after
*job titles* — Scrum Master, Floor Master, VP of Engineering — which were job descriptions
standing in for characters who did not exist. §22.5 lists twelve named cards, most of them
gated behind late-game milestones nobody has reached. §13.9 now needs one hero per branch, and
§21.7 needs each of them to walk through a door.

**So the six below are the roster. They are people, they are named, and each one owns a branch
of §13.9's board.**

| Hero | Branch | Bends | Arrives (§21.7.3) |
|---|---|---|---|
| **James** | **Engineering** — the trunk | §4.1 velocity, weakly, everywhere | Act I, 50 pokes, free |
| **Mo** | Quality | §4.12's **defect arrival rate** | First release rated below baseline on defects |
| **Serena** | Reliability | §4.12a's **incident arrival rate** | First incident to kill a release's tail |
| **Matt** | Support | §4.13 ticket capacity, and §4.12a **incident clearance** | First sustained unserved queue |
| **Melany** | Cloud | §4.2's **developer cap** — and the bill (§13.9.2) | First time the cap is hit with cash spare |
| **Billy** | Cohesion | §4.1's **Entropy** directly | First `CHATTY` outside Run 1 |

#### 22.8.1 What happens to the other two rosters

| | |
|---|---|
| **§13.6.3's nine titles** | **Become the branch vocabulary, not cards.** "Scrum Master" is what Billy *is*; "Architect" is a Cloud-branch TRAIT node; "VP of Engineering" is §22.2's org-chart amplification, which is a board rule and was never a person. **James's row survives verbatim** — home rung `any`, effect small at every rung, never scales |
| **§22.5's twelve** | **Six of them are these six** (James, and five replacing the title-cards). The remaining six — Intern #42, Chad from Sales, Dana, Bruno, The Greybeard, Yuki — stay exactly as specified, as the **collection long tail**: earned from milestones, no branch of their own, and they arrive after the story roster is complete |
| **§22.7's art cap** | **Unchanged at 12 portraits.** Six story heroes plus six collectables is twelve, which is the number that was already budgeted. Nothing about this section costs a sprite |

#### 22.8.2 The five, briefly — enough to write them **[CANON]**

Each is one sentence of who they are, one of how they talk, and their card's flavour line.
§21.7.0 does this for James at length because he is in every scene; these five need less.

**MO — Quality.** *Reads everything twice, ships nothing twice.* Speaks in short complete
sentences and asks the question you were avoiding, kindly, at the worst possible moment. Does
not think of herself as slow.
> *"I'm not blocking it. I'm just asking what happens if someone taps it twice."*

**SERENA — Reliability.** *Has a runbook for this. She wrote it before this happened.* Calm in
inverse proportion to how bad things are; the more the graph falls, the flatter her voice.
Deeply uninterested in whose fault it was.
> *"It's up. It was never really down. It was degraded. There's a difference and it matters."*

**MATT — Support.** *The only person in the company who has spoken to a player.* Warm, fast,
knows every customer's name and none of the acronyms. Quotes the forums in meetings, which
everyone finds annoying and nobody can argue with.
> *"Four hundred people wrote in about the same button. I don't know what it does either."*

**MELANY — Cloud.** *Can give you infinite capacity by Thursday.* Enthusiastic, extremely
competent, allergic to reading an invoice. Solves every problem by making it somebody's
metered resource.
> *"We can absolutely scale to that. I'd want to talk about the bill afterwards. Afterwards is fine."*

**BILLY — Cohesion.** *Believes in process, sincerely, in a way that is slightly moving.*
Facilitates. Has a deck. Genuinely does reduce Entropy, which is the uncomfortable part —
§13.6.3's joke was that he fixes communication overhead by adding a meeting, **and it works.**
> *"I've booked fifteen minutes. If we don't need fifteen minutes, we'll give them back."*

> **None of these five is a joke at the expense of their job.** §4.11 exists because a studio
> needs all four functions and the game is funnier when each of them is *right*. The comedy
> comes from an organisation that cannot hold five correct people at once, which is §6 again,
> with faces on it.

### 22.9 The card face — what a hero card actually looks like **[CANON - added 2026-08-15]** - R56

§22.1 says heroes are cards, §22.3 writes James's out as a stat block, and §22.4 tiers them by
rarity. **Nothing says what one looks like**, and the requirement that it be a *trading card*
is not decoration — it is the mechanism by which the player understands that a hero is a
different kind of object from a developer.

Because the competing object already exists. §7.8.8's dev card is a **personnel record**: a
clipboard, a name, four bars and a mood. If the hero card is that with better numbers, then a
hero is a good developer, and §13's entire command layer is a stat.

> **The dev card is a record of somebody who works here. The hero card is a card *of* somebody.
> They must not share a single visual element.**

#### 22.9.1 The register

The obvious build is a fantasy trading card — foil, gem, gradient frame — and it dies on
contact with ART_DIRECTION: 37 flat colours, no gradients, Departure Mono, and a §10.8a skew.
There is no gloss available and faking one costs the whole look.

**So the card is the object this company would actually print**, and the joke does the work the
foil was going to do:

> **It is a laminated staff pass, designed by somebody who badly wanted it to be a trading
> card.** Lanyard hole punched at the top. A rarity gem where the security chip goes. An
> abilities box where the emergency contact details go. The employee number is real and it is
> the order they were hired in.

That is buildable in the existing palette, it is funny in a way that is *about* this game rather
than about trading cards, and it inherits §10.8a's skew and border grammar for free.

#### 22.9.2 The face

```
   o
 +======================================================+
 | [SIGIL]  MO                              LV 14  ***  |   branch colour band
 +======================================================+
 |  +----------------------+                            |
 |  |                      |   REACH    FLOOR           |
 |  |      PORTRAIT        |   COVERS   10,000          |
 |  |   §7.8.7's face,     |   PLACED   FLOOR 3         |
 |  |   front, at 3x       |   ----------------------   |
 |  |                      |   DEFECT RATE      -34%    |
 |  +----------------------+                            |
 +------------------------------------------------------+
 | QUALITY                                  * * * . .   |   branch + depth
 +------------------------------------------------------+
 | SECOND PAIR OF EYES                                  |
 | A defect found before ship costs half.               |   TRAIT nodes owned
 |                                                      |
 | READS IT TWICE                                       |
 | The first release of a project cannot ship below     |
 | the §4.14 baseline on defects.                       |
 +------------------------------------------------------+
 | "I'm not blocking it. I'm just asking what happens   |
 |  if someone taps it twice."                          |   §22.8.2 flavour
 +------------------------------------------------------+
 | QUALITY ASSURANCE          EMPLOYEE #002       [gem] |
 +======================================================+
```

| Element | Rule |
|---|---|
| **Lanyard punch** | Top centre, and it is the only round thing on the card. It is what makes the object read as a pass rather than as a panel |
| **Branch band** | The colour §13.11.1 draws coverage in and §7.8.13 puts on the desk plate. **Three uses, one colour, learned once** |
| **Level** | §13.13's number, large, beside the name. Unspent points render as filled pips after it — so a card with something to spend on it is visibly waiting |
| **Portrait** | §7.8.7's generated face, front-facing, at 3× desk scale, in the same frame §7.8.11 puts on a building. **No new art**, which is what keeps §22.7's twelve-portrait cap intact |
| **The right column** | Reach, coverage, where they are, and **the one number this hero bends**, live. Not a stat block — one number, the one their branch is about |
| **Depth pips** | §13.6.4's DEPTH levels, filled and unfilled, at the reach they were bought at. §13.6.7a's dilution is why they are pips and not a total: a diluted level renders half-filled, so *"a hero broadened is a hero diluted"* is on the card |
| **The abilities box** | **TRAIT nodes only** (§13.6.4), in acquisition order, name then one line. Depth and reach are numbers; traits are the personality, and they are the only thing on this card written in sentences |
| **Flavour** | §22.8.2's line, italic, never changes, never explained |
| **The footer** | Role, employee number, and §22.4's rarity gem. The number is the hire order, so James is `#001` and it is the smallest joke on the card |

#### 22.9.3 Rules

- **The card is the hero screen.** There is no other one. Tapping a hero in the world (§7.8.8's
  turn), tapping their badge on a unit, or tapping their desk in the suite all open this, and
  §13.9's tree opens *from* it. §13.6.7's forbidden management screen stays forbidden.
- **The gem is a tier, never a roll.** §22.4's rarity is earned — promotions, levels, milestones
  — and MONETISATION's no-loot-box position means the gem must never be the most interesting
  thing on the card. It is in the footer for that reason.
- **The title string only grows.** §21.7.4's `GLOBAL HEAD OF HIS DESK` renders in the role slot
  and every promotion extends it. When it no longer fits, **it wraps and the card gets taller** —
  it is never truncated, because a title that outgrows its own card is the entire joke.
- **It renders at phone width.** §23.4.2's smallest frame is 748×336 and the card is portrait,
  so at that size it is a §10.5 sheet that scrolls internally. **It never scales down to fit** —
  a card too small to read is a card nobody opens twice. **The buttons do not scroll with it**:
  the title is meant to make this card taller over a career, and a card that grows is a card
  whose primary action walks off the bottom of a 336 px frame.
- **No animation on open beyond §10.5's transition.** A card that flips, shines or deals itself
  is a mobile-game tell, and §10.6 already forbids it in another form.

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

### 23.1b The studio platform owns the infrastructure **[CANON]**

**`mercilessstudio-platform` is the source of truth for everything cross-game.** It is not a
reference; it is the runbook, and this game follows it rather than deriving its own.

| Runbook | Owns |
|---|---|
| `playbook/STUDIO_PLAYBOOK.md` | **Start here.** End-to-end: cloud save, RevenueCat, AdMob, Firebase, Play release, and the `platform/` infrastructure-as-code pattern |
| `playbook/FIREBASE.md` | Firebase project, Firestore rules and indexes, `google-services.json` — including the canonical `/saves/{uid}` self-access rules |
| `playbook/SAVE.md` | **Save document shape, `SAVE_VERSION` and migration, and cloud reconciliation** — last-write-wins for run state, monotonic union for permanent state. Plus offline progression as a genre recommendation, since no studio game ships one |
| `playbook/MONETIZATION_SETUP.md` | RevenueCat, Play products, Play Games auth, restore purchases, consent |
| `playbook/PLAY_STORE.md` | Gradle Play Publisher, tracks, listing-as-code, content rating, privacy policy |
| `playbook/MARKETING.md` | ASO, launch angles, review prompts |
| `playbook/TRAPS.md` | Cross-game root-cause log — symptom to fix, so a mistake made on one game is not repeated on this one |
| `game-cloud` / `game-monetise` | The Capacitor plugins themselves, consumed by git tag |

**The house rule is API and CLI over dashboards**, and GeoDaily is the reference
implementation. Three shipped games have already paid for these mistakes.

**What that leaves this document responsible for**, and it is a much shorter list than it
looks: the platform owns every *mechanism* and this game owns every *value*. Firestore's save
transport is theirs; **what is in the save document is ours** (§24). RevenueCat's plumbing is
theirs; the SKUs are MONETISATION's. The content-rating questionnaire is theirs; **the
answers are ours**. Appendix F is scoped on exactly that line.

**Reinventing any of it is a defect**, not a preference. If something here disagrees with the
playbook, the playbook is right and this document is stale.

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
| Save and offline accrual (§24) | Local only. The document, migration, the monotonic merge and the closed-form offline model, with tests. **`game-cloud` is not wired** |
| §24.8 Overnight Build Report | Built. Staggered rows, headline last, the honest cap line, and the 2× offer above collect. **The 2× button is absent** because no ad network is wired — which is §24.8's correct behaviour for an unfilled slot, not a stub. `?overnight` and `?ad` make it inspectable |

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

## 24. Save & Offline Progression **[CANON]**

Closes Appendix **F1.1** and **F1.2**.

`playbook/SAVE.md` is the studio contract and this section does not restate it. Per §23.1b,
the platform owns the *mechanism* — the `SaveData` shape, `SAVE_VERSION` migration rules,
last-write-wins on `savedAt`, the two-tier reconciliation — and this game owns the *values*
and the one decision the playbook explicitly hands back: **which of our state is permanent.**

**Where we disagree with the playbook, the playbook is right and this is stale.** Where the
playbook has nothing — offline progression, which no studio game ships — §24.5 onward is the
first answer, and §24.10 records what goes back.

---

### 24.1 The save document **[CANON]**

One module, `src/game/save.ts`, exporting the four things `SAVE.md` §1 requires.

| | |
|---|---|
| `SAVE_VERSION` | **1**. This game has never shipped a save; there is no history to migrate *from* yet, and inventing one to look thorough would be a lie in the one place a lie corrupts data |
| `SAVE_KEY` | **`m100devs_save`**. The game prefix is not decoration — `SAVE.md` §4 lists key collision on a shared web origin as a trap, and we share an origin with every other studio game in a browser build |

```ts
interface SaveData {
  version: number      // ALWAYS first
  savedAt: number      // epoch ms, stamped at serialize time, never carried over
  run: RunSave         // last-write-wins
  permanent: PermanentSave
}
```

**`savedAt` is load-bearing twice over.** It is the last-write-wins input *and* it is the
offline clock (§24.5). There is deliberately no second timestamp: `SAVE.md` §5.2 is right that
a separate away-clock is a second thing to disagree, and it would disagree exactly when a
player switches device.

**Every large number is serialised as a `break_infinity.js` decimal string, never a float.**
Sprint Commitment and burn-down are `Decimal` in the store and a `10^308` overflow written
into a save is not recoverable by a migration. The save holds strings; the store holds
`Decimal`; the conversion happens in exactly one place.

---

### 24.2 Three tiers, not two **[CANON]**

`SAVE.md` §3 splits state into run and permanent. **We need a third: state that is never
serialised at all.**

| Tier | Rule | Ours |
|---|---|---|
| **Ephemeral** | **Not in the save document.** Reconstructed on load | Floating numerals (§8.2), speech bubbles, `SpawnEvent` (§7.7), zoom level, the poked developer's local entropy (§4.9) |
| **Run state** | Last-write-wins on `savedAt`. One device's session is the truth | Headcount, cash, current project and burn-down, in-run tech tree, §21 phase, `devCap` |
| **Permanent state** | **Monotonic merge — union, never overwrite** | Hero Cards and the org chart, prestige currency and nodes, lifetime aggregates, entitlements |

**Why the third tier earns its place.** A floating numeral has a `bornAt` from
`performance.now()`, which is a *page-lifetime* clock — persisting it and restoring it into a
new page produces a numeral born 400,000 ms in the future that never expires. That class of
bug is silent, arrives far from the load, and is avoided entirely by declaring the tier. The
same goes for local entropy: §4.9 decays it to baseline in ~8 seconds, so any absence long
enough to save through has already erased it. **It restores to zero by definition, not by
choice.**

#### The run block

`RunSave` is exactly what a Paradigm Shift throws away (§24.4), which is not a coincidence —
it is the reason the block exists as its own object.

| Field | Note |
|---|---|
| `devs`, `devCap` | Headcount and the capacity comm tech sustains (§4.2) |
| `cash` | In-run dollars (§4.10) |
| `projectIndex`, `commitment`, `burned` | The Sprint Burn-Down (§10.4). Decimal strings |
| `projectsShipped` | **This run**. The lifetime figure lives in `permanent` |
| `hasCultureUpgrade` and the §11 tech tree | Purchased with in-run cash, reset with it |
| `phase` | The §21 script position, so a player killed mid-Act-IV returns mid-Act-IV |
| `massHired` | The collapse beat fires once per run |

#### The permanent block, sub-split by prestige layer

```
permanent
├── layer1   BP balance, Paradigm Tree node levels          — cleared by a Codebase Fork
└── meta     Hero Cards, org chart, GP, Fork nodes,         — cleared by nothing
             Planck Cores, dimensions, lifetime aggregates,
             entitlements, milestone flags
```

**Permanent does not mean immortal.** §13.3's Codebase Fork resets Bandwidth Points and the
Paradigm Tree — which are permanent against a *sync race* and impermanent against a *player
decision*. Those are different questions and a single flat "permanent" bag conflates them, so
the split is in the document shape rather than in a comment. §24.4 is then a statement about
which sub-object a prestige clears, and it cannot drift from the code.

---

### 24.3 The monotonic merge **[CANON]**

`SAVE.md` §3 is explicit that the platform cannot infer this, because "monotonic" means four
different things here. Each field declares which.

| Kind | Merge | Ours |
|---|---|---|
| **Set** | **Union** | Owned Hero Card IDs, unlocked Paradigm/Fork node IDs, unlocked Multiverse dimensions, milestone flags, entitlements |
| **High-water integer** | **`max`** | Lifetime revenue, peak headcount $D_{peak}$, lifetime projects shipped, card duplicate counts, card promotion tier, per-node level, **total offline seconds** |
| **Spendable balance** | **Derived, never merged** | BP, GP, PC |
| **Org chart placement** | **The `savedAt` winner's layout, filtered to the merged card set** | §22.2 slots |

**Total offline seconds is not bookkeeping.** §22.5 card #6, *Bruno, On-Call*, is earned by
accumulating 24 hours of offline time. A player who accrues 20 hours on a phone and 6 on a
tablet has earned Bruno, and a last-write-wins save loses him. It is on the high-water list
for that reason and no other.

#### Balances are derived, and this is the interesting case

A currency balance is the one thing that is neither a union nor a maximum. Two devices each
spend 10 BP on a different node; `max` on the balance hands back both nodes and keeps the
money, and `min` confiscates a node the player legitimately owns.

**So the balance is not stored as a mergeable field at all:**

```
balance = max(0, lifetimeEarned  −  cost(mergedNodeSet))
```

`lifetimeEarned` is a high-water integer and merges by `max`. Spend is *recomputed* from the
merged node union against §14.2's deterministic cost table. The player therefore keeps every
node either device bought, and pays for both out of one earning history — clamped at zero, so
a double-spend race costs residual currency rather than an unlock.

**This is deliberately generous in the player's direction.** The alternative loses an unlock,
and §22.6 already establishes that this game does not take things away from a collection. The
worst case is bounded by one race and is not exploitable at scale: earning BP requires
finishing runs, which does not parallelise across two devices sharing one save.

**Lifetime BP earned survives a Codebase Fork** even though the BP balance does not, because
§14.3 computes GP from $\sqrt{\text{BP}_{total}}$ and *total* must mean total. It therefore
lives in `meta`, not `layer1`.

---

### 24.4 Paradigm Shift vs Codebase Fork — different answers **[CANON]**

| | **Paradigm Shift (L1)** | **Codebase Fork (L2)** | **Multiverse Compiler (L3)** |
|---|---|---|---|
| **Clears** | `run`, in full | `run` **and `permanent.layer1`, in full** | `run`, `permanent.layer1`, and the L2 node set |
| **Keeps** | All of `permanent` | All of `permanent.meta` | `meta` cards, dimensions, lifetime aggregates, entitlements |
| **In one line** | `{ ...save, run: freshRun() }` | `{ run: freshRun(), permanent: { layer1: empty(), meta: save.permanent.meta } }` | As L2, plus the Fork node set |

**A Paradigm Shift touches nothing in the permanent block.** That is the whole invariant, and
it is worth stating as an invariant rather than as a list because the list will grow: every
future field only has to answer "run or permanent", and its prestige behaviour follows.

**Two things the tables above would get wrong on their own:**

1. **Hero Cards survive everything, including a Multiverse Compiler.** §22.6 earns cards
   through milestones and never randomises them; a prestige that deleted a collection would
   be the harshest reset in a game whose collection layer is explicitly a months-long
   timescale.
2. **A Codebase Fork clears Yuki's quit flag.** §22.5 card #11 quits permanently "until the
   next Codebase Fork". Her flag therefore lives in `meta` alongside the card — she is not
   un-owned, she is refusing to work — and the Fork's reset explicitly clears it. This is the
   one piece of card state a prestige is allowed to touch, and it is a repair, not a loss.

---

### 24.5 The offline model **[CANON]**

| Parameter | Value | Why |
|---|---|---|
| **Starting cap** | **2 hours** | `SAVE.md` §5.3 puts the genre band at 2–4h and warns that a generous starting cap is a revenue floor given away for nothing. 2h leaves *two* upgrade steps to sell, not one |
| **First raise** | **2h → 4h**, a Paradigm Tree node | Free, earned, and it teaches the axis exists before anything is sold on it |
| **Subscription raise** | **4h → 16h**, SERIES A | This is MONETISATION §7 exactly. See the reconciliation below |
| **Offline rate** | **50%** of the active passive rate | `SAVE.md` §5.3's band is 50–100%; we sit at the floor, because §6's thesis requires that attention beats absence |
| **Rate raises** | Paradigm node **+25%/level**; SERIES A **+50%** | The other half of the same upgrade axis |
| **Minimum absence to report** | **30 minutes** | MONETISATION §4 R1's own trigger |
| **Unlocked at** | **The first Paradigm Shift** | Below |

**Reconciling the 4h in MONETISATION §7.** That document sells the cap as "4h → 16h", which
reads as a contradiction with a 2h start and is not one: **4h is the cap of every player who
will ever be offered a subscription.** MONETISATION §4's placement rules forbid any offer
before the first Paradigm Shift, and the first Paradigm Shift is where the 2h → 4h node
becomes purchasable. A player at 2h has never seen a store. Both documents are correct about
the player each is describing.

**Offline accrual does not exist during Run 1.** §21 paces Run 1 at about four minutes and
scripts every beat of it; an overnight summary landing in the middle of the trap would resolve
the lesson while the player was asleep, which is precisely the failure §6.3 exists to prevent.
The system unlocks with the first Paradigm Shift, alongside the first ad the player ever sees.

#### The away clock

Derived from `savedAt` and nothing else:

```
awaySeconds = clamp(0, (now − save.savedAt) / 1000, capSeconds)
```

**The lower clamp is not padding.** Device clocks move backwards — timezone changes, NTP
corrections, and players who wind the clock forward to farm and then wind it back. A negative
interval must pay zero.

**We do not attempt to defeat clock tampering**, per `SAVE.md` §5.2. The cap bounds the exploit
to one payout, and this is a single-player game with no competitive surface: §22.6 forbids
randomised rewards, there is no trading, and the leaderboards `game-cloud` offers are not
wired. The cost of anti-cheat here is false positives on players who genuinely travelled.

---

### 24.6 What accrues, and what deliberately does not **[CANON]**

| | Offline | Reasoning |
|---|---|---|
| **Story Points** | **Yes**, at 50% of the frozen rate | §4.4 makes SP the universal unit of progress. If anything accrues, this does |
| **The Sprint Burn-Down** | **Fills, and stops at 100%** | Below |
| **Projects shipping** | **No — unless CI/CD Autopilot (L2-2B) is owned** | Below |
| **Revenue** | **Only from offline ships**, so only with L2-2B | Revenue is realised on ship (§4.10), not continuously. Nothing changes here |
| **Payroll** | **No. The burn clock stops.** | Below — this is the load-bearing one |
| **Communication Entropy** | **Nothing to decay** | Below |
| **Random events (§18)** | **No** | `SAVE.md` §5.5: a player who returns to eight hours of resolved events has been told the game plays itself |
| **Hires** | **No** | Headcount is a decision, and §6 is a game about that decision |

#### Payroll does not run while the app is closed

**This is the single most important number in §24 and it is a zero.**

Under §4.10, payroll is $50 per paid developer per second. A mid-game studio of 100,000
developers burns $5,000,000/sec; the §4.10 bankruptcy threshold of −$1,000,000 is crossed in
under a fifth of a second. **Every player who closed the app would return, without exception,
to a bankruptcy screen.** `SAVE.md` §5.5 states the principle — nothing that can go *wrong*
should happen while away, or the player is punished for closing the app — and this is the
sharpest possible instance of it.

**The diegetic reading is better than the mechanical one:** nobody is being paid for hours
nobody logged. The studio is closed. It is a garage (§4.10) and then an office, and offices
have nights.

This has a consequence worth stating out loud: **the §6 trap cannot close while the player is
away.** An entropy-locked studio produces ~0 SP offline (its η is ~0, and 50% of nothing is
nothing) and burns nothing, so it is waiting in exactly the state it was left in. The trap is
sprung by the thumb or not at all, which is what §6.3 requires.

#### The burn-down fills and stops, and that is what L2-2B is for

Without **CI/CD Autopilot** (§13.3, L2-2B), offline SP fills the current Sprint Commitment and
**clamps there**. The project sits at 100%, complete, waiting on the ship. Shipping is a
player action until the node that automates it is bought — which is the node's entire premise,
and it gives L2-2B a concrete, sellable meaning it did not previously have: *with it, an
overnight absence chain-ships and banks revenue; without it, one project completes and the
line goes flat.*

That is also the honest reading of `SAVE.md` §5.5. Shipping is a decision right up until the
player buys the thing whose name is "you no longer decide this".

#### Entropy does not decay while away, because it is not a stored quantity

The question in F1.2 answers itself out of §4.1: **Communication Entropy is derived**,
$E = 1 - 1/(1 + (D/D_{cap})^\rho)$, a pure function of headcount against capacity. Neither
moves while the app is closed, so $E$ on return is $E$ at save, exactly, with nothing to
integrate. The only entropy that decays is §4.9's per-developer context-switch penalty, which
is ephemeral (§24.2) and reaches baseline in ~8 seconds.

---

### 24.7 Integrate, never simulate **[CANON]**

`SAVE.md` §5.1 calls this the rule most likely to be got wrong by a team with a good
simulation, and we have a good simulation. **`src/sim/offline.ts` must never call `tick()`.**

**Our accrual is closed form, not even bucketed**, and it is worth understanding why the
closed form is available: headcount, `devCap` and therefore η are all frozen during the
absence (§24.6 — nothing hires, nothing decays). Velocity is a constant, so the whole yield is

```
storyPoints = velocity × 0.5 × awaySeconds
```

The only iterative piece is L2-2B chain-shipping, which walks the project ladder crediting
revenue and is **hard-bounded at 64 ships** — a few dozen steps, exactly the budget §5.1
allows. If a future upgrade makes the offline rate time-varying, it becomes a fixed bucket
count and the approximation is accepted; consistency across devices matters more than
precision, and the player cannot tell.

**The property that must hold, and that the tests assert:** integrating one long absence
yields the same result as summing many short ones, within the cap. If that breaks, the model
has become device-dependent and two phones will disagree about the same eight hours.

---

### 24.8 The Overnight Build Report **[CANON]**

The return screen MONETISATION §4 R1 requires. **Specified here; it is a §10.8 scene and it
is held to F1–F6 like every other one.**

**In fiction it is a CI job summary.** `STUDIO_OS` ran the build overnight and this is the
log. That framing is free: the 2× rewarded offer is *"RUN IT AGAIN"*, and a capped-out
accrual is *"BUILD SERVER IDLE"*, which is a real thing that annoys real developers and is
therefore an upsell that lands as a joke.

| Rule | Detail |
|---|---|
| **When** | First thing on app open after **≥ 30 minutes** away, once offline is unlocked. Before the swarm, before the HUD |
| **Never** | During Run 1, or on any absence under 30 minutes — a report saying "you earned 40 SP" cheapens every later one |
| **Layout** | §10.8a's summary kit, verbatim: rows reveal on a 40–60 ms stagger, counters **roll and bounce**, and the headline total tweens up **last**, so it reads as a summation |
| **Rows** | Time away · Story Points · projects shipped (only if any) · revenue (only if any). A row with a zero value is **not rendered**, never rendered as `0` |
| **The 2× button** | **Above** `[ COLLECT ]`. Not beside it, not after it. Labelled with the exact reward on the button face — MONETISATION §4 forbids a `?` |
| **Collect** | **Always available, never gated, never on a timer.** The ad is an upgrade to a payout the player already owns |
| **Ad readiness** | Pre-loaded **before the screen renders**. If it is not filled, the 2× button is **absent**, not greyed — a dead button is a broken promise, and this is the one placement per session at peak intent |
| **Cap reached** | An extra line: `BUILD SERVER IDLE — 3h 12m`, with the upgrade path. This is the diegetic sell for the cap raise and it is the honest one: the player is being shown what they actually lost |
| **Copy** | No emoji, ART_DIRECTION §3.1, enforced by `art:check`. Emphasis is `**` and `[!]` |
| **Exit** | Hard-edged wipe into the swarm (§10.8a), never a fade |

**On the collect:** the yield is applied to the burn-down as one write, and the Sprint
Burn-Down bar animates from its old value to its new one *after* the wipe, so the player sees
where the numbers went. A summary screen whose figures do not visibly land somewhere reads as
a lie.

---

### 24.9 App lifecycle — when a save is written **[CANON]**

Partially answers F2.6, which is where F1.1 and F1.2 meet.

| Trigger | Action |
|---|---|
| `visibilitychange` → `hidden` | **Save.** This is the primary path |
| `pagehide` | Save. Belt and braces; a WebView is not obliged to give us both |
| Paradigm Shift / Codebase Fork | Save immediately — a prestige is the highest-value write in the game |
| Quit | Not relied upon. Mobile apps are killed without warning |

**Backgrounding, not quitting, is when the save must happen** (`SAVE.md` §5.2). A save written
at the last *interaction* under-counts the away period by however long the phone sat on the
desk with the game open — which is the most common way an idle game is left, and the player
would be silently robbed of that time every session.

The simulation tick also stops on `hidden`, so no frames are integrated against a throttled
background timer. Offline accrual is the only thing that runs while away, and it runs once, on
return.

---

### 24.10 What goes back to `playbook/SAVE.md`

§5 of that document says it explicitly: no studio game has offline accrual, and the first one
to ship it rewrites the section. Four things we found that it does not currently cover.

1. **The three-tier split.** §3 gives run and permanent; there is a third tier of state that
   must not be serialised at all, and the trap it prevents — persisting a `performance.now()`
   timestamp into a new page lifetime — is silent and lands far from the load.
2. **A spendable balance is not a mergeable field.** §3 says "monotonic means different things
   for a currency balance" and stops there. The answer is to store lifetime *earned* as a
   high-water mark, recompute *spent* from the merged unlock set, and clamp at zero (§24.3).
3. **Nested prestige needs the permanent block sub-split by layer** (§24.2). "Permanent" is
   two different questions — permanent against a sync race, permanent against a player
   decision — and a flat bag conflates them.
4. **§5.5 needs a stronger clause about costs, not just risks.** It says nothing that can go
   *wrong* should happen while away. Our payroll is not a risk, it is a certainty, and it
   would have bankrupted every returning player in under a second. **A continuous cost must
   not run offline unless the design has deliberately decided it should** (§24.6).

---

## 25. Requirements Ledger — 2026-08-08 intake **[CANON]**

**Why this section exists.** Batches of directed requirements arrive in single messages, and
the instruction attached to the first was explicit: *"if not already in GDD, add them in, just ensure
don't lose them, I don't want to tell you the same thing multiple times."*

R1-R13 came in one message, R14-R18 in the next, R19-R26 in a third on 2026-08-10 and R27-R28
in a fourth the same day (§25.4); the table grows rather than being replaced. So each item below is written **twice on purpose**: once here as a one-line row with a status,
and once in full in the section that owns it. The row is the guarantee that it is not lost;
the section is where an implementer will actually look. **A row is only allowed to leave this
table when the thing is built and seen working** — not when it is specced, and not when it is
"mostly done".

| # | Requirement | Owner § | Status |
|---|---|---|---|
| R1 | Music must have **melody**. Upbeat, retro, minor key, sovietwave. Short loops are fine | §20.7.1c | **Open** — prompts rewritten twice, 7/10 stems still measured as drones |
| R2 | Revenue is a **long-tailed randomised stream**, not a lump on ship. Plus a **revenue graph** in the HUD | §4.10e | **Built — needs eyes.** Two summed exponentials, a launch spike over a long tail; each written in normalised form so the integral is the ladder payout **exactly**, for every seed and every frame rate. Retirement pays the remainder, so nothing leaks. Persisted (§24) — a reload keeps the catalogue. Graph in the left rail: one band per still-earning game, payroll as a dashed line over them. **The chart was then hidden on every phone by a `max-height: 470px` rule and had to be asked for back — see §25.4.** It now shortens instead of vanishing |
| R3 | The lens is **too blurry**. Vibe, not a lo-fi filter. Speech bubbles must stay readable at high headcount | §7.6a | **Built — needs eyes.** Focal band 110→420, tilt 6→2, bloom halved, fringing halved, scanline contrast halved. Bubbles legible at 40 |
| R4 | Developers arrive **row by row**, never scattered — at every scale | §7.8.1b | **Built.** `seatFor` is one reading order at both scales; the row is a constant ten, so a seat once taken never moves. Costs the table's "6–10: two rows" line — recorded in §7.8.1b |
| R5 | A floor holds **10,000**: 100 squads of 100, corridors between them. Zoom to any squad, poke any individual | §7.8.1a | **Built.** 100 plates, corridors as darker floor between them, seats addressed to 10,000. *Zoom to any squad* landed with R8: the pinch now anchors on its own focal point, so pinching in on a squad frames that squad rather than sliding it off the edge — the general fix, and the one that also makes §7.7.6's double-tap land on what was tapped |
| R6 | Desks must **not overflow the floor**. The room starts sized for 100 | §7.8.1a | **Built.** Two causes, both fixed: the plate was sized `max(w, h)` for a sheared block, and the margin ran *negative* above 14 developers once crowding flipped it. Asserted at every headcount the tier can draw |
| R7 | At 100 developers the floor **unfolds** ×100, like paper | §7.8.1c | **Built — needs eyes.** 100 hinged panels, staggered outward from squad 0, overshoot and settle, light caught edge-on; squad 0 never moves and the camera pulls back with it. Scored by the existing rung promotion |
| R8 | Zooming out must climb **floor → building → campus → city → …**, not jump to a galaxy | §7.4a | **Built — needs eyes.** `sim/ladder.ts` makes the rung the navigation unit and the tier only a rendering one: eight views, one per rung, cross-fading in rung space. The city is three instances rather than one, so block → park → sprawl is a fade and not a cut. Ceiling is now the studio's own rung. Seen at rungs 1–6 with 3 M developers |
| R9 | **Poke vs drag must be distinguishable on a touch screen**, with no cursor to help | §7.7.6a, §7.7.6b | **Built, then rebuilt on the phone's verdict.** The timing model shipped — poke / drag / hold, motion beating time, the grab firing while the finger was still down — and came back as *"hard to control how to poke or grab or look at person"*. The diagnosis survived and the answer did not: the mode is now a control on the HUD (R27, §7.7.6b) and the only thing time decides is nothing. Poke vs **drag** is still the one distinction, and it is still the slop threshold |
| R10 | Story points appear as **+1 +1 over each developer's head**, not only under the thumb | §8.2b | **Built — needs eyes.** `render/tallies.ts`: one numeral per developer to a squad of 100, then per row, then per squad — thinning, never stopping. Pooled sprites, pre-baked glyphs, no per-developer allocation. Quiet and small; distinct from §8.2's poke numeral |
| R11 | A poke reading **"+0"** while the counters move is a lie. Fix the case and separate passive from active | §4.8a, §25.1 | **Built — needs eyes.** §10.1's `swarm + you` split shipped; an Overwhelmed poke now reads `UNBLOCKED` in amber instead of `+0` |
| R12 | Never write **"SP"**. It is "story point" | §10.2a | **Built.** Every user-facing use replaced, and `Hud.test.tsx` now fails on `/\bSP\b/` so it cannot come back one label at a time |
| R13 | **Colour-code the words that matter** — story points first, others later | §10.2a | **Partial.** `<Kw>` component + palette mapping shipped; story points coloured in the HUD. Cash / developers / entropy defined but not yet applied, and the §10.7 typed script is untouched |
| R14 | A poke **buffs that individual's output rate**, scaled by modifiers on them — it is not a one-off payout | §4.5a, §4.5c | **Built — needs eyes.** `sim/buffs.ts`: a sparse overlay of recently-poked units, capped at 64 and decaying on τ = 5 s. **The strength is solved, not chosen** — a buff of `s` on a unit producing `u` delivers `s·u·τ`, so the story points §4.5's formula already produced are converted back into the `s` that pays them. §4.10 therefore needs no rebalancing, which is §4.5a's own claim that only the *destination* changes. A quarter is still paid on the frame of the tap (§10.8 F2). Verified in the running game: five taps on one developer read `+69%`, decaying to `+2%` over eighteen seconds, with the neighbours untouched |
| R15 | **Any unit is pokeable** — person, squad, floor, building, campus, city, on up the ladder | §4.5b | **Built — needs eyes.** `sim/units.ts` reads §7.7.1's own headcount bands, so the unit size *is* the band's lower bound and cannot drift from the table. Towers answer which storey, cities which unit, rungs 7–9 are one thing. **§4.5b's "the buff percentage falls as the unit grows" arrives for free**: a unit of `n` produces ~`n` times as much and a poke on it is worth ~`Z(n)·n`, so `s ∝ Z(n)` with no second curve to tune. Verified at rung 4: a tap buffs one building of ten thousand by 10% |
| R16 | The **Founder has a desk and their own coding tree**, clickable anywhere, on a curve that never dilutes | §4.5d | **Built — verified by eye.** `sim/founder.ts`: your own rate is the one number in the game not multiplied by the swarm and not divided by §4.1, and the function takes no `GameState` at all — there is no headcount argument and no efficiency argument because neither can reach it. It lands in §10.1's `you` half, which R11 built for exactly this and which until now only counted pokes. **Both of §4.5d's failure conditions are tests rather than intentions**: the tap is worth more than the trickle (not an idler), and the whole tree maxed loses to the swarm at its §4.1 optimum, across the reachable headcount band, with the gap *required to widen* per Telepathic Compression level. The permanent rail action reads `CODE — YOU`, uses the normal short UI click rather than a camera sweep, banks that curve, makes the block founder perform a full hop/landing cycle, and throws the same floating `+SP` plus source line as every other coder. Tapping the physical person opens their identity and Management-tree screen; tapping the physical desk codes |
| R17 | **Exaggerate per-developer output variance**, and make it visible | §4.9a | **Built — needs eyes.** Log-normal at σ = 0.9, rolled from seat and run seed, never stored: 1st percentile 0.08×, 99.9th 10.8×, so §14.4's 10x Engineer *is* the top of the roll. Mean pinned twice — `μ = −σ²/2` in the distribution, and every share divided by the mean the roster actually rolled, so the sum is the headcount exactly. Visible through R10 |
| R18 | **Hero items**, bought with cash, equipped to a card, inheriting its reach | §13.6.9 | **Open** |

---

### 25.0 Intake — 2026-08-09, reported by eye **[CANON]**

Six things found by looking at the running game rather than by reading a
requirement. They are recorded here for the same reason §25 exists — so they are
not told to us twice — and every one is built.

| # | Reported as | Owner § | Status |
|---|---|---|---|
| E1 | "Your rows are diagonal, not horizontal ... I mean horizontal to the office layout, horizontal to the wall ... row means developers sitting next to each other, not in front and behind" | §7.8.1 | **Built.** `isoAt` is a real 2:1 isometric map and a row runs **across the way developers face**, parallel to the left-hand wall. A run of desks is one continuous bank. Which axis is not a free choice — see the trap in `docs/HANDOFF.md` |
| E2 | "The hiring animation, the fall goes down to the person before ... you literally need 3 things, a desk falldown, a computer fall down, a person fall down" | §7.8.5 | **Built.** Exactly three, each under gravity with one bounce, squash and stretch at both contacts, dust and its own sound. Landing on the seats the hire actually filled, with the room withholding a seat until its arrival lands |
| E3 | "Why are they white to start with and change into their colour?" | §7.8.7 | **Built.** The arrival draws the real desk, the real workstation and the **real generated developer**. Nothing is a placeholder for something we already know |
| E4 | "There's a big shade of black on title screen, what is that" | §10.9.6 | **Built — needs eyes.** The near field was a hard-edged slab of background colour over a third of the frame. Now a heavily blurred crop off two edges with a lit rim |
| E5 | "I want to see some stats that reports Man-Week, the key metric the users are tracking in their head, but not the actual velocity they get" | §10.1a | **Built, then withdrawn by the person who asked for it.** `MAN-WEEKS` read the plan against what lands, in the plan's own unit, and was removed on sight from a phone. The row stays so it is not proposed a third time: **the requirement is closed, not open**. What it was competing for is the space — the left rail already carries §4.10e's graph and §10.1's gauges, and a fourth readout is what pushed them into §21's script |
| E6 | "The speech bubble in and out animation ... they zoom and way too slow" | §8.3 | **Built.** Wall-clock 110 ms snap with an overshoot, a shut that collapses vertically, and words that never scale — they are up at full size or not up at all |
| E7 | "On floor view (>100 dev) it should still be on a floor, with wall and stuff. And you should still be able to zoom to individual level. Hire 1x should still be visible" | §7.8.1, §7.4a | **Built.** Rung 2 is the **room**, not an abstract particle grid: `ROOM_DEV_CAP` is a full thousand (measured at 59 fps, the same as the particles), the unfold no longer dissolves the walls, and the shell is sized from the whole occupied floor. Individuals are drawn, pokeable and zoomable at every headcount to a thousand, and a single hire animates at any of them |

---

### 25.0a Intake — 2026-08-10, reported by eye **[CANON]**

Three more found by looking at the running game. All three are **the same class
of mistake as §25.0's**: correct in the code, wrong in the picture.

| # | Reported as | Owner § | Status |
|---|---|---|---|
| E8 | "I don't like the siiuuuuuu sound when I click start on main menu" | §10.9.4, §10.8 F3 | **Built.** START fired `zoom-in` — **1.2 s** of descending swoop written for a camera crossing nine orders of magnitude — over a push-in that is `PUSH_IN_MS = 420 ms`. It was still going long after the title had gone, and it is **the first sound in the game**. This is the trap `uiSfx.ts` already records having fixed for panels, found a second time in the worst place, and defended by a comment. `start` is now its own sound, routed through the fallback table so a bespoke clip drops in with no code change |
| E9 | "there's a horizontal bar black one across the desk, why is that, remove it" | §7.8.1 | **Built.** The monitor lead — a 1 px stroke from the tower to the panel. Two faults compounding: the two props stand on the same surface so the lead was **flat**, in a picture whose rule is that nothing is flat (trap 10); and a stroke width is in room units, so it was sub-pixel at a full floor and **a dozen screen pixels at rung 0**. Never the width of a cable — either nothing or a girder. Removed |
| E10 | "the lines 'Progress is dangerously slow...' is very unreadable. make it, and other similar style lines more visible" | §10.7, §21 | **Built.** §21's advisor was styled as a *readout* — `--p1` ink on a 58% wash, the treatment every rail label gets — when it is a character speaking, lying across the middle of the frame over the brightest part of the lit room, and the only thing on screen that teaches the player what to do. The game already had the answer written down: §10.7's dialogue box is `--p3` on 80%. Both script lines now take that treatment, the terminal staying a step down the ramp at `--p2` so the register distinction is *which colour*, not whether you can read it |

---

### 25.1 R11, diagnosed — what "+0" actually is **[CANON]**

Two separate things were happening and they had one symptom, which is why it read as a single
bug:

**a. A tap on an Overwhelmed developer is worth exactly zero.** §4.7's `STATE_MULTIPLIER` sets
`overwhelmed: 0` deliberately — "the poke's value is clearing their lockup, not the points".
The maths is right and **the interface is wrong**: a numeral reading `+0` is indistinguishable
from a broken button, and the one thing a feedback numeral must never do is announce that
nothing happened when something did. The floater must say what the poke *achieved*
(§8.2 — the lockup cleared) rather than what it paid.

**b. Nothing on screen separates the swarm's output from the player's.** The commitment burns
down continuously from passive velocity whatever the player does, so a tap worth `+0.80` at
global zoom looks like it did nothing while the burn-down visibly moves and velocity rises.

§10.1's component table **already specified the fix** and it was never built:

> `VELOCITY: 4,120 SP/s` / `(3,880 swarm + 240 poke)`

The split is not decoration. It is the only thing on screen that can answer "did my tap do
anything", and without it every fractional yield reads as a bug.

**And the yields are fractional by design.** §4.8 makes a tap worth less per developer the
further out you are — `Z = 1.0 / 0.4 / 0.08 / 0.01` — so at global zoom a real tap is `+0.80`
and at cosmic `+0.10`. Those are correct, they are not zero, and the earlier `Math.round`
that turned them into `+0` is fixed. If a build still shows a bare `+0` for a working
developer, **check the build timestamp before believing it** — a stale `dist/` predating that
fix is the known cause and has cost this project a day before.

---

### 25.3 Intake — 2026-08-10 **[CANON]**

Eight requirements in one message, and unlike §25's first two batches they are **not eight
features**. They are one system seen from five sides, and the ledger is written in the order
the dependency runs rather than the order they were said:

> Developers stop being interchangeable (**R19**) → the roles that appear are the ones that
> answer two new ways to fail, defects (**R21**) and tickets (**R22**) → what those failures
> cost is a **rating** (**R23**), the first number in this game that can go down → heroes gain
> a class per role and a tree each (**R24**), placed on the floor as the management game
> (**R25**), visible from every rung (**R26**) → and **you** (**R20**) are the one person who
> has all five classes and is bad at all of them.

| # | Requirement | Owner § | Status |
|---|---|---|---|
| R19 | Developers are **not homogeneous**. Types of hire — **dev, QA, support, SRE** — assignable to particular rows, each with its own speech and behaviour | §4.11, §4.11.3 | **Partial — the model built, not wired.** `sim/roles.ts` holds the four functions, the roster, the per-role effects QA and Support carry, and §4.11.2's bands. **The roster is the hire history run-length encoded, not four counters** — see §4.11.3, which is the whole reason the file is shaped as it is. Still missing: the hire dial's role selector, §19's per-role speech, §7.8.6's per-role behaviour and §7.8.7's silhouette |
| R20 | **You** sit at the corner of the floor, apart from the rank and file and **facing them**, always clickable — and the Management tree is a diluted copy of every other class | §7.8.10, §13.7.1, §4.5d | **Built — verified at 1024×512 and 748×336.** The **tree is done**: five nodes, every one a weaker copy of a class §13.7 has not built yet, with the borrowed class printed on the card so the joke is legible before the specialists exist. `MANAGEMENT_DILUTION` is a named constant precisely so "weaker" is not re-guessed when they arrive. Levels persist in `meta`, not `layer1` — §4.5d's "grows only because *you* got better" means a rewrite of the company's architecture does not take it away. The physical desk occupies the fixed north-east corner beyond row zero and never moves as headcount grows. Its desk, tower, keyboard and monitor are now built from the **same proven workstation primitives as every developer** rather than a one-off projection; its personalised front-facing block developer uses the same `buildDeveloper` parts as the floor and looks back toward the studio. Tapping that world avatar opens a dedicated founder screen containing the chosen block portrait, live output, and the complete Management tree |
| R21 | A **defect system**. Bugs are generated by the work itself and damage what you shipped; QA suppress the rate, SRE clear the backlog | §4.12 | **Specced, not built** |
| R22 | A **support role**. Tickets are raised against the back catalogue forever and somebody has to answer them | §4.13 | **Specced, not built** |
| R23 | A **rating** for each shipped game, judged on defects, hero ability and the craft of the developers who built it — feeding revenue, reputation and prestige | §4.14, §4.14.1 | **Built, not wired.** `sim/rating.ts` holds the three weighted terms, reputation as a slow average, and the three multipliers it feeds — revenue, revenue-per-story-point, banked BP — all pure and tested. **The neutral point is derived from the garage rather than picked at 50** (§4.14.1), so wiring it cannot move §21's +$50. Not wired for one reason and it is not readiness: with no §4.12 the defect term reads zero, every release rates 60, and revenue would inflate ×1.23 **with no gameplay cause**. R21 is the switch — see §25.3.1 |
| R24 | Each function — **dev, QA, support, SRE** — has its **own hero class and upgrade tree**, and a class only multiplies its own role | §13.7 | **Specced, not built** |
| R25 | Hero cards are **placed in the world** as a management minigame, not slotted into a tray | §13.8 | **Specced, not built.** Build this last — see below |
| R26 | A hero is **visibly a hero**, including a **portrait carried on the floor, the building and the city** when zoomed out | §7.8.11 | **Specced, not built** |

#### 25.3.1 The order to build them in, and why it is not the order above

**R23, the rating, comes first.** It is pure economics — no art, no interface, no renderer —
and it is what every other item in the batch is *scored by*. Building R21's defects before
there is a rating means guessing what a bug is worth, and a guess made at that point becomes
canon by accident.

**R21 second**, because it is the thing R23 measures, it runs headless, and its coefficient is
the batch's one genuinely load-bearing number.

> **R23 is built, and building it turned R21 into a hard dependency rather than a preference.**
> The rating is pure and tested and deliberately **not wired**, because until defects exist the
> defect term reads zero on every release, every game rates 60 against a baseline of 35, and
> §4.10's revenue inflates by a quarter for a reason no player did anything to cause. The
> ordering above still holds; what has changed is that the two are now one switch. §4.14.1
> records the arithmetic that makes throwing that switch safe.

**R25 last, and deliberately.** It needs a floor that already has roles on it, rows worth
assigning somebody to, and a rating that makes a placement right or wrong. Built first it is a
card that goes into a slot for no reason — which is what §13.6.6 already is, and is why that
section has sat unbuilt.

#### 25.3.2 What this batch does *not* decide

Three numbers are deliberately absent, on §25.2's rule that a quantity invented at design time
and written as canon is a balance decision nobody measured:

- **The role ratio.** How much QA a studio needs per developer is the single most
  play-test-dependent quantity here.
- **The defect coefficient β.** It sets how punishing speed is, which is the whole feel of R21.
- **The rating's three weights.** §4.14 fixes their *order* — defects dominate — and not their
  values.

And one thing that is decided and must not drift: **none of this may become a fail state.**
§6.3's Entropy Lock is the game's one seizure and it is load-bearing. A second one competing
with it reads as a broken build rather than as a point being made.

### 25.4 Intake — 2026-08-10, second message **[CANON]**

Three things in one message, and they are not one system: two are the player asking for
control back over something the interface took from them, and the third is a new screen.

| # | Requirement | Owner § | Status |
|---|---|---|---|
| R27 | "Hard to control how to poke or grab or look at person. Make **2 modes** you can toggle on the UI, a POKE or a GRAB. If not selected, default to **check people**" | §7.7.6b | **Built — needs a phone.** Two latches at the foot of the right rail; neither lit is §7.8.8's card. Every duration threshold is gone from the input path — `resolveGesture`, `isTap`, `isHold` and `HOLD_MS` are deleted, not bypassed — so a slow tap and a quick tap are the same tap. GRAB fires on the press and reaches **anybody at rest**, not only §7.8.9's loiterers. Verified in the running game: GRAB lifts a seated developer with `pokeCount` still at 0, and unlatching drops them and opens the card |
| R28 | A **release gallery** — rating, revenue, cover art, and the **man-days** spent, represented so it still reads when the studio ships a billion a second | §10.11 | **Specced, not built.** Depends on R23's rating (§25.3.1 already puts that first). The spec's load-bearing half is §10.11.2: labour is headcount integrated over build time and is **not** divided by efficiency, and the unit climbs a ladder per release so the column is never normalised |
| — | "I like the moving revenue stream graph we had before, can we have it back" | §4.10e | **Built.** It was never removed — it was `display: none` below 470 px, which is **every phone**, including the 997x448 reference frame every screenshot is taken on. The feature shipped, was reviewed on a desktop, and did not exist on the hardware it was built for. The chart now gives height back instead of vanishing: 14 px under 470, 10 px under 400 |

> **The revenue-graph row has no R number on purpose.** It is not a new requirement; it is R2,
> reported as missing by the person who asked for R2. The lesson is worth more than the fix:
> **a responsive rule that hides a feature is a feature deletion on every device inside the
> breakpoint**, and §23.4's design box tops out at 448 px — so "below 470" meant "always". Any
> future `display: none` in a media query owes an answer to "on which device is this still
> visible?"

### 25.5 Intake — 2026-08-10, third message **[CANON]**

> *"Tighten the loose ends and ship one playable version. Prestige, upgrade, heroes (the You)
> are the three big things missing."*

Not a requirements batch — a **scope call**. Three systems named, and the instruction is that
the game is not playable without them. All three are built; what each one cost is below,
because in every case the interesting part was a decision the GDD had left open.

| # | Named as | Owner § | Status |
|---|---|---|---|
| S1 | **Upgrade** — the in-run tech tree | §11 | **Built — needs eyes.** `sim/techTree.ts`. Two branches, eleven nodes, every one wired. **§11.1's Branch A is deliberately not shipped** and that is the section's one real design decision: its nodes add developers on their own, and in this build hiring is §10.10's dial — a chosen act, priced by §4.10a, paid for forever by §4.10d. An upgrade that spawns free developers per second deletes the price of a hire and with it §6's trap, which only works because the player *decides* to hire the hundredth person. **The hire dial is the workforce branch.** §11.2's documented `[CONFLICT]` on B4's cap is resolved to 60% in the module, with the reasoning |
| S2 | **Prestige** — Layer 1, finished | §13.1, §13.2 | **Built — needs eyes.** All five Paradigm nodes wired; three had said *"not yet implemented"* on the card since the tree shipped. Meeting Ban was waiting on S1's standup to exist before it had anything to cancel, which is the pairing worth having — the pause is a real cost inside a run and this is the only thing that answers it across runs. **And §13.1's trigger row finally has more than one entry**: the shift lived on the Act V bankruptcy modal and nowhere else, which is one prestige per playthrough in a game whose second half *is* the loop |
| S3 | **Heroes (the You)** | §4.5d, §13.7.1 | **Built for You — see R16 and R20.** The founder's curve, dedicated profile/tree screen, first-start block-person identity, normal coding feedback, permanent Manager Corner action and §7.8.10 corner desk are implemented and tested. Hero *cards* (§13.6) remain correctly unreachable: they cost GP, GP needs Layer 2, and Layer 2 needs 100,000 BP |

#### 25.5.1 What was deliberately left out, and why

**Prestige Layers 2 and 3.** §13.3's Codebase Fork is gated on 100,000,000 simultaneous
developers and §13.4's Multiverse Compiler on a release every Planck time. Neither is
reachable in the version this session was asked to ship, and building a currency nobody can
earn is the same defect as a node that changes nothing — it is just harder to see. Layer 2
remains the single blocker on §13.6's Hero Cards, and that dependency is now the only thing
standing between the card rules (built, tested, unwired since 2026-08-08) and a player.

**§11's late nodes** — B5, B6, C3–C5 — act on systems that do not exist: code-bloat entropy,
swipeable notification bubbles, frame stutter at relativistic ship rates. **A shorter honest
tree beats a complete inert one**, which is the rule §13.2's cards were already following from
the other direction.

#### 25.5.2 One bug worth recording, because it is a whole class

`Math.max(0, Math.floor(NaN))` is **`NaN`**, not zero — `Math.max` propagates it rather than
treating it as the smaller operand. All three level maps written this session had it, and in
the tech tree the value reaches §4.1's efficiency curve, where a single `NaN` turns the studio
into `NaN` output and the treasury into `$NaN` on the following tick. Levels are read from a
save document, which is the one input in this game that can contain anything at all. §24's
`normaliseReleases` already carries the same scar and the same comment.

### 25.6 Intake — 2026-08-11 **[CANON]**

> *"Story / Heroes / Upgrades / Mechanics."*

The largest single batch since the ledger opened, and unusually it is **mostly repair rather
than addition**: five of the fourteen rows below name something the GDD already specified and
built wrong, or specified and never built. The requirements are recorded verbatim in intent
below; the owning sections carry the design.

| # | Requirement | Owner § | Status |
|---|---|---|---|
| **R29** | Defects generated alongside development, cleared by QA. **Incidents generated after a game has launched**, dealt with by SRE | **§4.12a** *(new)* | **Specified.** §4.12 made an incident "a defect past a threshold", which confines incidents to unreleased software. Now incidents arrive from the **released catalogue**, at a rate set by the defect density each release shipped with. Unbuilt: there is no `defects.ts`, no `incidents.ts`, no `support.ts` |
| **R30** | Different text colours and UI components to track them | **§4.15** *(new)* | **Specified.** Three concept tokens (`defects` amber, `incidents` red, `tickets` grey-blue), three distinct components, and a rule against ever merging them into one "problems" total |
| **R31** | More immersive story. **Focus down to the speaker, facing camera.** Speech subtitle bigger and more central | **§10.7a** *(new)* | **Specified.** §10.7 specified a box and never specified where anybody was standing. The camera now pushes to Desk zoom and re-centres per line; the speaker turns front-facing for their line. The box grows ~1.5×, moves to the lower third, and drops to two lines |
| **R32** | Instant Messenger is the **first upgrade**, with the same visual effect in the tree | **§11.5**, §21.7.2 | **Specified.** §11.2's B1 was Voice Shouting — *the thing IM replaces*. Voice Shouting becomes the starting condition; IM takes the B1 slot, is given free by James, and the scene's `hey` notification is drawn from the node's own icon and pulse. **Amended 2026-08-13 (R44): the handover is Run 2's Act 0, not Act I** — see §21.0c |
| **R33** | Clicking upgrade shows **the tree**. Incremental reveal — unlocking one shows others — with a guide layer on tap | **§11.4.1–3** *(new)* | **Specified.** Three visibility states (live / silhouette / dark-with-connector). **This overturns a recorded decision** — see 25.6.1 |
| **R34** | Upgrades **scale with prestige** and are **not available at the start** | **§11.4.6** | **Specified.** Node rings gated on shifts taken; ring 0 is Instant Messenger alone, given by the story. Costs gain a `Φ^s` prestige term |
| **R35** | Centre-out tree, **right angles**, **a node per upgrade level**. Icons. Purchase juice. A bigger screen, without saying so | **§11.4.1**, §11.4.4, §11.4.5 | **Specified.** `maxLevel` counters become chains of nodes; one procedural pixel icon per node with three states; a two-part audio cue and a pulse that travels the connectors it just unlocked; the board is pannable and larger than the viewport, which is how it is bigger without a line of copy saying so |
| **R36** | Heroes share **one upgrade tree**, branched into five areas | **§13.9** *(new)* | **Specified.** §13.7's five separate trees collapse into one centre-out board — Engineering at the trunk, five branches out. Same three node kinds |
| **R37** | Story hires arrive with **some skills pre-clicked** in their expertise; the player owns the rest | **§13.9.1** | **Specified.** A hero is a *starting position*, not a role. Nothing stops Mo going down Cloud |
| **R38** | The named roster and their effects. **Suggest the Cloud effect** | **§22.8** *(new)*, §13.9.2 | **Specified, and it is a proposal.** Melany/Cloud raises §4.2's developer cap and makes hires take effect immediately, paid for by a standing bill that scales superlinearly with headcount. Chosen because the cap is the only defence against §4.1 and only §11 touched it, and because it is the one branch whose upgrades make a line item *worse* |
| **R39** | **Heroes generate XP**, like the founder | **§13.10** *(new)* | **Specified.** XP accrues from work done under coverage, so an unplaced hero earns nothing and REACH pays twice. XP buys DEPTH/REACH; GP still buys the card and its TRAITs |
| **R40** | Heroes slot onto **units** (block of 100, floor of 10,000, building). **Design how assignment is displayed** | **§13.11** *(new)* | **Specified.** Three views: badges and tinted footprints on the world, a roster strip for who is benched, and §22.2's org chart for reporting lines only. Placement never happens on the chart |
| **R41** | The 1,000-point first level alone is **too brutal**. James at **~50 clicks as a free hire** | **§21.0b** | **Specified.** Fifty pokes, free, mid-Act-I. The arithmetic that made it brutal is recorded: James cost $1 from a $0 treasury, so the first help arrived *after* the hardest part |
| **R42** | Author a **new set of stories going forward**, tied to hero acquisition. Promote James — "global head of his desk" | **§21.7** *(new)* | **Specified.** One rule — *a hero arrives the first time you feel the problem they solve* — a voice bible for James, five gated arrivals, and the promotion scene |

#### 25.6.1 One recorded decision is overturned, deliberately

`hud/Upgrades.tsx` names every locked node and argues for it in a comment: *"A tree that
reveals nodes as you buy them cannot be planned, and planning is the whole of §11's 'upgrading
Workforce without Communication Infra' warning."*

**That argument is right about planning and wrong about its range.** §11's warning is about the
*next* purchase — do not buy capacity before you buy the thing that makes capacity work — and
§11.4.2's silhouette ring shows exactly that. What progressive reveal gives up is planning six
nodes ahead, which no player was doing, in exchange for every unlock in the tree being an
event. Recorded here rather than quietly deleted, because the comment was a real decision and
this is a real reversal of it.

#### 25.6.2 Two conflicts inside the batch, and how they are resolved

**The dialogue box cannot be both bigger-and-more-central and never cover the speaker.** §10.7
promised the second and enforced it by luck, since nothing specified where the camera was.
R31's own first half is the fix: with the speaker deliberately framed in the upper half
(§10.7a.1), a larger box in the lower third clears them **by construction**. The two halves of
R31 are not in tension — the first one is what makes the second one affordable.

**SRE and Support cross over on incidents.** §4.12 gives SRE the incident backlog end to end —
*"QA change how fast defects arrive, SRE change how fast they leave"* — while R29 and the
roster give **Serena (SRE) the arrival rate** and **Matt (Support) the resolution rate.**
Resolved by scope rather than by picking a side: **§4.12's sentence holds for roles**, where
SRE headcount still bends both terms, and the **heroes specialise at opposite ends of the same
pipe** (§4.12a.1). Prevention and response are genuinely different jobs, a studio that has one
and not the other is visibly broken in a specific direction, and that is the only reason to
model a pipe with two ends.

#### 25.6.2a Three things the build settled that the sections above did not **[CANON - added 2026-08-11]**

**1. *Flappy Square* now pays $45, and that is §4.14 working rather than the anchor moving.**
§4.10's economy is calibrated against §21's stated figure of **+$50**, and §4.14.1 promises
that "a player who ignores this entire batch earns exactly what they earned before it existed,
at every multiplier". Both still hold — **the $50 is the §4.10c *ladder* payout, and the
rating multiplies it**, which is exactly what §4.14 asks for when it says the payout scales
with the rating. What changed is that a player cannot ignore the batch during Act I, because
§21 asks them to burn 1,000 Story Points by thumb and §4.12 charges a poked point `β + ε`.
**Act I ships a rushed game and is paid for a rushed game**, roughly 10% under the ladder.
That is the system's first sentence and it should be the first one the player hears.

**2. `ι` is anchored at a *tenth* of a page per garage release, not one.** §4.12a's derivation
gives `ι = (pages per garage release) / β` and left the numerator implicit at 1. Measured, that
put a garage release **off sale for half of its life** — two incidents per game, each taking
`INCIDENT_WORK_SECONDS` at the founder's diluted clearance rate, against a four-minute tail.
Act II became a game about outages, which is not the act §21 wrote. At a tenth, **a studio
needs ten mediocre games before the pager is a standing feature**, which is the same shape
§4.13 already gives tickets and keeps Run 1 clean. The numerator is now a named constant.

**3. The founder covers every role they have not hired for, at §13.7.1's dilution.** This was
specified as a *tree* and had to be true of the floor as well, because two systems divide by a
headcount a garage does not have. §4.13's `clearanceWait` is infinite the moment a queue exists
with nobody on it, so a studio would take the full catalogue penalty from its first shipped
game. **§4.12a's is worse and is a fail state**: with no SRE, clearance capacity is zero, an
incident never closes, and a frozen tail never resumes — one page in Act II would take a game
off sale *permanently*, which §4.12's standing warning forbids outright. So you answer the
email and you carry the pager, at two-fifths of somebody who does it for a living: enough for
four games, hopeless after that, which is §13.7.1's "available earlier, meaningfully weaker"
landing on the floor instead of on a tree.

#### 25.6.3 What this batch does not decide

**No coefficient in it.** `ι` in §4.12a, `ξ` in §13.10, `Φ` in §11.4.6, the XP curve's `X₀`
and the ring-to-shift mapping are all first passes and are marked as such where they live.
§25.2's standing position applies to every one of them: what must be *true* is recorded here,
what it must be true *of* is recorded in the owning section, and the numbers want a playtest.

**And the build order is stated, because R29 has the same trap R21 had.** §4.14's rating is
already anchored so that `β` cannot secretly rebalance it; `ι` must be anchored the same way,
against **§4.10e's tail**, before any hero that bends it exists — or the first Reliability node
written will fix the meaning of an incident by accident.

### 25.7 Intake — 2026-08-13 **[CANON]**

Reported from a handset, mid-session, in four sentences. Three of them are layout defects and
one is a design correction that turns out to explain two of the other three.

| # | Reported | Owner | Resolution |
|---|---|---|---|
| **R43** | QA, SRE "and other story and their mechanics" come **after the first prestige** | **§21.0c** | **Specified.** Roles, the three backlogs and the upgrade board are all gated on `paradigmShifts > 0` |
| **R44** | Run 1's James beat should be **him joining, not him giving Instant Messenger** | **§21.0c**, §21.6 | **Specified.** The Act I Instant Messenger scene is deleted; §21.6 takes the node back |
| **R45** | **Why is the first person not James?** | §7.8.7 | **A bug.** `developerAt` said James was seat 1 while every other file said seat 0 |
| **R46** | Upgrades are given **only after the first prestige** | **§21.0c** | Same gate as R43 |
| **R47** | Character-creation buttons **overlap each other** | §10.12 | **A bug**, and a class of bug — see §25.7.2 |
| **R48** | Typing the name **crams the UI** | §10.12 | **A bug.** The keyboard leaves ~120 CSS px and nothing responded to that |
| **R49** | Main-game items are **blocked** | §10.1, §23.4.2 | **A bug**, seven of them — see §25.7.2 |
| **R50** | *"Why accept tests didn't catch these?"* | **§25.7.3** | Answered, and the gate is fixed rather than the answer being an excuse |

#### 25.7.1 §21.0c — Run 1 carries one idea

**The whole of R43, R44 and R46 in one sentence: everything §4.11 onward added to the game is
a system, and Run 1 is not about systems. It is about one lever.**

§21.0's thesis is that the player builds a mental model out of nothing but evidence — *more
developers, more speed* — and then watches it kill the company. §6's lesson only lands if that
model was theirs. By the end of the 2026-08-11 batch, Act I was also carrying a defect counter
that appeared on the fourth poke and named a job the player could not hire for, a hire dial
offering two professions before the player had hired one person, a tickets bar with nothing in
it, and an `UPGRADES` button onto a tree whose root node had already been given away in a
cutscene. None of those is wrong. All of them are wrong **there**.

So the first Paradigm Shift is the door, and it is the right door for a reason that is not
merely tidiness. §13.1's shift is already the moment the game stops being a straight line and
becomes a set of systems; §24.5 already gates offline accrual on it; §13.2 already gates the
Paradigm Tree on it. These join a list rather than starting one.

| System | Run 1 | Run 2+ |
|---|---|---|
| §4.11 QA / Support / SRE on the dial | Absent | As §4.11's table, when the problem appears |
| §4.12–§4.13 defects, incidents, tickets | **Not simulated at all** | Full |
| §4.14 release rating and reputation | Stamped at §4.14.1's anchor — every multiplier exactly x1 | Live |
| §11 the studio tech tree | No door, no nodes | Opens, with §11.5's node granted |
| §21.7.1 James arrives | **Yes** — he is a person, not a system | Already here |
| §21.6 Instant Messenger | No | The first thing after the shift |

Two consequences worth stating because they are not obvious:

**Run 1 ships at the baseline by construction, not by accident.** A studio with an empty defect
bench scores *better* than §4.14.1's anchor, so letting the live rating run during Run 1 would
hand every first-run release a quality bonus and quietly re-tune the economy §21 is paced
against — §25.6.2a measured *Flappy Square* at $45 and that number has to stay measured. The
run stamps the anchor and the baseline instead.

**James is not gated.** He is the one thing in this list that is not a system: he is a person
who sits down at the second desk. The distinction the whole section draws is between mechanics
and story, and he is the story.

#### 25.7.1a §21.6 takes Instant Messenger back

§25.6's batch moved §11.5's node into Act I on the argument that the joke is better when the
two of them are visibly side by side at two desks. **The joke is better there.** It was still
the wrong trade, and the reasoning is worth keeping because it is a general one: a joke that
costs an act its shape is not cheap because the joke is good. In Run 2 they are still sitting
side by side — that was never a fact about which act it was in — so the scene survives the move
without a word changed, and Act I gets §21.7.1 and nothing else.

The scene id `scene.run2.instant-messenger` has never changed through either rewrite. It keys
§24.3's `milestones`, and renumbering it would replay a scene for every player who has already
sat through one.

#### 25.7.2 R45, R47 and R49 — the defects, and what they have in common

Seven, and six of them are the same mistake in six places: **a container was allowed to be
smaller than its contents, and nothing was watching.**

| Where | What | Why |
|---|---|---|
| `identity.ts` | Act I sat a randomly generated stranger at James's desk | `developerAt` returned `JAMES` at index **1**. §21.0b made him the free *first* hire, and `scenes.ts`, the §22.3 LOYAL guard and §7.8.1b's seat rule had all been written against seat 0 while this one line still said 1 |
| `founderSetup.css` | `MOUSTACHGOATEE` | Four equal columns in a fieldset about 160 px wide, and a nine-character label. The count is now a **ceiling**, and the floor comes from the labels themselves |
| `founderSetup.css` | The action bar over BODY COLOUR, and over the name field | `position: sticky` in a screen that always scrolls means *always floating*. The scroll moved into the trait grid; the buttons became an ordinary final row |
| `app.css` | §21's advisor copy rendered **13 px wide** | The right grid track was `minmax(rail, auto)`. `--hud-overhang` describes the limit and nothing enforced it |
| `app.css` | The incident chip printed a release name over `OFF SALE` | Two levels of flex/grid automatic minimum size. `min-width: 0` on the name, `minmax(0, 1fr)` on the list |
| `Button.tsx` | `HIRE` above `DEVELOPER`; `HIRE 1,000 / DEVS / NOW` | `.ui-btn__label` is a grid and `ConceptText` returns *inline pieces*, one per tracked noun — so the grid gave each noun a row. It looked deliberate, which is why it survived every screenshot of the trap |
| `app.css` | Both rails ran off the bottom of every frame in §23.4.2's box | §4.15's three backlogs, a role dial and a `PARADIGM` button joined a rail budget measured to nine pixels of slack. 649 px of content in a 426 px column |

The last one is the only one that needed a decision rather than a fix, and §10.1a records it.

#### 25.7.2a §10.1a — what a rail gives up, and in what order **[CANON]**

Measured at 997x448 with everything live: the right rail wanted 649 px against 426. At
748x336 — the bottom of §23.4.2's box — the left rail wanted 478 against 314. That is not a
spacing problem and no amount of shaving padding reaches it, so the rails now have a stated
order in which content gives way, and three structural rules that stop the question recurring.

**The rules.**

1. **A rail may not draw outside itself.** Both rails are `overflow: hidden`. Clipping is not
   the fix and nothing in the design box is clipped; this is the backstop that turns the next
   regression into something visibly missing from a rail rather than something painted across
   §21's script.
2. **The overhang is a limit.** The right grid track is capped at `rail + overhang` rather
   than `auto`, so the rail can never take width from the copy again.
3. **The play tools pack, they do not stack.** §10.1's controls are a wrapping row: they take
   as many rows as the rail's width requires, at any size, with no hand-placed arrangement to
   go stale. The arrangement they replaced had been measured correctly and then had three
   controls added to it.

**The order.** Within a backlog: *that there is a problem* and *who fixes it* are never
dropped; the release name, the defect density and the `OFF SALE` tag are the courtesy and go
first. Across the rail, at 470 px and again at 400: second readings before first ones — a
nameplate repeating a name the player typed, an arithmetic breakdown of a number printed
directly above it, §23.3's instrumentation, and §4.5d's corner shortcut for a gesture the game
teaches in its first thirty seconds. §10.1's nav, §10.10's dial, the action button and every
readout survive to the bottom of the box.

**And §4.15's three backlogs moved into one column.** They shipped split across the two rails —
defects with the burn-down, incidents and tickets under SHIPPED — on the reasoning that the
latter two are facts about the *catalogue*. That reasoning is sound and it loses to §4.15's own
thesis: three numbers that all go up and all mean "something is wrong" are three copies of one
anxiety unless they can be read as a set, and split across sixty degrees of arc they are not a
set. It also happens to be the hundred pixels the right rail needed, which is the rare case
where the composition and the budget want the same thing.

**§4.13's ticket bar is now silent while the studio is keeping up**, on exactly the rule §4.12's
defect counter already followed at zero. A row that is always there is not "ambient"; it is the
loudest kind of furniture, because it teaches the player to stop reading the part of the rail
that will one day say FALLING BEHIND.

#### 25.7.3 R50 — why the gate passed

**The gate existed, ran in a real Chrome at real phone sizes, and passed.** Four reasons, each
a different class of hole, all now closed:

1. **It only asked about containment.** Its one question was whether a box had left the frame.
   Two boxes drawn on top of each other are both inside it. Every defect above was invisible to
   the only question being asked.
2. **It was not in `npm run check`.** `check` was `lint && tsc -b && vitest run && art:check`;
   the browser gate was a script nobody ran. So even the containment half was gating nothing.
3. **Its component list was a hand-maintained allowlist**, and nothing the batch added was on
   it. A list you have to remember to update is a list that is out of date.
4. **It never visited a frame where the HUD was full.** Every case was Act I or Act II on a
   fresh save — no offer, no dial, no backlogs, no prestige. A rail budget only fails when the
   rail is full. Its one keyboard case called `focus()` at full viewport height, which
   reproduces nothing about a keyboard.

**The unit suite is not at fault and could not have been.** jsdom has no layout engine:
`getBoundingClientRect` returns zeroes, so no vitest test in this repository can see a layout
defect at all. That division of labour is correct — vitest owns behaviour, the browser gate
owns geometry — and it only works if the browser gate runs. It runs now.

What the gate does now: overlap between anything sharing a layer (text measured on its em box,
so leading is not a false positive), containment as before, five frame sizes instead of three
including one just *above* the 400 px breakpoint, a `?full` fixture that puts the HUD into its
worst state, and a keyboard case that actually shrinks the viewport. It was verified by
reintroducing two of the defects above and watching it fail on each.

### 25.8 Intake — 2026-08-15 **[CANON]**

**The largest intake this document has taken, and the first one that is mostly not a
requirement.** It opens by asking for a roadmap — *"instead of piecemeal progression, we need a
clear roadmap"* — and then supplies three phases, twenty-nine specific things, and a pacing
table. §26 is the roadmap. This is the ledger.

| # | Reported | Owner | Resolution |
|---|---|---|---|
| **R51** | Heroes must be **extremely distinct** from other developers in the main game | **§7.8.13** | **Specified.** A hero is the one person on the floor whose behaviour never changes |
| **R52** | Heroes come with **own skill trees** — a real tree, from an origin, branching out | §13.9 | **Already canon, and it is one tree.** See §25.8.3 |
| **R53** | Heroes **level up** | **§13.13** | **Specified.** XP becomes levels; a level is a point |
| **R54** | Hero acquisition paced **with the story**; QA, SRE and Cloud introduced by storylines involving James; **after the first prestige** | §21.7.3, **§13.6.5a**, §13.12.2 | Already canon. §13.6.5a removes the wall that stopped it being built |
| **R55** | Defect and ticket mechanics **must not appear before their heroes** | **§21.7.6** | **Specified, and it generalises two existing rules.** See §25.8.1 |
| **R56** | Hero information as a **trading-card-game card**, in the art style, interesting to look at | **§22.9** | **Specified.** A laminated staff pass designed by somebody who wanted it to be a trading card |
| **R57** | Different **text colours and UI components** for defects, incidents and tickets | §4.15 | Already canon. §21.7.6b changes only *when* each colour arrives |
| **R58** | Dialogue focuses on the speaker, **facing the camera** | §10.7a.1 | Already canon, **and built** |
| **R59** | Speech subtitle **bigger, more in the middle** | §10.7a.2 | Already canon, **not built.** §26.1.3 |
| **R60** | Instant Messenger is the **first upgrade**, with the **same visual** in the tree | §11.5 | Already canon |
| **R61** | Author **a new set of stories** going forward from the first James scene | §21.7 | Already canon — five arrivals and a promotion. §21.7.6 adds the handover beat to each |
| **R62** | 1,000 SP alone is **too brutal**; James free at ~50 clicks | §21.0b | Already canon, **and built** |
| **R63** | The six heroes, their classes and their effects; **Melany's effect unspecified** | §22.8, §13.9.2 | Already canon. Melany bends §4.2's cap and invoices for it |
| **R64** | **One shared tree**, branched into five areas; story hires arrive pre-clicked; the player upgrades as they see fit | §13.9, §13.9.1 | Already canon — six branches, not five: Cloud was added as the sixth |
| **R65** | Heroes generate **XP, like the founder** | §13.10, §13.13 | Already canon; §13.13 completes it |
| **R66** | Heroes **slotted onto units** — block of 100, floor, building — modifying that unit's output; **design a way to display assignment** | §13.6.2, §13.8, §13.11, **§7.8.12** | Already canon. The display is the executive suite plus §13.11's three views |
| **R67** | **Promotion** built into the story — *Global Head of His Desk* | §21.7.4 | Already canon |
| **R68** | `UPGRADE` opens **the tree**; unlocking one reveals others; a guide layer on tap | §11.4.2, §11.4.3 | Already canon, **and built** |
| **R69** | Upgrades **scale with prestige**, not available at the start | §11.4.6 | Already canon, **and built** |
| **R70** | Tree **starts in the middle**, grows in all directions, **right angles**, one node per level | §11.4.1 | Already canon, **and built** |
| **R71** | **Icons** for the upgrades | §11.4.4 | Already canon, **and built** — procedural, 16×16 |
| **R72** | Purchase has **visual and sound juice** | §11.4.5 | Already canon, **and built** |
| **R73** | The upgrades screen is **bigger, without saying it** | §11.4.1 | Already canon, **and built** — the board is panned, not captioned |
| **R74** | An **executive suite** where the heroes sit, separate from the rank and file | **§7.8.12** | **Specified.** The walls arrive around the desk the founder never left |
| **R75** | **Prestige pacing targets** — a table of run durations per phase | **§13.12** | **Specified**, with one conflict resolved. See §25.8.2 |
| **R76** | **Scale-up**: approximate above the block of 100, generate individuals on click, aggregate the `+1`s, unit-level speech | **§26.2** | Phase 2 |
| **R77** | **Slack-off minigame**: leaving costs output, draggable while moving, walkways not desks, real destinations, **windows**, walk back rather than teleport, struggle when held | **§26.3.1** | Phase 3 |
| **R78** | Displaced developers **flash for a split second** on hire | **§26.3.2** | Phase 3. The move-out is virtual; §26.3.1's walking makes the fix free |
| **R79** | More **event minigames** — a buy/sell trading game framed as a crypto punt | **§26.3.3** | Phase 3, with §26.3.4's constraint |
| **R80** | **Monetisation decided early and built into the loop** — ad points, freemium offerings, considered while designing the loop rather than after | **§3.1** | **Specified**, and it found three collisions and one cliff. See §25.8.5 |

#### 25.8.1 R55 is not a UI note

**It arrived as one — *"the defect mechanics should not appear before their heroes"* — and it is
the general form of a rule this document had already found twice and written down as two special
cases.** §11.5 found it for the tech tree: James brings the board, and *"the door and the thing
behind it arrive together."* §21.0c found it for everything at once and gated the lot on
`paradigmShifts > 0`.

**The shift was standing in for a person**, because when §21.0c was written there were no people
to wait for. §21.7.6 names what it was standing in for, and the reason this is worth the section
rather than a line is that it converts a *gate* into a *story beat*: the same three bars, hidden
for the same reason, now arrive in somebody's hands instead of appearing when a counter ticks.

The apparent circle — Mo is triggered by defects, and defects are gated on Mo — is resolved in
§21.7.6a by splitting the mechanism from the instrument. **The mechanism runs from the first
frame of Run 2. Only the instrument waits.** The player meets defects as a release they were
proud of scoring 31, which is a problem with no handle, which is what makes the person holding
the handle relief rather than a tutorial.

#### 25.8.2 R75's table conflicts with §21, and §21 wins

The pacing table asks for a first run of **1–3 hours**. §21's Run 1 is **about four minutes**,
and the README has said so since the vertical slice.

**That is a real conflict and it is resolved by noticing that §21's four minutes are not a run.**
They end in a bankruptcy the player cannot avoid: nothing was steered and the ending was written
before the player arrived, so by the table's own terms it is a prologue. §13.12.2 states the
mapping — the table's "first steered run" is **Run 2** — and every subsequent row shifts by one.

**This is the answer to a question §21.0c left open**, which is what makes it a resolution rather
than a dodge. §21.0c gates five systems and a hero ladder behind the first Paradigm Shift and
never says what they open *into*. Landing all of that in a four-minute run would be a pile.
Landing it across the ninety minutes §13.12.1 gives the first steered run, one arrival at a time,
each triggered by a problem the player just felt, is precisely the arc §21.7 describes.
**The gate and the pacing were always one decision, made twice, at different times, without
either half knowing about the other.**

> **Run 2's actual length has never been measured.** It is asserted nowhere and it is Phase 1's
> last acceptance item (§26.1.8). If it measures at twenty minutes, the economy moves — not the
> table.

#### 25.8.3 Fourteen of the twenty-nine were already canon, and that is the finding

R52, R57–R58, R60–R73 are already in this document, and eight of them are already **built**. That
is not a complaint about the intake — a player reporting what they want from a build is doing
exactly the right thing, and they should never have to check whether it is written down.

**It is a finding about the project**, and it is the same one §26.0 opens with. The gap between
this document and the build is no longer a specification gap. R52's *"heroes should come with
their own skill trees, like a real tree, start from origin and branch out"* describes §13.9 to
the word, and §13.9's board is implemented and tested in `sim/heroTree.ts` — with **no UI**,
because the currency that was supposed to buy its nodes belongs to a prestige layer that does not
exist. The specification was right, the sim was built, and the player cannot see any of it.

That is what §26's phases and gates exist to stop, and it is why every gate in §26 is written as
something a player does rather than something that has been committed.

#### 25.8.5 R80 — what a companion document cannot see

`MONETISATION.md` has been complete and correct since before the vertical slice, and being
correct beside the GDD rather than inside it hid four things:

**Three collisions.** A persistent HUD button for the workhorse placement, against rails
§10.1a spent to the pixel. A views-per-day benchmark that is really a function of run length,
which nothing stated until §13.12. And the highest-intent offer in the game attached to a
prestige that §13.12.1 makes last one to three days.

**And one finding that neither document could reach alone.** §3.1.3's late-game inventory
cliff: at 24–72 hours per run, every run-attached placement fires about once a day, so the
late game's inventory has to be **session-shaped rather than run-shaped** — which makes
§24.8's Overnight Build Report the late game's primary placement and puts a real design
requirement on it (*it has to stay worth opening at every scale*). MONETISATION.md cannot see
that, because it does not know how long a run is. §13 could not see it, because it was not
counting placements.

**What did *not* move.** Prices, revenue mix, eCPM assumptions, store phasing, the metrics
list and the launch plan are not design and stay where they are. §3.1 takes only the part
that is a claim on a screen, a moment or a pacing decision.

The pleasing part, and the reason this was cheap: **the monetisation gate and the design gate
turned out to be the same gate.** MONETISATION §4 says no offer before the first Paradigm
Shift; §21.0c says no system before the first Paradigm Shift; §21.7.6 says no instrument
before its hero. Nothing had to be reconciled — it had already been decided twice, by two
people looking at different things.

#### 25.8.4 What §13.6.5a unblocks

One sentence in §13.6.5 — *"cards are acquired with GP"* — written before §22.8 existed, was
holding up **six** items on this intake (R53, R54, R56, R65, R66, R74), because a hero nobody can
own needs no card, no levels, no placement and nowhere to sit.

§22.8 and §21.7.3 had already stopped it being true; neither went back and said so. §13.6.5a says
so. **The story roster is free and the collection long tail is bought**, Layer 2 moves to Phase 2
where it belongs, and the whole of §26.1 becomes buildable.

> The general lesson, recorded because this is the second time it has cost a session: **when a
> section supersedes another section's rule, the superseded rule must be amended in place.** A
> correction that lives only in the new section is invisible to everybody reading the old one,
> including the person implementing it.

### 25.2 What is deliberately NOT decided here

R2's distribution shape, R5's corridor width and R7's unfold timing are all numbers that want
play-testing rather than a spec. This section records **what must be true**; the sections it
points at record what it must be true *of*. Where a number is genuinely arbitrary, it is
marked as a first guess in the owning section rather than being written here as if it were
canon.

---

## 26. The Delivery Roadmap **[CANON — added 2026-08-15]** - R51–R79

### 26.0 Why this document needed one

**This document specifies a finished game and, until now, said nothing about the order it gets
built in.** That was survivable while the work was a spike and it stopped being survivable
somewhere around §13.9. The batches of 2026-08-10 and 2026-08-11 each landed four or five
systems; every one of them was correct; and the result on a handset was §25.7 — seven layout
defects, a Run 1 that had lost its shape, and a hero layer whose two UI components could not be
built because the currency that buys them does not exist yet.

None of that was a failure of specification. **It was a failure of ordering**, and the shape of
it is always the same: a system arrives before the thing it needs, so it is built half-way, and
the half that is missing is the half the player can see.

So there are three phases, they are ordered, and each one has a **closing gate** — a short list
of things that must be true before the next phase may start. The gates are the point. A phase
without one is a heading.

| Phase | The one sentence | Closes when |
|---|---|---|
| **1 — The core loop** | **The game can be played from the first tap to the third prestige without hitting a system that is not there.** | §26.1.8 |
| **2 — Scale** | **The same game, at a hundred million developers, at sixty frames a second.** | §26.2.5 |
| **3 — Life** | **The floor is a place people work in rather than a grid people are drawn on.** | §26.3.5 |

**The ordering is not a preference.** Phase 2 is a set of approximations, and an approximation
can only be validated against the exact thing it approximates — so the exact thing has to work
first, or Phase 2 is approximating a guess. Phase 3 is ambient behaviour layered onto units,
and §26.2's level-of-detail rules decide what a unit *is* — so building the behaviour first
means building it twice.

> **What this section must never become: a schedule.** There are no dates here and there will
> not be any. A phase closes when its gate passes, and the gate is written in terms of what a
> player can do, not in terms of what has been committed.

---

### 26.1 Phase 1 — Complete the core game loop

**The thesis: every system this document describes as part of the loop exists, is reachable,
and is introduced by somebody.** Not "is specified" — §26.0 is the evidence that specification
is not the constraint. Reachable, on a phone, by a player who has never read this file.

Phase 1 is mostly *connective*. Almost every mechanism below is already written down and much
of it is already built; what is missing is that the pieces do not yet form a line the player
can walk from end to end.

#### 26.1.1 The pacing this phase is built against

§13.12 is the target and it is the first thing in Phase 1, because **every other item on this
list is sized by it.** A hero ladder that has to breathe across an hour is a different piece of
work from one that has to fit in four minutes, and until §13.12 was written down the game was
being built against the four.

#### 26.1.2 Heroes

| | What | Where |
|---|---|---|
| **Distinct in the world** | A hero is the one person on the floor whose behaviour never changes, and they are legible as such at every rung without a label | §7.8.13, §7.8.11 |
| **The executive suite** | Heroes have a place. It is built around the desk the founder has been sitting at since the garage, and it is where an unplaced hero visibly is | §7.8.12 |
| **One tree, six branches** | The shared centre-out board, right angles, one node per level, a hero's starting position is what makes them who they are | §13.9, §11.4 (same grammar) |
| **Levels** | XP earned from covered work becomes levels; a level is a point; a point buys a node | §13.13 |
| **The card** | A trading-card face that shares nothing with §7.8.8's personnel record, because the whole requirement is that heroes are *not* developers | §22.9 |
| **Placement** | Slotted onto a rung of §7.7's ladder — a block of 100, a floor, a building — modifying that unit's output, with coverage drawn rather than stated | §13.6.2, §13.8, §13.11 |
| **Free, not bought** | §26.1.6 — the six story heroes arrive; they are not GP purchases, which is what unblocks all of the above | §13.6.5a |

#### 26.1.3 The story

The arc §21.7 specifies, built: James at the fiftieth poke, Instant Messenger at the first
shift, five arrivals each gated on a feeling, and the promotion. Plus the two things §21.7 asks
for that the presentation layer does not yet do — the camera closing on the speaker with their
face turned to it (§10.7a.1, built), and **the subtitle at the size §10.7a.2 already specifies**
(R59, not built).

#### 26.1.4 The systems, and who brings them

§21.7.6 is the load-bearing new rule of this phase and it is stated once here because it
changes what "done" means for four different systems:

> **A system enters the game in the hands of the person who solves it.** Defects arrive with
> Mo, incidents with Serena, tickets with Matt. Before their hero, the system is simulated and
> silent — it is felt as a consequence, never displayed as an instrument.

#### 26.1.5 The upgrade tree

Built (§11.4, `UpgradeBoard.tsx`). What Phase 1 owes it is the **verification** that it behaves
as §11.4 says at the sizes §23.4.2 requires: centre-out, right angles, silhouette ring, guide
layer on tap, ring-gated by prestige, procedural icons, two-part purchase cue, and larger than
the viewport without a word of copy saying so.

#### 26.1.6 The decision this phase forces

**§13.6.5 buys hero cards with GP, GP is Layer 2, and Layer 2 does not exist.** That is why
`HeroBoard.tsx` and `RosterStrip.tsx` were correctly *not* built in the 2026-08-13 session, and
it is a wall directly across the middle of Phase 1.

**It is resolved by §22.8 rather than by building Layer 2.** The six story heroes are given by
the story — §21.7.3 says so in a table — so they were never GP purchases, and the sentence in
§13.6.5 was written before §22.8 existed. §13.6.5a records the split: **the story roster is
earned in scenes; GP buys §22.5's collection long tail.** Layer 2 is now a Phase 2 concern and
nothing in Phase 1 waits on it.

#### 26.1.7 Monetisation is a Phase 1 shape, not a Phase 2 integration

§3.1 folds `MONETISATION.md`'s placements onto the loop moments they attach to, and §3.1.6 is
the list of what Phase 1 owes it. **None of it is advertising.** It is five shapes — a report
that defers its collect, a board that can name the cheapest node you cannot afford, an event
that knows it is clearable, a modal with room for a second button, and the `paradigmShifts`
gate they all sit behind.

Every one is cheap now and a retrofit later, and none is wasted if the revenue mix changes.
**The SDK, the store and the metrics are Phase 2** (MONETISATION §10 owns that plan) and
nothing in Phase 1 waits on them.

**§3.1.4 is the one item Phase 1 cannot close**: the CONTRACTOR SURGE needs a persistent
control and §10.1a says both rails are full. The recommendation is to attach it to the ship
moment instead of making it furniture — it is the only option that costs no pixels — but it
is a composition decision and it is listed under "blocked on a human" rather than assumed.

#### 26.1.8 Phase 1's closing gate

Every line is a thing a player does, in order, without leaving the game:

1. Create a founder, play §21's prologue to the forced bankruptcy, and take the first Paradigm
   Shift.
2. Open `UPGRADES`, find Instant Messenger at the centre, buy a ring-1 node, and see the board
   grow.
3. Ship a release bad enough to bring Mo, and watch the defect backlog appear **with her** and
   not before.
4. Do the same for Serena and Matt.
5. Hit the developer cap with cash spare, meet Melany; read past `CHATTY`, meet Billy.
6. Open any hero's card, spend a level on a node in a branch that is not theirs, and see the
   number that node governs change.
7. Place a hero on a block of 100 and see the coverage drawn on the floor; place a second of
   the same branch overlapping and see the waste hatched.
8. Promote James and get §21.7.4.
9. Prestige again, and again, with §13.12's run lengths measured rather than asserted.
10. §3.1.6's shapes are in place — three of the five were already true, item 2 is built, and
    item 3 waits on §18's events being a system at all.

**`npm run check` green throughout, including the browser gate at all five frame sizes.**

---

### 26.2 Phase 2 — UI and compute scale-up

**The thesis: the simulation stops tracking developers and starts tracking units, and the
player cannot tell.**

#### 26.2.1 The problem, stated honestly

§7.7 already builds a ladder to a galaxy and §4.2 already caps a run at a hundred million
developers. **Nothing in the current build survives either.** Individuals are simulated
individually, drawn individually, and interrupted individually; the room holds a few hundred
before the frame budget in §23.3 is gone, and the design asks for eight orders of magnitude
more than that.

#### 26.2.2 The rule

**Above the block of 100, a unit is the simulated body and the people inside it do not exist
until somebody looks.**

| Rung | Simulated as | Individuals exist? |
|---|---|---|
| Desk, row | Themselves | **Yes.** Every one, as now |
| **Block of 100** | One aggregate: headcount, role mix, output, entropy contribution | **On demand** |
| **Floor of 10,000** | One aggregate over blocks | On demand, through the block |
| Building and above | One aggregate over floors | On demand, through the floor |

**On demand means procedurally generated at the moment of the click, from the unit's seed, and
discarded when the camera leaves.** §7.8.7 already generates identity without a database — the
same generator, given `(unitSeed, index)`, produces the same person every time it is asked,
which is what makes a person the player poked yesterday still be that person today without a
byte of storage.

#### 26.2.3 What the player sees instead

The feedback layer changes register with the rung, and this is the half that makes the
approximation invisible rather than merely fast:

- **`+1` becomes `+56`.** A block does not emit a hundred numerals; it emits one, for what the
  block did. §4.5's poke follows the same rule and §4.8 already scales its payout this way.
- **A speech bubble belongs to the unit**, not to a person inside it, at any rung above the
  row. §19's library gets a register per rung — a floor does not say *"I can't push my code"*;
  a floor says something a floor would say.
- **Zoom in and it resolves.** The aggregate's numbers have to *equal* the sum of the
  individuals it generates, or the player catches the game lying the first time they check.
  That equality is the acceptance test for the whole phase.

#### 26.2.4 What else lands here

Layer 2 (§13.3, GP) and §22.5's collection long tail, because §26.1.6 moved them here; §13.5's
hundred-million gate, which is unreachable before this phase by construction; and the §7.7
rungs above 3, which have never had a populated scene because nothing could populate them.

#### 26.2.5 Phase 2's closing gate

1. A save at 100,000,000 developers loads, runs at §23.3's frame budget, and the speedometer
   reads what §4.1 says it should.
2. From that save, the camera zooms from galaxy to a single desk without a stall, and the
   person at that desk has a name, a face and a history.
3. Zoom back out and in again: **the same person**.
4. A block's stated output equals the sum of the hundred people it generates, to the last
   story point.
5. Poking at every rung pays what §4.8 says.

---

### 26.3 Phase 3 — Jazz it up

**The thesis: the studio is a place.** Everything in this phase is optional to the loop and
none of it is optional to the game being liked.

#### 26.3.1 The slack-off minigame

The floor's ambient life (§7.8.6) is currently a set of poses. Phase 3 makes it a system with a
cost and a counterplay:

| | |
|---|---|
| **Leaving costs output** | A developer away from their desk produces nothing. This is the mechanic; everything else is presentation |
| **They go somewhere real** | The water machine, the whiteboard (in twos and threes), the window. **Floors get windows**, which they do not have |
| **They walk, they do not pass through** | Movement is on walkways — along and across the desk grain, never through it — and it is quicker than the current drift |
| **You can drag them** | Off their desk, for mischief, and back to it, for profit. §7.8.9's carry gesture already exists |
| **They walk back** | A dragged developer returns to their desk on foot. They do not teleport, which is what the current build does and what makes the floor feel like a spreadsheet |
| **They struggle** | Held in the air, a developer wriggles. This is the entire joke and it is worth the animation |

#### 26.3.2 The hire flash

**When a hire displaces somebody, the displaced sprite flashes for a frame.** Reported, and the
diagnosis is that the move-out is virtual — the seat's occupant is recomputed and redrawn
rather than moved. §26.3.1's walking makes the fix free: a displaced developer *walks* to their
new seat, so there is nothing to flash.

#### 26.3.3 Event minigames

§18's random events currently resolve as a banner and a number. A few of them earn an
interaction — the first is the **buy/sell trading game, framed as a crypto punt**, which is a
line chart, two buttons and a countdown, and which is funny for exactly the reason it is
inadvisable. Rules: never mandatory, never punishing to skip, never longer than ninety seconds,
and never the best way to make money (§26.3.4).

#### 26.3.4 The standing constraint

> **No minigame may be the optimal way to play.** The moment the trading game out-earns the
> studio, the game is about the trading game. Everything in Phase 3 is amplitude on a loop that
> already works without it — which is the same rule §13.6.7 applies to heroes, and it applies
> here for the same reason.

#### 26.3.5 Phase 3's closing gate

1. A developer leaves their desk, does something with a purpose, and comes back — and the
   output readout shows the dip.
2. Drag one off; they struggle; put them down anywhere; they walk back.
3. Hire into a full row and watch nobody flash.
4. Every floor has windows, and the light through them agrees with §7's single source.
5. One event minigame, playable, skippable, and worse than working.

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

> ### Re-scoped against `mercilessstudio-platform`, 2026-08-07
>
> The first draft of this register treated every gap as this project's to solve. **Most of
> them are already solved at studio level** and the playbook (§23.1b) owns them: cloud save
> transport, Firestore rules, RevenueCat, restore purchases, consent ordering, content
> rating, privacy policy, listing-as-code. Three shipped games have paid for those lessons
> and `TRAPS.md` records what went wrong.
>
> **Every row below is therefore narrowed to the part the platform cannot know** — the values,
> not the mechanism. Re-specifying a mechanism the playbook already covers is itself a defect.

### F.1 Blockers — the game cannot ship without these

| # | Gap | Platform provides | **What is still ours** |
|---|---|---|---|
| ~~**F1.1**~~ | ~~**Save**~~ | — | **CLOSED — owned by §24.** The save document, the three-tier split, the per-field monotonic merge, and what each prestige layer resets |
| ~~**F1.2**~~ | ~~**Offline progression**~~ | — | **CLOSED — owned by §24.** 2h starting cap, 50% rate, SP accrues and payroll does not, the closed-form model, and the Overnight Build Report. §24.10 is what goes back to `playbook/SAVE.md` §5 |
| **F1.3** | **Age rating & target audience** | The submission process and the questionnaire mechanics (`PLAY_STORE.md`) | ⚠️ **The answers**, and the consequence: declaring child appeal forces the Families policy and bans personalised ads, so it changes the AdMob configuration the playbook sets up. Decide before the ad stack is built |
| **F1.4** | **Privacy policy & data deletion** | Policy hosting and the Play requirement (`PLAY_STORE.md`, `MONETIZATION_SETUP.md`) | ⚠️ **The data inventory** — what this game actually collects beyond the studio baseline. **The in-app deletion entry point is now built** (§10.9.7's RESET, two presses, and the second one says what it erases); what is still open is the inventory and the cloud half, which does not exist until `game-cloud` is wired |
| **F1.5** | **Restore purchases** | RevenueCat's restore flow (`MONETIZATION_SETUP.md`) | ⚠️ **The UI entry point only.** Not in §10.9's menu and not in the §F2.1 settings screen, because neither exists |

### F.2 Major gaps — shippable, but visibly unfinished

| # | Gap | Platform provides | **What is still ours** |
|---|---|---|---|
| ~~**F2.1**~~ | ~~**Settings screen**~~ | — | **CLOSED — owned by §10.9.7.** Music and effects volumes on the §20 mixer, haptics, a three-way reduce-motion preference that can override the OS in *both* directions, and reset progress. Held **outside** §24's save document on purpose: a prestige resets the run, a Codebase Fork erases the lot, and a volume slider must survive both — it must also be readable before the store loads so the first sound the game makes is already at the chosen volume. Restore purchases (F1.5) is still absent rather than stubbed, because there is no RevenueCat in this build and a button that cannot restore anything is a worse answer than an honest gap |
| **F2.2** | **Localisation** | — | ❌ Undecided, not decided-against. §10.7's per-character typewriter behaves differently in CJK and §18/§19/§21 are almost entirely wordplay. **Record English-only**, or it gets decided by accident |
| **F2.3** | **Error and empty states** | `TRAPS.md` records the failures that actually happen in production | ❌ What the *screen* does when an ad fails to load, an IAP goes pending, the network is gone, a cloud save conflicts, or a save is corrupt |
| **F2.4** | **Push notifications** | Firebase messaging is available in the stack | ❌ Whether we use them at all, and what they say. Interacts directly with F1.2 |
| **F2.5** | **Store listing assets** | Listing-as-code and ASO guidance (`PLAY_STORE.md`, `MARKETING.md`) | ⚠️ **The art.** Icon, feature graphic, screenshots — a real art requirement outside §22.7's 19-sprite cap, and the icon is the most-viewed asset the project will produce |
| **F2.6** | **App lifecycle** | — | ⚠️ What the game does on backgrounding, a call, or audio-focus loss. Also where F1.1 and F1.2 meet: backgrounding is when a save must happen and when the offline clock starts |

### F.3 Smaller, still real

| # | Gap | Note |
|---|---|---|
| ~~**F3.1**~~ | **Credits content** | **CLOSED — owned by §10.9.7.** The licence is `?raw`-imported from the file that ships in the bundle rather than pasted in: a copy can drift from the text actually governing the font, and the failure mode of that drift is a licence violation no test can see. Importing the real file also makes the bundler prove it is present |
| **F3.2** | **Analytics event schema** | MONETISATION §12 lists metrics, Appendix D says instrument the Run 1 funnel *"heavily"*, PROJECT_SETUP §8 step 11 has it as an open task. No event names or properties exist, so two people will invent two |
| **F3.3** | **Tutorial beyond Run 1** | §21 scripts Run 1 exhaustively. Nothing teaches the tech tree, org chart or Multiverse grid when they first unlock |
| **F3.4** | **Live-ops / remote config** | MONETISATION §10 requires every ad placement behind remote config. No schema, no defaults, no fetch-failure behaviour |

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
- **All cross-game infrastructure** — `mercilessstudio-platform` (§23.1b). Cloud save
  transport, Firestore rules, RevenueCat, consent ordering, Play release, listing-as-code
  and a cross-game trap log, paid for by three shipped games

### F.5 How to use this

**Close a gap by writing the specification into the body of this document**, then strike the
row here with the section number that now owns it. Do not close a row by building the
feature — an undocumented feature is the same failure this appendix exists to catch, arriving
from the other direction.

**F1 is ordered.** F1.1 and F1.2 were the ones with architectural reach: save shape and the
offline model both constrain the store, and both were cheaper to decide before the tech tree
and prestige layers added state that has to persist. **Both are now closed by §24**, which is
why the remaining F1 rows are all store-and-policy work rather than design work.
