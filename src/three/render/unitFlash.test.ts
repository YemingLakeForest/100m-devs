import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { UNIT_FLASH_MS } from '../../sim/juice.ts'
import { createUnitFlash, MAX_FLASH_PADS, type FlashPad } from './unitFlash.ts'

const pad = (i: number): FlashPad => ({ x: i * 40, z: 0, y: -0.31, half: 14 })
const colourOf = (flash: ReturnType<typeof createUnitFlash>, i = 0) => { const c = new T.Color(); flash.mesh.getColorAt(i, c); return c.getHex() }

describe('the unit flash layer (§8.2a, move 3)', () => {
  it('lights every unit it is handed, in the first of three colours, and then in the next two', () => {
    const flash = createUnitFlash(new T.Group())
    flash.start([pad(0), pad(1), pad(2)], 0)
    flash.update(0, false)
    expect(flash.mesh.count).toBe(3)
    const first = colourOf(flash)
    flash.update(0.1, false)
    const second = colourOf(flash)
    flash.update(0.2, false)
    const third = colourOf(flash)
    expect(new Set([first, second, third]).size).toBe(3)
    expect(colourOf(flash, 2)).toBe(third)
    flash.dispose()
  })

  it('is gone when its time is up, and says so, so the view can stop drawing frames for it', () => {
    const flash = createUnitFlash(new T.Group())
    flash.start([pad(0)], 5)
    expect(flash.update(5.1, false)).toBe(true)
    expect(flash.update(5 + UNIT_FLASH_MS / 1000 + 0.01, false)).toBe(false)
    expect(flash.mesh.count).toBe(0)
    flash.dispose()
  })

  it('never lights more units than it has instances for', () => {
    const flash = createUnitFlash(new T.Group())
    flash.start(Array.from({ length: 500 }, (_, i) => pad(i)), 0)
    flash.update(0, false)
    expect(flash.mesh.count).toBe(MAX_FLASH_PADS)
    flash.dispose()
  })

  it('lies flat on the ground under the unit and no thicker than a pavement slab', () => {
    const flash = createUnitFlash(new T.Group())
    flash.start([pad(1)], 0)
    flash.update(0, false)
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
    flash.mesh.getMatrixAt(0, m); m.decompose(p, q, s)
    expect(p.x).toBe(40)
    expect(s.x).toBeCloseTo(28, 6)
    expect(s.y).toBeLessThanOrEqual(0.05)
    flash.dispose()
  })

  it('holds one colour under reduced motion', () => {
    const flash = createUnitFlash(new T.Group())
    flash.start([pad(0)], 0)
    flash.update(0, true); const a = colourOf(flash)
    flash.update(0.2, true); const b = colourOf(flash)
    expect(a).toBe(b)
    flash.dispose()
  })

  it('takes itself off the scene when disposed', () => {
    const parent = new T.Group()
    const flash = createUnitFlash(parent)
    flash.dispose()
    expect(parent.children).toHaveLength(0)
  })
})
