import { useEffect, useRef, useState } from 'react'
import type { StageHandle, NavState } from '../render/stage.ts'
import { BUILDING, DESK, DEVS_PER_FLOOR, FLOOR, SQUAD, type Level } from '../render/frames.ts'

/**
 * The lift panel and the breadcrumb — GDD §10's answer to "which floor am I on,
 * and how do I get to another one".
 *
 * The world already lets you pick a floor: at Building the first tap names a
 * storey and the second one enters it. That is the *good* interaction and this
 * does not replace it. What it fixes is that a tap target with no label is a
 * secret — the floors of a tower look like decoration until something tells you
 * they are doors. So the panel says the same thing the tower says, in words,
 * with the occupancy that makes one floor different from another.
 *
 * It is sampled rather than subscribed. The camera is not in the store and does
 * not notify; a subscription for a thing that changes every frame and is read
 * ten times a second is machinery with nothing to buy. Same argument as
 * `PerfOverlay`, and the same 4-10 Hz.
 */
const SAMPLE_MS = 100

/** Ground floor is FLOOR 01 — nobody calls the one they are standing on zero. */
function floorName(storey: number): string {
  return String(storey + 1).padStart(2, '0')
}

export function Lift({ stage }: { stage: StageHandle | null }) {
  const [nav, setNav] = useState<NavState | null>(null)
  const here = useRef<HTMLLIElement | null>(null)
  const storey = nav?.storey ?? 0
  const at = nav?.at ?? null

  useEffect(() => {
    if (!stage) return
    const read = () => setNav(stage.nav())
    read()
    const id = setInterval(read, SAMPLE_MS)
    return () => clearInterval(id)
  }, [stage])

  /*
   * Keep the floor you are on in the list.
   *
   * Ten storeys is 150 px of rows and the rail does not always have 150 px —
   * at the reference 448 it has about 130, so the list scrolls. Which is fine
   * until the row that scrolls out is the one marked *you are here*: a ten
   * storey studio standing on floor 01 saw a panel that started at 10 and
   * stopped at 02, and the only floor it could not show was the one it was
   * meant to be telling you about.
   *
   * `block: 'nearest'` so a row already on screen does not make the list jump,
   * and no smooth scrolling — this fires on arrival at a floor the player just
   * chose, and animating the menu after the camera has already left reads as
   * lag.
   */
  useEffect(() => {
    here.current?.scrollIntoView({ block: 'nearest' })
  }, [storey, at])

  if (!stage || !nav) return null
  /*
   * **One floor is not a building.** Nothing here appears until the studio has
   * a second storey, and that is a design rule rather than a way of saving
   * pixels: a lift with one button is furniture, and "BUILDING 1 / FLOOR 01 /
   * SQUAD 1 / DESK 1" over a room of forty people names four things that are
   * all the same thing. §21's whole script runs under a thousand developers, so
   * the acts anybody has played are exactly the ones this stays out of — which
   * is also what keeps the §23.4 rail containment gate honest at 640x360, where
   * the fullest HUD in the game has no spare pixels to lend.
   */
  if (nav.storeys <= 1) return null

  /*
   * **The doors and the way back out are never both needed, so only one is
   * shown.**
   *
   * The rail is 136 px tall between the resources and the action stack, and ten
   * storeys of list plus four rungs of address is 190. Something had to give
   * and the first attempt let the list scroll, which quietly hid floor 10 —
   * a picker that cannot show you one of the things you are picking from.
   *
   * They divide cleanly by level. Standing *outside* the building you are
   * choosing a floor, and the rungs under BUILDING name the floor you were on
   * last, which is history rather than address. Standing *inside* one you need
   * the way back out, and the list would be a menu covering the thing it is a
   * menu for. So Building gets the doors and one line saying where they are,
   * and everything below gets the ladder.
   */
  const outside = nav.at === BUILDING
  const crumbs: { level: Level; text: string }[] = outside
    ? [{ level: BUILDING, text: 'BUILDING 1' }]
    : [
        { level: BUILDING, text: 'BUILDING 1' },
        { level: FLOOR, text: `FLOOR ${floorName(nav.storey)}` },
        { level: SQUAD, text: `SQUAD ${nav.squad + 1}` },
        { level: DESK, text: `DESK ${(nav.seat % DEVS_PER_FLOOR) + 1}` },
      ]

  return (
    <div className="hud__lift">
      {/*
        The address as a ladder rather than a line of slashes. Four rungs down
        the rail, widest scope at the top, is the same shape as the thing it
        describes — and unlike a breadcrumb it fits a 146 px rail without
        wrapping into four ragged lines that happen to say the same words.
      */}
      <ol className="hud__crumbs">
        {crumbs.map((crumb) => (
          <li key={crumb.level}>
            <button
              type="button"
              className={`hud__crumb${nav.at === crumb.level ? ' is-here' : ''}`}
              onClick={() => stage.goToLevel(crumb.level)}
            >
              {crumb.text}
            </button>
          </li>
        ))}
      </ol>

      {outside && (
        <ol className="hud__floors">
          {/* Top floor first: a lift panel reads downward. */}
          {nav.occupancy
            .map((devs, storey) => ({ devs, storey }))
            .reverse()
            .map(({ devs, storey }) => {
              const onThis = storey === nav.storey
              const named = storey === nav.selected
              return (
                <li key={storey} ref={onThis ? here : null}>
                  <button
                    type="button"
                    className={`hud__floor${onThis ? ' is-here' : ''}${named ? ' is-named' : ''}`}
                    onClick={() => stage.enterFloor(storey)}
                  >
                    <span className="hud__floor-no">{floorName(storey)}</span>
                    <span className="hud__floor-bar">
                      <span
                        className="hud__floor-fill"
                        style={{ width: `${(devs / DEVS_PER_FLOOR) * 100}%` }}
                      />
                    </span>
                    <span className="hud__floor-devs">{devs}</span>
                  </button>
                </li>
              )
            })}
        </ol>
      )}
    </div>
  )
}
