/**
 * §13.8's interim placement gesture, said out loud — GDD §7.7.6b.
 *
 * §7.7.6b's finding was not about thresholds. It was that three verbs came off
 * one finger with nothing on screen saying which one was armed, so the player
 * found out what mode they were in by watching the wrong thing happen. Arming a
 * placement is a fourth verb on the same finger, and it inherits the same rule:
 *
 * > The mode is **said out loud, on the HUD, before the finger lands.**
 *
 * It is a banner rather than a fourth latch on §7.7.6b's switch, and that is
 * the distinction between the two kinds of mode this game has. POKE and GRAB
 * are *stances* — you stay in them, they are how you play. A posting is a
 * **sentence with one word left**: the player has already named who, and the
 * only thing outstanding is where. A stance that empties itself after one tap
 * would be a latch that will not stay down, which is a broken switch.
 *
 * So it appears with somebody armed and leaves with them placed, and while it
 * is up it is the only thing on the rail claiming the next tap.
 */

import { Button } from '../ui/Button.tsx'
import { cancelPosting } from '../game/store.ts'
import type { GameState } from '../game/store.ts'
import { heroIdentity } from '../sim/identity.ts'

import '../styles/heroes.css'

export function PostingBanner({ state }: { state: GameState }) {
  if (state.posting === null) return null
  const who = heroIdentity(state.posting)?.name ?? state.posting

  return (
    <div className="posting" role="status">
      <div className="posting__row">
        {/*
          Trap 31 — one template string. JSX whitespace between expressions is
          not part of the accessible name, so `TAP A UNIT TO POST {who}` gives a
          screen reader and a test `TAP A UNIT TO POST` and `Mo` as two separate
          strings, and a query for the sentence finds nothing.
        */}
        <span className="posting__line">{`TAP A UNIT TO POST ${who.toUpperCase()}`}</span>
        <Button onClick={cancelPosting}>CANCEL</Button>
      </div>
    </div>
  )
}
