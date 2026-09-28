/**
 * Pointer, wheel and keys, reduced to five verbs. A tap is a press that did not
 * travel past the slop (§7.7.6: "a poke that pans loses the clicker layer, and a
 * pan that pokes means every attempt to look around costs the player"); there
 * is no timer anywhere in it (§7.7.6b).
 */
export interface Controls {
  zoom(factor: number, x: number, y: number): void
  pan(dx: number, dy: number): void
  turn(angle: number): void
  tap(x: number, y: number): void
  key(k: string): void
}

const SLOP = 8

export function bindInput(el: HTMLElement, c: Controls): void {
  const pts = new Map<number, { x: number; y: number; sx: number; sy: number; button: number }>()
  let dragged = false
  let pinch: { d: number; a: number; x: number; y: number } | null = null
  const rect = () => el.getBoundingClientRect()
  el.addEventListener('contextmenu', (e) => e.preventDefault())
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId)
    const r = rect()
    pts.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top, sx: e.clientX - r.left, sy: e.clientY - r.top, button: e.button })
    if (pts.size === 1) dragged = false
    if (pts.size === 2) {
      const [a, b] = [...pts.values()]
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      dragged = true
    }
  })
  el.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId)
    if (!p) return
    const r = rect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    const dx = x - p.x, dy = y - p.y
    p.x = x; p.y = y
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const ang = Math.atan2(b.y - a.y, b.x - a.x)
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      if (d > 0 && pinch.d > 0) c.zoom(pinch.d / d, mx, my)
      c.turn(-(ang - pinch.a))
      c.pan(mx - pinch.x, my - pinch.y)
      pinch = { d, a: ang, x: mx, y: my }
      return
    }
    if (!dragged && Math.hypot(x - p.sx, y - p.sy) < SLOP) return
    dragged = true
    if (p.button === 2 || e.shiftKey) c.turn(-dx * 0.006)
    else c.pan(dx, dy)
  })
  const end = (e: PointerEvent) => {
    const p = pts.get(e.pointerId)
    pts.delete(e.pointerId)
    if (pts.size < 2) pinch = null
    if (p && !dragged && pts.size === 0 && p.button !== 2) c.tap(p.x, p.y)
  }
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch = null })
  el.addEventListener('wheel', (e) => {
    e.preventDefault()
    const r = rect()
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1
    c.zoom(Math.exp(e.deltaY * unit * 0.0014), e.clientX - r.left, e.clientY - r.top)
  }, { passive: false })
  el.addEventListener('dblclick', (e) => {
    const r = rect()
    c.zoom(0.35, e.clientX - r.left, e.clientY - r.top)
  })
  addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    c.key(e.key.toLowerCase())
  })
}
