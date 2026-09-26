import { useMemo } from 'react'
import type {
  FounderAccessory,
  FounderBody,
  FounderBodyColour,
  FounderHairColour,
  FounderHead,
  FounderFacialHair,
  FounderSkin,
} from '../game/founderProfile.ts'
import { founderLook } from '../game/founderProfile.ts'
import { personPortrait } from '../three/render/portrait.ts'

import '../styles/founderAvatar.css'

/**
 * The founder, previewed — **as the rebuild's person** (2026-09-26).
 *
 * *"any scenes with arvatar should be the 3d model not the old 2d"* and *"Why
 * can't you port the exact same character creation models?"* This was a block
 * figure assembled from `div`s with an SVG face over it: a second construction
 * of a person beside the room's, which drifts from it the moment either
 * changes. It now draws `studioPerson()` whole, exactly as the rebuild's
 * character screen does (`three/render/portrait.ts`). The name tag stays: a
 * label on a stalk is how the room names a person.
 */
export function FounderAvatar({
  head,
  hairColour = 0,
  skin = 2,
  accessory = 'none',
  facialHair = 'none',
  body,
  bodyColour = 1,
  label = 'YOU',
  large = false,
}: {
  head: FounderHead
  hairColour?: FounderHairColour
  skin?: FounderSkin
  accessory?: FounderAccessory
  facialHair?: FounderFacialHair
  body: FounderBody
  bodyColour?: FounderBodyColour
  label?: string
  /** The character screen's size, rather than a card's. */
  large?: boolean
}) {
  const look = useMemo(
    () => founderLook({ name: label, head, hairColour, skin, accessory, facialHair, body, bodyColour }),
    [label, head, hairColour, skin, accessory, facialHair, body, bodyColour],
  )
  const src = useMemo(() => personPortrait(look, 'founder', 'figure'), [look])

  return (
    <div
      className={`founder-avatar${large ? ' founder-avatar--large' : ''}`}
      data-head={head}
      data-hair-shape={look.hair}
      data-hair-colour={hairColour}
      data-skin={skin}
      data-accessory={accessory}
      data-facial-hair={facialHair}
      data-body={body}
      data-body-shape={look.body}
      data-body-colour={bodyColour}
      aria-label="Your founder, as they will appear at their desk"
    >
      <div className="founder-avatar__signal">{label}</div>
      {src && <img className="founder-avatar__render" src={src} alt="" aria-hidden="true" />}
    </div>
  )
}
