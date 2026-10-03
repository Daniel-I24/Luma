/**
 * Production environment configuration.
 * Replaced at build time via angular.json fileReplacements.
 * Actual values must come from CI/CD secrets — never commit real keys.
 */
export const environment = {
  production: true,
  supabase: {
    url: 'https://placeholder.supabase.co',
    anonKey: 'placeholder-anon-key',
  },
} as const;
