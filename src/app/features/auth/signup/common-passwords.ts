/**
 * Short list of very common passwords that pass the length and
 * letters-and-numbers rule (compared lowercase). Not exhaustive: it stops
 * the most guessed ones; Supabase's leaked-password protection can add more.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password1',
  'password12',
  'password123',
  'passw0rd',
  'qwerty123',
  'qwerty1234',
  'abc12345',
  'abcd1234',
  'a1b2c3d4',
  '1q2w3e4r',
  '1qaz2wsx',
  'iloveyou1',
  'welcome1',
  'admin123',
  'letmein1',
  'colombia1',
  'colombia123',
  'contrasena1',
  'contrasena123',
  'clave1234',
  'luma1234',
  'luma12345',
  'teamo123',
  'hola1234',
  'pasto123',
]);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.trim().toLowerCase());
}
