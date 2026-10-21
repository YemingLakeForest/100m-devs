/**
 * Studio OS's desktop furniture — GDD §10.1 [amended 2026-10-20].
 *
 * *"the general Studio OS UI can be improved"*, with Lonestar as the blueprint.
 * The frame had readouts in all four corners at five sizes and a pile of six
 * filled buttons in the bottom right, all equally loud. Lonestar does the
 * opposite: one thin bar of icon-and-number pairs along the top, the pilot's
 * face always on screen with their ability counters under it, and one big
 * action button. Studio OS already *says* it is an operating system in every
 * window's title bar, so the doors become what an OS has: a taskbar.
 *
 * - **StatusBar** — the readings, in one row across the top. The blocks are
 *   the same components the rails used (`Readouts.tsx`), so nothing about what
 *   a readout says or when it appears has moved; only where. Each sits in a
 *   `Tipped`, so the reasons behind a number are one hover away.
 * - **HeroRail** — every person who has arrived, as a face with a live counter
 *   from the same fold the simulation charges. A tap opens their card. It is
 *   the front door §7.8.12 always wanted (*the way you reach Mo is by looking
 *   at Mo*), now that the 3D studio does not seat everybody.
 * - **Taskbar** — the windows: PERSONNEL, PARADIGM, GALLERY, YOU, MENU. The one
 *   open is the filled one. Badges say when a window wants you.
 */

import type { ReactNode } from 'react'
import type { GameState } from '../game/store.ts'
import type { HeroRuntime } from '../sim/heroRoster.ts'
import { heroIdentity } from '../sim/identity.ts'
import { Button } from '../ui/Button.tsx'
import { Tipped, type TipSpec } from '../ui/OsTip.tsx'
import { HeroFace } from './HeroFace.tsx'
import { heroDuty } from './heroCardModel.ts'

/* --- the status bar ---------------------------------------------------------- */

/** One reading in the bar: the rail's own block, with its tooltip around it. */
export function StatusItem({ tip, className, children }: { tip: () => TipSpec; className?: string; children: ReactNode }) {
  return (
    <Tipped tip={tip} className={['hud__status-item', className].filter(Boolean).join(' ')}>
      {children}
    </Tipped>
  )
}

/* --- the hero rail ------------------------------------------------------------- */

/**
 * The counter on a face: the first live row's number, when it is short enough
 * to be a badge (`+2`, `8`). James's row is a sentence (KEEPS CODING), so his
 * face carries no badge rather than a truncated one.
 */
function badgeOf(hero: HeroRuntime, devs: number): string | null {
  const first = heroDuty(hero, devs)[0]?.value.split(' ')[0]
  return first && first.length <= 5 && /\d/.test(first) ? first : null
}

export function HeroRail({ roster, state, onOpen }: { roster: readonly HeroRuntime[]; state: GameState; onOpen: (id: HeroRuntime['id']) => void }) {
  if (roster.length === 0) return null
  return (
    <div className="hud__heroes" aria-label="Heroes">
      {roster.map((hero) => {
        const face = heroIdentity(hero.id)
        if (!face) return null
        const badge = badgeOf(hero, state.devs)
        return (
          <Tipped
            key={hero.id}
            className="hud__hero"
            tip={() => ({
              title: face.name.toUpperCase(),
              tag: hero.hero.role.toUpperCase(),
              rows: heroDuty(hero, state.devs).map((r) => [r.label, r.value] as const),
              body: `${hero.hero.trait.name}: ${hero.hero.trait.text}`,
            })}
          >
            <button
              type="button"
              className="hud__hero-face"
              style={{ ['--branch' as string]: hero.colour }}
              aria-label={`${face.name}: open their card`}
              onClick={() => onOpen(hero.id)}
            >
              <HeroFace look={face.look} id={hero.id} shot="head" />
              {badge && <span className="hud__hero-badge">{badge}</span>}
            </button>
          </Tipped>
        )
      })}
    </div>
  )
}

/* --- the taskbar ------------------------------------------------------------------ */

export interface TaskApp {
  id: string
  label: string
  open: boolean
  onToggle: () => void
  /** A short count or word when the window wants the player. */
  badge?: string | null
  /** Pulses when the window is the move (§13.12.4's ×10 seats). */
  urged?: boolean
  tip: () => TipSpec
}

export function Taskbar({ apps }: { apps: readonly TaskApp[] }) {
  return (
    <nav className="hud__taskbar" aria-label="Studio OS">
      <span className="hud__taskbar-logo" aria-hidden="true">STUDIO_OS</span>
      {apps.map((app) => (
        <Tipped key={app.id} tip={app.tip} className="hud__task">
          <Button
            className={['hud__task-btn', app.open && 'is-chosen', app.urged && 'hud__shift-pays'].filter(Boolean).join(' ')}
            aria-current={app.open ? 'true' : undefined}
            // Named for the window alone: the badge is a count that changes, and a
            // door whose name changes every second is one nothing can find.
            aria-label={app.label}
            onClick={app.onToggle}
          >
            {app.label}
            {app.badge && <small className="hud__task-badge">{app.badge}</small>}
          </Button>
        </Tipped>
      ))}
    </nav>
  )
}
