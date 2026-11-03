import { Phone } from '@shared/account/phone';
import { ExternalUrls } from '@core/config/external-urls';

/** The public contact of a business, as stored (mirrors the business_showcase CHECKs). */
export interface BusinessContact {
  readonly whatsapp: string | null;
  readonly instagram: string | null;
  readonly facebook: string | null;
  readonly website: string | null;
}

export type ContactField = keyof BusinessContact;
export type ContactErrors = Partial<Record<ContactField, string>>;

const V = 'businessPanel.validation.contact';
const INSTAGRAM = /^[a-z0-9._]{1,30}$/;
const FACEBOOK = /^[A-Za-z0-9.-]{2,80}$/;
const WEBSITE = /^https:\/\/[^\s/$.?#][^\s]*$/i;

const MAX_WEBSITE_LENGTH = 200;
const CONTACT_FIELDS: readonly ContactField[] = ['whatsapp', 'instagram', 'facebook', 'website'];

const blank = (value: string): boolean => value.trim() === '';
const orNull = (value: string): string | null => (value === '' ? null : value);

/** How each channel is cleaned up and checked (inputs are never blank here). */
const CHANNELS: Readonly<Record<ContactField, { normalize(raw: string): string | null; valid(value: string): boolean }>> = {
  whatsapp: { normalize: (raw) => Phone.parse(raw)?.e164 ?? null, valid: () => true },
  instagram: {
    normalize: (raw) =>
      orNull(
        raw.trim().replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').toLowerCase(),
      ),
    valid: (value) => INSTAGRAM.test(value),
  },
  facebook: {
    normalize: (raw) => orNull(raw.trim().replace(/^(https?:\/\/)?(www\.|m\.)?facebook\.com\//i, '').replace(/[/?].*$/, '')),
    valid: (value) => FACEBOOK.test(value),
  },
  website: {
    normalize: (raw) => orNull(raw.trim()),
    valid: (value) => WEBSITE.test(value) && value.length <= MAX_WEBSITE_LENGTH,
  },
};

/** BusinessContacts — parses, drafts and links the contact channels of a business. */
export class BusinessContacts {
  /**
   * What the owner types, made storable: WhatsApp as a Colombian mobile in
   * E.164, Instagram without "@" or the instagram.com prefix, Facebook page
   * name without facebook.com, websites https only. Empty fields are null.
   */
  public static parseContact(input: Record<ContactField, string>): { value: BusinessContact; errors: ContactErrors } {
    const value = {} as Record<ContactField, string | null>;
    const errors: ContactErrors = {};
    for (const field of CONTACT_FIELDS) {
      const raw = input[field];
      const parsed = blank(raw) ? null : CHANNELS[field].normalize(raw);
      value[field] = parsed;
      if (!blank(raw) && (parsed === null || !CHANNELS[field].valid(parsed))) errors[field] = `${V}.${field}`;
    }
    return { value, errors };
  }

  /** Text for the form fields from what is stored. */
  public static contactDraft(contact: Partial<BusinessContact>): Record<ContactField, string> {
    return {
      whatsapp: Phone.parse(contact.whatsapp)?.display ?? '',
      instagram: contact.instagram ?? '',
      facebook: contact.facebook ?? '',
      website: contact.website ?? '',
    };
  }

  /** Links for the public profile; only well-formed values become links. */
  public static contactLinks(contact: Partial<BusinessContact>): ContactLink[] {
    const links: ContactLink[] = [];
    const phone = Phone.parse(contact.whatsapp);
    if (phone) links.push({ field: 'whatsapp', href: ExternalUrls.whatsapp(phone.e164.slice(1)), text: phone.display });
    if (contact.instagram && INSTAGRAM.test(contact.instagram)) {
      links.push({ field: 'instagram', href: ExternalUrls.instagram(contact.instagram), text: `@${contact.instagram}` });
    }
    if (contact.facebook && FACEBOOK.test(contact.facebook)) {
      links.push({ field: 'facebook', href: ExternalUrls.facebook(contact.facebook), text: contact.facebook });
    }
    if (contact.website && WEBSITE.test(contact.website)) {
      links.push({ field: 'website', href: contact.website, text: contact.website.replace(/^https:\/\//i, '').replace(/\/$/, '') });
    }
    return links;
  }
}

export interface ContactLink {
  readonly field: ContactField;
  readonly href: string;
  readonly text: string;
}
