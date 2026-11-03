import { Phone } from '@shared/account/phone';

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

const blank = (value: string) => value.trim() === '';

/**
 * What the owner types, made storable: WhatsApp as a Colombian mobile in
 * E.164, Instagram without "@" or the instagram.com prefix, Facebook page
 * name without facebook.com, websites https only. Empty fields are null.
 */
export function parseContact(input: Record<ContactField, string>): { value: BusinessContact; errors: ContactErrors } {
  const errors: ContactErrors = {};
  const whatsapp = blank(input.whatsapp) ? null : (Phone.parse(input.whatsapp)?.e164 ?? null);
  if (!blank(input.whatsapp) && !whatsapp) errors.whatsapp = `${V}.whatsapp`;

  const handle = input.instagram.trim().replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '')
    .replace(/\/.*$/, '').toLowerCase();
  const instagram = handle === '' ? null : handle;
  if (instagram && !INSTAGRAM.test(instagram)) errors.instagram = `${V}.instagram`;

  const page = input.facebook.trim().replace(/^(https?:\/\/)?(www\.|m\.)?facebook\.com\//i, '').replace(/[/?].*$/, '');
  const facebook = page === '' ? null : page;
  if (facebook && !FACEBOOK.test(facebook)) errors.facebook = `${V}.facebook`;

  const site = input.website.trim();
  const website = site === '' ? null : site;
  if (website && (!WEBSITE.test(website) || website.length > 200)) errors.website = `${V}.website`;

  return { value: { whatsapp, instagram, facebook, website }, errors };
}

/** Text for the form fields from what is stored. */
export function contactDraft(contact: Partial<BusinessContact>): Record<ContactField, string> {
  return {
    whatsapp: Phone.parse(contact.whatsapp)?.display ?? '',
    instagram: contact.instagram ?? '',
    facebook: contact.facebook ?? '',
    website: contact.website ?? '',
  };
}

export interface ContactLink {
  readonly field: ContactField;
  readonly href: string;
  readonly text: string;
}

/** Links for the public profile; only well-formed values become links. */
export function contactLinks(contact: Partial<BusinessContact>): ContactLink[] {
  const links: ContactLink[] = [];
  const phone = Phone.parse(contact.whatsapp);
  if (phone) links.push({ field: 'whatsapp', href: `https://wa.me/${phone.e164.slice(1)}`, text: phone.display });
  if (contact.instagram && INSTAGRAM.test(contact.instagram)) {
    links.push({ field: 'instagram', href: `https://instagram.com/${contact.instagram}`, text: `@${contact.instagram}` });
  }
  if (contact.facebook && FACEBOOK.test(contact.facebook)) {
    links.push({ field: 'facebook', href: `https://facebook.com/${contact.facebook}`, text: contact.facebook });
  }
  if (contact.website && WEBSITE.test(contact.website)) {
    links.push({ field: 'website', href: contact.website, text: contact.website.replace(/^https:\/\//i, '').replace(/\/$/, '') });
  }
  return links;
}
