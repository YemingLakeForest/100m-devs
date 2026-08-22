import { useEffect, useRef, useState } from 'react'
import type { StageHandle, NavState } from '../render/stage.ts'
import { formatCount } from '../sim/headcount.ts'
import {
  BLOCK,
  BLOCK_CAP,
  BUILDING,
  BUILDING_CAP,
  DESK,
  DEVS_PER_FLOOR,
  FLOOR,
  PARK,
  SQUAD,
  type Level,
} from '../render/frames.ts'

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

/** Buildings and blocks are numbered like floors, and for the same reason. */
const buildingName = floorName
const blockName = floorName

export function Lift({ stage }: { stage: StageHandle | null }) {
  const [nav, setNav] = useState<NavState | null>(null)
  const here = useRef<HTMLLIElement | null>(null)
  const storey = nav?.storey ?? 0
  const at = nav?.at ?? null
  const building = nav?.building ?? 0
  const block = nav?.block ?? 0

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
  }, [storey, building, block, at])

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
  if (nav.storeys <= 1 && nav.buildings <= 1 && nav.blocks <= 1) return null

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
  const onThePark = nav.at === PARK
  const onTheBlock = nav.at === BLOCK
  const outside = nav.at === BUILDING
  /*
   * **The doors you are outside, and the ladder you are inside.**
   *
   * Three pickers now and still only ever one on screen, on the rule that
   * decided the first: the list is the level you are *choosing from*, and the
   * ladder is where you are. Standing in the park you are choosing a block;
   * standing on a block you are choosing a building; standing in a building you
   * are choosing a floor; standing on a floor you want the way back out.
   *
   * **A rung that names one thing is not a rung**, which is the lift's own
   * argument applied to the address rather than to the picker. `PARK 1 /
   * BLOCK 1 / BUILDING 07` over a studio with one block spends two lines of a
   * 136 px rail saying "the studio" twice.
   */
  const ladder: { level: Level; text: string }[] = []
  if (nav.blocks > 1) ladder.push({ level: PARK, text: 'PARK 1' })
  if (nav.blocks > 1 || nav.buildings > 1) {
    ladder.push({ level: BLOCK, text: `BLOCK ${blockName(nav.block)}` })
  }
  ladder.push(
    { level: BUILDING, text: `BUILDING ${buildingName(nav.building)}` },
    { level: FLOOR, text: `FLOOR ${floorName(nav.storey)}` },
    { level: SQUAD, text: `SQUAD ${nav.squad + 1}` },
    { level: DESK, text: `DESK ${(nav.seat % DEVS_PER_FLOOR) + 1}` },
  )
  /*
   * Cut at the rung the camera is on, once it is outside the building: the
   * rungs below a picker name where you were last, which is history rather than
   * address. Inside the building the whole ladder shows, because getting out is
   * the thing you need and there is no picker competing for the rail.
   */
  const cut = ladder.findIndex((r) => r.level === nav.at)
  const crumbs = nav.at >= BUILDING && cut >= 0 ? ladder.slice(0, cut + 1) : ladder

  /*
   * **The door, said out loud.**
   *
   * Naming a thing in the world and entering it are two steps now — nothing on
   * the glass changes the level (§12) — and the second step was a *row in a
   * list*. On a phone the rail is beside your thumb and that is fine; in a
   * desktop window the tower you just tapped is eighteen hundred pixels from
   * the row that opens it and nothing says the row is a door. Reported as "I
   * see the 10 towers now, but can't choose which tower to zoom into".
   *
   * So the selection gets a control with its name on it. It is not a second
   * mechanism — it calls exactly what the row calls — it is the same door with
   * a sign on it, and §10.2a is explicit that a control a player has to be told
   * about is not ready to be on screen.
   */
  const door =
    onThePark && nav.selectedBlock >= 0 && nav.selectedBlock < nav.blocks
      ? { text: `ENTER BLOCK ${blockName(nav.selectedBlock)}`, go: () => stage.enterBlock(nav.selectedBlock) }
      : onTheBlock && nav.selectedBuilding >= 0 && nav.selectedBuilding < nav.buildings
        ? { text: `ENTER BUILDING ${buildingName(nav.selectedBuilding)}`, go: () => stage.enterBuilding(nav.selectedBuilding) }
        : outside && nav.selected >= 0 && nav.selected < nav.storeys
          ? { text: `ENTER FLOOR ${floorName(nav.selected)}`, go: () => stage.enterFloor(nav.selected) }
          : null

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

      {door && (
        <button type="button" className="hud__enter" onClick={door.go}>
          {door.text}
        </button>
      )}

      {onThePark && nav.blocks > 1 && (
        <ol className="hud__floors">
          {/* Nearest parcel first, which is the block nearest the camera — the
              list reads in the order the park does. */}
          {nav.parkOccupancy
            .map((devs, i) => ({ devs, i }))
            .reverse()
            .map(({ devs, i }) => {
              const onThis = i === nav.block
              const named = i === nav.selectedBlock
              return (
                <li key={i} ref={onThis ? here : null}>
                  <button
                    type="button"
                    className={`hud__floor${onThis ? ' is-here' : ''}${named ? ' is-named' : ''}`}
                    onClick={() => stage.enterBlock(i)}
                  >
                    <span className="hud__floor-no">{blockName(i)}</span>
                    <span className="hud__floor-bar">
                      <span
                        className="hud__floor-fill"
                        style={{ width: `${(devs / BLOCK_CAP) * 100}%` }}
                      />
                    </span>
                    <span className="hud__floor-devs">{formatCount(devs)}</span>
                  </button>
                </li>
              )
            })}
        </ol>
      )}

      {onTheBlock && nav.buildings > 1 && (
        <ol className="hud__floors">
          {/* Nearest plot first, which is the row the tower nearest the camera
              stands on — the list reads in the order the block does. */}
          {nav.blockOccupancy
            .map((devs, i) => ({ devs, i }))
            .reverse()
            .map(({ devs, i }) => {
              const onThis = i === nav.building
              const named = i === nav.selectedBuilding
              return (
                <li key={i} ref={onThis ? here : null}>
                  <button
                    type="button"
                    className={`hud__floor${onThis ? ' is-here' : ''}${named ? ' is-named' : ''}`}
                    onClick={() => stage.enterBuilding(i)}
                  >
                    <span className="hud__floor-no">{buildingName(i)}</span>
                    <span className="hud__floor-bar">
                      <span
                        className="hud__floor-fill"
                        style={{ width: `${(devs / BUILDING_CAP) * 100}%` }}
                      />
                    </span>
                    <span className="hud__floor-devs">{formatCount(devs)}</span>
                  </button>
                </li>
              )
            })}
        </ol>
      )}

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
