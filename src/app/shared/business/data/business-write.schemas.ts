import * as z from 'zod/mini';
import { BUSINESS_CATEGORY_VALUES } from './business-categories';

/**
 * Validation of what the business panel writes. Every limit mirrors a CHECK
 * constraint (supabase/migrations/*business*), so invalid data never reaches
 * the database; messages are translation keys.
 */
const V = 'businessPanel.validation';
export const PHONE_PATTERN = /^\+?[0-9][0-9 ]{6,19}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MAX_PRICE_COP = 2_147_483_647;

// Limits of the CHECK constraints (keep in sync with the migrations).
export const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;
export const MIN_ADDRESS_LENGTH = 5;
const MAX_ADDRESS_LENGTH = 200;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;
const MAX_DEPARTMENT_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 300;
const MIN_PREP_MINUTES = 5;
const MAX_PREP_MINUTES = 180;
const LAST_WEEKDAY = 6; // Saturday; Sunday is 0
const MAX_SECTION_LENGTH = 40;
export const MAX_SORT_ORDER = 9999;
const MIN_PROMOTION_TITLE = 3;
export const MAX_PROMOTION_TITLE = 80;
export const MIN_DISCOUNT_PERCENT = 5;
export const MAX_DISCOUNT_PERCENT = 90;

const text = (min: number, max: number, key: string): z.ZodMiniString<string> =>
  z.string(key).check(z.trim(), z.minLength(min, key), z.maxLength(max, key));
const optionalText = (max: number, key: string): z.ZodMiniNullable<z.ZodMiniString<string>> =>
  z.nullable(z.string(key).check(z.trim(), z.maxLength(max, key)));
export const httpsUrl = z.nullable(z.string().check(z.regex(/^https:\/\//i, `${V}.imageUrl`)));

const registerShape = {
  name: text(MIN_NAME_LENGTH, MAX_NAME_LENGTH, `${V}.name`),
  category: z.enum(BUSINESS_CATEGORY_VALUES, `${V}.category`),
  phone: z.nullable(z.string(`${V}.phone`).check(z.trim(), z.regex(PHONE_PATTERN, `${V}.phone`))),
  address: text(MIN_ADDRESS_LENGTH, MAX_ADDRESS_LENGTH, `${V}.address`),
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
  description: optionalText(MAX_DESCRIPTION_LENGTH, `${V}.description`),
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
  name: text(1, MAX_NAME_LENGTH, `${V}.itemName`),
  description: optionalText(MAX_DESCRIPTION_LENGTH, `${V}.description`),
  price_cop: z
    .int(`${V}.price`)
    .check(z.minimum(0, `${V}.price`), z.maximum(MAX_PRICE_COP, `${V}.price`)),
  section: optionalText(MAX_SECTION_LENGTH, `${V}.section`),
  sort_order: z
    .int(`${V}.sortOrder`)
    .check(z.minimum(0, `${V}.sortOrder`), z.maximum(MAX_SORT_ORDER, `${V}.sortOrder`)),
  is_available: z.boolean(),
  image_url: httpsUrl,
});
export type MenuItemInput = z.infer<typeof menuItemSchema>;

export const promotionSchema = z
  .object({
    title: text(MIN_PROMOTION_TITLE, MAX_PROMOTION_TITLE, `${V}.promoTitle`),
    description: optionalText(MAX_DESCRIPTION_LENGTH, `${V}.description`),
    starts_at: z.iso.datetime({ offset: true, message: `${V}.date` }),
    ends_at: z.iso.datetime({ offset: true, message: `${V}.date` }),
    image_url: httpsUrl,
    menu_item_id: z.nullable(z.string()),
    discount_percent: z.nullable(
      z.int(`${V}.discount`).check(z.minimum(MIN_DISCOUNT_PERCENT, `${V}.discount`), z.maximum(MAX_DISCOUNT_PERCENT, `${V}.discount`)),
    ),
  })
  .check(
    z.refine((promo) => Date.parse(promo.ends_at) > Date.parse(promo.starts_at), {
      message: `${V}.datesOrder`,
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
