import { Phone } from '@shared/account/phone';
import { ExternalUrls } from '@core/config/external-urls';
import { ContactRules } from '@core/validation/contact-rules';
import type { FieldRule } from '@core/validation/field-rule';

/** The public contact of a business, as stored (mirrors the business_showcase CHECKs). */
export interface BusinessContact {
  readonly whatsapp: string | null;
  readonly instagram: string | null;
  readonly facebook: string | null;
  readonly website: string | null;
}

export type ContactField = keyof BusinessContact;
export type ContactErrors = Partial<Record<ContactField, string>>;

const CONTACT_FIELDS: readonly ContactField[] = ['whatsapp', 'instagram', 'facebook', 'website'];

/** How each channel is cleaned up and checked: the rules of core/validation, the same as the database. */
export const CONTACT_RULES: Readonly<Record<ContactField, FieldRule>> = {
  whatsapp: ContactRules.mobilePhone,
  instagram: ContactRules.instagram,
  facebook: ContactRules.facebook,
  website: ContactRules.website,
};

const valid = (field: ContactField, value: string | null | undefined): value is string =>
  !!value && CONTACT_RULES[field].spec.isSatisfiedBy(value);

/** BusinessContacts — parses, drafts and links the contact channels of a business. */
export class BusinessContacts {
  /**
   * What the owner types, made storable: WhatsApp as a Colombian mobile in
   * E.164, Instagram without "@" or the instagram.com prefix, Facebook page
   * name without facebook.com, websites https on a public domain. Empty
   * fields are null.
   */
  public static parseContact(input: Record<ContactField, string>): { value: BusinessContact; errors: ContactErrors } {
    const value = {} as Record<ContactField, string | null>;
    const errors: ContactErrors = {};
    for (const field of CONTACT_FIELDS) {
      const parsed = CONTACT_RULES[field].normalize(input[field]);
      value[field] = parsed === '' ? null : parsed;
      if (parsed !== '' && !valid(field, parsed)) errors[field] = CONTACT_RULES[field].messageKey;
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
    if (valid('instagram', contact.instagram)) {
      links.push({ field: 'instagram', href: ExternalUrls.instagram(contact.instagram), text: `@${contact.instagram}` });
    }
    if (valid('facebook', contact.facebook)) {
      links.push({ field: 'facebook', href: ExternalUrls.facebook(contact.facebook), text: contact.facebook });
    }
    if (valid('website', contact.website)) {
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
