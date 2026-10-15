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
 *  - `release-hit` — a release going on sale. It used to borrow `ui-whoosh`, a rising swoop the
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

function releaseHit(): Float32Array {
  const out = buffer(0.5)
  snap(out, 0, 0.55, 190, 0x7e1ea5e)
  thump(out, 0, 130, 42, 1, 9)
  return normalise(out, 0.78)
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('generate-juice-sfx.ts')) {
  await mkdir(OUT, { recursive: true })
  for (let i = 0; i < BLIP_NOTES.length; i++) await writeFile(path.join(OUT, `work-blip-${i}.wav`), wav(blip(i)))
  await writeFile(path.join(OUT, 'build-done.wav'), wav(buildDone()))
  await writeFile(path.join(OUT, 'release-hit.wav'), wav(releaseHit()))
  console.log('generated work-blip-0..9, build-done, release-hit')
}
