import { RAMPS } from '../../art/palette.ts'
import { mixHex } from '../../art/entropyTheme.ts'
import { terrainAt, settlementScore } from '../../sim/planetTerrain.ts'

let surface:HTMLCanvasElement|null=null,last=''
const bases=[RAMPS.GLOW[0],RAMPS.GLOW[1],RAMPS.FOLIAGE[0],RAMPS.FOLIAGE[1],RAMPS.WOOD[2],RAMPS.NEUTRAL[7]]
const colours=bases.map(c=>Array.from({length:12},(_,i)=>{
  const hex=mixHex(RAMPS.NEUTRAL[0],c,.18+i/11*.82)
  return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]
}))
/** A shaded sphere with continuous coastlines. Cache while the camera is still;
 * settlement lights animate independently without repainting the geography. */
export function paintPlanet(ctx:CanvasRenderingContext2D,cx:number,cy:number,radius:number,yaw:number,tilt:number,frontier:number) {
  surface??=document.createElement('canvas')
  const r=Math.ceil(radius),size=r*2+2,key=[r,yaw.toFixed(3),tilt.toFixed(3),frontier.toFixed(3)].join(':')
  if(key!==last) {
    last=key;surface.width=surface.height=size
    const paint=surface.getContext('2d')!,im=paint.createImageData(size,size)
    const sy=Math.sin(yaw),cyaw=Math.cos(yaw),st=Math.sin(tilt),ct=Math.cos(tilt)
    for(let row=0;row<size;row++)for(let col=0;col<size;col++) {
      const x=(col-r-.5)/r,y=-(row-r-.5)/r,rr=x*x+y*y
      if(rr>1)continue
      const z=Math.sqrt(1-rr),wy=y*ct+z*st,wz=z*ct-y*st
      const world=[x*cyaw-wz*sy,wy,wz*cyaw+x*sy]
      const t=terrainAt(world)
      const elevation=Math.sin(world[0]*17+world[1]*13)*Math.cos(world[2]*19-world[1]*9)
      const biome=t.ice?5:t.land?(t.coast<.08?4:elevation>.35?3:2):(t.coast>-.12?1:0)
      const light=Math.max(0,Math.min(1,-x*.5+y*.42+z*.74))
      const shade=Math.min(11,Math.floor((.10+light*.9)*11))
      const rgb=colours[biome][shade].slice(),offset=(row*size+col)*4
      // A contiguous survey tint follows the same growth order as city sites.
      // Ocean and ice never become owned tiles, and terrain remains visible.
      if(t.land&&!t.ice&&frontier>=0) {
        const distance=settlementScore(world)-frontier
        if(distance<0) {
          const edge=distance>-.018,amount=edge?.5:.22
          const warm=edge?[224,165,46]:[150,104,63]
          for(let k=0;k<3;k++)rgb[k]=Math.round(rgb[k]*(1-amount)+warm[k]*amount)
        }
      }
      im.data[offset]=rgb[0];im.data[offset+1]=rgb[1];im.data[offset+2]=rgb[2];im.data[offset+3]=255
    }
    paint.putImageData(im,0,0)
  }
  ctx.imageSmoothingEnabled=false;ctx.drawImage(surface,Math.round(cx-r-1),Math.round(cy-r-1))
}
