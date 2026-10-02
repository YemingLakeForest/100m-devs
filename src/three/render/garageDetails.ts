/*
 * Copied from the rebuild (100m-devs-three/src/render/garageDetails.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/** Architectural details from the garage art: an inhabited workshop and a
 * signed entrance kept forward of the occupied floor in the isometric view. */
import * as T from 'three'
import { box, cylinder, INK, line, sharedMaterial } from './worldArt.ts'
import { STUDIO_DOOR, STUDIO_GABLE } from '../sim/floorPlan.ts'
import { dietCoke } from './garageCraft.ts'

/**
 * The green the studio signs its own name in.
 *
 * One constant because it is now on two surfaces — the gable and the door's
 * fascia — and a second hand-typed `#28544f` is how a building ends up with
 * two nearly identical greens on it (§9.2).
 */
const SIGN_INK = '#28544f'

/**
 * The studio's name, printed on a surface.
 *
 * Exported because the office floor needs it three times — on the core, on the
 * glazed screen behind the meeting point and on every hero banner — and a
 * second copy of a canvas-texture helper is exactly the kind of duplicate that
 * drifts (§9.2). `facing` turns the plane; `bg` is the panel behind the
 * letters, which a hero banner sets to their own colour.
 */
/**
 * The printed faces, kept between rebuilds — one per *word*, not per sign.
 *
 * [2026-09-22] Each call used to paint a canvas, wrap it in a texture and a
 * material, and mark all three `own*` so `disposeArt` destroyed them. A room is
 * rebuilt in place on every hire (§12.6), so the ten signs an office floor
 * carries were ten canvases painted, ten textures uploaded and ten shader
 * programs compiled per press. Same argument as `garageCraft`'s `panels`, which
 * has cached its screens this way since the screens existed.
 *
 * Keyed by everything that changes the picture and nothing else. A studio
 * rename adds an entry rather than replacing one, which is correct and cheap:
 * the set of words a studio ever prints is a dozen or so.
 */
const signs = new Map<string, { geometry: T.PlaneGeometry; material: T.MeshBasicMaterial }>()
export function nameSign(parent: T.Object3D, label: string, x: number, y: number, z: number,
  width: number, facing = 0, bg = SIGN_INK): void {
  // Text is a surface on a real lintel, not a floating billboard or an atlas asset.
  // Geometry tests run without a DOM; only the browser needs the printed face.
  if (typeof document === 'undefined' || /jsdom/i.test(navigator.userAgent)) return
  const key = `${label}|${bg}|${width}`
  let sign = signs.get(key)
  if (!sign) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 220
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 1024, 220)
    let font = 82
    do { ctx.font = `600 ${font}px sans-serif`; font -= 2 } while (ctx.measureText(label).width > 930 && font > 20)
    ctx.fillStyle = '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 512, 112)
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace
    sign = { geometry: new T.PlaneGeometry(width, width * 220 / 1024), material: new T.MeshBasicMaterial({ map: texture }) }
    signs.set(key, sign)
  }
  const mesh = new T.Mesh(sign.geometry, sign.material)
  mesh.position.set(x, y, z); mesh.rotation.y = facing
  parent.add(mesh)
}

/**
 * **The camera's own bearing**, in radians about Y — GDD §12.1.
 *
 * `worldScene.setCamera` stands the camera along `(1, 1, 1)` at every playable
 * rank, so a surface whose normal is `(1, 0, 1)` faces the viewer square on.
 * That is `atan2(1, 1)`, which is a quarter turn's half — and it is the same
 * number `STUDIO_DOOR` already uses to cant the entrance towards the player.
 *
 * Written down here because §12.11's name plates are the second thing that
 * needs it and a second hand-typed 0.785 is how two surfaces end up facing
 * almost the same way (§9.2).
 */
/**
 * The gap between letters, in font cells -- §12.11.
 *
 * Departure Mono's own advance leaves a single cell between strokes, and a
 * single cell at this size is one cuboid of daylight that the extrusion's own
 * shaded side closes up again: measured on screen, `JAMES` read as one bar with
 * notches in it. Two cells is the smallest gap that survives being a solid
 * object lit from one side, and it is why the word is set letter by letter
 * rather than rasterised in a single pass.
 */
const NAME_TRACKING = 2

/**
 * How far in front of the person the plate floats, in station units.
 *
 * A hero station puts its desk, its screen and -- for the founder -- an
 * overhead shelf of task cards on the far side of the body, and §12.1's camera
 * lifts anything further away *up* the frame. So a plate directly over the head
 * projects into the same band as the furniture behind it: measured, the
 * founder's name sat behind the shelf's top rail with the letters cut in half
 * by it. Standing it a little forward puts it over the person and in front of
 * their own desk, which is where a label belongs anyway.
 */
/**
 * The size Departure Mono is rasterised at, in canvas pixels.
 *
 * **Departure Mono is a pixel face**, which is the whole reason this works: its
 * glyphs are drawn on a coarse grid, so rasterising it and turning each lit
 * pixel into a box does not *approximate* the letterform, it reproduces it. The
 * letters that end up in the room are the same letters the HUD is set in
 * (§12.3), built out of the same cuboids as everybody standing under them.
 *
 * 22 rather than the font's own 11: two device pixels a font pixel, so the
 * threshold below lands on whole cells rather than on the antialiasing at their
 * edges. `snap` folds the pair back down, and the result is exact.
 */
const RASTER_PX = 22
const RASTER_SCALE = 2

/** Is the real face loaded? A fallback monospace is not Departure Mono. */
export function departureMonoReady(): boolean {
  if (typeof document === 'undefined' || !document.fonts) return false
  try {
    return document.fonts.check(`${RASTER_PX}px "Departure Mono"`)
  } catch {
    return false
  }
}

/** One horizontal run of lit pixels: `y` rows down from the word's cap line. */
interface Run { x: number; y: number; w: number }

/**
 * Departure Mono, rasterised and run-length merged — §12.11.
 *
 * **One glyph at a time, then composed with tracking**, rather than one raster
 * of the whole word. Rasterising `JAMES` in a single pass and cropping to its
 * ink puts the letters at the font's own advance, which at this size is a
 * single pixel of white between strokes — and one pixel becomes one cuboid gap,
 * which the extrusion's own shading closes up. Measured on screen the word read
 * as a bar with notches in it. Set letter by letter the gap is a *decision*,
 * and {@link NAME_TRACKING} is that decision.
 *
 * Merged along x because a glyph row is two or three unbroken spans: emitting a
 * box per lit pixel would put about forty of them in an `E` and three hundred
 * in a six-letter name, and while `batchArt` would instance them all away it is
 * three hundred matrices to rebuild every time the room is. Merged, a name is a
 * few dozen boxes.
 *
 * Returns runs in *font-pixel* cells with the word's own ink as the frame, so
 * the caller sizes and centres on the letters themselves rather than on a line
 * box carrying descenders these words do not use.
 */
function departureRuns(label: string, tracking = NAME_TRACKING): { runs: Run[]; cols: number; rows: number } | null {
  if (typeof document === 'undefined' || /jsdom/i.test(navigator.userAgent)) return null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const font = `${RASTER_PX}px "Departure Mono", ui-monospace, monospace`
  canvas.width = RASTER_PX * 3
  canvas.height = RASTER_PX * 3
  const snap = RASTER_SCALE

  /** One character's lit cells, in its own ink box. */
  const glyph = (ch: string) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // The context keeps its state across `clearRect` but not across a resize,
    // and the resize happened once above; setting the font per glyph is free
    // and removes the question.
    ctx.font = font
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(ch, RASTER_PX, RASTER_PX * 1.5)
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const lit = (x: number, y: number) => data[(y * width + x) * 4 + 3] > 128
    let x0 = width, x1 = -1, y0 = height, y1 = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!lit(x, y)) continue
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
    if (x1 < x0) return null
    /*
     * Back down to the font's own grid. Rasterising at twice the size and
     * folding the pairs here is what keeps the edges square: at 1:1 the browser
     * hints and antialiases a pixel face like any other, and half-lit cells
     * would turn a crisp stroke into a staircase of boxes half a cell apart.
     */
    const cols = Math.ceil((x1 - x0 + 1) / snap)
    const rows = Math.ceil((y1 - y0 + 1) / snap)
    const cells: boolean[] = []
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        let on = false
        for (let dy = 0; dy < snap && !on; dy++) {
          for (let dx = 0; dx < snap && !on; dx++) {
            const x = x0 + cx * snap + dx, y = y0 + cy * snap + dy
            if (x <= x1 && y <= y1 && lit(x, y)) on = true
          }
        }
        cells[cy * cols + cx] = on
      }
    }
    // `top` is where this glyph's ink starts relative to the tallest one, so a
    // word of capitals sits on one cap line and one baseline.
    return { cells, cols, rows, top: Math.floor(y0 / snap) }
  }

  const drawn = [...label].map(glyph)
  if (!drawn.some(Boolean)) return null
  const capTop = Math.min(...drawn.filter(Boolean).map(g => g!.top))
  const rows = Math.max(...drawn.filter(Boolean).map(g => g!.rows + (g!.top - capTop)))
  const runs: Run[] = []
  let pen = 0
  for (const g of drawn) {
    // A space, or a glyph the face does not carry: advance and draw nothing.
    if (!g) { pen += 3 + tracking; continue }
    const lift = g.top - capTop
    for (let cy = 0; cy < g.rows; cy++) {
      let start = -1
      for (let cx = 0; cx <= g.cols; cx++) {
        const on = cx < g.cols && g.cells[cy * g.cols + cx]
        if (on && start < 0) start = cx
        if (!on && start >= 0) { runs.push({ x: pen + start, y: cy + lift, w: cx - start }); start = -1 }
      }
    }
    pen += g.cols + tracking
  }
  return { runs, cols: Math.max(1, pen - tracking), rows }
}

/**
 * The word, as cuboids, in the XY plane of whatever it is added to.
 *
 * Returns the width it drew, so the caller can size a panel to its own
 * lettering rather than to a guess.
 */
function letterBoxes(g: T.Object3D, label: string, cap: number, depth: number,
  colour: string, base = 0, tracking = NAME_TRACKING): number {
  const ink = departureRuns(label, tracking)
  if (!ink) return 0
  const unit = cap / ink.rows
  const width = ink.cols * unit
  for (const run of ink.runs) {
    box(g, -width / 2 + (run.x + run.w / 2) * unit, base + (ink.rows - 1 - run.y) * unit, 0,
      run.w * unit, unit, depth, colour)
  }
  return width
}

/**
 * How to set the studio's name on a board: as one line, or as two.
 *
 * The name is the player's, up to twenty-eight characters of it, and a board
 * over a door is 3.3 m wide — so a fixed cap height is a promise the sign
 * cannot keep. Every arrangement is measured instead and the one whose letters
 * come out **largest** wins, which on a two-word name is almost always the
 * two-line stack: MERCILESS over SOFTWARE is nine characters a line instead of
 * eighteen, so the letters are twice the height and the word block fills the
 * board rather than ruling a thin line across it.
 *
 * The board itself never changes size. That is deliberate: the architecture has
 * to be the same in a headless test as in the browser, and `departureRuns`
 * returns nothing without a DOM. A studio whose name cannot be measured gets an
 * unlettered board, not a differently shaped entrance.
 */
function signLayout(label: string, maxWidth: number, maxHeight: number, gap: number,
  limits: { maxCap?: number; splitBelow?: number } = {}):
{ lines: string[]; cap: number } | null {
  const { maxCap = Infinity, splitBelow = 0 } = limits
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return null
  /** The largest cap this arrangement can be set at, on both axes at once. */
  const score = (lines: string[]): { lines: string[]; cap: number } | null => {
    // `lines.map(departureRuns)` and not a lambda cost an afternoon once
    // `departureRuns` grew a second parameter: `map` hands the callback the
    // index, which arrived as the tracking, so line 0 measured at zero.
    const ink = lines.map(line => departureRuns(line))
    if (ink.some(m => !m)) return null
    // `rows / cols` converts a line's own ink box into the cap it would set at.
    return { lines, cap: Math.min(maxCap, (maxHeight - gap * (lines.length - 1)) / lines.length,
      ...ink.map(m => maxWidth * m!.rows / m!.cols)) }
  }
  const splits: string[][] = [[words.join(' ')]]
  for (let i = 1; i < words.length; i++) {
    splits.push([words.slice(0, i).join(' '), words.slice(i).join(' ')])
  }
  let best: { lines: string[]; cap: number } | null = null
  for (const lines of splits) {
    const fit = score(lines)
    if (!fit) return null
    if (!best || fit.cap > best.cap) best = fit
  }
  /*
   * **Breaking a word is a last resort and it is gated on a measurement.**
   *
   * A studio typed as one unbroken twenty-five-character word sets at a 5 px
   * cap on this wall, which is the defect this whole revision was about: the
   * studio's own name, illegible on its own building. There is no space to
   * break on, so the only move left is to break the word, and splitting it near
   * the middle roughly doubles the cap.
   *
   * It is gated because it is *wrong* whenever anything else will do — MERCILESS
   * has room to set whole and would happily break to MERCI / LESS for a bigger
   * cap if this were allowed to compete on size. So it is only reached when the
   * honest arrangements have all fallen below the caller's legibility floor.
   */
  if (best && best.cap < splitBelow && words.length === 1 && words[0].length > 5) {
    const whole = words[0]
    const alt = score([whole.slice(0, Math.round(whole.length / 2)), whole.slice(Math.round(whole.length / 2))])
    if (alt && alt.cap > best.cap) best = alt
  }
  return best
}

export function gableSign(g: T.Group, name: string,
  gable: { x0: number; x1: number; z: number; thickness: number } = STUDIO_GABLE): T.Group {
  const sign = new T.Group()
  sign.name = 'studio-gable-sign'
  // The outward face of the wall, which is the plane everything here stands on.
  sign.position.set((gable.x0 + gable.x1) / 2, 0, gable.z + gable.thickness / 2)
  g.add(sign)
  const low = 0.9, high = 3.05
  const width = Math.abs(gable.x1 - gable.x0) - 0.6
  const gap = 0.12
  /*
   * A ceiling and a floor, both in metres and both about proportion rather
   * than fit. Without the ceiling a two-letter studio sets at the full 1.25 m
   * band and the name towers over its own mark; without the floor a long
   * unbroken word sets at 5 px and says nothing.
   */
  const fit = signLayout(name, width, 1.25, gap, { maxCap: 0.52, splitBelow: 0.24 })
  const mark = 0.66
  const rule = 0.05
  // Stacked rather than side by side: the mark and two lines of type want
  // 0.55 + 3.4 m across this wall and it only has 3.4.
  const block = fit ? mark + 0.18 + fit.cap * fit.lines.length + gap * (fit.lines.length - 1) + 0.14 + rule : 0
  let y = low + (high - low - block) / 2
  const face = new T.Group()
  face.position.z = 0.03
  sign.add(face)
  if (fit) {
    // The rule is the canopy's amber, and it is the only warm thing on this
    // wall: a dark green wordmark on cream plaster is correct and slightly
    // severe, and one warm line under it is what stops the building reading
    // like a bank.
    // The block's width is the longest line's, and every other line is set out
    // to meet it -- see `justifyTracking`.
    /*
     * Measured again here, and the cap pulled in if it does not fit.
     *
     * Belt and braces over `signLayout`'s own bound, and it is not theoretical:
     * the first cut of the justified layout measured every first line at zero
     * tracking (see `score`), so the cap it chose was a quarter too big and the
     * name was drawn hanging off both ends of the wall. A sign that cannot
     * overflow its wall is worth four lines.
     */
    const natural = fit.lines.map(line => letterWidth(line, fit.cap))
    const over = Math.max(...natural) / width
    const cap = over > 1 ? fit.cap / over : fit.cap
    const measure = fit.lines.map(line => letterWidth(line, cap))
    const widest = Math.max(...measure)
    box(face, 0, y, 0, widest, rule, 0.05, INK.amber)
    y += rule + 0.14
    fit.lines.forEach((line, i) => {
      const spread = measure[i] < widest - 0.01 ? justifyTracking(line, cap, widest) : null
      letterBoxes(face, line, cap, 0.06, SIGN_INK,
        y + (fit.lines.length - 1 - i) * (cap + gap), spread ?? NAME_TRACKING)
    })
    y += cap * fit.lines.length + gap * (fit.lines.length - 1) + 0.18
  }
  /*
   * The mark is the studio's own initial, cut in cream on a green block.
   *
   * A d-pad was the first cut and it was the right idea in the wrong palette:
   * a white cross on a green square, at twenty pixels, is a pharmacy. A
   * monogram cannot be mistaken for anything, it is drawn from the name the
   * player typed rather than from a symbol the game chose for them, and it is
   * the same letterform as the wordmark under it — which is what makes the two
   * read as one lockup rather than as a badge and a sign.
   */
  const initial = ([...name.trim().toUpperCase()].find(c => /[A-Z0-9]/.test(c))) ?? ''
  box(face, 0, y, -0.01, mark, mark, 0.05, SIGN_INK)
  if (initial) {
    const plaque = new T.Group()
    plaque.position.z = 0.055
    sign.add(plaque)
    const cap = mark * 0.54
    letterBoxes(plaque, initial, cap, 0.04, INK.paper, y + (mark - cap) / 2)
  }
  return sign
}

/** How wide a line of this label sets at this cap and tracking. */
function letterWidth(label: string, cap: number, tracking = NAME_TRACKING): number {
  const ink = departureRuns(label, tracking)
  return ink ? ink.cols * cap / ink.rows : 0
}

/**
 * The tracking that sets `label` to exactly `width` — a justified line.
 *
 * **The one typographic move on the building that is not just size.** Two lines
 * of a studio's name are almost never the same length, and two ragged lines
 * stacked centre-on-centre read as a *label*: somebody wrote the name down and
 * it wrapped. Letter-spacing the short line out until its ends meet the long
 * one's is what a signwriter does, and it is the difference between a name
 * printed on a building and a name *set* on one — the block gets two straight
 * edges and starts reading as a mark.
 *
 * Returns `null` when it cannot be done honestly: a line of one glyph has no
 * gaps to open, and past about three times the natural tracking the word stops
 * being a word and becomes a row of letters. A line that cannot be justified is
 * simply centred, which is what it was before.
 */
function justifyTracking(label: string, cap: number, width: number): number | null {
  const natural = departureRuns(label, 0)
  if (!natural) return null
  const gaps = [...label.trim()].length - 1
  if (gaps < 1 || cap <= 0) return null
  const tracking = ((width * natural.rows) / cap - natural.cols) / gaps
  return tracking > NAME_TRACKING && tracking <= NAME_TRACKING * 3 ? tracking : null
}

export function entrance(g: T.Group, placement: {x:number;z:number;width:number;height:number;yaw:number} = STUDIO_DOOR): T.Group {
  const { width, height, yaw } = placement
  const x = 0, z = 0
  const door = new T.Group(); door.name = 'studio-entrance'; g.add(door)
  door.position.set(placement.x, 0, placement.z); door.rotation.y = yaw
  // Jambs, leaf and threshold share the straight east-facing portal frame.
  for (const side of [-1, 1]) {
    box(door, x + side * (width / 2 - 0.13), 0, z, 0.26, height, 0.26, INK.wall)
  }
  const leafWidth = width - 0.58
  box(door, x, 2.55, z, width, height - 2.55, 0.26, INK.wall)
  // A simple plaster lintel and coping replace the sign and shopfront canopy.
  box(door, x, height, z, width + .1, .10, .32, INK.trim)
  // The glazed leaf is open into the empty entry bay. The opening has no wall,
  // skirting or opaque glass panel stretching across it at knee height.
  const leaf = new T.Group(); leaf.name = 'studio-door-leaf'
  leaf.position.set(-leafWidth / 2, 0, 0); leaf.rotation.y = Math.PI / 3; door.add(leaf)
  box(leaf, leafWidth / 2, 0.08, 0, leafWidth, 0.2, 0.09, INK.teal)
  const glass = box(leaf, leafWidth / 2, 0.28, 0, leafWidth, 2.18, 0.045, '#b1c7c8', false)
  glass.material = sharedMaterial('studio-door-glass', () => new T.MeshStandardMaterial({ color: '#b1c7c8', transparent: true, opacity: 0.28, depthWrite: false, roughness: 0.35 }))
  for (const dx of [0, leafWidth]) box(leaf, dx, 0.08, 0, 0.075, 2.45, 0.1, INK.teal)
  box(leaf, leafWidth / 2, 2.46, 0, leafWidth, 0.08, 0.1, INK.teal)
  box(leaf, leafWidth - 0.2, 1.05, 0.1, 0.05, 0.45, 0.06, INK.metal)
  box(door, x + width / 2 - 0.13, 1.35, z + 0.15, 0.14, 0.22, 0.06, INK.metal)
  box(door, x, -0.02, z, leafWidth, 0.02, 0.38, INK.trim)
  box(door, x, -0.3, z + 0.48, leafWidth + 0.2, 0.15, 0.65, INK.trim)
  box(door, x, -0.315, z + 1.05, leafWidth, 0.025, 0.58, '#556964')
  return door
}

/** Small playable-world props distinguish the two founders without using a staff seat. */
export function garageDeskStory(g: T.Group, id: string): void {
  if (id === 'james') {
    const can = (x: number, y: number, z: number) => dietCoke(g, x, y, z)
    // A cabinet supports three rows of cans; every upper can has a base below it.
    box(g, -1.35, 0, .83, .55, .78, .85, INK.woodEdge)
    box(g, -1.35, .78, .83, .61, .06, .91, INK.wood)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        for (let level = 0; level < 3 - Math.abs(col - 1); level++) can(-1.55 + col * .2, .84 + level * .232, .6 + row * .22)
      }
    }
    can(.64, .92, .63); can(.83, .92, .63)
    nameSign(g, 'Diet Coke', -1.35, .55, .365, .48, Math.PI, '#9e3f36')
    box(g, -1.3, 0, -.08, .47, .42, .42, '#506565')
    box(g, -1.3, .42, -.08, .39, .012, .34, '#253b3c')
    for (let i = 0; i < 3; i++) dietCoke(g, -1.44 + i * .14, .34, -.08)
  } else if (id === 'founder') {
    // The rubber-duck debugger has been promoted to CTO: chunky, crowned, visible.
    box(g, -.67, .92, 1.00, .47, .26, .35, '#edbe47')
    box(g, -.67, 1.12, 1.03, .30, .28, .29, '#f4cf58')
    box(g, -.67, 1.14, 1.22, .25, .085, .18, '#d77b36')
    for (const x of [-.765, -.575]) {
      box(g, x, 1.25, 1.184, .072, .09, .035, '#fff6dc')
      box(g, x, 1.27, 1.207, .034, .045, .02, '#263c3c')
    }
    box(g, -.67, 1.4, 1.03, .3, .045, .26, '#d49a33')
    for (const x of [-.78, -.67, -.56]) box(g, x, 1.445, 1.12, .045, .10, .045, '#e8b541')
    nameSign(g, 'CTO', -.67, 1.01, 1.185, .32, 0, '#5f4c2c')
    // Pizza boxes are the founder's extremely informal filing system.
    for (let i = 0; i < 3; i++) {
      box(g, .42, .04 + i * .085, .83, .67, .07, .61, i % 2 ? '#c49b68' : '#e3c99a')
      box(g, .42, .055 + i * .085, 1.14, .39, .035, .012, '#b45338')
    }

  }
}

/**
 * The workshop bench, under the clerestory on the hall's far wall.
 *
 * It used to be a nine-metre strip across the whole back wall with its crates,
 * cabinet and framed posters at fixed coordinates. The far wall is stepped now
 * — the annex takes the right-hand 42% of it — so those coordinates put the
 * bench inside the leadership deck and hung the posters on fresh air outside
 * the building. Position comes from `sim/floorPlan.GARAGE_FURNITURE` and the
 * rest is measured off it, so the bench follows the wall it belongs to.
 */
export function workshop(g: T.Group, at: { x: number; z: number; w: number; d: number }): void {
  const { x, z, w, d } = at
  box(g, x, 0.82, z, w, 0.13, d, INK.wood)
  for (let i = 0; i < 3; i++) box(g, x - w / 2 + 0.4 + i * (w - 0.8) / 2, 0, z, 0.12, 0.82, d * 0.8, INK.woodEdge)
  box(g, x, 0.18, z, w, 0.08, d * 0.9, INK.woodEdge)
  // Pegboard on the wall behind it, and what hangs on it.
  box(g, x - 0.1, 1.12, z - d / 2 - 0.05, w - 0.5, 1.15, 0.07, '#b7a37a')
  for (let i = 0; i < 7; i++) {
    const px = x - w / 2 + 0.35 + i * (w - 0.7) / 6
    box(g, px, 1.32 + (i % 2) * 0.18, z - d / 2 + 0.03, 0.06, 0.44, 0.06, i % 3 ? INK.metal : '#ad6947')
    box(g, px, 1.72 + (i % 2) * 0.18, z - d / 2 + 0.03, i % 3 ? 0.13 : 0.26, 0.07, 0.06, INK.metal)
  }
  // Crates under it, a vice, and a clock that has been there since Act I.
  for (let i = 0; i < 3; i++) {
    box(g, x - w / 2 + 0.55 + i * (w - 1.1) / 2, 0.26, z + 0.08, 0.7, 0.4, d * 0.52,
      ['#6b9386', INK.trim, INK.wood][i])
  }
  box(g, x + w / 2 - 0.6, 0.96, z + 0.15, 0.62, 0.2, 0.4, '#60766e')
  cylinder(g, x + w / 2 - 0.35, 0.96, z - 0.1, 0.16, 0.42, '#ae6941')
  // Keep the whole dial below the clerestory and within the supporting wall.
  const clockX = x - w / 2 + 0.25, clockY = 1.57, clockZ = z - d / 2 + 0.05
  const clock = cylinder(g, clockX, clockY - 0.03, clockZ, 0.24, 0.06, INK.trim)
  clock.name = 'workshop-wall-clock'
  clock.rotation.x = Math.PI / 2
  line(g, [new T.Vector3(clockX, clockY + 0.17, clockZ + 0.04),
    new T.Vector3(clockX, clockY, clockZ + 0.04),
    new T.Vector3(clockX + 0.13, clockY, clockZ + 0.04)], INK.metal)
  /*
   * The drawer cabinet went with the long bench, and is not coming back.
   *
   * It stood 1.6 m wide beside the workshop and was never in
   * `GARAGE_FURNITURE`, so the walkability graph had no idea it was there — a
   * metre and a half of obstacle that routes walked straight through. In the
   * stepped plan it also landed on the sprint board. An unmodelled blocker is
   * worse than no blocker: it is the picture and the graph disagreeing again.
   */
}

export function street(g: T.Group): void {
  box(g, 0, -0.55, 15, 120, 0.15, 5.2, '#747d7c', false)
  // Leave curb openings where the quiet side streets join the main road.
  for (const [x, width] of [[-41, 38], [0, 32], [41, 38]]) box(g, x, -.37, 12.3, width, .1, .26, INK.trim)
  box(g, 0, -.37, 17.7, 120, .1, .26, INK.trim)
  for (let x = -57; x <= 57; x += 3) box(g, x, -0.392, 15, 1.5, 0.008, 0.085, '#e5dfc9', false)
  // A modest crossing continues the entrance path; drains and curb joints
  // are detail at street level rather than another high-contrast grid.
  for (let z = 12.65; z <= 17.4; z += 0.72) box(g, -3.2, -0.392, z, 2.6, 0.008, 0.3, '#d8d9cd', false)
  for (const x of [-7, 1, 12]) {
    box(g, x, -0.391, 12.6, 0.65, 0.01, 0.32, INK.metal, false)
    for (let i = 0; i < 5; i++) box(g, x - 0.23 + i * 0.115, -0.38, 12.6, 0.035, 0.005, 0.26, '#9ca49c', false)
  }
}

/** Small everyday objects on the forecourt; the entrance/crossing stays clear. */
export function garageForecourt(g: T.Group): void {
  const yard = new T.Group(); yard.position.y = -.32; g.add(yard)
  // Slatted oak bench beside the hedge, facing the street.
  for (const x of [5.1, 7.1]) box(yard, x, 0, 10.65, .12, .45, .62, INK.metal)
  for (const z of [10.42, 10.62, 10.82]) box(yard, 6.1, .45, z, 2.5, .09, .16, INK.wood)
  for (const x of [5.1, 7.1]) box(yard, x, .4, 10.3, .09, .6, .09, INK.metal)
  for (const y of [.68, .88]) box(yard, 6.1, y, 10.3, 2.5, .14, .08, INK.wood)
  // A low litter bin, with an inset opening and a separate lid.
  box(yard, 8.45, 0, 10.6, .55, .8, .55, '#536b62')
  box(yard, 8.45, .8, 10.6, .6, .07, .6, INK.metal)
  box(yard, 8.45, .59, 10.88, .34, .12, .012, INK.metal)
  for (const x of [-5.4, 10.6]) {
    cylinder(yard, x, 0, 11.5, .065, .95, INK.metal)
    cylinder(yard, x, .78, 11.5, .11, .13, INK.trim)
    cylinder(yard, x, .91, 11.5, .13, .06, INK.metal)
  }
}
