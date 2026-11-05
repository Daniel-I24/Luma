# 0003 — Only errors the user can act on reach the global notice

**Context.** "Algo salió mal" appeared on sign-in for failures the user could
not fix (a realtime channel, push plugins).

**Decision.** `AppErrorHandler` shows a notice only for a `UserFacingError`
(its own message) or a screen that failed to download. Every error goes to
`ErrorLog` (last 20, masked: no e-mails, phones, ids or tokens), visible in
"Información técnica" and handed to an `ErrorReporter` (none by default).
Realtime and push never throw: they degrade quietly.

**Consequences.** A real bug may now fail silently on screen; support asks
for "Copiar errores". A crash reporter can be plugged in without touching
the screens.
