import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { MsaaScenePass } from './msaaScene.ts'

/** A renderer that remembers what it was pointed at when it was asked to draw, and nothing else. */
function recorder() {
  const drawn: { what: 'scene' | 'quad'; target: T.WebGLRenderTarget | null }[] = []
  let target: T.WebGLRenderTarget | null = null
  const renderer = {
    autoClear: true, autoClearColor: true, autoClearDepth: true, autoClearStencil: true,
    setRenderTarget: (t: T.WebGLRenderTarget | null) => { target = t },
    clear: () => {},
    render: (object: T.Object3D) => { drawn.push({ what: object instanceof T.Scene ? 'scene' : 'quad', target }) },
  } as unknown as T.WebGLRenderer
  return { renderer, drawn }
}

describe('the scene is the only thing drawn multisampled', () => {
  // The claim behind `msaaScene.ts`: samples are paid per pass, so they are bought for the scene and for
  // no full-screen quad after it. Two samples cost the laptop as much as four did, so a number would not
  // show a regression; where the samples are does.
  const draw = (samples: number, width = 64, height = 32) => {
    const pass = new MsaaScenePass(new T.Scene(), new T.PerspectiveCamera(), samples)
    pass.setSize(width, height)
    const read = new T.WebGLRenderTarget(width, height), write = new T.WebGLRenderTarget(width, height)
    const { renderer, drawn } = recorder()
    pass.render(renderer, write, read, 0, false)
    return { drawn, read }
  }

  it('draws the scene into a multisampled target of its own', () => {
    const { drawn, read } = draw(4)
    expect(drawn[0].what).toBe('scene')
    expect(drawn[0].target?.samples).toBe(4)
    expect(drawn[0].target).not.toBe(read)
  })

  it('resolves it once, with one full-screen quad, into the composer buffer the next pass reads', () => {
    const { drawn, read } = draw(2)
    expect(drawn.map((d) => d.what)).toEqual(['scene', 'quad'])
    expect(drawn[1].target).toBe(read)
    expect(read.samples).toBe(0)
  })

  it('is as big as the composer says, or the room would come out a handful of pixels wide', () => {
    const { drawn } = draw(4, 1920, 1080)
    expect([drawn[0].target?.width, drawn[0].target?.height]).toEqual([1920, 1080])
  })
})
