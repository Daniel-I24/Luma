# Android APK

Luma ships to Android with Capacitor 8 (`android/`, `capacitor.config.ts`).
The APK always loads the bundled web build (no `server.url`, no cleartext:
the WebView origin is `https://localhost`).

| Setting | Value | Where |
| --- | --- | --- |
| Package (applicationId, namespace, appId) | `com.lumapasto.app` | `android/app/build.gradle`, `capacitor.config.ts`, `res/values/strings.xml` |
| Java package | `com.lumapasto.app` | `android/app/src/main/java/com/lumapasto/app/MainActivity.java` |
| App name | `Luma` | `strings.xml` (`app_name`) |
| Deep link | `luma://payments/return` | `AndroidManifest.xml` intent filter. Wompi returns to `public/pago-listo.html` (it only accepts https), which opens this link |

The package changed from `com.luma.app` in round 2: an APK built before it
installs as a different app (uninstall the old one), and the Firebase
Android app must be registered with `com.lumapasto.app` before downloading
`google-services.json` (docs/push.md).

## Requirements

- Node 24 and `npm ci`.
- Android SDK (Android Studio installs it; `android/local.properties` points
  to it and is gitignored).
- A JDK **17 to 24** (Gradle 8.14 does not run on newer ones). The scripts
  use `JAVA_HOME` when it is valid and compatible; otherwise Android Studio's
  JBR, or another installed JDK (Temurin, Microsoft, Oracle, Zulu), when its
  version fits. Recent Android Studio releases bundle JDK 25: install a JDK
  21 (e.g. Eclipse Temurin) or point `JAVA_HOME` to one.
- The public Supabase values: `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the
  anon/publishable key only; `generate-env.mjs` refuses service keys).

## Debug APK

```sh
export SUPABASE_URL=https://<project>.supabase.co
export SUPABASE_ANON_KEY=<anon key>
npm run apk:debug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Steps: deploy environment (`generate-env.mjs`), `ng build --configuration
production,deploy`, `npx cap sync android`, `gradlew assembleDebug`.
Install with `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

## Signed release APK

Create the keystore once and **back it up** (a password manager plus an
offline copy): losing it means the app can never be updated in the store.

```sh
keytool -genkeypair -v -keystore ~/keys/luma-release.jks -alias luma \
  -keyalg RSA -keysize 4096 -validity 10000
```

Never commit it (`.gitignore` blocks `*.jks`, `*.keystore` and
`keystore.properties`). Build with the four variables:

```sh
export LUMA_KEYSTORE_PATH=~/keys/luma-release.jks
export LUMA_KEYSTORE_PASSWORD=...
export LUMA_KEY_ALIAS=luma
export LUMA_KEY_PASSWORD=...
npm run apk:release
# → android/app/build/outputs/apk/release/app-release.apk
```

`android/app/build.gradle` reads them from the environment; without them a
release build is unsigned and the script refuses to start.

## Versions

`versionName` and `versionCode` come from `package.json` (`1.2.3` →
`10203`). Raise the version there before each release.

## What the app does natively

- **Back button** (`@capacitor/app`, `core/native/native-device.ts`): goes
  back in the app; on the first screen it closes the app.
- **Keyboard** (`@capacitor/keyboard`): the WebView resizes above the
  keyboard and the focused field scrolls into view.
- **Location**: `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` in the
  manifest, asked at runtime by `@capacitor/geolocation`: fused location with
  Google Play Services (and the system's "turn on location" dialog),
  `LocationManager` without them. Not `navigator.geolocation`: its low-accuracy
  read timed out on a phone with the permission and the GPS on. Approximate
  first, then GPS, then a refinement. Refused or off: the map says why and offers
  the settings (`LumaSettingsPlugin`). The last attempt, with no position, is in
  Admin → Información técnica.
- **Photos**: the system picker (`image/*`) needs no storage permission on any
  Android version; the picture is re-encoded before it is uploaded.
- **Manifest**: internet and location only, `allowBackup="false"` plus
  `data_extraction_rules.xml` (no cloud backup or device transfer of
  sessions), `usesCleartextTraffic="false"`.
- **Icon and splash**: `python docs/brand/icon-generator.py` and `icon-vectors.py`, from
  `assets/icon-source.png` (docs/brand/logo.md). Their output is committed; Pillow and numpy only to run them again.
- [ ] Install the debug APK; the icon and the splash look right.
- [ ] Sign up in steps, receive the code by email, verify.
- [ ] Allow location: the map centres on you; deny it: city centre.
- [ ] Back button: goes back; on the map it closes the app.
- [ ] Forms: the keyboard never hides the focused field.
- [ ] Place an order for pick-up and see it in Pedidos (owner account).
- [ ] Airplane mode: the app says there is no connection and recovers.
- [ ] Light and dark themes, larger system font.
- [ ] Release build: installs over nothing (new signature) and updates over
      itself.
