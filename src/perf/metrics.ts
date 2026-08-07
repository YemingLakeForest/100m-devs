/**
 * Measurement for the ADR 0001 §7.5 acceptance criteria.
 *
 * The ADR makes the engine decision conditional on seven thresholds, and five
 * of them were not instrumented at all — the spike could show a frame counter
 * and nothing that could actually pass or fail a gate. This module is the
 * missing half: percentile-accurate samplers for each measurable criterion.
 *
 *   1  tap -> numeral visible          <= 80 ms  p95
 *   2  tap -> click audible            <= 60 ms  p95   (see CAVEAT below)
 *   3  fps during a full L1->L4 dolly  >= 55     5th percentile
 *   4  fps at floor zoom, 1000 sprites >= 55     5th percentile
 *   5  5 taps/sec for 60 s             no drop below 50 fps, no drift
 *   6  cold start to interactive       <= 3 s
 *   7  the subjective gate             a human, not a number
 *
 * CAVEAT on criterion 2. What can be measured in-process is tap -> the moment
 * the audio API accepts the play call. The remaining path — mixer, buffer,
 * DAC, speaker — is invisible to JavaScript, and on Android it is exactly
 * where WebView latency hides. So this number is a LOWER BOUND. A real
 * criterion-2 measurement needs an external capture (phone mic recording a
 * tap on a hard surface plus the resulting click, then reading the gap in an
 * audio editor). Recorded here rather than quietly reporting a flattering
 * number as if it were the real one.
 */

/** Percentile of an unsorted sample set. `p` in [0, 1]. */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  // Nearest-rank. With sample counts in the hundreds the interpolation
  // difference is far below the noise floor, and nearest-rank has the property
  // that every reported value is a measurement that actually happened.
  const rank = Math.ceil(p * sorted.length)
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))]
}

/** A fixed-size ring of samples. Never allocates after construction. */
export class Samples {
  private readonly buf: Float64Array
  private next = 0
  private filled = 0

  constructor(capacity: number) {
    this.buf = new Float64Array(capacity)
  }

  push(v: number): void {
    this.buf[this.next] = v
    this.next = (this.next + 1) % this.buf.length
    if (this.filled < this.buf.length) this.filled++
  }

  get count(): number {
    return this.filled
  }

  values(): number[] {
    return Array.from(this.buf.subarray(0, this.filled))
  }

  percentile(p: number): number {
    return percentile(this.values(), p)
  }

  get min(): number {
    return this.filled === 0 ? 0 : Math.min(...this.values())
  }

  get mean(): number {
    if (this.filled === 0) return 0
    let sum = 0
    for (let i = 0; i < this.filled; i++) sum += this.buf[i]
    return sum / this.filled
  }

  clear(): void {
    this.next = 0
    this.filled = 0
  }
}

/**
 * Frame-rate sampler.
 *
 * Criteria 3 and 4 are specified as a **5th percentile**, not a mean, which is
 * the right choice and the reason a plain FPS counter cannot answer them: a
 * dolly that runs at 60 fps with four 30 ms hitches reads as "60 fps" on the
 * average and fails the gate on the percentile. The hitches are the thing the
 * player feels.
 */
export class FrameSampler {
  private readonly frameMs: Samples

  constructor(capacity = 2048) {
    this.frameMs = new Samples(capacity)
  }

  /** Call once per frame with the frame's duration in milliseconds. */
  sample(ms: number): void {
    // Ignore absurd deltas: a backgrounded tab or a devtools pause produces
    // multi-second frames that are not a rendering result.
    if (ms > 0 && ms < 1000) this.frameMs.push(ms)
  }

  get count(): number {
    return this.frameMs.count
  }

  /** fps at the 5th percentile — i.e. the 95th percentile of frame time. */
  get fps5th(): number {
    const worst = this.frameMs.percentile(0.95)
    return worst > 0 ? 1000 / worst : 0
  }

  get fpsMean(): number {
    const m = this.frameMs.mean
    return m > 0 ? 1000 / m : 0
  }

  /** The single worst frame, which is what criterion 5 forbids dropping below 50 fps. */
  get fpsWorst(): number {
    const values = this.frameMs.values()
    if (values.length === 0) return 0
    return 1000 / Math.max(...values)
  }

  clear(): void {
    this.frameMs.clear()
  }
}

/**
 * Latency sampler for criteria 1 and 2.
 *
 * Also reports drift, because criterion 5 asks for "no latency drift" over 60
 * seconds of sustained tapping — a pool that slowly exhausts or a GC that
 * gradually lengthens shows up as the second half being worse than the first,
 * and no single percentile would catch that.
 */
export class LatencySampler {
  private readonly all: number[] = []
  private readonly capacity: number

  constructor(capacity = 1024) {
    this.capacity = capacity
  }

  push(ms: number): void {
    this.all.push(ms)
    if (this.all.length > this.capacity) this.all.shift()
  }

  get count(): number {
    return this.all.length
  }

  get p95(): number {
    return percentile(this.all, 0.95)
  }

  get median(): number {
    return percentile(this.all, 0.5)
  }

  /**
   * p95 of the second half minus p95 of the first half, in ms.
   * Positive means it got worse as the run went on.
   */
  get driftMs(): number {
    if (this.all.length < 20) return 0
    const mid = Math.floor(this.all.length / 2)
    return percentile(this.all.slice(mid), 0.95) - percentile(this.all.slice(0, mid), 0.95)
  }

  clear(): void {
    this.all.length = 0
  }
}

let interactiveAtMs: number | null = null

/**
 * Mark the instant the app became interactive — call once, when the renderer
 * is up and the first frame can be poked.
 *
 * This has to be a mark rather than a reading taken later. An earlier version
 * simply called `coldStartMs()` at the top of the acceptance run, which meant
 * criterion 6 measured "time from navigation until someone pressed the bench
 * button" — on a device that is however long it took a human to reach for the
 * screen. It reported 4.6 s on a Pixel 8 Pro and failed a 3 s gate that the
 * app was not actually missing.
 */
export function markInteractive(): void {
  if (interactiveAtMs === null) interactiveAtMs = performance.now()
}

/**
 * Criterion 6 — cold start to interactive.
 *
 * Measured from the navigation start the browser records, not from when this
 * module happens to execute: bundle parse and evaluation are part of a cold
 * start and excluding them would be measuring the wrong thing.
 *
 * Returns NaN if {@link markInteractive} was never called, so the criterion
 * reports as unmeasured rather than as a number that means something else.
 */
export function coldStartMs(): number {
  if (interactiveAtMs === null) return Number.NaN
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  const origin = nav ? nav.startTime : 0
  return interactiveAtMs - origin
}

export interface CriterionResult {
  id: number
  name: string
  value: number
  unit: string
  threshold: string
  pass: boolean | null
  note?: string
}

export function formatReport(results: readonly CriterionResult[]): string {
  const lines = results.map((r) => {
    const mark = r.pass === null ? '?' : r.pass ? 'PASS' : 'FAIL'
    const note = r.note ? `  (${r.note})` : ''
    return `  ${mark.padEnd(4)} ${r.id}. ${r.name.padEnd(34)} ${r.value.toFixed(1).padStart(8)} ${r.unit.padEnd(4)} vs ${r.threshold}${note}`
  })
  return lines.join('\n')
}
