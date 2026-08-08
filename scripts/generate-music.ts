/**
 * Generate the adaptive score's nine stems via ElevenLabs Music.
 *
 * Prompts are source-controlled here so the score is reproducible — the MP3s
 * are build output, this file is the asset. Mirrors scripts/generate-sfx.ts
 * (key from .env, skip existing, --force to overwrite, positional args to
 * target a subset) because GDD §20.7.6 says to.
 *
 *   npm run music:generate                # generate whatever is missing
 *   npm run music:generate -- --force     # regenerate everything
 *   npm run music:generate -- bed-desk    # just one, by stem
 *
 * Stems are specified by GDD §20.7.2 (the nine-piece budget) and §20.7.6
 * (seed briefs). This is Web Audio material, not native audio — GDD §23.2
 * non-negotiable 1 draws that line and it is why this writes to public/music,
 * never through @capacitor-community/native-audio.
 *
 * -------------------------------------------------------------------------
 * TWO THINGS THE GDD FLAGS AS "CONFIRM, DO NOT ASSUME" (§20.7.6):
 *
 * 1. Endpoint. `generate-sfx.ts` posts to /v1/sound-generation, which is
 *    ElevenLabs' Sound Effects product, not Music — a different route with a
 *    different request shape. Per ElevenLabs' own API reference
 *    (https://elevenlabs.io/docs/api-reference/music/compose, checked
 *    2026-08-07), music generation is:
 *
 *      POST https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128
 *      body: { prompt: string, music_length_ms: number, model_id?: string }
 *      -> raw audio bytes (application/octet-stream), not JSON.
 *
 *    This has been checked against the docs, not guessed by analogy — but
 *    ElevenLabs ships API changes faster than this comment gets reread, so
 *    reconfirm against the reference above before the first real run if any
 *    time has passed.
 *
 * 2. Commercial licence. ElevenLabs' own docs state Music V2 is "cleared for
 *    nearly all commercial uses, from film and television to podcasts and
 *    social media videos, and from advertisements to gaming" (Eleven Music
 *    overview), and the published usage tiers explicitly name an "Offline"
 *    tier covering "games, apps, live events". Game development is not on
 *    the excluded-sectors list in elevenlabs.io/music-terms. That is a real
 *    green light, but it was read off marketing copy plus the general
 *    service terms, not the "Eleven Music Model-Specific Terms" the service
 *    terms defer to for conflicts, and not confirmed against whichever plan
 *    tier this project is actually subscribed to. Read that document once
 *    before the final generation pass — this comment is a strong steer, not
 *    a signed-off legal confirmation.
 * -------------------------------------------------------------------------
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'music')

// UNVERIFIED beyond the docs read above — this is Eleven Music's /v1/music
// compose route, not the /v1/sound-generation route generate-sfx.ts uses.
// Re-check https://elevenlabs.io/docs/api-reference/music/compose before the
// real run if this file has aged.
const ENDPOINT = 'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128'

/**
 * Shared constraint suffix. GDD §20.7.1: "every stem is written in the same
 * key, at the same tempo, in the same bar length" is the single rule that
 * lets any stem crossfade against any other with no beat-matching — a stem
 * that drifts from this is unusable regardless of how good it sounds, so it
 * belongs in every prompt rather than in a review note afterwards.
 */
const CONSTRAINTS =
  'A minor, 84 BPM, 8 bars, loopable, seamless loop point, no vocals, ' +
  'no fade in, no fade out, chiptune synth register throughout, no orchestral instrumentation'

/** 8 bars at 84 BPM, 4/4: 8 * 4 * (60000 / 84) ~= 22857 ms. */
const EIGHT_BARS_MS = Math.round(8 * 4 * (60_000 / 84))

interface MusicStem {
  stem: string
  /** GDD §20.7.6 seed brief plus the §20.2 zone palette, verbatim, where one applies. */
  prompt: string
  /** Milliseconds. §20.7.2 rule 4: no stem is longer than 8 bars. */
  durationMs: number
}

const STEMS: MusicStem[] = [
  // --- GDD §20.7.2, four zone beds — same band edges as src/render/omniLens.ts ---
  {
    // §10.9 / §20.7.2a. The one stem outside the gameplay mix: it plays alone
    // under the title and hands over to bed-desk on a crossfade as the camera
    // pushes into the room, so it has to sit in the same key and tempo as
    // everything else despite never being mixed with it.
    stem: 'bed-title',
    prompt:
      'Cozy lofi synth loop, sparse and slow, one held pad underneath. Spacious, ' +
      'patient, a title screen at night with one monitor on. Fewer elements than a ' +
      `full arrangement — it has to sit under a logo. ${CONSTRAINTS}`,
    durationMs: EIGHT_BARS_MS,
  },
  {
    stem: 'bed-desk',
    // Zone 0 palette (§20.2): intimate, tactile, mechanical, low-latency.
    prompt:
      'Cozy lofi synth loop. Warm, slow, unhurried, a little wistful — the sound of one ' +
      `person who thinks this is going to be fine. ${CONSTRAINTS}`,
    durationMs: EIGHT_BARS_MS,
  },
  {
    stem: 'bed-floor',
    // Zone 1 palette: chaotic corporate drone, overlapping clutter.
    prompt:
      'The same lofi progression as a cozy desk theme, but busier — arpeggios enter. ' +
      `Corporate optimism with an edge. ${CONSTRAINTS}`,
    durationMs: EIGHT_BARS_MS,
  },
  {
    stem: 'bed-global',
    // Zone 2 palette: high-tech data streams, rhythmic telemetry.
    prompt:
      `Modular synth arpeggios, pulsing telemetry. Wide, cold, impressive, inhuman. ${CONSTRAINTS}`,
    durationMs: EIGHT_BARS_MS,
  },
  {
    stem: 'bed-cosmic',
    // Zone 3 palette: massive cosmic scale, existential synth pads.
    prompt:
      'Existential synth pads over a 40 Hz sub. Almost ambient. Enormous and empty. ' +
      CONSTRAINTS,
    durationMs: EIGHT_BARS_MS,
  },

  // --- GDD §20.7.2, three strain layers — mixed in by Entropy, zone-agnostic ---
  {
    stem: 'layer-calm',
    prompt: `Sparse: a soft pad and an occasional bell. Barely present. ${CONSTRAINTS}`,
    durationMs: EIGHT_BARS_MS,
  },
  {
    stem: 'layer-strained',
    prompt:
      `A pulsing bass and a ticking percussive figure that will not resolve. ${CONSTRAINTS}`,
    durationMs: EIGHT_BARS_MS,
  },
  {
    stem: 'layer-collapse',
    prompt:
      'Detuned, dissonant, an alarm-pitched figure fighting the key it is written in. ' +
      CONSTRAINTS,
    durationMs: EIGHT_BARS_MS,
  },

  // --- GDD §20.7.2, two stingers — one-shots, in key, land on the beat ---
  {
    stem: 'sting-promotion',
    // §7.7.2 rung promotion. Four bars, not eight — §20.7.2 caps length, not floor.
    prompt:
      'Four-bar rising musical stinger, triumphant, faintly ridiculous, resolves cleanly ' +
      `on the downbeat. A minor, 84 BPM, no vocals, no fade in, no fade out, chiptune synth register.`,
    durationMs: Math.round(4 * 4 * (60_000 / 84)),
  },
  {
    stem: 'sting-paradigm',
    // §13 Paradigm Shift. Two bars: a reset, not a defeat.
    prompt:
      'Two-bar musical stinger, descending then resolving — a reset, not a defeat. ' +
      'A minor, 84 BPM, no vocals, no fade in, no fade out, chiptune synth register.',
    durationMs: Math.round(2 * 4 * (60_000 / 84)),
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

/**
 * Check the account tier before spending a request on it.
 *
 * The Music API is paid-only while the Sound Effects API — which produced this
 * project's entire SFX bank — is not, so a key that works perfectly for
 * `generate-sfx.ts` fails here with a bare `402 Payment Required`. That error
 * is true and useless: it says nothing about *which* key, and the natural
 * reading is "my subscription is not working" rather than "this repo has a
 * different key from the one I pay for".
 *
 * Which is exactly what happened. Three ElevenLabs keys exist across these
 * projects; this one reports `tier: free`, and the other two are API key *IDs*
 * rather than keys, which ElevenLabs rejects outright.
 *
 * So the preflight names the account, and costs one free request.
 */
async function preflight(): Promise<void> {
  const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
    headers: { 'xi-api-key': key },
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`Could not read the account for this key (${res.status}).\n${body}`)
    console.error(
      '\nIf the message mentions "API key ID", the value in .env is the key\'s identifier',
    )
    console.error('rather than the key itself. Real keys begin with "sk_".')
    process.exit(1)
  }

  const sub = (await res.json()) as { tier?: string }
  console.log(`  account  tier: ${sub.tier ?? 'unknown'}  (key ${key.slice(0, 6)}…)`)
  if (sub.tier === 'free') {
    console.error(
      [
        '',
        'The Music API is not available on the free tier. Sound Effects IS, which is why',
        'generate-sfx.ts works with this same key and this does not — the script is fine.',
        '',
        'ELEVENLABS_API_KEY in .env belongs to a free account. Paste the key from the paid',
        'account into .env and re-run. See GDD §20.7.6a.',
      ].join('\n'),
    )
    process.exit(1)
  }
}

await preflight()
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
      prompt: stem.prompt,
      music_length_ms: stem.durationMs,
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

console.log(`\n${generated} generated, ${skipped} skipped -> public/music/`)
