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
import { getSettings, subscribeSettings } from '../settings/settings.ts'

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

const WAV_SFX = new Set<SfxId>(['ui-click'])

function assetPath(id: SfxId): string {
  return `/sfx/${id}.${WAV_SFX.has(id) ? 'wav' : 'mp3'}`
}

/**
 * Voices per clip. Sustained tapping at 5 taps/sec against a 0.5 s clip needs
 * ~3 overlapping voices; 6 leaves headroom for the burst a player actually
 * produces. GDD §23.3 names audio pool exhaustion as a kill criterion, so this
 * is deliberately generous rather than minimal.
 */
const VOICES = 6

const isNative = Capacitor.isNativePlatform()

/*
 * [2026-09-26] **The browser path is Web Audio: decoded buffers, one source per
 * play.** *"sound effects lag"*, on a phone, playing the web build — which is
 * how the game is played now, so this is no longer the dev-only path the note
 * below it was written for. It used to be a pool of six `HTMLAudioElement`s per
 * clip (120 of them): a phone browser seeks and starts a media element on its
 * own schedule, a hundred milliseconds and more after the tap, and iOS ignores
 * an element's `volume` entirely, so the effects slider did nothing there.
 *
 * Non-negotiable 1's objection to Web Audio is an Android *WebView*'s output
 * latency, and the native app still goes through `NativeAudio` above. In a
 * browser a decoded `AudioBuffer` started on the tap is the shortest path there
 * is: no decode, no seek, no element. The element pool stays as the fallback
 * for a browser without `AudioContext`.
 */
let webCtx: AudioContext | null = null
let webGain: GainNode | null = null
const webBuffers = new Map<SfxId, AudioBuffer>()

/** Browser fallback pool, where Web Audio is unavailable. */
const webPool = new Map<SfxId, HTMLAudioElement[]>()
const webCursor = new Map<SfxId, number>()

/**
 * A browser starts an `AudioContext` suspended until a gesture, and iOS
 * suspends it again when the page is interrupted. Every gesture asks; one that
 * finds it running costs a property read.
 */
function wakeWebAudio(): void {
  if (webCtx && webCtx.state !== 'running' && webCtx.state !== 'closed') void webCtx.resume().catch(() => {})
}

function initWebAudio(): boolean {
  if (webCtx) return true
  if (typeof AudioContext === 'undefined' || typeof fetch === 'undefined') return false
  try {
    webCtx = new AudioContext({ latencyHint: 'interactive' })
    webGain = webCtx.createGain()
    webGain.gain.value = volume
    webGain.connect(webCtx.destination)
  } catch {
    webCtx = null
    webGain = null
    return false
  }
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown'] as const) {
    window.addEventListener(type, wakeWebAudio, { capture: true, passive: true })
  }
  // Decoded in the background: the bank is ready at once, and a clip plays from
  // the moment its buffer lands (well before the first scene's first tick).
  const ctx = webCtx
  void Promise.all(
    SFX.map(async (id) => {
      try {
        const res = await fetch(assetPath(id))
        // A clip that is listed but not yet made (`title-start`) comes back as the
        // site's HTML page, not a 404: nothing to decode, and `uiSfx` routes
        // around it through its fallback table.
        if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('audio')) return
        webBuffers.set(id, await ctx.decodeAudioData(await res.arrayBuffer()))
      } catch (err) {
        // One missing clip must not take the whole audio layer down with it.
        console.warn(`[sfx] decode failed for ${id}`, err)
      }
    }),
  )
  return true
}

let ready = false

/**
 * The F2.1 effects volume, mirrored locally.
 *
 * **Read from a plain number rather than from `getSettings()` on every play.**
 * `playSfx` runs inside the tap handler §23.3 criterion 1 measures against a
 * 60 ms p95 budget, and the whole reason this file exists is that the audio
 * path is the single largest feel risk in the project. A push-on-change mirror
 * costs nothing on the hot path; a native `setVolume` call per poke would cross
 * the Capacitor bridge inside the measurement.
 */
let volume = getSettings().sfx

subscribeSettings((s) => {
  if (s.sfx === volume) return
  volume = s.sfx
  if (webGain) webGain.gain.value = volume
  applyNativeVolume()
})

/**
 * Native volume is set per asset, once, on change — not per play.
 *
 * The plugin has no master, so every preloaded clip carries its own gain and a
 * change has to walk the whole bank. That is fine at the rate a human moves a
 * slider and would not be fine at the rate a human pokes.
 */
function applyNativeVolume(): void {
  if (!isNative || !ready) return
  for (const id of SFX) {
    void NativeAudio.setVolume({ assetId: id, volume }).catch(() => {})
  }
}

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
          assetPath: `public${assetPath(id)}`,
          audioChannelNum: VOICES,
          isUrl: false,
        }).catch((err: unknown) => {
          // One missing clip must not take the whole audio layer down with it.
          console.warn(`[sfx] preload failed for ${id}`, err)
        }),
      ),
    )
  } else if (!initWebAudio()) {
    for (const id of SFX) {
      const voices = Array.from({ length: VOICES }, () => {
        const el = new Audio(assetPath(id))
        el.preload = 'auto'
        return el
      })
      webPool.set(id, voices)
      webCursor.set(id, 0)
    }
  }

  ready = true
  // The bank exists now, so the stored preference can finally be applied to it.
  // Before this line there was nothing to set a volume on.
  applyNativeVolume()
}

/**
 * Fire a clip. Deliberately synchronous-looking and un-awaited at the call
 * site: the poke handler must not yield before the sound starts.
 */
export function playSfx(id: SfxId): void {
  if (!ready) return
  // Silence is a real setting, and starting a voice at zero gain still burns a
  // pool slot and a bridge call to produce nothing.
  if (volume <= 0) return

  if (isNative) {
    void NativeAudio.play({ assetId: id })
    return
  }

  if (webCtx && webGain) {
    const buffer = webBuffers.get(id)
    if (!buffer) return
    if (webCtx.state !== 'running') wakeWebAudio()
    // A source node is one play and is thrown away: overlapping taps are
    // overlapping sources, so there is no pool to exhaust.
    const source = webCtx.createBufferSource()
    source.buffer = buffer
    source.connect(webGain)
    source.start()
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
  // Per-element rather than per-bank: the web path has no shared node, and
  // assigning a float costs nothing next to the `play()` below.
  el.volume = volume
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

/**
 * Coding uses the original dry desk switch. A bank of generated variations
 * made a short run of clicks read as a melody; one neutral transient is the
 * sound the interaction had before that experiment and never forms a tune.
 */
export function playKeyboardClick(): void {
  playSfx('poke-desk')
}

export async function unloadSfx(): Promise<void> {
  if (!ready) return
  if (isNative) {
    await Promise.all(SFX.map((id) => NativeAudio.unload({ assetId: id }).catch(() => {})))
  }
  webPool.clear()
  webCursor.clear()
  webBuffers.clear()
  ready = false
}
