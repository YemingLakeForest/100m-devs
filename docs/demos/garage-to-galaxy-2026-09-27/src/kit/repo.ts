/**
 * Everything these demos take from the game itself, in one place.
 *
 * The garage at the origin is the real one (`buildGarageEnvironment`), and a
 * developer is the real `developerAt(seed, i)`, so seat 7 in the garage is the
 * same person here as in the game. Nothing is copied; if the game changes, the
 * demos change with it.
 */
export { buildGarageEnvironment, showGarageSeats, showGarageStations, GARAGE_ASSEMBLED } from '../../../../../src/three/render/garageEnvironment.ts'
export { defaultCast, LEADER_COLOURS, personColours, studioPerson, chair, type StudioCast } from '../../../../../src/three/render/studioPeople.ts'
export { placeInstances, type SeatInstance } from '../../../../../src/three/render/worldArt.ts'
export type { Environment } from '../../../../../src/three/render/worldEnvironments.ts'
export { developerAt, heroIdentity, JAMES, type Identity, type Look } from '../../../../../src/three/sim/identity.ts'
export { garageSeats, GARAGE_LEADERS, leaderSeat } from '../../../../../src/three/sim/floorPlan.ts'
export { lossBreakdown, LOSS_KINDS, type WorkState, type Breakdown } from '../../../../../src/three/sim/losses.ts'
export { STATE_LIGHT, STATE_LABEL, STATE_CAUSE } from '../../../../../src/three/art/stateLights.ts'
export { RAMPS } from '../../../../../src/art/palette.ts'
export { OS } from '../../../../../src/three/art/skin.ts'
