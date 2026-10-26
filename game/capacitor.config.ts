import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'juanstudio.wallgame',
  appName: 'Quoridor',
  webDir: 'dist',
  android: {
    // Everything is bundled; the app makes no network requests.
    allowMixedContent: false,
  },
};

export default config;
