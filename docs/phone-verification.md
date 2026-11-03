# Phone verification

Proves that a customer or owner controls the mobile in their profile. It
costs nothing while it is off or in demo mode. No CAPTCHA today.

## Switches

| Switch | Where | Default |
| --- | --- | --- |
| App flag | `PHONE_VERIFICATION_ENABLED` in `src/app/core/config/build-flags.ts` (not in the environment files) | `false` |
| Database requirement | `app_settings.require_phone_verification` | `0` |

Both off: nothing changes. The app never asks for a code, the user edits
the mobile freely in "Mis datos", and `phone_check_passed()` is true for
everyone.

Requirement on (`= 1`):

- `create_order`, `become_business_owner` and `submit_business_for_review`
  refuse with `phone_not_verified` (the app shows "Verifica tu número de
  celular…").
- `profiles.phone` can change only to the number confirmed in
  `auth.users` (trigger `profiles_phone_guard`, migration
  `20261031000000_phone_verification`). The flow: Supabase sends an SMS
  code (`auth.updateUser({ phone })`), the app checks it
  (`auth.verifyOtp({ type: 'phone_change' })`) and calls
  `sync_verified_phone()`.
- Turn the app flag on at the same time, or users cannot verify.

Tests: `supabase/tests/phone_verification.sql`, `customer_profile.sql`,
`src/app/shared/account/phone-verification/phone-verification.spec.ts`.

## Mode 1: off (today)

Nothing to do. Keep both switches at their defaults.

## Mode 2: demo (no real SMS)

For a demonstration with chosen numbers only:

1. Supabase dashboard → Authentication → Sign In / Providers → Phone:
   enable it and add **test phone numbers** with fixed codes, e.g.
   `573001234567=123456`. Supabase never sends an SMS to a test number.
   The dashboard may still ask you to choose an SMS provider before it
   enables Phone; do not enter a paid account for a demo. If it cannot be
   enabled without one, stay in mode 1.
2. In the SQL editor:
   `update public.app_settings set int_value = 1 where key = 'require_phone_verification';`
3. Build the app with `PHONE_VERIFICATION_ENABLED` set to `true`.
4. Use only the test numbers. When the demo ends, set the value back to 0
   and rebuild with the flag off.

## Mode 3: if there is a budget one day

- An SMS provider in Supabase (Twilio, MessageBird, Vonage, Textlocal),
  with a **monthly spending cap** set in the provider's console.
- **Colombia only**: in the provider, allow only `+57` destinations
  (geo-permissions), so SMS-pumping fraud cannot send abroad.
- **CAPTCHA** (Supabase → Attack Protection, hCaptcha or Turnstile) before
  sending codes, wired in the app at that time.
- **Rate limits**: Supabase → Rate Limits for SMS (per hour) and the OTP
  resend interval (60 s or more); the codes expire in 600 s.
- Then follow mode 2 steps 2 and 3 without test numbers.
