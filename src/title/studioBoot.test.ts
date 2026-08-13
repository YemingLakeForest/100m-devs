import { describe, expect, it } from 'vitest'
import { motionMs } from '../ui/motion.ts'
import { BOOT_EXIT_MS, BOOT_OS_LINE, bootPages } from './studioBoot.ts'

describe('the founder-to-game boot', () => {
  it('initialises the OS, names the project and the founder, and is ready', () => {
    const pages = bootPages('Anson', 'Flappy Square 1.0')
    expect(pages[0]).toBe(BOOT_OS_LINE)
    expect(pages[1]).toContain('Flappy Square 1.0')
    expect(pages[2]).toContain('Anson')
    expect(pages[pages.length - 1]).toBe('ready.')
  })

  it('is a handful of short pages, not a reading assignment', () => {
    // A cut scene between two screens: long enough to land the OS fiction,
    // short enough that the player is never waiting on it.
    const pages = bootPages('Anson', 'Flappy Square 1.0')
    expect(pages.length).toBeLessThanOrEqual(4)
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(60)
  })

  it('keeps the hand-over fade inside the §10.5 budget', () => {
    // F6 — nothing over 400 ms unless it is the scored beat. The page reveals
    // are the scored beat; the lift into the game is not.
    expect(BOOT_EXIT_MS).toBeLessThanOrEqual(400)
    // And §10.5 rule 3 still shortens it rather than cutting it.
    expect(motionMs(BOOT_EXIT_MS, true)).toBeGreaterThan(0)
    expect(motionMs(BOOT_EXIT_MS, true)).toBeLessThan(BOOT_EXIT_MS)
  })
})
