import type { FounderBody, FounderHead } from '../game/founderProfile.ts'

import '../styles/founderAvatar.css'

/**
 * Large UI portrait of the same head/body choices used by the Pixi developer.
 * It is deliberately assembled from square pixel blocks: no rounded portrait,
 * no separate mascot language, just the room character brought close enough
 * to choose parts and read a face.
 */
export function FounderAvatar({
  head,
  body,
  label = 'YOU',
}: {
  head: FounderHead
  body: FounderBody
  label?: string
}) {
  return (
    <div
      className="founder-avatar"
      data-head={head}
      data-body={body}
      aria-label="Your block avatar"
    >
      <div className="founder-avatar__signal">{label}</div>
      <div className="founder-avatar__person" aria-hidden="true">
        <div className="founder-avatar__head">
          <div className="founder-avatar__hair" />
          <div className="founder-avatar__face">
            <i />
            <i />
          </div>
          <div className="founder-avatar__phones" />
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
