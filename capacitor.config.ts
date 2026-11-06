import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The APK always loads the bundled web build (no server.url, no cleartext):
 * the WebView origin is https://localhost and every request uses https.
 */
const config: CapacitorConfig = {
  appId: 'com.lumapasto.app',
  appName: 'Luma',
  webDir: 'dist/luma/browser',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // The WebView shrinks above the keyboard so focused fields stay visible.
    Keyboard: { resize: 'body', resizeOnFullScreen: true },
    // With the app open too, FCM's message becomes a system notification (sound, banner, tap).
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
