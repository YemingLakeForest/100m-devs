/**
 * An event, on screen — GDD §18.0, §18.0a.
 *
 * Two surfaces for one thing, and the split is the design rather than a
 * convenience:
 *
 * | | | |
 * |---|---|---|
 * | **The card** | A modal, once, when it fires | *"This is happening and here is what it costs."* It has no dismiss — the two buttons on it are the only ways off, and both of them are decisions |
 * | **The banner** | A strip in §10.7's band, until it ends | *"This is still happening."* Both exits stay on it, so nothing the player chose is ever the only thing they can do |
 *
 * **The card cannot be dismissed and the banner cannot be hidden.** That is
 * what §18.0a means by mandatory, and it is the whole reason the event exists:
 * §11's board is the most consequential screen in the game and nothing in the
 * build had ever asked a player to open it. What the player *can* do is decide
 * how to deal with it, which is a different thing from being able to ignore it.
 *
 * The banner lives in `.hud__script` — the band the game already talks to the
 * player in — for two reasons that are both about pixels. §10.1a says both
 * rails are full and trap 26 says a control does not belong in a column of
 * readings; and an event is temporary, so it must not be furniture. It leaves
 * with the script while a scene is up, on the same `data-phase` contract, and
 * comes back the same way.
 */

import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import type { LiveEvent, StudioEvent } from '../sim/events.ts'

export interface EventView {
  live: LiveEvent
  def: StudioEvent
}

/**
 * The hand-clear, as a label.
 *
 * The count is in the button rather than beside it, because it is what the
 * button costs — the same argument §11.4.3 makes for putting the price on the
 * only button in the guide layer.
 */
function replyLabel(remaining: number): string {
  // §26.1.8 trap 31 — one template string. `{n}{' '}{word}` gives `Button` two
  // children, and JSX whitespace between two expressions is not in the computed
  // accessible name, so the label renders correctly and is unfindable by role.
  return `REPLY TO ALL · ${remaining}`
}

/**
 * The modal, shown once — before the player has chosen how to deal with it.
 *
 * `modal` dims and blurs the simulation behind it (§10.6), which is exactly
 * right here: the studio *has* stopped, and a scrim over a floor that is still
 * visibly working is the interface agreeing with the fiction.
 */
export function EventCard({
  event,
  onRoute,
  onReply,
}: {
  event: EventView | null
  /** Take the intended exit — routes the card away and opens the board. */
  onRoute: () => void
  /** Take the hand-clear — routes the card away; the banner counts down. */
  onReply: () => void
}) {
  const open = event !== null && !event.live.routed

  return (
    <Panel open={open} modal from="centre" className="event-card">
      {event && (
        <div className="event-card__body">
          <span className="event-card__kicker">STUDIO_OS // INCIDENT</span>
          <h2 className="event-card__name">{event.def.name}</h2>
          <pre className="event-card__headline">{event.def.headline}</pre>
          <p className="event-card__text">{event.def.body}</p>
          <div className="event-card__actions">
            <Button onClick={onRoute}>{event.def.routeLabel}</Button>
            {/*
              §18.0 — the exit that is always available and never priced in
              money. It is *worse* than the other one and it is deliberately not
              marked as worse: the player finds that out by comparing twenty
              taps against one purchase, which is the only way §21.7.6's rule
              can teach anything.
            */}
            <Button onClick={onReply}>{replyLabel(event.live.remaining)}</Button>
          </div>
        </div>
      )}
    </Panel>
  )
}

/**
 * The strip, shown for as long as it lasts.
 *
 * Rendered inside `.hud__script`, above §21's advisor copy, so a live event
 * reads as the loudest thing the game is currently saying — which it is.
 */
export function EventBanner({
  event,
  onRoute,
  onReply,
}: {
  event: EventView | null
  onRoute: () => void
  onReply: () => void
}) {
  if (!event || !event.live.routed) return null

  return (
    <div className="event-banner">
      <span className="event-banner__head">
        <b className="event-banner__name">{event.def.name}</b>
        {/*
          The cost, stated as the number the player is watching. §4.3's
          speedometer is already showing it; this says *why*, which is the one
          thing a speedometer cannot.
        */}
        <span className="event-banner__cost">
          OUTPUT {Math.round(event.def.ceiling * 100)}%
        </span>
      </span>
      <div className="event-banner__actions">
        <Button onClick={onRoute}>{event.def.routeLabel}</Button>
        <Button onClick={onReply}>{replyLabel(event.live.remaining)}</Button>
      </div>
    </div>
  )
}
