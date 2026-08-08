/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  /**
   * When this bundle was built, stamped in at build time.
   *
   * Exists because six hours of fixes were reported as still broken, and they
   * were: `dist/` had been built that morning and never rebuilt, so the running
   * app was a bundle that predated every one of them. **A stale build is
   * indistinguishable from a bug that will not die**, and it costs a round trip
   * with the player every time. The HUD prints this beside the FPS counter, so
   * the question "am I looking at the code you just changed" is answered by
   * looking rather than by trusting.
   */
  define: {
    __BUILD_AT__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  server: {
    // Distinct from the other studio apps so several can run at once.
    port: 5176,
    host: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
