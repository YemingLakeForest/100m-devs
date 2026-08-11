import { Children, useCallback, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { playUi } from './uiSfx.ts'
import { ConceptText } from './ConceptText.tsx'
import { conceptsIn, type Concept } from './concepts.ts'

/**
 * The pressable control — GDD §10.8 F2, and §10.6's "rectangular flat-colour
 * buttons" row.
 *
 * F2's test is "press and hold every interactive element without releasing; if
 * nothing changed, fail", so everything here hangs off pointer *down*:
 *
 *   - the slab depresses to 0.96 and its offset rule collapses under it;
 *   - the fill steps one value brighter, so the change is a shape and a colour
 *     at once rather than a hover-style tint;
 *   - the click sounds on down, not on up. This is the row people get wrong,
 *     and it is the difference between the button responding to the finger and
 *     the button reporting on the finger afterwards.
 *
 * On release the slab springs back through an overshoot rather than easing to
 * rest, which is F2's "not a linear return".
 *
 * Two ART_DIRECTION points the F2 wording brushes against. §1 forbids drop
 * shadows and bevels outright, so the "shadow" that collapses here is a hard
 * 2px offset slab of the dark phosphor value — no blur, no gradient, the
 * offset-block idiom of a terminal rather than a lit object. And §10.6 names
 * the axis-aligned rounded rectangle as the most web-page-looking object
 * available, so the frame is a 4° skewed parallelogram with the label
 * counter-skewed back to upright, wrapped in terminal brackets.
 */

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onPointerDown'> {
  /** `bait` is the §21 Act III mousetrap — the one control permitted to beg. */
  variant?: 'default' | 'bait'
  /** A button named entirely for one tracked concept keeps that concept's ink. */
  concept?: Concept
  children: ReactNode
}

export function Button({ variant = 'default', concept, className, children, ...rest }: ButtonProps) {
  const [pressed, setPressed] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const hasConceptLabel = Children.toArray(children).some(
    (child) => typeof child === 'string' && conceptsIn(child).length > 0,
  )

  const onPointerDown = useCallback(() => {
    setPressed(true)
    setReleasing(false)
    // F2, and F3: the acknowledgement of the finger is the sound, so it belongs
    // to the press and not to the click event that may never arrive.
    playUi('click')
  }, [])

  const onRelease = useCallback(() => {
    setPressed((was) => {
      // Only spring back if the press actually landed here — a pointer that
      // wandered in from elsewhere has nothing to release.
      if (was) setReleasing(true)
      return false
    })
  }, [])

  const classes = [
    'ui-btn',
    variant === 'bait' && 'ui-btn--bait',
    hasConceptLabel && 'ui-btn--has-concept',
    concept && `ui-btn--concept kw--${concept}`,
    pressed && 'is-pressed',
    releasing && 'is-releasing',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const label = Children.map(children, (child) =>
    typeof child === 'string' ? <ConceptText text={child} /> : child,
  )

  return (
    <button
      type="button"
      {...rest}
      className={classes}
      onPointerDown={onPointerDown}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onPointerLeave={onRelease}
      onAnimationEnd={() => setReleasing(false)}
    >
      <span className="ui-btn__face">
        <span className="ui-btn__bracket" aria-hidden="true">
          [
        </span>
        <span className="ui-btn__label">{label}</span>
        <span className="ui-btn__bracket" aria-hidden="true">
          ]
        </span>
      </span>
    </button>
  )
}
