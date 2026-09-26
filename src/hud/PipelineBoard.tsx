/**
 * Serena's pipeline board — GDD §10.7 [ported 2026-09-26].
 *
 * The rebuild's pipeline nodes (`sim/pipeline.ts`): the belt gets longer
 * (capacity), the stages get faster (speed), Test catches defects (quality),
 * and SHIP! learns to press itself (flow — Auto-Ship is Serena's rank II,
 * *"we start of have to manual ship our selves, like the scritchy game, but
 * upgrade from Serena make it auto"*). The rules and the prices are the
 * rebuild's; the drawing is this build's tech board's, a column of UML class
 * cards in the STUDIO_OS window, because that is what an upgrade looks like
 * here. The rebuild's isometric trees land with the heroes (phase 4 of
 * `docs/PLAN-2026-09-26-return.md`), and this board moves into Serena's then.
 *
 * Opened from the belt, and only once Serena has arrived: until then SHIP! is
 * the player's own press, and a board of things they cannot buy is a menu of
 * reasons to feel poor.
 */

import { OsWindow } from '../ui/OsWindow.tsx'
import { Button } from '../ui/Button.tsx'
import { formatMoney } from './hudModel.ts'
import { purchaseHaptic } from '../audio/haptics.ts'
import {
  buyPipeline,
  pipelinePrice,
  pipelineRank,
  pipelineRefusalOf,
  type GameState,
} from '../game/store.ts'
import { PIPELINE_BY_ID, PIPELINE_TREE, type PipelineFamily, type PipelineNode } from '../sim/pipeline.ts'
import { ERAS } from '../sim/eras.ts'

import '../styles/diagram.css'
import '../styles/pipeline.css'

const FAMILIES: readonly { id: PipelineFamily; label: string }[] = [
  { id: 'capacity', label: 'CAPACITY' },
  { id: 'speed', label: 'SPEED' },
  { id: 'quality', label: 'QUALITY' },
  { id: 'flow', label: 'FLOW' },
]

/** Why a node is not for sale, in the board's own words — or null if it is. */
function refusalText(node: PipelineNode): (why: ReturnType<typeof pipelineRefusalOf>) => string | null {
  return (why) => {
    switch (why) {
      case null:
        return null
      case 'maxed':
        return 'OWNED'
      case 'era':
        return `OPENS AT ${ERAS[Math.min(node.era, ERAS.length - 1)].label.toUpperCase()}`
      case 'requires':
        return `NEEDS ${node.requires.map((id) => PIPELINE_BY_ID.get(id)?.name.toUpperCase() ?? id).join(' + ')}`
      case 'fork':
        return 'THE OTHER ROAD WAS TAKEN'
      case 'cash':
        return 'NOT ENOUGH CASH'
      default:
        return 'LOCKED'
    }
  }
}

export function PipelineBoard({ open, state, onClose }: { open: boolean; state: GameState; onClose: () => void }) {
  return (
    <OsWindow
      open={open}
      from="centre"
      modal
      title="PIPELINE"
      meta={<span className="tech__cash">{formatMoney(state.cash)}</span>}
      onClose={onClose}
      className="pipe-board-frame"
      bodyClassName="pipe-board"
    >
      <p className="pipe-board__lede">
        SERENA'S BOARD. EVERYTHING PAST CODE COUNTS AGAINST ONE BUFFER, AND A FULL BUFFER STOPS THE FLOOR.
      </p>
      <div className="pipe-board__cols">
        {FAMILIES.map((family) => (
          <section key={family.id} className="pipe-board__col" aria-label={family.label}>
            <h3 className="pipe-board__family">{family.label}</h3>
            {PIPELINE_TREE.filter((n) => n.family === family.id).map((node) => (
              <NodeCard key={node.id} node={node} state={state} />
            ))}
          </section>
        ))}
      </div>
    </OsWindow>
  )
}

function NodeCard({ node, state }: { node: PipelineNode; state: GameState }) {
  const rank = pipelineRank(node.id, state)
  const price = pipelinePrice(node.id, state)
  const refusal = refusalText(node)(pipelineRefusalOf(node.id, state))
  return (
    <div className="pipe-board__node uml" data-owned={rank > 0 ? 'true' : 'false'} data-open={refusal === null ? 'true' : 'false'}>
      <span className="uml__head">
        <span className="uml__stereo">«{node.rank ? `rank ${node.rank}` : node.family}»</span>
        <span className="uml__name">{node.name}</span>
      </span>
      <span className="uml__body">
        <span className="uml__attr">
          <span className="uml__vis">+</span>
          <span className="uml__text">{node.effect}</span>
        </span>
        {node.flavour && (
          <span className="uml__attr pipe-board__flavour">
            <span className="uml__vis">#</span>
            <span className="uml__text">{node.flavour}</span>
          </span>
        )}
        <span className="uml__attr">
          <span className="uml__vis">−</span>
          {/* One inline run: `.uml__attr` is a flex row, and loose text would
              make every fragment its own item and wrap them apart. */}
          <span className="uml__text">
            level : <b>{rank}/{node.maxLevel}</b>
            {price !== null && (
              <>
                {' '}· cost : <b>{formatMoney(price)}</b>
              </>
            )}
          </span>
        </span>
      </span>
      {refusal === 'OWNED' ? (
        <p className="pipe-board__state">OWNED</p>
      ) : (
        <Button
          className="pipe-board__buy"
          disabled={refusal !== null}
          onClick={() => {
            if (buyPipeline(node.id)) purchaseHaptic()
          }}
          aria-label={`${node.name}. ${refusal ?? `Buy for ${price === null ? '' : formatMoney(price)}`}`}
        >
          {refusal ?? (rank > 0 ? 'UPGRADE' : 'BUY')}
        </Button>
      )}
    </div>
  )
}
