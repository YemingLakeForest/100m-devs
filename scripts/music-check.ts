/**
 * Does the score have a tune? — GDD §20.7.1b.
 *
 * This exists because of a specific failure: §20.7.1a asked the generator for
 * `no melody`, got exactly that, and shipped **ten stems of white noise with
 * moods**. §20.7.1b corrected the rule — melody is the essence of music, and
 * the thing that phases when stems overlap is a *pulse*, not a harmony — and
 * the prompts were rewritten and regenerated.
 *
 * And then nothing checked. A prompt asking for melody is not melody: the free
 * endpoint (§20.7.6a) is a **sound-effects** model, which is the tool in the
 * shop least likely to produce a tune however politely it is asked, and there
 * is no way to hear the result from a terminal.
 *
 * So this measures it. Not "is it good" — nothing here can answer that, and
 * §20.7 still needs ears. Only the one question that was being assumed:
 * **does the pitch move?**
 *
 *   npm run music:check              every stem
 *   npm run music:check -- bed-desk  one
 *
 * ---------------------------------------------------------------------------
 * HOW
 *
 * Chroma over time. Each frame's spectrum is folded into the twelve pitch
 * classes and the loudest one is the frame's note. A drone holds one class for
 * its whole length; a melody moves between several. That distinction is coarse
 * and it is the one that matters — the failure being tested for is not "the
 * tune is dull", it is "there is no tune at all", and a chromagram that never
 * changes says so unambiguously.
 *
 * Deliberately not a pitch tracker. Pitch tracking a pad through tape
 * saturation is a research problem; counting which of twelve buckets is loudest
 * is arithmetic, and the answer here is a yes or a no.
 * ---------------------------------------------------------------------------
 */
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const MUSIC_DIR = path.join(ROOT, 'public', 'music')

/** Analysis rate. Low on purpose — nothing here needs the top two octaves. */
const RATE = 22050
/** ~186 ms at 22 kHz. Long enough to resolve a bass note, short enough to see a change. */
const FRAME = 4096
const HOP = FRAME / 2

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** Decode to mono float PCM. ffmpeg because the alternative is an MP3 decoder. */
function decode(file: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-v', 'error',
      '-i', file,
      '-ac', '1',
      '-ar', String(RATE),
      '-f', 'f32le',
      '-',
    ])
    const chunks: Buffer[] = []
    let err = ''
    ff.stdout.on('data', (c: Buffer) => chunks.push(c))
    ff.stderr.on('data', (c: Buffer) => (err += c.toString()))
    ff.on('error', reject)
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || `ffmpeg exited ${code}`))
      const buf = Buffer.concat(chunks)
      resolve(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4)))
    })
  })
}

/** In-place radix-2 FFT. Real and imaginary parts, length must be a power of two. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]
        const ui = im[i + k]
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr
        im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr
        im[i + k + len / 2] = ui - vi
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

const HANN = Float64Array.from({ length: FRAME }, (_, i) =>
  0.5 * (1 - Math.cos((2 * Math.PI * i) / (FRAME - 1))),
)

export interface StemAnalysis {
  frames: number
  /** Dominant pitch class per frame, or -1 where the frame is too quiet to call. */
  notes: number[]
  /** Total energy per pitch class across the whole stem, normalised to its peak. */
  chroma: number[]
}

export function analyse(pcm: Float32Array): StemAnalysis {
  const notes: number[] = []
  const chroma = new Array(12).fill(0)
  // 65 Hz to 2 kHz: the register a pad or a lead actually occupies. Below it is
  // the sub swell every stem has, which would pin the chromagram to one class
  // whatever the tune did; above it is tape hiss.
  const loBin = Math.floor((65 * FRAME) / RATE)
  const hiBin = Math.ceil((2000 * FRAME) / RATE)

  const re = new Float64Array(FRAME)
  const im = new Float64Array(FRAME)

  for (let start = 0; start + FRAME <= pcm.length; start += HOP) {
    for (let i = 0; i < FRAME; i++) {
      re[i] = pcm[start + i] * HANN[i]
      im[i] = 0
    }
    fft(re, im)

    const frame = new Array(12).fill(0)
    let total = 0
    for (let b = loBin; b <= hiBin; b++) {
      const mag = Math.hypot(re[b], im[b])
      const freq = (b * RATE) / FRAME
      // A4 = 440 Hz = pitch class 9.
      const semis = 12 * Math.log2(freq / 440)
      const cls = ((Math.round(semis) + 9) % 12 + 12) % 12
      frame[cls] += mag
      total += mag
    }

    if (total <= 0) {
      notes.push(-1)
      continue
    }
    let best = 0
    for (let k = 1; k < 12; k++) if (frame[k] > frame[best]) best = k
    // A frame whose loudest class is barely louder than the average is not
    // sounding a note, it is sounding a wash. Calling that a "note" is how a
    // drone gets reported as a melody with a hundred key changes.
    notes.push(frame[best] > (total / 12) * 1.6 ? best : -1)
    for (let k = 0; k < 12; k++) chroma[k] += frame[k]
  }

  const peak = Math.max(...chroma, 1)
  return { frames: notes.length, notes, chroma: chroma.map((v) => v / peak) }
}

/** How many times the sounding note changes, ignoring silence and one-frame flickers. */
export function noteChanges(notes: readonly number[]): number {
  let changes = 0
  let held = -1
  let run = 0
  for (const n of notes) {
    if (n === -1) continue
    if (n === held) {
      run++
      continue
    }
    // Two frames (~0.19 s) before a new note counts. Anything shorter is the
    // chromagram wobbling inside one held pad, not a note being played.
    if (held !== -1 && run >= 2) changes++
    held = n
    run = 1
  }
  return changes
}

/** Distinct pitch classes that hold for long enough to be heard as notes. */
export function distinctNotes(notes: readonly number[]): number[] {
  const held = new Map<number, number>()
  let cur = -1
  let run = 0
  const commit = () => {
    if (cur !== -1 && run >= 2) held.set(cur, (held.get(cur) ?? 0) + run)
  }
  for (const n of notes) {
    if (n === cur) {
      run++
      continue
    }
    commit()
    cur = n
    run = 1
  }
  commit()
  const total = [...held.values()].reduce((a, b) => a + b, 0)
  // At least 3% of the sounding time, so one stray bin does not count as a note.
  return [...held.entries()].filter(([, n]) => n / Math.max(1, total) >= 0.03).map(([k]) => k)
}

/**
 * The verdict. **Two distinct notes is not a melody** — a drone that drifts
 * between neighbouring classes will produce two. Four is the floor for anything
 * a listener would call a tune.
 */
export const MIN_NOTES = 4
export const MIN_CHANGES = 8

async function main() {
  const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith('-')))
  const files = (await readdir(MUSIC_DIR))
    .filter((f) => f.endsWith('.mp3'))
    .filter((f) => only.size === 0 || only.has(path.basename(f, '.mp3')))
    .sort()

  if (files.length === 0) {
    console.error('No stems matched.')
    process.exit(1)
  }

  let failed = 0
  // The hash is not decoration. A run of this reported 3/10 and a later run
  // reported 10/10 with seven of the files provably unmodified, and there was
  // no way to prove which measurement had been taken against which bytes. A
  // result you cannot pin to an input is not evidence.
  console.log('  stem                 hash      notes  changes  scale                verdict')
  for (const file of files) {
    const full = path.join(MUSIC_DIR, file)
    const hash = createHash('sha256').update(await readFile(full)).digest('hex').slice(0, 8)
    const pcm = await decode(full)
    const a = analyse(pcm)
    const distinct = distinctNotes(a.notes)
    const changes = noteChanges(a.notes)
    const scale = a.chroma
      .map((v, i) => [v, i] as const)
      .filter(([v]) => v >= 0.55)
      .sort((x, y) => y[0] - x[0])
      .map(([, i]) => NOTES[i])
      .join(' ')
    // Stingers are 2.6 s. A tune is not a fair thing to ask of them.
    const sting = file.startsWith('sting-')
    const ok = sting || (distinct.length >= MIN_NOTES && changes >= MIN_CHANGES)
    if (!ok) failed++
    console.log(
      `  ${path.basename(file, '.mp3').padEnd(20)} ${hash}  ${String(distinct.length).padStart(5)}` +
        `  ${String(changes).padStart(7)}  ${scale.padEnd(19)}  ${ok ? 'ok' : 'DRONE — no tune'}`,
    )
  }

  console.log(
    `\n  ${files.length - failed}/${files.length} have a tune ` +
      `(>= ${MIN_NOTES} notes, >= ${MIN_CHANGES} changes). §20.7.1b.`,
  )
  if (failed > 0) {
    console.log('  Rerolls: npm run music:generate -- --force <stem>')
    process.exit(1)
  }
}

// Guarded so the pure halves above can be imported by a test.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await main()
}
