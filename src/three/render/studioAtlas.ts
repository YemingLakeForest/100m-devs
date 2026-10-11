import { debugSearchParams } from '../../dev/debugAccess.ts'
import * as T from 'three'
import { bindMonitorText, monitorText } from './monitorText.ts'
import { buildNetwork } from '../../sim/colonyNetwork.ts'
import { houseAddress, regionHouses, regionPopulation, worldPopulation, cityName, globeCell, WORLD_REGIONS } from '../../sim/worldAddress.ts'
import type { PhosphorRamp } from '../../art/entropyTheme.ts'
import { RAMPS } from '../../art/palette.ts'
import { atlasCaption, districtCentreAt, drawDistrict, drawGlobe, drawExpansionReceipt, drawHqMark, globeCentreAt, globeRadiusAt, type AtlasFrame, type Expansion } from './atlasWorlds.ts'
import { BRIDGE_FROM, BRIDGE_TO, bridgeU, easeInOutSine, facing, flightCost, flightPose, lerpAngle, levelAtCost, project, smoothstep } from '../../sim/lensFlight.ts'
import { drawGarageGlyph, lampLit } from './garageGlyph.ts'
import { drawNetwork } from './atlasNetwork.ts'
import { hqWings, type HqWing } from '../../sim/hqLook.ts'
import { headcountToReach, maxLensLevelFor } from '../../sim/headcount.ts'
import { lockNote } from '../../sim/monitorVoice.ts'
import type { HeroId } from '../../sim/storyHeroes.ts'
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
  /*
   * The lettering layer: the map's labels at device resolution, in the terminal
   * face the address bar already uses (`monitorText`'s sink). It is composited in
   * the shader rather than over the glass so the CRT lines, the RGB split and the
   * bloom land on it like on everything else on the monitor, and it wipes in
   * with the picture it labels.
   */
  const words = document.createElement('canvas'), wctx = words.getContext('2d')!
  const wordsTexture = new T.CanvasTexture(words)
  wordsTexture.minFilter = wordsTexture.magFilter = T.NearestFilter
  wordsTexture.generateMipmaps = false
  wordsTexture.colorSpace = T.NoColorSpace
  const face = getComputedStyle(document.documentElement).getPropertyValue('--font-terminal').trim() || 'monospace'
  void document.fonts?.load(`20px ${face.split(',')[0]}`)
  /** CSS pixels per map pixel; the map's 4-pixel advance is a 0.6 em cell of this face. */
  let mapScale = 3
  bindMonitorText(ctx, {
    draw(text, x, y, colour, centred) {
      const left = Math.round(x - (centred ? text.length * 2 : 0))
      wctx.fillStyle = colour
      for (let i = 0; i < text.length; i += 1) {
        if (text[i] !== ' ') wctx.fillText(text[i], (left + i * 4 + 1.5) * mapScale, y * mapScale)
      }
    },
  })
  const territory = document.createElement('canvas'), mask = territory.getContext('2d')!
  const net = buildNetwork(73)
  const previewWorld=Number(debugSearchParams().get('surveyWorld')??0)
  let world = Number.isInteger(previewWorld)&&previewWorld>=0&&previewWorld<73?previewWorld:0, region = 0, level = 1, total = 0, width = 1, height = 1
  let yaw = -.12, tilt = .40, panX = 0, panY = 0, lastTotal = -1
  /*
   * **The picture's level is not the player's level** [2026-10-11; `sim/lensFlight.ts`]. `level` is where the
   * lens has been asked to be and everything that is *logic* — the address bar, the cards, what a tap means —
   * keeps reading it. `shown` is where the picture is, and it gets there on its own clock: a wheel notch moves
   * it a little and it follows at once (a scrub), and a jump — the address bar, the dive button — is a timed flight with an ease, because a jump that arrives on one frame is the cut this
   * replaces. Entering or leaving the monitor is the CRT wipe's business and never flies.
   * `?flight=off` turns all of it off (the cut, as before); `?flight=0.2` runs it at a fifth of the speed, for
   * looking at, and for the frames the review page in `docs/demos/ladder-jokes-2026-10-11/` is made of. Loopback only, like every seam in `dev/`.
   */
  let shown = level, flight: { from: number; to: number; t0: number; dur: number } | null = null
  let anchorPan = { x: 0, y: 0 }
  const flightParam = debugSearchParams().get('flight')
  const flightOff = flightParam === 'off'
  const flightSpeed = flightOff ? 1 : Math.max(0.02, Number(flightParam ?? 1) || 1)
  /** The two pictures of a flight, drawn separately and laid over each other: each draws with its own alphas. */
  const layerGlobe = document.createElement('canvas'), gctx = layerGlobe.getContext('2d')!
  const layerCity = document.createElement('canvas'), cctx = layerCity.getContext('2d')!
  const expansions: Expansion[] = []
  let entryHouse = 0
  let chosen = -1, lastText = '', lastDraw = -1
  let wings: HqWing[] = []
  let points: { x: number; y: number; id: number; depth: number }[] = []
  const bar = document.createElement('nav'); bar.className = 'studio-address'; bar.setAttribute('aria-label', 'Studio address')
  Object.assign(bar.style, { position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', display: 'none', gap: '2px', zIndex: '4', maxWidth: '96%', background: '#181919', border: '1px solid currentColor', font: '12px var(--font-terminal), monospace' })
  const stops = [['Network', 6.3], ['World', 5], ['City', 3.6], ['HQ', 1]] as const
  /** The lens ceiling is the headcount's (`stage.ts`'s `travel` clamps to the same table): a stop above it is locked. */
  const isLocked = (value: number) => value > maxLensLevelFor(total) + 1e-6
  const note = document.createElement('div'); note.setAttribute('role', 'status')
  Object.assign(note.style, { position: 'absolute', top: '46px', left: '50%', transform: 'translateX(-50%)', display: 'none', zIndex: '4', padding: '6px 10px', background: '#181919', border: '1px solid currentColor', font: '12px var(--font-terminal), monospace', whiteSpace: 'nowrap' })
  let noteTimer = 0
  const say = (message: string) => { note.textContent = message; note.style.display = 'block'; window.clearTimeout(noteTimer); noteTimer = window.setTimeout(() => { note.style.display = 'none' }, 3200) }
  const buttons = stops.map(([name, value]) => {
    const button = document.createElement('button'); button.textContent = name; button.type = 'button'
    Object.assign(button.style, { color: 'inherit', background: 'transparent', border: '0', padding: '9px 10px', font: 'inherit', cursor: 'pointer' })
    // [2026-10-11] A stop the headcount has not earned says what it costs, rather than doing nothing.
    button.onclick = () => { if (isLocked(value)) { say(lockNote(headcountToReach(value), total)); return } chosen = -1; panX = panY = 0; if (value === 1) { world = region = entryHouse = 0; travel(value, -1) } else travel(value) }
    bar.append(button); return button
  })
  const frontierButton=document.createElement('button');frontierButton.type='button';frontierButton.textContent='Frontier'
  Object.assign(frontierButton.style,{color:'inherit',background:'transparent',border:'0',padding:'9px 10px',font:'inherit',cursor:'pointer'})
  frontierButton.onclick=()=>{
    let id=0;while(id<WORLD_REGIONS-1&&regionPopulation(total,world,id+1)>0)id++
    if(!worldPopulation(total,world))return
    const [x,y,z]=globeCell(id,world);yaw=-Math.atan2(x,z);tilt=Math.asin(y);chosen=id;lastText=''
  }
  bar.append(frontierButton)
  host.append(bar, note)
  const card = document.createElement('section'); card.className = 'studio-system'; card.setAttribute('aria-label', 'Selected system')
  Object.assign(card.style, { display: 'none', position: 'absolute', left: '50%', bottom: '130px', transform: 'translateX(-50%)', zIndex: '5', width: 'min(290px, 85%)', padding: '14px', border: '1px solid currentColor', background: '#181919', font: '13px var(--font-terminal), monospace', lineHeight: '1.6' })
  const text = document.createElement('div'), dive = document.createElement('button'), close = document.createElement('button')
  dive.textContent = 'Zoom in'; close.textContent = 'Close'
  for (const button of [dive, close]) { button.type = 'button'; Object.assign(button.style, { color: 'inherit', border: '1px solid currentColor', background: 'transparent', padding: '6px 12px', margin: '8px 8px 0 0', cursor: 'pointer' }) }
  close.onclick = () => { chosen = -1; card.style.display = 'none' }
  dive.onclick = () => {
    if(level<6){region=chosen;entryHouse=0;chosen=-1;panX=panY=0;travel(3.7)}
    else {world=net.worldOf[chosen];region=entryHouse=0;chosen=-1;panX=panY=0;travel(5)}
  }
  card.append(text, dive, close); host.append(card)
  const scene = new T.Scene(), camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const target = new T.WebGLRenderTarget(1, 1)
  const shader = new T.ShaderMaterial({ uniforms: { near: { value: texture }, far: { value: texture }, words: { value: wordsTexture }, wipe: { value: 0 } },
    vertexShader: 'varying vec2 uv0; void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
    // Pixel character comes from geometry and stepped light, not downsampling
    // the whole picture. Fine edges and in-world typography retain native detail.
    fragmentShader: 'uniform sampler2D near; uniform sampler2D far; uniform sampler2D words; uniform float wipe; varying vec2 uv0; void main(){vec4 room=texture2D(near,uv0); room.rgb=floor(room.rgb*64.+.5)/64.; float edge=1.-uv0.y; float blend=smoothstep(edge-.08,edge+.08,wipe*1.16-.08); vec4 far0=texture2D(far,uv0); vec4 ink=texture2D(words,uv0); far0.rgb=mix(far0.rgb,ink.rgb,ink.a); gl_FragColor=mix(room,far0,blend);}' })
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), shader); scene.add(quad)
  let sprites: CityImpostors | null = null
  let wipe = 0
  const label = (s: string, x: number, y: number) => monitorText(ctx, s, x, y)

  /**
   * **The city becomes its planet** (`sim/lensFlight.ts` is the shape; this is the drawing).
   *
   * Both pictures are drawn into layers, quietly, then laid over each other with the alphas the flight gives
   * them, with the one thing that is the same at both scales on top: the HQ's garage glyph, held at the focus
   * the whole way, so the eye has something to stay on while a district falls into a hub's lights and a planet
   * comes up behind it. The planet is turned to face the city you came from (the Frontier button's own turn),
   * and the pin — where the focus is on screen — is carried from the district's centre to wherever the planet
   * puts it at rest, so the landing is exactly the plain globe and nothing pops.
   */
  function drawFlight(frame: AtlasFrame, u: number, cityKit: CityImpostors) {
    const pose = flightPose(u)
    const cell = globeCell(region, world), want = facing(cell)
    // Turned to the city by the time the planet is half there; handed back to the player's own turn only at the very end.
    const yawE = lerpAngle(yaw, want.yaw, pose.orient), tiltE = tilt + (want.tilt - tilt) * pose.orient
    const restOff = (() => { const q = project(cell, yaw, tilt), r = globeRadiusAt(width, height, BRIDGE_TO); return { x: q.x * r, y: -q.y * r } })()
    // Deep in the flight the planet *stays* facing the city, so the globe it lands as is the one the city belongs to.
    if (u < .5) { yaw = want.yaw; tilt = want.tilt }
    const base = globeRadiusAt(width, height, BRIDGE_TO), radius = base * pose.globeMul
    const natural = globeCentreAt(width, height), anchor = districtCentreAt(width, height, anchorPan.x, anchorPan.y)
    const q = project(cell, yawE, tiltE)
    const pin = {
      x: anchor.x + (natural.x + restOff.x - anchor.x) * pose.pin,
      y: anchor.y + (natural.y + restOff.y - anchor.y) * pose.pin,
    }
    const centre = { x: pin.x - q.x * radius, y: pin.y + q.y * radius }

    for (const [layer, g] of [[layerGlobe, gctx], [layerCity, cctx]] as const) {
      if (layer.width !== canvas.width || layer.height !== canvas.height) { layer.width = canvas.width; layer.height = canvas.height }
      g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, width, height); g.font = '5px monospace'; g.lineWidth = 1
    }
    const globeCaption = drawGlobe({ ...frame, ctx: gctx, level: BRIDGE_TO, points: [], view: { quiet: true, radius, rasterRadius: base, centre } }, yawE, tiltE, -1)
    const cityCaption = drawDistrict({ ...frame, ctx: cctx, level: BRIDGE_FROM, points: [], view: { quiet: true, zoom: pose.cityZoom, centre: pin } }, cityKit)

    ctx.save()
    ctx.globalAlpha = pose.globeAlpha; ctx.drawImage(layerGlobe, 0, 0, width, height)
    ctx.globalAlpha = pose.cityAlpha; ctx.drawImage(layerCity, 0, 0, width, height)
    ctx.restore()

    // The constant: the garage, held at the focus. The HQ's own box (the survey's mark for it) lets go first —
    // its label is lettering, which lives on its own layer and cannot fade, so the box goes without the word —
    // and the glyph slides from where the box held it to the pin, onto a small plate that goes as the planet's
    // own pin takes over.
    const hq = world === 0 && region === 0
    const lead = hq ? 1 - smoothstep(0, .3, u) : 0
    const pinX = Math.round(pin.x), pinY = Math.round(pin.y), ink = frame.phosphor[3]
    if (lead > 0) { ctx.save(); ctx.globalAlpha = lead; drawHqMark(frame, pin.x, pin.y, '  ', frame.phosphor[2]); ctx.restore() }
    const boxGlyphX = Math.round(pin.x - 12) + 7.5
    const gx = pin.x + (boxGlyphX - pin.x) * lead
    ctx.save(); ctx.globalAlpha = (1 - pose.pin) * (1 - lead); ctx.fillStyle = RAMPS.NEUTRAL[0]; ctx.fillRect(Math.round(gx) - 7, pinY - 5, 14, 10); ctx.restore()
    if (hq) drawGarageGlyph(ctx, gx, pin.y - lead, ink, lampLit(frame.seconds, frame.reduced))
    else { ctx.strokeStyle = ink; ctx.beginPath(); ctx.arc(pinX, pinY, 3, 0, Math.PI * 2); ctx.stroke() }

    // One caption, from whichever picture is the larger half of the flight; two would be noise.
    const caption = u < .5 ? cityCaption : globeCaption
    if (caption) atlasCaption(frame, caption.title, caption.detail)
  }

  return {
    get world() { return world },
    get entrySeat() { return houseAddress(world, entryHouse || regionHouses(region).first) },
    get active() { return level >= 3 },
    /** Who has walked in: the colours the HQ wears on the map (`sim/hqLook.ts`). */
    setHeroes(ids: Iterable<HeroId>) { wings = hqWings(ids) },
    setLevel(value: number) {
      if ((value >= 6) !== (level >= 6) || (value >= 4.5) !== (level >= 4.5)) {
        // The district keeps the place it was panned to while it flies away: the register's own pan resets, the flight's anchor does not.
        anchorPan = value >= 4.5 ? { x: panX, y: panY } : { x: 0, y: 0 }
        panX = panY = 0; chosen = -1
      }
      const inMonitor = level >= 3 && value >= 3
      if (!inMonitor) { shown = value; flight = null }
      else if (!flightOff && Math.abs(value - level) > 0.6) flight = { from: shown, to: value, t0: Number.NaN, dur: (0.5 + 0.35 * Math.abs(flightCost(value) - flightCost(shown))) / flightSpeed }
      else if (flight) flight.to = value
      level = value
    },
    pan(dx: number, dy: number) { if (level >= 4.5 && level < 6) { yaw += dx * .008; tilt = Math.max(-1.2, Math.min(1.2, tilt + dy * .005)) } else { panX += dx / 3; panY += dy / 3 } },
    tap(x: number, y: number) {
      const nearest = points.reduce<typeof points[number] | null>((best, p) => !best || Math.hypot(p.x - x / 3, p.y - y / 3) < Math.hypot(best.x - x / 3, best.y - y / 3) ? p : best, null)
      if (!nearest || Math.hypot(nearest.x - x / 3, nearest.y - y / 3) > 14) return
      if (level >= 6) { chosen = nearest.id; lastText = '' }
      else if (level >= 4.5) { chosen = nearest.id; lastText = '' }
      else travel(1.6, houseAddress(world, nearest.id))
    },
    /**
     * Pick the city a pull-in is heading for, at the top of the flight rather than at the bottom of it: the flight
     * to the city has to know where it is going on its first frame, or it re-aims on its last. `descend` still
     * does this for the other two crossings; this is its globe branch, on its own.
     */
    aim(x: number, y: number) {
      const nearest = points.reduce<typeof points[number] | null>((best, p) => !best || Math.hypot(p.x - x / 3, p.y - y / 3) < Math.hypot(best.x - x / 3, best.y - y / 3) ? p : best, null)
      const id = chosen >= 0 ? chosen : nearest && Math.hypot(nearest.x - x / 3, nearest.y - y / 3) < 35 ? nearest.id : -1
      if (level >= 4.5 && level < 6 && id >= 0) { region = id; entryHouse = 0 }
    },
    descend(x: number, y: number) {
      const nearest = points.reduce<typeof points[number] | null>((best, p) => !best || Math.hypot(p.x - x / 3, p.y - y / 3) < Math.hypot(best.x - x / 3, best.y - y / 3) ? p : best, null)
      const id = chosen >= 0 ? chosen : nearest && Math.hypot(nearest.x - x / 3, nearest.y - y / 3) < 35 ? nearest.id : -1
      if (level >= 6 && id >= 0 && worldPopulation(total, net.worldOf[id]) > 0) { world = net.worldOf[id]; region = entryHouse = 0; chosen = -1 }
      else if (level >= 4.5 && level < 6 && id >= 0) { region = id; entryHouse = 0 }
      else if (level < 4.5 && id >= 0) entryHouse = id
    },
    render(renderer: T.WebGLRenderer, near: T.Texture, w: number, h: number, n: number, p: PhosphorRamp, seconds: number, reduced: boolean, done: number | null = null) {
      const active = level >= 3
      frontierButton.style.display=level>=4.5&&level<6?'block':'none'
      bar.style.display = active ? 'flex' : 'none'; bar.style.color = p[2]; card.style.color = p[2]
      buttons.forEach((b, i) => {
        b.style.background = (i === 0 && level >= 6) || (i === 1 && level >= 4.5 && level < 6) || (i === 2 && level < 4.5) ? p[1] : 'transparent'
        const locked = isLocked(stops[i][1]); b.style.opacity = locked ? '.4' : '1'; b.style.cursor = locked ? 'not-allowed' : 'pointer'; b.setAttribute('aria-disabled', String(locked))
      })
      note.style.color = p[2]; if (!active) note.style.display = 'none'
      card.style.display = active && chosen >= 0 ? 'block' : 'none'
      if (chosen >= 0 && level >= 6) {
        card.setAttribute('aria-label','Selected system'); dive.textContent='Enter world'
        const s = net.systems[chosen], pop = worldPopulation(n, net.worldOf[chosen]), content = `${s.name}\n${s.ly} light-years · ${s.ly} years light-lag\n${pop.toLocaleString()} / 100,000,000 developers`
        if (content !== lastText) { text.innerText = content; lastText = content; dive.disabled = pop === 0 }
      }
      if(chosen>=0&&level>=4.5&&level<6) {
        const r=regionHouses(chosen),pop=regionPopulation(n,world,chosen)
        const content=cityName(chosen,world)+'\n'+pop.toLocaleString()+' / '+((r.end-r.first)*100).toLocaleString()+' developers\n'+Math.ceil(pop/100)+' offices · '+(pop/((r.end-r.first)*100)*100).toFixed(1)+'% settled'
        card.setAttribute('aria-label','Selected city'); dive.textContent='Enter city'
        if(content!==lastText){text.innerText=content;lastText=content;dive.disabled=pop===0}
      }
      card.style.bottom=h<500?'72px':'130px'
      const dt = lastDraw < 0 ? 0 : Math.min(.1, seconds - lastDraw); lastDraw = seconds
      if (!active || reduced || flightOff) { shown = level; flight = null }
      else if (flight) {
        if (Number.isNaN(flight.t0)) flight.t0 = seconds
        const t = Math.min(1, (seconds - flight.t0) / flight.dur)
        // Tween the *cost* of the way, not the level: the flight is brisk to the bridge band and dwells in it (`flightCost`).
        const from = flightCost(flight.from), to = flightCost(flight.to)
        shown = levelAtCost(from + (to - from) * easeInOutSine(t))
        if (t >= 1) { shown = flight.to; flight = null }
      } else {
        shown += (level - shown) * (1 - Math.exp(-14 * dt))
        if (Math.abs(level - shown) < .003) shown = level
      }
      /** How far along the city-to-planet flight the *picture* is. With the flight off, the old cut at the planet's register. */
      const u = flightOff ? (shown >= BRIDGE_FROM ? 1 : 0) : bridgeU(shown)
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
      if (width !== nw || height !== nh) { width = territory.width = nw; height = territory.height = nh; canvas.width = nw * 2; canvas.height = nh * 2; ctx.setTransform(2, 0, 0, 2, 0, 0); target.setSize(Math.round(w * renderer.getPixelRatio()), Math.round(h * renderer.getPixelRatio())) }
      // The lettering layer follows the output's own pixels, one for one, and is
      // redrawn with the map: resizing a canvas resets its state, so the face is set here.
      const dpr = renderer.getPixelRatio(), pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr))
      if (words.width !== pw || words.height !== ph) { words.width = pw; words.height = ph }
      if (active) {
      wctx.setTransform(dpr, 0, 0, dpr, 0, 0); wctx.clearRect(0, 0, w, h)
      mapScale = w / Math.max(1, width)
      wctx.font = `${(mapScale * 4 / 0.6).toFixed(2)}px ${face}`; wctx.textAlign = 'center'; wctx.textBaseline = 'alphabetic'
      ctx.fillStyle = RAMPS.NEUTRAL[0]; ctx.fillRect(0, 0, width, height); ctx.font = '5px monospace'; ctx.lineWidth = 1
      // Quiet terminal furniture frames the survey, rather than recolouring
      // the buildings. The corners and prompt connect it to the studio OS.
      const left=Math.round(width*.19),right=Math.round(width*.81),top=27,bottom=Math.round(height*.78)
      ctx.strokeStyle=RAMPS.NEUTRAL[2];ctx.lineWidth=1
      for(const x of [left,right])for(const y of [top,bottom]) {
        const sx=x===left?1:-1,sy=y===top?1:-1
        ctx.beginPath();ctx.moveTo(x+sx*7,y);ctx.lineTo(x,y);ctx.lineTo(x,y+sy*5);ctx.stroke()
      }
      if(height>=160){ctx.fillStyle=p[1];label('STUDIO_OS / LIVE SURVEY',left+2,top+9)}
      points = []
      const frame: AtlasFrame = { ctx, width, height, total, world, region, level: shown, panX, panY, seconds, reduced, phosphor: p, points, expansions, wings, done }
      if (shown >= 6) drawNetwork(frame, net, chosen, territory, mask)
      else if (u >= 1) drawGlobe(frame, yaw, tilt, chosen)
      else if (u <= 0) { sprites ??= bakeCityImpostors(renderer); drawDistrict(frame, sprites) }
      else { sprites ??= bakeCityImpostors(renderer); drawFlight(frame, u, sprites) }
      drawExpansionReceipt(frame)
      ctx.fillStyle = RAMPS.NEUTRAL[6]; ctx.textAlign = 'center'; label(`${world === 0 ? 'EARTH' : net.systems[net.order[world]]?.name.toUpperCase() ?? `WORLD ${world + 1}`} / ${shown >= 6 ? 'NETWORK' : u >= .5 ? 'COLONISATION' : cityName(region,world).toUpperCase()}`, width / 2, 22); ctx.textAlign = 'left'
      texture.needsUpdate = true; wordsTexture.needsUpdate = true
      }
      shader.uniforms.near.value = near; shader.uniforms.wipe.value = wipe
      renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(null)
      return target.texture
    },
    dispose() { bindMonitorText(ctx, null); layerGlobe.width = layerCity.width = 0; window.clearTimeout(noteTimer); bar.remove(); note.remove(); card.remove(); texture.dispose(); wordsTexture.dispose(); shader.dispose(); quad.geometry.dispose(); target.dispose() },
  }
}
