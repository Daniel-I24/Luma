import { FieldRules } from './field-rule';
import { Spec } from './specification';
import { TextNormalizer } from './text-normalizer';

const MOBILE = /^\+573\d{9}$/;
/** Mobile 3XXXXXXXXX or landline 60 + area digit (1-8) + 7 digits, as +57. */
const CO_PHONE = /^\+57(?:3\d{9}|60[1-8]\d{7})$/;
const NATIONAL = /^(?:3\d{9}|60[1-8]\d{7})$/;
const COUNTRY = '57';
const EMAIL_MIN = 3;
const EMAIL_MAX = 254;
const WEBSITE_MAX = 200;
const NATIONAL_DIGITS = 10;
/** https, a public domain in lower case (letters TLD or punycode), only port 443, no user, no IP. */
const WEBSITE =
  /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})(?::443)?(?:[/?#]\S*)?$/;
/** Names that only exist inside a network. */
const PRIVATE_TLD = /\.(?:local|localhost|internal|lan|home|corp|test|invalid)(?=$|[:/?#])/i;
const WEBSITE_HOST = /^https:\/\/([^/:?#]+)/i;
const EMAIL =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
const INSTAGRAM_URL = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i;
const FACEBOOK_URL = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:facebook|fb)\.com\//i;

/** "+57 300 123 4567", "(601) 234 5678", "573001234567" → "+573001234567"; anything else stays as typed. */
function coPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const national = digits.length === COUNTRY.length + NATIONAL_DIGITS && digits.startsWith(COUNTRY) ? digits.slice(COUNTRY.length) : digits;
  return NATIONAL.test(national) ? `+${COUNTRY}${national}` : TextNormalizer.line(raw);
}

/**
 * The scheme and host in lower case. A site typed without "https://" is NOT
 * completed: verify-website treats it as blocked, so the owner is asked to
 * write it (validation.website says so).
 */
function website(raw: string): string {
  return TextNormalizer.line(raw).replace(/^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)/i, (prefix) => prefix.toLowerCase());
}

/** "@Cafe.Publico" or its profile URL → "cafe.publico". */
const handle = (url: RegExp, lower: boolean) => (raw: string): string => {
  const value = TextNormalizer.line(raw).replace(url, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  return lower ? value.toLowerCase() : value;
};

/** ContactRules — e-mail, phones and the public profiles of a business. */
export const ContactRules = {
  email: FieldRules.define({
    messageKey: 'validation.email',
    maxLength: EMAIL_MAX,
    normalize: (raw) => TextNormalizer.line(raw).toLowerCase(),
    spec: Spec.all(Spec.length(EMAIL_MIN, EMAIL_MAX), Spec.matches(EMAIL)),
  }),
  /** Colombian mobile (the account phone and WhatsApp: SMS and chats need a mobile). */
  mobilePhone: FieldRules.define({ messageKey: 'validation.mobilePhone', maxLength: 16, normalize: coPhone, spec: Spec.matches(MOBILE) }),
  /** Business phone: mobile or landline. */
  phone: FieldRules.define({ messageKey: 'validation.phone', maxLength: 16, normalize: coPhone, spec: Spec.matches(CO_PHONE) }),
  instagram: FieldRules.define({
    messageKey: 'validation.instagram',
    maxLength: 60,
    normalize: handle(INSTAGRAM_URL, true),
    spec: Spec.matches(/^[a-z0-9._]{1,30}$/),
  }),
  facebook: FieldRules.define({
    messageKey: 'validation.facebook',
    maxLength: 120,
    normalize: handle(FACEBOOK_URL, false),
    spec: Spec.matches(/^[A-Za-z0-9.-]{2,80}$/),
  }),
  website: FieldRules.define({
    messageKey: 'validation.website',
    maxLength: WEBSITE_MAX,
    normalize: website,
    spec: Spec.all(
      Spec.length(1, WEBSITE_MAX),
      Spec.matches(WEBSITE),
      Spec.of((value) => !PRIVATE_TLD.test(WEBSITE_HOST.exec(value)?.[1] ?? '')),
    ),
  }),
} as const;
