/**
 * Poke and UI sound effects — the NATIVE audio path.
 *
 * GDD §23.2 non-negotiable 1, non-negotiable: poke SFX go through native audio,
 * never Web Audio. Web Audio in an Android WebView can carry 100–300 ms of
 * latency against a 60 ms p95 budget (GDD §23.3 criterion 2), and this is the
 * single largest feel risk in the project.
 *
 * Web Audio keeps the GDD §20 ambient bus and DSP layers, where 100 ms is
 * inaudible. That lives in src/audio/ambience.ts, not here.
 */

import { Capacitor } from '@capacitor/core'
import { NativeAudio } from '@capacitor-community/native-audio'

/** Every clip loaded at startup. Stems match scripts/generate-sfx.ts. */
export const SFX = [
  'poke-desk',
  'poke-floor',
  'poke-global',
  'poke-cosmic',
  'poke-crit',
  'poke-void',
  'zoom-in',
  'zoom-out',
  'entropy-lock',
  // §21 Act IV part 4 — "the cozy lofi music abruptly cuts out, replaced by an
  // overwhelming, chaotic wall of overlapping notification pings, loud
  // overlapping chatter, and an alarm siren."
  'collapse-thud',
  'collapse-siren',
  'collapse-chatter',
  'collapse-ping',
  // §10.7 / §10.8 F2 + F3 — the interface bank. The most-heard sounds in the
  // product, so they are the shortest and the least characterful.
  'ui-click',
  'ui-whoosh',
  'ui-close',
  'ui-tick',
  // GDD 10.9.4 - START pressed. Not generated yet; uiSfx.ts routes it through
  // FALLBACK until it is, which is what the fallback table is for.
  'title-start',
] as const

export type SfxId = (typeof SFX)[number]

/**
 * Voices per clip. Sustained tapping at 5 taps/sec against a 0.5 s clip needs
 * ~3 overlapping voices; 6 leaves headroom for the burst a player actually
 * produces. GDD §23.3 names audio pool exhaustion as a kill criterion, so this
 * is deliberately generous rather than minimal.
 */
const VOICES = 6

const isNative = Capacitor.isNativePlatform()

/** Browser fallback pool — dev only. Never the path a pass/fail is measured on. */
const webPool = new Map<SfxId, HTMLAudioElement[]>()
const webCursor = new Map<SfxId, number>()

let ready = false

/**
 * Preload every clip. Call once, early — GDD §23.3 criterion 6 gives cold start
 * to interactive a 3 s budget, and decoding on first tap would show up as
 * latency on exactly the tap being measured.
 */
export async function initSfx(): Promise<void> {
  if (ready) return

  if (isNative) {
    await Promise.all(
      SFX.map((id) =>
        NativeAudio.preload({
          assetId: id,
          assetPath: `public/sfx/${id}.mp3`,
          audioChannelNum: VOICES,
          isUrl: false,
        }).catch((err: unknown) => {
          // One missing clip must not take the whole audio layer down with it.
          console.warn(`[sfx] preload failed for ${id}`, err)
        }),
      ),
    )
  } else {
    for (const id of SFX) {
      const voices = Array.from({ length: VOICES }, () => {
        const el = new Audio(`/sfx/${id}.mp3`)
        el.preload = 'auto'
        return el
      })
      webPool.set(id, voices)
      webCursor.set(id, 0)
    }
  }

  ready = true
}

/**
 * Fire a clip. Deliberately synchronous-looking and un-awaited at the call
 * site: the poke handler must not yield before the sound starts.
 */
export function playSfx(id: SfxId): void {
  if (!ready) return

  if (isNative) {
    void NativeAudio.play({ assetId: id })
    return
  }

  const voices = webPool.get(id)
  if (!voices) return

  // Round-robin across the pool so a rapid retrigger starts a new voice
  // instead of restarting the one already sounding.
  const i = webCursor.get(id) ?? 0
  webCursor.set(id, (i + 1) % voices.length)

  const el = voices[i]
  el.currentTime = 0
  // Autoplay policy rejects this until the first user gesture. The first poke
  // *is* a gesture, so this only ever silently no-ops before the game starts.
  void el.play().catch(() => {})
}

/** The poke sound for a zoom level — GDD §20.5. */
export function pokeSfxForZoom(zoom: 1 | 2 | 3 | 4): SfxId {
  switch (zoom) {
    case 1:
      return 'poke-desk'
    case 2:
      return 'poke-floor'
    case 3:
      return 'poke-global'
    case 4:
      return 'poke-cosmic'
  }
}

export async function unloadSfx(): Promise<void> {
  if (!ready) return
  if (isNative) {
    await Promise.all(SFX.map((id) => NativeAudio.unload({ assetId: id }).catch(() => {})))
  }
  webPool.clear()
  webCursor.clear()
  ready = false
}
