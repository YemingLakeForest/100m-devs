import * as T from 'three'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { CopyShader } from 'three/addons/shaders/CopyShader.js'

/**
 * **Multisampling for the scene, and for nothing after it** [2026-10-11, answering the user's *"why the game
 * is so laggy when I open full screen on laptop"*].
 *
 * The composer's two ping-pong targets were both multisampled (`samples = 4`, the 2026-10-05 smooth-edges
 * decision), and every pass after the scene writes into one of them: the contact shade, the output pass,
 * the grade and edge pass, each of bloom's blurs. A full-screen quad has no geometry edges to smooth, so
 * each of those drew into four samples a pixel and resolved them again for nothing. On an integrated GPU,
 * where the targets live in shared memory, that resolve is most of what a post pass costs: measured at a
 * 1920x1080 window at 1.5x, four samples cost 14 fps against 28 with none, and **two samples cost the same
 * as four**, which is the signature of a per-pass fixed price and not of the sample count. Every pass added
 * to the chain since (the grade pass and bloom on 2026-10-11) paid it again, and the room went from 18 fps
 * to 12 on the laptop without anything about the picture getting more expensive to compute.
 *
 * So the scene is drawn into a target of its own that *is* multisampled, resolved once into the composer's
 * plain buffer, and everything after it runs on single-sample targets. The picture is the same: the edges
 * that were smooth are smooth (they are resolved from the same samples), the full-screen passes see the
 * same resolved colour, and the 2026-10-05 rule, the room at the screen's own resolution with linear
 * filtering, is untouched.
 */
export class MsaaScenePass extends RenderPass {
  private readonly target: T.WebGLRenderTarget
  private readonly copy: FullScreenQuad

  constructor(scene: T.Scene, camera: T.Camera, samples: number) {
    super(scene, camera)
    // Half-float like the composer's own targets, so nothing about the colour the later passes read changes.
    this.target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples })
    this.copy = new FullScreenQuad(new T.ShaderMaterial({
      uniforms: T.UniformsUtils.clone(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      depthTest: false, depthWrite: false,
    }))
  }

  override setSize(width: number, height: number) { this.target.setSize(width, height) }

  override render(renderer: T.WebGLRenderer, writeBuffer: T.WebGLRenderTarget, readBuffer: T.WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
    // Straight to the screen there is nothing to resolve into; the composer here never does it.
    if (this.renderToScreen) { super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive); return }
    super.render(renderer, writeBuffer, this.target, deltaTime, maskActive)
    // Drawing into `readBuffer` resolves the samples; the copy is one single-sample full-screen pass.
    const material = this.copy.material as T.ShaderMaterial
    material.uniforms.tDiffuse.value = this.target.texture
    renderer.setRenderTarget(readBuffer)
    this.copy.render(renderer)
  }

  dispose() {
    super.dispose()
    this.target.dispose()
    this.copy.dispose()
  }
}
