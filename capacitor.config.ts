import type { CapacitorConfig } from '@capacitor/cli'

// Application ID confirmed 2026-08-06 — permanent, see docs/PROJECT_SETUP.md §1.
const config: CapacitorConfig = {
  appId: 'com.mercilessstudio.m100devs',
  appName: '100M Developers',
  webDir: 'dist',
  loggingBehavior: 'production',
  server: {
    androidScheme: 'http',
  },
  android: {
    backgroundColor: '#14121a',
  },
}

export default config
