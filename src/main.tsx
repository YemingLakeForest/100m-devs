import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TextureStyle } from 'pixi.js'
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

/**
 * Nearest-neighbour everywhere, set before any texture is created.
 *
 * ART_DIRECTION §7: hard pixels only. Pixi's default is linear filtering,
 * which would soften every sprite edge in the game and produce exactly the
 * anti-aliasing the acceptance checklist rejects — from a single default, in
 * one line, invisibly.
 */
TextureStyle.defaultOptions.scaleMode = 'nearest'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
