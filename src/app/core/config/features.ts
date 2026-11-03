import { InjectionToken } from '@angular/core';

/**
 * Phone verification by SMS code (docs/phone-verification.md). Off: the app
 * never asks for a code and nothing changes. Turn it on only together with
 * app_settings.require_phone_verification and a Supabase Phone provider
 * (demo test numbers or a paid SMS provider). Lives here and not in the
 * environment files, which hold real keys and are not edited by tooling.
 */
export const PHONE_VERIFICATION_ENABLED = new InjectionToken<boolean>('PHONE_VERIFICATION_ENABLED', {
  providedIn: 'root',
  factory: () => false,
});
