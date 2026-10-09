import * as T from 'three'
import { describe, expect, it } from 'vitest'
import { placeInstances, showSeatInstances, type SeatInstance } from './worldArt.ts'

describe('arriving furniture remains in the camera frustum', () => {
  it('recovers from bounds computed while its instances were hidden', () => {
    const mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), 1)
    const matrix = new T.Matrix4().makeTranslation(20, 0, 0)
    const parts: SeatInstance[] = [{ mesh, index: 0, matrix }]
    const camera = new T.OrthographicCamera(-2, 2, 2, -2, .1, 100)
    camera.position.set(20, 0, 10); camera.lookAt(20, 0, 0); camera.updateMatrixWorld(true)
    const frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    showSeatInstances(parts, false)
    expect(frustum.intersectsObject(mesh)).toBe(false)
    placeInstances(parts, new T.Matrix4())
    expect(frustum.intersectsObject(mesh)).toBe(true)
    showSeatInstances(parts, false)
    expect(frustum.intersectsObject(mesh)).toBe(false)
    showSeatInstances(parts, true)
    expect(frustum.intersectsObject(mesh)).toBe(true)
    mesh.geometry.dispose(); (mesh.material as T.Material).dispose()
  })
})
