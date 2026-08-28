/**
 * The geometry of a STUDIO_OS window's scroll rail — GDD §10.6a.
 *
 * The rail exists to answer one question the player should never have to guess
 * at: **is there more below?** §10.6's anti-pattern table forbids OS-native
 * controls, and a platform scrollbar is the most OS-native control there is —
 * it is drawn by the host, it is a different shape on every device, and on a
 * touch WebView it is not drawn at all until the finger is already moving. A
 * window whose content runs past its fold and says nothing about it is the same
 * defect as a modal whose only exit is off screen (§21.0a's note on the term
 * sheet), arrived at from the other direction.
 *
 * So the rail is ours: a track, a thumb, and a lit arrow at the foot while
 * anything is still below. Pure geometry lives here, away from the DOM, because
 * the interesting cases are all arithmetic — a thumb that vanishes on a long
 * list, a thumb that overshoots its track at the bottom, a rail that appears on
 * a window with nothing to scroll — and every one of them is cheaper to pin as
 * a number than to catch in a browser.
 */

export interface RailGeometry {
  /** Is there anything to scroll at all? False hides the whole rail. */
  overflow: boolean
  /** Thumb offset down the track, as a fraction of the track: 0..1. */
  top: number
  /** Thumb length, as a fraction of the track: 0..1. */
  size: number
  /** Is there content below the fold right now? Drives the arrow. */
  more: boolean
  /** And above it. Drives the arrow at the head. */
  less: boolean
}

/**
 * The shortest a thumb may be drawn, as a fraction of the track.
 *
 * A career gallery or a long roster makes the true ratio vanishingly small, and
 * a two-pixel thumb is an artefact rather than a control — it reads as a speck
 * of dirt on the glass. Clamped here rather than in CSS so `top` can be scaled
 * against the room the thumb actually leaves, which is what stops it running
 * past the end of the track at full scroll.
 */
export const MIN_THUMB = 0.12

/**
 * How close to an edge still counts as being at it, in CSS px.
 *
 * Fractional device pixel ratios mean `scrollTop + clientHeight` lands a
 * quarter-pixel short of `scrollHeight` at the true bottom on plenty of real
 * devices, so an exact comparison leaves the "more below" arrow lit on a window
 * that has been scrolled all the way down. One pixel of slack, once.
 */
const EDGE_SLACK = 1

export function railGeometry(scrollTop: number, clientHeight: number, scrollHeight: number): RailGeometry {
  const hidden = scrollHeight - clientHeight
  if (!(hidden > EDGE_SLACK) || !(clientHeight > 0)) {
    return { overflow: false, top: 0, size: 1, more: false, less: false }
  }

  const size = Math.max(MIN_THUMB, Math.min(1, clientHeight / scrollHeight))
  // Progress is measured against the scrollable distance and then laid out in
  // the room the thumb leaves behind — `1 - size` — rather than against the
  // whole track. Scaling against the track is the off-by-one that lets a
  // clamped thumb hang past the bottom of its own rail.
  const progress = Math.min(1, Math.max(0, scrollTop / hidden))

  return {
    overflow: true,
    top: progress * (1 - size),
    size,
    more: scrollTop + clientHeight < scrollHeight - EDGE_SLACK,
    less: scrollTop > EDGE_SLACK,
  }
}
