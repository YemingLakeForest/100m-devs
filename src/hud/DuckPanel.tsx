/**
 * The CTO's window — GDD §11.7 [CANON - added 2026-10-21].
 *
 * §11's note asked for the company tree to be *"a door of its own rather than a
 * sixth tab on anybody's card"*, so this is the founder's screen
 * (`Founder.tsx`) with the duck in it: the same pass lying across the top and
 * the same board under it, opened from the CTO app on the taskbar or by tapping
 * him in his corner. The one thing on his pass nobody else has is the wardrobe,
 * because he is the one member of staff whose upgrades you can see him wearing.
 *
 * The portrait is painted by the tree's own voxel painter (`isoBoard.paintVoxels`)
 * from `voxelIcons.duckBoxes` — `art/duckVoxels.ts`'s eight-bit grid, the one the
 * room draws [amended 2026-10-22] — so the duck on the glass is the duck in the
 * corner, and changes the moment his outfit does.
 *
 * [2026-10-22] *"I want vanity items purchasable on him too."* The wardrobe is a
 * rail of tiles, one per item, each painted from the same grid: what he owns in
 * colour, what is for sale in colour with its price, what is earned and not yet
 * as a phosphor ghost. A tile picks; the line under the rail says what it is and
 * does the one thing it can — wear it, take it off, buy it, or say how it is had.
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { OsWindow } from '../ui/OsWindow.tsx'
import {
  buyDuckItem,
  duckItemPriceOf,
  duckItemRefusalOf,
  duckOf,
  duckOutfit,
  duckWardrobe,
  isDuckPromoted,
  wearDuckItem,
  type DuckItemRefusal,
  type GameState,
} from '../game/store.ts'
import { DUCK_ITEMS, DUCK_NAME, DUCK_SLOTS, DUCK_TITLE, SLOT_NAME, type DuckItem, type DuckOutfit } from '../sim/duck.ts'
import { treeNode } from '../sim/upgradeTrees.ts'
import { ERAS } from '../sim/eras.ts'
import { DUCK_TURN, duckBoxes, itemBoxes, type Box } from '../art/voxelIcons.ts'
import { Raster, pack, paintTurned, turnedBounds, type Px } from './isoBoard.ts'
import { formatMoney } from './hudModel.ts'
import { TreePane } from './UpgradeTrees.tsx'
import { useGameState } from './useGameState.ts'

import '../styles/heroes.css'
import '../styles/duck.css'

/** The portrait's buffer, in board pixels; CSS scales it up by whole steps, nearest-neighbour. */
const PORTRAIT_PX = 64
/** A wardrobe tile's buffer. */
const TILE_PX = 24

/**
 * Paint voxels into a square buffer as big as they fit, centred, in his turned
 * view (`DUCK_TURN`, the icon's angle): the portrait and the tiles are the app
 * icon's drawing at another size.
 */
function paintFitted(canvas: HTMLCanvasElement, px: number, boxes: readonly Box[], margin: number, ghost: readonly [Px, Px, Px] | null, maxUnit = 4): void {
  const ctx = canvas.getContext('2d')
  if (!ctx || boxes.length === 0) return
  const { x0, x1, y0, y1 } = turnedBounds(boxes, DUCK_TURN)
  const room = px - margin * 2
  const u = Math.min(maxUnit, room / Math.max(x1 - x0, 0.01), room / Math.max(y1 - y0, 0.01))
  const image = ctx.createImageData(px, px)
  const r = new Raster(px, px, new Uint32Array(image.data.buffer))
  paintTurned(r, px / 2 - ((x0 + x1) / 2) * u, px / 2 - ((y0 + y1) / 2) * u, boxes, u, DUCK_TURN, ghost)
  ctx.putImageData(image, 0, 0)
}

/** The duck, in what he is wearing, as pixels. */
export function DuckPortrait({ outfit, className }: { outfit: DuckOutfit; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const key = DUCK_SLOTS.map((s) => outfit[s] ?? '-').join('|')
  useEffect(() => {
    if (canvas.current) paintFitted(canvas.current, PORTRAIT_PX, duckBoxes(outfit), 3, null)
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

/** The locked-tile ghost the tree uses, read off the glass so it follows the phosphor. */
function ghostOf(el: HTMLElement): readonly [Px, Px, Px] {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: string) => {
    const hex = css.getPropertyValue(name).trim()
    return pack(/^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback)
  }
  return [v('--p1', '#1a6b78'), v('--p0', '#0a2a30'), v('--n1', '#241f2e')]
}

/** One item's tile picture: in colour when it is his or for sale, a ghost when it is earned and not yet. */
function ItemIcon({ id, ghost }: { id: string; ghost: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current) paintFitted(canvas.current, TILE_PX, itemBoxes(id), 1, ghost ? ghostOf(canvas.current) : null, 3)
  }, [id, ghost])
  return <canvas ref={canvas} width={TILE_PX} height={TILE_PX} className="duckcard__icon" aria-hidden="true" />
}

/** Where an earned item comes from, said to somebody who does not own it yet. */
function sourceOf(item: DuckItem): string {
  if ('node' in item.from) return `Buy ${treeNode('duck', item.from.node)?.name ?? 'it'} on his board`
  if ('moment' in item.from) {
    switch (item.from.moment) {
      case 'promoted': return 'Make him CTO'
      case 'shipped': return 'Ship 25 games'
      case 'proxima': return 'Send James to Proxima b'
    }
  }
  return 'For sale'
}

/** Why a bought item is not for sale yet, in the button's words. */
function refusalWords(why: DuckItemRefusal, item: DuckItem): string {
  switch (why) {
    case 'absent': return 'MAKE HIM CTO FIRST'
    case 'era': return 'shop' in item.from ? `OPENS IN ${ERAS[Math.min(item.from.shop, ERAS.length - 1)].label.toUpperCase()}` : ''
    default: return ''
  }
}

/**
 * The wardrobe: every item as a tile in slot order, and a line under the rail
 * for the one picked. It starts on what he wears on his head, or the first tile.
 */
function Wardrobe({ state }: { state: GameState }) {
  const owned = duckWardrobe()
  const worn = duckOutfit()
  const [picked, setPicked] = useState<string>(() => worn.head ?? DUCK_ITEMS[0].id)
  const items = DUCK_SLOTS.flatMap((slot) => DUCK_ITEMS.filter((i) => i.slot === slot))
  const item = items.find((i) => i.id === picked) ?? items[0]
  const have = owned.has(item.id)
  const on = worn[item.slot] === item.id
  const forSale = 'shop' in item.from
  const why = forSale && !have ? duckItemRefusalOf(item.id, state) : null
  const price = forSale ? duckItemPriceOf(item.id, state) : null

  let action: React.ReactNode
  if (have) {
    action = <Button className="duckcard__act" onClick={() => wearDuckItem(item.id)}>{on ? 'TAKE OFF' : 'WEAR'}</Button>
  } else if (forSale) {
    const words = refusalWords(why, item)
    action = (
      <Button className="duckcard__act" disabled={why !== null} onClick={() => buyDuckItem(item.id)}>
        {words || `BUY ${formatMoney(price ?? 0)}`}
      </Button>
    )
  } else {
    // Earned, not bought: the slot says so in a word, and the line under it says how (a phone hides the line, so
    // the tile's title carries it too).
    action = <span className="duckcard__how" title={sourceOf(item)}>EARNED</span>
  }

  return (
    <div className="duckcard__wardrobe">
      <div className="duckcard__rail" role="group" aria-label="Wardrobe">
        {items.map((i) => {
          const mine = owned.has(i.id)
          const sale = 'shop' in i.from && !mine
          const look = mine ? (worn[i.slot] === i.id ? 'is-worn' : 'is-owned') : sale ? (duckItemRefusalOf(i.id, state) === null ? 'is-buyable' : 'is-sale') : 'is-locked'
          return (
            <button
              key={i.id}
              type="button"
              className={['duckcard__tile', look, i.id === item.id && 'is-picked'].filter(Boolean).join(' ')}
              aria-pressed={i.id === item.id}
              aria-label={`${SLOT_NAME[i.slot]}: ${mine || sale ? i.name : 'not yet earned'}${mine && worn[i.slot] === i.id ? ', wearing' : ''}`}
              title={mine || sale ? i.name : `??? ${sourceOf(i)}`}
              onClick={() => setPicked(i.id)}
            >
              <ItemIcon id={i.id} ghost={!mine && !sale} />
            </button>
          )
        })}
      </div>
      <div className="duckcard__pick">
        <span className="duckcard__pick-name">
          <span className="duckcard__slot-name">{SLOT_NAME[item.slot].toUpperCase()}</span>{' '}
          {have || forSale ? item.name.toUpperCase() : '???'}
        </span>
        {action}
        <span className="duckcard__pick-line">{have || forSale ? item.line : `Not yet. ${sourceOf(item)}.`}</span>
      </div>
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
  /** A node to open the tree on, selected — the promotion opens it on his root. */
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
          <Wardrobe state={state} />
        </div>
      </div>
      <section className="herocard__tree" aria-label="The CTO's upgrades">
        <TreePane open state={state} hero="duck" intro={intro} />
      </section>
    </OsWindow>
  )
}
