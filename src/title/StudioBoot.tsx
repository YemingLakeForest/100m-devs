import { useMemo } from 'react'
import { CutScene } from './CutScene.tsx'
import { bootPages } from './studioBoot.ts'

export interface StudioBootProps {
  /** The founder just built — named by the boot's `founder:` page. */
  founderName: string
  /** The run's first project — named by the boot's `project:` page. */
  projectName: string
  /** Called when the boot has lifted and the game may take the screen. */
  onDone: () => void
}

/**
 * The black cut scene between the founder creator and the game — §10.9.3.
 *
 * The stage is already running behind this — §10.9.1's rule that the simulation
 * is never stopped means the boot is an overlay on a lit room, not a screen that
 * loads anything. The player reads it at their own speed: it is a scene, not a
 * wait.
 *
 * **The screen itself is {@link CutScene}**, and has been since §15.1a needed
 * the same one for the reboot between two realities. What is left here is the
 * thing that is actually about the boot — *which* words, on the first launch of
 * an install — and that is the correct size for this file. Two black screens
 * with typed pages would have been two black screens to keep in step.
 */
export function StudioBoot({ founderName, projectName, onDone }: StudioBootProps) {
  const pages = useMemo(() => bootPages(founderName, projectName), [founderName, projectName])
  return <CutScene pages={pages} onDone={onDone} />
}
