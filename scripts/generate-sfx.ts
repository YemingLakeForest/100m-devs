/**
 * Generate the spike's sound effects via the ElevenLabs Sound Effects API.
 *
 * Prompts are source-controlled here so the audio is reproducible — the MP3s
 * are build output, this file is the asset. Mirrors the house pattern from
 * dungeon-doom-dash/scripts/generate_sounds.py (key from .env, skip existing,
 * --force to overwrite, positional args to target a subset).
 *
 *   npm run sfx:generate                  # generate whatever is missing
 *   npm run sfx:generate -- --force       # regenerate everything
 *   npm run sfx:generate -- poke-desk     # just one, by stem
 *
 * Sounds are specified by GDD §20.5 (poke feedback per zoom zone) and §20.4
 * (the rapid-zoom whoosh). Poke SFX play through the NATIVE audio path, never
 * Web Audio — ADR 0001 §5 mitigation 1, and the single largest feel risk in
 * the project.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'sfx')
const ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128'

/**
 * Shared style suffix. The game's fiction is a CRT terminal in a real office,
 * so these are dry, close-mic'd and short — reverb belongs to the §20.3 zoom
 * bus, which applies it live. Baking a tail in would double it.
 */
const STYLE =
  'dry close-mic\'d retro computer game sound effect, mono, short, ' +
  'no music, no melody, no speech, no reverb tail'

interface Sfx {
  stem: string
  prompt: string
  /**
   * Seconds. The API floor is 0.5, so the short poke clips are requested at
   * exactly that and carry trailing silence. Silence costs nothing at playback
   * — ADR §7.5 criterion 2 measures tap -> first audible sample, not clip
   * length — but the files are trimmed on import so the native audio pool
   * isn't holding dead bytes.
   */
  duration: number
  /** 0–1. Higher sticks closer to the literal prompt; lower is more inventive. */
  influence: number
}

const SOUNDS: Sfx[] = [
  // --- GDD §20.5, poke feedback by zoom zone -------------------------------
  {
    stem: 'poke-desk',
    // "Sharp mechanical keycap click", FM synthesis, high transient at 2.4 kHz.
    prompt:
      'a single sharp mechanical keyboard keycap click, Cherry MX Blue switch, ' +
      `crisp high transient, one press only, ${STYLE}`,
    duration: 0.5,
    influence: 0.85,
  },
  {
    stem: 'poke-floor',
    // "Pop-filter bubble burst", band-passed noise burst around 800 Hz.
    prompt:
      'a short muffled bubble pop burst, soft band-passed noise thump, ' +
      `single pop heard across a room, ${STYLE}`,
    duration: 0.5,
    influence: 0.8,
  },
  {
    stem: 'poke-global',
    // "Digital sonar ping with sub-bass thump", 440 Hz -> 110 Hz sweep.
    prompt:
      'a digital sonar ping sweeping downward in pitch with a soft sub-bass thump, ' +
      `single clean synthetic blip, ${STYLE}`,
    duration: 0.9,
    influence: 0.75,
  },
  {
    stem: 'poke-cosmic',
    // "Subatomic laser pulse with long shimmer delay tail." The shimmer is the
    // one place a tail is wanted: §20.2 Zone 3 runs 80% reverb wet anyway.
    prompt:
      'a tiny subatomic laser pulse with a bright shimmering delay tail, ' +
      'high frequency digital blip in deep space, no music, no speech',
    duration: 1.4,
    influence: 0.7,
  },

  // --- Poke crits, GDD §8.2 ------------------------------------------------
  {
    stem: 'poke-crit',
    // Flow State and 10x pokes. Larger numeral, chromatic-aberration punch.
    prompt:
      'a bright rewarding retro game critical hit chime, quick ascending sparkle ' +
      `with a punchy transient, single shot, ${STYLE}`,
    duration: 0.7,
    influence: 0.75,
  },
  {
    stem: 'poke-void',
    // Overwhelmed dev: x0 SP. The poke must sound like it did nothing.
    prompt:
      'a dull flat thud on a desk, deadened and unresolved, a keyboard being bumped ' +
      `by a forehead, no pitch, ${STYLE}`,
    duration: 0.5,
    influence: 0.8,
  },

  // --- GDD §20.4, rapid zoom juice ----------------------------------------
  {
    stem: 'zoom-out',
    prompt:
      'a rising suction whoosh accelerating outward with a low sub drop, ' +
      'air rushing away from the listener, no music, no speech',
    duration: 1.2,
    influence: 0.7,
  },
  {
    stem: 'zoom-in',
    prompt:
      'a reverse air thump falling in pitch, down-pitched laser chirp rushing ' +
      'toward the listener, no music, no speech',
    duration: 1.2,
    influence: 0.7,
  },

  // --- Interface, ART_DIRECTION §1.1 --------------------------------------
  {
    stem: 'entropy-lock',
    // E >= 0.99. Alarm red, horizontal tear, phosphor burn-in.
    prompt:
      'an old CRT monitor losing signal, harsh electrical buzz and a descending ' +
      'power-down whine, analogue failure, no music, no speech',
    duration: 1.6,
    influence: 0.75,
  },
]

async function loadKey(): Promise<string> {
  const fromEnv = process.env.ELEVENLABS_API_KEY
  if (fromEnv) return fromEnv

  try {
    const env = await readFile(path.join(ROOT, '.env'), 'utf8')
    const match = env.match(/^ELEVENLABS_API_KEY=(.+)$/m)
    if (match) return match[1].trim()
  } catch {
    // Fall through to the error below — a missing .env and a .env without the
    // key are the same problem from the caller's point of view.
  }

  console.error(
    'ELEVENLABS_API_KEY not set. Add it to .env in the repo root (gitignored).\n' +
      'See docs/PROJECT_SETUP.md §10.',
  )
  process.exit(1)
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

const argv = process.argv.slice(2)
const force = argv.includes('--force')
const only = new Set(argv.filter((a) => !a.startsWith('-')))
const targets = only.size > 0 ? SOUNDS.filter((s) => only.has(s.stem)) : SOUNDS

if (targets.length === 0) {
  console.error(`No sound matched. Known stems: ${SOUNDS.map((s) => s.stem).join(', ')}`)
  process.exit(2)
}

const key = await loadKey()
await mkdir(OUT_DIR, { recursive: true })

let generated = 0
let skipped = 0

for (const sfx of targets) {
  const out = path.join(OUT_DIR, `${sfx.stem}.mp3`)

  if (!force && (await exists(out))) {
    console.log(`  skip  ${sfx.stem}.mp3 (exists — pass --force to regenerate)`)
    skipped++
    continue
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: sfx.prompt,
      duration_seconds: sfx.duration,
      prompt_influence: sfx.influence,
    }),
  })

  if (!res.ok) {
    console.error(`  FAIL  ${sfx.stem}: ${res.status} ${res.statusText}\n${await res.text()}`)
    process.exit(1)
  }

  await writeFile(out, Buffer.from(await res.arrayBuffer()))
  const kb = ((await readFile(out)).length / 1024).toFixed(1)
  console.log(`  ok    ${sfx.stem}.mp3  ${sfx.duration}s  ${kb} KB`)
  generated++
}

console.log(`\n${generated} generated, ${skipped} skipped -> public/sfx/`)
