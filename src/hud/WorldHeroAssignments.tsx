import { useEffect, useState, type CSSProperties } from 'react'
import { heroCoverageOf, type GameState } from '../game/store.ts'
import type { StageHandle } from '../render/stage.ts'
import { heroIdentity } from '../sim/identity.ts'
import { SETTLE_SECONDS, type HeroRuntime } from '../sim/heroRoster.ts'
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
  const armed = state.posting === null ? null : roster.find((hero) => hero.id === state.posting) ?? null
  const preview = armed && state.postingTarget
    ? {
        ...armed,
        placement: { ...state.postingTarget, placedAt: state.runSeconds },
      }
    : null
  const assignments = [
    ...placed.map((hero) => ({ hero, preview: false })),
    ...(preview ? [{ hero: preview, preview: true }] : []),
  ]
  if (assignments.length === 0) return null

  const width = window.innerWidth
  const height = window.innerHeight
  const side = Math.min(86, width * 0.18)
  const minX = Math.min(width / 2, side)
  const maxX = Math.max(width / 2, width - side)
  const minY = Math.min(48, height * 0.2)
  const maxY = Math.max(minY, height - 84)

  return (
    <div className="world-heroes" aria-label="Hero assignments in this scene">
      {assignments.map(({ hero, preview: isPreview }, order) => {
        const placement = hero.placement!
        const coverage = isPreview ? null : heroCoverageOf(hero, state)
        const projected = stage.heroAnchor(placement)
        const fallbackX = width / 2 + (order % 2 === 0 ? -48 : 48)
        const fallbackY = minY + Math.floor(order / 2) * 42
        const rawX = projected?.x ?? fallbackX
        const rawY = projected?.y ?? fallbackY
        const x = Math.max(minX, Math.min(maxX, rawX))
        const y = Math.max(minY, Math.min(maxY, rawY))
        const edge = projected === null || x !== rawX || y !== rawY
        const face = heroIdentity(hero.id)
        const placementAge = isPreview ? 0 : Math.max(0, state.runSeconds - placement.placedAt)
        const settleProgress = Math.min(1, placementAge / SETTLE_SECONDS)
        const justActivated = !isPreview && placementAge >= SETTLE_SECONDS && placementAge < SETTLE_SECONDS + 1.1
        const remaining = Math.max(1, Math.ceil(SETTLE_SECONDS - placementAge))

        return (
          <div
            className="world-hero-pin"
            data-edge={edge ? 'true' : 'false'}
            data-state={isPreview ? 'preview' : coverage?.settling ? 'walking' : 'active'}
            data-activated={justActivated ? 'true' : 'false'}
            key={`${hero.id}:${isPreview ? 'preview' : 'committed'}`}
            aria-label={`${hero.hero.name} ${isPreview ? 'preview at' : 'assigned to'} ${assignmentLabel(hero)}`}
            style={
              {
                '--branch': hero.colour,
                '--pin-x': `${Math.round(x)}px`,
                '--pin-y': `${Math.round(y)}px`,
              } as CSSProperties
            }
          >
            {coverage?.settling && (
              <svg className="world-hero-pin__countdown" viewBox="0 0 40 40" aria-label={`Active in ${remaining} seconds`}>
                <circle className="world-hero-pin__countdown-track" cx="20" cy="20" r="17" pathLength="100" />
                <circle
                  className="world-hero-pin__countdown-value"
                  cx="20"
                  cy="20"
                  r="17"
                  pathLength="100"
                  style={{ strokeDashoffset: 100 - settleProgress * 100 }}
                />
                <text x="20" y="23">{remaining}</text>
              </svg>
            )}
            <span className="world-hero-pin__target" aria-hidden="true" />
            <div className="world-hero-pin__card">
              {face && <HeroFace look={face.look} className="world-hero-pin__face" />}
              <span className="world-hero-pin__copy">
                <strong>{hero.hero.name.toUpperCase()}</strong>
                <small>{isPreview ? 'PREVIEW' : 'ASSIGNED'}</small>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
