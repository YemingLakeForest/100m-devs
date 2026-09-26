/*
 * The environment types from the rebuild's render/worldEnvironments.ts, and only
 * the types: that module is the rebuild's whole scene ladder, which this build
 * replaces with its own (see ../world3d.ts).
 */
import * as T from 'three'
import type { SeatInstance, SeatInstances } from './worldArt.ts'
import type { ProjectPlate } from './projectPlate.ts'
import type { EndlessCity } from './city/endlessCity.ts'

export interface WorldTarget {
  rank: number
  index: number
  label: string
  population: number
  mesh: T.Mesh
  radius: number
  outline?: T.Vector3[]
  members?: { index: number; label: string; population: number }[]
}

export interface Environment {
  root: T.Group
  targets: WorldTarget[]
  occluders: T.Object3D[]
  people: T.Group[]
  focus: T.Vector3
  extent: number
  background: string
  rotating?: T.Group
  seatInstances?: SeatInstances
  projectPlate?: ProjectPlate
  props?: Map<string, GarageProp>
  city?: EndlessCity
  backdrop?: EndlessCity
}

export interface GarageProp {
  rest: T.Matrix4
  centre: T.Vector3
  group: T.Group
  instances: SeatInstance[]
}
