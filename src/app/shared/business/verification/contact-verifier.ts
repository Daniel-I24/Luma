import type { ContactKind } from './contact-verification';

/** How a kind of contact is proved (contact_verifier_config, migration 53). */
export type VerifierStrategy = 'whatsapp' | 'website' | 'manual';

/** What the owner's screen does for one strategy. */
export interface ContactVerifier {
  readonly strategy: VerifierStrategy;
  /** Translation key of the steps under contactVerification.steps. */
  readonly stepsKey: string;
  /** True when the server verifies it by itself and the screen watches the state. */
  readonly automatic: boolean;
}

/** WhatsAppInboundVerifier — the owner sends the code from that number; whatsapp-webhook verifies it. */
class WhatsAppInboundVerifier implements ContactVerifier {
  public readonly strategy = 'whatsapp' as const;
  public readonly stepsKey = 'whatsappAuto';
  public readonly automatic = true;
}

/** WebsiteFileVerifier — the code at /.well-known/luma-verification.txt; verify-website checks it. */
class WebsiteFileVerifier implements ContactVerifier {
  public readonly strategy = 'website' as const;
  public readonly stepsKey = 'websiteAuto';
  public readonly automatic = true;
}

/** ManualAdminVerifier — a person of the team checks it from the admin queue. */
class ManualAdminVerifier implements ContactVerifier {
  public readonly strategy = 'manual' as const;
  public readonly stepsKey = 'manual';
  public readonly automatic = false;
}

const VERIFIERS: Readonly<Record<VerifierStrategy, ContactVerifier>> = {
  whatsapp: new WhatsAppInboundVerifier(),
  website: new WebsiteFileVerifier(),
  manual: new ManualAdminVerifier(),
};

/** Kinds the automatic strategies may cover; the rest always go to the admin queue. */
const AUTOMATIC_FOR: Readonly<Record<ContactKind, VerifierStrategy | null>> = {
  phone: 'whatsapp', whatsapp: 'whatsapp', website: 'website', instagram: null, facebook: null,
};

/** Where WebsiteFileVerifier (and verify-website) look for the code. */
const VERIFICATION_FILE = '/.well-known/luma-verification.txt';
/** Colombian landlines (60 + area): they cannot send a WhatsApp from the number itself. */
const LANDLINE = /^(?:\+?57)?60\d{8}$/;

/**
 * ContactVerifiers — the verifier of each kind from the server's
 * configuration. A kind whose automatic strategy is off, unknown or not
 * allowed for it falls back to the manual queue, so nothing breaks.
 */
export class ContactVerifiers {
  /** The verifier of a kind under the server's configuration. */
  public static for(kind: ContactKind, config: Partial<Record<ContactKind, VerifierStrategy>>): ContactVerifier {
    const wanted = config[kind];
    return wanted && wanted === AUTOMATIC_FOR[kind] ? VERIFIERS[wanted] : VERIFIERS.manual;
  }

  /** The verification file of a website: always at the root of its own https origin. */
  public static fileUrl(website: string): string {
    try {
      return new URL(VERIFICATION_FILE, new URL(website).origin).href;
    } catch {
      return website;
    }
  }

  /** The website itself, only when it is an http(s) address the reviewer can open safely. */
  public static siteUrl(website: string): string | null {
    try {
      const url = new URL(website);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
      return null;
    }
  }

  /** A fixed line: no WhatsApp, so no automatic verification and no badge. */
  public static isLandline(value: string): boolean {
    return LANDLINE.test(value.replace(/[^0-9+]/g, ''));
  }
}
