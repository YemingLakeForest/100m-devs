import { describe,it,expect } from 'vitest'
import { planetKind } from './colonyTerrain.ts'
import { terrainAt,planetHubs,direction,settlementLayout } from './planetTerrain.ts'
import { globeCell,cityName,WORLD_REGIONS } from './worldAddress.ts'

describe('colonies retain their own geography',()=>{
  it('assigns each surface family and keeps Earth exclusive to home',()=>{
    expect(Array.from({length:5},(_,i)=>planetKind(i))).toEqual(['earth','rock','desert','ocean','ice'])
    for(let world=1;world<100;world++)expect(planetKind(world)).not.toBe('earth')
  })
  it('keeps all addresses on their own terrain, stable across revisits',()=>{
    for(let world=1;world<=8;world++) {
      const sites=settlementLayout(WORLD_REGIONS,world)
      expect(sites).toHaveLength(WORLD_REGIONS)
      expect(new Set(sites.map(s=>s.point.join(','))).size).toBe(WORLD_REGIONS)
      for(const {point} of sites){expect(terrainAt(point,world).land).toBe(true);expect(Math.hypot(...point)).toBeCloseTo(1)}
      expect(globeCell(400,world)).toEqual(sites[400].point)
      expect(cityName(0,world)).toContain('First Landing')
      expect(planetHubs(world).some(h=>h[0]==='London')).toBe(false)
    }
    expect(globeCell(400,1)).toEqual(settlementLayout(WORLD_REGIONS,1)[400].point)
  })
  it('changes geography within a family, not merely the colour',()=>{
    const samples=Array.from({length:60},(_,i)=>direction(i*137.5,i*2-60))
    for(let world=1;world<=4;world++) {
      const signature=(w:number)=>samples.map(p=>terrainAt(p,w).relief)
      expect(signature(world)).not.toEqual(signature(world+4))
    }
  })
})
