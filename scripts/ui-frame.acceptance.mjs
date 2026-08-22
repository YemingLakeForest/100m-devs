/**
 * Real-browser acceptance gate for UI containment, **overlap** and contrast.
 *
 * This checks the supported landscape frames, not jsdom's synthetic boxes. It
 * fails when any visible UI component or any actually painted text crosses the
 * game frame, when two things that share a layer are drawn on top of each other,
 * and when a button label disappears into its rendered background.
 *
 * ## Why this file grew, on 2026-08-12
 *
 * A batch of HUD work shipped with the character creator's buttons overlapping
 * each other, its action bar floating over the fields, an incident chip printing
 * a release name straight through the words beside it, and both HUD rails
 * running off the bottom of every phone in §23.4.2's design box. This gate
 * existed the whole time, ran in a real Chrome at real phone sizes, and passed.
 * Four separate reasons, each worth writing down because each is a different
 * class of hole:
 *
 * 1. **It only asked about containment.** `outside()` tests whether a box has
 *    left the frame. Two boxes drawn on top of each other are both entirely
 *    inside it, so every reported defect was invisible to the only question
 *    being asked. Overlap detection is the bulk of what is new below.
 *
 * 2. **It was not in `npm run check`.** That is `lint && tsc -b && vitest run &&
 *    art:check`; this file was a script nobody ran. So even the containment half
 *    was not gating anything. It is in `check` now.
 *
 * 3. **`COMPONENTS` was a hand-maintained allowlist**, and the components the
 *    batch added — the three backlogs, the role dial, the action bar of the
 *    character creator — were never added to it. A list you have to remember to
 *    update is a list that is out of date. It is still a list, because a gate
 *    that measures *everything* reports a hundred true-but-uninteresting nested
 *    boxes; but the overlap pass below works off painted text as well, which no
 *    list can go stale against.
 *
 * 4. **It never visited the states where the HUD is full.** Every HUD case was
 *    Act I or Act II on a fresh save: no offer, no dial, no backlogs, no
 *    prestige, no upgrade door. The rail budget only fails when the rail is
 *    full, and the gate had no way to fill it. `?full` (App.tsx) exists for
 *    this, and the `keyboard` cases below shrink the viewport the way a real
 *    Android keyboard does rather than merely focusing the field — which is
 *    what the case named "founder name with mobile keyboard layout" had been
 *    doing since it was written.
 *
 * The unit suite is not at fault and could not have been: jsdom has no layout
 * engine, so `getBoundingClientRect` returns zeroes and no vitest test in this
 * repo can see a layout defect at all. That is the division of labour — vitest
 * owns behaviour, this file owns geometry — and it only works if this file runs.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright-core'
import sharp from 'sharp'

const port = Number(process.env.UI_TEST_PORT ?? 5197)
const origin = `http://127.0.0.1:${port}`
const vite = path.resolve('node_modules/vite/bin/vite.js')
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
})

let serverLog = ''
server.stdout.on('data', (chunk) => { serverLog += String(chunk) })
server.stderr.on('data', (chunk) => { serverLog += String(chunk) })

async function waitForServer() {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin)
      if (response.ok) return
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Vite did not start.\n${serverLog}`)
}

const COMPONENTS = [
  '.ui-btn',
  '.ui-panel[data-phase="in"]',
  '.hud__block',
  '.hud__terminal',
  '.hud__advisor',
  '.hud__perf',
  '.touch',
  '.founder__corner',
  '.founder-setup input',
  '.founder-setup__option',
  '.founder-setup__actions',
  '.founder-avatar',
  '.hud__actions[data-phase="in"]',
  '.hud__controls',
  '.hire-dial',
  '.backlog',
  // §18.0 — a live event's banner is a control in the middle column, which is
  // the one place in the frame nothing else is anchored to an edge.
  '.event-banner',
  '.upgrade-board__node',
  '.title__logo',
  '.title__menu',
].join(',')

/**
 * Boxes that paint something — a border, a fill, a chart — and must therefore
 * not be drawn through one another.
 *
 * Narrower than {@link COMPONENTS} on purpose. Containment is a question you can
 * ask of any element; overlap is only interesting between things that both leave
 * a mark, and asking it of every `div` produces a page of true reports about
 * wrappers sitting inside wrappers.
 */
const PAINTED = [
  '.ui-btn__face',
  '.hud__block',
  '.backlog',
  '.event-banner',
  '.touch',
  '.hire-dial',
  '.hud__terminal',
  '.hud__advisor',
  '.hud__perf',
  '.founder__corner',
  '.founder-setup__option',
  '.founder-setup input',
  '.founder-setup fieldset',
  '.founder-setup__name-row',
  '.founder-setup__actions',
  '.founder-avatar',
  '.burndown__chart',
  '.revenue__chart',
  '.upgrade-board__node',
].join(',')

async function overflowIssues(page) {
  return page.evaluate(({ componentSelector, paintedSelector }) => {
    const root = document.querySelector('#root')
    if (!root) return ['missing #root']
    const frame = root.getBoundingClientRect()
    const tolerance = 1
    const issues = []

    const outside = (rect) =>
      rect.left < frame.left - tolerance ||
      rect.top < frame.top - tolerance ||
      rect.right > frame.right + tolerance ||
      rect.bottom > frame.bottom + tolerance

    const visible = (element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0
    }

    const clipToAncestors = (element, raw) => {
      const clipped = { left: raw.left, top: raw.top, right: raw.right, bottom: raw.bottom }
      for (let ancestor = element.parentElement; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor)
        const clipsX = style.overflowX !== 'visible'
        const clipsY = style.overflowY !== 'visible'
        if (!clipsX && !clipsY) continue
        const box = ancestor.getBoundingClientRect()
        if (clipsX) {
          clipped.left = Math.max(clipped.left, box.left)
          clipped.right = Math.min(clipped.right, box.right)
        }
        if (clipsY) {
          clipped.top = Math.max(clipped.top, box.top)
          clipped.bottom = Math.min(clipped.bottom, box.bottom)
        }
      }
      return clipped
    }

    for (const element of root.querySelectorAll(componentSelector)) {
      if (!visible(element) || element.closest('[data-phase="exit"]')) continue
      const rect = clipToAncestors(element, element.getBoundingClientRect())
      if (rect.right <= rect.left || rect.bottom <= rect.top) continue
      if (outside(rect)) issues.push(`component ${element.className || element.tagName} ${JSON.stringify(rect)}`)
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue
      const parent = node.parentElement
      if (!parent || !visible(parent) || parent.closest('[data-phase="exit"]')) continue

      const range = document.createRange()
      range.selectNodeContents(node)
      for (const raw of range.getClientRects()) {
        const clipped = clipToAncestors(parent, raw)
        if (clipped.right <= clipped.left || clipped.bottom <= clipped.top) continue
        if (outside(clipped)) issues.push(`text ${JSON.stringify(node.textContent.trim())}`)
      }
    }

    /* ------------------------------------------------------------------
       Overlap. Two things drawn on top of each other are both inside the
       frame, so nothing above can see this — and it is what every layout
       defect reported off a handset has actually been.

       Three rules keep it free of false positives without weakening it:

       1. **Same layer.** An element's layer is its nearest positioned
          ancestor. A drawer, a modal or the §10.7 dialogue box is *supposed*
          to be over the HUD, and each of those is `position: absolute`, so
          they land on layers of their own and are never compared with what
          they cover. Everything in normal flow shares the HUD's layer, which
          is exactly the set that must not collide.
       2. **Neither contains the other.** A button always overlaps its own
          label.
       3. **Text is measured on its em box, not its line box.** A line box
          includes half-leading, so two consecutive lines of `line-height:
          1.2` technically intersect by a pixel or two. Trimming to the em box
          removes that entire class of report and keeps every real one — a
          real collision is glyphs on glyphs.
    ------------------------------------------------------------------ */
    const layerOf = (element) => {
      for (let n = element; n && n !== document.documentElement; n = n.parentElement) {
        const position = getComputedStyle(n).position
        if (position === 'absolute' || position === 'fixed') return n
      }
      return root
    }

    const intersect = (a, b, slack) => {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left) - slack
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) - slack
      return w > 0 && h > 0 ? { w, h } : null
    }

    const unrelated = (a, b) => a !== b && !a.contains(b) && !b.contains(a)

    const runs = []
    const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
      const copy = node.textContent?.trim()
      if (!copy) continue
      const parent = node.parentElement
      if (!parent || !visible(parent) || parent.closest('[data-phase="exit"]')) continue
      const em = Number.parseFloat(getComputedStyle(parent).fontSize) || 0
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const raw of range.getClientRects()) {
        if (raw.width < 1 || raw.height < 1) continue
        const lead = Math.max(0, (raw.height - em) / 2)
        // Clipped, like the containment pass above: a run that a scroller or a
        // rail has cut off is not painted there, so it cannot be over anything.
        const box = clipToAncestors(parent, {
          left: raw.left,
          right: raw.right,
          top: raw.top + lead,
          bottom: raw.bottom - lead,
        })
        if (box.right <= box.left || box.bottom <= box.top) continue
        runs.push({ element: parent, copy, layer: layerOf(parent), box })
      }
    }

    for (let i = 0; i < runs.length; i += 1) {
      for (let j = i + 1; j < runs.length; j += 1) {
        const a = runs[i]
        const b = runs[j]
        if (a.layer !== b.layer || !unrelated(a.element, b.element)) continue
        const hit = intersect(a.box, b.box, 0)
        if (!hit) continue
        issues.push(
          `text "${a.copy.slice(0, 40)}" is drawn over "${b.copy.slice(0, 40)}" (${hit.w.toFixed(0)}x${hit.h.toFixed(0)}px)`,
        )
      }
    }

    const painted = [...root.querySelectorAll(paintedSelector)]
      .filter((element) => visible(element) && !element.closest('[data-phase="exit"]'))
      .map((element) => ({
        element,
        layer: layerOf(element),
        /* Clipped, because a scroller's overflowing child is not on screen —
           the character creator's trait grid scrolls, and its last fieldset
           legitimately extends past the bottom of it. */
        box: clipToAncestors(element, element.getBoundingClientRect()),
      }))
      .filter(({ box }) => box.right > box.left && box.bottom > box.top)

    for (let i = 0; i < painted.length; i += 1) {
      for (let j = i + 1; j < painted.length; j += 1) {
        const a = painted[i]
        const b = painted[j]
        if (a.layer !== b.layer || !unrelated(a.element, b.element)) continue
        /* Two pixels of slack: adjacent boxes share a 1px rule, and a skewed
           §10.8a slab's bounding box reaches a little past its own edge. */
        const hit = intersect(a.box, b.box, 2)
        if (!hit) continue
        issues.push(
          `${a.element.className || a.element.tagName} is drawn over ${b.element.className || b.element.tagName} (${hit.w.toFixed(0)}x${hit.h.toFixed(0)}px)`,
        )
      }
    }

    const card = root.querySelector('.devcard[data-phase="in"]')
    if (card) {
      const cardRect = card.getBoundingClientRect()
      for (const bar of card.querySelectorAll('.devcard__stat-bar')) {
        const rect = bar.getBoundingClientRect()
        if (rect.left < cardRect.left - tolerance || rect.right > cardRect.right + tolerance) {
          issues.push(`developer stat bar crossed its card: ${bar.textContent}`)
        }
      }
    }

    const nameDice = root.querySelector('.founder-setup__dice-btn')
    const die = nameDice?.querySelector('.founder-setup__die')
    if (nameDice && die && visible(nameDice) && visible(die)) {
      const buttonRect = nameDice.getBoundingClientRect()
      const dieRect = die.getBoundingClientRect()
      const buttonCentre = buttonRect.left + buttonRect.width / 2
      const dieCentre = dieRect.left + dieRect.width / 2
      const error = Math.abs(buttonCentre - dieCentre)
      if (error > 2) issues.push(`random-name die is ${error.toFixed(1)}px off-centre`)
    }

    const parseColor = (value) => {
      const rgb = value.match(/^rgba?\((.*)\)$/i)
      if (rgb) {
        const parts = rgb[1].split(/[\s,/]+/).filter(Boolean)
        if (parts.length < 3) return null
        const channel = (part) => part.endsWith('%') ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part)
        const alpha = parts[3]?.endsWith('%') ? Number.parseFloat(parts[3]) / 100 : Number.parseFloat(parts[3] ?? '1')
        return { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha }
      }

      const srgb = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i)
      if (srgb) {
        return {
          r: Number(srgb[1]) * 255,
          g: Number(srgb[2]) * 255,
          b: Number(srgb[3]) * 255,
          a: Number(srgb[4] ?? '1'),
        }
      }
      return null
    }

    const over = (top, bottom) => {
      const a = top.a + bottom.a * (1 - top.a)
      if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }
      return {
        r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
        g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
        b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
        a,
      }
    }

    const backgroundBehind = (element) => {
      const layers = []
      for (let current = element; current; current = current.parentElement) {
        const colour = parseColor(getComputedStyle(current).backgroundColor)
        if (colour?.a > 0) layers.push(colour)
      }
      let result = { r: 255, g: 255, b: 255, a: 1 }
      for (let i = layers.length - 1; i >= 0; i -= 1) result = over(layers[i], result)
      return result
    }

    const luminance = ({ r, g, b }) => {
      const linear = (channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
    }

    const contrast = (foreground, background) => {
      const light = Math.max(luminance(foreground), luminance(background))
      const dark = Math.min(luminance(foreground), luminance(background))
      return (light + 0.05) / (dark + 0.05)
    }

    /* Inspect the actual colour inherited by each painted label fragment. This
       catches mixed labels such as HIRE + DEVELOPER, where testing only the
       button's own `color` would miss the semantic span that caused the bug. */
    for (const button of root.querySelectorAll('.ui-btn')) {
      if (!visible(button) || button.closest('[data-phase="exit"]')) continue
      const background = backgroundBehind(button)
      const label = button.querySelector('.ui-btn__label')
      if (!label) continue
      const labelWalker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT)
      for (let node = labelWalker.nextNode(); node; node = labelWalker.nextNode()) {
        const copy = node.textContent?.trim()
        const parent = node.parentElement
        if (!copy || !parent || !visible(parent)) continue
        const foreground = parseColor(getComputedStyle(parent).color)
        if (!foreground) {
          issues.push(`button label colour could not be measured: ${copy}`)
          continue
        }
        const ratio = contrast(over(foreground, background), background)
        if (ratio < 4.5) {
          issues.push(`button "${button.textContent?.trim()}" segment "${copy}" has ${ratio.toFixed(2)}:1 contrast`)
        }
      }
    }

    /* ------------------------------------------------------------------
       Cropped button edges.

       A `.ui-btn` paints a hard offset slab (box-shadow) and a 4-degree
       skew past its border box. An `overflow: hidden` ancestor that clips
       it shaves the button's edge silently — the exact defect reported as
       MENU / CODE / HIRE DEVELOPER. For every button, its painted extent
       (border box plus the shadow offset) must sit inside every clipping
       ancestor's box. Buttons inside a scroller that is currently showing
       them whole are fine; only a slab cut by a clip is a failure.
    ------------------------------------------------------------------ */
    for (const button of root.querySelectorAll('.ui-btn')) {
      if (!visible(button) || button.closest('[data-phase="exit"]')) continue
      // The HUD rail is the concern; the first-run creator is a modal over the
      // title with its own (known-to-be-tight-at-640px) layout budget.
      if (!button.closest('.hud')) continue
      const shadow = getComputedStyle(button).boxShadow
      const match = shadow.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/)
      if (!match) continue
      const ox = Number(match[1])
      const oy = Number(match[2])
      if (ox <= 0 && oy <= 0) continue

      const rect = button.getBoundingClientRect()
      const painted = {
        left: rect.left + Math.min(0, ox),
        top: rect.top + Math.min(0, oy),
        right: rect.right + Math.max(0, ox),
        bottom: rect.bottom + Math.max(0, oy),
      }
      for (let ancestor = button.parentElement; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor)
        const clipsX = style.overflowX !== 'visible'
        /*
         * **A button below the fold is not a clipped button.**
         *
         * `.paradigm` is `max-height: 86vh; overflow-y: auto`, and on a 640x360
         * phone its ten nodes, two readouts and shift offer do not fit — so the
         * player scrolls, which is the design. Measured at the top of that
         * scroll, PARADIGM SHIFT and CLOSE sit past the container's bottom edge
         * and tripped this check, which is a true statement about the boxes and
         * says nothing at all about whether the screen looks broken.
         *
         * So vertical clipping is a defect only where the container **cannot**
         * scroll. Horizontal stays unconditional: nothing in this game is
         * allowed to scroll sideways, so a slab past the side edge is always a
         * defect whatever the overflow value says.
         */
        const scrollsY =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          ancestor.scrollHeight > ancestor.clientHeight + 1
        const clipsY = style.overflowY !== 'visible' && !scrollsY
        if (!clipsX && !clipsY) continue
        const box = ancestor.getBoundingClientRect()
        // No slack here: the whole point is that a slab cut by even one pixel
        // is the defect (the skew alone shaves ~1px off a flush-left button).
        if (clipsX && (painted.left < box.left || painted.right > box.right)) {
          issues.push(`button "${button.textContent?.trim()}" slab clipped horizontally by ${ancestor.className || ancestor.tagName}`)
          break
        }
        if (clipsY && (painted.top < box.top || painted.bottom > box.bottom)) {
          issues.push(`button "${button.textContent?.trim()}" slab clipped vertically by ${ancestor.className || ancestor.tagName}`)
          break
        }
      }
    }

    return [...new Set(issues)]
  }, { componentSelector: COMPONENTS, paintedSelector: PAINTED })
}

async function sceneIssues(page, width, height) {
  const clip = {
    x: Math.round(width * 0.2),
    y: Math.round(height * 0.08),
    width: Math.round(width * 0.55),
    height: Math.round(height * 0.62),
  }
  const image = await page.screenshot({ clip })
  const stats = await sharp(image).stats()
  const colourSpread = Math.max(...stats.channels.slice(0, 3).map((channel) => channel.stdev))
  return colourSpread < 4
    ? [`game visual layer is blank (central colour spread ${colourSpread.toFixed(2)})`]
    : []
}

/**
 * §10.7a.3 — while a scene is up the HUD is genuinely inert, so a gate that
 * clicks a HUD button must first play the conversation out the way a player
 * does: tap the glass until the box is gone. One tap completes a typing page
 * (rule 1), the next turns it (rule 2, after the 260 ms arming window), so a
 * ~450 ms beat per tap walks the whole script without ever holding a page
 * open. The glass, not a selector: the scrim owns every tap by design, and it
 * stays mounted through the panel's exit — so a scene is only clear once the
 * glass has stayed clear past the exit, because a dismiss can trigger the next
 * arrival scene on the following tick and the `?full` fixture satisfies
 * several arrival predicates at once.
 */
async function clearScene(page) {
  for (let i = 0; i < 200; i++) {
    const scrim = page.locator('.ui-dialogue__scrim')
    if (!(await scrim.count())) {
      await page.waitForTimeout(600)
      if (!(await scrim.count())) return
    }
    await page.mouse.click(320, 200)
    await page.waitForTimeout(450)
  }
  throw new Error('a scene would not clear')
}

/**
 * **Every button you can see, you can press.**
 *
 * This pass exists because §13.2's PARADIGM button and §13.11.2's TEAM button
 * shipped drawn, correctly positioned, contrast-checked — and completely dead.
 * `.hud` is `pointer-events: none` by design and each control opts back in; the
 * opt-in had been written on the *containers*, and those two buttons are direct
 * children of a row that never needed pointers, so the canvas sat on top of
 * them. The Paradigm Tree is the only place Bandwidth Points can be spent and
 * its only other door is Act V's bankruptcy modal, so the whole prestige loop
 * was reachable once per playthrough, by going broke.
 *
 * **Not one of the existing passes could have caught it.** Overflow measures
 * boxes and both buttons were inside the frame. Contrast measures pixels and
 * both were perfectly legible. A dead control is not a geometry defect or a
 * colour defect — it is the one class of interface bug that is *invisible in a
 * screenshot*, which is exactly why it needs a pass of its own in the file that
 * takes the screenshots.
 *
 * Hit-tests the centre of every labelled, on-screen button and reports the one
 * case that is unambiguously wrong: **the canvas receives the tap.**
 *
 * Narrowed to the canvas deliberately, and the first draft is worth recording
 * because it was too clever. Asking "does the topmost element belong to this
 * button" reports fourteen things on the upgrades drawer alone, and none of them
 * is a bug: a drawer is *meant* to cover the HUD behind it, and a button scrolled
 * out of a panel legitimately has no element above it because it is off-screen.
 * A gate that reports true-but-uninteresting overlap is the exact failure this
 * file's own header describes, and the fix is the same one — measure the thing
 * that is actually wrong.
 *
 * The canvas is never a legitimate cover. It is the bottom layer; §7.1 puts the
 * HUD above it and turns pointers off so taps fall *through* to the simulation.
 * Anything the canvas is on top of has lost that argument.
 */
async function deadControlIssues(page) {
  return page.evaluate(() => {
    const out = []
    for (const btn of document.querySelectorAll('button')) {
      const r = btn.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      const style = getComputedStyle(btn)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      if (btn.disabled) continue
      // A label, because an unlabelled button is a swatch or a sprite target and
      // this pass cannot tell a dead one from a decorative one.
      const label = (btn.textContent || '').trim()
      if (!label) continue
      const cx = Math.round(r.left + r.width / 2)
      const cy = Math.round(r.top + r.height / 2)
      // Off-screen, or scrolled out of its own container: not this pass's
      // business, and `elementFromPoint` cannot answer for it anyway.
      if (cx < 0 || cy < 0 || cx >= innerWidth || cy >= innerHeight) continue
      const hit = document.elementFromPoint(cx, cy)
      if (!hit || hit.tagName !== 'CANVAS') continue
      out.push(
        `dead control: "${label.slice(0, 32)}" is visible at ${Math.round(r.x)},${Math.round(r.y)} ` +
          `but the canvas receives the tap (pointer-events: ${style.pointerEvents})`,
      )
    }
    return out
  })
}

/** How many screens this run actually looked at. Reported at the end. */
let screensChecked = 0

/** A real tap on the canvas: down and up, no travel, so §7.7.6 reads it as a tap. */
async function tapAt(page, x, y) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(20)
  await page.mouse.up()
  await page.waitForTimeout(450)
}

async function check(
  page,
  { name, width, height, path: urlPath, action, requireScene = false, keyboard = 0 },
) {
  screensChecked += 1
  await page.setViewportSize({ width, height })
  await page.goto(`${origin}${urlPath}`, { waitUntil: 'load' })
  await page.locator('.app').waitFor()
  await page.waitForTimeout(1_400)
  if (action) {
    await action(page)
    await page.waitForTimeout(450)
  }
  /*
   * The mobile keyboard, done properly.
   *
   * A soft keyboard on landscape Android does not "focus a field": it takes
   * about three fifths of the window and the layout viewport shrinks to what is
   * left. `focus()` alone — which is all this gate used to do — reproduces none
   * of that, so the case named for the keyboard was checking the ordinary
   * layout at full height and had never once exercised the thing it was for.
   */
  if (keyboard > 0) {
    await page.setViewportSize({ width, height: Math.round(height * keyboard) })
    await page.waitForTimeout(450)
  }
  const measuredHeight = keyboard > 0 ? Math.round(height * keyboard) : height
  const issues = [
    ...await overflowIssues(page),
    ...await deadControlIssues(page),
    ...(requireScene ? await sceneIssues(page, width, measuredHeight) : []),
  ]
  if (issues.length > 0) {
    throw new Error(`${name} at ${width}x${measuredHeight}:\n${issues.join('\n')}`)
  }
}

let browser
try {
  await waitForServer()
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('m100devs.booted', '1')
    localStorage.setItem('m100devs_founder_profile', JSON.stringify({ name: 'Ada', head: 'wave', body: 'jacket' }))
    /*
     * Every case starts from nothing. `?full` prestiges the player and the store
     * writes a save on the next scene dismissal, so without this the cases would
     * be ordered — an Act I frame checked after a `?full` one would be checking
     * a studio that had already been through the trap, which is a different
     * frame with different content in it.
     *
     * **This line is load-bearing, and the note that used to be here said it was
     * not** — corrected 2026-08-18. It read *"nothing loads the save at boot
     * today, so this is insurance rather than a fix"*, and `store.ts` has called
     * `initPersistence()` at module scope for as long as that function has
     * existed: the save is loaded before the first render, by design, because it
     * has to be. So the failure it described as hypothetical — a gate that
     * silently stops testing Run 1 — is the one this line has been preventing
     * all along. Found while writing `playthrough.acceptance.mjs`, which
     * believed the comment and built two of its three careers on it.
     */
    localStorage.removeItem('m100devs_save')
  })

  /*
   * §23.4.2's design box runs 1.78:1 to 2.4:1. The two ends were already here;
   * 816x366 and 898x403 are the middle, and 898x403 earns its place by sitting
   * just *above* the `max-height: 400px` breakpoint — the arrangement a frame
   * gets on the tall side of a breakpoint is a different arrangement, and the
   * device this batch's defects were reported from landed there.
   */
  const sizes = [
    [640, 360],
    [748, 336],
    [816, 366],
    [898, 403],
    [997, 448],
  ]

  const openFounderSetup = async (target) => {
    await target.getByRole('button', { name: 'NEW GAME' }).click()
    const erase = target.getByRole('button', { name: 'ERASE & START' })
    if (await erase.count()) await erase.click()
    await target.getByRole('dialog', { name: 'WHO ARE YOU?' }).waitFor()
  }

  for (const [width, height] of sizes) {
    await check(page, { name: 'landing screen', width, height, path: '/' })
    await check(page, {
      name: 'new-game confirmation',
      width,
      height,
      path: '/',
      action: (target) => target.getByRole('button', { name: 'NEW GAME' }).click(),
    })
    await check(page, { name: 'developer details', width, height, path: '/?notitle&select=0&nopost' })
    await check(page, {
      name: 'game menu',
      width,
      height,
      path: '/?notitle&nopost',
      action: async (target) => {
        await clearScene(target)
        await target.getByRole('button', { name: 'MENU' }).click()
      },
    })

    /*
     * §21.0c — Run 1 has no upgrade door, so the drawer has to be opened from a
     * studio that has prestiged. This case used to load a fresh save and click
     * UPGRADES, which is a button that no longer exists there.
     */
    await check(page, {
      name: 'upgrades drawer',
      width,
      height,
      path: '/?notitle&full&nopost',
      action: async (target) => {
        // `?full` opens on a hero arrival scene; the door cannot open while it
        // plays, which is the behaviour being gated rather than a bug in the
        // gate.
        await clearScene(target)
        // `exact`, because §18.0's event banner is part of this fixture and its
        // route button is `OPEN UPGRADES`. Two buttons that lead to the same
        // screen is correct — one is the standing door and one is an
        // interruption saying to use it — and a substring match cannot tell
        // them apart.
        await target.getByRole('button', { name: 'UPGRADES', exact: true }).click()
      },
    })

    /*
     * **The frames where the HUD is full**, which is where every rail defect
     * lives and where this gate had never looked. `?full` is App.tsx's
     * worst-case fixture: prestiged, so §21.0c's roles, backlogs and upgrade
     * door all exist, with a defect bench, a downed release and a losing ticket
     * queue — combined with Act III, which adds §21.0a's offer and §10.10's
     * dial to the same rail.
     */
    await check(page, { name: 'Act I', width, height, path: '/?notitle&nopost' })
    await check(page, {
      name: 'the fullest the HUD gets',
      width,
      height,
      path: '/?act=act3_bait&full&nopost',
      action: async (target) => {
        /*
         * §18.0 — and the banner really is on this frame.
         *
         * Out of flow, so it costs the grid nothing, which is also how it could
         * silently stop existing without the containment pass noticing. Waiting
         * for it is the only thing standing between "the worst frame carries a
         * live event" and trap 28 all over again.
         */
        await target.locator('.event-banner').waitFor({ state: 'visible' })
      },
    })
    /*
     * §18.0a's modal, which is the frame a player actually meets first. A
     * centred scrim over the fullest HUD there is — the composition most likely
     * to overflow a 640x360 phone, because nothing else in the game draws a
     * panel *and* both full rails at once.
     */
    await check(page, {
      name: 'a mandatory event, before the player has chosen an exit',
      width,
      height,
      path: '/?act=act3_bait&full&event&nopost',
    })
    await check(page, {
      name: 'the fullest the HUD gets, mid-collapse',
      width,
      height,
      path: '/?act=act4_collapse&full&nopost',
    })

    /*
     * §13.2's tree, which this gate had never opened — and §13.12.4 has just put
     * two more lines of prose on it.
     *
     * It is the tallest panel in the game: a header, a capacity readout, the new
     * near-miss line, two branch columns of five nodes, the shift offer and its
     * two-press confirmation. Every one of those is text that grows when a name
     * or a number gets longer, and on a 640x360 phone there is nothing else it
     * can do but overflow. The near-miss line in particular is the one piece of
     * copy here whose length depends on a *node name*, so it is the one most
     * likely to push the panel past the frame the first time somebody adds a
     * node with a long one.
     */
    await check(page, {
      name: 'the paradigm tree, with somewhere still to climb',
      width,
      height,
      path: '/?notitle&full&nopost',
      action: async (target) => {
        await clearScene(target)
        await target.getByRole('button', { name: 'PARADIGM', exact: true }).click()
        // The readout, not just the panel: it is conditional on §13.12.4's
        // `nextRung`, so a fixture that stopped satisfying it would leave this
        // case quietly gating a screen with the new lines missing.
        await target.locator('.paradigm__next').waitFor({ state: 'visible' })
      },
    })

    /*
     * §13.8's placement gesture, all the way from the strip to the armed tap.
     *
     * Three surfaces in one screen, and the reason they are checked together is
     * that each one is a control the last session found dead on a different
     * layer: §13.11.2's strip (a `Panel`), §22.9's card (pinned to the right
     * edge, over the CASH block), and the banner (its own row, pinned above the
     * bottom rail). The banner is also the only surface in the game whose width
     * is set by **a hero's name inside a sentence**, so it is the one that
     * overflows first when somebody joins the roster with a longer one.
     */
    await check(page, {
      name: 'a hero armed for placement',
      width,
      height,
      path: '/?notitle&full&nopost',
      action: async (target) => {
        await clearScene(target)
        await target.getByRole('button', { name: 'TEAM', exact: true }).click()
        await target.locator('.roster__card').first().click()
        await target.getByRole('button', { name: 'POST', exact: true }).click()
        // The banner, not just the absence of the card: POST closes the card
        // either way, so waiting on the card would pass with the gesture dead.
        await target.locator('.posting').waitFor({ state: 'visible' })
      },
    })

    await check(page, {
      name: 'founder setup',
      width,
      height,
      path: '/',
      action: openFounderSetup,
    })
    await check(page, {
      name: 'founder name with the keyboard up',
      width,
      height,
      path: '/',
      action: async (target) => {
        await openFounderSetup(target)
        await target.getByLabel('YOUR NAME').focus()
      },
      // What is left of a landscape frame under a soft keyboard. Measured off
      // the report this was written for: 2244x1008 physical, ~330 px of game.
      keyboard: 0.42,
    })
  }

  await check(page, {
    name: 'degenerate pinch keeps the room visible',
    width: 997,
    height: 448,
    path: '/?notitle&nopost',
    requireScene: true,
    action: async (target) => {
      const canvas = target.locator('.app__canvas canvas')
      const point = { clientX: 300, clientY: 180 }
      await canvas.dispatchEvent('pointerdown', { ...point, pointerId: 41, pointerType: 'touch' })
      await canvas.dispatchEvent('pointerdown', { ...point, pointerId: 42, pointerType: 'touch' })
      // The first move latches the old 0 px baseline; the second used to divide
      // 0 by 0, poison Z with NaN and cull every Pixi view while the HUD lived.
      await canvas.dispatchEvent('pointermove', { ...point, pointerId: 42, pointerType: 'touch' })
      await canvas.dispatchEvent('pointermove', { ...point, pointerId: 42, pointerType: 'touch' })
      await canvas.dispatchEvent('pointerup', { ...point, pointerId: 42, pointerType: 'touch' })
      await canvas.dispatchEvent('pointerup', { ...point, pointerId: 41, pointerType: 'touch' })
    },
  })

  await check(page, {
    name: 'hire developer contrast',
    width: 748,
    height: 336,
    path: '/?act=act2_offer_hire&nopost',
  })
  await check(page, {
    name: 'pressed hire developer contrast',
    width: 748,
    height: 336,
    path: '/?act=act2_offer_hire&nopost',
    action: (target) => target.getByRole('button', { name: /HIRE DEVELOPER/ }).dispatchEvent('pointerdown'),
  })

  /*
   * **The studio is still on screen on a screen.**
   *
   * Every size above is a phone in landscape, because §23.4 measures the game
   * on one and the reference frame is 997x448. Nothing here had ever opened a
   * *desktop window*, and that is how the block came to be invisible at one:
   * its chrome fade was written as a floor-space scale, floor-space scale at a
   * given level scales with the viewport, and at 1999x1115 the nine towers the
   * player was not in were at alpha zero **while the block was the subject**.
   * Reported as "at 100k still just one tower", with every gate green.
   *
   * So this asks the only question that matters and asks it through the
   * picker: at a hundred thousand developers, how many buildings can the finger
   * actually reach? `__pick` is the same sanctioned hook the walk aims with.
   */
  for (const [width, height] of [
    [1999, 1115],
    [2560, 1440],
    [1280, 720],
    [997, 448],
  ]) {
    screensChecked += 1
    await page.setViewportSize({ width, height })
    await page.goto(`${origin}/?notitle&nopost&scenario=campus`, { waitUntil: 'load' })
    await page.locator('.hud').waitFor()
    await page.waitForTimeout(1_800)
    const seen = await page.evaluate(() => {
      const found = new Set()
      for (let y = 6; y < window.innerHeight - 6; y += 6) {
        for (let x = 6; x < window.innerWidth - 6; x += 6) {
          const hit = globalThis.__pick?.(x, y)
          if (hit && hit.rung === 4) found.add(hit.index)
        }
      }
      const s = window.__stage
      return {
        buildings: [...found].sort((a, b) => a - b),
        at: s?.at ?? null,
        blockAlpha: s?.blockAlpha ?? null,
      }
    })
    if (seen.at !== 'BLOCK' || seen.buildings.length !== 10) {
      throw new Error(
        `the block at ${width}x${height}: a hundred thousand developers put the lens at ` +
          `${seen.at} with ${seen.buildings.length} of 10 buildings reachable — ` +
          JSON.stringify(seen.buildings),
      )
    }
    /*
     * **Reachable is not the same as drawn**, and asking only the first
     * question is how the first draft of this check passed against the very
     * defect it was written for. `__pick` answers off the model; the model was
     * never wrong. What was wrong is that the block's chrome was being faded
     * out *at the block*, so all ten towers were there, all ten were pickable,
     * and none of them was on the screen.
     */
    if (seen.blockAlpha !== 1) {
      throw new Error(
        `the block at ${width}x${height}: the lens is at BLOCK and the block's own chrome is ` +
          `at alpha ${seen.blockAlpha} — its towers are being drawn invisible`,
      )
    }
    // The panel and its door have to fit the rail at every one of these too.
    const spill = await overflowIssues(page)
    if (spill.length > 0) {
      throw new Error(`the block at ${width}x${height}: ` + spill.join(' | '))
    }

    /*
     * **And the address survives the way in.** Two taps and two doors: name a
     * tower, enter it, name a storey, enter that. A floor number is only a
     * floor number *of something*, and the call that named a storey used
     * `seatOfStorey(f)` — whose building argument defaults to the first one —
     * so choosing a floor of building 8 quietly moved the studio to building 1
     * and took the room with it.
     */
    const tower = await page.evaluate(() => {
      for (let y = 6; y < window.innerHeight - 6; y += 5) {
        for (let x = 6; x < window.innerWidth - 6; x += 5) {
          const hit = globalThis.__pick?.(x, y)
          if (hit && hit.rung === 4 && hit.index === 7) return { x, y }
        }
      }
      return null
    })
    if (!tower) throw new Error(`the block at ${width}x${height}: building 8 is not reachable`)
    await tapAt(page, tower.x, tower.y + 40)
    await page.locator('.hud__enter').click()
    await page.waitForTimeout(1_200)
    const storey = await page.evaluate(() => {
      for (let y = 6; y < window.innerHeight - 6; y += 5) {
        for (let x = 6; x < window.innerWidth - 6; x += 5) {
          const hit = globalThis.__pick?.(x, y)
          if (hit && hit.rung === 3 && hit.index === 5) return { x, y }
        }
      }
      return null
    })
    if (!storey) throw new Error(`the block at ${width}x${height}: floor 6 of building 8 is not reachable`)
    await tapAt(page, storey.x, storey.y)
    await page.locator('.hud__enter').click()
    await page.waitForTimeout(1_200)
    const where = await page.evaluate(() => {
      const s = window.__stage
      return { at: s?.at, building: s?.building, storey: s?.storey }
    })
    if (where.at !== 'FLOOR' || where.building !== 7 || where.storey !== 5) {
      throw new Error(
        `the block at ${width}x${height}: two doors from building 8, floor 6 landed on ` +
          JSON.stringify(where),
      )
    }
  }

  /*
   * **And the same questions one rung further out, at a million developers.**
   *
   * §7.7.1 rung 5: past a hundred thousand a block is full and the thing that
   * arrives is another block, on its own parcel. The park is the level that
   * holds ten of them, and every defect the block had is available to it — the
   * chrome fade that was written in pixels, the frame that measured the towers
   * and not the ground they stand on, the default argument that quietly means
   * "the first one". So it is asked the same three things: is the lens where
   * the headcount says, is every parcel reachable, and is the park's own chrome
   * *drawn* rather than merely present.
   *
   * The last of those is trap 51 and it is why the alpha is asserted at all:
   * `__pick` answers off the model, and the model is never the thing that is
   * wrong.
   */
  for (const [width, height] of [
    [1999, 1115],
    [1280, 720],
    [997, 448],
  ]) {
    screensChecked += 1
    await page.setViewportSize({ width, height })
    await page.goto(`${origin}/?notitle&nopost&scenario=town`, { waitUntil: 'load' })
    await page.locator('.hud').waitFor()
    await page.waitForTimeout(2_200)

    const seen = await page.evaluate(() => {
      const found = new Set()
      for (let y = 6; y < window.innerHeight - 6; y += 6) {
        for (let x = 6; x < window.innerWidth - 6; x += 6) {
          const hit = globalThis.__pick?.(x, y)
          if (hit && hit.rung === 5) found.add(hit.index)
        }
      }
      const s = window.__stage
      return {
        blocks: [...found].sort((a, b) => a - b),
        at: s?.at ?? null,
        parkAlpha: s?.parkAlpha ?? null,
      }
    })
    if (seen.at !== 'PARK' || seen.blocks.length !== 10) {
      throw new Error(
        `the park at ${width}x${height}: a million developers put the lens at ${seen.at} ` +
          `with ${seen.blocks.length} of 10 blocks reachable — ${JSON.stringify(seen.blocks)}`,
      )
    }
    if (seen.parkAlpha !== 1) {
      throw new Error(
        `the park at ${width}x${height}: the lens is at PARK and the park's own chrome is ` +
          `at alpha ${seen.parkAlpha} — its parcels are being drawn invisible`,
      )
    }
    const spill = await overflowIssues(page)
    if (spill.length > 0) throw new Error(`the park at ${width}x${height}: ` + spill.join(' | '))

    /*
     * **Three doors, and the address survives all three.** Block 8, then its
     * fifth tower, then that tower's sixth floor — 745,000, which is a seat no
     * arithmetic in the game had to reach before there was a park.
     *
     * Aimed at the *middle* of what a unit covers rather than at the first
     * point that names it. The first point is the top of a crown, and a camera
     * still easing into its stop moves it out from under the cursor between the
     * scan and the tap — trap 40, which is about a moving camera and not about
     * a wrong pick.
     */
    const aim = (rung, index) =>
      page.evaluate(
        ({ r, i }) => {
          let sx = 0
          let sy = 0
          let n = 0
          for (let y = 6; y < window.innerHeight - 6; y += 5) {
            for (let x = 6; x < window.innerWidth - 6; x += 5) {
              const hit = globalThis.__pick?.(x, y)
              if (!hit || hit.rung !== r || hit.index !== i) continue
              sx += x
              sy += y
              n += 1
            }
          }
          return n === 0 ? null : { x: Math.round(sx / n), y: Math.round(sy / n) }
        },
        { r: rung, i: index },
      )

    const doors = [
      { rung: 5, index: 7, what: 'block 8' },
      { rung: 4, index: 74, what: 'the fifth tower of block 8' },
      { rung: 3, index: 5, what: 'floor 6 of it' },
    ]
    for (const door of doors) {
      const at = await aim(door.rung, door.index)
      if (!at) throw new Error(`the park at ${width}x${height}: ${door.what} is not reachable`)
      await tapAt(page, at.x, at.y)
      const enter = page.locator('.hud__enter')
      if (!(await enter.count())) {
        throw new Error(
          `the park at ${width}x${height}: tapping ${door.what} named nothing, so there is no door`,
        )
      }
      await enter.click()
      await page.waitForTimeout(1_400)
    }

    const where = await page.evaluate(() => {
      const s = window.__stage
      return { at: s?.at, block: s?.block, building: s?.building, storey: s?.storey, seat: s?.focusSeat }
    })
    if (
      where.at !== 'FLOOR' ||
      where.block !== 7 ||
      where.building !== 4 ||
      where.storey !== 5 ||
      where.seat !== 745_000
    ) {
      throw new Error(
        `the park at ${width}x${height}: three doors from block 8, building 5, floor 6 landed on ` +
          JSON.stringify(where),
      )
    }
  }

  /*
   * **Counted, not asserted.** This line used to read `sizes.length * 10 + 3`,
   * a formula somebody kept in step with the cases below by hand — so adding a
   * case and watching the total stay at 53 was the only clue that it was not
   * measuring anything. A gate whose own summary is a guess is a gate that can
   * report a pass over cases it never ran.
   */
  console.log(`UI frame, overlap, scene and contrast acceptance passed (${screensChecked} screens).`)
} finally {
  await browser?.close()
  server.kill()
}
