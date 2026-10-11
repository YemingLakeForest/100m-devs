import * as T from 'three'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { NIGHT, OS } from '../art/skin.ts'

/**
 * **The room, graded into the interface's palette** [2026-10-11 — demo, `OS_NIGHT`].
 *
 * Two jobs, both of them the interface's habits applied to a picture:
 *
 * - **A grade.** Shadows lean toward the UI's phosphor teal rather than toward neutral grey, and the
 *   highlights give up a little of their cream, so a plaster wall and a panel of the HUD sit in one
 *   colour family. It is a lean, not a filter: the strength is `NIGHT.tint`, and the materials stay
 *   the materials (§2.1a: the quantiser polices membership, and this does not touch an asset).
 * - **One-pixel edges.** The interface draws everything in hard 1px rules and brackets and never
 *   in shading; the room is smooth shading and soft shadow. Where the picture changes brightness
 *   sharply (a roof against the street, a monitor against its desk) this lays the interface's
 *   rule colour on that seam, so the room is *drawn* the way the HUD is drawn without anything in it
 *   becoming a line drawing. Run on the output pass, in display space, so the threshold means what
 *   the eye sees; `NIGHT.edgeFloor` keeps paving grain and soft shadow out of it.
 *
 * Runs after `OutputPass` and before bloom, so the lamps and screens that bloom are the ones the
 * grade left brightest.
 */
export function createOsPass(): ShaderPass {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      texel: { value: new T.Vector2(1, 1) },
      rule: { value: new T.Color(OS.glow2) },
      shade: { value: new T.Color(OS.glow0) },
      tint: { value: NIGHT.tint },
      edge: { value: NIGHT.edge },
      edgeFloor: { value: NIGHT.edgeFloor },
    },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform vec2 texel; uniform vec3 rule; uniform vec3 shade;
      uniform float tint; uniform float edge; uniform float edgeFloor; varying vec2 vUv;
      float luma(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = luma(c);
        // Sobel on luma, one device pixel out: the interface's rules are one pixel.
        float tl = luma(texture2D(tDiffuse, vUv + texel*vec2(-1., 1.)).rgb), t = luma(texture2D(tDiffuse, vUv + texel*vec2(0., 1.)).rgb), tr = luma(texture2D(tDiffuse, vUv + texel*vec2(1., 1.)).rgb);
        float ml = luma(texture2D(tDiffuse, vUv + texel*vec2(-1., 0.)).rgb), mr = luma(texture2D(tDiffuse, vUv + texel*vec2(1., 0.)).rgb);
        float bl = luma(texture2D(tDiffuse, vUv + texel*vec2(-1., -1.)).rgb), b = luma(texture2D(tDiffuse, vUv + texel*vec2(0., -1.)).rgb), br = luma(texture2D(tDiffuse, vUv + texel*vec2(1., -1.)).rgb);
        float gx = (tr + 2.*mr + br) - (tl + 2.*ml + bl), gy = (tl + 2.*t + tr) - (bl + 2.*b + br);
        float seam = smoothstep(edgeFloor, edgeFloor + .22, length(vec2(gx, gy)) * .25);
        // The grade: shadows toward the UI's teal, highlights a touch cooler and less cream.
        // Not into the blacks: the darkest thing in the room is the interface's own charcoal, not a teal one.
        vec3 graded = c * vec3(.90, 1.0, 1.05) + shade * pow(1. - l, 2.) * .30;
        vec3 cool = mix(c, graded, smoothstep(.06, .24, l));
        c = mix(c, cool, tint);
        // The rule goes on the seam at the colour of the seam's brighter side, never brighter than a glyph.
        c = mix(c, rule * (.55 + .45 * l), seam * edge);
        gl_FragColor = vec4(c, 1.);
      }`,
  })
  const setSize = pass.setSize.bind(pass)
  pass.setSize = (w: number, h: number) => { setSize(w, h); (pass.uniforms.texel.value as T.Vector2).set(1 / w, 1 / h) }
  return pass
}
