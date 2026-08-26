/**
 * Speech balloons, pooled — GDD §7.8.6, §8.3.
 *
 * Extracted from `ambient.ts` on 2026-08-26, when §7.8.9's away population
 * moved out into `errands.ts` and two modules needed to put words over
 * somebody's head. The alternative was a second `Text` pool and a second copy
 * of the pop curve, which is how the two would have drifted apart — one of them
 * getting the wall-clock fix and the other keeping the zoom.
 *
 * Everything §7.8.6's header argued for is preserved verbatim, because it was
 * all argued from evidence:
 *
 *  - **The words do not scale with the box.** A bubble whose text grows out of
 *    nothing is a zoom; a bubble that snaps open and then has words in it is
 *    somebody speaking. So the balloon pops and the label is either there at
 *    full size or not there at all.
 *  - **A bubble nobody can read is not drawn.** §6.3 is that dialogue is the
 *    product; a line of it five pixels tall is a white smudge on a desk.
 *  - **The pool is per instance, never module-local.** A shared pool would have
 *    two rooms writing over each other's words and `destroy` on one taking the
 *    other's labels with it.
 */

import { Container, Graphics, Text } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import { bubblePop } from '../sim/ambient.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/**
 * The smallest a bubble may be drawn, as a multiple of its authored size.
 *
 * Below this the words stop being words. The face is 11 px at 1.0, so 0.62 is
 * about seven pixels of cap height — the last size at which a short line still
 * reads as language rather than as texture. Clamping the counter-scale (see
 * {@link counterScale}) means the bubble stops growing at a 2.4x magnification,
 * so this threshold is crossed at a room scale of about 0.26: legible from
 * Squad inward, and absent at Floor and Building where the unit on screen is a
 * squad or a storey and nobody is being quoted anyway.
 */
export const BUBBLE_MIN_SCALE = 0.62

/**
 * How much to counter-scale a bubble so it is drawn at a constant *screen* size.
 *
 * Bubbles are parented into the room and therefore scale with the camera, which
 * at the Hero Anchor zoom made a speech bubble taller than the HUD and wider
 * than four desks. Text pinned to a world object still has to be legible rather
 * than proportional — the same reason a map label does not grow when you zoom.
 */
export function counterScale(worldScale: number): number {
  return Math.min(2.4, 1 / Math.max(0.35, worldScale))
}

/** Is a bubble at this world scale worth drawing at all? */
export function bubblesLegible(worldScale: number): boolean {
  return worldScale * counterScale(worldScale) >= BUBBLE_MIN_SCALE
}

/** Which ramp a balloon takes. `warn` is for interruptions nobody asked for. */
export type BubbleTone = 'speech' | 'warn'

export interface Bubbles {
  readonly layer: Container
  /** Start a frame: clears the balloons and rewinds the label pool. */
  begin(): void
  /** One balloon, with `says` in it. Times are in wall-clock milliseconds. */
  draw(opts: {
    x: number
    y: number
    ageMs: number
    remainMs: number
    says: string
    /** The counter-scale from {@link counterScale}. */
    inv: number
    tone?: BubbleTone
  }): void
  /** Finish a frame: hides whatever the pool did not claim. */
  end(): void
  clear(): void
  destroy(): void
}

export function createBubbles(): Bubbles {
  const layer = new Container()
  const g = new Graphics()
  layer.addChild(g)

  const labels: Text[] = []
  let used = 0
  /**
   * Set once if `Text` cannot be constructed — which happens wherever there is
   * no canvas to measure against. The balloon then draws without words rather
   * than throwing, so the *behaviour* stays testable headlessly and a real
   * device that somehow fails to make a Text loses the joke rather than the
   * frame.
   */
  let textUnavailable = false

  function label(text: string): Text | null {
    if (textUnavailable) return null
    let t = labels[used]
    if (!t) {
      try {
        t = new Text({
          style: {
            // ART_DIRECTION §3 — the one face. The generic fallback matters:
            // the woff2 may not have loaded, and a missing font must degrade to
            // the wrong monospace rather than to no words at all.
            fontFamily: 'Departure Mono, monospace',
            fontSize: 9,
            fill: 0xffffff,
          },
        })
        t.anchor.set(0.5, 0)
      } catch {
        textUnavailable = true
        return null
      }
      labels.push(t)
      layer.addChild(t)
    }
    used++
    if (t.text !== text) t.text = text
    t.visible = true
    return t
  }

  function hideFrom(from: number) {
    for (let i = from; i < labels.length; i++) labels[i].visible = false
  }

  return {
    layer,

    begin() {
      g.clear()
      used = 0
    },

    draw({ x, y, ageMs, remainMs, says, inv, tone = 'speech' }) {
      const pop = bubblePop(ageMs, remainMs)
      if (pop.sy <= 0.01) return

      const fill = tone === 'warn' ? RAMPS.WARN[0] : RAMPS.NEUTRAL[7]
      const ink = RAMPS.NEUTRAL[0]

      const node = pop.ink ? label(says) : null
      if (node) {
        node.scale.set(inv)
        node.tint = c(ink)
      }

      const w = (says.length * 5.4 + 10) * pop.sx * inv
      const h = 15 * pop.sy * inv
      const k = pop.sy * inv

      g.roundRect(x - w / 2, y - h, w, h, 3 * k).fill({ color: c(fill), alpha: 0.95 })
      // The tail, pointing down at whoever is speaking.
      g.moveTo(x - 3 * k, y)
        .lineTo(x + 2 * k, y)
        .lineTo(x - 1 * k, y + 5 * k)
        .closePath()
        .fill({ color: c(fill), alpha: 0.95 })

      node?.position.set(x, y - h + 3 * inv)
    },

    end() {
      hideFrom(used)
    },

    clear() {
      g.clear()
      used = 0
      hideFrom(0)
    },

    destroy() {
      layer.destroy({ children: true })
      labels.length = 0
    },
  }
}
