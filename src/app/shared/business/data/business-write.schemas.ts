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

const text = (min: number, max: number, key: string) =>
  z.string(key).check(z.trim(), z.minLength(min, key), z.maxLength(max, key));
const optionalText = (max: number, key: string) =>
  z.nullable(z.string(key).check(z.trim(), z.maxLength(max, key)));
const httpsUrl = z.nullable(z.string().check(z.regex(/^https:\/\//i, `${V}.imageUrl`)));

const registerShape = {
  name: text(2, 80, `${V}.name`),
  category: z.enum(BUSINESS_CATEGORY_VALUES, `${V}.category`),
  phone: z.nullable(z.string(`${V}.phone`).check(z.trim(), z.regex(PHONE_PATTERN, `${V}.phone`))),
  address: text(5, 200, `${V}.address`),
  latitude: z
    .number(`${V}.location`)
    .check(z.gte(-90, `${V}.location`), z.lte(90, `${V}.location`)),
  longitude: z
    .number(`${V}.location`)
    .check(z.gte(-180, `${V}.location`), z.lte(180, `${V}.location`)),
};

/** Registration form (/business/new). */
export const newBusinessSchema = z.object(registerShape);
export type NewBusinessInput = z.infer<typeof newBusinessSchema>;

/** Information form (/business/:id/info). */
export const businessInfoSchema = z.object({
  ...registerShape,
  description: optionalText(300, `${V}.description`),
  prep_minutes: z
    .int(`${V}.prepMinutes`)
    .check(z.minimum(5, `${V}.prepMinutes`), z.maximum(180, `${V}.prepMinutes`)),
});
export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;

/** One day of the weekly schedule; closing before opening crosses midnight. */
export const dayHoursSchema = z
  .object({
    day_of_week: z.int().check(z.minimum(0), z.maximum(6)),
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
  name: text(1, 80, `${V}.itemName`),
  description: optionalText(300, `${V}.description`),
  price_cop: z
    .int(`${V}.price`)
    .check(z.minimum(0, `${V}.price`), z.maximum(MAX_PRICE_COP, `${V}.price`)),
  section: optionalText(40, `${V}.section`),
  sort_order: z
    .int(`${V}.sortOrder`)
    .check(z.minimum(0, `${V}.sortOrder`), z.maximum(9999, `${V}.sortOrder`)),
  is_available: z.boolean(),
  image_url: httpsUrl,
});
export type MenuItemInput = z.infer<typeof menuItemSchema>;

export const promotionSchema = z
  .object({
    title: text(3, 80, `${V}.promoTitle`),
    description: optionalText(300, `${V}.description`),
    starts_at: z.iso.datetime({ offset: true, message: `${V}.date` }),
    ends_at: z.iso.datetime({ offset: true, message: `${V}.date` }),
    image_url: httpsUrl,
  })
  .check(
    z.refine((promo) => Date.parse(promo.ends_at) > Date.parse(promo.starts_at), {
      message: `${V}.datesOrder`,
      path: ['ends_at'],
    }),
  );
export type PromotionInput = z.infer<typeof promotionSchema>;
