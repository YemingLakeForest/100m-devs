import { describe, expect, it } from 'vitest'

import { SUBJECTS, subjectSprite } from './coverPixels.ts'
import { STATUE, cellSize, statueModel, voxelsBuilt } from './statueModel.ts'
import { SUBJECTS_PER_GENRE, type CoverSpec } from '../sim/cover.ts'
import { GENRES, type Genre } from '../sim/titles.ts'

/** Every subject the cover painter can draw, as the spec that draws it. The sky and the ground are not the statue's. */
const everySubject: CoverSpec[] = GENRES.flatMap((genre: Genre) =>
  Array.from({ length: SUBJECTS_PER_GENRE[genre] }, (_, subject) => ({ genre, subject, band: 0, layout: 0, pattern: 0, scene: 0, backdrop: 0, family: 0 })))

describe('the statue is the cover’s own subject, stood up (§8.2a, 2026-10-14)', () => {
  it('has a statue for every subject the painter has a sprite for, and no subject is left without one', () => {
    expect(everySubject.length).toBe(Object.values(SUBJECTS).flat().length)
    for (const spec of everySubject) expect(statueModel(spec).voxels.length, `${spec.genre}/${spec.subject}`).toBeGreaterThan(30)
  })

  it('makes one voxel of every painted cell of the sprite, in the sprite’s own colours, and nothing else', () => {
    for (const spec of everySubject) {
      const { rows, colours } = subjectSprite(spec), model = statueModel(spec)
      const painted = rows.join('').split('').filter((c) => colours[c]).length
      expect(model.voxels.length, `${spec.genre}/${spec.subject}`).toBe(painted)
      const legend = new Set(Object.values(colours))
      for (const v of model.voxels) {
        expect(legend.has(v.colour)).toBe(true)
        expect(v.col).toBeGreaterThanOrEqual(0); expect(v.col).toBeLessThan(model.cols)
        expect(v.row).toBeGreaterThanOrEqual(0); expect(v.row).toBeLessThan(model.rows)
      }
    }
  })

  it('stands them from the floor up, a row at a time, each row left to right, and never one twice', () => {
    for (const spec of everySubject) {
      const { voxels } = statueModel(spec)
      for (let i = 1; i < voxels.length; i++) {
        const a = voxels[i - 1], b = voxels[i]
        expect(b.row > a.row || (b.row === a.row && b.col > a.col), `${spec.genre}/${spec.subject} at ${i}`).toBe(true)
      }
      // nothing hangs: the first voxel stands on the plinth, and every row that has voxels has one on the row below it
      // somewhere (a rocket's nose is held up by its body, a sword's blade by its hilt)
      expect(voxels[0].row).toBe(0)
      const rowsUsed = new Set(voxels.map((v) => v.row))
      for (const r of rowsUsed) if (r > 0) expect(rowsUsed.has(r - 1), `${spec.genre}/${spec.subject} row ${r}`).toBe(true)
    }
  })

  it('stands a share of the statue equal to the share of the game built: none at nothing, all at done, more as it grows', () => {
    const n = statueModel(everySubject[0]).voxels.length
    expect(voxelsBuilt(n, 0)).toBe(0)
    expect(voxelsBuilt(n, 1)).toBe(n)
    let last = 0
    for (let p = 0; p <= 1.0001; p += 0.01) { const b = voxelsBuilt(n, p); expect(b).toBeGreaterThanOrEqual(last); last = b }
    // the last voxel is the game being done, and never a frame before
    expect(voxelsBuilt(n, 0.999)).toBe(n - 1)
  })

  it('stands nothing for a progress that is not a number, and never more than there is', () => {
    expect(voxelsBuilt(100, Number.NaN)).toBe(0)
    expect(voxelsBuilt(100, -1)).toBe(0)
    expect(voxelsBuilt(100, 7)).toBe(100)
    expect(voxelsBuilt(0, 0.5)).toBe(0)
  })

  it('stands every subject inside the box a statue may take, and fills it on the axis that is the limit', () => {
    for (const spec of everySubject) {
      const m = statueModel(spec), c = cellSize(m)
      expect(m.rows * c, `${spec.genre}/${spec.subject} height`).toBeLessThanOrEqual(STATUE.height + 1e-9)
      expect(m.cols * c, `${spec.genre}/${spec.subject} width`).toBeLessThanOrEqual(STATUE.width + 1e-9)
      const fillsHeight = Math.abs(m.rows * c - STATUE.height) < 1e-9, fillsWidth = Math.abs(m.cols * c - STATUE.width) < 1e-9
      expect(fillsHeight || fillsWidth, `${spec.genre}/${spec.subject}`).toBe(true)
    }
  })
})
