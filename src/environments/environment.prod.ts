/**
 * Production environment with placeholders (committed). CI and plain
 * `ng build` use it as is; Vercel runs `npm run build:prod`, which writes the
 * gitignored environment.deploy.ts and swaps it in (`deploy` configuration).
 * Never put real keys here.
 */
export const environment = {
  production: true,
  supabase: {
    url: 'https://placeholder.supabase.co',
    anonKey: 'placeholder-anon-key',
  },
} as const;
