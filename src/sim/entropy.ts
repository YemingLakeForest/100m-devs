/**
 * Communication Entropy — GDD §4.1–4.3.
 *
 * The load curve is the mathematical heart of the game: total output rises,
 * peaks below capacity, and then *falls*. That falling half is The Mythical
 * Man-Month stated as a derivative, and it is why hiring 1,000 developers on
 * Run 1 bankrupts you.
 *
 *   L = D / D_cap          communication load
 *   eta(L) = 1 / (1 + L^p)  efficiency factor
 *   E = 1 - eta             the player-facing Entropy readout
 */

/**
 * Overhead exponent (rho). GDD §4.1: "the single most important tuning knob in
 * the game" — how violently the studio collapses past capacity.
 */
export const RHO = 5

/** Base developer capacity, GDD §4.2. Low enough to force Run 1 entropy lock. */
export const D_BASE = 100

/** Prestige scaling multiplier (mu), GDD §4.2. */
export const MU = 1000

/** Compression exponent (phi), GDD §4.2. */
export const PHI = 1.35

/** One developer at full efficiency produces 1 SP/sec. Every number hangs off this. */
export const SP_PER_DEV_PER_SEC = 1

/** GDD §4.3: at this Entropy the speedometer slams into ENTROPY LOCK. */
export const ENTROPY_LOCK_THRESHOLD = 0.999

/** Communication load — headcount against the capacity comm tech can sustain. */
export function load(devs: number, devCap: number): number {
  if (devCap <= 0) return Infinity
  return devs / devCap
}

/**
 * Efficiency factor eta. 1.0 is every developer producing their full
 * 1 SP/sec; it approaches 0 as the studio outgrows its infrastructure.
 */
export function efficiency(devs: number, devCap: number): number {
  const l = load(devs, devCap)
  if (!Number.isFinite(l)) return 0
  // L^RHO overflows to Infinity long before eta would round to anything but 0,
  // and Infinity would poison the division, so short-circuit.
  const overhead = l ** RHO
  if (!Number.isFinite(overhead)) return 0
  return 1 / (1 + overhead)
}

/** E = 1 - eta. The Entropy Speedometer readout, GDD §4.3. */
export function entropy(devs: number, devCap: number): number {
  return 1 - efficiency(devs, devCap)
}

export function isEntropyLocked(e: number): boolean {
  return e >= ENTROPY_LOCK_THRESHOLD
}

/**
 * Passive output of the swarm — the first half of Velocity (GDD §4.4).
 * D * eta, in SP/sec.
 */
export function passiveVelocity(devs: number, devCap: number): number {
  return devs * efficiency(devs, devCap) * SP_PER_DEV_PER_SEC
}

/**
 * Developer capacity from allocated Blueprint points — GDD §4.2.
 *
 *   D_cap = D_base * (1 + mu * BP^phi)
 */
export function devCap(blueprintPoints = 0, base = D_BASE): number {
  if (blueprintPoints <= 0) return base
  return base * (1 + MU * blueprintPoints ** PHI)
}

/**
 * The headcount that maximises total output — GDD §4.1.
 *
 *   D_optimal = D_cap * (rho - 1)^(-1/rho)   ~= 0.76 * D_cap at rho = 5
 *
 * It sits *below* capacity, which is the point: every hire past it makes the
 * company slower.
 */
export function optimalHeadcount(cap: number): number {
  return cap * (RHO - 1) ** (-1 / RHO)
}

/** Best achievable output at a given capacity — about 0.61 * D_cap at rho = 5. */
export function bestOutput(cap: number): number {
  const d = optimalHeadcount(cap)
  return passiveVelocity(d, cap)
}

/**
 * The capacity needed to run `devs` developers at a target efficiency —
 * the inverse of {@link efficiency}, and the real shape of the 100M gate.
 *
 *   eta = 1 / (1 + L^rho)  =>  L = (1/eta - 1)^(1/rho)  =>  D_cap = D / L
 *
 * GDD §4.2 states the gate as "L ~= 0.40, and therefore D_cap >= 2.5e8". That
 * is the rounded form: L is exactly 0.39892, so 2.5e8 delivers 98.99%, a
 * hair *under* the 99% the gate asks for. The true threshold is 2.5068e8.
 * Deriving it here rather than hard-coding 2.5e8 keeps the gate honest if rho
 * is ever retuned — and rho is explicitly the knob most likely to move.
 */
export function capacityForEfficiency(devs: number, targetEfficiency: number): number {
  if (targetEfficiency <= 0) return 0
  if (targetEfficiency >= 1) return Infinity
  const l = (1 / targetEfficiency - 1) ** (1 / RHO)
  return devs / l
}

/**
 * Local entropy from a poke — GDD §4.9, the context switch penalty.
 *
 * A poked developer is temporarily worse than their peers. This is what stops
 * the clicker layer being a mash: local entropy multiplies *against* the
 * studio-wide efficiency, so more input really does mean more overhead.
 */
export const CONTEXT_SWITCH_COEFFICIENT = 0.02

/** Seconds for a poked developer's local entropy to decay back to baseline. */
export const LOCAL_DECAY_SECONDS = 8

/** eta_dev = eta(L) * 1 / (1 + E_local) — GDD §4.9. */
export function devEfficiency(globalEta: number, localEntropy: number): number {
  return globalEta / (1 + localEntropy)
}

/**
 * Exponential decay of a developer's local entropy.
 *
 * §4.9 specifies "~8 seconds to baseline". Exponential decay never literally
 * reaches zero, so LOCAL_DECAY_SECONDS is treated as the time to fall to ~2%
 * of the starting value — indistinguishable from baseline in play, and it
 * keeps the decay smooth rather than snapping at a cutoff.
 */
export function decayLocalEntropy(localEntropy: number, dtSeconds: number): number {
  if (localEntropy <= 0) return 0
  const decayed = localEntropy * Math.exp((-4 * dtSeconds) / LOCAL_DECAY_SECONDS)
  return decayed < 1e-4 ? 0 : decayed
}
