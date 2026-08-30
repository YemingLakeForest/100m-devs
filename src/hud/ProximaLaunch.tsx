import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motionMs, useReducedMotion } from '../ui/motion.ts'
import { playUi } from '../ui/uiSfx.ts'
import { PROXIMA_LY, starName } from '../sim/starfield.ts'

import '../styles/proxima.css'

/**
 * §21.8 — the launch. GDD §7.7.1a's door, played once.
 *
 * `SCENE_JAMES_PROXIMA` is the argument; this is the consequence, and it is a
 * *shot list* rather than a dialogue because the joke is entirely visual and
 * §10.7's box cannot hold a picture. The scene ends on `STAND CLEAR OF THE
 * FILING CABINET` and this begins on the next frame.
 *
 * ## Why it is drawn here and not in Pixi
 *
 * §23.2 non-negotiable 3 puts the simulation, the camera and the particles on
 * the canvas and everything with structured text on the DOM, and this is not a
 * borderline case: it is nine captioned title cards. Nothing in it is in the
 * world — the studio is *not there*, which is the point of the shot where the
 * planet leaves — so putting it on the canvas would mean building a second
 * scene graph the camera must be kept away from. §15.1a's reboot made the same
 * call for the same reason.
 *
 * ## Why the rocket does not move
 *
 * Shot five. The player has spent the whole game watching a fixed isometric
 * camera and a world that grows underneath it, so the funniest and cheapest
 * possible launch is the one that keeps faith with that: the filing cabinet
 * holds still and **the planet leaves**. It is one CSS transform on the thing
 * nobody expected to be transformed, and it says the studio has stopped being
 * the largest object in the game in a way no caption could.
 *
 * ## The pace is the player's
 *
 * Each shot has a dwell, and a tap skips to the next one — the same contract
 * `CutScene` and §10.7's box both keep, and the reason F6 is not violated by a
 * fourteen-second interstitial: nobody is ever *waiting* on it. Reduced motion
 * scales every dwell by §10.5 rule 3 rather than cutting the sequence, so the
 * beats still land in order for a player who asked for less movement.
 */

interface Shot {
  /** How long it holds before advancing on its own, in ms at full motion. */
  ms: number
  /** The machine's line. Flat, always — `STUDIO_OS` has no opinions. */
  os?: string
  /** A line of James's, over the picture. */
  says?: string
  /** Which tableau to draw. */
  art:
    | 'pad'
    | 'porthole'
    | 'hold'
    | 'ignition'
    | 'cruise'
    | 'arrival'
    | 'flag'
    | 'open'
    | 'standup'
}

/**
 * The shot list.
 *
 * Nine, and the count is the budget rather than a coincidence: §10.8's F6 says
 * a player waiting for the game to finish being beautiful is not looking at
 * something beautiful, so the whole sequence is about fourteen seconds and any
 * one shot can be skipped past in a thumb's width of time.
 */
const SHOTS: readonly Shot[] = [
  {
    ms: 2000,
    art: 'pad',
    os: 'VEHICLE: FILING CABINET, 4-DRAWER, GREY. FINS: TAPED.',
  },
  {
    ms: 1900,
    art: 'porthole',
    says: 'The top drawer is the window. The other three are for my things.',
  },
  {
    // The hold. Every launch has one, and this one is a calendar invite.
    ms: 2100,
    art: 'hold',
    os: 'HOLD AT T-2. ONE (1) UNREAD MESSAGE.',
    says: 'It’s a meeting invite. I’ve accepted it.',
  },
  {
    ms: 1700,
    art: 'ignition',
    os: 'T-0.',
  },
  {
    ms: 2300,
    art: 'cruise',
    os: 'THE ROCKET DID NOT MOVE. THE PLANET DID.',
  },
  {
    ms: 2400,
    art: 'arrival',
    os: `CROSSING ${PROXIMA_LY.toFixed(4)} LIGHT-YEARS. ELAPSED: ONE SPRINT.`,
  },
  {
    ms: 2000,
    art: 'flag',
    says: 'I’ve planted the chair. The chair is the office.',
  },
  {
    ms: 2200,
    art: 'open',
    os: `SITE OPENED: ${starName(1)}. 100,000,000 DESKS AVAILABLE.`,
  },
  {
    // The last line arrives four and a bit years late and is about nothing.
    // That is §16's interstellar latency, stated as a joke before it is stated
    // as a term in `sim/starbound.ts`.
    ms: 2600,
    art: 'standup',
    os: 'INCOMING — SENT 4.2 YEARS AGO',
    says: 'Morning. Anything blocking?',
  },
]

export function ProximaLaunch({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion()
  const [shot, setShot] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const exitMs = motionMs(420, reduced)

  // Latched, for `CutScene`'s reason: an inline arrow from the caller changes
  // identity on every parent render and would restart the exit timer mid-fade.
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  const current = SHOTS[Math.min(shot, SHOTS.length - 1)]
  const dwell = motionMs(current.ms, reduced)

  useEffect(() => {
    if (leaving) return
    const timer = setTimeout(() => advance(), dwell)
    return () => clearTimeout(timer)
    // `advance` is stable enough for this — it only reads `shot`, which is the
    // dependency that already re-runs the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, dwell, leaving])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => done.current(), exitMs)
    return () => clearTimeout(timer)
  }, [leaving, exitMs])

  function advance() {
    if (leaving) return
    if (shot < SHOTS.length - 1) {
      setShot((s) => s + 1)
      playUi('tick')
    } else {
      playUi('start')
      setLeaving(true)
    }
  }

  return (
    <div
      className="proxima"
      data-phase={leaving ? 'exit' : 'in'}
      data-art={current.art}
      style={{ '--proxima-exit': `${exitMs}ms`, '--proxima-dwell': `${dwell}ms` } as CSSProperties}
      onClick={advance}
      role="presentation"
    >
      {/* The field the whole sequence happens against. Three parallax layers of
          nothing, so the cut from a lit garage to deep space is not a cut to a
          black rectangle. */}
      <div className="proxima__sky" aria-hidden="true">
        <span className="proxima__stars proxima__stars--far" />
        <span className="proxima__stars proxima__stars--mid" />
        <span className="proxima__stars proxima__stars--near" />
      </div>

      <div className="proxima__stage" aria-hidden="true">
        {/* The planet. It is behind the cabinet until shot five, and then it is
            the thing that leaves. */}
        <span className="proxima__earth" />
        {/* Proxima itself — a red dwarf, and small, which is the true thing that
            is also the funnier one. */}
        <span className="proxima__star" />
        <span className="proxima__world" />

        <span className="proxima__ship">
          <span className="proxima__drawer proxima__drawer--porthole">
            <span className="proxima__james">
              {/* The shirt, and the hole in the elbow — §2.3's promise, cashed. */}
              <span className="proxima__james-head" />
              <span className="proxima__james-shirt" />
              <span className="proxima__james-hole" />
            </span>
          </span>
          <span className="proxima__drawer" />
          <span className="proxima__drawer" />
          <span className="proxima__drawer" />
          <span className="proxima__fin proxima__fin--left" />
          <span className="proxima__fin proxima__fin--right" />
          <span className="proxima__tape" />
          <span className="proxima__flame" />
        </span>

        <span className="proxima__chair" />
        <span className="proxima__flag">SPRINT 1</span>
        <span className="proxima__invite">THU 09:00 — STAND-UP</span>
      </div>

      <div className="proxima__caption">
        {current.os && <p className="proxima__os">{current.os}</p>}
        {current.says && (
          <p className="proxima__says">
            <span className="proxima__who">JAMES</span>
            {current.says}
          </p>
        )}
      </div>

      <p className="proxima__skip">TAP TO CONTINUE</p>
    </div>
  )
}
