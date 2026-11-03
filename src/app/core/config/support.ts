import { InjectionToken } from '@angular/core';

declare const LUMA_SUPPORT_WHATSAPP: string | undefined;
declare const LUMA_CONTACT_EMAIL: string | undefined;

/**
 * The contact e-mail of the legal texts (privacy requests, refunds, data
 * deletion). Set by the build: LEGAL_CONTACT_EMAIL (scripts/build-flags.mjs);
 * empty → the texts say it is still to be defined.
 */
export const CONTACT_EMAIL = new InjectionToken<string>('CONTACT_EMAIL', {
  providedIn: 'root',
  factory: () => (typeof LUMA_CONTACT_EMAIL !== 'undefined' ? LUMA_CONTACT_EMAIL : ''),
});

/**
 * WhatsApp number of Luma support in E.164 without "+" (e.g. 573001234567),
 * where owners send their contact verification codes from their own phone
 * or WhatsApp. Empty: not configured yet; the verification steps say so and
 * the request waits for the team. Set by the build: SUPPORT_WHATSAPP=57…
 * (scripts/build-flags.mjs, docs/whatsapp-setup.md).
 */
export const SUPPORT_WHATSAPP = new InjectionToken<string>('SUPPORT_WHATSAPP', {
  providedIn: 'root',
  factory: () => (typeof LUMA_SUPPORT_WHATSAPP !== 'undefined' && /^57[0-9]{10}$/.test(LUMA_SUPPORT_WHATSAPP) ? LUMA_SUPPORT_WHATSAPP : ''),
});
