/**
 * The adaptive score — GDD §20.7, the Web Audio path.
 *
 * §20.7.1's core claim: "the game has no tracks. It has stems." Every stem is
 * written in the same key, at the same tempo, in the same bar length, which
 * is what lets all nine of them play at once, all the time, at volumes the
 * simulation sets — the player never hears a transition because there never
 * is one, they hear the mix change. That means this file has no "play track
 * X" API at all; it has one continuous mix, recomputed every frame from
 * (camera Z, Entropy, Act IV state) plus two one-shot stingers.
 *
 * This is the file src/audio/sfx.ts's header comment points at: the poke SFX
 * live on native audio (GDD §23.2 non-negotiable 1) because Web Audio can
 * carry 100-300 ms of latency in an Android WebView against a 60 ms budget.
 * Music and ambience live here, on Web Audio, precisely because 100 ms is
 * inaudible on a bed that fades rather than triggers. That split is
 * deliberate and this file must not grow a native path.
 *
 * The mix is split into two halves on purpose:
 *   - Pure functions (zoneBedGains, strainLayerGains, actIVEnvelope, mix) —
 *     the actual musical logic, gain curves and crossfade weights, unit
 *     tested in music.test.ts with no Web Audio involved.
 *   - MusicBus — the thin, untested wiring that loads buffers, drives
 *     GainNodes from the pure mix, and must not throw when the files it
 *     wants (public/music/*.mp3, from scripts/generate-music.ts) don't exist
 *     yet. They don't, as of this writing, and the game must run silently
 *     rather than crash — every load failure is caught and logged, never
 *     thrown.
 */

import { lodWeights } from '../render/omniLens.ts'
import { getSettings, subscribeSettings } from '../settings/settings.ts'
import type { ZoomLevel } from '../sim/poke.ts'

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

// ---------------------------------------------------------------------------
// Zone beds — GDD §20.7.2, four beds crossfaded by camera Z.
// ---------------------------------------------------------------------------

/** Stems match scripts/generate-music.ts and public/music/*.mp3. */
export const ZONE_BEDS = ['bed-desk', 'bed-floor', 'bed-global', 'bed-cosmic'] as const
export type ZoneBed = (typeof ZONE_BEDS)[number]

/**
 * §10.9 / §20.7.2a — the title bed.
 *
 * Deliberately NOT a zone bed. It is the only stem that plays outside the
 * gameplay mix, and it hands over to `bed-desk` on a crossfade under the
 * camera push into the room (§10.9.4), never a cut. Kept separate so it can
 * never be picked up by `zoneBedGains` and mixed into the game by accident.
 */
export const TITLE_BED = 'bed-title' as const

/**
 * Gain for the title bed and for the gameplay mix as a whole, during the
 * hand-off. `t` runs 0 (title) to 1 (in the room).
 *
 * They sum to 1 at every point, so the hand-off is a crossfade and never a gap
 * — §10.5's "nothing cuts" applied to the one transition every player makes.
 */
export function titleHandoffGains(t: number): { title: number; gameplay: number } {
  const u = Math.min(1, Math.max(0, t))
  const eased = u * u * (3 - 2 * u)
  return { title: 1 - eased, gameplay: eased }
}

/**
 * Zone 0-3 (§20.2) map onto ZoomLevel 1-4 (§7.4) one-for-one — the levels are
 * the zones. Keyed off {@link ZoomLevel} rather than repeated here so a
 * renumbering upstream cannot silently desync bed from picture.
 */
const BED_FOR_LEVEL: Record<ZoomLevel, ZoneBed> = {
  1: 'bed-desk',
  2: 'bed-floor',
  3: 'bed-global',
  4: 'bed-cosmic',
}

/**
 * Bed crossfade weights at camera Z. §20.7.3: "the same weights as §20.3's
 * DSP matrix and §7's LOD cross-fade... picture, ambience and music change
 * register on the same frame — that is the point of sharing the band edges."
 * `lodWeights` in src/render/omniLens.ts *is* that shared curve (it already
 * bakes in BAND_EDGES), so it is reused rather than re-derived — a second,
 * slightly different crossfade curve here would be exactly the drift §20.7.3
 * exists to prevent, even if nobody meant it.
 */
export function zoneBedGains(z: number): Record<ZoneBed, number> {
  const levelWeights = lodWeights(z)
  const out = {} as Record<ZoneBed, number>
  for (const level of [1, 2, 3, 4] as const) {
    out[BED_FOR_LEVEL[level]] = levelWeights[level]
  }
  return out
}

// ---------------------------------------------------------------------------
// Strain layers — GDD §20.7.2 & §20.7.3, three layers mixed in by Entropy.
// ---------------------------------------------------------------------------

export const STRAIN_LAYERS = ['layer-calm', 'layer-strained', 'layer-collapse'] as const
export type StrainLayer = (typeof STRAIN_LAYERS)[number]

interface StrainKnot {
  layer: StrainLayer
  /** Entropy [0, 1] at which this layer peaks. */
  center: number
  /** Distance from center at which this layer has faded to nothing. */
  halfWidth: number
}

/**
 * §20.7.3: "calm at E < 10%, strained peaking around 40-70%, collapse from
 * 90% up." These knots are tuned to that prose rather than derived from it —
 * there is no single formula three named ranges reduce to, so the widths are
 * chosen so each range in the spec is where the smoothstep test below says it
 * should be:
 *   - calm: full at E=0, past its shoulder by E~0.1, exactly zero by E=0.35.
 *   - strained: the only layer left once calm has faded and before collapse
 *     has started (E in [0.35, 0.85]), which spans and exceeds the 40-70%
 *     window the spec names — "peaking" reads here as a plateau, not a spike.
 *   - collapse: exactly zero below E=0.85 (halfWidth=0.15 from center=1), so
 *     nothing pre-empts the Act IV override — it only ever appears "from 90%".
 */
const STRAIN_KNOTS: StrainKnot[] = [
  { layer: 'layer-calm', center: 0, halfWidth: 0.35 },
  { layer: 'layer-strained', center: 0.55, halfWidth: 0.3 },
  { layer: 'layer-collapse', center: 1, halfWidth: 0.15 },
]

/** Same smoothstep falloff as lodWeights — continuous in value and slope. */
function smoothFalloff(d: number): number {
  return d >= 1 ? 0 : 1 - d * d * (3 - 2 * d)
}

/**
 * Strain layer crossfade weights at Entropy E. Normalised to sum to 1, same
 * reasoning as {@link zoneBedGains}: without it the overlap between layers
 * would read as a loudness pulse, which is the "something cut" artefact
 * §10.5 forbids applied to the score instead of the picture.
 */
export function strainLayerGains(entropy: number): Record<StrainLayer, number> {
  const e = clamp01(entropy)
  const raw = {} as Record<StrainLayer, number>
  let total = 0

  for (const knot of STRAIN_KNOTS) {
    const d = Math.abs(e - knot.center) / knot.halfWidth
    const w = smoothFalloff(d)
    raw[knot.layer] = w
    total += w
  }

  if (total === 0) {
    // Unreachable at the tuned widths above — every E in [0,1] sits inside at
    // least one knot's window — but a silent bed is a worse failure than a
    // wrong one, so fail toward the nearest knot rather than divide by zero.
    const nearest = STRAIN_KNOTS.reduce((a, b) =>
      Math.abs(e - a.center) <= Math.abs(e - b.center) ? a : b,
    )
    const fallback = { 'layer-calm': 0, 'layer-strained': 0, 'layer-collapse': 0 } as Record<
      StrainLayer,
      number
    >
    fallback[nearest.layer] = 1
    return fallback
  }

  for (const knot of STRAIN_KNOTS) raw[knot.layer] /= total
  return raw
}

// ---------------------------------------------------------------------------
// Stingers — GDD §20.7.2, one-shots, not part of the continuous mix.
// ---------------------------------------------------------------------------

export const STINGERS = ['sting-promotion', 'sting-paradigm'] as const
export type Stinger = (typeof STINGERS)[number]

// ---------------------------------------------------------------------------
// Act IV override — GDD §20.7.4, the one scripted exception to §10.5.
// ---------------------------------------------------------------------------

/** All zone beds duck to zero over this long — "not a fade, a drop." */
export const ACT_IV_DROP_MS = 120
/** The gap: nothing but the §21 impact, siren and chatter. */
export const ACT_IV_GAP_MS = 400
/**
 * Not specified by §20.7.4 beyond "comes up" — a literal instant jump from
 * silence to full would be its own audible click, so `collapse` gets the same
 * short ramp the drop uses, just running the other direction. Symmetric with
 * ACT_IV_DROP_MS on purpose: one number to reason about, not two.
 */
export const ACT_IV_COLLAPSE_RISE_MS = ACT_IV_DROP_MS

export interface ActIVEnvelope {
  /** Multiplies every zone bed's gain. 1 = untouched, 0 = silent. */
  bedGain: number
  /** The collapse strain layer's gain once it comes up alone. */
  collapseGain: number
}

/**
 * The Act IV timeline as a pure function of milliseconds since Mass Hire.
 * Negative input means "not triggered" — beds untouched, collapse silent —
 * so callers can pass a real elapsed time and let this function decide
 * whether the override is even active yet.
 */
export function actIVEnvelope(elapsedMs: number): ActIVEnvelope {
  if (elapsedMs < 0) return { bedGain: 1, collapseGain: 0 }

  const bedGain = elapsedMs >= ACT_IV_DROP_MS ? 0 : 1 - elapsedMs / ACT_IV_DROP_MS

  const collapseStartMs = ACT_IV_DROP_MS + ACT_IV_GAP_MS
  let collapseGain = 0
  if (elapsedMs >= collapseStartMs) {
    collapseGain = Math.min(1, (elapsedMs - collapseStartMs) / ACT_IV_COLLAPSE_RISE_MS)
  }

  return { bedGain, collapseGain }
}

// ---------------------------------------------------------------------------
// The mix — a pure function of (camera Z, Entropy, Act IV state).
// ---------------------------------------------------------------------------

export interface MixState {
  beds: Record<ZoneBed, number>
  layers: Record<StrainLayer, number>
}

/**
 * The whole score, reduced to nine gain values. `actIVElapsedMs` is `null`
 * before Mass Hire fires and a real (possibly negative-clamped-to-active)
 * number afterwards — see {@link actIVEnvelope}.
 */
export function mix(z: number, entropy: number, actIVElapsedMs: number | null): MixState {
  const beds = zoneBedGains(z)

  if (actIVElapsedMs === null) {
    return { beds, layers: strainLayerGains(entropy) }
  }

  const { bedGain, collapseGain } = actIVEnvelope(actIVElapsedMs)
  const duckedBeds = {} as Record<ZoneBed, number>
  for (const bed of ZONE_BEDS) duckedBeds[bed] = beds[bed] * bedGain

  // §20.7.4: collapse comes up ALONE, not blended with the entropy-driven
  // mix it would otherwise be in. By Act IV, Entropy is already pinned near
  // its cap and strainLayerGains would land here anyway — but forcing it
  // makes the cut deterministic on the scripted beat rather than hostage to
  // the sim's exact E on the frame Mass Hire fired.
  return {
    beds: duckedBeds,
    layers: { 'layer-calm': 0, 'layer-strained': 0, 'layer-collapse': collapseGain },
  }
}

// ---------------------------------------------------------------------------
// MusicBus — the Web Audio wiring. Not unit tested; the mix above is.
// ---------------------------------------------------------------------------

type LoopStem = ZoneBed | StrainLayer
const LOOP_STEMS: readonly LoopStem[] = [...ZONE_BEDS, ...STRAIN_LAYERS]

/**
 * Drives Web Audio GainNodes from {@link mix}. Every stem is loaded and
 * looped independently and silently (gain 0) at startup — §20.7.1 says they
 * are "all playing, all the time" — and {@link update} only ever changes
 * gain, never starts or stops a source, so there is no restart to be heard.
 */
export class MusicBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private readonly gains = new Map<LoopStem, GainNode>()
  private readonly stingerBuffers = new Map<Stinger, AudioBuffer>()
  /** ctx.currentTime (ms) at which triggerActIV() was called, or null. */
  private act4StartMs: number | null = null
  /** Unsubscribe for the F2.1 music volume. Held so `unload` can let go. */
  private offSettings: (() => void) | null = null
  private suspendedByPage = false
  private lifecycleBound = false

  private readonly suspendForPage = () => {
    if (!this.ctx || this.ctx.state === 'closed') return
    this.suspendedByPage = true
    void this.ctx.suspend().catch(() => {})
  }

  private readonly resumeForPage = () => {
    if (!this.ctx || !this.suspendedByPage || this.ctx.state === 'closed') return
    this.suspendedByPage = false
    void this.ctx.resume().catch(() => {})
  }

  private readonly onVisibility = () => {
    if (document.hidden) this.suspendForPage()
    else this.resumeForPage()
  }

  private bindLifecycle() {
    if (this.lifecycleBound || typeof document === 'undefined' || typeof window === 'undefined') return
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('pagehide', this.suspendForPage)
    window.addEventListener('pageshow', this.resumeForPage)
    this.lifecycleBound = true
  }

  private unbindLifecycle() {
    if (!this.lifecycleBound || typeof document === 'undefined' || typeof window === 'undefined') return
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('pagehide', this.suspendForPage)
    window.removeEventListener('pageshow', this.resumeForPage)
    this.lifecycleBound = false
    this.suspendedByPage = false
  }

  /**
   * Boots the bus and starts every stem looping at zero gain. Must never
   * throw: no audio files exist yet as of this writing, and a crash here
   * would take the whole game down over a missing asset directory. Safe to
   * call more than once (unload() first if a real re-init is wanted).
   */
  async init(): Promise<void> {
    if (this.ctx) return

    // `typeof AudioContext` rather than a bare reference: this file also
    // gets imported under vitest/jsdom, which does not define the global,
    // and a direct reference to an undeclared identifier throws before the
    // guard even runs.
    if (typeof AudioContext === 'undefined') {
      console.warn('[music] Web Audio unavailable in this environment — running silent.')
      return
    }

    try {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      this.bindLifecycle()
      this.onVisibility()
      // Appendix F2.1 — the music half of the §20 mixer. It lands on the master
      // node rather than on the stems because the simulation owns every stem
      // gain frame by frame (§20.3's DSP matrix), so a player preference
      // written there would be overwritten on the next tick. One node above all
      // of them is the only place a volume can survive the mix.
      this.master.gain.value = getSettings().music
      this.offSettings = subscribeSettings((s) => {
        if (this.master) this.master.gain.value = s.music
      })
    } catch (err) {
      console.warn('[music] AudioContext failed to start — running silent.', err)
      this.ctx = null
      this.master = null
      return
    }

    await Promise.all(LOOP_STEMS.map((id) => this.startLoop(id)))
  }

  private async fetchBuffer(id: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null
    try {
      const res = await fetch(`/music/${id}.mp3`)
      if (!res.ok) return null
      const data = await res.arrayBuffer()
      return await this.ctx.decodeAudioData(data)
    } catch {
      // 404, network failure, or a corrupt/absent file failing to decode —
      // every one of these means "this stem doesn't exist yet", never a
      // reason to take the audio layer down. GDD §20.7.6 has not shipped
      // any public/music/*.mp3 files at the time this bus was written.
      return null
    }
  }

  private async startLoop(id: LoopStem): Promise<void> {
    if (!this.ctx || !this.master) return

    const buffer = await this.fetchBuffer(id)
    if (!buffer) {
      console.warn(`[music] ${id}.mp3 not found — stem silent until generated.`)
      return
    }

    const gain = this.ctx.createGain()
    gain.gain.value = 0
    gain.connect(this.master)

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gain)
    source.start()

    this.gains.set(id, gain)
  }

  /**
   * Per-frame update. `z` and `entropy` are read, not owned — GDD §20.7.3:
   * "both inputs already exist in the simulation... the music costs no new
   * state." A stem with no loaded buffer has no GainNode in `gains`, so its
   * target gain is computed and silently discarded — the graceful-degrade
   * path, exercised by construction whenever an mp3 is missing.
   */
  update(z: number, entropy: number): void {
    if (!this.ctx) return

    const elapsedMs =
      this.act4StartMs === null ? null : this.ctx.currentTime * 1000 - this.act4StartMs
    const state = mix(z, entropy, elapsedMs)

    for (const bed of ZONE_BEDS) this.setGain(bed, state.beds[bed])
    for (const layer of STRAIN_LAYERS) this.setGain(layer, state.layers[layer])
  }

  private setGain(id: LoopStem, value: number): void {
    // Direct assignment, not an AudioParam ramp: update() runs every frame,
    // so the mix's own smoothstep curves already produce a smooth signal.
    // Layering a ramp on top of an already-continuous per-frame value would
    // only add lag, and would blur the deliberately sharp ACT_IV_DROP_MS
    // edge that actIVEnvelope computes exactly.
    this.gains.get(id)?.gain.setValueAtTime(value, this.ctx?.currentTime ?? 0)
  }

  /** GDD §20.7.4 — Mass Hire fires the Act IV override. Idempotent. */
  triggerActIV(): void {
    if (!this.ctx || this.act4StartMs !== null) return
    this.act4StartMs = this.ctx.currentTime * 1000
  }

  /** One-shot stingers — GDD §7.7.2 rung promotion, §13 Paradigm Shift. */
  async playStinger(id: Stinger): Promise<void> {
    if (!this.ctx || !this.master) return

    let buffer = this.stingerBuffers.get(id)
    if (!buffer) {
      const loaded = await this.fetchBuffer(id)
      if (!loaded) return
      this.stingerBuffers.set(id, loaded)
      buffer = loaded
    }

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.master)
    source.start()
  }

  async unload(): Promise<void> {
    this.unbindLifecycle()
    // Before the nodes go: a live subscription holding a disconnected master
    // node would keep this bus alive for the lifetime of the settings module.
    this.offSettings?.()
    this.offSettings = null

    for (const gain of this.gains.values()) gain.disconnect()
    this.gains.clear()
    this.stingerBuffers.clear()
    this.act4StartMs = null

    const ctx = this.ctx
    this.ctx = null
    this.master = null
    if (ctx) await ctx.close().catch(() => {})
  }
}
