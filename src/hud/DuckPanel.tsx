/**
 * The CTO's window — GDD §11.7 [CANON - added 2026-10-21].
 *
 * §11's note asked for the company tree to be *"a door of its own rather than a
 * sixth tab on anybody's card"*, so this is the founder's screen
 * (`Founder.tsx`) with the duck in it: the same pass lying across the top and
 * the same board under it, opened from the CTO app on the taskbar or by tapping
 * him in his bath. The one thing on his pass nobody else has is the wardrobe,
 * because he is the one member of staff whose upgrades you can see him wearing.
 *
 * The portrait is painted by the tree's own voxel painter (`isoBoard.paintVoxels`)
 * from `voxelIcons.duckBoxes`, so the duck on the glass is drawn in the same
 * hand as the icons on his board, and changes the moment his outfit does.
 */

import { useEffect, useRef } from 'react'
import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'
import { duckOf, duckOutfit, duckWardrobe, isDuckPromoted, wearDuckItem, type GameState } from '../game/store.ts'
import { DUCK_ITEMS, DUCK_NAME, DUCK_SLOTS, DUCK_TITLE, SLOT_NAME, type DuckOutfit } from '../sim/duck.ts'
import { treeNode } from '../sim/upgradeTrees.ts'
import { duckBoxes } from '../art/voxelIcons.ts'
import { Raster, paintVoxels } from './isoBoard.ts'
import { formatMoney } from './hudModel.ts'
import { TreePane } from './UpgradeTrees.tsx'
import { useGameState } from './useGameState.ts'

import '../styles/heroes.css'
import '../styles/duck.css'

/** The portrait's buffer, in board pixels; CSS scales it up by whole steps, nearest-neighbour. */
const PORTRAIT_PX = 64
/** Board pixels per voxel unit. Seven fills the frame with a duck in a party hat and keeps a pixel at the top. */
const PORTRAIT_UNIT = 7

/** The duck, in what he is wearing, as pixels. */
export function DuckPortrait({ outfit, className }: { outfit: DuckOutfit; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const key = DUCK_SLOTS.map((s) => outfit[s] ?? '-').join('|')
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const image = ctx.createImageData(PORTRAIT_PX, PORTRAIT_PX)
    const r = new Raster(PORTRAIT_PX, PORTRAIT_PX, new Uint32Array(image.data.buffer))
    paintVoxels(r, PORTRAIT_PX / 2, 52, duckBoxes(outfit), PORTRAIT_UNIT, null)
    ctx.putImageData(image, 0, 0)
    // `key` is the outfit, said as a string: the object is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return (
    <canvas
      ref={canvas}
      width={PORTRAIT_PX}
      height={PORTRAIT_PX}
      className={['duckcard__portrait', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={`${DUCK_NAME}, wearing ${DUCK_SLOTS.map((s) => outfit[s]).filter(Boolean).join(', ') || 'nothing'}`}
    />
  )
}

/** Where an item comes from, said as the wardrobe says it to somebody who does not own it yet. */
function sourceOf(item: (typeof DUCK_ITEMS)[number]): string {
  if ('node' in item.from) return `BUY ${treeNode('duck', item.from.node)?.name.toUpperCase() ?? 'IT'}`
  switch (item.from.moment) {
    case 'promoted': return 'MAKE HIM CTO'
    case 'shipped': return 'SHIP 25 GAMES'
    case 'proxima': return 'SEND JAMES TO PROXIMA B'
  }
}

/**
 * The wardrobe: a row per slot, a chip per item. An owned item toggles on and
 * off; one not yet owned is a `???` that says where it comes from, so the
 * wardrobe is also a list of things still to do.
 */
function Wardrobe() {
  const owned = duckWardrobe()
  const worn = duckOutfit()
  return (
    <div className="duckcard__wardrobe" aria-label="Wardrobe">
      {DUCK_SLOTS.map((slot) => (
        <div key={slot} className="duckcard__slot">
          <span className="duckcard__slot-name">{SLOT_NAME[slot].toUpperCase()}</span>
          <span className="duckcard__items">
            {DUCK_ITEMS.filter((i) => i.slot === slot).map((item) => {
              const have = owned.has(item.id)
              const on = worn[slot] === item.id
              return (
                <Button
                  key={item.id}
                  className={['duckcard__item', on && 'is-chosen'].filter(Boolean).join(' ')}
                  disabled={!have}
                  aria-pressed={have ? on : undefined}
                  title={have ? `${item.name}. ${item.line}` : `Not yet: ${sourceOf(item).toLowerCase()}.`}
                  aria-label={have ? `${on ? 'Take off' : 'Wear'} ${item.name}` : `${item.name}, not yet earned: ${sourceOf(item).toLowerCase()}`}
                  onClick={() => wearDuckItem(item.id)}
                >
                  {have ? item.name.toUpperCase() : '???'}
                </Button>
              )
            })}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * The wardrobe on a short frame (a phone on its side): one button per slot that
 * names what he has on and steps to the next item he owns, then to nothing. The
 * full wardrobe is four rows of chips and would take the board's height; CSS
 * shows one or the other (`duck.css`), so both are always in the document.
 */
function CompactWardrobe() {
  const owned = duckWardrobe()
  const worn = duckOutfit()
  return (
    <div className="duckcard__compact" aria-label="Wardrobe, one button per slot">
      {DUCK_SLOTS.map((slot) => {
        const mine = DUCK_ITEMS.filter((i) => i.slot === slot && owned.has(i.id))
        const at = mine.findIndex((i) => i.id === worn[slot])
        // The next item he owns, or off again after the last.
        const next = at + 1 < mine.length ? mine[at + 1] : null
        const current = at >= 0 ? mine[at] : null
        return (
          <Button
            key={slot}
            className="duckcard__item duckcard__cycle"
            disabled={mine.length === 0}
            aria-label={`${SLOT_NAME[slot]}: ${current?.name ?? 'nothing'}. ${next ? `Next: ${next.name}` : 'Next: nothing'}`}
            onClick={() => {
              if (next) wearDuckItem(next.id)
              else if (current) wearDuckItem(current.id)
            }}
          >
            {/* One string: the button's label puts every child on its own row. */}
            {`${SLOT_NAME[slot].toUpperCase()} · ${current ? current.name.toUpperCase() : mine.length ? '—' : '???'}`}
          </Button>
        )
      })}
    </div>
  )
}

export function DuckPanel({
  open,
  onClose,
  state,
  intro = null,
}: {
  open: boolean
  onClose: () => void
  state: GameState
  /** A node to open the tree on, selected — the promotion opens it on his bath. */
  intro?: string | null
}) {
  useGameState()
  const fx = duckOf(state)
  const promoted = isDuckPromoted()
  const percent = (v: number) => `${Math.round(v * 100)}%`
  return (
    <OsWindow
      open={open}
      modal
      from="centre"
      className="herocard duckcard"
      bodyClassName="herocard__split"
      title={`PERSONNEL // ${DUCK_NAME.toUpperCase()}`}
      meta={<span className="trees__cash">{formatMoney(state.cash)}</span>}
      onClose={onClose}
    >
      <div className="herocard__side" style={{ ['--branch' as string]: 'var(--warn-2)' }}>
        <div className="herocard__pass duckcard__pass">
          <span className="herocard__punch" aria-hidden="true" />
          <DuckPortrait outfit={duckOutfit()} className="herocard__portrait" />
          <header className="herocard__band">
            <h2 className="herocard__name">{DUCK_NAME}</h2>
            <p className="herocard__tags">
              <span className="herocard__branch">CTO</span>
              <span className="herocard__employee">
                EMPLOYEE #−1
                <span className="herocard__gem" aria-hidden="true" />
              </span>
            </p>
            <p className="herocard__role">{DUCK_TITLE.toUpperCase()} · REPORTS TO NOBODY</p>
          </header>
          <dl className="herocard__facts">
            <div><dt>BUGS WRITTEN</dt><dd>{promoted && fx.defectScale < 1 ? `−${percent(1 - fx.defectScale)}` : '—'}</dd></div>
            <div><dt>CAUGHT BEFORE THE RING</dt><dd>{promoted && fx.catches > 0 ? percent(fx.catches) : '—'}</dd></div>
            <div><dt>PAYROLL</dt><dd>ONE BATH</dd></div>
          </dl>
          <Wardrobe />
          <CompactWardrobe />
        </div>
      </div>
      <section className="herocard__tree" aria-label="The CTO's upgrades">
        <TreePane open state={state} hero="duck" intro={intro} />
      </section>
    </OsWindow>
  )
}
