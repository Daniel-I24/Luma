import { environment } from '../../../environments/environment';

/**
 * True while the environment still has the template values
 * (environment.example.ts): the app cannot reach Supabase. Development
 * builds show a notice so this is not mistaken for a network failure.
 */
export function usesPlaceholderConfig(
  config: { supabase: { url: string; anonKey: string } } = environment,
): boolean {
  return (
    config.supabase.url.includes('placeholder.supabase.co') ||
    config.supabase.anonKey.startsWith('placeholder')
  );
}
