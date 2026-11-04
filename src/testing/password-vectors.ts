/**
 * Password vectors shared by every spec of a new-password form (sign-up,
 * change, recovery) and by PasswordRules itself: same rule everywhere.
 */
export const PASSWORD_VECTORS = {
  email: 'ana.perez@correo.com',
  /** Saved as they are. */
  valid: ['Tamal2024', 'Pastuso-Frio7', 'Ñame con Ajo 9z', 'CuyAsado2026x'],
  /** Refused, with the translation key of the reason. */
  invalid: [
    ['', 'auth.validation.passwordWeak'],
    ['Corta1', 'auth.validation.passwordWeak'],
    ['tamal2024', 'auth.validation.passwordWeak'],
    ['TAMAL2024', 'auth.validation.passwordWeak'],
    ['TamalPastuso', 'auth.validation.passwordWeak'],
    ['Password123', 'auth.password.refusal.common'],
    ['Colombia2026', 'auth.password.refusal.common'],
    ['Ana.Perez2026', 'auth.password.refusal.containsEmail'],
  ],
} as const;
