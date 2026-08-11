/**
 * Real-browser acceptance gate for UI containment and control contrast.
 *
 * This checks the smallest supported landscape frames, not jsdom's synthetic
 * boxes. It fails when any visible UI component or any actually painted text
 * crosses the game frame, carries a focused assertion for the developer stat
 * bar that prompted the gate, and rejects button labels that disappear into
 * their rendered background.
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
  '.founder-avatar',
  '.hud__actions[data-phase="in"]',
  '.title__logo',
  '.title__menu',
].join(',')

async function overflowIssues(page) {
  return page.evaluate((componentSelector) => {
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

    return issues
  }, COMPONENTS)
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

async function check(page, { name, width, height, path: urlPath, action, requireScene = false }) {
  await page.setViewportSize({ width, height })
  await page.goto(`${origin}${urlPath}`, { waitUntil: 'load' })
  await page.locator('.app').waitFor()
  await page.waitForTimeout(1_400)
  if (action) {
    await action(page)
    await page.waitForTimeout(450)
  }
  const issues = [
    ...await overflowIssues(page),
    ...(requireScene ? await sceneIssues(page, width, height) : []),
  ]
  if (issues.length > 0) throw new Error(`${name} at ${width}x${height}:\n${issues.join('\n')}`)
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
  })

  const sizes = [
    [640, 360],
    [748, 336],
    [997, 448],
  ]
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
      name: 'upgrades drawer',
      width,
      height,
      path: '/?notitle&nopost',
      action: (target) => target.getByRole('button', { name: 'UPGRADES' }).click(),
    })
    await check(page, {
      name: 'game menu',
      width,
      height,
      path: '/?notitle&nopost',
      action: (target) => target.getByRole('button', { name: 'MENU' }).click(),
    })
    await check(page, {
      name: 'founder name with mobile keyboard layout',
      width,
      height,
      path: '/',
      action: async (target) => {
        await target.getByRole('button', { name: 'NEW GAME' }).click()
        await target.getByRole('button', { name: 'ERASE & START' }).click()
        await target.getByRole('dialog', { name: 'WHO ARE YOU?' }).waitFor()
        await target.getByLabel('YOUR NAME').focus()
      },
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

  console.log(`UI frame, scene and contrast acceptance passed (${sizes.length * 6 + 3} screens).`)
} finally {
  await browser?.close()
  server.kill()
}
