import * as z from 'zod/mini';
import { ContactRules } from '@core/validation/contact-rules';
import { DISCOUNT_MAX, DISCOUNT_MIN, PRICE_MAX_COP, PRICE_MIN_COP, PROMOTION_MAX_DAYS } from '@core/validation/number-rules';
import { TextRules } from '@core/validation/text-rules';
import { ZodRules } from '@core/validation/zod-rules';
import { BUSINESS_CATEGORY_VALUES } from './business-categories';

/**
 * Validation of what the business panel writes. Names, phones, addresses
 * and texts use the rules of core/validation, the same the database checks
 * (20261104000000_round7.sql); every other limit mirrors a CHECK constraint
 * (supabase/migrations/*business*). Messages are translation keys.
 */
const V = 'businessPanel.validation';
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MS_PER_DAY = 86_400_000;

// Limits of the CHECK constraints (keep in sync with the migrations).
export const MIN_NAME_LENGTH = 2;
export const MIN_ADDRESS_LENGTH = 5;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;
const MAX_DEPARTMENT_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 300;
const MIN_PREP_MINUTES = 5;
const MAX_PREP_MINUTES = 180;
const LAST_WEEKDAY = 6; // Saturday; Sunday is 0
export const MAX_SORT_ORDER = 9999;
export const MAX_PROMOTION_TITLE = 80;

const text = (min: number, max: number, key: string): z.ZodMiniString<string> =>
  z.string(key).check(z.trim(), z.minLength(min, key), z.maxLength(max, key));
const httpsUrl = z.nullable(z.string().check(z.regex(/^https:\/\//i, `${V}.imageUrl`)));

const registerShape = {
  name: ZodRules.text(TextRules.businessName),
  category: z.enum(BUSINESS_CATEGORY_VALUES, `${V}.category`),
  phone: ZodRules.optionalText(ContactRules.phone),
  address: ZodRules.text(TextRules.address),
  latitude: z
    .number(`${V}.location`)
    .check(z.gte(-MAX_LATITUDE, `${V}.location`), z.lte(MAX_LATITUDE, `${V}.location`)),
  longitude: z
    .number(`${V}.location`)
    .check(z.gte(-MAX_LONGITUDE, `${V}.location`), z.lte(MAX_LONGITUDE, `${V}.location`)),
  // Chosen in the location step (businesses.department, city_dane_code).
  department: z.optional(z.nullable(text(MIN_NAME_LENGTH, MAX_DEPARTMENT_LENGTH, `${V}.municipality`))),
  city_dane_code: z.optional(z.nullable(z.string(`${V}.municipality`).check(z.regex(/^[0-9]{5}$/, `${V}.municipality`)))),
};

/** Registration form (/business/new). */
export const newBusinessSchema = z.object(registerShape);
export type NewBusinessInput = z.infer<typeof newBusinessSchema>;

/** Information form (/owner/:id/business/info). */
export const businessInfoSchema = z.object({
  ...registerShape,
  description: ZodRules.optionalText(TextRules.freeText(MAX_DESCRIPTION_LENGTH)),
  prep_minutes: z
    .int(`${V}.prepMinutes`)
    .check(z.minimum(MIN_PREP_MINUTES, `${V}.prepMinutes`), z.maximum(MAX_PREP_MINUTES, `${V}.prepMinutes`)),
});
export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;

/** Logo and cover of a business (Storage URLs). */
export const businessImagesSchema = z.partial(
  z.object({ logo_url: httpsUrl, cover_url: httpsUrl }),
);
export type BusinessImagesInput = z.infer<typeof businessImagesSchema>;

/** One day of the weekly schedule; closing before opening crosses midnight. */
export const dayHoursSchema = z
  .object({
    day_of_week: z.int().check(z.minimum(0), z.maximum(LAST_WEEKDAY)),
    opens_at: z.string(`${V}.time`).check(z.regex(TIME_PATTERN, `${V}.time`)),
    closes_at: z.string(`${V}.time`).check(z.regex(TIME_PATTERN, `${V}.time`)),
    is_closed: z.boolean(),
  })
  .check(
    z.refine((day) => day.is_closed || day.opens_at !== day.closes_at, {
      message: `${V}.sameTimes`,
      path: ['closes_at'],
    }),
  );
export type DayHoursInput = z.infer<typeof dayHoursSchema>;

export const menuItemSchema = z.object({
  name: ZodRules.text(TextRules.productName),
  description: ZodRules.optionalText(TextRules.freeText(MAX_DESCRIPTION_LENGTH)),
  price_cop: z
    .int('validation.price')
    .check(z.minimum(PRICE_MIN_COP, 'validation.price'), z.maximum(PRICE_MAX_COP, 'validation.price')),
  section: ZodRules.optionalText(TextRules.menuSection),
  sort_order: z
    .int(`${V}.sortOrder`)
    .check(z.minimum(0, `${V}.sortOrder`), z.maximum(MAX_SORT_ORDER, `${V}.sortOrder`)),
  is_available: z.boolean(),
  image_url: httpsUrl,
});
export type MenuItemInput = z.infer<typeof menuItemSchema>;

export const promotionSchema = z
  .object({
    title: ZodRules.text(TextRules.promotionTitle),
    description: ZodRules.optionalText(TextRules.freeText(MAX_DESCRIPTION_LENGTH)),
    starts_at: z.iso.datetime({ offset: true, message: 'validation.date' }),
    ends_at: z.iso.datetime({ offset: true, message: 'validation.date' }),
    image_url: httpsUrl,
    menu_item_id: z.nullable(z.string()),
    discount_percent: z.nullable(
      z.int('validation.discount').check(z.minimum(DISCOUNT_MIN, 'validation.discount'), z.maximum(DISCOUNT_MAX, 'validation.discount')),
    ),
  })
  .check(
    z.refine((promo) => Date.parse(promo.ends_at) > Date.parse(promo.starts_at), {
      message: 'validation.datesOrder',
      path: ['ends_at'],
    }),
    // Mirrors promotions_period_length.
    z.refine((promo) => Date.parse(promo.ends_at) - Date.parse(promo.starts_at) <= PROMOTION_MAX_DAYS * MS_PER_DAY, {
      message: 'validation.datesTooLong',
      path: ['ends_at'],
    }),
    // Mirrors promotions_discount_needs_item.
    z.refine((promo) => promo.discount_percent === null || promo.menu_item_id !== null, {
      message: `${V}.discountNeedsItem`,
      path: ['menu_item_id'],
    }),
  );

/** Most promotions active at once per business (promotions_guard, app_settings). */
export const MAX_ACTIVE_PROMOTIONS = 5;
export type PromotionInput = z.infer<typeof promotionSchema>;
