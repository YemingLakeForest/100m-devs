/*
 * Copied from the rebuild (100m-devs-three/src/art/skin.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * **The STUDIO_OS skin — a proof, 2026-09-26.**
 *
 * *"The game scenes of city, galaxy UI all of it looks very amateur. Theres no
 * cohesive design and aesthetic"*, then, on being told the legacy build's
 * direction was the cohesive one and its modelling the broken part: *"Yes build
 * the proof please"*.
 *
 * `?skin=os` puts the legacy direction — the game as the studio's operating
 * system: CRT glass, one mono face, phosphor cyan for actions and amber for
 * money, a dark room lit by its own screens — over this build's engine and
 * geometry, so the two can be compared side by side before either is chosen.
 * Without the flag nothing changes. The palette is the legacy master palette's
 * ramps (legacy `art/palette.ts`, NEUTRAL / GLOW / CALM / WARN / ALARM).
 *
 * Read once at load: a skin that changed mid-session would need every material
 * rebuilt, and the proof does not need that.
 */
import { debugSearchParams } from '../../dev/debugAccess.ts'

// In this build the world is always STUDIO_OS: dusk, screen-lit, head-and-body people.
export const OS_SKIN = true

/**
 * **The scene as the interface's own picture** [2026-10-11 — DEMO, `demo/ladder-jokes`].
 *
 * *"I want the art scene style to fit the UI style as much as we can, UI is a OS system."*
 * The 2026-10-07 daylight rig answered a real complaint (a flat fill made every surface equally dull) and
 * made a second one: the room is lit like a house at noon while the glass in front of it is a dark phosphor
 * terminal, and the monitor stops past the block are night again, so one scroll went day → night.
 * This look keeps the depth and moves everything else to the interface's side: the dark room lit by its own
 * screens (§7.8.0c's original brief), the UI's neutral and phosphor ramps for light and shade, hard
 * one-pixel edges where the interface draws them, brackets at the corners of every lot as the survey frame
 * has them, and a dot-grid desktop where the world runs out.
 *
 * `?look=day` (loopback only, like every seam in `dev/`) puts the 2026-10-07 daylight back, so the two can
 * be compared in one build. Read once at load: a look that changed mid-session would rebuild every material.
 */
export const OS_NIGHT = debugSearchParams().get('look') !== 'day'

/**
 * The night rig's numbers. Placements, not claims: they were tuned by putting the two looks side by side
 * (a first, darker pass lost the roofs' variety and the warm windows at the 1K stop, so the key and the
 * exposure came back up) and nothing pins them but `osLook.test.ts`'s two ceilings. Colours come from the
 * interface's ramps (`OS`, below) so a wall is never a hue the HUD does not have.
 */
export const NIGHT = {
  key: '#b4dbe4', keyIntensity: 1.25,
  sky: '#5b8792', ground: '#1b2527', skyIntensity: 1.2,
  fill: '#4a8fa8', fillIntensity: 0.25,
  exposure: 1.35,
  /** The grade and edge pass (`osPass.ts`). */
  tint: 0.38, edge: 0.5, edgeFloor: 0.12,
} as const

/**
 * The horizon slab's colour in the OS look: the survey's own `OS.n0` *as it must be handed to the room* so
 * that it comes out of the room's tone map (ACES at `NIGHT.exposure`) and the interface grade as `#181919`.
 * A flat colour is crushed by that tone map, so `OS.n0` itself came out at `#0c0c0c`, a black the
 * interface never uses. Measured against `town.png`'s void rather than derived: if the exposure moves, this
 * is the number to re-measure against the monitor's void (`#191a1a` at the globe).
 */
export const OS_HORIZON = '#232424'

/** The legacy ramps this skin draws from, by name. */
export const OS = {
  n0: '#181919', n1: '#292a29', n2: '#3c3e3c', n3: '#575a56', n4: '#767970',
  glow0: '#2a4a5c', glow1: '#4a8fa8', glow2: '#7fd4e8',
  calm1: '#1a6b78', calm2: '#35c9d9', calm3: '#b8f4ff',
  warm: '#e0a52e', lamp: '#ffd68c',
} as const
