import { beltView, type GameState } from '../game/store.ts'

/**
 * What the advisor says while the queue needs the player — or null when it
 * does not. Two moments only: the first build ever to reach the shelf (the
 * control has to be named once), and a full buffer (the studio has stopped,
 * and the one thing that starts it is a press).
 */
export function pipelineAdvice(state: GameState): string | null {
  const belt = beltView(state)
  if (belt.buffer >= belt.capacity && belt.ready > 0) return 'The queue is full and nobody can code. Press SHIP!'
  if (belt.ready > 0 && state.projectsShipped === 0) return 'Your build is in the queue. Press SHIP! to release it.'
  return null
}
