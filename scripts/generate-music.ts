/**
 * Generate the adaptive score's ten stems — GDD §20.7.
 *
 * Prompts are source-controlled here so the score is reproducible: the MP3s are
 * build output, this file is the asset. Mirrors scripts/generate-sfx.ts (key
 * from .env, skip existing, --force to overwrite, positional args to target a
 * subset) because §20.7.6 says to.
 *
 *   npm run music:generate                # generate whatever is missing
 *   npm run music:generate -- --force     # regenerate everything
 *   npm run music:generate -- bed-desk    # just one, by stem
 *
 * Web Audio material, not native audio — §23.2 non-negotiable 1 draws that line,
 * and it is why this writes to public/music and never goes through
 * @capacitor-community/native-audio.
 *
 * ---------------------------------------------------------------------------
 * WHICH API, AND WHY IT IS NOT THE ONE CALLED "MUSIC"
 *
 * `/v1/music` is paid-only and this project's key is on a free account
 * (§20.7.6a). `/v1/sound-generation` is free.
 *
 * That sounds like a downgrade and for an *ambient* score it is not, because it
 * changes which of §20.7.1's two guarantees the stems need. Composed loops have
 * to share a key and a tempo or they fight; **ambient textures have no pulse to
 * disagree about**, so any two of them can be crossfaded at any moment for free.
 * §20.7.1a records the amended rule. The score is drones and pads rather than
 * beats, which is what the game wanted under a room at night anyway.
 *
 * GeoDaily reached this same endpoint by asking for music, catching the 402 and
 * falling back silently — printing one line nobody read, which cost three
 * exchanges to unpick a year later. **This does not fall back.** It posts to
 * sound-generation on purpose and writes music.manifest.json saying so, so
 * nobody ever has to reverse-engineer the provenance from MP3 durations again.
 * ---------------------------------------------------------------------------
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'music')

// UNVERIFIED beyond the docs read above — this is Eleven Music's /v1/music
// compose route, not the /v1/sound-generation route generate-sfx.ts uses.
// Re-check https://elevenlabs.io/docs/api-reference/music/compose before the
// real run if this file has aged.
/**
 * **The Sound Effects endpoint, not the Music one.**
 *
 * `/v1/music` is paid-only (§20.7.6a) and this project's key is on a free
 * account. `/v1/sound-generation` is free, and for an *ambient* score it is the
 * right tool anyway — see §20.7.1a. Thirty seconds is its ceiling: 30 returns
 * audio, 45 returns an error.
 *
 * GeoDaily reached the same place by falling back silently and printing one
 * line nobody read, which cost three exchanges to unpick. This one does not
 * fall back at all: it posts here on purpose, and `music.manifest.json` records
 * that it did.
 */
const ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128'

/** The API's ceiling. 30 works, 45 does not. */
const MAX_SECONDS = 30

/**
 * Shared constraint suffix — §20.7.1a, and it is the load-bearing line here.
 *
 * §20.7.1 originally required one key, one tempo and one bar length, because
 * that is what lets *composed* loops crossfade with no beat-matching. §20.7.1a
 * then met the constraint the other way round — **no pulse and no melody at
 * all** — on the grounds that two drones layer cleanly because neither has
 * anything to be out of step with.
 *
 * That worked, and what it produced was **white noise**. Ten stems of pure
 * texture is not a score, it is a hiss with moods, and the first person to
 * listen to it said exactly that.
 *
 * So this is the third position, and it is the right one: **the thing that
 * phases is a pulse, not a harmony.** Two loops with beats drift against each
 * other within seconds and no amount of prompting fixes it; two loops in the
 * same key sound like the same piece however they overlap, because harmony has
 * no clock to be wrong about. The rule therefore splits in two:
 *
 *   - **No percussion, ever.** That is the half §20.7.1a got right, and it is
 *     non-negotiable for anything audible at the same time as anything else.
 *   - **One key, and melody is allowed.** A slow line in A minor over a pad in
 *     A minor is consonant at every offset. That is the whole trick, and it is
 *     what §20.7.1's original "one key" clause was asking for all along.
 *
 * A minor because the register the brief now asks for — *sovietwave*: the warm
 * melancholy of an analogue synth through a tape machine — is built on it, and
 * because a natural minor has no leading tone to clash when two stems happen to
 * overlap on different scale degrees.
 */
/**
 * The chord progression, named explicitly.
 *
 * §20.7.1b said "melody is allowed" and the prompts duly asked for "a simple
 * wistful melody on a soft lead". **`npm run music:check` then measured seven
 * of the ten stems as drones**, which is what asking a *sound-effects* model
 * (§20.7.6a) for an abstraction gets you.
 *
 * The one stem that passed on the first attempt was the one whose prompt
 * contained the word **arpeggio**. That is the whole lesson: this model
 * responds to a concrete musical noun and ignores an adjective. "Melodic",
 * "wistful", "a lead line" are adjectives. "Arpeggio", "Am F C G", "a repeating
 * four-note figure" are things a musician could play.
 *
 * So the key is not stated as a key any more, it is stated as **chords**.
 */
const KEY = 'in A minor, chord progression Am F C G'

/**
 * Shared constraint suffix.
 *
 * Note what is **absent** from it, because the absences were the bug. The
 * previous version carried `continuous`, `even texture`, `slow and unhurried`
 * and `no beat` — four separate instructions to hold still, wrapped around one
 * polite request for a tune. A generator resolves that contradiction the easy
 * way every time.
 *
 * What remains is only the constraint that actually matters when stems overlap:
 * **no drums.** A percussion loop phases against every other loop in the mix
 * within seconds and no prompt fixes it. A melody does not — two lines over the
 * same chords are consonant at any offset, which is §20.7.1b's whole point.
 */
const CONSTRAINTS =
  `upbeat retro sovietwave instrumental ${KEY}, a clear repeating melody the ` +
  'whole way through, warm analogue synth, tape saturation, ' +
  'no drums, no percussion, no vocals, seamless loop, no fade in, no fade out'

interface MusicStem {
  stem: string
  /** GDD §20.7.6 seed brief plus the §20.2 zone palette, verbatim, where one applies. */
  prompt: string
  /** Milliseconds. §20.7.2 rule 4: no stem is longer than 8 bars. */
  durationMs: number
}

/** Every bed and layer is this long. Longer means the loop is less obvious. */
const BED_MS = MAX_SECONDS * 1000

const STEMS: MusicStem[] = [
  // --- §20.7.2, four zone beds — same band edges as src/render/omniLens.ts ---
  {
    // §10.9 / §20.7.2a. The one stem outside the gameplay mix: it plays alone
    // under the title and hands over to bed-desk on a crossfade as the camera
    // pushes into the room.
    stem: 'bed-title',
    prompt:
      'Cosy sovietwave synth instrumental. A soft lead plays a slow four-note ' +
      'arpeggio over a warm pad, wistful and patient, ' +
      `a dark room at night with one monitor on. ${CONSTRAINTS}`,
    durationMs: BED_MS,
  },
  {
    stem: 'bed-desk',
    // Zone 0 (§20.2): intimate, tactile, close.
    prompt:
      'Cosy sovietwave synth instrumental, warm analogue pad over a slow gentle ' +
      'arpeggio, tape hiss, close and a little melancholy, ' +
      `the sound of one person who thinks this is going to be fine. ${CONSTRAINTS}`,
    durationMs: BED_MS,
  },
  {
    stem: 'bed-floor',
    // Zone 1: corporate clutter, more air moving.
    prompt:
      'Retro sovietwave synth instrumental. A chorused lead plays a plain ' +
      'repeating eight-note phrase over an arpeggiated pad, air-conditioning hum ' +
      `underneath, brighter and busier than a quiet room. ${CONSTRAINTS}`,
    durationMs: BED_MS,
  },
  {
    stem: 'bed-global',
    // Zone 2: wide, cold, telemetric.
    prompt:
      'Cold wide sovietwave synth instrumental. A glassy detuned lead plays a slow ' +
      'descending arpeggio over a wide pad, vast and inhuman, ' +
      `the hum of a data centre somebody was proud of once. ${CONSTRAINTS}`,
    durationMs: BED_MS,
  },
  {
    stem: 'bed-cosmic',
    // Zone 3: enormous and empty.
    prompt:
      'Enormous empty sovietwave synth instrumental. One very slow arpeggio on a ' +
      'distant bell-like lead over a deep sub-bass swell, tape-saturated, ' +
      `existential. ${CONSTRAINTS}`,
    durationMs: BED_MS,
  },

  // --- §20.7.2, three strain layers — mixed in by Entropy, zone-agnostic ---
  {
    stem: 'layer-calm',
    prompt:
      'Sparse sovietwave synth instrumental. A soft high bell plays a few slow ' +
      'separated notes over a quiet pad, unhurried, almost nothing there. ' +
      `${CONSTRAINTS}`,
    durationMs: BED_MS,
  },
  {
    stem: 'layer-strained',
    prompt:
      'Uneasy sovietwave synth instrumental. A slowly detuning lead plays a short ' +
      'repeating figure that never resolves, restless tape flutter underneath. ' +
      `${CONSTRAINTS}`,
    durationMs: BED_MS,
  },
  {
    stem: 'layer-collapse',
    prompt:
      'Harsh sovietwave synth instrumental. A badly detuned lead lurches between ' +
      'clashing notes over an oppressive pad, distant alarm-pitched whine, wrong. ' +
      `${CONSTRAINTS}`,
    durationMs: BED_MS,
  },

  // --- §20.7.2, two stingers — one-shots. These MAY have rhythm: nothing is
  // layered against them, so §20.7.1a's no-pulse rule does not apply.
  {
    stem: 'sting-promotion',
    // §7.7.2 rung promotion.
    prompt:
      'Short rising sovietwave sting, warm analogue synth, triumphant and faintly ' +
      `ridiculous, resolves cleanly, one shot, ${KEY}, no vocals, no fade in, no fade out`,
    durationMs: 2600,
  },
  {
    stem: 'sting-paradigm',
    // §13 Paradigm Shift — a reset, not a defeat.
    prompt:
      'Short descending then resolving sovietwave sting, warm analogue synth, a reset ' +
      `rather than a defeat, one shot, ${KEY}, no vocals, no fade in, no fade out`,
    durationMs: 2600,
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
const targets = only.size > 0 ? STEMS.filter((s) => only.has(s.stem)) : STEMS

if (targets.length === 0) {
  console.error(`No stem matched. Known stems: ${STEMS.map((s) => s.stem).join(', ')}`)
  process.exit(2)
}

const key = await loadKey()

await mkdir(OUT_DIR, { recursive: true })

let generated = 0
let skipped = 0

for (const stem of targets) {
  const out = path.join(OUT_DIR, `${stem.stem}.mp3`)

  if (!force && (await exists(out))) {
    console.log(`  skip  ${stem.stem}.mp3 (exists — pass --force to regenerate)`)
    skipped++
    continue
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: stem.prompt,
      duration_seconds: stem.durationMs / 1000,
      // `loop` is accepted and may or may not be honoured; harmless either way,
      // and the bus loops the buffer regardless.
      loop: true,
      // Low, deliberately. High influence on a texture prompt produces a
      // literal-minded sound effect; low lets it stay musical.
      prompt_influence: 0.3,
    }),
  })

  if (!res.ok) {
    console.error(`  FAIL  ${stem.stem}: ${res.status} ${res.statusText}\n${await res.text()}`)
    process.exit(1)
  }

  await writeFile(out, Buffer.from(await res.arrayBuffer()))
  const kb = ((await readFile(out)).length / 1024).toFixed(1)
  console.log(`  ok    ${stem.stem}.mp3  ${(stem.durationMs / 1000).toFixed(1)}s  ${kb} KB`)
  generated++
}

// §20.7.6a — provenance, written every run. The whole point of this file is
// that nobody should ever again have to work out which endpoint made a stem by
// measuring its duration.
await writeFile(
  path.join(OUT_DIR, 'music.manifest.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      endpoint: ENDPOINT,
      note: 'ElevenLabs Sound Effects, not the Music API. See GDD 20.7.1a and 20.7.6a.',
      stems: STEMS.map((s) => ({ stem: s.stem, seconds: s.durationMs / 1000, prompt: s.prompt })),
    },
    null,
    2,
  )}\n`,
)

console.log(`\n${generated} generated, ${skipped} skipped -> public/music/`)
