import * as T from 'three'
import { monitorText } from './monitorText.ts'
import { buildNetwork } from '../../sim/colonyNetwork.ts'
import { houseAddress, regionHouses, worldPopulation } from '../../sim/worldAddress.ts'
import type { PhosphorRamp } from '../../art/entropyTheme.ts'
import { RAMPS } from '../../art/palette.ts'
import { drawDistrict, drawGlobe, drawExpansionReceipt, type AtlasFrame, type Expansion } from './atlasWorlds.ts'
import { drawNetwork } from './atlasNetwork.ts'
import { bakeCityImpostors, type CityImpostors } from './cityImpostors.ts'

/** The OS draws the studio once the physical desks are too small to read.
 * Canvas is sampled nearest through three's glass; marks share one pixel grid.
 * The three views retain ranges, not copies of people, so a dive keeps identity.
 */
export function createStudioAtlas(host: HTMLElement, travel: (level: number, seat?: number) => void) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')!
  const texture = new T.CanvasTexture(canvas)
  texture.minFilter = texture.magFilter = T.NearestFilter
  texture.colorSpace = T.NoColorSpace
  const territory = document.createElement('canvas'), mask = territory.getContext('2d')!
  const net = buildNetwork(73)
  let world = 0, region = 0, level = 1, total = 0, width = 1, height = 1
  let yaw = -.5, tilt = .2, panX = 0, panY = 0, lastTotal = -1
  const expansions: Expansion[] = []
  let entryHouse = 0
  let chosen = -1, lastText = '', lastDraw = -1
  let points: { x: number; y: number; id: number; depth: number }[] = []
  const bar = document.createElement('nav'); bar.className = 'studio-address'; bar.setAttribute('aria-label', 'Studio address')
  Object.assign(bar.style, { position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', display: 'none', gap: '2px', zIndex: '4', maxWidth: '96%', background: '#181919', border: '1px solid currentColor', font: '12px var(--font-terminal), monospace' })
  const stops = [['Network', 6.3], ['World', 5], ['City', 3.6], ['HQ', 1]] as const
  const buttons = stops.map(([name, value]) => {
    const button = document.createElement('button'); button.textContent = name; button.type = 'button'
    Object.assign(button.style, { color: 'inherit', background: 'transparent', border: '0', padding: '9px 10px', font: 'inherit', cursor: 'pointer' })
    button.onclick = () => { chosen = -1; panX = panY = 0; if (value === 1) { world = region = entryHouse = 0; travel(value, -1) } else travel(value) }
    bar.append(button); return button
  })
  host.append(bar)
  const card = document.createElement('section'); card.className = 'studio-system'; card.setAttribute('aria-label', 'Selected system')
  Object.assign(card.style, { display: 'none', position: 'absolute', left: '50%', bottom: '130px', transform: 'translateX(-50%)', zIndex: '5', width: 'min(290px, 85%)', padding: '14px', border: '1px solid currentColor', background: '#181919', font: '13px var(--font-terminal), monospace', lineHeight: '1.6' })
  const text = document.createElement('div'), dive = document.createElement('button'), close = document.createElement('button')
  dive.textContent = 'Zoom in'; close.textContent = 'Close'
  for (const button of [dive, close]) { button.type = 'button'; Object.assign(button.style, { color: 'inherit', border: '1px solid currentColor', background: 'transparent', padding: '6px 12px', margin: '8px 8px 0 0', cursor: 'pointer' }) }
  close.onclick = () => { chosen = -1; card.style.display = 'none' }
  dive.onclick = () => { world = net.worldOf[chosen]; region = 0; chosen = -1; panX = panY = 0; travel(5) }
  card.append(text, dive, close); host.append(card)
  const scene = new T.Scene(), camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const target = new T.WebGLRenderTarget(1, 1)
  const shader = new T.ShaderMaterial({ uniforms: { near: { value: texture }, far: { value: texture }, wipe: { value: 0 }, grid: { value: new T.Vector2(1, 1) } },
    vertexShader: 'varying vec2 uv0; void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
    // Quantise the physical scene on the same pixel lattice as the map. The HUD
    // and interaction coordinates keep full resolution; this is a drawing treatment.
    fragmentShader: 'uniform sampler2D near; uniform sampler2D far; uniform float wipe; uniform vec2 grid; varying vec2 uv0; void main(){vec2 cell=floor(uv0*grid); vec2 uv=(cell+.5)/grid; vec4 room=texture2D(near,uv); float d=mod(cell.x+cell.y,2.)*.10; room.rgb=floor(pow(max(room.rgb,vec3(0.)),vec3(.94))*28.+d)/28.; float edge=1.-uv0.y; gl_FragColor=edge<wipe?texture2D(far,uv0):room;}' })
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), shader); scene.add(quad)
  let sprites: CityImpostors | null = null
  let wipe = 0
  const label = (s: string, x: number, y: number) => monitorText(ctx, s, x, y)
  return {
    get world() { return world },
    get entrySeat() { return houseAddress(world, entryHouse || regionHouses(region).first) },
    get active() { return level >= 3 },
    setLevel(value: number) { if ((value >= 6) !== (level >= 6) || (value >= 4.5) !== (level >= 4.5)) { panX = panY = 0; chosen = -1 } level = value },
    pan(dx: number, dy: number) { if (level >= 4.5 && level < 6) { yaw += dx * .008; tilt = Math.max(-1.2, Math.min(1.2, tilt + dy * .005)) } else { panX += dx / 3; panY += dy / 3 } },
    tap(x: number, y: number) {
      const nearest = points.reduce<typeof points[number] | null>((best, p) => !best || Math.hypot(p.x - x / 3, p.y - y / 3) < Math.hypot(best.x - x / 3, best.y - y / 3) ? p : best, null)
      if (!nearest || Math.hypot(nearest.x - x / 3, nearest.y - y / 3) > 14) return
      if (level >= 6) { chosen = nearest.id; lastText = '' }
      else if (level >= 4.5) { region = nearest.id; panX = panY = 0; travel(3.7) }
      else travel(1.6, houseAddress(world, nearest.id))
    },
    descend(x: number, y: number) {
      const nearest = points.reduce<typeof points[number] | null>((best, p) => !best || Math.hypot(p.x - x / 3, p.y - y / 3) < Math.hypot(best.x - x / 3, best.y - y / 3) ? p : best, null)
      const id = chosen >= 0 ? chosen : nearest && Math.hypot(nearest.x - x / 3, nearest.y - y / 3) < 35 ? nearest.id : -1
      if (level >= 6 && id >= 0 && worldPopulation(total, net.worldOf[id]) > 0) { world = net.worldOf[id]; region = entryHouse = 0; chosen = -1 }
      else if (level >= 4.5 && level < 6 && id >= 0) { region = id; entryHouse = 0 }
      else if (level < 4.5 && id >= 0) entryHouse = id
    },
    render(renderer: T.WebGLRenderer, near: T.Texture, w: number, h: number, n: number, p: PhosphorRamp, seconds: number, reduced: boolean) {
      const active = level >= 3
      bar.style.display = active ? 'flex' : 'none'; bar.style.color = p[2]; card.style.color = p[2]
      buttons.forEach((b, i) => { b.style.background = (i === 0 && level >= 6) || (i === 1 && level >= 4.5 && level < 6) || (i === 2 && level < 4.5) ? p[1] : 'transparent' })
      card.style.display = active && chosen >= 0 ? 'block' : 'none'
      if (chosen >= 0) {
        const s = net.systems[chosen], pop = worldPopulation(n, net.worldOf[chosen]), content = `${s.name}\n${s.ly} light-years · ${s.ly} years light-lag\n${pop.toLocaleString()} / 100,000,000 developers`
        if (content !== lastText) { text.innerText = content; lastText = content; dive.disabled = pop === 0 }
      }
      const dt = lastDraw < 0 ? 0 : Math.min(.1, seconds - lastDraw); lastDraw = seconds
      wipe = reduced ? Number(active) : Math.max(0, Math.min(1, wipe + (active ? 1 : -1) * dt * 3))
      if (lastTotal >= 0 && n > lastTotal) {
        const recent = expansions[expansions.length - 1]
        if (recent && seconds - recent.at < .2) recent.to = n
        else expansions.push({ from: lastTotal, to: n, at: seconds })
      }
      if (n < lastTotal) expansions.length = 0
      while (expansions.length > 6 || (expansions[0] && seconds - expansions[0].at > 3)) expansions.shift()
      lastTotal = total = n
      const nw = Math.max(1, Math.floor(w / 3)), nh = Math.max(1, Math.floor(h / 3))
      if (width !== nw || height !== nh) { width = canvas.width = territory.width = nw; height = canvas.height = territory.height = nh; target.setSize(w, h) }
      shader.uniforms.grid.value.set(Math.max(1, Math.floor(w / (w < 900 ? 2 : 3))), Math.max(1, Math.floor(h / (w < 900 ? 2 : 3))))
      if (active) {
      ctx.fillStyle = RAMPS.NEUTRAL[0]; ctx.fillRect(0, 0, width, height); ctx.font = '5px monospace'; ctx.lineWidth = 1
      points = []
      const frame: AtlasFrame = { ctx, width, height, total, world, region, level, panX, panY, seconds, reduced, phosphor: p, points, expansions }
      if (level >= 6) drawNetwork(frame, net, chosen, territory, mask)
      else if (level >= 4.5) drawGlobe(frame, yaw, tilt)
      else { sprites ??= bakeCityImpostors(renderer); drawDistrict(frame, sprites) }
      drawExpansionReceipt(frame)
      ctx.fillStyle = RAMPS.NEUTRAL[6]; ctx.textAlign = 'center'; label(`${world === 0 ? 'EARTH' : net.systems[net.order[world]]?.name.toUpperCase() ?? `WORLD ${world + 1}`} / ${level >= 6 ? 'NETWORK' : level >= 4.5 ? 'WORLD' : `DISTRICT ${region + 1}`}`, width / 2, 22); ctx.textAlign = 'left'
      texture.needsUpdate = true
      }
      shader.uniforms.near.value = near; shader.uniforms.wipe.value = wipe
      renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(null)
      return target.texture
    },
    dispose() { bar.remove(); card.remove(); texture.dispose(); shader.dispose(); quad.geometry.dispose(); target.dispose() },
  }
}
