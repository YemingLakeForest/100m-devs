import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TextureStyle } from 'pixi.js'
import App from './App.tsx'
import { installPaletteTokens } from './art/cssTokens.ts'

import './styles/fonts.css'
import './styles/tokens.css'
import './styles/app.css'

// Publish the master palette to CSS before the first paint, so no element ever
// renders against an unset custom property.
installPaletteTokens(document.documentElement)

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
