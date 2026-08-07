/**
 * The ADR 0001 §7.5 acceptance run — `?bench`.
 *
 * Each criterion specifies a *scenario*, not just a number: "during a full
 * L1->L4 zoom dolly", "at floor zoom with 1,000 sprites", "sustained tapping
 * at 5 taps/sec for 60 s". Measuring the numbers while someone plays by hand
 * measures a different thing every time, so the scenarios are scripted and the
 * run is repeatable.
 *
 * Deliberately a separate mode rather than always-on: driving the camera and
 * synthesising taps is not something a player should ever have happen to them.
 */

import type { LensCamera } from '../render/omniLens.ts'
import {
  FrameSampler,
  LatencySampler,
  coldStartMs,
  formatReport,
  type CriterionResult,
} from './metrics.ts'

export interface BenchHooks {
  camera: LensCamera
  /** Synthesise one poke at the centre of the screen. */
  tap: () => void
  /** Latency samples the stage is already collecting for criterion 1. */
  tapLatency: LatencySampler
  /** Lower-bound audio latency — see the CAVEAT in metrics.ts. */
  audioLatency: LatencySampler
}

export interface BenchResult {
  results: CriterionResult[]
  text: string
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * A criterion with no samples behind it is UNKNOWN, never a failure.
 *
 * An earlier revision reported 0.0 fps and 0.0 ms as FAIL when the sampler had
 * collected nothing — which happens routinely, because Chrome suspends
 * requestAnimationFrame and the Pixi ticker in a backgrounded or unfocused
 * tab. That is the same mistake as reporting a pass on no data, and worse in
 * consequence: §7.6 says a failed frame-rate gate reopens the ADR and sends
 * the project to rebuild the spike in Godot. A throttled tab must never be
 * able to trigger that.
 */
function judge(value: number, count: number, ok: (v: number) => boolean): {
  pass: boolean | null
  note?: string
} {
  if (count === 0) {
    return { pass: null, note: 'NO SAMPLES — tab backgrounded or throttled; re-run focused' }
  }
  return { pass: ok(value) }
}

/** Criterion 3 — a full L1->L4 dolly and back, measured throughout. */
async function measureDolly(hooks: BenchHooks, frames: FrameSampler): Promise<number> {
  frames.clear()
  const startZ = hooks.camera.z

  // Out over 3 s, back over 3 s. Slow enough that a hitch is the renderer's
  // fault rather than an artefact of an unrealistically fast sweep.
  for (const [from, to] of [
    [0, 1],
    [1, 0],
  ] as const) {
    const t0 = performance.now()
    const duration = 3000
    while (performance.now() - t0 < duration) {
      const t = (performance.now() - t0) / duration
      hooks.camera.set(from + (to - from) * t)
      await sleep(0)
    }
  }

  hooks.camera.set(startZ)
  return frames.fps5th
}

/** Criterion 4 — floor zoom, where the 1,000-sprite ParticleContainer lives. */
async function measureFloor(hooks: BenchHooks, frames: FrameSampler): Promise<number> {
  // z = 0.35 is the centre of the Level 2 band, so the floor tier is at full
  // cross-fade weight and every one of the 1,000 particles is being submitted.
  hooks.camera.set(0.35)
  await sleep(500) // let the tier fade in before sampling
  frames.clear()
  await sleep(5000)
  return frames.fps5th
}

/**
 * Criterion 5 — 5 taps/sec for 60 s.
 *
 * The gate has three parts and all of them matter: no frame below 50 fps, no
 * audio dropout, and no latency drift. Drift is the one most likely to fire —
 * §7.6 names audio pool exhaustion as a kill criterion, and it looks like a
 * run whose second half is worse than its first.
 */
async function measureSustained(
  hooks: BenchHooks,
  frames: FrameSampler,
  seconds: number,
): Promise<{ worstFps: number; driftMs: number; frameCount: number }> {
  hooks.camera.set(0)
  frames.clear()
  hooks.tapLatency.clear()

  const t0 = performance.now()
  let taps = 0
  while (performance.now() - t0 < seconds * 1000) {
    hooks.tap()
    taps++
    // Pace against elapsed time rather than sleeping a fixed 200 ms, so a slow
    // frame does not silently reduce the tap rate and make the test easier.
    const due = t0 + taps * 200
    const wait = due - performance.now()
    if (wait > 0) await sleep(wait)
  }

  return {
    worstFps: frames.fpsWorst,
    driftMs: hooks.tapLatency.driftMs,
    frameCount: frames.count,
  }
}

export async function runBench(
  hooks: BenchHooks,
  frames: FrameSampler,
  { sustainedSeconds = 60 }: { sustainedSeconds?: number } = {},
): Promise<BenchResult> {
  // Any time spent hidden invalidates every frame and latency number in the
  // run, so it is recorded rather than silently absorbed.
  let wasHidden = document.hidden
  const onVisibility = () => {
    if (document.hidden) wasHidden = true
  }
  document.addEventListener('visibilitychange', onVisibility)
  // Criterion 6 first — it is only meaningful before anything else has run.
  const cold = coldStartMs()

  // Warm up the tap path so criterion 1 measures steady state rather than
  // first-call JIT and texture upload.
  for (let i = 0; i < 10; i++) {
    hooks.tap()
    await sleep(60)
  }
  hooks.tapLatency.clear()
  hooks.audioLatency.clear()

  const sustained = await measureSustained(hooks, frames, sustainedSeconds)
  // Value and count must be read in the same breath. An earlier revision took
  // the p95 here and the sample count when the report was assembled seconds
  // later — long enough for rAF callbacks queued by a throttled tab to drain,
  // which produced "PASS, 0.0 ms" for criterion 1: an empty sampler's zero,
  // judged against a count that had since become non-zero. A false pass on the
  // tightest latency gate in the ADR is the worst failure this file could have.
  const tapP95 = hooks.tapLatency.p95
  const tapCount = hooks.tapLatency.count
  const audioP95 = hooks.audioLatency.p95

  const dollyFps = await measureDolly(hooks, frames)
  const dollyFrames = frames.count
  const floorFps = await measureFloor(hooks, frames)
  const floorFrames = frames.count

  hooks.camera.set(0)
  document.removeEventListener('visibilitychange', onVisibility)

  const results: CriterionResult[] = [
    {
      id: 1,
      name: 'tap -> numeral visible',
      value: tapP95,
      unit: 'ms',
      threshold: '<= 80 p95',
      ...judge(tapP95, tapCount, (v) => v <= 80),
    },
    {
      id: 2,
      name: 'tap -> audio call accepted',
      value: audioP95,
      unit: 'ms',
      threshold: '<= 60 p95',
      pass: null,
      note: 'LOWER BOUND — mixer/DAC/speaker invisible to JS; needs external capture',
    },
    {
      id: 3,
      name: 'fps during L1->L4 dolly',
      value: dollyFps,
      unit: 'fps',
      threshold: '>= 55 5th pct',
      ...judge(dollyFps, dollyFrames, (v) => v >= 55),
    },
    {
      id: 4,
      name: 'fps at floor zoom, 1000 sprites',
      value: floorFps,
      unit: 'fps',
      threshold: '>= 55 5th pct',
      ...judge(floorFps, floorFrames, (v) => v >= 55),
    },
    {
      id: 5,
      name: `sustained 5/sec for ${sustainedSeconds}s — worst frame`,
      value: sustained.worstFps,
      unit: 'fps',
      threshold: '>= 50',
      ...judge(sustained.worstFps, sustained.frameCount, (v) => v >= 50),
    },
    {
      id: 5.1 as unknown as number,
      name: 'sustained — latency drift',
      value: sustained.driftMs,
      unit: 'ms',
      threshold: '~0',
      ...judge(sustained.driftMs, tapCount, (v) => v < 15),
      note: 'p95 second half minus first half; §7.6 audio pool exhaustion',
    },
    {
      id: 6,
      name: 'cold start to interactive',
      value: cold / 1000,
      unit: 's',
      threshold: '<= 3',
      pass: cold <= 3000,
    },
    {
      id: 7,
      name: 'the subjective gate',
      value: 0,
      unit: '',
      threshold: 'a human, for 60s',
      pass: null,
      note: 'outranks every number above — ADR §7.5',
    },
  ]

  const measured = results.filter((r) => r.pass !== null)
  const failed = measured.filter((r) => !r.pass)
  const unknown = results.filter((r) => r.pass === null)

  const text = [
    'ADR 0001 §7.5 — acceptance run',
    `device: ${navigator.userAgent}`,
    `dpr: ${devicePixelRatio}  viewport: ${innerWidth}x${innerHeight}`,
    '',
    formatReport(results),
    '',
    failed.length === 0
      ? `${measured.length}/${measured.length} measured criteria pass.`
      : `${failed.length} FAILING: ${failed.map((r) => r.id).join(', ')}`,
    `${unknown.length} not measured: ${unknown.map((r) => r.id).join(', ')}`,
    wasHidden
      ? 'INVALID RUN: the tab was hidden or unfocused. Chrome suspends rAF and\nthe ticker, so every frame and latency number above is meaningless. Re-run\nwith the window in front.'
      : '',
    '',
    // The one thing this harness must not let anyone forget.
    'NOTE: ADR §7.4 — a pass on a flagship or a desktop browser proves nothing.',
    'A FAIL here is decisive; a PASS is not. The gate needs a ~2021 budget phone.',
  ].join('\n')

  return { results, text }
}
