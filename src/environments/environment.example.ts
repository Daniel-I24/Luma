/**
 * Development environment configuration.
 * Values are read from environment variables at build time via Angular's
 * fileReplacements mechanism. Never hardcode real keys here.
 */
export const environment = {
  production: false,
  supabase: {
    url: 'https://placeholder.supabase.co',
    anonKey: 'placeholder-anon-key',
  },
} as const;
