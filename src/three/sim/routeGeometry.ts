/*
 * Copied from the rebuild (100m-devs-three/src/sim/routeGeometry.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/** Exact intersection with an open padded rectangle; touching its edge is allowed. */
export function crossesFurniture(a:{x:number;z:number},b:{x:number;z:number},
  rect:{x:number;z:number;w:number;d:number},pad=.25):boolean {
  let enter=0,exit=1
  for(const [origin,delta,centre,half] of [
    [a.x,b.x-a.x,rect.x,rect.w/2+pad],
    [a.z,b.z-a.z,rect.z,rect.d/2+pad],
  ]){
    if(delta===0){if(origin<=centre-half||origin>=centre+half)return false;continue}
    const t0=(centre-half-origin)/delta,t1=(centre+half-origin)/delta
    enter=Math.max(enter,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1))
    if(enter>=exit)return false
  }
  return enter<exit
}
