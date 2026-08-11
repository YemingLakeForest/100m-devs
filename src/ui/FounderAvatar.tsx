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
import { AVATAR_FACE, frontAvatarParts } from '../render/avatarParts.ts'

import '../styles/founderAvatar.css'

/**
 * Large UI portrait of the same head/body choices used by the Pixi developer.
 * It is deliberately assembled from square pixel blocks: no rounded portrait,
 * no separate mascot language, just the room character brought close enough
 * to choose parts and read a face.
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
}: {
  head: FounderHead
  hairColour?: FounderHairColour
  skin?: FounderSkin
  accessory?: FounderAccessory
  facialHair?: FounderFacialHair
  body: FounderBody
  bodyColour?: FounderBodyColour
  label?: string
}) {
  // The preview carries the renderer's resolved part indices, not its own
  // interpretation of the friendly option names. These are the same values
  // buildDeveloper() receives for the in-room founder.
  const look = founderLook({
    name: label,
    head,
    hairColour,
    skin,
    accessory,
    facialHair,
    body,
    bodyColour,
  })
  const faceParts = frontAvatarParts(look)

  return (
    <div
      className="founder-avatar"
      data-head={head}
      data-hair-shape={look.hair}
      data-hair-colour={hairColour}
      data-skin={skin}
      data-accessory={accessory}
      data-facial-hair={facialHair}
      data-body={body}
      data-body-shape={look.body}
      data-body-colour={bodyColour}
      aria-label="Your block avatar"
    >
      <div className="founder-avatar__signal">{label}</div>
      <div className="founder-avatar__person" aria-hidden="true">
        <div className="founder-avatar__head">
          <div className="founder-avatar__hair" />
          <svg
            className="founder-avatar__face-parts"
            viewBox={`${AVATAR_FACE.x} ${AVATAR_FACE.y} ${AVATAR_FACE.w} ${AVATAR_FACE.h}`}
            preserveAspectRatio="none"
            shapeRendering="crispEdges"
          >
            {faceParts.map((part, index) => (
              <rect
                key={`${part.colour}-${index}`}
                className={`founder-avatar__part founder-avatar__part--${part.colour}`}
                x={part.x}
                y={part.y}
                width={part.w}
                height={part.h}
              />
            ))}
          </svg>
        </div>
        <div className="founder-avatar__arm founder-avatar__arm--left" />
        <div className="founder-avatar__body">
          <div className="founder-avatar__collar" />
          <div className="founder-avatar__zip" />
        </div>
        <div className="founder-avatar__arm founder-avatar__arm--right" />
        <div className="founder-avatar__leg founder-avatar__leg--left" />
        <div className="founder-avatar__leg founder-avatar__leg--right" />
      </div>
    </div>
  )
}
