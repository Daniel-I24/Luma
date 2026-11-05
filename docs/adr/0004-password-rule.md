# 0004 — One password rule, equal to Supabase's

**Decision.** `PasswordRules` (8–72 characters, ASCII uppercase, lowercase
and digit; not the e-mail's local part nor one of 200 common passwords) is
used by sign-up, change and recovery, with shared test vectors; Supabase's
"Password requirements" is set to "Lowercase, uppercase letters and digits".
The initial bundle only carries the required parts (`PasswordPolicy`).

**Consequences.** App and server never disagree; old passwords still sign in.
