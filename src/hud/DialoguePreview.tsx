import { useState } from 'react'
import { Dialogue, type DialogueLine } from '../ui/Dialogue.tsx'

/**
 * The §10.8 gate, runnable — `?dialogue`.
 *
 * §10.8 says the gate "runs on the device" and that a reviewer sits with the
 * thing and tries F1–F6 in turn. The dialogue system has no caller yet (§21.0
 * has not been reshaped and the store carries no scene state), so without this
 * there is nothing on a phone to sit with, and §23.6 already lists visual
 * verification as owed to a human rather than to code.
 *
 * Dev affordance, same register as `?act=` and `?bench`. It replaces nothing
 * and no shipping path reaches it.
 */

/** Lines lifted from §21 and §19 so the preview exercises the real register. */
const SCRIPT: readonly DialogueLine[] = [
  {
    speaker: 'STUDIO_OS',
    text: 'STUDIO_OS v0.0.1 initialized. Project: "Flappy Square 1.0". Sprint commitment: 300 story points. Developer count: 1.',
  },
  {
    speaker: 'JAMES',
    text: 'Okay... just need to write 300 lines of code. Simple enough.',
  },
  {
    speaker: 'ADVISOR',
    text: 'Progress is dangerously slow! At this rate, your indie game will launch after the sun dies. Let’s scale up!',
  },
  {
    speaker: 'JAMES',
    text: 'Poking me again isn’t making the meeting end sooner.',
  },
]

export function DialoguePreview() {
  const [run, setRun] = useState(0)
  const [playing, setPlaying] = useState(true)

  if (!playing) {
    return (
      <div className="hud__actions">
        <button
          type="button"
          className="bench-trigger"
          onClick={() => {
            setRun((n) => n + 1)
            setPlaying(true)
          }}
        >
          REPLAY §10.7
        </button>
      </div>
    )
  }

  return (
    <Dialogue
      key={run}
      script={SCRIPT}
      // Every odd run replays as "already seen", which is the one §10.7
      // exception — instant fill, same taps. Having both on one screen is the
      // cheapest way to check the exception did not quietly become a skip.
      seen={run % 2 === 1}
      onFinished={() => setPlaying(false)}
    />
  )
}
