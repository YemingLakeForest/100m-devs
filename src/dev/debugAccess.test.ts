import { describe, expect, it } from 'vitest'
import { debugSearchParamsFor, debugToolsAllowed } from './debugAccess.ts'

describe('localhost-only debug access', () => {
  it.each(['localhost', 'LOCALHOST', '127.0.0.1', '::1', '[::1]'])(
    'allows a local web session at %s',
    (hostname) => {
      expect(debugToolsAllowed(hostname, false)).toBe(true)
    },
  )

  it.each(['100mdevs.mercilessstudio.com', 'preview.pages.dev', '192.168.1.42', '', 'localhost.example'])(
    'refuses a deployed or non-loopback HTML host at %s',
    (hostname) => {
      expect(debugToolsAllowed(hostname, false)).toBe(false)
    },
  )

  it('refuses Android even though Capacitor presents its bundle as localhost', () => {
    expect(debugToolsAllowed('localhost', true)).toBe(false)
    expect(debugToolsAllowed('127.0.0.1', true)).toBe(false)
  })

  it('preserves debug query flags only for an authorised local browser', () => {
    expect(debugSearchParamsFor('?act=bankrupt&bench=10', 'localhost', false).get('act')).toBe(
      'bankrupt',
    )
    expect(
      debugSearchParamsFor('?act=bankrupt&bench=10', '100mdevs.mercilessstudio.com', false).size,
    ).toBe(0)
    expect(debugSearchParamsFor('?act=bankrupt&bench=10', 'localhost', true).size).toBe(0)
  })
})
