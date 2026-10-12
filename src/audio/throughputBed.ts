import { getSettings } from '../settings/settings.ts'

/**
 * The continuous half of the throughput sound (GDD §20.5a, `sim/throughputAudio.ts` for the
 * argument): one looping low rumble whose level follows the world's output, which takes over from
 * the individual clicks as the work stops being countable.
 *
 * **Web Audio, and not the native path `sfx.ts` insists on for pokes.** §23.2 puts pokes on native
 * audio because 100–300 ms of latency breaks a tap; a bed is not a response to anything, a
 * quarter of a second of lag in a level that moves over seconds is inaudible, and a looping buffer
 * is exactly what Web Audio is for (§20 already keeps the ambient bus there).
 *
 * Brown noise through a low-pass, because it has no pitch to form a tune with (the clip bank that
 * read as a melody is why `playKeyboardClick` is one dry switch) and no tonal centre to fight the
 * score's. **Its timbre has never been auditioned** — written headless — and the filter and the
 * gain ceiling below are the two numbers to tune by ear.
 */

/** The loudest the bed ever is, as a gain on the effects volume. Quiet: it is a floor, not a feature. */
const CEILING = 0.16
/** The low-pass opens a little as the work grows, so a bigger world is brighter as well as louder. */
const CUTOFF_QUIET = 160
const CUTOFF_FULL = 520
/** Seconds the gain takes to follow a change. A bed that jumped would be a click. */
const FOLLOW_S = 0.5

export interface ThroughputBed {
  /** `level` is `bedLevel(rate)`, `pull` is `pullOut(zoom)`, both from `sim/throughputAudio.ts`. */
  update(level: number, pull: number): void
  dispose(): void
}

export function createThroughputBed(): ThroughputBed {
  let ctx: AudioContext | null = null
  let gain: GainNode | null = null
  let filter: BiquadFilterNode | null = null
  let source: AudioBufferSourceNode | null = null
  const wake = () => { if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {}) }

  function start(): boolean {
    if (ctx) return true
    if (typeof AudioContext === 'undefined') return false
    try {
      ctx = new AudioContext()
      const length = ctx.sampleRate * 4
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      // Brown noise: a leaky integral of white. Normalised by hand, since the integral's own level
      // depends on the leak; the loop point is made seamless by easing the last samples to the first.
      let last = 0
      for (let i = 0; i < length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
        data[i] = last * 3.5
      }
      const seam = Math.min(2048, length >> 2)
      for (let i = 0; i < seam; i++) { const t = i / seam; data[length - seam + i] = data[length - seam + i] * (1 - t) + data[i] * t }
      source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = CUTOFF_QUIET
      gain = ctx.createGain()
      gain.gain.value = 0
      source.connect(filter).connect(gain).connect(ctx.destination)
      source.start()
      for (const type of ['pointerdown', 'touchend', 'keydown'] as const) window.addEventListener(type, wake, { capture: true, passive: true })
      return true
    } catch {
      ctx = null
      return false
    }
  }

  return {
    update(level, pull) {
      // Nothing to say, and nothing yet made to say it with: do not wake an audio context for silence.
      if (!ctx && !(level > 0)) return
      if (!start() || !ctx || !gain || !filter) return
      const target = Math.max(0, Math.min(1, level)) * pull * CEILING * getSettings().sfx
      gain.gain.setTargetAtTime(target, ctx.currentTime, FOLLOW_S)
      filter.frequency.setTargetAtTime(CUTOFF_QUIET + (CUTOFF_FULL - CUTOFF_QUIET) * level, ctx.currentTime, FOLLOW_S)
    },
    dispose() {
      for (const type of ['pointerdown', 'touchend', 'keydown'] as const) window.removeEventListener(type, wake, { capture: true })
      try { source?.stop() } catch { /* already stopped */ }
      void ctx?.close().catch(() => {})
      ctx = null; gain = null; filter = null; source = null
    },
  }
}
