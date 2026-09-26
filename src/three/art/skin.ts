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
// In this build the world is always STUDIO_OS: dusk, screen-lit, head-and-body people.
export const OS_SKIN = true

/** The legacy ramps this skin draws from, by name. */
export const OS = {
  n0: '#14121a', n1: '#241f2e', n2: '#3a3244', n3: '#55495e', n4: '#736579',
  glow0: '#2a4a5c', glow1: '#4a8fa8', glow2: '#7fd4e8',
  calm1: '#1a6b78', calm2: '#35c9d9', calm3: '#b8f4ff',
  warm: '#e0a52e', lamp: '#ffd68c',
} as const
