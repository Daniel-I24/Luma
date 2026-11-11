/**
 * Invented data of the e2e tests: one owner with a public bakery in Pasto,
 * its menu and hours. No real person, key or project.
 */
export const OWNER_ID = '00000000-0000-4000-8000-00000000000a';
export const BUSINESS_ID = '00000000-0000-4000-8000-0000000000b1';
export const OWNER_EMAIL = 'dueno@example.test';
export const CUSTOMER_ID = '00000000-0000-4000-8000-00000000000c';
export const CUSTOMER_EMAIL = 'cliente@example.test';
export const PASSWORD = 'Luma-Prueba-2026';
export const CODE = '123456';

const NOW = () => new Date().toISOString();

const profile = (id, accountType, name) => ({
  id, account_type: accountType, display_name: name, full_name: `${name} Prueba`, phone: '3001234567',
  onboarding_seen_version: 99, residence_department: 'Nariño', residence_city: 'Pasto', residence_dane_code: '52001',
  residence_neighborhood: 'Centro', avatar_path: null, show_avatar_to_business: false,
});

/** Every table the flows read, as arrays of rows. */
export function seed() {
  const business = {
    id: BUSINESS_ID, owner_id: OWNER_ID, name: 'Panadería Doña Rosa', description: 'Pan de yuca y café de Nariño.',
    category: 'Panadería', latitude: 1.2136, longitude: -77.2811, address: 'Carrera 27 # 15-40', phone: '+573001234567',
    whatsapp: null, instagram: null, facebook: null, website: null, logo_url: null, cover_url: null, is_active: true,
    verification_status: 'approved', verification_note: null, prep_minutes: 20, department: 'Nariño', city_dane_code: '52001',
    orders_paused_until: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
  };
  const menu = [
    { name: 'Pan de yuca', price_cop: 2500, section: 'Panadería' },
    { name: 'Tinto', price_cop: 2000, section: 'Bebidas' },
  ].map((item, i) => ({
    id: `00000000-0000-4000-8000-0000000000c${i}`, business_id: BUSINESS_ID, description: 'Recién hecho.',
    image_url: null, is_available: true, sort_order: i, created_at: NOW(), updated_at: NOW(), ...item,
  }));
  return {
    profiles: [profile(OWNER_ID, 'business_owner', 'Rosa'), profile(CUSTOMER_ID, 'customer', 'Ana')],
    businesses: [business],
    menu_items: menu,
    business_hours: Array.from({ length: 7 }, (_, day) => ({
      business_id: BUSINESS_ID, day_of_week: day, opens_at: '00:00:00', closes_at: '23:59:59', is_closed: false,
    })),
    promotions: [],
    business_ratings: [],
    reviews_with_author: [],
    favorites: [],
    notifications: [],
    contact_verifications: [],
    orders: [],
    order_items: [],
    business_photos: [],
    business_legal: [],
    business_verification_docs: [],
    notification_preferences: [],
    devices: [],
  };
}

export const newProfile = profile;
