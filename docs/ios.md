# iOS: compile and install on a Mac

The Xcode project is in `ios/`, generated with Capacitor and prepared from Windows. **It has
never been compiled or opened in Xcode**: nothing in this guide has been tested on an iPhone
yet. A user with an iPhone can already use the web version (add it to the home screen).

## What is already prepared

| Piece | Where |
| --- | --- |
| Permission texts: location while in use, photos, camera | `ios/App/App/Info.plist` |
| Return from Wompi (`luma://payments/return`) | `CFBundleURLTypes` in `Info.plist` |
| Background notifications mode | `UIBackgroundModes` in `Info.plist` |
| FCM token instead of the APNs one | `ios/App/App/AppDelegate.swift` (active once Firebase is added) |
| Icon and splash | `ios/App/App/Assets.xcassets` (from the Android mark, `#120428` background) |
| Location (Core Location) | `@capacitor/geolocation`, included by `cap sync` |

## What you need

- A Mac with the current Xcode, Node.js 24 and npm 11.
- An Apple account. **Free:** installs on your own iPhone for 7 days, **without notifications**.
- **Apple Developer Program (99 USD a year):** needed for notifications (APNs key), TestFlight and
  the App Store.
- The values of `app.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY` and the optional ones). Never put
  them in the repository.

## 1. Compile and install

```sh
git clone https://github.com/Daniel-I24/Luma.git && cd Luma
npm ci
cp src/environments/environment.example.ts src/environments/environment.ts
export SUPABASE_URL='https://<ref>.supabase.co' SUPABASE_ANON_KEY='<anon key>' AI_MODE=remote
npm run ios:sync
npx cap open ios
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → choose your **Team**. If the bundle id
   `com.lumapasto.app` is taken for your account, use another and also change it in Firebase.
2. Connect the iPhone, turn on **Developer Mode** (Settings → Privacy & Security), choose it as the
   destination and press **Run**.
3. On the iPhone, trust the certificate: Settings → General → VPN & Device Management.

Check: Luma opens and you can sign in.

## 2. The server must accept the app

The iOS app's origin is `capacitor://localhost`. Option 3 or 8 of `scripts\luma.ps1` (Windows)
loads it in `ALLOWED_ORIGINS`. Without it, Edge Functions (AI, payments, routes) fail with CORS.

## 3. Notifications (needs the paid program)

1. Apple Developer → Keys → create a key with **Apple Push Notifications service**; download the
   `.p8` and keep it out of the repository.
2. Firebase console → project settings → add an **iOS app** with the same bundle id → download
   `GoogleService-Info.plist` to `ios/App/App/` (gitignored) and add it to the App target in Xcode.
3. Firebase → Cloud Messaging → Apple app configuration → upload the `.p8` with its Key ID and Team ID.
4. Xcode → File → Add Package Dependencies → `https://github.com/firebase/firebase-ios-sdk` → add
   **FirebaseMessaging** to the App target.
5. Xcode → Signing & Capabilities → **+ Capability** → **Push Notifications**.
6. Run again with `PUSH_ENABLED=1` in the environment: `npm run ios:sync`.

The token is stored with platform `android` because `device_tokens` accepts only `android` and
`web`, and `push-dispatch` sends every token through FCM alike. A migration can add `ios` if
the two platforms ever need different treatment.

Check: in Perfil, turn the notifications on, accept, and send a test from Admin → Operaciones.

## 4. What is left to test on a real iPhone

- [ ] It compiles with the current Xcode, and the Swift Package dependencies resolve.
- [ ] Sign-in, map (WebGL), themes, notch and home indicator.
- [ ] Location: allow once, allow while using, precise off, denied, and Location Services off.
- [ ] Photo from the library and from the camera (HEIC is delivered as JPEG).
- [ ] Wompi: paying in the system browser and returning through `pago-listo.html` to `luma://`.
- [ ] Notifications with the app open, in the background and closed; tapping one opens the order.
- [ ] The keyboard does not cover the fields.

For the App Store: privacy nutrition labels, screenshots and the account deletion path (already in
Perfil), reviewed by Apple.
