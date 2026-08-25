import { useEffect, useState, type CSSProperties } from 'react'
import { heroCoverageOf, type GameState } from '../game/store.ts'
import type { StageHandle } from '../render/stage.ts'
import { heroIdentity } from '../sim/identity.ts'
import type { HeroRuntime } from '../sim/heroRoster.ts'
import { HeroFace } from './HeroFace.tsx'
import { assignmentLabel } from './worldHeroAssignmentModel.ts'

/** Camera and scene transforms are not store state, so sample them like Lift. */
const SAMPLE_MS = 100

/**
 * §13.11.1 — visible ownership, directly on the scene.
 *
 * The floor tint says how far an effect reaches. This deliberately tiny pass
 * only answers who owns the anchor: the hero's recognisable head, name, and the
 * word ASSIGNED. Coverage and effect numbers stay in the card and placement
 * receipt, where they can be read without covering the world.
 */
export function WorldHeroAssignments({
  stage,
  state,
  roster,
}: {
  stage: StageHandle | null
  state: GameState
  roster: readonly HeroRuntime[]
}) {
  const [, setSample] = useState(0)

  useEffect(() => {
    if (!stage) return
    const id = window.setInterval(() => setSample((n) => (n + 1) % 10_000), SAMPLE_MS)
    return () => window.clearInterval(id)
  }, [stage])

  if (!stage) return null
  const placed = roster.filter((hero) => hero.placement !== null)
  if (placed.length === 0) return null

  const width = window.innerWidth
  const height = window.innerHeight
  const side = Math.min(86, width * 0.18)
  const minX = Math.min(width / 2, side)
  const maxX = Math.max(width / 2, width - side)
  const minY = Math.min(48, height * 0.2)
  const maxY = Math.max(minY, height - 84)

  return (
    <div className="world-heroes" aria-label="Hero assignments in this scene">
      {placed.map((hero, order) => {
        const placement = hero.placement!
        const coverage = heroCoverageOf(hero, state)
        const projected = stage.heroAnchor(placement)
        const fallbackX = width / 2 + (order % 2 === 0 ? -48 : 48)
        const fallbackY = minY + Math.floor(order / 2) * 42
        const rawX = projected?.x ?? fallbackX
        const rawY = projected?.y ?? fallbackY
        const x = Math.max(minX, Math.min(maxX, rawX))
        const y = Math.max(minY, Math.min(maxY, rawY))
        const edge = projected === null || x !== rawX || y !== rawY
        const face = heroIdentity(hero.id)

        return (
          <div
            className="world-hero-pin"
            data-edge={edge ? 'true' : 'false'}
            data-state={coverage.settling ? 'walking' : 'active'}
            key={hero.id}
            aria-label={`${hero.hero.name} assigned to ${assignmentLabel(hero)}`}
            style={
              {
                '--branch': hero.colour,
                '--pin-x': `${Math.round(x)}px`,
                '--pin-y': `${Math.round(y)}px`,
              } as CSSProperties
            }
          >
            <span className="world-hero-pin__target" aria-hidden="true" />
            <div className="world-hero-pin__card">
              {face && <HeroFace look={face.look} className="world-hero-pin__face" />}
              <span className="world-hero-pin__copy">
                <strong>{hero.hero.name.toUpperCase()}</strong>
                <small>ASSIGNED</small>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
