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
| Reset the password | `/auth/forgot-password` | `resetPasswordForEmail(email)`, then `verifyOtp({ type: 'recovery' })` and `updateUser({ password })` |

The client keeps `detectSessionInUrl: false` and sends no `emailRedirectTo`;
there are no callback routes. Messages never reveal whether an email has an
account (sign-up, resend and recovery always continue to the next step; only
rate-limit and network errors are shown).

## Where to paste the templates

Supabase Dashboard → **Authentication → Emails → Templates** (same texts in
`supabase/config.toml` if you use the CLI locally). Make sure **Confirm email**
is enabled (Authentication → Sign In / Providers → Email).

### Confirm signup

Subject: `Tu código de Luma: {{ .Token }}`

```html
<h2>Confirma tu cuenta de Luma</h2>
<p>Escribe este código en la app para terminar tu registro:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>Caduca en una hora. Si no creaste una cuenta en Luma, ignora este correo.</p>
```

### Reset password

Subject: `Código para cambiar tu contraseña de Luma: {{ .Token }}`

```html
<h2>Cambia tu contraseña de Luma</h2>
<p>Escribe este código en la app junto a tu nueva contraseña:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>Caduca en una hora. Si no lo pediste, ignora este correo: tu contraseña no cambia.</p>
```

Neither template may contain `{{ .ConfirmationURL }}`. Keep the OTP length at
6 digits (Authentication → Emails → "Email OTP length") and the expiry at one
hour or less.

## Important: the default email sender is for testing only

Supabase's built-in email service sends only a few emails per hour and only to
the project's team addresses. **Real users need your own SMTP** (Authentication
→ Emails → SMTP Settings): a transactional provider (for example Amazon SES,
Brevo, Postmark or Resend) with a domain you control and SPF, DKIM and DMARC
records, or the codes will not arrive or will land in spam.
