import { useEffect, useState, type CSSProperties } from 'react'
import { heroCoverageOf, type GameState } from '../game/store.ts'
import type { StageHandle } from '../render/stage.ts'
import { SETTLE_SECONDS, type HeroRuntime } from '../sim/heroRoster.ts'
import { assignmentLabel } from './worldHeroAssignmentModel.ts'
import { coverageLabel, placementBenefit, studioCoverageShare } from './heroPlacementModel.ts'

/** Camera and scene transforms are not store state, so sample them like Lift. */
const SAMPLE_MS = 100

/**
 * §13.11.1 — visible ownership, directly on the scene.
 *
 * The floor tint says how far an effect reaches. This answers who owns the
 * anchor, and **it is a desk plate rather than a card** [rewritten 2026-08-29].
 *
 * ## What was wrong with the card
 *
 * Reported alongside the placement banner: *"as well as the placed tag, it's a
 * bit clunky and breaking immersion as well."* It was a 78x34 px panel with a
 * 28 px portrait in it, the hero's name, and the word `ASSIGNED` — one per
 * placed hero, floating over the floor and, with two heroes placed near each
 * other, overlapping itself.
 *
 * Both halves of that report are one diagnosis: **it was a piece of interface
 * standing in the world.** §7.1 gives the HUD its own layer precisely so the
 * simulation can be looked at, and this was a HUD component that had walked out
 * onto the set. The portrait is the tell — the person it depicts is drawn, at
 * that same moment, eight pixels below it, so the thumbnail is a picture of
 * something already on screen. And `ASSIGNED` is machine vocabulary about a
 * database row; nothing in an office is labelled `ASSIGNED`.
 *
 * ## What it is instead
 *
 * §21.7.4 already says what a name looks like in this world: *"the desk plate
 * in the world at Desk zoom"*, which is where `GLOBAL HEAD OF HIS DESK` renders.
 * So this is that object — a thin plate, the name, the role under it, in the
 * branch colour, on a leader line down to the anchor. It is roughly a third of
 * the mass, it reads as something the studio printed rather than something the
 * interface is telling you, and two of them side by side look like two desks.
 *
 * The one thing the plate gains is the **preview** reading. While a placement
 * is being aimed, the candidate plate carries the coverage and the effect —
 * because that is the moment the player is looking at a specific rung asking a
 * specific question, and the answer used to be four lines away at the bottom of
 * the screen. See `PostingBanner.tsx`, which gave them up to get here.
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
        const placementAge = isPreview ? 0 : Math.max(0, state.runSeconds - placement.placedAt)
        const settleProgress = Math.min(1, placementAge / SETTLE_SECONDS)
        const justActivated = !isPreview && placementAge >= SETTLE_SECONDS && placementAge < SETTLE_SECONDS + 1.1
        const remaining = Math.max(1, Math.ceil(SETTLE_SECONDS - placementAge))
        /*
         * The plate's second line. Placed, it is the role §22.9.2 prints in the
         * card's footer — a job title on a desk, which is the whole conceit.
         * Previewing, it is the answer to the question the finger is asking.
         */
        const covered = Math.min(hero.reachDevs, coverage?.covered ?? hero.reachDevs)
        const benefit = placementBenefit(hero, studioCoverageShare(covered, state.devs))
        const under = isPreview
          ? `${coverageLabel(covered, state.devs)} · ${benefit.value} ${benefit.label}`
          : hero.hero.role

        return (
          <div
            className="world-hero-pin"
            data-edge={edge ? 'true' : 'false'}
            data-state={isPreview ? 'preview' : coverage?.settling ? 'connecting' : 'active'}
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
            <div className="world-hero-pin__plate">
              <strong>{hero.hero.name.toUpperCase()}</strong>
              <small>{under}</small>
            </div>
          </div>
        )
      })}
    </div>
  )
}
