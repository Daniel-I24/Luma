

/** Review state of a business (businesses_verification_status_valid). */
export type VerificationStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended';

/**
 * Business — mirrors the public.businesses table row.
 * All fields are non-optional unless the column is nullable in the DB.
 */
export interface Business {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  category: string;
  logo_url: string | null;
  cover_url: string | null;
  latitude: number;
  longitude: number;
  address: string;
  phone: string | null;
  is_active: boolean;
  /** Usual preparation time in minutes (5-180). */
  prep_minutes: number;
  /** Public only when published (is_active) and approved. */
  verification_status: VerificationStatus;
  /** Note of the review team when rejected or suspended. */
  verification_note: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  /** No new orders until then ('infinity': until resumed); see BusinessPause. */
  orders_paused_until?: string | null;
  /** Department chosen by the owner. */
  department?: string | null;
  /** DANE municipality code chosen by the owner (five digits). */
  city_dane_code?: string | null;
  /** Sector the owner wrote (round 10; optional). */
  neighborhood?: string | null;
  /** "Al frente del parque" (round 10; optional). */
  address_reference?: string | null;
  /** Public contact (migration business_showcase; absent before it is applied). */
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  /** When the review team verified each contact (only admin_verify_contact writes them; round5). */
  phone_verified_at?: string | null;
  whatsapp_verified_at?: string | null;
  instagram_verified_at?: string | null;
  facebook_verified_at?: string | null;
  website_verified_at?: string | null;
}

/** 0 = Sunday … 6 = Saturday (JS Date.getDay()). */
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * BusinessHours — mirrors the public.business_hours table row.
 * day_of_week: 0 = Sunday … 6 = Saturday (matches JS Date.getDay()).
 */
export interface BusinessHours {
  id: string;
  business_id: string;
  day_of_week: Weekday;
  opens_at: string; // 'HH:MM:SS'
  closes_at: string; // 'HH:MM:SS'
  is_closed: boolean;
}

/**
 * Promotion — mirrors the public.promotions table row.
 */
export interface Promotion {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  starts_at: string; // ISO-8601
  ends_at: string; // ISO-8601
  is_active: boolean;
  /** Item the discount applies to, or null for a text-only promotion. */
  menu_item_id: string | null;
  /** 5-90 when the promotion discounts menu_item_id. */
  discount_percent: number | null;
  created_at: string;
  /** When the owner told the followers (push_notifications; absent before it). */
  notified_at?: string | null;
}

/**
 * BusinessStatus — the four states shown on the Luma map marker.
 * Maps directly to the --color-status-* design tokens.
 */
export type BusinessStatus = 'open' | 'closed' | 'opening-soon' | 'closing-soon';

/**
 * BusinessPause — "Pedidos en pausa": the owner stops new orders for a while
 * (businesses.orders_paused_until; 'infinity' means until resumed). The
 * server refuses orders while paused (business_paused); the app only shows it.
 */
export class BusinessPause {
  /** Minutes the owner can choose; -1 is "until I resume". */
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- data table: pause lengths in minutes (-1 until reopened)
  public static readonly OPTIONS = [15, 30, 60, 120, -1] as const;
  public static readonly UNTIL_RESUMED = -1;
  /** PostgREST sends timestamptz 'infinity' as text (also '+infinity' from some clients). */
  private static readonly INFINITY = /^\+?infinity$/i;

  /** True while orders are paused. */
  public static isPaused(pausedUntil: string | null | undefined, now = Date.now()): boolean {
    if (!pausedUntil) return false;
    if (BusinessPause.isIndefinite(pausedUntil)) return true;
    const end = Date.parse(pausedUntil);
    return Number.isFinite(end) && end > now;
  }

  /** True when the pause has no end time ("hasta que se reanude"). */
  public static isIndefinite(pausedUntil: string | null | undefined): boolean {
    return typeof pausedUntil === 'string' && BusinessPause.INFINITY.test(pausedUntil.trim());
  }
}
