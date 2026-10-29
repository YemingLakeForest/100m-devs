/**
 * Which cash movements deserve a flash — the status bar's hot edge for money (docs/demos/ui-juice-2026-10-28).
 *
 * Revenue arrives in lumps on ship (§4.10c) and payroll drips continuously, so the cash readout changes every frame
 * of a healthy game. Flashing on change would be a strobe, and flashing never would waste the one moment the readout
 * has something to say. The line drawn here is a *lump*: a gain of more than two seconds of the studio's own flow.
 * Income and payroll are, by construction, a fraction of one second per frame, so only a payout clears it. Losses
 * never flash: a hire's cost already has the key that bought it, and a red strobe on the bar is the bankruptcy
 * clock's job (§4.10d), not this one's.
 */

import { useState } from 'react'

/** Seconds of flow a gain must exceed to be a lump rather than the drip. */
export const LUMP_SECONDS = 2

/** The smallest flow the rule scales by, so a studio with no flow at all does not flash on a one-dollar poke. */
const FLOW_FLOOR = 1

export function isLump(previous: number, next: number, flowPerSecond: number): boolean {
  const gain = next - previous
  return gain > Math.max(FLOW_FLOOR, Math.abs(flowPerSecond)) * LUMP_SECONDS
}

/**
 * A counter that goes up by one each time a lump lands. The caller keys the number on it, so the CSS animation
 * restarts for every payout — two releases a second apart flash twice rather than once.
 *
 * "Adjust state during render" (Panel.tsx's pattern) rather than an effect, so the flash is on the frame the cash
 * changed, not the frame after it.
 */
export function useLumpFlash(cash: number, flowPerSecond: number): number {
  const [seen, setSeen] = useState(cash)
  const [lumps, setLumps] = useState(0)
  if (seen !== cash) {
    setSeen(cash)
    if (isLump(seen, cash, flowPerSecond)) setLumps(lumps + 1)
  }
  return lumps
}
