/* The cover's type from the rebuild's sim/cover.ts; the generator itself is not needed here. */
import type { Genre } from './titles.ts'

export interface CoverSpec {
  genre: Genre
  band: number
  layout: number
  pattern: number
  scene: number
  backdrop: number
  family: number
  subject: number
}
