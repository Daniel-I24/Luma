import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The APK always loads the bundled web build (no server.url, no cleartext):
 * the WebView origin is https://localhost and every request uses https.
 */
const config: CapacitorConfig = {
  appId: 'com.luma.app',
  appName: 'Luma',
  webDir: 'dist/luma/browser',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // The WebView shrinks above the keyboard so focused fields stay visible.
    Keyboard: { resize: 'body', resizeOnFullScreen: true },
  },
};

export default config;
