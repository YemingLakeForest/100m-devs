import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installPaletteTokens } from './art/cssTokens.ts'
import { loadSettings } from './settings/settings.ts'

import './styles/fonts.css'
import './styles/tokens.css'
import './styles/app.css'

// Publish the master palette to CSS before the first paint, so no element ever
// renders against an unset custom property.
installPaletteTokens(document.documentElement)

// Appendix F2.1 — before anything can make a sound or animate. `App` preloads
// the SFX bank in its first effect and the title's boot sequence is the first
// motion in the product, so a settings read that happened any later would let
// one launch play at the wrong volume and animate at the wrong length.
loadSettings()

/*
 * Pixi's texture default (nearest-neighbour, ART_DIRECTION §7) was set here
 * until the Pixi stage was decommissioned on 2026-09-28. The 3D room's own
 * textures set their filters where they are made.
 */

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
