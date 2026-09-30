import * as T from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { createCityHouse, dressCityLot } from './cityHouse.ts'
import { box, disposeArt } from './worldArt.ts'
import { defaultCast } from './studioPeople.ts'
import { BLOCK_SIZE, BLOCK_PITCH } from './cityGrid.ts'
import { OS } from '../art/skin.ts'

export interface CityImpostors { houses: HTMLCanvasElement[][]; width: number; height: number; worldWidth: number }

/** District art is rendered from the actual neighbourhood models. A second
 * hand-drawn approximation kept changing roof slopes, porch sizes and lighting
 * at the zoom boundary. Fifteen small baked views retain those shapes without
 * allocating hundreds of furnished 3D houses or another WebGL context. */
export function bakeCityImpostors(renderer: T.WebGLRenderer): CityImpostors {
  const width = 160, height = 120, worldWidth = 52
  const scene = new T.Scene(), root = new T.Group(); scene.add(root)
  const sky = new T.HemisphereLight(OS.n3, OS.n0, .55); scene.add(sky)
  const sun = new T.DirectionalLight('#bdc6cb', .7); sun.position.set(22,28,10); scene.add(sun)
  const fill = new T.DirectionalLight(OS.calm2, .12); fill.position.set(-32,15,-10); scene.add(fill)
  const camera = new T.OrthographicCamera(-26,26,19.5,-19.5,.1,300)
  camera.position.set(80,80,80); camera.lookAt(0,0,0); camera.updateMatrixWorld()
  const pavement = new T.Group(); root.add(pavement)
  box(pavement,0,-.49,0,BLOCK_PITCH,.05,BLOCK_PITCH,OS.n1,false)
  box(pavement,0,-.43,0,BLOCK_SIZE,.08,BLOCK_SIZE,OS.n3,false)
  box(pavement,0,-.34,0,BLOCK_SIZE-1,.02,BLOCK_SIZE-1,OS.n2,false)
  for (const offset of [-12,0,12]) {
    box(pavement,BLOCK_PITCH/2,-.42,offset,.12,.015,3,OS.n4,false)
    box(pavement,offset,-.42,BLOCK_PITCH/2,3,.015,.12,OS.n4,false)
  }
  // The near scene gives paving a moonlit bounce; the baked lot uses the same.
  pavement.traverse(o => { if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial) {
    const m = o.material.clone(); m.emissive.copy(m.color); m.emissiveIntensity = .45; o.material=m; o.userData.ownMaterial=true
  } })
  const garden = dressCityLot(root,0,0)
  const savedTarget = renderer.getRenderTarget(), savedColour = renderer.getClearColor(new T.Color()), savedAlpha = renderer.getClearAlpha()
  const shadows = renderer.shadowMap.enabled
  const renderTarget = new T.WebGLRenderTarget(width,height,{type:T.UnsignedByteType})
  const composer = new EffectComposer(renderer,renderTarget)
  composer.setPixelRatio(1); composer.setSize(width,height); composer.renderToScreen=false
  const render = new RenderPass(scene,camera), output = new OutputPass(); composer.addPass(render); composer.addPass(output)
  const pixels = new Uint8Array(width*height*4), houses: HTMLCanvasElement[][] = []
  renderer.setClearColor(0,0); renderer.shadowMap.enabled=false
  try {
    for (let variant=0; variant<3; variant++) {
      const house=createCityHouse(variant,defaultCast); house.body.position.y=-.3; root.add(house.body)
      const states: HTMLCanvasElement[]=[]
      for (let step=0; step<=4; step++) {
        house.fill(step*25); composer.render()
        renderer.readRenderTargetPixels(composer.readBuffer,0,0,width,height,pixels)
        const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height
        const ctx=canvas.getContext('2d')!, bitmap=ctx.createImageData(width,height)
        // Render targets are bottom-up; Canvas is top-down. Alpha keeps lots
        // composable in painter order without a rectangular backdrop.
        for(let row=0;row<height;row++) bitmap.data.set(pixels.subarray(row*width*4,(row+1)*width*4),(height-row-1)*width*4)
        ctx.putImageData(bitmap,0,0); states.push(canvas)
      }
      houses.push(states); root.remove(house.body); house.dispose()
    }
  } finally {
    composer.dispose(); render.dispose(); output.dispose(); disposeArt(pavement); disposeArt(garden)
    renderer.shadowMap.enabled=shadows; renderer.setClearColor(savedColour,savedAlpha); renderer.setRenderTarget(savedTarget)
  }
  return { houses,width,height,worldWidth }
}
