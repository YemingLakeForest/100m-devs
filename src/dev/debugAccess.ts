import { Capacitor } from '@capacitor/core'

/**
 * The sole authority for developer instrumentation.
 *
 * Capacitor is the important second half of this check: an installed Android
 * app serves its bundled HTML from `localhost`, so hostname alone would make a
 * native build look like a local browser session and expose every debug seam.
 *
 * Keep the host allow-list exact. In particular, a Vite server opened through
 * its LAN address is useful for ordinary device testing, but it is deployed
 * from the browser's point of view and must not accept state-changing query
 * flags or publish inspection globals.
 */
export function debugToolsAllowed(hostname: string, native: boolean): boolean {
  if (native) return false
  const host = hostname.trim().toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}

export const DEBUG_TOOLS_ENABLED = debugToolsAllowed(
  typeof location === 'undefined' ? '' : location.hostname,
  Capacitor.isNativePlatform(),
)

export function debugSearchParamsFor(
  search: string,
  hostname: string,
  native: boolean,
): URLSearchParams {
  return debugToolsAllowed(hostname, native)
    ? new URLSearchParams(search)
    : new URLSearchParams()
}

/**
 * Query parameters are empty outside an authorised local browser session.
 * Callers can therefore parse their fixtures normally without each one
 * growing a separate, and eventually inconsistent, deployment check.
 */
export function debugSearchParams(): URLSearchParams {
  if (typeof location === 'undefined') return new URLSearchParams()
  return debugSearchParamsFor(location.search, location.hostname, Capacitor.isNativePlatform())
}
