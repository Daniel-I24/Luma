# Security findings (repository and history)

Scan of 2026-10-26 (round 2, phase 5). Tools: `node scripts/secret-scan.mjs`
(tracked files, CI) and `npm run scan:history` (every line ever added in
every commit of every ref). Neither prints values. **History was not
rewritten**: rewriting would need a force push, which this round does not
do; the owner decides (see "What to do").

## Tree (what is tracked today)

Clean: no keys, keystores, service accounts, `.env` files, environment files
with real values, project references or personal e-mail addresses.
`src/environments/environment.ts` and `environment.deploy.ts` were never
committed.

## History

| Commit | Date | Files | Kind | Severity |
| --- | --- | --- | --- | --- |
| `911046d` | 2026-10-17 | `supabase/.temp/` (9 files: `project-ref`, `linked-project.json`, `pooler-url`, versions) | Supabase CLI link data: the project reference, the project name and the pooler host. **No key, no password.** | Low |
| `4823052` | — | `scripts/secret-scan.test.mjs` | Fake values of the scanner's own test (an `sb_secret_abc…` placeholder and a PEM header) | None (false positive) |
| `928c846` | — | `supabase/functions/push-dispatch/fcm.test.ts` | A PEM header around a key generated at run time with WebCrypto | None (false positive) |

`supabase/.temp/` was removed and ignored in `6ac085c` (same day), and
`scripts/secret-scan.mjs` now refuses it as a forbidden path.

### Impact of the project reference

The reference is the subdomain of the Supabase URL; it is also inside the
published web app (the client must know its project URL) and in every
anon-key request. Knowing it does not grant access: RLS, the anon/
authenticated grants and the Edge Function secrets protect the data. It
does make the pooler host known, so the database password must stay strong
and secret.

## Round 14 review (2026-11-07)

Every blob of every ref after `git fetch --all --prune` (9,197 blobs, 1,645 paths;
GitHub: `main`, `respaldo-verificacion`, 9 Dependabot branches) with the scanner's patterns
plus e-mails, Colombian mobile numbers, password literals and keystore fields:

- **No real secret was ever published.** `911046d` and `6ac085c` (`supabase/.temp/`) are now
  only in the local branches `backup-before-reauthor` and `backup-before-temp-cleanup`, not
  on GitHub; the pooler URL in them has no password.
- Private keys and `sb_secret_` matches are test fixtures (keys generated at run time).
- Password literals are test values in specs and e2e data; `build.gradle` reads the
  keystore passwords from environment variables.
- Phone numbers are synthetic (`300 123 4567` and similar); the rest are bytes of a PNG.
- E-mails in files are placeholders (`example.test`, `correo.com`, `luma.co`...). The two
  personal addresses appear **only as commit author and committer**, which GitHub shows on
  every commit. Rewriting authors needs a force push; for new commits use the GitHub
  `noreply` address (`git config user.email`).
- `.gitignore` and the secret scan also cover `luma-secrets/`, `*.env`,
  `wompi-sandbox.txt`, `*.p12`, `*.pfx` and `.angular/`.

Database (production, read-only): RLS on every public table; no table grant to `anon`
beyond public reads; the three owner-rights views filter by `auth.uid()` (orders) or the
public filter (reviews); `private` functions reachable by clients are pure validators.
Edge Functions without JWT check their own secret (Meta signature, `x-push-secret`, Wompi
checksum, `x-cron-secret` or an admin JWT with aal2). CORS answers 403 to unknown origins;
`reconcile-payments` had no CORS (fixed, pending deploy). Vercel serves CSP, HSTS,
`nosniff`, `DENY` and a strict referrer policy. Logs carry codes and counts only.
`npm audit --omit=dev`: 0. The 20 moderate advisories are in the lint toolchain and
`@capacitor/cli` (dev only, not in the app or the web).

## What to do (owner)

1. Nothing urgent: no secret was exposed.
2. Keep the database password strong; rotate it if it was ever shared in
   chat, e-mail or a screenshot (it never appears in this repository).
3. Optional, before making the repository public: rewrite history to drop
   `supabase/.temp/` (`git filter-repo --path supabase/.temp --invert-paths`)
   and force-push, coordinating with every clone. Not done here (no force
   push in this round).

## Repeat

```
node scripts/secret-scan.mjs        # tree, fails CI on a finding
npm run scan:history                # history, report only
```
