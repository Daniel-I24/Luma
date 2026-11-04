# Auth emails: 6-digit codes, no links

Links in emails broke on phones: they pointed to `localhost`, mail scanners
"clicked" them and used them up, and the Android app has no deep links. Luma
therefore confirms accounts and resets passwords with the **6-digit code** that
Supabase puts in `{{ .Token }}`:

| Flow | App screen | Supabase call |
| --- | --- | --- |
| Confirm a new account | `/auth/verify` | `verifyOtp({ email, token, type: 'signup' })` |
| Resend the sign-up code (every 60 s) | `/auth/verify` | `resend({ type: 'signup', email })` |
| Sign in with an unconfirmed email | `/auth/login` → "Verificar mi correo" | `resend` then `/auth/verify` |
| Reset the password (3 steps) | `/auth/forgot-password` | 1. `resetPasswordForEmail(email)`; 2. `verifyOtp({ type: 'recovery' })` checks the code **before** the new password is asked for ("Reenviar código" after 60 s); 3. `updateUser({ password })` with confirmation and the live checklist |
| Delete the account (signed in) | Profile / Mi negocio → "Eliminar cuenta" | consequences first, then `signInWithOtp({ email, options: { shouldCreateUser: false } })` e-mails a code, `verifyOtp({ email, token, type: 'email' })` starts a fresh session, and only then `delete-account` runs (it refuses sessions older than 10 minutes: `reauth_required`) |
| Change the password (signed in) | `/account/password` | current password checked with `signInWithPassword`, then `reauthenticate()` e-mails a code and `updateUser({ password, nonce: code })` saves it |

The client keeps `detectSessionInUrl: false` and sends no `emailRedirectTo`;
there are no callback routes. Messages never reveal whether an email has an
account (sign-up, resend and recovery always continue to the next step; only
rate-limit and network errors are shown).

## Where to paste the templates

Supabase Dashboard → **Authentication → Emails → Templates**.
Make sure **Confirm email**
is enabled (Authentication → Sign In / Providers → Email).

### Confirm signup

Subject: `Tu código de Luma: {{ .Token }}`

```html
<h2>Confirma tu cuenta de Luma</h2>
<p>Escribe este código en la app para terminar tu registro:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>Caduca en 10 minutos. Si no creaste una cuenta en Luma, ignora este correo.</p>
```

### Reset password

Subject: `Código para cambiar tu contraseña de Luma: {{ .Token }}`

```html
<h2>Cambia tu contraseña de Luma</h2>
<p>Escribe este código en la app; después eliges tu nueva contraseña:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>Caduca en 10 minutos. Si no lo pediste, ignora este correo: tu contraseña no cambia.</p>
```

### Reauthentication

Subject: `Código para confirmar el cambio de contraseña: {{ .Token }}`

```html
<h2>Confirma que eres tú</h2>
<p>Pediste cambiar la contraseña de tu cuenta de Luma. Escribe este código en la app:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>Caduca en 10 minutos. Si no fuiste tú, cambia tu contraseña y no compartas este código.</p>
```

### Magic Link (used to confirm an account deletion)

`signInWithOtp` sends the **Magic Link** template. It MUST carry
`{{ .Token }}` (the app asks for the 6-digit code; there is no link to follow).

Subject: `Código para eliminar tu cuenta de Luma: {{ .Token }}`

```html
<h2>Confirma que quieres eliminar tu cuenta</h2>
<p>Escribe este código en la app para eliminar tu cuenta de Luma de forma permanente:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>Caduca en 10 minutos. Si no lo pediste, ignora este correo: tu cuenta sigue intacta.</p>
```

Each delete-account failure has its own message in the app: no connection
(`errors.offline` / `errors.serviceUnavailable`), session expired (401), code
too old (`reauth_required`), function not deployed or origin not allowed
(`auth.errors.deleteAccountUnavailable`) and a server failure (5xx,
`auth.errors.deleteAccountServer`).

No template may contain `{{ .ConfirmationURL }}`.

## Supabase settings

| Setting | Where | Value |
| --- | --- | --- |
| Email OTP length | Authentication → Emails (or Providers → Email) | 6 digits |
| Email OTP expiration | same | 600 seconds |
| Confirm email | Authentication → Sign In / Providers → Email | on |
| Secure password change | Authentication → Sign In / Providers → Email | on (the app always sends the reauthentication code) |
| Minimum password length | Authentication → Sign In / Providers → Email → Password | 8 |
| Password requirements | same | **Lowercase, uppercase letters and digits** (must be the same rule as the app's `PasswordRules`) |
| TOTP (MFA) | Authentication → Multi-Factor | enabled (admins enrol at `/admin/mfa`) |
| Limit AAL1 sessions / enforce MFA for enrolled users | Authentication → Multi-Factor (or Sessions) | on: a user with a factor cannot keep a session without the second step |

## Error messages in the app

Supabase answers the same error for a wrong and for an expired code. In the
password recovery the app tells them apart by the time since the code was
sent (more than 10 minutes: "El código venció"; otherwise "El código no es
correcto"); after 5 wrong codes, or a Supabase rate limit, it asks for a new
code ("Demasiados intentos"). The other flows show one message for both;
rate limits and "only request this after N seconds" show "Demasiados
intentos…"; a malformed code is refused before any request ("Escribe los 6
dígitos del código"). Mapping: `src/app/core/auth/auth-error.ts`.

## Password rule (one rule, three forms)

`src/app/core/validation/password-rules.ts` (`PasswordRules`) is used by the
sign-up, the change (`/account/password`) and the recovery, with a live
checklist (`PasswordChecklist`) and shared test vectors
(`src/testing/password-vectors.ts`):

- Required: 8 to 72 characters, an uppercase letter, a lowercase letter and a
  digit (ASCII classes, exactly like Supabase's "Lowercase, uppercase letters
  and digits"). The zod schema of the initial bundle checks these parts
  (`PasswordPolicy`); Supabase checks them again.
- Refused: a password that contains the local part of the account's e-mail
  (3+ characters) or is one of the 200 common passwords of
  `common-passwords.ts`.
- Recommended (strength "Fuerte"): 12 characters or a symbol.

Existing passwords keep working at sign-in; the rule applies to new ones.
**Set the Supabase rule to the same value** (table above), or Supabase and
the app would disagree.

## Important: the default email sender is for testing only

Supabase's built-in email service sends only a few emails per hour and only to
the project's team addresses. **Real users need your own SMTP** (Authentication
→ Emails → SMTP Settings): a transactional provider (for example Amazon SES,
Brevo, Postmark or Resend) with a domain you control and SPF, DKIM and DMARC
records, or the codes will not arrive or will land in spam.
