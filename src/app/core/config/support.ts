import { InjectionToken } from '@angular/core';

/**
 * WhatsApp number of Luma support in E.164 without "+" (e.g. 573001234567),
 * where owners send their contact verification codes from their own phone
 * or WhatsApp. Empty: not configured yet; the verification steps say so.
 * Configure it in app.config.ts: { provide: SUPPORT_WHATSAPP, useValue: '57…' }.
 */
export const SUPPORT_WHATSAPP = new InjectionToken<string>('SUPPORT_WHATSAPP', {
  providedIn: 'root',
  factory: () => '',
});
