import fontUrl from '../../../../../src/assets/fonts/DepartureMono-Regular.woff2'
import { HEX } from './palette.ts'

/**
 * The demo's HUD, in the game's own interface language (ART_DIRECTION §3,
 * §10.6a): one face, integer multiples of 11 px, 1 px rules, skewed slabs with a
 * hard offset, and the live phosphor ramp (--p0..--p3) that follows the studio's
 * entropy — calm cyan in the garage, amber past a few thousand, red when a
 * hundred million people are mostly in meetings (§1.1).
 */
export interface CardInfo {
  title: string
  kicker: string
  lines: string[]
  state?: { label: string; colour: string; cause: string }
  actions: { id: string; label: string }[]
}

export type Action = string

/** One stop on the monitor's address bar: NETWORK > EARTH > CITY > HQ > GARAGE. */
export interface Crumb { id: string; label: string; active: boolean }
/** One row of the map's legend: a mask image drawn in one of the ramp's values. */
export interface LegendRow { mask: string; w: number; h: number; tone: 'p1' | 'p2' | 'p3'; label: string }

export interface Hud {
  root: HTMLElement
  setDevs(n: number): void
  setStats(rows: [string, string][]): void
  setWhere(title: string, lines: string[], scale: string): void
  log(line: string): void
  card(info: CardInfo | null): void
  entropy(e: number): void
  monitor(t: number, info: { crumbs: Crumb[]; right: string }): void
  /** The scale bar under the where panel: `px` long, standing for `label`. */
  scaleBar(px: number, label: string): void
  legend(rows: LegendRow[] | null): void
  hint(text: string): void
  lift(rungs: { id: string; label: string; active: boolean; open: boolean }[] | null): void
  setAuto(label: string): void
  showLaunch(on: boolean): void
  on(cb: (a: Action) => void): void
}

const CSS = /* css */ `
@font-face { font-family: 'Departure Mono'; src: url(${JSON.stringify(fontUrl)}) format('woff2'); font-display: block; }
:root {
  --p0: ${HEX.calm[0]}; --p1: ${HEX.calm[1]}; --p2: ${HEX.calm[2]}; --p3: ${HEX.calm[3]};
  --n0: ${HEX.night}; --n1: ${HEX.n1}; --ink: ${HEX.n7};
  --edge: 14px;
  color-scheme: dark;
}
html, body { margin: 0; height: 100%; background: var(--n0); overflow: hidden; }
body { font-family: 'Departure Mono', ui-monospace, monospace; font-size: 11px; color: var(--ink); -webkit-font-smoothing: none; }
#stage { position: fixed; inset: 0; }
.hud { position: fixed; inset: 0; pointer-events: none; }
.hud * { box-sizing: border-box; }
.panel { background: rgba(20, 18, 26, 0.78); border: 1px solid var(--p1); padding: 8px 10px; }
.lbl { color: var(--p2); letter-spacing: 1px; text-transform: uppercase; }
.dim { color: var(--p1); }
.big { font-size: 22px; color: var(--p3); line-height: 1; font-variant-numeric: tabular-nums; }
.rail { position: absolute; top: calc(var(--edge) + var(--frame, 0px)); display: grid; gap: 6px; width: 212px; transition: top 120ms; }
.rail.l { left: var(--edge); }
.rail.r { right: var(--edge); justify-items: end; }
.rail.r .panel { width: 100%; }
.where .t { color: var(--p3); letter-spacing: 1px; margin-bottom: 4px; }
.where .line { color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.where .line::before { content: '> '; color: var(--p1); }
.where .scale { margin-top: 6px; color: var(--p2); border-top: 1px solid var(--p0); padding-top: 5px; }
.stats { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; margin-top: 6px; }
.stats span:nth-child(odd) { color: var(--p2); letter-spacing: 1px; }
.stats span:nth-child(even) { text-align: right; font-variant-numeric: tabular-nums; }
.tabs { position: absolute; top: calc(var(--edge) + var(--frame, 0px)); left: 50%; transform: translateX(-50%); display: flex; gap: 6px; pointer-events: auto; }
.tab { font: inherit; font-size: 11px; letter-spacing: 1px; color: var(--p2); background: rgba(20,18,26,.8); border: 1px solid var(--p1); padding: 5px 8px; cursor: pointer; }
.tab[aria-current="true"] { color: var(--n0); background: var(--p2); border-color: var(--p3); }
.tab.back { text-decoration: none; color: var(--p1); }
.dock { position: absolute; bottom: var(--edge); display: flex; flex-wrap: wrap; gap: 7px; align-items: flex-end; pointer-events: auto; }
.dock.l { left: var(--edge); max-width: 40vw; }
.dock.r { right: var(--edge); justify-content: flex-end; max-width: 46vw; }
.btn { font: inherit; font-size: 11px; letter-spacing: 1px; color: var(--n0); background: var(--p2); border: 1px solid var(--p3);
  padding: 7px 10px; cursor: pointer; transform: skewX(-4deg); box-shadow: 3px 3px 0 0 var(--p0); transition: transform 70ms, box-shadow 70ms; }
.btn > span { display: inline-block; transform: skewX(4deg); }
.btn:active { transform: skewX(-4deg) translate(2px, 2px); box-shadow: 1px 1px 0 0 var(--p0); }
.btn.ghost { color: var(--p2); background: rgba(20,18,26,.85); border-color: var(--p1); }
.btn.big2 { font-size: 22px; padding: 8px 14px; }
.btn:focus-visible, .tab:focus-visible { outline: 1px solid var(--p3); outline-offset: 2px; }
.presets { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; width: 100%; }
.presets .btn { padding: 4px 6px; box-shadow: 2px 2px 0 0 var(--p0); }
.head { width: 44px; height: 52px; display: grid; place-items: end center; padding-bottom: 3px; background: rgba(20,18,26,.85); border: 1px solid var(--p1); cursor: pointer; font: inherit; font-size: 11px; color: var(--p2); letter-spacing: 1px; position: relative; }
.head i { position: absolute; top: 6px; left: 50%; width: 22px; height: 22px; transform: translateX(-50%); image-rendering: pixelated; background-size: 100% 100%; }
.console { position: absolute; bottom: var(--edge); left: 50%; transform: translateX(-50%); width: min(420px, 34vw); pointer-events: none; }
.console .panel { padding: 6px 9px; }
.console p { margin: 0; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
.console p:last-child { color: var(--p3); }
.console p::before { content: '$ '; color: var(--p1); }
.card { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(340px, 86vw); pointer-events: auto; border: 1px solid var(--p2); background: rgba(20,18,26,.94); }
.card .bar { display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; border-bottom: 1px solid var(--p1); letter-spacing: 1px; color: var(--p1); }
.card .bar b { color: var(--p3); font-weight: normal; }
.card .body { padding: 10px; display: grid; gap: 5px; }
.card h2 { margin: 0; font-size: 22px; font-weight: normal; color: var(--p3); }
.card .kick { color: var(--p2); letter-spacing: 1px; }
.card .state { display: flex; gap: 8px; align-items: baseline; border-top: 1px solid var(--p0); padding-top: 6px; margin-top: 2px; }
.card .state i { width: 10px; height: 10px; flex: none; transform: translateY(1px); }
.card .acts { display: flex; gap: 8px; justify-content: flex-end; padding: 0 10px 10px; }
.frame { position: absolute; inset: 6px; border: 1px solid var(--p2); pointer-events: none; opacity: 0; }
.frame .fbar { position: absolute; left: 0; right: 0; top: 0; height: 20px; border-bottom: 1px solid var(--p1); background: rgba(20,18,26,.9); display: flex; align-items: center; padding: 0 8px; letter-spacing: 1px; color: var(--p1); gap: 6px; white-space: nowrap; overflow: hidden; }
.frame .fbar em { margin-left: auto; font-style: normal; color: var(--p2); overflow: hidden; text-overflow: ellipsis; }
/* The address bar: every stop of the zoom is a place you can go to (§7.4a). */
.crumbs { display: flex; align-items: center; }
.crumbs button { font: inherit; font-size: 11px; letter-spacing: 1px; color: var(--p1); background: none; border: 0; padding: 1px 4px; cursor: pointer; pointer-events: auto; }
.crumbs button + button::before { content: '> '; color: var(--p1); }
.crumbs button:hover { color: var(--p3); }
.crumbs button[aria-current="true"] { color: var(--p3); background: rgba(255,255,255,.06); outline: 1px solid var(--p1); }
.frame[data-live="false"] .crumbs button { pointer-events: none; }
.where .sbar { display: flex; align-items: flex-end; gap: 6px; margin-top: 6px; color: var(--p2); }
.where .sbar i { display: block; height: 6px; border: 1px solid var(--p2); border-top: 0; flex: none; }
.legend { display: grid; grid-template-columns: 22px 1fr; gap: 4px 6px; align-items: center; }
.legend[hidden] { display: none; }
.legend .lbl { grid-column: 1 / -1; margin-bottom: 2px; }
.legend i { justify-self: center; -webkit-mask: var(--m) center / auto no-repeat; mask: var(--m) center / auto no-repeat; }
.legend span { color: var(--ink); }
.lift { position: absolute; right: var(--edge); top: 50%; transform: translateY(-50%); display: grid; gap: 4px; pointer-events: auto; }
.lift .rung { font: inherit; font-size: 11px; letter-spacing: 1px; text-align: right; background: rgba(20,18,26,.85); border: 1px solid var(--p0); color: var(--p1); padding: 5px 8px; cursor: pointer; }
.lift .rung[data-open="true"] { color: var(--p2); border-color: var(--p1); }
.lift .rung[aria-current="true"] { color: var(--n0); background: var(--p2); border-color: var(--p3); }
.hint { position: absolute; left: 50%; bottom: 78px; transform: translateX(-50%); color: var(--p1); letter-spacing: 1px; white-space: nowrap; }
@media (max-width: 760px), (max-height: 420px) {
  /* A phone on its side: the picture first. One line of stats, letters for
     the options, and the controls that matter within a thumb's reach. */
  :root { --edge: 8px; }
  .rail { width: 150px; gap: 4px; }
  /* Ten billion is fourteen characters at 22 px: the count's panel grows to it. */
  .rail.r { width: auto; min-width: 150px; }
  .panel { padding: 5px 7px; }
  .console, .hint, .legend, .where .sbar, [data-a="hire10"], [data-a="loss"] { display: none; }
  .fzoom { display: none; }
  .stats span:nth-child(n+3) { display: none; }
  .where .line:nth-child(n+2) { display: none; }
  .tabs { gap: 3px; }
  .tab { padding: 3px 6px; font-size: 0; }
  .tab::first-letter { font-size: 11px; }
  .dock.l { max-width: 46vw; gap: 5px; }
  .dock.r { max-width: 52vw; gap: 5px; }
  .btn { padding: 5px 7px; }
  .presets .btn { padding: 3px 4px; }
  .head { width: 38px; height: 44px; }
}
`

const MODE_TABS: [string, string][] = [['monitor', 'A MONITOR'], ['planet', 'B LITTLE PLANET'], ['swarm', 'C SWARM'], ['dioramas', 'D DIORAMAS']]
const PRESETS: [string, number][] = [['1', 1], ['20', 20], ['200', 200], ['1K', 1e3], ['10K', 1e4], ['100K', 1e5], ['1M', 1e6], ['10M', 1e7], ['100M', 1e8], ['1B', 1e9], ['10B', 1e10]]

export function createHud(mode: string, title: string): Hud {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)
  const root = document.createElement('div')
  root.className = 'hud'
  root.innerHTML = `
    <div class="frame" data-live="false"><div class="fbar"><span>STUDIO_OS //</span><nav class="crumbs" aria-label="Address"></nav><em class="fzoom"></em></div></div>
    <div class="rail l">
      <div class="panel where"><div class="t"></div><div class="lines"></div><div class="scale"></div><div class="sbar"><i></i><span></span></div></div>
      <div class="panel legend" hidden></div>
    </div>
    <div class="rail r">
      <div class="panel"><div class="lbl">Developers</div><div class="big devs">0</div><div class="stats"></div></div>
    </div>
    <nav class="tabs" aria-label="Options"><a class="tab back" href="./" data-a="back" title="Back to the options">&lt; BRIEF</a>${MODE_TABS.map(([id, label]) =>
      `<button class="tab" data-a="mode:${id}" aria-current="${id === mode}">${label}</button>`).join('')}</nav>
    <div class="dock l">
      <button class="head" data-a="home" title="Fly to your desk"><i class="face-you"></i>YOU</button>
      <button class="head" data-a="james" title="Fly to James"><i class="face-james"></i>JAMES</button>
      <button class="btn ghost" data-a="find"><span>[ FIND ANYONE ]</span></button>
      <button class="btn ghost" data-a="loss"><span>[ LOSS VIEW ]</span></button>
    </div>
    <div class="dock r">
      <button class="btn launch" data-a="launch" hidden><span>[ LAUNCH JAMES ]</span></button>
      <button class="btn ghost" data-a="colonise" title="Frame the planet and hire at a watchable pace"><span>[ COLONISE ]</span></button>
      <button class="btn" data-a="hire1"><span>[ HIRE ]</span></button>
      <button class="btn" data-a="hire10"><span>[ +10 ]</span></button>
      <button class="btn" data-a="x2"><span>[ x2 ]</span></button>
      <button class="btn auto" data-a="auto"><span>[ AUTO ]</span></button>
      <div class="presets">${PRESETS.map(([l, n]) => `<button class="btn ghost" data-a="preset:${n}"><span>${l}</span></button>`).join('')}</div>
    </div>
    <div class="console"><div class="panel"></div></div>
    <div class="hint">SCROLL / PINCH TO ZOOM &middot; DRAG TO MOVE &middot; RIGHT-DRAG TO TURN &middot; TAP ANYONE</div>
    <div class="lift" hidden></div>
    <section class="card" hidden aria-live="polite"></section>`
  document.body.appendChild(root)
  const q = <E extends Element>(s: string) => root.querySelector(s) as E
  q<HTMLElement>('.face-you').style.backgroundImage = `url(${pixelFace('you')})`
  q<HTMLElement>('.face-james').style.backgroundImage = `url(${pixelFace('james')})`
  q<HTMLElement>('.where .t').textContent = title
  const cbs: ((a: Action) => void)[] = []
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null
    if (b) { e.preventDefault(); e.stopPropagation(); for (const cb of cbs) cb(b.dataset.a!) }
  })
  for (const ev of ['pointerdown', 'wheel', 'pointerup'] as const) {
    root.addEventListener(ev, (e) => { if ((e.target as HTMLElement).closest('[data-a], .card')) e.stopPropagation() })
  }
  const lines: string[] = []
  let crumbKey = ''
  let legendKey = ''
  const phosphor = [HEX.calm, HEX.warn, HEX.alarm]
  const mixHex = (a: string, b: string, t: number) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
    const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t)
    return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`
  }
  const hud: Hud = {
    root,
    setDevs(n) { q<HTMLElement>('.devs').textContent = Math.floor(n).toLocaleString('en-US') },
    setStats(rows) {
      q<HTMLElement>('.stats').innerHTML = rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')
    },
    setWhere(t, ls, scale) {
      q<HTMLElement>('.where .t').textContent = t
      q<HTMLElement>('.where .lines').innerHTML = ls.map((l) => `<div class="line">${l}</div>`).join('')
      q<HTMLElement>('.where .scale').textContent = scale
    },
    log(line) {
      lines.push(line)
      while (lines.length > 3) lines.shift()
      q<HTMLElement>('.console .panel').innerHTML = lines.map((l) => `<p>${l}</p>`).join('')
    },
    card(info) {
      const el = q<HTMLElement>('.card')
      if (!info) { el.hidden = true; return }
      el.hidden = false
      el.innerHTML = `<div class="bar"><span>STUDIO_OS // <b>${info.kicker}</b></span><button class="btn ghost" data-a="close"><span>X</span></button></div>
        <div class="body"><h2>${info.title}</h2>${info.lines.map((l) => `<div class="kick">${l}</div>`).join('')}
        ${info.state ? `<div class="state"><i style="background:${info.state.colour}"></i><div><div>${info.state.label}</div><div class="dim">${info.state.cause}</div></div></div>` : ''}</div>
        <div class="acts">${info.actions.map((a) => `<button class="btn" data-a="${a.id}"><span>[ ${a.label} ]</span></button>`).join('')}</div>`
    },
    entropy(e) {
      // Calm to warn to alarm, one ramp at a time (§1.1).
      const seg = e < 0.5 ? 0 : 1
      const t = e < 0.5 ? e / 0.5 : (e - 0.5) / 0.5
      const a = phosphor[seg], b = phosphor[seg + 1]
      for (let i = 0; i < 4; i++) document.documentElement.style.setProperty(`--p${i}`, mixHex(a[i], b[i], t))
    },
    monitor(t, info) {
      const f = q<HTMLElement>('.frame')
      f.style.opacity = String(t)
      f.style.inset = `${6 + (1 - t) * 30}px`
      f.dataset.live = String(t > 0.6)
      root.style.setProperty('--frame', `${Math.round(22 * t)}px`)
      const key = info.crumbs.map((c) => `${c.id}:${c.label}:${c.active}`).join('|')
      if (key !== crumbKey) {
        crumbKey = key
        q<HTMLElement>('.crumbs').innerHTML = info.crumbs.map((c) => `<button data-a="goto:${c.id}" aria-current="${c.active}">${c.label}</button>`).join('')
      }
      const right = q<HTMLElement>('.fzoom')
      if (right.textContent !== info.right) right.textContent = info.right
    },
    scaleBar(px, label) {
      q<HTMLElement>('.where .sbar i').style.width = `${Math.round(px)}px`
      const s = q<HTMLElement>('.where .sbar span')
      if (s.textContent !== label) s.textContent = label
    },
    legend(rows) {
      const el = q<HTMLElement>('.legend')
      el.hidden = !rows
      if (!rows) return
      const key = rows.map((r) => r.label).join('|')
      if (key === legendKey) return
      legendKey = key
      el.innerHTML = '<div class="lbl">Legend</div>' + rows.map((r) =>
        `<i style="--m:url(${r.mask});width:${r.w}px;height:${r.h}px;background:var(--${r.tone})"></i><span>${r.label}</span>`).join('')
    },
    hint(text) {
      const el = q<HTMLElement>('.hint')
      if (el.textContent !== text) el.textContent = text
    },
    lift(rungs) {
      const el = q<HTMLElement>('.lift')
      if (!rungs) { el.hidden = true; return }
      el.hidden = false
      el.innerHTML = rungs.map((r) => `<button class="rung" data-a="rung:${r.id}" data-open="${r.open}" aria-current="${r.active}">${r.label}</button>`).join('')
    },
    setAuto(label) { q<HTMLElement>('.auto span').textContent = `[ ${label} ]` },
    showLaunch(on) { q<HTMLElement>('.launch').hidden = !on },
    on(cb) { cbs.push(cb) },
  }
  return hud
}

/**
 * The two heads on the dock, drawn pixel by pixel in the palette (ART_DIRECTION
 * §3.1: procedural pixel icons, never an emoji): the founder, and James with
 * his orange hair, beard and thick glasses (§21.7.0).
 */
function pixelFace(who: 'you' | 'james'): string {
  const c = document.createElement('canvas')
  c.width = 11; c.height = 11
  const g = c.getContext('2d')!
  const px = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h) }
  const skin = who === 'james' ? HEX.skin[0] : HEX.skin[1]
  const hair = who === 'james' ? '#cf792f' : HEX.wood[0]
  px(2, 2, 7, 8, skin)
  px(1, 1, 9, 3, hair)
  px(1, 4, 1, 2, hair); px(9, 4, 1, 2, hair)
  px(3, 5, 2, 1, HEX.night); px(6, 5, 2, 1, HEX.night)
  if (who === 'james') {
    // Thick glasses: two rims and a bridge, over the eyes.
    px(2, 4, 3, 1, HEX.night); px(6, 4, 3, 1, HEX.night); px(2, 6, 3, 1, HEX.night); px(6, 6, 3, 1, HEX.night)
    px(2, 4, 1, 3, HEX.night); px(4, 4, 1, 3, HEX.night); px(6, 4, 1, 3, HEX.night); px(8, 4, 1, 3, HEX.night); px(5, 5, 1, 1, HEX.night)
    px(2, 7, 7, 3, hair); px(4, 8, 3, 1, HEX.skin[3])
  } else {
    px(4, 8, 3, 1, HEX.skin[4])
  }
  return c.toDataURL()
}

/** 12,345 -> "12.3K"; the HUD's short numbers. */
export function short(n: number): string {
  if (n < 1000) return String(Math.floor(n))
  const units = ['K', 'M', 'B', 'T']
  let u = -1
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++ }
  return `${n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)}${units[u]}`
}

/** Metres, as a view width: "38 M", "2.4 KM". */
export function metres(m: number): string {
  if (m < 1000) return `${Math.round(m)} M`
  if (m < 1e7) return `${(m / 1000).toFixed(m < 1e4 ? 1 : 0)} KM`
  return `${short(m / 1000)} KM`
}
