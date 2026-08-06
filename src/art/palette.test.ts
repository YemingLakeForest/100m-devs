import { describe, expect, it } from 'vitest'
import { MASTER_PALETTE, RAMPS, RARITY_FRAME, hexToRgb, rgbToHex } from './palette.ts'
import { installPaletteTokens } from './cssTokens.ts'
import { entropyTheme, interfaceState } from './entropyTheme.ts'

describe('the master palette (ART_DIRECTION §2.1)', () => {
  it('has the ramp sizes the structure table specifies', () => {
    expect(RAMPS.NEUTRAL).toHaveLength(9)
    expect(RAMPS.WOOD).toHaveLength(4)
    expect(RAMPS.SKIN).toHaveLength(6)
    expect(RAMPS.GLOW).toHaveLength(3)
    expect(RAMPS.FOLIAGE).toHaveLength(2)
    expect(RAMPS.CALM).toHaveLength(4)
    expect(RAMPS.WARN).toHaveLength(4)
    expect(RAMPS.ALARM).toHaveLength(4)
  })

  it('is the 36 specified colours plus the one §2.3 rarity addition', () => {
    expect(MASTER_PALETTE).toHaveLength(37)
  })

  it('contains no duplicates — a duplicate would be a colour nobody chose twice', () => {
    expect(new Set(MASTER_PALETTE).size).toBe(MASTER_PALETTE.length)
  })

  it('is written in one canonical form, so string comparison is safe', () => {
    for (const hex of MASTER_PALETTE) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('rarity frames are palette entries, not new art (ART_DIRECTION §2.3)', () => {
  it('covers all seven Hero Card tiers', () => {
    expect(Object.keys(RARITY_FRAME)).toHaveLength(7)
  })

  it('draws every tier colour from the master palette', () => {
    for (const [tier, hex] of Object.entries(RARITY_FRAME)) {
      expect(MASTER_PALETTE, `${tier} frame`).toContain(hex)
    }
  })
})

describe('hex/rgb round-trip', () => {
  it('survives every colour in the palette', () => {
    for (const hex of MASTER_PALETTE) {
      const [r, g, b] = hexToRgb(hex)
      expect(rgbToHex(r, g, b)).toBe(hex)
    }
  })

  it('pads short values rather than emitting a malformed hex', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
    expect(rgbToHex(0, 0, 1)).toBe('#000001')
  })
})

describe('the palette reaches CSS without being restated', () => {
  it('publishes every ramp as custom properties', () => {
    const root = document.createElement('div')
    installPaletteTokens(root)

    for (const [prefix, ramp] of [
      ['--n', RAMPS.NEUTRAL],
      ['--wood-', RAMPS.WOOD],
      ['--skin-', RAMPS.SKIN],
      ['--glow-', RAMPS.GLOW],
      ['--foliage-', RAMPS.FOLIAGE],
      ['--calm-', RAMPS.CALM],
      ['--warn-', RAMPS.WARN],
      ['--alarm-', RAMPS.ALARM],
    ] as const) {
      ramp.forEach((hex, i) => {
        expect(root.style.getPropertyValue(`${prefix}${i}`), `${prefix}${i}`).toBe(hex)
      })
    }
  })

  it('starts the live phosphor on the calm ramp, so the first paint is correct', () => {
    const root = document.createElement('div')
    installPaletteTokens(root)
    RAMPS.CALM.forEach((hex, i) => {
      expect(root.style.getPropertyValue(`--p${i}`)).toBe(hex)
    })
  })

})

describe('entropy drives the interface (ART_DIRECTION §1.1)', () => {
  it('maps each band of E to the state the table names', () => {
    expect(interfaceState(0)).toBe('calm')
    expect(interfaceState(0.24)).toBe('calm')
    expect(interfaceState(0.25)).toBe('loaded')
    expect(interfaceState(0.59)).toBe('loaded')
    expect(interfaceState(0.6)).toBe('strained')
    expect(interfaceState(0.84)).toBe('strained')
    expect(interfaceState(0.85)).toBe('critical')
    expect(interfaceState(0.98)).toBe('critical')
    expect(interfaceState(0.99)).toBe('lock')
    expect(interfaceState(1)).toBe('lock')
  })

  it('is cyan when calm and alarm red at lock', () => {
    expect(entropyTheme(0).phosphor).toEqual(RAMPS.CALM)
    expect(entropyTheme(1).phosphor).toEqual(RAMPS.ALARM)
  })

  it('crossfades rather than cutting between bands', () => {
    const mid = entropyTheme(0.42).phosphor[2]
    expect(mid).not.toBe(RAMPS.CALM[2])
    expect(mid).not.toBe(RAMPS.WARN[2])
    // Still a legal colour, even though it is between two palette entries:
    // the phosphor is emissive shader output, not a sprite, so §5 does not
    // apply to it. Only assets in assets/ are palette-locked.
    expect(mid).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('rises monotonically in bloom as the studio strains', () => {
    const samples = [0, 0.3, 0.6, 0.85, 1].map((e) => entropyTheme(e).glass.bloom)
    expect(samples).toEqual([...samples].sort((a, b) => a - b))
  })

  it('starts the screen jittering at 80%, per GDD §8.1 rather than the §1.1 band', () => {
    expect(entropyTheme(0.79).glass.jitter).toBe(0)
    expect(entropyTheme(0.9).glass.jitter).toBeGreaterThan(0)
  })

  it('tears only at Entropy Lock', () => {
    expect(entropyTheme(0.98).glass.tear).toBe(0)
    expect(entropyTheme(0.995).glass.tear).toBe(1)
  })

  it('clamps input rather than producing colours outside the ramps', () => {
    expect(entropyTheme(-5).phosphor).toEqual(RAMPS.CALM)
    expect(entropyTheme(99).phosphor).toEqual(RAMPS.ALARM)
  })
})
