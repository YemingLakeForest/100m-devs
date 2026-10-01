import { planetKind } from '../../sim/colonyTerrain.ts'
import { RAMPS, hexToRgb } from '../../art/palette.ts'
import { mixHex } from '../../art/entropyTheme.ts'
import { terrainAt } from '../../sim/planetTerrain.ts'
let surface:HTMLCanvasElement|null=null,last=''
const ocean=hexToRgb(mixHex(RAMPS.NEUTRAL[0],RAMPS.GLOW[0],.24))
const stone=hexToRgb(RAMPS.NEUTRAL[4]),coast=hexToRgb(RAMPS.NEUTRAL[5]),ice=hexToRgb(RAMPS.NEUTRAL[6])
/** Full-resolution coast silhouette, restrained dusk shading. Population never
 * changes this surface: the cities above it carry the growth and its rewards. */
export function paintPlanet(ctx:CanvasRenderingContext2D,cx:number,cy:number,radius:number,yaw:number,tilt:number,worldId=0) {
  surface??=document.createElement('canvas')
  const r=Math.ceil(radius*2),size=r*2+2,key=[worldId,r,yaw.toFixed(3),tilt.toFixed(3)].join(':')
  const kind=planetKind(worldId)
  const rock=hexToRgb(RAMPS.NEUTRAL[5]),sand=hexToRgb(RAMPS.WOOD[3]),frost=hexToRgb(mixHex(RAMPS.NEUTRAL[7],RAMPS.GLOW[1],.22)),island=hexToRgb(RAMPS.FOLIAGE[1])
  if(key!==last) {
    last=key;surface.width=surface.height=size
    const paint=surface.getContext('2d')!,im=paint.createImageData(size,size)
    const sy=Math.sin(yaw),cyaw=Math.cos(yaw),st=Math.sin(tilt),ct=Math.cos(tilt)
    for(let row=0;row<size;row++)for(let col=0;col<size;col++) {
      const x=(col-r-.5)/r,y=-(row-r-.5)/r,rr=x*x+y*y
      if(rr>1)continue
      const z=Math.sqrt(1-rr),wy=y*ct+z*st,wz=z*ct-y*st
      const world=[x*cyaw-wz*sy,wy,wz*cyaw+x*sy],t=terrainAt(world,worldId)
      const base=kind==='rock'?rock:kind==='desert'?sand:kind==='ice'?frost:kind==='ocean'?(t.land?island:ocean):t.ice&&t.land?ice:t.land?(t.coast<.05?coast:stone):ocean
      const sun=Math.max(0,-x*.64+y*.43+z*.38)
      const light=Math.round((.29+sun*.66)*24)/24,relief=1+t.relief*1.4,limb=.6+.4*Math.pow(z,.35)
      const at=(row*size+col)*4
      for(let k=0;k<3;k++)im.data[at+k]=Math.round(base[k]*(t.land?light*relief: .75+sun*.35)*limb)
      im.data[at+3]=255
    }
    paint.putImageData(im,0,0)
  }
  ctx.save()
  const glow=ctx.createRadialGradient(cx,cy,radius*.94,cx,cy,radius+4)
  glow.addColorStop(0,'transparent');glow.addColorStop(.68,'#4a8fa826');glow.addColorStop(1,'transparent')
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,radius+4,0,Math.PI*2);ctx.fill()
  ctx.imageSmoothingEnabled=true;ctx.drawImage(surface,cx-(r+1)/2,cy-(r+1)/2,(r+1),(r+1))
  ctx.restore()
}
