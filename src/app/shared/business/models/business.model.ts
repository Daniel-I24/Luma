/** Review state of a business (businesses_verification_status_valid). */
export const VERIFICATION_STATUSES = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'suspended',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

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
}

/**
 * BusinessHours — mirrors the public.business_hours table row.
 * day_of_week: 0 = Sunday … 6 = Saturday (matches JS Date.getDay()).
 */
export interface BusinessHours {
  id: string;
  business_id: string;
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
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
  created_at: string;
}

/**
 * BusinessStatus — the four states shown on the Luma map marker.
 * Maps directly to the --color-status-* design tokens.
 */
export type BusinessStatus = 'open' | 'closed' | 'opening-soon' | 'closing-soon';
