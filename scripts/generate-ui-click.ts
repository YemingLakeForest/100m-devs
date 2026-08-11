/** Generate the zero-latency PCM UI click used by interface buttons. */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SAMPLE_RATE = 44_100
const OUT = path.join(import.meta.dirname, '..', 'public', 'sfx')

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
    const value = Math.max(-1, Math.min(1, samples[i]))
    bytes.writeInt16LE(Math.round(value * 0x7fff), 44 + i * 2)
  }
  return bytes
}

function randomFor(seed: number) {
  let value = seed | 0
  return () => {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    return ((value >>> 0) / 0xffffffff) * 2 - 1
  }
}

function uiClick(): Float32Array {
  const samples = new Float32Array(Math.ceil(SAMPLE_RATE * 0.052))
  const noise = randomFor(0x51ab)
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE
    const snap = noise() * Math.exp(-t * 135) * 0.34
    const plastic = Math.sin(Math.PI * 2 * 930 * t) * Math.exp(-t * 120) * 0.42
    samples[i] = (snap + plastic) * Math.min(1, t / 0.0005) * 0.72
  }
  return samples
}

await mkdir(OUT, { recursive: true })
await writeFile(path.join(OUT, 'ui-click.wav'), wav(uiClick()))

console.log('generated immediate UI click')
