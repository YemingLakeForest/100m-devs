import { useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { Panel } from '../ui/Panel.tsx'
import { UPGRADES_COPY } from './hudModel.ts'

/**
 * The upgrades entry point — GDD §10.1's bottom-nav `UPGRADES` tab, and the
 * door §11's Communication Tech tree will eventually be behind.
 *
 * The tree does not exist. This is deliberately *not* a hidden tab that appears
 * when the feature lands: the frame is being divided in this pass, and a
 * control introduced later would have to be wedged into a layout that had
 * already agreed how to spend its edges. The door is built now, at the size and
 * in the place the real one will occupy, and it opens onto an honest empty
 * room.
 *
 * The drawer slides from the right edge because that is the edge its button
 * lives on — §10.5 rule 1, an element enters from where it belongs and exits
 * back toward it. It is a drawer rather than a modal for §7.1: the swarm stays
 * visible and pokeable everywhere the panel is not.
 */
export function Upgrades() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Panel open={open} from="right" className="hud__upgrades">
        <div className="hud__upgrades-body">
          <h2 className="hud__upgrades-title">UPGRADES</h2>
          {/* `pre` rather than paragraphs: the copy is authored as terminal
              output at a fixed column width, and re-wrapping it would put the
              pixel face on a different grid every viewport. */}
          <pre className="hud__upgrades-copy">{UPGRADES_COPY.join('\n')}</pre>
          <Button onClick={() => setOpen(false)}>BACK</Button>
        </div>
      </Panel>

      <div className="hud__nav">
        <Button onClick={() => setOpen((was) => !was)}>UPGRADES</Button>
      </div>
    </>
  )
}
