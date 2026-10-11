import * as T from 'three'
import { OS } from '../art/skin.ts'
import { BLOCK_PITCH } from './cityGrid.ts'

/**
 * **The desktop the studio sits on** [2026-10-11, `OS_NIGHT`].
 *
 * Past the last lot the world used to be a flat charcoal void with the edge of the paving showing in
 * it, which is nobody's idea of a place. The interface already has a ground for things that are not
 * on screen yet — the survey's dark field, with its corner brackets — and the room now stands on the
 * same one: a dot grid at the street's own pitch, a plus at every block, fading out with distance.
 * It is what the monitor's `LIVE SURVEY` frame is drawn on, so the hand-off at the top of the block
 * no longer changes the ground under the player's feet.
 *
 * Drawn under the paving (the lots hide it where there is a lot), at one device pixel wherever the
 * lens is: the dots are screen-space-sized by `fwidth`, and fade out when the lens is so far out they
 * would crowd into a texture. Pure decoration, never picked, never shadowed.
 */
export function createOsDesktop(): T.Mesh {
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      ink: { value: new T.Color(OS.glow1) },
      pitch: { value: 6 },
      major: { value: BLOCK_PITCH },
    },
    vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix*vec4(position,1.); wp = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: /* glsl */ `
      uniform vec3 ink; uniform float pitch; uniform float major; varying vec3 wp;
      void main(){
        vec2 g = wp.xz / pitch;
        vec2 f = abs(fract(g - .5) - .5) / fwidth(g);
        // A dot where two grid lines cross: one device pixel, whatever the zoom.
        float dotPx = (1. - min(f.x, 1.)) * (1. - min(f.y, 1.));
        // A plus at every block: the survey frame's corner mark, laid on the ground.
        vec2 g2 = wp.xz / major; vec2 f2 = abs(fract(g2 - .5) - .5) / fwidth(g2);
        float arm = (1. - min(min(f2.x, f2.y), 1.)) * (1. - min(max(f2.x, f2.y) / 5., 1.));
        float crowd = 1. - smoothstep(.22, .5, max(fwidth(g.x), fwidth(g.y)));
        float far = 1. - smoothstep(70., 260., length(wp.xz));
        float a = (dotPx * .30 + arm * .55) * crowd * far;
        gl_FragColor = vec4(ink, a);
      }`,
  })
  const mesh = new T.Mesh(new T.PlaneGeometry(900, 900), material)
  mesh.rotation.x = -Math.PI / 2
  // On the horizon slab (`garageEnvironment` lays a 512 m ground with its top at -0.5 to hide the
  // void), a centimetre above it: any lower and the slab covers the grid, which is how this first
  // drew nothing. The paving of every occupied lot (top at -0.465) still covers it where there is a lot.
  mesh.position.y = -0.49
  mesh.renderOrder = -1
  mesh.frustumCulled = false
  mesh.name = 'os-desktop'
  return mesh
}

/** Just outside a 30 m lot's own wall (x = ±14.7), on the street's kerb, so no hedge ever covers a corner. */
export const LOT_BRACKET = 15.7

/**
 * Four corner brackets round a lot, the survey frame's own mark at lot scale.
 * One-pixel lines (the interface has no other weight) in the interface's action colour.
 */
export function createLotBrackets(half: number, arm = 3.2, opacity = 0.7): T.LineSegments {
  const p: T.Vector3[] = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * half, z = sz * half
    p.push(new T.Vector3(x, 0, z), new T.Vector3(x - sx * arm, 0, z))
    p.push(new T.Vector3(x, 0, z), new T.Vector3(x, 0, z - sz * arm))
  }
  const brackets = new T.LineSegments(
    new T.BufferGeometry().setFromPoints(p),
    new T.LineBasicMaterial({ color: OS.calm2, transparent: true, opacity }),
  )
  brackets.name = 'os-brackets'
  return brackets
}
