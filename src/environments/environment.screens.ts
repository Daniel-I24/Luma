/**
 * Screen review build (`ng build --configuration screens`): an invented,
 * unreachable project. scripts/screens/capture.mjs answers its API with
 * fixtures; nothing leaves the machine. Never a real URL or key here.
 */
export const environment = {
  production: false,
  supabase: {
    url: 'https://screens.invalid',
    anonKey: 'screens-anon-key',
  },
} as const;
