import { environment } from '../../../environments/environment';

/** EnvironmentCheck — detects template values in the environment file. */
export class EnvironmentCheck {
  /**
   * True while the environment still has the template values
   * (environment.example.ts): the app cannot reach Supabase. Development
   * builds show a notice so this is not mistaken for a network failure.
   */
  public static usesPlaceholderConfig(
    config: { supabase: { url: string; anonKey: string } } = environment,
  ): boolean {
    return (
      config.supabase.url.includes('placeholder.supabase.co') ||
      config.supabase.anonKey.startsWith('placeholder')
    );
  }
}

