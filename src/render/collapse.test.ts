import { describe, expect, it, vi } from 'vitest'

// The Capacitor native-audio plugin cannot initialise under jsdom — it reaches
// for a global the web bundle only defines inside a real Capacitor shell. These
// tests cover the timeline maths, which never plays a sound, so the module is
// stubbed rather than the tests being moved away from the code they describe.
vi.mock('../audio/sfx.ts', () => ({ playSfx: () => {} }))

import {
  CHATTER_LINES,
  DROP_MS,
  SHAKE_MS,
  SURGE_RAMP_MS,
  SURGE_START_MS,
  WEB_RAMP_MS,
  WEB_START_MS,
  dropProgress,
  rampAt,
  shakeOffset,
} from './collapse.ts'
import { DROP_HEIGHT, dropOffset } from './scene.ts'

describe('shakeOffset — §21 Act IV part 1', () => {
  it('is still at rest before and after the impact', () => {
    expect(shakeOffset(-1)).toEqual({ x: 0, y: 0 })
    expect(shakeOffset(SHAKE_MS)).toEqual({ x: 0, y: 0 })
    expect(shakeOffset(SHAKE_MS + 500)).toEqual({ x: 0, y: 0 })
  })

  it('decays to nothing rather than being cut off mid-swing', () => {
    // §10.5: nothing cuts. A shake truncated at full amplitude snaps the
    // picture back into place, which is exactly the artefact that rule exists
    // to forbid.
    const nearEnd = shakeOffset(SHAKE_MS - 1)
    expect(Math.abs(nearEnd.x)).toBeLessThan(0.1)
    expect(Math.abs(nearEnd.y)).toBeLessThan(0.1)
  })

  it('is strongest at the impact and weaker later', () => {
    const peak = Math.max(
      ...Array.from({ length: 40 }, (_, i) => Math.abs(shakeOffset(i * 2).x)),
    )
    const late = Math.max(
      ...Array.from({ length: 40 }, (_, i) => Math.abs(shakeOffset(SHAKE_MS * 0.7 + i * 2).x)),
    )
    expect(peak).toBeGreaterThan(late * 2)
  })

  it('does not degenerate into a diagonal', () => {
    // Both axes on the same frequency reads as the whole screen sliding along
    // one line, which looks like a dropped transform rather than an impact.
    const sameSign = Array.from({ length: 200 }, (_, i) => shakeOffset(i * 3)).filter(
      (s) => Math.sign(s.x) === Math.sign(s.y),
    ).length
    expect(sameSign).toBeGreaterThan(30)
    expect(sameSign).toBeLessThan(170)
  })
})

describe('dropOffset — §21 Act IV part 2, "1,000 developers drop from the sky"', () => {
  const COUNT = 1000

  it('starts every developer in the sky and lands every one of them', () => {
    for (const i of [0, 1, 7, 500, 999]) {
      expect(dropOffset(i, 0)).toBe(DROP_HEIGHT)
      expect(dropOffset(i, 1)).toBe(0)
    }
  })

  it('is deterministic, so a bad-looking drop is reproducible', () => {
    for (const i of [0, 13, 742]) {
      expect(dropOffset(i, 0.5)).toBe(dropOffset(i, 0.5))
    }
  })

  it('staggers the release instead of landing the swarm on one frame', () => {
    // Halfway through, some have landed and some have not. If they all shared a
    // schedule this set would have exactly one member.
    const heights = new Set(
      Array.from({ length: COUNT }, (_, i) => Math.round(dropOffset(i, 0.5))),
    )
    expect(heights.size).toBeGreaterThan(50)
  })

  it('does not release in index order — that would read as a diagonal wipe', () => {
    // The particles are laid out on an iso grid by index, so an index-ordered
    // stagger sweeps the floor corner to corner. Neighbouring indices must not
    // have neighbouring release times.
    const at = (i: number) => dropOffset(i, 0.35)
    const neighbourGaps = Array.from({ length: 200 }, (_, i) => Math.abs(at(i) - at(i + 1)))
    const spread = Math.max(...neighbourGaps)
    expect(spread).toBeGreaterThan(DROP_HEIGHT * 0.2)
  })

  it('accelerates rather than descending at a constant rate', () => {
    // Things fall under gravity: ground covered in the second half of a fall
    // exceeds the first. An ease-out curve gets this backwards and reads as a
    // lift descending, which is what the first version of dropOffset did.
    //
    // Particle 0 has a zero stagger delay, so its own fall occupies the first
    // (1 - DROP_STAGGER_SPAN) of the window and these three samples sit inside
    // it. Sampling on the global t without accounting for that measures the
    // settle against the fall and proves nothing.
    const at = (u: number) => dropOffset(0, u * 0.55)
    const first = at(0.2) - at(0.5)
    const second = at(0.5) - at(0.8)
    expect(second).toBeGreaterThan(first)
  })

  it('never sends a developer back up into the sky once it has landed', () => {
    // Not monotonic by design — the landing dips below the desk and settles
    // back, which is the impact. What must never happen is a particle
    // recovering any real altitude after touchdown.
    const i = 42
    let landed = false
    for (let t = 0; t <= 1; t += 0.005) {
      const h = dropOffset(i, t)
      if (h < DROP_HEIGHT * 0.02) landed = true
      if (landed) expect(h).toBeLessThan(DROP_HEIGHT * 0.02)
    }
  })

  it('lands with a dip below the desk, not a soft stop', () => {
    const i = 0
    const heights = Array.from({ length: 400 }, (_, k) => dropOffset(i, k / 400))
    expect(Math.min(...heights)).toBeLessThan(0)
  })
})

describe('rampAt — the staged surge', () => {
  it('holds at zero until its stage begins', () => {
    expect(rampAt(0, WEB_START_MS, WEB_RAMP_MS)).toBe(0)
    expect(rampAt(WEB_START_MS, WEB_START_MS, WEB_RAMP_MS)).toBe(0)
  })

  it('reaches full and stays there', () => {
    expect(rampAt(WEB_START_MS + WEB_RAMP_MS, WEB_START_MS, WEB_RAMP_MS)).toBe(1)
    expect(rampAt(60_000, WEB_START_MS, WEB_RAMP_MS)).toBe(1)
  })

  it('eases in rather than ramping linearly', () => {
    const quarter = rampAt(SURGE_START_MS + SURGE_RAMP_MS * 0.25, SURGE_START_MS, SURGE_RAMP_MS)
    expect(quarter).toBeLessThan(0.25)
  })
})

describe('the Act IV running order — §21', () => {
  it('drops the bodies before it draws the web that connects them', () => {
    // "1,000 pixel developers drop from the sky" comes before "red web lines
    // instantly connect all desks". A web strung between empty floor is the
    // gag arriving before its setup.
    expect(rampAt(0, WEB_START_MS, WEB_RAMP_MS)).toBe(0)
    expect(dropProgress(WEB_START_MS)).toBeGreaterThan(0.2)
  })

  it('floods the screen only once the room is full', () => {
    expect(SURGE_START_MS).toBeGreaterThan(WEB_START_MS)
    expect(dropProgress(SURGE_START_MS)).toBeGreaterThan(0.5)
  })

  it('finishes the fall well inside the surge, so nothing is still falling at full noise', () => {
    expect(DROP_MS).toBeLessThan(SURGE_START_MS + SURGE_RAMP_MS)
  })
})

describe('dropProgress', () => {
  it('is clamped at both ends', () => {
    expect(dropProgress(-500)).toBe(0)
    expect(dropProgress(0)).toBe(0)
    expect(dropProgress(DROP_MS)).toBe(1)
    expect(dropProgress(DROP_MS * 10)).toBe(1)
  })
})

describe('chatter copy', () => {
  it('carries the §21 Act IV lines verbatim', () => {
    // These are quoted from the GDD. Paraphrasing them is a content change and
    // should have to break a test to happen.
    expect(CHATTER_LINES).toContain('Who broke the build?')
    expect(CHATTER_LINES).toContain("What's the password for the Wi-Fi?")
    expect(CHATTER_LINES).toContain('Why are we in a meeting?')
    expect(CHATTER_LINES).toContain('Is there oat milk?')
  })
})
