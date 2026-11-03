import { InjectionToken } from '@angular/core';

/*
 * Switches of the app that are not secrets (the ones only lazy screens read;
 * PUSH_ENABLED and UPDATE_SITE_URL live with their services). The build sets
 * the first three (scripts/build-flags.mjs: `ng build --define`); without a
 * define every one keeps its safe default. None of them lives in the
 * environment files, which hold real keys and are not edited by tooling.
 */
declare const LUMA_AI_MODE: string | undefined;
declare const LUMA_SUPPORT_WHATSAPP: string | undefined;
declare const LUMA_CONTACT_EMAIL: string | undefined;

/**
 * How Luma IA runs: "rules" (in the app, no external service) or "remote"
 * (Edge Functions recommend, suggest-promotions and extract-menu with the
 * LLM gateway, falling back to the rules on any failure). AI_MODE=remote
 * at build time; rules otherwise (docs/ai.md, "Comprobar cada caso").
 */
export type AiMode = 'rules' | 'remote';

/** AiModes — the mode this bundle was built with. */
export class AiModes {
  /** "remote" only when the build defined LUMA_AI_MODE='remote'. */
  public static built(): AiMode {
    return typeof LUMA_AI_MODE !== 'undefined' && LUMA_AI_MODE === 'remote' ? 'remote' : 'rules';
  }
}

export const AI_MODE = new InjectionToken<AiMode>('AI_MODE', { providedIn: 'root', factory: AiModes.built });

/**
 * WhatsApp number of Luma support in E.164 without "+" (e.g. 573001234567),
 * where owners send their contact verification codes from their own phone
 * or WhatsApp. Empty: not configured yet; the verification steps say so and
 * the request waits for the team. SUPPORT_WHATSAPP=57… at build time
 * (docs/whatsapp-setup.md).
 */
export const SUPPORT_WHATSAPP = new InjectionToken<string>('SUPPORT_WHATSAPP', {
  providedIn: 'root',
  factory: () => (typeof LUMA_SUPPORT_WHATSAPP !== 'undefined' && /^57[0-9]{10}$/.test(LUMA_SUPPORT_WHATSAPP) ? LUMA_SUPPORT_WHATSAPP : ''),
});

/**
 * The contact e-mail of the legal texts (privacy requests, refunds, data
 * deletion). LEGAL_CONTACT_EMAIL at build time; empty → the texts say it is
 * still to be defined.
 */
export const CONTACT_EMAIL = new InjectionToken<string>('CONTACT_EMAIL', {
  providedIn: 'root',
  factory: () => (typeof LUMA_CONTACT_EMAIL !== 'undefined' ? LUMA_CONTACT_EMAIL : ''),
});

/**
 * Phone verification by SMS code (docs/phone-verification.md). Off: the app
 * never asks for a code and nothing changes. Turn it on only together with
 * app_settings.require_phone_verification and a Supabase Phone provider.
 */
export const PHONE_VERIFICATION_ENABLED = new InjectionToken<boolean>('PHONE_VERIFICATION_ENABLED', {
  providedIn: 'root',
  factory: () => false,
});

