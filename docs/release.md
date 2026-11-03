# Releasing a new version

One version number for the web and the APK: `package.json` "version"
(`versionName`; `versionCode` = major*10000 + minor*100 + patch).

## 1. Bump the version (one commit)

- [ ] `package.json` "version" → e.g. `1.1.0` (`npm version 1.1.0 --no-git-tag-version`).
- [ ] `src/app/core/config/app-version.ts` → the same value.
- [ ] `public/version.json` → `"latest": "1.1.0"`; raise `"minimum"` only when
      older apps must stop (e.g. an incompatible database change).
- [ ] `npm run test:scripts` (checks the three stay equal) and the full
      verification of CLAUDE.md.

## 2. Web

- [ ] Push to `main`; Vercel builds it. Web users get the "Hay una versión
      nueva" banner and "Actualizar" reloads.

## Build variables (all of them)

Read by `npm run build:prod` (web) and `npm run apk:debug|release`
(scripts/apk.mjs, scripts/build-flags.mjs, scripts/generate-env.mjs). None of
them is written to the repository; an invalid value stops the build instead
of shipping a wrong one.

| Variable | Needed | Values | Default | What it does |
| --- | --- | --- | --- | --- |
| `SUPABASE_URL` | yes | `https://<ref>.supabase.co` | — | The project the app talks to (written to the gitignored `environment.deploy.ts`) |
| `SUPABASE_ANON_KEY` | yes | the public anon / publishable key | — | Client key; never `service_role` or a `sb_secret_` key |
| `AI_MODE` | no | `rules`, `remote` | `rules` | `remote` turns on Luma IA through the Edge Functions (docs/ai.md) |
| `PUSH_ENABLED` | no | `1`, `0` | on when `android/app/google-services.json` exists | Push notifications in the APK; `1` without the file fails (docs/push-setup.md) |
| `SUPPORT_WHATSAPP` | no | `57` + 10 digits, e.g. `573001234567` | empty | Luma's WhatsApp for the contact verification steps |
| `LEGAL_CONTACT_EMAIL` | no | an e-mail | empty ("por definir") | Contact e-mail of the legal texts and public pages |
| `LUMA_KEYSTORE_PATH` | release | path to the `.jks` | — | Release signing (never in git) |
| `LUMA_KEYSTORE_PASSWORD` | release | text | — | Keystore password |
| `LUMA_KEY_ALIAS` | release | text | — | Key alias |
| `LUMA_KEY_PASSWORD` | release | text | — | Key password |
| `JAVA_HOME` | no | a JDK 17 to 24 folder | detected (Android Studio JBR) | JDK for Gradle |

### Examples

PowerShell, one variable per line (short lines paste safely):

```powershell
$env:SUPABASE_URL = "https://<ref>.supabase.co"
$env:SUPABASE_ANON_KEY = "<anon key>"
$env:AI_MODE = "remote"
$env:SUPPORT_WHATSAPP = "573001234567"
$env:LEGAL_CONTACT_EMAIL = "hola@ejemplo.com"
npm run apk:debug
```

Or put them in `%USERPROFILE%\luma-secrets\app.env` (one `NAME=value` per
line) and use option 6 of `scripts\luma.ps1`, which builds (signed when the
four `LUMA_KEY*` are there) and installs on the phone:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
AI_MODE=remote
SUPPORT_WHATSAPP=573001234567
LEGAL_CONTACT_EMAIL=hola@ejemplo.com
LUMA_KEYSTORE_PATH=C:\keys\luma-release.jks
LUMA_KEYSTORE_PASSWORD=...
LUMA_KEY_ALIAS=luma
LUMA_KEY_PASSWORD=...
```

The web build (Vercel or local) takes the same variables except the
signing ones: `npm run build:prod`.

## 3. APK

Your keystore never enters the repository or CI ([android.md](android.md)).

```sh
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=<anon key>
export LUMA_KEYSTORE_PATH=~/keys/luma-release.jks
export LUMA_KEYSTORE_PASSWORD=...   # typed, never saved in shell history files you share
export LUMA_KEY_ALIAS=luma
export LUMA_KEY_PASSWORD=...
npm run apk:release
```

The last step runs `scripts/apk-verify.mjs`: `apksigner verify`, refusal of
the debug certificate, and `dist/apk-release.json` with the SHA-256, size and
signer digest. **The signer digest must be the same in every release**
(Android refuses updates signed with another key).

To rehearse the whole path without your keystore: `npm run apk:demo` (a
throwaway key in a temporary folder; the demo APK is deleted at the end and
must never be published).

## Test APK (debug), PowerShell, JDK 21

Checked on 2026-10-28: JDK 21 (Eclipse Adoptium), Android SDK 36, no
`google-services.json` → `android/app/build/outputs/apk/debug/app-debug.apk`,
package `com.lumapasto.app`, version 1.0.0 (code 10000).

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"   # your JDK 21 folder
$env:SUPABASE_URL = "https://<ref>.supabase.co"
$env:SUPABASE_ANON_KEY = "<anon key>"            # the public anon key, never service_role
npm ci
npm run apk:debug
adb install -r android\app\build\outputs\apk\debug\app-debug.apk   # phone with USB debugging
```

`apk:debug` writes `src/environments/environment.deploy.ts` from the two
variables (gitignored), builds `production,deploy`, runs `npx cap sync
android` and `gradlew assembleDebug`.

What the test APK does without optional services:

- **No `google-services.json`**: Gradle skips the Google Services plugin
  (a log line says so) and push stays off (`PUSH_ENABLED = false`); the app
  never initialises Firebase, so it cannot crash on it.
- **Database without the round 2 migrations**: the profile read fails with
  a missing column and the app shows "El servidor de Luma aún no tiene la
  actualización…" with Reintentar / Cerrar sesión (`/account-error`),
  never a blank screen.
- **Entry animation**: ends as soon as the session and first screen are
  ready (at most 1.8 s the first time, 0.9 s later; a tap skips it); the
  native splash waits for the page at most 1.5 s.

Typical errors:

| Message | Fix |
| --- | --- |
| `No JDK 17-24 found: set JAVA_HOME` | Install JDK 21 (Adoptium) and set `$env:JAVA_HOME` as above |
| `Unsupported class file major version 69` / Gradle fails to start | JAVA_HOME points to JDK 25; use 21 |
| `SDK location not found` | Create `android\local.properties` with `sdk.dir=C:\Users\<you>\AppData\Local\Android\Sdk`, or open the `android` folder once in Android Studio |
| `SUPABASE_URL and SUPABASE_ANON_KEY are required.` | Set both variables in the same PowerShell window |
| `'.\gradlew.bat' is not recognized` | Run from the repository root (`npm run apk:debug`), not from `android` |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` on `adb install` | An APK signed with another key is installed: `adb uninstall com.lumapasto.app` |
| White screen after install | Old web assets: run `npx cap sync android` again (apk:debug already does) |

## 4. Publish the APK

- [ ] Upload `android/app/build/outputs/apk/release/app-release.apk` as
      `luma-<version>.apk` (e.g. a GitHub Release of this repository).
- [ ] Add to `public/version.json`, with the values of `dist/apk-release.json`:

      "apk": { "url": "https://…/luma-1.1.0.apk", "sha256": "<64 hex>", "size": <bytes> }

- [ ] Commit and push: `/download` shows the button and the SHA-256; APK
      users see "Descargar" (when `UPDATE_SITE_URL` is set).
- [ ] Install over the previous version on a phone (the update must succeed:
      same key) and run the QA smoke in [qa-checklist.md](qa-checklist.md).

## 5. Database or functions in the release?

After the freeze, only bug fixes ([migrations.md](migrations.md)): apply them
before the web/APK that needs them, and redeploy the changed functions. Run
`npm run verify:backend` afterwards.
