# Monetisation Strategy — *100000000 Developers*

Companion to [`GDD.md`](./GDD.md). Everything here is new work — it is not part of the
original design drafts.

**Studio context this is written against:** solo/small-budget developer; Capacitor mobile
stack; existing shared packages `@mercilessstudio/game-monetise` (AdMob via
`useAdMobInit` / `useRewardedAd` / `useInterstitial`, RevenueCat via `usePremium`) and
`@mercilessstudio/game-cloud` (Play Games + Firebase). The plan below is deliberately
implementable with those packages as they stand — no new SDK integrations required for
v1.0.

---

## 1. The One-Paragraph Version

Idle games monetise on **rewarded video**, not IAP — target a 70/30 ad-to-IAP revenue
split at launch. The three highest-value rewarded placements are *doubling offline
earnings on return*, *a global production surge*, and *a bonus on the prestige payout*.
Sell **Multiverse dimensions** as the primary IAP, because §17 of the GDD already specced
six of them as palette-swap-plus-one-rule re-skins — the highest margin content this
project can possibly produce. Wrap the entire storefront in the game's corporate satire
(funding rounds, procurement forms, investor pitches) so the monetisation is *part of the
joke* rather than an interruption to it. And protect the Early Game Trap absolutely: never
sell a way past it.

---

## 2. Design Guardrails — What Must Never Be Sold

This game has an unusually fragile progression spine. Six things are load-bearing, and
selling any of them collapses the design.

| Never sell | Why it breaks the game |
|---|---|
| **A way past the Early Game Trap** (GDD §6) | The first 3–5 runs failing *is the tutorial and the thesis*. A "Skip the Bankruptcy" IAP would sell the player out of the only lesson the game teaches, and would read as cynical to exactly the audience (developers) most likely to notice. |
| **Bandwidth Points / Git Points / Planck Cores directly** | The three prestige layers (GDD §13) are the entire long-term structure. Direct currency sale flattens L1→L2→L3 into a credit card, and the yield formulas in GDD §14 are tuned assuming earned currency. |
| **Entropy immunity or an entropy cap raise** | Entropy *is* the game. Selling relief from it is selling the removal of gameplay. |
| **Anything that substitutes for Communication Infra upgrades** | The core lesson (GDD §6.1.3) is "comm tech dictates workforce capacity, not cash." A cash-for-capacity purchase inverts the game's central joke. |
| **Hero Cards, duplicates, or promotions — in any randomised or purchasable form** | GDD §22.6 makes this a hard line. A card collection is exactly where a game like this drifts into gacha, and a developer audience will punish it harder than any other. Cards are earned through milestones only. Cosmetic frames and alternate portraits are sellable; the cards themselves are not. |
| **A shortcut to the 100,000,000 gate** | The title gate (GDD §13.5) requires 100M devs *at 100% efficiency*, which is a test of whether the player has understood the core system. Selling a bypass sells the ending. |

**Corollary — no loot boxes, no gacha, no randomised paid rewards.** Beyond the ethics,
they now carry disclosure requirements on both stores, active regulatory attention in the
EU and Brazil, and an age-rating penalty. This game does not need them; it has better
things to sell.

**The safe rule:** sell **time**, **convenience**, **cosmetics**, and **content** — never
**capability the design requires you to earn**.

---

## 3. Revenue Model & Mix

| Stream | Share of revenue (target) | Role |
|---|---|---|
| **Rewarded video** | ~60% | Primary earner. Voluntary, high-frequency, well-matched to idle pacing. |
| **Interstitial** | ~10% | Small, tightly capped. Real risk of harming retention if over-used. |
| **One-time IAP** | ~20% | Dimension packs, Remove Ads, starter pack. |
| **Subscription** | ~10% at launch, growing | Ships *after* retention is proven, not at v1.0. |

Planning benchmarks (2026, blended global, use as ranges not promises):

- Rewarded eCPM **$6–14** (US-heavy audiences trend to the top of that; this game skews
  developer/US/EU, which helps materially).
- Well-placed idle games see **3–8 rewarded views per DAU per day**.
- Blended **ARPDAU $0.05–0.15**.
- IAP conversion **1.5–3%**; subscription conversion **0.5–2%** of installs.

Worked example at a modest scale — 4,000 DAU, 5 rewarded views/DAU, $9 eCPM:
`4,000 × 5 × ($9 / 1000) = $180/day` from rewarded alone, ≈ **$5.4k/month**, before IAP.
Halve it for a pessimistic case, double it for a good one. Most solo idle games without
paid UA never reach 4,000 DAU — treat user acquisition, not monetisation tuning, as the
binding constraint on revenue.

---

## 4. Rewarded Video Placements

All placements use in-fiction naming. This is not decoration — diegetic ad offers measurably
reduce the "I'm being sold to" friction, and this game's premise makes them free jokes.

| # | In-game name | Trigger / placement | Reward | Cap | Notes |
|---|---|---|---|---|---|
| **R1** | **OVERNIGHT BUILD** | On app open after ≥30 min away, on the offline-earnings summary | **2× offline earnings** | 1 per return, max 4/day | The single highest-value placement in any idle game. Must be the *first* thing a returning player sees, above the collect button. |
| **R2** | **EMERGENCY CONTRACTOR SURGE** | Persistent HUD button, greyed during cooldown | **+100% total dev output for 30 min**, stacking additively with in-run multipliers | 1 active at a time, 6/day | The workhorse. Cooldown = duration, so an engaged player re-ups continuously. |
| **R3** | **PITCH TO INVESTORS** | Cash-starved state (can't afford next Branch A/B node for >60s) | Instant cash = **30 min of current production** | 3/day | Contextual, so it appears exactly when it's wanted. Never offer when the player is flush. |
| **R4** | **BANDWIDTH GRANT** | On the *Trigger Paradigm Shift* confirm modal (GDD §15.1), beside `[ REWRITE CODEBASE ]` | **+20% BP** on this shift | 1 per prestige, 5/day | Highest-intent moment in the game — the player has already decided to sacrifice everything. The $\gamma = 0.20$ damping in GDD §14.1 keeps this from inflating the curve. |
| **R5** | **AUTO-POKE DRONE** | HUD, unlocked after first Paradigm Shift | **10 min of auto-poking** at 25 pokes/sec | 4/day | Now one of the strongest offers in the game, since poking generates Story Points directly (GDD §4.5). Must stay materially weaker than the owned *Subatomic Auto-Poker* node (L1-3B, 100/sec) so it never devalues a 10,000 BP purchase. Auto-pokes still incur the Context Switch Penalty — this buys a rate, not an exemption. |
| **R6** | **PAGERDUTY ESCALATION** | Inside an active Slack Storm / entropy event | Auto-clears the event | 3/day | Sells *convenience*, not power — the player could have tapped it out. Ideal for lapsed-attention moments. |
| **R7** | **DIMENSION TRIAL** | On a locked Multiverse dimension (Layer 3) | Play that dimension free for **one run** | 1/day per dimension | Doubles as the storefront demo. Trial-to-purchase is the main conversion path for dimension packs. |
| **R8** | **SEVERANCE PACKAGE** | On an *unintended* bankruptcy — **locked until after the player's 5th run** | Retain **25% of pending BP** | 2/day | **Hard-gated so it can never appear during the scripted Run 1–3 trap.** See §2. |

### Placement rules

- **No rewarded offer of any kind before the first Paradigm Shift.** Acts I–V of the
  onboarding script (GDD §21) run clean. The first ad the player ever sees should be R1 on
  their second session, or R4 on the confirm modal — both after the lesson has landed.
- Every offer states the exact reward and duration on the button face. No "?" rewards.
- Failed/abandoned ad loads must grant nothing but must never block the underlying action.
- Pre-cache aggressively: idle players open the app for 20 seconds. A rewarded offer that
  isn't ready when the offline summary renders is revenue that does not exist.

---

## 5. Interstitials

The riskiest stream for a game whose Layer 1 prestige loop can be **minutes** long (GDD §13.1).
An interstitial on every prestige would be intolerable.

**Rules:**

- **Never before the first Paradigm Shift.** (Protects onboarding.)
- **Never on the bankruptcy screen.** That is an emotional story beat and the tutorial's
  punchline; an ad there is the single most churn-inducing placement available.
- **Never during** an entropy event, mini-game, or the Stamp Frenzy / Notification Storm.
- Frequency cap: **1 per 5 minutes**, hard ceiling **8/day**, and a **90-second grace
  period** on every app open.
- Trigger only on natural breaks: returning to the Swarm view from a menu, or every *third*
  Paradigm Shift (not every one).
- Fully removed by the **Remove Forced Ads** IAP and by subscription.

Ship v1.0 **with interstitials disabled behind a remote flag.** Turn them on at v1.1 and
A/B the retention delta. If D7 moves more than 2 points against you, leave them off — the
rewarded stream is worth more than the interstitial stream in this genre anyway.

---

## 6. In-App Purchases

### 6.1 The catalogue

| SKU | Price | Type | Contents |
|---|---|---|---|
| **SEED ROUND** (starter pack) | $2.99 | One-time, offer-gated | +50% permanent cash multiplier, 24h Contractor Surge, 3 Dimension Trials. Offered once, ~48h after the player's first successful Paradigm Shift. |
| **REMOVE FORCED ADS** | $4.99 | One-time | Removes all interstitials permanently. **Does not remove rewarded offers** — see §6.2. |
| **DIMENSION PACK** (each) | $3.99 | One-time | One Multiverse dimension: art palette, audio stems, signature mod, dimension-specific events. |
| **WARDROBE PACK** | $1.99 | One-time, cosmetic | Alternate Hero Card frames and portrait variants — including *Hawaiian Shirt James*, which still has the hole in the elbow. Cosmetic only; no card, duplicate, or promotion is ever sold. |
| **MULTIVERSE BUNDLE** | $9.99 | One-time | All four paid dimensions. Discounted vs. buying separately. |
| **FOUNDER'S EQUITY** | $9.99 | One-time | Permanent +25% cash production, +10% BP yield, exclusive `[FOUNDER]` HUD badge. |
| **THE IPO** | $34.99 | One-time | Everything: all dimensions, Remove Ads, Founder's Equity, all subscription perks permanently. The "I like this, stop asking me" tier. |

### 6.2 The Remove-Ads trap (important)

In an ad-driven idle game, a naive "Remove Ads" purchase is **negative EV** — it converts
your highest-LTV, most engaged players (the ones watching 8 rewarded videos a day) into
players generating $4.99 total.

**Do it this way instead:**

- "Remove Forced Ads" removes **interstitials only**. Rewarded offers remain available and
  are clearly labelled *optional*.
- Buyers additionally get **one free auto-grant of R1 (Overnight Build) per day** without
  watching. This makes the purchase feel generous, and it costs one ad impression.
- Never label the SKU just "Remove Ads" — label it **"REMOVE FORCED ADS — keep optional
  bonuses"** so the distinction is on the button, not buried in a description.

### 6.3 Why dimensions are the anchor SKU

Per GDD §17, each Multiverse dimension is explicitly designed as a **palette swap + audio
stems + one mechanical twist + a handful of text events**. That is:

- the cheapest content this project can produce, by a wide margin;
- fully aligned with the low-animation / static-pixel-art constraint;
- gated behind Layer 3, so only deeply engaged players even see the storefront;
- naturally extensible as live-ops.

**Recommended split:** ship **Cyberpunk Sub-Grid** and **8-Bit Retro Realm** free (they're
the two strongest hooks and they demonstrate the format), and sell **Medieval Alchemy
Coders**, **Silicon Nebula**, **Paperwork Bureaucracy Realm**, and **Post-Singularity
Hivemind**.

Then add **one new dimension every 6–8 weeks** as paid live-ops. Seasonal ones write
themselves: *Crunch Season*, *Y2K Remediation Realm*, *Hacktoberfest Dimension*,
*The Blockchain Years*. This is recurring revenue at near-zero art cost — the defining
advantage of this design.

### 6.4 No premium currency

The game already has four currencies: `$`, BP, GP, PC. **Do not add gems.** A fifth
currency whose only source is a credit card would be both confusing and tonally wrong.
Sell entitlements and effects directly, priced in real money. This is simpler to build,
simpler to reason about, and avoids the entire "currency bundle" dark-pattern surface.

---

## 7. Subscription — The Funding Rounds

**Ship at v1.1, not v1.0.** A subscription before retention data is a commitment to
content cadence you can't yet size. Get D7/D30 first.

**Name:** *SERIES A* (monthly) — consistent with the SEED ROUND → SERIES A → IPO ladder,
and immediately legible to the target audience.

Implemented with `usePremium({ entitlement: "series-a" })` from
`@mercilessstudio/game-monetise` (RevenueCat), matching the house pattern already used for
GeoDaily Plus.

| Price | $4.99/mo, or $34.99/yr (~42% saving) |
|---|---|

**Benefits:**

1. No forced interstitials.
2. **Offline accrual cap 4h → 16h**, and offline rate +50%. *(This is the benefit that
   actually retains subscribers in idle games — everything else is garnish.)*
3. Daily **BOARD MEETING** bonus: one free R1 + one free R2 auto-granted, no ad.
4. One **exclusive subscriber dimension**, rotating quarterly.
5. Multi-device cloud save + 3 backup save slots (see §7.1).
6. `[SERIES A]` HUD badge and terminal colour scheme.
7. 2× Bandwidth Grant cap (R4: 5/day → 10/day).

### 7.1 Cloud save — a decision to make

House convention (GeoDaily) gates cloud save behind the Plus entitlement. **I'd recommend
deviating here.** In an idle game a lost save is not an inconvenience, it's the loss of
weeks of progress — it produces refund requests, one-star reviews, and permanent churn.

**Recommendation:** basic single-slot cloud save **free** for everyone (via
`@mercilessstudio/game-cloud` + the existing Firebase/Anonymous-auth setup); subscription
adds **multi-device sync and 3 named backup slots**. You keep a real subscription benefit
without holding progress hostage.

---

## 8. Making the Storefront Part of the Joke

The game is a satire of corporate software development. The store should be too. This is
cheap (text and UI panels — no new art), it is the kind of thing that gets screenshotted
and shared, and it converts better than a generic gem shop because it does not break the
fiction.

- The shop is the **PROCUREMENT PORTAL**, styled as the CRT terminal HUD from GDD §21. It
  opens with a boot-scan reveal, never an instant appearance — the transition rules in
  GDD §10.5 apply to the storefront exactly as they apply to everything else.
- Purchases are **budget approvals**: `PO #4471 — REQUISITION APPROVED. Thank you for your business.`
- The subscription paywall is a **term sheet**, with the price in a "valuation" box.
- Rewarded ads are **investor pitches**: `[ PITCH TO INVESTORS (2 min) ]`.
- Restore Purchases is **`git pull --tags`**.
- Post-purchase confirmation: *"Your capital has been deployed. Communication Entropy is
  unaffected. It is always unaffected."*

**Be self-aware, not defensive.** A game whose entire thesis is "throwing money and people
at a problem doesn't work" that then sells you multipliers is funny *if you say so first*.
One honest line in the shop header — something like *"Yes, we see the irony. Buy the thing
anyway."* — buys enormous goodwill with a developer audience. Trying to hide it does the
opposite.

**Hard line:** the satire covers the framing, never the mechanics. Prices, subscription
terms, renewal dates, and cancellation must be stated plainly and un-ironically. Joke
copy on a real payment flow is a store-review rejection and, more importantly, a genuine
dark pattern. Also keep "SERIES A" / "IPO" obviously fictional — no implication of a real
financial instrument or return.

---

## 9. Ad Pacing & The Retention Curve

Idle games live or die on **long-horizon retention** — a D30 player is worth many times a
D1 player because ad revenue accrues daily and compounds with session frequency.

- **Sessions 1–3: zero ads.** No exceptions. The onboarding trap (GDD §21) needs a clean run.
- **Day 2–7:** rewarded offers only. Interstitials still off.
- **Day 8+:** interstitials enabled at the §5 caps.
- Never interrupt: the Bankruptcy screen, any mini-game, the prestige confirm modal (R4
  sits *beside* the confirm button, it does not gate it), or the first 90s of any session.

**Instrument the bankruptcy beat specifically.** The design deliberately fails players 3–5
times. That is a retention cliff by construction, and it is the single most important
number in the game. If Run-1 → Run-2 continuation is below ~70%, the trap needs softening
(a warmer *"everyone fails this"* message, a clearer BP reward preview) — **not** a paid
escape hatch.

---

## 10. Implementation Plan

Against the existing packages — no new SDKs for v1.0.

```
@mercilessstudio/game-monetise
  useAdMobInit()    → app boot, after UMP/ATT consent
  useRewardedAd()   → R1–R8 placements
  useInterstitial() → §5, behind a remote kill-switch
  usePremium()      → entitlements: "remove-ads", "founders-equity",
                      "dim-alchemy" | "dim-nebula" | "dim-paperwork" | "dim-hivemind",
                      "series-a", "ipo"

@mercilessstudio/game-cloud
  cloudDoc     → save + entitlement mirror (server-side truth for restores)
  leaderboard  → "Fastest Release Time" / "Peak Dev Count" (retention, not revenue)
```

Notes:

- Consume both by **git tag** per house convention; `git fetch --tags` first — the local
  sibling checkouts run behind the published tags. Requires **Capacitor ≥ 8**.
- Mirror RevenueCat entitlements into the Firestore save doc so an offline player keeps
  their purchases, and so restores survive a reinstall without a network round-trip.
- Gate every ad placement behind a **remote config flag** so caps and placements can be
  tuned without a store release. Non-negotiable — you will get the caps wrong first time.
- Put **UMP (GDPR/consent)** and **ATT** prompts before `useAdMobInit`, not after. Prompt
  ATT on session 2, not session 1 — opt-in rates are materially higher once the player
  knows what the game is.
- AdMob alone is fine at launch. Revisit mediation only once you're consistently past
  ~5k DAU; below that the integration cost outruns the eCPM lift.

---

## 11. Launch Phasing

| Phase | Ships | Rationale |
|---|---|---|
| **v1.0** | R1, R2, R4 rewarded. SEED ROUND, REMOVE FORCED ADS. Interstitials built but flagged **off**. | Smallest surface that earns. Three placements is enough to validate eCPM and accept-rate before building more. |
| **v1.1** (+6 wks) | R3, R5, R6, R8. Interstitials on + A/B. SERIES A subscription. | Only after D7/D30 are known. Subscription needs a content cadence you can now size. |
| **v1.2** | Layer 3 ships → DIMENSION PACKS, MULTIVERSE BUNDLE, R7 trial, FOUNDER'S EQUITY, THE IPO. | Dimensions can't be sold before the endgame that contains them exists. |
| **Live-ops** | One new dimension every 6–8 weeks; seasonal variants. | The recurring-revenue engine, at near-zero art cost. |

---

## 12. Metrics To Instrument From Day One

**Monetisation**
- ARPDAU, split ad vs. IAP; rewarded views per DAU; **accept rate per placement** (R1–R8 separately — this is what you tune)
- eCPM by placement and geo; fill rate; ad-load failure rate
- IAP conversion by SKU; subscription trial→paid; churn by month

**Progression (leading indicators of everything above)**
- **Run 1 funnel: Act I → Act V completion**, and **Run-1 → Run-2 continuation** ← the most important number in the game
- % reaching first Paradigm Shift; runs to first shift
- Time to Layer 2 (Codebase Fork); time to Layer 3
- **Pokes per session and SP-from-poke vs. SP-from-swarm ratio** — if active SP share collapses after the early game, the clicker layer has stopped mattering and the Fibonacci ladder needs re-tuning
- **Time from ~10M to 100M devs** (the title gate) — the most likely dead zone in the progression
- Hero Cards owned and org-chart slots filled, by cohort week
- Offline return rate; median offline duration (this sizes the R1 cap and the subscription's accrual benefit)
- Session length and sessions/day by cohort week

**Health**
- D1 / D7 / D30 by cohort, split by ad-exposure variant
- Churn immediately following: bankruptcy screen, first interstitial, first paywall view

---

## 13. Risks

1. **The trap vs. the funnel.** Deliberately failing players 3–5 times is a bold design
   choice and a real retention risk. Mitigate with tone and clarity, never with a paid skip.
2. **Prestige-loop ad fatigue.** If Layer 1 shifts happen every few minutes, R4 and the
   every-third-shift interstitial can feel relentless. Cap by *time* as well as by count.
3. **Audience irony sensitivity.** Developers are the most ad-literate, adblock-native
   audience there is. The self-aware framing (§8) is a mitigation, but a bad placement will
   be noticed and posted about faster here than in any other genre.
4. **Remove-Ads cannibalisation.** Addressed in §6.2, but re-check the LTV of Remove-Ads
   buyers vs. non-buyers after 60 days; if buyers are worth less, raise the price rather
   than removing the SKU.
5. **Subscription content debt.** A rotating exclusive dimension every quarter is a
   standing commitment. Don't ship the subscription until the dimension pipeline has
   demonstrably produced two of them on schedule.
6. **UA is the real constraint.** None of this matters below a few thousand DAU. The
   game's best organic asset is its premise — a developer-audience joke that markets itself
   on Hacker News, r/programming, and dev social media. Budget effort for that launch beat
   accordingly; it is worth more than any tuning in this document.
