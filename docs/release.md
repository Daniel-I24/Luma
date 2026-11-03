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
