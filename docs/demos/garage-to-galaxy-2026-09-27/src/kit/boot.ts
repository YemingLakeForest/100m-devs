import * as T from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { HEX } from './palette.ts'

/**
 * The glass: bloom for the lit windows, then the CRT (ART_DIRECTION §6) in
 * display space — fringe, scanlines, vignette and a slight barrel. The barrel
 * is kept, and hit-testing goes through {@link Stage.content} rather than the
 * raw pointer, which is the §0 lesson the game learnt the hard way ("undo the
 * barrel curvature in hit-testing").
 */
const CURVE = 0.03

const CrtShader = {
  uniforms: {
    tDiffuse: { value: null as T.Texture | null },
    uRes: { value: new T.Vector2(1, 1) },
    uCurve: { value: CURVE },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uCurve;
    varying vec2 vUv;
    vec2 barrel(vec2 uv) { vec2 c = uv * 2.0 - 1.0; c *= 1.0 + uCurve * dot(c, c); return c * 0.5 + 0.5; }
    void main() {
      vec2 uv = barrel(vUv);
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
      vec2 d = (uv - 0.5) * 0.0022;
      vec3 col = vec3(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b);
      col *= 0.93 + 0.07 * sin(uv.y * uRes.y * 3.14159);
      vec2 v = uv - 0.5;
      col *= 1.0 - dot(v, v) * 0.6;
      gl_FragColor = vec4(col, 1.0);
    }`,
}

export interface Stage {
  renderer: T.WebGLRenderer
  composer: EffectComposer
  scene: T.Scene
  camera: T.PerspectiveCamera
  /** A second, far layer drawn first (stars, galaxy), with its own camera. */
  sky: T.Scene
  skyCamera: T.PerspectiveCamera
  /** A phone: one pixel per pixel, no MSAA, bloom at half size. */
  lite: boolean
  width: number
  height: number
  /** Where a pointer's CSS position lands in the picture, after the barrel, in NDC. */
  /**
   * A second picture laid over the world before the glass: the monitor's
   * phosphor, or the swarm. `amount` 0 turns it off; 1 replaces the world.
   */
  overlay(texture: T.Texture | null, amount: number, wipe?: boolean): void
  /** Skip drawing the world when an overlay covers it completely. */
  worldVisible(on: boolean): void
  content(x: number, y: number): T.Vector2
  /** The inverse, for placing HTML over the world: picture NDC to CSS pixels. */
  screen(ndcX: number, ndcY: number): { x: number; y: number }
  loop(frame: (dt: number, t: number) => void): void
}

export function createStage(host: HTMLElement): Stage {
  const lite = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('lite')
  const renderer = new T.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(lite ? 1 : Math.min(devicePixelRatio || 1, 1.5))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  renderer.shadowMap.enabled = !lite
  renderer.shadowMap.type = T.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.autoClear = false
  host.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.touchAction = 'none'

  const scene = new T.Scene()
  scene.background = null
  const camera = new T.PerspectiveCamera(24, 1, 0.05, 1e5)
  const sky = new T.Scene()
  sky.background = new T.Color(HEX.night)
  const skyCamera = new T.PerspectiveCamera(24, 1, 1, 1e9)

  const composer = new EffectComposer(renderer)
  if (!lite) { composer.renderTarget1.samples = 4; composer.renderTarget2.samples = 4 }
  const skyPass = new RenderPass(sky, skyCamera)
  composer.addPass(skyPass)
  const worldPass = new RenderPass(scene, camera)
  worldPass.clear = false
  // The sky is drawn with its own frustum, so its depth means nothing here.
  worldPass.clearDepth = true
  composer.addPass(worldPass)
  const overlayPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tOverlay: { value: null }, uAmount: { value: 0 }, uWipe: { value: 0 }, uRes: { value: new T.Vector2(1, 1) } },
    vertexShader: CrtShader.vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform sampler2D tOverlay;
      uniform float uAmount;
      uniform float uWipe;
      uniform vec2 uRes;
      varying vec2 vUv;
      void main() {
        vec3 a = texture2D(tDiffuse, vUv).rgb;
        vec3 b = texture2D(tOverlay, vUv).rgb;
        if (uWipe < 0.5) { gl_FragColor = vec4(mix(a, b, uAmount), 1.0); return; }
        // A CRT refresh: the phosphor redraws the picture from the top down,
        // a bright scan line at its leading edge.
        float edge = 1.0 - uAmount * 1.04;
        float d = vUv.y - edge;
        vec3 col = d > 0.0 ? b : a;
        float line = exp(-abs(d) * uRes.y * 0.25) * step(0.001, uAmount) * step(uAmount, 0.999);
        gl_FragColor = vec4(col + (b * 2.0 + vec3(0.25)) * line, 1.0);
      }`,
  })
  overlayPass.enabled = false
  composer.addPass(overlayPass)
  const bloom = new UnrealBloomPass(new T.Vector2(256, 256), 0.6, 0.4, 0.82)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const crt = new ShaderPass(CrtShader)
  composer.addPass(crt)

  const stage: Stage = {
    renderer, composer, scene, camera, sky, skyCamera, lite,
    width: 1, height: 1,
    overlay(texture, amount, wipe = false) {
      overlayPass.enabled = texture !== null && amount > 0
      overlayPass.uniforms.tOverlay.value = texture
      overlayPass.uniforms.uAmount.value = amount
      overlayPass.uniforms.uWipe.value = wipe ? 1 : 0
      overlayPass.uniforms.uRes.value.set(stage.width, stage.height)
    },
    worldVisible(on) {
      skyPass.enabled = on
      worldPass.enabled = on
    },
    content(x, y) {
      const u = x / stage.width, v = 1 - y / stage.height
      const cx = u * 2 - 1, cy = v * 2 - 1
      const k = 1 + CURVE * (cx * cx + cy * cy)
      return new T.Vector2(cx * k, cy * k)
    },
    screen(nx, ny) {
      // One fixed-point step inverts the barrel well inside a pixel at this curve.
      let cx = nx, cy = ny
      for (let i = 0; i < 3; i++) {
        const k = 1 + CURVE * (cx * cx + cy * cy)
        cx = nx / k; cy = ny / k
      }
      return { x: (cx + 1) / 2 * stage.width, y: (1 - (cy + 1) / 2) * stage.height }
    },
    loop(frame) {
      let last = performance.now()
      const tick = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        frame(dt, now / 1000)
        skyCamera.quaternion.copy(camera.quaternion)
        skyCamera.fov = camera.fov
        skyCamera.aspect = camera.aspect
        skyCamera.updateProjectionMatrix()
        composer.render()
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
  }

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight
    stage.width = w; stage.height = h
    renderer.setSize(w, h, false)
    renderer.domElement.style.width = w + 'px'
    renderer.domElement.style.height = h + 'px'
    composer.setSize(w, h)
    const pr = renderer.getPixelRatio()
    bloom.setSize(Math.round(w * pr / (lite ? 2 : 1)), Math.round(h * pr / (lite ? 2 : 1)))
    crt.uniforms.uRes.value.set(w * pr, h * pr)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(host)
  resize()
  return stage
}
