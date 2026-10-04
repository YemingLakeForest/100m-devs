import type { QueueCell } from './queueModel.ts'

export type NodeState = 'pending' | 'run' | 'wait' | 'pass' | 'ready'

/**
 * The three jobs of a run — Build, Test, and the hand-off that waits for SHIP! —
 * as the states they are in for a build at `cell.stage`.
 *
 * *A build that is behind another one in its stage is `wait`, not `run`*: only
 * the head of a lane progresses (`sim/pipeline.ts`), and a node that spun for
 * a build that was not moving would be lying about the jam.
 */
export function jobStates(cell: Pick<QueueCell, 'stage' | 'waiting'>): [NodeState, NodeState, NodeState] {
  const live: NodeState = cell.waiting ? 'wait' : 'run'
  switch (cell.stage) {
    case 'build':
      return [live, 'pending', 'pending']
    case 'test':
      return ['pass', live, 'pending']
    default:
      return ['pass', 'pass', 'ready']
  }
}

export const JOB_LABELS = ['BUILD', 'TEST', 'SHIP'] as const
