/**
 * The juice layer's sounds, written as PCM rather than prompted (docs/PLAN-2026-10-11-juice-layer.md).
 *
 *   npx tsx scripts/generate-juice-sfx.ts
 *
 * Three families, each answering something the user said on playing the first pass:
 *
 *  - `work-blip-0..9` — what a point landing at the project sounds like. The first pass used the
 *    interface's `ui-tick` for this, and the user: *"I don't like the tic tic tic sound, make
 *    something else."* A tick is a transient with no pitch, so a stream of them is a clock; a blip
 *    is a short pitched note, and five of them on a pentatonic scale (C D E G A) played in any
 *    order are always consonant, so a stream of landings is a little marimba figure instead.
 *  - `build-done` — a build going into the queue, which had no sound at all (*"the build should
 *    have sound effects too"*): a low thump for the weight, then a rising C-E-G arpeggio of the
 *    same marimba, and a bell on top for the last note to hang on.
 *  - `release-hit` — a release going on sale (rebuilt 2026-10-16 as a layered stinger; see `releaseHit`). It used to borrow `ui-whoosh`, a rising swoop the
 *    user called *"the siuuuu sound… make something else that is fitting the vibe."* The first
 *    replacement was a stamp and then a five-note bell arpeggio that climbed and rang, and the
 *    user, three days later: *"remove the siuuuu sound when apps released."* Measured, it was the
 *    same sound: the loudest partial rose 517 → 1314 Hz in 0.4 s and then rang at 2.6 kHz for half
 *    a second, and a rise followed by a held high note is a siuuu however it is played. So nothing
 *    rises: a stamp — a short noise burst and a deep drop — and the clip ends. The reel's pitch
 *    (the critics' blips climbing a pentatonic run) belongs to the review, not to this clip.
 *
 * Everything is synthesised from sines and one seeded noise, so the files are reproducible and
 * need no API key (`generate-sfx.ts` does). Peak levels are normalised here and nowhere else, so
 * the mix is a property of this file.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SAMPLE_RATE = 44_100
const OUT = path.join(import.meta.dirname, '..', 'public', 'sfx')

/** The pentatonic notes of the blip family, in Hz: C5 D5 E5 G5 A5, then the same an octave up (a run climbs all ten). */
const BLIP_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0] as const

function wav(samples: Float32Array): Buffer {
  const bytes = Buffer.alloc(44 + samples.length * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(36 + samples.length * 2, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(SAMPLE_RATE, 24)
  bytes.writeUInt32LE(SAMPLE_RATE * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++) {
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 0x7fff), 44 + i * 2)
  }
  return bytes
}

function noiseFor(seed: number) {
  let value = seed | 0
  return () => {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    return ((value >>> 0) / 0xffffffff) * 2 - 1
  }
}

const buffer = (seconds: number) => new Float32Array(Math.ceil(SAMPLE_RATE * seconds))

/** A wooden-bar note: a sine, a quiet fourth partial that dies faster, a hard-struck start. */
function marimba(out: Float32Array, at: number, hz: number, gain: number, decay: number) {
  const start = Math.round(at * SAMPLE_RATE)
  for (let i = 0; start + i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.exp(-t * decay) * Math.min(1, t / 0.002)
    if (t > 0.01 && env < 1e-4) break
    const body = Math.sin(2 * Math.PI * hz * t) + 0.32 * Math.sin(2 * Math.PI * hz * 4 * t) * Math.exp(-t * decay * 2.6)
    out[start + i] += body * env * gain
  }
}

/** A small struck bell: two inharmonic partials over the fundamental, a long soft ring. */
function bell(out: Float32Array, at: number, hz: number, gain: number, decay: number) {
  const start = Math.round(at * SAMPLE_RATE)
  for (let i = 0; start + i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.exp(-t * decay) * Math.min(1, t / 0.001)
    if (t > 0.01 && env < 1e-4) break
    const tone = Math.sin(2 * Math.PI * hz * t) + 0.45 * Math.sin(2 * Math.PI * hz * 2.76 * t) * Math.exp(-t * decay * 1.8) + 0.2 * Math.sin(2 * Math.PI * hz * 5.4 * t) * Math.exp(-t * decay * 3.4)
    out[start + i] += tone * env * gain
  }
}

/** A weight: a sine that drops from `from` to `to` Hz, which the ear hears as a thump, not a note. */
function thump(out: Float32Array, at: number, from: number, to: number, gain: number, decay: number) {
  const start = Math.round(at * SAMPLE_RATE)
  let phase = 0
  for (let i = 0; start + i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.exp(-t * decay) * Math.min(1, t / 0.002)
    if (t > 0.01 && env < 1e-4) break
    const hz = to + (from - to) * Math.exp(-t * 28)
    phase += (2 * Math.PI * hz) / SAMPLE_RATE
    out[start + i] += Math.sin(phase) * env * gain
  }
}

/** A stamp's edge: a few milliseconds of noise, which is what makes the thump a hit. */
function snap(out: Float32Array, at: number, gain: number, decay: number, seed: number) {
  const noise = noiseFor(seed)
  const start = Math.round(at * SAMPLE_RATE)
  for (let i = 0; start + i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.exp(-t * decay)
    if (env < 1e-3) break
    out[start + i] += noise() * env * gain
  }
}

function normalise(samples: Float32Array, peak: number): Float32Array {
  let max = 0
  for (const s of samples) max = Math.max(max, Math.abs(s))
  if (max > 0) for (let i = 0; i < samples.length; i++) samples[i] *= peak / max
  // A hard cut at the end is a click; the last few milliseconds are brought to zero.
  const fade = Math.min(samples.length, Math.round(SAMPLE_RATE * 0.006))
  for (let i = 0; i < fade; i++) samples[samples.length - 1 - i] *= i / fade
  return samples
}

function blip(index: number): Float32Array {
  const out = buffer(0.2)
  marimba(out, 0, BLIP_NOTES[index], 1, 24)
  return normalise(out, 0.5)
}

function buildDone(): Float32Array {
  const out = buffer(0.95)
  thump(out, 0, 150, 52, 0.9, 11)
  const arpeggio = [523.25, 659.25, 783.99]
  arpeggio.forEach((hz, i) => marimba(out, 0.07 + i * 0.075, hz, 0.7, 9))
  bell(out, 0.07 + 3 * 0.075, 1046.5, 0.45, 5.5)
  return normalise(out, 0.7)
}

/**
 * The review's verdict, stamped — what `release-hit` was until 2026-10-16: a few ms of noise and a deep drop. It is
 * the right sound for a word landing on a card, and it was the wrong sound for the largest event in the loop, which
 * the user heard as having *"no meat too simple, not enough satisfaction."*
 */
function verdictStamp(): Float32Array {
  const out = buffer(0.5)
  snap(out, 0, 0.55, 190, 0x7e1ea5e)
  thump(out, 0, 130, 42, 1, 9)
  return normalise(out, 0.78)
}

/**
 * A struck chord tone with a brass edge: the first eight harmonics at 1/n, the upper ones dying faster, so the attack
 * is bright and the tail is round. **It holds its pitch** — the release path plays nothing that glides (`audio/glides.ts`).
 */
function stab(out: Float32Array, at: number, hz: number, gain: number, decay: number) {
  const start = Math.round(at * SAMPLE_RATE)
  for (let i = 0; start + i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.exp(-t * decay) * Math.min(1, t / 0.003)
    if (t > 0.01 && env < 1e-4) break
    let tone = 0
    for (let n = 1; n <= 8; n++) tone += (Math.sin(2 * Math.PI * hz * n * t) / n) * (n > 3 ? Math.exp(-t * decay * n * 0.6) : 1)
    out[start + i] += tone * env * gain
  }
}

/** Noise with the lows taken off (a first difference), for a cymbal's wash or a clap's crack. */
function hiss(out: Float32Array, at: number, seconds: number, gain: number, decay: number, seed: number) {
  const noise = noiseFor(seed)
  const start = Math.round(at * SAMPLE_RATE)
  const n = Math.round(seconds * SAMPLE_RATE)
  let last = 0
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const x = noise()
    out[start + i] += (x - last) * 0.5 * Math.exp(-t * decay) * Math.min(1, t / 0.001) * gain
    last = x
  }
}

/** A buzz at one pitch: two square-ish waves six per cent apart, so it beats like a cheap speaker. */
function buzz(out: Float32Array, at: number, hz: number, gain: number, seconds: number) {
  const start = Math.round(at * SAMPLE_RATE)
  const n = Math.round(seconds * SAMPLE_RATE)
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.min(1, t / 0.004) * Math.min(1, (seconds - t) / 0.03)
    const tone = Math.tanh(3 * Math.sin(2 * Math.PI * hz * t)) + Math.tanh(3 * Math.sin(2 * Math.PI * hz * 1.06 * t))
    out[start + i] += tone * 0.5 * env * gain
  }
}

/**
 * **A release going on sale** [2026-10-16, at the user's instruction: *"the SFX has no meat too simple, not enough
 * satisfaction for the game release"*].
 *
 * The stamp alone was right about the siuuu and wrong about the weight: one transient is a confirmation, and this is
 * the payoff of the whole loop. So it is built the way a broadcast stinger is, out of layers that all hold their
 * pitch — **nothing in it rises or falls**, the user's standing rule since 2026-10-15:
 *
 *  - **Two hits, a beat apart** — a big one and a smaller one 0.16 s later. BA-DUM is a gavel; one hit is a click.
 *  - **A sub boom** under the first, long enough to be felt through a phone speaker as a press, not heard as a note.
 *  - **A C major chord, struck all at once** (C3 G3 C4 E4 G4) with a brass edge, on the second hit. Struck together it
 *    is one event; played in order it would be an arpeggio, and an arpeggio is a rise.
 *  - **A crash** washing out over a second and a half.
 *  - **A room clapping** — sixty claps thinning out under the crash: the people the game was made for, receiving it.
 */
function releaseHit(): Float32Array {
  const out = buffer(2.1)
  snap(out, 0, 0.9, 90, 0x7e1ea5e)
  thump(out, 0, 110, 38, 1, 4.5)
  snap(out, 0.16, 0.5, 140, 0x5eed2)
  thump(out, 0.16, 100, 44, 0.6, 9)
  for (const hz of [130.81, 196.0, 261.63, 329.63, 392.0]) stab(out, 0.16, hz, 0.22, 3.2)
  hiss(out, 0.16, 1.7, 0.55, 2.4, 0xc4a54)
  const noise = noiseFor(0xc1a9)
  for (let i = 0; i < 60; i++) {
    const u = (i + 0.5 * (noise() + 1)) / 60
    hiss(out, 0.3 + 1.6 * u ** 1.7, 0.012, (0.5 + 0.25 * noise()) * (1 - 0.6 * u), 260, 0xc1a9 + i * 7)
  }
  return normalise(out, 0.86)
}

/** The ring's clean fix: a crunch and a bright wooden note — the bug squashed in one hit. */
function ringFix(): Float32Array {
  const out = buffer(0.32)
  snap(out, 0, 0.6, 260, 0xf1c5)
  thump(out, 0, 170, 70, 0.6, 28)
  marimba(out, 0.004, 1318.51, 0.75, 26)
  marimba(out, 0.004, 659.25, 0.45, 20)
  return normalise(out, 0.62)
}

/** A rushed fix: the same crunch, softer, on a lower, duller note — it landed, and it does not sound proud of it. */
function ringRushed(): Float32Array {
  const out = buffer(0.26)
  snap(out, 0, 0.35, 220, 0x2a5e)
  thump(out, 0, 140, 60, 0.45, 26)
  marimba(out, 0.004, 587.33, 0.7, 30)
  return normalise(out, 0.5)
}

/** An armoured bug's shell giving way: a metallic clank that has not finished the job. */
function ringCrack(): Float32Array {
  const out = buffer(0.4)
  snap(out, 0, 0.8, 120, 0xc4ac)
  thump(out, 0, 220, 90, 0.5, 30)
  bell(out, 0.002, 1480, 0.5, 20)
  bell(out, 0.002, 2210, 0.28, 26)
  return normalise(out, 0.6)
}

/** A miss: a cheap buzzer at one pitch and a dull knock. The head stalls on it. */
function ringMiss(): Float32Array {
  const out = buffer(0.26)
  buzz(out, 0, 92, 0.6, 0.2)
  thump(out, 0, 90, 55, 0.5, 24)
  return normalise(out, 0.5)
}

/** The date locked: a heavy latch, two clicks a hair apart over a low struck fifth. */
function ringLock(): Float32Array {
  const out = buffer(0.5)
  snap(out, 0, 0.7, 240, 0x10c4)
  snap(out, 0.034, 0.55, 240, 0x10c5)
  thump(out, 0.034, 120, 40, 0.9, 10)
  stab(out, 0.034, 130.81, 0.35, 9)
  stab(out, 0.034, 196.0, 0.25, 9)
  return normalise(out, 0.72)
}

/**
 * One key of a keyboard going down: a few ms of band-limited noise for the edge and a short square-ish pip under it.
 * The window chrome is drawn in hard steps (`.ui-panel` unrolls in four heights), so its sound is four of these, one
 * per height, spaced to the animation's own step. Sound and picture share one clock — that is the whole idea.
 */
function clack(out: Float32Array, at: number, hz: number, gain: number, seed: number) {
  hiss(out, at, 0.03, gain, 190, seed)
  const start = Math.round(at * SAMPLE_RATE)
  for (let i = 0; start + i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.exp(-t * 95) * Math.min(1, t / 0.0015)
    if (t > 0.01 && env < 1e-3) break
    out[start + i] += Math.tanh(2.2 * Math.sin(2 * Math.PI * hz * t)) * env * gain * 0.55
  }
}

/** A window unrolling: four clacks falling in pitch, 80 ms apart — `DURATION.panelIn` (320 ms) over `steps(4)`. */
function clackOpen(): Float32Array {
  const out = buffer(0.36)
  ;[1400, 1180, 960, 780].forEach((hz, i) => clack(out, i * 0.08, hz, 1 - i * 0.08, 0xc1ac0 + i))
  return normalise(out, 0.5)
}

/** A window rolling up: two clacks rising, 90 ms apart — `DURATION.panelOut` (180 ms) over two steps. Faster out than in. */
function clackClose(): Float32Array {
  const out = buffer(0.22)
  ;[700, 1100].forEach((hz, i) => clack(out, i * 0.09, hz, 0.9, 0xc105e + i))
  return normalise(out, 0.45)
}

/** A pointer arriving on a key: one triangle pip, high and short, quiet enough to be ignored until it is missing. */
function hoverTick(): Float32Array {
  const out = buffer(0.04)
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE
    const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * 2093 * t))
    out[i] = tri * Math.exp(-t * 120) * Math.min(1, t / 0.001)
  }
  return normalise(out, 0.2)
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('generate-juice-sfx.ts')) {
  await mkdir(OUT, { recursive: true })
  for (let i = 0; i < BLIP_NOTES.length; i++) await writeFile(path.join(OUT, `work-blip-${i}.wav`), wav(blip(i)))
  await writeFile(path.join(OUT, 'build-done.wav'), wav(buildDone()))
  await writeFile(path.join(OUT, 'release-hit.wav'), wav(releaseHit()))
  await writeFile(path.join(OUT, 'verdict-stamp.wav'), wav(verdictStamp()))
  await writeFile(path.join(OUT, 'ring-fix.wav'), wav(ringFix()))
  await writeFile(path.join(OUT, 'ring-rushed.wav'), wav(ringRushed()))
  await writeFile(path.join(OUT, 'ring-crack.wav'), wav(ringCrack()))
  await writeFile(path.join(OUT, 'ring-miss.wav'), wav(ringMiss()))
  await writeFile(path.join(OUT, 'ring-lock.wav'), wav(ringLock()))
  await writeFile(path.join(OUT, 'ui-clack-open.wav'), wav(clackOpen()))
  await writeFile(path.join(OUT, 'ui-clack-close.wav'), wav(clackClose()))
  await writeFile(path.join(OUT, 'ui-hover.wav'), wav(hoverTick()))
  console.log('generated ui-clack-open, ui-clack-close, ui-hover, work-blip-0..9, build-done, release-hit, verdict-stamp, ring-fix, ring-rushed, ring-crack, ring-miss, ring-lock')
}
