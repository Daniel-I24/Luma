# Android APK

Luma ships to Android with Capacitor 8 (`android/`, `capacitor.config.ts`).
The APK always loads the bundled web build (no `server.url`, no cleartext:
the WebView origin is `https://localhost`).

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

- **Back button** (`@capacitor/app`, `core/native/native-shell.ts`): goes
  back in the app; on the first screen it closes the app.
- **Keyboard** (`@capacitor/keyboard`): the WebView resizes above the
  keyboard and the focused field scrolls into view.
- **Location**: `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` in the
  manifest; the WebView asks at runtime through Capacitor's
  `BridgeWebChromeClient`, so `navigator.geolocation` works without an extra
  plugin. Denying it keeps the city centre.
- **Manifest**: internet and location only, `allowBackup="false"` plus
  `data_extraction_rules.xml` (no cloud backup or device transfer of
  sessions), `usesCleartextTraffic="false"`.
- **Icon and splash**: generated from `assets/logo.svg` (brand mark on the
  Indigo primary) with
  `npx @capacitor/assets@3.0.5 generate --android --iconBackgroundColor '#14174a' --splashBackgroundColor '#14174a'`.
  The tool is run on demand and is not a project dependency (it pulls in
  packages with known vulnerabilities).

## Content Security Policy

Evaluated and **not added** as a `<meta>` for now: `connect-src` must list the
project's Supabase URL (different per environment) and the map tile hosts,
and a wrong policy breaks the app silently. The APK only loads bundled files
over `https://localhost` and Android blocks cleartext, which covers the main
risks. If wanted, generate the meta at build time next to
`environment.deploy.ts` (`generate-env.mjs`) with `default-src 'self'`,
`connect-src` for Supabase and the tiles, and `img-src` for Storage.

## Checklist on a phone

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
