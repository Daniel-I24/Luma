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
  opens_at: string;   // 'HH:MM:SS'
  closes_at: string;  // 'HH:MM:SS'
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
  starts_at: string;  // ISO-8601
  ends_at: string;    // ISO-8601
  is_active: boolean;
  created_at: string;
}

/**
 * BusinessStatus — the four states shown on the Luma map marker.
 * Maps directly to the --status-* design tokens.
 */
export type BusinessStatus =
  | 'open'
  | 'closed'
  | 'opening-soon'
  | 'closing-soon';
